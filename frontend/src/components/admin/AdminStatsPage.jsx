import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import adminApi from '../../api/admin';
import Layout from '../common/Layout';
import { usePolling } from '../../hooks/usePolling';

const card = {
  background: '#fffbeb',
  borderRadius: '0.85rem',
  padding: '1rem',
  border: '1px solid #fed7aa',
};

const btn = {
  background: '#f59e0b',
  color: '#fff',
  border: 'none',
  borderRadius: '0.65rem',
  padding: '0.5rem 1rem',
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
};

function StatTile({ label, value }) {
  return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#b45309' }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: '#92400e' }}>{label}</div>
    </div>
  );
}

function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ totalTokensIssued: 0, totalTokensSpent: 0, vendors: [], users: [], tokenLoadingByAdmin: [] });
  const [rate, setRate] = useState(2);
  const [stallCount, setStallCount] = useState(0);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [statsRes, eventRes, stallsRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getEvent(),
        adminApi.listStallsFull(),
      ]);
      setStats(statsRes || { totalTokensIssued: 0, totalTokensSpent: 0, vendors: [], users: [], tokenLoadingByAdmin: [] });
      setRate(eventRes?.tokenRate ?? 2);
      setStallCount(Array.isArray(stallsRes) ? stallsRes.length : 0);
    } catch (e) {
      setError(e?.response?.data?.error || 'Unable to load stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 10000);

  const topVendors = useMemo(() => {
    return [...(stats.vendors || [])]
      .sort((a, b) => (b.totalReceived || 0) - (a.totalReceived || 0))
      .slice(0, 10);
  }, [stats.vendors]);

  const topUsers = useMemo(() => {
    return [...(stats.users || [])]
      .sort((a, b) => (b.tokenBalance || 0) - (a.tokenBalance || 0))
      .slice(0, 10);
  }, [stats.users]);

  const doReset = async () => {
    if (!window.confirm('Reset ALL user token balances to 0 and clear token-loading history? This cannot be undone.')) return;
    setResetBusy(true);
    setResetMsg(null);
    try {
      const res = await adminApi.resetTokenBalances();
      setResetMsg({ ok: true, text: `Reset complete — ${res.usersZeroed} user(s) zeroed, ${res.logsRemoved} log entries cleared.` });
      await load();
      setTimeout(() => setResetMsg(null), 6000);
    } catch (e) {
      setResetMsg({ ok: false, text: e?.response?.data?.error || 'Reset failed.' });
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <Layout title="📊 Admin Stats" subtitle="Dedicated view for event-wide numbers and leaderboards.">
      <section style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Auto-refreshes every 10 seconds.</div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="button" style={btn} onClick={load}>Refresh</button>
            <Link to="/admin" style={{ ...btn, background: '#374151' }}>Back to Admin</Link>
          </div>
        </div>

        {error && (
          <div style={{ ...card, color: '#dc2626', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.75rem' }}>
          <StatTile label="Tokens Issued" value={stats.totalTokensIssued} />
          <StatTile label="Tokens Spent" value={stats.totalTokensSpent} />
          <StatTile label="Users" value={stats.users?.length || 0} />
          <StatTile label="Vendors" value={stats.vendors?.length || 0} />
          <StatTile label="Stalls" value={stallCount} />
          <StatTile label="Token Rate" value={`$1 = ${rate}`} />
        </div>

        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>💰 Token Loading by Admin</h3>
            <button type="button" onClick={doReset} disabled={resetBusy}
              style={{ ...btn, background: '#dc2626', fontSize: '0.82rem', padding: '0.35rem 0.85rem', opacity: resetBusy ? 0.6 : 1 }}>
              {resetBusy ? '⏳ Resetting…' : '🔄 Reset All Balances'}
            </button>
          </div>
          {resetMsg && (
            <div style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.5rem 0.85rem', borderRadius: '0.65rem', background: resetMsg.ok ? '#d1fae5' : '#fee2e2', color: resetMsg.ok ? '#065f46' : '#dc2626' }}>
              {resetMsg.ok ? '✅' : '❌'} {resetMsg.text}
            </div>
          )}
          {loading && (stats.tokenLoadingByAdmin || []).length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p> : null}
          {!loading && (stats.tokenLoadingByAdmin || []).length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>No token loads recorded yet.</p> : null}
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {(stats.tokenLoadingByAdmin || []).map((row, idx) => (
              <div key={row.adminId || idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '0.75rem', background: '#fff', borderRadius: '0.6rem', padding: '0.55rem 0.7rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{row.adminName || row.adminId}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{row.loadCount} load{row.loadCount !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, color: '#b45309' }}>🪙 {row.tokensLoaded}</div>
                  <div style={{ fontSize: '0.82rem', color: '#065f46', fontWeight: 700 }}>${row.dollarsCollected.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '0.75rem' }}>
          <section style={card}>
            <h3 style={{ margin: '0 0 0.7rem 0' }}>🏪 Top Vendors</h3>
            {loading && topVendors.length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p> : null}
            {!loading && topVendors.length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>No vendor stats yet.</p> : null}
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {topVendors.map((vendor, idx) => (
                <div key={vendor.vendorId || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: '#fff', borderRadius: '0.6rem', padding: '0.55rem 0.7rem' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{idx + 1}. {vendor.vendorName || 'Unnamed Vendor'}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{vendor.transactionCount || 0} transactions</div>
                  </div>
                  <div style={{ fontWeight: 900, color: '#b45309' }}>🪙 {vendor.totalReceived || 0}</div>
                </div>
              ))}
            </div>
          </section>

          <section style={card}>
            <h3 style={{ margin: '0 0 0.7rem 0' }}>👥 Top User Balances</h3>
            {loading && topUsers.length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p> : null}
            {!loading && topUsers.length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>No users found.</p> : null}
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {topUsers.map((user, idx) => (
                <div key={user.userId || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: '#fff', borderRadius: '0.6rem', padding: '0.55rem 0.7rem' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{idx + 1}. {user.name || user.phone || 'Unnamed User'}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.82rem' }}>{user.phone || 'No phone'}</div>
                  </div>
                  <div style={{ fontWeight: 900, color: '#b45309' }}>🪙 {user.tokenBalance || 0}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </Layout>
  );
}

export default AdminStatsPage;