import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const cardStyle = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1rem',
  border: '1px solid #fed7aa',
  display: 'grid',
  gap: '0.75rem',
  justifyItems: 'center',
  textAlign: 'center',
};

function PrintableQR({ title, qrValue, subtitle }) {
  const ref = useRef(null);

  const handlePrint = () => {
    const el = ref.current;
    if (!el) return;

    // Clone the card to a body-level portal so print CSS can target it directly.
    // This avoids the position:fixed / overflow-x:hidden incompatibility and
    // works reliably across Chrome, Firefox, Safari and iOS.
    const portal = document.createElement('div');
    portal.id = 'qr-print-root';
    const clone = el.cloneNode(true);
    clone.querySelector('button')?.remove(); // strip the Print button from the clone
    portal.appendChild(clone);

    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body > *:not(#qr-print-root) { display: none !important; }
        #qr-print-root {
          display: flex !important;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 2rem;
          text-align: center;
          background: #fff;
        }
        #qr-print-root svg { max-width: none !important; }
      }
    `;
    portal.appendChild(style);
    document.body.appendChild(portal);

    const cleanup = () => {
      if (document.body.contains(portal)) document.body.removeChild(portal);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  return (
    <div ref={ref} style={cardStyle} className="print-qr-card">
      <h3 style={{ margin: 0 }}>{title}</h3>
      <QRCodeSVG value={qrValue} size={180} includeMargin />
      {subtitle ? <p style={{ margin: 0, color: '#6b7280' }}>{subtitle}</p> : null}
      <button type="button" onClick={handlePrint}>
        Print
      </button>
    </div>
  );
}

export default PrintableQR;
