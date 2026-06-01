import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { usePolling } from '../../hooks/usePolling';
import { useSettings } from '../../context/SettingsContext';
import userApi from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import { BrowseStallsTab, StallsTab } from '../common/StallsTab';
import { HistoryTab, ProfileTab } from '../common/ProfileSections';
import { getStale, setCache } from '../../utils/swrCache';

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
  const { pollIntervalSec } = useSettings();
  const isAdmin = user?.roles?.includes('admin');

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || localStorage.getItem('cc_defaultTab') || 'Stalls');
  const [profile, setProfile] = useState(() => getStale('profile') || { name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState(() => getStale('balance') || { tokenBalance: 0, pin: '', birthYear: '0000' });
  const [transactions, setTransactions] = useState(() => getStale('transactions') || []);
  const [status, setStatus] = useState('');

  const load = async () => {
    const [p, b, t] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getTransactions(),
    ]);
    setProfile(p);   setCache('profile', p);
    setBalance(b);   setCache('balance', { tokenBalance: b.tokenBalance, birthYear: b.birthYear });
    setTransactions(t); setCache('transactions', t);
    if (!searchParams.get('tab') && p.defaultTab && TABS.includes(p.defaultTab)) {
      localStorage.setItem('cc_defaultTab', p.defaultTab);
      setTab(p.defaultTab);
    } else if (p.defaultTab) {
      localStorage.setItem('cc_defaultTab', p.defaultTab);
    }
  };

  useEffect(() => {
    load().catch(() => setStatus('Unable to load stall dashboard.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(load, pollIntervalSec * 1000);

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
        {tab === 'Profile' && <ProfileTab profile={profile} balance={balance} event={null} isAdmin={isAdmin} setStatus={setStatus} onReload={load} kids={[]} setProfile={setProfile} tabs={TABS} tabLabels={{ Stalls: 'Vendor & Stalls', Browse: 'Vendor & Browse', Profile: 'Vendor & Profile', History: 'Vendor & History' }} />}
        {tab === 'History' && <HistoryTab transactions={transactions} />}
      </div>
    </Layout>
  );
}

export default VendorDashboard;
