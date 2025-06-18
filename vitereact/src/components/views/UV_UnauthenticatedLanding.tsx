import React, { useState } from "react";
import { Navigate } from "react-router-dom";

interface UV_UnauthenticatedLandingProps {}

const UV_UnauthenticatedLanding: React.FC<UV_UnauthenticatedLandingProps> = () => {
  // State variable for intro text (default from datamap)
  const [introText] = useState<string>(
    "Welcome to TaskMaster - Manage your tasks efficiently and collaboratively."
  );

  // State to track navigation choice (empty string or 'login' | 'register')
  const [authRedirect, setAuthRedirect] = useState<"" | "login" | "register">("");

  // If a redirect was triggered by button click, perform navigation
  if (authRedirect === "login") {
    return <Navigate to="/login" replace />;
  } else if (authRedirect === "register") {
    return <Navigate to="/register" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-tr from-blue-600 via-indigo-700 to-purple-700 px-4 text-white">
      <main className="max-w-xl w-full text-center">
        <h1 className="text-5xl font-extrabold mb-6 tracking-tight drop-shadow-md">
          TaskMaster
        </h1>
        <p className="text-lg mb-12 leading-relaxed drop-shadow-sm">{introText}</p>

        <div className="flex flex-col sm:flex-row justify-center gap-6">
          <button
            type="button"
            onClick={() => setAuthRedirect("login")}
            className="px-8 py-4 bg-white text-blue-700 font-semibold rounded-lg shadow-md hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300 transition"
            aria-label="Login to your TaskMaster account"
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => setAuthRedirect("register")}
            className="px-8 py-4 bg-blue-500 bg-opacity-80 hover:bg-opacity-100 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 transition"
            aria-label="Register a new TaskMaster account"
          >
            Register
          </button>
        </div>
      </main>

      <footer className="mt-16 text-sm select-none opacity-70">
        &copy; {new Date().getFullYear()} TaskMaster. All rights reserved.
      </footer>
    </div>
  );
};

export default UV_UnauthenticatedLanding;