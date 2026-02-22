import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const API_BASE = 'https://api.kycshield.ai';

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(API_BASE + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await res.json();

      // Store access token in memory only
      login(data.access_token);

      const next = searchParams.get('next');
      navigate(next ? decodeURIComponent(next) : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('test@test.com');
    setPassword('test123');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0f1e 0%, #1a1f3a 50%, #0a0f1e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      padding: '40px 20px'
    }}>
      <div style={{width: '100%', maxWidth: '480px'}}>

        <div style={{textAlign: 'center', marginBottom: '48px'}}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: '700',
              color: 'white'
            }}>K</div>
          </div>
          <h1 style={{
            margin: '0 0 12px 0',
            fontSize: '36px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>KYCShield</h1>
          <p style={{
            margin: 0,
            color: '#94a3b8',
            fontSize: '16px'
          }}>AI-Powered Identity Verification</p>
        </div>

        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          <div style={{
            color: '#fca5a5',
            fontSize: '15px',
            lineHeight: '1.6'
          }}>
            <strong style={{color: '#ef4444'}}>$4.6B+</strong> lost to synthetic identity fraud annually.
            <br/>
            Tools like <strong style={{color: '#ef4444'}}>ProKYC</strong> bypass traditional KYC in seconds.
          </div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '24px',
          padding: '48px'
        }}>
          <h2 style={{
            color: 'white',
            margin: '0 0 32px 0',
            fontSize: '24px',
            fontWeight: '600'
          }}>Sign in to your account</h2>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '24px',
              color: '#fca5a5',
              fontSize: '14px'
            }}>{error}</div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{marginBottom: '24px'}}>
              <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '10px', fontSize: '14px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  color: 'white'
                }}
              />
            </div>

            <div style={{marginBottom: '32px'}}>
              <label style={{ display: 'block', color: '#cbd5e1', marginBottom: '10px', fontSize: '14px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  color: 'white'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '16px',
                background: isLoading
                  ? 'rgba(59, 130, 246, 0.5)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{marginTop: '24px', textAlign: 'center'}}>
            <button
              onClick={handleDemoLogin}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60a5fa',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Use demo credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
