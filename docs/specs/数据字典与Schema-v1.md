# 数据字典与 Schema v1

> 配套 SQL：`docs/specs/schema-v1.sql`
> 目标：让“概念模型”变成可直接建库、可迁移、可测试的实现基线
> 日期：2026-11-05

---

## 1. 设计约定

### 1.1 存储与类型

| 约定 | 说明 |
|---|---|
| 数据库 | SQLite 3.34+（建议 3.45+），WAL 模式，开启外键 |
| 主键 | TEXT，UUIDv7（时间有序，便于分页与未来同步） |
| 时间戳 | INTEGER，UTC 毫秒 |
| 日历日期 | TEXT，`YYYY-MM-DD`，本地日期，不使用 UTC 零点 |
| 本地时间 | TEXT，`HH:MM:SS` |
| 布尔 | INTEGER，`0/1`，带 CHECK |
| 枚举 | TEXT + CHECK |
| 结构化配置 | TEXT JSON，带 `version` 字段，应用层校验 |
| 金额/打卡量 | REAL |
| 排序 | TEXT `sort_key`，fractional indexing，按字典序比较 |

### 1.2 时间语义（最重要）

必须区分四种“时间”：

1. **日历日期**：`start_date` / `end_date`，用于“哪一天”“全天”“跨天”。
2. **本地时间**：`start_time` / `end_time`，用于“几点”。
3. **绝对时刻**：`start_at` / `end_at`，UTC 毫秒，用于提醒排序与跨时区比较。
4. **时区**：`timezone`，IANA 名称，例如 `Asia/Shanghai`。

规则：

- **全天任务**：`all_day=1`，只用 `start_date` / `end_date`，`start_time` / `end_time` / `start_at` / `end_at` 为空。`end_date` 为包含式（inclusive）。
- **有时间任务**：`all_day=0`，必须有 `start_time` 和 `start_at`；`end_time` / `end_at` 可选。
- **floating（固定时间）**：用户看到的是“墙上时钟”。跨时区后仍是本地 9:00；`start_at` 是缓存，时区变化时重算。
- **fixed_zone（固定时区）**：绝对时刻固定；`start_at` / `timezone` 为权威值，显示时可按原时区或本地时区对照。
- **无日期任务**：`start_date` / `start_time` / `start_at` 均为空；`all_day` 默认 1。
- **跨天**：`end_date > start_date` 或 `end_at > start_at`；不要用“加 24 小时”判断跨天。

> 禁止把全天日期存成 `UTC 00:00` 的时间戳。这是“日期跳一天”的常见根因。

### 1.3 软删除

- 统一用 `deleted_at` 表示进入垃圾桶；`status` 不包含 `deleted`。
- `status` 只表示业务状态：`open` / `completed` / `abandoned` / `skipped`。
- 查询默认加 `deleted_at IS NULL`。
- 恢复 = 清空 `deleted_at`；彻底删除 = 物理删除并级联附件。
- 软删除的任务仍保留在 FTS 索引中，查询时 join `task` 过滤。

### 1.4 排序

- 所有可拖动列表使用 `sort_key TEXT`。
- 新条目插入时在相邻两条之间生成 key（如 `a0`, `a0V`, `a1`），避免整表重排。
- 定期在后台重排，保持 key 长度可控。
- 不要用浮点 `order` 长期硬扛；精度耗尽后会出现“拖不动”。

### 1.5 主键与外部标识

- `task.row_id`：SQLite 内部整数主键，供 FTS5 external content 使用，不对外暴露。
- `task.id`：UUIDv7，对外使用；外键引用 `task(id)`。
- 未来同步时，`id` 是跨设备稳定标识。

### 1.6 Web 运行方式

- Web/PWA 使用 `@sqlite.org/sqlite-wasm`，在 Worker 中打开 OPFS 数据库 `/dayline.sqlite3`。
- 首次启动执行 `schema-v1.sql`，用 `PRAGMA user_version` 记录版本。
- OPFS VFS 不支持 WAL；Web 端跳过 `PRAGMA journal_mode=WAL`，桌面端原生 SQLite 仍使用 WAL。
- 需要 COOP/COEP 响应头；缺少时降级为内存数据库，UI 明确提示数据不会持久化。
- 数据访问统一走 `packages/db` 的 `SqliteRepository`；桌面端后续换成 Tauri SQLite driver，Repository 与 UI 不变。

---

## 2. 表清单

| 域 | 表 | 用途 |
|---|---|---|
| 基础 | `schema_migrations` | 迁移历史 |
| 基础 | `profile` | 本地档案 |
| 基础 | `app_setting` | 档案级设置（key-value JSON） |
| 基础 | `device` | 设备标识（为同步预留） |
| 组织 | `folder` | 文件夹 |
| 组织 | `project` | 清单（含收集箱） |
| 组织 | `section` | 清单内分组 / 看板列 |
| 组织 | `tag` | 标签（支持二级） |
| 任务 | `task` | 任务 / 笔记 |
| 任务 | `task_tag` | 任务-标签多对多 |
| 任务 | `checklist_item` | 检查事项 |
| 任务 | `reminder` | 通用提醒 |
| 任务 | `recurrence_series` | 重复系列 |
| 任务 | `recurrence_exception` | 单周期跳过/覆盖 |
| 任务 | `attachment` | 附件元数据 |
| 任务 | `comment` | 评论 |
| 任务 | `activity` | 动态/审计 |
| 任务 | `template` | 任务/笔记/摘要模板 |
| 任务 | `filter` | 保存的过滤器 |
| 习惯 | `habit_section` | 习惯分组 |
| 习惯 | `habit` | 习惯定义 |
| 习惯 | `habit_checkin` | 打卡记录 |
| 专注 | `common_focus` | 常用专注 |
| 专注 | `focus_session` | 专注记录 |
| 专注 | `focus_pause` | 暂停区间 |
| 纪念日 | `countdown` | 倒数纪念日 |
| 日历 | `calendar_account` | 订阅账号/URL |
| 日历 | `calendar_event` | 外部日历事件缓存 |
| 统计 | `achievement_state` | 成就值/等级 |
| 统计 | `badge_unlock` | 勋章进度 |
| 系统 | `holiday_calendar` | 法定节假日/调休数据 |
| 系统 | `change_log` | 变更日志（为同步预留） |
| 搜索 | `task_fts` | 任务全文索引 |

---

## 3. 核心实体字段说明

### 3.1 profile / app_setting

| 字段 | 类型 | 说明 |
|---|---|---|
| `profile.id` | TEXT PK | UUIDv7 |
| `profile.name` | TEXT | 档案名，默认“我的日程” |
| `profile.avatar_json` | TEXT | 头像配置（可选） |
| `app_setting.key` | TEXT | 设置键，如 `theme`、`weekStart` |
| `app_setting.value_json` | TEXT | 设置值；每个键独立版本化 |

设置建议按域拆分键：`appearance`、`dateTime`、`taskDefaults`、`notifications`、`calendar`、`ai`、`backup`。不要把所有设置塞进一个巨大 JSON。

### 3.2 folder / project / section

| 字段 | 类型 | 说明 |
|---|---|---|
| `project.kind` | TEXT | `task`（任务清单）/ `note`（笔记清单） |
| `project.is_inbox` | INTEGER | 每档案唯一；收集箱是真实清单行，不是 `project_id = null` |
| `project.folder_id` | TEXT NULL | 所属文件夹；解散文件夹后置空，清单保留 |
| `project.view_config_json` | TEXT | 视图配置（列表/看板/时间线） |
| `project.group_config_json` | TEXT | 分组配置 |
| `project.sort_config_json` | TEXT | 排序配置 |
| `project.show_in_smart` | INTEGER | 是否在智能清单显示 |
| `section.project_id` | TEXT | 分组必须属于一个清单 |

**收集箱设计**：每个 profile 创建一行 `is_inbox=1` 的 project。任务必须 `project_id NOT NULL`，因此“未分配清单”实际是“在收集箱”。这样所有查询路径统一，不需要到处处理 `NULL`。

### 3.3 task

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT | UUIDv7，对外标识 |
| `row_id` | INTEGER PK | 内部行号，FTS 用 |
| `profile_id` | TEXT | 档案隔离 |
| `project_id` | TEXT | 必填；收集箱也是 project |
| `section_id` | TEXT NULL | 所属分组；必须与 project 一致 |
| `parent_id` | TEXT NULL | 父任务；最多 5 级，应用层校验 |
| `title` | TEXT | 必填，非空 |
| `content_md` | TEXT | Markdown 正文 |
| `kind` | TEXT | `task` / `note` |
| `status` | TEXT | `open` / `completed` / `abandoned` / `skipped` |
| `priority` | INTEGER | 0 / 1 / 3 / 5 |
| `all_day` | INTEGER | 1=全天/仅日期；0=有时间 |
| `start_date` / `end_date` | TEXT | 本地日期；`end_date` 包含式 |
| `start_time` / `end_time` | TEXT | 本地时间；全天为空 |
| `timezone` | TEXT | IANA |
| `time_mode` | TEXT | `floating` / `fixed_zone` |
| `start_at` / `end_at` | INTEGER | UTC 毫秒 |
| `recurrence_series_id` | TEXT NULL | 所属重复系列 |
| `occurrence_date` | TEXT NULL | 本实例的本地日期；系列内唯一 |
| `occurrence_index` | INTEGER NULL | 第几个实例，从 0 开始 |
| `progress` | INTEGER | 0–100；有检查事项时自动计算 |
| `pinned` | INTEGER | 置顶 |
| `sort_key` | TEXT | 排序 |
| `estimated_pomodoros` | INTEGER | 预计番茄数 |
| `estimated_minutes` | INTEGER | 预计时长 |
| `assignee_id` / `created_by` | TEXT | 为协作预留，v1 为空 |
| `created_at` / `updated_at` | INTEGER | UTC 毫秒 |
| `completed_at` / `abandoned_at` | INTEGER | 状态时间 |
| `deleted_at` | INTEGER | 垃圾桶 |

**状态机**：

```text
open ──完成──> completed ──取消完成──> open
  │                 │
  ├──放弃──> abandoned ──重新开始──> open
  ├──跳过重复周期──> skipped
  └──删除──> deleted_at != null（status 不变）
```

**不变量**：

- `kind='note'` 时 `status='open'`，无完成/放弃。
- `status='completed'` ⇔ `completed_at IS NOT NULL`（应用层保证）。
- `status='abandoned'` ⇔ `abandoned_at IS NOT NULL`。
- 子任务与父任务同一 `project_id`；移动父任务时级联移动子树。
- 子任务最多 5 级；删除父任务时软删除整棵子树。
- 有检查事项时，`progress = 已完成检查事项 / 总数`；全部完成时主任务自动完成（可配置）。
- 重复任务完成当前实例后，才生成下一实例；同一系列同一 `occurrence_date` 只能有一个未删除实例。

### 3.4 tag / task_tag

| 字段 | 说明 |
|---|---|
| `tag.parent_id` | 二级标签；最多两级 |
| `tag.name` | 同一档案内唯一（未删除） |
| `task_tag` | 多对多；删除标签只删关联，不删任务 |

### 3.5 checklist_item

| 字段 | 说明 |
|---|---|
| `task_id` | 所属任务 |
| `completed` / `completed_at` | 勾选状态 |
| `sort_key` | 排序 |
| 独立提醒 | 通过 `reminder.owner_type='checklist_item'` |

检查事项与子任务是两套体系：检查事项不创建任务、不参与智能清单；子任务是独立任务。只有检查事项影响主任务进度。

### 3.6 reminder

| 字段 | 说明 |
|---|---|
| `owner_type` | `task` / `checklist_item` / `countdown` / `habit` |
| `owner_id` | 对应实体 ID |
| `kind` | `absolute` / `relative_start` / `relative_end` |
| `trigger_at` | 绝对触发时间（UTC 毫秒），调度以此为准 |
| `offset_minutes` | 相对偏移；用于“提前 30 分钟”“结束时” |
| `persistent` | 持续提醒 |
| `state` | `pending` / `fired` / `snoozed` / `dismissed` / `cancelled` |
| `snooze_until` | 稍后提醒时间 |

规则：

- 任务时间、时区、提醒偏移变化时，重算 `trigger_at`。
- 重复任务的每个实例有独立提醒行。
- 应用启动时扫描 `state='pending' AND trigger_at <= now`，按补偿策略处理。
- 删除任务/纪念日/习惯时，取消其提醒（`state='cancelled'`）。

### 3.7 recurrence_series / recurrence_exception

| 字段 | 说明 |
|---|---|
| `template_task_id` | 模板任务（同时是当前实例）；逻辑外键，避免与 task 循环依赖 |
| `mode` | `due`（到期重复）/ `completion`（完成重复）/ `selected_dates`（自选日期） |
| `rule_json` | 频率、间隔、星期、月日、农历、结束条件等 |
| `timezone` | 固定时区重复使用；floating 可用档案时区 |
| `dtstart_date` / `dtstart_time` | 首次发生 |
| `end_type` | `never` / `date` / `count` |
| `completed_count` | 已完成次数，用于按次数结束 |
| `status` | `active` / `paused` / `ended` |

`recurrence_exception`：

| 字段 | 说明 |
|---|---|
| `occurrence_date` | 被例外处理的本地日期 |
| `action` | `skip`（跳过）/ `override`（仅此周期修改） |
| `override_json` | 覆盖字段（标题、时间、优先级、清单等） |

**物化策略**：同一系列只保留一个“当前未完成实例”，未来实例由日历按需展开，不预生成无限行。完成/跳过后再生成下一个。

### 3.8 attachment

| 字段 | 说明 |
|---|---|
| `owner_type` | `task` / `comment` / `note` / `template` |
| `sha256` | 内容哈希 |
| `storage_path` | 应用数据目录下的相对路径，按哈希寻址 |
| `size_bytes` | 大小，用于配额与备份 |

附件文件不存 BLOB；备份时单独打包并按 `sha256` 校验。

### 3.9 comment / activity

- `comment.author_id`：v1 只有本地用户，可为空；未来协作填成员 ID。
- `activity`：记录创建、修改、完成、移动、删除等；字段级 old/new value 用 JSON。
- 动态用于任务详情时间线，不作为同步真源。

### 3.10 template / filter

| 表 | 说明 |
|---|---|
| `template.type` | `task` / `note` / `summary` |
| `template.content_md` | 模板正文 |
| `template.tags_json` | 默认标签 ID 列表 |
| `filter.query_json` | 查询 DSL（见“过滤器规格”） |
| `filter.pinned` | 侧边栏置顶 |

### 3.11 habit / habit_section / habit_checkin

| 字段 | 说明 |
|---|---|
| `habit.frequency_json` | 频率定义；结构见习惯规格 |
| `habit.goal_amount` / `unit` | 目标量与单位 |
| `habit.checkin_mode` | `auto` / `manual` / `complete_all` |
| `habit.archived` | 归档；保留历史 |
| `habit_checkin.date` | 本地日期 |
| `habit_checkin.amount` | 当次完成量 |
| `habit_checkin.source` | `manual` / `auto` / `backfill` |

同一习惯同一天最多一条未删除记录；补记通过更新该记录实现。

### 3.12 focus_session / common_focus / focus_pause

| 字段 | 说明 |
|---|---|
| `focus_session.mode` | `pomodoro` / `stopwatch` |
| `focus_session.state` | `running` / `paused` / `finished` / `abandoned` |
| `planned_seconds` | 计划时长 |
| `duration_seconds` | 实际专注时长（不含暂停） |
| `source` | `timer` / `backfill` |
| `focus_pause` | 暂停区间，用于恢复和统计 |
| `common_focus.linked_type` | `task` / `habit` |

应用重启时，`state='running'/'paused'` 的记录需要恢复或结算；不能静默丢失。

### 3.13 countdown

| 字段 | 说明 |
|---|---|
| `type` | `festival` / `birthday` / `anniversary` / `countdown` |
| `date` | 本地日期；农历时存对应公历日期 + `lunar_json` |
| `calendar` | `solar` / `lunar` |
| `lunar_json` | 农历月/日/是否闰月 |
| `ignore_year` | 生日忽略年份 |
| `repeat_rule_json` | 每年/每月/自定义 |
| `count_mode` | 倒计时/正计时 |
| `include_first_day` | 当天算第 1 天 |
| `show_age` | 显示岁数 |
| `pinned` | 每档案最多一个置顶 |

### 3.14 calendar_account / calendar_event

- `calendar_account.type`：v1 只支持 `ics` / `url` / `local`；OAuth 类型后置。
- `secret_ref`：系统钥匙串引用，不存明文密码。
- `calendar_event` 是外部事件的本地缓存；`external_id` 用于去重。
- `rrule` 存原始 RRULE 字符串；`exdates_json` 存例外日期。
- 同步失败不能清空已有事件；保留最后一次成功数据并显示错误。

### 3.15 holiday_calendar

| 字段 | 说明 |
|---|---|
| `date` | 日期 |
| `type` | `holiday`（放假）/ `workday`（调休上班） |
| `year` | 年份 |
| `source` | 数据来源/版本 |

使用规则：

- `statutory_workday`：优先查表；表中有 `workday` 则上班，有 `holiday` 则不上班；无记录时周一至周五上班。
- `statutory_holiday`：表中有 `holiday` 则放假；无记录时周六周日放假。
- 每年数据需更新；缺失年份在 UI 提示，不能静默算错。

### 3.16 achievement_state / badge_unlock

- `achievement_state` 存计算结果；每天 00:00 重算。
- 成就公式未公开，需自定义并写进产品文档。
- `badge_unlock` 存进度与解锁时间；勋章定义放代码/配置，不建表。

### 3.17 change_log

| 字段 | 说明 |
|---|---|
| `seq` | 自增序列 |
| `entity_type` / `entity_id` | 变更对象 |
| `op` | `create` / `update` / `delete` / `restore` |
| `payload_json` | 变更后的字段快照或 patch |
| `device_id` | 设备标识 |
| `created_at` | 时间 |

v1 不做同步，但所有写用例都应写 `change_log`。这样未来加同步时不需要重写业务层。

---

## 4. 关键不变量清单

实现和测试必须覆盖：

1. 每档案恰好一个未删除的收集箱（partial unique index）。
2. 每个任务必须有 `project_id`；收集箱也是 project。
3. 任务 `section_id` 必须属于同一 `project_id`。
4. 子任务最多 5 级；父子同 project。
5. `kind='note'` 的任务 `status='open'`。
6. `status='completed'` ⇔ `completed_at` 非空。
7. `status='abandoned'` ⇔ `abandoned_at` 非空。
8. 全天任务没有 `start_time` / `start_at`。
9. 有时间任务必须有 `start_time` / `start_at`。
10. `end_date >= start_date`；`end_at >= start_at`。
11. 同一系列同一 `occurrence_date` 最多一个未删除实例。
12. 同一系列最多一个 `open` 的当前实例（应用层保证）。
13. 标签名在同一档案内唯一（未删除）。
14. 同一习惯同一天最多一条未删除打卡。
15. 每档案最多一个置顶纪念日。
16. 提醒的 `trigger_at` 必须由任务时间/偏移计算得出，不手填。
17. 删除父任务时子任务一起软删除；恢复时一起恢复。
18. 附件 `sha256` 与文件内容一致；缺失文件在 UI 标记。
19. 迁移前必须自动备份；迁移失败可回滚。
20. 所有写操作写 `change_log`，并更新 `updated_at`。

---

## 5. 索引与查询

已建索引覆盖：

- 档案 + 状态 + 删除标记：列表/智能清单。
- 清单 + 排序：清单视图。
- 父任务：子任务树。
- 日期/时间：日历、今天、最近 7 天。
- 完成时间：已完成/统计。
- 系列 + 日期：重复实例。
- 提醒状态 + 触发时间：调度器。
- 标签关联：按标签筛选。
- 检查事项/评论/附件：详情页。
- 打卡/专注时间：统计。

查询注意：

- 所有列表查询必须带 `profile_id` 和 `deleted_at IS NULL`。
- 日历查询用 `start_date` / `start_at` 范围，避免全表扫描。
- 统计查询按月/年聚合，必要时加汇总表（v1 可先实时算）。
- 大列表用游标分页（`sort_key` / `start_at`），不要 offset 翻页。

---

## 6. 全文搜索

- 使用 FTS5 `trigram` tokenizer，适合中文子串搜索。
- `task_fts` 为 external content 表，触发器同步 `title` / `content_md`。
- 查询示例：

```sql
SELECT t.*
FROM task_fts f
JOIN task t ON t.row_id = f.rowid
WHERE task_fts MATCH ?
  AND t.profile_id = ?
  AND t.deleted_at IS NULL
ORDER BY rank
LIMIT 50;
```

- 1–2 个字符的查询 trigram 可能无法命中，回退 `LIKE '%x%'`。
- 搜索范围可配置：标题 / 正文 / 检查事项 / 评论。
- 未来可加拼音索引（预计算拼音列），v1 不做。

---

## 7. 迁移策略

- 每个迁移一个版本，记录在 `schema_migrations`，同时更新 `PRAGMA user_version`。
- 迁移脚本只前进，不写“向下迁移”；回滚靠备份。
- 启动流程：
  1. 打开数据库，检查 `user_version`。
  2. 若需迁移，先创建备份（数据库 + 附件清单）。
  3. 在事务中依次执行迁移。
  4. 失败则恢复备份并提示用户。
- 迁移测试：用上一版本生成的 fixture 数据库跑全量升级，校验行数与关键字段。
- 禁止在迁移中做网络请求/UI 交互。

---

## 8. 备份与恢复

### 8.1 全量备份（自有格式）

建议打包为 zip：

```text
backup-20261105-120000.zip
  manifest.json        # 版本、时间、设备、计数、校验和
  database.sqlite      # 一致性快照（VACUUM INTO 或 backup API）
  attachments/         # 按 sha256 命名
  settings.json        # 可选，便于人工查看
```

- 生成前执行 WAL checkpoint；使用 SQLite backup API，不直接复制正在写的文件。
- `manifest.json` 记录每张表行数、附件数量、sha256。
- 恢复前先备份当前数据；恢复后跑完整性检查与迁移。
- 支持“只恢复某个清单/某段时间”作为后续增强。

### 8.2 CSV / ICS

- CSV 用于互操作，不保证保留全部字段；导出时在表头写版本。
- ICS 导出任务/日历事件；重复任务导出 RRULE 子集，农历/完成重复降级为单次或说明。
- 导入必须 dry-run：预览条数、冲突、无法识别的字段。

---

## 9. 与调研文档概念模型的差异

| 调研模型 | Schema v1 | 原因 |
|---|---|---|
| `Task.status` 含 `deleted` | `status` 不含 deleted，用 `deleted_at` | 保留完成/放弃状态，垃圾桶可恢复 |
| `repeatRule` 单字段 | `recurrence_series` + `recurrence_exception` | 支持系列、单周期例外、结束条件 |
| `reminders[]` 内嵌 | 独立 `reminder` 表 | 调度、查询、稍后提醒、补偿 |
| 任务可 `projectId` 为空 | `project_id NOT NULL` + 收集箱 project | 查询路径统一 |
| 日期可能存时间戳 | 本地日期 + UTC 时刻分离 | 避免时区跳天 |
| 标签内嵌 | `tag` + `task_tag` | 多对多、二级标签、统计 |
| 检查事项内嵌 | 独立表 | 独立提醒、排序、进度 |
| 附件内嵌 | 元数据表 + 内容寻址文件 | 备份、去重、恢复 |
| 无变更日志 | `change_log` | 为未来同步预留 |
| 无 FTS | FTS5 trigram | 中文搜索性能 |

---

## 10. 待确认

1. 标签名是否全局唯一，还是允许不同父标签下重名？当前选择：同档案唯一。
2. 全天任务的 `end_date` 是否包含式？当前选择：包含。
3. `floating` 的命名是否改为 `fixed_time` 更贴近官方文案？当前选择：`floating` 表意更准确，UI 文案用“固定时间”。
4. 重复任务是否允许同一系列同一天多个实例？当前假设不允许；自选日期去重。
5. 附件是否允许跨任务去重引用？当前按 `sha256` 存一份，元数据可多行引用。
6. 任务删除后，其子任务/检查事项/提醒的清理时机？当前：软删除级联，彻底删除时物理级联。
