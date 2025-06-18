import React, { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/main";

const DEBOUNCE_DELAY = 300; // ms

export const GV_TopNavigation: React.FC = () => {
  // Global state selectors
  const search_keyword = useAppStore((state) => state.filters.search_keyword || "");
  const set_filters = useAppStore((state) => state.set_filters);
  const view_mode = useAppStore((state) => state.view_mode);
  const set_view_mode = useAppStore((state) => state.set_view_mode);
  const unread_count = useAppStore((state) => state.unread_count);
  const notification_center_open = useAppStore((state) => state.notification_center_open);
  const set_notification_center_open = useAppStore((state) => state.set_notification_center_open);
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);

  const location = useLocation();
  const navigate = useNavigate();

  // Local UI state
  const [searchInput, setSearchInput] = useState<string>(search_keyword);
  const [userAvatarDropdownOpen, setUserAvatarDropdownOpen] = useState<boolean>(false);
  const searchDebounceTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

  // Sync local searchInput with global filter when global changes externally
  useEffect(() => {
    setSearchInput(search_keyword ?? "");
  }, [search_keyword]);

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userAvatarDropdownOpen &&
        avatarDropdownRef.current &&
        !avatarDropdownRef.current.contains(event.target as Node)
      ) {
        setUserAvatarDropdownOpen(false);
      }
    }
    if (userAvatarDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [userAvatarDropdownOpen]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (searchDebounceTimeoutId.current) {
      clearTimeout(searchDebounceTimeoutId.current);
    }
    searchDebounceTimeoutId.current = setTimeout(() => {
      triggerSearchFilter(val);
    }, DEBOUNCE_DELAY);
  };

  const triggerSearchFilter = (val: string) => {
    set_filters({ search_keyword: val.trim() === "" ? null : val.trim() });
  };

  const toggleViewMode = () => {
    const newMode = view_mode === "list" ? "kanban" : "list";
    set_view_mode(newMode);
  };

  const toggleNotificationCenter = () => {
    set_notification_center_open(!notification_center_open);
  };

  const openUserAvatarDropdown = () => {
    setUserAvatarDropdownOpen(true);
  };

  const closeUserAvatarDropdown = () => {
    setUserAvatarDropdownOpen(false);
  };

  const logoutUser = () => {
    logout();
    navigate("/login");
  };

  // Show view toggle only on certain routes
  const showViewToggle =
    location.pathname === "/tasks" || location.pathname === "/team-dashboard";

  // User initial for avatar fallback
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 bg-white shadow-md z-50"
        role="banner"
        aria-label="Primary"
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo and App Name */}
            <div className="flex-shrink-0 flex items-center">
              <Link
                to="/tasks"
                className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 rounded"
                aria-label="TaskMaster Home"
              >
                <svg
                  className="h-8 w-8 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m1-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="text-xl font-bold text-gray-900 select-none">
                  TaskMaster
                </span>
              </Link>
            </div>

            {/* Center: Search Input and View Toggle */}
            <div className="flex-1 flex items-center justify-center px-2">
              <div className="max-w-lg w-full">
                <label htmlFor="task_search_input" className="sr-only">
                  Search tasks
                </label>
                <div className="relative text-gray-400 focus-within:text-gray-600">
                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                    <svg
                      className="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1012 19.5a7.5 7.5 0 004.65-2.85z"
                      />
                    </svg>
                  </div>
                  <input
                    id="task_search_input"
                    name="task_search_input"
                    className="block w-full bg-gray-100 text-gray-900 rounded-md py-2 pl-10 pr-3 border border-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Search tasks"
                    type="search"
                    value={searchInput}
                    onChange={handleSearchInputChange}
                    aria-autocomplete="list"
                    aria-controls="task-list"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              {showViewToggle && (
                <button
                  onClick={toggleViewMode}
                  type="button"
                  aria-pressed={view_mode === "kanban"}
                  aria-label={`Switch to ${view_mode === "list" ? "Kanban" : "List"} view`}
                  title={`Switch to ${view_mode === "list" ? "Kanban" : "List"} view`}
                  className="ml-4 p-2 rounded-md text-gray-700 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {view_mode === "list" ? (
                    <>
                      {/* Kanban icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </>
                  ) : (
                    <>
                      {/* List icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h4M4 12h4M4 18h4M12 6h8M12 12h8M12 18h8"
                        />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Right: Notification Bell and User Avatar Dropdown */}
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleNotificationCenter}
                aria-label="Toggle notification center"
                className="relative p-1 text-gray-700 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                type="button"
              >
                {/* Bell icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-5-5.917V5a3 3 0 10-6 0v.083A6.002 6.002 0 002 11v3.159c0 .538-.214 1.055-.595 1.436L0 17h5m5 0v1a3 3 0 006 0v-1m-6 0h6"
                  />
                </svg>
                {/* Unread badge */}
                {unread_count > 0 && (
                  <span
                    aria-live="polite"
                    aria-atomic="true"
                    className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2"
                  >
                    {unread_count}
                  </span>
                )}
              </button>

              {/* User Avatar Dropdown */}
              <div className="relative" ref={avatarDropdownRef}>
                <button
                  onClick={
                    userAvatarDropdownOpen ? closeUserAvatarDropdown : openUserAvatarDropdown
                  }
                  aria-haspopup="true"
                  aria-expanded={userAvatarDropdownOpen}
                  aria-label="User menu"
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  type="button"
                >
                  {/* Avatar circle with initials */}
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white font-medium select-none">
                    {userInitial}
                  </span>
                  <span className="ml-2 hidden sm:inline-block font-medium text-gray-700">
                    {user?.name}
                  </span>
                  <svg
                    className="ml-1 h-4 w-4 text-gray-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {userAvatarDropdownOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu"
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  >
                    <div className="py-1">
                      <Link
                        to="/settings"
                        role="menuitem"
                        tabIndex={0}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-100 focus:bg-indigo-100 focus:outline-none"
                        onClick={closeUserAvatarDropdown}
                      >
                        Settings
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-100 focus:bg-indigo-100 focus:outline-none"
                        onClick={() => {
                          closeUserAvatarDropdown();
                          logoutUser();
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
      {/* Spacer div to offset fixed navigation height */}
      <div className="h-16" aria-hidden="true" />
    </>
  );
};