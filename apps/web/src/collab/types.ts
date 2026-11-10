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

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
}

export interface ChatMessageEnvelope {
  type: 'chat';
  groupId: string;
  token: string;
  message: ChatMessage;
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
  chat?: ChatMessage[];
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

export interface SyncUploadMessage {
  type: 'sync_upload';
  groupId: string;
  token: string;
  tasks: Task[];
  assignments: Record<string, string[]>;
  chat?: ChatMessage[];
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
  | SyncUploadMessage
  | ChatMessageEnvelope
  | PingMessage;

export interface IncomingEnvelope {
  from: string;
  name: string;
  message: CollabMessage;
}
