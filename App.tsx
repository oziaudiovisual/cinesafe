
import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';

// Carrega uma página em chunk separado. Se o chunk falhar (deploy novo trocou os
// hashes, ou service worker/CDN servindo HTML antigo), recarrega a página UMA vez
// para pegar o index.html + chunks atuais. Nunca mostra tela de erro ao usuário.
const lazyWithReload = (factory: () => Promise<{ default: React.ComponentType<any> }>) =>
  lazy(() =>
    factory().catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isChunkError = errMsg.includes('Failed to fetch dynamically imported module')
        || errMsg.includes('Loading chunk')
        || errMsg.includes('Loading CSS chunk')
        || errMsg.includes('text/html')
        || errMsg.includes('Importing a module script failed');

      if (isChunkError) {
        const key = 'chunkReloadAt';
        const now = Date.now();
        const last = Number(sessionStorage.getItem(key) || '0');
        // Permite reload a cada 30s para evitar loop infinito
        if (now - last > 30000) {
          sessionStorage.setItem(key, String(now));
          // Force reload sem cache
          window.location.reload();
          // Retorna promise que nunca resolve (a página vai recarregar)
          return new Promise<{ default: React.ComponentType<any> }>(() => {});
        }
      }
      throw err;
    })
  );

// Lazy Load Pages (code-splitting para melhorar o carregamento inicial)
const Home = lazyWithReload(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Inventory = lazyWithReload(() => import('./pages/Inventory').then(module => ({ default: module.Inventory })));
const TheftReport = lazyWithReload(() => import('./pages/TheftReport').then(module => ({ default: module.TheftReport })));
const Rentals = lazyWithReload(() => import('./pages/Rentals').then(module => ({ default: module.Rentals })));
const Sales = lazyWithReload(() => import('./pages/Sales').then(module => ({ default: module.Sales })));
const SerialCheck = lazyWithReload(() => import('./pages/SerialCheck').then(module => ({ default: module.SerialCheck })));
const Rankings = lazyWithReload(() => import('./pages/Rankings').then(module => ({ default: module.Rankings })));
const Login = lazyWithReload(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazyWithReload(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Profile = lazyWithReload(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const AdminDashboard = lazyWithReload(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const SafetyMap = lazyWithReload(() => import('./pages/SafetyMap').then(module => ({ default: module.SafetyMap })));
const Network = lazyWithReload(() => import('./pages/Network').then(module => ({ default: module.Network })));
const Landing = lazyWithReload(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const Chat = lazyWithReload(() => import('./pages/Chat').then(module => ({ default: module.Chat })));
const Contracts = lazyWithReload(() => import('./pages/Contracts').then(module => ({ default: module.Contracts })));
const Raffles = lazyWithReload(() => import('./pages/Raffles').then(module => ({ default: module.Raffles })));

// Loading Component
const PageLoader = () => (
  <div className="min-h-screen bg-brand-950 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-brand-800 border-t-accent-primary rounded-full animate-spin"></div>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Root Route: public landing for visitors, personal dashboard for logged-in users.
// The main page is open (like a marketplace storefront), but every actual feature
// still lives behind ProtectedRoute, so using anything requires login/register.
const RootRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Landing />;

  return <Layout><Home /></Layout>;
};

// Rede de segurança final: se qualquer rota estourar um erro (ex.: chunk que não
// carrega mesmo após o reload), mostra uma tela amigável com botão de recarregar,
// em vez de uma tela preta.
class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Erro ao carregar a página:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center text-center p-6">
          <p className="text-white font-bold text-lg mb-2">Não foi possível carregar esta página.</p>
          <p className="text-brand-400 text-sm mb-6 max-w-sm">Isso costuma ser uma atualização recente do app. Recarregue para continuar.</p>
          <button
            onClick={() => { sessionStorage.removeItem('chunkReloadAt'); window.location.reload(); }}
            className="px-6 py-3 rounded-xl bg-accent-primary text-brand-950 font-bold hover:bg-cyan-300 transition-colors"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  React.useEffect(() => {
    // Intercepta erros de autenticação do Supabase na URL (HashRouter)
    if (window.location.hash && window.location.hash.includes('error=')) {
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      const errorDesc = hashParams.get('error_description');
      if (errorDesc) {
        alert('Ops! Ocorreu um erro: ' + errorDesc.replace(/\+/g, ' '));
      }
      window.location.hash = '#/login';
    }
  }, []);

  return (
    <AuthProvider>
      <HashRouter>
        <RouteErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Public landing (open) for visitors; dashboard for logged-in users */}
            <Route path="/" element={<RootRoute />} />

            {/* Protected Routes */}
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/report-theft" element={<ProtectedRoute><TheftReport /></ProtectedRoute>} />
            <Route path="/rentals" element={<ProtectedRoute><Rentals /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/check-serial" element={<ProtectedRoute><SerialCheck /></ProtectedRoute>} />
            <Route path="/safety" element={<ProtectedRoute><SafetyMap /></ProtectedRoute>} />
            <Route path="/rankings" element={<ProtectedRoute><Rankings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/notifications" element={<Navigate to="/chat?tab=notifications" replace />} />
            <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
            <Route path="/raffles" element={<ProtectedRoute><Raffles /></ProtectedRoute>} />

            {/* Admin Route */}
            <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>} />
          </Routes>
        </Suspense>
        </RouteErrorBoundary>
      </HashRouter>
      <Analytics />
    </AuthProvider>
  );
}

export default App;
