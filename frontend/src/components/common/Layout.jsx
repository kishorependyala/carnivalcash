import { NavLink } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

const shellStyle = {
  minHeight: '100vh',
  background: '#fff7ed',
  color: '#1f2937',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = {
  background: '#f59e0b',
  color: '#fff',
  padding: '1rem',
  boxShadow: '0 8px 20px rgba(245, 158, 11, 0.25)',
};

const headerInnerStyle = {
  maxWidth: '960px',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
};

const contentStyle = {
  flex: 1,
  width: '100%',
  maxWidth: '960px',
  margin: '0 auto',
  padding: '1rem 1rem 5rem',
  boxSizing: 'border-box',
};

const bottomNavStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  background: '#ffffff',
  borderTop: '1px solid #fed7aa',
};

const navInnerStyle = {
  maxWidth: '960px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
};

const navLinkStyle = ({ isActive }) => ({
  padding: '0.9rem 0.5rem',
  textAlign: 'center',
  textDecoration: 'none',
  color: isActive ? '#d97706' : '#6b7280',
  fontWeight: isActive ? 700 : 500,
  fontSize: '0.95rem',
});

function getNavLinks(user) {
  if (user?.roles?.includes('admin')) {
    return [
      { to: '/admin', label: 'Stats' },
      { to: '/admin#tokens', label: 'Tokens' },
      { to: '/admin#event', label: 'Event' },
    ];
  }

  if (user?.roles?.includes('vendor')) {
    return [
      { to: '/vendor', label: 'QR' },
      { to: '/vendor#items', label: 'Items' },
      { to: '/vendor#history', label: 'History' },
    ];
  }

  return [
    { to: '/user', label: 'Home' },
    { to: '/scan', label: 'Scan' },
    { to: '/user#kids', label: 'Kids' },
  ];
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const links = getNavLinks(user);

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>🎪 CarnivalCash</div>
            <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>{user?.phone || 'Carnival donations made easy'}</div>
          </div>
          {user ? (
            <button
              type="button"
              onClick={logout}
              style={{ border: 0, borderRadius: '999px', padding: '0.65rem 1rem', fontWeight: 700 }}
            >
              Logout
            </button>
          ) : null}
        </div>
      </header>
      <main style={contentStyle}>{children}</main>
      {user ? (
        <nav style={bottomNavStyle}>
          <div style={navInnerStyle}>
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} style={navLinkStyle} end={link.to === '/admin' || link.to === '/user' || link.to === '/vendor'}>
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

export default Layout;
