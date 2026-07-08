import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatService, ChatSummary, ChatMessage } from '../services/chatService';
import { ContractModal } from '../components/ContractModal';
import { Icons } from '../components/Icons';

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>((location.state as any)?.openChatId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Lista de conversas em tempo real.
  useEffect(() => {
    if (!user) return;
    const unsub = chatService.subscribeUserChats(user.id, setChats);
    return () => unsub();
  }, [user]);

  // Mensagens da conversa selecionada em tempo real.
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    const unsub = chatService.subscribeMessages(selectedId, setMessages);
    return () => unsub();
  }, [selectedId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!user) return null;

  const selectedChat = chats.find(c => c.id === selectedId);
  const otherOf = (c: ChatSummary) => {
    const uid = c.participants.find(p => p !== user.id) || user.id;
    return { uid, ...(c.participantInfo?.[uid] || { name: 'Contato', avatarUrl: '' }) };
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !text.trim() || sending) return;
    setSending(true);
    const toSend = text;
    setText('');
    await chatService.sendMessage(selectedId, user.id, toSend);
    setSending(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex gap-4">
      {/* Conversation list */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 glass-card rounded-[2rem] border border-white/5 overflow-hidden`}>
        <div className="p-5 border-b border-white/5">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Icons.MessageCircle className="w-6 h-6 text-accent-primary" /> Mensagens
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chats.length === 0 ? (
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

      {/* Thread */}
      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col glass-card rounded-[2rem] border border-white/5 overflow-hidden`}>
        {!selectedChat ? (
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
