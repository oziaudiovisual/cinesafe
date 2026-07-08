
import { db, storage } from './firebase';
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, getDocs, writeBatch, increment,
  limit, startAfter, orderBy, QueryConstraint, DocumentData, QueryDocumentSnapshot
} from 'firebase/firestore';
import { Equipment, EquipmentStatus, MarketplaceFilters } from '../types';
import { userService } from './userService';
import { processImageForWebP, resilientUpload } from '../utils/imageProcessor';

// --- Equipment Service Logic ---
export const equipmentService = {
  getUserEquipment: async (userId: string): Promise<Equipment[]> => {
    const q = query(collection(db, 'equipment'), where('ownerId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Equipment);
  },

  addEquipment: async (item: Equipment) => {
    // Data Denormalization: Fetch owner profile to store directly on equipment doc
    const ownerProfile = await userService.getUserProfile(item.ownerId);

    const itemWithProfile: Equipment = {
      ...item,
      // Normaliza o serial (maiúsculas + sem espaços) para verificação consistente.
      serialNumber: String(item.serialNumber || '').trim().toUpperCase(),
      // NÃO denormaliza o telefone no item: a vitrine é pública e o telefone
      // vazaria. O contato acontece via notificação (fromUserPhone).
      ownerProfile: ownerProfile ? {
        name: ownerProfile.name,
        avatarUrl: ownerProfile.avatarUrl,
        location: ownerProfile.location
      } : undefined
    };

    await setDoc(doc(db, 'equipment', item.id), itemWithProfile);
  },

  updateEquipment: async (updatedItem: Equipment) => {
    // Ensure profile data is fresh/present on update if available
    let dataToSave = { ...updatedItem };
    // Mantém o serial normalizado também na edição (consistente com addEquipment/checkSerial).
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

    await updateDoc(doc(db, 'equipment', updatedItem.id), dataToSave);
  },

  recoverEquipment: async (item: Equipment, recoveredViaApp: boolean = false): Promise<boolean> => {
    try {
      await setDoc(doc(collection(db, 'theft_history')), {
        equipmentId: item.id, ownerId: item.ownerId, theftDate: item.theftDate,
        theftLat: item.theftLocation?.lat, theftLng: item.theftLocation?.lng,
        theftAddress: item.theftAddress, equipmentValue: item.value || 0,
        recoveryDate: new Date().toISOString(), recoveredViaApp: recoveredViaApp
      });
      await updateDoc(doc(db, 'equipment', item.id), {
        status: EquipmentStatus.SAFE, theftDate: null, theftLocation: null, theftAddress: null
      });
      return true;
    } catch (e) { return false; }
  },

  deleteEquipment: async (id: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, 'equipment', id));
      return true;
    } catch (e) { return false; }
  },

  checkSerial: async (serial: string): Promise<Equipment | undefined> => {
    try {
      if (!serial) return undefined;
      const trimmed = String(serial).trim();
      const upper = trimmed.toUpperCase();
      // Tenta o valor normalizado (docs novos) e, se não achar, o cru (docs legados
      // que ainda não foram normalizados) — evita regressão na verificação de serial.
      const candidates = upper === trimmed ? [upper] : [upper, trimmed];

      for (const value of candidates) {
        const q = query(collection(db, 'equipment'), where('serialNumber', '==', value));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const item = snap.docs[0].data() as Equipment;
          // Refresh profile on check to be safe, though likely denormalized data is enough
          if (!item.ownerProfile) {
            const owner = await userService.getUserProfile(item.ownerId);
            if (owner) {
              item.ownerProfile = {
                name: owner.name, avatarUrl: owner.avatarUrl,
                location: owner.location
              };
            }
          }
          return item;
        }
      }
      return undefined;
    } catch (e) { return undefined; }
  },

  _getMarketplaceItems: async (
    filterField: string,
    lastDoc: QueryDocumentSnapshot<DocumentData> | null,
    limitCount: number,
    filters: MarketplaceFilters
  ): Promise<{ data: Equipment[], lastDoc: QueryDocumentSnapshot<DocumentData> | null, hasMore: boolean }> => {

    // 1. Build Query Constraints
    const constraints: QueryConstraint[] = [
      where(filterField, '==', true),
      where('status', '==', 'SAFE'),
      // Order by ID is required for consistent pagination if we don't have a specific sort field like createdAt
      // In a production app, we should add 'createdAt' to Equipment and order by that.
      // using documentId() or a field that exists is crucial for startAfter.
      orderBy('id')
    ];

    // 2. Apply Server-Side Filters (Exact matches only)
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }

    // 3. Pagination Constraints
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    // Fetch one extra to determine hasMore without a second query count
    constraints.push(limit(limitCount + 1));

    // 4. Execute Query
    const q = query(collection(db, 'equipment'), ...constraints);
    const snap = await getDocs(q);

    // 5. Process Results
    const allDocs = snap.docs;
    const hasMore = allDocs.length > limitCount;

    // If we fetched limit + 1, remove the last one from the data result
    const docsToReturn = hasMore ? allDocs.slice(0, limitCount) : allDocs;
    const newLastDoc = docsToReturn.length > 0 ? docsToReturn[docsToReturn.length - 1] : null;

    let items = docsToReturn.map(d => d.data() as Equipment);

    // 6. Apply "Soft" Filters for Location (Optimization: O(N) only on the page size, not DB)
    // Since Firestore doesn't support full-text search or "contains" for location efficiently 
    // without third-party tools (Algolia/Typesense), we filter the page results.
    // NOTE: This might result in pages with fewer than 'limit' items, but preserves architecture.
    if (filters.uf || filters.city) {
      const searchLoc = (filters.city || filters.uf || '').toLowerCase();
      items = items.filter(item => {
        return item.ownerProfile?.location?.toLowerCase().includes(searchLoc);
      });
    }

    return {
      data: items,
      lastDoc: newLastDoc,
      hasMore: hasMore
    };
  },

  getRentalsPaginated: async (lastDoc: any, limit: number, filters: MarketplaceFilters) => {
    return equipmentService._getMarketplaceItems('isForRent', lastDoc, limit, filters);
  },

  getSalesPaginated: async (lastDoc: any, limit: number, filters: MarketplaceFilters) => {
    return equipmentService._getMarketplaceItems('isForSale', lastDoc, limit, filters);
  },

  // Busca textual por trecho (substring, case-insensitive) sobre um lote do
  // marketplace. Sem serviço externo e sem migração: funciona em todos os itens.
  // Limitação: cobre os primeiros ~120 itens do filtro (suficiente enquanto o
  // catálogo é pequeno; acima disso, migrar para full-text externo).
  searchMarketplace: async (
    filterField: 'isForRent' | 'isForSale',
    queryText: string,
    filters: MarketplaceFilters = {}
  ): Promise<Equipment[]> => {
    const q = query(
      collection(db, 'equipment'),
      where(filterField, '==', true),
      where('status', '==', 'SAFE'),
      orderBy('id'),
      limit(120)
    );
    const snap = await getDocs(q);
    let items = snap.docs.map(d => d.data() as Equipment);

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
    const optimizedBlob = await processImageForWebP(file);
    const fileName = `users/${ownerId}/equipment/${Date.now()}.webp`;
    const storageRef = storage.ref(fileName);
    return resilientUpload(storageRef, optimizedBlob);
  },

  uploadInvoiceImage: async (file: File, ownerId: string, equipmentId: string): Promise<string | null> => {
    // PDFs vão direto (o pipeline WebP só lida com imagem e quebraria com PDF).
    const isPdf = file.type === 'application/pdf';
    const blob: Blob = isPdf ? file : await processImageForWebP(file);
    const ext = isPdf ? 'pdf' : 'webp';
    const fileName = `users/${ownerId}/invoices/${equipmentId}_${Date.now()}.${ext}`;
    const storageRef = storage.ref(fileName);
    return resilientUpload(storageRef, blob);
  },

  transferEquipmentOwnership: async (itemId: string, newOwnerId: string, transactionValue?: number): Promise<boolean> => {
    try {
      const itemDoc = await getDoc(doc(db, 'equipment', itemId));
      if (!itemDoc.exists()) return false;
      const item = itemDoc.data() as Equipment;

      const batch = writeBatch(db);

      // Update Equipment: Change Owner, Reset Status, Clear Pending
      const eqRef = doc(db, 'equipment', itemId);

      // We must also fetch the NEW owner profile to update the denormalized data immediately
      const newOwnerProfile = await userService.getUserProfile(newOwnerId);

      const updatePayload: any = {
        ownerId: newOwnerId,
        status: EquipmentStatus.SAFE,
        pendingTransferTo: null,
        // Chega ao novo dono fora do marketplace (ele decide se re-anuncia).
        isForRent: false,
        isForSale: false,
        ownerProfile: newOwnerProfile ? {
          name: newOwnerProfile.name,
          avatarUrl: newOwnerProfile.avatarUrl,
          location: newOwnerProfile.location
        } : null
      };

      if (transactionValue && transactionValue > 0) {
        updatePayload.value = transactionValue;
      }
      batch.update(eqRef, updatePayload);

      // Update Transaction History
      if (transactionValue && transactionValue > 0) {
        const sellerRef = doc(db, 'users', item.ownerId);
        const buyerRef = doc(db, 'users', newOwnerId);

        batch.update(sellerRef, { [`transactionHistory.${newOwnerId}`]: increment(transactionValue) });
        batch.update(buyerRef, { [`transactionHistory.${item.ownerId}`]: increment(transactionValue) });
      }

      await batch.commit();
      return true;
    } catch (e) {
      console.error("Transfer Error:", e);
      return false;
    }
  },

  cancelTransfer: async (equipmentId: string): Promise<boolean> => {
    try {
      // Note: Notification cleanup must be handled by the recipient when they view it.
      // We cannot query notifications by itemId due to security rules (toUserId only).
      const equipmentDocRef = doc(db, 'equipment', equipmentId);
      await updateDoc(equipmentDocRef, { status: EquipmentStatus.SAFE, pendingTransferTo: null });
      return true;
    } catch (e) { return false; }
  },
};
