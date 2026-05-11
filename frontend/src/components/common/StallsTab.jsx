import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [form, setForm] = useState({ stallName: '', stallType: 'game', tokensPerItem: 3, description: '' });
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
      setForm({ stallName: '', stallType: 'game', tokensPerItem: 3, description: '' });
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
      <button onClick={submit} disabled={saving} style={actionBtn}>
        {saving ? 'Creating…' : '+ Create Stall'}
      </button>
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
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [txns, setTxns] = useState([]);
  const [showTxns, setShowTxns] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', tokenPrice: initialStall.tokensPerItem });
  const [addingItem, setAddingItem] = useState(false);
  const [status, setStatus] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestsLoaded, setJoinRequestsLoaded] = useState(false);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const typeMeta = TYPE_META[stall.stallType] || {};
  const isCreator = stall.createdBy === myUserId;

  useEffect(() => {
    setStall(initialStall);
    setNewItem({ name: '', tokenPrice: initialStall.tokensPerItem });
  }, [initialStall]);

  useEffect(() => {
    if (!expanded || joinRequestsLoaded) {
      return;
    }
    setJoinRequestsLoading(true);
    stallsApi.listJoinRequests(stall.stallId)
      .then((requests) => {
        setJoinRequests(requests);
        setJoinRequestsLoaded(true);
      })
      .catch(() => {
        setStatus('Failed to load join requests.');
      })
      .finally(() => setJoinRequestsLoading(false));
  }, [expanded, joinRequestsLoaded, stall.stallId]);

  const startEdit = () => {
    setForm({
      stallName: stall.stallName,
      stallType: stall.stallType,
      tokensPerItem: stall.tokensPerItem,
      description: stall.description,
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    try {
      const updated = await stallsApi.update(stall.stallId, { ...form, tokensPerItem: Number(form.tokensPerItem) });
      setStall(updated);
      setEditMode(false);
      setStatus('');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Save failed.');
    }
  };

  const removeMember = async (userId) => {
    try {
      const updated = await stallsApi.removeMember(stall.stallId, userId);
      setStall(updated);
      setStatus('');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed.');
    }
  };

  const toggleAdmin = async (memberId, makeAdmin) => {
    try {
      const updated = await stallsApi.toggleAdmin(stall.stallId, memberId, makeAdmin);
      setStall(updated);
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed to update admin.');
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) {
      return;
    }
    try {
      const updated = await stallsApi.addItem(stall.stallId, { ...newItem, tokenPrice: Number(newItem.tokenPrice) });
      setStall(updated);
      setNewItem({ name: '', tokenPrice: updated.tokensPerItem });
      setAddingItem(false);
      setStatus('');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed.');
    }
  };

  const toggleItem = async (item) => {
    try {
      const updated = await stallsApi.updateItem(stall.stallId, item.itemId, { active: !item.active });
      setStall(updated);
      setStatus('');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed.');
    }
  };

  const loadTxns = async () => {
    try {
      setTxns(await stallsApi.transactions(stall.stallId));
      setShowTxns(true);
      setStatus('');
    } catch {
      setStatus('Failed to load transactions.');
    }
  };

  const handleJoinRequest = async (userId, action) => {
    try {
      const updated = await stallsApi.handleJoinRequest(stall.stallId, userId, action);
      setStall(updated);
      setJoinRequests((updated.joinRequests || []).filter((request) => request.status === 'pending'));
      setJoinRequestsLoaded(true);
      setStatus('');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Failed to update join request.');
    }
  };

  return (
    <div style={{ ...card, gap: '0.75rem' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
        onClick={() => setExpanded((value) => !value)}
      >
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.4rem' }}>{typeMeta.icon}</span>
          <div>
            <div style={{ fontWeight: 900 }}>{stall.stallName}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>🪙 {stall.tokensPerItem}/item</div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
              👥 {stall.memberNames && Object.keys(stall.memberNames).length > 0
                ? Object.values(stall.memberNames).join(', ')
                : `${stall.members.length} member${stall.members.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ background: typeMeta.bg, color: typeMeta.color, borderRadius: '1rem', padding: '0.15rem 0.6rem', fontSize: '0.78rem', fontWeight: 700 }}>
            {typeMeta.label}
          </span>
          <span style={{ color: '#9ca3af' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '0.65rem', padding: '0.3rem 0.8rem', fontWeight: 700, fontSize: '0.9rem' }}>
          🪙 {stall.tokenBalance || 0} earned
        </span>
        {onScanCustomer && (
          <button onClick={() => onScanCustomer()} style={actionBtn}>
            📷 Scan Customer
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ display: 'grid', gap: '1rem', borderTop: '1px solid #fed7aa', paddingTop: '0.85rem' }}>
          {status && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{status}</p>}

          <div style={{ textAlign: 'center' }}>
            <PrintableQR title="" qrValue={`CARNIVAL_STALL:${stall.stallId}`} subtitle={`${stall.stallName} · Scan to pay`} />
          </div>

          {editMode ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <input style={inp} placeholder="Stall name" value={form.stallName} onChange={(event) => setForm((current) => ({ ...current, stallName: event.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['game', 'food'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, stallType: type }))}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
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
              <input type="number" style={inp} placeholder="Tokens per item" value={form.tokensPerItem} onChange={(event) => setForm((current) => ({ ...current, tokensPerItem: event.target.value }))} />
              <textarea style={{ ...inp, minHeight: '3rem', resize: 'vertical' }} placeholder="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={saveEdit} style={{ ...actionBtn, flex: 1 }}>Save</button>
                <button onClick={() => setEditMode(false)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.6rem', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                {stall.description || <em style={{ color: '#9ca3af' }}>No description</em>}
              </div>
              <button onClick={startEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>✏️ Edit</button>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 700 }}>Items</div>
              <button onClick={() => setAddingItem((value) => !value)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 700 }}>
                {addingItem ? 'Cancel' : '+ Add Item'}
              </button>
            </div>
            {stall.items.length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                Default: {stall.tokensPerItem} token{stall.tokensPerItem !== 1 ? 's' : ''} per item. Add named sub-items optionally.
              </div>
            )}
            {stall.items.map((item) => (
              <div key={item.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6', opacity: item.active ? 1 : 0.45 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  <span style={{ color: '#b45309', fontSize: '0.85rem', marginLeft: '0.4rem' }}>🪙 {item.tokenPrice}</span>
                </div>
                <button onClick={() => toggleItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#6b7280' }}>
                  {item.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
            {addingItem && (
              <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.5rem' }}>
                <input style={inp} placeholder="Item name" value={newItem.name} onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} />
                <input type="number" style={inp} placeholder="Token price" value={newItem.tokenPrice} onChange={(event) => setNewItem((current) => ({ ...current, tokenPrice: event.target.value }))} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={addItem} style={{ ...actionBtn, flex: 1 }}>Add</button>
                  <button onClick={() => setAddingItem(false)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.5rem', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Members</div>
            {stall.members.map((uid) => {
              const isKid = uid.startsWith('KID:');
              const isStallAdmin = (stall.stallAdmins || []).includes(uid);
              const displayName = uid === myUserId ? 'You' : (stall.memberNames?.[uid] || (isKid ? uid : `…${uid.slice(-8)}`));
              return (
                <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
                  <span style={{ fontSize: '0.9rem' }}>
                    {isKid ? '👦' : '👤'} {displayName} {isStallAdmin && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '0.5rem', padding: '0.1rem 0.4rem', fontSize: '0.75rem', fontWeight: 700 }}>👑 Admin</span>}
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {isCreator && uid !== stall.createdBy && (
                      <button onClick={() => toggleAdmin(uid, !isStallAdmin)} style={{ background: isStallAdmin ? '#fef3c7' : '#f3f4f6', border: 'none', borderRadius: '0.5rem', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e' }}>
                        {isStallAdmin ? 'Revoke Admin' : 'Make Admin'}
                      </button>
                    )}
                    {(isCreator || uid === myUserId) && uid !== stall.createdBy && (
                      <button onClick={() => removeMember(uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem' }}>Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Add member</div>
              <MemberAdder stallId={stall.stallId} onUpdated={setStall} />
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Join Requests</div>
            {joinRequestsLoading && <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>Loading join requests…</p>}
            {!joinRequestsLoading && joinRequests.length === 0 && <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>No pending join requests.</p>}
            {!joinRequestsLoading && joinRequests.map((request) => (
              <div key={request.userId} style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem', display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>
                <div style={{ fontWeight: 700 }}>{request.userName || request.userId}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{request.requestedAt}</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleJoinRequest(request.userId, 'approve')} style={{ ...actionBtn, flex: 1, background: '#059669' }}>Approve</button>
                  <button onClick={() => handleJoinRequest(request.userId, 'reject')} style={{ flex: 1, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '0.65rem', padding: '0.5rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <div style={{ fontWeight: 700 }}>Transactions</div>
              {!showTxns && <button onClick={loadTxns} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 700 }}>Load</button>}
            </div>
            {showTxns && txns.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No transactions yet.</p>}
            {showTxns && txns.map((tx) => (
              <div key={`${tx.txId}-${tx.itemId}`} style={{ background: '#fffbeb', borderRadius: '0.65rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                <div style={{ fontWeight: 700 }}>{tx.userName} · {tx.itemName} × {tx.qty}</div>
                <div style={{ color: '#b45309' }}>🪙 {tx.amount}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{tx.timestamp}</div>
              </div>
            ))}
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
          onScanCustomer={user?.roles?.includes('vendor') ? () => navigate('/vendor/scan') : undefined}
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
