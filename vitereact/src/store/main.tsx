import create from 'zustand';
import { persist } from 'zustand/middleware';

// Types / Interfaces

export type UserRole = 'regular' | 'manager';

export interface NotificationSettings {
  in_app: boolean;
  email: boolean;
}

export interface User {
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  notification_settings: NotificationSettings;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface AuthState {
  user: User | null;
  token: string;
  is_authenticated: boolean;
  loading: boolean;
  error: string | null;
  set_user: (user: User | null) => void;
  set_token: (token: string) => void;
  set_is_authenticated: (is_auth: boolean) => void;
  set_loading: (loading: boolean) => void;
  set_error: (error: string | null) => void;
  logout: () => void;
}

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'To Do' | 'In Progress' | 'Done';

export interface Assignee {
  user_id: number;
  name: string;
  avatar_url: string | null;
}

export interface Comment {
  comment_id: number;
  author_user_id: number;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
  parent_comment_id: number | null;
}

export interface Task {
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

export interface Pagination {
  current_page: number;
  total_pages: number;
  page_size: number;
  total_items: number;
}

export interface TasksFilters {
  status: TaskStatus[];
  priority: TaskPriority[];
  tags: string[];
  assignees: number[]; // array of user_id
  due_date_from: string | null; // ISO string date or null
  due_date_to: string | null;   // ISO string date or null
  search_keyword: string | null;
}

export interface TasksState {
  tasks: Task[];
  task_detail: Task | null;
  pagination: Pagination;
  filters: TasksFilters;
  view_mode: 'list' | 'kanban';
  bulk_selection: number[]; // task_ids

  loading: boolean;
  error: string | null;

  // setters
  set_tasks: (tasks: Task[]) => void;
  set_task_detail: (task: Task | null) => void;
  set_pagination: (pagination: Pagination) => void;
  set_filters: (filters: Partial<TasksFilters>) => void;
  set_view_mode: (mode: 'list' | 'kanban') => void;
  set_bulk_selection: (selection: number[]) => void;
  set_loading: (loading: boolean) => void;
  set_error: (error: string | null) => void;

  // utility methods
  add_task: (task: Task) => void;
  update_task: (task: Partial<Task> & { task_id: number }) => void;
  remove_tasks_by_ids: (task_ids: number[]) => void;
}

export interface CommentsState {
  comments: Comment[]; // comments for current task detail
  loading: boolean;
  error: string | null;

  set_comments: (comments: Comment[]) => void;
  add_comment: (comment: Comment) => void;
  update_comment: (comment: Partial<Comment> & { comment_id: number }) => void;
  remove_comment: (comment_id: number) => void;
  set_loading: (loading: boolean) => void;
  set_error: (error: string | null) => void;
}

export type NotificationType = 'assignment' | 'comment' | 'status_update' | 'reminder';

export interface Notification {
  notification_id: number;
  type: NotificationType;
  message: string;
  reference_id: number; // usually task_id or comment_id
  created_at: string;
  is_read: boolean;
}

export interface NotificationsState {
  notifications: Notification[];
  unread_count: number;
  loading: boolean;
  error: string | null;

  set_notifications: (notifications: Notification[]) => void;
  add_notification: (notification: Notification) => void;
  mark_as_read: (notification_id: number) => void;
  mark_all_as_read: () => void;
  set_unread_count: (count: number) => void;
  set_loading: (loading: boolean) => void;
  set_error: (error: string | null) => void;
}

export type ModalType = 'task_creation' | 'task_detail' | 'confirmation';

export interface ModalPayload {
  [key: string]: any;
}

export interface UIState {
  modal: { type: ModalType; payload: ModalPayload } | null;
  notification_center_open: boolean;

  open_modal: (type: ModalType, payload?: ModalPayload) => void;
  close_modal: () => void;
  set_notification_center_open: (open: boolean) => void;
}

export interface WebsocketState {
  connected: boolean;
  subscribed_task_ids: number[];
  subscribed_user_notifications: boolean;

  set_connected: (connected: boolean) => void;
  subscribe_task_id: (task_id: number) => void;
  unsubscribe_task_id: (task_id: number) => void;
  set_subscribed_user_notifications: (subscribed: boolean) => void;
  clear_subscriptions: () => void;
}

export interface GlobalLoadingErrorState {
  global_loading: boolean;
  global_error: string | null;

  set_global_loading: (loading: boolean) => void;
  set_global_error: (error: string | null) => void;
}

// Combined store state interface

export interface AppState
  extends AuthState,
    TasksState,
    CommentsState,
    NotificationsState,
    UIState,
    WebsocketState,
    GlobalLoadingErrorState {}

// Zustand store creation with persist middleware

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth State
      user: null,
      token: '',
      is_authenticated: false,
      loading: false,
      error: null,
      set_user: (user) => set({ user }),
      set_token: (token) => set({ token }),
      set_is_authenticated: (is_auth) => set({ is_authenticated: is_auth }),
      set_loading: (loading) => set({ loading }),
      set_error: (error) => set({ error }),
      logout: () => {
        set({
          user: null,
          token: '',
          is_authenticated: false,
          loading: false,
          error: null,
          tasks: [],
          task_detail: null,
          pagination: {
            current_page: 1,
            total_pages: 1,
            page_size: 20,
            total_items: 0,
          },
          filters: {
            status: [],
            priority: [],
            tags: [],
            assignees: [],
            due_date_from: null,
            due_date_to: null,
            search_keyword: '',
          },
          view_mode: 'list',
          bulk_selection: [],
          // comments
          comments: [],
          // notifications
          notifications: [],
          unread_count: 0,
          // UI
          modal: null,
          notification_center_open: false,
          // websocket
          connected: false,
          subscribed_task_ids: [],
          subscribed_user_notifications: false,
          // global loading/error
          global_loading: false,
          global_error: null,
        });
      },

      // Tasks State
      tasks: [],
      task_detail: null,
      pagination: {
        current_page: 1,
        total_pages: 1,
        page_size: 20,
        total_items: 0,
      },
      filters: {
        status: [],
        priority: [],
        tags: [],
        assignees: [],
        due_date_from: null,
        due_date_to: null,
        search_keyword: '',
      },
      view_mode: 'list',
      bulk_selection: [],
      loading: false,
      error: null,
      set_tasks: (tasks) => set({ tasks }),
      set_task_detail: (task_detail) => set({ task_detail }),
      set_pagination: (pagination) => set({ pagination }),
      set_filters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      set_view_mode: (view_mode) => set({ view_mode }),
      set_bulk_selection: (bulk_selection) => set({ bulk_selection }),
      set_loading: (loading) => set({ loading }),
      set_error: (error) => set({ error }),
      add_task: (task) =>
        set((state) => ({
          tasks: [task, ...state.tasks.filter((t) => t.task_id !== task.task_id)],
        })),
      update_task: (taskUpdate) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.task_id === taskUpdate.task_id ? { ...t, ...taskUpdate } : t
          ),
          task_detail:
            state.task_detail && state.task_detail.task_id === taskUpdate.task_id
              ? { ...state.task_detail, ...taskUpdate }
              : state.task_detail,
        })),
      remove_tasks_by_ids: (task_ids) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => !task_ids.includes(t.task_id)),
          bulk_selection: state.bulk_selection.filter((id) => !task_ids.includes(id)),
          task_detail:
            state.task_detail && task_ids.includes(state.task_detail.task_id)
              ? null
              : state.task_detail,
        })),

      // Comments State
      comments: [],
      set_comments: (comments) => set({ comments }),
      add_comment: (comment) =>
        set((state) => ({
          comments: [...state.comments, comment],
          task_detail: state.task_detail
            ? {
                ...state.task_detail,
                comments: [...state.task_detail.comments, comment],
              }
            : null,
        })),
      update_comment: (commentUpdate) =>
        set((state) => {
          const updatedComments = state.comments.map((c) =>
            c.comment_id === commentUpdate.comment_id ? { ...c, ...commentUpdate } : c
          );
          let updatedTaskDetail = state.task_detail;
          if (state.task_detail) {
            updatedTaskDetail = {
              ...state.task_detail,
              comments: updatedComments,
            };
          }
          return { comments: updatedComments, task_detail: updatedTaskDetail };
        }),
      remove_comment: (comment_id) =>
        set((state) => {
          const filteredComments = state.comments.filter((c) => c.comment_id !== comment_id);
          let updatedTaskDetail = state.task_detail;
          if (state.task_detail) {
            updatedTaskDetail = {
              ...state.task_detail,
              comments: filteredComments,
            };
          }
          return { comments: filteredComments, task_detail: updatedTaskDetail };
        }),
      set_loading: (loading) => set({ loading }),
      set_error: (error) => set({ error }),

      // Notifications State
      notifications: [],
      unread_count: 0,
      set_notifications: (notifications) => {
        const unread = notifications.filter((n) => !n.is_read).length;
        set({ notifications, unread_count: unread });
      },
      add_notification: (notification) =>
        set((state) => {
          const exists = state.notifications.find(n => n.notification_id === notification.notification_id);
          if (exists) {
            return state; // no duplicate
          }
          const newNotifications = [notification, ...state.notifications];
          const newUnreadCount = notification.is_read ? state.unread_count : state.unread_count + 1;
          return {
            notifications: newNotifications,
            unread_count: newUnreadCount,
          };
        }),
      mark_as_read: (notification_id) =>
        set((state) => {
          const newNotifications = state.notifications.map((n) =>
            n.notification_id === notification_id ? { ...n, is_read: true } : n
          );
          const newUnreadCount = newNotifications.filter((n) => !n.is_read).length;
          return {
            notifications: newNotifications,
            unread_count: newUnreadCount,
          };
        }),
      mark_all_as_read: () =>
        set((state) => {
          const allRead = state.notifications.map((n) => ({ ...n, is_read: true }));
          return { notifications: allRead, unread_count: 0 };
        }),
      set_unread_count: (count) => set({ unread_count: count }),
      set_loading: (loading) => set({ loading }),
      set_error: (error) => set({ error }),

      // UI State
      modal: null,
      notification_center_open: false,
      open_modal: (type, payload = {}) => set({ modal: { type, payload } }),
      close_modal: () => set({ modal: null }),
      set_notification_center_open: (open) => set({ notification_center_open: open }),

      // Websocket State
      connected: false,
      subscribed_task_ids: [],
      subscribed_user_notifications: false,
      set_connected: (connected) => set({ connected }),
      subscribe_task_id: (task_id) => {
        const current = get().subscribed_task_ids;
        if (!current.includes(task_id)) {
          set({ subscribed_task_ids: [...current, task_id] });
        }
      },
      unsubscribe_task_id: (task_id) => {
        const current = get().subscribed_task_ids;
        if (current.includes(task_id)) {
          set({ subscribed_task_ids: current.filter((id) => id !== task_id) });
        }
      },
      set_subscribed_user_notifications: (subscribed) => set({ subscribed_user_notifications: subscribed }),
      clear_subscriptions: () =>
        set({
          subscribed_task_ids: [],
          subscribed_user_notifications: false,
        }),

      // Global Loading and Error
      global_loading: false,
      global_error: null,
      set_global_loading: (global_loading) => set({ global_loading }),
      set_global_error: (global_error) => set({ global_error }),
    }),
    {
      name: 'taskmaster_app_state',
      getStorage: () => localStorage,
      // partialize: (state) => selectively persist if needed
    }
  )
);