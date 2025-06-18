import React from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/store/main";

const GV_Footer: React.FC = () => {
  const is_authenticated = useAppStore((state) => state.is_authenticated);
  const current_year = new Date().getFullYear();

  if (!is_authenticated) {
    return null;
  }

  return (
    <>
      <footer className="w-full border-t border-gray-300 bg-white px-4 py-3 text-center text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-center select-none">
        <div>© {current_year} TaskMaster</div>
        <nav className="space-x-4 mt-2 sm:mt-0" aria-label="Footer legal links">
          <Link
            to="/privacy-policy"
            className="hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms-of-service"
            className="hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
          >
            Terms of Service
          </Link>
        </nav>
      </footer>
    </>
  );
};

export default GV_Footer;