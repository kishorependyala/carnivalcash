import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import adminApi from '../../api/admin';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { HistoryTab, KidsTab, ProfileEditTab, ProfileViewTab, card } from '../common/ProfileSections';

const TABS = ['Home', 'Profile', 'Edit', 'Kids', 'History'];

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

  const [tab, setTab] = useState('Home');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '' });
  const [kids, setKids] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [qrPayload, setQrPayload] = useState('');
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('');

  const load = async () => {
    const [p, b, k, t, qr] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getKids(),
      userApi.getTransactions(),
      userApi.getQr(),
    ]);
    setProfile(p);
    setBalance(b);
    setKids(k);
    setTransactions(t);
    setQrPayload(qr.qrPayload);
    if (isAdmin) {
      try { const ev = await adminApi.getEvent(); setEvent(ev); } catch (_) {}
    }
  };

  useEffect(() => { load().catch(() => setStatus('Unable to load dashboard.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = (t) => { setStatus(''); setTab(t); };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {/* ── HOME ── */}
        {tab === 'Home' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* balance banner */}
            <section style={{ ...card, textAlign: 'center', background: 'linear-gradient(135deg,#fffbeb,#fed7aa)' }}>
              <div style={{ fontSize: '0.8rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>
                {profile.name || 'Token Balance'}
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#b45309', lineHeight: 1 }}>
                {balance.tokenBalance}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#78350f' }}>tokens remaining</div>
            </section>

            {/* QR code */}
            <section style={card}>
              <div style={{ fontWeight: 700, color: '#374151' }}>📲 Your Payment QR</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Vendors scan this to charge you</div>
              {qrPayload && (
                <PrintableQR title="" qrValue={qrPayload} subtitle={`PIN: ${balance.pin}`} />
              )}
            </section>

            {/* action button */}
            <button
              onClick={() => navigate('/scan')}
              style={{
                background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '1rem',
                padding: '1rem', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
              📷 Pay a Stall
            </button>

            {/* kids quick view */}
            {kids.length > 0 && (
              <section style={card}>
                <div style={{ fontWeight: 700 }}>👦 Kids</div>
                {kids.map(kid => (
                  <div key={kid.kidId} style={{ display: 'flex', justifyContent: 'space-between', background: '#fffbeb', borderRadius: '0.65rem', padding: '0.6rem 0.9rem' }}>
                    <span>{kid.name}</span>
                    <span style={{ color: '#b45309', fontWeight: 700 }}>{kid.spendingLimit - kid.spent} tokens left</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {tab === 'Profile' && (
          <ProfileViewTab profile={profile} balance={balance} event={event} isAdmin={isAdmin} setStatus={setStatus} onReload={load} />
        )}
        {tab === 'Edit' && (
          <ProfileEditTab profile={profile} setProfile={setProfile} setStatus={setStatus} onTabChange={changeTab} />
        )}
        {tab === 'Kids' && (
          <KidsTab profile={profile} kids={kids} onReload={load} setStatus={setStatus} />
        )}
        {tab === 'History' && (
          <HistoryTab transactions={transactions} />
        )}
      </div>
    </Layout>
  );
}

export default UserDashboard;
