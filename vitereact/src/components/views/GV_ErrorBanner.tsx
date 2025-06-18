import React from "react";
import { useAppStore } from "@/store/main";

export const GV_ErrorBanner: React.FC = () => {
  // Select error message and setter from store
  const global_error = useAppStore((state) => state.global_error);
  const set_global_error = useAppStore((state) => state.set_global_error);

  // Determine visibility
  const visible = Boolean(global_error && global_error.trim() !== "");

  // Action: dismiss clears the error message
  const dismissError = () => {
    set_global_error(null);
  };

  return (
    <>
      {visible && (
        <div
          className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-md"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          data-testid="global-error-banner"
        >
          <p className="flex-1 text-sm font-semibold truncate">{global_error}</p>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss error"
            className="ml-4 text-white hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-white rounded"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-5 w-5"
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
      )}
    </>
  );
};