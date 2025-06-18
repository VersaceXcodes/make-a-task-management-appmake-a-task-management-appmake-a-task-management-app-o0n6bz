import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore, Task, TaskPriority, TaskStatus, ModalType } from "@/store/main";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Base API URL constant
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Interfaces for API payloads/responses

interface TaskCreatePayload {
  title: string;
  description?: string;
  due_date?: string | null;
  priority: TaskPriority;
  tags?: string[];
  assignees?: number[]; // user_ids
}

interface TaskUpdatePayload {
  task_id: number;
  title: string;
  description?: string;
  due_date?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  assignees: number[];
}

interface ConfirmationPayload {
  task_ids: number[]; // tasks to delete
  message?: string;   // optional message to display
}

interface ModalPayload {
  [key: string]: any;
}

const GV_GlobalModalWrapper: React.FC = () => {
  // Zustand global app state selectors and actions
  const modal = useAppStore((state) => state.modal);
  const close_modal = useAppStore((state) => state.close_modal);
  const set_loading = useAppStore((state) => state.set_loading);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);

  // Task global store methods to update state
  const set_tasks = useAppStore((state) => state.set_tasks);
  const add_task = useAppStore((state) => state.add_task);
  const update_task = useAppStore((state) => state.update_task);
  const remove_tasks_by_ids = useAppStore((state) => state.remove_tasks_by_ids);
  const set_error_global = useAppStore((state) => state.set_error);

  // Query client for invalidation
  const queryClient = useQueryClient();

  // Derived states
  const modalType = modal?.type ?? null;
  const modalPayload = modal?.payload ?? {};
  const isOpen = modalType !== null;

  // Accessibility: maintain focus inside modal: ref to modal container
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Focus trap inside modal container 
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstEl = focusableElements[0];
    const lastEl = focusableElements[focusableElements.length - 1];

    const handleTrap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        // shift + tab
        if (document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        }
      } else {
        // tab
        if (document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    };

    window.addEventListener("keydown", handleTrap);
    // focus first element initially
    firstEl.focus();

    return () => {
      window.removeEventListener("keydown", handleTrap);
    };
  }, [isOpen]);

  // === TASK CREATION MODAL IMPLEMENTATION ===

  // Form state for task creation modal
  const [create_title, setCreate_title] = useState<string>("");
  const [create_description, setCreate_description] = useState<string>("");
  const [create_due_date, setCreate_due_date] = useState<string>("");
  const [create_priority, setCreate_priority] = useState<TaskPriority>("Medium");
  const [create_tags_text, setCreate_tags_text] = useState<string>(""); // input as comma separated string
  // Optional: assignees from context payload (array of user ids)
  const create_assignees: number[] = Array.isArray(modalPayload.assignees)
    ? modalPayload.assignees
    : [];

  // Reset form on modal open/close changes for task creation
  useEffect(() => {
    if (modalType === "task_creation") {
      setCreate_title("");
      setCreate_description("");
      setCreate_due_date("");
      setCreate_priority("Medium");
      setCreate_tags_text("");
      // assignees comes from modalPayload.assignees for team dashboard, no input field here for MVP
    }
  }, [modalType]);

  // Create task mutation using react-query
  const createTaskMutation = useMutation<
    Task,
    Error,
    TaskCreatePayload
  >(
    async (newTask) => {
      const { data } = await axios.post<Task>(`${API_BASE_URL}/api/tasks`, newTask);
      return data;
    },
    {
      onMutate: () => set_loading(true),
      onSettled: () => set_loading(false),
      onSuccess: (createdTask) => {
        add_task(createdTask); // update global store by adding to the front
        queryClient.invalidateQueries(["tasks"]); // refetch tasks list
        close_modal();
        set_error_global(null);
      },
      onError: (error) => {
        set_error_global(error.message);
      },
    }
  );

  // Handler when Save clicked in Task Creation modal
  const handleCreateSave = () => {
    // Validate title required
    if (create_title.trim() === "") {
      set_error_global("Title is required.");
      return;
    }
    // Prepare tags array from comma-separated input (remove empty entries and trim)
    const tagsArray = create_tags_text
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Prepare due_date: empty string means null
    const dueDateFormatted = create_due_date.trim() === "" ? null : create_due_date;

    // Compose payload
    const payload: TaskCreatePayload = {
      title: create_title.trim(),
      description: create_description.trim() || undefined,
      due_date: dueDateFormatted,
      priority: create_priority,
      tags: tagsArray,
      assignees: create_assignees.length > 0 ? create_assignees : undefined,
    };

    createTaskMutation.mutate(payload);
  };

  // === TASK DETAIL MODAL IMPLEMENTATION ===

  // Current task_id to fetch details from modalPayload
  const task_detail_id =
    modalType === "task_detail" && typeof modalPayload.task_id === "number"
      ? modalPayload.task_id
      : null;

  // Local form state for task detail editing
  // On fetch success, populate these states for editing
  const [detail_loading_local, set_detail_loading_local] = useState<boolean>(false);
  const [detail_error_local, set_detail_error_local] = useState<string | null>(null);

  const [detail_title, set_detail_title] = useState<string>("");
  const [detail_description, set_detail_description] = useState<string>("");
  const [detail_due_date, set_detail_due_date] = useState<string>("");
  const [detail_priority, set_detail_priority] = useState<TaskPriority>("Medium");
  const [detail_status, set_detail_status] = useState<TaskStatus>("To Do");
  const [detail_tags_text, set_detail_tags_text] = useState<string>(""); // comma-separated string
  // For assignees, readonly display in modal: no edits in MVP per FRD
  const [detail_assignees, set_detail_assignees] = useState<{ user_id: number; name: string; avatar_url: string | null }[]>([]);

  // Editing mode flag toggled by Edit button
  const [is_editing, set_is_editing] = useState<boolean>(false);

  // Reset and load task details form whenever modalType or task_id changes
  useEffect(() => {
    if (modalType !== "task_detail" || task_detail_id === null) {
      // Clear form and editing state
      set_is_editing(false);
      set_detail_title("");
      set_detail_description("");
      set_detail_due_date("");
      set_detail_priority("Medium");
      set_detail_status("To Do");
      set_detail_tags_text("");
      set_detail_assignees([]);
      set_detail_error_local(null);
      return;
    }

    // Fetch task detail on modal open or task_id change
    set_detail_loading_local(true);
    set_detail_error_local(null);

    axios
      .get<Task>(`${API_BASE_URL}/api/tasks/${task_detail_id}`)
      .then(({ data }) => {
        // Populate form state
        set_detail_title(data.title);
        set_detail_description(data.description ?? "");
        set_detail_due_date(data.due_date ?? "");
        set_detail_priority(data.priority);
        set_detail_status(data.status);
        set_detail_tags_text(data.tags.join(", "));
        set_detail_assignees(data.assignees);
        set_detail_loading_local(false);
        set_is_editing(false);
      })
      .catch((err) => {
        set_detail_error_local(err?.message || "Failed to load task details.");
        set_detail_loading_local(false);
      });
  }, [modalType, task_detail_id]);

  // Mutation for updating task detail
  const updateTaskMutation = useMutation<
    Task,
    Error,
    TaskUpdatePayload
  >(
    async (updatePayload) => {
      const { data } = await axios.patch<Task>(
        `${API_BASE_URL}/api/tasks/${updatePayload.task_id}`,
        updatePayload
      );
      return data;
    },
    {
      onMutate: () => set_loading(true),
      onSettled: () => set_loading(false),
      onSuccess: (updatedTask) => {
        update_task(updatedTask);
        queryClient.invalidateQueries(["tasks"]);
        close_modal();
        set_error_global(null);
      },
      onError: (error) => {
        set_error_global(error.message);
      },
    }
  );

  // Handler for save in task detail modal
  const handleTaskDetailSave = () => {
    if (task_detail_id === null) return;
    if (detail_title.trim() === "") {
      set_error_global("Title is required.");
      return;
    }
    const tagsArr = detail_tags_text
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const dueDateFormatted = detail_due_date.trim() === "" ? null : detail_due_date;

    const payload: TaskUpdatePayload = {
      task_id: task_detail_id,
      title: detail_title.trim(),
      description: detail_description.trim() || undefined,
      due_date: dueDateFormatted,
      priority: detail_priority,
      status: detail_status,
      tags: tagsArr,
      assignees: detail_assignees.map((a) => a.user_id),
    };

    updateTaskMutation.mutate(payload);
  };

  // === CONFIRMATION MODAL IMPLEMENTATION ===

  // Confirmation modal payload expected shape
  const confirmationPayload: ConfirmationPayload = {
    task_ids: Array.isArray(modalPayload.task_ids) ? modalPayload.task_ids : [],
    message:
      typeof modalPayload.message === "string"
        ? modalPayload.message
        : "Are you sure you want to perform this action?",
  };

  // Mutation for deleting tasks (single or bulk)
  const deleteTaskMutation = useMutation<
    void,
    Error,
    { task_ids: number[] }
  >(
    async ({ task_ids }) => {
      if (task_ids.length === 0) throw new Error("No task IDs provided for deletion.");
      let url: string;
      let config: any = {};
      if (task_ids.length === 1) {
        url = `${API_BASE_URL}/api/tasks/${task_ids[0]}`;
        await axios.delete(url, config);
      } else {
        url = `${API_BASE_URL}/api/tasks/bulk-delete`;
        await axios.delete(url, { data: { task_ids } });
      }
    },
    {
      onMutate: () => set_loading(true),
      onSettled: () => set_loading(false),
      onSuccess: () => {
        remove_tasks_by_ids(confirmationPayload.task_ids);
        queryClient.invalidateQueries(["tasks"]);
        close_modal();
        set_error_global(null);
      },
      onError: (error) => {
        set_error_global(error.message);
      },
    }
  );

  // Handler for confirm button in confirmation modal
  const handleConfirmDelete = () => {
    deleteTaskMutation.mutate({ task_ids: confirmationPayload.task_ids });
  };

  // General handlers for modal footer buttons based on modalType
  const handleSave = () => {
    if (modalType === "task_creation") handleCreateSave();
    else if (modalType === "task_detail") handleTaskDetailSave();
  };

  const handleCancel = () => {
    // Clear errors if any
    set_error_global(null);
    close_modal();
  };

  // Prevent scrolling background when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  // Modal titles per modalType
  const modalTitles: Record<ModalType, string> = {
    task_creation: "Create New Task",
    task_detail: is_editing ? "Edit Task Details" : "Task Details",
    confirmation: "Confirm Action",
  };

  // Render everything inside one big <>...</> react fragment
  return (
    <>
      {isOpen && (
        <>
          {/* Modal background overlay */}
          <div
            aria-modal="true"
            role="dialog"
            aria-labelledby="modal-title"
            tabIndex={-1}
            onClick={() => {
              // Clicking on overlay closes modal
              if (!loading) handleCancel();
            }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
          >
            {/* Modal container; stop propagation to prevent overlay click */}
            <div
              ref={modalRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg shadow-md max-w-4xl w-full max-h-[90vh] overflow-y-auto focus:outline-none p-6 relative"
            >
              {/* Modal Header */}
              <header className="flex items-center justify-between border-b border-gray-300 pb-2 mb-4">
                <h2
                  id="modal-title"
                  className="text-xl font-semibold text-gray-900 select-text"
                >
                  {modalType ? modalTitles[modalType] : ""}
                </h2>
                <button
                  type="button"
                  onClick={handleCancel}
                  aria-label="Close modal"
                  disabled={loading}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </header>

              {/* Modal Content */}
              <section className="min-h-[200px] mb-6 text-gray-800 text-sm max-h-[60vh] overflow-y-auto">
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-30 rounded-lg">
                    <svg
                      className="animate-spin h-8 w-8 text-blue-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-label="Loading spinner"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  </div>
                )}

                {modalType === "task_creation" && (
                  <>
                    {/* Task Creation Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCreateSave();
                      }}
                      className="space-y-4"
                      aria-describedby="modal-error"
                    >
                      <div>
                        <label
                          htmlFor="create_title"
                          className="block font-medium text-gray-700 mb-1"
                        >
                          Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="create_title"
                          name="title"
                          required
                          disabled={loading}
                          value={create_title}
                          onChange={(e) => setCreate_title(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="create_description"
                          className="block font-medium text-gray-700 mb-1"
                        >
                          Description
                        </label>
                        <textarea
                          id="create_description"
                          name="description"
                          disabled={loading}
                          value={create_description}
                          onChange={(e) => setCreate_description(e.target.value)}
                          rows={3}
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label
                            htmlFor="create_due_date"
                            className="block font-medium text-gray-700 mb-1"
                          >
                            Due Date
                          </label>
                          <input
                            type="date"
                            id="create_due_date"
                            name="due_date"
                            disabled={loading}
                            value={create_due_date}
                            onChange={(e) => setCreate_due_date(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="create_priority"
                            className="block font-medium text-gray-700 mb-1"
                          >
                            Priority
                          </label>
                          <select
                            id="create_priority"
                            name="priority"
                            disabled={loading}
                            value={create_priority}
                            onChange={(e) =>
                              setCreate_priority(e.target.value as TaskPriority)
                            }
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="create_tags"
                            className="block font-medium text-gray-700 mb-1"
                          >
                            Tags (comma separated)
                          </label>
                          <input
                            type="text"
                            id="create_tags"
                            name="tags"
                            disabled={loading}
                            value={create_tags_text}
                            onChange={(e) => setCreate_tags_text(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="e.g. urgent, client"
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      {/* Show error if any */}
                      {error && (
                        <p
                          role="alert"
                          id="modal-error"
                          className="text-red-600 font-medium mt-1"
                        >
                          {error}
                        </p>
                      )}
                    </form>
                  </>
                )}

                {modalType === "task_detail" && (
                  <>
                    {/* Task Detail View / Edit Mode */}
                    {detail_loading_local ? (
                      <p className="text-center text-gray-600">Loading task details...</p>
                    ) : detail_error_local ? (
                      <p className="text-red-600 font-medium">{detail_error_local}</p>
                    ) : (
                      <>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (is_editing) handleTaskDetailSave();
                            else set_is_editing(true);
                          }}
                          aria-describedby="modal-error"
                        >
                          <div className="space-y-4">
                            <div>
                              <label
                                htmlFor="detail_title"
                                className="block font-medium text-gray-700 mb-1"
                              >
                                Title <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                id="detail_title"
                                name="detail_title"
                                disabled={!is_editing || loading}
                                value={detail_title}
                                onChange={(e) => set_detail_title(e.target.value)}
                                className={`w-full border ${
                                  is_editing ? "border-gray-300" : "border-transparent"
                                } rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                  !is_editing ? "bg-gray-100" : ""
                                }`}
                                autoFocus={is_editing}
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="detail_description"
                                className="block font-medium text-gray-700 mb-1"
                              >
                                Description
                              </label>
                              <textarea
                                id="detail_description"
                                name="detail_description"
                                disabled={!is_editing || loading}
                                value={detail_description}
                                onChange={(e) => set_detail_description(e.target.value)}
                                rows={3}
                                className={`w-full border ${
                                  is_editing ? "border-gray-300" : "border-transparent"
                                } rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y ${
                                  !is_editing ? "bg-gray-100" : ""
                                }`}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label
                                  htmlFor="detail_due_date"
                                  className="block font-medium text-gray-700 mb-1"
                                >
                                  Due Date
                                </label>
                                <input
                                  type="date"
                                  id="detail_due_date"
                                  name="detail_due_date"
                                  disabled={!is_editing || loading}
                                  value={detail_due_date}
                                  onChange={(e) => set_detail_due_date(e.target.value)}
                                  className={`w-full border ${
                                    is_editing ? "border-gray-300" : "border-transparent"
                                  } rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                    !is_editing ? "bg-gray-100" : ""
                                  }`}
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor="detail_priority"
                                  className="block font-medium text-gray-700 mb-1"
                                >
                                  Priority
                                </label>
                                <select
                                  id="detail_priority"
                                  name="detail_priority"
                                  disabled={!is_editing || loading}
                                  value={detail_priority}
                                  onChange={(e) =>
                                    set_detail_priority(e.target.value as TaskPriority)
                                  }
                                  className={`w-full border ${
                                    is_editing ? "border-gray-300" : "border-transparent"
                                  } rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                    !is_editing ? "bg-gray-100" : ""
                                  }`}
                                >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor="detail_status"
                                  className="block font-medium text-gray-700 mb-1"
                                >
                                  Status
                                </label>
                                <select
                                  id="detail_status"
                                  name="detail_status"
                                  disabled={!is_editing || loading}
                                  value={detail_status}
                                  onChange={(e) =>
                                    set_detail_status(e.target.value as TaskStatus)
                                  }
                                  className={`w-full border ${
                                    is_editing ? "border-gray-300" : "border-transparent"
                                  } rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                    !is_editing ? "bg-gray-100" : ""
                                  }`}
                                >
                                  <option value="To Do">To Do</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Done">Done</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label
                                htmlFor="detail_tags"
                                className="block font-medium text-gray-700 mb-1"
                              >
                                Tags (comma separated)
                              </label>
                              <input
                                type="text"
                                id="detail_tags"
                                name="detail_tags"
                                disabled={!is_editing || loading}
                                value={detail_tags_text}
                                onChange={(e) => set_detail_tags_text(e.target.value)}
                                className={`w-full border ${
                                  is_editing ? "border-gray-300" : "border-transparent"
                                } rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                  !is_editing ? "bg-gray-100" : ""
                                }`}
                                placeholder="e.g. urgent, client"
                                autoComplete="off"
                              />
                            </div>

                            {/* Assignees readonly display */}
                            <div>
                              <p className="font-medium mb-1 text-gray-700">Assignees</p>
                              {detail_assignees.length === 0 ? (
                                <p className="text-gray-500 italic">No assignees</p>
                              ) : (
                                <ul className="flex flex-wrap gap-2">
                                  {detail_assignees.map((assignee) => (
                                    <li
                                      key={assignee.user_id}
                                      className="bg-gray-200 rounded-full px-3 py-1 text-sm text-gray-800 select-text"
                                      title={assignee.name}
                                    >
                                      {assignee.name}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </form>

                        {/* Show error if any */}
                        {error && (
                          <p role="alert" className="text-red-600 font-medium mt-3">
                            {error}
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}

                {modalType === "confirmation" && (
                  <>
                    <p className="mb-6 text-gray-800 select-text">
                      {confirmationPayload.message ??
                        "Are you sure you want to perform this action?"}
                    </p>
                    {/* Show error if any */}
                    {error && (
                      <p role="alert" className="text-red-600 font-medium mb-3">
                        {error}
                      </p>
                    )}
                  </>
                )}
              </section>

              {/* Modal Footer Buttons */}
              <footer className="flex justify-end space-x-3">
                {(modalType === "task_creation" || modalType === "task_detail") && (
                  <>
                    {is_editing || modalType === "task_creation" ? (
                      <>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={loading}
                          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => set_is_editing(true)}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={loading}
                          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Close
                        </button>
                      </>
                    )}
                  </>
                )}

                {modalType === "confirmation" && (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={loading}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={loading}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      Confirm
                    </button>
                  </>
                )}
              </footer>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default GV_GlobalModalWrapper;