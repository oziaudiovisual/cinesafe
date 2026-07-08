import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { isValidCPF, maskCPF } from '../utils/cpf';
import { raffleService } from '../services/raffleService';

interface RaffleCpfModalProps {
  isOpen: boolean;
  raffleId: string;
  onClose: () => void;
  /** Chamado após participação bem-sucedida, com o total de tickets do usuário. */
  onParticipated: (tickets: number) => void;
}

/**
 * Modal antifraude de participação no sorteio. Coleta o CPF (máscara + validação
 * em tempo real) e chama `raffleService.participate` → RPC `participar_sorteio`.
 * A regra (validação, unicidade, referral qualificado) roda no Postgres.
 */
export const RaffleCpfModal: React.FC<RaffleCpfModalProps> = ({ isOpen, raffleId, onClose, onParticipated }) => {
  const [cpf, setCpf] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset ao abrir + trava o scroll do body.
  useEffect(() => {
    if (!isOpen) return;
    setCpf('');
    setError('');
    setSubmitting(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const valid = isValidCPF(cpf);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setError('');
    setSubmitting(true);
    const res = await raffleService.participate(raffleId, cpf);
    if (res.ok) {
      onParticipated(res.tickets ?? 0);
    } else {
      setError(res.message || 'Não foi possível concluir. Tente novamente.');
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-brand-950/80 backdrop-blur-md animate-fade-in font-sans"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md p-6 md:p-8 rounded-[2rem] relative z-10 border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Fechar"
        >
          <Icons.X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-accent-primary/20 flex items-center justify-center text-accent-primary mb-4">
          <Icons.ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Sorteio protegido contra fraude</h2>
        <p className="text-brand-400 text-sm mb-6">
          Para garantir que cada pessoa concorra <span className="text-white font-semibold">uma vez só</span>, precisamos do seu CPF. Ele é usado apenas pelo nosso sistema antifraude e para a entrega do prêmio.
        </p>

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm flex items-center gap-3 animate-fade-in">
            <Icons.AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">CPF</label>
            <input
              inputMode="numeric"
              autoFocus
              placeholder="000.000.000-00"
              value={cpf}
              onChange={e => setCpf(maskCPF(e.target.value))}
              className="w-full glass-input rounded-xl py-3.5 px-6 text-white placeholder-brand-600 font-medium tracking-wide"
            />
          </div>
          <button
            type="submit"
            disabled={!valid || submitting}
            className="w-full bg-gradient-to-r from-accent-primary to-accent-blue text-brand-950 font-bold py-4 rounded-xl hover:shadow-glow hover:scale-[1.02] transition-all text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-brand-950/30 border-t-brand-950 rounded-full animate-spin"></span>
                Confirmando...
              </>
            ) : 'Confirmar e participar'}
          </button>
        </form>

        <p className="text-[10px] text-brand-500 text-center mt-4">
          🔒 Seu CPF fica protegido e não é exibido a outros usuários.
        </p>
      </div>
    </div>,
    document.body
  );
};
