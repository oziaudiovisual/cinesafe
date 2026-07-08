import { supabase } from './supabase';
import { User } from '../types';

export interface ChatParticipant {
  name: string;
  avatarUrl: string;
}

export interface ChatSummary {
  id: string;
  participants: string[];
  participantInfo: { [uid: string]: ChatParticipant };
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

// ID determinístico: abrir conversa com a mesma pessoa sempre cai no mesmo doc.
const chatIdFor = (a: string, b: string) => [a, b].sort().join('__');

export const chatService = {
  chatIdFor,

  // Garante que a conversa existe e devolve o id. Idempotente.
  openChat: async (me: User, other: { id: string; name: string; avatarUrl: string }): Promise<string> => {
    const id = chatIdFor(me.id, other.id);
    const { data: existing } = await supabase.from('chats').select('id').eq('id', id).maybeSingle();
    
    if (!existing) {
      const now = new Date().toISOString();
      await supabase.from('chats').insert({
        id,
        participants: [me.id, other.id],
        participant_info: {
          [me.id]: { name: me.name || 'Usuário', avatarUrl: me.avatarUrl || '' },
          [other.id]: { name: other.name || 'Usuário', avatarUrl: other.avatarUrl || '' },
        },
        last_message: '',
        last_message_at: now,
        unread_count: {},
      });
    }
    return id;
  },

  sendMessage: async (chatId: string, senderId: string, text: string): Promise<boolean> => {
    const clean = text.trim();
    if (!clean) return false;
    try {
      const now = new Date().toISOString();
      await supabase.from('chat_messages').insert({
        chat_id: chatId,
        sender_id: senderId,
        sender_name: '',
        text: clean,
        created_at: now,
      });
      await supabase.from('chats').update({
        last_message: clean,
        last_message_at: now,
      }).eq('id', chatId);
      return true;
    } catch (e) {
      console.error('sendMessage error:', e);
      return false;
    }
  },

  subscribeMessages: (chatId: string, cb: (msgs: ChatMessage[]) => void) => {
    // Carga inicial
    const loadMessages = async () => {
      const { data: rows } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      cb((rows || []).map((d: any) => ({
        id: d.id,
        senderId: d.sender_id,
        text: d.text,
        createdAt: d.created_at,
      })));
    };
    loadMessages();

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`,
      }, () => { loadMessages(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  // Conversas do usuário. Ordena no cliente por recência.
  subscribeUserChats: (userId: string, cb: (chats: ChatSummary[]) => void) => {
    const loadChats = async () => {
      const { data: rows } = await supabase
        .from('chats')
        .select('*')
        .contains('participants', [userId])
        .order('last_message_at', { ascending: false });
      
      const list = (rows || []).map((d: any) => ({
        id: d.id,
        participants: d.participants,
        participantInfo: d.participant_info || {},
        lastMessage: d.last_message,
        lastMessageAt: d.last_message_at,
        lastSenderId: '',
      }));
      cb(list);
    };
    loadChats();

    const channel = supabase
      .channel(`chats:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats',
      }, () => { loadChats(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
};
