-- ============================================================================
-- 本地任务管理应用 Schema v1 (SQLite)
-- 说明：
--   1. 所有时间戳为 UTC 毫秒（INTEGER）。
--   2. 所有“日历日期”为本地日期字符串 YYYY-MM-DD，不使用 UTC 零点。
--   3. 所有主键为 TEXT UUIDv7，task 额外保留 row_id 供 FTS5 使用。
--   4. 软删除统一用 deleted_at；status 不包含 deleted。
--   5. 需要 SQLite 3.34+（FTS5 trigram）；建议 3.45+。
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

-- ----------------------------------------------------------------------------
-- 迁移与设备
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  checksum    TEXT NOT NULL,
  applied_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  platform    TEXT NOT NULL,
  last_seen_at INTEGER,
  created_at  INTEGER NOT NULL
);

-- ----------------------------------------------------------------------------
-- 档案与设置
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profile (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  avatar_json TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_setting (
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (profile_id, key)
);

-- ----------------------------------------------------------------------------
-- 组织：文件夹 / 清单 / 分组
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS folder (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_key    TEXT NOT NULL,
  collapsed   INTEGER NOT NULL DEFAULT 0 CHECK (collapsed IN (0, 1)),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_folder_profile
  ON folder(profile_id, deleted_at, sort_key);

CREATE TABLE IF NOT EXISTS project (
  id                     TEXT PRIMARY KEY,
  profile_id             TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  folder_id              TEXT REFERENCES folder(id) ON DELETE SET NULL,
  name                   TEXT NOT NULL,
  kind                   TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'note')),
  color                  TEXT,
  icon                   TEXT,
  background_json        TEXT,
  is_inbox               INTEGER NOT NULL DEFAULT 0 CHECK (is_inbox IN (0, 1)),
  pinned                 INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  sort_key               TEXT NOT NULL,
  view_config_json       TEXT NOT NULL DEFAULT '{}',
  group_config_json      TEXT NOT NULL DEFAULT '{}',
  sort_config_json       TEXT NOT NULL DEFAULT '{}',
  show_in_smart          INTEGER NOT NULL DEFAULT 1 CHECK (show_in_smart IN (0, 1)),
  notification_config_json TEXT NOT NULL DEFAULT '{}',
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  deleted_at             INTEGER
);

CREATE INDEX IF NOT EXISTS idx_project_profile
  ON project(profile_id, deleted_at, sort_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_inbox
  ON project(profile_id)
  WHERE is_inbox = 1 AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS section (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  sort_key    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_section_project
  ON section(project_id, deleted_at, sort_key);

-- ----------------------------------------------------------------------------
-- 标签
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tag (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  parent_id   TEXT REFERENCES tag(id) ON DELETE SET NULL,
  sort_key    TEXT NOT NULL,
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tag_profile
  ON tag(profile_id, deleted_at, sort_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_name
  ON tag(profile_id, name)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 重复系列（必须先于 task 创建，供 task.series_id 引用）
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recurrence_series (
  id                TEXT PRIMARY KEY,
  profile_id        TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  template_task_id  TEXT NOT NULL,             -- 逻辑外键；避免与 task 循环依赖
  mode              TEXT NOT NULL CHECK (mode IN ('due', 'completion', 'selected_dates')),
  rule_json         TEXT NOT NULL,             -- 规则细节见“重复规则规格”
  timezone          TEXT,                      -- IANA；固定时区必填
  dtstart_date      TEXT NOT NULL,             -- 首次本地日期 YYYY-MM-DD
  dtstart_time      TEXT,                      -- HH:MM:SS；全天为空
  end_type          TEXT NOT NULL DEFAULT 'never' CHECK (end_type IN ('never', 'date', 'count')),
  end_date          TEXT,
  end_count         INTEGER CHECK (end_count IS NULL OR end_count > 0),
  completed_count   INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_series_profile
  ON recurrence_series(profile_id, status, deleted_at);

CREATE TABLE IF NOT EXISTS recurrence_exception (
  id              TEXT PRIMARY KEY,
  series_id       TEXT NOT NULL REFERENCES recurrence_series(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,               -- 本地日期 YYYY-MM-DD
  action          TEXT NOT NULL CHECK (action IN ('skip', 'override')),
  override_json   TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (series_id, occurrence_date)
);

-- ----------------------------------------------------------------------------
-- 任务 / 笔记
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task (
  row_id                 INTEGER PRIMARY KEY,   -- FTS5 外部内容行号；保留稳定 rowid
  id                     TEXT NOT NULL UNIQUE,
  profile_id             TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  project_id             TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  section_id             TEXT REFERENCES section(id) ON DELETE SET NULL,
  parent_id              TEXT REFERENCES task(id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  content_md             TEXT NOT NULL DEFAULT '',
  kind                   TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task', 'note')),
  status                 TEXT NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'completed', 'abandoned', 'skipped')),
  priority               INTEGER NOT NULL DEFAULT 0 CHECK (priority IN (0, 1, 3, 5)),
  all_day                INTEGER NOT NULL DEFAULT 1 CHECK (all_day IN (0, 1)),
  start_date             TEXT,                 -- YYYY-MM-DD
  end_date               TEXT,
  start_time             TEXT,                 -- HH:MM:SS；全天为空
  end_time               TEXT,
  timezone               TEXT,                 -- IANA
  time_mode              TEXT NOT NULL DEFAULT 'floating'
                         CHECK (time_mode IN ('floating', 'fixed_zone')),
  start_at               INTEGER,              -- UTC 毫秒；fixed_zone 时为权威值
  end_at                 INTEGER,
  recurrence_series_id   TEXT REFERENCES recurrence_series(id) ON DELETE SET NULL,
  occurrence_date        TEXT,                 -- 本实例对应的本地日期
  occurrence_index       INTEGER,
  progress               INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  pinned                 INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  sort_key               TEXT NOT NULL,
  estimated_pomodoros    INTEGER,
  estimated_minutes      INTEGER,
  assignee_id            TEXT,                 -- 预留给协作
  created_by             TEXT,                 -- 预留给协作
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  completed_at           INTEGER,
  abandoned_at           INTEGER,
  deleted_at             INTEGER,
  CHECK (kind = 'task' OR status = 'open'),
  CHECK (all_day = 0 OR (start_time IS NULL AND end_time IS NULL)),
  CHECK (all_day = 1 OR (start_time IS NOT NULL AND start_at IS NOT NULL)),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  CHECK (start_at IS NULL OR end_at IS NULL OR end_at >= start_at),
  CHECK (recurrence_series_id IS NULL OR occurrence_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_task_profile_status
  ON task(profile_id, status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_task_project_sort
  ON task(project_id, deleted_at, status, sort_key);

CREATE INDEX IF NOT EXISTS idx_task_parent
  ON task(parent_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_task_dates
  ON task(profile_id, deleted_at, start_date, start_at);

CREATE INDEX IF NOT EXISTS idx_task_completed
  ON task(profile_id, deleted_at, completed_at);

CREATE INDEX IF NOT EXISTS idx_task_series
  ON task(recurrence_series_id, occurrence_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_task_series_occurrence
  ON task(recurrence_series_id, occurrence_date)
  WHERE recurrence_series_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS task_tag (
  task_id     TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tag_tag
  ON task_tag(tag_id, task_id);

CREATE TABLE IF NOT EXISTS checklist_item (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  completed     INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_at  INTEGER,
  sort_key      TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_checklist_task
  ON checklist_item(task_id, deleted_at, sort_key);

-- ----------------------------------------------------------------------------
-- 提醒（通用：任务 / 检查事项 / 纪念日 / 习惯）
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reminder (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  owner_type      TEXT NOT NULL CHECK (owner_type IN ('task', 'checklist_item', 'countdown', 'habit')),
  owner_id        TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'absolute'
                  CHECK (kind IN ('absolute', 'relative_start', 'relative_end')),
  trigger_at      INTEGER NOT NULL,            -- UTC 毫秒；绝对触发时间
  offset_minutes  INTEGER,                     -- 相对偏移
  persistent      INTEGER NOT NULL DEFAULT 0 CHECK (persistent IN (0, 1)),
  state           TEXT NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending', 'fired', 'snoozed', 'dismissed', 'cancelled')),
  snooze_until    INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminder_due
  ON reminder(state, trigger_at);

CREATE INDEX IF NOT EXISTS idx_reminder_owner
  ON reminder(owner_type, owner_id);

-- ----------------------------------------------------------------------------
-- 附件 / 评论 / 动态
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attachment (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  owner_type    TEXT NOT NULL CHECK (owner_type IN ('task', 'comment', 'note', 'template')),
  owner_id      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  storage_path  TEXT NOT NULL,                 -- 内容寻址相对路径
  created_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_attachment_owner
  ON attachment(owner_type, owner_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_attachment_hash
  ON attachment(sha256);

CREATE TABLE IF NOT EXISTS comment (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  task_id     TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  author_id   TEXT,
  content_md  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_comment_task
  ON comment(task_id, deleted_at, created_at);

CREATE TABLE IF NOT EXISTS activity (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  actor_id        TEXT,
  action          TEXT NOT NULL,
  field           TEXT,
  old_value_json  TEXT,
  new_value_json  TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_entity
  ON activity(entity_type, entity_id, created_at);

-- ----------------------------------------------------------------------------
-- 模板 / 过滤器
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS template (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('task', 'note', 'summary')),
  name        TEXT NOT NULL,
  content_md  TEXT NOT NULL DEFAULT '',
  tags_json   TEXT NOT NULL DEFAULT '[]',
  sort_key    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_template_profile
  ON template(profile_id, type, deleted_at, sort_key);

CREATE TABLE IF NOT EXISTS filter (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  query_json  TEXT NOT NULL,
  sort_key    TEXT NOT NULL,
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_filter_profile
  ON filter(profile_id, deleted_at, sort_key);

-- ----------------------------------------------------------------------------
-- 习惯
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS habit_section (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_key    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_habit_section_profile
  ON habit_section(profile_id, deleted_at, sort_key);

CREATE TABLE IF NOT EXISTS habit (
  id             TEXT PRIMARY KEY,
  profile_id     TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  section_id     TEXT REFERENCES habit_section(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  icon           TEXT,
  color          TEXT,
  description    TEXT NOT NULL DEFAULT '',
  frequency_json TEXT NOT NULL,
  goal_amount    REAL,
  unit           TEXT,
  checkin_mode   TEXT NOT NULL DEFAULT 'manual'
                 CHECK (checkin_mode IN ('auto', 'manual', 'complete_all')),
  archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_key       TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_habit_profile
  ON habit(profile_id, archived, deleted_at, sort_key);

CREATE TABLE IF NOT EXISTS habit_checkin (
  id          TEXT PRIMARY KEY,
  habit_id    TEXT NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                   -- 本地日期 YYYY-MM-DD
  amount      REAL NOT NULL DEFAULT 1,
  mood        TEXT,
  note        TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual', 'auto', 'backfill')),
  checked_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_habit_checkin_date
  ON habit_checkin(habit_id, date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_habit_checkin_range
  ON habit_checkin(habit_id, date, deleted_at);

-- ----------------------------------------------------------------------------
-- 专注
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS common_focus (
  id               TEXT PRIMARY KEY,
  profile_id       TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  icon             TEXT,
  mode             TEXT NOT NULL CHECK (mode IN ('pomodoro', 'stopwatch')),
  duration_seconds INTEGER NOT NULL DEFAULT 1500,
  linked_type      TEXT CHECK (linked_type IS NULL OR linked_type IN ('task', 'habit')),
  linked_id        TEXT,
  sort_key         TEXT NOT NULL,
  archived         INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_common_focus_profile
  ON common_focus(profile_id, archived, deleted_at, sort_key);

CREATE TABLE IF NOT EXISTS focus_session (
  id                TEXT PRIMARY KEY,
  profile_id        TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  task_id           TEXT REFERENCES task(id) ON DELETE SET NULL,
  habit_id          TEXT REFERENCES habit(id) ON DELETE SET NULL,
  common_focus_id   TEXT REFERENCES common_focus(id) ON DELETE SET NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('pomodoro', 'stopwatch')),
  state             TEXT NOT NULL DEFAULT 'finished'
                    CHECK (state IN ('running', 'paused', 'finished', 'abandoned')),
  planned_seconds   INTEGER,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  note              TEXT NOT NULL DEFAULT '',
  source            TEXT NOT NULL DEFAULT 'timer'
                    CHECK (source IN ('timer', 'backfill')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_focus_started
  ON focus_session(profile_id, started_at, deleted_at);

CREATE TABLE IF NOT EXISTS focus_pause (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES focus_session(id) ON DELETE CASCADE,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_focus_pause_session
  ON focus_pause(session_id, started_at);

-- ----------------------------------------------------------------------------
-- 倒数纪念日
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS countdown (
  id                  TEXT PRIMARY KEY,
  profile_id          TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  icon                TEXT,
  type                TEXT NOT NULL CHECK (type IN ('festival', 'birthday', 'anniversary', 'countdown')),
  date                TEXT NOT NULL,           -- 本地日期 YYYY-MM-DD
  calendar            TEXT NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar', 'lunar')),
  lunar_json          TEXT,
  ignore_year         INTEGER NOT NULL DEFAULT 0 CHECK (ignore_year IN (0, 1)),
  repeat_rule_json    TEXT,
  count_mode          TEXT NOT NULL DEFAULT 'countdown'
                      CHECK (count_mode IN ('countdown', 'count_up')),
  include_first_day   INTEGER NOT NULL DEFAULT 0 CHECK (include_first_day IN (0, 1)),
  show_age            INTEGER NOT NULL DEFAULT 0 CHECK (show_age IN (0, 1)),
  style_json          TEXT NOT NULL DEFAULT '{}',
  note                TEXT NOT NULL DEFAULT '',
  pinned              INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  archived            INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_key            TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  deleted_at          INTEGER
);

CREATE INDEX IF NOT EXISTS idx_countdown_profile
  ON countdown(profile_id, archived, deleted_at, sort_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_countdown_pinned
  ON countdown(profile_id)
  WHERE pinned = 1 AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 日历订阅
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calendar_account (
  id             TEXT PRIMARY KEY,
  profile_id     TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('ics', 'url', 'local')),
  name           TEXT NOT NULL,
  url            TEXT,
  username       TEXT,
  secret_ref     TEXT,                         -- 系统钥匙串引用，不存明文
  color          TEXT,
  visible        INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sync_cursor    TEXT,
  last_synced_at INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_calendar_account_profile
  ON calendar_account(profile_id, deleted_at);

CREATE TABLE IF NOT EXISTS calendar_event (
  id           TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES calendar_account(id) ON DELETE CASCADE,
  external_id  TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  description  TEXT,
  location     TEXT,
  all_day      INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
  start_date   TEXT,
  end_date     TEXT,
  start_at     INTEGER,
  end_at       INTEGER,
  timezone     TEXT,
  rrule        TEXT,
  exdates_json TEXT NOT NULL DEFAULT '[]',
  raw_json     TEXT,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER,
  UNIQUE (account_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_range
  ON calendar_event(account_id, start_at, start_date, deleted_at);

-- ----------------------------------------------------------------------------
-- 成就 / 节假日 / 变更日志
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS achievement_state (
  profile_id    TEXT PRIMARY KEY REFERENCES profile(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 1,
  calculated_at INTEGER,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS badge_unlock (
  profile_id  TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  level       INTEGER NOT NULL,
  progress    INTEGER NOT NULL DEFAULT 0,
  unlocked_at INTEGER,
  PRIMARY KEY (profile_id, code, level)
);

CREATE TABLE IF NOT EXISTS holiday_calendar (
  date    TEXT PRIMARY KEY,                   -- YYYY-MM-DD
  type    TEXT NOT NULL CHECK (type IN ('holiday', 'workday')),
  name    TEXT,
  year    INTEGER NOT NULL,
  source  TEXT
);

CREATE INDEX IF NOT EXISTS idx_holiday_year
  ON holiday_calendar(year, type);

CREATE TABLE IF NOT EXISTS change_log (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id   TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  op           TEXT NOT NULL CHECK (op IN ('create', 'update', 'delete', 'restore')),
  payload_json TEXT,
  device_id    TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_log_profile
  ON change_log(profile_id, seq);

-- ----------------------------------------------------------------------------
-- 全文搜索（FTS5 external content）
-- 说明：trigram 适合中文子串搜索；1-2 字查询回退 LIKE。
-- ----------------------------------------------------------------------------

CREATE VIRTUAL TABLE IF NOT EXISTS task_fts USING fts5(
  title,
  content_md,
  content = 'task',
  content_rowid = 'row_id',
  tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS task_fts_ai AFTER INSERT ON task BEGIN
  INSERT INTO task_fts(rowid, title, content_md)
  VALUES (new.row_id, new.title, new.content_md);
END;

CREATE TRIGGER IF NOT EXISTS task_fts_ad AFTER DELETE ON task BEGIN
  INSERT INTO task_fts(task_fts, rowid, title, content_md)
  VALUES ('delete', old.row_id, old.title, old.content_md);
END;

CREATE TRIGGER IF NOT EXISTS task_fts_au AFTER UPDATE OF title, content_md ON task BEGIN
  INSERT INTO task_fts(task_fts, rowid, title, content_md)
  VALUES ('delete', old.row_id, old.title, old.content_md);
  INSERT INTO task_fts(rowid, title, content_md)
  VALUES (new.row_id, new.title, new.content_md);
END;

PRAGMA user_version = 1;
