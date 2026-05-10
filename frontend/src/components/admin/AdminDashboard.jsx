import { useEffect, useMemo, useState } from 'react';

import adminApi from '../../api/admin';
import Layout from '../common/Layout';

const sectionStyle = {
  background: '#fff',
  border: '1px solid #fed7aa',
  borderRadius: '1rem',
  padding: '1rem',
  display: 'grid',
  gap: '0.75rem',
};

const inputStyle = {
  padding: '0.8rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid #d1d5db',
};

function AdminDashboard() {
  const [stats, setStats] = useState({ totalTokensIssued: 0, totalTokensSpent: 0, vendors: [], users: [] });
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState('');
  const [tokenForm, setTokenForm] = useState({ phone: '', amount: 100 });
  const [rate, setRate] = useState(10);
  const [eventName, setEventName] = useState('Carnival 2026');
  const [zeroInput, setZeroInput] = useState('');

  const userLookup = useMemo(() => {
    const map = new Map();
    stats.users.forEach((user) => {
      map.set(user.userId, user.userId);
      map.set(user.phone, user.userId);
    });
    return map;
  }, [stats.users]);

  const loadDashboard = async () => {
    const [statsResponse, eventResponse] = await Promise.all([adminApi.getStats(), adminApi.getEvent()]);
    setStats(statsResponse);
    setEvent(eventResponse);
    setRate(eventResponse?.tokenRate || 10);
  };

  useEffect(() => {
    loadDashboard().catch(() => setStatus('Unable to load admin dashboard.'));
  }, []);

  const withRefresh = async (action, message) => {
    try {
      await action();
      await loadDashboard();
      setStatus(message);
    } catch (error) {
      setStatus(error.response?.data?.error || 'Action failed.');
    }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1 style={{ marginBottom: 0 }}>Admin Dashboard</h1>
        {status ? <p style={{ margin: 0, color: '#92400e' }}>{status}</p> : null}

        <section id="stats" style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div><strong>Total issued:</strong> {stats.totalTokensIssued}</div>
            <div><strong>Total spent:</strong> {stats.totalTokensSpent}</div>
            <div><strong>Vendors:</strong> {stats.vendors.length}</div>
          </div>
          <div>
            <h3>Vendor totals</h3>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th align="left">Vendor</th>
                  <th align="left">Received</th>
                  <th align="left">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {stats.vendors.map((vendor) => (
                  <tr key={vendor.vendorId}>
                    <td>{vendor.vendorName || vendor.vendorId}</td>
                    <td>{vendor.totalReceived}</td>
                    <td>{vendor.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Users</h3>
            <ul style={{ paddingLeft: '1rem', margin: 0 }}>
              {stats.users.map((user) => (
                <li key={user.userId}>
                  {user.name || 'Unnamed user'} — {user.phone} — balance {user.tokenBalance}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="tokens" style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Add Tokens</h2>
          <input
            style={inputStyle}
            placeholder="Phone"
            value={tokenForm.phone}
            onChange={(eventValue) => setTokenForm((current) => ({ ...current, phone: eventValue.target.value }))}
          />
          <input
            style={inputStyle}
            type="number"
            placeholder="Amount"
            value={tokenForm.amount}
            onChange={(eventValue) => setTokenForm((current) => ({ ...current, amount: Number(eventValue.target.value) }))}
          />
          <button
            type="button"
            onClick={() => withRefresh(() => adminApi.addTokens(tokenForm), 'Tokens added successfully.')}
          >
            Submit
          </button>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Set Token Rate</h2>
          <input style={inputStyle} type="number" value={rate} onChange={(eventValue) => setRate(Number(eventValue.target.value))} />
          <button type="button" onClick={() => withRefresh(() => adminApi.setRate({ tokenRate: rate }), 'Rate updated successfully.')}>Set Rate</button>
        </section>

        <section id="event" style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Event Control</h2>
          <p style={{ margin: 0 }}>
            Current event: <strong>{event?.name || 'No event configured'}</strong> ({event?.status || 'closed'})
          </p>
          <input style={inputStyle} value={eventName} onChange={(eventValue) => setEventName(eventValue.target.value)} />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => withRefresh(() => adminApi.manageEvent({ action: 'open', name: eventName }), 'Event opened.')}>Open Event</button>
            <button type="button" onClick={() => withRefresh(() => adminApi.manageEvent({ action: 'close' }), 'Event closed.')}>Close Event</button>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Zero Balance</h2>
          <input
            style={inputStyle}
            placeholder="User ID or phone"
            value={zeroInput}
            onChange={(eventValue) => setZeroInput(eventValue.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const userId = userLookup.get(zeroInput) || zeroInput;
              return withRefresh(() => adminApi.zeroBalance(userId), 'Balance reset to zero.');
            }}
          >
            Zero Out Balance
          </button>
        </section>
      </div>
    </Layout>
  );
}

export default AdminDashboard;
