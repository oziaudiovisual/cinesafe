import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';
import { Notification, User } from '../types';
import { AdBanner } from '../components/AdBanner';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { equipmentService } from '../services/equipmentService';
import { useAd } from '../hooks/useAd';

const NotificationTimer: React.FC<{ expiresAt: string; onExpire: () => void }> = ({ expiresAt, onExpire }) => {
  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const delay = expiryTime - now;

    if (delay > 0) {
      const timerId = setTimeout(() => {
        onExpire();
      }, delay);
      return () => clearTimeout(timerId);
    } else {
      onExpire();
    }
  }, [expiresAt, onExpire]);

  return null;
};

export const Notifications: React.FC = () => {
  const { user } = useAuth();
  const { ad } = useAd();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myConnections, setMyConnections] = useState<User[]>([]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; confirmLabel: string; isDestructive?: boolean; }>({ title: '', message: '', action: async () => {}, confirmLabel: '' });
  const [modalProcessing, setModalProcessing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        const [n, connections] = await Promise.all([
          notificationService.getUserNotifications(user.id),
          userService.getConnections(user.id),
        ]);
        setNotifications(n);
        setMyConnections(connections);
      }
    };
    loadData();
  }, [user]);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
        await notificationService.markNotificationAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
  };

  const openWhatsAppDirectly = (notif: Notification) => {
    if (!notif.fromUserPhone) return;
    const cleanPhone = notif.fromUserPhone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá! Vi sua notificação no Cine Safe sobre o item ${notif.itemName || 'o equipamento'}.`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  const handleStartChat = (notif: Notification) => {
    setModalConfig({
        title: "Iniciar Conversa",
        message: "Por segurança, esta notificação desaparecerá em 24 horas. Deseja continuar para o WhatsApp?",
        confirmLabel: "Ir para WhatsApp",
        action: async () => {
            await notificationService.scheduleNotificationExpiry(notif.id);
            openWhatsAppDirectly(notif);
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true, expiresAt } : n));
            setModalOpen(false);
        }
    });
    setModalOpen(true);
  };
  
  const handleConnectBack = async (notif: Notification) => {
    if (!user) return;
    setModalConfig({
        title: "Enviar Convite",
        message: `Deseja enviar um convite de conexão para ${notif.fromUserName}?`,
        confirmLabel: "Enviar",
        action: async () => {
            const newNotif: Notification = { id: crypto.randomUUID(), toUserId: notif.fromUserId, fromUserId: user.id, fromUserName: user.name, fromUserPhone: user.contactPhone, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, fromUserConnectionsCount: user.connections?.length || 0, type: 'CONNECTION_REQUEST', createdAt: new Date().toISOString(), read: false, message: `${user.name} quer te adicionar à Rede de Confiança dele.`, actionPayload: { requesterId: user.id } };
            await notificationService.createNotification(newNotif);
            setModalConfig({ title: "Convite Enviado", message: `Sua solicitação foi enviada para ${notif.fromUserName}.`, confirmLabel: "OK", isDestructive: false, action: async () => setModalOpen(false) });
        }
    });
    setModalOpen(true);
  };

  const handleAcceptConnection = async (notif: Notification) => {
    if (!user || !notif.actionPayload?.requesterId) return;
    setModalProcessing(true);
    const success = await userService.addConnection(user.id, notif.actionPayload.requesterId);
    if (success) {
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        await notificationService.deleteNotification(notif.id);
        const updatedConnections = await userService.getConnections(user.id);
        setMyConnections(updatedConnections);
        setModalConfig({ title: "Conectado!", message: `Você agora faz parte da rede de ${notif.fromUserName}.`, confirmLabel: "OK", isDestructive: false, action: async () => setModalOpen(false) });
        setModalOpen(true);
    }
    setModalProcessing(false);
  };

  const handleAcceptTransfer = async (notif: Notification) => {
    if (!user || !notif.actionPayload?.equipmentId) return;
    setModalProcessing(true);
    const { equipmentId, transactionValue } = notif.actionPayload;
    
    // Call equipmentService directly for transfer
    const success = await equipmentService.transferEquipmentOwnership(equipmentId, user.id, transactionValue);
    
    if (success) {
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        await notificationService.deleteNotification(notif.id);
        setModalConfig({ title: "Transferência Concluída", message: "Equipamento recebido! Ele já consta no seu inventário.", confirmLabel: "OK", isDestructive: false, action: async () => setModalOpen(false) });
        setModalOpen(true);
    } else {
        setModalConfig({ title: "Erro", message: "Não foi possível transferir o equipamento.", confirmLabel: "Fechar", isDestructive: true, action: async () => setModalOpen(false) });
        setModalOpen(true);
    }
    setModalProcessing(false);
  };

  const handleModalConfirm = async () => { setModalProcessing(true); await modalConfig.action(); setModalProcessing(false); };
  const handleExpire = (id: string) => { setNotifications(prev => prev.filter(n => n.id !== id)); };

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12">
        <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} confirmLabel={modalConfig.confirmLabel} isDestructive={modalConfig.isDestructive} />
        {ad && <div className="mb-6"><AdBanner ad={ad} /></div>}
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Icons.MessageCircle className="w-8 h-8 text-accent-primary" />
            Notificações
        </h1>
        {notifications.length === 0 ? (
            <div className="glass-card p-12 rounded-[2.5rem] text-center border border-white/5">
                <div className="w-16 h-16 bg-brand-800 rounded-full flex items-center justify-center mx-auto mb-4"><Icons.MessageCircle className="w-8 h-8 text-brand-600" /></div>
                <p className="text-brand-400 font-medium">Você não tem novas notificações.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {notifications.map(notif => {
                    const isExpired = notif.expiresAt && new Date(notif.expiresAt) <= new Date();
                    if (isExpired) return null;
                    const isConnected = myConnections.some(c => c.id === notif.fromUserId);
                    const canConnectBack = (notif.type === 'RENTAL_INTEREST' || notif.type === 'SALE_INTEREST') && !isConnected;

                    return (
                        <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`glass-card p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group ${notif.read ? 'border-white/5 bg-brand-900/40 opacity-70 hover:opacity-100' : 'border-accent-primary/30 bg-brand-800/60 shadow-lg shadow-cyan-900/10'}`}>
                            {notif.expiresAt && <NotificationTimer expiresAt={notif.expiresAt} onExpire={() => handleExpire(notif.id)} />}
                            {!notif.read && <div className="absolute top-4 right-4 w-3 h-3 bg-accent-primary rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]"></div>}
                            <div className="flex flex-col sm:flex-row items-start gap-5 relative z-10">
                                <div className="relative shrink-0">
                                    <div className="w-14 h-14 rounded-full bg-brand-700 overflow-hidden border-2 border-brand-600">
                                        {notif.fromUserAvatar ? <img src={notif.fromUserAvatar} alt={notif.fromUserName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-400"><Icons.User className="w-6 h-6" /></div>}
                                    </div>
                                    {notif.type === 'STOLEN_FOUND' && <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 border border-brand-900"><Icons.ShieldAlert className="w-3 h-3 text-white" /></div>}
                                    {(notif.type === 'RENTAL_INTEREST' || notif.type === 'SALE_INTEREST') && <div className="absolute -bottom-1 -right-1 bg-accent-primary rounded-full p-1 border border-brand-900"><Icons.DollarSign className="w-3 h-3 text-brand-950" /></div>}
                                </div>
                                <div className="flex-1 w-full">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="text-lg font-bold text-white">{notif.fromUserName}</h3>
                                        <span className="text-xs text-brand-500 font-mono">{new Date(notif.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-3 text-[10px] uppercase font-bold text-brand-400">
                                        <span className="flex items-center gap-1 text-accent-gold"><Icons.Trophy className="w-3 h-3" /> {notif.fromUserReputation || 0} XP</span>
                                        <span className="w-1 h-1 bg-brand-700 rounded-full"></span>
                                        <span className="flex items-center gap-1"><Icons.Users className="w-3 h-3" /> {notif.fromUserConnectionsCount || 0} Amigos</span>
                                    </div>
                                    <div className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">
                                        {notif.type === 'RENTAL_INTEREST' && 'Interesse em Aluguel'}
                                        {notif.type === 'SALE_INTEREST' && 'Interesse em Compra'}
                                        {notif.type === 'STOLEN_FOUND' && <span className="text-red-400">Alerta de Segurança</span>}
                                        {notif.type === 'CONNECTION_REQUEST' && 'Convite de Conexão'}
                                        {notif.type === 'ITEM_TRANSFER' && 'Transferência de Equipamento'}
                                    </div>
                                    <p className="text-brand-300 text-sm leading-relaxed mb-4">{notif.message}</p>
                                    
                                    {notif.expiresAt && (
                                        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-2 rounded-lg border border-orange-500/20 w-fit">
                                            <Icons.Clock className="w-3 h-3" />
                                            Expira em: <Countdown targetDate={notif.expiresAt} />
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-3">
                                        {(notif.type === 'RENTAL_INTEREST' || notif.type === 'SALE_INTEREST' || notif.type === 'STOLEN_FOUND') && (
                                            <button onClick={(e) => { e.stopPropagation(); handleStartChat(notif); }} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-green-500/20">
                                                <Icons.MessageCircle className="w-4 h-4" /> Conversar no WhatsApp
                                            </button>
                                        )}
                                        {canConnectBack && (
                                            <button onClick={(e) => { e.stopPropagation(); handleConnectBack(notif); }} className="px-4 py-2 bg-brand-700 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-brand-600">
                                                <Icons.UserPlus className="w-4 h-4" /> Adicionar à Rede
                                            </button>
                                        )}
                                        {notif.type === 'CONNECTION_REQUEST' && (
                                            <button onClick={(e) => { e.stopPropagation(); handleAcceptConnection(notif); }} className="px-4 py-2 bg-accent-primary hover:bg-cyan-400 text-brand-950 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20">
                                                <Icons.CheckCircle className="w-4 h-4" /> Aceitar Conexão
                                            </button>
                                        )}
                                        {notif.type === 'ITEM_TRANSFER' && (
                                            <button onClick={(e) => { e.stopPropagation(); handleAcceptTransfer(notif); }} className="px-4 py-2 bg-accent-primary hover:bg-cyan-400 text-brand-950 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20">
                                                <Icons.Download className="w-4 h-4" /> Aceitar Transferência
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {notif.itemImage && (
                                    <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 shrink-0 overflow-hidden hidden sm:block">
                                        <img src={notif.itemImage} alt="Item" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
    </div>
  );
};

const Countdown = ({ targetDate }: { targetDate: string }) => {
    const [timeLeft, setTimeLeft] = useState('');
    useEffect(() => {
        const interval = setInterval(() => {
            const diff = new Date(targetDate).getTime() - Date.now();
            if (diff <= 0) { setTimeLeft("Expirado"); clearInterval(interval); return; }
            const hrs = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setTimeLeft(`${hrs}h ${mins}m`);
        }, 60000);
        const diff = new Date(targetDate).getTime() - Date.now();
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${hrs}h ${mins}m`);
        return () => clearInterval(interval);
    }, [targetDate]);
    return <span>{timeLeft}</span>;
};