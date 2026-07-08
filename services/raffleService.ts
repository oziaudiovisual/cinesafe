
import { db, storage } from './firebase';
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, getDocs, increment, writeBatch
} from 'firebase/firestore';
import { Raffle, RaffleTicket, User } from '../types';
import { notificationService } from './notificationService';
import { processImageForWebP, resilientUpload } from '../utils/imageProcessor';

const generateUUID = () => crypto.randomUUID();

export const raffleService = {

  // --- LEITURA ---

  /**
   * Retorna sorteios ativos cujo período ainda não acabou.
   * Sorteio ativo = status 'active' E endDate >= hoje.
   */
  getActiveRaffles: async (): Promise<Raffle[]> => {
    try {
      const q = query(collection(db, 'raffles'), where('status', '==', 'active'));
      const snap = await getDocs(q);
      const today = new Date().toISOString().slice(0, 10);
      return snap.docs
        .map(d => d.data() as Raffle)
        .filter(r => r.endDate >= today)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));
    } catch (e) {
      console.error('Erro ao buscar sorteios ativos:', e);
      return [];
    }
  },

  /** Admin: todos os sorteios, ordenados por criação desc. */
  getAllRaffles: async (): Promise<Raffle[]> => {
    try {
      const snap = await getDocs(collection(db, 'raffles'));
      return snap.docs
        .map(d => d.data() as Raffle)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (e) {
      console.error('Erro ao buscar todos os sorteios:', e);
      return [];
    }
  },

  getRaffleById: async (raffleId: string): Promise<Raffle | null> => {
    try {
      const snap = await getDoc(doc(db, 'raffles', raffleId));
      return snap.exists() ? (snap.data() as Raffle) : null;
    } catch (e) {
      console.error('Erro ao buscar sorteio:', e);
      return null;
    }
  },

  // --- CRUD (Admin) ---

  createRaffle: async (data: Omit<Raffle, 'id' | 'createdAt' | 'updatedAt' | 'totalTickets' | 'totalParticipants'>): Promise<Raffle | null> => {
    try {
      const now = new Date().toISOString();
      const raffle: Raffle = {
        id: generateUUID(),
        ...data,
        totalTickets: 0,
        totalParticipants: 0,
        createdAt: now,
        updatedAt: now,
      };
      // Remover campos undefined (Firestore rejeita)
      const clean = Object.fromEntries(
        Object.entries(raffle).filter(([, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'raffles', raffle.id), clean);
      return raffle;
    } catch (e) {
      console.error('Erro ao criar sorteio:', e);
      return null;
    }
  },

  updateRaffle: async (raffleId: string, updates: Partial<Raffle>): Promise<boolean> => {
    try {
      const clean = Object.fromEntries(
        Object.entries({ ...updates, updatedAt: new Date().toISOString() })
          .filter(([, v]) => v !== undefined)
      );
      await updateDoc(doc(db, 'raffles', raffleId), clean);
      return true;
    } catch (e) {
      console.error('Erro ao atualizar sorteio:', e);
      return false;
    }
  },

  deleteRaffle: async (raffleId: string): Promise<boolean> => {
    try {
      // Excluir tickets do sorteio primeiro
      const ticketsSnap = await getDocs(
        query(collection(db, 'raffle_tickets'), where('raffleId', '==', raffleId))
      );
      const batch = writeBatch(db);
      ticketsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'raffles', raffleId));
      await batch.commit();
      return true;
    } catch (e) {
      console.error('Erro ao excluir sorteio:', e);
      return false;
    }
  },

  // --- TICKETS ---

  /** Todos os tickets de um sorteio. */
  getRaffleTickets: async (raffleId: string): Promise<RaffleTicket[]> => {
    try {
      const q = query(collection(db, 'raffle_tickets'), where('raffleId', '==', raffleId));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => d.data() as RaffleTicket)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (e) {
      console.error('Erro ao buscar tickets:', e);
      return [];
    }
  },

  /** Tickets de um usuário em um sorteio específico. */
  getUserTickets: async (raffleId: string, userId: string): Promise<RaffleTicket[]> => {
    try {
      const q = query(
        collection(db, 'raffle_tickets'),
        where('raffleId', '==', raffleId),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as RaffleTicket);
    } catch (e) {
      console.error('Erro ao buscar tickets do usuário:', e);
      return [];
    }
  },

  /**
   * Concede 1 ticket de cadastro (signup) ao usuário em um sorteio.
   * Chamado automaticamente pelo fluxo de registro quando há sorteios ativos.
   */
  grantSignupTicket: async (raffleId: string, user: User): Promise<boolean> => {
    try {
      const ticket: RaffleTicket = {
        id: generateUUID(),
        raffleId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatarUrl,
        source: 'signup',
        createdAt: new Date().toISOString(),
      };
      const batch = writeBatch(db);
      batch.set(doc(db, 'raffle_tickets', ticket.id), ticket);
      batch.update(doc(db, 'raffles', raffleId), {
        totalTickets: increment(1),
        totalParticipants: increment(1),
      });
      await batch.commit();
      return true;
    } catch (e) {
      console.error('Erro ao conceder ticket de cadastro:', e);
      return false;
    }
  },

  /**
   * Concede 1 ticket de referral ao indicador em um sorteio.
   * Chamado quando alguém se cadastra via link de convite de outro usuário.
   */
  grantReferralTicket: async (
    raffleId: string,
    referrer: User,
    referredUser: { id: string; name: string }
  ): Promise<boolean> => {
    try {
      // Verificar se o referrer já participa deste sorteio (para não incrementar totalParticipants novamente)
      const existingTickets = await raffleService.getUserTickets(raffleId, referrer.id);
      const isNewParticipant = existingTickets.length === 0;

      const ticket: RaffleTicket = {
        id: generateUUID(),
        raffleId,
        userId: referrer.id,
        userName: referrer.name,
        userAvatar: referrer.avatarUrl,
        source: 'referral',
        referredUserId: referredUser.id,
        referredUserName: referredUser.name,
        createdAt: new Date().toISOString(),
      };

      const updates: Record<string, any> = { totalTickets: increment(1) };
      if (isNewParticipant) updates.totalParticipants = increment(1);

      const batch = writeBatch(db);
      batch.set(doc(db, 'raffle_tickets', ticket.id), ticket);
      batch.update(doc(db, 'raffles', raffleId), updates);
      await batch.commit();
      return true;
    } catch (e) {
      console.error('Erro ao conceder ticket de referral:', e);
      return false;
    }
  },

  // --- SORTEIO ---

  /**
   * Realiza o sorteio: seleciona um vencedor aleatório ponderado pelo nº de tickets.
   * Cada ticket = 1 entrada. Mais tickets = mais chances.
   * Atualiza o raffle com o vencedor e cria notificação.
   */
  drawWinner: async (raffleId: string): Promise<{ winnerId: string; winnerName: string } | null> => {
    try {
      const tickets = await raffleService.getRaffleTickets(raffleId);
      if (tickets.length === 0) return null;

      // Sortear: cada ticket tem peso igual (1 entrada por ticket)
      const winnerIndex = Math.floor(Math.random() * tickets.length);
      const winningTicket = tickets[winnerIndex];

      // Atualizar sorteio com o resultado
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'raffles', raffleId), {
        winnerId: winningTicket.userId,
        winnerName: winningTicket.userName,
        winnerAvatar: winningTicket.userAvatar,
        drawnAt: now,
        status: 'completed',
        updatedAt: now,
      });

      // Buscar dados do sorteio para a notificação
      const raffle = await raffleService.getRaffleById(raffleId);

      // Notificar o vencedor
      if (raffle) {
        await notificationService.createNotification({
          id: generateUUID(),
          toUserId: winningTicket.userId,
          fromUserId: raffle.createdBy,
          fromUserName: 'Cine Safe',
          type: 'RAFFLE_WINNER',
          createdAt: now,
          read: false,
          message: `🎉 Parabéns! Você ganhou o sorteio "${raffle.title}"! Entre em contato com a equipe para retirar seu prêmio.`,
          itemName: raffle.title,
          itemImage: raffle.prizeImageUrl,
        });
      }

      return { winnerId: winningTicket.userId, winnerName: winningTicket.userName };
    } catch (e) {
      console.error('Erro ao realizar sorteio:', e);
      return null;
    }
  },

  // --- LEADERBOARD ---

  /**
   * Top participantes de um sorteio por número de tickets.
   * Retorna { userId, userName, userAvatar, ticketCount }[] ordenado desc.
   */
  getRaffleLeaderboard: async (raffleId: string): Promise<
    { userId: string; userName: string; userAvatar: string; ticketCount: number }[]
  > => {
    try {
      const tickets = await raffleService.getRaffleTickets(raffleId);
      const map = new Map<string, { userName: string; userAvatar: string; count: number }>();
      for (const t of tickets) {
        const existing = map.get(t.userId);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(t.userId, { userName: t.userName, userAvatar: t.userAvatar, count: 1 });
        }
      }
      return Array.from(map.entries())
        .map(([userId, data]) => ({ userId, userName: data.userName, userAvatar: data.userAvatar, ticketCount: data.count }))
        .sort((a, b) => b.ticketCount - a.ticketCount);
    } catch (e) {
      console.error('Erro ao montar leaderboard:', e);
      return [];
    }
  },

  // --- IMAGEM ---

  uploadPrizeImage: async (file: File): Promise<string | null> => {
    try {
      const optimizedBlob = await processImageForWebP(file);
      const fileName = `raffles/${Date.now()}_${generateUUID().slice(0, 8)}.webp`;
      const storageRef = storage.ref(fileName);
      return resilientUpload(storageRef, optimizedBlob);
    } catch (e) {
      console.error('Erro ao fazer upload da imagem do prêmio:', e);
      return null;
    }
  },
};
