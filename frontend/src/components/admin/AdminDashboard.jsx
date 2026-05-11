import { useEffect, useMemo, useRef, useState } from 'react';

import adminApi from '../../api/admin';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import { HistoryTab, KidsTab, ProfileEditTab, ProfileViewTab, StallTab, card, inp } from '../common/ProfileSections';

/* ── shared styles ── */
const btn = (variant = 'primary') => ({
  padding: '0.5rem 1rem', borderRadius: '0.65rem', border: 'none', cursor: 'pointer', fontWeight: 600,
  background: variant === 'primary' ? '#f59e0b' : variant === 'danger' ? '#fee2e2' : '#f3f4f6',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#dc2626' : '#374151',
});

const TABS = ['Overview', 'Users', 'Vendors', 'Admins', 'Profile', 'Edit', 'Kids', 'History'];
// 'Stall' tab is injected dynamically when user also has vendor role

/* ── inline token loader per user row ── */
function TokenRow({ user, tokenRate, onDone, setStatus }) {
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState('');
  const tokens = dollars > 0 ? Math.floor(parseFloat(dollars) * tokenRate) : null;

  const doAdd = async () => {
    if (!tokens) return;
    try {
      await adminApi.addTokens({ phone: user.phone, amount: tokens });
      setStatus(`✅ Added ${tokens} tokens to ${user.name || user.phone}`);
      setOpen(false); setDollars('');
      onDone();
    } catch (e) { setStatus(e.response?.data?.error || 'Failed to add tokens.'); }
  };

  const doZero = async () => {
    if (!window.confirm(`Zero out balance for ${user.name || user.phone}?`)) return;
    try {
      await adminApi.zeroBalance(user.userId);
      setStatus(`✅ Balance zeroed for ${user.name || user.phone}`);
      onDone();
    } catch (e) { setStatus(e.response?.data?.error || 'Failed to zero balance.'); }
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
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={btn('secondary')} onClick={() => { setOpen(o => !o); setDollars(''); }}>
            {open ? 'Cancel' : '🪙 Add Tokens'}
          </button>
          <button style={btn('danger')} onClick={doZero}>⬛ Zero</button>
        </div>
      </div>
      {open && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>$</span>
          <input type="number" min="1" style={{ ...inp, maxWidth: '100px' }} value={dollars}
            placeholder="Dollars" onChange={e => setDollars(e.target.value)} autoFocus />
          {tokens != null && <span style={{ color: '#b45309', fontWeight: 700 }}>= {tokens} tokens</span>}
          <button style={btn()} onClick={doAdd} disabled={!tokens}>Confirm</button>
        </div>
      )}
    </div>
  );
}

/* ── typeahead to pick a user ── */
function UserTypeahead({ allUsers, onSelect, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return allUsers.filter(u =>
      u.phone?.includes(q) || u.name?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query, allUsers]);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input style={inp} placeholder={placeholder || 'Search by phone or name…'}
        value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '220px', overflowY: 'auto',
        }}>
          {matches.map(u => (
            <div key={u.userId} onClick={() => { onSelect(u); setQuery(''); setOpen(false); }}
              style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <strong>{u.name || '—'}</strong>
              <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{u.phone}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── main dashboard ── */
function AdminDashboard() {
  const { user: me } = useAuth();
  const isVendor = me?.roles?.includes('vendor');
  const allTabs = [...TABS, ...(isVendor ? ['Stall'] : [])];

  const [tab, setTab] = useState('Overview');
  const [stats, setStats] = useState({ totalTokensIssued: 0, totalTokensSpent: 0, vendors: [], users: [] });
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [status, setStatus] = useState('');
  const [rate, setRate] = useState(2);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(2);
  const [eventName, setEventName] = useState('Carnival 2026');

  // own profile/kids/history state (same as UserDashboard)
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '' });
  const [kids, setKids] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const loadAdmin = async () => {
    const [statsRes, eventRes, usersRes] = await Promise.all([
      adminApi.getStats(), adminApi.getEvent(), adminApi.listUsers(),
    ]);
    setStats(statsRes);
    setEvent(eventRes);
    const r = eventRes?.tokenRate ?? 2;
    setRate(r);
    setRateInput(r);
    setUsers(usersRes);
  };

  const loadProfile = async () => {
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
  };

  const load = async () => { await Promise.all([loadAdmin(), loadProfile()]); };

  const loadVendors = async () => {
    const v = await adminApi.listVendors();
    setVendors(v);
  };

  useEffect(() => { load().catch(() => setStatus('Unable to load dashboard.')); }, []);
  useEffect(() => { if (tab === 'Vendors') loadVendors(); }, [tab]);

  const changeTab = (t) => { setStatus(''); setTab(t); };

  const run = async (action, msg) => {
    try { await action(); await loadAdmin(); setStatus(msg); }
    catch (e) { setStatus(e.response?.data?.error || 'Action failed.'); }
  };

  const admins = users.filter(u => u.roles?.includes('admin'));
  const nonAdminUsers = users.filter(u => !u.roles?.includes('admin'));

  const grantAdmin = async (u) => {
    const newRoles = Array.from(new Set([...(u.roles || []), 'admin']));
    try {
      await adminApi.setUserRoles(u.userId, newRoles);
      await loadAdmin();
      setStatus(`✅ ${u.name || u.phone} is now an admin.`);
    } catch (e) { setStatus(e.response?.data?.error || 'Failed.'); }
  };

  const revokeAdmin = async (u) => {
    if (!window.confirm(`Remove admin from ${u.name || u.phone}?`)) return;
    const newRoles = (u.roles || []).filter(r => r !== 'admin');
    try {
      await adminApi.setUserRoles(u.userId, newRoles);
      await loadAdmin();
      setStatus(`✅ Admin removed from ${u.name || u.phone}.`);
    } catch (e) { setStatus(e.response?.data?.error || 'Failed.'); }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {allTabs.map(t => (
            <button key={t} type="button" onClick={() => changeTab(t)}
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

        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && (
          <>
            <section style={{ ...card, background: 'linear-gradient(135deg,#fffbeb,#fed7aa)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.75rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309' }}>{stats.totalTokensIssued}</div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Tokens Issued</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309' }}>{stats.totalTokensSpent}</div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Tokens Spent</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309' }}>{stats.vendors.length}</div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Vendors</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309' }}>{stats.users.length}</div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Users</div>
                </div>
              </div>
            </section>

            <section style={card}>
              <h2 style={{ margin: 0 }}>🎪 Event Control</h2>
              <p style={{ margin: 0 }}>
                <strong>{event?.name || 'No event'}</strong>
                <span style={{ marginLeft: '0.5rem', background: event?.status === 'open' ? '#d1fae5' : '#fee2e2', color: event?.status === 'open' ? '#065f46' : '#991b1b', borderRadius: '1rem', padding: '0.15rem 0.6rem', fontSize: '0.8rem' }}>
                  {event?.status || 'closed'}
                </span>
              </p>
              <input style={inp} value={eventName} placeholder="Event name" onChange={e => setEventName(e.target.value)} />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button style={btn()} onClick={() => run(() => adminApi.manageEvent({ action: 'open', name: eventName }), 'Event opened.')}>Open Event</button>
                <button style={btn('danger')} onClick={() => run(() => adminApi.manageEvent({ action: 'close' }), 'Event closed.')}>Close Event</button>
              </div>
            </section>

            <section style={card}>
              <h2 style={{ margin: 0 }}>💱 Token Rate</h2>
              {!editingRate ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fed7aa)', borderRadius: '0.85rem', padding: '0.75rem 1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Current Rate</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309' }}>$1 = {rate} tokens</div>
                  </div>
                  <button style={btn('secondary')} onClick={() => { setRateInput(rate); setEditingRate(true); }}>
                    ✏️ Edit
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>$1 =</span>
                  <input style={{ ...inp, maxWidth: '100px' }} type="number" min="1" value={rateInput}
                    onChange={e => setRateInput(Number(e.target.value))} autoFocus />
                  <span style={{ fontWeight: 600 }}>tokens</span>
                  <button style={btn()} onClick={() => run(() => adminApi.setRate({ tokenRate: rateInput }), 'Rate updated.').then(() => setEditingRate(false))}>
                    Save
                  </button>
                  <button style={btn('secondary')} onClick={() => setEditingRate(false)}>Cancel</button>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── USERS ── */}
        {tab === 'Users' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>👥 Users ({users.filter(u => u.roles?.includes('user')).length})</h2>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Rate: {rate} tokens / $1</div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {users.filter(u => u.roles?.includes('user')).map(u => (
                <TokenRow key={u.userId} user={u} tokenRate={rate} onDone={load} setStatus={setStatus} />
              ))}
            </div>
          </section>
        )}

        {/* ── VENDORS ── */}
        {tab === 'Vendors' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>🏪 Vendors ({vendors.length})</h2>
            {vendors.length === 0 && <p style={{ color: '#6b7280' }}>No vendors yet.</p>}
            {vendors.map(v => (
              <div key={v.userId} style={{ background: '#fffbeb', borderRadius: '0.85rem', padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div>
                    <strong>{v.name || '—'}</strong>
                    <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{v.phone}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '1rem', padding: '0.15rem 0.6rem', marginRight: '0.4rem' }}>{v.totalReceived} tokens received</span>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: '1rem', padding: '0.15rem 0.6rem' }}>{v.transactionCount} txns</span>
                  </div>
                </div>
                {v.items?.length > 0 && (
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                    <strong>Items:</strong>{' '}
                    {v.items.filter(i => i.active).map(i => `${i.name} (${i.tokenPrice}🪙)`).join(' · ')}
                  </div>
                )}
                {v.recentTransactions?.length > 0 && (
                  <details style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    <summary style={{ cursor: 'pointer' }}>Recent transactions ({v.recentTransactions.length})</summary>
                    <div style={{ paddingTop: '0.4rem', display: 'grid', gap: '0.2rem' }}>
                      {v.recentTransactions.map((tx, i) => (
                        <div key={i}>{tx.itemName} × {tx.qty} — {tx.amount} tokens — {tx.timestamp?.slice(0, 10)}</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ── ADMINS ── */}
        {tab === 'Admins' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>🛡️ Admins ({admins.length})</h2>

            {/* current admins */}
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {admins.map(u => {
                const isMe = u.userId === me?.userId;
                return (
                  <div key={u.userId} style={{ background: isMe ? '#fffbeb' : '#f9fafb', border: isMe ? '2px solid #f59e0b' : '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div>
                      <strong>{u.name || '—'}</strong>
                      {isMe && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#b45309' }}>(you)</span>}
                      <span style={{ color: '#6b7280', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{u.phone}</span>
                    </div>
                    {!isMe && (
                      <button style={btn('danger')} onClick={() => revokeAdmin(u)}>Remove Admin</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* add admin typeahead */}
            <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
              <div style={{ fontWeight: 600 }}>+ Add Admin</div>
              <UserTypeahead
                allUsers={nonAdminUsers}
                placeholder="Search by phone or name…"
                onSelect={u => {
                  if (window.confirm(`Grant admin to ${u.name || u.phone}?`)) grantAdmin(u);
                }}
              />
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Start typing to find a user — select to grant admin role</div>
            </div>
          </section>
        )}

        {/* ── PROFILE / EDIT / KIDS / HISTORY (same as user dashboard) ── */}
        {tab === 'Profile' && (
          <ProfileViewTab profile={profile} balance={balance} event={event} isAdmin setStatus={setStatus} onReload={load} />
        )}
        {tab === 'Edit' && (
          <ProfileEditTab profile={profile} setProfile={setProfile} setStatus={setStatus} onTabChange={changeTab} />
        )}
        {tab === 'Kids' && (
          <KidsTab profile={profile} kids={kids} onReload={load} setStatus={setStatus} />
        )}
        {tab === 'History' && (
          <HistoryTab transactions={transactions} />
        )}

        {/* ── STALL (only if admin is also a vendor) ── */}
        {tab === 'Stall' && isVendor && (
          <StallTab setStatus={setStatus} />
        )}
      </div>
    </Layout>
  );
}

export default AdminDashboard;
