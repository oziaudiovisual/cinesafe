import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

const ConfirmModalComponent: React.FC<ConfirmModalProps> = ({ 
  isOpen, title, message, confirmLabel = "Confirmar", isDestructive = false, onConfirm, onCancel, isProcessing = false 
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-brand-950/80 backdrop-blur-xl animate-fade-in">
      <div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] relative transform transition-all scale-100 border border-white/10 shadow-2xl">
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg border border-white/5 ${
              isDestructive 
                ? 'bg-red-500/10 text-red-500 shadow-red-500/20' 
                : 'bg-accent-primary/10 text-accent-primary shadow-cyan-500/20'
            }`}>
            {isDestructive ? <Icons.AlertTriangle className="w-10 h-10" /> : <Icons.HelpCircle className="w-10 h-10" />}
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
        </div>
        
        <p className="text-brand-300 mb-8 text-center leading-relaxed">
          {message}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-brand-300 font-bold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-3.5 rounded-xl text-brand-950 font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] ${
                isDestructive 
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/20' 
                : 'bg-gradient-to-r from-accent-primary to-accent-blue shadow-cyan-500/20'
            }`}
          >
            {isProcessing && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ConfirmModal = memo(ConfirmModalComponent);