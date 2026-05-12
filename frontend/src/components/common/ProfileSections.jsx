/**
 * Shared profile/kids/history/stall tab content used by both UserDashboard, AdminDashboard, and VendorDashboard.
 */
import { useEffect, useState } from 'react';

import adminApi from '../../api/admin';
import stallsApi from '../../api/stalls';
import userApi from '../../api/user';
import vendorApi from '../../api/vendor';
import PrintableQR from './PrintableQR';

export const SOCIAL_META = {
  gmail:     { label: 'Gmail',     color: '#EA4335', bg: '#fde8e7', icon: 'G' },
  yahoo:     { label: 'Yahoo',     color: '#6001D2', bg: '#ede7f6', icon: 'Y!' },
  instagram: { label: 'Instagram', color: '#E1306C', bg: '#fce4ec', icon: '📷' },
  facebook:  { label: 'Facebook',  color: '#1877F2', bg: '#e3f0fd', icon: 'f' },
};

export const card = {
  background: '#fff',
  border: '1px solid #fed7aa',
  borderRadius: '1rem',
  padding: '1.25rem',
  display: 'grid',
  gap: '0.85rem',
};

export const inp = {
  padding: '0.8rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid #d1d5db',
  width: '100%',
  boxSizing: 'border-box',
};

/* ── colorful social media badge ── */
export function SocialBadge({ platform, handle }) {
  const meta = SOCIAL_META[platform];
  if (!meta || !handle) return null;
  const href = platform === 'instagram'
    ? `https://instagram.com/${handle}`
    : platform === 'facebook'
    ? `https://facebook.com/${handle}`
    : `mailto:${handle}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        background: meta.bg, color: meta.color,
        borderRadius: '2rem', padding: '0.35rem 0.85rem',
        fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
      }}>
      <span style={{ fontWeight: 900 }}>{meta.icon}</span>
      {handle}
    </a>
  );
}

/* ── Profile view tab ── */
export function ProfileViewTab({ profile, balance, event, isAdmin, setStatus, onReload }) {
  const [dollars, setDollars] = useState('');
  const socials = profile.socials || {};
  const hasSocials = Object.values(socials).some(Boolean);
  const rate = event?.tokenRate || 10;
  const tokens = dollars > 0 ? Math.floor(parseFloat(dollars) * rate) : null;

  const loadTokens = async () => {
    if (!tokens) return;
    try {
      await adminApi.addTokens({ phone: profile.phone, amount: tokens });
      await onReload();
      setDollars('');
      setStatus(`✅ Loaded ${tokens} tokens ($${dollars} × ${rate} rate).`);
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to load tokens.'); }
  };

  return (
    <section style={card}>
      <h2 style={{ margin: 0 }}>👤 {profile.name || profile.phone}</h2>
      <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>📱 {profile.phone}</div>
      {profile.name && <div><strong>Name:</strong> {profile.name}</div>}

      {hasSocials && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {Object.entries(socials).map(([k, v]) => v ? <SocialBadge key={k} platform={k} handle={v} /> : null)}
        </div>
      )}

      {/* balance badge */}
      <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fed7aa)', borderRadius: '0.85rem', padding: '0.75rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Balance</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309' }}>{balance?.tokenBalance ?? 0} tokens</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>PIN</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#78350f' }}>{balance?.pin}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Birth Year</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#78350f' }}>{balance?.birthYear === '0000' ? 'Not set' : balance?.birthYear}</div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.85rem', display: 'grid', gap: '0.6rem' }}>
          <div style={{ fontWeight: 700, color: '#b45309' }}>🪙 Load Tokens (Admin)</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Rate: {rate} tokens / $1</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>$</span>
            <input type="number" min="1" step="1"
              style={{ ...inp, maxWidth: '120px' }} placeholder="Dollars"
              value={dollars} onChange={e => setDollars(e.target.value)} />
            {tokens != null && <span style={{ color: '#b45309', fontWeight: 700 }}>= {tokens} tokens</span>}
            <button onClick={loadTokens} disabled={!tokens}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontWeight: 700, cursor: 'pointer', opacity: tokens ? 1 : 0.5 }}>
              Add Tokens
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Profile edit tab ── */
export function ProfileEditTab({ profile, setProfile, onSave, setStatus, onTabChange }) {
  const [form, setForm] = useState({
    name: profile.name || '',
    socials: { gmail: '', yahoo: '', instagram: '', facebook: '', ...(profile.socials || {}) },
  });

  // keep form in sync when profile loads
  const save = async () => {
    try {
      const updated = await userApi.updateProfile({ name: form.name, socials: form.socials });
      setProfile(updated);
      setStatus('Profile updated.');
      onTabChange('Profile');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to update profile.'); }
  };

  return (
    <section style={card}>
      <h2 style={{ margin: 0 }}>✏️ Edit Profile</h2>
      <label style={{ fontWeight: 600 }}>Name</label>
      <input style={inp} value={form.name} placeholder="Your name"
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

      <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>Social Handles</div>
      {Object.keys(SOCIAL_META).map(platform => {
        const meta = SOCIAL_META[platform];
        return (
          <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ minWidth: '2.2rem', textAlign: 'center', fontWeight: 900, background: meta.bg, color: meta.color, borderRadius: '0.5rem', padding: '0.3rem 0.5rem' }}>
              {meta.icon}
            </span>
            <input style={inp} placeholder={meta.label}
              value={form.socials[platform] || ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, [platform]: e.target.value } }))} />
          </div>
        );
      })}

      <button onClick={save}
        style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
        Save Profile
      </button>
    </section>
  );
}

/* ── Kids tab ── */
export function KidsTab({ profile, kids, onReload, setStatus }) {
  const [form, setForm] = useState({ name: '', spendingLimit: 25, birthYear: '' });
  const [editingKid, setEditingKid] = useState(null);
  const [editForm, setEditForm] = useState({});

  const addKid = async () => {
    try {
      await userApi.createKid(form);
      setForm({ name: '', spendingLimit: 25, birthYear: '' });
      await onReload();
      setStatus('Kid added.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to add kid.'); }
  };

  const deleteKid = async (kidId) => {
    try { await userApi.deleteKid(kidId); await onReload(); setStatus('Kid removed.'); }
    catch (e) { setStatus(e.response?.data?.error || 'Unable to remove kid.'); }
  };

  const startEdit = (kid) => {
    setEditingKid(kid.kidId);
    setEditForm({ name: kid.name, spendingLimit: kid.spendingLimit, birthYear: kid.birthYear || '' });
  };

  const saveEdit = async (kidId) => {
    try {
      await userApi.updateKid(kidId, editForm);
      setEditingKid(null);
      await onReload();
      setStatus('Kid updated.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to update kid.'); }
  };

  return (
    <section style={card}>
      <h2 style={{ margin: 0 }}>🎪 Kid Tokens</h2>
      <input style={inp} value={form.name} placeholder="Kid name"
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <input style={inp} type="number" value={form.spendingLimit} placeholder="Spending limit (tokens)"
        onChange={e => setForm(f => ({ ...f, spendingLimit: Number(e.target.value) }))} />
      <input style={inp} value={form.birthYear} placeholder="Birth year for PIN (e.g. 2015, or leave blank)"
        maxLength={4} onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))} />
      <button onClick={addKid}
        style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
        + Add Kid
      </button>

      {kids.map(kid => (
        <div key={kid.kidId} style={{ background: '#fffbeb', borderRadius: '1rem', padding: '1rem', display: 'grid', gap: '0.5rem' }}>
          {editingKid === kid.kidId ? (
            <>
              <input style={inp} value={editForm.name} placeholder="Kid name"
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              <input style={inp} type="number" value={editForm.spendingLimit} placeholder="Spending limit (tokens)"
                onChange={e => setEditForm(f => ({ ...f, spendingLimit: Number(e.target.value) }))} />
              <input style={inp} value={editForm.birthYear || ''} placeholder="Birth year for PIN (e.g. 2015)"
                maxLength={4} onChange={e => setEditForm(f => ({ ...f, birthYear: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => saveEdit(kid.kidId)}
                  style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                  Save
                </button>
                <button onClick={() => setEditingKid(null)}
                  style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{kid.name}</strong>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={() => startEdit(kid)}
                    style={{ background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    Edit
                  </button>
                  <button onClick={() => deleteKid(kid.kidId)}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.7rem', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Limit: {kid.spendingLimit} tokens &nbsp;·&nbsp; Spent: {kid.spent}
                {kid.birthYear && kid.birthYear !== '0000' && <>&nbsp;·&nbsp; PIN: {kid.birthYear}</>}
              </div>
              <PrintableQR
                title={`${kid.name}'s Wristband`}
                qrValue={`CARNIVAL_KID:${profile.userId}:${kid.kidId}`}
                subtitle={`Limit ${kid.spendingLimit} tokens`}
              />
            </>
          )}
        </div>
      ))}
    </section>
  );
}

/* ── Transaction history tab ── */
export function HistoryTab({ transactions }) {
  return (
    <section style={card}>
      <h2 style={{ margin: 0 }}>📜 Transaction History</h2>
      {transactions.length === 0 && <p style={{ color: '#6b7280' }}>No transactions yet.</p>}
      {transactions.map(tx => (
        <div key={`${tx.txId}-${tx.itemId}`}
          style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.9rem' }}>
          <div style={{ fontWeight: 700 }}>{tx.itemName} × {tx.qty}</div>
          <div style={{ color: '#6b7280' }}>at {tx.stallName || tx.vendorName || 'Stall'} · <strong style={{ color: '#b45309' }}>{tx.amount} tokens</strong></div>
          {tx.kidName && <div style={{ color: '#7c3aed', fontSize: '0.8rem' }}>👦 {tx.kidName}</div>}
          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{tx.timestamp}</div>
        </div>
      ))}
    </section>
  );
}

export function FamilyTab({ setStatus }) {
  const [family, setFamily] = useState([]);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userApi.getFamily().then(setFamily).catch(() => {}).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const link = async () => {
    try {
      await userApi.linkFamily(phone);
      const updated = await userApi.getFamily();
      setFamily(updated);
      setPhone('');
      setStatus('Family member linked.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to link.'); }
  };

  const unlink = async (userId) => {
    try {
      await userApi.unlinkFamily(userId);
      setFamily(f => f.filter(m => m.userId !== userId));
      setStatus('Unlinked.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to unlink.'); }
  };

  return (
    <section style={card}>
      <h2 style={{ margin: 0 }}>👨‍👩‍👧 Family Links</h2>
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Link adult family members to share stall admin rights for kids.</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input style={{ ...inp, flex: 1 }} value={phone} placeholder="Phone number of family member"
          onChange={e => setPhone(e.target.value)} />
        <button onClick={link}
          style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Link
        </button>
      </div>
      {loading && <p style={{ color: '#6b7280', margin: 0 }}>Loading…</p>}
      {!loading && family.length === 0 && <p style={{ color: '#6b7280', margin: 0 }}>No family members linked yet.</p>}
      {family.map(m => (
        <div key={m.userId} style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{m.name || m.phone}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{m.phone}</div>
          </div>
          <button onClick={() => unlink(m.userId)}
            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.7rem', cursor: 'pointer' }}>
            Unlink
          </button>
        </div>
      ))}
    </section>
  );
}

/* ── Combined Profile tab (profile view/edit + kids + family) ── */
export function ProfileTab({ profile, balance, event, isAdmin, setStatus, onReload, kids, setProfile, tabs }) {
  const [editing, setEditing] = useState(false);
  const [birthYear, setBirthYear] = useState(balance?.birthYear || '0000');
  const [editBY, setEditBY] = useState('');
  const [editForm, setEditForm] = useState({
    name: profile.name || '',
    birthYear: balance?.birthYear || '0000',
    defaultTab: profile.defaultTab || '',
    socials: { gmail: '', yahoo: '', instagram: '', facebook: '', ...(profile.socials || {}) },
  });
  const [kidForm, setKidForm] = useState({ name: '', spendingLimit: 25 });
  const [editingKid, setEditingKid] = useState(null);
  const [editKidForm, setEditKidForm] = useState({});
  const [family, setFamily] = useState([]);
  const [familyQ, setFamilyQ] = useState('');
  const [familyResults, setFamilyResults] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [dollars, setDollars] = useState('');

  useEffect(() => {
    userApi.getFamily().then(setFamily).catch(() => {}).finally(() => setFamilyLoading(false));
    userApi.getBalance().then(b => setBirthYear(b.birthYear || '0000')).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const nextBirthYear = balance?.birthYear || '0000';
    setBirthYear(nextBirthYear);
    setEditBY(nextBirthYear);
    setEditForm({
      name: profile.name || '',
      birthYear: nextBirthYear,
      defaultTab: profile.defaultTab || '',
      socials: { gmail: '', yahoo: '', instagram: '', facebook: '', ...(profile.socials || {}) },
    });
  }, [profile, balance]);

  const searchFamily = async (val) => {
    setFamilyQ(val);
    if (val.length < 2) { setFamilyResults([]); return; }
    try {
      const results = await stallsApi.searchUsers(val);
      setFamilyResults(results.filter(u => !u.isKid));
    } catch { setFamilyResults([]); }
  };

  const linkFamily = async (user) => {
    try {
      await userApi.linkFamily(user.phone);
      setFamilyResults([]); setFamilyQ('');
      setFamily(await userApi.getFamily());
      setStatus('Family member linked.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to link.'); }
  };

  const unlinkFamily = async (userId) => {
    try {
      await userApi.unlinkFamily(userId);
      setFamily(f => f.filter(m => m.userId !== userId));
      setStatus('Unlinked.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to unlink.'); }
  };

  const saveProfile = async () => {
    try {
      const nextBirthYear = String(editForm.birthYear || '0000').trim() || '0000';
      const updated = await userApi.updateProfile({ name: editForm.name, socials: editForm.socials, defaultTab: editForm.defaultTab || '' });
      if (nextBirthYear !== birthYear) {
        const birthYearRes = await userApi.updateBirthYear(nextBirthYear);
        setBirthYear(birthYearRes.birthYear || '0000');
        setEditBY(birthYearRes.birthYear || '0000');
      }
      if (editForm.defaultTab) {
        localStorage.setItem('cc_defaultTab', editForm.defaultTab);
      } else {
        localStorage.removeItem('cc_defaultTab');
      }
      setProfile(updated);
      await onReload();
      setEditing(false);
      setStatus('Profile updated.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to update profile.'); }
  };

  const addKid = async () => {
    if (!kidForm.name.trim()) return;
    try {
      await userApi.createKid(kidForm);
      setKidForm({ name: '', spendingLimit: 25 });
      await onReload();
      setStatus('Kid added.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to add kid.'); }
  };

  const deleteKid = async (kidId) => {
    try { await userApi.deleteKid(kidId); await onReload(); setStatus('Kid removed.'); }
    catch (e) { setStatus(e.response?.data?.error || 'Unable to remove kid.'); }
  };

  const saveKid = async (kidId) => {
    try {
      await userApi.updateKid(kidId, editKidForm);
      setEditingKid(null);
      await onReload();
      setStatus('Kid updated.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to update kid.'); }
  };

  const rate = event?.tokenRate || 10;
  const tokens = dollars > 0 ? Math.floor(parseFloat(dollars) * rate) : null;
  const loadTokens = async () => {
    if (!tokens) return;
    try {
      await adminApi.addTokens({ phone: profile.phone, amount: tokens });
      await onReload(); setDollars('');
      setStatus(`✅ Loaded ${tokens} tokens ($${dollars} × ${rate} rate).`);
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to load tokens.'); }
  };

  const socials = profile.socials || {};
  const hasSocials = Object.values(socials).some(Boolean);
  const btnSm = { border: 'none', borderRadius: '0.5rem', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* ── Profile card ── */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ margin: 0 }}>👤 {profile.name || profile.phone}</h2>
          <button onClick={() => setEditing(e => !e)}
            style={{ ...btnSm, background: editing ? '#f3f4f6' : '#dbeafe', color: editing ? '#374151' : '#1d4ed8' }}>
            {editing ? 'Cancel' : '✏️ Edit'}
          </button>
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>📱 {profile.phone}</div>

        {!editing && hasSocials && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Object.entries(socials).map(([k, v]) => v ? <SocialBadge key={k} platform={k} handle={v} /> : null)}
          </div>
        )}

        <div style={{ background: 'linear-gradient(135deg,#fffbeb,#fed7aa)', borderRadius: '0.85rem', padding: '0.75rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Balance</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309' }}>{balance?.tokenBalance ?? 0} tokens</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>PIN</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#78350f' }}>{balance?.pin}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Birth Year</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#78350f' }}>{birthYear === '0000' ? 'Not set' : birthYear}</div>
          </div>
          {profile.defaultTab && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Start on</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#78350f' }}>{profile.defaultTab}</div>
            </div>
          )}
        </div>

        {editing && (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            <label style={{ fontWeight: 600 }}>Name</label>
            <input style={inp} value={editForm.name} placeholder="Your name"
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <div style={{ fontWeight: 600 }}>Social Handles</div>
            {Object.keys(SOCIAL_META).map(platform => {
              const meta = SOCIAL_META[platform];
              return (
                <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ minWidth: '2.2rem', textAlign: 'center', fontWeight: 900, background: meta.bg, color: meta.color, borderRadius: '0.5rem', padding: '0.3rem 0.5rem' }}>{meta.icon}</span>
                  <input style={inp} placeholder={meta.label} value={editForm.socials[platform] || ''}
                    onChange={e => setEditForm(f => ({ ...f, socials: { ...f.socials, [platform]: e.target.value } }))} />
                </div>
              );
            })}
            <label style={{ fontWeight: 600 }}>Birth Year (used as transaction PIN)</label>
            <input
              style={inp}
              placeholder="e.g. 1990 or 0000 to skip"
              value={editForm.birthYear || editBY}
              onChange={e => {
                setEditBY(e.target.value);
                setEditForm(f => ({ ...f, birthYear: e.target.value }));
              }}
            />
            {tabs && tabs.length > 0 && (
              <>
                <label style={{ fontWeight: 600 }}>Default landing tab</label>
                <select style={{ ...inp, appearance: 'auto' }}
                  value={editForm.defaultTab || ''}
                  onChange={e => setEditForm(f => ({ ...f, defaultTab: e.target.value }))}>
                  <option value="">— Role default —</option>
                  {tabs.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            )}
            <button onClick={saveProfile}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              Save Profile
            </button>
          </div>
        )}

        {isAdmin && !editing && (
          <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.85rem', display: 'grid', gap: '0.6rem' }}>
            <div style={{ fontWeight: 700, color: '#b45309' }}>🪙 Load Tokens (Admin)</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Rate: {rate} tokens / $1</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>$</span>
              <input type="number" min="1" step="1" style={{ ...inp, maxWidth: '120px' }} placeholder="Dollars"
                value={dollars} onChange={e => setDollars(e.target.value)} />
              {tokens != null && <span style={{ color: '#b45309', fontWeight: 700 }}>= {tokens} tokens</span>}
              <button onClick={loadTokens} disabled={!tokens}
                style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.6rem 1.1rem', fontWeight: 700, cursor: 'pointer', opacity: tokens ? 1 : 0.5 }}>
                Add Tokens
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Family card (kids + linked adults) ── */}
      <section style={card}>
        <h2 style={{ margin: 0 }}>👨‍👩‍👧 Family</h2>

        {/* Kids */}
        <div style={{ fontWeight: 700, color: '#92400e', marginTop: '0.25rem' }}>🎪 Kids</div>
        {(kids || []).map(kid => (
          <div key={kid.kidId} style={{ background: '#fffbeb', borderRadius: '1rem', padding: '0.9rem', display: 'grid', gap: '0.5rem' }}>
            {editingKid === kid.kidId ? (
              <>
                <input style={inp} value={editKidForm.name} placeholder="Kid name"
                  onChange={e => setEditKidForm(f => ({ ...f, name: e.target.value }))} />
                <input style={inp} type="number" value={editKidForm.spendingLimit} placeholder="Token limit"
                  onChange={e => setEditKidForm(f => ({ ...f, spendingLimit: Number(e.target.value) }))} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => saveKid(kid.kidId)} style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingKid(null)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '0.5rem', padding: '0.4rem', cursor: 'pointer' }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>👦 {kid.name}</strong>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { setEditingKid(kid.kidId); setEditKidForm({ name: kid.name, spendingLimit: kid.spendingLimit }); }}
                      style={{ ...btnSm, background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                    <button onClick={() => deleteKid(kid.kidId)}
                      style={{ ...btnSm, background: '#fee2e2', color: '#dc2626' }}>Remove</button>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Limit: {kid.spendingLimit} tokens · Spent: {kid.spent}</div>
                <PrintableQR title={`${kid.name}'s Wristband`} qrValue={`CARNIVAL_KID:${profile.userId}:${kid.kidId}`} subtitle={`Limit ${kid.spendingLimit} tokens`} />
              </>
            )}
          </div>
        ))}
        <div style={{ display: 'grid', gap: '0.5rem', background: '#fef9f0', borderRadius: '0.75rem', padding: '0.75rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>+ Add Kid</div>
          <input style={inp} value={kidForm.name} placeholder="Kid name"
            onChange={e => setKidForm(f => ({ ...f, name: e.target.value }))} />
          <input style={inp} type="number" value={kidForm.spendingLimit} placeholder="Spending limit (tokens)"
            onChange={e => setKidForm(f => ({ ...f, spendingLimit: Number(e.target.value) }))} />
          <button onClick={addKid}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.6rem', fontWeight: 700, cursor: 'pointer' }}>
            Add Kid
          </button>
        </div>

        {/* Linked adults */}
        <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '0.75rem', fontWeight: 700, color: '#92400e' }}>👨‍👩 Linked Adults</div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Linked adults share stall admin rights when kids are stall admins.</p>
        <div style={{ position: 'relative' }}>
          <input style={inp} value={familyQ} placeholder="Search adult by name or phone…"
            onChange={e => searchFamily(e.target.value)} />
          {familyResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.65rem', zIndex: 10, marginTop: '0.25rem', display: 'grid', gap: '0.15rem', padding: '0.3rem' }}>
              {familyResults.map(u => (
                <button key={u.userId} onClick={() => linkFamily(u)}
                  style={{ background: 'none', border: 'none', padding: '0.45rem 0.75rem', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem', borderRadius: '0.4rem' }}
                  onMouseEnter={e => { e.target.style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { e.target.style.background = 'none'; }}>
                  👤 {u.name || u.phone}{u.name && u.phone ? ` · ${u.phone}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        {familyLoading && <p style={{ color: '#6b7280', margin: 0, fontSize: '0.85rem' }}>Loading…</p>}
        {!familyLoading && family.length === 0 && <p style={{ color: '#6b7280', margin: 0, fontSize: '0.85rem' }}>No adults linked yet.</p>}
        {family.map(m => (
          <div key={m.userId} style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.6rem 0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>👤 {m.name || m.phone}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{m.phone}</div>
            </div>
            <button onClick={() => unlinkFamily(m.userId)}
              style={{ ...btnSm, background: '#fee2e2', color: '#dc2626' }}>Unlink</button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ── Stall tab ── view by default, edit on button press ── */
const TYPE_META = {
  food: { label: 'Food Stall', color: '#b45309', bg: '#fef3c7', icon: '🍕' },
  game: { label: 'Game Stall', color: '#1d4ed8', bg: '#dbeafe', icon: '🎯' },
};

export function StallTab({ setStatus }) {
  const [stall, setStall] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ stallName: '', stallType: 'food', tokensPerPlay: 2, description: '' });

  const load = async () => {
    try {
      const s = await vendorApi.getStall();
      setStall(s);
      setForm({
        stallName: s.stallName || '',
        stallType: s.stallType || 'food',
        tokensPerPlay: s.tokensPerPlay ?? 2,
        description: s.description || '',
      });
    } catch (e) { setStatus('Unable to load stall info.'); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    try {
      const updated = await vendorApi.updateStall(form);
      setStall(updated);
      setEditing(false);
      setStatus('Stall updated.');
    } catch (e) { setStatus(e.response?.data?.error || 'Unable to save stall.'); }
  };

  const typeMeta = TYPE_META[stall?.stallType] || TYPE_META.food;
  const priceLabel = (stall?.stallType || form.stallType) === 'game' ? 'tokens per play' : 'tokens per serving';

  if (!stall) return <section style={card}><p style={{ color: '#6b7280' }}>Loading stall info…</p></section>;

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>🏪 My Stall</h2>
        {!editing && (
          <button onClick={() => setEditing(true)}
            style={{ background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.4rem 0.9rem', fontWeight: 600, cursor: 'pointer' }}>
            ✏️ Edit
          </button>
        )}
      </div>

      {!editing ? (
        /* ── view mode ── */
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {stall.stallName ? (
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{stall.stallName}</div>
          ) : (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No stall name set — click Edit to add one</div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {stall.stallType && (
              <span style={{ background: typeMeta.bg, color: typeMeta.color, borderRadius: '1rem', padding: '0.25rem 0.75rem', fontWeight: 700, fontSize: '0.9rem' }}>
                {typeMeta.icon} {typeMeta.label}
              </span>
            )}
            {stall.tokensPerPlay != null && (
              <span style={{ background: '#fffbeb', color: '#b45309', borderRadius: '1rem', padding: '0.25rem 0.75rem', fontWeight: 700, fontSize: '0.9rem' }}>
                🪙 {stall.tokensPerPlay} {priceLabel}
              </span>
            )}
          </div>

          {stall.description && (
            <div style={{ background: '#f9fafb', borderRadius: '0.75rem', padding: '0.75rem', color: '#374151', fontSize: '0.95rem' }}>
              {stall.description}
            </div>
          )}
        </div>
      ) : (
        /* ── edit mode ── */
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ fontWeight: 600 }}>Stall Name</label>
          <input style={inp} placeholder="e.g. Ring Toss, Pizza Stand"
            value={form.stallName} onChange={e => setForm(f => ({ ...f, stallName: e.target.value }))} />

          <label style={{ fontWeight: 600 }}>Stall Type</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {['food', 'game'].map(type => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                background: form.stallType === type ? TYPE_META[type].bg : '#f9fafb',
                color: form.stallType === type ? TYPE_META[type].color : '#374151',
                borderRadius: '0.75rem', padding: '0.5rem 1rem', fontWeight: 600, border: '2px solid', borderColor: form.stallType === type ? TYPE_META[type].color : 'transparent' }}>
                <input type="radio" name="stallType" value={type} checked={form.stallType === type}
                  onChange={() => setForm(f => ({ ...f, stallType: type }))} style={{ display: 'none' }} />
                {TYPE_META[type].icon} {TYPE_META[type].label}
              </label>
            ))}
          </div>

          <label style={{ fontWeight: 600 }}>
            {form.stallType === 'game' ? 'Tokens per Play' : 'Tokens per Serving'}
          </label>
          <input style={{ ...inp, maxWidth: '150px' }} type="number" min="1"
            value={form.tokensPerPlay} onChange={e => setForm(f => ({ ...f, tokensPerPlay: Number(e.target.value) }))} />

          <label style={{ fontWeight: 600 }}>
            {form.stallType === 'game' ? 'Game Description' : 'Menu / Food Description'}
          </label>
          <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }}
            placeholder={form.stallType === 'game' ? 'e.g. 3 rings to win a prize!' : 'e.g. Fresh-grilled hot dogs, nachos…'}
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={save}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>
              Save Stall
            </button>
            <button onClick={() => setEditing(false)}
              style={{ background: '#f3f4f6', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1rem', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
