import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import stallsApi from '../../api/stalls';
import authApi from '../../api/auth';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { card, inp } from '../common/ProfileSections';
import { MergedStallsTab } from '../common/StallsTab';

const TABS = ['User', 'Stalls'];

const actionBtn = {
  background: 'linear-gradient(135deg,#f59e0b,#d97706)',
  color: '#fff', border: 'none', borderRadius: '0.75rem',
  padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
};

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {tabs.map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          style={{
            padding: '0.5rem 1.4rem', borderRadius: '2rem', border: 'none', cursor: 'pointer',
            background: active === t ? '#f59e0b' : '#f3f4f6',
            color: active === t ? '#fff' : '#374151',
            fontWeight: active === t ? 700 : 400, fontSize: '0.95rem',
          }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function UserDashboard() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || localStorage.getItem('cc_defaultTab') || 'User');

  // Profile state
  const [profile, setProfile] = useState({ name: '', phone: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '', birthYear: '0000' });
  const [kids, setKids] = useState([]);
  const [linkedFamily, setLinkedFamily] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [qrPayload, setQrPayload] = useState('');
  const [status, setStatus] = useState('');

  // Edit drawer
  const [kidQrPopup, setKidQrPopup] = useState(null);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editSection, setEditSection] = useState('profile');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPinCurrent, setEditPinCurrent] = useState('');
  const [editPinNew, setEditPinNew] = useState('');
  const [editPinConfirm, setEditPinConfirm] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidLimit, setNewKidLimit] = useState('');
  const [newKidPin, setNewKidPin] = useState('0000');
  const [editingKid, setEditingKid] = useState(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkSuggestions, setLinkSuggestions] = useState([]);
  const [linkSelected, setLinkSelected] = useState(null);
  const [drawerStatus, setDrawerStatus] = useState('');
  const [requestingPinReset, setRequestingPinReset] = useState(false);
  const [emailResetMode, setEmailResetMode] = useState(null);
  const [emailResetCode, setEmailResetCode] = useState('');
  const [emailResetNewPin, setEmailResetNewPin] = useState('');
  const [emailResetConfirm, setEmailResetConfirm] = useState('');
  const [emailResetLoading, setEmailResetLoading] = useState(false);

  const loadProfile = async () => {
    try {
      const [p, b, k, fam, t, qr] = await Promise.all([
        userApi.getProfile(),
        userApi.getBalance(),
        userApi.getKids(),
        userApi.getFamily(),
        userApi.getTransactions(),
        userApi.getQr(),
      ]);
      setProfile(p);
      setBalance(b);
      setKids(k);
      setLinkedFamily(Array.isArray(fam) ? fam : []);
      setTransactions(t);
      setQrPayload(qr.qrPayload);
      if (!searchParams.get('tab') && p.defaultTab && TABS.includes(p.defaultTab)) {
        localStorage.setItem('cc_defaultTab', p.defaultTab);
        setTab(p.defaultTab);
      } else if (p.defaultTab) {
        localStorage.setItem('cc_defaultTab', p.defaultTab);
      }
    } catch { setStatus('Unable to load profile.'); }
  };

  useEffect(() => { loadProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = (t) => { setStatus(''); setTab(t); setSearchParams({ tab: t }, { replace: true }); };

  const tokensSpent = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);

  const clearEmailResetState = () => {
    setEmailResetMode(null);
    setEmailResetCode('');
    setEmailResetNewPin('');
    setEmailResetConfirm('');
  };

  const handleRequestEmailReset = async () => {
    if (!profile.phone) {
      setDrawerStatus('❌ No phone on file.');
      return;
    }
    setEmailResetLoading(true);
    try {
      const res = await authApi.requestPinResetCode(profile.phone);
      setEmailResetMode('enter-code');
      setEmailResetCode('');
      setEmailResetNewPin('');
      setEmailResetConfirm('');
      setDrawerStatus(res.message || '✅ Reset code sent to your email(s).');
    } catch (e) {
      setDrawerStatus(e.response?.data?.error || '❌ Failed to send reset code.');
    } finally {
      setEmailResetLoading(false);
    }
  };

  const handleConfirmEmailReset = async () => {
    if (!/^\d{4}$/.test(emailResetCode)) {
      setDrawerStatus('❌ Enter the 4-digit code from your email.');
      return;
    }
    if (!/^\d{4}$/.test(emailResetNewPin)) {
      setDrawerStatus('❌ New PIN must be 4 digits.');
      return;
    }
    if (emailResetNewPin !== emailResetConfirm) {
      setDrawerStatus('❌ PINs do not match.');
      return;
    }
    setEmailResetLoading(true);
    try {
      await authApi.verifyPinResetCode(profile.phone, emailResetCode, emailResetNewPin);
      await loadProfile();
      setEditPinCurrent('');
      setEditPinNew('');
      setEditPinConfirm('');
      clearEmailResetState();
      setDrawerStatus('✅ PIN updated!');
    } catch (e) {
      setDrawerStatus(e.response?.data?.error || '❌ Failed to reset PIN.');
    } finally {
      setEmailResetLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>

        {/* Welcome */}
        {profile.name ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#92400e', fontSize: '1rem' }}>Welcome, {profile.name}</span>
            {profile.phone && <span style={{ color: '#b45309', fontSize: '0.88rem' }}>{profile.phone}</span>}
          </div>
        ) : null}

        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {/* ── USER TAB ── */}
        {tab === 'User' && (
          <div style={{ display: 'grid', gap: '1rem' }}>

            {/* Edit button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditSection('profile'); setDrawerStatus(''); setShowEditDrawer(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: '0.75rem', padding: '0.45rem 1rem', cursor: 'pointer', fontWeight: 600, color: '#92400e', fontSize: '0.88rem' }}>
                ✏️ Edit Profile &amp; Family
              </button>
            </div>

            {/* Two-column: QR | Order */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>
              <section style={{ ...card, textAlign: 'center', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxSizing: 'border-box' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#92400e' }}>📲 Your QR Code</div>
                <div style={{ fontSize: '0.82rem', color: '#78350f' }}>Show this to stall owners</div>
                {qrPayload && <PrintableQR title="" qrValue={qrPayload} subtitle={profile.name || profile.phone || ''} />}
                <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309', verticalAlign: 'middle' }}>{balance.tokenBalance}</span>
                  {' '}<span style={{ verticalAlign: 'middle' }}>tokens</span>
                </div>
              </section>
              <button
                onClick={() => navigate('/scan')}
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '1.25rem', padding: '1.75rem 1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(245,158,11,0.35)', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>🛒</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Order from a Stall</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 400, opacity: 0.9 }}>Scan a stall's QR to browse &amp; order</span>
              </button>
            </div>

            {/* Family token table */}
            <section style={card}>
              <h3 style={{ margin: '0 0 0.75rem', color: '#92400e' }}>👨‍👩‍👧 Family</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #fed7aa' }}>
                    {['Type','Name','Limit','Spent','Available','QR'].map((h, i) => (
                      <th key={h} style={{ padding: '0.4rem 0.3rem', textAlign: i >= 2 && i < 5 ? 'right' : i === 5 ? 'center' : 'left', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Self */}
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.4rem 0.3rem', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 }}>User</td>
                    <td style={{ padding: '0.4rem 0.3rem', color: '#374151', fontWeight: 600 }}>{profile.name || profile.phone || 'You'}</td>
                    <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#6b7280' }}>—</td>
                    <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{tokensSpent}</td>
                    <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>🪙 {balance.tokenBalance}</td>
                    <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center' }}>
                      <button onClick={() => setKidQrPopup({ name: profile.name || profile.phone || 'You', qrValue: qrPayload, limit: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', padding: '0.1rem' }}>📲</button>
                    </td>
                  </tr>
                  {/* Linked family */}
                  {linkedFamily.map(member => (
                    <tr key={member.userId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.4rem 0.3rem', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 }}>Linked</td>
                      <td style={{ padding: '0.4rem 0.3rem', color: '#374151' }}>{member.name || member.phone}</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#6b7280' }}>—</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{member.tokenSpent}</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>🪙 {member.tokenBalance}</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center' }}>
                        <button onClick={() => setKidQrPopup({ name: member.name || member.phone, qrValue: `CARNIVAL_USER:${member.userId}`, limit: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', padding: '0.1rem' }}>📲</button>
                      </td>
                    </tr>
                  ))}
                  {/* Kids */}
                  {kids.map(kid => (
                    <tr key={kid.kidId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.4rem 0.3rem', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 }}>Kid</td>
                      <td style={{ padding: '0.4rem 0.3rem', color: '#374151', fontWeight: 600 }}>{kid.name}</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#6b7280' }}>{kid.spendingLimit}</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{kid.spent}</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>🪙 {kid.spendingLimit - kid.spent}</td>
                      <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center' }}>
                        <button onClick={() => setKidQrPopup({ name: kid.name, qrValue: `CARNIVAL_KID:${me?.userId}:${kid.kidId}`, limit: kid.spendingLimit })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', padding: '0.1rem' }} title={`QR for ${kid.name}`}>📲</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {tab === 'Stalls' && <MergedStallsTab />}
      </div>

      {/* ── Kid / User QR Popup ── */}
      {kidQrPopup && (
        <div onClick={() => setKidQrPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem 1.5rem', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#92400e', marginBottom: '1rem' }}>👤 {kidQrPopup.name}</div>
            <PrintableQR title={kidQrPopup.name} qrValue={kidQrPopup.qrValue} subtitle={kidQrPopup.limit != null ? `Token limit: ${kidQrPopup.limit}` : kidQrPopup.name} />
            <button onClick={() => setKidQrPopup(null)} style={{ marginTop: '1rem', background: '#f3f4f6', border: 'none', borderRadius: '0.75rem', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Edit Drawer ── */}
      {showEditDrawer && (
        <div onClick={() => setShowEditDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '1.5rem 1.5rem 0 0', width: '100%', maxWidth: '560px', padding: '1.5rem 1.25rem 6rem', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(0,0,0,0.18)', boxSizing: 'border-box' }}>
            <div style={{ width: '2.5rem', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 1.25rem' }} />

            {/* Section tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[['profile','👤 Profile'],['kids','👦 Kids'],['family','🔗 Family']].map(([key, label]) => (
                <button key={key} onClick={() => { setEditSection(key); setDrawerStatus(''); }}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: editSection === key ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#f3f4f6', color: editSection === key ? '#fff' : '#374151' }}>
                  {label}
                </button>
              ))}
            </div>

            {drawerStatus && <p style={{ margin: '0 0 1rem', padding: '0.6rem 1rem', background: '#fffbeb', color: '#92400e', borderRadius: '0.75rem', fontSize: '0.88rem' }}>{drawerStatus}</p>}

            {/* Profile */}
            {editSection === 'profile' && (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* Name */}
                <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>
                  Display Name
                  <input value={editName || profile.name || ''} onChange={e => setEditName(e.target.value)} placeholder="Your name" style={{ ...inp, fontSize: '1rem' }} />
                </label>

                {/* Email */}
                <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>
                  Email Address
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Add email" type="email" style={{ ...inp, fontSize: '1rem', flex: 1 }} />
                    <button
                      onClick={async () => {
                        if (!editEmail.trim()) return;
                        const emails = [...(profile.emails || [])];
                        if (!emails.includes(editEmail.trim())) emails.push(editEmail.trim());
                        try { await userApi.updateProfile({ emails }); await loadProfile(); setEditEmail(''); setDrawerStatus('✅ Email added!'); }
                        catch { setDrawerStatus('❌ Failed to add email.'); }
                      }}
                      style={{ ...actionBtn, padding: '0.65rem 0.9rem', whiteSpace: 'nowrap' }}
                    >+ Add</button>
                  </div>
                </label>
                {(profile.emails || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {profile.emails.map(em => (
                      <div key={em} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '999px', padding: '0.3rem 0.7rem', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {em}
                        <button onClick={async () => {
                          const emails = profile.emails.filter(e => e !== em);
                          try { await userApi.updateProfile({ emails }); await loadProfile(); setDrawerStatus('Email removed.'); }
                          catch { setDrawerStatus('❌ Failed.'); }
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>📱 Phone: <strong>{profile.phone}</strong> &nbsp;(cannot be changed)</div>

                <button onClick={async () => {
                  try { await userApi.updateProfile({ name: editName || profile.name }); await loadProfile(); setDrawerStatus('✅ Name saved!'); }
                  catch { setDrawerStatus('❌ Failed.'); }
                }} style={{ ...actionBtn, padding: '0.75rem', fontSize: '1rem' }}>Save Name</button>

                {/* PIN change */}
                <div style={{ background: '#fffbeb', borderRadius: '0.85rem', padding: '1rem', display: 'grid', gap: '0.65rem', borderTop: '2px solid #fde68a' }}>
                  <div style={{ fontWeight: 700, color: '#78350f', fontSize: '0.92rem' }}>🔐 Change PIN / Password</div>
                  <input
                    type="password" inputMode="numeric" maxLength={4}
                    placeholder="Current PIN" value={editPinCurrent}
                    onChange={e => setEditPinCurrent(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={inp}
                  />
                  <input
                    type="password" inputMode="numeric" maxLength={4}
                    placeholder="New PIN (4 digits)" value={editPinNew}
                    onChange={e => setEditPinNew(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={inp}
                  />
                  <input
                    type="password" inputMode="numeric" maxLength={4}
                    placeholder="Confirm new PIN" value={editPinConfirm}
                    onChange={e => setEditPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{ ...inp, borderColor: editPinConfirm && editPinNew !== editPinConfirm ? '#dc2626' : '#e5e7eb' }}
                  />
                  {editPinConfirm && editPinNew !== editPinConfirm && (
                    <p style={{ margin: 0, color: '#dc2626', fontSize: '0.82rem' }}>PINs do not match</p>
                  )}
                  <button
                    disabled={savingPin || editPinNew.length < 4 || editPinNew !== editPinConfirm}
                    onClick={async () => {
                      if (editPinCurrent !== balance.pin) { setDrawerStatus('❌ Current PIN is incorrect.'); return; }
                      if (editPinNew.length !== 4) { setDrawerStatus('❌ New PIN must be 4 digits.'); return; }
                      setSavingPin(true);
                      try {
                        await userApi.updatePin(editPinNew);
                        await loadProfile();
                        setEditPinCurrent(''); setEditPinNew(''); setEditPinConfirm('');
                        setDrawerStatus('✅ PIN updated!');
                      } catch (e) { setDrawerStatus(e.response?.data?.error || '❌ Failed to update PIN.'); }
                      finally { setSavingPin(false); }
                    }}
                    style={{ ...actionBtn, padding: '0.7rem', opacity: savingPin || editPinNew.length < 4 || editPinNew !== editPinConfirm ? 0.5 : 1 }}
                  >
                    {savingPin ? 'Saving…' : 'Update PIN'}
                  </button>
                  <button
                    onClick={async () => {
                      setRequestingPinReset(true);
                      try {
                        await userApi.requestPinReset();
                        setDrawerStatus('✅ Reset request sent. Admin will reset your PIN to 0000 shortly.');
                      } catch (e) {
                        setDrawerStatus(e.response?.data?.error || '❌ Failed.');
                      } finally { setRequestingPinReset(false); }
                    }}
                    disabled={requestingPinReset}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0 }}
                  >
                    {requestingPinReset ? 'Sending…' : 'Forgot PIN? Request admin reset'}
                  </button>
                  <button
                    onClick={handleRequestEmailReset}
                    disabled={emailResetLoading}
                    style={{ background: 'none', border: 'none', color: '#92400e', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0 }}
                  >
                    {emailResetLoading && emailResetMode !== 'enter-code' ? 'Sending…' : '📧 Reset via email'}
                  </button>
                  {emailResetMode === 'enter-code' && (
                    <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '0.85rem', display: 'grid', gap: '0.55rem', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '0.82rem', color: '#78350f' }}>A 4-digit code was sent to your email(s) on file.</div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="4-digit code"
                        value={emailResetCode}
                        onChange={e => setEmailResetCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        style={inp}
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="New PIN"
                        value={emailResetNewPin}
                        onChange={e => setEmailResetNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        style={inp}
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Confirm new PIN"
                        value={emailResetConfirm}
                        onChange={e => setEmailResetConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        style={{ ...inp, borderColor: emailResetConfirm && emailResetNewPin !== emailResetConfirm ? '#dc2626' : '#e5e7eb' }}
                      />
                      {emailResetConfirm && emailResetNewPin !== emailResetConfirm && (
                        <p style={{ margin: 0, color: '#dc2626', fontSize: '0.82rem' }}>PINs do not match</p>
                      )}
                      <button
                        onClick={handleConfirmEmailReset}
                        disabled={emailResetLoading || emailResetCode.length < 4 || emailResetNewPin.length < 4 || emailResetNewPin !== emailResetConfirm}
                        style={{ ...actionBtn, padding: '0.7rem', opacity: emailResetLoading || emailResetCode.length < 4 || emailResetNewPin.length < 4 || emailResetNewPin !== emailResetConfirm ? 0.5 : 1 }}
                      >
                        {emailResetLoading ? 'Resetting…' : 'Confirm Reset'}
                      </button>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button onClick={handleRequestEmailReset} disabled={emailResetLoading} style={{ background: 'none', border: 'none', color: '#92400e', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0 }}>Resend code</button>
                        <button onClick={clearEmailResetState} disabled={emailResetLoading} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0 }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Kids */}
            {editSection === 'kids' && (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {kids.map(kid => (
                  <div key={kid.kidId} style={{ background: '#f9fafb', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
                    {editingKid?.kidId === kid.kidId ? (
                      <>
                        <input value={editingKid.name} onChange={e => setEditingKid({ ...editingKid, name: e.target.value })} placeholder="Kid's name" style={inp} />
                        <input type="number" value={editingKid.spendingLimit} onChange={e => setEditingKid({ ...editingKid, spendingLimit: e.target.value })} placeholder="Token limit" style={inp} />
                        <input type="password" inputMode="numeric" maxLength={4} value={editingKid.pin || ''} onChange={e => setEditingKid({ ...editingKid, pin: e.target.value.replace(/\D/g,'').slice(0,4) })} placeholder="PIN (4 digits)" style={inp} />
                        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Tip: use birth year, e.g. 2015</div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={async () => {
                            const updates = { name: editingKid.name, spendingLimit: parseInt(editingKid.spendingLimit) };
                            if (editingKid.pin?.length === 4) updates.pin = editingKid.pin;
                            try { await userApi.updateKid(kid.kidId, updates); await loadProfile(); setEditingKid(null); setDrawerStatus('✅ Kid updated!'); } catch { setDrawerStatus('❌ Failed.'); }
                          }} style={{ flex: 1, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingKid(null)} style={{ flex: 1, background: '#e5e7eb', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#374151' }}>👦 {kid.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Limit: {kid.spendingLimit} tokens · PIN: {kid.pin ? '****' : '(none)'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => setEditingKid({ ...kid, pin: '' })} style={{ background: '#fef3c7', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', cursor: 'pointer', fontWeight: 600, color: '#92400e' }}>✏️</button>
                          <button onClick={async () => { if (!window.confirm(`Remove ${kid.name}?`)) return; try { await userApi.deleteKid(kid.kidId); await loadProfile(); setDrawerStatus('Removed.'); } catch { setDrawerStatus('❌ Failed.'); } }}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ background: '#f0fdf4', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.88rem' }}>➕ Add a Kid</div>
                  <input value={newKidName} onChange={e => setNewKidName(e.target.value)} placeholder="Name" style={inp} />
                  <input type="number" value={newKidLimit} onChange={e => setNewKidLimit(e.target.value)} placeholder="Token limit" style={inp} />
                  <input type="password" inputMode="numeric" maxLength={4} value={newKidPin} onChange={e => setNewKidPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="PIN (4 digits, default 0000)" style={inp} />
                  <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Tip: use birth year as PIN, e.g. 2015</div>
                  <button onClick={async () => {
                    if (!newKidName.trim()) return;
                    try { await userApi.createKid({ name: newKidName.trim(), spendingLimit: parseInt(newKidLimit) || 0, pin: newKidPin || '0000' }); await loadProfile(); setNewKidName(''); setNewKidLimit(''); setNewKidPin('0000'); setDrawerStatus('✅ Kid added!'); } catch { setDrawerStatus('❌ Failed.'); }
                  }} style={{ ...actionBtn, padding: '0.65rem' }}>Add Kid</button>
                </div>
              </div>
            )}

            {/* Family */}
            {editSection === 'family' && (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {linkedFamily.map(member => (
                  <div key={member.userId} style={{ background: '#f9fafb', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#374151' }}>👤 {member.name || member.phone}</div>
                      {member.name && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{member.phone}</div>}
                    </div>
                    <button onClick={async () => { if (!window.confirm(`Unlink ${member.name || member.phone}?`)) return; try { await userApi.unlinkFamily(member.userId); await loadProfile(); setDrawerStatus('Unlinked.'); } catch { setDrawerStatus('❌ Failed.'); } }}
                      style={{ background: '#fee2e2', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>Unlink</button>
                  </div>
                ))}
                {linkedFamily.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: 0 }}>No linked family members yet.</p>}

                <div style={{ background: '#eff6ff', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.88rem' }}>🔗 Link a Family Member</div>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={linkSelected ? `${linkSelected.name} (${linkSelected.phone})` : linkQuery}
                      onChange={async e => {
                        const q = e.target.value;
                        setLinkQuery(q);
                        setLinkSelected(null);
                        if (q.length >= 2) {
                          try { const res = await stallsApi.searchUsers(q); setLinkSuggestions(res.filter(u => !u.isKid)); } catch { setLinkSuggestions([]); }
                        } else { setLinkSuggestions([]); }
                      }}
                      placeholder="Type name or phone…"
                      style={{ ...inp, width: '100%', boxSizing: 'border-box' }}
                    />
                    {linkSuggestions.length > 0 && !linkSelected && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.65rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 600, maxHeight: '180px', overflowY: 'auto' }}>
                        {linkSuggestions.map(u => (
                          <div key={u.userId} onClick={() => { setLinkSelected(u); setLinkQuery(''); setLinkSuggestions([]); }}
                            style={{ padding: '0.6rem 0.9rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '0.88rem' }}
                            onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                            onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                            <span style={{ fontWeight: 600 }}>👤 {u.name}</span>
                            <span style={{ color: '#9ca3af', marginLeft: '0.5rem' }}>{u.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {linkSelected && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#dbeafe', borderRadius: '0.65rem', padding: '0.4rem 0.75rem' }}>
                      <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 600 }}>✅ {linkSelected.name} · {linkSelected.phone}</span>
                      <button onClick={() => { setLinkSelected(null); setLinkQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1rem' }}>✕</button>
                    </div>
                  )}
                  <button onClick={async () => {
                    const phone = linkSelected?.phone;
                    if (!phone) return;
                    try { await userApi.linkFamily(phone); await loadProfile(); setLinkSelected(null); setLinkQuery(''); setDrawerStatus('✅ Family member linked!'); }
                    catch { setDrawerStatus('❌ Not found or already linked.'); }
                  }} style={{ ...actionBtn, padding: '0.65rem' }}>Link</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default UserDashboard;
