import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import type { LocalUser } from '../users';
import { Modal } from './Modal';

interface UserManagerProps {
  users: LocalUser[];
  activeUserId: string;
  onSwitch: (user: LocalUser) => void;
  onCreate: (name: string) => void;
  onRename: (user: LocalUser, name: string) => void;
  onDelete: (user: LocalUser) => void;
  onClose: () => void;
}

export function UserManager({
  users,
  activeUserId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: UserManagerProps) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    onCreate(value);
    setName('');
  }

  return (
    <Modal
      title="用户管理"
      subtitle="每个用户拥有独立的本地数据库，任务、清单、标签、习惯和专注记录互不影响。"
      onClose={onClose}
      wide
    >
      <form className="manager-add" onSubmit={submit}>
        <UserRound size={16} />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="新用户名称"
          aria-label="新用户名称"
        />
        <button className="button primary" type="submit" disabled={!name.trim()}>
          <Plus size={14} />
          创建用户
        </button>
      </form>

      <div className="user-list">
        {users.map((user) => {
          const active = user.id === activeUserId;
          return (
            <div key={user.id} className={`user-row ${active ? 'is-active' : ''}`}>
              <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div className="user-copy">
                {editingId === user.id ? (
                  <input
                    className="user-name-input"
                    autoFocus
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        const value = editingName.trim();
                        if (value) onRename(user, value);
                        setEditingId(null);
                      }
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <strong>
                    {user.name}
                    {active && <em className="user-active-badge">当前</em>}
                  </strong>
                )}
                <span>
                  {user.demo ? '示例数据' : '独立数据'} · 创建于{' '}
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>

              {editingId === user.id ? (
                <button
                  className="icon-button small"
                  onClick={() => {
                    const value = editingName.trim();
                    if (value) onRename(user, value);
                    setEditingId(null);
                  }}
                  aria-label="保存用户名"
                >
                  <Check size={15} />
                </button>
              ) : (
                <>
                  {!active && (
                    <button className="button ghost small" onClick={() => onSwitch(user)}>
                      切换
                    </button>
                  )}
                  <button
                    className="icon-button small"
                    onClick={() => {
                      setEditingId(user.id);
                      setEditingName(user.name);
                    }}
                    aria-label={`重命名${user.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button small"
                    onClick={() => {
                      if (confirm(`删除用户“${user.name}”？该用户的本地数据会被永久删除。`)) {
                        onDelete(user);
                      }
                    }}
                    aria-label={`删除用户${user.name}`}
                    disabled={users.length <= 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="field-hint">
        <Users size={13} /> 用户数据只保存在当前浏览器/设备中。切换用户不会上传或合并任何数据。
      </p>
    </Modal>
  );
}
