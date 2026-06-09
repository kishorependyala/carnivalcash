import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import statsApi from '../../api/stats';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { usePolling } from '../../hooks/usePolling';
import { ProfileTab } from './ProfileSections';

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  zIndex: 200,
};

const card = {
  background: '#fffbeb',
  border: '1px solid #fed7aa',
  borderRadius: '0.85rem',
  padding: '0.9rem 1rem',
};

function StatsPanel() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    statsApi.get().then(setStats).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stats) {
    return <p style={{ color: '#6b7280' }}>Loading…</p>;
  }

  const stat = (label, value, icon) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309' }}>
        {icon} {value}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ margin: 0 }}>📊 Event Stats</h2>
      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {stat('Users', stats.totalUsers, '👥')}
        {stat('Stalls', stats.totalStalls, '🏪')}
        {stat('Transactions', stats.totalTransactions, '🔄')}
      </div>
      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {stat('In Circulation', stats.tokensInCirculation, '🪙')}
        {stat('Stall Total', stats.stallTokensEarned, '💰')}
        {stat('To Charities', stats.charityTokensDonated, '💝')}
      </div>
      {stats.topStalls?.length > 0 ? (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🏆 Top Stalls</div>
          {stats.topStalls.map((stall, index) => (
            <div
              key={`${stall.name}-${index}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.9rem' }}
            >
              <span>
                {index + 1}. {stall.name}
              </span>
              <span style={{ fontWeight: 700, color: '#b45309' }}>🪙 {stall.tokens}</span>
            </div>
          ))}
        </div>
      ) : null}
      {stats.topCharities?.length > 0 ? (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>💚 Charity Leaders</div>
          {stats.topCharities.map((charity, index) => (
            <div
              key={`${charity.name}-${index}`}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.9rem' }}
            >
              <span>
                {index + 1}. {charity.name}
              </span>
              <span style={{ fontWeight: 700, color: '#059669' }}>🪙 {charity.tokens}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TokensPanel() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [txns, setTxns] = useState([]);

  useEffect(() => {
    userApi.getBalance().then(setBalance).catch(() => {});
    userApi
      .getTransactions()
      .then((transactions) => setTxns(transactions.slice(0, 15)))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ margin: 0 }}>🪙 My Tokens</h2>
      <div
        style={{
          background: 'linear-gradient(135deg,#fffbeb,#fed7aa)',
          borderRadius: '0.85rem',
          padding: '1.1rem',
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Balance</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#b45309' }}>{balance?.tokenBalance ?? '…'}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>PIN</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#78350f' }}>{balance?.pin ?? '0000'}</div>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>📱 {user?.phone}</div>
      </div>
      <div style={{ fontWeight: 700 }}>Recent Transactions</div>
      {txns.length === 0 ? <p style={{ color: '#6b7280', margin: 0 }}>No transactions yet.</p> : null}
      {txns.map((tx, index) => (
        <div key={tx.txId || `${tx.timestamp || 'tx'}-${index}`} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tx.itemName || tx.description || 'Transaction'}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{tx.timestamp?.slice(0, 16).replace('T', ' ')}</div>
          </div>
          <div style={{ fontWeight: 800, color: '#dc2626' }}>−🪙 {tx.amount || tx.qty}</div>
        </div>
      ))}
    </div>
  );
}

function ProfilePanel({ onClose }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(null);
  const [kids, setKids] = useState([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      const [p, b, k] = await Promise.all([
        userApi.getProfile(),
        userApi.getBalance(),
        userApi.getKids().catch(() => []),
      ]);
      setProfile(p);
      setBalance(b);
      setKids(k);
    } catch {
      setStatus('Unable to load profile.');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = user?.roles?.includes('admin');
  const isVendor = user?.roles?.includes('vendor');
  const tabs = isAdmin
    ? ['User', 'Stalls', 'Admin']
    : isVendor
    ? ['Stalls', 'Browse', 'Profile', 'History']
    : ['User', 'Stalls'];
  const tabLabels = isAdmin
    ? { User: 'Admin & Users', Stalls: 'Admin & Stalls', Admin: 'Admin & Admin settings' }
    : isVendor
    ? { Stalls: 'Vendor & Stalls', Browse: 'Vendor & Browse', Profile: 'Vendor & Profile', History: 'Vendor & History' }
    : { User: 'My profile', Stalls: 'Stalls' };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ margin: 0 }}>👤 Profile</h2>
      {status ? <p style={{ color: '#dc2626', margin: 0 }}>{status}</p> : null}
      {!profile ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <ProfileTab
          profile={profile}
          balance={balance}
          event={null}
          isAdmin={isAdmin}
          setStatus={setStatus}
          onReload={load}
          kids={kids}
          setProfile={setProfile}
          tabs={tabs}
          tabLabels={tabLabels}
        />
      )}
    </div>
  );
}

function BottomNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [panel, setPanel] = useState(null);

  if (!user) {
    return null;
  }

  const toggle = (name) => setPanel((current) => (current === name ? null : name));

  const navBtn = (name, icon, label) => (
    <button
      key={name}
      type="button"
      onClick={() => toggle(name)}
      style={{
        background: 'none',
        border: 'none',
        padding: '0.75rem 0.5rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.15rem',
        color: panel === name ? '#d97706' : '#6b7280',
        fontWeight: panel === name ? 700 : 500,
        fontSize: '0.82rem',
        transition: 'color 0.15s',
      }}
    >
      <span style={{ fontSize: '1.3rem' }}>{icon}</span>
      {label}
    </button>
  );

  const navLink = (path, icon, label) => {
    const active = location.pathname === path;
    return (
      <button
        key={path}
        type="button"
        onClick={() => { setPanel(null); navigate(path); }}
        style={{
          background: 'none',
          border: 'none',
          padding: '0.75rem 0.5rem',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.15rem',
          color: active ? '#d97706' : '#6b7280',
          fontWeight: active ? 700 : 500,
          fontSize: '0.82rem',
          transition: 'color 0.15s',
        }}
      >
        <span style={{ fontSize: '1.3rem' }}>{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <>
      {panel ? (
        <div role="presentation" style={backdropStyle} onClick={() => setPanel(null)}>
          <div role="dialog" aria-modal="true" className="cc-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPanel(null)}
              style={{ position: 'absolute', top: '0.75rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af' }}
            >
              ✕
            </button>
            {panel === 'stats' ? <StatsPanel /> : null}
            {panel === 'tokens' ? <TokensPanel /> : null}
          </div>
        </div>
      ) : null}
      <nav className="cc-bottom-bar">
        <div className="cc-bar-inner">
          {navBtn('stats', '📊', 'Stats')}
          {navBtn('tokens', '🪙', 'Tokens')}
          {navLink('/donations', '💝', 'Donations')}
        </div>
      </nav>
    </>
  );
}

// Countdown timer — ticks every second, resets on each poll cycle
function RefreshTimer({ intervalSec = 15 }) {
  const [secs, setSecs] = useState(intervalSec);
  const secsRef = useRef(intervalSec);

  // reset whenever a poll fires
  usePolling(() => { secsRef.current = intervalSec; setSecs(intervalSec); }, intervalSec * 1000);

  useEffect(() => {
    const id = setInterval(() => {
      secsRef.current = Math.max(0, secsRef.current - 1);
      setSecs(secsRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pct = secs / intervalSec;
  const r = 9;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div title={`Refreshes in ${secs}s`} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: 0.85 }}>
      <svg width="26" height="26" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="13" cy="13" r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
        <circle cx="13" cy="13" r={r} fill="none" stroke="#fff" strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.9s linear' }} />
      </svg>
      <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 600, minWidth: '1.5rem' }}>{secs}s</span>
    </div>
  );
}

// Root dashboard paths — no back button shown here
const ROOT_PATHS = ['/user', '/vendor', '/admin', '/'];

function Layout({ children }) {
  const { user, logout, login } = useAuth();
  const { pollIntervalSec, appEnv, appRegion } = useSettings();
  const envLabel = appEnv && appRegion ? `${appRegion} · ${appEnv}` : null;
  const navigate = useNavigate();
  const location = useLocation();
  const isSubPage = !ROOT_PATHS.includes(location.pathname);
  const [profileOpen, setProfileOpen] = useState(false);

  // ── Impersonation ──────────────────────────────────────────────────────────
  const isImpersonating = !!sessionStorage.getItem('adminToken');

  const handleRestoreAdmin = () => {
    const adminToken = sessionStorage.getItem('adminToken');
    if (!adminToken) return;
    const adminUserRaw = sessionStorage.getItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    login(adminToken, adminUserRaw ? JSON.parse(adminUserRaw) : null);
    navigate('/admin');
  };
  // ──────────────────────────────────────────────────────────────────────────

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      if (user?.roles?.includes('admin')) navigate('/admin');
      else if (user?.roles?.includes('vendor')) navigate('/vendor');
      else navigate('/user');
    }
  };

  return (
    <div className="cc-shell">
      <header className="cc-header">
        {/* Impersonation banner — shown on every page when admin is viewing as another user */}
        {isImpersonating && (
          <div style={{ background: '#f59e0b', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1rem' }}>🎭</span>
            <span style={{ fontWeight: 700, color: '#78350f', fontSize: '0.88rem', flex: 1 }}>
              Viewing as <strong>{user?.name || user?.phone}</strong>
            </span>
            <button
              onClick={handleRestoreAdmin}
              style={{ padding: '0.3rem 0.9rem', borderRadius: '0.65rem', border: '2px solid #78350f', cursor: 'pointer', fontWeight: 800, background: '#fff', color: '#78350f', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              ⬅ Return to Admin
            </button>
          </div>
        )}
        <div className="cc-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isSubPage && (
              <button
                type="button"
                onClick={goBack}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '999px', padding: '0.45rem 0.9rem', fontWeight: 700, color: '#fff', cursor: 'pointer', fontSize: '1rem' }}
                aria-label="Go back"
              >
                ← Back
              </button>
            )}
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>🎪 CarnivalCash</div>
              <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                {user ? '' : 'Carnival donations made easy'}
              </div>
              {envLabel && (
                <div style={{ fontSize: '0.65rem', opacity: 0.75, letterSpacing: '0.03em', marginTop: '1px' }}>
                  {envLabel}
                </div>
              )}
            </div>
          </div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <RefreshTimer intervalSec={pollIntervalSec} />
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                style={{ border: 0, borderRadius: '999px', padding: '0.65rem 1rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}
              >
                Profile
              </button>
              <button type="button" onClick={logout} style={{ border: 0, borderRadius: '999px', padding: '0.65rem 1rem', fontWeight: 700 }}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>
      {profileOpen ? (
        <div role="presentation" style={backdropStyle} onClick={() => setProfileOpen(false)}>
          <div role="dialog" aria-modal="true" className="cc-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              style={{ position: 'absolute', top: '0.75rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af' }}
            >
              ✕
            </button>
            <ProfilePanel onClose={() => setProfileOpen(false)} />
          </div>
        </div>
      ) : null}
      <main className="cc-content">{children}</main>
      <BottomNav />
    </div>
  );
}

export default Layout;
