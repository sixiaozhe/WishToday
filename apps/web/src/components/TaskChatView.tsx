import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import type { Task } from '@dayline/core';
import type { ChatMessage, CollabGroup } from '../collab/types';

interface TaskChatViewProps {
  task: Task;
  group: CollabGroup;
  messages: ChatMessage[];
  deviceId: string;
  onSend: (content: string) => void;
  onBack: () => void;
}

function messageTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskChatView({
  task,
  group,
  messages,
  deviceId,
  onSend,
  onBack,
}: TaskChatViewProps) {
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  function submit() {
    const value = input.trim();
    if (!value) return;
    onSend(value);
    setInput('');
  }

  return (
    <section className="group-chat task-chat-view">
      <div className="group-chat-head">
        <div className="group-chat-title">
          <span className="group-chat-icon">
            <MessageCircle size={16} />
          </span>
          <div>
            <strong>{task.title}</strong>
            <span>
              任务讨论 · {group.name} · {group.members.length} 人
            </span>
          </div>
        </div>
        <button className="button ghost small" onClick={onBack}>
          <ArrowLeft size={14} />
          返回任务列表
        </button>
      </div>

      <div className="group-chat-log" ref={logRef}>
        {messages.length === 0 ? (
          <div className="group-chat-empty">
            <MessageCircle size={26} />
            <strong>还没有讨论</strong>
            <span>发消息和群成员一起讨论这个任务。</span>
          </div>
        ) : (
          messages.map((message) => {
            const own = message.senderId === deviceId;
            return (
              <div
                key={message.id}
                className={`chat-message ${own ? 'is-own' : ''}`}
              >
                {!own && (
                  <span className="chat-avatar">
                    {message.senderName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="chat-body">
                  <div className="chat-meta">
                    <strong>{own ? '我' : message.senderName}</strong>
                    <span>{messageTime(message.createdAt)}</span>
                  </div>
                  <div className="chat-bubble">{message.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="group-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          rows={2}
          value={input}
          placeholder="讨论这个任务，Enter 发送，Shift+Enter 换行"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          className="button primary"
          disabled={!input.trim()}
        >
          <Send size={15} />
          发送
        </button>
      </form>
    </section>
  );
}
