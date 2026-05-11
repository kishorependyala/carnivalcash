import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import stallsApi from '../../api/stalls';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { ProfileEditTab, ProfileViewTab, card, inp } from '../common/ProfileSections';

const TABS = ['Stalls', 'Profile', 'Edit', 'History'];
const TYPE_META = {
  food: { icon: '🍕', label: 'Food', color: '#b45309', bg: '#fef3c7' },
  game: { icon: '🎯', label: 'Game', color: '#1d4ed8', bg: '#dbeafe' },
};

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

function CreateStallForm({ onCreated }) {
  const [form, setForm] = useState({ stallName: '', stallType: 'game', tokensPerItem: 3, description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.stallName.trim()) { setErr('Stall name is required.'); return; }
    setSaving(true); setErr('');
    try {
      const stall = await stallsApi.create({ ...form, tokensPerItem: Number(form.tokensPerItem) });
      onCreated(stall);
    } catch (e) { setErr(e.response?.data?.error || 'Failed to create stall.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem', background: '#fffbeb', borderRadius: '1rem', padding: '1rem' }}>
      <div style={{ fontWeight: 700 }}>Create New Stall</div>
      {err && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.9rem' }}>{err}</p>}
      <input style={inp} placeholder="Stall name *" value={form.stallName} onChange={e => set('stallName', e.target.value)} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {['game', 'food'].map(type => (
          <button key={type} type="button" onClick={() => set('stallType', type)}
            style={{
              flex: 1, padding: '0.6rem', borderRadius: '0.75rem', cursor: 'pointer',
              border: `2px solid ${form.stallType === type ? '#f59e0b' : '#e5e7eb'}`,
              background: form.stallType === type ? '#fef3c7' : '#f9fafb',
              fontWeight: form.stallType === type ? 700 : 400,
            }}>
            {TYPE_META[type].icon} {TYPE_META[type].label}
          </button>
        ))}
      </div>
      <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
        Tokens per {form.stallType === 'game' ? 'play' : 'serving'}
        <input type="number" min={1} style={{ ...inp, marginTop: '0.25rem' }}
          value={form.tokensPerItem} onChange={e => set('tokensPerItem', e.target.value)} />
      </label>
      <textarea style={{ ...inp, resize: 'vertical', minHeight: '3rem' }}
        placeholder="Description (optional)"
        value={form.description} onChange={e => set('description', e.target.value)} />
      <button onClick={submit} disabled={saving}
        style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Creating…' : '+ Create Stall'}
      </button>
    </div>
  );
}

function MemberAdder({ stallId, onUpdated }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  const search = async (val) => {
    setQ(val);
    if (val.length < 3) { setResults([]); return; }
    try { setResults(await stallsApi.searchUsers(val)); } catch { setResults([]); }
  };

  const add = async (u) => {
    try {
      const updated = await stallsApi.addMember(stallId, u.phone);
      setResults([]); setQ(''); setStatus(''); onUpdated(updated);
    } catch (e) { setStatus(e.response?.data?.error || 'Failed.'); }
  };

  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <input style={inp} placeholder="Search by phone or name…" value={q} onChange={e => search(e.target.value)} />
      {results.map(u => (
        <button key={u.userId} onClick={() => add(u)}
          style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '0.65rem', padding: '0.45rem 0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '0.5rem', fontSize: '0.9rem' }}>
          📱 {u.phone}{u.name ? ` — ${u.name}` : ''}
        </button>
      ))}
      {status && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{status}</p>}
    </div>
  );
}

function StallCard({ stall: initialStall, myUserId, onScanCustomer }) {
  const [stall, setStall] = useState(initialStall);
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [txns, setTxns] = useState([]);
  const [showTxns, setShowTxns] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', tokenPrice: initialStall.tokensPerItem });
  const [addingItem, setAddingItem] = useState(false);
  const [status, setStatus] = useState('');
  const typeMeta = TYPE_META[stall.stallType] || {};
  const isCreator = stall.createdBy === myUserId;

  const startEdit = () => {
    setForm({ stallName: stall.stallName, stallType: stall.stallType, tokensPerItem: stall.tokensPerItem, description: stall.description });
    setEditMode(true);
  };

  const saveEdit = async () => {
    try {
      const updated = await stallsApi.update(stall.stallId, { ...form, tokensPerItem: Number(form.tokensPerItem) });
      setStall(updated); setEditMode(false);
    } catch (e) { setStatus(e.response?.data?.error || 'Save failed.'); }
  };

  const removeMember = async (userId) => {
    try { const updated = await stallsApi.removeMember(stall.stallId, userId); setStall(updated); }
    catch (e) { setStatus(e.response?.data?.error || 'Failed.'); }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) return;
    try {
      const updated = await stallsApi.addItem(stall.stallId, { ...newItem, tokenPrice: Number(newItem.tokenPrice) });
      setStall(updated); setNewItem({ name: '', tokenPrice: stall.tokensPerItem }); setAddingItem(false);
    } catch (e) { setStatus(e.response?.data?.error || 'Failed.'); }
  };

  const toggleItem = async (item) => {
    try { const updated = await stallsApi.updateItem(stall.stallId, item.itemId, { active: !item.active }); setStall(updated); }
    catch (e) { setStatus(e.response?.data?.error || 'Failed.'); }
  };

  const loadTxns = async () => {
    try { const t = await stallsApi.transactions(stall.stallId); setTxns(t); setShowTxns(true); }
    catch (e) { setStatus('Failed to load transactions.'); }
  };

  return (
    <div style={{ ...card, gap: '0.75rem' }}>
      {/* header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1.4rem' }}>{typeMeta.icon}</span>
          <div>
            <div style={{ fontWeight: 900 }}>{stall.stallName}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              🪙 {stall.tokensPerItem}/item · {stall.members.length} member{stall.members.length !== 1 ? 's' : ''}
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

      {/* quick actions */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '0.65rem', padding: '0.3rem 0.8rem', fontWeight: 700, fontSize: '0.9rem' }}>
          🪙 {stall.tokenBalance || 0} earned
        </span>
        <button onClick={() => onScanCustomer()}
          style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.4rem 0.85rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
          📷 Scan Customer
        </button>
      </div>

      {expanded && (
        <div style={{ display: 'grid', gap: '1rem', borderTop: '1px solid #fed7aa', paddingTop: '0.85rem' }}>
          {status && <p style={{ margin: 0, color: '#dc2626', fontSize: '0.85rem' }}>{status}</p>}

          {/* stall QR */}
          <div style={{ textAlign: 'center' }}>
            <PrintableQR title="" qrValue={`CARNIVAL_STALL:${stall.stallId}`} subtitle={`${stall.stallName} · Scan to pay`} />
          </div>

          {/* edit stall info */}
          {editMode ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <input style={inp} placeholder="Stall name" value={form.stallName} onChange={e => setForm(f => ({ ...f, stallName: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['game', 'food'].map(type => (
                  <button key={type} type="button" onClick={() => setForm(f => ({ ...f, stallType: type }))}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', cursor: 'pointer', border: `2px solid ${form.stallType === type ? '#f59e0b' : '#e5e7eb'}`, background: form.stallType === type ? '#fef3c7' : '#f9fafb', fontWeight: form.stallType === type ? 700 : 400 }}>
                    {TYPE_META[type].icon} {TYPE_META[type].label}
                  </button>
                ))}
              </div>
              <input type="number" style={inp} placeholder="Tokens per item" value={form.tokensPerItem} onChange={e => setForm(f => ({ ...f, tokensPerItem: e.target.value }))} />
              <textarea style={{ ...inp, minHeight: '3rem', resize: 'vertical' }} placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={saveEdit} style={{ flex: 1, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.6rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditMode(false)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.6rem', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                {stall.description || <em style={{ color: '#9ca3af' }}>No description</em>}
              </div>
              <button onClick={startEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>✏️ Edit</button>
            </div>
          )}

          {/* items management */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 700 }}>Items</div>
              <button onClick={() => setAddingItem(a => !a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 700 }}>
                {addingItem ? 'Cancel' : '+ Add Item'}
              </button>
            </div>
            {stall.items.length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                Default: {stall.tokensPerItem} token{stall.tokensPerItem !== 1 ? 's' : ''} per item. Add named sub-items optionally.
              </div>
            )}
            {stall.items.map(item => (
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
                <input style={inp} placeholder="Item name" value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} />
                <input type="number" style={inp} placeholder="Token price" value={newItem.tokenPrice} onChange={e => setNewItem(n => ({ ...n, tokenPrice: e.target.value }))} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={addItem} style={{ flex: 1, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.65rem', padding: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => setAddingItem(false)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.5rem', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* members management */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Members</div>
            {stall.members.map(uid => (
              <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' }}>
                <span style={{ fontSize: '0.9rem' }}>{uid === myUserId ? '👤 You' : `👤 …${uid.slice(-8)}`}</span>
                {(isCreator || uid === myUserId) && uid !== stall.createdBy && (
                  <button onClick={() => removeMember(uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem' }}>Remove</button>
                )}
              </div>
            ))}
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Add member</div>
              <MemberAdder stallId={stall.stallId} onUpdated={setStall} />
            </div>
          </div>

          {/* transactions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <div style={{ fontWeight: 700 }}>Transactions</div>
              {!showTxns && <button onClick={loadTxns} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 700 }}>Load</button>}
            </div>
            {showTxns && txns.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No transactions yet.</p>}
            {showTxns && txns.map(tx => (
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

function VendorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes('admin');

  const [tab, setTab] = useState('Stalls');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '' });
  const [transactions, setTransactions] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState('');

  const load = async () => {
    const [p, b, t, s] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getTransactions(),
      stallsApi.mine(),
    ]);
    setProfile(p);
    setBalance(b);
    setTransactions(t);
    setStalls(s);
  };

  useEffect(() => { load().catch(() => setStatus('Unable to load vendor dashboard.')); }, []);

  const changeTab = (t) => { setStatus(''); setTab(t); };

  const onStallCreated = (stall) => {
    setStalls(s => [stall, ...s]);
    setShowCreate(false);
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {tab === 'Stalls' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>🎪 My Stalls</div>
              <button onClick={() => setShowCreate(s => !s)}
                style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '1rem', padding: '0.5rem 1rem', fontWeight: 700, cursor: 'pointer' }}>
                {showCreate ? 'Cancel' : '+ New Stall'}
              </button>
            </div>

            {showCreate && <CreateStallForm onCreated={onStallCreated} />}

            {stalls.length === 0 && !showCreate && (
              <section style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem' }}>🎪</div>
                <div style={{ color: '#6b7280' }}>You're not part of any stalls yet.</div>
                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Create one or ask a stall owner to add you.</div>
              </section>
            )}

            {stalls.map(stall => (
              <StallCard
                key={stall.stallId}
                stall={stall}
                myUserId={user?.userId}
                onScanCustomer={() => navigate('/vendor/scan')}
              />
            ))}
          </div>
        )}

        {tab === 'Profile' && (
          <ProfileViewTab profile={profile} balance={balance} event={null} isAdmin={isAdmin} setStatus={setStatus} onReload={load} />
        )}
        {tab === 'Edit' && (
          <ProfileEditTab profile={profile} setProfile={setProfile} setStatus={setStatus} onTabChange={changeTab} />
        )}
        {tab === 'History' && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {transactions.length === 0 && <p style={{ color: '#6b7280' }}>No transactions yet.</p>}
            {transactions.map(tx => (
              <div key={`${tx.txId}-${tx.itemId || tx.stallId}`}
                style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.9rem' }}>
                <div style={{ fontWeight: 700 }}>{tx.stallName || tx.vendorName || 'Stall'} · {tx.itemName}</div>
                <div style={{ color: '#b45309' }}>🪙 {tx.amount}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{tx.timestamp}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default VendorDashboard;
