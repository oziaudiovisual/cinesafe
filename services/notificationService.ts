
import { supabase } from './supabase';
import { Notification } from '../types';

// --- Mapper ---
const mapFromDb = (row: any): Notification => ({
  id: row.id,
  toUserId: row.to_user_id,
  fromUserId: row.from_user_id,
  fromUserName: row.from_user_name,
  fromUserPhone: row.from_user_phone,
  fromUserAvatar: row.from_user_avatar,
  fromUserReputation: row.from_user_reputation,
  fromUserConnectionsCount: row.from_user_connections_count,
  itemId: row.item_id,
  itemName: row.item_name,
  itemImage: row.item_image,
  type: row.type,
  createdAt: row.created_at,
  read: row.read,
  message: row.message,
  expiresAt: row.expires_at,
  actionPayload: row.action_payload,
});

const mapToDb = (n: Notification): any => {
  const obj: any = {
    id: n.id,
    to_user_id: n.toUserId,
    from_user_id: n.fromUserId,
    from_user_name: n.fromUserName,
    type: n.type,
    created_at: n.createdAt,
    read: n.read,
  };
  if (n.fromUserPhone !== undefined) obj.from_user_phone = n.fromUserPhone;
  if (n.fromUserAvatar !== undefined) obj.from_user_avatar = n.fromUserAvatar;
  if (n.fromUserReputation !== undefined) obj.from_user_reputation = n.fromUserReputation;
  if (n.fromUserConnectionsCount !== undefined) obj.from_user_connections_count = n.fromUserConnectionsCount;
  if (n.itemId !== undefined) obj.item_id = n.itemId;
  if (n.itemName !== undefined) obj.item_name = n.itemName;
  if (n.itemImage !== undefined) obj.item_image = n.itemImage;
  if (n.message !== undefined) obj.message = n.message;
  if (n.expiresAt !== undefined) obj.expires_at = n.expiresAt;
  if (n.actionPayload !== undefined) obj.action_payload = n.actionPayload;
  return obj;
};

export const notificationService = {
  // Real-time: escuta notificações via Supabase Realtime (postgres_changes)
  subscribeUserNotifications: (userId: string, callback: (notifs: Notification[]) => void) => {
    // Carga inicial
    const loadInitial = async () => {
      const notifs = await notificationService.getUserNotifications(userId);
      callback(notifs);
    };
    loadInitial();

    // Escuta em tempo real
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `to_user_id=eq.${userId}`,
      }, () => {
        // Recarrega tudo ao receber qualquer mudança (insert/update/delete)
        loadInitial();
      })
      .subscribe();

    // Retorna unsubscribe
    return () => { supabase.removeChannel(channel); };
  },

  createNotification: async (notification: Notification) => {
    try {
        const dbNotif = mapToDb(notification);
        const { error } = await supabase.from('notifications').upsert(dbNotif);
        if (error) { console.error('createNotification insert error:', error); return false; }

        // Incrementar stats do usuário
        let statField = '';
        if (notification.type === 'RENTAL_INTEREST') statField = 'rentalInterest';
        else if (notification.type === 'SALE_INTEREST') statField = 'saleInterest';
        else if (notification.type === 'STOLEN_FOUND') statField = 'stolenAlerts';

        if (statField) {
          const { data: user } = await supabase
            .from('users')
            .select('notification_stats')
            .eq('id', notification.toUserId)
            .maybeSingle();
          if (user) {
            const stats = user.notification_stats || { rentalInterest: 0, saleInterest: 0, stolenAlerts: 0 };
            stats[statField] = (stats[statField] || 0) + 1;
            await supabase.from('users').update({ notification_stats: stats }).eq('id', notification.toUserId);
          }
        }
        return true;
    } catch (e) {
        console.error('createNotification error:', e);
        return false;
    }
  },

  getUserNotifications: async (userId: string): Promise<Notification[]> => {
      const { data: rows } = await supabase
        .from('notifications')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false });
      
      const now = new Date();
      const notifs = (rows || []).map(mapFromDb);
      
      // Expiração: apaga as expiradas e retorna só as ativas
      const active: Notification[] = [];
      for (const n of notifs) {
        if (n.expiresAt && new Date(n.expiresAt) <= now) {
          supabase.from('notifications').delete().eq('id', n.id).then(() => {});
        } else {
          active.push(n);
        }
      }
      return active;
  },

  markNotificationAsRead: async (notificationId: string) => {
      try {
          const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
          return !error;
      } catch (e) { return false; }
  },

  deleteNotification: async (notificationId: string): Promise<boolean> => {
      try {
          const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
          return !error;
      } catch (e) { 
          console.error("Error deleting notification:", e);
          return false; 
      }
  },

  scheduleNotificationExpiry: async (notificationId: string) => {
     try {
         const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
         const { error } = await supabase.from('notifications').update({ 
             read: true,
             expires_at: expiresAt 
         }).eq('id', notificationId);
         return !error;
     } catch (e) { return false; }
  },
};
