import React, { useState, useEffect, useRef, ChangeEvent, KeyboardEvent, FC } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore, Task, TaskPriority } from "@/store/main";

type ReminderPreset = "1 hour" | "1 day" | null;

interface FormFields {
  title: string;
  description: string;
  due_date: string | null;
  priority: TaskPriority;
  tags: string[];
  reminder_preset: ReminderPreset;
}

interface ValidationErrors {
  title?: string | null;
}

interface NewTaskPayload {
  title: string;
  description?: string;
  due_date?: string | null;
  priority: TaskPriority;
  tags: string[];
  reminder_preset?: ReminderPreset;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const UV_TaskCreationModal: FC = () => {
  // Global app store hooks
  const token = useAppStore(state => state.token);
  const close_modal = useAppStore(state => state.close_modal);
  const add_task = useAppStore(state => state.add_task);
  const user = useAppStore(state => state.user);

  // React-query client for query invalidation if needed
  const queryClient = useQueryClient();

  // Form state
  const [formFields, setFormFields] = useState<FormFields>({
    title: "",
    description: "",
    due_date: null,
    priority: "Medium",
    tags: [],
    reminder_preset: null,
  });

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Saving & error states
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for modal dialog for focus trap
  const modalRef = useRef<HTMLDivElement>(null);
  // Ref for first focusable element in modal (input title)
  const firstFocusableRef = useRef<HTMLInputElement>(null);
  // Ref for last focusable element in modal
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // Validate form function called on input changes and before submit
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (!formFields.title.trim()) {
      errors.title = "Title is required";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Effect to validate form on title change
  useEffect(() => {
    validateForm();
  }, [formFields.title]);

  // Handle input change for simple inputs
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormFields((prev) => {
      if (name === "due_date") {
        // due_date can be empty => null
        const val = value === "" ? null : value;
        return { ...prev, due_date: val };
      }
      if (name === "priority") {
        if (value === "Low" || value === "Medium" || value === "High") {
          return { ...prev, priority: value as TaskPriority };
        }
        return prev;
      }
      if (name === "reminder_preset") {
        if (value === "") return { ...prev, reminder_preset: null };
        if (value === "1 hour" || value === "1 day") {
          return { ...prev, reminder_preset: value as ReminderPreset };
        }
        return prev;
      }
      return { ...prev, [name]: value };
    });
  };

  // Handle tags multi-select input: allow typing tags separated by commas and show current tags
  const handleTagsInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    // last part split by comma; allow user to enter multiple tags separated by commas
    const rawValue = e.target.value;
    // split by comma and trim
    const splitTags = rawValue.split(",").map(t => t.trim()).filter(t => t.length > 0);
    setFormFields(prev => ({ ...prev, tags: splitTags }));
  };

  // For tags, show tags joined by comma in input box
  const tagsInputValue = formFields.tags.join(", ");

  // Handle keypress in tags input: prevent adding duplicates, allow adding tags both by comma and Enter key
  const handleTagsKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const currentInput = (e.target as HTMLInputElement).value.trim();
      if (!currentInput) return;
      // Split by commas
      const newTags = currentInput
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0 && !formFields.tags.includes(t));
      if (newTags.length > 0) {
        setFormFields(prev => ({ ...prev, tags: [...prev.tags, ...newTags] }));
      }
      // Clear input after adding tags
      (e.target as HTMLInputElement).value = "";
    }
    if (e.key === "Backspace") {
      // If input is empty and Backspace pressed, remove last tag
      const inputElem = e.target as HTMLInputElement;
      if (inputElem.value === "" && formFields.tags.length > 0) {
        setFormFields(prev => ({ ...prev, tags: prev.tags.slice(0, -1) }));
      }
    }
  };

  // Handle removing tags on click 'x'
  const handleRemoveTag = (tagToRemove: string) => {
    setFormFields(prev => ({ ...prev, tags: prev.tags.filter((t) => t !== tagToRemove) }));
  };

  // Mutation for creating task
  const createTaskMutation = useMutation<
    Task,
    Error,
    NewTaskPayload
  >(
    async (newTask) => {
      const { data } = await axios.post<Task>(
        `${API_BASE_URL}/api/tasks`,
        newTask,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return data;
    },
    {
      onMutate: () => {
        setSaving(true);
        setError(null);
      },
      onSuccess: (createdTask) => {
        add_task(createdTask);
        close_modal();
      },
      onError: (error: any) => {
        setError(error?.response?.data?.message || error.message || "Failed to create task");
      },
      onSettled: () => {
        setSaving(false);
      },
    }
  );

  // Handle form submission/save click
  const handleSave = () => {
    if (!validateForm()) return;

    // prepare payload
    const payload: NewTaskPayload = {
      title: formFields.title.trim(),
      description: formFields.description.trim() || undefined,
      due_date: formFields.due_date,
      priority: formFields.priority,
      tags: formFields.tags,
    };
    if (formFields.reminder_preset) {
      payload.reminder_preset = formFields.reminder_preset;
    }

    createTaskMutation.mutate(payload);
  };

  // Handle cancel action closes modal and resets states
  const handleCancel = () => {
    close_modal();
    // reset form and errors after modal closes (optional)
    setFormFields({
      title: "",
      description: "",
      due_date: null,
      priority: "Medium",
      tags: [],
      reminder_preset: null,
    });
    setValidationErrors({});
    setError(null);
  };

  // Focus trap keyboard handler inside modal (Tab and Shift+Tab)
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
      return;
    }
    if (e.key === "Tab") {
      if (!modalRef.current) return;
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  // Auto focus title input on mount
  useEffect(() => {
    firstFocusableRef.current?.focus();
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        onKeyDown={handleKeyDown}
      >
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 overflow-auto max-h-[90vh]"
        >
          <h2
            id="modal-title"
            className="text-xl font-semibold mb-4"
            tabIndex={-1}
          >
            New Task
          </h2>

          {/* Title input */}
          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700"
            >
              Title <span className="text-red-600">*</span>
            </label>
            <input
              ref={firstFocusableRef}
              type="text"
              id="title"
              name="title"
              value={formFields.title}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                validationErrors.title ? "border-red-600" : "border-gray-300"
              }`}
              aria-invalid={validationErrors.title ? "true" : "false"}
              aria-describedby={validationErrors.title ? "title-error" : undefined}
              autoComplete="off"
              disabled={saving}
            />
            {validationErrors.title && (
              <p
                className="mt-1 text-xs text-red-600"
                id="title-error"
              >
                {validationErrors.title}
              </p>
            )}
          </div>

          {/* Description input */}
          <div className="mb-4">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formFields.description}
              onChange={handleInputChange}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            />
          </div>

          {/* Due date input */}
          <div className="mb-4">
            <label
              htmlFor="due_date"
              className="block text-sm font-medium text-gray-700"
            >
              Due Date
            </label>
            <input
              type="date"
              id="due_date"
              name="due_date"
              value={formFields.due_date ? formFields.due_date.substring(0, 10) : ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
              aria-describedby="due_date_help"
            />
            <p className="text-xs text-gray-500 mt-1" id="due_date_help">
              Optional deadline for the task
            </p>
          </div>

          {/* Priority select */}
          <div className="mb-4">
            <label
              htmlFor="priority"
              className="block text-sm font-medium text-gray-700"
            >
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              value={formFields.priority}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          {/* Tags multi-select input */}
          <div className="mb-4">
            <label
              htmlFor="tags"
              className="block text-sm font-medium text-gray-700"
            >
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={tagsInputValue}
              onChange={handleTagsInputChange}
              onKeyDown={handleTagsKeyDown}
              placeholder="Add tags separated by commas"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
              autoComplete="off"
              aria-describedby="tags_help"
            />
            <p className="text-xs text-gray-500 mt-1" id="tags_help">
              Separate tags by commas. Press Enter or comma to add.
            </p>

            {/* Display tags below */}
            <div className="mt-2 flex flex-wrap gap-2">
              {formFields.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    className="ml-1 text-indigo-700 hover:text-indigo-900 focus:outline-none"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={saving}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Reminder preset select */}
          <div className="mb-6">
            <label
              htmlFor="reminder_preset"
              className="block text-sm font-medium text-gray-700"
            >
              Reminder
            </label>
            <select
              id="reminder_preset"
              name="reminder_preset"
              value={formFields.reminder_preset || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            >
              <option value="">None</option>
              <option value="1 hour">1 hour before</option>
              <option value="1 day">1 day before</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Optional reminder before task due date
            </p>
          </div>

          {/* Display global error message */}
          {error && (
            <p className="mb-4 text-red-600 text-sm" role="alert">
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !!validationErrors.title || formFields.title.trim() === ""}
              className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                saving || !!validationErrors.title || formFields.title.trim() === ""
                  ? "bg-indigo-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
              aria-disabled={saving || !!validationErrors.title}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_TaskCreationModal;