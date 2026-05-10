import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

function firstAllowedRoute(user) {
  if (user?.roles?.includes('admin')) {
    return '/admin';
  }
  if (user?.roles?.includes('vendor')) {
    return '/vendor';
  }
  return '/user';
}

function ProtectedRoute({ children, roles }) {
  const { token, user } = useAuth();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !roles.some((role) => user.roles?.includes(role))) {
    return <Navigate to={firstAllowedRoute(user)} replace />;
  }

  return children;
}

export default ProtectedRoute;
