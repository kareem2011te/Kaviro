import React, { useEffect, useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { PrimaryButton, SecondaryButton, SectionHeader, SurfaceCard } from '../design-system/components';
import { apiRequest } from '../lib/api';
import type { Language } from '../lib/i18n';
import type { Project, TaskItem, TaskPriority, TaskStatus, UserProfile } from '../lib/types';

interface TasksProjectsViewProps {
  lang: Language;
  currentUser: UserProfile;
  users: UserProfile[];
}

export const TasksProjectsView: React.FC<TasksProjectsViewProps> = ({ lang, currentUser, users }) => {
  const isAr = lang === 'ar';
  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'supervisor';

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [commentText, setCommentText] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(currentUser.id);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [deadline, setDeadline] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));

  const userMap = new Map(users.map((u) => [u.id, u]));

  const loadTasks = async () => {
    const res = await apiRequest<{ projects: Project[]; tasks: TaskItem[] }>('/api/tasks');
    setProjects(res.projects);
    setTasks(res.tasks);
    if (selectedTask) {
      const updated = res.tasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        projectId: selectedProjectId === 'all' ? projects[0]?.id : selectedProjectId,
        title,
        description,
        assigneeId,
        priority,
        deadline,
      }),
    });
    setShowNewTask(false);
    setTitle('');
    setDescription('');
    loadTasks();
  };

  const handleMoveStatus = async (taskId: string, status: TaskStatus) => {
    await apiRequest(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    loadTasks();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentText.trim()) return;
    await apiRequest(`/api/tasks/${selectedTask.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text: commentText.trim() }),
    });
    setCommentText('');
    loadTasks();
  };

  const visibleTasks = tasks.filter(
    (t) => selectedProjectId === 'all' || t.projectId === selectedProjectId
  );

  const columns: Array<{ key: TaskStatus; label: string; labelAr: string }> = [
    { key: 'backlog', label: 'Backlog', labelAr: 'قائمة الانتظار' },
    { key: 'in_progress', label: 'In Progress', labelAr: 'قيد التنفيذ' },
    { key: 'in_review', label: 'In Review', labelAr: 'قيد المراجعة' },
    { key: 'done', label: 'Done', labelAr: 'مكتمل' },
  ];

  // Workload summary
  const workload = users.map((u) => ({
    user: u,
    openCount: tasks.filter((t) => t.assigneeId === u.id && t.status !== 'done').length,
    doneCount: tasks.filter((t) => t.assigneeId === u.id && t.status === 'done').length,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isAr ? 'إدارة المهام والمشاريع' : 'Tasks & Project Boards'}
        subtitle={
          isAr
            ? 'توزيع المهام، تحديد الأولويات والمواعيد النهائية، ومتابعة عبء العمل الجماعي.'
            : 'Organize project sprints, assign tasks, track deadlines, collaborate in comments, and monitor team workload.'
        }
        action={
          <PrimaryButton size="sm" onClick={() => setShowNewTask(!showNewTask)}>
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? 'مهمة جديدة' : 'New Task'}</span>
          </PrimaryButton>
        }
      />

      {/* Project Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedProjectId('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
            selectedProjectId === 'all'
              ? 'bg-[#1D7AFC]/15 border-[#00D4FF] text-slate-900 dark:text-white'
              : 'bg-white dark:bg-[#091124] border-slate-200 dark:border-blue-500/20 text-slate-600 dark:text-slate-400'
          }`}
        >
          {isAr ? 'جميع المشاريع' : 'All Projects'}
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedProjectId(p.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
              selectedProjectId === p.id
                ? 'bg-[#1D7AFC]/15 border-[#00D4FF] text-slate-900 dark:text-white'
                : 'bg-white dark:bg-[#091124] border-slate-200 dark:border-blue-500/20 text-slate-600 dark:text-slate-400'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {showNewTask && (
        <SurfaceCard elevated className="p-5">
          <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAr ? 'عنوان المهمة' : 'Task title'}
              className="lg:col-span-2 px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
            />
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={!isPrivileged}
              className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isAr ? 'وصف المهمة...' : 'Description...'}
              className="sm:col-span-2 lg:col-span-3 px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
            />
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="px-3 py-2 text-xs font-mono-tabular rounded-lg bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/25"
            />
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <SecondaryButton size="sm" type="button" onClick={() => setShowNewTask(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton size="sm" type="submit">
                Create Task
              </PrimaryButton>
            </div>
          </form>
        </SurfaceCard>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.status === col.key);
          return (
            <SurfaceCard key={col.key} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-blue-500/15">
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  {isAr ? col.labelAr : col.label}
                </span>
                <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {colTasks.map((task) => {
                  const assignee = userMap.get(task.assigneeId);
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-200 dark:border-blue-500/20 hover:border-[#00D4FF] transition-colors cursor-pointer space-y-2"
                    >
                      <div className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {task.priority} · Due {task.deadline} · {assignee?.fullName || 'Unassigned'}
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#091124] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#1D7AFC] to-[#00D4FF]"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> {task.comments.length}
                        </span>
                        <select
                          value={task.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleMoveStatus(task.id, e.target.value as TaskStatus)}
                          className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#091124] border border-slate-300 dark:border-blue-500/20"
                        >
                          {columns.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      {/* Task Detail & Comments Drawer + Team Workload Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SurfaceCard className="lg:col-span-6 p-5">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-3">
            {isAr ? 'نظرة عامة على عبء عمل الفريق' : 'Team Workload Overview'}
          </h3>
          <div className="divide-y divide-slate-200 dark:divide-blue-500/15">
            {workload.map(({ user, openCount, doneCount }) => (
              <div key={user.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">{user.fullName}</span>
                  <span className="text-slate-500 dark:text-slate-400"> · {user.desiredRole}</span>
                </div>
                <div className="font-mono-tabular text-slate-600 dark:text-slate-300">
                  {openCount} open · {doneCount} done
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="lg:col-span-6 p-5">
          {selectedTask ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    {selectedTask.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedTask.description || 'No additional description.'}
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-[#1D7AFC] dark:text-[#00D4FF]">
                  {selectedTask.progress}%
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedTask.comments.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#0e1934] text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {userMap.get(c.authorId)?.fullName || 'Member'}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">{c.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={isAr ? 'أضف تعليقاً...' : 'Write a task comment...'}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25"
                />
                <PrimaryButton size="sm" type="submit">
                  Post
                </PrimaryButton>
              </form>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
              {isAr ? 'اختر مهمة من اللوحة لعرض تفاصيلها والتعليقات.' : 'Click any task card to inspect details and post comments.'}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
};
