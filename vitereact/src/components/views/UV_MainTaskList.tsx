import React, { useEffect, useState, ChangeEvent, DragEvent } from 'react';
import { useAppStore, Task, TaskPriority, TaskStatus } from '@/store/main';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

type Filters = {
  status: TaskStatus[];
  priority: TaskPriority[];
  tags: string[];
  assignees: number[]; // user ids
  due_date_from: string | null;
  due_date_to: string | null;
  search_keyword: string | null;
};

const TASK_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Done'];
const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];

const parseQueryParamArray = (param: string | null): string[] => {
  if (!param) return [];
  return param.split(',').map((s) => s.trim()).filter(Boolean);
};

const serializeQueryParamArray = (arr: string[]) => arr.join(',');

export const UV_MainTaskList: React.FC = () => {
  // Zustand store state and setters
  const {
    tasks,
    set_tasks,
    pagination,
    set_pagination,
    filters,
    set_filters,
    view_mode,
    set_view_mode,
    bulk_selection,
    set_bulk_selection,
    loading,
    set_loading,
    error,
    set_error,
    open_modal,
    close_modal,
    add_task,
    update_task,
    remove_tasks_by_ids,
    user,
    subscribe_task_id,
    unsubscribe_task_id,
    connected,
  } = useAppStore(state => ({
    tasks: state.tasks,
    set_tasks: state.set_tasks,
    pagination: state.pagination,
    set_pagination: state.set_pagination,
    filters: state.filters,
    set_filters: state.set_filters,
    view_mode: state.view_mode,
    set_view_mode: state.set_view_mode,
    bulk_selection: state.bulk_selection,
    set_bulk_selection: state.set_bulk_selection,
    loading: state.loading,
    set_loading: state.set_loading,
    error: state.error,
    set_error: state.set_error,
    open_modal: state.open_modal,
    close_modal: state.close_modal,
    add_task: state.add_task,
    update_task: state.update_task,
    remove_tasks_by_ids: state.remove_tasks_by_ids,
    user: state.user,
    subscribe_task_id: state.subscribe_task_id,
    unsubscribe_task_id: state.unsubscribe_task_id,
    connected: state.connected,
  }));

  const navigate = useNavigate();
  const location = useLocation();

  // QueryClient for invalidations
  const queryClient = useQueryClient();

  // Local state to toggle showing bulk delete confirmation dialog
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Local local error for mutation failures
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Search keyword from filters with debounce
  const [searchInput, setSearchInput] = useState(filters.search_keyword || '');
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== (filters.search_keyword || '')) {
        set_filters({ search_keyword: searchInput });
        set_pagination({ ...pagination, current_page: 1 });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // === URL Sync: On mount, parse URL query parameters to update Zustand filters & pagination & view_mode
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const new_filters: Partial<Filters> = {};

    const url_status = params.get('status');
    if (url_status !== null) new_filters.status = parseQueryParamArray(url_status) as TaskStatus[];
    const url_priority = params.get('priority');
    if (url_priority !== null) new_filters.priority = parseQueryParamArray(url_priority) as TaskPriority[];
    const url_tags = params.get('tags');
    if (url_tags !== null) new_filters.tags = parseQueryParamArray(url_tags);
    const url_assignees = params.get('assignee_ids');
    if (url_assignees !== null) {
      // parse to number[]
      const assn = parseQueryParamArray(url_assignees).map((a) => Number(a)).filter((n) => !Number.isNaN(n));
      new_filters.assignees = assn;
    }
    const url_due_date_from = params.get('due_date_from');
    if (url_due_date_from) new_filters.due_date_from = url_due_date_from;
    const url_due_date_to = params.get('due_date_to');
    if (url_due_date_to) new_filters.due_date_to = url_due_date_to;
    const url_q = params.get('q');
    if (url_q !== null) new_filters.search_keyword = url_q;

    const url_sort_by = params.get('sort_by');
    const url_sort_order = params.get('sort_order');
    const url_page = params.get('page');
    const url_page_size = params.get('page_size');
    const url_view_mode = params.get('view_mode');

    set_filters(new_filters);
    set_pagination({
      current_page: url_page ? Math.max(1, Number(url_page)) : 1,
      total_pages: 1,
      page_size: url_page_size ? Math.max(1, Number(url_page_size)) : 20,
      total_items: 0,
    });
    if (url_view_mode === 'kanban' || url_view_mode === 'list') {
      set_view_mode(url_view_mode);
    } else {
      set_view_mode('list');
    }
  }, []);

  // === Compose query params for GET /api/tasks from filters, sort, pagination, search

  // Sorting info: we store sort_by and sort_order in component state
  // Zustand store has no sort info, so we use local state here
  const [sortBy, setSortBy] = useState<string>('due_date'); // default sort field
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // When filters or pagination or search or sort change => fetch task list
  const fetchTasks = async () => {
    set_loading(true);
    set_error(null);
    try {
      const params = new URLSearchParams();

      // Filters as multi-select: join arrays with commas
      if (filters.status?.length) params.append('status', serializeQueryParamArray(filters.status));
      if (filters.priority?.length) params.append('priority', serializeQueryParamArray(filters.priority));
      if (filters.tags?.length) params.append('tags', serializeQueryParamArray(filters.tags));
      if (filters.assignees?.length) params.append('assignee_ids', serializeQueryParamArray(filters.assignees.map(String)));
      if (filters.due_date_from) params.append('due_date_from', filters.due_date_from);
      if (filters.due_date_to) params.append('due_date_to', filters.due_date_to);
      if (filters.search_keyword) params.append('q', filters.search_keyword);

      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);
      if (pagination.current_page) params.append('page', pagination.current_page.toString());
      if (pagination.page_size) params.append('page_size', pagination.page_size.toString());

      const url = `${API_BASE_URL}/api/tasks?${params.toString()}`;
      const { data } = await axios.get<{
        tasks: Task[];
        pagination: {
          current_page: number;
          total_pages: number;
          page_size: number;
          total_items: number;
        };
      }>(url, {
        headers: { Authorization: `Bearer ${user?.token || ''}` }
      });

      set_tasks(data.tasks);
      set_pagination(data.pagination);
      set_loading(false);
    } catch (err: any) {
      set_loading(false);
      set_error(err?.message || 'Failed to load tasks.');
    }
  };

  // Use React Query to manage this fetch with refetch on deps
  const { refetch } = useQuery(['tasks', filters, pagination.current_page, pagination.page_size, sortBy, sortOrder, filters.search_keyword], fetchTasks, {
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  // Refetch on filter, pagination, sort change
  useEffect(() => {
    // push params to URL for bookmarking/sharing and syncing
    const params = new URLSearchParams();

    if (filters.status?.length) params.set('status', serializeQueryParamArray(filters.status));
    if (filters.priority?.length) params.set('priority', serializeQueryParamArray(filters.priority));
    if (filters.tags?.length) params.set('tags', serializeQueryParamArray(filters.tags));
    if (filters.assignees?.length) params.set('assignee_ids', serializeQueryParamArray(filters.assignees.map(String)));
    if (filters.due_date_from) params.set('due_date_from', filters.due_date_from);
    if (filters.due_date_to) params.set('due_date_to', filters.due_date_to);
    if (filters.search_keyword) params.set('q', filters.search_keyword);

    if (sortBy) params.set('sort_by', sortBy);
    if (sortOrder) params.set('sort_order', sortOrder);
    if (pagination.current_page) params.set('page', String(pagination.current_page));
    if (pagination.page_size) params.set('page_size', String(pagination.page_size));
    if (view_mode) params.set('view_mode', view_mode);

    const searchString = params.toString();
    navigate({ pathname: location.pathname, search: searchString }, { replace: true });

    refetch();
  }, [filters, pagination.current_page, pagination.page_size, sortBy, sortOrder, filters.search_keyword, view_mode]);

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation(async (task_ids: number[]) => {
    const url = `${API_BASE_URL}/api/tasks/bulk-delete`;
    await axios.post(url, { task_ids }, { headers: { Authorization: `Bearer ${user?.token || ''}` } });
  }, {
    onSuccess: () => {
      // Remove deleted tasks from state
      remove_tasks_by_ids(bulk_selection);
      set_bulk_selection([]);
      setShowBulkDeleteConfirm(false);
      setMutationError(null);
      refetch();
    },
    onError: (error: any) => {
      setMutationError(error?.message || 'Failed to delete selected tasks.');
    }
  });

  // Inline quick edit mutation for changing status or priority
  const inlineUpdateMutation = useMutation(async ({ task_id, updates }: { task_id: number; updates: Partial<Pick<Task, 'priority' | 'status'>> }) => {
    const url = `${API_BASE_URL}/api/tasks/${task_id}`;
    const { data } = await axios.patch<Task>(url, updates, { headers: { Authorization: `Bearer ${user?.token || ''}` } });
    return data;
  }, {
    onSuccess: (updatedTask) => {
      update_task(updatedTask);
    },
    onError: (error: any) => {
      // Optional: rollback / show error toast; here just console error
      console.error('Failed to update task inline', error);
    }
  });

  // Websocket live updates handler (simplified)
  useEffect(() => {
    if (!connected) return;
    // subscribe to all visible task ids
    tasks.forEach(task => subscribe_task_id(task.task_id));
    // unsub on cleanup
    return () => {
      tasks.forEach(task => unsubscribe_task_id(task.task_id));
    };
  }, [tasks, connected]);

  // Handler: when user clicks New Task button
  const handleNewTaskClick = () => {
    open_modal('task_creation', {});
  };

  // Handler: when user clicks on a task row/card
  const handleTaskClick = (task_id: number) => {
    open_modal('task_detail', { task_id });
  };

  // Handler: bulk selection checkbox change
  const handleBulkSelectChange = (task_id: number, checked: boolean) => {
    if (checked) {
      set_bulk_selection([...bulk_selection, task_id]);
    } else {
      set_bulk_selection(bulk_selection.filter((id) => id !== task_id));
    }
  };

  // Handler: select all visible tasks checkbox
  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      const allIds = tasks.map(t => t.task_id);
      set_bulk_selection(allIds);
    } else {
      set_bulk_selection([]);
    }
  };

  // Handler: bulk delete confirmed
  const handleBulkDeleteConfirm = () => {
    if (bulk_selection.length === 0) return;
    bulkDeleteMutation.mutate(bulk_selection);
  };

  // Handler: filter change (status, priority, tags, assignees, dates)
  // We'll implement basic multi-select inputs and date inputs inline here for demo
  
  const toggleStatusFilter = (status: TaskStatus) => {
    const current = filters.status || [];
    if (current.includes(status)) {
      set_filters({ status: current.filter(s => s !== status) });
    } else {
      set_filters({ status: [...current, status] });
    }
    set_pagination({ ...pagination, current_page: 1 });
  };

  const togglePriorityFilter = (priority: TaskPriority) => {
    const current = filters.priority || [];
    if (current.includes(priority)) {
      set_filters({ priority: current.filter(p => p !== priority) });
    } else {
      set_filters({ priority: [...current, priority] });
    }
    set_pagination({ ...pagination, current_page: 1 });
  };

  // For tags and assignees filters inputs, as no external API or global user/tag list provided,
  // we will extract list of all tags and assignees from current tasks for selection options

  const allTagsSet = new Set<string>();
  const allAssigneesMap = new Map<number, string>();
  tasks.forEach(task => {
    task.tags.forEach(tag => allTagsSet.add(tag));
    task.assignees.forEach(assn => allAssigneesMap.set(assn.user_id, assn.name));
  });
  const allTags = Array.from(allTagsSet).sort((a,b) => a.localeCompare(b));
  const allAssignees = Array.from(allAssigneesMap.entries()).map(([user_id, name]) => ({ user_id, name })).sort((a,b) => a.name.localeCompare(b.name));

  // Toggle tag filter
  const toggleTagFilter = (tag: string) => {
    const current = filters.tags || [];
    if (current.includes(tag)) {
      set_filters({ tags: current.filter(t => t !== tag) });
    } else {
      set_filters({ tags: [...current, tag] });
    }
    set_pagination({ ...pagination, current_page: 1 });
  };

  // Toggle assignee filter
  const toggleAssigneeFilter = (user_id: number) => {
    const current = filters.assignees || [];
    if (current.includes(user_id)) {
      set_filters({ assignees: current.filter(id => id !== user_id) });
    } else {
      set_filters({ assignees: [...current, user_id] });
    }
    set_pagination({ ...pagination, current_page: 1 });
  };

  // Due date filters with date inputs
  const handleDueDateFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || null;
    set_filters({ due_date_from: val });
    set_pagination({ ...pagination, current_page: 1 });
  };
  const handleDueDateToChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || null;
    set_filters({ due_date_to: val });
    set_pagination({ ...pagination, current_page: 1 });
  };

  // Sorting change handlers (select dropdowns)
  const handleSortByChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  };
  const handleSortOrderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value === 'asc' ? 'asc' : 'desc';
    setSortOrder(val);
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      set_pagination({ ...pagination, current_page: newPage });
    }
  };

  // View mode toggle
  const toggleViewModeHandler = () => {
    set_view_mode(view_mode === 'list' ? 'kanban' : 'list');
  };

  // Handler for inline quick edit change for status or priority (in list view)
  const handleInlineQuickEdit = (task_id: number, field: 'status' | 'priority', value: string) => {
    if (field === 'status' && TASK_STATUSES.includes(value as TaskStatus)) {
      inlineUpdateMutation.mutate({ task_id, updates: { status: value as TaskStatus } });
    }
    if (field === 'priority' && TASK_PRIORITIES.includes(value as TaskPriority)) {
      inlineUpdateMutation.mutate({ task_id, updates: { priority: value as TaskPriority } });
    }
  };

  // Drag and Drop handlers for Kanban
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  const onDragStart = (e: DragEvent<HTMLDivElement>, task_id: number) => {
    setDraggedTaskId(task_id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>, newStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId === null) return;
    const task = tasks.find(t => t.task_id === draggedTaskId);
    if (!task) return;
    if (task.status !== newStatus) {
      inlineUpdateMutation.mutate({ task_id: task.task_id, updates: { status: newStatus } });
    }
    setDraggedTaskId(null);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Determine if all visible tasks selected
  const allSelected = bulk_selection.length > 0 && tasks.length > 0 && bulk_selection.length === tasks.length;

  return (
    <>
      <div className="flex flex-col p-4 min-h-screen bg-gray-50">
        {/* Header - New Task, View Mode, Search */}
        <header className="flex flex-wrap items-center justify-between mb-4 gap-2">
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleNewTaskClick}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Create New Task"
            >
              New Task
            </button>

            <button
              onClick={toggleViewModeHandler}
              className="border border-gray-300 px-3 py-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Switch to ${view_mode === 'list' ? 'Kanban' : 'List'} View`}
              title={`Switch to ${view_mode === 'list' ? 'Kanban' : 'List'} View`}
            >
              {view_mode === 'list' ? 'Kanban View' : 'List View'}
            </button>

            <input
              type="text"
              aria-label="Search tasks"
              placeholder="Search tasks..."
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </header>

        {/* Filters Panel */}
        <section aria-label="Task Filters" className="mb-6 w-full overflow-auto border p-4 rounded bg-white shadow-sm">
          <div className="flex flex-wrap gap-6">
            {/* Status Filters */}
            <fieldset>
              <legend className="font-semibold mb-1">Status</legend>
              <div className="flex space-x-3">
                {TASK_STATUSES.map((status) => (
                  <label key={status} className="inline-flex items-center space-x-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={() => toggleStatusFilter(status)}
                      aria-checked={filters.status.includes(status)}
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Priority Filters */}
            <fieldset>
              <legend className="font-semibold mb-1">Priority</legend>
              <div className="flex space-x-3">
                {TASK_PRIORITIES.map((priority) => (
                  <label key={priority} className="inline-flex items-center space-x-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filters.priority.includes(priority)}
                      onChange={() => togglePriorityFilter(priority)}
                      aria-checked={filters.priority.includes(priority)}
                    />
                    <span>{priority}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Tags Filters */}
            <fieldset>
              <legend className="font-semibold mb-1">Tags</legend>
              <div className="flex flex-wrap gap-2 max-w-xs max-h-24 overflow-auto border rounded p-2">
                {allTags.length === 0 && <p className="text-gray-500 italic">No tags</p>}
                {allTags.map((tag) => {
                  const selected = filters.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTagFilter(tag)}
                      className={`px-2 py-1 rounded text-sm border ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-800 border-gray-300'} hover:bg-blue-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      aria-pressed={selected}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Assignees Filters */}
            <fieldset>
              <legend className="font-semibold mb-1">Assignees</legend>
              <div className="flex flex-wrap gap-2 max-w-xs max-h-24 overflow-auto border rounded p-2">
                {allAssignees.length === 0 && <p className="text-gray-500 italic">No assignees</p>}
                {allAssignees.map(({ user_id, name }) => {
                  const selected = filters.assignees.includes(user_id);
                  return (
                    <button
                      key={user_id}
                      type="button"
                      onClick={() => toggleAssigneeFilter(user_id)}
                      className={`px-2 py-1 rounded text-sm border ${selected ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-800 border-gray-300'} hover:bg-green-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                      aria-pressed={selected}
                      title={name}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Due Date Range Filters */}
            <fieldset>
              <legend className="font-semibold mb-1">Due Date From</legend>
              <input
                type="date"
                value={filters.due_date_from || ''}
                onChange={handleDueDateFromChange}
                className="border border-gray-300 rounded px-2 py-1"
                aria-label="Filter tasks due date from"
              />
            </fieldset>
            <fieldset>
              <legend className="font-semibold mb-1">Due Date To</legend>
              <input
                type="date"
                value={filters.due_date_to || ''}
                onChange={handleDueDateToChange}
                className="border border-gray-300 rounded px-2 py-1"
                aria-label="Filter tasks due date to"
              />
            </fieldset>
          </div>
        </section>

        {/* Sorting Controls */}
        <section className="flex items-center justify-start gap-4 mb-4">
          <label htmlFor="sort_by" className="font-semibold">Sort By:</label>
          <select
            id="sort_by"
            value={sortBy}
            onChange={handleSortByChange}
            className="border border-gray-300 rounded px-2 py-1"
            aria-label="Sort tasks by field"
          >
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
            <option value="created_at">Creation Date</option>
          </select>

          <label htmlFor="sort_order" className="font-semibold">Order:</label>
          <select
            id="sort_order"
            value={sortOrder}
            onChange={handleSortOrderChange}
            className="border border-gray-300 rounded px-2 py-1"
            aria-label="Sort order ascending or descending"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </section>

        {/* If error */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded" role="alert" aria-live="assertive">
            Error: {error}
            <button
              onClick={() => refetch()}
              className="ml-4 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label="Retry loading tasks"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded" role="status" aria-live="polite">
            Loading tasks...
          </div>
        )}

        {/* Bulk Delete Toolbar */}
        {bulk_selection.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded flex items-center justify-between">
            <span>{bulk_selection.length} task(s) selected.</span>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete Selected
            </button>
          </div>
        )}

        {/* Main Content: List or Kanban View */}
        <main className="flex-grow overflow-auto min-h-0">
          {view_mode === 'list' ? (
            <div className="overflow-x-auto rounded-lg shadow bg-white border border-gray-200">
              <table
                className="min-w-full divide-y divide-gray-200"
                role="table"
                aria-label="Task list"
              >
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 p-2 text-left">
                      <input
                        type="checkbox"
                        aria-label="Select all tasks"
                        checked={allSelected}
                        onChange={(e) => handleSelectAllChange(e.target.checked)}
                        disabled={tasks.length === 0}
                      />
                    </th>
                    <th className="p-2 text-left font-medium text-gray-700">Title</th>
                    <th className="p-2 text-left font-medium text-gray-700">Due Date</th>
                    <th className="p-2 text-left font-medium text-gray-700">Priority</th>
                    <th className="p-2 text-left font-medium text-gray-700">Status</th>
                    <th className="p-2 text-left font-medium text-gray-700">Assignees</th>
                    <th className="p-2 text-left font-medium text-gray-700">Tags</th>
                    <th className="p-2 text-left font-medium text-gray-700">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center p-4 text-gray-500 italic">No tasks found.</td>
                    </tr>
                  )}
                  {tasks.map((task) => {
                    const isSelected = bulk_selection.includes(task.task_id);
                    return (
                      <tr key={task.task_id} className="hover:bg-gray-50">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            aria-label={`Select task ${task.title}`}
                            checked={isSelected}
                            onChange={(e) => handleBulkSelectChange(task.task_id, e.target.checked)}
                          />
                        </td>
                        <td
                          className="p-2 cursor-pointer text-blue-600 hover:underline"
                          role="link"
                          tabIndex={0}
                          onClick={() => handleTaskClick(task.task_id)}
                          onKeyPress={(e) => { if (e.key === 'Enter') handleTaskClick(task.task_id); }}
                        >
                          {task.title}
                        </td>
                        <td className="p-2 text-gray-600 truncate max-w-[120px]">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-2">
                          {/* Inline edit Priority */}
                          <select
                            aria-label={`Change priority for task ${task.title}`}
                            value={task.priority}
                            onChange={(e) => handleInlineQuickEdit(task.task_id, 'priority', e.target.value)}
                            className="border border-gray-300 rounded px-1 py-0.5"
                            disabled={inlineUpdateMutation.isLoading}
                          >
                            {TASK_PRIORITIES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          {/* Inline edit Status */}
                          <select
                            aria-label={`Change status for task ${task.title}`}
                            value={task.status}
                            onChange={(e) => handleInlineQuickEdit(task.task_id, 'status', e.target.value)}
                            className="border border-gray-300 rounded px-1 py-0.5"
                            disabled={inlineUpdateMutation.isLoading}
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 max-w-[150px] truncate">
                          <div className="flex space-x-1 items-center">
                            {task.assignees.length === 0 && <span className="text-gray-500 italic">Unassigned</span>}
                            {task.assignees.map((assn) => (
                              <div key={assn.user_id} className="flex items-center space-x-1" title={assn.name}>
                                {assn.avatar_url ? (
                                  <img
                                    src={assn.avatar_url}
                                    alt={assn.name}
                                    className="w-6 h-6 rounded-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-gray-400 text-xs font-semibold text-white flex items-center justify-center">
                                    {assn.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 max-w-[200px] truncate">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs inline-block px-2 py-1 mr-1 mb-1 rounded bg-gray-200 text-gray-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </td>
                        <td className="p-2 text-gray-600 truncate max-w-[120px]">
                          {new Date(task.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // Kanban View
            <div className="flex gap-4 overflow-x-auto h-[600px]">
              {TASK_STATUSES.map((status) => {
                const tasksInColumn = tasks.filter((t) => t.status === status);
                return (
                  <section
                    key={status}
                    aria-labelledby={`kanban-column-${status.replace(' ', '-')}`}
                    className="w-80 bg-white rounded shadow p-3 flex flex-col"
                    onDrop={(e) => onDrop(e, status)}
                    onDragOver={onDragOver}
                  >
                    <h2 id={`kanban-column-${status.replace(' ', '-')}`} className="mb-3 font-semibold text-lg">
                      {status} ({tasksInColumn.length})
                    </h2>
                    <div className="flex flex-col gap-3 overflow-auto max-h-[540px]">
                      {tasksInColumn.length === 0 && <p className="text-gray-500 italic">No tasks.</p>}
                      {tasksInColumn.map((task) => (
                        <div
                          key={task.task_id}
                          draggable
                          onDragStart={(e) => onDragStart(e, task.task_id)}
                          className="p-3 rounded border border-gray-300 shadow-sm cursor-move bg-gray-50 hover:bg-gray-100"
                          onClick={() => handleTaskClick(task.task_id)}
                          role="button"
                          tabIndex={0}
                          onKeyPress={(e) => { if (e.key === 'Enter') handleTaskClick(task.task_id); }}
                          aria-describedby={`task-title-${task.task_id}`}
                        >
                          <h3 id={`task-title-${task.task_id}`} className="font-semibold text-blue-600 truncate">{task.title}</h3>
                          <div className="text-sm text-gray-700 mt-1">
                            <div>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</div>
                            <div>Priority: {task.priority}</div>
                            <div>Assignees: {task.assignees.length > 0 ? task.assignees.map(a => a.name).join(', ') : 'Unassigned'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>

        {/* Pagination Controls */}
        <nav
          aria-label="Pagination"
          className="mt-6 flex justify-center gap-2 select-none"
        >
          <button
            onClick={() => handlePageChange(pagination.current_page - 1)}
            disabled={pagination.current_page === 1 || loading}
            className={`px-3 py-1 rounded border ${pagination.current_page === 1 || loading ? 'text-gray-400 border-gray-300 cursor-not-allowed' : 'text-blue-600 border-blue-600 hover:bg-blue-50'}`}
            aria-disabled={pagination.current_page === 1 || loading}
            aria-label="Previous page"
          >
            &laquo; Prev
          </button>
          <span className="px-3 py-1 border border-gray-300 rounded text-gray-700">
            Page {pagination.current_page} of {pagination.total_pages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.current_page + 1)}
            disabled={pagination.current_page >= pagination.total_pages || loading}
            className={`px-3 py-1 rounded border ${pagination.current_page >= pagination.total_pages || loading ? 'text-gray-400 border-gray-300 cursor-not-allowed' : 'text-blue-600 border-blue-600 hover:bg-blue-50'}`}
            aria-disabled={pagination.current_page >= pagination.total_pages || loading}
            aria-label="Next page"
          >
            Next &raquo;
          </button>
        </nav>

      </div>

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-dialog-title"
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div
            className="bg-white p-6 rounded shadow max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="bulk-delete-dialog-title" className="text-xl font-semibold mb-4">
              Confirm Bulk Delete
            </h2>
            <p className="mb-6">
              Are you sure you want to delete {bulk_selection.length} selected task(s)? This action cannot be undone.
            </p>
            {mutationError && <p className="mb-4 text-red-600 font-semibold">{mutationError}</p>}
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                disabled={bulkDeleteMutation.isLoading}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
              >
                {bulkDeleteMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};