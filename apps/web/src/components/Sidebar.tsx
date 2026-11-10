import { useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Folder,
  FolderPlus,
  Hash,
  Inbox,
  ListFilter,
  ListTodo,
  Moon,
  Pencil,
  Plus,
  Settings2,
  SkipForward,
  Sun,
  Sunrise,
  Tags,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { AppState, Folder as FolderType, Project, SavedFilter, Tag, TaskCounts } from '@dayline/core';
import { MODULE_VIEWS, SMART_VIEWS, isSameView, type View } from '../view';

interface SidebarProps {
  state: AppState;
  view: View;
  counts: TaskCounts;
  onSelectView: (view: View) => void;
  onAddProject: (name: string, folderId: string | null) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onMoveTaskToProject: (taskId: string, projectId: string) => void;
  onAddFolder: (name: string) => void;
  onToggleFolder: (folder: FolderType) => void;
  onDeleteFolder: (folder: FolderType) => void;
  onOpenTagManager: () => void;
  onSelectFilter: (filter: SavedFilter) => void;
  onOpenFilterDialog: () => void;
  onEditFilter: (filter: SavedFilter) => void;
  onDeleteFilter: (filter: SavedFilter) => void;
  onOpenBackup: () => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
  activeUserName: string;
  onOpenUsers: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onClose?: () => void;
  storageLabel?: string;
  sharedGroupIds?: Set<string>;
}

const SMART_ICONS = {
  inbox: Inbox,
  today: CalendarDays,
  tomorrow: Sunrise,
  next7days: CalendarRange,
  all: ListTodo,
  completed: CheckCircle2,
  abandoned: CircleSlash,
  skipped: SkipForward,
  trash: Trash2,
} as const;

const MODULE_ICONS = {
  summary: CalendarDays,
  focus: Settings2,
  habits: CheckCircle2,
  countdowns: CalendarRange,
  stats: ListTodo,
} as const;

export function Sidebar({
  state,
  view,
  counts,
  onSelectView,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onMoveTaskToProject,
  onAddFolder,
  onToggleFolder,
  onDeleteFolder,
  onOpenTagManager,
  onSelectFilter,
  onOpenFilterDialog,
  onEditFilter,
  onDeleteFilter,
  onOpenBackup,
  onOpenTemplates,
  onOpenSettings,
  activeUserName,
  onOpenUsers,
  theme,
  onToggleTheme,
  onClose,
  storageLabel,
  sharedGroupIds,
}: SidebarProps) {
  const [addingProject, setAddingProject] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const folders = state.folders
    .filter((folder) => folder.deletedAt === null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const projects = state.projects
    .filter((project) => project.deletedAt === null && !project.isInbox)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const filters = state.filters
    .filter((filter) => filter.deletedAt === null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  function projectCount(projectId: string): number {
    return state.tasks.filter(
      (task) =>
        task.deletedAt === null &&
        task.status === 'open' &&
        task.projectId === projectId &&
        task.parentId === null,
    ).length;
  }

  function submitProject(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    const folderId = addingProject === 'root' ? null : addingProject;
    onAddProject(name, folderId);
    setProjectName('');
    setAddingProject(null);
  }

  function submitFolder(event: FormEvent) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    onAddFolder(name);
    setFolderName('');
    setAddingFolder(false);
  }

  function renderProject(project: Project) {
    const active = isSameView(view, { kind: 'project', id: project.id });
    const count = projectCount(project.id);
    return (
      <div key={project.id} className={`project-row ${active ? 'is-active' : ''}`}>
        <button
          className="nav-item project-main"
          onClick={() => onSelectView({ kind: 'project', id: project.id })}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            const taskId = event.dataTransfer.getData('text/plain');
            if (taskId) onMoveTaskToProject(taskId, project.id);
          }}
        >
          <span className="project-dot" style={{ background: project.color }} />
          <span>{project.name}</span>
          {sharedGroupIds?.has(project.id) && (
            <Users size={12} className="project-shared-icon" aria-label="群组" />
          )}
          {project.kind === 'note' && <em className="kind-badge">笔记</em>}
          {count > 0 && <em>{count}</em>}
        </button>
        <button
          className="icon-button tiny project-action"
          onClick={() => onEditProject(project)}
          aria-label={`编辑${project.name}`}
        >
          <Pencil size={12} />
        </button>
        <button
          className="icon-button tiny project-action"
          onClick={() => onDeleteProject(project)}
          aria-label={`删除${project.name}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  function renderProjectAdder(folderId: string | null) {
    const key = folderId ?? 'root';
    if (addingProject !== key) return null;
    return (
      <form className="inline-form" onSubmit={submitProject}>
        <Folder size={15} />
        <input
          autoFocus
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="清单名称"
          onBlur={() => {
            if (!projectName.trim()) setAddingProject(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setProjectName('');
              setAddingProject(null);
            }
          }}
        />
      </form>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">D</div>
        <div className="brand-copy">
          <strong>Dayline</strong>
          <span>本地优先</span>
        </div>
        {onClose && (
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="关闭侧边栏">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="sidebar-scroll">
        <nav className="sidebar-nav" aria-label="智能清单">
          {SMART_VIEWS.map((item) => {
            const Icon = SMART_ICONS[item.id];
            const active = isSameView(view, { kind: 'smart', id: item.id });
            const count = counts[item.countKey];
            return (
              <button
                key={item.id}
                className={`nav-item ${active ? 'is-active' : ''}`}
                onClick={() => onSelectView({ kind: 'smart', id: item.id })}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                {count > 0 && <em>{count}</em>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>过滤器</span>
            <button
              className="icon-button small"
              onClick={onOpenFilterDialog}
              aria-label="新建过滤器"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="filter-list">
            {filters.map((filter) => {
              const active = view.kind === 'filter' && view.id === filter.id;
              return (
                <div key={filter.id} className={`filter-row ${active ? 'is-active' : ''}`}>
                  <button
                    className="nav-item filter-main"
                    onClick={() => onSelectFilter(filter)}
                  >
                    <ListFilter size={15} />
                    <span>{filter.name}</span>
                    <em>{filter.conditions.length}</em>
                  </button>
                  <button
                    className="icon-button tiny"
                    onClick={() => onEditFilter(filter)}
                    aria-label={`编辑过滤器${filter.name}`}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="icon-button tiny"
                    onClick={() => onDeleteFilter(filter)}
                    aria-label={`删除过滤器${filter.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            {filters.length === 0 && (
              <button className="nav-item muted" onClick={onOpenFilterDialog}>
                <Plus size={15} />
                <span>新建过滤器</span>
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>清单</span>
            <span className="section-actions">
              <button
                className="icon-button tiny"
                onClick={() => setAddingFolder(true)}
                aria-label="新建文件夹"
              >
                <FolderPlus size={14} />
              </button>
              <button
                className="icon-button small"
                onClick={() => setAddingProject('root')}
                aria-label="新建清单"
              >
                <Plus size={15} />
              </button>
            </span>
          </div>

          {addingFolder && (
            <form className="inline-form" onSubmit={submitFolder}>
              <Folder size={15} />
              <input
                autoFocus
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="文件夹名称"
                onBlur={() => {
                  if (!folderName.trim()) setAddingFolder(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setFolderName('');
                    setAddingFolder(false);
                  }
                }}
              />
            </form>
          )}

          <div className="project-list">
            {folders.map((folder) => {
              const folderProjects = projects.filter(
                (project) => project.folderId === folder.id,
              );
              return (
                <div key={folder.id} className="folder-group">
                  <div className="folder-heading">
                    <button
                      className="folder-toggle"
                      onClick={() => onToggleFolder(folder)}
                      aria-label={folder.collapsed ? '展开文件夹' : '收起文件夹'}
                    >
                      {folder.collapsed ? (
                        <ChevronRight size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                      <Folder size={13} />
                      <span>{folder.name}</span>
                    </button>
                    <button
                      className="icon-button tiny"
                      onClick={() => setAddingProject(folder.id)}
                      aria-label={`在${folder.name}中新建清单`}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      className="icon-button tiny"
                      onClick={() => onDeleteFolder(folder)}
                      aria-label={`删除文件夹${folder.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {!folder.collapsed && (
                    <div className="folder-children">
                      {folderProjects.map(renderProject)}
                      {renderProjectAdder(folder.id)}
                    </div>
                  )}
                </div>
              );
            })}

            {projects
              .filter((project) => project.folderId === null)
              .map(renderProject)}
            {renderProjectAdder(null)}

            {projects.length === 0 && folders.length === 0 && addingProject === null && (
              <button className="nav-item muted" onClick={() => setAddingProject('root')}>
                <Plus size={16} />
                <span>新建清单</span>
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>标签</span>
            <button
              className="icon-button small"
              onClick={onOpenTagManager}
              aria-label="管理标签"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="tag-list">
            {state.tags.map((tag) => (
              <button
                key={tag.id}
                className={`tag-chip ${
                  isSameView(view, { kind: 'tag', id: tag.id }) ? 'is-active' : ''
                }`}
                onClick={() => onSelectView({ kind: 'tag', id: tag.id })}
              >
                <Hash size={12} style={{ color: tag.color }} />
                {tag.name}
              </button>
            ))}
            {state.tags.length === 0 && (
              <button className="tag-chip muted" onClick={onOpenTagManager}>
                <Plus size={12} />
                新建标签
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>模块</span>
          </div>
          <div className="module-list">
            {MODULE_VIEWS.map((item) => {
              const Icon = MODULE_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  className={`nav-item ${
                    isSameView(view, { kind: 'module', id: item.id }) ? 'is-active' : ''
                  }`}
                  onClick={() => onSelectView({ kind: 'module', id: item.id })}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>数据</span>
          </div>
          <div className="module-list">
            <button className="nav-item" onClick={onOpenBackup}>
              <Settings2 size={16} />
              <span>备份与恢复</span>
            </button>
            <button className="nav-item" onClick={onOpenTemplates}>
              <Tags size={16} />
              <span>任务模板</span>
            </button>
            <button className="nav-item" onClick={onOpenSettings}>
              <Settings2 size={16} />
              <span>设置</span>
            </button>
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="nav-item user-switch" onClick={onOpenUsers}>
          <span className="user-avatar small">{activeUserName.slice(0, 1).toUpperCase()}</span>
          <span>{activeUserName}</span>
          <em>切换</em>
        </button>
        <button className="nav-item" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
        </button>
        <div className="sidebar-note">{storageLabel ?? '数据默认保存在本机'}</div>
      </div>
    </aside>
  );
}
