
import { supabase } from './supabase';
import { Raffle, RaffleTicket } from '../types';
import { notificationService } from './notificationService';
import { processImageForWebP } from '../utils/imageProcessor';

const generateUUID = () => crypto.randomUUID();

// --- Mappers ---
const mapRaffleFromDb = (row: any): Raffle => ({
  id: row.id, title: row.title, description: row.description,
  prizeImageUrl: row.prize_image_url, status: row.status,
  createdBy: row.created_by, startDate: row.start_date, endDate: row.end_date,
  createdAt: row.created_at, updatedAt: row.updated_at,
  winnerId: row.winner_id, winnerName: row.winner_name, winnerAvatar: row.winner_avatar,
  drawnAt: row.drawn_at, totalTickets: row.total_tickets, totalParticipants: row.total_participants,
});

const mapTicketFromDb = (row: any): RaffleTicket => ({
  id: row.id, raffleId: row.raffle_id, userId: row.user_id,
  userName: row.user_name, userAvatar: row.user_avatar,
  source: row.source, referredUserId: row.referred_user_id,
  referredUserName: row.referred_user_name, createdAt: row.created_at,
});

export const raffleService = {

  // --- LEITURA ---

  getActiveRaffles: async (): Promise<Raffle[]> => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from('raffles')
        .select('*')
        .eq('status', 'active')
        .gte('end_date', today)
        .order('end_date', { ascending: true });
      return (rows || []).map(mapRaffleFromDb);
    } catch (e) {
      console.error('Erro ao buscar sorteios ativos:', e);
      return [];
    }
  },

  getAllRaffles: async (): Promise<Raffle[]> => {
    try {
      const { data: rows } = await supabase
        .from('raffles')
        .select('*')
        .order('created_at', { ascending: false });
      return (rows || []).map(mapRaffleFromDb);
    } catch (e) {
      console.error('Erro ao buscar todos os sorteios:', e);
      return [];
    }
  },

  getRaffleById: async (raffleId: string): Promise<Raffle | null> => {
    try {
      const { data: row } = await supabase.from('raffles').select('*').eq('id', raffleId).single();
      return row ? mapRaffleFromDb(row) : null;
    } catch (e) {
      console.error('Erro ao buscar sorteio:', e);
      return null;
    }
  },

  // --- CRUD (Admin) ---

  createRaffle: async (data: Omit<Raffle, 'id' | 'createdAt' | 'updatedAt' | 'totalTickets' | 'totalParticipants'>): Promise<Raffle | null> => {
    try {
      const now = new Date().toISOString();
      const id = generateUUID();
      const dbRaffle: any = {
        id, title: data.title, description: data.description || '',
        status: data.status, created_by: data.createdBy,
        start_date: data.startDate, end_date: data.endDate,
        total_tickets: 0, total_participants: 0,
        created_at: now, updated_at: now,
      };
      if (data.prizeImageUrl) dbRaffle.prize_image_url = data.prizeImageUrl;
      
      const { error } = await supabase.from('raffles').insert(dbRaffle);
      if (error) { console.error('Erro ao criar sorteio:', error); return null; }
      
      return { id, ...data, totalTickets: 0, totalParticipants: 0, createdAt: now, updatedAt: now } as Raffle;
    } catch (e) {
      console.error('Erro ao criar sorteio:', e);
      return null;
    }
  },

  updateRaffle: async (raffleId: string, updates: Partial<Raffle>): Promise<boolean> => {
    try {
      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.prizeImageUrl !== undefined) dbUpdates.prize_image_url = updates.prizeImageUrl;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
      if (updates.winnerId !== undefined) dbUpdates.winner_id = updates.winnerId;
      if (updates.winnerName !== undefined) dbUpdates.winner_name = updates.winnerName;
      if (updates.winnerAvatar !== undefined) dbUpdates.winner_avatar = updates.winnerAvatar;
      if (updates.drawnAt !== undefined) dbUpdates.drawn_at = updates.drawnAt;
      if (updates.totalTickets !== undefined) dbUpdates.total_tickets = updates.totalTickets;
      if (updates.totalParticipants !== undefined) dbUpdates.total_participants = updates.totalParticipants;

      const { error } = await supabase.from('raffles').update(dbUpdates).eq('id', raffleId);
      return !error;
    } catch (e) {
      console.error('Erro ao atualizar sorteio:', e);
      return false;
    }
  },

  deleteRaffle: async (raffleId: string): Promise<boolean> => {
    try {
      // Tickets são deletados em cascata (FK ON DELETE CASCADE)
      const { error } = await supabase.from('raffles').delete().eq('id', raffleId);
      return !error;
    } catch (e) {
      console.error('Erro ao excluir sorteio:', e);
      return false;
    }
  },

  // --- TICKETS ---

  getRaffleTickets: async (raffleId: string): Promise<RaffleTicket[]> => {
    try {
      const { data: rows } = await supabase
        .from('raffle_tickets')
        .select('*')
        .eq('raffle_id', raffleId)
        .order('created_at', { ascending: false });
      return (rows || []).map(mapTicketFromDb);
    } catch (e) {
      console.error('Erro ao buscar tickets:', e);
      return [];
    }
  },

  getUserTickets: async (raffleId: string, userId: string): Promise<RaffleTicket[]> => {
    try {
      const { data: rows } = await supabase
        .from('raffle_tickets')
        .select('*')
        .eq('raffle_id', raffleId)
        .eq('user_id', userId);
      return (rows || []).map(mapTicketFromDb);
    } catch (e) {
      console.error('Erro ao buscar tickets do usuário:', e);
      return [];
    }
  },

  // Participação no sorteio via CPF. Toda a regra antifraude (validação de CPF,
  // unicidade, ticket de participação, referral qualificado, contadores) roda na
  // função Postgres `participar_sorteio` (SECURITY DEFINER). O cliente não insere
  // tickets direto (INSERT revogado). Ver spec e supabase/migrations/.
  participate: async (
    raffleId: string,
    cpf: string
  ): Promise<{ ok: boolean; tickets?: number; code?: string; message?: string }> => {
    try {
      const { data, error } = await supabase.rpc('participar_sorteio', {
        p_raffle_id: raffleId,
        p_cpf: cpf,
      });
      if (error) {
        console.error('Erro ao participar do sorteio:', error);
        return { ok: false, message: 'Não foi possível concluir. Tente novamente.' };
      }
      return (data || { ok: false, message: 'Não foi possível concluir. Tente novamente.' }) as {
        ok: boolean; tickets?: number; code?: string; message?: string;
      };
    } catch (e) {
      console.error('Erro ao participar do sorteio:', e);
      return { ok: false, message: 'Não foi possível concluir. Tente novamente.' };
    }
  },

  // Lembrete in-app idempotente: cria (uma vez) a notificação para convidados que
  // não completaram o CPF em 24h, se houver sorteio ativo. Silencioso.
  ensureParticipationReminder: async (): Promise<void> => {
    try {
      await supabase.rpc('ensure_participation_reminder');
    } catch (e) {
      /* silencioso — lembrete é best-effort */
    }
  },

  // --- SORTEIO ---

  drawWinner: async (raffleId: string): Promise<{ winnerId: string; winnerName: string } | null> => {
    try {
      const tickets = await raffleService.getRaffleTickets(raffleId);
      if (tickets.length === 0) return null;

      const winnerIndex = Math.floor(Math.random() * tickets.length);
      const winningTicket = tickets[winnerIndex];

      const now = new Date().toISOString();
      await supabase.from('raffles').update({
        winner_id: winningTicket.userId, winner_name: winningTicket.userName,
        winner_avatar: winningTicket.userAvatar, drawn_at: now,
        status: 'completed', updated_at: now,
      }).eq('id', raffleId);

      const raffle = await raffleService.getRaffleById(raffleId);

      if (raffle) {
        await notificationService.createNotification({
          id: generateUUID(),
          toUserId: winningTicket.userId, fromUserId: raffle.createdBy,
          fromUserName: 'Cine Safe', type: 'RAFFLE_WINNER',
          createdAt: now, read: false,
          message: `🎉 Parabéns! Você ganhou o sorteio "${raffle.title}"! Entre em contato com a equipe para retirar seu prêmio.`,
          itemName: raffle.title, itemImage: raffle.prizeImageUrl,
        });
      }

      return { winnerId: winningTicket.userId, winnerName: winningTicket.userName };
    } catch (e) {
      console.error('Erro ao realizar sorteio:', e);
      return null;
    }
  },

  // --- LEADERBOARD ---

  getRaffleLeaderboard: async (raffleId: string): Promise<
    { userId: string; userName: string; userAvatar: string; ticketCount: number }[]
  > => {
    try {
      const tickets = await raffleService.getRaffleTickets(raffleId);
      const map = new Map<string, { userName: string; userAvatar: string; count: number }>();
      for (const t of tickets) {
        const existing = map.get(t.userId);
        if (existing) { existing.count += 1; }
        else { map.set(t.userId, { userName: t.userName, userAvatar: t.userAvatar, count: 1 }); }
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
      const fileName = `${Date.now()}_${generateUUID().slice(0, 8)}.webp`;
      const { error } = await supabase.storage.from('raffles').upload(fileName, optimizedBlob, {
        contentType: 'image/webp',
      });
      if (error) { console.error('Raffle image upload error:', error); return null; }
      const { data: { publicUrl } } = supabase.storage.from('raffles').getPublicUrl(fileName);
      return publicUrl;
    } catch (e) {
      console.error('Erro ao fazer upload da imagem do prêmio:', e);
      return null;
    }
  },
};
