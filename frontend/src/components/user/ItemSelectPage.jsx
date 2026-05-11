import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import stallsApi from '../../api/stalls';
import transactionsApi from '../../api/transactions';
import userApi from '../../api/user';
import Layout from '../common/Layout';

const card = { background: '#fff', border: '1px solid #fed7aa', borderRadius: '1rem', padding: '1.25rem', display: 'grid', gap: '0.85rem' };
const TYPE_META = {
  food: { icon: '🍕', color: '#b45309', bg: '#fef3c7' },
  game: { icon: '🎯', color: '#1d4ed8', bg: '#dbeafe' },
};

function ItemSelectPage({ mode }) {
  const { vendorId, stallId } = useParams();
  const targetId = mode === 'stall' ? stallId : vendorId;
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState({ vendorName: '', stallName: '', stall: {}, items: [] });
  const [kids, setKids] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [kidId, setKidId] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const loadCatalog = mode === 'stall'
      ? stallsApi.catalog(targetId)
      : transactionsApi.getVendorCatalog(targetId);

    Promise.all([loadCatalog, userApi.getKids()])
      .then(([cat, kidsRes]) => { setCatalog(cat); setKids(kidsRes || []); })
      .catch(e => setStatus(e.response?.data?.error || 'Unable to load catalog.'));
  }, [targetId, mode]);

  const totalTokens = useMemo(
    () => catalog.items.reduce((sum, item) => sum + (quantities[item.itemId] || 0) * Number(item.tokenPrice || 0), 0),
    [catalog.items, quantities]
  );

  const updateQty = (itemId, delta) =>
    setQuantities(q => ({ ...q, [itemId]: Math.max(0, (q[itemId] || 0) + delta) }));

  const handlePay = async () => {
    try {
      const payload = mode === 'stall'
        ? { stallId: targetId, items: catalog.items.map(i => ({ itemId: i.itemId, qty: quantities[i.itemId] || 0 })), kidId: kidId || null }
        : { vendorId: targetId, items: catalog.items.map(i => ({ itemId: i.itemId, qty: quantities[i.itemId] || 0 })), kidId: kidId || null };
      const res = await transactionsApi.transferTokens(payload);
      setResult(res);
      setStatus('✅ Payment complete!');
    } catch (e) { setStatus(e.response?.data?.error || 'Payment failed.'); }
  };

  const stall = catalog.stall || {};
  const typeMeta = TYPE_META[stall.stallType] || {};
  const displayName = catalog.stallName || catalog.vendorName || 'Stall';

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* stall header */}
        <section style={{ ...card, background: 'linear-gradient(135deg,#fffbeb,#fed7aa)' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>
            {typeMeta.icon || '🎪'} {displayName}
          </div>
          {stall.stallType && (
            <span style={{ background: typeMeta.bg, color: typeMeta.color, borderRadius: '1rem', padding: '0.2rem 0.7rem', fontSize: '0.85rem', fontWeight: 700, width: 'fit-content' }}>
              {stall.stallType === 'game' ? 'Game' : 'Food'}
            </span>
          )}
          {stall.description && <div style={{ color: '#374151', fontSize: '0.9rem' }}>{stall.description}</div>}
        </section>

        {status && <p style={{ margin: 0, color: result ? '#065f46' : '#92400e', background: result ? '#d1fae5' : '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {!result ? (
          <section style={card}>
            <div style={{ fontWeight: 700 }}>Choose Items</div>
            {catalog.items.length === 0 && <p style={{ color: '#6b7280' }}>No items available.</p>}
            {catalog.items.map(item => (
              <div key={item.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ color: '#b45309', fontSize: '0.9rem' }}>🪙 {item.tokenPrice} tokens</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button onClick={() => updateQty(item.itemId, -1)}
                    style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 700 }}>−</button>
                  <span style={{ minWidth: '1.5rem', textAlign: 'center', fontWeight: 700 }}>{quantities[item.itemId] || 0}</span>
                  <button onClick={() => updateQty(item.itemId, 1)}
                    style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
              </div>
            ))}

            {kids.length > 0 && (
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Charge to</label>
                <select value={kidId} onChange={e => setKidId(e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', marginTop: '0.25rem' }}>
                  <option value="">Myself</option>
                  {kids.map(kid => <option key={kid.kidId} value={kid.kidId}>{kid.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fed7aa', paddingTop: '0.75rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#b45309' }}>Total: {totalTokens} 🪙</div>
              <button onClick={handlePay} disabled={!totalTokens}
                style={{ background: totalTokens ? '#f59e0b' : '#d1d5db', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1.4rem', fontWeight: 700, cursor: totalTokens ? 'pointer' : 'default', fontSize: '1rem' }}>
                Pay Now
              </button>
            </div>
          </section>
        ) : (
          <section style={{ ...card, background: '#d1fae5', border: '1px solid #6ee7b7' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#065f46' }}>✅ Payment Sent!</div>
            <div style={{ color: '#047857' }}>Tokens charged: <strong>{result.totalTokens}</strong></div>
            <div style={{ color: '#047857' }}>New balance: <strong>{result.newBalance}</strong></div>
            <button onClick={() => navigate('/user')}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
              Back Home
            </button>
          </section>
        )}
      </div>
    </Layout>
  );
}

export default ItemSelectPage;
