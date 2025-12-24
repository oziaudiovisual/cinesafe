import React, { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import { equipmentService } from '../services/equipmentService';
import { User, Equipment, EquipmentStatus } from '../types';
import { Icons } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

export const Rankings: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [myEquipment, setMyEquipment] = useState<Equipment[]>([]);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const loadData = async () => {
        // Load Leaderboard
        const allUsers = await userService.getAllUsers();
        const sorted = [...allUsers].sort((a, b) => b.reputationPoints - a.reputationPoints);
        setUsers(sorted);

        // Load My Equipment for Score Breakdown
        if (currentUser) {
            const eq = await equipmentService.getUserEquipment(currentUser.id);
            setMyEquipment(eq);
        }
    };
    loadData();
  }, [currentUser]);

  const getTier = (points: number) => {
      if (points >= 5000) return { name: 'Diamond', color: 'text-cyan-300', icon: Icons.ShieldCheck, bg: 'bg-cyan-500/20' };
      if (points >= 2500) return { name: 'Platinum', color: 'text-indigo-300', icon: Icons.Trophy, bg: 'bg-indigo-500/20' };
      if (points >= 1000) return { name: 'Gold', color: 'text-amber-300', icon: Icons.Trophy, bg: 'bg-amber-500/20' };
      if (points >= 500) return { name: 'Silver', color: 'text-slate-300', icon: Icons.Trophy, bg: 'bg-slate-500/20' };
      return { name: 'Bronze', color: 'text-orange-300', icon: Icons.Trophy, bg: 'bg-orange-500/20' };
  };

  // Calculate Breakdown
  const calculateBreakdown = () => {
      if (!currentUser) return null;
      
      const safeItems = myEquipment.filter(e => e.status === EquipmentStatus.SAFE);
      const forRentItems = safeItems.filter(e => e.isForRent);
      const forSaleItems = safeItems.filter(e => e.isForSale);
      const totalValue = safeItems.reduce((acc, item) => acc + (Number(item.value) || 0), 0);

      const hasAvatar = currentUser.avatarUrl && !currentUser.avatarUrl.includes('ui-avatars');
      const hasPhone = !!currentUser.contactPhone;

      return {
          profile: (hasAvatar ? 50 : 0) + (hasPhone ? 50 : 0),
          items: safeItems.length * 10,
          streak: safeItems.length * 5,
          rent: forRentItems.length * 20,
          sale: forSaleItems.length * 15,
          value: Math.floor(totalValue / 1000),
          checks: (currentUser.checksCount || 0) * 2,
          reports: (currentUser.reportsCount || 0) * 1,
          admin: currentUser.role === 'admin' ? 500 : 0
      };
  };

  const myStats = calculateBreakdown();
  const currentTier = currentUser ? getTier(currentUser.reputationPoints) : getTier(0);
  const nextTierPoints = currentUser?.reputationPoints < 500 ? 500 : currentUser?.reputationPoints < 1000 ? 1000 : currentUser?.reputationPoints < 2500 ? 2500 : currentUser?.reputationPoints < 5000 ? 5000 : 10000;
  const progress = currentUser ? Math.min(100, (currentUser.reputationPoints / nextTierPoints) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Icons.Trophy className="w-10 h-10 text-accent-gold" />
            Ranking da Comunidade
        </h1>
        <p className="text-brand-300">
            Profissionais confiáveis ganham pontos ao cadastrar equipamentos, alugar com sucesso e ajudar a comunidade.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Status Card */}
          {currentUser && (
              <div className="lg:col-span-1 space-y-6">
                  <div className="glass-card p-6 rounded-[2.5rem] relative overflow-hidden">
                      <div className="relative z-10 flex flex-col items-center">
                          <img src={currentUser.avatarUrl} alt="User" className="w-24 h-24 rounded-full border-4 border-brand-800 shadow-xl mb-4" />
                          <h2 className="text-2xl font-bold text-white">{currentUser.name.split(' ')[0]}</h2>
                          <div className={`mt-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/10 ${currentTier.bg} ${currentTier.color} flex items-center gap-2`}>
                              <currentTier.icon className="w-4 h-4" />
                              {currentTier.name}
                          </div>

                          <div className="w-full mt-6">
                              <div className="flex justify-between text-xs text-brand-400 mb-2 font-bold uppercase">
                                  <span>Progresso</span>
                                  <span>{currentUser.reputationPoints} / {nextTierPoints} XP</span>
                              </div>
                              <div className="h-3 bg-brand-900 rounded-full overflow-hidden border border-white/5">
                                  <div className="h-full bg-gradient-to-r from-accent-primary to-accent-blue transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                              </div>
                          </div>
                      </div>
                      
                      {/* Background Effects */}
                      <div className="absolute top-0 right-0 w-48 h-48 bg-accent-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                  </div>

                  <div className="glass-card p-6 rounded-3xl border border-white/5">
                      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                          <Icons.HelpCircle className="w-5 h-5 text-accent-blue" />
                          Composição da Sua Pontuação
                      </h3>
                      
                      <div className="flex justify-between text-[10px] text-brand-500 uppercase font-bold mb-2 px-1">
                          <span>Critério (Regra)</span>
                          <span>Seus Pontos</span>
                      </div>

                      <ul className="space-y-3 text-sm text-brand-300">
                          <ScoreRow label="Foto & WhatsApp" rule="+100 XP" value={myStats?.profile || 0} />
                          <ScoreRow label="Itens Seguros" rule="+10 XP/item" value={myStats?.items || 0} />
                          <ScoreRow label="Bônus Seguro" rule="+5 XP/item" value={myStats?.streak || 0} />
                          <ScoreRow label="Em Aluguel" rule="+20 XP/item" value={myStats?.rent || 0} />
                          <ScoreRow label="À Venda" rule="+15 XP/item" value={myStats?.sale || 0} />
                          <ScoreRow label="Valor Inventário" rule="1 XP / R$ 1k" value={myStats?.value || 0} />
                          <ScoreRow label="Verificações" rule="+2 XP/uso" value={myStats?.checks || 0} />
                          <ScoreRow label="Reports" rule="+1 XP/uso" value={myStats?.reports || 0} />
                          {myStats?.admin ? (
                              <ScoreRow label="Bônus Admin" rule="+500 XP" value={myStats.admin} highlight />
                          ) : null}
                      </ul>
                      
                      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                          <span className="text-white font-bold">Total</span>
                          <span className="text-accent-primary font-bold text-lg">{currentUser.reputationPoints} XP</span>
                      </div>
                  </div>
              </div>
          )}

          {/* Leaderboard */}
          <div className="lg:col-span-2">
            <div className="bg-brand-800 rounded-[2rem] border border-brand-700 overflow-hidden shadow-2xl">
                <div className="p-6 bg-brand-900/50 border-b border-brand-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Top Profissionais</h3>
                    <div className="text-xs text-brand-500 uppercase font-bold tracking-widest">Atualizado em tempo real</div>
                </div>

                <div className="divide-y divide-brand-700/50">
                    {users.map((user, index) => {
                        const tier = getTier(user.reputationPoints);
                        return (
                            <div key={user.id} className={`p-5 flex items-center gap-4 hover:bg-white/5 transition-colors ${user.id === currentUser?.id ? 'bg-accent-blue/5' : ''}`}>
                                <div className="w-8 text-center font-bold text-lg text-brand-500">
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                </div>
                                
                                <div className="relative">
                                    <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full border-2 border-brand-600 object-cover" />
                                    <div className="absolute -bottom-1 -right-1 bg-brand-900 rounded-full p-0.5 border border-brand-700">
                                        <div className={`w-3 h-3 rounded-full ${user.role === 'admin' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className={`font-bold text-lg ${user.id === currentUser?.id ? 'text-accent-blue' : 'text-white'}`}>
                                            {user.name}
                                        </h4>
                                        {user.isVerified && <Icons.CheckCircle className="w-4 h-4 text-blue-500" />}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full border border-white/5 ${tier.bg} ${tier.color}`}>
                                            {tier.name}
                                        </span>
                                        <span className="text-brand-500">{user.location}</span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-2xl font-bold text-white">{user.reputationPoints}</div>
                                    <div className="text-[10px] text-brand-500 uppercase tracking-widest font-bold">XP Total</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};

const ScoreRow = ({ label, rule, value, highlight = false }: { label: string, rule: string, value: number, highlight?: boolean }) => (
    <li className="flex justify-between items-center group">
        <div>
            <span className={`block font-medium ${highlight ? 'text-accent-gold' : 'text-brand-200'}`}>{label}</span>
            <span className="text-xs text-brand-500">{rule}</span>
        </div>
        <span className={`${value > 0 ? (highlight ? 'text-accent-gold' : 'text-green-400') : 'text-brand-700'} font-bold transition-colors`}>
            {value > 0 ? '+' : ''}{value} XP
        </span>
    </li>
);