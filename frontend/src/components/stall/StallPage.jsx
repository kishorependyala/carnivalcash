import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import stallsApi from '../../api/stalls';
import { useAuth } from '../../context/AuthContext';
import { usePolling } from '../../hooks/usePolling';
import { useSettings } from '../../context/SettingsContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { card } from '../common/ProfileSections';
import { TYPE_META } from '../common/StallsTab';

const btn = {
  border: 'none',
  borderRadius: '0.75rem',
  padding: '0.65rem 1rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.92rem',
};

export default function StallPage() {
  const { stallId } = useParams();
  const { user } = useAuth();
  const { pollIntervalSec } = useSettings();
  const navigate = useNavigate();

  const [stall, setStall] = useState(null);
  const [orders, setOrders] = useState([]);
  const [txns, setTxns] = useState([]);
  const [status, setStatus] = useState('');

  const myUserId = user?.userId;

  const load = useCallback(async () => {
    try {
      const [s, o, t] = await Promise.all([
        stallsApi.get(stallId),
        stallsApi.getStallOrders(stallId),
        stallsApi.transactions(stallId),
      ]);
      setStall(s);
      setOrders(Array.isArray(o) ? o : []);
      setTxns(Array.isArray(t) ? t : []);
    } catch (e) {
      setStatus(e.response?.data?.error || 'Unable to load stall.');
    }
  }, [stallId]);

  useEffect(() => { load(); }, [load]);
  usePolling(load, pollIntervalSec * 1000);

  const advanceOrder = async (orderId, newStatus) => {
    try {
      const updated = await stallsApi.updateOrder(stallId, orderId, newStatus);
      setOrders(prev => newStatus === 'complete'
        ? prev.filter(o => o.orderId !== orderId)
        : prev.map(o => o.orderId === orderId ? updated : o));
    } catch (e) { setStatus(e.response?.data?.error || 'Failed to update order.'); }
  };

  if (!stall) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          {status || 'Loading stall…'}
        </div>
      </Layout>
    );
  }

  const typeMeta = TYPE_META[stall.stallType] || {};
  // eslint-disable-next-line no-unused-vars
  const isAdmin = (stall.stallAdmins || []).includes(myUserId) || stall.createdBy === myUserId;
  const isMember = (stall.members || []).includes(myUserId);
  const openOrders = orders.filter(o => o.status === 'pending' || o.status === 'ready');

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem', maxWidth: '560px', margin: '0 auto', padding: '0.5rem 0 4rem' }}>

        {/* ── Stall header ── */}
        <div style={{ ...card, gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <span style={{ fontSize: '2rem', lineHeight: 1 }}>{typeMeta.icon}</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#1f2937' }}>{stall.stallName}</div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                  🪙 {stall.tokensPerItem} token{stall.tokensPerItem !== 1 ? 's' : ''}/item · {stall.members?.length || 0} member{stall.members?.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
              <span style={{ background: typeMeta.bg, color: typeMeta.color, borderRadius: '1rem', padding: '0.15rem 0.65rem', fontSize: '0.8rem', fontWeight: 700 }}>{typeMeta.label}</span>
              <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '1rem', padding: '0.15rem 0.65rem', fontSize: '0.8rem', fontWeight: 700 }}>🪙 {stall.tokenBalance || 0} earned</span>
            </div>
          </div>
          {stall.description ? <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{stall.description}</div> : null}
        </div>

        {status && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.88rem', textAlign: 'center' }}>{status}</p>}

        {/* ── Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {isMember && (
            <button
              onClick={() => navigate(`/vendor/scan?stallId=${stallId}`)}
              style={{ ...btn, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}
            >
              <span style={{ fontSize: '2rem', lineHeight: 1 }}>🛒</span>
              <span style={{ fontSize: '1rem', fontWeight: 800 }}>Charge Customer</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>Scan customer QR</span>
            </button>
          )}
          <div style={{ ...card, padding: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', gridColumn: isMember ? 'auto' : '1 / -1' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e' }}>📲 Stall QR</div>
            <PrintableQR title="" qrValue={`CARNIVAL_STALL:${stallId}`} subtitle={stall.stallName} />
          </div>
        </div>

        {/* ── Open Orders ── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: openOrders.length ? '0.65rem' : 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1f2937' }}>
              📋 Open Orders
              {openOrders.length > 0 && (
                <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                  {openOrders.length}
                </span>
              )}
            </div>
          </div>

          {openOrders.length === 0 && (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.88rem' }}>No open orders right now. Refreshing every {pollIntervalSec}s.</p>
          )}

          {openOrders.map((order, idx) => {
            const isReady = order.status === 'ready';
            return (
              <div key={order.orderId} style={{ background: isReady ? '#d1fae5' : '#fffbeb', border: `1.5px solid ${isReady ? '#6ee7b7' : '#fed7aa'}`, borderRadius: '0.85rem', padding: '0.75rem', marginBottom: '0.5rem', display: 'grid', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>#{idx + 1} · {order.kidName ? `${order.kidName} (via ${order.userName})` : order.userName}</span>
                  <span style={{ background: isReady ? '#059669' : '#f59e0b', color: '#fff', borderRadius: '999px', padding: '0.15rem 0.55rem', fontSize: '0.78rem', fontWeight: 700 }}>
                    {isReady ? 'Ready ✅' : 'Pending'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  {order.items.map(i => `${i.itemName} × ${i.qty}`).join(', ')} · 🪙 {order.totalTokens}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                  {!isReady && (
                    <button
                      onClick={() => advanceOrder(order.orderId, 'ready')}
                      style={{ ...btn, flex: 1, background: '#059669', color: '#fff', padding: '0.55rem' }}
                    >
                      {stall.stallType === 'game' ? 'Your Turn 🎯' : 'Ready 🍕'}
                    </button>
                  )}
                  <button
                    onClick={() => advanceOrder(order.orderId, 'complete')}
                    style={{ ...btn, flex: 1, background: '#374151', color: '#fff', padding: '0.55rem' }}
                  >
                    ✓ Done
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Recent Transactions ── */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1f2937', marginBottom: txns.length ? '0.65rem' : 0 }}>
            💸 Recent Transactions
          </div>
          {txns.length === 0 && <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.88rem' }}>No transactions yet.</p>}
          {txns.slice(0, 20).map((tx) => (
            <div key={`${tx.txId}-${tx.itemId}`} style={{ background: '#fffbeb', borderRadius: '0.65rem', padding: '0.45rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700 }}>{tx.userName}</span>
                <span style={{ color: '#6b7280' }}> · {tx.itemName} × {tx.qty}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#b45309', fontWeight: 700 }}>🪙 {tx.amount}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>{tx.timestamp}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Members ── */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1f2937', marginBottom: '0.5rem' }}>👥 Members</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {(stall.members || []).map(uid => {
              const isStallAdmin = (stall.stallAdmins || []).includes(uid);
              const isKid = uid.startsWith('KID:');
              const name = uid === myUserId ? 'You' : (stall.memberNames?.[uid] || (isKid ? uid : `…${uid.slice(-8)}`));
              return (
                <span key={uid} style={{ background: isStallAdmin ? '#fef3c7' : '#f3f4f6', color: isStallAdmin ? '#92400e' : '#374151', borderRadius: '999px', padding: '0.2rem 0.7rem', fontSize: '0.82rem', fontWeight: isStallAdmin ? 700 : 400 }}>
                  {isKid ? '👦' : '👤'} {name}{isStallAdmin ? ' 👑' : ''}
                </span>
              );
            })}
          </div>
        </div>

      </div>
    </Layout>
  );
}
