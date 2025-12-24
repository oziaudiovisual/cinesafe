
import { db, storage } from './firebase';
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, getDocs, getCountFromServer, increment, arrayUnion, arrayRemove, writeBatch
} from 'firebase/firestore';
import { Equipment, User, EquipmentStatus, UsageStats, DetailedStats, Notification } from '../types';
import { processImageForWebP, resilientUpload, cropImageHelper } from '../utils/imageProcessor';

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
       const docRef = doc(db, 'users', userId);
       const docSnap = await getDoc(docRef);
       
       if (docSnap.exists()) {
           const user = docSnap.data() as User;
           const q = query(collection(db, 'equipment'), where('ownerId', '==', userId));
           const eqSnap = await getDocs(q);
           const equipment = eqSnap.docs.map(d => d.data() as Equipment);
           
           user.reputationPoints = calculateReputation(user, equipment);
           return user;
       }
       return null;
    } catch (e) {
        console.error("Profile Fetch Exception:", e);
        return null;
    }
  },

  saveUser: async (user: User) => {
    await setDoc(doc(db, 'users', user.id), user);
  },

  updateUserProfile: async (userId: string, updates: Partial<User>) => {
    try {
        await updateDoc(doc(db, 'users', userId), updates);
        return true;
    } catch (e) { return false; }
  },

  isPremium: (user: User): boolean => {
    return (user.referralCount || 0) >= 5 || user.role === 'admin';
  },

  checkLimit: async (userId: string, type: 'inventory' | 'check' | 'contact'): Promise<boolean> => {
    const user = await userService.getUserProfile(userId);
    if (!user) return false;
    if (userService.isPremium(user)) return true;
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (type === 'inventory') {
        const q = query(collection(db, 'equipment'), where('ownerId', '==', userId));
        const count = (await getCountFromServer(q)).data().count;
        return count < 3;
    }
    if (type === 'check') {
        const stats = user.usageStats?.serialChecks || { count: 0, month: '' };
        if (stats.month !== currentMonth) return true; 
        return stats.count < 1;
    }
    if (type === 'contact') {
        const stats = user.usageStats?.contactReveals || { count: 0, month: '' };
        if (stats.month !== currentMonth) return true; 
        return stats.count < 2;
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
    await updateDoc(doc(db, 'users', userId), { usageStats });
  },

  processReferral: async (referralCode: string) => {
    const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const referrerDoc = snapshot.docs[0];
        await updateDoc(referrerDoc.ref, { referralCount: increment(1) });
    }
  },

  incrementUserStat: async (userId: string, stat: 'checksCount' | 'reportsCount') => {
    if (stat === 'checksCount') await userService.incrementUsage(userId, 'check');
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
        await updateDoc(doc(db, 'users', userId), { [stat]: increment(1) });
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => d.data() as User);
    const eqSnap = await getDocs(collection(db, 'equipment'));
    const allEq = eqSnap.docs.map(d => d.data() as Equipment);
    return users.map(user => {
        const userEq = allEq.filter(e => e.ownerId === user.id);
        user.reputationPoints = calculateReputation(user, userEq);
        user.inventoryCount = userEq.length;
        return user;
    });
  },

  toggleUserBlock: async (userId: string, currentStatus: boolean): Promise<boolean> => {
    try {
        await updateDoc(doc(db, 'users', userId), { isBlocked: !currentStatus });
        return true;
    } catch (e) { return false; }
  },

  deleteUser: async (userId: string): Promise<boolean> => {
    try {
        const q = query(collection(db, 'equipment'), where('ownerId', '==', userId));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => await deleteDoc(d.ref));
        await deleteDoc(doc(db, 'users', userId));
        return true;
    } catch (e) { return false; }
  },

  toggleUserRole: async (userId: string, newRole: 'admin' | 'user'): Promise<boolean> => {
    try {
        await updateDoc(doc(db, 'users', userId), { role: newRole });
        return true;
    } catch (e) { return false; }
  },

  searchUsers: async (queryStr: string, currentUserId: string): Promise<User[]> => {
    if (!queryStr || queryStr.length < 2) return [];
    try {
        const allUsers = await userService.getAllUsers();
        const lowerQuery = queryStr.toLowerCase();
        return allUsers.filter(u => u.id !== currentUserId && (u.name.toLowerCase().includes(lowerQuery) || u.email.toLowerCase().includes(lowerQuery))).slice(0, 20);
    } catch (e) { return []; }
  },

  addConnection: async (userAId: string, userBId: string) => {
    if (userAId === userBId) return false;
    try {
        const refA = doc(db, 'users', userAId);
        const refB = doc(db, 'users', userBId);
        await updateDoc(refA, { connections: arrayUnion(userBId) });
        await updateDoc(refB, { connections: arrayUnion(userAId) });
        return true;
    } catch (e) { return false; }
  },

  removeConnection: async (userAId: string, userBId: string) => {
    try {
        const batch = writeBatch(db);
        const refA = doc(db, 'users', userAId);
        const refB = doc(db, 'users', userBId);
        batch.update(refA, { connections: arrayRemove(userBId) });
        batch.update(refB, { connections: arrayRemove(userAId) });
        await batch.commit();
        return true;
    } catch (e) { return false; }
  },

  getConnections: async (userId: string): Promise<User[]> => {
    try {
        const user = await userService.getUserProfile(userId);
        if (!user || !user.connections || user.connections.length === 0) return [];
        const promises = user.connections.map(id => getDoc(doc(db, 'users', id)));
        const snaps = await Promise.all(promises);
        return snaps.filter(s => s.exists()).map(s => s.data() as User).filter(u => u.id !== userId);
    } catch (e) { return []; }
  },

  getUserDetailedStats: async (userId: string): Promise<DetailedStats> => {
    const qEq = query(collection(db, 'equipment'), where('ownerId', '==', userId));
    const eqSnap = await getDocs(qEq);
    const equipment = eqSnap.docs.map(d => d.data() as Equipment);
    
    const totalItems = equipment.length;
    const safeItemsCount = equipment.filter(e => e.status === EquipmentStatus.SAFE).length;
    const totalValue = equipment.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const stolenItems = equipment.filter(e => e.status === EquipmentStatus.STOLEN).length;
    const itemsForRentCount = equipment.filter(e => e.isForRent && e.status === EquipmentStatus.SAFE).length;
    const itemsForSaleCount = equipment.filter(e => e.isForSale && e.status === EquipmentStatus.SAFE).length;

    const qHist = query(collection(db, 'theft_history'), where('ownerId', '==', userId));
    const histSnap = await getDocs(qHist);
    const recoveredItems = histSnap.size;
    let recoveredValue = 0;
    histSnap.forEach(doc => { recoveredValue += Number(doc.data().equipmentValue) || 0; });

    const qNotif = query(collection(db, 'notifications'), where('toUserId', '==', userId));
    const notifSnap = await getDocs(qNotif);
    const notifications = notifSnap.docs.map(d => d.data() as Notification);
    const rentalOffers = notifications.filter(n => n.type === 'RENTAL_INTEREST').length;
    const saleOffers = notifications.filter(n => n.type === 'SALE_INTEREST').length;

    return { totalItems, safeItemsCount, totalValue, stolenItems, recoveredItems, recoveredValue, rentalOffers, saleOffers, itemsForRentCount, itemsForSaleCount };
  },

  getGlobalDetailedStats: async (): Promise<DetailedStats> => {
    const eqSnap = await getDocs(collection(db, 'equipment'));
    const equipment = eqSnap.docs.map(d => d.data() as Equipment);
    const totalItems = equipment.length;
    const safeItemsCount = equipment.filter(e => e.status === EquipmentStatus.SAFE).length;
    const totalValue = equipment.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const stolenItems = equipment.filter(e => e.status === EquipmentStatus.STOLEN).length;
    const itemsForRentCount = equipment.filter(e => e.isForRent).length;
    const itemsForSaleCount = equipment.filter(e => e.isForSale).length;

    const histSnap = await getDocs(collection(db, 'theft_history'));
    const recoveredItems = histSnap.size;
    let recoveredValue = 0;
    histSnap.forEach(doc => { recoveredValue += Number(doc.data().equipmentValue) || 0; });

    const notifSnap = await getDocs(collection(db, 'notifications'));
    const notifications = notifSnap.docs.map(d => d.data() as Notification);
    const rentalOffers = notifications.filter(n => n.type === 'RENTAL_INTEREST').length;
    const saleOffers = notifications.filter(n => n.type === 'SALE_INTEREST').length;

    return { totalItems, safeItemsCount, totalValue, stolenItems, recoveredItems, recoveredValue, rentalOffers, saleOffers, itemsForRentCount, itemsForSaleCount };
  },

  getCommunitySafetyData: async (): Promise<{ lat: number, lng: number, address: string, date: string, itemName: string }[]> => {
    try {
        const q = query(collection(db, 'equipment'), where('status', '==', 'STOLEN'));
        const activeSnap = await getDocs(q);
        const active = activeSnap.docs.map(d => d.data() as Equipment).filter(e => e.theftLocation).map(e => ({ lat: e.theftLocation!.lat, lng: e.theftLocation!.lng, address: e.theftAddress || 'Local desconhecido', date: e.theftDate || new Date().toISOString(), itemName: e.name }));
        const histSnap = await getDocs(collection(db, 'theft_history'));
        const history = histSnap.docs.map(d => ({ lat: d.data().theftLat, lng: d.data().theftLng, address: d.data().theftAddress, date: d.data().theftDate, itemName: 'Item Recuperado/Histórico' }));
        return [...active, ...history];
    } catch (e) {
        console.error("Error fetching safety data:", e);
        return [];
    }
  },

  getStats: async (userId: string) => {
    const q = query(collection(db, 'equipment'), where('ownerId', '==', userId));
    const snap = await getDocs(q);
    const safeEq = snap.docs.map(d => d.data() as Equipment);
    const totalValue = safeEq.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
    return { total: safeEq.length, value: totalValue, stolen: safeEq.filter(e => e.status === EquipmentStatus.STOLEN).length, forRent: safeEq.filter(e => e.isForRent).length, forSale: safeEq.filter(e => e.isForSale).length };
  },

  uploadUserAvatar: async (file: File, userId: string): Promise<string | null> => {
    const optimizedBlob = await processImageForWebP(file);
    const fileName = `users/${userId}/avatar/${Date.now()}.webp`;
    const storageRef = storage.ref(fileName);
    return resilientUpload(storageRef, optimizedBlob);
  },

  cropImage: cropImageHelper,
};
