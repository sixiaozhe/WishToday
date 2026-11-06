import {
  achievements,
  dailyStats,
  focusSummary,
  habitStreak,
  taskStats,
  type AppState,
  type Habit,
  type Project,
  type Tag,
} from '@dayline/core';

interface StatsViewProps {
  state: AppState;
  projects: Project[];
  tags: Tag[];
}

export function StatsView({ state, projects, tags }: StatsViewProps) {
  const stats = taskStats(state.tasks);
  const daily = dailyStats(state.tasks, 14);
  const focus = focusSummary(state.focusSessions);
  const achievement = achievements(state);
  const maxDaily = Math.max(1, ...daily.map((day) => Math.max(day.created, day.completed)));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  const habits: Habit[] = state.habits.filter((habit) => habit.deletedAt === null);

  return (
    <div className="stats-wrap">
      <div className="stat-grid">
        <div>
          <strong>{stats.open}</strong>
          <span>未完成任务</span>
        </div>
        <div>
          <strong>{stats.completed}</strong>
          <span>已完成</span>
        </div>
        <div>
          <strong>{stats.completionRate}%</strong>
          <span>完成率</span>
        </div>
        <div>
          <strong>{stats.overdue}</strong>
          <span>已过期</span>
        </div>
        <div>
          <strong>{stats.todayCompleted}</strong>
          <span>今日完成</span>
        </div>
        <div>
          <strong>{stats.weekCompleted}</strong>
          <span>近 7 天完成</span>
        </div>
        <div>
          <strong>{focus.totalMinutes}</strong>
          <span>累计专注分钟</span>
        </div>
        <div>
          <strong>{achievement.score}</strong>
          <span>成就值 · Lv.{achievement.level}</span>
        </div>
      </div>

      <section className="stats-section">
        <h3>近 14 天任务趋势</h3>
        <div className="bar-chart">
          {daily.map((day) => (
            <div key={day.date} className="bar-day" title={`${day.date} 新建 ${day.created} / 完成 ${day.completed}`}>
              <div className="bar-track">
                <span
                  className="bar-created"
                  style={{ height: `${(day.created / maxDaily) * 100}%` }}
                />
                <span
                  className="bar-completed"
                  style={{ height: `${(day.completed / maxDaily) * 100}%` }}
                />
              </div>
              <em>{day.date.slice(5)}</em>
            </div>
          ))}
        </div>
        <div className="legend">
          <span><i className="legend-created" /> 新建</span>
          <span><i className="legend-completed" /> 完成</span>
        </div>
      </section>

      <div className="stats-columns">
        <section className="stats-section">
          <h3>优先级分布</h3>
          <div className="distribution">
            {stats.byPriority.map((item) => (
              <div key={item.priority} className="distribution-row">
                <span>
                  {item.priority === 0
                    ? '无'
                    : item.priority === 1
                      ? '低'
                      : item.priority === 3
                        ? '中'
                        : '高'}
                </span>
                <div className="distribution-track">
                  <i
                    className={`priority-fill p${item.priority}`}
                    style={{
                      width: `${stats.open === 0 ? 0 : (item.count / stats.open) * 100}%`,
                    }}
                  />
                </div>
                <em>{item.count}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="stats-section">
          <h3>清单分布</h3>
          <div className="distribution">
            {stats.byProject.slice(0, 6).map((item) => {
              const project = projectById.get(item.projectId);
              return (
                <div key={item.projectId} className="distribution-row">
                  <span>{project?.name ?? '未知'}</span>
                  <div className="distribution-track">
                    <i
                      style={{
                        width: `${stats.open === 0 ? 0 : (item.count / stats.open) * 100}%`,
                        background: project?.color ?? 'var(--accent)',
                      }}
                    />
                  </div>
                  <em>{item.count}</em>
                </div>
              );
            })}
            {stats.byProject.length === 0 && <p className="field-hint">暂无未完成任务。</p>}
          </div>
        </section>

        <section className="stats-section">
          <h3>标签分布</h3>
          <div className="distribution">
            {stats.byTag.slice(0, 8).map((item) => {
              const tag = tagById.get(item.tagId);
              return (
                <div key={item.tagId} className="distribution-row">
                  <span>#{tag?.name ?? '已删除'}</span>
                  <div className="distribution-track">
                    <i
                      style={{
                        width: `${stats.open === 0 ? 0 : (item.count / stats.open) * 100}%`,
                        background: tag?.color ?? 'var(--accent)',
                      }}
                    />
                  </div>
                  <em>{item.count}</em>
                </div>
              );
            })}
            {stats.byTag.length === 0 && <p className="field-hint">暂无标签统计。</p>}
          </div>
        </section>

        <section className="stats-section">
          <h3>习惯概览</h3>
          <div className="distribution">
            {habits.map((habit) => {
              const streak = habitStreak(state.habitCheckins, habit);
              return (
                <div key={habit.id} className="distribution-row">
                  <span>{habit.icon} {habit.name}</span>
                  <div className="distribution-track">
                    <i
                      style={{
                        width: `${Math.min(100, (streak.current / 30) * 100)}%`,
                        background: habit.color,
                      }}
                    />
                  </div>
                  <em>{streak.current} 天</em>
                </div>
              );
            })}
            {habits.length === 0 && <p className="field-hint">还没有习惯。</p>}
          </div>
        </section>
      </div>

      <section className="stats-section">
        <h3>成就</h3>
        <div className="achievement-grid">
          {achievement.list.map((item) => (
            <div key={item.id} className={`achievement ${item.unlocked ? 'is-unlocked' : ''}`}>
              <span className="achievement-icon">{item.icon}</span>
              <div>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
                <div className="achievement-track">
                  <i
                    style={{
                      width: `${Math.min(100, (item.progress / item.target) * 100)}%`,
                    }}
                  />
                </div>
                <em>
                  {Math.min(item.progress, item.target)} / {item.target}
                </em>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
