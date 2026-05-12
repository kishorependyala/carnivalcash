import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import { BrowseStallsTab, StallsTab } from '../common/StallsTab';
import { HistoryTab, ProfileTab } from '../common/ProfileSections';

const TABS = ['Stalls', 'Browse', 'Profile', 'History'];

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          style={{
            padding: '0.5rem 1.1rem',
            borderRadius: '2rem',
            border: 'none',
            cursor: 'pointer',
            background: active === tab ? '#f59e0b' : '#f3f4f6',
            color: active === tab ? '#fff' : '#374151',
            fontWeight: active === tab ? 700 : 400,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function VendorDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'Stalls');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '', birthYear: '0000' });
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    const [p, b, t] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getTransactions(),
    ]);
    setProfile(p);
    setBalance(b);
    setTransactions(t);
  };

  useEffect(() => {
    load().catch(() => setStatus('Unable to load stall dashboard.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = (nextTab) => {
    setStatus('');
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#92400e' }}>🎪 Stall Dashboard</div>
        <TabBar tabs={TABS} active={tab} onChange={changeTab} />
        {status && <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>}

        {tab === 'Stalls' && <StallsTab />}
        {tab === 'Browse' && <BrowseStallsTab />}
        {tab === 'Profile' && <ProfileTab profile={profile} balance={balance} event={null} isAdmin={isAdmin} setStatus={setStatus} onReload={load} kids={[]} setProfile={setProfile} />}
        {tab === 'History' && <HistoryTab transactions={transactions} />}
      </div>
    </Layout>
  );
}

export default VendorDashboard;
