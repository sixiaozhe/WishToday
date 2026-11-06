use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::Mutex,
};
use tauri::{Manager, State};

struct DbManager {
    connections: Mutex<HashMap<String, Connection>>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Param {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    String(String),
}

fn to_sql_value(param: &Param) -> SqlValue {
    match param {
        Param::Null => SqlValue::Null,
        Param::Bool(value) => SqlValue::Integer(if *value { 1 } else { 0 }),
        Param::Int(value) => SqlValue::Integer(*value),
        Param::Float(value) => SqlValue::Real(*value),
        Param::String(value) => SqlValue::Text(value.clone()),
    }
}

#[derive(Deserialize)]
struct BatchStatement {
    sql: String,
    #[serde(default)]
    params: Vec<Param>,
}

#[derive(Serialize)]
struct DbInfo {
    storage: &'static str,
    sqlite: String,
    database_name: String,
}

fn sanitize_name(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    if sanitized.is_empty() {
        "dayline.sqlite3".to_string()
    } else {
        sanitized
    }
}

fn database_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法确定桌面数据目录：{error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建数据目录：{error}"))?;
    Ok(directory.join(name))
}

fn lock_error() -> String {
    "数据库连接锁失败".to_string()
}

#[tauri::command]
fn db_open(
    app: tauri::AppHandle,
    state: State<'_, DbManager>,
    database_name: String,
    schema: String,
) -> Result<DbInfo, String> {
    let name = sanitize_name(&database_name);
    let mut connections = state.connections.lock().map_err(|_| lock_error())?;

    if !connections.contains_key(&name) {
        let path = database_path(&app, &name)?;
        let connection = Connection::open(&path)
            .map_err(|error| format!("无法打开桌面数据库 {}：{error}", path.display()))?;
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|error| error.to_string())?;

        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(|error| error.to_string())?;
        if version < 1 {
            connection
                .execute_batch(&schema)
                .map_err(|error| format!("初始化数据库结构失败：{error}"))?;
            connection
                .execute_batch("PRAGMA user_version = 1;")
                .map_err(|error| error.to_string())?;
        }
        connections.insert(name.clone(), connection);
    }

    let connection = connections
        .get(&name)
        .ok_or_else(|| "数据库未打开".to_string())?;
    let version: String = connection
        .query_row("select sqlite_version()", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;

    Ok(DbInfo {
        storage: "tauri",
        sqlite: version,
        database_name: name,
    })
}

#[tauri::command]
fn db_all(
    state: State<'_, DbManager>,
    database_name: String,
    sql: String,
    params: Vec<Param>,
) -> Result<Vec<Map<String, Value>>, String> {
    let name = sanitize_name(&database_name);
    let connections = state.connections.lock().map_err(|_| lock_error())?;
    let connection = connections
        .get(&name)
        .ok_or_else(|| "数据库未打开".to_string())?;

    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let columns: Vec<String> = statement
        .column_names()
        .iter()
        .map(|column| column.to_string())
        .collect();

    let mut rows = statement
        .query(params_from_iter(params.iter().map(to_sql_value)))
        .map_err(|error| error.to_string())?;
    let mut result = Vec::new();

    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut object = Map::new();
        for (index, column) in columns.iter().enumerate() {
            let value = row.get_ref(index).map_err(|error| error.to_string())?;
            object.insert(column.clone(), sqlite_value_to_json(value));
        }
        result.push(object);
    }

    Ok(result)
}

fn sqlite_value_to_json(value: rusqlite::types::ValueRef<'_>) -> Value {
    match value {
        rusqlite::types::ValueRef::Null => Value::Null,
        rusqlite::types::ValueRef::Integer(value) => Value::Number(Number::from(value)),
        rusqlite::types::ValueRef::Real(value) => {
            Value::Number(Number::from_f64(value).unwrap_or(Number::from(0)))
        }
        rusqlite::types::ValueRef::Text(bytes) => {
            Value::String(String::from_utf8_lossy(bytes).to_string())
        }
        rusqlite::types::ValueRef::Blob(bytes) => Value::Array(
            bytes
                .iter()
                .map(|byte| Value::Number(Number::from(*byte)))
                .collect(),
        ),
    }
}

#[tauri::command]
fn db_run(
    state: State<'_, DbManager>,
    database_name: String,
    sql: String,
    params: Vec<Param>,
) -> Result<(), String> {
    let name = sanitize_name(&database_name);
    let connections = state.connections.lock().map_err(|_| lock_error())?;
    let connection = connections
        .get(&name)
        .ok_or_else(|| "数据库未打开".to_string())?;
    connection
        .execute(&sql, params_from_iter(params.iter().map(to_sql_value)))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn db_batch(
    state: State<'_, DbManager>,
    database_name: String,
    statements: Vec<BatchStatement>,
) -> Result<(), String> {
    let name = sanitize_name(&database_name);
    let mut connections = state.connections.lock().map_err(|_| lock_error())?;
    let connection = connections
        .get_mut(&name)
        .ok_or_else(|| "数据库未打开".to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;

    for statement in statements {
        transaction
            .execute(
                &statement.sql,
                params_from_iter(statement.params.iter().map(to_sql_value)),
            )
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn db_close(state: State<'_, DbManager>, database_name: String) -> Result<(), String> {
    let name = sanitize_name(&database_name);
    let mut connections = state.connections.lock().map_err(|_| lock_error())?;
    connections.remove(&name);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DbManager {
            connections: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            db_open, db_all, db_run, db_batch, db_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
