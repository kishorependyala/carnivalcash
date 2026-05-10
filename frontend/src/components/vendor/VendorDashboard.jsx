import { useEffect, useMemo, useState } from 'react';

import vendorApi from '../../api/vendor';
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

function VendorDashboard() {
  const [qrPayload, setQrPayload] = useState('');
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState('');
  const [itemForm, setItemForm] = useState({ name: '', tokenPrice: 5, stallType: 'food' });

  const latestTimestamp = useMemo(() => transactions[0]?.timestamp || '', [transactions]);

  const loadDashboard = async () => {
    const [qrResponse, itemResponse, transactionResponse] = await Promise.all([
      vendorApi.getQr(),
      vendorApi.getItems(),
      vendorApi.getTransactions(),
    ]);
    setQrPayload(qrResponse.qrPayload);
    setItems(itemResponse);
    setTransactions(transactionResponse.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  };

  useEffect(() => {
    loadDashboard().catch(() => setStatus('Unable to load vendor dashboard.'));
  }, []);

  useEffect(() => {
    if (!latestTimestamp) {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        const poll = await vendorApi.pollTransactions(latestTimestamp);
        if (poll.newTransactions > 0) {
          setNotice(`New payment received (${poll.newTransactions}).`);
          await loadDashboard();
        }
      } catch (error) {
        setStatus(error.response?.data?.error || 'Polling failed.');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [latestTimestamp]);

  const resetForm = () => {
    setEditingId('');
    setItemForm({ name: '', tokenPrice: 5, stallType: 'food' });
  };

  const saveItem = async () => {
    try {
      if (editingId) {
        await vendorApi.updateItem(editingId, itemForm);
        setStatus('Item updated.');
      } else {
        await vendorApi.createItem(itemForm);
        setStatus('Item added.');
      }
      resetForm();
      await loadDashboard();
    } catch (error) {
      setStatus(error.response?.data?.error || 'Unable to save item.');
    }
  };

  const deactivateItem = async (itemId) => {
    try {
      await vendorApi.deleteItem(itemId);
      await loadDashboard();
      setStatus('Item deactivated.');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Unable to deactivate item.');
    }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1 style={{ marginBottom: 0 }}>Vendor Dashboard</h1>
        {notice ? <div style={{ ...sectionStyle, background: '#fffbeb' }}>{notice}</div> : null}
        {status ? <p style={{ margin: 0, color: '#92400e' }}>{status}</p> : null}

        <section id="qr" style={sectionStyle}>
          <h2 style={{ margin: 0 }}>My QR Code</h2>
          {qrPayload ? <PrintableQR title="Vendor Payment QR" qrValue={qrPayload} subtitle="Show this to CarnivalCash users" /> : null}
        </section>

        <section id="items" style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Stall Items</h2>
          <input style={inputStyle} value={itemForm.name} placeholder="Item name" onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} />
          <input style={inputStyle} type="number" value={itemForm.tokenPrice} placeholder="Token price" onChange={(event) => setItemForm((current) => ({ ...current, tokenPrice: Number(event.target.value) }))} />
          <input style={inputStyle} value={itemForm.stallType} placeholder="Stall type" onChange={(event) => setItemForm((current) => ({ ...current, stallType: event.target.value }))} />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={saveItem}>{editingId ? 'Update Item' : 'Add Item'}</button>
            {editingId ? <button type="button" onClick={resetForm}>Cancel</button> : null}
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {items.map((item) => (
              <div key={item.itemId} style={{ background: '#fffbeb', padding: '1rem', borderRadius: '1rem' }}>
                <strong>{item.name}</strong> — {item.tokenPrice} tokens — {item.stallType} — {item.active ? 'Active' : 'Inactive'}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.itemId);
                      setItemForm({ name: item.name, tokenPrice: item.tokenPrice, stallType: item.stallType });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => deactivateItem(item.itemId)} disabled={!item.active}>Deactivate</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="history" style={sectionStyle}>
          <h2 style={{ margin: 0 }}>Transactions</h2>
          <ul style={{ paddingLeft: '1rem', margin: 0 }}>
            {transactions.map((transaction) => (
              <li key={`${transaction.txId}-${transaction.itemId}`}>
                {transaction.userName} bought {transaction.itemName} × {transaction.qty} for {transaction.amount} tokens
                {transaction.kidName ? ` (${transaction.kidName})` : ''}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Layout>
  );
}

export default VendorDashboard;
