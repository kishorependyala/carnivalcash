import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import charitiesApi from '../../api/charities';
import stallsApi from '../../api/stalls';
import { useAuth } from '../../context/AuthContext';
import PrintableQR from './PrintableQR';
import { card, inp } from './ProfileSections';

export const TYPE_META = {
  food: { icon: '🍕', label: 'Food', color: '#b45309', bg: '#fef3c7' },
  game: { icon: '🎯', label: 'Game', color: '#1d4ed8', bg: '#dbeafe' },
};

const actionBtn = {
  background: '#f59e0b',
  color: '#fff',
  border: 'none',
  borderRadius: '0.65rem',
  padding: '0.5rem 0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
};

export function CreateStallForm({ onCreated }) {
  const [form, setForm] = useState({ stallName: '', stallType: 'game', tokensPerItem: 3, description: '', charities: [] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.stallName.trim()) {
      setErr('Stall name is required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const stall = await stallsApi.create({ ...form, tokensPerItem: Number(form.tokensPerItem) });
      onCreated(stall);
      setForm({ stallName: '', stallType: 'game', tokensPerItem: 3, description: '', charities: [] });
    } catch (error) {
      setErr(error.response?.data?.error || 'Failed to create stall.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem', background: '#fffbeb', borderRadius: '1rem', padding: '1rem' }}>
      <div style={{ fontWeight: 700 }}>Create New Stall</div>
      {err && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.9rem' }}>{err}</p>}
      <input style={inp} placeholder="Stall name *" value={form.stallName} onChange={(event) => set('stallName', event.target.value)} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {['game', 'food'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => set('stallType', type)}
            style={{
              flex: 1,
              padding: '0.6rem',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              border: `2px solid ${form.stallType === type ? '#f59e0b' : '#e5e7eb'}`,
              background: form.stallType === type ? '#fef3c7' : '#f9fafb',
              fontWeight: form.stallType === type ? 700 : 400,
            }}
          >
            {TYPE_META[type].icon} {TYPE_META[type].label}
          </button>
        ))}
      </div>
      <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
        Tokens per {form.stallType === 'game' ? 'play' : 'serving'}
        <input type="number" min={1} style={{ ...inp, marginTop: '0.25rem' }} value={form.tokensPerItem} onChange={(event) => set('tokensPerItem', event.target.value)} />
      </label>
      <textarea
        style={{ ...inp, resize: 'vertical', minHeight: '3rem' }}
        placeholder="Description (optional)"
        value={form.description}
        onChange={(event) => set('description', event.target.value)}
      />
      <CharityConfig charities={form.charities} onChange={(value) => setForm((current) => ({ ...current, charities: value }))} />
      <button onClick={submit} disabled={saving} style={actionBtn}>
        {saving ? 'Creating…' : '+ Create Stall'}
      </button>
    </div>
  );
}

function CharityConfig({ charities, onChange }) {
  const [allCharities, setAllCharities] = useState([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [pickId, setPickId] = useState('');

  useEffect(() => {
    charitiesApi.list().then(setAllCharities).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPct = (charities || []).reduce((sum, charity) => sum + (charity.percentage || 0), 0);

  const addExisting = () => {
    if (!pickId) {
      return;
    }
    if ((charities || []).some((charity) => charity.charityId === pickId)) {
      return;
    }
    const found = allCharities.find((charity) => charity.charityId === pickId);
    if (!found) {
      return;
    }
    const remaining = Math.max(0, 100 - totalPct);
    onChange([...(charities || []), { charityId: found.charityId, name: found.name, percentage: remaining }]);
    setPickId('');
  };

  const addNew = async () => {
    if (!newName.trim()) {
      return;
    }
    try {
      const created = await charitiesApi.add({ name: newName.trim(), description: newDesc.trim() });
      setAllCharities((current) => (current.some((charity) => charity.charityId === created.charityId) ? current : [...current, created]));
      const remaining = Math.max(0, 100 - totalPct);
      onChange([...(charities || []), { charityId: created.charityId, name: created.name, percentage: remaining }]);
      setNewName('');
      setNewDesc('');
      setAddingNew(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add charity');
    }
  };

  const remove = (charityId) => onChange((charities || []).filter((charity) => charity.charityId !== charityId));

  const setPct = (charityId, pct) => onChange((charities || []).map((charity) => (
    charity.charityId === charityId
      ? { ...charity, percentage: Math.min(100, Math.max(0, parseInt(pct, 10) || 0)) }
      : charity
  )));

  const unselectedCharities = allCharities.filter((charity) => !(charities || []).some((selected) => selected.charityId === charity.charityId));

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
        💝 Charities {totalPct > 0 && <span style={{ color: '#059669', fontSize: '0.8rem' }}>({totalPct}% of earnings donated)</span>}
      </div>

      {(charities || []).map((charity) => (
        <div key={charity.charityId} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.65rem', padding: '0.5rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem' }}>💚 {charity.name}</span>
          <input
            type="number"
            min="1"
            max="100"
            value={charity.percentage}
            onChange={(event) => setPct(charity.charityId, event.target.value)}
            style={{ width: '60px', padding: '0.3rem 0.5rem', borderRadius: '0.4rem', border: '1px solid #d1d5db', textAlign: 'center' }}
          />
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>%</span>
          <button onClick={() => remove(charity.charityId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.9rem' }}>✕</button>
        </div>
      ))}

      {totalPct > 100 && (
        <div style={{ color: '#dc2626', fontSize: '0.82rem' }}>⚠️ Total exceeds 100% — please adjust.</div>
      )}

      {unselectedCharities.length > 0 && !addingNew && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={pickId} onChange={(event) => setPickId(event.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.65rem', border: '1px solid #d1d5db' }}>
            <option value="">— Pick existing charity —</option>
            {unselectedCharities.map((charity) => (
              <option key={charity.charityId} value={charity.charityId}>{charity.name}</option>
            ))}
          </select>
          <button onClick={addExisting} disabled={!pickId} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.5rem 0.9rem', fontWeight: 700, cursor: pickId ? 'pointer' : 'default', opacity: pickId ? 1 : 0.5 }}>
            Add
          </button>
        </div>
      )}

      {!addingNew ? (
        <button onClick={() => setAddingNew(true)} style={{ background: 'none', border: '1px dashed #059669', color: '#059669', borderRadius: '0.65rem', padding: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
          + Add new charity
        </button>
      ) : (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.65rem', padding: '0.75rem', display: 'grid', gap: '0.4rem' }}>
          <input style={inp} placeholder="Charity name *" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <input style={inp} placeholder="Description (optional)" value={newDesc} onChange={(event) => setNewDesc(event.target.value)} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={addNew} style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>Save & Add</button>
            <button onClick={() => { setAddingNew(false); setNewName(''); setNewDesc(''); }} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.5rem', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberAdder({ stallId, onUpdated }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const search = async (value) => {
    setQ(value);
    if (value.length < 3) {
      setResults([]);
      return;
    }
    try {
      setResults(await stallsApi.searchUsers(value));
    } catch {
      setResults([]);
    }
  };

  const add = async (user) => {
    try {
      const updated = await stallsApi.addMember(stallId, user.userId, isAdmin);
      setResults([]);
      setQ('');
      setIsAdmin(false);
      setStatus('');
      onUpdated(updated);
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <input style={inp} placeholder="Search by phone or name…" value={q} onChange={(event) => search(event.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
        Make stall admin
      </label>
      {results.map((user) => (
        <button
          key={user.userId}
          onClick={() => add(user)}
          style={{
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '0.65rem',
            padding: '0.45rem 0.75rem',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            gap: '0.5rem',
            fontSize: '0.9rem',
          }}
        >
          {user.isKid ? `👦 ${user.name}` : `👤 ${user.name || user.phone}${user.phone ? ` · ${user.phone}` : ''}`}
        </button>
      ))}
      {status && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{status}</p>}
    </div>
  );
}

export function StallCard({ stall: initialStall, myUserId, onScanCustomer }) {
  const [stall, setStall] = useState(initialStall);
  const [txns, setTxns] = useState([]);
  const [showTxns, setShowTxns] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestsLoaded, setJoinRequestsLoaded] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [manageSection, setManageSection] = useState('details'); // 'details'|'members'|'items'
  const [form, setForm] = useState({});
  const [newItem, setNewItem] = useState({ name: '', tokenPrice: initialStall.tokensPerItem });
  const [manageStatus, setManageStatus] = useState('');
  const typeMeta = TYPE_META[stall.stallType] || {};
  const isCreator = stall.createdBy === myUserId;
  const isAdmin = (stall.stallAdmins || []).includes(myUserId);
  const canManage = isCreator || isAdmin;

  useEffect(() => {
    setStall(initialStall);
    setNewItem({ name: '', tokenPrice: initialStall.tokensPerItem });
    setOrders([]);
    setOrdersLoaded(false);
  }, [initialStall]);

  useEffect(() => {
    if (joinRequestsLoaded) return;
    stallsApi.listJoinRequests(stall.stallId)
      .then((requests) => { setJoinRequests(requests); setJoinRequestsLoaded(true); })
      .catch(() => {});
  }, [joinRequestsLoaded, stall.stallId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ordersLoaded || !isAdmin) return;
    stallsApi.getStallOrders(stall.stallId)
      .then((result) => { setOrders(result); setOrdersLoaded(true); })
      .catch(() => {});
  }, [ordersLoaded, isAdmin, stall.stallId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openManage = () => {
    setForm({ stallName: stall.stallName, stallType: stall.stallType, tokensPerItem: stall.tokensPerItem, description: stall.description, charities: stall.charities || [] });
    setManageStatus('');
    setManageSection('details');
    setShowManage(true);
  };

  const saveDetails = async () => {
    try {
      const updated = await stallsApi.update(stall.stallId, { ...form, tokensPerItem: Number(form.tokensPerItem) });
      setStall(updated);
      setManageStatus('✅ Saved!');
    } catch (e) { setManageStatus(e.response?.data?.error || 'Save failed.'); }
  };

  const removeMember = async (uid) => {
    try { const u = await stallsApi.removeMember(stall.stallId, uid); setStall(u); setManageStatus('Removed.'); }
    catch (e) { setManageStatus(e.response?.data?.error || 'Failed.'); }
  };

  const toggleAdmin = async (uid, makeAdmin) => {
    try { const u = await stallsApi.toggleAdmin(stall.stallId, uid, makeAdmin); setStall(u); }
    catch (e) { setManageStatus(e.response?.data?.error || 'Failed.'); }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) return;
    try {
      const u = await stallsApi.addItem(stall.stallId, { ...newItem, tokenPrice: Number(newItem.tokenPrice) });
      setStall(u); setNewItem({ name: '', tokenPrice: u.tokensPerItem }); setManageStatus('✅ Item added.');
    } catch (e) { setManageStatus(e.response?.data?.error || 'Failed.'); }
  };

  const toggleItem = async (item) => {
    try { const u = await stallsApi.updateItem(stall.stallId, item.itemId, { active: !item.active }); setStall(u); }
    catch (e) { setManageStatus(e.response?.data?.error || 'Failed.'); }
  };

  const loadTxns = async () => {
    try { setTxns(await stallsApi.transactions(stall.stallId)); setShowTxns(true); }
    catch { setStatus('Failed to load transactions.'); }
  };

  const handleJoinRequest = async (userId, action) => {
    try {
      const u = await stallsApi.handleJoinRequest(stall.stallId, userId, action);
      setStall(u);
      setJoinRequests((u.joinRequests || []).filter((r) => r.status === 'pending'));
      setJoinRequestsLoaded(true);
    } catch (e) { setStatus(e.response?.data?.error || 'Failed.'); }
  };

  return (
    <div style={{ ...card, gap: '0.85rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.4rem' }}>{typeMeta.icon}</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>{stall.stallName}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>🪙 {stall.tokensPerItem}/item · {stall.members.length} member{stall.members.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ background: typeMeta.bg, color: typeMeta.color, borderRadius: '1rem', padding: '0.15rem 0.6rem', fontSize: '0.78rem', fontWeight: 700 }}>{typeMeta.label}</span>
          <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '1rem', padding: '0.15rem 0.6rem', fontSize: '0.78rem', fontWeight: 700 }}>🪙 {stall.tokenBalance || 0}</span>
          {canManage && (
            <button onClick={openManage} style={{ background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: '0.65rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontWeight: 700, color: '#92400e', fontSize: '0.82rem' }}>⚙️ Manage</button>
          )}
        </div>
      </div>

      {status && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{status}</p>}

      {/* ── Two-column: QR | Create Order ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>
        <section style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderRadius: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxSizing: 'border-box' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#92400e' }}>📲 Stall QR</div>
          <PrintableQR title="" qrValue={`CARNIVAL_STALL:${stall.stallId}`} subtitle={stall.stallName} />
        </section>
        {onScanCustomer ? (
          <button onClick={() => onScanCustomer()} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '1rem', padding: '1.5rem 1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(245,158,11,0.3)', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '2rem', lineHeight: 1 }}>🛒</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>Create Order</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 400, opacity: 0.9 }}>Scan customer QR to charge</span>
          </button>
        ) : (
          <div style={{ background: '#f3f4f6', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>Not a member</div>
        )}
      </div>

      {/* ── Members (read-only) ── */}
      <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.65rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#374151', marginBottom: '0.35rem' }}>👥 Members</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {stall.members.map((uid) => {
            const isKid = uid.startsWith('KID:');
            const isStallAdmin = (stall.stallAdmins || []).includes(uid);
            const displayName = uid === myUserId ? 'You' : (stall.memberNames?.[uid] || (isKid ? uid : `…${uid.slice(-8)}`));
            return (
              <span key={uid} style={{ background: isStallAdmin ? '#fef3c7' : '#f3f4f6', color: isStallAdmin ? '#92400e' : '#374151', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.82rem', fontWeight: isStallAdmin ? 700 : 400 }}>
                {isKid ? '👦' : '👤'} {displayName}{isStallAdmin ? ' 👑' : ''}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Join Requests ── */}
      {joinRequests.length > 0 && (
        <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.65rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#374151', marginBottom: '0.35rem' }}>
            ⏳ Join Requests
            <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.75rem', marginLeft: '0.4rem' }}>{joinRequests.length}</span>
          </div>
          {joinRequests.map((req) => (
            <div key={req.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: '#fffbeb', borderRadius: '0.65rem', padding: '0.5rem 0.75rem', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>👤 {req.userName || req.userId}</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => handleJoinRequest(req.userId, 'approve')} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.75rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>✓ Approve</button>
                <button onClick={() => handleJoinRequest(req.userId, 'reject')} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.6rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Open Orders (admin) ── */}
      {isAdmin && orders.filter(o => o.status === 'pending' || o.status === 'ready').length > 0 && (
        <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.65rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#374151', marginBottom: '0.35rem' }}>
            📋 Open Orders
            <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '999px', padding: '0.1rem 0.45rem', fontSize: '0.75rem', marginLeft: '0.4rem' }}>{orders.filter(o => o.status === 'pending').length}</span>
          </div>
          {orders.filter(o => o.status === 'pending' || o.status === 'ready').map((order, idx) => {
            const isReady = order.status === 'ready';
            return (
              <div key={order.orderId} style={{ background: isReady ? '#d1fae5' : '#fffbeb', border: `1px solid ${isReady ? '#6ee7b7' : '#fed7aa'}`, borderRadius: '0.75rem', padding: '0.65rem', marginBottom: '0.35rem', display: 'grid', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>#{idx + 1} · {order.kidName ? `${order.kidName} (via ${order.userName})` : order.userName}</span>
                  <span style={{ background: isReady ? '#059669' : '#f59e0b', color: '#fff', borderRadius: '999px', padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>{isReady ? 'Ready' : 'Pending'}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{order.items.map(i => `${i.itemName} × ${i.qty}`).join(', ')} · 🪙 {order.totalTokens}</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!isReady && <button onClick={async () => { const u = await stallsApi.updateOrder(stall.stallId, order.orderId, 'ready'); setOrders(p => p.map(o => o.orderId === order.orderId ? u : o)); }} style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.4rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>{stall.stallType === 'game' ? 'Your Turn 🎯' : 'Ready 🍕'}</button>}
                  <button onClick={async () => { await stallsApi.updateOrder(stall.stallId, order.orderId, 'complete'); setOrders(p => p.filter(o => o.orderId !== order.orderId)); }} style={{ flex: 1, background: '#374151', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.4rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>✓ Complete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Transactions ── */}
      <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.65rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#374151' }}>Transactions</div>
          {!showTxns && <button onClick={loadTxns} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem' }}>Load</button>}
        </div>
        {showTxns && txns.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>No transactions yet.</p>}
        {showTxns && txns.map((tx) => (
          <div key={`${tx.txId}-${tx.itemId}`} style={{ background: '#fffbeb', borderRadius: '0.65rem', padding: '0.4rem 0.7rem', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>{tx.userName} · {tx.itemName} × {tx.qty}</div>
            <div style={{ color: '#b45309' }}>🪙 {tx.amount} <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.4rem' }}>{tx.timestamp}</span></div>
          </div>
        ))}
      </div>

      {/* ── Manage Modal ── */}
      {showManage && (
        <div onClick={() => setShowManage(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '1.5rem 1.5rem 0 0', width: '100%', maxWidth: '560px', padding: '1.5rem 1.25rem 6rem', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 -4px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ width: '2.5rem', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#92400e' }}>⚙️ Manage: {stall.stallName}</div>
              <button onClick={() => setShowManage(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            {/* Section tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[['details','✏️ Details'],['members','👥 Members'],['items','🛍 Items']].map(([key, label]) => (
                <button key={key} onClick={() => { setManageSection(key); setManageStatus(''); }} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: manageSection === key ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#f3f4f6', color: manageSection === key ? '#fff' : '#374151' }}>{label}</button>
              ))}
            </div>
            {manageStatus && <p style={{ margin: '0 0 1rem', padding: '0.6rem 1rem', background: '#fffbeb', color: '#92400e', borderRadius: '0.75rem', fontSize: '0.88rem' }}>{manageStatus}</p>}

            {/* Details */}
            {manageSection === 'details' && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>Stall Name<input style={inp} value={form.stallName} onChange={(e) => setForm(f => ({ ...f, stallName: e.target.value }))} /></label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['game', 'food'].map((type) => (
                    <button key={type} type="button" onClick={() => setForm(f => ({ ...f, stallType: type }))} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', cursor: 'pointer', border: `2px solid ${form.stallType === type ? '#f59e0b' : '#e5e7eb'}`, background: form.stallType === type ? '#fef3c7' : '#f9fafb', fontWeight: form.stallType === type ? 700 : 400 }}>
                      {TYPE_META[type].icon} {TYPE_META[type].label}
                    </button>
                  ))}
                </div>
                <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>Tokens per item<input type="number" style={inp} value={form.tokensPerItem} onChange={(e) => setForm(f => ({ ...f, tokensPerItem: e.target.value }))} /></label>
                <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>Description<textarea style={{ ...inp, minHeight: '3rem', resize: 'vertical' }} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></label>
                <CharityConfig charities={form.charities} onChange={(v) => setForm(f => ({ ...f, charities: v }))} />
                <button onClick={saveDetails} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>Save Changes</button>
              </div>
            )}

            {/* Members */}
            {manageSection === 'members' && (
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {stall.members.map((uid) => {
                  const isKid = uid.startsWith('KID:');
                  const isStallAdmin = (stall.stallAdmins || []).includes(uid);
                  const displayName = uid === myUserId ? 'You' : (stall.memberNames?.[uid] || (isKid ? uid : `…${uid.slice(-8)}`));
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', borderRadius: '0.75rem', padding: '0.6rem 0.85rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{isKid ? '👦' : '👤'} {displayName}{isStallAdmin ? ' 👑' : ''}</span>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {isCreator && uid !== stall.createdBy && <button onClick={() => toggleAdmin(uid, !isStallAdmin)} style={{ background: '#fef3c7', border: 'none', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>{isStallAdmin ? 'Revoke 👑' : 'Make 👑'}</button>}
                        {(isCreator || uid === myUserId) && uid !== stall.createdBy && <button onClick={() => removeMember(uid)} style={{ background: '#fee2e2', border: 'none', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Remove</button>}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', color: '#374151' }}>➕ Add Member</div>
                  <MemberAdder stallId={stall.stallId} onUpdated={setStall} />
                </div>
              </div>
            )}

            {/* Items */}
            {manageSection === 'items' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {stall.items.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: 0 }}>Default: {stall.tokensPerItem} token{stall.tokensPerItem !== 1 ? 's' : ''}/item. Add named items below.</p>}
                {stall.items.map((item) => (
                  <div key={item.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', borderRadius: '0.75rem', padding: '0.6rem 0.85rem', opacity: item.active ? 1 : 0.5 }}>
                    <span><span style={{ fontWeight: 600 }}>{item.name}</span><span style={{ color: '#b45309', marginLeft: '0.4rem', fontSize: '0.85rem' }}>🪙 {item.tokenPrice}</span></span>
                    <button onClick={() => toggleItem(item)} style={{ background: item.active ? '#fee2e2' : '#d1fae5', border: 'none', borderRadius: '0.5rem', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', color: item.active ? '#dc2626' : '#059669', fontWeight: 600 }}>{item.active ? 'Disable' : 'Enable'}</button>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', display: 'grid', gap: '0.4rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#374151' }}>➕ New Item</div>
                  <input style={inp} placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem(n => ({ ...n, name: e.target.value }))} />
                  <input type="number" style={inp} placeholder="Token price" value={newItem.tokenPrice} onChange={(e) => setNewItem(n => ({ ...n, tokenPrice: e.target.value }))} />
                  <button onClick={addItem} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>Add Item</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export function StallsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stalls, setStalls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stallsApi.mine()
      .then((result) => setStalls(result))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onStallCreated = (stall) => {
    setStalls((current) => [stall, ...current]);
    setShowCreate(false);
  };

  if (loading) {
    return <p style={{ color: '#9ca3af' }}>Loading stalls…</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>🎪 My Stalls</div>
        <button onClick={() => setShowCreate((value) => !value)} style={{ ...actionBtn, borderRadius: '1rem' }}>
          {showCreate ? 'Cancel' : '+ New Stall'}
        </button>
      </div>

      {showCreate && <CreateStallForm onCreated={onStallCreated} />}

      {stalls.length === 0 && !showCreate && (
        <section style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🎪</div>
          <div style={{ color: '#6b7280' }}>You're not part of any stalls yet.</div>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Create one above, or request to join from Browse.</div>
        </section>
      )}

      {stalls.map((stall) => (
        <StallCard
          key={stall.stallId}
          stall={stall}
          myUserId={user?.userId}
          onScanCustomer={() => navigate(`/vendor/scan?stallId=${stall.stallId}`)}
        />
      ))}
    </div>
  );
}

export function BrowseStallsTab() {
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    stallsApi.listAll()
      .then((result) => setStalls(result))
      .catch((error) => setStatus(error.response?.data?.error || 'Unable to load stalls.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestJoin = async (stallId) => {
    try {
      setBusyId(stallId);
      await stallsApi.requestJoin(stallId);
      setStalls((current) => current.map((stall) => (
        stall.stallId === stallId ? { ...stall, hasPendingRequest: true } : stall
      )));
      setStatus('Join request submitted.');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Unable to request access.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return <p style={{ color: '#9ca3af' }}>Loading stalls…</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}
      {stalls.length === 0 && <section style={card}><p style={{ margin: 0, color: '#6b7280' }}>No stalls yet.</p></section>}
      {stalls.map((stall) => {
        const typeMeta = TYPE_META[stall.stallType] || TYPE_META.game;
        const expanded = expandedId === stall.stallId;
        return (
          <section key={stall.stallId} style={{ ...card, gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? '' : stall.stallId)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'grid', gap: '0.35rem', flex: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{typeMeta.icon}</span>
                  <strong style={{ fontSize: '1rem' }}>{stall.stallName}</strong>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>{stall.memberCount} member{stall.memberCount !== 1 ? 's' : ''}</div>
                <div style={{ color: '#374151', fontSize: '0.9rem' }}>{stall.description || 'No description yet.'}</div>
              </button>
              <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'end' }}>
                {stall.isMember ? (
                  <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '999px', padding: '0.35rem 0.7rem', fontWeight: 700, fontSize: '0.85rem' }}>✓ Member</span>
                ) : stall.hasPendingRequest ? (
                  <span style={{ background: '#e5e7eb', color: '#374151', borderRadius: '999px', padding: '0.35rem 0.7rem', fontWeight: 700, fontSize: '0.85rem' }}>⏳ Pending</span>
                ) : (
                  <button onClick={() => requestJoin(stall.stallId)} disabled={busyId === stall.stallId} style={{ ...actionBtn, background: '#d97706' }}>
                    {busyId === stall.stallId ? 'Sending…' : 'Request to Join'}
                  </button>
                )}
                <span style={{ background: typeMeta.bg, color: typeMeta.color, borderRadius: '999px', padding: '0.2rem 0.7rem', fontWeight: 700, fontSize: '0.8rem' }}>
                  {typeMeta.label}
                </span>
              </div>
            </div>
            {expanded && (
              <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.85rem', display: 'grid', gap: '0.5rem' }}>
                <div><strong>Stall ID:</strong> {stall.stallId}</div>
                <div><strong>Name:</strong> {stall.stallName}</div>
                <div><strong>Type:</strong> {typeMeta.label}</div>
                <div><strong>Description:</strong> {stall.description || 'No description yet.'}</div>
                <div><strong>Members:</strong> {stall.memberCount}</div>
                <div><strong>Tokens / item:</strong> {stall.tokensPerItem}</div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const subTab = (active) => ({
  padding: '0.4rem 0.9rem',
  borderRadius: '2rem',
  border: 'none',
  cursor: 'pointer',
  background: active ? '#f59e0b' : '#f3f4f6',
  color: active ? '#fff' : '#374151',
  fontWeight: active ? 700 : 400,
  fontSize: '0.9rem',
});

export function MergedStallsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myStalls, setMyStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(''); // eslint-disable-line no-unused-vars
  const [popup, setPopup] = useState(null); // 'create' | null

  useEffect(() => {
    stallsApi.mine()
      .then((result) => { setMyStalls(result); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onStallCreated = (stall) => {
    setMyStalls((prev) => [stall, ...prev]);
    setPopup(null);
  };

  if (loading) return <p style={{ color: '#9ca3af' }}>Loading stalls…</p>;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>

      {/* Sub-navigation */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={{ ...subTab(false), background: '#f59e0b', color: '#fff', fontWeight: 700 }}
          onClick={() => setPopup('create')}
        >
          + Add / Join Stall
        </button>
      </div>

      {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

      {/* ── My Stalls ── */}
      <>
        {myStalls.length === 0 && (
            <section style={{ ...card, textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '2.5rem' }}>🎪</div>
              <div style={{ fontWeight: 700, color: '#374151' }}>No stalls yet</div>
              <div style={{ fontSize: '0.88rem', color: '#6b7280' }}>Create your own stall or request to join an existing one.</div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setPopup('create')} style={actionBtn}>+ Add / Join a Stall</button>
              </div>
            </section>
          )}
          {myStalls.map((stall) => (
            <StallCard
              key={stall.stallId}
              stall={stall}
              myUserId={user?.userId}
              onScanCustomer={() => navigate(`/vendor/scan?stallId=${stall.stallId}`)}
            />
          ))}
      </>

      {/* ── Add / Join popup ── */}
      {popup === 'create' && (
        <div
          onClick={() => setPopup(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '1.5rem', padding: '1.75rem 1.5rem', maxWidth: '460px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}
          >
            {/* Popup header with close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#92400e' }}>🎪 Add / Join a Stall</div>
              <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>✕</button>
            </div>

            {/* Popup content */}
            <CreateStallForm onCreated={onStallCreated} />
          </div>
        </div>
      )}

    </div>
  );
}
