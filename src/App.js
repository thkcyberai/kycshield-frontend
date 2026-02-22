import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';

import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import UseCasesPage from './pages/UseCasesPage';
import NewsletterPage from './pages/NewsletterPage';
import BetaLoginPage from './pages/BetaLoginPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UnifiedKYCPage from './pages/UnifiedKYCPage';

function ProtectedRoute({ element }) {
  const { accessToken, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <div>Loading...</div>;
  }

  if (!accessToken) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return element;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/home" element={<HomePage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/use-cases" element={<UseCasesPage />} />
          <Route path="/usecases" element={<Navigate to="/use-cases" replace />} />
          <Route path="/newsletter" element={<NewsletterPage />} />
          <Route path="/beta" element={<BetaLoginPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute element={<DashboardPage />} />} />

          <Route path="/unified" element={<ProtectedRoute element={<UnifiedKYCPage />} />} />
          <Route path="/unified-kyc" element={<ProtectedRoute element={<UnifiedKYCPage />} />} />
          <Route path="/kyc" element={<ProtectedRoute element={<UnifiedKYCPage />} />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
