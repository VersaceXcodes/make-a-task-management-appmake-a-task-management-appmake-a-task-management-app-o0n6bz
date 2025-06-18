import React from 'react';
import { useAppStore } from '@/store/main';

export const GV_LoadingSpinner: React.FC = () => {
  // Access global loading state from Zustand store
  const isLoading = useAppStore(state => state.global_loading);

  return (
    <>
      {isLoading && (
        <div
          role="alert"
          aria-busy="true"
          aria-live="assertive"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
        >
          <svg
            className="w-16 h-16 text-white animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
          <span className="sr-only">Loading...</span>
        </div>
      )}
    </>
  );
};

export default GV_LoadingSpinner;