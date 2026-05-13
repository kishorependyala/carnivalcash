import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import adminApi from '../../api/admin';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { HistoryTab, ProfileTab, card } from '../common/ProfileSections';
import { MergedStallsTab } from '../common/StallsTab';
import CharitiesTab from './CharitiesTab';

const TABS = ['Home', 'Stalls', 'Charities', 'Profile', 'History'];

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          style={{
            padding: '0.5rem 1.1rem', borderRadius: '2rem', border: 'none', cursor: 'pointer',
            background: active === t ? '#f59e0b' : '#f3f4f6',
            color: active === t ? '#fff' : '#374151',
            fontWeight: active === t ? 700 : 400,
          }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes('admin');

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || localStorage.getItem('cc_defaultTab') || 'Home');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '', birthYear: '0000' });
  const [kids, setKids] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [qrPayload, setQrPayload] = useState('');
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('');

  const load = async () => {
    const [p, b, k, t, qr, orders] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getKids(),
      userApi.getTransactions(),
      userApi.getQr(),
      userApi.getMyOrders().catch(() => []),
    ]);
    setProfile(p);
    setBalance(b);
    setKids(k);
    setTransactions(t);
    setUserOrders(orders);
    setQrPayload(qr.qrPayload);
    // Sync default tab from profile (no URL override)
    if (!searchParams.get('tab') && p.defaultTab && TABS.includes(p.defaultTab)) {
      localStorage.setItem('cc_defaultTab', p.defaultTab);
      setTab(p.defaultTab);
    } else if (p.defaultTab) {
      localStorage.setItem('cc_defaultTab', p.defaultTab);
    }
    if (isAdmin) {
      try { const ev = await adminApi.getEvent(); setEvent(ev); } catch (_) {}
    }
  };

  useEffect(() => { load().catch(() => setStatus('Unable to load dashboard.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = (t) => {
    setStatus('');
    setTab(t);
    setSearchParams({ tab: t }, { replace: true });
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {/* ── HOME ── */}
        {tab === 'Home' && (() => {
          const tokensSpent = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
          const tokensIssued = balance.tokenBalance + tokensSpent;
          return (
            <div style={{ display: 'grid', gap: '1rem' }}>

              {/* Box 1 – QR code */}
              <section style={{ ...card, textAlign: 'center', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', padding: '1.5rem 1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#92400e', marginBottom: '0.3rem' }}>📲 Your QR Code</div>
                <div style={{ fontSize: '0.82rem', color: '#78350f', marginBottom: '0.75rem' }}>Show this to stall owners — they'll scan it to charge you</div>
                {qrPayload && <PrintableQR title="" qrValue={qrPayload} subtitle={`PIN: ${balance.birthYear || '0000'}`} />}
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#92400e' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309', verticalAlign: 'middle' }}>{balance.tokenBalance}</span>
                  {' '}<span style={{ verticalAlign: 'middle' }}>tokens available</span>
                </div>
              </section>

              {/* Box 2 – Order button */}
              <button
                onClick={() => navigate('/scan')}
                style={{
                  background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  color: '#fff', border: 'none', borderRadius: '1.25rem',
                  padding: '1.75rem 1rem', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
                }}>
                <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>🛒</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Order from a Stall</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 400, opacity: 0.9 }}>Scan a stall's QR to browse &amp; order</span>
              </button>

              {/* Active orders */}
              {userOrders.length > 0 && (
                <section style={{ ...card, background: '#fffbeb' }}>
                  <div style={{ fontWeight: 700 }}>📋 Active Orders</div>
                  {userOrders.map(order => {
                    const isReady = order.status === 'ready';
                    const readyMsg = order.stallType === 'game' ? '🎯 Your turn!' : '🍕 Ready for pickup!';
                    return (
                      <div key={order.orderId} style={{ background: isReady ? '#d1fae5' : '#f9fafb', border: `1px solid ${isReady ? '#6ee7b7' : '#e5e7eb'}`, borderRadius: '0.75rem', padding: '0.75rem', display: 'grid', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{order.stallName}</span>
                          {isReady
                            ? <span style={{ background: '#059669', color: '#fff', borderRadius: '999px', padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>{readyMsg}</span>
                            : <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>#{order.position} in queue</span>}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{order.items.map(i => `${i.itemName} × ${i.qty}`).join(', ')}</div>
                        <div style={{ fontSize: '0.82rem', color: '#b45309' }}>🪙 {order.totalTokens} tokens</div>
                      </div>
                    );
                  })}
                </section>
              )}

              {/* Summary table */}
              <section style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.35rem 0', color: '#6b7280' }}>Total issued</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{tokensIssued}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem 0', color: '#6b7280' }}>Spent</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>−{tokensSpent}</td>
                    </tr>
                    <tr style={{ borderTop: '2px solid #fed7aa' }}>
                      <td style={{ padding: '0.5rem 0 0.25rem', fontWeight: 700, color: '#374151' }}>Available</td>
                      <td style={{ padding: '0.5rem 0 0.25rem', textAlign: 'right', fontWeight: 900, color: '#b45309', fontSize: '1.05rem' }}>🪙 {balance.tokenBalance}</td>
                    </tr>
                    {kids.map(kid => (
                      <tr key={kid.kidId} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.3rem 0', paddingLeft: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>👦 {kid.name}</td>
                        <td style={{ padding: '0.3rem 0', textAlign: 'right', fontSize: '0.85rem', color: '#b45309', fontWeight: 700 }}>{kid.spendingLimit - kid.spent} left</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

            </div>
          );
        })()}

        {tab === 'Profile' && (
          <ProfileTab profile={profile} balance={balance} event={event} isAdmin={isAdmin} setStatus={setStatus} onReload={load} kids={kids} setProfile={setProfile} tabs={TABS} />
        )}
        {tab === 'Stalls' && <MergedStallsTab />}
        {tab === 'Charities' && <CharitiesTab />}
        {tab === 'History' && (
          <HistoryTab transactions={transactions} />
        )}
      </div>
    </Layout>
  );
}

export default UserDashboard;
