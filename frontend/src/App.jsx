import { Navigate, Route, Routes } from 'react-router-dom';

import AdminDashboard from './components/admin/AdminDashboard';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import ItemSelectPage from './components/user/ItemSelectPage';
import ScanPage from './components/user/ScanPage';
import UserDashboard from './components/user/UserDashboard';
import VendorChargePage from './components/vendor/VendorChargePage';
import VendorDashboard from './components/vendor/VendorDashboard';
import VendorScanPage from './components/vendor/VendorScanPage';
import { useAuth } from './context/AuthContext';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.roles?.includes('admin')) return <Navigate to="/admin" replace />;
  if (user.roles?.includes('vendor')) return <Navigate to="/vendor" replace />;
  return <Navigate to="/user" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/user" element={<ProtectedRoute roles={['user']}><UserDashboard /></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute roles={['user', 'admin']}><ScanPage /></ProtectedRoute>} />
      <Route path="/scan/items/:vendorId" element={<ProtectedRoute roles={['user', 'admin']}><ItemSelectPage mode="vendor" /></ProtectedRoute>} />
      <Route path="/scan/stall/:stallId" element={<ProtectedRoute roles={['user', 'admin']}><ItemSelectPage mode="stall" /></ProtectedRoute>} />
      <Route path="/vendor" element={<ProtectedRoute roles={['vendor']}><VendorDashboard /></ProtectedRoute>} />
      <Route path="/vendor/scan" element={<ProtectedRoute roles={['vendor', 'user', 'admin']}><VendorScanPage /></ProtectedRoute>} />
      <Route path="/vendor/charge/:userId" element={<ProtectedRoute roles={['vendor', 'user', 'admin']}><VendorChargePage /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
