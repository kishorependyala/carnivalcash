import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import eventsApi from '../../api/events';
import statsApi from '../../api/stats';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';

const shellStyle = {
  minHeight: '100vh',
  background: '#fff7ed',
  color: '#1f2937',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = {
  background: '#f59e0b',
  color: '#fff',
  padding: '1rem',
  boxShadow: '0 8px 20px rgba(245, 158, 11, 0.25)',
};

const headerInnerStyle = {
  maxWidth: '960px',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
};

const contentStyle = {
  flex: 1,
  width: '100%',
  maxWidth: '960px',
  margin: '0 auto',
  padding: '1rem 1rem 5rem',
  boxSizing: 'border-box',
};

const bottomBarStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  background: '#ffffff',
  borderTop: '2px solid #fed7aa',
  zIndex: 100,
};

const barInnerStyle = {
  maxWidth: '960px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
};

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  zIndex: 200,
};

const panelStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  maxHeight: '75vh',
  overflowY: 'auto',
  background: '#fff',
  borderRadius: '1.25rem 1.25rem 0 0',
  boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
  zIndex: 300,
  padding: '1.25rem 1.25rem 6rem',
  boxSizing: 'border-box',
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
        {stat('Stall Earned', stats.stallTokensEarned, '💰')}
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

function EventsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', type: 'announcement', scheduledFor: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    eventsApi
      .list()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!form.title.trim()) {
      return;
    }

    try {
      const created = await eventsApi.create(form);
      setEvents((prev) => [...prev, created]);
      setForm({ title: '', description: '', type: 'announcement', scheduledFor: '' });
      setAdding(false);
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(error.response?.data?.error || 'Failed');
    }
  };

  const remove = async (eventId) => {
    try {
      await eventsApi.remove(eventId);
      setEvents((prev) => prev.filter((event) => event.eventId !== eventId));
    } catch {
      // ignore delete failures in panel UI
    }
  };

  const typeIcon = (type) => (type === 'schedule' ? '📅' : '📢');

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>📅 Events & Announcements</h2>
        {isAdmin && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.45rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}
          >
            + Add
          </button>
        ) : null}
      </div>

      {isAdmin && adding ? (
        <div style={{ ...card, display: 'grid', gap: '0.5rem' }}>
          <input
            placeholder="Title *"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            style={{ padding: '0.7rem', borderRadius: '0.65rem', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box' }}
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            rows={2}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            style={{
              padding: '0.7rem',
              borderRadius: '0.65rem',
              border: '1px solid #d1d5db',
              width: '100%',
              boxSizing: 'border-box',
              resize: 'none',
            }}
          />
          <select
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            style={{ padding: '0.6rem', borderRadius: '0.65rem', border: '1px solid #d1d5db' }}
          >
            <option value="announcement">📢 Announcement</option>
            <option value="schedule">📅 Schedule Item</option>
          </select>
          <input
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))}
            style={{ padding: '0.6rem', borderRadius: '0.65rem', border: '1px solid #d1d5db' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={add}
              style={{ flex: 1, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.6rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Post
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.6rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <p style={{ color: '#6b7280', margin: 0 }}>Loading…</p> : null}
      {!loading && events.length === 0 ? <p style={{ color: '#6b7280', margin: 0 }}>No announcements yet.</p> : null}
      {events.map((event) => (
        <div key={event.eventId} style={{ ...card, display: 'grid', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ fontWeight: 700 }}>
              {typeIcon(event.type)} {event.title}
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => remove(event.eventId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            ) : null}
          </div>
          {event.description ? <div style={{ fontSize: '0.88rem', color: '#374151' }}>{event.description}</div> : null}
          {event.scheduledFor ? <div style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>🕐 {event.scheduledFor.replace('T', ' ')}</div> : null}
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Posted {event.createdAt?.slice(0, 10)}</div>
        </div>
      ))}
    </div>
  );
}

function BottomNav() {
  const { user } = useAuth();
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

  return (
    <>
      {panel ? (
        <div role="presentation" style={backdropStyle} onClick={() => setPanel(null)}>
          <div role="dialog" aria-modal="true" style={panelStyle} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPanel(null)}
              style={{ position: 'absolute', top: '0.75rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af' }}
            >
              ✕
            </button>
            {panel === 'stats' ? <StatsPanel /> : null}
            {panel === 'tokens' ? <TokensPanel /> : null}
            {panel === 'events' ? <EventsPanel /> : null}
          </div>
        </div>
      ) : null}
      <nav style={bottomBarStyle}>
        <div style={barInnerStyle}>
          {navBtn('stats', '📊', 'Stats')}
          {navBtn('tokens', '🪙', 'Tokens')}
          {navBtn('events', '📅', 'Events')}
        </div>
      </nav>
    </>
  );
}

// Root dashboard paths — no back button shown here
const ROOT_PATHS = ['/user', '/vendor', '/admin', '/'];

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSubPage = !ROOT_PATHS.includes(location.pathname);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fall back to role home
      if (user?.roles?.includes('admin')) navigate('/admin');
      else if (user?.roles?.includes('vendor')) navigate('/vendor');
      else navigate('/user');
    }
  };

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
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
            </div>
          </div>
          {user ? (
            <button type="button" onClick={logout} style={{ border: 0, borderRadius: '999px', padding: '0.65rem 1rem', fontWeight: 700 }}>
              Logout
            </button>
          ) : null}
        </div>
      </header>
      <main style={contentStyle}>{children}</main>
      <BottomNav />
    </div>
  );
}

export default Layout;
