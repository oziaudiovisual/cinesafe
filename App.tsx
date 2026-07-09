
import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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

// Loader da ÁREA DE CONTEÚDO (não é tela cheia). Enquanto um chunk carrega, o
// menu/sidebar continua visível e só o miolo mostra o spinner.
const ContentLoader = () => (
  <div className="flex items-center justify-center py-32">
    <div className="w-10 h-10 border-4 border-brand-800 border-t-accent-primary rounded-full animate-spin"></div>
  </div>
);

// Shell da aplicação autenticada (rota de layout). O `Layout` (menu) fica montado
// de forma PERSISTENTE entre navegações — só o conteúdo interno (`Outlet`) troca —
// e o `Suspense` vive DENTRO do Layout, então o menu nunca "pisca" ao carregar uma
// página. Visitantes veem a Landing pública em "/" e são mandados ao login no resto
// (todo recurso real continua atrás de autenticação).
const AppShell: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!user) {
    return location.pathname === '/'
      ? <Suspense fallback={<PageLoader />}><Landing /></Suspense>
      : <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Suspense fallback={<ContentLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

// Guard de rota só-admin (o AppShell já garantiu que há usuário autenticado).
const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
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
          <Routes>
            {/* Rotas públicas sem sidebar — cada uma com seu próprio Suspense */}
            <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            <Route path="/register" element={<Suspense fallback={<PageLoader />}><Register /></Suspense>} />
            <Route path="/notifications" element={<Navigate to="/chat?tab=notifications" replace />} />

            {/* Shell autenticado: o Layout (menu) fica FIXO; só o Outlet troca.
                Visitantes veem a Landing em "/" (tratado dentro do AppShell). */}
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="report-theft" element={<TheftReport />} />
              <Route path="rentals" element={<Rentals />} />
              <Route path="sales" element={<Sales />} />
              <Route path="check-serial" element={<SerialCheck />} />
              <Route path="safety" element={<SafetyMap />} />
              <Route path="rankings" element={<Rankings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="network" element={<Network />} />
              <Route path="chat" element={<Chat />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="raffles" element={<Raffles />} />
              <Route path="admin" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
            </Route>
          </Routes>
        </RouteErrorBoundary>
      </HashRouter>
      <Analytics />
    </AuthProvider>
  );
}

export default App;
