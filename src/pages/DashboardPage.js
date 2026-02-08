import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const [activeTab, setActiveTab] = useState('video');
  const [videoFile, setVideoFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Async video job state
  const [videoJobId, setVideoJobId] = useState(null);
  const [videoJobStatus, setVideoJobStatus] = useState(null);
  const [videoElapsedSec, setVideoElapsedSec] = useState(0);
  const [videoProgressText, setVideoProgressText] = useState('');
  const pollCancelRef = useRef(false);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSelected, setFeedbackSelected] = useState(null);
  const [actualLabel, setActualLabel] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Responsive
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const API_BASE = 'https://api.kycshield.ai';

  const getToken = () => localStorage.getItem('kycshield_token');

  const handleLogout = () => {
    localStorage.removeItem('kycshield_token');
    navigate('/');
  };

  const clearAll = () => {
    pollCancelRef.current = true;

    setVideoFile(null);
    setDocumentFile(null);
    setSelfieFile(null);
    setIdFile(null);

    setIsAnalyzing(false);
    setResults(null);
    setError(null);

    setVideoJobId(null);
    setVideoJobStatus(null);
    setVideoElapsedSec(0);
    setVideoProgressText('');

    setShowFeedback(false);
    setFeedbackSelected(null);
    setActualLabel(null);
    setFeedbackSubmitted(false);
    setFeedbackMessage('');
  };

  const handleFileChange = (setter) => (e) => {
    const file = e.target.files[0];
    if (file) setter(file);
  };

  const safeReadJson = async (res) => {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawText = await res.text();
    let data = null;

    if (rawText && contentType.includes('application/json')) {
      try { data = JSON.parse(rawText); } catch { data = null; }
    }
    if (!data && rawText) {
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
    }
    return { data, rawText };
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  
  const formatJobStatus = (s) => {
    if (!s) return '';
    if (s === 'done') return 'Completed';
    if (s === 'processing') return 'Processing';
    if (s === 'queued') return 'Queued';
    if (s === 'failed') return 'Failed';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };


  const pollVideoJob = async (jobId) => {
    pollCancelRef.current = false;

    setVideoJobId(jobId);
    setVideoJobStatus('processing');
    setVideoElapsedSec(0);
    setVideoProgressText('Processing video. This can take a bit.');

    const startedAt = Date.now();
    const maxMs = 2 * 60 * 1000; // 2 minutes
    const intervalMs = 2000;

    while (true) {
      if (pollCancelRef.current) {
        setVideoProgressText('');
        setVideoJobStatus(null);
        setVideoJobId(null);
        return;
      }

      const elapsed = Date.now() - startedAt;
      setVideoElapsedSec(Math.floor(elapsed / 1000));

      if (elapsed > maxMs) {
        setError(`Video analysis is taking longer than expected. Job ID: ${jobId}`);
        setIsAnalyzing(false);
        setVideoJobStatus('timeout');
        setVideoProgressText('');
        return;
      }

      let res;
      try {
        res = await fetch(API_BASE + `/api/v1/video-deepfake/status/${jobId}`, {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + getToken() },
        });
      } catch {
        setError('Network error while checking status. Please retry.');
        setIsAnalyzing(false);
        setVideoJobStatus('failed');
        setVideoProgressText('');
        return;
      }

      const { data, rawText } = await safeReadJson(res);

      if (!res.ok) {
        const detail = (data && (data.detail || data.error)) || rawText || `Request failed (HTTP ${res.status})`;

        if (res.status === 401) {
          setError('Session expired. Please log in again.');
        } else {
          setError(`Status check failed (HTTP ${res.status}). ${detail}`);
        }

        setIsAnalyzing(false);
        setVideoJobStatus('failed');
        setVideoProgressText('');
        return;
      }

      const status = (data && data.status) || '';
      setVideoJobStatus(status || 'processing');

      if (status === 'done') {
        const result = (data && data.result) ? data.result : data;
        setResults({ type: 'video', data: result });
        if (result && result.usage_log_id) setShowFeedback(true);

        setIsAnalyzing(false);
        setVideoProgressText('');
        return;
      }

      if (status === 'failed') {
        const errMsg = (data && (data.error || (data.result && data.result.error))) || 'Video analysis failed.';
        setError(errMsg);
        setIsAnalyzing(false);
        setVideoProgressText('');
        return;
      }

      await sleep(intervalMs);
    }
  };

  const analyzeVideo = async () => {
    if (!videoFile) { setError('Please select a video'); return; }

    // Client-side guardrail: avoid long uploads that will fail or feel broken.
    // Backend limit is 200MB. Keep the same here.
    const maxMb = 200;
    const sizeMb = videoFile.size / (1024 * 1024);
    if (sizeMb > maxMb) {
      setError(`Video is too large. Max allowed is ${maxMb} MB. Your file is ${sizeMb.toFixed(1)} MB.`);
      return;
    }

    pollCancelRef.current = false;

    setIsAnalyzing(true);
    setError(null);
    setResults(null);
    setShowFeedback(false);
    setFeedbackSubmitted(false);

    setVideoJobId(null);
    setVideoJobStatus(null);
    setVideoElapsedSec(0);
    setVideoProgressText('Uploading video...');

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('page_source', 'dashboard');

      const res = await fetch(API_BASE + '/api/v1/video-deepfake/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData
      });

      const { data, rawText } = await safeReadJson(res);

      if (!res.ok) {
        const detail =
          (data && (data.detail || data.error)) ||
          rawText ||
          `Request failed (HTTP ${res.status})`;
        setError(`Video analysis failed (HTTP ${res.status}). ${detail}`);
        return;
      }

      // Async job mode
      if (data && data.job_id) {
        setVideoProgressText('Video received. Processing started.');
        await pollVideoJob(data.job_id);
        return;
      }

      // Sync mode (backward compatible)
      setResults({ type: 'video', data });
      if (data && data.usage_log_id) setShowFeedback(true);

    } catch (err) {
      setError('Network error while uploading/analyzing the video. Please retry.');
    } finally {
      // If we entered async mode, pollVideoJob will turn this off.
      // If we stayed sync, this turns it off here.
      setVideoProgressText((prev) => prev && videoJobId ? prev : '');
      setIsAnalyzing((prev) => prev && videoJobId ? prev : false);
    }
  };

  const analyzeDocument = async () => {
    if (!documentFile) { setError('Please select a document'); return; }
    setIsAnalyzing(true); setError(null); setResults(null);
    setShowFeedback(false); setFeedbackSubmitted(false);
    try {
      const formData = new FormData();
      formData.append('document', documentFile);
      const res = await fetch(API_BASE + '/api/v1/document/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData
      });
      const data = await res.json();
      setResults({ type: 'document', data });
      if (data.usage_log_id) setShowFeedback(true);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setIsAnalyzing(false); }
  };

  const analyzeFace = async () => {
    if (!selfieFile || !idFile) { setError('Please select both selfie and ID'); return; }
    setIsAnalyzing(true); setError(null); setResults(null);
    setShowFeedback(false); setFeedbackSubmitted(false);
    try {
      const formData = new FormData();
      formData.append('selfie', selfieFile);
      formData.append('id_photo', idFile);
      const res = await fetch(API_BASE + '/api/v1/face/verify', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData
      });
      const data = await res.json();
      setResults({ type: 'face', data });
      if (data.usage_log_id) setShowFeedback(true);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setIsAnalyzing(false); }
  };

  const submitFeedback = async () => {
    if (!results?.data?.usage_log_id || !feedbackSelected) return;
    try {
      const res = await fetch(API_BASE + '/api/v1/beta/feedback', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + getToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usage_log_id: results.data.usage_log_id,
          user_feedback: feedbackSelected,
          user_actual_label: actualLabel
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackSubmitted(true);
        setFeedbackMessage('Thank you! Your feedback helps improve our AI.');
      } else {
        setFeedbackMessage(data.detail || 'Feedback submission failed');
      }
    } catch (err) {
      setFeedbackMessage('Error submitting feedback');
    }
  };

  const skipFeedback = () => {
    setShowFeedback(false);
  };

  const getVerdictInfo = () => {
    if (!results) return { color: 'gray', text: 'N/A' };
    const d = results.data;
    if (results.type === 'face') {
      const match = d.match || d.verified || d.is_match;
      return match ? { color: 'green', text: 'MATCH' } : { color: 'red', text: 'NO MATCH' };
    }
    const isGood = d.is_real || d.verdict === 'GENUINE' || d.verdict === 'REAL';
    return isGood ? { color: 'green', text: d.verdict || 'REAL' } : { color: 'red', text: d.verdict || 'FAKE' };
  };

  const formatConfidencePercent = () => {
    if (!results || !results.data) return '0.0%';

    // Face: show similarity score as-is (already in percent-like format in UI)
    if (results.type === 'face') {
      const sim = Number(results.data.similarity || 0);
      return `${sim.toFixed(1)}%`;
    }

    // Video/document: confidence is 0..1. Avoid showing 100.0% unless truly absolute.
    const c = Number(results.data.confidence || 0);
    let pct = c * 100;

    // If we have explicit probabilities, prefer the max (more honest).
    const rp = Number(results.data.real_probability ?? NaN);
    const fp = Number(results.data.fake_probability ?? NaN);
    if (!Number.isNaN(rp) && !Number.isNaN(fp)) {
      pct = Math.max(rp, fp) * 100;
    }

    // Cap display at 99.9% unless it is mathematically 100%.
    // This prevents rounding artifacts like 0.9996 -> 100.0%
    if (pct >= 99.95 && pct < 100) pct = 99.9;

    // Clamp
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    return `${pct.toFixed(1)}%`;
  };

  const tabs = [
    { id: 'video', label: 'Video Deepfake', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l4-2v8l-4-2v-4z" /></svg>, color: '#a78bfa' },
    { id: 'document', label: 'Document Fraud', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>, color: '#a78bfa' },
    { id: 'face', label: 'Face Matching', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>, color: '#a78bfa' },
  ];

  const FeedbackModal = () => {
    if (!showFeedback || feedbackSubmitted) return null;

    return (
      <div style={{
        marginTop: '24px',
        padding: '24px',
        background: 'rgba(124, 58, 237, 0.1)',
        border: '1px solid rgba(124, 58, 237, 0.3)',
        borderRadius: '16px',
        textAlign: 'center'
      }}>
        <h4 style={{ color: '#a78bfa', margin: '0 0 16px 0', fontSize: '18px' }}>
          🎯 Did we get it right?
        </h4>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
          <button
            onClick={() => setFeedbackSelected('correct')}
            style={{
              padding: '16px 24px',
              background: feedbackSelected === 'correct' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(30, 41, 59, 0.6)',
              border: feedbackSelected === 'correct' ? '2px solid #22c55e' : '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>👍</div>
            <div style={{ color: '#22c55e', fontWeight: '600', fontSize: '14px' }}>Correct</div>
          </button>

          <button
            onClick={() => setFeedbackSelected('wrong')}
            style={{
              padding: '16px 24px',
              background: feedbackSelected === 'wrong' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(30, 41, 59, 0.6)',
              border: feedbackSelected === 'wrong' ? '2px solid #ef4444' : '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>👎</div>
            <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '14px' }}>Wrong</div>
          </button>

          <button
            onClick={() => setFeedbackSelected('unsure')}
            style={{
              padding: '16px 24px',
              background: feedbackSelected === 'unsure' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(30, 41, 59, 0.6)',
              border: feedbackSelected === 'unsure' ? '2px solid #fbbf24' : '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>🤷</div>
            <div style={{ color: '#fbbf24', fontWeight: '600', fontSize: '14px' }}>Not Sure</div>
          </button>
        </div>

        {feedbackSelected && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
              (Optional) What was it really?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setActualLabel('real')}
                style={{
                  padding: '10px 20px',
                  background: actualLabel === 'real' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                  border: actualLabel === 'real' ? '1px solid #22c55e' : '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '8px',
                  color: actualLabel === 'real' ? '#22c55e' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Real
              </button>
              <button
                onClick={() => setActualLabel('fake')}
                style={{
                  padding: '10px 20px',
                  background: actualLabel === 'fake' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  border: actualLabel === 'fake' ? '1px solid #ef4444' : '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '8px',
                  color: actualLabel === 'fake' ? '#ef4444' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Fake
              </button>
              <button
                onClick={() => setActualLabel('unknown')}
                style={{
                  padding: '10px 20px',
                  background: actualLabel === 'unknown' ? 'rgba(148, 163, 184, 0.2)' : 'transparent',
                  border: actualLabel === 'unknown' ? '1px solid #94a3b8' : '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Don't Know
              </button>
            </div>
          </div>
        )}

        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
          Your feedback helps train our AI!
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            onClick={submitFeedback}
            disabled={!feedbackSelected}
            style={{
              padding: '12px 32px',
              background: feedbackSelected ? 'linear-gradient(135deg, #a78bfa, #7c3aed)' : 'rgba(51, 65, 85, 0.5)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: '600',
              cursor: feedbackSelected ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
          >
            Submit
          </button>
          <button
            onClick={skipFeedback}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  };

  const FeedbackSuccess = () => {
    if (!feedbackSubmitted) return null;
    return (
      <div style={{
        marginTop: '24px',
        padding: '20px',
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <span style={{ fontSize: '24px', marginRight: '8px' }}>✅</span>
        <span style={{ color: '#4ade80', fontWeight: '500' }}>{feedbackMessage}</span>
      </div>
    );
  };

  return (
    <div style={{minHeight: '100vh', background: '#010a13', color: 'white', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '16px 20px' : '28px 100px',
        maxWidth: '1600px',
        margin: '0 auto',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer'}} onClick={() => navigate('/')}>
          <img src="/assets/KYCShield_logo_final.png" alt="KYCShield Logo" style={{height: '64px', width: 'auto'}} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          <button onClick={() => navigate('/unified')} style={{
            padding: isMobile ? '10px 14px' : '16px 32px',
            background: 'linear-gradient(135deg, #c084fc, #a855f7, #7c3aed)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: isMobile ? '12px' : '15px'
          }}>
            {isMobile ? '🎯 KYC' : '🎯 Unified KYC'}
          </button>
          <button onClick={handleLogout} style={{
            padding: isMobile ? '10px 14px' : '16px 32px',
            background: 'transparent',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '8px',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: isMobile ? '11px' : '15px'
          }}>
            {isMobile ? 'Exit' : 'Logout'}
          </button>
        </div>
      </header>

      <main style={{maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '20px 16px' : '70px 40px'}}>
        <div style={{textAlign: 'center', marginBottom: '40px'}}>
          <h1 style={{ fontSize: isMobile ? '28px' : '56px', fontWeight: '700', margin: '0 0 16px 0', letterSpacing: '-1px' }}>
            <span style={{color: '#60a5fa'}}>Detection</span>
            <span style={{color: 'white'}}> Dashboard</span>
          </h1>
          <p style={{color: '#94a3b8', fontSize: isMobile ? '14px' : '22px', margin: 0}}>Test individual detection capabilities</p>
        </div>

        <div style={{display: 'flex', gap: '16px', marginBottom: '50px', justifyContent: 'center'}}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); clearAll(); }} style={{
              padding: isMobile ? '10px 14px' : '18px 36px',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: activeTab === tab.id ? '1px solid ' + tab.color : '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: activeTab === tab.id ? tab.color : '#94a3b8',
              cursor: 'pointer',
              fontSize: '17px',
              fontWeight: activeTab === tab.id ? '600' : '500',
              transition: 'all 0.2s'
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: '24px', padding: isMobile ? '20px' : '50px' }}>
          {activeTab === 'video' && (
            <div>
              <h3 style={{margin: '0 0 12px 0', color: '#a78bfa', fontSize: '28px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px'}}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l4-2v8l-4-2v-4z" /></svg> Video Deepfake Detection</h3>
              <p style={{color: '#94a3b8', marginBottom: '35px', fontSize: '15px'}}>Upload a video to detect AI-generated deepfakes with 99.90% accuracy.</p>

              <div style={{ border: '2px dashed rgba(148, 163, 184, 0.2)', borderRadius: '20px', padding: isMobile ? '30px' : '70px', textAlign: 'center', marginBottom: '20px', background: 'rgba(15, 23, 42, 0.4)' }}>
                <input type="file" accept="video/*" onChange={handleFileChange(setVideoFile)} style={{display: 'none'}} id="video-upload" />
                <label htmlFor="video-upload" style={{cursor: 'pointer'}}>
                  <div style={{marginBottom: '12px'}}><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg></div>
                  {videoFile ? <p style={{color: '#a78bfa', fontWeight: '500', fontSize: '15px'}}>{videoFile.name}</p> : <p style={{color: '#64748b', fontSize: '15px'}}>Drop video or click to upload</p>}
                </label>
              </div>

              {(isAnalyzing || videoJobId) && (
                <div style={{
                  marginBottom: '15px',
                  padding: '14px 16px',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: '12px',
                  color: '#cbd5e1',
                  fontSize: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Status</div>
                    <div style={{ fontWeight: '600', color: '#e2e8f0' }}>
                      {formatJobStatus(videoJobStatus) || videoProgressText || (isAnalyzing ? 'Working...' : '')}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Elapsed</div>
                    <div style={{ fontWeight: '600', color: '#e2e8f0' }}>{videoElapsedSec}s</div>
                  </div>
                  {videoJobId && (
                    <div style={{ minWidth: '260px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Job</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#a78bfa' }}>{videoJobId}</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{display: 'flex', gap: '12px'}}>
                <button onClick={analyzeVideo} disabled={!videoFile || isAnalyzing} style={{ flex: 1, padding: '22px', background: videoFile && !isAnalyzing ? 'linear-gradient(135deg, #a78bfa, #7c3aed)' : 'rgba(51, 65, 85, 0.5)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '600', fontSize: '17px', cursor: videoFile && !isAnalyzing ? 'pointer' : 'not-allowed' }}>
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Video'}
                </button>
                <button onClick={clearAll} style={{ padding: '22px 36px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontSize: '15px' }}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {activeTab === 'document' && (
            <div>
              <h3 style={{margin: '0 0 12px 0', color: '#a78bfa', fontSize: '28px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px'}}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg> Document Fraud Detection</h3>
              <p style={{color: '#94a3b8', marginBottom: '35px', fontSize: '15px'}}>Upload an ID document to detect synthetic or tampered documents with 100% accuracy.</p>
              <div style={{ border: '2px dashed rgba(148, 163, 184, 0.2)', borderRadius: '20px', padding: isMobile ? '30px' : '70px', textAlign: 'center', marginBottom: '35px', background: 'rgba(15, 23, 42, 0.4)' }}>
                <input type="file" accept="image/*" onChange={handleFileChange(setDocumentFile)} style={{display: 'none'}} id="doc-upload" />
                <label htmlFor="doc-upload" style={{cursor: 'pointer'}}>
                  <div style={{marginBottom: '12px'}}><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg></div>
                  {documentFile ? <p style={{color: '#a78bfa', fontWeight: '500', fontSize: '15px'}}>{documentFile.name}</p> : <p style={{color: '#64748b', fontSize: '15px'}}>Drop document or click to upload</p>}
                </label>
              </div>
              <div style={{display: 'flex', gap: '12px'}}>
                <button onClick={analyzeDocument} disabled={!documentFile || isAnalyzing} style={{ flex: 1, padding: '22px', background: documentFile && !isAnalyzing ? 'linear-gradient(135deg, #a78bfa, #7c3aed)' : 'rgba(51, 65, 85, 0.5)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '600', fontSize: '17px', cursor: documentFile && !isAnalyzing ? 'pointer' : 'not-allowed' }}>
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Document'}
                </button>
                <button onClick={clearAll} style={{ padding: '22px 36px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontSize: '15px' }}>Clear</button>
              </div>
            </div>
          )}

          {activeTab === 'face' && (
            <div>
              <h3 style={{margin: '0 0 12px 0', color: '#a78bfa', fontSize: '28px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px'}}><svg width="32" height="32" viewBox="0 0 24 24" fill="#a78bfa" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> Face Matching</h3>
              <p style={{color: '#94a3b8', marginBottom: '35px', fontSize: '15px'}}>Compare a selfie with an ID photo to verify identity with 96.94% accuracy.</p>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px'}}>
                <div style={{ border: '2px dashed rgba(148, 163, 184, 0.2)', borderRadius: '20px', padding: isMobile ? '30px' : '70px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)' }}>
                  <input type="file" accept="image/*" onChange={handleFileChange(setSelfieFile)} style={{display: 'none'}} id="selfie-upload" />
                  <label htmlFor="selfie-upload" style={{cursor: 'pointer'}}>
                    <div style={{marginBottom: '10px'}}><svg width={isMobile ? "28" : "56"} height={isMobile ? "28" : "56"} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><circle cx="12" cy="10" r="3" /><path d="M12 17v.01" /></svg></div>
                    {selfieFile ? <p style={{color: '#a78bfa', fontWeight: '500', fontSize: '14px'}}>{selfieFile.name}</p> : <p style={{color: '#64748b', fontSize: '14px'}}>Upload Selfie</p>}
                  </label>
                </div>
                <div style={{ border: '2px dashed rgba(148, 163, 184, 0.2)', borderRadius: '20px', padding: isMobile ? '30px' : '70px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)' }}>
                  <input type="file" accept="image/*" onChange={handleFileChange(setIdFile)} style={{display: 'none'}} id="id-upload" />
                  <label htmlFor="id-upload" style={{cursor: 'pointer'}}>
                    <div style={{marginBottom: '10px'}}><svg width={isMobile ? "28" : "56"} height={isMobile ? "28" : "56"} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2" /><path d="M14 10h4" /><path d="M14 14h4" /></svg></div>
                    {idFile ? <p style={{color: '#a78bfa', fontWeight: '500', fontSize: '14px'}}>{idFile.name}</p> : <p style={{color: '#64748b', fontSize: '14px'}}>Upload ID Photo</p>}
                  </label>
                </div>
              </div>
              <div style={{display: 'flex', gap: '12px'}}>
                <button onClick={analyzeFace} disabled={!selfieFile || !idFile || isAnalyzing} style={{ flex: 1, padding: '22px', background: selfieFile && idFile && !isAnalyzing ? 'linear-gradient(135deg, #a78bfa, #7c3aed)' : 'rgba(51, 65, 85, 0.5)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '600', fontSize: '17px', cursor: selfieFile && idFile && !isAnalyzing ? 'pointer' : 'not-allowed' }}>
                  {isAnalyzing ? 'Analyzing...' : 'Compare Faces'}
                </button>
                <button onClick={clearAll} style={{ padding: '22px 36px', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontSize: '15px' }}>Clear</button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '25px', padding: '22px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#f87171', textAlign: 'center', fontSize: '15px' }}>{error}</div>
          )}

          {results && (
            <div style={{ marginTop: '30px', padding: '36px', borderRadius: '20px', background: getVerdictInfo().color === 'green' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid', borderColor: getVerdictInfo().color === 'green' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)' }}>
              <div style={{textAlign: 'center', marginBottom: '24px'}}>
                <span style={{ display: 'inline-block', padding: '14px 36px', borderRadius: '50px', fontSize: '28px', fontWeight: 'bold', background: getVerdictInfo().color === 'green' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: getVerdictInfo().color === 'green' ? '#4ade80' : '#f87171' }}>
                  {getVerdictInfo().color === 'green' ? '✅' : '⚠️'} {getVerdictInfo().text}
                </span>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px'}}>
                <div style={{background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', padding: '24px', textAlign: 'center'}}>
                  <p style={{color: '#94a3b8', fontSize: '15px', margin: '0 0 6px 0'}}>Confidence</p>
                  <p style={{fontSize: '28px', fontWeight: 'bold', margin: 0, color: 'white'}}>{formatConfidencePercent()}</p>
                </div>
                <div style={{background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', padding: '24px', textAlign: 'center'}}>
                  <p style={{color: '#94a3b8', fontSize: '15px', margin: '0 0 6px 0'}}>Type</p>
                  <p style={{fontSize: isMobile ? '14px' : '22px', fontWeight: '600', margin: 0, color: 'white'}}>{results.type === 'video' ? 'Video' : results.type === 'document' ? 'Document' : 'Face Match'}</p>
                </div>
                <div style={{background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', padding: '24px', textAlign: 'center'}}>
                  <p style={{color: '#94a3b8', fontSize: '15px', margin: '0 0 6px 0'}}>Processing</p>
                  <p style={{fontSize: isMobile ? '14px' : '22px', fontWeight: '600', margin: 0, color: 'white'}}>{results.data.frames_analyzed ? results.data.frames_analyzed + ' frames' : 'Instant'}</p>
                </div>
              </div>
            </div>
          )}

          <FeedbackModal />
          <FeedbackSuccess />
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
        © 2025 KYCShield by Facti.ai
      </footer>
    </div>
  );
}

export default DashboardPage;
