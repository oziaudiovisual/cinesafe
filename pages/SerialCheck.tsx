import React, { useState } from 'react';
import { Icons } from '../components/Icons';
import { equipmentService } from '../services/equipmentService';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { EquipmentStatus, Equipment, Notification } from '../types';
import { useAuth } from '../context/AuthContext';
import { ReferralModal } from '../components/ReferralModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AdBanner } from '../components/AdBanner';
import { useAd } from '../hooks/useAd';

export const SerialCheck: React.FC = () => {
  const { user } = useAuth();
  const { ad } = useAd();
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<'clean' | 'stolen' | 'unknown' | null>(null);
  const [foundItem, setFoundItem] = useState<Equipment | null>(null);
  const [checking, setChecking] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; confirmLabel: string; }>({ title: '', message: '', action: async () => {}, confirmLabel: '' });
  const [modalProcessing, setModalProcessing] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial || !user) return;
    
    const canCheck = await userService.checkLimit(user.id, 'check');
    if (!canCheck) { setShowReferralModal(true); return; }

    setChecking(true); setResult(null);
    await new Promise(r => setTimeout(r, 600));

    const item = await equipmentService.checkSerial(serial);
    if (item) {
        setFoundItem(item);
        setResult(item.status === EquipmentStatus.STOLEN ? 'stolen' : 'clean');
    } else {
        setResult('unknown');
        setFoundItem(null);
    }
    await userService.incrementUsage(user.id, 'check');
    setChecking(false);
  };

  const handleNotifyOwner = async () => {
    if (!user || !foundItem) return;
    setModalConfig({
        title: "Avisar o Dono",
        message: `Você encontrou este item roubado? O proprietário ${foundItem.ownerProfile?.name || ''} receberá uma notificação urgente.`,
        confirmLabel: "Enviar Alerta",
        action: async () => {
             const notification: Notification = { id: crypto.randomUUID(), toUserId: foundItem.ownerId, fromUserId: user.id, fromUserName: user.name, fromUserPhone: user.contactPhone, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, fromUserConnectionsCount: user.connections?.length || 0, itemId: foundItem.id, itemName: foundItem.name, itemImage: foundItem.imageUrl, type: 'STOLEN_FOUND', createdAt: new Date().toISOString(), read: false, message: `URGENTE: Seu item roubado ${foundItem.name} foi localizado!` };
            await notificationService.createNotification(notification);
            setModalOpen(false);
        }
    });
    setModalOpen(true);
  };

  const handleModalConfirm = async () => { setModalProcessing(true); await modalConfig.action(); setModalProcessing(false); };

  return (
    <div className="max-w-2xl mx-auto space-y-10 py-10">
      <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} confirmLabel={modalConfig.confirmLabel} />
      <ReferralModal isOpen={showReferralModal} onClose={() => setShowReferralModal(false)} reason="check" />
      
      {ad && <AdBanner ad={ad} />}

      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-brand-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl border border-brand-700">
            <Icons.Search className="w-10 h-10 text-accent-primary" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Verificação de Serial</h1>
        <p className="text-brand-300 text-lg max-w-md mx-auto leading-relaxed">
          Antes de comprar um equipamento usado, verifique se ele consta como roubado na nossa base de dados.
        </p>
      </div>

      <form onSubmit={handleCheck} className="relative group">
        <div className="absolute inset-0 bg-accent-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <input
          type="text"
          className="w-full bg-brand-900/80 backdrop-blur-xl border-2 border-brand-600 rounded-2xl py-6 pl-8 pr-32 text-xl text-white placeholder-brand-600 focus:border-accent-primary focus:shadow-[0_0_30px_rgba(34,211,238,0.2)] outline-none transition-all font-mono tracking-widest uppercase relative z-10"
          placeholder="INSIRA O NÚMERO DE SÉRIE"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <button
          type="submit"
          disabled={checking || !serial}
          className="absolute right-3 top-3 bottom-3 bg-accent-primary hover:bg-cyan-400 text-brand-950 font-bold px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed z-20 flex items-center gap-2"
        >
          {checking ? (
              <div className="w-5 h-5 border-2 border-brand-950 border-t-transparent rounded-full animate-spin"></div>
          ) : (
              <>Verificar <Icons.ArrowRight className="w-5 h-5" /></>
          )}
        </button>
      </form>

      {result && (
        <div className={`rounded-[2.5rem] p-8 animate-fade-in border-2 ${
          result === 'clean' ? 'bg-green-500/10 border-green-500/30' : 
          result === 'stolen' ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : 
          'bg-brand-800 border-brand-700'
        }`}>
          <div className="flex flex-col items-center text-center gap-4">
            {result === 'clean' && (
              <>
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 mb-2"><Icons.CheckCircle className="w-8 h-8" /></div>
                <h3 className="text-2xl font-bold text-white">Tudo Limpo!</h3>
                <p className="text-green-200">Este número de série está registrado como seguro por: <span className="font-bold text-white">{foundItem?.ownerProfile?.name}</span>.</p>
                <div className="mt-4 p-4 bg-black/20 rounded-xl w-full max-w-sm">
                    <img src={foundItem?.imageUrl} alt="Item" className="w-full h-48 object-contain mb-4 rounded-lg" />
                    <p className="font-bold text-white text-lg">{foundItem?.name}</p>
                </div>
              </>
            )}
            {result === 'stolen' && (
              <>
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-2 animate-pulse"><Icons.ShieldAlert className="w-8 h-8" /></div>
                <h3 className="text-3xl font-bold text-red-500 uppercase tracking-widest">ALERTA DE ROUBO</h3>
                <p className="text-white text-lg">Este equipamento foi reportado como roubado.</p>
                <div className="bg-red-900/40 p-6 rounded-2xl w-full max-w-md border border-red-500/30 mt-4">
                    <p className="text-red-300 text-sm uppercase font-bold mb-2">Detalhes da Ocorrência</p>
                    <p className="text-white font-bold text-xl mb-1">{foundItem?.name}</p>
                    <p className="text-red-200 mb-4">{foundItem?.theftAddress || 'Local não informado'}</p>
                    <p className="text-xs text-red-400 font-mono">Reportado em: {new Date(foundItem?.theftDate || '').toLocaleDateString()}</p>
                </div>
                <button onClick={handleNotifyOwner} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 mt-4">
                    <Icons.Siren className="w-6 h-6 animate-pulse" /> Notificar Proprietário Imediatamente
                </button>
              </>
            )}
            {result === 'unknown' && (
              <>
                <div className="w-16 h-16 bg-brand-700 rounded-full flex items-center justify-center text-brand-400 mb-2"><Icons.HelpCircle className="w-8 h-8" /></div>
                <h3 className="text-2xl font-bold text-white">Não Encontrado</h3>
                <p className="text-brand-400">Este número de série não consta na nossa base de dados.</p>
                <p className="text-sm text-brand-500 mt-2 max-w-md">Isso não garante que o item é seguro, apenas que ele não foi cadastrado ou reportado no Cine Safe.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};