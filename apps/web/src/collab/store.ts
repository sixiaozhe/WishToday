import { generateId } from '@dayline/core';
import type { CollabGroup, CollabInvite } from './types';

const DEVICE_KEY = 'dayline.collab.device.v1';

export interface CollabStore {
  groups: CollabGroup[];
}

function storageKey(profileId: string): string {
  return `dayline.collab.v1.${profileId}`;
}

export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = generateId();
    window.localStorage.setItem(DEVICE_KEY, created);
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
