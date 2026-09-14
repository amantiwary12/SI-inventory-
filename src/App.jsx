import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import ItemDetail from './pages/ItemDetail.jsx';
import Transactions from './pages/Transactions.jsx';
import Returns from './pages/Returns.jsx';
import Reports from './pages/Reports.jsx';
import Masters from './pages/Masters.jsx';
import Fields from './pages/Fields.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Scan from './pages/Scan.jsx';
import SelfService from './pages/SelfService.jsx';

function Protected({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <Loading label="Starting SI Inventory…" />;
  return user ? children : <Navigate to="/login" replace />;
}

function RoleGate({ allow, children }) {
  const { user } = useAuth();
  if (!allow.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, booting } = useAuth();

  if (booting) return <Loading label="Starting SI Inventory…" />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* The QR self-service counter: open to anyone who scans, signed in or not. */}
      <Route path="/scan" element={<Scan />} />

      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/:id" element={<ItemDetail />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/returns" element={<Returns />} />
        <Route
          path="/self-service"
          element={
            <RoleGate allow={['admin']}>
              <SelfService />
            </RoleGate>
          }
        />
        <Route path="/reports" element={<Reports />} />
        <Route path="/masters" element={<Masters />} />
        <Route
          path="/fields"
          element={
            <RoleGate allow={['admin', 'manager']}>
              <Fields />
            </RoleGate>
          }
        />
        <Route
          path="/users"
          element={
            <RoleGate allow={['admin', 'manager']}>
              <Users />
            </RoleGate>
          }
        />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}
