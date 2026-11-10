import type { Task } from '@dayline/core';

export interface CollabPeer {
  deviceId: string;
  name: string;
  address: string;
  online: boolean;
  lastSeen: number;
}

export interface CollabMember {
  deviceId: string;
  name: string;
}

export interface CollabGroup {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  members: CollabMember[];
  token: string;
  createdAt: number;
  /** taskId -> device ids */
  assignments: Record<string, string[]>;
}

export interface CollabInvite {
  id: string;
  groupId: string;
  groupName: string;
  ownerId: string;
  ownerName: string;
  members: CollabMember[];
  token: string;
  fromDeviceId: string;
  fromName: string;
  receivedAt: number;
}

export interface CollabProjectPayload {
  id: string;
  name: string;
  color: string;
}

export interface CollabSnapshot {
  type: 'snapshot';
  groupId: string;
  token: string;
  group: {
    id: string;
    name: string;
    ownerId: string;
    ownerName: string;
    members: CollabMember[];
  };
  project: CollabProjectPayload;
  tasks: Task[];
  assignments: Record<string, string[]>;
}

export interface InviteMessage {
  type: 'invite';
  inviteId: string;
  groupId: string;
  groupName: string;
  ownerId: string;
  ownerName: string;
  members: CollabMember[];
  token: string;
  fromName: string;
}

export interface InviteAcceptMessage {
  type: 'invite_accept';
  inviteId: string;
  groupId: string;
  token: string;
  member: CollabMember;
}

export interface InviteDeclineMessage {
  type: 'invite_decline';
  inviteId: string;
  groupId: string;
}

export interface MembersMessage {
  type: 'members';
  groupId: string;
  token: string;
  members: CollabMember[];
}

export interface TaskMessage {
  type: 'task';
  groupId: string;
  token: string;
  task: Task;
  assignments?: Record<string, string[]>;
}

export interface AssignMessage {
  type: 'assign';
  groupId: string;
  token: string;
  taskId: string;
  assignees: string[];
}

export interface PingMessage {
  type: 'ping';
}

export type CollabMessage =
  | InviteMessage
  | InviteAcceptMessage
  | InviteDeclineMessage
  | MembersMessage
  | CollabSnapshot
  | TaskMessage
  | AssignMessage
  | PingMessage;

export interface IncomingEnvelope {
  from: string;
  name: string;
  message: CollabMessage;
}
