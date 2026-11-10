import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import type { ChatMessage } from '../collab/types';

interface TaskChatProps {
  messages: ChatMessage[];
  deviceId: string;
  onSend: (content: string) => void;
}

function chatTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskChat({ messages, deviceId, onSend }: TaskChatProps) {
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
    <div className="task-chat">
      <span className="detail-label">
        <MessageCircle size={14} />
        群组讨论
        {messages.length > 0 && <em>{messages.length}</em>}
      </span>
      <div className="task-chat-log" ref={logRef}>
        {messages.length === 0 ? (
          <p className="field-hint">
            群成员都可以在这里讨论这个任务；消息会同步给在线成员。
          </p>
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
                    <span>{chatTime(message.createdAt)}</span>
                  </div>
                  <div className="chat-bubble">{message.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        className="task-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          rows={2}
          value={input}
          placeholder="讨论这个任务…"
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
          className="button primary small"
          disabled={!input.trim()}
          aria-label="发送讨论消息"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
