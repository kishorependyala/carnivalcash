import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import authApi from '../../api/auth';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';

const AMBER = '#f59e0b';
const DARK_AMBER = '#d97706';
const DEEP = '#78350f';

const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #fffbeb 0%, #fef3c7 45%, #fde68a 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
  boxSizing: 'border-box',
};

const card = {
  background: '#fff',
  borderRadius: '1.5rem',
  boxShadow: '0 8px 40px rgba(120,53,15,0.12)',
  padding: '2rem 1.75rem',
  width: '100%',
  maxWidth: '400px',
  boxSizing: 'border-box',
  display: 'grid',
  gap: '1rem',
};

const inp = {
  width: '100%',
  padding: '0.85rem 1rem',
  borderRadius: '0.85rem',
  border: '1.5px solid #e5e7eb',
  boxSizing: 'border-box',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const primaryBtn = {
  width: '100%',
  padding: '0.9rem',
  background: `linear-gradient(135deg, ${AMBER}, ${DARK_AMBER})`,
  color: '#fff',
  border: 'none',
  borderRadius: '0.85rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
};

const skipBtn = {
  background: 'none',
  border: 'none',
  color: '#9ca3af',
  fontSize: '0.88rem',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: '0.25rem 0',
  alignSelf: 'center',
};

const pill = (active) => ({
  flex: 1,
  height: '4px',
  borderRadius: '2px',
  background: active ? AMBER : '#e5e7eb',
  transition: 'background 0.3s',
});

function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={pill(i <= current)} />
      ))}
    </div>
  );
}

function getLandingRoute(user) {
  if (user.roles?.includes('admin')) return '/admin';
  if (user.roles?.includes('vendor') && !user.roles?.includes('admin')) return '/vendor';
  return '/user';
}

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Auth steps
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [authStep, setAuthStep] = useState(1); // 1=phone, 2=code
  const [authStatus, setAuthStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Onboarding state (new users only)
  const [onboarding, setOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0); // 0=name, 1=kids, 2=tips
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [name, setName] = useState('');
  const [kids, setKids] = useState([]); // [{name, limit}]
  const [newKid, setNewKid] = useState({ name: '', limit: '' });
  const [saving, setSaving] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState('');

  const handleRequestCode = async () => {
    setLoading(true);
    setAuthStatus('');
    const wakeTimer = setTimeout(() => setAuthStatus('Waking up server, please wait…'), 5000);
    try {
      await authApi.requestCode(phone);
      clearTimeout(wakeTimer);
      setCode(phone); // dev: code matches phone
      setAuthStep(2);
      setAuthStatus('Code sent! For this build, the code matches your phone number.');
    } catch (err) {
      clearTimeout(wakeTimer);
      setAuthStatus(err.response?.data?.error || 'Unable to send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setAuthStatus('');
    try {
      const res = await authApi.verifyCode(phone, code);
      login(res.token, res.user);
      if (res.user?.isNew) {
        setLoggedInUser(res.user);
        setOnboarding(true);
      } else {
        navigate(getLandingRoute(res.user), { replace: true });
      }
    } catch (err) {
      setAuthStatus(err.response?.data?.error || 'Unable to log in.');
    } finally {
      setLoading(false);
    }
  };

  const saveName = async () => {
    if (!name.trim()) return nextOnboard();
    setSaving(true);
    try {
      await userApi.updateProfile({ name: name.trim() });
    } catch { /* ignore */ }
    finally { setSaving(false); }
    nextOnboard();
  };

  const addKid = async () => {
    if (!newKid.name.trim()) return;
    setSaving(true);
    try {
      const created = await userApi.createKid({ name: newKid.name.trim(), spendingLimit: newKid.limit ? Number(newKid.limit) : null });
      setKids(prev => [...prev, created]);
      setNewKid({ name: '', limit: '' });
      setOnboardStatus('');
    } catch (e) {
      setOnboardStatus(e.response?.data?.error || 'Failed to add kid.');
    } finally { setSaving(false); }
  };

  const nextOnboard = () => {
    if (onboardStep < 2) { setOnboardStep(s => s + 1); setOnboardStatus(''); }
    else { navigate(getLandingRoute(loggedInUser), { replace: true }); }
  };

  const finishOnboarding = () => navigate(getLandingRoute(loggedInUser), { replace: true });

  /* ── Render ── */

  if (onboarding) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🎡</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: DEEP }}>CarnivalCash</div>
        </div>
        <div style={card}>
          <ProgressDots current={onboardStep} total={3} />

          {/* Step 0: Name */}
          {onboardStep === 0 && (
            <>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: DEEP }}>👋 Welcome!</div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.25rem' }}>Let's set up your profile. What should we call you?</div>
              </div>
              <input
                autoFocus
                style={inp}
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
              />
              <button style={primaryBtn} onClick={saveName} disabled={saving}>
                {saving ? 'Saving…' : 'Continue →'}
              </button>
              <button style={skipBtn} onClick={nextOnboard}>Skip for now</button>
            </>
          )}

          {/* Step 1: Kids */}
          {onboardStep === 1 && (
            <>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: DEEP }}>👦 Add your kids</div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.25rem' }}>Kids get their own QR code and token limit so they can spend independently.</div>
              </div>
              {kids.length > 0 && (
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  {kids.map(k => (
                    <div key={k.kidId} style={{ background: '#fef3c7', borderRadius: '0.75rem', padding: '0.5rem 0.85rem', fontWeight: 600, color: DEEP, fontSize: '0.9rem' }}>
                      👦 {k.name}{k.spendingLimit ? ` · 🪙 ${k.spendingLimit}` : ''}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.5rem', background: '#f9fafb', borderRadius: '0.85rem', padding: '0.85rem' }}>
                <input style={inp} placeholder="Kid's name" value={newKid.name} onChange={e => setNewKid(n => ({ ...n, name: e.target.value }))} />
                <input style={inp} placeholder="Token limit (optional)" type="number" value={newKid.limit} onChange={e => setNewKid(n => ({ ...n, limit: e.target.value }))} />
                <button style={{ ...primaryBtn, background: '#f3f4f6', color: '#374151', boxShadow: 'none' }} onClick={addKid} disabled={saving || !newKid.name.trim()}>
                  {saving ? 'Adding…' : '+ Add Kid'}
                </button>
              </div>
              {onboardStatus && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{onboardStatus}</p>}
              <button style={primaryBtn} onClick={nextOnboard}>{kids.length > 0 ? 'Done, Continue →' : 'Skip for now'}</button>
            </>
          )}

          {/* Step 2: Tips */}
          {onboardStep === 2 && (
            <>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: DEEP }}>🎪 You're all set!</div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.25rem' }}>Here's how CarnivalCash works:</div>
              </div>
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {[
                  ['🪙', 'Buy tokens', 'Tokens are your carnival currency. Get them at the entry booth.'],
                  ['📲', 'Scan at stalls', 'Show your QR code at any stall to spend tokens on games & food.'],
                  ['👦', 'Kids spend too', 'Each kid has their own QR code with a set limit you control.'],
                  ['🔗', 'Link family', 'Connect with a partner so you can share balance visibility.'],
                  ['🎪', 'Run a stall?', 'Go to the Stalls tab to create your stall or request to join an existing one.'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#fffbeb', borderRadius: '0.85rem', padding: '0.75rem 0.9rem' }}>
                    <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: DEEP }}>{title}</div>
                      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.1rem' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button style={primaryBtn} onClick={finishOnboarding}>🎡 Let's go!</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>🎡</div>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: DEEP, marginTop: '0.4rem', letterSpacing: '-0.5px' }}>CarnivalCash</div>
        <div style={{ color: '#92400e', fontSize: '0.92rem', marginTop: '0.3rem', opacity: 0.8 }}>Your digital token wallet for the carnival</div>
      </div>

      <div style={card}>
        {authStep === 1 ? (
          <>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: DEEP }}>Sign in</div>
              <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.2rem' }}>Enter your phone number to get started</div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.4rem' }}>Phone number</label>
              <input
                style={inp}
                type="tel"
                placeholder="e.g. 7327184414"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && phone && handleRequestCode()}
                autoFocus
              />
            </div>
            <button style={{ ...primaryBtn, opacity: loading || !phone ? 0.65 : 1 }} onClick={handleRequestCode} disabled={loading || !phone}>
              {loading ? 'Sending…' : 'Send Code →'}
            </button>
          </>
        ) : (
          <>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: DEEP }}>Verify your number</div>
              <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.2rem' }}>Code sent to <strong>{phone}</strong></div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.4rem' }}>Verification code</label>
              <input
                style={inp}
                type="text"
                inputMode="numeric"
                placeholder="Enter code"
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && code && handleLogin()}
                autoFocus
              />
            </div>
            <button style={{ ...primaryBtn, opacity: loading || !code ? 0.65 : 1 }} onClick={handleLogin} disabled={loading || !code}>
              {loading ? 'Signing in…' : '✓ Sign In'}
            </button>
            <button style={skipBtn} onClick={() => { setAuthStep(1); setAuthStatus(''); }}>← Change number</button>
          </>
        )}

        {authStatus && (
          <p style={{ margin: 0, padding: '0.6rem 0.9rem', background: '#fffbeb', color: '#92400e', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
            {authStatus}
          </p>
        )}
      </div>

      <p style={{ color: '#b45309', fontSize: '0.8rem', marginTop: '1.5rem', textAlign: 'center', opacity: 0.7 }}>
        🔒 Phone-based login · No password needed
      </p>
    </div>
  );
}

export default LoginPage;

