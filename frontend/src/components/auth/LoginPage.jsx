import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import authApi from '../../api/auth';
import api from '../../api/index';
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

  const [phone, setPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [authStep, setAuthStep] = useState(1); // 1=phone, 2=pin (existing users only)
  const [authStatus, setAuthStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExisting, setIsExisting] = useState(null);
  const [resetMode, setResetMode] = useState(null);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [onboarding, setOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [name, setName] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');
  const [kids, setKids] = useState([]);
  const [newKid, setNewKid] = useState({ name: '', limit: '', kidPin: '0000' });
  const [pin, setPin] = useState('0000');
  const [confirmPin, setConfirmPin] = useState('0000');
  const [saving, setSaving] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState('');
  const [confirmSkipKids, setConfirmSkipKids] = useState(false);

  const pinMismatch = confirmPin.length > 0 && pin !== confirmPin;

  const handlePhoneChange = async (val) => {
    setPhone(val);
    setIsExisting(null);
    setResetMode(null);
    setResetCode('');
    setResetNewPin('');
    setResetConfirmPin('');
    setResetStatus('');
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 10) {
      try {
        const res = await api.get('/api/auth/check-phone', { params: { phone: digits } });
        setIsExisting(res.data.exists);
      } catch { /* ignore */ }
    }
  };

  const handleContinue = async () => {
    if (isExisting) {
      // Existing user — show PIN step
      setAuthStep(2);
      setAuthStatus('');
    } else {
      // New user — create account & go to onboarding
      setLoading(true);
      setAuthStatus('');
      try {
        const res = await authApi.loginWithPin(phone.replace(/\D/g, ''), '');
        login(res.token, res.user);
        setLoggedInUser(res.user);
        setOnboarding(true);
      } catch (err) {
        setAuthStatus(err.response?.data?.error || 'Unable to sign up. Try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLoginWithPin = async () => {
    setLoading(true);
    setAuthStatus('');
    try {
      const res = await authApi.loginWithPin(phone.replace(/\D/g, ''), loginPin);
      login(res.token, res.user);
      if (res.user?.isNew) {
        setLoggedInUser(res.user);
        setOnboarding(true);
      } else {
        navigate(getLandingRoute(res.user), { replace: true });
      }
    } catch (err) {
      setAuthStatus(err.response?.data?.error || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const clearResetState = () => {
    setResetMode(null);
    setResetCode('');
    setResetNewPin('');
    setResetConfirmPin('');
    setResetStatus('');
  };

  const handleRequestPinResetCode = async () => {
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone) {
      setResetStatus('Phone required.');
      return;
    }
    setResetLoading(true);
    setResetStatus('');
    try {
      const res = await authApi.requestPinResetCode(normalizedPhone);
      setResetMode('enter-code');
      setResetCode('');
      setResetNewPin('');
      setResetConfirmPin('');
      setResetStatus(res.message || 'A 4-digit code was sent to your email(s) on file.');
    } catch (err) {
      setResetStatus(err.response?.data?.error || 'Unable to send reset code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyPinResetCode = async () => {
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!/^\d{4}$/.test(resetCode)) {
      setResetStatus('Enter the 4-digit code from your email.');
      return;
    }
    if (!/^\d{4}$/.test(resetNewPin)) {
      setResetStatus('New PIN must be exactly 4 digits.');
      return;
    }
    if (resetNewPin !== resetConfirmPin) {
      setResetStatus('PINs do not match.');
      return;
    }
    setResetLoading(true);
    setResetStatus('');
    try {
      await authApi.verifyPinResetCode(normalizedPhone, resetCode, resetNewPin);
      setLoginPin('');
      clearResetState();
      setAuthStatus('✅ PIN updated! Please sign in.');
    } catch (err) {
      setResetStatus(err.response?.data?.error || 'Unable to reset PIN.');
    } finally {
      setResetLoading(false);
    }
  };

  const nextOnboard = () => {
    if (onboardStep < 4) {
      setOnboardStep(s => s + 1);
      setOnboardStatus('');
    } else {
      navigate(getLandingRoute(loggedInUser), { replace: true });
    }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
      setOnboardStatus('PIN must be 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setOnboardStatus('PINs do not match.');
      return;
    }
    setSaving(true);
    try {
      await userApi.updatePin(pin);
      nextOnboard();
    } catch (e) {
      setOnboardStatus(e.response?.data?.error || 'Failed to save PIN.');
    } finally {
      setSaving(false);
    }
  };

  const saveName = async () => {
    if (!name.trim()) {
      setOnboardStatus('Please enter your name to continue.');
      return;
    }
    setSaving(true);
    try {
      await userApi.updateProfile({ name: name.trim() });
    } catch {}
    finally { setSaving(false); }
    nextOnboard();
  };

  const addKid = async () => {
    if (!newKid.name.trim()) return;
    if (!/^\d{4}$/.test(newKid.kidPin || '0000')) {
      setOnboardStatus('Kid PIN must be 4 digits.');
      return;
    }
    setSaving(true);
    try {
      const created = await userApi.createKid({
        name: newKid.name.trim(),
        spendingLimit: newKid.limit ? Number(newKid.limit) : null,
        pin: newKid.kidPin || '0000',
      });
      setKids(prev => [...prev, created]);
      setNewKid({ name: '', limit: '', kidPin: '0000' });
      setOnboardStatus('');
      setConfirmSkipKids(false);
    } catch (e) {
      setOnboardStatus(e.response?.data?.error || 'Failed to add kid.');
    } finally { setSaving(false); }
  };

  const handleKidsContinue = () => {
    if (kids.length > 0) {
      nextOnboard();
      return;
    }
    setConfirmSkipKids(true);
  };

  const saveEmail = async () => {
    const email = onboardEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOnboardStatus('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      await userApi.updateProfile({ emails: [email] });
      setOnboardStep(s => s + 1);
      setOnboardStatus('');
    } catch (e) {
      setOnboardStatus(e.response?.data?.error || 'Failed to save email.');
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = () => navigate(getLandingRoute(loggedInUser), { replace: true });

  if (onboarding) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🎡</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: DEEP }}>CarnivalCash</div>
          <div style={{ color: '#111827', fontSize: '0.7rem', marginTop: '0.2rem' }}>Designed by Harshan &amp; Kishore</div>
        </div>
        <div style={card}>
          <ProgressDots current={onboardStep} total={5} />

          {onboardStep === 0 && (
            <>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: DEEP }}>🔐 Set your PIN / Password</div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.25rem' }}>4 digits · Used for all payments · Default is 0000 · If forgotten, request a reset from admin</div>
              </div>
              <input
                autoFocus
                style={inp}
                inputMode="numeric"
                maxLength={4}
                placeholder="e.g. 0000"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <input
                style={inp}
                inputMode="numeric"
                maxLength={4}
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && savePin()}
              />
              {pinMismatch && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>PINs do not match.</p>}
              <button style={primaryBtn} onClick={savePin} disabled={saving}>
                {saving ? 'Saving…' : 'Continue →'}
              </button>
            </>
          )}

          {onboardStep === 1 && (
            <>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: DEEP }}>👋 What's your name?</div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.25rem' }}>Required — this is how others find you and stalls identify you.</div>
              </div>
              <input
                autoFocus
                style={{ ...inp, borderColor: onboardStatus && !name.trim() ? '#dc2626' : '#e5e7eb' }}
                placeholder="Your name"
                value={name}
                onChange={e => { setName(e.target.value); setOnboardStatus(''); }}
                onKeyDown={e => e.key === 'Enter' && saveName()}
              />
              {onboardStatus && !name.trim() && (
                <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{onboardStatus}</p>
              )}
              <button style={primaryBtn} onClick={saveName} disabled={saving}>
                {saving ? 'Saving…' : 'Continue →'}
              </button>
            </>
          )}

          {onboardStep === 2 && (
            <>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: DEEP }}>📧 Add your email</div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.25rem' }}>Required — used to send PIN reset codes if you ever forget your PIN.</div>
              </div>
              <input
                autoFocus
                type="email"
                inputMode="email"
                style={{ ...inp, borderColor: onboardStatus ? '#dc2626' : '#e5e7eb' }}
                placeholder="you@example.com"
                value={onboardEmail}
                onChange={e => { setOnboardEmail(e.target.value); setOnboardStatus(''); }}
                onKeyDown={e => e.key === 'Enter' && saveEmail()}
              />
              {onboardStatus && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{onboardStatus}</p>}
              <button style={primaryBtn} onClick={saveEmail} disabled={saving}>
                {saving ? 'Saving…' : 'Continue →'}
              </button>
            </>
          )}

          {onboardStep === 3 && (
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
                <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>Tip: use their birth year as PIN, e.g. 2015</div>
                <input style={inp} placeholder="Kid PIN" inputMode="numeric" maxLength={4} value={newKid.kidPin} onChange={e => setNewKid(n => ({ ...n, kidPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                <button style={{ ...primaryBtn, background: '#f3f4f6', color: '#374151', boxShadow: 'none' }} onClick={addKid} disabled={saving || !newKid.name.trim()}>
                  {saving ? 'Adding…' : '+ Add Kid'}
                </button>
              </div>
              {confirmSkipKids && kids.length === 0 && (
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '0.85rem', padding: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                  <div style={{ color: '#92400e', fontSize: '0.88rem', fontWeight: 600 }}>⚠️ Are you sure you want to skip adding kids? You can add them later from your profile.</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ ...primaryBtn, margin: 0 }} onClick={() => { setConfirmSkipKids(false); nextOnboard(); }}>Yes, skip</button>
                    <button style={{ ...primaryBtn, margin: 0, background: '#f3f4f6', color: '#374151', boxShadow: 'none' }} onClick={() => setConfirmSkipKids(false)}>Add a kid</button>
                  </div>
                </div>
              )}
              <button style={primaryBtn} onClick={handleKidsContinue}>{kids.length > 0 ? 'Done, Continue →' : 'Continue →'}</button>
              <button style={skipBtn} onClick={() => setConfirmSkipKids(true)}>Skip for now</button>
            </>
          )}

          {onboardStep === 4 && (
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
                  ['🔗', 'Link family', 'Connect with a partner from your profile page after sign-in.'],
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

          {onboardStatus && (
            <p style={{ margin: 0, padding: '0.6rem 0.9rem', background: '#fffbeb', color: '#92400e', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
              {onboardStatus}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>🎡</div>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: DEEP, marginTop: '0.4rem', letterSpacing: '-0.5px' }}>CarnivalCash</div>
        <div style={{ color: '#92400e', fontSize: '0.92rem', marginTop: '0.3rem', opacity: 0.8 }}>Your digital token wallet for the carnival</div>
        <div style={{ color: '#111827', fontSize: '0.7rem', marginTop: '0.4rem' }}>Designed by Harshan &amp; Kishore</div>
      </div>

      <div style={card}>
        {authStep === 1 ? (
          <>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: DEEP }}>
                {isExisting === false ? '👋 Sign Up' : isExisting === true ? '👋 Welcome back!' : 'Sign In / Sign Up'}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.2rem' }}>Enter your phone number to get started</div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.4rem' }}>Phone number</label>
              <input
                style={inp}
                type="tel"
                placeholder="e.g. 7327184414"
                value={phone}
                onChange={e => handlePhoneChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && phone && handleContinue()}
                autoFocus
              />
            </div>
            <button style={{ ...primaryBtn, opacity: loading || !phone ? 0.65 : 1 }} onClick={handleContinue} disabled={loading || !phone}>
              {loading ? 'Please wait…' : isExisting === false ? '✨ Sign Up →' : isExisting === true ? '→ Sign In' : 'Continue →'}
            </button>
          </>
        ) : resetMode ? (
          <>
            {resetMode === 'choose' ? (
              <>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: DEEP }}>🔐 Reset your PIN</div>
                  <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.2rem' }}>Choose how you want to reset the PIN for <strong>{phone}</strong>.</div>
                </div>
                <button style={primaryBtn} onClick={handleRequestPinResetCode} disabled={resetLoading}>
                  {resetLoading ? 'Sending…' : '📧 Send code to my email'}
                </button>
                <button
                  style={{ ...primaryBtn, background: '#f3f4f6', color: '#374151', boxShadow: 'none' }}
                  onClick={async () => {
                    setResetLoading(true);
                    setResetStatus('');
                    try {
                      await userApi.requestPinReset();
                      clearResetState();
                      setAuthStatus('✅ Reset request sent. Admin will reset your PIN to 0000 shortly.');
                    } catch (err) {
                      setResetStatus(err.response?.data?.error || 'Unable to request admin reset.');
                    } finally {
                      setResetLoading(false);
                    }
                  }}
                  disabled={resetLoading}
                >
                  Ask admin to reset PIN
                </button>
                <button style={skipBtn} onClick={() => { clearResetState(); setAuthStatus(''); }}>← Back</button>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: DEEP }}>📧 Enter your reset code</div>
                  <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.2rem' }}>A 4-digit code was sent to your email(s) on file.</div>
                </div>
                <input
                  style={inp}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4-digit code"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  autoFocus
                />
                <input
                  style={inp}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="New PIN"
                  value={resetNewPin}
                  onChange={e => setResetNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <input
                  style={{ ...inp, borderColor: resetConfirmPin && resetNewPin !== resetConfirmPin ? '#dc2626' : '#e5e7eb' }}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Confirm new PIN"
                  value={resetConfirmPin}
                  onChange={e => setResetConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && !resetLoading && handleVerifyPinResetCode()}
                />
                {resetConfirmPin && resetNewPin !== resetConfirmPin && (
                  <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>PINs do not match.</p>
                )}
                <button
                  style={{ ...primaryBtn, opacity: resetLoading || resetCode.length < 4 || resetNewPin.length < 4 || resetNewPin !== resetConfirmPin ? 0.65 : 1 }}
                  onClick={handleVerifyPinResetCode}
                  disabled={resetLoading || resetCode.length < 4 || resetNewPin.length < 4 || resetNewPin !== resetConfirmPin}
                >
                  {resetLoading ? 'Resetting…' : 'Reset PIN'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button style={{ ...skipBtn, alignSelf: 'auto' }} onClick={handleRequestPinResetCode} disabled={resetLoading}>Resend code</button>
                  <button style={{ ...skipBtn, alignSelf: 'auto' }} onClick={() => { setResetMode('choose'); setResetStatus(''); }}>← Back</button>
                </div>
              </>
            )}
            {resetStatus && (
              <p style={{ margin: 0, padding: '0.6rem 0.9rem', background: '#fffbeb', color: '#92400e', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
                {resetStatus}
              </p>
            )}
          </>
        ) : (
          <>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: DEEP }}>🔐 Enter your PIN</div>
              <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                Signing in as <strong>{phone}</strong>
              </div>
            </div>
            <input
              style={inp}
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Your 4-digit PIN"
              value={loginPin}
              onChange={e => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && !loading && loginPin.length === 4 && handleLoginWithPin()}
              autoFocus
            />
            <button style={{ ...primaryBtn, opacity: loading || loginPin.length < 4 ? 0.65 : 1 }} onClick={handleLoginWithPin} disabled={loading || loginPin.length < 4}>
              {loading ? 'Signing in…' : '✓ Sign In'}
            </button>
            <button style={skipBtn} onClick={() => { setAuthStep(1); setAuthStatus(''); setLoginPin(''); clearResetState(); }}>← Change number</button>
            <button
              style={{ ...skipBtn, color: '#92400e' }}
              onClick={() => { setResetMode('choose'); setResetStatus(''); setAuthStatus(''); }}
            >
              Forgot PIN?
            </button>
          </>
        )}

        {authStatus && (
          <p style={{ margin: 0, padding: '0.6rem 0.9rem', background: '#fffbeb', color: '#92400e', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
            {authStatus}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
