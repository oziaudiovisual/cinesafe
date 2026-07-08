import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatService, ChatSummary, ChatMessage } from '../services/chatService';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { equipmentService } from '../services/equipmentService';
import { ContractModal } from '../components/ContractModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Icons } from '../components/Icons';
import { AdBanner } from '../components/AdBanner';
import { useAd } from '../hooks/useAd';
import { Notification, User } from '../types';

// --- Helper: timer para expiração de notificação ---
const NotificationTimer: React.FC<{ expiresAt: string; onExpire: () => void }> = ({ expiresAt, onExpire }) => {
  useEffect(() => {
    if (!expiresAt) return;
    const delay = new Date(expiresAt).getTime() - Date.now();
    if (delay > 0) {
      const t = setTimeout(onExpire, delay);
      return () => clearTimeout(t);
    } else {
      onExpire();
    }
  }, [expiresAt, onExpire]);
  return null;
};

// --- Helper: countdown para expiração ---
const Countdown = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expirado"); return; }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hrs}h ${mins}m`);
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return <span>{timeLeft}</span>;
};

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { ad } = useAd();

  // --- Aba ativa (conversas / notificações) ---
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') === 'notifications' ? 'notifications' : 'conversations';
  const [activeTab, setActiveTab] = useState<'conversations' | 'notifications'>(initialTab);

  // --- Estado de Chat ---
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>((location.state as any)?.openChatId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // --- Estado de Notificações ---
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myConnections, setMyConnections] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; confirmLabel: string; isDestructive?: boolean }>({ title: '', message: '', confirmLabel: '', action: async () => {} });
  const [modalProcessing, setModalProcessing] = useState(false);

  const unreadNotifications = notifications.filter(n => !n.read && !(n.expiresAt && new Date(n.expiresAt) <= new Date())).length;

  // --- Subscriptions ---
  useEffect(() => {
    if (!user) return;
    const unsub = chatService.subscribeUserChats(user.id, setChats);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    const unsub = chatService.subscribeMessages(selectedId, setMessages);
    return () => unsub();
  }, [selectedId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!user) return;
    userService.getConnections(user.id).then(setMyConnections);
    const unsub = notificationService.subscribeUserNotifications(user.id, setNotifications);
    return () => unsub();
  }, [user]);

  // Se veio de link direto com tab=notifications
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get('tab') === 'notifications') setActiveTab('notifications');
  }, [location.search]);

  // --- Handlers de Chat ---
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !text.trim() || sending) return;
    setSending(true);
    const toSend = text;
    setText('');
    await chatService.sendMessage(selectedId, user!.id, toSend);
    setSending(false);
  };

  // --- Handlers de Notificação ---
  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      await notificationService.markNotificationAsRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
  };

  const handleInAppChat = async (notif: Notification) => {
    if (!user) return;
    const chatId = await chatService.openChat(user, { id: notif.fromUserId, name: notif.fromUserName, avatarUrl: notif.fromUserAvatar || '' });
    setSelectedId(chatId);
    setActiveTab('conversations');
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
      await notificationService.deleteNotification(notif.id);
      await notificationService.createNotification({
        id: crypto.randomUUID(), toUserId: notif.actionPayload.requesterId, fromUserId: user.id, fromUserName: user.name, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, fromUserConnectionsCount: user.connections?.length || 0, type: 'CONNECTION_ACCEPTED', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), read: false, message: `${user.name} aceitou seu convite e agora faz parte da sua Rede de Confiança.`,
      });
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
    const success = await equipmentService.transferEquipmentOwnership(equipmentId, user.id, transactionValue);
    if (success) {
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
  const handleExpire = useCallback((id: string) => { setNotifications(prev => prev.filter(n => n.id !== id)); }, []);

  if (!user) return null;

  const selectedChat = chats.find(c => c.id === selectedId);
  const otherOf = (c: ChatSummary) => {
    const uid = c.participants.find(p => p !== user.id) || user.id;
    return { uid, ...(c.participantInfo?.[uid] || { name: 'Contato', avatarUrl: '' }) };
  };

  // --- Flag: sidebar visível ou thread ---
  const showSidebar = activeTab === 'notifications' || !selectedId;

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 6rem)' }}>
      {ad && <div className="flex-shrink-0"><AdBanner ad={ad} /></div>}
      <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} confirmLabel={modalConfig.confirmLabel} isDestructive={modalConfig.isDestructive} />

      <div className="flex-1 min-h-0 flex gap-4">
        {/* ===== SIDEBAR: Abas + Lista ===== */}
        <div className={`${showSidebar ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-80 glass-card rounded-[2rem] border border-white/5 overflow-hidden`}>
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'conversations'
                  ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5'
                  : 'text-brand-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icons.MessageCircle className="w-4 h-4" />
              Conversas
            </button>
            <button
              onClick={() => { setActiveTab('notifications'); setSelectedId(null); }}
              className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${
                activeTab === 'notifications'
                  ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5'
                  : 'text-brand-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icons.Bell className="w-4 h-4" />
              Notificações
              {unreadNotifications > 0 && (
                <span className="absolute top-2 right-4 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                  {unreadNotifications}
                </span>
              )}
            </button>
          </div>

          {/* Conteúdo da aba */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'conversations' ? (
              /* ---- Lista de Conversas ---- */
              chats.length === 0 ? (
                <div className="p-8 text-center text-brand-500 text-sm">
                  <Icons.MessageCircle className="w-10 h-10 mx-auto mb-3 text-brand-700" />
                  Nenhuma conversa ainda. Inicie pela sua Rede ou pelas Notificações.
                </div>
              ) : (
                chats.map(c => {
                  const other = otherOf(c);
                  const unread = c.lastSenderId && c.lastSenderId !== user.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedId(c.id); setActiveTab('conversations'); }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-white/5 hover:bg-white/5 transition-colors ${selectedId === c.id ? 'bg-white/5' : ''}`}
                    >
                      <div className="w-11 h-11 rounded-full bg-brand-800 overflow-hidden border border-brand-700 shrink-0">
                        {other.avatarUrl ? <img src={other.avatarUrl} alt={other.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-400"><Icons.User className="w-5 h-5" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{other.name}</p>
                        <p className={`text-xs truncate ${unread ? 'text-accent-primary font-medium' : 'text-brand-500'}`}>{c.lastMessage || 'Conversa iniciada'}</p>
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              /* ---- Lista de Notificações ---- */
              notifications.length === 0 ? (
                <div className="p-8 text-center text-brand-500 text-sm">
                  <Icons.Bell className="w-10 h-10 mx-auto mb-3 text-brand-700" />
                  Nenhuma notificação.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map(notif => {
                    const isExpired = notif.expiresAt && new Date(notif.expiresAt) <= new Date();
                    if (isExpired) return null;
                    const isConnected = myConnections.some(c => c.id === notif.fromUserId);
                    const canConnectBack = (notif.type === 'RENTAL_INTEREST' || notif.type === 'SALE_INTEREST') && !isConnected;

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 cursor-pointer transition-colors relative ${notif.read ? 'opacity-60 hover:opacity-100' : 'bg-accent-primary/5'}`}
                      >
                        {notif.expiresAt && <NotificationTimer expiresAt={notif.expiresAt} onExpire={() => handleExpire(notif.id)} />}
                        {!notif.read && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-accent-primary rounded-full animate-pulse"></div>}
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-brand-700 overflow-hidden border border-brand-600">
                              {notif.fromUserAvatar ? <img src={notif.fromUserAvatar} alt={notif.fromUserName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-400"><Icons.User className="w-4 h-4" /></div>}
                            </div>
                            {notif.type === 'STOLEN_FOUND' && <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full p-0.5 border border-brand-900"><Icons.ShieldAlert className="w-2.5 h-2.5 text-white" /></div>}
                            {(notif.type === 'RENTAL_INTEREST' || notif.type === 'SALE_INTEREST') && <div className="absolute -bottom-0.5 -right-0.5 bg-accent-primary rounded-full p-0.5 border border-brand-900"><Icons.DollarSign className="w-2.5 h-2.5 text-brand-950" /></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-bold text-white truncate">{notif.fromUserName}</p>
                              <span className="text-[10px] text-brand-500 shrink-0 ml-2">{new Date(notif.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500 mb-0.5">
                              {notif.type === 'RENTAL_INTEREST' && 'Interesse em Aluguel'}
                              {notif.type === 'SALE_INTEREST' && 'Interesse em Compra'}
                              {notif.type === 'STOLEN_FOUND' && <span className="text-red-400">Alerta de Segurança</span>}
                              {notif.type === 'CONNECTION_REQUEST' && 'Convite de Conexão'}
                              {notif.type === 'CONNECTION_ACCEPTED' && <span className="text-green-400">Conexão Aceita</span>}
                              {notif.type === 'RENTAL_OVERDUE' && <span className="text-red-400">Aluguel Atrasado</span>}
                              {notif.type === 'ITEM_TRANSFER' && 'Transferência'}
                            </p>
                            <p className="text-brand-300 text-xs leading-snug line-clamp-2 mb-2">{notif.message}</p>

                            {notif.expiresAt && (
                              <div className="flex items-center gap-1 mb-2 text-[10px] font-bold text-orange-400">
                                <Icons.Clock className="w-3 h-3" /> Expira: <Countdown targetDate={notif.expiresAt} />
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              {(notif.type === 'RENTAL_INTEREST' || notif.type === 'SALE_INTEREST' || notif.type === 'STOLEN_FOUND') && (
                                <button onClick={(e) => { e.stopPropagation(); handleInAppChat(notif); }} className="px-3 py-1.5 bg-accent-primary hover:bg-cyan-300 text-brand-950 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors">
                                  <Icons.MessageCircle className="w-3.5 h-3.5" /> Conversar
                                </button>
                              )}
                              {canConnectBack && (
                                <button onClick={(e) => { e.stopPropagation(); handleConnectBack(notif); }} className="px-3 py-1.5 bg-brand-700 hover:bg-brand-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors border border-brand-600">
                                  <Icons.UserPlus className="w-3.5 h-3.5" /> Conectar
                                </button>
                              )}
                              {notif.type === 'CONNECTION_REQUEST' && (
                                <button onClick={(e) => { e.stopPropagation(); handleAcceptConnection(notif); }} className="px-3 py-1.5 bg-accent-primary hover:bg-cyan-400 text-brand-950 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors">
                                  <Icons.CheckCircle className="w-3.5 h-3.5" /> Aceitar
                                </button>
                              )}
                              {notif.type === 'ITEM_TRANSFER' && (
                                <button onClick={(e) => { e.stopPropagation(); handleAcceptTransfer(notif); }} className="px-3 py-1.5 bg-accent-primary hover:bg-cyan-400 text-brand-950 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors">
                                  <Icons.Download className="w-3.5 h-3.5" /> Aceitar
                                </button>
                              )}
                            </div>
                          </div>
                          {notif.itemImage && (
                            <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 shrink-0 overflow-hidden hidden sm:block">
                              <img src={notif.itemImage} alt="Item" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* ===== THREAD / Painel principal ===== */}
        <div className={`${!showSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col glass-card rounded-[2rem] border border-white/5 overflow-hidden`}>
          {activeTab === 'notifications' ? (
            /* Painel vazio quando na aba notificações (desktop) */
            <div className="flex-1 flex flex-col items-center justify-center text-brand-500">
              <Icons.Bell className="w-14 h-14 mb-4 text-brand-700" />
              <p className="text-sm">Gerencie suas notificações no painel ao lado.</p>
            </div>
          ) : !selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-brand-500">
              <Icons.MessageCircle className="w-14 h-14 mb-4 text-brand-700" />
              <p className="text-sm">Selecione uma conversa para começar.</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="md:hidden text-brand-400 hover:text-white p-1"><Icons.X className="w-5 h-5" /></button>
                <div className="w-10 h-10 rounded-full bg-brand-800 overflow-hidden border border-brand-700 shrink-0">
                  {(() => { const o = otherOf(selectedChat); return o.avatarUrl ? <img src={o.avatarUrl} alt={o.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-400"><Icons.User className="w-5 h-5" /></div>; })()}
                </div>
                <p className="font-bold text-white">{otherOf(selectedChat).name}</p>
                <button onClick={() => setContractOpen(true)} className="ml-auto text-xs font-bold bg-accent-primary/15 hover:bg-accent-primary/25 text-accent-primary px-3 py-2 rounded-lg border border-accent-primary/20 flex items-center gap-2 transition-colors">
                  <Icons.FileText className="w-4 h-4" /> <span className="hidden sm:inline">Fechar negócio</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {messages.map(m => {
                  const mine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${mine ? 'bg-accent-primary text-brand-950 rounded-br-sm' : 'bg-brand-800 text-brand-100 rounded-bl-sm border border-white/5'}`}>
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'text-brand-900/70' : 'text-brand-500'}`}>{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-white/5 flex items-center gap-3">
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  className="flex-1 glass-input rounded-xl py-3 px-4 text-sm text-white"
                />
                <button type="submit" disabled={!text.trim() || sending} className="bg-accent-primary hover:bg-cyan-300 text-brand-950 font-bold p-3 rounded-xl transition-colors disabled:opacity-40 shrink-0">
                  <Icons.ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {contractOpen && selectedChat && (
        <ContractModal
          isOpen={contractOpen}
          onClose={() => setContractOpen(false)}
          owner={user}
          counterparty={{ id: otherOf(selectedChat).uid, name: otherOf(selectedChat).name, avatarUrl: otherOf(selectedChat).avatarUrl }}
          chatId={selectedChat.id}
          onCreated={(summary) => { chatService.sendMessage(selectedChat.id, user.id, summary); }}
        />
      )}
    </div>
  );
};
