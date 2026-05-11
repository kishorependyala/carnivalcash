import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import stallsApi from '../../api/stalls';
import userApi from '../../api/user';
import Layout from '../common/Layout';

const card = {
  background: '#fff', border: '1px solid #fed7aa', borderRadius: '1rem',
  padding: '1.25rem', display: 'grid', gap: '0.9rem',
};

const TYPE_META = {
  food: { icon: '🍕', color: '#b45309', bg: '#fef3c7' },
  game: { icon: '🎯', color: '#1d4ed8', bg: '#dbeafe' },
};

function VendorChargePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [myStalls, setMyStalls] = useState([]);
  const [selectedStall, setSelectedStall] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [userProfile, setUserProfile] = useState(null);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    stallsApi.mine()
      .then(stalls => {
        setMyStalls(stalls);
        if (stalls.length === 1) pickStall(stalls[0]);
      })
      .catch(() => setStatus('Unable to load your stalls.'));

    // Load target user info
    fetch(`/api/user/public/${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setUserProfile(p); })
      .catch(() => {});
  }, [userId]);

  const pickStall = async (stall) => {
    setSelectedStall(stall);
    setQuantities({});
    try {
      const cat = await stallsApi.catalog(stall.stallId);
      setCatalog(cat);
    } catch {
      setStatus('Unable to load stall catalog.');
    }
  };

  const updateQty = (itemId, delta) =>
    setQuantities(q => ({ ...q, [itemId]: Math.max(0, (q[itemId] || 0) + delta) }));

  const totalTokens = (catalog?.items || []).reduce(
    (sum, item) => sum + (quantities[item.itemId] || 0) * Number(item.tokenPrice || 0), 0
  );

  const handleCharge = async () => {
    if (!selectedStall || !totalTokens) return;
    try {
      const res = await stallsApi.charge(selectedStall.stallId, {
        userId,
        items: (catalog?.items || []).map(item => ({ itemId: item.itemId, qty: quantities[item.itemId] || 0 })),
      });
      setResult(res);
      setStatus('');
    } catch (e) {
      setStatus(e.response?.data?.error || 'Charge failed.');
    }
  };

  const typeMeta = TYPE_META[selectedStall?.stallType] || {};

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>💳 Charge Customer</div>

        {/* customer info */}
        {userId && (
          <section style={{ ...card, background: '#fffbeb' }}>
            <div style={{ fontWeight: 700 }}>👤 Customer</div>
            <div style={{ color: '#374151', fontSize: '0.95rem' }}>
              {userProfile ? (userProfile.name || userProfile.phone) : `ID: ${userId}`}
            </div>
          </section>
        )}

        {status && !result && (
          <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>
        )}

        {result ? (
          <section style={{ ...card, background: '#d1fae5', border: '1px solid #6ee7b7' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#065f46' }}>✅ Charged!</div>
            <div style={{ color: '#047857' }}>Tokens charged: <strong>{result.totalTokens}</strong></div>
            <div style={{ color: '#047857' }}>Customer's new balance: <strong>{result.newBalance}</strong></div>
            <div style={{ color: '#047857' }}>Stall total: <strong>{result.stallBalance}</strong> tokens</div>
            <button onClick={() => navigate('/vendor')}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </section>
        ) : (
          <>
            {/* stall selector (if multiple stalls) */}
            {myStalls.length > 1 && (
              <section style={card}>
                <div style={{ fontWeight: 700 }}>Select Stall</div>
                {myStalls.map(stall => {
                  const meta = TYPE_META[stall.stallType] || {};
                  return (
                    <button key={stall.stallId} onClick={() => pickStall(stall)}
                      style={{
                        background: selectedStall?.stallId === stall.stallId ? '#fef3c7' : '#f9fafb',
                        border: `2px solid ${selectedStall?.stallId === stall.stallId ? '#f59e0b' : '#e5e7eb'}`,
                        borderRadius: '0.75rem', padding: '0.8rem', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', gap: '0.5rem', alignItems: 'center',
                      }}>
                      <span>{meta.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700 }}>{stall.stallName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>🪙 {stall.tokensPerItem} per item</div>
                      </div>
                    </button>
                  );
                })}
              </section>
            )}

            {/* items */}
            {selectedStall && catalog && (
              <section style={card}>
                {/* stall header */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.4rem' }}>{typeMeta.icon}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{selectedStall.stallName}</div>
                    {selectedStall.description && <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{selectedStall.description}</div>}
                  </div>
                </div>

                <div style={{ fontWeight: 700 }}>Select Items</div>
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #fed7aa', paddingTop: '0.75rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#b45309' }}>Total: {totalTokens} 🪙</div>
                  <button onClick={handleCharge} disabled={!totalTokens}
                    style={{ background: totalTokens ? '#f59e0b' : '#d1d5db', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1.4rem', fontWeight: 700, cursor: totalTokens ? 'pointer' : 'default', fontSize: '1rem' }}>
                    Charge
                  </button>
                </div>
              </section>
            )}

            {myStalls.length === 0 && (
              <section style={card}>
                <div style={{ color: '#6b7280' }}>You don't have any stalls yet. Create one from the Vendor dashboard.</div>
                <button onClick={() => navigate('/vendor')}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                  Go to Dashboard
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default VendorChargePage;
