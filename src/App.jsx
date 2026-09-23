import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';

// Everything past login is loaded on demand, so a signed-out visitor's
// first load only ships the login page instead of the whole app.
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Inventory = lazy(() => import('./pages/Inventory.jsx'));
const ItemDetail = lazy(() => import('./pages/ItemDetail.jsx'));
const Transactions = lazy(() => import('./pages/Transactions.jsx'));
const Returns = lazy(() => import('./pages/Returns.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Masters = lazy(() => import('./pages/Masters.jsx'));
const Fields = lazy(() => import('./pages/Fields.jsx'));
const Users = lazy(() => import('./pages/Users.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Scan = lazy(() => import('./pages/Scan.jsx'));
const SelfService = lazy(() => import('./pages/SelfService.jsx'));

function Protected({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <Loading label="Starting R&D Inventory…" />;
  return user ? children : <Navigate to="/login" replace />;
}

function RoleGate({ allow, children }) {
  const { user } = useAuth();
  if (!allow.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, booting } = useAuth();

  if (booting) return <Loading label="Starting R&D Inventory…" />;

  return (
    <Suspense fallback={<Loading label="Loading…" />}>
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
    </Suspense>
  );
}
