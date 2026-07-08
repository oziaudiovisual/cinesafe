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
      <div className="glass-card rounded-2xl p-4 border border-accent-primary/20 hover:border-accent-primary/40 transition-all duration-300 relative overflow-hidden bg-gradient-to-r from-accent-primary/5 to-transparent">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-accent-primary/5 rounded-full blur-[60px] pointer-events-none -mr-10 -mt-10 group-hover:bg-accent-primary/10 transition-colors duration-500"></div>

        <div className="relative z-10 flex items-center gap-4">
          {/* Imagem do prêmio */}
          <div className="w-14 h-14 rounded-xl bg-black/30 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
            {raffle.prizeImageUrl ? (
              <img src={raffle.prizeImageUrl} alt={raffle.title} className="w-full h-full object-cover" />
            ) : (
              <Icons.Gift className="w-7 h-7 text-accent-primary/60" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isCompleted
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-accent-primary/20 text-accent-primary'
              }`}>
                {isCompleted ? '✨ Concluído' : '🎯 Ativo'}
              </span>
            </div>
            <h3 className="text-white font-bold text-sm truncate">{raffle.title}</h3>
            {!isCompleted && <RaffleCountdown endDate={raffle.endDate} compact />}
            {isCompleted && raffle.winnerName && (
              <span className="text-green-400 text-xs">🏆 {raffle.winnerName}</span>
            )}
          </div>

          {/* CTA + Tickets */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* CTA */}
            {!isCompleted && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-accent-primary font-bold text-xs">Convide amigos</span>
                <span className="text-brand-400 text-[10px]">e ganhe mais tickets!</span>
              </div>
            )}

            {/* Tickets Badge */}
            <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-xl px-3 py-2 text-center group-hover:bg-accent-primary/20 transition-colors">
              <span className="text-accent-primary font-extrabold text-lg block leading-none">
                {userTicketCount}
              </span>
              <span className="text-brand-400 text-[9px] uppercase tracking-wider">
                {userTicketCount === 1 ? 'ticket' : 'tickets'}
              </span>
            </div>

            {/* Seta */}
            <Icons.ArrowRight className="w-5 h-5 text-brand-500 group-hover:text-accent-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </div>
    </Link>
  );
};
