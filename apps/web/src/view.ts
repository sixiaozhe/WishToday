import type { Project, SmartView, Tag } from '@dayline/core';

export type ModuleViewId = 'focus' | 'habits' | 'countdowns' | 'stats' | 'summary';

export type View =
  | { kind: 'smart'; id: SmartView }
  | { kind: 'project'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'filter'; id: string }
  | { kind: 'module'; id: ModuleViewId };

export const MODULE_VIEWS: Array<{ id: ModuleViewId; label: string }> = [
  { id: 'summary', label: '摘要' },
  { id: 'focus', label: '专注' },
  { id: 'habits', label: '习惯' },
  { id: 'countdowns', label: '纪念日' },
  { id: 'stats', label: '统计' },
];

export const SMART_VIEWS: Array<{
  id: SmartView;
  label: string;
  countKey:
    | 'inbox'
    | 'today'
    | 'tomorrow'
    | 'next7days'
    | 'all'
    | 'completed'
    | 'abandoned'
    | 'skipped'
    | 'trash';
}> = [
  { id: 'inbox', label: '收集箱', countKey: 'inbox' },
  { id: 'today', label: '今天', countKey: 'today' },
  { id: 'tomorrow', label: '明天', countKey: 'tomorrow' },
  { id: 'next7days', label: '最近 7 天', countKey: 'next7days' },
  { id: 'all', label: '所有', countKey: 'all' },
  { id: 'completed', label: '已完成', countKey: 'completed' },
  { id: 'abandoned', label: '已放弃', countKey: 'abandoned' },
  { id: 'skipped', label: '已跳过', countKey: 'skipped' },
  { id: 'trash', label: '垃圾桶', countKey: 'trash' },
];

export function viewTitle(view: View, projects: Project[], tags: Tag[] = []): string {
  if (view.kind === 'smart') {
    return SMART_VIEWS.find((item) => item.id === view.id)?.label ?? '任务';
  }
  if (view.kind === 'tag') {
    return `#${tags.find((tag) => tag.id === view.id)?.name ?? '标签'}`;
  }
  if (view.kind === 'filter') {
    return '过滤器';
  }
  if (view.kind === 'module') {
    return MODULE_VIEWS.find((item) => item.id === view.id)?.label ?? '模块';
  }
  return projects.find((project) => project.id === view.id)?.name ?? '清单';
}

export function isSameView(a: View, b: View): boolean {
  return a.kind === b.kind && a.id === b.id;
}
