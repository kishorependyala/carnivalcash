import { useEffect, useState } from 'react';

import charitiesApi from '../../api/charities';
import stallsApi from '../../api/stalls';
import { card } from '../common/ProfileSections';

function CharitiesTab() {
  const [charities, setCharities] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([charitiesApi.list(), stallsApi.listAll()])
      .then(([ch, st]) => { setCharities(ch); setStalls(st); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p style={{ color: '#9ca3af' }}>Loading charities…</p>;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>💝 Charities & Fundraising</div>
      {charities.length === 0 && <section style={card}><p style={{ margin: 0, color: '#6b7280' }}>No charities yet.</p></section>}
      {charities.map(charity => {
        const contributors = stalls.filter(s =>
          (s.charities || []).some(c => c.charityId === charity.charityId)
        );
        return (
          <section key={charity.charityId} style={{ ...card, gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>💚 {charity.name}</div>
                {charity.description && <div style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.2rem' }}>{charity.description}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669' }}>{charity.tokenBalance || 0}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase' }}>tokens raised</div>
              </div>
            </div>
            {contributors.length > 0 && (
              <div style={{ borderTop: '1px solid #bbf7d0', paddingTop: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, marginBottom: '0.3rem' }}>Contributing stalls:</div>
                {contributors.map(s => {
                  const c = (s.charities || []).find(entry => entry.charityId === charity.charityId);
                  return (
                    <div key={s.stallId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#374151', padding: '0.2rem 0' }}>
                      <span>{s.stallType === 'game' ? '🎯' : '🍕'} {s.stallName}</span>
                      <span style={{ color: '#059669', fontWeight: 600 }}>{c?.percentage || 0}% of earnings</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default CharitiesTab;
