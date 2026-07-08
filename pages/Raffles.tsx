import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../components/Icons';
import { RaffleCountdown } from '../components/RaffleCountdown';
import { raffleService } from '../services/raffleService';
import { Raffle, RaffleTicket } from '../types';

export const Raffles: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeRaffles, setActiveRaffles] = useState<Raffle[]>([]);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [userTickets, setUserTickets] = useState<RaffleTicket[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ userId: string; userName: string; userAvatar: string; ticketCount: number }[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    loadRaffles();
  }, []);

  const loadRaffles = async () => {
    setLoading(true);
    try {
      const raffles = await raffleService.getActiveRaffles();
      // Também buscar sorteios concluídos recentemente (últimos 30 dias)
      const all = await raffleService.getAllRaffles();
      const recentCompleted = all.filter(r =>
        r.status === 'completed' &&
        r.drawnAt &&
        (Date.now() - new Date(r.drawnAt).getTime()) < 30 * 24 * 60 * 60 * 1000
      );
      const combined = [...raffles, ...recentCompleted];
      setActiveRaffles(combined);
      if (combined.length > 0) {
        await selectRaffle(combined[0]);
      }
    } catch (e) {
      console.error('Erro ao carregar sorteios:', e);
    }
    setLoading(false);
  };

  const selectRaffle = async (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    if (user) {
      const [tickets, lb] = await Promise.all([
        raffleService.getUserTickets(raffle.id, user.id),
        raffleService.getRaffleLeaderboard(raffle.id),
      ]);
      setUserTickets(tickets);
      setLeaderboard(lb);
    }
  };

  const copyInviteLink = async () => {
    if (!user?.referralCode) return;
    const link = `${window.location.origin}/#/register?ref=${user.referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e) {
      console.error('Erro ao copiar link:', e);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (activeRaffles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center px-6 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-brand-800 border border-white/5 flex items-center justify-center mb-6">
          <Icons.Gift className="w-10 h-10 text-brand-500" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Nenhum sorteio ativo</h2>
        <p className="text-brand-400 text-sm max-w-sm">
          Fique ligado! Em breve teremos sorteios incríveis de equipamentos para a comunidade.
        </p>
      </div>
    );
  }

  const signupTickets = userTickets.filter(t => t.source === 'signup').length;
  const referralTickets = userTickets.filter(t => t.source === 'referral').length;
  const isCompleted = selectedRaffle?.status === 'completed';
  const isWinner = isCompleted && selectedRaffle?.winnerId === user.id;

  // Calcula stats reais a partir do leaderboard (fonte de verdade)
  const realTotalParticipants = leaderboard.length;
  const realTotalTickets = leaderboard.reduce((sum, entry) => sum + entry.ticketCount, 0);
  const realChances = realTotalTickets > 0 ? ((userTickets.length / realTotalTickets) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Título da página */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg">
          <Icons.Gift className="w-5 h-5 text-brand-950" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Sorteios</h1>
          <p className="text-brand-400 text-xs">Convide amigos e aumente suas chances</p>
        </div>
      </div>

      {/* Tabs de sorteio se houver mais de um */}
      {activeRaffles.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {activeRaffles.map(r => (
            <button
              key={r.id}
              onClick={() => selectRaffle(r)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedRaffle?.id === r.id
                  ? 'bg-accent-primary text-brand-950'
                  : 'bg-white/5 text-brand-300 hover:bg-white/10'
              }`}
            >
              {r.title}
            </button>
          ))}
        </div>
      )}

      {selectedRaffle && (
        <>
          {/* Hero do sorteio */}
          <div className="glass-card rounded-[2rem] relative overflow-hidden border border-white/5">
            {/* Glows de fundo */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-accent-primary/10 rounded-full blur-[100px] pointer-events-none -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-accent-secondary/10 rounded-full blur-[80px] pointer-events-none -ml-10 -mb-10"></div>

            {isCompleted && isWinner && (
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none z-0"></div>
            )}

            <div className="relative z-10 p-5 md:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Coluna esquerda (50%): Imagem + Info + Countdown — preenchendo tudo */}
                <div className="flex gap-5 items-stretch h-full">
                  {/* Imagem do prêmio — ocupa toda a altura */}
                  <div className="w-36 md:w-44 rounded-2xl bg-black/30 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {selectedRaffle.prizeImageUrl ? (
                      <img
                        src={selectedRaffle.prizeImageUrl}
                        alt={selectedRaffle.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icons.Gift className="w-16 h-16 text-accent-primary/40" />
                    )}
                  </div>

                  {/* Info + Countdown */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                          isCompleted
                            ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                            : 'bg-accent-primary/20 text-accent-primary border border-accent-primary/20'
                        }`}>
                          {isCompleted ? '✨ Realizado' : '🎯 Sorteio Ativo'}
                        </span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-1">
                        {selectedRaffle.title}
                      </h2>
                      <p className="text-brand-300 text-sm mb-4 line-clamp-2">
                        {selectedRaffle.description}
                      </p>
                    </div>

                    {!isCompleted && (
                      <RaffleCountdown endDate={selectedRaffle.endDate} />
                    )}

                    {isCompleted && selectedRaffle.winnerName && (
                      <div className={`inline-flex items-center gap-3 rounded-xl px-4 py-2.5 ${
                        isWinner
                          ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
                          : 'bg-white/5 border border-white/10'
                      }`}>
                        <img
                          src={selectedRaffle.winnerAvatar || ''}
                          alt={selectedRaffle.winnerName}
                          className="w-10 h-10 rounded-full object-cover border-2 border-yellow-500"
                        />
                        <div>
                          <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider block">
                            🏆 Vencedor
                          </span>
                          <span className="text-white font-bold">
                            {isWinner ? 'Você! 🎉' : selectedRaffle.winnerName}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna direita (50%): Stats 2×2 preenchendo todo o espaço */}
                <div className="grid grid-cols-2 gap-3 h-full">
                  {[
                    { label: 'Participantes', value: realTotalParticipants, icon: Icons.Users },
                    { label: 'Tickets Totais', value: realTotalTickets, icon: Icons.Ticket },
                    { label: 'Seus Tickets', value: userTickets.length, icon: Icons.Gift, highlight: true },
                    { label: 'Suas Chances', value: `${realChances}%`, icon: Icons.BarChart },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-4 flex flex-col items-center justify-center ${
                        stat.highlight
                          ? 'bg-accent-primary/10 border border-accent-primary/20'
                          : 'bg-black/20 border border-white/5'
                      }`}
                    >
                      <stat.icon className={`w-5 h-5 mb-1 ${stat.highlight ? 'text-accent-primary' : 'text-brand-400'}`} />
                      <span className={`text-2xl font-extrabold leading-tight ${stat.highlight ? 'text-accent-primary' : 'text-white'}`}>
                        {stat.value}
                      </span>
                      <span className="text-brand-500 text-[10px] uppercase tracking-wider font-bold mt-0.5">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detalhamento dos seus tickets + Convite */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seus Tickets */}
            <div className="glass-card rounded-2xl p-6 border border-white/5">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Icons.Ticket className="w-5 h-5 text-accent-primary" />
                Seus Tickets
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3 border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Icons.CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-brand-300 text-sm">Cadastro na plataforma</span>
                  </div>
                  <span className="text-white font-bold">{signupTickets}</span>
                </div>
                <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3 border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent-secondary/20 flex items-center justify-center">
                      <Icons.UserPlus className="w-4 h-4 text-accent-secondary" />
                    </div>
                    <span className="text-brand-300 text-sm">Amigos convidados</span>
                  </div>
                  <span className="text-white font-bold">{referralTickets}</span>
                </div>
                <div className="flex items-center justify-between bg-accent-primary/5 rounded-xl px-4 py-3 border border-accent-primary/10">
                  <span className="text-accent-primary font-bold text-sm">Total</span>
                  <span className="text-accent-primary font-extrabold text-xl">{userTickets.length}</span>
                </div>
              </div>
            </div>

            {/* Convite */}
            {!isCompleted && (
              <div className="glass-card rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-secondary/10 rounded-full blur-[60px] pointer-events-none -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                    <Icons.UserPlus className="w-5 h-5 text-accent-secondary" />
                    Ganhe Mais Tickets
                  </h3>
                  <p className="text-brand-400 text-sm mb-4">
                    Cada amigo que se cadastrar usando seu link = <span className="text-accent-primary font-bold">+1 ticket</span> para você!
                  </p>

                  <div className="bg-black/30 rounded-xl p-4 border border-white/10 mb-4">
                    <span className="text-brand-500 text-[10px] uppercase tracking-wider block mb-1">Seu link de convite</span>
                    <div className="flex items-center gap-2">
                      <code className="text-accent-primary text-xs flex-1 truncate font-mono">
                        {window.location.origin}/#/register?ref={user.referralCode}
                      </code>
                    </div>
                  </div>

                  <button
                    onClick={copyInviteLink}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                      linkCopied
                        ? 'bg-green-500 text-white'
                        : 'bg-accent-primary text-brand-950 hover:bg-cyan-400 shadow-lg shadow-accent-primary/20'
                    }`}
                  >
                    {linkCopied ? '✓ Link Copiado!' : '📋 Copiar Link de Convite'}
                  </button>

                  {referralTickets > 0 && (
                    <p className="text-center text-brand-400 text-xs mt-3">
                      Você já convidou <span className="text-accent-primary font-bold">{referralTickets}</span> {referralTickets === 1 ? 'pessoa' : 'pessoas'}!
                    </p>
                  )}
                </div>
              </div>
            )}

            {isCompleted && isWinner && (
              <div className="glass-card rounded-2xl p-6 border border-yellow-500/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 pointer-events-none"></div>
                <div className="relative z-10 text-center py-4">
                  <span className="text-6xl mb-4 block">🎉</span>
                  <h3 className="text-2xl font-extrabold text-yellow-400 mb-2">Parabéns!</h3>
                  <p className="text-brand-300 text-sm">
                    Você ganhou o sorteio! Verifique suas notificações para mais informações sobre como retirar o prêmio.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Icons.Trophy className="w-5 h-5 text-yellow-400" />
              Ranking de Participantes
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-brand-500 text-sm text-center py-8">
                Nenhum participante ainda. Seja o primeiro a convidar amigos!
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry, i) => {
                  const isCurrentUser = entry.userId === user.id;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                        isCurrentUser
                          ? 'bg-accent-primary/10 border border-accent-primary/20'
                          : i === 0
                            ? 'bg-yellow-500/5 border border-yellow-500/10'
                            : 'bg-black/20 border border-white/5'
                      }`}
                    >
                      {/* Posição */}
                      <div className="w-8 text-center flex-shrink-0">
                        {i < 3 ? (
                          <span className="text-lg">{medals[i]}</span>
                        ) : (
                          <span className="text-brand-500 font-bold text-sm">{i + 1}º</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <img
                        src={entry.userAvatar}
                        alt={entry.userName}
                        className={`w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 ${
                          i === 0 ? 'border-yellow-500' : isCurrentUser ? 'border-accent-primary' : 'border-white/10'
                        }`}
                      />

                      {/* Nome */}
                      <span className={`flex-1 truncate text-sm font-medium ${
                        isCurrentUser ? 'text-accent-primary' : 'text-white'
                      }`}>
                        {entry.userName}
                        {isCurrentUser && <span className="text-brand-400 text-xs ml-1">(você)</span>}
                      </span>

                      {/* Tickets */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Icons.Ticket className={`w-3.5 h-3.5 ${i === 0 ? 'text-yellow-400' : 'text-brand-400'}`} />
                        <span className={`font-bold text-sm ${
                          i === 0 ? 'text-yellow-400' : isCurrentUser ? 'text-accent-primary' : 'text-white'
                        }`}>
                          {entry.ticketCount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Regras */}
          <div className="glass-card rounded-2xl p-6 border border-white/5">
            <h3 className="text-white font-bold text-base mb-3 flex items-center gap-2">
              <Icons.HelpCircle className="w-4 h-4 text-brand-400" />
              Como funciona
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {[
                { step: '1', title: 'Cadastre-se', desc: 'Ao se cadastrar na plataforma durante o período do sorteio, você ganha automaticamente 1 ticket.' },
                { step: '2', title: 'Convide Amigos', desc: 'Compartilhe seu link de convite. Cada amigo que se cadastrar = +1 ticket para você.' },
                { step: '3', title: 'Aguarde o Sorteio', desc: 'Na data de encerramento, o vencedor será sorteado. Mais tickets = mais chances!' },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-primary/20 text-accent-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <span className="text-white font-bold block">{item.title}</span>
                    <span className="text-brand-400 text-xs">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
