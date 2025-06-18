import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";

interface PasswordResetPayload {
  token: string;
  new_password: string;
}

interface ValidationErrors {
  newPassword: string | null;
  confirmNewPassword: string | null;
}

const validatePasswordStrength = (password: string): string | null => {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  return null;
};

const UV_PasswordResetConfirm: React.FC = () => {
  const { invitation_token = "" } = useParams<{ invitation_token?: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    newPassword: null,
    confirmNewPassword: null,
  });
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);

  // Validate passwords on change
  const validatePasswords = (np: string, cnp: string): ValidationErrors => {
    const errors: ValidationErrors = {
      newPassword: null,
      confirmNewPassword: null,
    };
    const pwdStrengthError = validatePasswordStrength(np);
    if (pwdStrengthError) {
      errors.newPassword = pwdStrengthError;
    }
    if (cnp.length === 0) {
      errors.confirmNewPassword = "Please confirm your password.";
    } else if (np !== cnp) {
      errors.confirmNewPassword = "Passwords do not match.";
    }
    return errors;
  };

  // Effect to validate on input changes
  useEffect(() => {
    setValidationErrors(validatePasswords(newPassword, confirmNewPassword));
    // Clear submission errors on input change
    setSubmissionError(null);
  }, [newPassword, confirmNewPassword]);

  // React Query mutation for password reset
  const mutation = useMutation<
    void,
    Error,
    PasswordResetPayload
  >(async (payload) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    await axios.post(`${baseUrl}/api/auth/password-reset`, payload);
  }, {
    onSuccess: () => {
      setSubmissionSuccess(true);
      setSubmissionError(null);
      // Redirect after brief delay
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        setSubmissionError(String(error.response.data.message));
      } else {
        setSubmissionError(error.message);
      }
    },
  });

  // Handle form submit
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validatePasswords(newPassword, confirmNewPassword);
    setValidationErrors(errors);
    if (errors.newPassword || errors.confirmNewPassword) {
      return;
    }
    if (!invitation_token || invitation_token.trim() === "") {
      setSubmissionError("Reset token missing or invalid.");
      return;
    }
    mutation.mutate({
      token: invitation_token,
      new_password: newPassword,
    });
  };

  const isSubmitDisabled =
    !!validationErrors.newPassword ||
    !!validationErrors.confirmNewPassword ||
    newPassword.length === 0 ||
    confirmNewPassword.length === 0 ||
    mutation.isLoading;

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Set Your New Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 max-w">
            Enter your new password below to reset your account password.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10">
            {submissionSuccess ? (
              <div className="text-center">
                <p className="text-green-600 font-semibold mb-4">
                  Password reset successful! Redirecting to login...
                </p>
                <p>
                  If you are not redirected, click{" "}
                  <Link
                    to="/login"
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    here
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleFormSubmit} noValidate>
                {submissionError && (
                  <div
                    role="alert"
                    className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
                  >
                    {submissionError}
                  </div>
                )}
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    New Password *
                  </label>
                  <input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border ${
                      validationErrors.newPassword
                        ? "border-red-500"
                        : "border-gray-300"
                    } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    aria-describedby="new-password-error"
                    aria-invalid={!!validationErrors.newPassword}
                  />
                  {validationErrors.newPassword && (
                    <p
                      id="new-password-error"
                      className="mt-2 text-sm text-red-600"
                    >
                      {validationErrors.newPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Confirm New Password *
                  </label>
                  <input
                    id="confirm-new-password"
                    name="confirmNewPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border ${
                      validationErrors.confirmNewPassword
                        ? "border-red-500"
                        : "border-gray-300"
                    } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    aria-describedby="confirm-new-password-error"
                    aria-invalid={!!validationErrors.confirmNewPassword}
                  />
                  {validationErrors.confirmNewPassword && (
                    <p
                      id="confirm-new-password-error"
                      className="mt-2 text-sm text-red-600"
                    >
                      {validationErrors.confirmNewPassword}
                    </p>
                  )}
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      isSubmitDisabled
                        ? "bg-blue-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {mutation.isLoading ? (
                      <svg
                        className="animate-spin h-5 w-5 text-white"
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
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </div>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-gray-600">
              Remembered your password?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:text-blue-500 underline"
              >
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UV_PasswordResetConfirm;