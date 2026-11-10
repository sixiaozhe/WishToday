import { generateId } from '@dayline/core';
import type { CollabGroup, CollabInvite } from './types';

const DEVICE_KEY = 'dayline.collab.device.v1';
const KNOWN_PEERS_KEY = 'dayline.collab.known-peers.v1';

function deviceKey(profileId: string): string {
  return `${DEVICE_KEY}.${profileId}`;
}

export interface CollabStore {
  groups: CollabGroup[];
}

function storageKey(profileId: string): string {
  return `dayline.collab.v1.${profileId}`;
}

/**
 * Each local user profile gets its own device identity. Two windows signed in
 * as different local users can therefore see each other even when they share
 * the same WebView storage.
 */
export function getDeviceId(profileId: string): string {
  if (!profileId) return '';
  try {
    const key = deviceKey(profileId);
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = generateId();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return generateId();
  }
}

export function loadCollab(profileId: string): CollabStore {
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    if (!raw) return { groups: [] };
    const parsed = JSON.parse(raw) as Partial<CollabStore>;
    if (!Array.isArray(parsed.groups)) return { groups: [] };
    return {
      groups: parsed.groups.filter(
        (group): group is CollabGroup =>
          Boolean(group) &&
          typeof group.id === 'string' &&
          typeof group.name === 'string' &&
          typeof group.token === 'string' &&
          Array.isArray(group.members),
      ),
    };
  } catch {
    return { groups: [] };
  }
}

export function saveCollab(profileId: string, store: CollabStore): void {
  try {
    window.localStorage.setItem(storageKey(profileId), JSON.stringify(store));
  } catch {
    // Collaboration metadata is best-effort; tasks stay in SQLite.
  }
}

export function randomToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function newGroupId(): string {
  return `group-${generateId()}`;
}

export function inviteFromMessage(
  invite: Omit<CollabInvite, 'receivedAt'>,
): CollabInvite {
  return { ...invite, receivedAt: Date.now() };
}

/**
 * Manual connections are not re-discovered reliably on every network (and
 * two clients on the same machine may not receive each other's UDP
 * broadcasts). Remember peer addresses and reconnect on startup.
 */
export function loadKnownPeers(): string[] {
  try {
    const raw = window.localStorage.getItem(KNOWN_PEERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (address): address is string =>
        typeof address === 'string' && address.includes(':'),
    );
  } catch {
    return [];
  }
}

export function saveKnownPeers(addresses: string[]): void {
  try {
    const unique = [...new Set(addresses.filter((item) => item.includes(':')))];
    window.localStorage.setItem(
      KNOWN_PEERS_KEY,
      JSON.stringify(unique.slice(0, 20)),
    );
  } catch {
    // Best-effort; manual connection can still be used this session.
  }
}

export function rememberPeer(address: string): void {
  if (!address.includes(':')) return;
  saveKnownPeers([address, ...loadKnownPeers()]);
}
