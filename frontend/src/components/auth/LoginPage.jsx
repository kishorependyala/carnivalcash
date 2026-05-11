import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import authApi from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';

const cardStyle = {
  backgroundColor: '#ffffff',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
  display: 'grid',
  gap: '1rem',
};

const inputStyle = {
  width: '100%',
  padding: '0.85rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
};

function getLandingRoute(user) {
  if (user.roles?.includes('admin')) {
    return '/admin';
  }
  if (user.roles?.includes('vendor') && !user.roles?.includes('admin')) {
    return '/vendor';
  }
  return '/user';
}

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    setLoading(true);
    setStatus('');
    const wakeTimer = setTimeout(() => setStatus('Waking up server, please wait...'), 5000);
    try {
      await authApi.requestCode(phone);
      clearTimeout(wakeTimer);
      setCode(phone);
      setStep(2);
      setStatus('Code sent. For this build, the code matches the phone number.');
    } catch (error) {
      clearTimeout(wakeTimer);
      setStatus(error.response?.data?.error || 'Unable to request code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setStatus('');
    try {
      const response = await authApi.verifyCode(phone, code);
      login(response.token, response.user);
      navigate(getLandingRoute(response.user), { replace: true });
    } catch (error) {
      setStatus(error.response?.data?.error || 'Unable to log in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Login</h1>
          <p style={{ marginTop: 0, color: '#6b7280' }}>Sign in with your phone number to access CarnivalCash.</p>
        </div>
        <div style={cardStyle}>
          <label htmlFor="phone">Phone number</label>
          <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} style={inputStyle} />
          {step === 1 ? (
            <button type="button" onClick={handleRequestCode} disabled={loading || !phone}>
              Get Code
            </button>
          ) : (
            <>
              <label htmlFor="code">Verification code</label>
              <input id="code" value={code} onChange={(event) => setCode(event.target.value)} style={inputStyle} />
              <button type="button" onClick={handleLogin} disabled={loading || !phone || !code}>
                Login
              </button>
            </>
          )}
          {status ? <p style={{ margin: 0, color: '#92400e' }}>{status}</p> : null}
        </div>
      </div>
    </Layout>
  );
}

export default LoginPage;
