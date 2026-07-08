import React from 'react';
import { Link } from 'react-router-dom';
import { Raffle } from '../types';
import { RaffleCountdown } from './RaffleCountdown';
import { Icons } from './Icons';

interface RaffleCardProps {
  raffle: Raffle;
  userTicketCount?: number;
}

export const RaffleCard: React.FC<RaffleCardProps> = ({ raffle, userTicketCount = 0 }) => {
  const isCompleted = raffle.status === 'completed';

  return (
    <Link to="/raffles" className="block group">
      <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
        {/* Background gradiente vibrante */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 via-violet-800/40 to-cyan-900/50"></div>
        <div className="absolute top-0 right-0 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div className="relative z-10 p-4 flex items-center gap-4">
          {/* Imagem do prêmio */}
          <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center ring-2 ring-purple-500/30">
            {raffle.prizeImageUrl ? (
              <img src={raffle.prizeImageUrl} alt={raffle.title} className="w-full h-full object-cover" />
            ) : (
              <Icons.Gift className="w-8 h-8 text-purple-400" />
            )}
          </div>

          {/* Info do sorteio */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/20">
                🎰 Sorteio {isCompleted ? 'Encerrado' : 'Ativo'}
              </span>
            </div>
            <h3 className="text-white font-bold text-base truncate">{raffle.title}</h3>
            {!isCompleted && (
              <div className="mt-1">
                <RaffleCountdown endDate={raffle.endDate} compact />
              </div>
            )}
            {isCompleted && raffle.winnerName && (
              <span className="text-green-400 text-xs font-semibold">🏆 {raffle.winnerName}</span>
            )}
          </div>

          {/* CTA central — chamativo */}
          {!isCompleted && (
            <div className="hidden md:flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-400/20 group-hover:from-purple-500/30 group-hover:to-cyan-500/30 transition-all">
              <span className="text-purple-300 font-extrabold text-sm whitespace-nowrap">🎟️ Participe e Concorra!</span>
              <span className="text-cyan-400/80 text-[10px] font-medium">Convide amigos = mais chances</span>
            </div>
          )}

          {/* Tickets do usuário */}
          <div className="flex-shrink-0 text-center">
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl px-4 py-2 shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all group-hover:scale-105">
              <span className="text-white font-black text-xl block leading-none">
                {userTicketCount}
              </span>
              <span className="text-purple-200 text-[9px] uppercase tracking-wider font-bold">
                {userTicketCount === 1 ? 'ticket' : 'tickets'}
              </span>
            </div>
          </div>

          {/* Seta */}
          <Icons.ArrowRight className="w-5 h-5 text-purple-400 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
};
