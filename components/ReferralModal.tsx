import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { useAuth } from '../context/AuthContext';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'inventory' | 'check' | 'contact' | 'invite';
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose, reason }) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !user) return null;

  const currentReferrals = user.referralCount || 0;
  const target = 5;
  const progress = Math.min(100, (currentReferrals / target) * 100);

  const inviteLink = `${window.location.origin}/#/register?ref=${user.referralCode}`;
  
  // WhatsApp Message Integration
  const waMessage = encodeURIComponent(`Olá! Estou usando o Cine Safe para proteger meus equipamentos audiovisuais. Cadastre-se com meu link para ganharmos benefícios exclusivos: ${inviteLink}`);
  const waUrl = `https://wa.me/?text=${waMessage}`;

  const handleWhatsAppShare = () => {
      window.open(waUrl, '_blank');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const titles = {
      inventory: "Limite de Inventário Atingido",
      check: "Limite de Verificações Atingido",
      contact: "Limite de Contatos Atingido",
      invite: "Convide Amigos"
  };

  const messages = {
      inventory: "No plano gratuito, você pode cadastrar até 3 equipamentos.",
      check: "Você atingiu seu limite de 1 verificação de serial por mês.",
      contact: "Você já revelou 2 contatos de proprietários este mês.",
      invite: "Ajude a comunidade a crescer e desbloqueie recursos ilimitados para sua conta."
  };

  return createPortal(
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-brand-950/90 backdrop-blur-xl animate-fade-in">
      <div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] relative overflow-hidden border border-white/10 shadow-2xl">
        
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 rounded-full blur-[50px] pointer-events-none -mr-10 -mt-10"></div>

        <button onClick={onClose} className="absolute top-4 right-4 text-brand-400 hover:text-white transition-colors">
            <Icons.X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-accent-primary to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
                {reason === 'invite' ? (
                    <Icons.Users className="w-8 h-8 text-brand-950" />
                ) : (
                    <Icons.Lock className="w-8 h-8 text-brand-950" />
                )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{titles[reason]}</h2>
            <p className="text-brand-300 text-sm mb-4">{messages[reason]}</p>
        </div>

        <div className="bg-brand-900/50 rounded-2xl p-6 border border-brand-700 mb-6 relative overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Icons.Trophy className="w-5 h-5 text-accent-primary" />
                Status Premium
            </h3>
            <p className="text-sm text-brand-400 mb-4">
                Convide <span className="text-white font-bold">5 amigos</span> para desbloquear itens, verificações e contatos <span className="text-accent-primary font-bold">ILIMITADOS</span>.
            </p>

            <div className="mb-2 flex justify-between text-xs font-bold uppercase text-brand-500">
                <span>Progresso</span>
                <span>{currentReferrals} / {target} Amigos</span>
            </div>
            <div className="h-3 bg-brand-950 rounded-full overflow-hidden border border-brand-700">
                <div className="h-full bg-gradient-to-r from-accent-primary to-blue-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
        </div>

        <div className="space-y-4">
            <p className="text-xs font-bold text-brand-400 uppercase text-center">Compartilhe seu Link</p>
            
            <button 
                onClick={handleWhatsAppShare}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-all"
            >
                <Icons.MessageCircle className="w-5 h-5" />
                Enviar no WhatsApp
            </button>

            <div 
                onClick={copyToClipboard}
                className="bg-brand-900 border border-brand-600 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-accent-primary transition-colors group"
            >
                <span className="text-sm text-white truncate px-2 font-mono">{inviteLink}</span>
                <div className="bg-brand-800 p-2 rounded-lg group-hover:bg-accent-primary group-hover:text-brand-950 transition-colors">
                    {copied ? <Icons.CheckCircle className="w-4 h-4" /> : <Icons.Upload className="w-4 h-4 rotate-90" />}
                </div>
            </div>
            {copied && <p className="text-center text-xs text-green-400 font-bold">Link copiado!</p>}
        </div>

      </div>
    </div>,
    document.body
  );
};