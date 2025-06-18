import React, { useEffect, useCallback } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore, Notification } from "@/store/main";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Utility function to format date-time nicely
const formatDateTime = (dtString: string): string => {
  const dt = new Date(dtString);
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const GV_NotificationCenter: React.FC = () => {
  // Zustand store selectors and actions
  const notifications = useAppStore((state) => state.notifications);
  const loadingGlobal = useAppStore((state) => state.loading);
  const errorGlobal = useAppStore((state) => state.error);
  const set_notifications = useAppStore((state) => state.set_notifications);
  const mark_as_read = useAppStore((state) => state.mark_as_read);
  const mark_all_as_read = useAppStore((state) => state.mark_all_as_read);
  const open_modal = useAppStore((state) => state.open_modal);
  const set_loading = useAppStore((state) => state.set_loading);
  const set_error = useAppStore((state) => state.set_error);

  const queryClient = useQueryClient();

  // Fetch Notifications Query - called on panel open and periodically
  const { refetch, isFetching } = useQuery<Notification[], Error>(
    ["notifications"],
    async () => {
      set_loading(true);
      try {
        const response = await axios.get<Notification[]>(
          `${API_BASE_URL}/api/notifications`
        );
        set_notifications(response.data);
        set_error(null);
        set_loading(false);
        return response.data;
      } catch (err: any) {
        const message =
          err?.response?.data?.message || err.message || "Failed to load notifications";
        set_error(message);
        set_loading(false);
        throw err;
      }
    },
    {
      enabled: false, // only fetch on demand
    }
  );

  // Mutation to mark a notification as read
  const markAsReadMutation = useMutation<
    void,
    Error,
    number
  >(
    async (notification_id: number) => {
      await axios.patch(`${API_BASE_URL}/api/notifications/${notification_id}/read`);
    },
    {
      onSuccess: (_data, notification_id) => {
        mark_as_read(notification_id);
        // Optionally, invalidate queries or refetch
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      },
      onError: (error) => {
        // Could show toast or snackbar - here just log
        console.error("Failed to mark notification as read:", error.message);
      },
    }
  );

  // Mutation to mark all notifications as read
  const markAllAsReadMutation = useMutation<void, Error>(
    async () => {
      await axios.patch(`${API_BASE_URL}/api/notifications/mark_all_read`);
    },
    {
      onSuccess: () => {
        mark_all_as_read();
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      },
      onError: (error) => {
        console.error("Failed to mark all notifications as read:", error.message);
      },
    }
  );

  // Effect: initial fetch on mount (or panel open)
  useEffect(() => {
    // Fetch notifications when the panel is mounted (opened)
    refetch();

    // Setup interval for periodic refresh every 60 seconds
    const intervalId = setInterval(() => {
      refetch();
    }, 60000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [refetch]);

  // Handler: click on notification to open related task detail modal and mark it read
  const onNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) {
        markAsReadMutation.mutate(notification.notification_id);
      }
      open_modal("task_detail", { task_id: notification.reference_id });
    },
    [markAsReadMutation, open_modal]
  );

  // Handler: click Clear All button
  const onClearAllClick = useCallback(() => {
    if (!markAllAsReadMutation.isLoading) {
      markAllAsReadMutation.mutate();
    }
  }, [markAllAsReadMutation]);

  // Accessibility: keyboard handling for notifications list
  // Focus management is handled by modal logic outside or implicitly by tab order

  return (
    <>
      <aside
        role="region"
        aria-label="Notification Center"
        className="fixed top-14 right-4 w-96 max-h-[80vh] bg-white shadow-lg rounded-md z-50 flex flex-col"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          <button
            onClick={onClearAllClick}
            disabled={notifications.length === 0 || markAllAsReadMutation.isLoading}
            className={`text-sm font-medium text-blue-600 hover:underline disabled:text-gray-400`}
            aria-label="Mark all notifications as read"
          >
            {markAllAsReadMutation.isLoading ? "Clearing..." : "Clear All"}
          </button>
        </header>

        {/* Content Area */}
        <section className="flex-1 overflow-y-auto" tabIndex={0}>
          {loadingGlobal || isFetching ? (
            <div className="flex items-center justify-center p-6 text-gray-500">
              Loading notifications...
            </div>
          ) : errorGlobal ? (
            <div className="p-4 text-red-600 text-sm">
              Error loading notifications: {errorGlobal}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              You have no notifications
            </div>
          ) : (
            <ul className="divide-y divide-gray-200" role="list">
              {notifications.map((notification) => {
                const isUnread = !notification.is_read;
                return (
                  <li
                    key={notification.notification_id}
                    className={`cursor-pointer px-4 py-3 hover:bg-gray-100 ${
                      isUnread ? "bg-blue-50 font-semibold" : "bg-white font-normal"
                    }`}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isUnread ? "false" : "true"}
                    onClick={() => onNotificationClick(notification)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onNotificationClick(notification);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-gray-900">{notification.message}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!notification.is_read) {
                            markAsReadMutation.mutate(notification.notification_id);
                          }
                        }}
                        aria-label={
                          notification.is_read
                            ? "Mark as unread (not implemented)"
                            : "Mark as read"
                        }
                        disabled={notification.is_read || markAsReadMutation.isLoading}
                        className={`ml-2 text-sm text-blue-600 hover:underline disabled:text-gray-400`}
                      >
                        {notification.is_read ? "Read" : "Mark read"}
                      </button>
                    </div>
                    <time
                      dateTime={notification.created_at}
                      className="mt-1 block text-xs text-gray-500"
                    >
                      {formatDateTime(notification.created_at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </>
  );
};