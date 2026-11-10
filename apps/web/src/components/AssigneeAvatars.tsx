import type { CollabMember } from '../collab/types';

const COLORS = [
  '#5b8cff',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
];

function colorFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return COLORS[hash % COLORS.length] ?? COLORS[0]!;
}

interface AssigneeAvatarsProps {
  people: Array<Pick<CollabMember, 'deviceId' | 'name'>>;
  size?: 'xs' | 'sm';
  max?: number;
  className?: string;
}

export function AssigneeAvatars({
  people,
  size = 'sm',
  max = 3,
  className = '',
}: AssigneeAvatarsProps) {
  if (people.length === 0) return null;
  const unique = people.filter(
    (person, index, list) =>
      list.findIndex(
        (item) =>
          item.deviceId === person.deviceId && item.name === person.name,
      ) === index,
  );
  const shown = unique.slice(0, max);
  const rest = unique.length - shown.length;

  return (
    <span
      className={`assignee-avatars is-${size} ${className}`.trim()}
      title={`关联成员：${unique.map((person) => person.name).join('、')}`}
      aria-label={`关联成员：${unique.map((person) => person.name).join('、')}`}
    >
      {shown.map((person) => (
        <span
          key={`${person.deviceId ?? person.name}-${person.name}`}
          className="assignee-avatar"
          style={{ background: colorFor(person.name) }}
        >
          {person.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {rest > 0 && <span className="assignee-avatar is-more">+{rest}</span>}
    </span>
  );
}
