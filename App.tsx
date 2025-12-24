
import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';

// Lazy Load Pages
// This improves initial load performance by splitting the code into chunks
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Inventory = lazy(() => import('./pages/Inventory').then(module => ({ default: module.Inventory })));
const TheftReport = lazy(() => import('./pages/TheftReport').then(module => ({ default: module.TheftReport })));
const Rentals = lazy(() => import('./pages/Rentals').then(module => ({ default: module.Rentals })));
const Sales = lazy(() => import('./pages/Sales').then(module => ({ default: module.Sales })));
const SerialCheck = lazy(() => import('./pages/SerialCheck').then(module => ({ default: module.SerialCheck })));
const Rankings = lazy(() => import('./pages/Rankings').then(module => ({ default: module.Rankings })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const SafetyMap = lazy(() => import('./pages/SafetyMap').then(module => ({ default: module.SafetyMap })));
const Notifications = lazy(() => import('./pages/Notifications').then(module => ({ default: module.Notifications })));
const Network = lazy(() => import('./pages/Network').then(module => ({ default: module.Network })));

// Loading Component
const PageLoader = () => (
  <div className="min-h-screen bg-brand-950 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-brand-800 border-t-accent-primary rounded-full animate-spin"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/report-theft" element={<ProtectedRoute><TheftReport /></ProtectedRoute>} />
            <Route path="/rentals" element={<ProtectedRoute><Rentals /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/check-serial" element={<ProtectedRoute><SerialCheck /></ProtectedRoute>} />
            <Route path="/safety" element={<ProtectedRoute><SafetyMap /></ProtectedRoute>} />
            <Route path="/rankings" element={<ProtectedRoute><Rankings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />

            {/* Admin Route */}
            <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </HashRouter>
      <Analytics />
    </AuthProvider>
  );
}

export default App;
