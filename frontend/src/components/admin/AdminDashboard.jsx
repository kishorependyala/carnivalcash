import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import adminApi from '../../api/admin';
import charitiesApi from '../../api/charities';
import stallsApi from '../../api/stalls';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { TYPE_META, MergedStallsTab } from '../common/StallsTab';
import { HistoryTab, card, inp } from '../common/ProfileSections'; // eslint-disable-line no-unused-vars

const btn = (variant = 'primary') => ({
  padding: '0.5rem 1rem',
  borderRadius: '0.65rem',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  background: variant === 'primary' ? '#f59e0b' : variant === 'danger' ? '#fee2e2' : '#f3f4f6',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#dc2626' : '#374151',
});

const TABS = ['User', 'Stalls', 'Admin'];

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          style={{
            padding: '0.5rem 1.1rem',
            borderRadius: '2rem',
            border: 'none',
            cursor: 'pointer',
            background: active === tab ? '#f59e0b' : '#f3f4f6',
            color: active === tab ? '#fff' : '#374151',
            fontWeight: active === tab ? 700 : 400,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function TokenRow({ user, tokenRate, onDone, setStatus }) {
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [delCode, setDelCode] = useState('');
  const tokens = dollars > 0 ? Math.floor(parseFloat(dollars) * tokenRate) : null;

  const doAdd = async () => {
    if (!tokens) return;
    try {
      await adminApi.addTokens({ phone: user.phone, amount: tokens });
      setStatus(`✅ Added ${tokens} tokens to ${user.name || user.phone}`);
      setOpen(false);
      setDollars('');
      onDone();
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed to add tokens.');
    }
  };

  const doZero = async () => {
    if (!window.confirm(`Zero out balance for ${user.name || user.phone}?`)) return;
    try {
      await adminApi.zeroBalance(user.userId);
      setStatus(`✅ Balance zeroed for ${user.name || user.phone}`);
      onDone();
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed to zero balance.');
    }
  };

  const doDelete = async () => {
    try {
      await adminApi.deleteUser(user.userId, delCode);
      setStatus(`✅ Deleted ${user.name || user.phone}`);
      setDeleting(false);
      setDelCode('');
      onDone();
    } catch (error) {
      setStatus(error.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem', display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div>
          <strong>{user.name || '—'}</strong>
          <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{user.phone}</span>
          <span style={{ background: '#fde68a', borderRadius: '1rem', padding: '0.15rem 0.6rem', fontSize: '0.8rem', marginLeft: '0.5rem', fontWeight: 700 }}>
            {user.tokenBalance} tokens
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button style={btn('secondary')} onClick={() => { setOpen((v) => !v); setDollars(''); setDeleting(false); }}>
            {open ? 'Cancel' : '🪙 Add'}
          </button>
          <button style={btn('danger')} onClick={doZero}>⬛ Zero</button>
          <button style={btn('danger')} onClick={() => { setDeleting((v) => !v); setDelCode(''); setOpen(false); }}>
            🗑️
          </button>
        </div>
      </div>

      {open && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>$</span>
          <input type="number" min="1" style={{ ...inp, maxWidth: '100px' }} value={dollars} placeholder="Dollars" onChange={(e) => setDollars(e.target.value)} autoFocus />
          {tokens != null && <span style={{ color: '#b45309', fontWeight: 700 }}>= {tokens} tokens</span>}
          <button style={btn()} onClick={doAdd} disabled={!tokens}>Confirm</button>
        </div>
      )}

      {deleting && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: '#fee2e2', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>Delete user? Enter code:</span>
          <input
            type="password"
            style={{ ...inp, maxWidth: '130px', fontFamily: 'monospace' }}
            placeholder="••••••"
            value={delCode}
            onChange={(e) => setDelCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && delCode && doDelete()}
            autoFocus
          />
          <button style={btn('danger')} disabled={!delCode} onClick={doDelete}>Delete</button>
          <button style={btn('secondary')} onClick={() => { setDeleting(false); setDelCode(''); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function UserTypeahead({ allUsers, onSelect, placeholder }) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return [];
    }
    return allUsers.filter((user) => user.phone?.includes(normalized) || user.name?.toLowerCase().includes(normalized)).slice(0, 8);
  }, [allUsers, query]);

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <input style={inp} placeholder={placeholder || 'Search by phone or name…'} value={query} onChange={(event) => setQuery(event.target.value)} />
      {matches.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {matches.map((user) => (
            <button
              key={user.userId}
              type="button"
              onClick={() => { onSelect(user); setQuery(''); }}
              style={{ textAlign: 'left', padding: '0.7rem 0.9rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', background: '#fffbeb', cursor: 'pointer' }}
            >
              <strong>{user.name || '—'}</strong>
              <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{user.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'json') return '{ }';
  if (ext === 'txt' || ext === 'log') return '📝';
  if (ext === 'csv') return '📊';
  if (ext === 'md') return '📖';
  return '📄';
}

function fileTypeBadge(name) {
  const ext = name.split('.').pop().toLowerCase();
  const styles = {
    json: { bg: '#dbeafe', color: '#1e40af', label: 'JSON' },
    txt:  { bg: '#f3f4f6', color: '#374151', label: 'TXT' },
    log:  { bg: '#fef3c7', color: '#92400e', label: 'LOG' },
    csv:  { bg: '#d1fae5', color: '#065f46', label: 'CSV' },
    md:   { bg: '#ede9fe', color: '#5b21b6', label: 'MD' },
  };
  const s = styles[ext] || { bg: '#f3f4f6', color: '#6b7280', label: ext.toUpperCase() };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: '0.4rem', padding: '0.1rem 0.45rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em' }}>
      {s.label}
    </span>
  );
}

function fmtSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DataFilesTab() {
  const [path, setPath] = useState('');
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const browse = (targetPath) => {
    setError('');
    setLoading(true);
    adminApi.browseFiles(targetPath)
      .then((data) => { setNode(data); setPath(targetPath); })
      .catch((err) => setError(err.response?.data?.error || err.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { browse(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const breadcrumbs = path ? path.split('/') : [];
  const parentPath = breadcrumbs.slice(0, -1).join('/');
  const currentName = breadcrumbs[breadcrumbs.length - 1] || 'data';

  const dirs  = (node?.items || []).filter((i) => i.type === 'dir');
  const files = (node?.items || []).filter((i) => i.type === 'file');

  return (
    <section style={card}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {path && (
          <button
            type="button"
            onClick={() => browse(parentPath)}
            style={{ background: '#f3f4f6', border: 'none', borderRadius: '0.6rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
            title="Go up"
          >
            ←
          </button>
        )}
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {path ? '📁' : '🗂️'}
          <span>{currentName}</span>
        </h2>
        <button
          type="button"
          onClick={() => browse(path)}
          style={{ marginLeft: 'auto', background: '#f3f4f6', border: 'none', borderRadius: '0.6rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem' }}
          title="Refresh"
        >
          ↺
        </button>
      </div>

      {/* Breadcrumb trail */}
      {breadcrumbs.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.82rem', color: '#9ca3af' }}>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', padding: 0, fontWeight: 600 }} onClick={() => browse('')}>data</button>
          {breadcrumbs.map((part, i) => {
            const crumbPath = breadcrumbs.slice(0, i + 1).join('/');
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={crumbPath} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>/</span>
                {isLast
                  ? <span style={{ color: '#374151', fontWeight: 600 }}>{part}</span>
                  : <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', padding: 0, fontWeight: 600 }} onClick={() => browse(crumbPath)}>{part}</button>}
              </span>
            );
          })}
        </div>
      )}

      {loading && <p style={{ color: '#6b7280', margin: 0 }}>Loading…</p>}
      {error   && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}

      {/* Directory listing */}
      {!loading && node?.type === 'dir' && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {node.items.length === 0 && <p style={{ color: '#6b7280', margin: 0 }}>Empty folder.</p>}

          {/* Folders first */}
          {dirs.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => browse(item.path)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', padding: '0.7rem 1rem', borderRadius: '0.75rem', border: '1px solid #fde68a', background: '#fffbeb', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>📁</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#92400e' }}>{item.name}</span>
              <span style={{ color: '#d97706', fontSize: '1rem' }}>›</span>
            </button>
          ))}

          {/* Files */}
          {files.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => browse(item.path)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', padding: '0.65rem 1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '1.1rem', lineHeight: 1, color: '#6b7280' }}>{fileIcon(item.name)}</span>
              <span style={{ flex: 1, color: '#374151' }}>{item.name}</span>
              {fileTypeBadge(item.name)}
              <span style={{ fontSize: '0.78rem', color: '#9ca3af', minWidth: '3.5rem', textAlign: 'right' }}>{fmtSize(item.size)}</span>
            </button>
          ))}
        </div>
      )}

      {/* File viewer */}
      {!loading && node?.type === 'file' && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.2rem' }}>{fileIcon(node.name)}</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{node.name}</span>
            {fileTypeBadge(node.name)}
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>{fmtSize(node.size)}</span>
          </div>
          <pre style={{ background: '#1e1e2e', color: '#cdd6f4', borderRadius: '0.75rem', padding: '1rem', overflowX: 'auto', fontSize: '0.8rem', margin: 0, maxHeight: '60vh', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {(() => { try { return JSON.stringify(JSON.parse(node.content), null, 2); } catch { return node.content; } })()}
          </pre>
        </div>
      )}
    </section>
  );
}

function AdminDashboard() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const isAdmin = me?.roles?.includes('admin'); // eslint-disable-line no-unused-vars

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || localStorage.getItem('cc_defaultTab') || 'User');
  const [stats, setStats] = useState({ totalTokensIssued: 0, totalTokensSpent: 0, vendors: [], users: [] });
  const [event, setEvent] = useState(null); // eslint-disable-line no-unused-vars
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('');
  const [rate, setRate] = useState(2);
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '', birthYear: '0000' });
  const [kids, setKids] = useState([]);
  const [linkedFamily, setLinkedFamily] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [qrPayload, setQrPayload] = useState('');
  const [allStalls, setAllStalls] = useState([]);
  const [stallsLoaded, setStallsLoaded] = useState(false);
  const [charities, setCharities] = useState([]);
  const [charitiesLoaded, setCharitiesLoaded] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetting, setResetting] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [adminSubTab, setAdminSubTab] = useState('Admins');
  const [expandedKid, setExpandedKid] = useState(null); // eslint-disable-line no-unused-vars
  const [kidQrPopup, setKidQrPopup] = useState(null); // {name, qrValue}
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editSection, setEditSection] = useState('profile'); // 'profile' | 'kids' | 'family'
  const [editName, setEditName] = useState('');
  const [newKidName, setNewKidName] = useState('');
  const [newKidLimit, setNewKidLimit] = useState('');
  const [editingKid, setEditingKid] = useState(null); // {kidId, name, spendingLimit}
  const [linkPhone, setLinkPhone] = useState('');
  const [drawerStatus, setDrawerStatus] = useState('');

  const loadAdmin = async () => {
    const [statsRes, eventRes, usersRes] = await Promise.all([
      adminApi.getStats(),
      adminApi.getEvent(),
      adminApi.listUsers(),
    ]);
    setStats(statsRes);
    setEvent(eventRes);
    setRate(eventRes?.tokenRate ?? 2);
    setUsers(usersRes);
  };

  const loadProfile = async () => {
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
  };

  const loadStalls = async () => {
    const result = await stallsApi.listAll();
    setAllStalls(result);
    setStallsLoaded(true);
  };

  const load = async () => {
    await Promise.all([loadAdmin(), loadProfile()]);
  };

  useEffect(() => {
    load().catch(() => setStatus('Unable to load dashboard.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'Admin' && adminSubTab === 'Stalls' && !stallsLoaded) {
      loadStalls().catch((error) => setStatus(error.response?.data?.error || 'Unable to load stalls.'));
    }
  }, [tab, adminSubTab, stallsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'Admin' && adminSubTab === 'Charities' && !charitiesLoaded) {
      charitiesApi.list().then(setCharities).catch(() => {}).finally(() => setCharitiesLoaded(true));
    }
  }, [tab, adminSubTab, charitiesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = (nextTab) => {
    setStatus('');
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const admins = users.filter((user) => user.roles?.includes('admin'));
  const nonAdminUsers = users.filter((user) => !user.roles?.includes('admin'));

  const grantAdmin = async (user) => {
    const newRoles = Array.from(new Set([...(user.roles || []), 'admin']));
    try {
      await adminApi.setUserRoles(user.userId, newRoles);
      await loadAdmin();
      setStatus(`✅ ${user.name || user.phone} is now an admin.`);
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed.');
    }
  };

  const revokeAdmin = async (user) => {
    if (!window.confirm(`Remove admin from ${user.name || user.phone}?`)) {
      return;
    }
    const newRoles = (user.roles || []).filter((role) => role !== 'admin');
    try {
      await adminApi.setUserRoles(user.userId, newRoles);
      await loadAdmin();
      setStatus(`✅ Admin removed from ${user.name || user.phone}.`);
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed.');
    }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Welcome header */}
        {profile.name || profile.phone ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>👋</span>
            <span style={{ fontWeight: 700, color: '#92400e', fontSize: '1rem' }}>Welcome, {profile.name || 'there'}</span>
            {profile.phone && <span style={{ color: '#b45309', fontSize: '0.88rem', marginLeft: '0.25rem' }}>{profile.phone}</span>}
          </div>
        ) : null}

        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {tab === 'User' && (() => {
          const tokensSpent = transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
          const tokensIssued = balance.tokenBalance + tokensSpent; // eslint-disable-line no-unused-vars
          return (
            <div style={{ display: 'grid', gap: '1rem' }}>

              {/* Edit button row */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setEditSection('profile'); setDrawerStatus(''); setShowEditDrawer(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: '0.75rem', padding: '0.45rem 1rem', cursor: 'pointer', fontWeight: 600, color: '#92400e', fontSize: '0.88rem' }}>
                  ✏️ Edit Profile &amp; Family
                </button>
              </div>

              {/* Two-column row: QR code | Order button */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>

                {/* QR code */}
                <section style={{ ...card, textAlign: 'center', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#92400e' }}>📲 Your QR Code</div>
                  <div style={{ fontSize: '0.82rem', color: '#78350f' }}>Show this to stall owners</div>
                  {qrPayload && <PrintableQR title="" qrValue={qrPayload} subtitle={profile.name || profile.phone || ''} />}
                  <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309', verticalAlign: 'middle' }}>{balance.tokenBalance}</span>
                    {' '}<span style={{ verticalAlign: 'middle' }}>tokens</span>
                  </div>
                </section>

                {/* Order from Stall */}
                <button
                  onClick={() => navigate('/scan')}
                  style={{
                    background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                    color: '#fff', border: 'none', borderRadius: '1.25rem',
                    padding: '1.75rem 1rem', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
                    width: '100%', boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>🛒</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Order from a Stall</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 400, opacity: 0.9 }}>Scan a stall's QR to browse &amp; order</span>
                </button>

              </div>

              {/* Family section */}
              <section style={card}>
                <h3 style={{ margin: '0 0 0.75rem', color: '#92400e' }}>👨‍👩‍👧 Family</h3>

                {/* 6-column token table: Type | Name | Limit | Spent | Available | QR */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #fed7aa' }}>
                      <th style={{ padding: '0.4rem 0.5rem 0.4rem 0', textAlign: 'left', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}>Type</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'left', color: '#92400e', fontWeight: 700 }}>Name</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'right', color: '#92400e', fontWeight: 700 }}>Limit</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'right', color: '#92400e', fontWeight: 700 }}>Spent</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'right', color: '#92400e', fontWeight: 700 }}>Available</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'center', color: '#92400e', fontWeight: 700 }}>QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Main user row */}
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.4rem 0.5rem 0.4rem 0', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>User</td>
                      <td style={{ padding: '0.4rem 0', color: '#374151', fontWeight: 600 }}>{profile.name || profile.phone || 'You'}</td>
                      <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#6b7280' }}>—</td>
                      <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{tokensSpent}</td>
                      <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>🪙 {balance.tokenBalance}</td>
                      <td style={{ padding: '0.4rem 0', textAlign: 'center' }}>
                        <button
                          onClick={() => setKidQrPopup({ name: profile.name || profile.phone || 'You', qrValue: qrPayload, limit: null })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.1rem 0.3rem' }}
                        >📲</button>
                      </td>
                    </tr>

                    {/* Linked family members */}
                    {linkedFamily.map((member) => (
                      <tr key={member.userId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.4rem 0.5rem 0.4rem 0', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Linked</td>
                        <td style={{ padding: '0.4rem 0', color: '#374151' }}>{member.name || member.phone}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#6b7280' }}>—</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{member.tokenSpent}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>🪙 {member.tokenBalance}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'center' }}>
                          <button
                            onClick={() => setKidQrPopup({ name: member.name || member.phone, qrValue: `CARNIVAL_USER:${member.userId}`, limit: null })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.1rem 0.3rem' }}
                          >📲</button>
                        </td>
                      </tr>
                    ))}

                    {/* Kids — QR opens popup */}
                    {kids.map((kid) => (
                      <tr key={kid.kidId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.4rem 0.5rem 0.4rem 0', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Kid</td>
                        <td style={{ padding: '0.4rem 0', color: '#374151', fontWeight: 600 }}>{kid.name}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#6b7280' }}>{kid.spendingLimit}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{kid.spent}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>🪙 {kid.spendingLimit - kid.spent}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'center' }}>
                          <button
                            onClick={() => setKidQrPopup({ name: kid.name, qrValue: `CARNIVAL_KID:${profile.userId}:${kid.kidId}`, limit: kid.spendingLimit })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.1rem 0.3rem' }}
                            title={`Show QR for ${kid.name}`}
                          >📲</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

            </div>
          );
        })()}

        {tab === 'Stalls' && <MergedStallsTab />}

        {tab === 'Admin' && (
          <section style={card}>
            {/* Sub-tab bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {['Users', 'Admins', 'Stalls', 'Charities', 'Files', 'History'].map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setAdminSubTab(sub);
                    if (sub === 'Stalls' && !stallsLoaded) {
                      loadStalls().catch((error) => setStatus(error.response?.data?.error || 'Unable to load stalls.'));
                    }
                    if (sub === 'Charities' && !charitiesLoaded) {
                      charitiesApi.list().then(setCharities).catch(() => {}).finally(() => setCharitiesLoaded(true));
                    }
                  }}
                  style={{
                    padding: '0.35rem 1rem',
                    borderRadius: '2rem',
                    border: 'none',
                    cursor: 'pointer',
                    background: adminSubTab === sub ? '#f59e0b' : '#f3f4f6',
                    color: adminSubTab === sub ? '#fff' : '#374151',
                    fontWeight: adminSubTab === sub ? 700 : 400,
                  }}
                >
                  {sub}
                </button>
              ))}
            </div>

            {adminSubTab === 'Users' && (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* Stats grid */}
                <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fed7aa)', borderRadius: '0.85rem', padding: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.75rem' }}>
                    {[
                      { label: 'Tokens Issued', value: stats.totalTokensIssued },
                      { label: 'Tokens Spent', value: stats.totalTokensSpent },
                      { label: 'Stalls', value: stallsLoaded ? allStalls.length : '—' },
                      { label: 'Users', value: stats.users.length },
                      { label: 'Token Rate', value: `$1 = ${rate}` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309' }}>{value}</div>
                        <div style={{ fontSize: '0.78rem', color: '#92400e' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User list with search */}
                {(() => {
                  const allRegularUsers = users
                    .filter((u) => u.roles?.includes('user'))
                    .sort((a, b) => (a.name || a.phone || '').localeCompare(b.name || b.phone || ''));
                  const q = userSearch.toLowerCase().trim();
                  const filtered = q
                    ? allRegularUsers.filter((u) => u.phone?.includes(q) || u.name?.toLowerCase().includes(q))
                    : allRegularUsers;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h2 style={{ margin: 0 }}>👥 Users ({allRegularUsers.length})</h2>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Rate: {rate} tokens / $1</span>
                      </div>
                      <input
                        style={inp}
                        placeholder="Search by name or phone…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                      {filtered.length === 0 && <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.88rem' }}>No users match.</p>}
                      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {filtered.map((u) => (
                          <TokenRow key={u.userId} user={u} tokenRate={rate} onDone={load} setStatus={setStatus} />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Reset all tokens */}
                <div style={{ border: '1.5px solid #fca5a5', borderRadius: '0.85rem', padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <h2 style={{ margin: 0, color: '#dc2626' }}>⚠️ Reset All Tokens</h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                    Zeros every user and stall token balance. A timestamped snapshot is saved to <code>data/archive/</code> first. This cannot be undone.
                  </p>
                  {!resetting ? (
                    <button style={btn('danger')} onClick={() => setResetting(true)}>Reset All Tokens…</button>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Enter code to confirm:</label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          type="password"
                          style={{ ...inp, maxWidth: '160px', fontFamily: 'monospace', letterSpacing: '0.15em' }}
                          placeholder="••••••"
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value)}
                          autoFocus
                        />
                        <button
                          style={btn('danger')}
                          disabled={!resetCode}
                          onClick={async () => {
                            try {
                              const res = await adminApi.resetTokens(resetCode);
                              setStatus(`✅ Reset complete — ${res.usersReset} users, ${res.stallsReset} stalls zeroed. Archived as ${res.archive}.`);
                              setResetting(false);
                              setResetCode('');
                              await load();
                            } catch (err) {
                              setStatus(err.response?.data?.error || 'Reset failed.');
                            }
                          }}
                        >
                          Confirm Reset
                        </button>
                        <button style={btn('secondary')} onClick={() => { setResetting(false); setResetCode(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {adminSubTab === 'Admins' && (
              <>
                <h2 style={{ margin: 0 }}>🛡️ Admins ({admins.length})</h2>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {admins.map((user) => {
                    const isMe = user.userId === me?.userId;
                    return (
                      <div key={user.userId} style={{ background: isMe ? '#fffbeb' : '#f9fafb', border: isMe ? '2px solid #f59e0b' : '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <div>
                          <strong>{user.name || '—'}</strong>
                          {isMe && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#b45309' }}>(you)</span>}
                          <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{user.phone}</span>
                        </div>
                        {!isMe && <button style={btn('danger')} onClick={() => revokeAdmin(user)}>Remove Admin</button>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 600 }}>+ Add Admin</div>
                  <UserTypeahead
                    allUsers={nonAdminUsers}
                    placeholder="Search by phone or name…"
                    onSelect={(user) => {
                      if (window.confirm(`Grant admin to ${user.name || user.phone}?`)) {
                        grantAdmin(user);
                      }
                    }}
                  />
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Start typing to find a user — select to grant admin role</div>
                </div>
              </>
            )}

            {adminSubTab === 'Stalls' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>🎪 Stalls ({allStalls.length})</h2>
                  <button style={btn('secondary')} onClick={() => loadStalls().catch((error) => setStatus(error.response?.data?.error || 'Unable to load stalls.'))}>Refresh</button>
                </div>
                {allStalls.length === 0 && <p style={{ color: '#6b7280' }}>No stalls yet.</p>}
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {allStalls.map((stall) => {
                    const typeMeta = TYPE_META[stall.stallType] || TYPE_META.game;
                    return (
                      <div key={stall.stallId} style={{ background: '#fffbeb', borderRadius: '0.85rem', padding: '1rem', display: 'grid', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <strong>{stall.stallName}</strong>
                          <span style={{ background: typeMeta.bg, color: typeMeta.color, borderRadius: '999px', padding: '0.2rem 0.7rem', fontWeight: 700, fontSize: '0.85rem' }}>{typeMeta.icon} {typeMeta.label}</span>
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{stall.stallId}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: '999px', padding: '0.2rem 0.7rem', fontWeight: 700, fontSize: '0.85rem' }}>{stall.memberCount} members</span>
                          <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '999px', padding: '0.2rem 0.7rem', fontWeight: 700, fontSize: '0.85rem' }}>{stall.tokenBalance} tokens</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {adminSubTab === 'Charities' && (
              <>
                <h2 style={{ margin: 0 }}>💝 Charities</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Token balances accumulated from stall donations.</p>
                {!charitiesLoaded && <p style={{ color: '#6b7280' }}>Loading…</p>}
                {charitiesLoaded && charities.length === 0 && <p style={{ color: '#6b7280' }}>No charities yet. Stall owners can add them when configuring their stall.</p>}
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {charities.map((charity) => (
                    <div key={charity.charityId} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '1rem', padding: '1rem', display: 'grid', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>💚 {charity.name}</div>
                        <div style={{ background: '#dcfce7', color: '#166534', borderRadius: '0.65rem', padding: '0.3rem 0.85rem', fontWeight: 700 }}>
                          🪙 {charity.tokenBalance || 0} tokens
                        </div>
                      </div>
                      {charity.description && <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{charity.description}</div>}
                      {charity.website && <a href={charity.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: '#059669' }}>{charity.website}</a>}
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Added {charity.addedAt?.slice(0, 10)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {adminSubTab === 'Files' && <DataFilesTab />}
            {adminSubTab === 'History' && <HistoryTab transactions={transactions} />}
          </section>
        )}

      </div>

      {/* ── Kid QR Popup ── */}
      {kidQrPopup && (
        <div
          onClick={() => setKidQrPopup(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem 1.5rem', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}
          >
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#92400e', marginBottom: '1rem' }}>👤 {kidQrPopup.name}</div>
            <PrintableQR
              title={kidQrPopup.name}
              qrValue={kidQrPopup.qrValue}
              subtitle={kidQrPopup.limit != null ? `Token limit: ${kidQrPopup.limit}` : kidQrPopup.name}
            />
            <button
              onClick={() => setKidQrPopup(null)}
              style={{ marginTop: '1rem', background: '#f3f4f6', border: 'none', borderRadius: '0.75rem', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: 600, color: '#374151' }}
            >Close</button>
          </div>
        </div>
      )}

      {/* ── Edit Drawer ── */}
      {showEditDrawer && (
        <div
          onClick={() => setShowEditDrawer(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '1.5rem 1.5rem 0 0', width: '100%', maxWidth: '560px', padding: '1.5rem 1.25rem 6rem', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(0,0,0,0.18)', boxSizing: 'border-box' }}
          >
            {/* Drawer handle */}
            <div style={{ width: '2.5rem', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 1.25rem' }} />

            {/* Section tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[['profile','👤 Profile'],['kids','👦 Kids'],['family','🔗 Family']].map(([key, label]) => (
                <button key={key} onClick={() => { setEditSection(key); setDrawerStatus(''); }}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                    background: editSection === key ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#f3f4f6',
                    color: editSection === key ? '#fff' : '#374151' }}>
                  {label}
                </button>
              ))}
            </div>

            {drawerStatus && (
              <p style={{ margin: '0 0 1rem', padding: '0.6rem 1rem', background: '#fffbeb', color: '#92400e', borderRadius: '0.75rem', fontSize: '0.88rem' }}>{drawerStatus}</p>
            )}

            {/* ── Profile section ── */}
            {editSection === 'profile' && (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>
                  Display Name
                  <input value={editName || profile.name || ''} onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your name" style={{ ...inp, fontSize: '1rem' }} />
                </label>
                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>📱 Phone: <strong>{profile.phone}</strong> &nbsp;(cannot be changed)</div>
                <button
                  onClick={async () => {
                    try {
                      await userApi.updateProfile({ name: editName || profile.name });
                      await loadProfile();
                      setDrawerStatus('✅ Name updated!');
                    } catch { setDrawerStatus('❌ Failed to update.'); }
                  }}
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                  Save Changes
                </button>
              </div>
            )}

            {/* ── Kids section ── */}
            {editSection === 'kids' && (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {/* Existing kids */}
                {kids.map((kid) => (
                  <div key={kid.kidId} style={{ background: '#f9fafb', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
                    {editingKid?.kidId === kid.kidId ? (
                      <>
                        <input value={editingKid.name} onChange={(e) => setEditingKid({ ...editingKid, name: e.target.value })}
                          placeholder="Kid's name" style={{ ...inp }} />
                        <input type="number" value={editingKid.spendingLimit} onChange={(e) => setEditingKid({ ...editingKid, spendingLimit: e.target.value })}
                          placeholder="Token limit" style={{ ...inp }} />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={async () => {
                            try {
                              await userApi.updateKid(kid.kidId, { name: editingKid.name, spendingLimit: parseInt(editingKid.spendingLimit) });
                              await loadProfile(); setEditingKid(null); setDrawerStatus('✅ Kid updated!');
                            } catch { setDrawerStatus('❌ Failed.'); }
                          }} style={{ flex: 1, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingKid(null)} style={{ flex: 1, background: '#e5e7eb', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#374151' }}>👦 {kid.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Limit: {kid.spendingLimit} tokens</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => setEditingKid({ ...kid })}
                            style={{ background: '#fef3c7', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', cursor: 'pointer', fontWeight: 600, color: '#92400e' }}>✏️</button>
                          <button onClick={async () => {
                            if (!window.confirm(`Remove ${kid.name}?`)) return;
                            try { await userApi.deleteKid(kid.kidId); await loadProfile(); setDrawerStatus('Removed.'); } catch { setDrawerStatus('❌ Failed.'); }
                          }} style={{ background: '#fee2e2', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add new kid */}
                <div style={{ background: '#f0fdf4', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.88rem' }}>➕ Add a Kid</div>
                  <input value={newKidName} onChange={(e) => setNewKidName(e.target.value)} placeholder="Name" style={{ ...inp }} />
                  <input type="number" value={newKidLimit} onChange={(e) => setNewKidLimit(e.target.value)} placeholder="Token limit" style={{ ...inp }} />
                  <button onClick={async () => {
                    if (!newKidName.trim()) return;
                    try {
                      await userApi.createKid({ name: newKidName.trim(), spendingLimit: parseInt(newKidLimit) || 0 });
                      await loadProfile(); setNewKidName(''); setNewKidLimit(''); setDrawerStatus('✅ Kid added!');
                    } catch { setDrawerStatus('❌ Failed to add kid.'); }
                  }} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                    Add Kid
                  </button>
                </div>
              </div>
            )}

            {/* ── Family section ── */}
            {editSection === 'family' && (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {/* Existing linked members */}
                {linkedFamily.map((member) => (
                  <div key={member.userId} style={{ background: '#f9fafb', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#374151' }}>👤 {member.name || member.phone}</div>
                      {member.name && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{member.phone}</div>}
                    </div>
                    <button onClick={async () => {
                      if (!window.confirm(`Unlink ${member.name || member.phone}?`)) return;
                      try { await userApi.unlinkFamily(member.userId); await loadProfile(); setDrawerStatus('Unlinked.'); } catch { setDrawerStatus('❌ Failed.'); }
                    }} style={{ background: '#fee2e2', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>Unlink</button>
                  </div>
                ))}
                {linkedFamily.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: 0 }}>No linked family members yet.</p>}

                {/* Link by phone */}
                <div style={{ background: '#eff6ff', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.88rem' }}>🔗 Link a Family Member</div>
                  <input value={linkPhone} onChange={(e) => setLinkPhone(e.target.value)} placeholder="Their phone number" style={{ ...inp }} type="tel" />
                  <button onClick={async () => {
                    if (!linkPhone.trim()) return;
                    try {
                      await userApi.linkFamily(linkPhone.trim());
                      await loadProfile(); setLinkPhone(''); setDrawerStatus('✅ Family member linked!');
                    } catch { setDrawerStatus('❌ Not found or already linked.'); }
                  }} style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                    Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default AdminDashboard;
