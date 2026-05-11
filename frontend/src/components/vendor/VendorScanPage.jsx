import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '../common/Layout';

const card = {
  background: '#fff', border: '1px solid #fed7aa', borderRadius: '1rem',
  padding: '1.25rem', display: 'grid', gap: '1rem',
};

function parseUserId(rawValue) {
  const parts = String(rawValue || '').split(':');
  if (parts[0] === 'CARNIVAL_USER' && parts[1]) return parts[1];
  return null;
}

function VendorScanPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const html5Scanner = useRef(null);
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('Scan a customer QR code.');

  useEffect(() => {
    let mounted = true;
    async function startScanner() {
      if (!scannerRef.current) return;
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (!mounted || !scannerRef.current) return;
        html5Scanner.current = new Html5QrcodeScanner('vendor-scan-reader', { fps: 5, qrbox: 220 }, false);
        html5Scanner.current.render((decodedText) => {
          const userId = parseUserId(decodedText);
          if (userId) {
            navigate(`/vendor/charge/${userId}`);
          } else {
            setStatus('That is not a CarnivalCash customer QR code.');
          }
        }, () => {});
      } catch {
        setStatus('Camera unavailable. Enter the customer QR payload below.');
      }
    }
    startScanner();
    return () => {
      mounted = false;
      html5Scanner.current?.clear?.().catch(() => {});
    };
  }, [navigate]);

  const handleManual = () => {
    const userId = parseUserId(manualValue.trim());
    if (!userId) {
      setStatus('Enter a value like CARNIVAL_USER:<userId>.');
      return;
    }
    navigate(`/vendor/charge/${userId}`);
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>📷 Scan Customer QR</div>
        <section style={card}>
          <div id="vendor-scan-reader" ref={scannerRef} />
          <hr style={{ border: 'none', borderTop: '1px solid #fed7aa' }} />
          <div style={{ fontWeight: 600, color: '#374151' }}>Or paste QR payload:</div>
          <input
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            placeholder="CARNIVAL_USER:userId"
            style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid #d1d5db', fontSize: '0.95rem' }}
          />
          <button onClick={handleManual}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            Continue
          </button>
          {status && <p style={{ margin: 0, color: '#92400e' }}>{status}</p>}
        </section>
      </div>
    </Layout>
  );
}

export default VendorScanPage;
