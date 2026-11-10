import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AppState, Project, Task } from '@dayline/core';
import type { SqliteRepository } from '@dayline/db';
import {
  getDeviceId,
  loadCollab,
  newGroupId,
  randomToken,
  saveCollab,
} from './store';
import type {
  AssignMessage,
  CollabGroup,
  CollabInvite,
  CollabMember,
  CollabMessage,
  CollabPeer,
  CollabSnapshot,
  IncomingEnvelope,
  InviteAcceptMessage,
  InviteMessage,
  MembersMessage,
  TaskMessage,
} from './types';

interface UseCollabOptions {
  profileId: string;
  displayName: string;
  state: AppState | null;
  stateRef: RefObject<AppState | null>;
  repository: SqliteRepository | null;
  repositoryRef: RefObject<SqliteRepository | null>;
  commit: (state: AppState) => void;
  notify: (title: string, body: string) => void;
}

interface CollabInfo {
  supported: boolean;
  deviceId: string;
  name: string;
  port: number;
}

function parentFirst(tasks: Task[]): Task[] {
  return [
    ...tasks.filter((task) => !task.parentId),
    ...tasks.filter((task) => task.parentId),
  ];
}

function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

async function invokeCollab<T>(
  command: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export function useCollab({
  profileId,
  displayName,
  state,
  stateRef,
  repository,
  repositoryRef,
  commit,
  notify,
}: UseCollabOptions) {
  const [supported] = useState(() => isTauri());
  const [deviceId] = useState(() => getDeviceId());
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const [groups, setGroups] = useState<CollabGroup[]>(
    () => loadCollab(profileId).groups,
  );
  const [invites, setInvites] = useState<CollabInvite[]>([]);
  const [running, setRunning] = useState(false);
  const [port, setPort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupsRef = useRef(groups);
  const peersRef = useRef(peers);
  const invitesRef = useRef(invites);
  const displayNameRef = useRef(displayName);
  const commitRef = useRef(commit);
  const notifyRef = useRef(notify);
  const baselineRef = useRef<Map<string, Map<string, number>>>(new Map());
  const incomingRef = useRef<(envelope: IncomingEnvelope) => void>(() => {});
  const runningRef = useRef(false);

  commitRef.current = commit;
  notifyRef.current = notify;

  function setGroupsNow(next: CollabGroup[]) {
    groupsRef.current = next;
    saveCollab(profileId, { groups: next });
    setGroups(next);
  }

  function updateGroupNow(group: CollabGroup) {
    setGroupsNow(
      groupsRef.current.map((item) => (item.id === group.id ? group : item)),
    );
  }

  function setInvitesNow(next: CollabInvite[]) {
    invitesRef.current = next;
    setInvites(next);
  }

  function dismissInvite(inviteId: string) {
    setInvitesNow(invitesRef.current.filter((item) => item.id !== inviteId));
  }

  useEffect(() => {
    displayNameRef.current = displayName;
    if (runningRef.current) {
      void invokeCollab('collab_update_name', { name: displayName }).catch(
        () => undefined,
      );
    }
  }, [displayName]);

  useEffect(() => {
    const loaded = loadCollab(profileId).groups;
    groupsRef.current = loaded;
    setGroups(loaded);
    setInvitesNow([]);
    baselineRef.current.clear();
  }, [profileId]);

  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    let unlistenPeers: (() => void) | undefined;
    let unlistenMessages: (() => void) | undefined;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const info = await invokeCollab<CollabInfo>('collab_start', {
          deviceId,
          name: displayNameRef.current,
        });
        if (disposed) return;
        setRunning(true);
        runningRef.current = true;
        setPort(info.port);
        unlistenPeers = await listen<CollabPeer[]>('collab-peers', (event) => {
          peersRef.current = event.payload;
          setPeers(event.payload);
        });
        unlistenMessages = await listen<IncomingEnvelope>(
          'collab-message',
          (event) => incomingRef.current(event.payload),
        );
        const initial = await invokeCollab<CollabPeer[]>('collab_peers', {});
        if (!disposed) {
          peersRef.current = initial;
          setPeers(initial);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();

    return () => {
      disposed = true;
      unlistenPeers?.();
      unlistenMessages?.();
    };
  }, [supported, deviceId]);

  async function sendTo(target: string, message: CollabMessage) {
    try {
      await invokeCollab('collab_send', { deviceId: target, message });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function sendMany(targets: string[], message: CollabMessage) {
    if (targets.length === 0) return;
    try {
      await invokeCollab('collab_send_many', {
        deviceIds: targets,
        message,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function connectPeer(address: string) {
    try {
      await invokeCollab('collab_connect', { address });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function ownerTargets(group: CollabGroup): string[] {
    return group.members
      .filter((member) => member.deviceId !== deviceId)
      .map((member) => member.deviceId);
  }

  function buildSnapshot(group: CollabGroup): CollabSnapshot {
    const local = stateRef.current;
    const project = local?.projects.find((item) => item.id === group.id);
    return {
      type: 'snapshot',
      groupId: group.id,
      token: group.token,
      group: {
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        ownerName: group.ownerName,
        members: group.members,
      },
      project: {
        id: group.id,
        name: group.name,
        color: project?.color ?? '#8b5cf6',
      },
      tasks: local
        ? parentFirst(
            local.tasks.filter((task) => task.projectId === group.id),
          )
        : [],
      assignments: group.assignments,
    };
  }

  async function ensureProject(group: CollabGroup) {
    const local = stateRef.current;
    if (!local) return;
    if (local.projects.some((project) => project.id === group.id)) return;
    const now = Date.now();
    const project: Project = {
      id: group.id,
      profileId: local.profile.id,
      folderId: null,
      name: group.name,
      kind: 'task',
      color: '#8b5cf6',
      isInbox: false,
      sortKey: `group-${now}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (repositoryRef.current) {
      await repositoryRef.current.saveProject(project);
    }
    const latest = stateRef.current ?? local;
    commitRef.current({ ...latest, projects: [...latest.projects, project] });
  }

  async function createGroup(name: string): Promise<CollabGroup | null> {
    const value = name.trim();
    if (!value) return null;
    const group: CollabGroup = {
      id: newGroupId(),
      name: value,
      ownerId: deviceId,
      ownerName: displayNameRef.current,
      members: [{ deviceId, name: displayNameRef.current }],
      token: randomToken(),
      createdAt: Date.now(),
      assignments: {},
    };
    await ensureProject(group);
    baselineRef.current.set(group.id, new Map());
    setGroupsNow([...groupsRef.current, group]);
    notifyRef.current('已创建群组', `${value} 已加入清单`);
    return group;
  }

  function inviteToGroup(groupId: string, peer: CollabPeer) {
    const group = groupsRef.current.find((item) => item.id === groupId);
    if (!group) return;
    if (group.ownerId !== deviceId) {
      notifyRef.current('只有群主可以邀请', '请联系群主添加成员');
      return;
    }
    if (group.members.some((member) => member.deviceId === peer.deviceId)) {
      notifyRef.current('已经是群成员', `${peer.name} 已在「${group.name}」中`);
      return;
    }
    const message: InviteMessage = {
      type: 'invite',
      inviteId: randomToken(),
      groupId: group.id,
      groupName: group.name,
      ownerId: group.ownerId,
      ownerName: group.ownerName,
      members: group.members,
      token: group.token,
      fromName: displayNameRef.current,
    };
    void sendTo(peer.deviceId, message);
    notifyRef.current('邀请已发送', `已邀请 ${peer.name} 加入「${group.name}」`);
  }

  async function acceptInvite(invite: CollabInvite) {
    if (groupsRef.current.some((group) => group.id === invite.groupId)) {
      dismissInvite(invite.id);
      return;
    }
    const group: CollabGroup = {
      id: invite.groupId,
      name: invite.groupName,
      ownerId: invite.ownerId,
      ownerName: invite.ownerName,
      members: invite.members,
      token: invite.token,
      createdAt: Date.now(),
      assignments: {},
    };
    await ensureProject(group);
    baselineRef.current.set(group.id, new Map());
    setGroupsNow([...groupsRef.current, group]);
    dismissInvite(invite.id);
    await sendTo(invite.fromDeviceId, {
      type: 'invite_accept',
      inviteId: invite.id,
      groupId: group.id,
      token: group.token,
      member: { deviceId, name: displayNameRef.current },
    });
    notifyRef.current('已加入群组', `「${group.name}」已出现在清单里`);
  }

  function declineInvite(invite: CollabInvite) {
    dismissInvite(invite.id);
    void sendTo(invite.fromDeviceId, {
      type: 'invite_decline',
      inviteId: invite.id,
      groupId: invite.groupId,
    });
  }

  async function applySnapshot(
    message: CollabSnapshot,
    envelope: IncomingEnvelope,
  ) {
    const group = groupsRef.current.find((item) => item.id === message.groupId);
    if (!group || group.token !== message.token) return;
    if (envelope.from !== group.ownerId) return;
    const local = stateRef.current;
    if (!local) return;

    let next = local;
    if (!next.projects.some((project) => project.id === message.group.id)) {
      const now = Date.now();
      const project: Project = {
        id: message.project.id,
        profileId: local.profile.id,
        folderId: null,
        name: message.project.name,
        kind: 'task',
        color: message.project.color,
        isInbox: false,
        sortKey: `group-${now}`,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      if (repositoryRef.current) {
        await repositoryRef.current.saveProject(project);
      }
      next = { ...next, projects: [...next.projects, project] };
    }

    const baseline = baselineRef.current.get(group.id) ?? new Map();
    let tasks = [...next.tasks];
    const byId = new Map(tasks.map((task) => [task.id, task]));
    for (const remote of parentFirst(message.tasks ?? [])) {
      const existing = byId.get(remote.id);
      if (existing && existing.updatedAt > remote.updatedAt) {
        continue;
      }
      const normalized: Task = {
        ...remote,
        profileId: local.profile.id,
        projectId: group.id,
      };
      if (repositoryRef.current) {
        await repositoryRef.current.saveTask(normalized);
      }
      if (existing) {
        tasks = tasks.map((task) => (task.id === normalized.id ? normalized : task));
      } else {
        tasks.push(normalized);
      }
      byId.set(normalized.id, normalized);
      baseline.set(normalized.id, normalized.updatedAt);
    }
    baselineRef.current.set(group.id, baseline);

    const updatedGroup: CollabGroup = {
      ...group,
      name: message.group.name,
      ownerName: message.group.ownerName,
      members: message.group.members,
      assignments: { ...group.assignments, ...(message.assignments ?? {}) },
    };
    updateGroupNow(updatedGroup);
    commitRef.current({ ...next, tasks });
  }

  async function applyTask(message: TaskMessage, envelope: IncomingEnvelope) {
    const group = groupsRef.current.find((item) => item.id === message.groupId);
    if (!group || group.token !== message.token) return;
    const local = stateRef.current;
    if (!local) return;
    const existing = local.tasks.find((task) => task.id === message.task.id);
    if (existing && existing.updatedAt > message.task.updatedAt) return;

    const normalized: Task = {
      ...message.task,
      profileId: local.profile.id,
      projectId: group.id,
    };
    if (repositoryRef.current) {
      await repositoryRef.current.saveTask(normalized);
    }
    const baseline = baselineRef.current.get(group.id) ?? new Map();
    baseline.set(normalized.id, normalized.updatedAt);
    baselineRef.current.set(group.id, baseline);

    let currentGroup = group;
    if (message.assignments) {
      currentGroup = {
        ...group,
        assignments: { ...group.assignments, ...message.assignments },
      };
      updateGroupNow(currentGroup);
    }
    commitRef.current({
      ...local,
      tasks: existing
        ? local.tasks.map((task) => (task.id === normalized.id ? normalized : task))
        : [...local.tasks, normalized],
    });

    if (group.ownerId === deviceId && envelope.from !== deviceId) {
      const targets = ownerTargets(currentGroup).filter(
        (target) => target !== envelope.from,
      );
      await sendMany(targets, message);
    }
  }

  async function applyAssign(
    message: AssignMessage,
    envelope: IncomingEnvelope,
  ) {
    const group = groupsRef.current.find((item) => item.id === message.groupId);
    if (!group || group.token !== message.token) return;
    const updated: CollabGroup = {
      ...group,
      assignments: {
        ...group.assignments,
        [message.taskId]: message.assignees,
      },
    };
    updateGroupNow(updated);
    if (group.ownerId === deviceId && envelope.from !== deviceId) {
      const targets = ownerTargets(updated).filter(
        (target) => target !== envelope.from,
      );
      await sendMany(targets, message);
    }
  }

  function handleIncoming(envelope: IncomingEnvelope) {
    const message = envelope.message;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'invite') {
      if (groupsRef.current.some((group) => group.id === message.groupId)) return;
      if (invitesRef.current.some((invite) => invite.id === message.inviteId)) {
        return;
      }
      const invite: CollabInvite = {
        id: message.inviteId,
        groupId: message.groupId,
        groupName: message.groupName,
        ownerId: message.ownerId,
        ownerName: message.ownerName,
        members: message.members,
        token: message.token,
        fromDeviceId: envelope.from,
        fromName: envelope.name || message.fromName,
        receivedAt: Date.now(),
      };
      setInvitesNow([...invitesRef.current, invite]);
      notifyRef.current(
        '收到群组邀请',
        `${invite.fromName} 邀请你加入「${invite.groupName}」`,
      );
      return;
    }

    if (message.type === 'invite_accept') {
      const group = groupsRef.current.find(
        (item) => item.id === message.groupId,
      );
      if (!group || group.ownerId !== deviceId || group.token !== message.token) {
        return;
      }
      if (
        group.members.some(
          (member) => member.deviceId === message.member.deviceId,
        )
      ) {
        return;
      }
      const updated: CollabGroup = {
        ...group,
        members: [
          ...group.members,
          {
            deviceId: message.member.deviceId,
            name: envelope.name || message.member.name,
          },
        ],
      };
      updateGroupNow(updated);
      void sendTo(message.member.deviceId, buildSnapshot(updated)).then(() =>
        sendTo(message.member.deviceId, {
          type: 'members',
          groupId: updated.id,
          token: updated.token,
          members: updated.members,
        } satisfies MembersMessage),
      );
      const targets = ownerTargets(updated).filter(
        (target) => target !== message.member.deviceId,
      );
      void sendMany(targets, {
        type: 'members',
        groupId: updated.id,
        token: updated.token,
        members: updated.members,
      });
      notifyRef.current(
        '新成员加入',
        `${envelope.name || message.member.name} 加入了「${updated.name}」`,
      );
      return;
    }

    if (message.type === 'invite_decline') {
      return;
    }

    if (message.type === 'members') {
      const group = groupsRef.current.find(
        (item) => item.id === message.groupId,
      );
      if (!group || group.token !== message.token) return;
      updateGroupNow({ ...group, members: message.members });
      return;
    }

    if (message.type === 'snapshot') {
      void applySnapshot(message, envelope);
      return;
    }

    if (message.type === 'task') {
      void applyTask(message, envelope);
      return;
    }

    if (message.type === 'assign') {
      void applyAssign(message, envelope);
      return;
    }
  }
  incomingRef.current = handleIncoming;

  useEffect(() => {
    if (!supported || !running || !state) return;
    const currentState = stateRef.current ?? state;
    const jobs: Array<() => Promise<void>> = [];

    for (const group of groupsRef.current) {
      if (!group.members.some((member) => member.deviceId === deviceId)) {
        continue;
      }
      let baseline = baselineRef.current.get(group.id);
      if (!baseline) {
        baseline = new Map();
        for (const task of currentState.tasks) {
          if (task.projectId === group.id) {
            baseline.set(task.id, task.updatedAt);
          }
        }
        baselineRef.current.set(group.id, baseline);
        continue;
      }
      for (const task of currentState.tasks) {
        if (task.projectId !== group.id) continue;
        const previous = baseline.get(task.id);
        if (previous === task.updatedAt) continue;
        baseline.set(task.id, task.updatedAt);
        const message: TaskMessage = {
          type: 'task',
          groupId: group.id,
          token: group.token,
          task,
          assignments: { [task.id]: group.assignments[task.id] ?? [] },
        };
        if (group.ownerId === deviceId) {
          const targets = ownerTargets(group);
          if (targets.length > 0) {
            jobs.push(() => sendMany(targets, message));
          }
        } else {
          jobs.push(() => sendTo(group.ownerId, message));
        }
      }
    }

    for (const job of jobs) void job();
  }, [state?.tasks, supported, running, deviceId]);

  async function assignTask(
    groupId: string,
    taskId: string,
    assignees: string[],
  ) {
    const group = groupsRef.current.find((item) => item.id === groupId);
    if (!group) return;
    const updated: CollabGroup = {
      ...group,
      assignments: { ...group.assignments, [taskId]: assignees },
    };
    updateGroupNow(updated);
    const message: AssignMessage = {
      type: 'assign',
      groupId,
      token: group.token,
      taskId,
      assignees,
    };
    if (group.ownerId === deviceId) {
      await sendMany(ownerTargets(updated), message);
    } else {
      await sendTo(group.ownerId, message);
    }
  }

  function groupForProject(projectId: string): CollabGroup | undefined {
    return groups.find((group) => group.id === projectId);
  }

  function membersForTask(task: Task): CollabMember[] {
    const group = groups.find((item) => item.id === task.projectId);
    if (!group) return [];
    const assigned = group.assignments[task.id] ?? [];
    return assigned
      .map((memberId) =>
        group.members.find((member) => member.deviceId === memberId),
      )
      .filter((member): member is CollabMember => Boolean(member));
  }

  function assigneesForTask(task: Task): string[] {
    const group = groups.find((item) => item.id === task.projectId);
    return group?.assignments[task.id] ?? [];
  }

  return {
    supported,
    running,
    port,
    error,
    deviceId,
    peers,
    groups,
    invites,
    createGroup,
    inviteToGroup,
    acceptInvite,
    declineInvite,
    connectPeer,
    assignTask,
    groupForProject,
    membersForTask,
    assigneesForTask,
    dismissInvite,
  };
}
