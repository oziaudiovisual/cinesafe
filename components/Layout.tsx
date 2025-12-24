import React, { useState, useMemo, useCallback, memo } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { Icons } from './Icons';
import { useAuth } from '../context/AuthContext';
import { CineSafeLogo } from './CineSafeLogo';

interface LayoutProps {
  children: React.ReactNode;
}

const LayoutComponent: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const navItems = useMemo(() => [
    { to: '/', label: 'Início', icon: Icons.Home },
    { to: '/notifications', label: 'Notificações', icon: Icons.MessageCircle },
    { to: '/network', label: 'Minha Rede', icon: Icons.Users },
    { to: '/inventory', label: 'Inventário', icon: Icons.Camera },
    { to: '/rentals', label: 'Alugar', icon: Icons.ShoppingBag },
    { to: '/sales', label: 'Comprar', icon: Icons.Tag },
    { to: '/safety', label: 'Segurança', icon: Icons.Siren },
    { to: '/check-serial', label: 'Verificar', icon: Icons.Search },
    { to: '/rankings', label: 'Ranking', icon: Icons.Trophy },
  ], []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-brand-950 font-sans text-brand-50">
      
      {/* Desktop Sidebar (Floating Glass) */}
      <aside className="hidden md:flex flex-col w-[280px] h-full p-6 z-[1050]">
        <div className="glass flex flex-col h-full rounded-[2rem] relative overflow-hidden shadow-2xl">
            {/* Glow Effect */}
            <div className="absolute top-0 left-0 w-full h-32 bg-accent-primary/10 blur-2xl pointer-events-none"></div>

            {/* Header */}
            <div className="px-[18px] py-6 flex items-center z-10">
                <CineSafeLogo className="w-full" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-2 z-10 overflow-y-auto custom-scrollbar py-4">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                            isActive
                                ? 'text-white bg-white/5 shadow-lg border border-white/5'
                                : 'text-brand-400 hover:text-white hover:bg-white/5'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-primary rounded-full"></div>}
                                <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-accent-primary' : 'text-brand-500 group-hover:text-brand-200'}`} />
                                <span className="font-medium tracking-wide text-sm">{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}

                {/* Admin Link */}
                {user?.role === 'admin' && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                        `flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 mt-6 border border-dashed border-accent-warning/30 ${
                            isActive
                            ? 'bg-accent-warning/10 text-accent-warning'
                            : 'text-accent-warning/70 hover:bg-accent-warning/10 hover:text-accent-warning'
                        }`
                        }
                    >
                        <Icons.Lock className="w-5 h-5" />
                        <span className="font-medium text-sm">Admin</span>
                    </NavLink>
                )}
            </nav>

            {/* User Profile Footer */}
            <div className="p-4 z-10 mt-auto space-y-4">
                {user ? (
                    <>
                        <NavLink to="/report-theft" className="group relative overflow-hidden flex items-center justify-center space-x-2 w-full bg-gradient-to-r from-red-600 to-red-500 text-white p-3 rounded-xl transition-all hover:shadow-lg hover:shadow-red-500/20">
                            <Icons.ShieldAlert className="w-4 h-4" />
                            <span className="font-bold text-sm tracking-wide">REPORTAR</span>
                        </NavLink>
                        
                        <div className="bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                            <Link to="/profile" className="relative shrink-0 group">
                                <img src={user.avatarUrl} alt="User" className="w-9 h-9 rounded-full object-cover ring-2 ring-brand-800 group-hover:ring-accent-primary transition-all" />
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-accent-success rounded-full border border-brand-900"></div>
                            </Link>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{user.name.split(' ')[0]}</p>
                                <p className="text-[10px] text-accent-primary font-bold flex items-center gap-1">
                                  <Icons.Trophy className="w-3 h-3" /> {user.reputationPoints} XP
                                </p>
                            </div>
                            <button onClick={handleLogout} title="Sair" className="text-brand-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <Icons.LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-white/5 p-4 rounded-xl text-center border border-white/5">
                        <p className="text-xs font-medium text-brand-400 mb-3">Acesse sua conta</p>
                        <NavLink to="/login" className="block w-full py-2 bg-accent-primary text-brand-950 rounded-lg font-bold text-sm hover:bg-accent-primary/90 transition-colors">
                            Entrar
                        </NavLink>
                    </div>
                )}
            </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-brand-950/90 backdrop-blur-xl z-[1050] border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
            <CineSafeLogo size={32} />
        </div>
        <button onClick={toggleMobileMenu} className="text-white p-2 rounded-lg bg-white/5">
            {isMobileMenuOpen ? <Icons.X /> : <Icons.Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-brand-950/95 backdrop-blur-2xl z-[1040] pt-20 px-6 flex flex-col animate-fade-in">
            <nav className="space-y-2 flex-1">
                {navItems.map((item) => (
                    <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                        `flex items-center space-x-4 px-4 py-4 rounded-xl text-lg font-medium transition-all ${
                        isActive ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20' : 'text-brand-400'
                        }`
                    }
                    >
                    <item.icon className="w-6 h-6" />
                    <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="pb-8 space-y-4">
                 {user ? (
                     <button 
                        onClick={() => { handleLogout(); closeMobileMenu(); }}
                        className="w-full bg-brand-800 border border-brand-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
                    >
                        <Icons.LogOut className="w-5 h-5" /> Sair
                    </button>
                 ) : (
                    <NavLink 
                        to="/login"
                        onClick={closeMobileMenu}
                        className="flex items-center justify-center w-full bg-accent-primary text-brand-950 font-bold py-3 rounded-xl"
                    >
                        Entrar
                    </NavLink>
                 )}
            </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-0">
        
        {/* Background Orbs */}
        <div className="fixed top-[-10%] right-[-5%] w-[400px] h-[400px] bg-accent-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-accent-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 pt-8 pb-20 z-10 custom-scrollbar scroll-smooth mt-[60px] md:mt-0">
            <div className="max-w-7xl mx-auto w-full">
                {children}
            </div>
        </main>
      </div>
    </div>
  );
};

export const Layout = memo(LayoutComponent);
