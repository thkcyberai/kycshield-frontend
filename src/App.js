import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

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
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/unified" element={<UnifiedKYCPage />} />
          <Route path="/unified-kyc" element={<UnifiedKYCPage />} />
          <Route path="/kyc" element={<UnifiedKYCPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
