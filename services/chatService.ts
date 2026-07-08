import { db } from './firebase';
import {
  collection, doc, setDoc, addDoc, updateDoc, getDoc,
  query, where, orderBy, onSnapshot
} from 'firebase/firestore';
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
    const ref = doc(db, 'chats', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const now = new Date().toISOString();
      await setDoc(ref, {
        id,
        participants: [me.id, other.id],
        participantInfo: {
          [me.id]: { name: me.name || 'Usuário', avatarUrl: me.avatarUrl || '' },
          [other.id]: { name: other.name || 'Usuário', avatarUrl: other.avatarUrl || '' },
        },
        lastMessage: '',
        lastMessageAt: now,
        lastSenderId: '',
        createdAt: now,
      });
    }
    return id;
  },

  sendMessage: async (chatId: string, senderId: string, text: string): Promise<boolean> => {
    const clean = text.trim();
    if (!clean) return false;
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId, text: clean, createdAt: now });
      await updateDoc(doc(db, 'chats', chatId), { lastMessage: clean, lastMessageAt: now, lastSenderId: senderId });
      return true;
    } catch (e) {
      console.error('sendMessage error:', e);
      return false;
    }
  },

  subscribeMessages: (chatId: string, cb: (msgs: ChatMessage[]) => void) => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) })));
    }, () => cb([]));
  },

  // Conversas do usuário. Ordena no cliente por recência (evita índice composto).
  subscribeUserChats: (userId: string, cb: (chats: ChatSummary[]) => void) => {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', userId));
    return onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => d.data() as ChatSummary)
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      cb(list);
    }, () => cb([]));
  },
};
