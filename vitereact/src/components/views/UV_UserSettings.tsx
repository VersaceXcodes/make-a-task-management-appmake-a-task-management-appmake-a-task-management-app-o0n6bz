import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";
import { Link, useNavigate } from "react-router-dom";

interface UserProfile {
  name: string;
  email: string;
  notification_settings: {
    in_app: boolean;
  };
}

interface UpdateProfilePayload {
  name: string;
  email: string;
}

interface UpdatePasswordPayload {
  current_password: string;
  new_password: string;
}

interface UpdateNotificationPayload {
  notification_settings: {
    in_app: boolean;
  };
}

const api_base_url = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UV_UserSettings: React.FC = () => {
  const { user, token, logout } = useAppStore((state) => ({
    user: state.user,
    token: state.token,
    logout: state.logout,
  }));
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  // Local states for form inputs
  const [profile, setProfile] = useState<{ name: string; email: string }>({
    name: "",
    email: "",
  });
  const [passwordChange, setPasswordChange] = useState<{
    current_password: string;
    new_password: string;
    confirm_password: string;
  }>({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [notificationSettings, setNotificationSettings] = useState<{ in_app: boolean }>({
    in_app: true,
  });

  // Loading and feedback states
  const [loading, setLoading] = useState(false); // generic loading for profile fetch and save
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccessMessage, setPasswordChangeSuccessMessage] = useState<string | null>(null);
  const [notificationToggleLoading, setNotificationToggleLoading] = useState(false);

  // Fetch user profile and notification settings on mount
  const { isLoading: queryLoading, error: queryError } = useQuery<UserProfile, Error>(
    ["userProfile"],
    async () => {
      const res = await axios.get<UserProfile>(`${api_base_url}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    {
      enabled: !!token && !!user,
      onSuccess: (data) => {
        setProfile({ name: data.name, email: data.email });
        setNotificationSettings({ in_app: data.notification_settings.in_app });
      },
      onError: (err) => {
        setError(err.message ?? "Failed to load user profile.");
      },
    }
  );

  // Mutation for updating profile (name, email)
  const updateProfileMutation = useMutation<
    UserProfile,
    Error,
    UpdateProfilePayload
  >(
    async (updatedProfile) => {
      const res = await axios.patch<UserProfile>(
        `${api_base_url}/api/users/me`,
        updatedProfile,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    {
      onMutate: () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
      },
      onSuccess: (data) => {
        setLoading(false);
        setSuccessMessage("Profile updated successfully.");
        setProfile({ name: data.name, email: data.email });
        queryClient.invalidateQueries(["userProfile"]);
      },
      onError: (err) => {
        setLoading(false);
        setError(err.message || "Failed to update profile.");
      },
    }
  );

  // Mutation for changing password
  const changePasswordMutation = useMutation<void, Error, UpdatePasswordPayload>(
    async (payload) => {
      await axios.patch(
        `${api_base_url}/api/users/me`,
        { ...payload },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    },
    {
      onMutate: () => {
        setPasswordChangeLoading(true);
        setPasswordChangeError(null);
        setPasswordChangeSuccessMessage(null);
      },
      onSuccess: () => {
        setPasswordChangeLoading(false);
        setPasswordChangeSuccessMessage("Password changed successfully.");
        setPasswordChange({ current_password: "", new_password: "", confirm_password: "" });
      },
      onError: (err) => {
        setPasswordChangeLoading(false);
        setPasswordChangeError(err.message || "Failed to change password.");
      },
    }
  );

  // Mutation for toggling in-app notification settings
  const toggleNotificationMutation = useMutation<
    UserProfile,
    Error,
    UpdateNotificationPayload
  >(
    async (payload) => {
      const res = await axios.patch<UserProfile>(
        `${api_base_url}/api/users/me`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    {
      onMutate: () => {
        setNotificationToggleLoading(true);
        setError(null);
        setSuccessMessage(null);
      },
      onSuccess: (data) => {
        setNotificationToggleLoading(false);
        setSuccessMessage("Notification settings updated.");
        setNotificationSettings({ in_app: data.notification_settings.in_app });
        queryClient.invalidateQueries(["userProfile"]);
      },
      onError: (err) => {
        setNotificationToggleLoading(false);
        setError(err.message || "Failed to update notification settings.");
      },
    }
  );

  // Handlers

  // Profile form input change
  const handleProfileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // Profile form submit
  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validate inputs
    if (!profile.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!profile.email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_REGEX.test(profile.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    updateProfileMutation.mutate({ name: profile.name.trim(), email: profile.email.trim() });
  };

  // Password change inputs change
  const handlePasswordInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordChange((prev) => ({ ...prev, [name]: value }));
  };

  // Password change submit
  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccessMessage(null);

    // Validate inputs
    if (!passwordChange.current_password) {
      setPasswordChangeError("Current password is required.");
      return;
    }
    if (!passwordChange.new_password) {
      setPasswordChangeError("New password is required.");
      return;
    }
    if (passwordChange.new_password !== passwordChange.confirm_password) {
      setPasswordChangeError("New password and confirmation do not match.");
      return;
    }
    if (passwordChange.new_password.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters.");
      return;
    }

    changePasswordMutation.mutate({
      current_password: passwordChange.current_password,
      new_password: passwordChange.new_password,
    });
  };

  // Notification toggle handler
  const handleNotificationToggle = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    // Optimistic UI update
    setNotificationSettings({ in_app: newValue });
    toggleNotificationMutation.mutate({
      notification_settings: { in_app: newValue },
    });
  };

  // Logout handler
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // If not authenticated user, redirect or show nothing (optional)
  if (!user || !token) {
    // Could redirect to login if not authenticated
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <>
      <main className="max-w-4xl mx-auto p-6 sm:p-10">
        <h1 className="text-3xl font-bold mb-8 text-center">User Profile & Settings</h1>

        {/* Feedback Messages */}
        {(error || successMessage) && (
          <div
            role="alert"
            className={`mb-6 p-4 rounded ${
              error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}
          >
            {error || successMessage}
          </div>
        )}

        {/* Profile Form */}
        <section aria-labelledby="profile-form-title" className="mb-12">
          <h2 id="profile-form-title" className="text-xl font-semibold mb-4">
            Profile Information
          </h2>
          <form onSubmit={handleProfileSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                aria-required="true"
                value={profile.name}
                onChange={handleProfileInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="name"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                aria-required="true"
                value={profile.email}
                onChange={handleProfileInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`inline-block px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </section>

        {/* Password Change Form */}
        <section aria-labelledby="password-change-title" className="mb-12 border-t pt-8">
          <h2 id="password-change-title" className="text-xl font-semibold mb-4">
            Change Password
          </h2>

          {(passwordChangeError || passwordChangeSuccessMessage) && (
            <div
              role="alert"
              className={`mb-4 p-3 rounded ${
                passwordChangeError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}
            >
              {passwordChangeError || passwordChangeSuccessMessage}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="current_password" className="block text-sm font-medium mb-1">
                Current Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="current_password"
                name="current_password"
                aria-required="true"
                value={passwordChange.current_password}
                onChange={handlePasswordInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="new_password" className="block text-sm font-medium mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="new_password"
                name="new_password"
                aria-required="true"
                value={passwordChange.new_password}
                onChange={handlePasswordInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="confirm_password" className="block text-sm font-medium mb-1">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                aria-required="true"
                value={passwordChange.confirm_password}
                onChange={handlePasswordInputChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={passwordChangeLoading}
              className={`inline-block px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                passwordChangeLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {passwordChangeLoading ? "Changing..." : "Change Password"}
            </button>
          </form>
        </section>

        {/* Notification Settings */}
        <section aria-labelledby="notification-settings-title" className="mb-12 border-t pt-8">
          <h2 id="notification-settings-title" className="text-xl font-semibold mb-4">
            Notification Preferences
          </h2>

          <label htmlFor="in_app_notifications" className="inline-flex items-center cursor-pointer select-none">
            <input
              id="in_app_notifications"
              type="checkbox"
              checked={notificationSettings.in_app}
              disabled={notificationToggleLoading}
              onChange={handleNotificationToggle}
              className="form-checkbox h-5 w-5 text-blue-600"
              aria-checked={notificationSettings.in_app}
            />
            <span className="ml-2 select-text">Enable In-App Notifications</span>
          </label>

          {notificationToggleLoading && (
            <p className="mt-2 text-sm text-gray-500" aria-live="polite">
              Updating...
            </p>
          )}
        </section>

        {/* Logout Button */}
        <section className="border-t pt-6 text-center">
          <button
            type="button"
            onClick={handleLogout}
            className="text-red-600 hover:text-red-800 font-semibold focus:outline-none focus:underline"
            aria-label="Logout"
          >
            Logout
          </button>
        </section>
      </main>
    </>
  );
};

export default UV_UserSettings;