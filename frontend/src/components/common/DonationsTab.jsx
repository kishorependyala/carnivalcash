import { useEffect, useState } from 'react';

import donationsApi from '../../api/donations';

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

export default function DonationsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState({});
  const [status, setStatus] = useState('');

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

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const tokenRate = data?.tokenRate || 2;
  const charities = data?.charities || [];

  const totalTokens = charities.reduce((s, c) => s + c.totalTokens, 0);
  const totalDollars = charities.reduce((s, c) => s + c.totalDollars, 0);
  const totalMatches = charities.reduce((s, c) => s + c.employerMatches.length, 0);

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
            { icon: '🪙', label: 'Total Tokens', value: totalTokens, color: '#92400e', bg: '#fde68a' },
            { icon: '💵', label: 'Total Amount', value: `$${totalDollars.toFixed(2)}`, color: '#065f46', bg: '#d1fae5' },
            { icon: '🤝', label: 'Employer Matches', value: totalMatches, color: '#1d4ed8', bg: '#dbeafe' },
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
                <th style={th('right')}>Employer Match (100%)</th>
                <th style={th('center')}>My Employer</th>
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
                      🪙 {charity.totalTokens} · ${charity.totalDollars.toFixed(2)}
                    </div>
                  </td>

                  <td style={{ ...td, minWidth: '180px' }}>
                    {charity.stalls.length === 0
                      ? <span style={{ color: '#9ca3af' }}>—</span>
                      : charity.stalls.map((s, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: '#374151', marginBottom: '0.15rem' }}>
                          <span style={{ fontWeight: 600 }}>{s.stallName}</span>
                          <span style={{ color: '#b45309', marginLeft: '0.4rem' }}>🪙{s.tokens} / ${s.dollars.toFixed(2)}</span>
                        </div>
                      ))
                    }
                  </td>

                  <td style={{ ...td, textAlign: 'right', minWidth: '160px' }}>
                    <div style={{ fontWeight: 800, color: '#1d4ed8' }}>
                      🤝 🪙{charity.employerMatchTokens} / ${charity.employerMatchDollars.toFixed(2)}
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

                  <td style={{ ...td, textAlign: 'center', minWidth: '110px' }}>
                    <button
                      onClick={() => handleMatch(charity)}
                      disabled={!!matching[charity.charityId]}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.65rem',
                        border: '2px solid ' + (charity.myMatch ? '#059669' : '#d1d5db'),
                        cursor: matching[charity.charityId] ? 'default' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        background: charity.myMatch ? '#d1fae5' : '#fff',
                        color: charity.myMatch ? '#065f46' : '#374151',
                        opacity: matching[charity.charityId] ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {matching[charity.charityId] ? '…' : charity.myMatch ? '✓ Matched' : '🤝 My Employer Matches'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>
        Employer match is 100% of the total tokens donated to each charity. Click "My Employer Matches" to register your pledge.
      </p>
    </div>
  );
}
