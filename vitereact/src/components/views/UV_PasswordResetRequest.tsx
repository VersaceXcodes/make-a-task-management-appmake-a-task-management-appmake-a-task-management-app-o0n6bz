import React, { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

interface PasswordResetRequestPayload {
  email: string;
}

interface PasswordResetResponse {
  message: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // basic email validation regex

const UV_PasswordResetRequest: React.FC = () => {
  // state variables
  const [email, setEmail] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);

  // Validate email format on input change
  useEffect(() => {
    if (email.trim() === "") {
      setValidationError(null);
      setSubmissionStatus(null);
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setValidationError("Please enter a valid email address.");
      setSubmissionStatus(null);
    } else {
      setValidationError(null);
    }
  }, [email]);

  // Mutation for password reset request
  const mutation = useMutation<
    PasswordResetResponse,
    Error,
    PasswordResetRequestPayload
  >(
    (payload) =>
      axios.post(`${apiBaseUrl}/api/auth/password-reset-request`, payload).then(res => res.data),
    {
      onSuccess: (data) => {
        setSubmissionStatus(
          "If the email is registered, a password reset link has been sent. Please check your inbox."
        );
      },
      onError: (error) => {
        setSubmissionStatus(
          error.response?.data?.message ||
            error.message ||
            "An unexpected error occurred. Please try again later."
        );
      },
    }
  );

  // Handler for form submit
  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // If validation error or empty email, do not submit
    if (validationError || email.trim() === "") {
      setSubmissionStatus(null);
      if (email.trim() === "") {
        setValidationError("Email is required.");
      }
      return;
    }

    setSubmissionStatus(null);
    mutation.mutate({ email: email.trim() });
  };

  return (
    <>
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Password Reset Request
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address below and we will send you a link to reset your password.
          </p>
          <form className="mt-8 space-y-6" onSubmit={handleFormSubmit} noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address<span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none rounded relative block w-full px-3 py-2 border ${
                  validationError ? "border-red-500" : "border-gray-300"
                } placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                placeholder="you@example.com"
                aria-invalid={validationError ? "true" : "false"}
                aria-describedby="email-error"
              />
              {validationError && (
                <p
                  className="mt-2 text-sm text-red-600"
                  id="email-error"
                  role="alert"
                >
                  {validationError}
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={mutation.isLoading}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  mutation.isLoading
                    ? "bg-indigo-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                }`}
              >
                {mutation.isLoading ? "Submitting..." : "Send Reset Link"}
              </button>
            </div>
          </form>

          {submissionStatus && (
            <p
              className="mt-4 text-center text-sm text-gray-700"
              role="status"
              aria-live="polite"
            >
              {submissionStatus}
            </p>
          )}

          <div className="mt-6 text-center text-sm">
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PasswordResetRequest;