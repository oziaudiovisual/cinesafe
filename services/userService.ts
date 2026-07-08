
import { supabase } from './supabase';
import { Equipment, User, EquipmentStatus, UsageStats, DetailedStats, Notification } from '../types';
import { processImageForWebP, cropImageHelper } from '../utils/imageProcessor';

// Limites do plano gratuito. Premium = indicar PREMIUM_REFERRALS amigos ou ser admin.
export const PREMIUM_REFERRALS = 5;
export const FREE_LIMITS = {
  inventory: 5,       // itens no inventário
  serialChecks: 5,    // verificações de serial por mês
  contactReveals: 3,  // interesses/contatos enviados por mês
};

// --- Mappers: snake_case (DB) <-> camelCase (TS) ---

const mapUserFromDb = (row: any): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  avatarUrl: row.avatar_url,
  location: row.location,
  reputationPoints: row.reputation_points,
  isVerified: row.is_verified,
  contactPhone: row.contact_phone,
  role: row.role,
  isBlocked: row.is_blocked,
  checksCount: row.checks_count,
  reportsCount: row.reports_count,
  inventoryCount: row.inventory_count,
  connections: row.connections || [],
  transactionHistory: row.transaction_history || {},
  referralCode: row.referral_code,
  referredBy: row.referred_by,
  referralCount: row.referral_count,
  usageStats: row.usage_stats,
  notificationStats: row.notification_stats,
});

const mapUserToDb = (user: Partial<User>): any => {
  const map: any = {};
  if (user.id !== undefined) map.id = user.id;
  if (user.email !== undefined) map.email = user.email;
  if (user.name !== undefined) map.name = user.name;
  if (user.avatarUrl !== undefined) map.avatar_url = user.avatarUrl;
  if (user.location !== undefined) map.location = user.location;
  if (user.reputationPoints !== undefined) map.reputation_points = user.reputationPoints;
  if (user.isVerified !== undefined) map.is_verified = user.isVerified;
  if (user.contactPhone !== undefined) map.contact_phone = user.contactPhone;
  if (user.role !== undefined) map.role = user.role;
  if (user.isBlocked !== undefined) map.is_blocked = user.isBlocked;
  if (user.checksCount !== undefined) map.checks_count = user.checksCount;
  if (user.reportsCount !== undefined) map.reports_count = user.reportsCount;
  if (user.inventoryCount !== undefined) map.inventory_count = user.inventoryCount;
  if (user.connections !== undefined) map.connections = user.connections;
  if (user.transactionHistory !== undefined) map.transaction_history = user.transactionHistory;
  if (user.referralCode !== undefined) map.referral_code = user.referralCode;
  if (user.referredBy !== undefined) map.referred_by = user.referredBy;
  if (user.referralCount !== undefined) map.referral_count = user.referralCount;
  if (user.usageStats !== undefined) map.usage_stats = user.usageStats;
  if (user.notificationStats !== undefined) map.notification_stats = user.notificationStats;
  return map;
};

const mapEquipmentFromDb = (row: any): Equipment => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  brand: row.brand,
  model: row.model,
  serialNumber: row.serial_number,
  category: row.category,
  status: row.status,
  value: row.value ? Number(row.value) : undefined,
  isForRent: row.is_for_rent,
  rentalPricePerDay: row.rental_price_per_day ? Number(row.rental_price_per_day) : undefined,
  isForSale: row.is_for_sale,
  salePrice: row.sale_price ? Number(row.sale_price) : undefined,
  imageUrl: row.image_url,
  invoiceUrl: row.invoice_url,
  description: row.description,
  purchaseDate: row.purchase_date,
  theftLocation: row.theft_location,
  theftDate: row.theft_date,
  theftAddress: row.theft_address,
  pendingTransferTo: row.pending_transfer_to,
  ownerProfile: row.owner_profile,
});

// --- Logic ---

const calculateReputation = (user: User, equipment: Equipment[]): number => {
  let score = 0;
  if (user.avatarUrl && !user.avatarUrl.includes('ui-avatars')) score += 50;
  if (user.contactPhone) score += 50;
  if (user.role === 'admin') score += 500;

  const safeItems = equipment.filter(e => e.status === EquipmentStatus.SAFE);
  score += safeItems.length * 10;
  score += safeItems.length * 5; // Streak bonus

  const forRentItems = safeItems.filter(e => e.isForRent);
  score += forRentItems.length * 20;

  const forSaleItems = safeItems.filter(e => e.isForSale);
  score += forSaleItems.length * 15;

  const totalValue = safeItems.reduce((acc, item) => acc + (item.value || 0), 0);
  score += Math.floor(totalValue / 1000);

  score += (user.checksCount || 0) * 2;
  score += (user.reportsCount || 0) * 1;
  score += (user.connections?.length || 0) * 20;
  return score;
};

export const userService = {
  getUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const { data: row, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error || !row) return null;
      const user = mapUserFromDb(row);

      // Fetch equipment for reputation calculation
      const { data: eqRows } = await supabase
        .from('equipment')
        .select('*')
        .eq('owner_id', userId);
      
      const equipment = (eqRows || []).map(mapEquipmentFromDb);
      user.reputationPoints = calculateReputation(user, equipment);
      return user;
    } catch (e) {
      console.error("Profile Fetch Exception:", e);
      return null;
    }
  },

  saveUser: async (user: User) => {
    const dbUser = mapUserToDb(user);
    await supabase.from('users').upsert(dbUser);
  },

  updateUserProfile: async (userId: string, updates: Partial<User>) => {
    try {
      const dbUpdates = mapUserToDb(updates);
      const { error } = await supabase.from('users').update(dbUpdates).eq('id', userId);
      return !error;
    } catch (e) { return false; }
  },

  isPremium: (user: User): boolean => {
    return (user.referralCount || 0) >= PREMIUM_REFERRALS || user.role === 'admin';
  },

  checkLimit: async (userId: string, type: 'inventory' | 'check' | 'contact'): Promise<boolean> => {
    const user = await userService.getUserProfile(userId);
    if (!user) return false;
    if (userService.isPremium(user)) return true;
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (type === 'inventory') {
      const { count } = await supabase
        .from('equipment')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', userId);
      return (count || 0) < FREE_LIMITS.inventory;
    }
    if (type === 'check') {
      const stats = user.usageStats?.serialChecks || { count: 0, month: '' };
      if (stats.month !== currentMonth) return true;
      return stats.count < FREE_LIMITS.serialChecks;
    }
    if (type === 'contact') {
      const stats = user.usageStats?.contactReveals || { count: 0, month: '' };
      if (stats.month !== currentMonth) return true;
      return stats.count < FREE_LIMITS.contactReveals;
    }
    return false;
  },

  incrementUsage: async (userId: string, type: 'check' | 'contact') => {
    const user = await userService.getUserProfile(userId);
    if (!user) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageStats: UsageStats = {
      serialChecks: user.usageStats?.serialChecks || { count: 0, month: currentMonth },
      contactReveals: user.usageStats?.contactReveals || { count: 0, month: currentMonth }
    };
    if (type === 'check') {
      if (usageStats.serialChecks.month !== currentMonth) usageStats.serialChecks = { count: 1, month: currentMonth };
      else usageStats.serialChecks.count += 1;
    }
    if (type === 'contact') {
      if (usageStats.contactReveals.month !== currentMonth) usageStats.contactReveals = { count: 1, month: currentMonth };
      else usageStats.contactReveals.count += 1;
    }
    await supabase.from('users').update({ usage_stats: usageStats }).eq('id', userId);
  },

  processReferral: async (referralCode: string, newUser?: User) => {
    const { data: rows } = await supabase
      .from('users')
      .select('*')
      .eq('referral_code', referralCode)
      .limit(1);
    
    if (rows && rows.length > 0) {
      const referrerRow = rows[0];
      await supabase
        .from('users')
        .update({ referral_count: (referrerRow.referral_count || 0) + 1 })
        .eq('id', referrerRow.id);

      // Sorteios: conceder ticket de referral ao indicador para sorteios ativos
      if (newUser) {
        try {
          const { raffleService } = await import('./raffleService');
          const activeRaffles = await raffleService.getActiveRaffles();
          const referrer = mapUserFromDb(referrerRow);
          for (const raffle of activeRaffles) {
            await raffleService.grantReferralTicket(
              raffle.id,
              referrer,
              { id: newUser.id, name: newUser.name }
            );
          }
        } catch (e) {
          console.error('Erro ao conceder tickets de referral no sorteio:', e);
        }
      }
    }
  },

  incrementUserStat: async (userId: string, stat: 'checksCount' | 'reportsCount') => {
    if (stat === 'checksCount') await userService.incrementUsage(userId, 'check');
    const dbField = stat === 'checksCount' ? 'checks_count' : 'reports_count';
    const { data: row } = await supabase.from('users').select(dbField).eq('id', userId).maybeSingle();
    if (row) {
      await supabase.from('users').update({ [dbField]: (row[dbField] || 0) + 1 }).eq('id', userId);
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    const { data: userRows } = await supabase.from('users').select('*');
    const { data: eqRows } = await supabase.from('equipment').select('*');
    const allEq = (eqRows || []).map(mapEquipmentFromDb);
    return (userRows || []).map(row => {
      const user = mapUserFromDb(row);
      const userEq = allEq.filter(e => e.ownerId === user.id);
      user.reputationPoints = calculateReputation(user, userEq);
      user.inventoryCount = userEq.length;
      return user;
    });
  },

  toggleUserBlock: async (userId: string, currentStatus: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase.from('users').update({ is_blocked: !currentStatus }).eq('id', userId);
      return !error;
    } catch (e) { return false; }
  },

  deleteUser: async (userId: string): Promise<boolean> => {
    try {
      await supabase.from('equipment').delete().eq('owner_id', userId);
      await supabase.from('users').delete().eq('id', userId);
      return true;
    } catch (e) { return false; }
  },

  toggleUserRole: async (userId: string, newRole: 'admin' | 'user'): Promise<boolean> => {
    try {
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
      return !error;
    } catch (e) { return false; }
  },

  searchUsers: async (queryStr: string, currentUserId: string): Promise<User[]> => {
    if (!queryStr || queryStr.length < 2) return [];
    try {
      // Supabase suporta ilike nativo — muito melhor que baixar tudo!
      const { data: rows } = await supabase
        .from('users')
        .select('*')
        .or(`name.ilike.%${queryStr}%,email.ilike.%${queryStr}%`)
        .neq('id', currentUserId)
        .limit(20);
      return (rows || []).map(mapUserFromDb);
    } catch (e) { return []; }
  },

  addConnection: async (userAId: string, userBId: string) => {
    if (userAId === userBId) return false;
    try {
      // Buscar conexões atuais de ambos
      const { data: userA } = await supabase.from('users').select('connections').eq('id', userAId).single();
      const { data: userB } = await supabase.from('users').select('connections').eq('id', userBId).single();
      if (!userA || !userB) return false;

      const connectionsA = [...new Set([...(userA.connections || []), userBId])];
      const connectionsB = [...new Set([...(userB.connections || []), userAId])];

      await supabase.from('users').update({ connections: connectionsA }).eq('id', userAId);
      await supabase.from('users').update({ connections: connectionsB }).eq('id', userBId);
      return true;
    } catch (e) { return false; }
  },

  removeConnection: async (userAId: string, userBId: string) => {
    try {
      const { data: userA } = await supabase.from('users').select('connections').eq('id', userAId).single();
      const { data: userB } = await supabase.from('users').select('connections').eq('id', userBId).single();
      if (!userA || !userB) return false;

      const connectionsA = (userA.connections || []).filter((id: string) => id !== userBId);
      const connectionsB = (userB.connections || []).filter((id: string) => id !== userAId);

      await supabase.from('users').update({ connections: connectionsA }).eq('id', userAId);
      await supabase.from('users').update({ connections: connectionsB }).eq('id', userBId);
      return true;
    } catch (e) { return false; }
  },

  getConnections: async (userId: string): Promise<User[]> => {
    try {
      const user = await userService.getUserProfile(userId);
      if (!user || !user.connections || user.connections.length === 0) return [];
      const { data: rows } = await supabase
        .from('users')
        .select('*')
        .in('id', user.connections);
      return (rows || []).map(mapUserFromDb).filter(u => u.id !== userId);
    } catch (e) { return []; }
  },

  getUserDetailedStats: async (userId: string): Promise<DetailedStats> => {
    const { data: eqRows } = await supabase.from('equipment').select('*').eq('owner_id', userId);
    const equipment = (eqRows || []).map(mapEquipmentFromDb);

    const totalItems = equipment.length;
    const safeItemsCount = equipment.filter(e => e.status === EquipmentStatus.SAFE).length;
    const totalValue = equipment.reduce((s, item) => s + (Number(item.value) || 0), 0);
    const stolenItems = equipment.filter(e => e.status === EquipmentStatus.STOLEN).length;
    const itemsForRentCount = equipment.filter(e => e.isForRent && e.status === EquipmentStatus.SAFE).length;
    const itemsForSaleCount = equipment.filter(e => e.isForSale && e.status === EquipmentStatus.SAFE).length;

    const { data: histRows } = await supabase.from('theft_history').select('*').eq('owner_id', userId);
    const recoveredItems = (histRows || []).length;
    const recoveredValue = (histRows || []).reduce((s: number, r: any) => s + (Number(r.equipment_value) || 0), 0);

    const { data: notifRows } = await supabase.from('notifications').select('type').eq('to_user_id', userId);
    const notifications = notifRows || [];
    const rentalOffers = notifications.filter((n: any) => n.type === 'RENTAL_INTEREST').length;
    const saleOffers = notifications.filter((n: any) => n.type === 'SALE_INTEREST').length;

    return { totalItems, safeItemsCount, totalValue, stolenItems, recoveredItems, recoveredValue, rentalOffers, saleOffers, itemsForRentCount, itemsForSaleCount };
  },

  getGlobalDetailedStats: async (): Promise<DetailedStats> => {
    // Com PostgreSQL podemos usar count/sum nativos via queries separadas
    const [eqCount, safeCount, stolenCount, rentCount, saleCount, eqAll, histAll, statsRow] = await Promise.all([
      supabase.from('equipment').select('*', { count: 'exact', head: true }),
      supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('status', 'SAFE'),
      supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('status', 'STOLEN'),
      supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('is_for_rent', true),
      supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('is_for_sale', true),
      supabase.from('equipment').select('value'),
      supabase.from('theft_history').select('equipment_value'),
      supabase.from('global_stats').select('*').eq('id', 'global').maybeSingle(),
    ]);

    const totalValue = (eqAll.data || []).reduce((s: number, r: any) => s + (Number(r.value) || 0), 0);
    const recoveredValue = (histAll.data || []).reduce((s: number, r: any) => s + (Number(r.equipment_value) || 0), 0);
    const global = statsRow.data || {};

    return {
      totalItems: eqCount.count || 0,
      safeItemsCount: safeCount.count || 0,
      totalValue,
      stolenItems: stolenCount.count || 0,
      recoveredItems: (histAll.data || []).length,
      recoveredValue,
      rentalOffers: 0,
      saleOffers: 0,
      itemsForRentCount: rentCount.count || 0,
      itemsForSaleCount: saleCount.count || 0,
      transactionsCount: Number(global.transactions_count) || 0,
      transactedValue: Number(global.transacted_value) || 0,
    };
  },

  getCommunitySafetyData: async (): Promise<{ lat: number, lng: number, address: string, date: string, itemName: string }[]> => {
    try {
      const { data: activeRows } = await supabase
        .from('equipment')
        .select('name, theft_location, theft_address, theft_date')
        .eq('status', 'STOLEN')
        .not('theft_location', 'is', null);
      
      const active = (activeRows || []).map((e: any) => ({
        lat: e.theft_location?.lat,
        lng: e.theft_location?.lng,
        address: e.theft_address || 'Local desconhecido',
        date: e.theft_date || new Date().toISOString(),
        itemName: e.name,
      })).filter((e: any) => e.lat && e.lng);

      const { data: histRows } = await supabase.from('theft_history').select('*');
      const history = (histRows || []).map((d: any) => ({
        lat: d.theft_location?.lat,
        lng: d.theft_location?.lng,
        address: d.theft_address,
        date: d.theft_date,
        itemName: 'Item Recuperado/Histórico',
      })).filter((e: any) => e.lat && e.lng);
      
      return [...active, ...history];
    } catch (e) {
      console.error("Error fetching safety data:", e);
      return [];
    }
  },

  getStats: async (userId: string) => {
    const { data: eqRows } = await supabase.from('equipment').select('*').eq('owner_id', userId);
    const safeEq = (eqRows || []).map(mapEquipmentFromDb);
    const totalValue = safeEq.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
    return {
      total: safeEq.length,
      value: totalValue,
      stolen: safeEq.filter(e => e.status === EquipmentStatus.STOLEN).length,
      forRent: safeEq.filter(e => e.isForRent).length,
      forSale: safeEq.filter(e => e.isForSale).length,
    };
  },

  uploadUserAvatar: async (file: File, userId: string): Promise<string | null> => {
    try {
      const optimizedBlob = await processImageForWebP(file);
      const fileName = `${userId}/avatar_${Date.now()}.webp`;
      const { error } = await supabase.storage.from('avatars').upload(fileName, optimizedBlob, {
        contentType: 'image/webp', upsert: true,
      });
      if (error) { console.error('Avatar upload error:', error); return null; }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return publicUrl;
    } catch (e) {
      console.error('uploadUserAvatar error:', e);
      return null;
    }
  },

  cropImage: cropImageHelper,
};
