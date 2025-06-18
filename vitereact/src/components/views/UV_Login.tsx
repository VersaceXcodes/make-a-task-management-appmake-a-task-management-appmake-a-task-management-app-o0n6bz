import React, { useState, useEffect, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    user_id: number;
    name: string;
    email: string;
    role: "regular" | "manager";
    notification_settings: {
      in_app: boolean;
      email: boolean;
    };
    created_at: string; // ISO datetime
    updated_at: string; // ISO datetime
  };
}

interface ValidationErrors {
  email: string | null;
  password: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UV_Login: React.FC = () => {
  const navigate = useNavigate();

  // Local state
  const [email, set_email] = useState<string>("");
  const [password, set_password] = useState<string>("");
  const [validation_errors, set_validation_errors] = useState<ValidationErrors>({
    email: null,
    password: null,
  });
  const [submission_error, set_submission_error] = useState<string | null>(null);

  // Global auth state setters
  const set_user = useAppStore((state) => state.set_user);
  const set_token = useAppStore((state) => state.set_token);
  const set_is_authenticated = useAppStore((state) => state.set_is_authenticated);

  // Mutation for login
  const login_mutation = useMutation<LoginResponse, Error, LoginPayload>({
    mutationFn: async (payload) => {
      const base_url = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const response = await axios.post<LoginResponse>(`${base_url}/api/auth/login`, payload);
      return response.data;
    },
    onSuccess: (data) => {
      // Clear any submission errors
      set_submission_error(null);
      // Store token and user in global state
      set_token(data.token);
      set_user(data.user);
      set_is_authenticated(true);
      // Redirect to main tasks page
      navigate("/tasks", { replace: true });
    },
    onError: (error) => {
      // Set error message for display
      // Prefer using server response if available (axios error response)
      if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === "object") {
        // Attempt to parse a message property from response data
        const data = error.response.data as any;
        if (typeof data.message === "string") {
          set_submission_error(data.message);
          return;
        }
      }
      set_submission_error(error.message || "Login failed. Please try again.");
    },
  });

  // Validate inputs before submission
  const validate = (): boolean => {
    let valid = true;
    const errors: ValidationErrors = { email: null, password: null };

    if (!email.trim()) {
      errors.email = "Email is required.";
      valid = false;
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = "Please enter a valid email address.";
      valid = false;
    }

    if (!password) {
      errors.password = "Password is required.";
      valid = false;
    }

    set_validation_errors(errors);
    return valid;
  };

  // Handle form submission
  const handle_form_submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    set_submission_error(null);
    if (!validate()) return;
    login_mutation.mutate({ email: email.trim(), password });
  };

  // Clear submission error on input change
  useEffect(() => {
    if (submission_error) {
      set_submission_error(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8 border border-gray-200 shadow-md rounded-md bg-white p-8">
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900" tabIndex={-1}>
            Sign in to TaskMaster
          </h2>
          {submission_error && (
            <div
              role="alert"
              aria-live="assertive"
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
            >
              {submission_error}
            </div>
          )}
          <form className="mt-8 space-y-6" onSubmit={handle_form_submit} noValidate>
            <div className="rounded-md shadow-sm -space-y-px">
              {/* Email input */}
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={login_mutation.isLoading}
                  aria-invalid={validation_errors.email ? "true" : "false"}
                  aria-describedby={validation_errors.email ? "email-error" : undefined}
                  placeholder="Email address"
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    validation_errors.email
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-offset-white`}
                  value={email}
                  onChange={(e) => set_email(e.target.value)}
                  onBlur={() => {
                    if (!email.trim()) {
                      set_validation_errors((v) => ({ ...v, email: "Email is required." }));
                    } else if (!EMAIL_REGEX.test(email)) {
                      set_validation_errors((v) => ({ ...v, email: "Please enter a valid email address." }));
                    } else {
                      set_validation_errors((v) => ({ ...v, email: null }));
                    }
                  }}
                />
                {validation_errors.email && (
                  <p
                    className="mt-1 text-sm text-red-600"
                    id="email-error"
                    role="alert"
                  >
                    {validation_errors.email}
                  </p>
                )}
              </div>

              {/* Password input */}
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={login_mutation.isLoading}
                  aria-invalid={validation_errors.password ? "true" : "false"}
                  aria-describedby={validation_errors.password ? "password-error" : undefined}
                  placeholder="Password"
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                    validation_errors.password
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                  } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-offset-white`}
                  value={password}
                  onChange={(e) => set_password(e.target.value)}
                  onBlur={() => {
                    if (!password) {
                      set_validation_errors((v) => ({ ...v, password: "Password is required." }));
                    } else {
                      set_validation_errors((v) => ({ ...v, password: null }));
                    }
                  }}
                  onKeyDown={(e) => {
                    // Allow form submission on Enter key press in password field
                    if (e.key === "Enter" && !login_mutation.isLoading) {
                      handle_form_submit(e);
                    }
                  }}
                />
                {validation_errors.password && (
                  <p
                    className="mt-1 text-sm text-red-600"
                    id="password-error"
                    role="alert"
                  >
                    {validation_errors.password}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link
                  to="/password-reset-request"
                  className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={login_mutation.isLoading}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  login_mutation.isLoading
                    ? "bg-indigo-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                } focus:ring-offset-gray-50`}
                aria-busy={login_mutation.isLoading}
              >
                {login_mutation.isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 text-white"
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
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>

          <p className="mt-2 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default UV_Login;