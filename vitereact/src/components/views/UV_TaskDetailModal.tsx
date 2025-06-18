import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { use_app_store, TaskDetail, Comment, TaskPriority, TaskStatus, UserProfile } from "@/store/main";
import { format } from "date-fns";

const api_base = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

interface UpdateTaskPayload {
  title: string;
  description?: string;
  due_date?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  assignees: number[]; // user_ids
}

interface NewCommentPayload {
  body: string;
  parent_comment_id?: string | null;
}

interface UpdateCommentPayload {
  body: string;
}

const priorityOptions: TaskPriority[] = ["Low", "Medium", "High"];
const statusOptions: TaskStatus[] = ["To Do", "In Progress", "Done"];

const UV_TaskDetailModal: React.FC = () => {
  const queryClient = useQueryClient();

  // Global app store
  const modal = use_app_store((state) => state.modal);
  const close_modal = use_app_store((state) => state.close_modal);
  const set_task_detail = use_app_store((state) => state.set_task_detail);
  const set_comments = use_app_store((state) => state.set_comments);
  const add_comment_to_store = use_app_store((state) => state.add_comment);
  const update_comment_in_store = use_app_store((state) => state.update_comment);
  const remove_comment_from_store = use_app_store((state) => state.remove_comment);
  const user = use_app_store((state) => state.user);

  // Modal visibility & task id from payload
  const is_visible = modal.isVisible && modal.type === "task_detail";
  const task_id = modal.payload?.task_id;

  // Local UI state
  const [is_editing, set_is_editing] = useState(false);
  const [editing_fields, set_editing_fields] = useState<{
    title: string;
    description: string;
    due_date: string; // iso date string or ""
    priority: TaskPriority;
    status: TaskStatus;
    tags: string[];
    assignees: UserProfile[]; // full assignee objects for display
  } | null>(null);

  const [new_comment_body, set_new_comment_body] = useState("");
  const [comments_error, set_comments_error] = useState<string | null>(null);

  // Focus management refs
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const newCommentInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch task detail query
  const {
    data: fetched_task,
    isLoading: task_loading,
    isError: task_error,
    error: task_error_obj,
    refetch: refetch_task,
  } = useQuery<TaskDetail, Error>(
    ['task_detail', task_id],
    async () => {
      if (!task_id) throw new Error("Invalid task ID");
      const { data } = await axios.get<TaskDetail>(`${api_base}/api/tasks/${task_id}`);
      return data;
    },
    {
      enabled: is_visible && !!task_id,
      onSuccess: (data) => {
        set_task_detail(data);
        // Initialize editing fields with fresh data if editing
        if (!is_editing) {
          set_editing_fields({
            title: data.title,
            description: data.description || "",
            due_date: data.due_date ?? "",
            priority: data.priority,
            status: data.status,
            tags: data.tags,
            assignees: data.assignees,
          });
        }
      }
    }
  );

  // Fetch comments query
  const {
    data: fetched_comments,
    isLoading: comments_loading,
    isError: comments_loading_error,
    error: comments_loading_error_obj,
    refetch: refetch_comments,
  } = useQuery<Comment[], Error>(
    ['task_comments', task_id],
    async () => {
      if (!task_id) throw new Error("Invalid task ID");
      const { data } = await axios.get<Comment[]>(`${api_base}/api/tasks/${task_id}/comments`);
      return data;
    },
    {
      enabled: is_visible && !!task_id,
      onSuccess: (data) => set_comments(data),
    }
  );

  // Mutation: update task
  const update_task_mutation = useMutation<TaskDetail, Error, UpdateTaskPayload>(
    async (payload) => {
      if (!task_id) throw new Error("Invalid task ID");
      const { data } = await axios.patch<TaskDetail>(`${api_base}/api/tasks/${task_id}`, payload);
      return data;
    },
    {
      onSuccess: (data) => {
        set_task_detail(data);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['task_detail', task_id]);
        set_is_editing(false);
        set_editing_fields({
          title: data.title,
          description: data.description || "",
          due_date: data.due_date ?? "",
          priority: data.priority,
          status: data.status,
          tags: data.tags,
          assignees: data.assignees,
        });
      },
      onError: (error) => {
        alert(`Failed to update task: ${error.message}`);
      }
    }
  );

  // Mutation: add comment
  const add_comment_mutation = useMutation<Comment, Error, NewCommentPayload>(
    async (payload) => {
      if (!task_id) throw new Error("Invalid task ID");
      const { data } = await axios.post<Comment>(`${api_base}/api/tasks/${task_id}/comments`, payload);
      return data;
    },
    {
      onSuccess: (data) => {
        add_comment_to_store(data);
        set_new_comment_body("");
      },
      onError: (error) => {
        set_comments_error(`Failed to add comment: ${error.message}`);
      }
    }
  );

  // Mutation: delete task
  const delete_task_mutation = useMutation<void, Error, void>(
    async () => {
      if (!task_id) throw new Error("Invalid task ID");
      await axios.delete(`${api_base}/api/tasks/${task_id}`);
    },
    {
      onSuccess: () => {
        set_task_detail(null);
        queryClient.invalidateQueries(['tasks']);
        close_modal();
      },
      onError: (error) => {
        alert(`Failed to delete task: ${error.message}`);
      }
    }
  );

  // Mutation: update comment
  const update_comment_mutation = useMutation<Comment, Error, { comment_id: string; body: string }>(
    async ({ comment_id, body }) => {
      const { data } = await axios.patch<Comment>(`${api_base}/api/comments/${comment_id}`, { body });
      return data;
    },
    {
      onSuccess: (data) => {
        update_comment_in_store(data);
      },
      onError: (error) => {
        alert(`Failed to update comment: ${error.message}`);
      }
    }
  );

  // Mutation: delete comment
  const delete_comment_mutation = useMutation<void, Error, string>(
    async (comment_id) => {
      await axios.delete(`${api_base}/api/comments/${comment_id}`);
    },
    {
      onSuccess: (_, comment_id) => {
        remove_comment_from_store(comment_id);
      },
      onError: (error) => {
        alert(`Failed to delete comment: ${error.message}`);
      }
    }
  );

  // Manage edit mode toggle
  const start_editing = () => {
    if (fetched_task) {
      set_editing_fields({
        title: fetched_task.title,
        description: fetched_task.description || "",
        due_date: fetched_task.due_date ?? "",
        priority: fetched_task.priority,
        status: fetched_task.status,
        tags: fetched_task.tags,
        assignees: fetched_task.assignees,
      });
    }
    set_is_editing(true);
  };

  const cancel_editing = () => {
    if (fetched_task) {
      set_editing_fields({
        title: fetched_task.title,
        description: fetched_task.description || "",
        due_date: fetched_task.due_date ?? "",
        priority: fetched_task.priority,
        status: fetched_task.status,
        tags: fetched_task.tags,
        assignees: fetched_task.assignees,
      });
    }
    set_is_editing(false);
  };

  // Handle editing field changes
  const on_edit_field_change = <K extends keyof typeof editing_fields>(
    key: K,
    value: typeof editing_fields[K]
  ) => {
    if (!editing_fields) return;
    set_editing_fields({ ...editing_fields, [key]: value });
  };

  // Handle assignees addition/removal (simple add/remove by user id)
  // For MVP, we only allow remove; adding assumes user management UI outside this modal
  const remove_assignee = (user_id: number) => {
    if (!editing_fields) return;
    on_edit_field_change(
      "assignees",
      editing_fields.assignees.filter((u) => u.user_id !== user_id)
    );
  };

  // Save edited task details
  const save_edits = () => {
    if (!editing_fields) return;
    const payload: UpdateTaskPayload = {
      title: editing_fields.title.trim(),
      description: editing_fields.description.trim(),
      due_date: editing_fields.due_date || null,
      priority: editing_fields.priority,
      status: editing_fields.status,
      tags: editing_fields.tags.map((t) => t.trim()).filter((t) => t.length > 0),
      assignees: editing_fields.assignees.map((a) => a.user_id),
    };
    if (!payload.title) {
      alert("Title is required");
      return;
    }
    update_task_mutation.mutate(payload);
  };

  // Handle new comment submission
  const submit_new_comment = () => {
    const body = new_comment_body.trim();
    if (!body) return;
    add_comment_mutation.mutate({ body });
  };

  // Keyboard handler for new comment textarea: Enter sends comment, with shift+Enter new line
  const handle_new_comment_keydown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit_new_comment();
    }
  };

  // Delete task handler: open confirmation modal in global modal wrapper
  const on_delete_task_clicked = () => {
    const global_open_modal = use_app_store.getState().open_modal;
    global_open_modal("confirmation", {
      confirmation_message:
        "Are you sure you want to delete this task? This action cannot be undone.",
      onConfirm: () => {
        delete_task_mutation.mutate();
        const global_close_modal = use_app_store.getState().close_modal;
        global_close_modal(); // Close confirmation modal
      },
      onCancel: () => {
        const global_close_modal = use_app_store.getState().close_modal;
        global_close_modal();
      },
    });
  };

  // Delete comment handler with inline confirmation (browser confirm for MVP)
  const on_delete_comment = (comment_id: string) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      delete_comment_mutation.mutate(comment_id);
    }
  };

  // Edit comment inline state management
  const [editing_comment_id, set_editing_comment_id] = useState<string | null>(null);
  const [editing_comment_body, set_editing_comment_body] = useState<string>("");

  const start_edit_comment = (comment: Comment) => {
    set_editing_comment_id(comment.comment_id);
    set_editing_comment_body(comment.body);
  };

  const cancel_edit_comment = () => {
    set_editing_comment_id(null);
    set_editing_comment_body("");
  };

  const save_edit_comment = () => {
    if (editing_comment_id == null) return;
    if (!editing_comment_body.trim()) {
      alert("Comment body is required.");
      return;
    }
    update_comment_mutation.mutate({ comment_id: editing_comment_id, body: editing_comment_body.trim() });
    set_editing_comment_id(null);
    set_editing_comment_body("");
  };

  // Accessibility & close modal on ESC
  useEffect(() => {
    if (!is_visible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!update_task_mutation.isLoading && !add_comment_mutation.isLoading) {
          close_modal();
          set_is_editing(false);
          set_editing_comment_id(null);
          set_editing_comment_body("");
          set_new_comment_body("");
          set_comments_error(null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [is_visible, close_modal, update_task_mutation.isLoading, add_comment_mutation.isLoading]);

  // Focus first input on start editing
  useEffect(() => {
    if (is_editing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [is_editing]);

  // Close modal and clear states on close button or background click
  if (!is_visible) return null;

  // Loading or error states
  if (task_loading) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-md p-6 w-full max-w-lg shadow-md text-center">
            Loading task details...
          </div>
        </div>
      </>
    );
  }

  if (task_error) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-md p-6 w-full max-w-lg shadow-md text-center">
            <p className="text-red-600 font-semibold mb-2">Error loading task details.</p>
            <p>{task_error_obj?.message}</p>
            <button
              onClick={() => refetch_task()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              type="button"
            >
              Retry
            </button>
            <button
              onClick={() => close_modal()}
              className="mt-4 ml-2 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!fetched_task || !editing_fields) {
    return null; // Should not happen but safeguard
  }

  // Simple helper to format date string to yyyy-MM-dd for input[type=date]
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    // yyyy-MM-dd
    return d.toISOString().substring(0, 10);
  };

  // Friendly display date format
  const formatDisplayDate = (dateStr?: string | null) => {
    if (!dateStr) return "No due date";
    try {
      return format(new Date(dateStr), "PPPP");
    } catch {
      return dateStr;
    }
  };

  // Handle tag input changes (comma separated string)
  const tagsString = editing_fields.tags.join(", ");

  const onTagsInputChange = (value: string) => {
    // Split by commas trim whitespace, filter out empty strings
    const newTags = value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    on_edit_field_change("tags", newTags);
  };

  // Assignees display: show initials or avatar (if we had avatars)
  // MVP: initials from name

  // Check if current user can edit or delete (owner or manager)
  const can_edit =
    user &&
    (user.role === "manager" || user.user_id === fetched_task.creator_user_id);

  return (
    <>
      {/* Modal backdrop and center container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 py-6 overflow-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-modal-title"
          ref={modalContentRef}
          tabIndex={-1}
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
        >
          {/* Modal Header */}
          <div className="flex justify-between items-center border-b border-gray-300 p-4 sticky top-0 bg-white z-10">
            <h2
              id="task-detail-modal-title"
              className="text-xl font-semibold text-gray-900"
            >
              {is_editing ? "Edit Task" : "Task Details"}
            </h2>
            <button
              aria-label="Close Task Detail Modal"
              onClick={() => {
                close_modal();
                set_is_editing(false);
                set_editing_comment_id(null);
                set_editing_comment_body("");
                set_new_comment_body("");
                set_comments_error(null);
              }}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="px-6 py-4 flex flex-col flex-grow overflow-auto">
            {/* Task fields */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label
                  htmlFor="task-title"
                  className="block text-sm font-medium text-gray-700"
                >
                  Title<span className="text-red-500">*</span>
                </label>
                {is_editing ? (
                  <input
                    id="task-title"
                    type="text"
                    ref={titleInputRef}
                    value={editing_fields.title}
                    onChange={(e) => on_edit_field_change("title", e.target.value)}
                    disabled={update_task_mutation.isLoading}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                    required
                  />
                ) : (
                  <p className="mt-1 text-gray-900" tabIndex={0}>
                    {fetched_task.title}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="task-description"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                {is_editing ? (
                  <textarea
                    id="task-description"
                    rows={4}
                    value={editing_fields.description}
                    onChange={(e) =>
                      on_edit_field_change("description", e.target.value)
                    }
                    disabled={update_task_mutation.isLoading}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                  />
                ) : (
                  <p
                    className={`mt-1 whitespace-pre-wrap text-gray-900 ${
                      !fetched_task.description ? "italic text-gray-400" : ""
                    }`}
                    tabIndex={0}
                  >
                    {fetched_task.description || "No description provided."}
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label
                  htmlFor="task-due-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Due Date
                </label>
                {is_editing ? (
                  <input
                    id="task-due-date"
                    type="date"
                    value={formatDateForInput(editing_fields.due_date)}
                    onChange={(e) => on_edit_field_change("due_date", e.target.value)}
                    disabled={update_task_mutation.isLoading}
                    className="mt-1 block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                  />
                ) : (
                  <p className="mt-1 text-gray-900" tabIndex={0}>
                    {formatDisplayDate(fetched_task.due_date)}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label
                  htmlFor="task-priority"
                  className="block text-sm font-medium text-gray-700"
                >
                  Priority
                </label>
                {is_editing ? (
                  <select
                    id="task-priority"
                    value={editing_fields.priority}
                    onChange={(e) =>
                      on_edit_field_change("priority", e.target.value as TaskPriority)
                    }
                    disabled={update_task_mutation.isLoading}
                    className="mt-1 block w-48 rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-200"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-gray-900" tabIndex={0}>
                    {fetched_task.priority}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label
                  htmlFor="task-status"
                  className="block text-sm font-medium text-gray-700"
                >
                  Status
                </label>
                {is_editing ? (
                  <select
                    id="task-status"
                    value={editing_fields.status}
                    onChange={(e) =>
                      on_edit_field_change("status", e.target.value as TaskStatus)
                    }
                    disabled={update_task_mutation.isLoading}
                    className="mt-1 block w-48 rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-200"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-gray-900" tabIndex={0}>
                    {fetched_task.status}
                  </p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label
                  htmlFor="task-tags"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tags (comma separated)
                </label>
                {is_editing ? (
                  <input
                    id="task-tags"
                    type="text"
                    value={tagsString}
                    onChange={(e) => onTagsInputChange(e.target.value)}
                    disabled={update_task_mutation.isLoading}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                    placeholder="e.g. urgent, client, bug"
                  />
                ) : (
                  <p className="mt-1 text-gray-900" tabIndex={0}>
                    {fetched_task.tags.length > 0 ? (
                      fetched_task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="italic text-gray-400">No tags</span>
                    )}
                  </p>
                )}
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Assignees
                </label>
                <div className="mt-1 flex flex-wrap gap-2" aria-live="polite">
                  {editing_fields.assignees.length > 0 ? (
                    editing_fields.assignees.map((assignee) => {
                      const initials = assignee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <div
                          key={assignee.user_id}
                          className="flex items-center bg-gray-200 rounded-full px-3 py-1 text-sm font-medium text-gray-700"
                        >
                          <span
                            aria-label={`Assignee: ${assignee.name}`}
                            title={assignee.name}
                            className="mr-2"
                          >
                            {initials}
                          </span>
                          {is_editing && can_edit && (
                            <button
                              type="button"
                              aria-label={`Remove assignee ${assignee.name}`}
                              onClick={() => remove_assignee(assignee.user_id)}
                              disabled={update_task_mutation.isLoading}
                              className="text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="italic text-gray-400">No assignees</p>
                  )}
                </div>
                {!is_editing && can_edit && (
                  <p className="text-xs text-gray-500 mt-1">Assignees can be managed via team dashboard</p>
                )}
              </div>
            </div>
          </div>

          {/* Edit & Delete buttons / Save & Cancel buttons */}
          {can_edit && (
            <div className="flex justify-between items-center border-t border-gray-300 px-6 py-4 bg-gray-50 sticky bottom-0 z-20">
              {is_editing ? (
                <>
                  <button
                    onClick={cancel_editing}
                    disabled={update_task_mutation.isLoading}
                    type="button"
                    className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save_edits}
                    disabled={update_task_mutation.isLoading}
                    type="button"
                    className="ml-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {update_task_mutation.isLoading ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={start_editing}
                    type="button"
                    className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={on_delete_task_clicked}
                    type="button"
                    className="ml-2 px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}

          {/* Comments Section */}
          <section
            aria-label="Comments"
            className="border-t border-gray-300 bg-gray-50 flex flex-col flex-grow"
          >
            <h3 className="sr-only">Comments</h3>
            <div
              id="comments-list"
              className="flex-grow overflow-y-auto px-6 py-4 space-y-4"
            >
              {comments_loading ? (
                <p>Loading comments...</p>
              ) : comments_loading_error ? (
                <p className="text-red-600">Error loading comments.</p>
              ) : (
                // Sort comments ascending by created_at
                [...(fetched_comments ?? [])]
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((comment) => {
                    const author =
                      // Find full user info from task assignees or fallback minimal
                      fetched_task.assignees.find((u) => u.user_id === comment.author_user_id) ||
                      (comment.author_user_id === user?.user_id
                        ? user
                        : { user_id: comment.author_user_id, name: "Unknown", email: "", role: "regular", notification_settings: { email: false, in_app: false }, created_at: "", updated_at: "" });

                    const can_edit_comment = user && (user.user_id === comment.author_user_id || user.role === "manager");

                    const is_editing_this_comment = editing_comment_id === comment.comment_id;

                    return (
                      <div
                        key={comment.comment_id}
                        className="bg-white rounded-md shadow p-3"
                        aria-live="polite"
                      >
                        {/* Author and timestamp */}
                        <div className="flex justify-between items-center mb-1 text-sm text-gray-500">
                          <span className="font-medium text-gray-700">{author.name}</span>
                          <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>
                            {formatDisplayDate(comment.created_at)}
                          </time>
                        </div>

                        {/* Comment Body or Edit textarea */}
                        {is_editing_this_comment ? (
                          <>
                            <textarea
                              value={editing_comment_body}
                              onChange={(e) => set_editing_comment_body(e.target.value)}
                              rows={3}
                              className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={update_comment_mutation.isLoading}
                            />
                            <div className="mt-2 flex justify-end space-x-2">
                              <button
                                onClick={cancel_edit_comment}
                                type="button"
                                disabled={update_comment_mutation.isLoading}
                                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={save_edit_comment}
                                type="button"
                                disabled={update_comment_mutation.isLoading}
                                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                Save
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="whitespace-pre-wrap text-gray-900">{comment.body}</p>
                        )}

                        {/* Edit/Delete buttons */}
                        {!is_editing_this_comment && can_edit_comment && (
                          <div className="mt-1 flex space-x-4 text-sm text-blue-600">
                            <button
                              type="button"
                              onClick={() => start_edit_comment(comment)}
                              className="hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => on_delete_comment(comment.comment_id)}
                              className="hover:underline text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
              {comments_error && (
                <p className="text-red-600 mt-2" role="alert">
                  {comments_error}
                </p>
              )}
            </div>

            {/* New comment input - fixed at bottom */}
            <div className="border-t border-gray-300 px-6 py-3 bg-white sticky bottom-0">
              <label htmlFor="new-comment" className="sr-only">
                Write a comment
              </label>
              <textarea
                id="new-comment"
                rows={2}
                value={new_comment_body}
                onChange={(e) => set_new_comment_body(e.target.value)}
                onKeyDown={handle_new_comment_keydown}
                placeholder="Write a comment..."
                className="w-full rounded-md border border-gray-300 p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={add_comment_mutation.isLoading}
                ref={newCommentInputRef}
                aria-multiline="true"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={submit_new_comment}
                  disabled={add_comment_mutation.isLoading || new_comment_body.trim() === ""}
                  type="button"
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
                >
                  {add_comment_mutation.isLoading ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default UV_TaskDetailModal;