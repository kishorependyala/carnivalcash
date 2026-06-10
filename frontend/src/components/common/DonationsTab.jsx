import { useCallback, useEffect, useRef, useState } from 'react';

import donationsApi from '../../api/donations';

const RECEIPTS_KEY = 'cc_charity_receipts';

function loadReceipts() {
  try { return JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '{}'); } catch { return {}; }
}
function saveReceipts(data) {
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(data));
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

function ReceiptCell({ charityId, charityName, userNames, onChanged }) {
  const [receipts, setReceipts] = useState(() => loadReceipts()[charityId] || []);
  const [adding, setAdding] = useState(false);
  const [donatedBy, setDonatedBy] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const startAdd = () => { setAdding(true); setDonatedBy(''); setSuggestions([]); };
  const cancelAdd = () => { setAdding(false); setDonatedBy(''); setShowSuggestions(false); };

  const handleNameInput = (val) => {
    setDonatedBy(val);
    if (val.trim().length > 0) {
      const q = val.toLowerCase();
      setSuggestions((userNames || []).filter(u => u.name.toLowerCase().includes(q)).slice(0, 8));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectName = (name) => {
    setDonatedBy(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const processFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const entry = { name: file.name, data: reader.result, addedAt: new Date().toISOString(), donatedBy: donatedBy.trim() };
      setReceipts(prev => {
        const next = [...prev, entry];
        const all = loadReceipts();
        all[charityId] = next;
        saveReceipts(all);
        onChanged?.();
        return next;
      });
      setAdding(false);
      setDonatedBy('');
    };
    reader.readAsDataURL(file);
  }, [charityId, donatedBy, onChanged]);

  const handleFile = useCallback((e) => {
    processFile(e.target.files?.[0]);
    e.target.value = '';
  }, [processFile]);

  const remove = useCallback((idx) => {
    setReceipts(prev => {
      const next = prev.filter((_, i) => i !== idx);
      const all = loadReceipts();
      all[charityId] = next;
      saveReceipts(all);
      onChanged?.();
      return next;
    });
  }, [charityId, onChanged]);

  const preview = (r) => {
    const w = window.open();
    w.document.write(`<html><body style="margin:0;background:#111"><img src="${r.data}" style="max-width:100%;display:block" onerror="this.style.display='none'" /><iframe src="${r.data}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
  };

  return (
    <div style={{ display: 'grid', gap: '0.3rem' }}>
      {receipts.map((r, i) => (
        <div key={i} style={{ display: 'grid', gap: '0.1rem', fontSize: '0.78rem', borderBottom: '1px solid #fde68a', paddingBottom: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <a href={r.data} download={r.name} style={{ color: '#059669', fontWeight: 600, textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>
              📎 {r.name}
            </a>
            <button onClick={() => preview(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: '0.78rem', padding: '0 0.2rem' }} title="Preview">👁</button>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem', padding: '0 0.2rem', lineHeight: 1 }} title="Remove">✕</button>
          </div>
          {r.donatedBy && (
            <div style={{ color: '#6b7280', fontSize: '0.72rem' }}>👤 {r.donatedBy}</div>
          )}
        </div>
      ))}

      {adding ? (
        <div style={{ display: 'grid', gap: '0.35rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.4rem', position: 'relative' }}>
          {/* Typeahead */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Donated by (type to search…)"
              value={donatedBy}
              onChange={e => handleNameInput(e.target.value)}
              onFocus={() => donatedBy.trim() && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              style={{ width: '100%', fontSize: '0.78rem', padding: '0.28rem 0.4rem', border: '1px solid #d1d5db', borderRadius: '0.35rem', outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: '0.35rem', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: '160px', overflowY: 'auto' }}>
                {suggestions.map(u => (
                  <div
                    key={u.id}
                    onMouseDown={() => selectName(u.name)}
                    style={{ padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    👤 {u.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File / Camera buttons */}
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ flex: 1, background: '#15803d', border: 'none', borderRadius: '0.35rem', color: '#fff', fontSize: '0.75rem', padding: '0.28rem 0.4rem', cursor: 'pointer', fontWeight: 600 }}
            >
              📁 File
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              style={{ flex: 1, background: '#0369a1', border: 'none', borderRadius: '0.35rem', color: '#fff', fontSize: '0.75rem', padding: '0.28rem 0.4rem', cursor: 'pointer', fontWeight: 600 }}
            >
              📷 Camera
            </button>
            <button onClick={cancelAdd} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '0.35rem', color: '#6b7280', fontSize: '0.75rem', padding: '0.28rem 0.4rem', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startAdd}
          style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: '0.5rem', color: '#15803d', fontSize: '0.75rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontWeight: 600, textAlign: 'left' }}
          title={`Upload receipt for ${charityName}`}
        >
          + Receipt
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

export default function DonationsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState({});
  const [status, setStatus] = useState('');
  const [receipts, setReceiptsState] = useState(loadReceipts);
  const [userNames, setUserNames] = useState([]);

  const refreshReceipts = useCallback(() => setReceiptsState(loadReceipts()), []);

  const load = async () => {
    setLoading(true);
    try {
      setData(await donationsApi.get());
    } catch {
      setStatus('Unable to load donations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    donationsApi.getUserNames().then(setUserNames).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMatch = async (charity) => {
    setMatching(prev => ({ ...prev, [charity.charityId]: true }));
    try {
      if (charity.myMatch) {
        await donationsApi.removeEmployerMatch(charity.charityId);
      } else {
        await donationsApi.addEmployerMatch(charity.charityId, charity.name, charity.employerMatchTokens);
      }
      await load();
    } catch {
      setStatus('Action failed. Please try again.');
    } finally {
      setMatching(prev => ({ ...prev, [charity.charityId]: false }));
    }
  };

  const charities = data?.charities || [];
  const grandTotalDollars = data?.grandTotalDollars ?? 0;

  const totalDollars = charities.reduce((s, c) => s + c.totalDollars, 0);
  const totalMatches = charities.reduce((s, c) => s + c.employerMatches.length, 0);
  const pctOfCollected = grandTotalDollars > 0 ? ((totalDollars / grandTotalDollars) * 100).toFixed(1) : null;

  // Count charities that have at least one local receipt
  const receiptsCount = Object.values(receipts).filter(arr => arr.length > 0).length;
  const receiptsDollars = charities
    .filter(c => receipts[c.charityId]?.length > 0)
    .reduce((s, c) => s + c.totalDollars, 0);

  // Employer 100% match total = sum of totalDollars for charities with BOTH a receipt AND myMatch
  const totalEmployerMatch = charities
    .filter(c => receipts[c.charityId]?.length > 0 && c.myMatch)
    .reduce((s, c) => s + c.totalDollars, 0);
  // Total donated = only stall dollars with receipts + employer match (both conditions)
  const totalDonatedGrand = receiptsDollars + totalEmployerMatch;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>💝 Donations</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={load} disabled={loading} style={{ background: '#f3f4f6', border: 'none', borderRadius: '0.65rem', padding: '0.4rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
            {loading ? '⏳' : '↺ Refresh'}
          </button>
        </div>
      </div>

      {status && <p style={{ color: status.startsWith('✅') ? '#059669' : '#dc2626', margin: 0, fontSize: '0.88rem' }}>{status}</p>}

      {!loading && charities.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { icon: '💚', label: 'Charities', value: charities.length, color: '#065f46', bg: '#d1fae5' },
            { icon: '💝', label: 'Mapped to Charity Money', value: `$${totalDollars.toFixed(2)}`, color: '#065f46', bg: '#d1fae5' },
            { icon: '💵', label: 'Raised Money', value: `$${grandTotalDollars.toFixed(2)}`, color: '#7c3aed', bg: '#ede9fe' },
            ...(pctOfCollected ? [{ icon: '📊', label: '% to Charity', value: `${pctOfCollected}%`, color: '#0369a1', bg: '#e0f2fe' }] : []),
            { icon: '💼', label: 'Employer 100% Match', value: `$${totalEmployerMatch.toFixed(2)}`, color: '#059669', bg: '#f0fdf4' },
            { icon: '🏆', label: 'Total Donated', value: `$${totalDonatedGrand.toFixed(2)}`, color: '#7c3aed', bg: '#ede9fe' },
            ...(receiptsCount > 0 ? [{ icon: '🧾', label: 'Donated w/ Receipts', value: `${receiptsCount} ($${receiptsDollars.toFixed(2)})`, color: '#15803d', bg: '#f0fdf4' }] : []),
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
              {charities.map((charity) => (
                <tr key={charity.charityId} style={{ borderBottom: '1px solid #fde68a', verticalAlign: 'top' }}>
                  <td style={{ ...td, minWidth: '140px' }}>
                    <div style={{ fontWeight: 800, color: '#065f46' }}>
                      💚 {charity.name}
                      {charity.unmapped && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: '#fde68a', color: '#92400e', borderRadius: '0.4rem', padding: '0.1rem 0.4rem', fontWeight: 700 }}>unmapped</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem' }}>
                      ${charity.totalDollars.toFixed(2)}
                    </div>
                  </td>

                  <td style={{ ...td, minWidth: '140px' }}>
                    <StallsCell stalls={charity.stalls} />
                  </td>

                  <td style={{ ...td, textAlign: 'right', minWidth: '160px' }}>
                    <div style={{ fontWeight: 800, color: '#1d4ed8' }}>
                      🤝 ${charity.employerMatchDollars.toFixed(2)}
                    </div>
                    {charity.employerMatches.length > 0 && (
                      <div style={{ marginTop: '0.3rem' }}>
                        {charity.employerMatches.map((m, i) => (
                          <div key={i} style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            ✓ <span style={{ fontWeight: 600, color: '#374151' }}>{m.userName || '—'}</span>
                            {m.userPhone && (
                              <span style={{ color: '#9ca3af', marginLeft: '0.3rem' }}>{m.userPhone}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Employer 100% Match: value only when BOTH matched AND receipt uploaded */}
                  {(() => {
                    const hasReceipt = (receipts[charity.charityId] || []).length > 0;
                    const hasMatch = !!charity.myMatch;
                    const matchValue = (hasReceipt && hasMatch) ? charity.totalDollars : 0;
                    const totalDonated = hasReceipt ? (charity.totalDollars + matchValue) : 0;
                    return (
                      <>
                        <td style={{ ...td, textAlign: 'right', minWidth: '130px' }}>
                          <div style={{ fontWeight: 800, color: (hasReceipt && hasMatch) ? '#059669' : '#9ca3af' }}>
                            ${matchValue.toFixed(2)}
                          </div>
                          <div style={{ marginTop: '0.3rem' }}>
                            <button
                              onClick={() => handleMatch(charity)}
                              disabled={!!matching[charity.charityId]}
                              style={{
                                padding: '0.3rem 0.6rem',
                                borderRadius: '0.65rem',
                                border: '2px solid ' + (charity.myMatch ? '#059669' : '#d1d5db'),
                                cursor: matching[charity.charityId] ? 'default' : 'pointer',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                background: charity.myMatch ? '#d1fae5' : '#fff',
                                color: charity.myMatch ? '#065f46' : '#374151',
                                opacity: matching[charity.charityId] ? 0.6 : 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {matching[charity.charityId] ? '…' : charity.myMatch ? '✓ Matched' : '🤝 Match'}
                            </button>
                          </div>
                        </td>

                        <td style={{ ...td, textAlign: 'right', minWidth: '110px', fontWeight: 800, color: '#7c3aed' }}>
                          ${totalDonated.toFixed(2)}
                        </td>
                      </>
                    );
                  })()}

                  <td style={{ ...td, minWidth: '140px' }}>
                    <ReceiptCell charityId={charity.charityId} charityName={charity.name} userNames={userNames} onChanged={refreshReceipts} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>
        Employer match is 100% of the total donated to each charity. Click "🤝 Match" to register your pledge. Receipts are stored locally on this device.
      </p>
    </div>
  );
}
