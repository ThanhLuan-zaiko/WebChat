import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Simple Home Page (Placeholder)
const HomePage = () => {
  const { user, logout } = useAuth();
  return (
    <div className="flex h-screen flex-col items-center justify-center space-y-4">
      <h1 className="text-2xl font-bold">Welcome, {user?.username}!</h1>
      <button
        onClick={logout}
        className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
      >
        Logout
      </button>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

