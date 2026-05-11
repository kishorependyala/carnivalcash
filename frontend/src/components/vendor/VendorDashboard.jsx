import { useEffect, useMemo, useState } from 'react';

import userApi from '../../api/user';
import vendorApi from '../../api/vendor';
import { useAuth } from '../../context/AuthContext';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';
import { HistoryTab, ProfileEditTab, ProfileViewTab, StallTab, card } from '../common/ProfileSections';

const TABS = ['Profile', 'Edit', 'Stall', 'Transactions'];

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

function VendorDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  const [tab, setTab] = useState('Profile');
  const [profile, setProfile] = useState({ name: '', emails: [], socials: {} });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '' });
  const [qrPayload, setQrPayload] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('');

  const latestTimestamp = useMemo(() => transactions[0]?.timestamp || '', [transactions]);

  const load = async () => {
    const [p, b, qr, txns] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      vendorApi.getQr(),
      vendorApi.getTransactions(),
    ]);
    setProfile(p);
    setBalance(b);
    setQrPayload(qr.qrPayload);
    setTransactions(txns.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  };

  useEffect(() => { load().catch(() => setStatus('Unable to load vendor dashboard.')); }, []);

  /* real-time polling for new transactions */
  useEffect(() => {
    if (!latestTimestamp) return undefined;
    const interval = setInterval(async () => {
      try {
        const poll = await vendorApi.pollTransactions(latestTimestamp);
        if (poll.newTransactions > 0) {
          setNotice(`🔔 New payment received (${poll.newTransactions}).`);
          await load();
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [latestTimestamp]);

  const changeTab = (t) => { setStatus(''); setNotice(''); setTab(t); };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {notice && (
          <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontWeight: 600 }}>
            {notice}
          </div>
        )}
        {status && (
          <p style={{ margin: 0, color: '#92400e', background: '#fffbeb', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}>{status}</p>
        )}

        {/* QR always visible at top */}
        {qrPayload && (
          <div style={{ ...card, alignItems: 'center', textAlign: 'center' }}>
            <PrintableQR title="Vendor Payment QR" qrValue={qrPayload} subtitle="Show this to CarnivalCash users" />
          </div>
        )}

        <TabBar tabs={TABS} active={tab} onChange={changeTab} />

        {tab === 'Profile' && (
          <ProfileViewTab profile={profile} balance={balance} event={null} isAdmin={isAdmin} setStatus={setStatus} onReload={load} />
        )}
        {tab === 'Edit' && (
          <ProfileEditTab profile={profile} setProfile={setProfile} setStatus={setStatus} onTabChange={changeTab} />
        )}
        {tab === 'Stall' && (
          <StallTab setStatus={setStatus} />
        )}
        {tab === 'Transactions' && (
          <section style={card}>
            <h2 style={{ margin: 0 }}>💳 Transactions</h2>
            {transactions.length === 0 && <p style={{ color: '#6b7280' }}>No transactions yet.</p>}
            {transactions.map(tx => (
              <div key={`${tx.txId}-${tx.itemId}`}
                style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.9rem' }}>
                <div style={{ fontWeight: 700 }}>{tx.userName} bought {tx.itemName} × {tx.qty}</div>
                <div style={{ color: '#b45309', fontWeight: 700 }}>{tx.amount} tokens</div>
                {tx.kidName && <div style={{ color: '#7c3aed', fontSize: '0.8rem' }}>👦 {tx.kidName}</div>}
                <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{tx.timestamp}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </Layout>
  );
}

export default VendorDashboard;
