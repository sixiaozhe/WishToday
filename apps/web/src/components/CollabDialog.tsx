import { useState } from 'react';
import {
  Check,
  Link2,
  Plus,
  UserRound,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  CollabGroup,
  CollabInvite,
  CollabPeer,
} from '../collab/types';
import { Modal } from './Modal';

interface CollabDialogProps {
  supported: boolean;
  running: boolean;
  port: number | null;
  lanAddress: string | null;
  localAddress: string | null;
  error: string | null;
  peers: CollabPeer[];
  groups: CollabGroup[];
  invites: CollabInvite[];
  deviceId: string;
  onClose: () => void;
  onCreateGroup: (name: string) => Promise<CollabGroup | null>;
  onInvite: (groupId: string, peer: CollabPeer) => void;
  onAcceptInvite: (invite: CollabInvite) => Promise<void>;
  onDeclineInvite: (invite: CollabInvite) => void;
  onOpenGroup: (groupId: string) => void;
  onConnect: (address: string) => Promise<void>;
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

function memberNames(group: CollabGroup): string {
  return group.members.map((member) => member.name).join('、');
}

export function CollabDialog({
  supported,
  running,
  port,
  lanAddress,
  localAddress,
  error,
  peers,
  groups,
  invites,
  deviceId,
  onClose,
  onCreateGroup,
  onInvite,
  onAcceptInvite,
  onDeclineInvite,
  onOpenGroup,
  onConnect,
}: CollabDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [address, setAddress] = useState('');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  const ownedGroups = groups.filter((group) => group.ownerId === deviceId);
  const onlinePeers = peers.filter((peer) => peer.online).length;

  function memberOf(group: CollabGroup): boolean {
    return group.members.some((member) => member.deviceId === deviceId);
  }

  return (
    <Modal
      title="局域网协作"
      subtitle="同一 Wi-Fi / 局域网内的设备可以直接互相发现，无需账号或服务器。"
      onClose={onClose}
      wide
    >
      {!supported && (
        <div className="collab-notice">
          <WifiOff size={15} />
          <span>
            局域网协作需要桌面版。浏览器页面不能监听端口，Web/PWA 暂不支持被发现或加入群组。
          </span>
        </div>
      )}

      {supported && (
        <div className={`collab-status ${running ? 'is-online' : ''}`}>
          {running ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>
            {running
              ? `协作服务已启动${port ? ` · 端口 ${port}` : ''}`
              : '协作服务未启动'}
          </span>
          {error && <em>{error}</em>}
        </div>
      )}

      {supported && running && (
        <div className="collab-address">
          <span>
            本机地址 <code>{localAddress ?? `127.0.0.1:${port ?? '…'}`}</code>
            <em>同一台电脑的两个客户端用这个连接</em>
          </span>
          <span>
            局域网地址 <code>{lanAddress ?? '—'}</code>
          </span>
        </div>
      )}

      <section className="collab-section">
        <div className="collab-section-head">
          <h3>
            <Users size={14} />
            局域网内的其他人
          </h3>
          <span className="collab-count">{onlinePeers} 人在线</span>
        </div>
        {peers.length === 0 ? (
          <p className="field-hint">
            {supported
              ? '正在搜索同一局域网内的设备…首次使用可能需要在 Windows 防火墙中允许访问。'
              : '当前环境无法搜索局域网设备。'}
          </p>
        ) : (
          <div className="collab-peer-list">
            {peers.map((peer) => {
              const groupId =
                targets[peer.deviceId] ?? ownedGroups[0]?.id ?? '';
              const targetGroup = groups.find((group) => group.id === groupId);
              const alreadyMember = targetGroup
                ? targetGroup.members.some(
                    (member) => member.deviceId === peer.deviceId,
                  )
                : false;
              return (
                <div className="collab-peer" key={peer.deviceId}>
                  <span className={`peer-avatar ${peer.online ? '' : 'is-offline'}`}>
                    {initials(peer.name)}
                    <i className={peer.online ? 'is-online' : ''} />
                  </span>
                  <div className="collab-peer-main">
                    <strong>{peer.name}</strong>
                    <span>
                      {peer.online ? '在线' : '离线'}
                      {peer.address ? ` · ${peer.address}` : ''}
                    </span>
                  </div>
                  {ownedGroups.length > 0 ? (
                    <div className="collab-peer-action">
                      <select
                        value={groupId}
                        onChange={(event) =>
                          setTargets((previous) => ({
                            ...previous,
                            [peer.deviceId]: event.target.value,
                          }))
                        }
                        aria-label={`邀请 ${peer.name} 到群组`}
                      >
                        {ownedGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="button ghost small"
                        disabled={!peer.online || alreadyMember || busyInvite === peer.deviceId}
                        onClick={() => {
                          if (!groupId) return;
                          setBusyInvite(peer.deviceId);
                          onInvite(groupId, peer);
                          window.setTimeout(() => setBusyInvite(null), 600);
                        }}
                      >
                        {alreadyMember ? '已加入' : '邀请'}
                      </button>
                    </div>
                  ) : (
                    <span className="collab-peer-hint">先创建群组</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="collab-section">
        <div className="collab-section-head">
          <h3>
            <UserRound size={14} />
            我的群组
          </h3>
          <span className="collab-count">{groups.length} 个</span>
        </div>
        {groups.length === 0 ? (
          <p className="field-hint">还没有群组。创建一个群组后就可以邀请同事加入。</p>
        ) : (
          <div className="collab-group-list">
            {groups.map((group) => {
              const onlineMembers = group.members.filter(
                (member) =>
                  member.deviceId === deviceId ||
                  peers.some(
                    (peer) => peer.deviceId === member.deviceId && peer.online,
                  ),
              ).length;
              return (
                <div className="collab-group" key={group.id}>
                  <div className="collab-group-head">
                    <div>
                      <strong>{group.name}</strong>
                      <span>
                        {group.ownerId === deviceId
                          ? '我是群主'
                          : `群主：${group.ownerName}`}
                        {' · '}
                        {group.members.length} 人 · {onlineMembers} 在线
                      </span>
                    </div>
                    <button
                      className="button ghost small"
                      onClick={() => {
                        onOpenGroup(group.id);
                        onClose();
                      }}
                    >
                      打开清单
                    </button>
                  </div>
                  <div className="collab-group-members" title={memberNames(group)}>
                    {group.members.slice(0, 8).map((member) => {
                      const online =
                        member.deviceId === deviceId ||
                        peers.some(
                          (peer) =>
                            peer.deviceId === member.deviceId && peer.online,
                        );
                      return (
                        <span
                          key={member.deviceId}
                          className={`member-chip ${online ? 'is-online' : 'is-offline'}`}
                          title={`${member.name} · ${online ? '在线' : '离线'}`}
                        >
                          {initials(member.name)}
                        </span>
                      );
                    })}
                    {group.members.length > 8 && (
                      <span className="member-chip">+{group.members.length - 8}</span>
                    )}
                    <em>{memberNames(group)}</em>
                  </div>
                  {group.ownerId !== deviceId && (
                    <p className="field-hint">
                      {memberOf(group)
                        ? '群内任务会实时同步；只有群主可以邀请新成员。'
                        : '你还没有加入这个群组。'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <form
          className="collab-create"
          onSubmit={(event) => {
            event.preventDefault();
            if (!groupName.trim() || creating) return;
            setCreating(true);
            void onCreateGroup(groupName)
              .then((group) => {
                if (group) setGroupName('');
              })
              .finally(() => setCreating(false));
          }}
        >
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="新群组名称，例如：产品设计组"
            disabled={!supported}
          />
          <button
            type="submit"
            className="button primary small"
            disabled={!supported || !groupName.trim() || creating}
          >
            <Plus size={14} />
            新建群组
          </button>
        </form>
      </section>

      {invites.length > 0 && (
        <section className="collab-section">
          <div className="collab-section-head">
            <h3>待处理邀请</h3>
          </div>
          <div className="collab-invites">
            {invites.map((invite) => (
              <div className="collab-invite" key={invite.id}>
                <div>
                  <strong>{invite.groupName}</strong>
                  <span>
                    {invite.fromName} 邀请你加入 · {invite.members.length} 人
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="button primary small"
                    onClick={() => void onAcceptInvite(invite)}
                  >
                    <Check size={13} />
                    同意
                  </button>
                  <button
                    className="button ghost small"
                    onClick={() => onDeclineInvite(invite)}
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {supported && (
        <section className="collab-section">
          <div className="collab-section-head">
            <h3>
              <Link2 size={14} />
              手动连接
            </h3>
          </div>
          <p className="field-hint">
            如果自动发现被防火墙拦截，可以输入对方页面显示的地址手动连接。
          </p>
          <form
            className="collab-create"
            onSubmit={(event) => {
              event.preventDefault();
              if (!address.trim()) return;
              void onConnect(address);
              setAddress('');
            }}
          >
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="例如 192.168.1.20:51234"
            />
            <button
              type="submit"
              className="button ghost small"
              disabled={!address.trim()}
            >
              连接
            </button>
          </form>
        </section>
      )}
    </Modal>
  );
}

export function InvitePrompt({
  invite,
  onAccept,
  onDecline,
}: {
  invite: CollabInvite;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal
      title="收到群组邀请"
      subtitle="同意后这个群组会出现在你的清单里，群内任务会实时同步。"
      onClose={onDecline}
    >
      <div className="invite-prompt">
        <span className="invite-prompt-avatar">
          {initials(invite.fromName)}
        </span>
        <div>
          <strong>{invite.groupName}</strong>
          <span>
            {invite.fromName} 邀请你加入 · 当前 {invite.members.length} 人
          </span>
        </div>
      </div>
      <div className="button-row invite-prompt-actions">
        <button className="button primary" onClick={onAccept}>
          同意加入
        </button>
        <button className="button ghost" onClick={onDecline}>
          暂不加入
        </button>
      </div>
    </Modal>
  );
}
