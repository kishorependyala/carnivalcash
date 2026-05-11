import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Layout from '../common/Layout';

const scannerStyle = {
  background: '#fff',
  border: '1px solid #fed7aa',
  borderRadius: '1rem',
  padding: '1rem',
  display: 'grid',
  gap: '1rem',
};

function parseQRCode(rawValue) {
  const parts = String(rawValue || '').split(':');
  if (parts[0] === 'CARNIVAL_VENDOR' && parts[1]) return { type: 'vendor', id: parts[1] };
  if (parts[0] === 'CARNIVAL_STALL' && parts[1]) return { type: 'stall', id: parts[1] };
  return null;
}

function ScanPage() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const html5Scanner = useRef(null);
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('Scan a stall QR code or paste the payload manually.');

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      if (!scannerRef.current || typeof window === 'undefined') {
        return;
      }

      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (!mounted || !scannerRef.current) {
          return;
        }
        html5Scanner.current = new Html5QrcodeScanner('vendor-qr-reader', { fps: 5, qrbox: 220 }, false);
        html5Scanner.current.render((decodedText) => {
          const parsed = parseQRCode(decodedText);
          if (!parsed) { setStatus('That QR code is not a CarnivalCash stall QR.'); return; }
          if (parsed.type === 'stall') navigate(`/scan/stall/${parsed.id}`);
          else navigate(`/scan/items/${parsed.id}`);
        }, () => {});
      } catch (error) {
        setStatus('Camera scanning is unavailable here. Paste the QR payload manually.');
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (html5Scanner.current?.clear) {
        html5Scanner.current.clear().catch(() => {});
      }
    };
  }, [navigate]);

  const handleManualSubmit = () => {
    const parsed = parseQRCode(manualValue.trim());
    if (!parsed) {
      setStatus('Enter a value like CARNIVAL_STALL:<id> or CARNIVAL_VENDOR:<id>.');
      return;
    }
    if (parsed.type === 'stall') navigate(`/scan/stall/${parsed.id}`);
    else navigate(`/scan/items/${parsed.id}`);
  };

  return (
    <Layout>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h1 style={{ marginBottom: 0 }}>Scan Stall QR</h1>
        <div style={scannerStyle}>
          <div id="vendor-qr-reader" ref={scannerRef} />
          <input value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="CARNIVAL_STALL:stall-id" />
          <button type="button" onClick={handleManualSubmit}>Continue</button>
          <p style={{ margin: 0, color: '#92400e' }}>{status}</p>
        </div>
      </div>
    </Layout>
  );
}

export default ScanPage;
