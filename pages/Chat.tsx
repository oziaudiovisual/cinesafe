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

// Timer para auto-expirar notificação
const NotificationTimer: React.FC<{ expiresAt: string; onExpire: () => void }> = ({ expiresAt, onExpire }) => {
  useEffect(() => {
    if (!expiresAt) return;
    const delay = new Date(expiresAt).getTime() - Date.now();
    if (delay > 0) { const t = setTimeout(onExpire, delay); return () => clearTimeout(t); }
    else onExpire();
  }, [expiresAt, onExpire]);
  return null;
};

const Countdown = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expirado"); return; }
      setTimeLeft(`${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`);
    };
    calc();
    const iv = setInterval(calc, 60000);
    return () => clearInterval(iv);
  }, [targetDate]);
  return <span>{timeLeft}</span>;
};

const CINESAFE_ID = '__cinesafe_system__';

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { ad } = useAd();

  // Conversa selecionada: pode ser um chatId real ou CINESAFE_ID
  const openChatId = (location.state as any)?.openChatId || null;
  const searchParams = new URLSearchParams(location.search);
  const startOnNotif = searchParams.get('tab') === 'notifications';
  const [selectedId, setSelectedId] = useState<string | null>(startOnNotif ? CINESAFE_ID : openChatId);

  // Chat state
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myConnections, setMyConnections] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; confirmLabel: string; isDestructive?: boolean }>({ title: '', message: '', confirmLabel: '', action: async () => {} });
  const [modalProcessing, setModalProcessing] = useState(false);

  const activeNotifications = notifications.filter(n => !(n.expiresAt && new Date(n.expiresAt) <= new Date()));
  const unreadNotifications = activeNotifications.filter(n => !n.read).length;

  // --- Subscriptions ---
  useEffect(() => { if (!user) return; const u = chatService.subscribeUserChats(user.id, setChats); return () => u(); }, [user]);
  useEffect(() => {
    if (!selectedId || selectedId === CINESAFE_ID) { setMessages([]); return; }
    const u = chatService.subscribeMessages(selectedId, setMessages); return () => u();
  }, [selectedId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (!user) return;
    userService.getConnections(user.id).then(setMyConnections);
    const u = notificationService.subscribeUserNotifications(user.id, setNotifications); return () => u();
  }, [user]);

  // React to openChatId from location.state
  useEffect(() => {
    const id = (location.state as any)?.openChatId;
    if (id) setSelectedId(id);
  }, [location.state]);

  // --- Chat handlers ---
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || selectedId === CINESAFE_ID || !text.trim() || sending) return;
    setSending(true); const t = text; setText('');
    await chatService.sendMessage(selectedId, user!.id, t);
    setSending(false);
  };

  // --- Notification handlers ---
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
  };

  const handleConnectBack = async (notif: Notification) => {
    if (!user) return;
    setModalConfig({
      title: "Enviar Convite", message: `Deseja enviar um convite de conexão para ${notif.fromUserName}?`, confirmLabel: "Enviar",
      action: async () => {
        const newNotif: Notification = { id: crypto.randomUUID(), toUserId: notif.fromUserId, fromUserId: user.id, fromUserName: user.name, fromUserPhone: user.contactPhone, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, fromUserConnectionsCount: user.connections?.length || 0, type: 'CONNECTION_REQUEST', createdAt: new Date().toISOString(), read: false, message: `${user.name} quer te adicionar à Rede de Confiança dele.`, actionPayload: { requesterId: user.id } };
        await notificationService.createNotification(newNotif);
        setModalConfig({ title: "Convite Enviado", message: `Solicitação enviada para ${notif.fromUserName}.`, confirmLabel: "OK", isDestructive: false, action: async () => setModalOpen(false) });
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
      await notificationService.createNotification({ id: crypto.randomUUID(), toUserId: notif.actionPayload.requesterId, fromUserId: user.id, fromUserName: user.name, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, fromUserConnectionsCount: user.connections?.length || 0, type: 'CONNECTION_ACCEPTED', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 72 * 3600000).toISOString(), read: false, message: `${user.name} aceitou seu convite e agora faz parte da sua Rede de Confiança.` });
      setMyConnections(await userService.getConnections(user.id));
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
    } else {
      setModalConfig({ title: "Erro", message: "Não foi possível transferir.", confirmLabel: "Fechar", isDestructive: true, action: async () => setModalOpen(false) });
    }
    setModalOpen(true);
    setModalProcessing(false);
  };

  const handleModalConfirm = async () => { setModalProcessing(true); await modalConfig.action(); setModalProcessing(false); };
  const handleExpire = useCallback((id: string) => { setNotifications(prev => prev.filter(n => n.id !== id)); }, []);

  if (!user) return null;

  const selectedChat = chats.find(c => c.id === selectedId);
  const isCineSafe = selectedId === CINESAFE_ID;
  const otherOf = (c: ChatSummary) => {
    const uid = c.participants.find(p => p !== user.id) || user.id;
    return { uid, ...(c.participantInfo?.[uid] || { name: 'Contato', avatarUrl: '' }) };
  };

  // Última notificação não lida como preview
  const latestNotif = activeNotifications[0];
  const notifPreview = latestNotif?.message || 'Nenhuma notificação';

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 6rem)' }}>
      {ad && <div className="flex-shrink-0"><AdBanner ad={ad} /></div>}
      <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} confirmLabel={modalConfig.confirmLabel} isDestructive={modalConfig.isDestructive} />

      <div className="flex-1 min-h-0 flex gap-4">
        {/* ===== SIDEBAR: Lista unificada ===== */}
        <div className={`${selectedId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 glass-card rounded-[2rem] border border-white/5 overflow-hidden`}>
          <div className="p-5 border-b border-white/5">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Icons.MessageCircle className="w-6 h-6 text-accent-primary" /> Mensagens
            </h1>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* === Item fixo: CineSafe (notificações) === */}
            <button
              onClick={() => setSelectedId(CINESAFE_ID)}
              className={`w-full text-left px-4 py-3.5 flex items-center gap-3 border-b border-white/5 hover:bg-white/5 transition-colors ${isCineSafe ? 'bg-accent-primary/5 border-l-2 border-l-accent-primary' : ''}`}
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-primary to-cyan-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
                <Icons.Bell className="w-5 h-5 text-brand-950" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">CineSafe</p>
                  {unreadNotifications > 0 && (
                    <span className="min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                      {unreadNotifications}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate ${unreadNotifications > 0 ? 'text-accent-primary font-medium' : 'text-brand-500'}`}>
                  {unreadNotifications > 0 ? `${unreadNotifications} ${unreadNotifications === 1 ? 'nova notificação' : 'novas notificações'}` : notifPreview}
                </p>
              </div>
            </button>

            {/* === Conversas reais === */}
            {chats.length === 0 ? (
              <div className="p-6 text-center text-brand-500 text-xs">
                Suas conversas aparecerão aqui.
              </div>
            ) : (
              chats.map(c => {
                const other = otherOf(c);
                const unread = c.lastSenderId && c.lastSenderId !== user.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
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
            )}
          </div>
        </div>

        {/* ===== PAINEL PRINCIPAL ===== */}
        <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col glass-card rounded-[2rem] border border-white/5 overflow-hidden`}>

          {/* --- Nenhuma seleção --- */}
          {!selectedId && (
            <div className="flex-1 flex flex-col items-center justify-center text-brand-500">
              <Icons.MessageCircle className="w-14 h-14 mb-4 text-brand-700" />
              <p className="text-sm">Selecione uma conversa para começar.</p>
            </div>
          )}

          {/* --- CineSafe: Notificações --- */}
          {isCineSafe && (
            <>
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="md:hidden text-brand-400 hover:text-white p-1"><Icons.X className="w-5 h-5" /></button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-cyan-600 flex items-center justify-center shrink-0">
                  <Icons.Bell className="w-5 h-5 text-brand-950" />
                </div>
                <div>
                  <p className="font-bold text-white">CineSafe</p>
                  <p className="text-[10px] text-brand-500 uppercase tracking-wider font-bold">Notificações do sistema</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {activeNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-brand-500">
                    <Icons.Bell className="w-12 h-12 mb-3 text-brand-700" />
                    <p className="text-sm font-medium">Tudo em dia!</p>
                    <p className="text-xs text-brand-600 mt-1">Nenhuma notificação no momento.</p>
                  </div>
                ) : (
                  activeNotifications.map(notif => {
                    const isConnected = myConnections.some(c => c.id === notif.fromUserId);
                    const canConnectBack = (notif.type === 'RENTAL_INTEREST' || notif.type === 'SALE_INTEREST') && !isConnected;
                    const isSystem = !notif.fromUserAvatar && !notif.fromUserName;

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`flex justify-start cursor-pointer group`}
                      >
                        {notif.expiresAt && <NotificationTimer expiresAt={notif.expiresAt} onExpire={() => handleExpire(notif.id)} />}
                        <div className={`max-w-[85%] rounded-2xl rounded-bl-sm p-4 transition-colors ${
                          notif.read
                            ? 'bg-brand-800/60 border border-white/5'
                            : 'bg-accent-primary/10 border border-accent-primary/20 shadow-lg shadow-cyan-500/5'
                        }`}>
                          {/* Header: avatar + nome + tipo */}
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="w-8 h-8 rounded-full bg-brand-700 overflow-hidden border border-brand-600 shrink-0">
                              {notif.fromUserAvatar ? <img src={notif.fromUserAvatar} alt={notif.fromUserName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-400"><Icons.User className="w-3.5 h-3.5" /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{notif.fromUserName || 'CineSafe'}</p>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-brand-500">
                                {notif.type === 'RENTAL_INTEREST' && 'Interesse em Aluguel'}
                                {notif.type === 'SALE_INTEREST' && 'Interesse em Compra'}
                                {notif.type === 'STOLEN_FOUND' && <span className="text-red-400">Alerta de Segurança</span>}
                                {notif.type === 'CONNECTION_REQUEST' && 'Convite de Conexão'}
                                {notif.type === 'CONNECTION_ACCEPTED' && <span className="text-green-400">Conexão Aceita</span>}
                                {notif.type === 'RENTAL_OVERDUE' && <span className="text-red-400">Aluguel Atrasado</span>}
                                {notif.type === 'ITEM_TRANSFER' && 'Transferência'}
                                {notif.type === 'RAFFLE_WINNER' && <span className="text-accent-gold">Sorteio</span>}
                                {notif.type === 'RAFFLE_CPF_REMINDER' && <span className="text-accent-primary">Sorteio</span>}
                              </p>
                            </div>
                            {notif.itemImage && (
                              <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 shrink-0 overflow-hidden">
                                <img src={notif.itemImage} alt="Item" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>

                          {/* Mensagem */}
                          <p className="text-brand-200 text-sm leading-relaxed mb-2">{notif.message}</p>

                          {/* Reputação */}
                          {(notif.fromUserReputation !== undefined || notif.fromUserConnectionsCount !== undefined) && (
                            <div className="flex items-center gap-3 mb-2 text-[10px] uppercase font-bold text-brand-500">
                              <span className="flex items-center gap-1 text-accent-gold"><Icons.Trophy className="w-3 h-3" /> {notif.fromUserReputation || 0} XP</span>
                              <span className="w-1 h-1 bg-brand-700 rounded-full"></span>
                              <span className="flex items-center gap-1"><Icons.Users className="w-3 h-3" /> {notif.fromUserConnectionsCount || 0}</span>
                            </div>
                          )}

                          {/* Expiração */}
                          {notif.expiresAt && (
                            <div className="flex items-center gap-1 mb-2 text-[10px] font-bold text-orange-400">
                              <Icons.Clock className="w-3 h-3" /> Expira: <Countdown targetDate={notif.expiresAt} />
                            </div>
                          )}

                          {/* Ações */}
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

                          {/* Timestamp */}
                          <p className="text-[10px] text-brand-600 mt-2">{new Date(notif.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* --- Conversa real --- */}
          {selectedId && !isCineSafe && !selectedChat && (
            <div className="flex-1 flex flex-col items-center justify-center text-brand-500">
              <Icons.MessageCircle className="w-14 h-14 mb-4 text-brand-700" />
              <p className="text-sm">Conversa não encontrada.</p>
            </div>
          )}

          {selectedChat && (
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
                <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Escreva uma mensagem..." className="flex-1 glass-input rounded-xl py-3 px-4 text-sm text-white" />
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
