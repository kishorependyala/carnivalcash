import { useEffect, useState } from 'react';

import adminApi from '../../api/admin';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import { HistoryTab, KidsTab, ProfileEditTab, ProfileViewTab, card, inp } from '../common/ProfileSections';

const TABS = ['Profile', 'Edit', 'Kids', 'History'];

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
  const isAdmin = user?.roles?.includes('admin');

  const [tab, setTab] = useState('Profile');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '' });
  const [kids, setKids] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('');

  const load = async () => {
    const [p, b, k, t] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getKids(),
      userApi.getTransactions(),
    ]);
    setProfile(p);
    setBalance(b);
    setKids(k);
    setTransactions(t);
    if (isAdmin) {
      try { const ev = await adminApi.getEvent(); setEvent(ev); } catch (_) {}
    }
  };

  useEffect(() => { load().catch(() => setStatus('Unable to load dashboard.')); }, []);

  const changeTab = (t) => { setStatus(''); setTab(t); };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

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
