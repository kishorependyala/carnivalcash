import { useEffect, useState } from 'react';

import donationsApi from '../../api/donations';

const RECEIPTS_KEY = 'cc_charity_receipts';
function loadReceipts() {
  try { return JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '{}'); } catch { return {}; }
}

const card = {
  background: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '0.85rem',
  padding: '1rem',
};

const th = (align) => ({
  padding: '0.5rem 0.75rem', textAlign: align, color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap',
});
const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid #fde68a', fontSize: '0.85rem' };

function StallsCell({ stalls }) {
  const [open, setOpen] = useState(false);
  if (!stalls || stalls.length === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: '#fef3c7', border: 'none', cursor: 'pointer', color: '#b45309', fontWeight: 700, fontSize: '0.8rem', padding: '0.15rem 0.4rem', borderRadius: '0.4rem' }}
      >
        🎪 {stalls.length} stall{stalls.length !== 1 ? 's' : ''} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: '0.35rem', display: 'grid', gap: '0.15rem' }}>
          {stalls.map((s, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: '#374151' }}>
              <span style={{ fontWeight: 600 }}>{s.stallName}</span>
              <span style={{ color: '#b45309', marginLeft: '0.35rem' }}>${s.dollars.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PublicDonationsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [receipts, setReceipts] = useState(loadReceipts);

  const load = async () => {
    setLoading(true);
    try {
      setData(await donationsApi.getPublic());
    } catch {
      setStatus('Unable to load donation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh receipts when tab regains focus (uploaded on another tab/page)
  useEffect(() => {
    const onFocus = () => setReceipts(loadReceipts());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const charities = data?.charities || [];
  const grandTotalDollars = data?.grandTotalDollars ?? 0;

  const totalDollars = charities.reduce((s, c) => s + c.totalDollars, 0);
  const totalMatches = charities.reduce((s, c) => s + (c.employerMatchCount ?? 0), 0);
  const totalEmployerMatch = charities
    .filter(c => (c.employerMatchCount ?? 0) > 0 && (receipts[c.charityId] || []).length > 0)
    .reduce((s, c) => s + c.employerMatchDollars, 0);
  const receiptsDollars = charities
    .filter(c => (receipts[c.charityId] || []).length > 0)
    .reduce((s, c) => s + c.totalDollars, 0);
  // Total donated = only stall dollars with receipts + employer match (both conditions)
  const totalDonatedGrand = receiptsDollars + totalEmployerMatch;
  const pctOfCollected = grandTotalDollars > 0 ? ((totalDollars / grandTotalDollars) * 100).toFixed(1) : null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>💝 Donations</h2>
        <button onClick={load} disabled={loading} style={{ background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.4rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
          {loading ? '⏳' : '↺ Refresh'}
        </button>
      </div>

      {status && <p style={{ color: '#dc2626', margin: 0, fontSize: '0.88rem' }}>{status}</p>}

      {!loading && charities.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { icon: '💚', label: 'Charities', value: charities.length, color: '#065f46', bg: '#d1fae5' },
            { icon: '💝', label: 'Mapped to Charity Money', value: `$${totalDollars.toFixed(2)}`, color: '#065f46', bg: '#d1fae5' },
            { icon: '💵', label: 'Raised Money', value: `$${grandTotalDollars.toFixed(2)}`, color: '#7c3aed', bg: '#ede9fe' },
            ...(pctOfCollected ? [{ icon: '📊', label: '% to Charity', value: `${pctOfCollected}%`, color: '#0369a1', bg: '#e0f2fe' }] : []),
            { icon: '💼', label: 'Employer 100% Match', value: `$${totalEmployerMatch.toFixed(2)}`, color: '#059669', bg: '#f0fdf4' },
            { icon: '🏆', label: 'Total Donated', value: `$${totalDonatedGrand.toFixed(2)}`, color: '#7c3aed', bg: '#ede9fe' },
          ].map(({ icon, label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: '0.75rem', padding: '0.5rem 0.9rem', textAlign: 'center', minWidth: '85px' }}>
              <div style={{ fontWeight: 900, fontSize: '1rem', color }}>{icon} {value}</div>
              <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {!loading && charities.length === 0 && (
        <div style={{ ...card, color: '#6b7280', textAlign: 'center' }}>No donation data yet.</div>
      )}

      {!loading && charities.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#fef3c7' }}>
                <th style={th('left')}>Charity</th>
                <th style={th('left')}>Stalls & Amounts</th>
                <th style={th('right')}>Raised Money</th>
                <th style={th('right')}>Employer 100% Match</th>
                <th style={th('right')}>Total Donated</th>
                <th style={th('left')}>Receipts</th>
              </tr>
            </thead>
            <tbody>
              {charities.map((charity) => {
                // Employer 100% Match: requires BOTH employer pledge AND receipt uploaded
                const hasMatch = (charity.employerMatchCount ?? 0) > 0;
                const hasReceipt = (receipts[charity.charityId] || []).length > 0;
                const matchValue = (hasMatch && hasReceipt) ? charity.employerMatchDollars : 0;
                const totalDonated = hasReceipt ? (charity.totalDollars + matchValue) : 0;
                return (
                  <tr key={charity.charityId} style={{ borderBottom: '1px solid #fde68a', verticalAlign: 'top' }}>
                    <td style={{ ...td, minWidth: '140px' }}>
                      <div style={{ fontWeight: 800, color: '#065f46' }}>
                        💚 {charity.name}
                        {charity.unmapped && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: '#fde68a', color: '#92400e', borderRadius: '0.4rem', padding: '0.1rem 0.4rem', fontWeight: 700 }}>unmapped</span>
                        )}
                      </div>
                    </td>

                    <td style={{ ...td, minWidth: '140px' }}>
                      <StallsCell stalls={charity.stalls} />
                    </td>

                    <td style={{ ...td, textAlign: 'right', minWidth: '140px' }}>
                      <div style={{ fontWeight: 800, color: '#1d4ed8' }}>
                        🤝 ${charity.employerMatchDollars.toFixed(2)}
                      </div>
                    </td>

                    <td style={{ ...td, textAlign: 'right', minWidth: '130px' }}>
                      <div style={{ fontWeight: 800, color: (hasMatch && hasReceipt) ? '#059669' : '#9ca3af' }}>
                        ${matchValue.toFixed(2)}
                      </div>
                    </td>

                    <td style={{ ...td, textAlign: 'right', minWidth: '110px', fontWeight: 800, color: '#7c3aed' }}>
                      ${totalDonated.toFixed(2)}
                    </td>

                    <td style={{ ...td, minWidth: '160px' }}>
                      {(receipts[charity.charityId] || []).length > 0 ? (
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          {(receipts[charity.charityId] || []).map((r, i) => (
                            <div key={i} style={{ fontSize: '0.78rem', borderBottom: '1px solid #fde68a', paddingBottom: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <a href={r.data} download={r.name} style={{ color: '#059669', fontWeight: 600, textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
                                  📎 {r.name}
                                </a>
                                <button
                                  onClick={() => { const w = window.open(); w.document.write(`<html><body style="margin:0;background:#111"><img src="${r.data}" style="max-width:100%;display:block" onerror="this.style.display='none'" /><iframe src="${r.data}" style="width:100%;height:100vh;border:none"></iframe></body></html>`); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: '0.78rem', padding: '0 0.2rem' }}
                                  title="Preview"
                                >👁</button>
                              </div>
                              {r.donatedBy && (
                                <div style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: '0.1rem' }}>👤 {r.donatedBy}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>
        Live read-only view · No login required.
      </p>
    </div>
  );
}
