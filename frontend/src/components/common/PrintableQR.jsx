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
    ref.current.classList.add('print-qr-active');
    window.print();
    ref.current.classList.remove('print-qr-active');
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
