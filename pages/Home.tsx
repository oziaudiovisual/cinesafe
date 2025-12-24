import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../components/Icons';
import { ReferralModal } from '../components/ReferralModal';
import { Notification } from '../types';
import { AdBanner } from '../components/AdBanner';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { useUserStats } from '../hooks/useUserStats';
import { useAd } from '../hooks/useAd';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const { userStats, systemStats, loading: loadingStats } = useUserStats();
  const { ad } = useAd();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showReferralModal, setShowReferralModal] = useState(false);

  useEffect(() => {
    const loadNotifications = async () => {
      if (user) {
        const n = await notificationService.getUserNotifications(user.id);
        setNotifications(n);
      }
    };
    loadNotifications();
  }, [user]);
  
  const getGreeting = () => {
    try {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return 'Bom dia.';
      else if (hour >= 12 && hour < 18) return 'Boa tarde.';
      else return 'Boa noite.';
    } catch (error) {
      return 'Que bom que você está aqui.';
    }
  };

  if (!user || loadingStats || !userStats || !systemStats) return (
      <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
  );

  const isPremium = userService.isPremium(user);
  const referralCount = user.referralCount || 0;
  const referralTarget = 5;
  const referralProgress = Math.min(100, (referralCount / referralTarget) * 100);
  const unreadCount = notifications.filter(n => !n.read).length;

  const isProfileIncomplete = !user.contactPhone || user.avatarUrl.includes('ui-avatars.com');
  const hasNoInventory = userStats.totalItems === 0;
  const hasInventoryButNoRentals = userStats.safeItemsCount > 0 && userStats.itemsForRentCount === 0;

  const firstName = user.name.split(' ')[0];
  const nameLength = firstName.length;
  const titleSizeClass = nameLength > 14 ? 'text-2xl md:text-3xl' : nameLength > 9 ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl';

  return (
    <div className="space-y-6 animate-fade-in pb-10">
        <ReferralModal isOpen={showReferralModal} onClose={() => setShowReferralModal(false)} reason="invite" />
        <div className={`grid gap-8 items-stretch ${ad ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {ad && <AdBanner ad={ad} />}
            <div className={`glass-card rounded-[2.5rem] p-8 relative overflow-hidden border border-white/5 flex flex-col ${ad ? 'h-64' : ''}`}>
                 <div className="absolute top-0 right-0 w-96 h-96 bg-accent-primary/10 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20"></div>
                 <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-secondary/10 rounded-full blur-[80px] pointer-events-none -ml-20 -mb-20"></div>
                 <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-4">
                     <div className="flex-1 min-w-0 pr-4">
                        <h1 className={`${titleSizeClass} font-extrabold text-white tracking-tight mb-1 truncate`}>
                            Olá, <span className="text-transparent bg-clip-text bg-glow-text">{firstName}</span>
                        </h1>
                        <p className="text-brand-300 text-base font-light tracking-wide ml-2">{getGreeting()}</p>
                     </div>
                     <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-3 shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-warning to-orange-500 flex items-center justify-center shadow-lg text-brand-950">
                            <Icons.Trophy className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-[10px] text-brand-400 uppercase font-bold tracking-widest block">Reputação</span>
                            <span className="text-2xl font-bold text-white">{user.reputationPoints} XP</span>
                        </div>
                     </div>
                 </div>
                 <div className="mt-auto relative z-10">
                    <div className={`rounded-2xl overflow-hidden p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 relative group ${unreadCount > 0 ? 'bg-brand-900/80 border border-accent-primary/30' : 'bg-brand-900/50 border-white/5'}`}>
                        {unreadCount > 0 && <div className="absolute top-0 left-0 w-1 h-full bg-accent-primary shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>}
                        <div className="flex items-center gap-4 w-full pl-2">
                            <div className={`p-3 rounded-xl relative transition-colors ${unreadCount > 0 ? 'bg-accent-primary/20' : 'bg-brand-800'}`}>
                                <Icons.MessageCircle className={`w-5 h-5 ${unreadCount > 0 ? 'text-accent-primary' : 'text-brand-400'}`} />
                                {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full animate-pulse border border-accent-primary"></div>}
                            </div>
                            <div>
                                <h3 className={`text-base font-bold ${unreadCount > 0 ? 'text-white' : 'text-brand-100'}`}>Notificações</h3>
                                <p className={`text-sm ${unreadCount > 0 ? 'text-accent-primary font-medium' : 'text-brand-400'}`}>
                                    {unreadCount > 0 ? `Você tem ${unreadCount} ${unreadCount === 1 ? 'nova notificação' : 'novas notificações'}.` : 'Nenhuma nova notificação no momento.'}
                                </p>
                            </div>
                        </div>
                        <Link to="/notifications" className={`w-full sm:w-auto font-bold px-5 py-2.5 rounded-xl transition-all border flex items-center justify-center gap-2 whitespace-nowrap text-sm ${unreadCount > 0 ? 'bg-accent-primary text-brand-950 border-accent-primary hover:bg-cyan-300' : 'bg-brand-800 hover:bg-brand-700 text-white border-brand-600'}`}>
                            Ver Notificações <Icons.ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                 </div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isProfileIncomplete && <ActionCard icon={Icons.User} color="warning" title="Complete seu Perfil" text="Adicione foto e WhatsApp para ganhar +100 XP e confiança." link="/profile" linkText="Atualizar Agora" />}
            {hasNoInventory && <ActionCard icon={Icons.Plus} color="primary" title="Proteja seus Itens" text="Seu inventário está vazio. Cadastre equipamentos para proteção." link="/inventory" linkText="Cadastrar Primeiro Item" />}
            {hasInventoryButNoRentals && <ActionCard icon={Icons.Banknote} color="green" title="Faça Renda Extra" text="Você tem itens parados. Coloque-os para alugar e lucre." link="/inventory" linkText="Ativar Aluguéis" />}
        </div>
        {!isPremium && (
            <div className="bg-gradient-to-r from-brand-800 to-brand-900 rounded-[2rem] p-6 border border-brand-700 relative overflow-hidden group hover:border-accent-primary/50 transition-colors">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary"><Icons.Users className="w-6 h-6" /></div>
                         <div>
                             <h3 className="text-lg font-bold text-white">Desbloqueie o Cine Safe Premium</h3>
                             <p className="text-brand-400 text-sm">Convide 5 amigos para uso ilimitado.</p>
                         </div>
                     </div>
                     <div className="flex-1 w-full md:max-w-xs">
                         <div className="flex justify-between text-xs font-bold uppercase text-brand-500 mb-2"><span>Progresso</span><span>{referralCount} / {referralTarget}</span></div>
                         <div className="h-2 bg-brand-950 rounded-full overflow-hidden"><div className="h-full bg-accent-primary transition-all duration-1000" style={{ width: `${referralProgress}%` }}></div></div>
                     </div>
                     <button onClick={() => setShowReferralModal(true)} className="bg-accent-primary hover:bg-cyan-400 text-brand-950 px-6 py-2 rounded-xl font-bold shadow-lg shadow-cyan-500/20 transition-all">Convidar Agora</button>
                 </div>
            </div>
        )}
        <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Icons.Wallet className="w-6 h-6 text-accent-primary" />Meu Patrimônio</h2>
            <div className="glass-card rounded-[2rem] p-6 border border-white/5"><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <StatItem label="Valor em Ativos" value={userStats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} color="accent-primary" />
                <StatItem label="Total de Itens" value={userStats.totalItems.toString()} />
                <StatItem label="Itens Roubados" value={userStats.stolenItems.toString()} color="accent-danger" />
                <StatItem label="Recuperados" value={userStats.recoveredItems.toString()} color="green-400" />
                <StatItem label="Ofertas de Aluguel" value={userStats.rentalOffers.toString()} color="accent-secondary" />
                <StatItem label="Ofertas de Compra" value={userStats.saleOffers.toString()} color="green-400" />
            </div></div>
        </div>
        <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Icons.Globe className="w-6 h-6 text-blue-400" />Impacto global do Cine Safe</h2>
            <div className="bg-brand-800/50 rounded-[2.5rem] border border-white/5 p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
                <GlobalStatItem icon={Icons.Camera} label="Equipamentos Protegidos" value={systemStats.totalItems.toLocaleString('pt-BR')} />
                <GlobalStatItem icon={Icons.Banknote} label="Em Valor Segurado" value={systemStats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })} />
                <GlobalStatItem icon={Icons.Siren} label="Ocorrências Registradas" value={systemStats.stolenItems.toLocaleString('pt-BR')} />
            </div>
        </div>
    </div>
  );
};

// --- Sub-components for Home Page ---
const ActionCard: React.FC<{icon: React.ElementType, color: string, title: string, text: string, link: string, linkText: string}> = ({ icon: Icon, color, title, text, link, linkText }) => (
    <div className={`bg-gradient-to-br from-brand-800 to-brand-900 p-6 rounded-[2rem] border border-accent-${color}/30 relative overflow-hidden group`}>
        <div className={`absolute top-0 right-0 w-32 h-32 bg-accent-${color}/10 rounded-full blur-[40px] -mr-10 -mt-10`}></div>
        <div className="relative z-10">
            <div className={`w-10 h-10 rounded-full bg-accent-${color}/20 flex items-center justify-center text-accent-${color} mb-4`}><Icon className="w-5 h-5" /></div>
            <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
            <p className="text-brand-400 text-sm mb-4">{text}</p>
            <Link to={link} className={`inline-flex items-center text-sm font-bold text-accent-${color} hover:text-white transition-colors`}>{linkText} <Icons.ArrowRight className="w-4 h-4 ml-1" /></Link>
        </div>
    </div>
);
const StatItem: React.FC<{label: string, value: string, color?: string}> = ({ label, value, color = 'white' }) => (
    <div className="text-center">
        <p className="text-[10px] text-brand-400 uppercase font-bold tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-bold text-${color} tracking-tight`}>{value}</p>
    </div>
);
const GlobalStatItem: React.FC<{icon: React.ElementType, label: string, value: string}> = ({ icon: Icon, label, value }) => (
    <div className="relative text-center md:text-left">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto md:mx-0 mb-3"><Icon className="w-6 h-6" /></div>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-brand-400">{label}</p>
    </div>
);