import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import api from '../../api';
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
  const [searchParams] = useSearchParams();
  const preselectedStallId = searchParams.get('stallId') || '';
  const navigate = useNavigate();
  const [myStalls, setMyStalls] = useState([]);
  const [selectedStall, setSelectedStall] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [customerLabel, setCustomerLabel] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [pin, setPin] = useState('');

  const decodedUserId = decodeURIComponent(userId);
  const isCard = decodedUserId.startsWith('CARNIVAL_CARD:');
  const cardId = isCard ? decodedUserId.split(':')[1] : null;
  const [resolvedUserId, setResolvedUserId] = useState(decodedUserId);
  const isKid = resolvedUserId.startsWith('KID:');

  useEffect(() => {
    setResolvedUserId(decodedUserId);
    stallsApi.mine()
      .then(stalls => {
        setMyStalls(stalls);
        if (preselectedStallId) {
          const found = stalls.find(s => s.stallId === preselectedStallId);
          if (found) pickStall(found);
        } else if (stalls.length === 1) {
          pickStall(stalls[0]);
        }
      })
      .catch(() => setStatus('Unable to load your stalls.'));

    if (isCard && cardId) {
      api.get(`/api/cards/resolve/${cardId}`)
        .then(res => {
          const data = res.data;
          const nextResolved = data.linkedKidId ? `KID:${data.linkedUserId}:${data.linkedKidId}` : data.linkedUserId;
          setResolvedUserId(nextResolved);
          if (data.linkedKidId) {
            userApi.getPublicKid(data.linkedUserId, data.linkedKidId)
              .then(kid => {
                setCustomerLabel(`👦 ${kid.name}`);
                setCustomerName(kid.name);
              })
              .catch(() => {
                setCustomerLabel(`👦 ${data.linkedName || 'Kid'}`);
                setCustomerName(data.linkedName || 'Kid');
              });
            userApi.getPublicProfile(data.linkedUserId)
              .then(p => setCustomerPhone(p.phone || ''))
              .catch(() => {});
          } else {
            userApi.getPublicProfile(data.linkedUserId)
              .then(p => {
                setCustomerLabel(`👤 ${p.name || p.phone}`);
                setCustomerName(p.name || p.phone);
                setCustomerPhone(p.phone || '');
              })
              .catch(() => {
                setCustomerLabel(`👤 ${data.linkedName || 'Customer'}`);
                setCustomerName(data.linkedName || 'Customer');
              });
          }
        })
        .catch((error) => setStatus(error.response?.data?.error || 'Card not linked to any user yet.'));
      return;
    }

    if (decodedUserId.startsWith('KID:')) {
      const parts = decodedUserId.split(':');
      if (parts.length === 3) {
        const parentId = parts[1];
        const kidId = parts[2];
        userApi.getPublicProfile(parentId)
          .then(p => setCustomerPhone(p.phone || ''))
          .catch(() => {});
        userApi.getPublicKid(parentId, kidId)
          .then(kid => {
            setCustomerLabel(`👦 ${kid.name}`);
            setCustomerName(kid.name);
          })
          .catch(() => {
            setCustomerLabel('👦 Kid');
            setCustomerName('Kid');
          });
      }
      return;
    }

    userApi.getPublicProfile(decodedUserId)
      .then(p => {
        setCustomerLabel(`👤 ${p.name || p.phone}`);
        setCustomerName(p.name || p.phone);
        setCustomerPhone(p.phone || '');
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      const res = await stallsApi.charge(
        selectedStall.stallId,
        resolvedUserId,
        (catalog?.items || []).map(item => ({ itemId: item.itemId, qty: quantities[item.itemId] || 0 })),
        pin.trim(),
      );
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

        <section style={{ ...card, background: '#fffbeb' }}>
          <div style={{ fontWeight: 700 }}>Customer</div>
          <div style={{ color: '#374151', fontSize: '0.95rem', fontWeight: 600 }}>
            {customerLabel || (isCard ? '🎫 Card' : isKid ? '👦 Kid' : '👤 Customer')}
          </div>
          {customerPhone && (
            <div style={{ fontSize: '0.88rem', color: '#6b7280' }}>{customerPhone}</div>
          )}
          {isKid && (
            <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
              Tokens deducted from parent's balance.
            </div>
          )}
        </section>

        {status && !result && (
          <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>
        )}

        {result ? (
          <section style={{ ...card, background: '#d1fae5', border: '1px solid #6ee7b7' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#065f46' }}>✅ Charged!</div>
            <div style={{ color: '#047857' }}>Tokens charged: <strong>{result.totalTokens}</strong></div>
            <div style={{ color: '#047857' }}>Customer's new balance: <strong>{result.newBalance}</strong></div>
            <div style={{ color: '#047857' }}>Stall total: <strong>{result.stallBalance}</strong> tokens</div>
            <button onClick={() => navigate(-1)}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </section>
        ) : (
          <>
            {!preselectedStallId && myStalls.length > 1 && (
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

            {selectedStall && catalog && (
              <section style={card}>
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

                <div style={{ display: 'grid', gap: '0.75rem', borderTop: '1px solid #fed7aa', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <label style={{ fontWeight: 700, color: '#92400e' }}>
                      {customerName
                        ? `Hi ${customerName}, please enter your PIN`
                        : 'Ask customer to enter their PIN'}
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="Enter PIN"
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#b45309' }}>Total: {totalTokens} 🪙</div>
                    <button onClick={handleCharge} disabled={!totalTokens || pin.trim().length < 4}
                      style={{ background: totalTokens && pin.trim().length >= 4 ? '#f59e0b' : '#d1d5db', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1.4rem', fontWeight: 700, cursor: totalTokens && pin.trim().length >= 4 ? 'pointer' : 'default', fontSize: '1rem' }}>
                      Charge
                    </button>
                  </div>
                </div>
              </section>
            )}

            {myStalls.length === 0 && (
              <section style={card}>
                <div style={{ color: '#6b7280' }}>You don't have any stalls yet. Create one from the Stall tab.</div>
                <button onClick={() => navigate(-1)}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                  Go Back
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
