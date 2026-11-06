export interface LocalUser {
  id: string;
  name: string;
  /** OPFS / SQLite database file name. */
  dbName: string;
  /** localStorage key for the HTTP fallback. */
  stateKey: string;
  /** Suffix used for per-user auto backups (empty for the legacy user). */
  backupKey: string;
  createdAt: number;
  lastUsedAt: number;
  /** Seed the demo data when this user database is first created. */
  demo: boolean;
}

const USERS_KEY = 'dayline.users.v1';
const ACTIVE_KEY = 'dayline.activeUser.v1';
const LEGACY_DB = 'dayline.sqlite3';
const LEGACY_STATE_KEY = 'dayline.state.v1';

function generateUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function legacyUser(): LocalUser {
  const now = Date.now();
  return {
    id: 'default',
    name: '我的日程',
    dbName: LEGACY_DB,
    stateKey: LEGACY_STATE_KEY,
    backupKey: '',
    createdAt: now,
    lastUsedAt: now,
    demo: true,
  };
}

function normalizeUser(raw: Partial<LocalUser>, index: number): LocalUser {
  const id = raw.id ?? `user-${index}`;
  return {
    id,
    name: raw.name?.trim() || `用户 ${index + 1}`,
    dbName: raw.dbName || (id === 'default' ? LEGACY_DB : `dayline-user-${id}.sqlite3`),
    stateKey:
      raw.stateKey || (id === 'default' ? LEGACY_STATE_KEY : `dayline.state.v1.${id}`),
    backupKey: raw.backupKey ?? (id === 'default' ? '' : id),
    createdAt: raw.createdAt ?? Date.now(),
    lastUsedAt: raw.lastUsedAt ?? Date.now(),
    demo: raw.demo ?? id === 'default',
  };
}

export function loadUsers(): LocalUser[] {
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalUser>[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeUser);
      }
    }
  } catch {
    // fall through to legacy user
  }
  return [legacyUser()];
}

export function saveUsers(users: LocalUser[]): void {
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // The active session remains usable if storage is full.
  }
}

export function createUser(name: string): LocalUser {
  const id = generateUserId();
  const now = Date.now();
  return {
    id,
    name: name.trim() || '新用户',
    dbName: `dayline-user-${id}.sqlite3`,
    stateKey: `dayline.state.v1.${id}`,
    backupKey: id,
    createdAt: now,
    lastUsedAt: now,
    demo: false,
  };
}

export function getActiveUserId(users: LocalUser[]): string {
  try {
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored && users.some((user) => user.id === stored)) return stored;
  } catch {
    // ignore
  }
  return users[0]?.id ?? 'default';
}

export function setActiveUserId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
}

export function removeUserLocalData(user: LocalUser): void {
  try {
    window.localStorage.removeItem(user.stateKey);
    if (user.backupKey) {
      window.localStorage.removeItem(`dayline.autobackup.v1.${user.backupKey}`);
      window.localStorage.removeItem(`dayline.autobackup.at.${user.backupKey}`);
    }
  } catch {
    // ignore
  }
}
