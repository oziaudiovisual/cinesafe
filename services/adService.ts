
import { db, storage } from './firebase';
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, getDocs, orderBy, increment
} from 'firebase/firestore';
import { Ad } from '../types';
import { processImageForWebP, resilientUpload } from '../utils/imageProcessor';

// --- Ads Service Logic ---
export const adService = {
  createAd: async (ad: Ad): Promise<boolean> => {
    try {
      await setDoc(doc(db, 'ads', ad.id), ad);
      return true;
    } catch (e) { return false; }
  },

  updateAd: async (ad: Ad): Promise<boolean> => {
    try {
      await updateDoc(doc(db, 'ads', ad.id), { ...ad });
      return true;
    } catch (e) { return false; }
  },

  deleteAd: async (id: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, 'ads', id));
      return true;
    } catch (e) { return false; }
  },

  getAllAds: async (): Promise<Ad[]> => {
    const q = query(collection(db, 'ads'), orderBy('startDate', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Ad);
  },

  getActiveAd: async (): Promise<Ad | null> => {
    const now = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'ads'), where('active', '==', true));
    const snap = await getDocs(q);
    const validAds = snap.docs.map(d => d.data() as Ad).filter(ad => ad.startDate <= now && ad.endDate >= now);
    
    if (validAds.length === 0) return null;
    
    const totalWeight = validAds.reduce((sum, ad) => sum + (ad.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const ad of validAds) {
        random -= (ad.weight || 1);
        if (random <= 0) return ad;
    }
    return validAds[0];
  },

  trackAdImpression: async (id: string) => {
    try {
        await updateDoc(doc(db, 'ads', id), { impressions: increment(1) });
    } catch (e) { console.error(e); }
  },

  trackAdClick: async (id: string) => {
    try {
        await updateDoc(doc(db, 'ads', id), { clicks: increment(1) });
    } catch (e) { console.error(e); }
  },

  uploadAdImage: async (file: File): Promise<string | null> => {
    const optimizedBlob = await processImageForWebP(file);
    const fileName = `ads/${Date.now()}.webp`;
    const storageRef = storage.ref(fileName);
    return resilientUpload(storageRef, optimizedBlob);
  }
};
