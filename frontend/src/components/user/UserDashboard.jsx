import { useEffect, useState } from 'react';

import userApi from '../../api/user';
import Layout from '../common/Layout';
import PrintableQR from '../common/PrintableQR';

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

function UserDashboard() {
  const [profile, setProfile] = useState({ name: '', emails: [] });
  const [balance, setBalance] = useState({ tokenBalance: 0, pin: '' });
  const [kids, setKids] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [emailsText, setEmailsText] = useState('');
  const [kidForm, setKidForm] = useState({ name: '', spendingLimit: 25 });
  const [status, setStatus] = useState('');

  const loadDashboard = async () => {
    const [profileResponse, balanceResponse, kidsResponse, transactionsResponse] = await Promise.all([
      userApi.getProfile(),
      userApi.getBalance(),
      userApi.getKids(),
      userApi.getTransactions(),
    ]);
    setProfile(profileResponse);
    setEmailsText((profileResponse.emails || []).join(', '));
    setBalance(balanceResponse);
    setKids(kidsResponse);
    setTransactions(transactionsResponse);
  };

  useEffect(() => {
    loadDashboard().catch(() => setStatus('Unable to load dashboard.'));
  }, []);

  const saveProfile = async () => {
    try {
      const updated = await userApi.updateProfile({
        name: profile.name,
        emails: emailsText
          .split(',')
          .map((email) => email.trim())
          .filter(Boolean),
      });
      setProfile(updated);
      setStatus('Profile updated.');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Unable to update profile.');
    }
  };

  const addKid = async () => {
    try {
      await userApi.createKid(kidForm);
      setKidForm({ name: '', spendingLimit: 25 });
      await loadDashboard();
      setStatus('Kid added successfully.');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Unable to add kid.');
    }
  };

  const deleteKid = async (kidId) => {
    try {
      await userApi.deleteKid(kidId);
      await loadDashboard();
      setStatus('Kid removed successfully.');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Unable to remove kid.');
    }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1 style={{ marginBottom: 0 }}>User Dashboard</h1>
        {status ? <p style={{ margin: 0, color: '#92400e' }}>{status}</p> : null}

        <section style={{ ...sectionStyle, textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>Balance</h2>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{balance.tokenBalance} tokens</div>
          <div style={{ fontSize: '1.25rem' }}>PIN: {balance.pin}</div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Profile</h2>
          <input style={inputStyle} value={profile.name || ''} placeholder="Name" onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} />
          <textarea
            style={{ ...inputStyle, minHeight: '100px' }}
            value={emailsText}
            placeholder="Emails, comma separated"
            onChange={(event) => setEmailsText(event.target.value)}
          />
          <button type="button" onClick={saveProfile}>Save Profile</button>
        </section>

        <section id="kids" style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Kid Tokens</h2>
          <input style={inputStyle} value={kidForm.name} placeholder="Kid name" onChange={(event) => setKidForm((current) => ({ ...current, name: event.target.value }))} />
          <input style={inputStyle} type="number" value={kidForm.spendingLimit} placeholder="Spending limit" onChange={(event) => setKidForm((current) => ({ ...current, spendingLimit: Number(event.target.value) }))} />
          <button type="button" onClick={addKid}>Add Kid</button>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {kids.map((kid) => (
              <div key={kid.kidId} style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ background: '#fffbeb', borderRadius: '1rem', padding: '1rem' }}>
                  <strong>{kid.name}</strong> — limit {kid.spendingLimit} — spent {kid.spent}
                  <div style={{ marginTop: '0.75rem' }}>
                    <button type="button" onClick={() => deleteKid(kid.kidId)}>Remove</button>
                  </div>
                </div>
                <PrintableQR
                  title={`${kid.name}'s Kid QR`}
                  qrValue={`CARNIVAL_KID:${profile.userId}:${kid.kidId}`}
                  subtitle={`Limit ${kid.spendingLimit} tokens`}
                />
              </div>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Transaction History</h2>
          <ul style={{ paddingLeft: '1rem', margin: 0 }}>
            {transactions.map((transaction) => (
              <li key={`${transaction.txId}-${transaction.itemId}`}>
                {transaction.itemName} × {transaction.qty} at {transaction.vendorName} — {transaction.amount} tokens
                {transaction.kidName ? ` for ${transaction.kidName}` : ''}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Layout>
  );
}

export default UserDashboard;
