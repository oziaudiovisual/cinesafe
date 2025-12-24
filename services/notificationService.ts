
import { db } from './firebase';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  query, where, getDocs, increment
} from 'firebase/firestore';
import { Notification } from '../types';

export const notificationService = {
  createNotification: async (notification: Notification) => {
    try {
        await setDoc(doc(db, 'notifications', notification.id), notification);
        
        const userRef = doc(db, 'users', notification.toUserId);
        
        let statField = '';
        if (notification.type === 'RENTAL_INTEREST') statField = 'notificationStats.rentalInterest';
        else if (notification.type === 'SALE_INTEREST') statField = 'notificationStats.saleInterest';
        else if (notification.type === 'STOLEN_FOUND') statField = 'notificationStats.stolenAlerts';

        if (statField) {
             await updateDoc(userRef, {
                 [statField]: increment(1)
             });
        }
        return true;
    } catch (e) { return false; }
  },

  getUserNotifications: async (userId: string): Promise<Notification[]> => {
      const q = query(collection(db, 'notifications'), where('toUserId', '==', userId));
      const snap = await getDocs(q);
      let notifs = snap.docs.map(d => d.data() as Notification);
      
      const now = new Date();
      notifs = notifs.filter(n => {
          if (n.expiresAt) {
              return new Date(n.expiresAt) > now;
          }
          return true;
      });

      return notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  markNotificationAsRead: async (notificationId: string) => {
      try {
          await updateDoc(doc(db, 'notifications', notificationId), { read: true });
          return true;
      } catch (e) { return false; }
  },

  deleteNotification: async (notificationId: string): Promise<boolean> => {
      try {
          await deleteDoc(doc(db, 'notifications', notificationId));
          return true;
      } catch (e) { 
          console.error("Error deleting notification:", e);
          return false; 
      }
  },

  scheduleNotificationExpiry: async (notificationId: string) => {
     try {
         const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
         await updateDoc(doc(db, 'notifications', notificationId), { 
             read: true,
             expiresAt: expiresAt 
         });
         return true;
     } catch (e) { return false; }
  },
};
