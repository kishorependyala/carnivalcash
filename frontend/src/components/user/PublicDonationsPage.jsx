import PublicDonationsTab from '../common/PublicDonationsTab';

export default function PublicDonationsPage() {
  return (
    <div className="cc-shell">
      <header className="cc-header">
        <div className="cc-header-inner">
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>🎪 CarnivalCash</div>
            <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Donations · Public View</div>
          </div>
        </div>
      </header>
      <main className="cc-content">
        <PublicDonationsTab />
      </main>
    </div>
  );
}
