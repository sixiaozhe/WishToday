import { Fragment, type ReactNode } from 'react';

function inline(text: string, onLinkTask?: (title: string) => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('[[')) {
      const title = token.slice(2, -2);
      nodes.push(
        <button
          key={key++}
          type="button"
          className="md-task-link"
          onClick={() => onLinkTask?.(title)}
          disabled={!onLinkTask}
        >
          {title}
        </button>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a key={key++} href={link[2]} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({
  value,
  onLinkTask,
}: {
  value: string;
  onLinkTask?: (title: string) => void;
}) {
  if (!value.trim()) return null;
  const lines = value.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];
  let ordered = false;

  function flushList() {
    if (list.length === 0) return;
    const Tag = ordered ? 'ol' : 'ul';
    blocks.push(<Tag key={blocks.length}>{list}</Tag>);
    list = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1]?.length ?? 1;
      const content = heading[2] ?? '';
      const Tag = (`h${Math.min(4, level + 1)}`) as 'h2';
      blocks.push(<Tag key={index}>{inline(content, onLinkTask)}</Tag>);
      return;
    }
    const checkbox = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(trimmed);
    if (checkbox) {
      ordered = false;
      list.push(
        <li key={index} className={`md-task ${checkbox[1] === ' ' ? '' : 'is-done'}`}>
          <span className={`md-check ${checkbox[1] === ' ' ? '' : 'is-checked'}`}>
            {checkbox[1] === ' ' ? '' : '✓'}
          </span>
          {inline(checkbox[2] ?? '', onLinkTask)}
        </li>,
      );
      return;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      ordered = false;
      list.push(<li key={index}>{inline(bullet[1] ?? '', onLinkTask)}</li>);
      return;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (numbered) {
      ordered = true;
      list.push(<li key={index}>{inline(numbered[1] ?? '', onLinkTask)}</li>);
      return;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushList();
      blocks.push(<blockquote key={index}>{inline(quote[1] ?? '', onLinkTask)}</blockquote>);
      return;
    }
    if (trimmed === '---') {
      flushList();
      blocks.push(<hr key={index} />);
      return;
    }
    flushList();
    blocks.push(<p key={index}>{inline(line, onLinkTask)}</p>);
  });

  flushList();
  return <div className="markdown">{blocks.map((block, index) => <Fragment key={index}>{block}</Fragment>)}</div>;
}
