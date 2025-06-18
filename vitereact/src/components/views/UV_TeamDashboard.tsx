import React, { useEffect, useState, ChangeEvent, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { useNavigate } from 'react-router-dom';

type TaskPriority = 'Low' | 'Medium' | 'High';
type TaskStatus = 'To Do' | 'In Progress' | 'Done';

interface Assignee {
  user_id: number;
  name: string;
  avatar_url: string | null;
}

interface Task {
  task_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  assignees: Assignee[];
  created_at: string;
  updated_at: string;
}

interface ActivityEvent {
  event_id: number;
  event_type: string;
  description: string;
  created_at: string;
}

interface ProgressData {
  To_Do: number;
  In_Progress: number;
  Done: number;
}

const PRIORITY_OPTIONS: TaskPriority[] = ['Low', 'Medium', 'High'];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Fetch functions

const fetchTeamTasks = async (params: {
  assignee_ids?: number[];
  priority?: TaskPriority[];
  due_date_from?: string | null;
  due_date_to?: string | null;
}): Promise<Task[]> => {
  // Build query params string
  const query = new URLSearchParams();
  if (params.assignee_ids && params.assignee_ids.length > 0) {
    params.assignee_ids.forEach((id) => query.append('assignee_ids', id.toString()));
  }
  if (params.priority && params.priority.length > 0) {
    params.priority.forEach((p) => query.append('priority', p));
  }
  if (params.due_date_from) {
    query.append('due_date_from', params.due_date_from);
  }
  if (params.due_date_to) {
    query.append('due_date_to', params.due_date_to);
  }
  // Always sort by due_date ascending
  query.append('sort_by', 'due_date');
  query.append('sort_order', 'asc');

  const { data } = await axios.get<Task[]>(`${API_BASE_URL}/api/tasks?${query.toString()}`);
  return data;
};

const fetchActivityFeed = async (): Promise<ActivityEvent[]> => {
  const { data } = await axios.get<ActivityEvent[]>(`${API_BASE_URL}/api/team/activities`);
  return data;
};

const UV_TeamDashboard: React.FC = () => {
  const navigate = useNavigate();
  const authUser = useAppStore(state => state.user);
  const open_modal = useAppStore(state => state.open_modal);
  const websocketConnected = useAppStore(state => state.connected);
  const [filters, setFilters] = useState<{
    assignees: number[];
    priority: TaskPriority[];
    due_date_from: string | null;
    due_date_to: string | null;
  }>({
    assignees: [],
    priority: [],
    due_date_from: null,
    due_date_to: null,
  });

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Protect: only managers can view
  useEffect(() => {
    if (!authUser || authUser.role !== 'manager') {
      navigate('/tasks', { replace: true });
    }
  }, [authUser, navigate]);

  // Queries

  const { data: teamTasks = [], isLoading: isLoadingTasks, isError: isErrorTasks, refetch: refetchTasks, error: errorTasks } = useQuery<Task[], Error>(
    ['teamTasks', filters],
    () => fetchTeamTasks({
      assignee_ids: filters.assignees,
      priority: filters.priority,
      due_date_from: filters.due_date_from,
      due_date_to: filters.due_date_to,
    }),
    {
      keepPreviousData: true,
      staleTime: 1000 * 60 * 5, // 5 min
    }
  );

  const { data: activityFeed = [], isLoading: isLoadingActivity, isError: isErrorActivity, refetch: refetchActivity, error: errorActivity } = useQuery<ActivityEvent[], Error>(
    ['teamActivityFeed'],
    fetchActivityFeed,
    {
      refetchInterval: 60000, // refresh every 60 sec
      staleTime: 1000 * 60 * 2,
    }
  );

  // Calculate progressData from teamTasks:
  const progressData: ProgressData = useMemo(() => {
    const data: ProgressData = { To_Do: 0, In_Progress: 0, Done: 0 };
    teamTasks.forEach((task) => {
      switch (task.status) {
        case 'To Do':
          data.To_Do += 1;
          break;
        case 'In Progress':
          data.In_Progress += 1;
          break;
        case 'Done':
          data.Done += 1;
          break;
      }
    });
    return data;
  }, [teamTasks]);

  // Collect unique assignees from tasks as filter options
  const assigneeOptions = useMemo(() => {
    const map = new Map<number, Assignee>();
    teamTasks.forEach(task => {
      task.assignees.forEach(a => {
        if (!map.has(a.user_id)) {
          map.set(a.user_id, a);
        }
      });
    });
    // Sort by name ascending
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [teamTasks]);

  // Handlers for filters

  const onAssigneesChange = (e: ChangeEvent<HTMLSelectElement>) => {
    // Multiple select
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => Number(option.value));
    setFilters(f => ({ ...f, assignees: selectedOptions }));
  };

  const onPriorityChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value as TaskPriority);
    setFilters(f => ({ ...f, priority: selectedOptions }));
  };

  const onDueDateFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFilters(f => ({ ...f, due_date_from: e.target.value || null }));
  };

  const onDueDateToChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFilters(f => ({ ...f, due_date_to: e.target.value || null }));
  };

  // On filters change, react-query auto refetches by dependency

  // New Task button handler
  const onNewTaskClick = () => {
    open_modal('task_creation', { context: 'team_dashboard' });
  };

  // View mode toggle
  const onViewModeChange = (mode: 'list' | 'kanban') => setViewMode(mode);

  // Click task handler: open Details modal
  const onTaskClick = (task_id: number) => {
    open_modal('task_detail', { task_id });
  };

  // Accessibility ID management for labels & inputs
  // ... done inline

  return (
    <>
      {/* Page heading bar */}
      <div className="flex items-center justify-between mb-4 px-4 py-3 border-b border-gray-300">
        <h1 className="text-xl font-semibold text-gray-900">Team Dashboard</h1>
        <button
          onClick={onNewTaskClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white font-medium rounded"
          aria-label="Create New Task"
        >
          New Task
        </button>
      </div>

      {/* Filters panel */}
      <div className="mb-6 px-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Assignees filter */}
        <div className="flex flex-col">
          <label htmlFor="assignees-filter" className="mb-1 font-medium text-gray-700">
            Assignees
          </label>
          <select
            id="assignees-filter"
            multiple
            size={4}
            value={filters.assignees.map(String)}
            onChange={onAssigneesChange}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-describedby="assignees-filter-help"
          >
            {assigneeOptions.length === 0 && (
              <option disabled>No assignees available</option>
            )}
            {assigneeOptions.map((assignee) => (
              <option key={assignee.user_id} value={assignee.user_id}>
                {assignee.name}
              </option>
            ))}
          </select>
          <small id="assignees-filter-help" className="text-gray-500 mt-1">
            Select one or more team members
          </small>
        </div>

        {/* Priority filter */}
        <div className="flex flex-col">
          <label htmlFor="priority-filter" className="mb-1 font-medium text-gray-700">
            Priority
          </label>
          <select
            id="priority-filter"
            multiple
            size={3}
            value={filters.priority}
            onChange={onPriorityChange}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-describedby="priority-filter-help"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <small id="priority-filter-help" className="text-gray-500 mt-1">
            Select one or more priorities
          </small>
        </div>

        {/* Due Date From */}
        <div className="flex flex-col">
          <label htmlFor="due-date-from" className="mb-1 font-medium text-gray-700">
            Due Date From
          </label>
          <input
            id="due-date-from"
            type="date"
            value={filters.due_date_from ?? ''}
            onChange={onDueDateFromChange}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-describedby="due-date-from-help"
          />
          <small id="due-date-from-help" className="text-gray-500 mt-1">
            Start due date
          </small>
        </div>

        {/* Due Date To */}
        <div className="flex flex-col">
          <label htmlFor="due-date-to" className="mb-1 font-medium text-gray-700">
            Due Date To
          </label>
          <input
            id="due-date-to"
            type="date"
            value={filters.due_date_to ?? ''}
            onChange={onDueDateToChange}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-describedby="due-date-to-help"
          />
          <small id="due-date-to-help" className="text-gray-500 mt-1">
            End due date
          </small>
        </div>
      </div>

      {/* Progress Indicators */}
      <section aria-label="Task Progress Indicators" className="mb-8 px-4">
        <h2 className="text-lg font-semibold mb-2">Task Progress</h2>
        <div className="flex space-x-6 max-w-md">
          <div className="flex flex-col items-center bg-gray-50 rounded p-4 w-32 shadow">
            <div className="text-sm font-medium text-gray-700">To Do</div>
            <div className="text-2xl font-bold text-blue-600">{progressData.To_Do}</div>
            {/* Bar indicator */}
            <div className="w-full h-2 bg-gray-300 rounded mt-2">
              <div
                className="h-2 bg-blue-600 rounded"
                style={{
                  width:
                    teamTasks.length > 0 ? `${(progressData.To_Do / teamTasks.length) * 100}%` : '0%',
                }}
                aria-valuenow={progressData.To_Do}
                aria-valuemin={0}
                aria-valuemax={teamTasks.length}
                role="progressbar"
              ></div>
            </div>
          </div>
          <div className="flex flex-col items-center bg-gray-50 rounded p-4 w-32 shadow">
            <div className="text-sm font-medium text-gray-700">In Progress</div>
            <div className="text-2xl font-bold text-yellow-600">{progressData.In_Progress}</div>
            <div className="w-full h-2 bg-gray-300 rounded mt-2">
              <div
                className="h-2 bg-yellow-600 rounded"
                style={{
                  width:
                    teamTasks.length > 0 ? `${(progressData.In_Progress / teamTasks.length) * 100}%` : '0%',
                }}
                aria-valuenow={progressData.In_Progress}
                aria-valuemin={0}
                aria-valuemax={teamTasks.length}
                role="progressbar"
              ></div>
            </div>
          </div>
          <div className="flex flex-col items-center bg-gray-50 rounded p-4 w-32 shadow">
            <div className="text-sm font-medium text-gray-700">Done</div>
            <div className="text-2xl font-bold text-green-600">{progressData.Done}</div>
            <div className="w-full h-2 bg-gray-300 rounded mt-2">
              <div
                className="h-2 bg-green-600 rounded"
                style={{
                  width:
                    teamTasks.length > 0 ? `${(progressData.Done / teamTasks.length) * 100}%` : '0%',
                }}
                aria-valuenow={progressData.Done}
                aria-valuemin={0}
                aria-valuemax={teamTasks.length}
                role="progressbar"
              ></div>
            </div>
          </div>
        </div>
      </section>

      {/* View mode toggle */}
      <section aria-label="Task View Mode Toggle" className="mb-6 px-4">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`px-4 py-2 border border-gray-300 text-sm font-medium ${
              viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            } focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-pressed={viewMode === 'list'}
            aria-label="List View"
          >
            List View
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('kanban')}
            className={`px-4 py-2 border border-gray-300 -ml-px text-sm font-medium ${
              viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            } focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-pressed={viewMode === 'kanban'}
            aria-label="Kanban View"
          >
            Kanban View
          </button>
        </div>
      </section>

      {/* Error and Loading states */}
      {(isErrorTasks || isErrorActivity) && (
        <section role="alert" aria-live="assertive" className="mb-4 px-4 text-red-600">
          <div>
            Error loading data:{' '}
            {(errorTasks?.message ?? errorActivity?.message) || 'Unknown error occurred.'}
          </div>
          <button
            onClick={() => {
              refetchTasks();
              refetchActivity();
            }}
            className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Retry
          </button>
        </section>
      )}

      {(isLoadingTasks || isLoadingActivity) && (
        <section aria-live="polite" className="mb-4 px-4 text-gray-500">
          Loading data, please wait...
        </section>
      )}

      {/* Main content panel: Task List or Kanban + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
        {/* Task list or Kanban */}
        <section
          aria-label="Team Tasks List or Kanban"
          className="col-span-2 bg-white rounded shadow p-4 max-h-[600px] overflow-auto"
          tabIndex={-1}
        >
          {teamTasks.length === 0 && !isLoadingTasks ? (
            <p className="text-gray-600 italic">No tasks match the current filters.</p>
          ) : viewMode === 'list' ? (
            <table className="w-full border-collapse table-auto" role="grid" aria-rowcount={teamTasks.length}>
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="p-2 border-b border-gray-300">Title</th>
                  <th className="p-2 border-b border-gray-300">Due Date</th>
                  <th className="p-2 border-b border-gray-300">Priority</th>
                  <th className="p-2 border-b border-gray-300">Status</th>
                  <th className="p-2 border-b border-gray-300">Assignees</th>
                </tr>
              </thead>
              <tbody>
                {teamTasks.map(task => (
                  <tr
                    key={task.task_id}
                    className="cursor-pointer hover:bg-gray-100 focus:bg-gray-200 focus:outline-none"
                    tabIndex={0}
                    onClick={() => onTaskClick(task.task_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onTaskClick(task.task_id);
                      }
                    }}
                  >
                    <td className="p-2 border-b border-gray-200">{task.title}</td>
                    <td className="p-2 border-b border-gray-200">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-2 border-b border-gray-200">{task.priority}</td>
                    <td className="p-2 border-b border-gray-200">{task.status}</td>
                    <td className="p-2 border-b border-gray-200">
                      <div className="flex space-x-2">
                        {task.assignees.length === 0 && <span className="text-gray-500 italic">Unassigned</span>}
                        {task.assignees.map((assignee) => (
                          <abbr key={assignee.user_id} title={assignee.name}>
                            <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold select-none">
                              {assignee.avatar_url ? (
                                <img
                                  src={assignee.avatar_url}
                                  alt={assignee.name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                assignee.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                              )}
                            </div>
                          </abbr>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // Kanban view - show columns for To Do, In Progress, Done with tasks in each
            <div className="grid grid-cols-3 gap-4 overflow-auto max-h-[600px]">
              {(['To Do', 'In Progress', 'Done'] as TaskStatus[]).map((status) => (
                <section key={status} aria-label={`${status} tasks`} className="bg-gray-100 rounded p-2 flex flex-col max-h-[600px] overflow-auto">
                  <h3 className="font-semibold mb-2 text-center">{status}</h3>
                  {teamTasks.filter(task => task.status === status).length === 0 && (
                    <p className="text-gray-500 text-sm italic text-center select-none">No tasks</p>
                  )}
                  {teamTasks.filter(task => task.status === status).map(task => (
                    <article
                      key={task.task_id}
                      tabIndex={0}
                      role="button"
                      onClick={() => onTaskClick(task.task_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onTaskClick(task.task_id);
                        }
                      }}
                      className="bg-white rounded shadow p-3 mb-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label={`Task: ${task.title}, Priority: ${task.priority}, Due: ${
                        task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'
                      }`}
                    >
                      <h4 className="text-md font-semibold truncate">{task.title}</h4>
                      <div className="text-sm text-gray-600 truncate">{task.priority} Priority</div>
                      <div className="text-xs text-gray-500">
                        Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="flex space-x-1 mt-1">
                        {task.assignees.map((assignee) => (
                          <abbr key={assignee.user_id} title={assignee.name}>
                            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold select-none">
                              {assignee.avatar_url ? (
                                <img
                                  src={assignee.avatar_url}
                                  alt={assignee.name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                assignee.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                              )}
                            </div>
                          </abbr>
                        ))}
                      </div>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
        </section>

        {/* Activity Feed */}
        <section
          aria-label="Team Activity Feed"
          className="bg-white rounded shadow p-4 max-h-[600px] overflow-auto"
          tabIndex={-1}
        >
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          {activityFeed.length === 0 && !isLoadingActivity ? (
            <p className="text-gray-600 italic">No recent team activity.</p>
          ) : (
            <ul className="space-y-3" role="list">
              {activityFeed.map((event) => (
                <li key={event.event_id} tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-2 hover:bg-gray-50">
                  <p className="text-sm text-gray-800">{event.description}</p>
                  <time dateTime={event.created_at} className="text-xs text-gray-500">
                    {new Date(event.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default UV_TeamDashboard;