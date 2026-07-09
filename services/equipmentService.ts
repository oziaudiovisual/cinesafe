
import { supabase } from './supabase';
import { Equipment, EquipmentStatus, MarketplaceFilters } from '../types';
import { userService } from './userService';
import { processImageForWebP } from '../utils/imageProcessor';

// --- Mapper ---
const mapFromDb = (row: any): Equipment => ({
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

const mapToDb = (item: Equipment): any => ({
  id: item.id,
  owner_id: item.ownerId,
  name: item.name,
  brand: item.brand,
  model: item.model,
  serial_number: String(item.serialNumber || '').trim().toUpperCase(),
  category: item.category,
  status: item.status,
  value: item.value,
  is_for_rent: item.isForRent,
  rental_price_per_day: item.rentalPricePerDay,
  is_for_sale: item.isForSale,
  sale_price: item.salePrice,
  image_url: item.imageUrl,
  invoice_url: item.invoiceUrl,
  description: item.description,
  purchase_date: item.purchaseDate,
  theft_location: item.theftLocation,
  theft_date: item.theftDate,
  theft_address: item.theftAddress,
  pending_transfer_to: item.pendingTransferTo,
  owner_profile: item.ownerProfile,
});

// Cursor de paginação: string ID em vez de QueryDocumentSnapshot
export const equipmentService = {
  getUserEquipment: async (userId: string): Promise<Equipment[]> => {
    const { data } = await supabase.from('equipment').select('*').eq('owner_id', userId);
    return (data || []).map(mapFromDb);
  },

  addEquipment: async (item: Equipment) => {
    const ownerProfile = await userService.getUserProfile(item.ownerId);
    const itemWithProfile: Equipment = {
      ...item,
      serialNumber: String(item.serialNumber || '').trim().toUpperCase(),
      ownerProfile: ownerProfile ? {
        name: ownerProfile.name,
        avatarUrl: ownerProfile.avatarUrl,
        location: ownerProfile.location
      } : undefined
    };
    const dbItem = mapToDb(itemWithProfile);
    // Remove undefined values
    const clean = Object.fromEntries(Object.entries(dbItem).filter(([, v]) => v !== undefined));
    await supabase.from('equipment').upsert(clean);
  },

  updateEquipment: async (updatedItem: Equipment) => {
    let dataToSave = { ...updatedItem };
    dataToSave.serialNumber = String(updatedItem.serialNumber || '').trim().toUpperCase();

    if (!dataToSave.ownerProfile) {
      const ownerProfile = await userService.getUserProfile(updatedItem.ownerId);
      if (ownerProfile) {
        dataToSave.ownerProfile = {
          name: ownerProfile.name,
          avatarUrl: ownerProfile.avatarUrl,
          location: ownerProfile.location
        };
      }
    }
    const dbItem = mapToDb(dataToSave);
    const clean = Object.fromEntries(Object.entries(dbItem).filter(([, v]) => v !== undefined));
    await supabase.from('equipment').update(clean).eq('id', updatedItem.id);
  },

  recoverEquipment: async (item: Equipment, recoveredViaApp: boolean = false): Promise<boolean> => {
    try {
      await supabase.from('theft_history').insert({
        equipment_id: item.id, owner_id: item.ownerId, theft_date: item.theftDate,
        theft_location: item.theftLocation,
        theft_address: item.theftAddress, equipment_value: item.value || 0,
        recovery_date: new Date().toISOString(), recovered_via_app: recoveredViaApp,
        equipment_name: item.name,
      });
      await supabase.from('equipment').update({
        status: EquipmentStatus.SAFE, theft_date: null, theft_location: null, theft_address: null
      }).eq('id', item.id);
      return true;
    } catch (e) { return false; }
  },

  deleteEquipment: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('equipment').delete().eq('id', id);
      return !error;
    } catch (e) { return false; }
  },

  checkSerial: async (serial: string): Promise<Equipment | undefined> => {
    try {
      if (!serial) return undefined;
      const upper = String(serial).trim().toUpperCase();
      
      // PostgreSQL: busca case-insensitive nativa
      const { data } = await supabase
        .from('equipment')
        .select('*')
        .ilike('serial_number', upper)
        .limit(1);
      
      if (data && data.length > 0) {
        const item = mapFromDb(data[0]);
        if (!item.ownerProfile) {
          const owner = await userService.getUserProfile(item.ownerId);
          if (owner) {
            item.ownerProfile = { name: owner.name, avatarUrl: owner.avatarUrl, location: owner.location };
          }
        }
        return item;
      }
      return undefined;
    } catch (e) { return undefined; }
  },

  _getMarketplaceItems: async (
    filterField: string,
    lastDoc: string | null,  // Agora é string (ID do último item) em vez de QueryDocumentSnapshot
    limitCount: number,
    filters: MarketplaceFilters
  ): Promise<{ data: Equipment[], lastDoc: string | null, hasMore: boolean }> => {
    let query = supabase
      .from('equipment')
      .select('*')
      .eq(filterField === 'isForRent' ? 'is_for_rent' : 'is_for_sale', true)
      .eq('status', 'SAFE')
      .order('id');

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    // Oculta os próprios itens do usuário na vitrine (aluguel/venda).
    if (filters.excludeOwnerId) {
      query = query.neq('owner_id', filters.excludeOwnerId);
    }

    if (lastDoc) {
      query = query.gt('id', lastDoc);
    }

    query = query.limit(limitCount + 1);

    const { data: rows } = await query;
    const allItems = (rows || []).map(mapFromDb);
    const hasMore = allItems.length > limitCount;
    const items = hasMore ? allItems.slice(0, limitCount) : allItems;
    const newLastDoc = items.length > 0 ? items[items.length - 1].id : null;

    // Filtro de localização no cliente (como antes)
    let filtered = items;
    if (filters.uf || filters.city) {
      const searchLoc = (filters.city || filters.uf || '').toLowerCase();
      filtered = items.filter(item => item.ownerProfile?.location?.toLowerCase().includes(searchLoc));
    }

    return { data: filtered, lastDoc: newLastDoc, hasMore };
  },

  getRentalsPaginated: async (lastDoc: any, limit: number, filters: MarketplaceFilters) => {
    return equipmentService._getMarketplaceItems('isForRent', lastDoc, limit, filters);
  },

  getSalesPaginated: async (lastDoc: any, limit: number, filters: MarketplaceFilters) => {
    return equipmentService._getMarketplaceItems('isForSale', lastDoc, limit, filters);
  },

  searchMarketplace: async (
    filterField: 'isForRent' | 'isForSale',
    queryText: string,
    filters: MarketplaceFilters = {}
  ): Promise<Equipment[]> => {
    const dbField = filterField === 'isForRent' ? 'is_for_rent' : 'is_for_sale';
    let query = supabase
      .from('equipment')
      .select('*')
      .eq(dbField, true)
      .eq('status', 'SAFE')
      .order('id')
      .limit(120);

    // Oculta os próprios itens do usuário na busca da vitrine.
    if (filters.excludeOwnerId) {
      query = query.neq('owner_id', filters.excludeOwnerId);
    }

    const { data: rows } = await query;
    let items = (rows || []).map(mapFromDb);

    const needle = (queryText || '').trim().toLowerCase();
    if (needle) {
      items = items.filter(it => `${it.name} ${it.brand} ${it.model}`.toLowerCase().includes(needle));
    }
    if (filters.category) {
      items = items.filter(it => it.category === filters.category);
    }
    if (filters.uf || filters.city) {
      const loc = (filters.city || filters.uf || '').toLowerCase();
      items = items.filter(it => it.ownerProfile?.location?.toLowerCase().includes(loc));
    }
    return items;
  },

  uploadEquipmentImage: async (file: File, ownerId: string): Promise<string | null> => {
    try {
      const optimizedBlob = await processImageForWebP(file);
      const fileName = `${ownerId}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from('equipment').upload(fileName, optimizedBlob, {
        contentType: 'image/webp',
      });
      if (error) { console.error('Equipment image upload error:', error); return null; }
      const { data: { publicUrl } } = supabase.storage.from('equipment').getPublicUrl(fileName);
      return publicUrl;
    } catch (e) { console.error('uploadEquipmentImage error:', e); return null; }
  },

  uploadInvoiceImage: async (file: File, ownerId: string, equipmentId: string): Promise<string | null> => {
    try {
      const isPdf = file.type === 'application/pdf';
      const blob: Blob = isPdf ? file : await processImageForWebP(file);
      const ext = isPdf ? 'pdf' : 'webp';
      const fileName = `${ownerId}/${equipmentId}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('invoices').upload(fileName, blob, {
        contentType: isPdf ? 'application/pdf' : 'image/webp',
      });
      if (error) { console.error('Invoice upload error:', error); return null; }
      const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName);
      return publicUrl;
    } catch (e) { console.error('uploadInvoiceImage error:', e); return null; }
  },

  transferEquipmentOwnership: async (itemId: string, newOwnerId: string, transactionValue?: number): Promise<boolean> => {
    try {
      const { data: itemRow } = await supabase.from('equipment').select('*').eq('id', itemId).single();
      if (!itemRow) return false;
      const item = mapFromDb(itemRow);

      const newOwnerProfile = await userService.getUserProfile(newOwnerId);

      const updatePayload: any = {
        owner_id: newOwnerId,
        status: EquipmentStatus.SAFE,
        pending_transfer_to: null,
        is_for_rent: false,
        is_for_sale: false,
        owner_profile: newOwnerProfile ? {
          name: newOwnerProfile.name,
          avatarUrl: newOwnerProfile.avatarUrl,
          location: newOwnerProfile.location
        } : null
      };
      if (transactionValue && transactionValue > 0) {
        updatePayload.value = transactionValue;
      }
      await supabase.from('equipment').update(updatePayload).eq('id', itemId);

      // Update Transaction History
      if (transactionValue && transactionValue > 0) {
        // Seller
        const { data: seller } = await supabase.from('users').select('transaction_history').eq('id', item.ownerId).single();
        if (seller) {
          const sellerHist = { ...(seller.transaction_history || {}), [newOwnerId]: ((seller.transaction_history || {})[newOwnerId] || 0) + transactionValue };
          await supabase.from('users').update({ transaction_history: sellerHist }).eq('id', item.ownerId);
        }
        // Buyer
        const { data: buyer } = await supabase.from('users').select('transaction_history').eq('id', newOwnerId).single();
        if (buyer) {
          const buyerHist = { ...(buyer.transaction_history || {}), [item.ownerId]: ((buyer.transaction_history || {})[item.ownerId] || 0) + transactionValue };
          await supabase.from('users').update({ transaction_history: buyerHist }).eq('id', newOwnerId);
        }
      }

      return true;
    } catch (e) {
      console.error("Transfer Error:", e);
      return false;
    }
  },

  cancelTransfer: async (equipmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('equipment').update({
        status: EquipmentStatus.SAFE, pending_transfer_to: null
      }).eq('id', equipmentId);
      return !error;
    } catch (e) { return false; }
  },
};
