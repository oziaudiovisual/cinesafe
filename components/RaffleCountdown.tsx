import React, { useState, useEffect } from 'react';

interface RaffleCountdownProps {
  endDate: string;
  compact?: boolean;
}

export const RaffleCountdown: React.FC<RaffleCountdownProps> = ({ endDate, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calcTime = () => {
      const end = new Date(endDate + 'T23:59:59').getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calcTime();
    const interval = setInterval(calcTime, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (isExpired) {
    return (
      <div className={`flex items-center gap-2 ${compact ? '' : 'justify-center'}`}>
        <div className={`bg-red-500/20 border border-red-500/30 rounded-xl ${compact ? 'px-3 py-1.5' : 'px-6 py-3'}`}>
          <span className={`font-bold text-red-400 ${compact ? 'text-xs' : 'text-base'}`}>
            ⏰ Sorteio Encerrado
          </span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {[
          { value: timeLeft.days, label: 'd' },
          { value: timeLeft.hours, label: 'h' },
          { value: timeLeft.minutes, label: 'm' },
        ].map((item, i) => (
          <div key={i} className="flex items-baseline gap-0.5">
            <span className="text-accent-primary font-bold text-sm tabular-nums">
              {String(item.value).padStart(2, '0')}
            </span>
            <span className="text-brand-500 text-[10px]">{item.label}</span>
            {i < 2 && <span className="text-brand-600 text-xs mx-0.5">:</span>}
          </div>
        ))}
      </div>
    );
  }

  const blocks = [
    { value: timeLeft.days, label: 'Dias' },
    { value: timeLeft.hours, label: 'Horas' },
    { value: timeLeft.minutes, label: 'Min' },
    { value: timeLeft.seconds, label: 'Seg' },
  ];

  return (
    <div className="flex items-center gap-3 justify-center">
      {blocks.map((block, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <div className="bg-black/40 backdrop-blur-md border border-accent-primary/20 rounded-2xl w-[72px] h-[72px] flex items-center justify-center shadow-lg shadow-accent-primary/5">
              <span className="text-accent-primary font-extrabold text-3xl tabular-nums drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                {String(block.value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-brand-400 text-[10px] font-medium uppercase tracking-widest mt-1.5">
              {block.label}
            </span>
          </div>
          {i < blocks.length - 1 && (
            <span className="text-accent-primary/40 text-2xl font-bold mt-[-16px]">:</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
