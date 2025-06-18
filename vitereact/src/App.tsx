import React, { Component, ReactNode } from "react";
import {
	BrowserRouter,
	Route,
	Routes,
	Navigate,
	useLocation,
} from "react-router-dom";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import GV_TopNavigation from '@/components/views/GV_TopNavigation.tsx';
import GV_NotificationCenter from '@/components/views/GV_NotificationCenter.tsx';
import GV_GlobalModalWrapper from '@/components/views/GV_GlobalModalWrapper.tsx';
import GV_Footer from '@/components/views/GV_Footer.tsx';
import GV_LoadingSpinner from '@/components/views/GV_LoadingSpinner.tsx';
import GV_ErrorBanner from '@/components/views/GV_ErrorBanner.tsx';

import UV_UnauthenticatedLanding from '@/components/views/UV_UnauthenticatedLanding.tsx';
import UV_Login from '@/components/views/UV_Login.tsx';
import UV_Register from '@/components/views/UV_Register.tsx';
import UV_PasswordResetRequest from '@/components/views/UV_PasswordResetRequest.tsx';
import UV_PasswordResetConfirm from '@/components/views/UV_PasswordResetConfirm.tsx';
import UV_MainTaskList from '@/components/views/UV_MainTaskList.tsx';
import UV_TaskCreationModal from '@/components/views/UV_TaskCreationModal.tsx';
import UV_TaskDetailModal from '@/components/views/UV_TaskDetailModal.tsx';
import UV_TeamDashboard from '@/components/views/UV_TeamDashboard.tsx';
import UV_UserSettings from '@/components/views/UV_UserSettings.tsx';

// New fallback 404 page:
const UV_NotFound: React.FC = () => (
	<div className="flex flex-col items-center justify-center h-screen p-4">
		<h1 className="text-3xl font-bold mb-4">404 - Page Not Found</h1>
		<p className="mb-8">Sorry, the page you are looking for does not exist.</p>
		<a href="/" className="text-blue-600 underline">Go to Home</a>
	</div>
);

import { use_app_store } from '@/store/main';

const queryClient = new QueryClient();

// React error boundary component for global error handling
interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log error to external service here if needed
		console.error("Uncaught error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div role="alert" className="p-8 text-center">
					<h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
					<p className="mb-4">{this.state.error?.message || "An unexpected error occurred."}</p>
					<button
						className="px-4 py-2 bg-blue-600 text-white rounded"
						onClick={() => this.setState({ hasError: false, error: null })}
						autoFocus
					>
						Retry
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}

const AppContent: React.FC = () => {
	const {
		auth: { is_authenticated, user, loading: authLoading, error: authError },
		modals,
		notification_center_open,
		tasks: { loading: tasksLoading, error: tasksError },
		task_detail: { loading: taskDetailLoading, error: taskDetailError },
		notifications: { loading: notificationsLoading, error: notificationsError },
	} = use_app_store();

	const location = useLocation();

	const unauthenticatedPaths = new Set([
		"/",
		"/login",
		"/register",
		"/password-reset-request",
	]);

	const isPasswordResetConfirmPath = location.pathname.startsWith("/password-reset-confirm");

	const isAuthRoute = !unauthenticatedPaths.has(location.pathname) && !isPasswordResetConfirmPath;

	const managerOnlyPaths = new Set(["/team-dashboard"]);

	if (authLoading) {
		return (
			<div className="flex items-center justify-center h-screen" role="alert" aria-busy="true" aria-live="polite">
				<GV_LoadingSpinner />
			</div>
		);
	}

	if (!is_authenticated && isAuthRoute) {
		return <Navigate to="/" replace />;
	}

	if (is_authenticated && (unauthenticatedPaths.has(location.pathname) || isPasswordResetConfirmPath)) {
		return <Navigate to="/tasks" replace />;
	}

	if (is_authenticated && managerOnlyPaths.has(location.pathname) && user?.role !== "manager") {
		return <Navigate to="/tasks" replace />;
	}

	const showAuthenticatedLayout =
		is_authenticated &&
		(!unauthenticatedPaths.has(location.pathname) && !isPasswordResetConfirmPath);

	const renderModal = () => {
		switch (modals.modal_type) {
			case "task_creation":
				return <UV_TaskCreationModal {...(modals.modal_payload ?? {})} />;
			case "task_detail":
				return <UV_TaskDetailModal {...(modals.modal_payload ?? {})} />;
			case "confirmation":
				return null;
			default:
				return null;
		}
	};

	const globalError =
		authError || tasksError || taskDetailError || notificationsError || null;

	const globalLoading =
		authLoading || tasksLoading || taskDetailLoading || notificationsLoading;

	return (
		<>
			{showAuthenticatedLayout && <GV_TopNavigation />}

			{showAuthenticatedLayout && notification_center_open && <GV_NotificationCenter />}

			<main role="main" className="min-h-screen">
				<Routes>
					{/* Unauthenticated Landing */}
					<Route path="/" element={<UV_UnauthenticatedLanding />} />

					<Route path="/login" element={<UV_Login />} />
					<Route path="/register" element={<UV_Register />} />
					<Route path="/password-reset-request" element={<UV_PasswordResetRequest />} />
					<Route path="/password-reset-confirm/:invitation_token?" element={<UV_PasswordResetConfirm />} />

					{/* Authenticated Routes */}
					<Route path="/tasks" element={<UV_MainTaskList />} />
					<Route path="/team-dashboard" element={<UV_TeamDashboard />} />
					<Route path="/settings" element={<UV_UserSettings />} />

					{/* 404 Not Found fallback */}
					<Route path="*" element={<UV_NotFound />} />
				</Routes>
			</main>

			{/* Global modal wrapper */}
			{showAuthenticatedLayout && (
				<GV_GlobalModalWrapper>
					{renderModal()}
				</GV_GlobalModalWrapper>
			)}

			{/* Footer only in authenticated layout */}
			{showAuthenticatedLayout && <GV_Footer />}

			{/* Global Loading Spinner overlay if any major loading ongoing on authenticated views */}
			{showAuthenticatedLayout && globalLoading && (
				<div
					className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50"
					role="alert"
					aria-busy="true"
					aria-live="polite"
				>
					<GV_LoadingSpinner />
				</div>
			)}

			{/* Global Error Banner on top authenticated views */}
			{showAuthenticatedLayout && globalError && (
				<div className="fixed top-16 left-0 right-0 z-50 px-4" role="alert">
					<GV_ErrorBanner />
				</div>
			)}
		</>
	);
};

const App: React.FC = () => {
	return (
		<BrowserRouter>
			<QueryClientProvider client={queryClient}>
				<GlobalErrorBoundary>
					<AppContent />
				</GlobalErrorBoundary>
			</QueryClientProvider>
		</BrowserRouter>
	);
};

export default App;