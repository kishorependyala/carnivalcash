import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import adminApi from '../../api/admin';
import charitiesApi from '../../api/charities';
import stallsApi from '../../api/stalls';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { BrowseStallsTab, StallsTab, TYPE_META } from '../common/StallsTab';
import { HistoryTab, ProfileTab, card, inp } from '../common/ProfileSections';

const btn = (variant = 'primary') => ({
  padding: '0.5rem 1rem',
  borderRadius: '0.65rem',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  background: variant === 'primary' ? '#f59e0b' : variant === 'danger' ? '#fee2e2' : '#f3f4f6',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#dc2626' : '#374151',
});

const TABS = ['Home', 'Overview', 'Users', 'Stalls', 'Admins', 'My Stalls', 'Browse', 'Charities', 'Profile', 'History'];

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
  const tokens = dollars > 0 ? Math.floor(parseFloat(dollars) * tokenRate) : null;

  const doAdd = async () => {
    if (!tokens) {
      return;
    }
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
    if (!window.confirm(`Zero out balance for ${user.name || user.phone}?`)) {
      return;
    }
    try {
      await adminApi.zeroBalance(user.userId);
      setStatus(`✅ Balance zeroed for ${user.name || user.phone}`);
      onDone();
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed to zero balance.');
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
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={btn('secondary')} onClick={() => { setOpen((value) => !value); setDollars(''); }}>
            {open ? 'Cancel' : '🪙 Add Tokens'}
          </button>
          <button style={btn('danger')} onClick={doZero}>⬛ Zero</button>
        </div>
      </div>
      {open && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>$</span>
          <input type="number" min="1" style={{ ...inp, maxWidth: '100px' }} value={dollars} placeholder="Dollars" onChange={(event) => setDollars(event.target.value)} autoFocus />
          {tokens != null && <span style={{ color: '#b45309', fontWeight: 700 }}>= {tokens} tokens</span>}
          <button style={btn()} onClick={doAdd} disabled={!tokens}>Confirm</button>
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

function AdminDashboard() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const isAdmin = me?.roles?.includes('admin');

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'Home');
  const [stats, setStats] = useState({ totalTokensIssued: 0, totalTokensSpent: 0, vendors: [], users: [] });
  const [event, setEvent] = useState(null);
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('');
  const [rate, setRate] = useState(2);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(2);
  const [eventName, setEventName] = useState('Carnival 2026');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '', birthYear: '0000' });
  const [kids, setKids] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [qrPayload, setQrPayload] = useState('');
  const [allStalls, setAllStalls] = useState([]);
  const [stallsLoaded, setStallsLoaded] = useState(false);
  const [charities, setCharities] = useState([]);
  const [charitiesLoaded, setCharitiesLoaded] = useState(false);

  const loadAdmin = async () => {
    const [statsRes, eventRes, usersRes] = await Promise.all([
      adminApi.getStats(),
      adminApi.getEvent(),
      adminApi.listUsers(),
    ]);
    setStats(statsRes);
    setEvent(eventRes);
    const currentRate = eventRes?.tokenRate ?? 2;
    setRate(currentRate);
    setRateInput(currentRate);
    setEventName(eventRes?.name || 'Carnival 2026');
    setUsers(usersRes);
  };

  const loadProfile = async () => {
    const [p, b, k, t, qr] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getKids(),
      userApi.getTransactions(),
      userApi.getQr(),
    ]);
    setProfile(p);
    setBalance(b);
    setKids(k);
    setTransactions(t);
    setQrPayload(qr.qrPayload);
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
    if (tab === 'Stalls' && !stallsLoaded) {
      loadStalls().catch((error) => setStatus(error.response?.data?.error || 'Unable to load stalls.'));
    }
  }, [tab, stallsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'Charities' && !charitiesLoaded) {
      charitiesApi.list().then(setCharities).catch(() => {}).finally(() => setCharitiesLoaded(true));
    }
  }, [tab, charitiesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = (nextTab) => {
    setStatus('');
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const run = async (action, message) => {
    try {
      await action();
      await loadAdmin();
      setStatus(message);
    } catch (error) {
      setStatus(error.response?.data?.error || 'Action failed.');
    }
  };

  const admins = users.filter((user) => user.roles?.includes('admin'));
  const nonAdminUsers = users.filter((user) => !user.roles?.includes('admin'));
  const userCount = users.filter((user) => user.roles?.includes('user')).length;

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
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {tab === 'Home' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <section style={{ ...card, textAlign: 'center', background: 'linear-gradient(135deg,#fffbeb,#fed7aa)' }}>
              <div style={{ fontSize: '0.8rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>
                {profile.name || 'Token Balance'}
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#b45309', lineHeight: 1 }}>{balance.tokenBalance}</div>
              <div style={{ fontSize: '0.9rem', color: '#78350f' }}>tokens remaining</div>
            </section>

            <section style={card}>
              <div style={{ fontWeight: 700, color: '#374151' }}>📲 Your Payment QR</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Stalls scan this to charge you</div>
              {qrPayload && <PrintableQR title="" qrValue={qrPayload} subtitle={`PIN: ${balance.birthYear || '0000'}`} />}
            </section>

            <button
              onClick={() => navigate('/scan')}
              style={{
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
                borderRadius: '1rem',
                padding: '1rem',
                fontSize: '1.1rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              📷 Pay a Stall
            </button>

            {kids.length > 0 && (
              <section style={card}>
                <div style={{ fontWeight: 700 }}>👦 Kids</div>
                {kids.map((kid) => (
                  <div key={kid.kidId} style={{ display: 'flex', justifyContent: 'space-between', background: '#fffbeb', borderRadius: '0.65rem', padding: '0.6rem 0.9rem' }}>
                    <span>{kid.name}</span>
                    <span style={{ color: '#b45309', fontWeight: 700 }}>{kid.spendingLimit - kid.spent} tokens left</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

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
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#b45309' }}>{stallsLoaded ? allStalls.length : '—'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Stalls</div>
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
              <input style={inp} value={eventName} placeholder="Event name" onChange={(eventValue) => setEventName(eventValue.target.value)} />
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
                  <button style={btn('secondary')} onClick={() => { setRateInput(rate); setEditingRate(true); }}>✏️ Edit</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>$1 =</span>
                  <input style={{ ...inp, maxWidth: '100px' }} type="number" min="1" value={rateInput} onChange={(eventValue) => setRateInput(Number(eventValue.target.value))} autoFocus />
                  <span style={{ fontWeight: 600 }}>tokens</span>
                  <button style={btn()} onClick={() => run(() => adminApi.setRate({ tokenRate: rateInput }), 'Rate updated.').then(() => setEditingRate(false))}>Save</button>
                  <button style={btn('secondary')} onClick={() => setEditingRate(false)}>Cancel</button>
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'Users' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>👥 Users ({userCount})</h2>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Rate: {rate} tokens / $1</div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {users.filter((user) => user.roles?.includes('user')).map((user) => (
                <TokenRow key={user.userId} user={user} tokenRate={rate} onDone={load} setStatus={setStatus} />
              ))}
            </div>
          </section>
        )}

        {tab === 'Stalls' && (
          <section style={card}>
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
          </section>
        )}

        {tab === 'Admins' && (
          <section style={card}>
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
          </section>
        )}

        {tab === 'Family' && null}
        {tab === 'My Stalls' && <StallsTab />}
        {tab === 'Browse' && <BrowseStallsTab />}
        {tab === 'Charities' && (
          <section style={card}>
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
          </section>
        )}
        {tab === 'Profile' && <ProfileTab profile={profile} balance={balance} event={event} isAdmin={isAdmin} setStatus={setStatus} onReload={load} kids={kids} setProfile={setProfile} />}
        {tab === 'History' && <HistoryTab transactions={transactions} />}
      </div>
    </Layout>
  );
}

export default AdminDashboard;
