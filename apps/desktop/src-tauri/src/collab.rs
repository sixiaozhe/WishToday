use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    net::{Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream, UdpSocket},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};

const DISCOVERY_PORT: u16 = 45454;
const APP_TAG: &str = "wish-today";

type Peers = Arc<Mutex<HashMap<String, PeerInfo>>>;
type Conns = Arc<Mutex<HashMap<String, Connection>>>;
type Identity = Arc<Mutex<(String, String)>>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
    pub device_id: String,
    pub name: String,
    pub address: String,
    pub online: bool,
    pub last_seen: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabInfo {
    pub supported: bool,
    pub device_id: String,
    pub name: String,
    pub port: u16,
    pub address: String,
    pub local_address: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Beacon {
    app: String,
    version: u8,
    device_id: String,
    name: String,
    port: u16,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Hello {
    device_id: String,
    name: String,
}

struct Connection {
    id: String,
    writer: Arc<Mutex<TcpStream>>,
}

pub struct CollabManager {
    peers: Peers,
    conns: Conns,
    identity: Identity,
    started: Mutex<Option<u16>>,
}

impl CollabManager {
    pub fn new() -> Self {
        Self {
            peers: Arc::new(Mutex::new(HashMap::new())),
            conns: Arc::new(Mutex::new(HashMap::new())),
            identity: Arc::new(Mutex::new((String::new(), String::new()))),
            started: Mutex::new(None),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn local_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    Some(socket.local_addr().ok()?.ip().to_string())
}

fn connection_id(device_id: &str) -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    format!(
        "{}-{}-{}",
        device_id,
        now_ms(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

fn into_blocking_reader(reader: BufReader<TcpStream>) -> BufReader<TcpStream> {
    let stream = reader.into_inner();
    let _ = stream.set_read_timeout(None);
    BufReader::new(stream)
}

fn write_line(stream: &mut TcpStream, value: &Value) -> std::io::Result<()> {
    let mut data = serde_json::to_vec(value).unwrap_or_default();
    data.push(b'\n');
    stream.write_all(&data)?;
    stream.flush()
}

fn peers_snapshot(peers: &Peers) -> Vec<PeerInfo> {
    let mut list: Vec<PeerInfo> = peers
        .lock()
        .map(|map| map.values().cloned().collect())
        .unwrap_or_default();
    list.sort_by(|a, b| a.name.cmp(&b.name));
    list
}

fn emit_peers(app: &AppHandle, peers: &Peers) {
    let _ = app.emit("collab-peers", peers_snapshot(peers));
}

fn mark_peer_online(peers: &Peers, device_id: &str, name: &str, address: &str) {
    if let Ok(mut map) = peers.lock() {
        let entry = map
            .entry(device_id.to_string())
            .or_insert_with(|| PeerInfo {
                device_id: device_id.to_string(),
                name: name.to_string(),
                address: address.to_string(),
                online: true,
                last_seen: now_ms(),
            });
        entry.name = name.to_string();
        if !address.is_empty() {
            entry.address = address.to_string();
        }
        entry.online = true;
        entry.last_seen = now_ms();
    }
}

fn register_connection(
    conns: &Conns,
    device_id: &str,
    name: &str,
    writer: TcpStream,
) -> String {
    let id = connection_id(device_id);
    let _ = name;
    let new_connection = Connection {
        id: id.clone(),
        writer: Arc::new(Mutex::new(writer)),
    };
    let old = conns
        .lock()
        .ok()
        .and_then(|mut map| map.insert(device_id.to_string(), new_connection));
    if let Some(old) = old {
        if let Ok(stream) = old.writer.lock() {
            let _ = stream.shutdown(Shutdown::Both);
        }
    }
    id
}

fn read_loop(
    app: AppHandle,
    reader: BufReader<TcpStream>,
    device_id: String,
    name: String,
    conns: Conns,
    peers: Peers,
    conn_id: String,
) {
    for line in reader.lines() {
        let Ok(text) = line else { break };
        let trimmed = text.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        if let Ok(mut map) = peers.lock() {
            if let Some(peer) = map.get_mut(&device_id) {
                peer.online = true;
                peer.last_seen = now_ms();
            }
        }
        let message_type = value.get("type").and_then(Value::as_str);
        if message_type == Some("hello") || message_type == Some("ping") {
            continue;
        }
        let _ = app.emit(
            "collab-message",
            json!({
              "from": device_id,
              "name": name,
              "message": value,
            }),
        );
    }

    let should_remove = conns
        .lock()
        .ok()
        .and_then(|map| map.get(&device_id).map(|item| item.id == conn_id))
        .unwrap_or(false);
    if should_remove {
        if let Ok(mut map) = conns.lock() {
            map.remove(&device_id);
        }
        if let Ok(mut map) = peers.lock() {
            if let Some(peer) = map.get_mut(&device_id) {
                peer.online = false;
            }
        }
        emit_peers(&app, &peers);
    }
}

fn handle_inbound(
    app: AppHandle,
    stream: TcpStream,
    peers: Peers,
    conns: Conns,
    identity: Identity,
) -> Result<(), String> {
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
    let mut writer = stream.try_clone().map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|error| format!("读取握手失败：{error}"))?;
    let hello: Hello = serde_json::from_str(line.trim())
        .map_err(|error| format!("无效的握手消息：{error}"))?;
    if hello.device_id.is_empty() {
        return Err("缺少设备标识".to_string());
    }

    let (our_id, our_name) = identity
        .lock()
        .map(|value| value.clone())
        .unwrap_or_default();
    let _ = write_line(
        &mut writer,
        &json!({ "app": APP_TAG, "deviceId": our_id, "name": our_name }),
    );

    mark_peer_online(&peers, &hello.device_id, &hello.name, "");
    let conn_id = register_connection(&conns, &hello.device_id, &hello.name, writer);
    emit_peers(&app, &peers);
    read_loop(
        app,
        into_blocking_reader(reader),
        hello.device_id,
        hello.name,
        conns,
        peers,
        conn_id,
    );
    Ok(())
}

fn handle_outbound(
    app: AppHandle,
    address: String,
    peers: Peers,
    conns: Conns,
    identity: Identity,
) -> Result<(), String> {
    let mut stream = TcpStream::connect(&address)
        .map_err(|error| format!("无法连接 {address}：{error}"))?;
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(15)));
    let (our_id, our_name) = identity
        .lock()
        .map(|value| value.clone())
        .unwrap_or_default();
    write_line(
        &mut stream,
        &json!({ "app": APP_TAG, "deviceId": our_id, "name": our_name }),
    )
    .map_err(|error| format!("发送握手失败：{error}"))?;

    let mut reader = BufReader::new(stream.try_clone().map_err(|error| error.to_string())?);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|error| format!("等待对方握手失败：{error}"))?;
    let hello: Hello = serde_json::from_str(line.trim())
        .map_err(|error| format!("对方握手无效：{error}"))?;
    if hello.device_id.is_empty() {
        return Err("对方缺少设备标识".to_string());
    }

    mark_peer_online(&peers, &hello.device_id, &hello.name, &address);
    let writer = stream.try_clone().map_err(|error| error.to_string())?;
    let conn_id = register_connection(&conns, &hello.device_id, &hello.name, writer);
    emit_peers(&app, &peers);
    read_loop(
        app,
        into_blocking_reader(reader),
        hello.device_id,
        hello.name,
        conns,
        peers,
        conn_id,
    );
    Ok(())
}

fn spawn_connection(
    app: AppHandle,
    address: String,
    peers: Peers,
    conns: Conns,
    identity: Identity,
) {
    thread::spawn(move || {
        let _ = handle_outbound(app, address, peers, conns, identity);
    });
}

fn start_discovery(
    app: AppHandle,
    port: u16,
    peers: Peers,
    conns: Conns,
    identity: Identity,
) -> Result<(), String> {
    let socket = socket2::Socket::new(
        socket2::Domain::IPV4,
        socket2::Type::DGRAM,
        Some(socket2::Protocol::UDP),
    )
    .map_err(|error| format!("无法创建发现套接字：{error}"))?;
    socket
        .set_reuse_address(true)
        .map_err(|error| format!("无法复用发现端口：{error}"))?;
    let bind_address: SocketAddr = ([0, 0, 0, 0], DISCOVERY_PORT).into();
    socket
        .bind(&bind_address.into())
        .map_err(|error| format!("无法监听发现端口 {DISCOVERY_PORT}：{error}"))?;
    socket
        .set_broadcast(true)
        .map_err(|error| format!("无法启用广播：{error}"))?;
    let multicast_group = Ipv4Addr::new(239, 255, 42, 99);
    let _ = socket.join_multicast_v4(&multicast_group, &Ipv4Addr::UNSPECIFIED);
    let _ = socket.set_multicast_loop_v4(true);
    let udp: UdpSocket = socket.into();
    udp.set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|error| error.to_string())?;

    if let Ok(beacon_udp) = udp.try_clone() {
        let identity = identity.clone();
        thread::spawn(move || loop {
            let (device_id, name) = identity
                .lock()
                .map(|value| value.clone())
                .unwrap_or_default();
            if device_id.is_empty() {
                thread::sleep(Duration::from_secs(2));
                continue;
            }
            let beacon = Beacon {
                app: APP_TAG.to_string(),
                version: 1,
                device_id,
                name,
                port,
            };
            if let Ok(data) = serde_json::to_vec(&beacon) {
                let _ = beacon_udp.send_to(&data, ("255.255.255.255", DISCOVERY_PORT));
                let _ = beacon_udp.send_to(&data, ("127.0.0.1", DISCOVERY_PORT));
                let _ = beacon_udp.send_to(&data, (multicast_group, DISCOVERY_PORT));
            }
            thread::sleep(Duration::from_secs(2));
        });
    }

    let prune_peers = peers.clone();
    let prune_conns = conns.clone();
    let prune_app = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(5));
        let now = now_ms();
        let mut changed = false;
        let connected: std::collections::HashSet<String> = prune_conns
            .lock()
            .map(|map| map.keys().cloned().collect())
            .unwrap_or_default();
        if let Ok(mut map) = prune_peers.lock() {
            map.retain(|_, peer| now.saturating_sub(peer.last_seen) < 10 * 60 * 1000);
            for (device_id, peer) in map.iter_mut() {
                if connected.contains(device_id) {
                    if !peer.online {
                        changed = true;
                    }
                    peer.online = true;
                    peer.last_seen = now;
                    continue;
                }
                if peer.online && now.saturating_sub(peer.last_seen) > 15_000 {
                    peer.online = false;
                    changed = true;
                }
            }
        }
        if changed {
            emit_peers(&prune_app, &prune_peers);
        }
    });

    let heartbeat_conns = conns.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(10));
        let writers: Vec<Arc<Mutex<TcpStream>>> = heartbeat_conns
            .lock()
            .map(|map| {
                map.values()
                    .map(|connection| connection.writer.clone())
                    .collect()
            })
            .unwrap_or_default();
        for writer in writers {
            if let Ok(mut stream) = writer.lock() {
                let _ = write_line(&mut stream, &json!({ "type": "ping" }));
            }
        }
    });

    thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        let mut last_attempt: HashMap<String, u64> = HashMap::new();
        loop {
            let Ok((size, source)) = udp.recv_from(&mut buffer) else {
                continue;
            };
            let Ok(beacon) = serde_json::from_slice::<Beacon>(&buffer[..size]) else {
                continue;
            };
            if beacon.app != APP_TAG || beacon.version != 1 {
                continue;
            }
            let (our_id, _) = identity
                .lock()
                .map(|value| value.clone())
                .unwrap_or_default();
            if beacon.device_id == our_id || beacon.port == 0 {
                continue;
            }

            let address = format!("{}:{}", source.ip(), beacon.port);
            let now = now_ms();
            {
                let Ok(mut map) = peers.lock() else { continue };
                let entry = map
                    .entry(beacon.device_id.clone())
                    .or_insert_with(|| PeerInfo {
                        device_id: beacon.device_id.clone(),
                        name: beacon.name.clone(),
                        address: address.clone(),
                        online: true,
                        last_seen: now,
                    });
                entry.name = beacon.name.clone();
                entry.address = address.clone();
                entry.online = true;
                entry.last_seen = now;
            }
            emit_peers(&app, &peers);

            let connected = conns
                .lock()
                .map(|map| map.contains_key(&beacon.device_id))
                .unwrap_or(false);
            let last = last_attempt
                .get(&beacon.device_id)
                .copied()
                .unwrap_or(0);
            if !connected && now.saturating_sub(last) > 3_000 {
                last_attempt.insert(beacon.device_id.clone(), now);
                spawn_connection(
                    app.clone(),
                    address,
                    peers.clone(),
                    conns.clone(),
                    identity.clone(),
                );
            }
        }
    });

    Ok(())
}

pub fn start_collab(
    app: AppHandle,
    manager: &CollabManager,
    device_id: String,
    name: String,
) -> Result<CollabInfo, String> {
    if device_id.trim().is_empty() {
        return Err("缺少设备标识".to_string());
    }
    let previous_device = manager
        .identity
        .lock()
        .map(|value| value.0.clone())
        .unwrap_or_default();
    let identity_changed = !previous_device.is_empty() && previous_device != device_id;
    {
        let mut identity = manager
            .identity
            .lock()
            .map_err(|_| "协作状态锁失败".to_string())?;
        *identity = (device_id.clone(), name.clone());
    }
    if identity_changed {
        // Switching local users gets a new device identity. Drop stale
        // connections so peers rediscover us under the new identity.
        let old_connections: Vec<Connection> = manager
            .conns
            .lock()
            .map(|mut map| map.drain().map(|(_, connection)| connection).collect())
            .unwrap_or_default();
        for connection in old_connections {
            if let Ok(stream) = connection.writer.lock() {
                let _ = stream.shutdown(Shutdown::Both);
            }
        }
        if let Ok(mut peers) = manager.peers.lock() {
            peers.clear();
        }
        emit_peers(&app, &manager.peers);
    }
    {
        let started = manager
            .started
            .lock()
            .map_err(|_| "协作状态锁失败".to_string())?;
        if let Some(port) = *started {
            let address = local_ip()
                .map(|ip| format!("{ip}:{port}"))
                .unwrap_or_else(|| format!("127.0.0.1:{port}"));
            return Ok(CollabInfo {
                supported: true,
                device_id,
                name,
                port,
                address,
                local_address: format!("127.0.0.1:{port}"),
            });
        }
    }

    let listener = TcpListener::bind(("0.0.0.0", 0))
        .map_err(|error| format!("无法启动协作服务：{error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("无法获取协作端口：{error}"))?
        .port();
    if let Ok(mut started) = manager.started.lock() {
        *started = Some(port);
    }

    {
        let app = app.clone();
        let peers = manager.peers.clone();
        let conns = manager.conns.clone();
        let identity = manager.identity.clone();
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let app = app.clone();
                let peers = peers.clone();
                let conns = conns.clone();
                let identity = identity.clone();
                thread::spawn(move || {
                    let _ = handle_inbound(app, stream, peers, conns, identity);
                });
            }
        });
    }

    start_discovery(
        app,
        port,
        manager.peers.clone(),
        manager.conns.clone(),
        manager.identity.clone(),
    )?;

    let address = local_ip()
        .map(|ip| format!("{ip}:{port}"))
        .unwrap_or_else(|| format!("127.0.0.1:{port}"));
    Ok(CollabInfo {
        supported: true,
        device_id,
        name,
        port,
        address,
        local_address: format!("127.0.0.1:{port}"),
    })
}

fn send_to(conns: &Conns, device_id: &str, message: &Value) -> Result<(), String> {
    let writer = conns
        .lock()
        .map_err(|_| "连接状态锁失败".to_string())?
        .get(device_id)
        .map(|connection| connection.writer.clone())
        .ok_or_else(|| "对方设备不在线".to_string())?;
    let mut stream = writer
        .lock()
        .map_err(|_| "连接写入锁失败".to_string())?;
    write_line(&mut stream, message).map_err(|error| format!("发送失败：{error}"))
}

#[tauri::command]
pub fn collab_start(
    app: AppHandle,
    state: State<'_, CollabManager>,
    device_id: String,
    name: String,
) -> Result<CollabInfo, String> {
    start_collab(app, state.inner(), device_id, name)
}

#[tauri::command]
pub fn collab_update_name(state: State<'_, CollabManager>, name: String) -> Result<(), String> {
    let mut identity = state
        .identity
        .lock()
        .map_err(|_| "协作状态锁失败".to_string())?;
    identity.1 = name;
    Ok(())
}

#[tauri::command]
pub fn collab_send(
    state: State<'_, CollabManager>,
    device_id: String,
    message: Value,
) -> Result<(), String> {
    send_to(&state.conns, &device_id, &message)
}

#[tauri::command]
pub fn collab_send_many(
    state: State<'_, CollabManager>,
    device_ids: Vec<String>,
    message: Value,
) -> Result<(), String> {
    let mut first_error: Option<String> = None;
    for device_id in device_ids {
        if let Err(error) = send_to(&state.conns, &device_id, &message) {
            if first_error.is_none() {
                first_error = Some(error);
            }
        }
    }
    match first_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

#[tauri::command]
pub fn collab_peers(state: State<'_, CollabManager>) -> Vec<PeerInfo> {
    peers_snapshot(&state.peers)
}

#[tauri::command]
pub fn collab_connect(
    app: AppHandle,
    state: State<'_, CollabManager>,
    address: String,
) -> Result<(), String> {
    let address = address.trim().to_string();
    if address.is_empty() || !address.contains(':') {
        return Err("请输入 IP:端口".to_string());
    }
    spawn_connection(
        app,
        address,
        state.peers.clone(),
        state.conns.clone(),
        state.identity.clone(),
    );
    Ok(())
}
