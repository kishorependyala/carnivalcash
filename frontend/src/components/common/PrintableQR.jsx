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
  return (
    <div style={cardStyle}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <QRCodeSVG value={qrValue} size={180} includeMargin />
      {subtitle ? <p style={{ margin: 0, color: '#6b7280' }}>{subtitle}</p> : null}
      <code style={{ wordBreak: 'break-all' }}>{qrValue}</code>
      <button type="button" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}

export default PrintableQR;
