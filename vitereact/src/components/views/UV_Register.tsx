import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useAppStore, User } from "@/store/main";

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

interface RegisterResponse {
  user: User;
  token: string;
}

interface ValidationErrors {
  name: string | null;
  email: string | null;
  password: string | null;
  confirmPassword: string | null;
}

const UV_Register: React.FC = () => {
  const [name, set_name] = useState<string>("");
  const [email, set_email] = useState<string>("");
  const [password, set_password] = useState<string>("");
  const [confirmPassword, set_confirmPassword] = useState<string>("");
  const [validationErrors, set_validationErrors] = useState<ValidationErrors>({
    name: null,
    email: null,
    password: null,
    confirmPassword: null,
  });
  const [submissionError, set_submissionError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Global auth state setters
  const set_user = useAppStore((state) => state.set_user);
  const set_token = useAppStore((state) => state.set_token);
  const set_is_authenticated = useAppStore((state) => state.set_is_authenticated);

  // Helper validation functions
  const validateEmail = (value: string): boolean => {
    // Simple RFC 5322 email regex
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$/i;
    return re.test(value.toLowerCase());
  };

  const validatePassword = (value: string): string | null => {
    if (value.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[a-z]/.test(value)) {
      return "Password must include a lowercase letter.";
    }
    if (!/[A-Z]/.test(value)) {
      return "Password must include an uppercase letter.";
    }
    if (!/\d/.test(value)) {
      return "Password must include a number.";
    }
    return null;
  };

  // Validation function for all fields
  const validateInputs = (): ValidationErrors => {
    const errors: ValidationErrors = {
      name: null,
      email: null,
      password: null,
      confirmPassword: null,
    };

    // Name validation
    if (name.trim().length === 0) {
      errors.name = "Name is required.";
    }

    // Email validation
    if (email.trim().length === 0) {
      errors.email = "Email is required.";
    } else if (!validateEmail(email.trim())) {
      errors.email = "Email format is invalid.";
    }

    // Password validation
    const pwdError = validatePassword(password);
    if (password.length === 0) {
      errors.password = "Password is required.";
    } else if (pwdError) {
      errors.password = pwdError;
    }

    // Confirm password validation
    if (confirmPassword.length === 0) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
  };

  // Re-validate on any input change
  useEffect(() => {
    set_validationErrors(validateInputs());
    // We don't want to reset submissionError on every change, so leave it alone
  }, [name, email, password, confirmPassword]);

  // Mutation for registration API call
  const registerMutation = useMutation<
    RegisterResponse,
    Error,
    RegisterPayload
  >(
    (newUser) =>
      axios
        .post<RegisterResponse>(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/auth/register`,
          newUser
        )
        .then((res) => res.data),
    {
      onSuccess: (data) => {
        set_token(data.token);
        set_user(data.user);
        set_is_authenticated(true);
        set_submissionError(null);
        // Redirect to main task list after success
        navigate("/tasks");
      },
      onError: (error) => {
        set_submissionError(
          error.response?.data?.message ||
            error.message ||
            "Registration failed. Please try again."
        );
      },
    }
  );

  // Form submit handler
  const handleFormSubmit = (
    e: React.FormEvent<HTMLFormElement>
  ): void => {
    e.preventDefault();
    const errors = validateInputs();
    set_validationErrors(errors);

    // Check if any errors exist for required fields
    const hasErrors = Object.values(errors).some(
      (err) => err !== null && err !== ""
    );
    if (hasErrors) {
      return;
    }

    // Execute the mutation to register user
    registerMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password,
    });
  };

  // Determine if submit button should be disabled:
  // Disabled if loading or if any validation error exists or any field empty
  const isSubmitDisabled =
    registerMutation.isLoading ||
    Object.values(validationErrors).some((err) => err !== null) ||
    !name.trim() ||
    !email.trim() ||
    !password ||
    !confirmPassword;

  return (
    <>
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create a new account
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{" "}
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              already have an account? Login
            </Link>
          </p>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleFormSubmit} noValidate>
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  disabled={registerMutation.isLoading}
                  value={name}
                  onChange={(e) => set_name(e.target.value)}
                  aria-invalid={validationErrors.name ? "true" : "false"}
                  aria-describedby={validationErrors.name ? "name-error" : undefined}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    validationErrors.name ? "border-red-500" : ""
                  }`}
                />
                {validationErrors.name && (
                  <p
                    className="mt-1 text-sm text-red-600"
                    id="name-error"
                    role="alert"
                  >
                    {validationErrors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  disabled={registerMutation.isLoading}
                  value={email}
                  onChange={(e) => set_email(e.target.value)}
                  aria-invalid={validationErrors.email ? "true" : "false"}
                  aria-describedby={validationErrors.email ? "email-error" : undefined}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    validationErrors.email ? "border-red-500" : ""
                  }`}
                />
                {validationErrors.email && (
                  <p
                    className="mt-1 text-sm text-red-600"
                    id="email-error"
                    role="alert"
                  >
                    {validationErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password <span className="text-red-600">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  disabled={registerMutation.isLoading}
                  value={password}
                  onChange={(e) => set_password(e.target.value)}
                  aria-invalid={validationErrors.password ? "true" : "false"}
                  aria-describedby={validationErrors.password ? "password-error" : undefined}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    validationErrors.password ? "border-red-500" : ""
                  }`}
                />
                {validationErrors.password && (
                  <p
                    className="mt-1 text-sm text-red-600"
                    id="password-error"
                    role="alert"
                  >
                    {validationErrors.password}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters, include uppercase, lowercase, and a number.
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirm Password <span className="text-red-600">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  disabled={registerMutation.isLoading}
                  value={confirmPassword}
                  onChange={(e) => set_confirmPassword(e.target.value)}
                  aria-invalid={validationErrors.confirmPassword ? "true" : "false"}
                  aria-describedby={
                    validationErrors.confirmPassword ? "confirmPassword-error" : undefined
                  }
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                    validationErrors.confirmPassword ? "border-red-500" : ""
                  }`}
                />
                {validationErrors.confirmPassword && (
                  <p
                    className="mt-1 text-sm text-red-600"
                    id="confirmPassword-error"
                    role="alert"
                  >
                    {validationErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Server submission error */}
              {submissionError && (
                <div
                  className="rounded-md bg-red-50 p-4"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{submissionError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    isSubmitDisabled
                      ? "bg-indigo-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  }`}
                >
                  {registerMutation.isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 mr-3 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        ></path>
                      </svg>
                      Registering...
                    </>
                  ) : (
                    "Register"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_Register;