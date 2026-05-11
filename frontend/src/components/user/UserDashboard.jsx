import { useEffect, useState } from 'react';

import adminApi from '../../api/admin';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';

/* ── brand colours ── */
const SOCIAL_META = {
  gmail:     { label: 'Gmail',     color: '#EA4335', bg: '#fde8e7', icon: 'G' },
  yahoo:     { label: 'Yahoo',     color: '#6001D2', bg: '#ede7f6', icon: 'Y!' },
  instagram: { label: 'Instagram', color: '#E1306C', bg: '#fce4ec', icon: '📷' },
  facebook:  { label: 'Facebook',  color: '#1877F2', bg: '#e3f0fd', icon: 'f' },
};

const card = {
  background: '#fff',
  border: '1px solid #fed7aa',
  borderRadius: '1rem',
  padding: '1.25rem',
  display: 'grid',
  gap: '0.85rem',
};

const input = {
  padding: '0.8rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid #d1d5db',
  width: '100%',
  boxSizing: 'border-box',
};

const TABS = ['Profile', 'Edit', 'Kids', 'History'];

function SocialBadge({ platform, handle }) {
  const meta = SOCIAL_META[platform];
  if (!meta || !handle) return null;
  return (
    <a
      href={platform === 'instagram'
        ? `https://instagram.com/${handle}`
        : platform === 'facebook'
        ? `https://facebook.com/${handle}`
        : `mailto:${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        background: meta.bg, color: meta.color,
        borderRadius: '2rem', padding: '0.35rem 0.85rem',
        fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
      }}
    >
      <span style={{ fontWeight: 900 }}>{meta.icon}</span>
      {handle}
    </a>
  );
}

function UserDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  const [tab, setTab] = useState('Profile');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '' });
  const [kids, setKids] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [editForm, setEditForm] = useState({ name: '', socials: { gmail: '', yahoo: '', instagram: '', facebook: '' } });
  const [kidForm, setKidForm] = useState({ name: '', spendingLimit: 25 });
  const [tokenForm, setTokenForm] = useState({ dollars: '' });
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('');

  const load = async () => {
    const [p, b, k, t] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getKids(),
      userApi.getTransactions(),
    ]);
    setProfile(p);
    setBalance(b);
    setKids(k);
    setTransactions(t);
    setEditForm({ name: p.name || '', socials: { gmail: '', yahoo: '', instagram: '', facebook: '', ...(p.socials || {}) } });
    if (isAdmin) {
      try { const ev = await adminApi.getEvent(); setEvent(ev); } catch (_) {}
    }
  };

  useEffect(() => { load().catch(() => setStatus('Unable to load dashboard.')); }, []);

  const saveProfile = async () => {
    try {
      const updated = await userApi.updateProfile({ name: editForm.name, socials: editForm.socials });
      setProfile(updated);
      setStatus('Profile updated.');
      setTab('Profile');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to update profile.'); }
  };

  const addKid = async () => {
    try {
      await userApi.createKid(kidForm);
      setKidForm({ name: '', spendingLimit: 25 });
      await load();
      setStatus('Kid added.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to add kid.'); }
  };

  const deleteKid = async (kidId) => {
    try { await userApi.deleteKid(kidId); await load(); setStatus('Kid removed.'); }
    catch (e) { setStatus(e.response?.data?.error || 'Unable to remove kid.'); }
  };

  const loadTokens = async () => {
    const dollars = parseFloat(tokenForm.dollars);
    if (!dollars || dollars <= 0) { setStatus('Enter a valid dollar amount.'); return; }
    const rate = event?.tokenRate || 10;
    const tokens = Math.floor(dollars * rate);
    try {
      await adminApi.addTokens({ phone: profile.phone, amount: tokens });
      await load();
      setTokenForm({ dollars: '' });
      setStatus(`✅ Loaded ${tokens} tokens ($${dollars} × ${rate} rate).`);
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to load tokens.'); }
  };

  const tokenPreview = () => {
    const d = parseFloat(tokenForm.dollars);
    if (!d || d <= 0) return null;
    return Math.floor(d * (event?.tokenRate || 10));
  };

  const socials = profile.socials || {};
  const hasSocials = Object.values(socials).some(Boolean);

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Balance banner */}
        <section style={{ ...card, textAlign: 'center', background: 'linear-gradient(135deg,#fffbeb,#fed7aa)' }}>
          <div style={{ fontSize: '0.85rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Token Balance</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#b45309' }}>{balance.tokenBalance}</div>
          <div style={{ fontSize: '1rem', color: '#78350f' }}>PIN: <strong>{balance.pin}</strong></div>
        </section>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} type="button" onClick={() => { setStatus(''); setTab(t); }}
              style={{
                padding: '0.5rem 1.1rem', borderRadius: '2rem', border: 'none', cursor: 'pointer',
                background: tab === t ? '#f59e0b' : '#f3f4f6',
                color: tab === t ? '#fff' : '#374151',
                fontWeight: tab === t ? 700 : 400,
              }}>
              {t}
            </button>
          ))}
        </div>

        {status ? <p style={{ margin: 0, color: '#92400e' }}>{status}</p> : null}

        {/* ── PROFILE VIEW ── */}
        {tab === 'Profile' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>👤 {profile.name || profile.phone}</h2>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>📱 {profile.phone}</div>
            {profile.name ? <div><strong>Name:</strong> {profile.name}</div> : null}

            {hasSocials && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                {Object.entries(socials).map(([k, v]) => v ? <SocialBadge key={k} platform={k} handle={v} /> : null)}
              </div>
            )}

            {isAdmin && (
              <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.85rem', display: 'grid', gap: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#b45309' }}>🪙 Load Tokens (Admin)</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Rate: {event?.tokenRate ?? '…'} tokens / $1
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.1rem' }}>$</span>
                  <input
                    type="number" min="1" step="1"
                    style={{ ...input, maxWidth: '120px' }}
                    placeholder="Dollars"
                    value={tokenForm.dollars}
                    onChange={e => setTokenForm({ dollars: e.target.value })}
                  />
                  {tokenPreview() != null && (
                    <span style={{ color: '#b45309', fontWeight: 700 }}>= {tokenPreview()} tokens</span>
                  )}
                </div>
                <button type="button" onClick={loadTokens}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>
                  Add Tokens
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── EDIT PROFILE ── */}
        {tab === 'Edit' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>✏️ Edit Profile</h2>
            <label style={{ fontWeight: 600 }}>Name</label>
            <input style={input} value={editForm.name} placeholder="Your name"
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />

            <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>Social Handles</div>
            {Object.keys(SOCIAL_META).map(platform => {
              const meta = SOCIAL_META[platform];
              return (
                <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    minWidth: '2.2rem', textAlign: 'center', fontWeight: 900,
                    background: meta.bg, color: meta.color,
                    borderRadius: '0.5rem', padding: '0.3rem 0.5rem',
                  }}>{meta.icon}</span>
                  <input style={{ ...input }} placeholder={meta.label}
                    value={editForm.socials[platform] || ''}
                    onChange={e => setEditForm(f => ({ ...f, socials: { ...f.socials, [platform]: e.target.value } }))}
                  />
                </div>
              );
            })}

            <button type="button" onClick={saveProfile}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              Save Profile
            </button>
          </section>
        )}

        {/* ── KIDS ── */}
        {tab === 'Kids' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>🎪 Kid Tokens</h2>
            <input style={input} value={kidForm.name} placeholder="Kid name"
              onChange={e => setKidForm(f => ({ ...f, name: e.target.value }))} />
            <input style={input} type="number" value={kidForm.spendingLimit} placeholder="Spending limit (tokens)"
              onChange={e => setKidForm(f => ({ ...f, spendingLimit: Number(e.target.value) }))} />
            <button type="button" onClick={addKid}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
              + Add Kid
            </button>
            {kids.map(kid => (
              <div key={kid.kidId} style={{ background: '#fffbeb', borderRadius: '1rem', padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{kid.name}</strong>
                  <button type="button" onClick={() => deleteKid(kid.kidId)}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.7rem', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  Limit: {kid.spendingLimit} tokens &nbsp;·&nbsp; Spent: {kid.spent}
                </div>
                <PrintableQR
                  title={`${kid.name}'s Wristband`}
                  qrValue={`CARNIVAL_KID:${profile.userId}:${kid.kidId}`}
                  subtitle={`Limit ${kid.spendingLimit} tokens`}
                />
              </div>
            ))}
          </section>
        )}

        {/* ── HISTORY ── */}
        {tab === 'History' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>📜 Transaction History</h2>
            {transactions.length === 0 && <p style={{ color: '#6b7280' }}>No transactions yet.</p>}
            {transactions.map(tx => (
              <div key={`${tx.txId}-${tx.itemId}`}
                style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.9rem' }}>
                <div style={{ fontWeight: 700 }}>{tx.itemName} × {tx.qty}</div>
                <div style={{ color: '#6b7280' }}>at {tx.vendorName} · <strong style={{ color: '#b45309' }}>{tx.amount} tokens</strong></div>
                {tx.kidName && <div style={{ color: '#7c3aed', fontSize: '0.8rem' }}>👦 {tx.kidName}</div>}
                <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{tx.timestamp}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </Layout>
  );
}

export default UserDashboard;
