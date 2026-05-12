import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Layout from '../common/Layout';

const card = {
  background: '#fff', border: '1px solid #fed7aa', borderRadius: '1rem',
  padding: '1.25rem', display: 'grid', gap: '1rem',
};

function parseQRPayload(raw) {
  const val = String(raw || '').trim();
  if (val.startsWith('CARNIVAL_USER:')) {
    const userId = val.split(':')[1];
    return userId ? { userId } : null;
  }
  if (val.startsWith('CARNIVAL_KID:')) {
    const parts = val.split(':');
    if (parts.length === 3 && parts[1] && parts[2]) {
      return { userId: `KID:${parts[1]}:${parts[2]}` };
    }
  }
  return null;
}

function VendorScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stallId = searchParams.get('stallId') || '';
  const scannerRef = useRef(null);
  const html5Scanner = useRef(null);
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('Scan a customer QR code.');

  const goToCharge = (userId) => {
    const dest = `/vendor/charge/${encodeURIComponent(userId)}${stallId ? `?stallId=${stallId}` : ''}`;
    navigate(dest);
  };

  useEffect(() => {
    let mounted = true;
    async function startScanner() {
      if (!scannerRef.current) return;
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (!mounted || !scannerRef.current) return;
        html5Scanner.current = new Html5QrcodeScanner('vendor-scan-reader', { fps: 5, qrbox: 220 }, false);
        html5Scanner.current.render((decodedText) => {
          const parsed = parseQRPayload(decodedText);
          if (parsed) {
            goToCharge(parsed.userId);
          } else {
            setStatus('That is not a CarnivalCash customer or kid QR code.');
          }
        }, () => {});
      } catch {
        setStatus('Camera unavailable. Enter the QR payload below.');
      }
    }
    startScanner();
    return () => {
      mounted = false;
      html5Scanner.current?.clear?.().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManual = () => {
    const parsed = parseQRPayload(manualValue.trim());
    if (!parsed) {
      setStatus('Enter a value like CARNIVAL_USER:<userId> or CARNIVAL_KID:<parentId>:<kidId>.');
      return;
    }
    goToCharge(parsed.userId);
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>📷 Scan Customer QR</div>
        {stallId && (
          <div style={{ background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: '0.75rem', padding: '0.6rem 1rem', fontSize: '0.9rem', color: '#92400e' }}>
            🎪 Charging for stall · Scan user or kid QR
          </div>
        )}
        <section style={card}>
          <div id="vendor-scan-reader" ref={scannerRef} />
          <hr style={{ border: 'none', borderTop: '1px solid #fed7aa' }} />
          <div style={{ fontWeight: 600, color: '#374151' }}>Or paste QR payload:</div>
          <input
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            placeholder="CARNIVAL_USER:userId  or  CARNIVAL_KID:parentId:kidId"
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
