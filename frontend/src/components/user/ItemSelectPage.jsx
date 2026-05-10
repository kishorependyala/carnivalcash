import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import transactionsApi from '../../api/transactions';
import userApi from '../../api/user';
import Layout from '../common/Layout';

const sectionStyle = {
  background: '#fff',
  border: '1px solid #fed7aa',
  borderRadius: '1rem',
  padding: '1rem',
  display: 'grid',
  gap: '0.75rem',
};

function ItemSelectPage() {
  const { vendorId } = useParams();
  const [items, setItems] = useState([]);
  const [kids, setKids] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [kidId, setKidId] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([transactionsApi.getVendorCatalog(vendorId), userApi.getKids()])
      .then(([catalog, kidsResponse]) => {
        setItems(catalog.items || []);
        setKids(kidsResponse || []);
      })
      .catch((error) => setStatus(error.response?.data?.error || 'Unable to load vendor catalog.'));
  }, [vendorId]);

  const totalTokens = useMemo(
    () => items.reduce((sum, item) => sum + (quantities[item.itemId] || 0) * Number(item.tokenPrice || 0), 0),
    [items, quantities]
  );

  const updateQty = (itemId, delta) => {
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, (current[itemId] || 0) + delta) }));
  };

  const handlePay = async () => {
    try {
      const response = await transactionsApi.transferTokens({
        vendorId,
        items: items.map((item) => ({ itemId: item.itemId, qty: quantities[item.itemId] || 0 })),
        kidId: kidId || null,
      });
      setResult(response);
      setStatus('Payment complete.');
    } catch (error) {
      setStatus(error.response?.data?.error || 'Payment failed.');
    }
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1 style={{ marginBottom: 0 }}>Choose Items</h1>
        {status ? <p style={{ margin: 0, color: '#92400e' }}>{status}</p> : null}
        <section style={sectionStyle}>
          {items.map((item) => (
            <div key={item.itemId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center' }}>
              <div>
                <strong>{item.name}</strong>
                <div>{item.tokenPrice} tokens • {item.stallType}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button type="button" onClick={() => updateQty(item.itemId, -1)}>-</button>
                <span>{quantities[item.itemId] || 0}</span>
                <button type="button" onClick={() => updateQty(item.itemId, 1)}>+</button>
              </div>
            </div>
          ))}
          <label htmlFor="kid-select">Charge to</label>
          <select id="kid-select" value={kidId} onChange={(event) => setKidId(event.target.value)}>
            <option value="">Myself</option>
            {kids.map((kid) => (
              <option key={kid.kidId} value={kid.kidId}>{kid.name}</option>
            ))}
          </select>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Total: {totalTokens} tokens</div>
          <button type="button" onClick={handlePay} disabled={!totalTokens}>Pay</button>
        </section>
        {result ? (
          <section style={sectionStyle}>
            <h2 style={{ margin: 0 }}>Success</h2>
            <div>Transaction ID: {result.txId}</div>
            <div>Tokens charged: {result.totalTokens}</div>
            <div>New balance: {result.newBalance}</div>
          </section>
        ) : null}
      </div>
    </Layout>
  );
}

export default ItemSelectPage;
