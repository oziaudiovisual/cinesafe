
import { adService } from './adService';
import { equipmentService } from './equipmentService';
import { notificationService } from './notificationService';
import { userService } from './userService';
import { User } from '../types';

// Export domain services directly for pages to use
export { adService, equipmentService, notificationService, userService };

// Legacy StorageService Object for backward compatibility
// Now it serves strictly as a facade, forwarding calls to the new services.
export const StorageService = {
  // User
  getUserProfile: userService.getUserProfile,
  getCurrentUser: async (): Promise<User> => {
    // Basic placeholder, logic should be handled by AuthContext via userService
    return { id: 'guest', name: 'Guest', email: '', avatarUrl: '', location: '', reputationPoints: 0, isVerified: false, role: 'user' };
  },
  saveUser: userService.saveUser,
  updateUserProfile: userService.updateUserProfile,
  isPremium: userService.isPremium,
  checkLimit: userService.checkLimit,
  incrementUsage: userService.incrementUsage,
  processReferral: userService.processReferral,
  incrementUserStat: userService.incrementUserStat,
  getAllUsers: userService.getAllUsers,
  toggleUserBlock: userService.toggleUserBlock,
  findUserByEmail: async (email: string) => { 
      const users = await userService.searchUsers(email, ''); 
      return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  searchUsers: userService.searchUsers,
  addConnection: userService.addConnection,
  removeConnection: userService.removeConnection,
  getConnections: userService.getConnections,
  deleteUser: userService.deleteUser,
  toggleUserRole: userService.toggleUserRole,
  getGlobalStats: async () => { 
      const stats = await userService.getGlobalDetailedStats();
      return { users: 0, equipment: stats.totalItems, stolen: stats.stolenItems, value: stats.totalValue };
  },
  getUserDetailedStats: userService.getUserDetailedStats,
  getGlobalDetailedStats: userService.getGlobalDetailedStats,
  getCommunitySafetyData: userService.getCommunitySafetyData,
  getStats: userService.getStats,
  uploadUserAvatar: userService.uploadUserAvatar,
  cropImage: userService.cropImage,
  
  // Equipment
  getUserEquipment: equipmentService.getUserEquipment,
  addEquipment: equipmentService.addEquipment,
  updateEquipment: equipmentService.updateEquipment,
  recoverEquipment: equipmentService.recoverEquipment,
  deleteEquipment: equipmentService.deleteEquipment,
  checkSerial: equipmentService.checkSerial,
  getRentalsPaginated: equipmentService.getRentalsPaginated,
  getSalesPaginated: equipmentService.getSalesPaginated,
  getRentals: async () => {
      const res = await equipmentService.getRentalsPaginated(0, 100, {});
      return res.data;
  },
  uploadEquipmentImage: equipmentService.uploadEquipmentImage,
  uploadInvoiceImage: equipmentService.uploadInvoiceImage,
  transferEquipmentOwnership: equipmentService.transferEquipmentOwnership,
  cancelTransfer: equipmentService.cancelTransfer,

  // Notification
  createNotification: notificationService.createNotification,
  getUserNotifications: notificationService.getUserNotifications,
  markNotificationAsRead: notificationService.markNotificationAsRead,
  deleteNotification: notificationService.deleteNotification,
  scheduleNotificationExpiry: notificationService.scheduleNotificationExpiry,

  // Ads
  createAd: adService.createAd,
  updateAd: adService.updateAd,
  deleteAd: adService.deleteAd,
  getAllAds: adService.getAllAds,
  getActiveAd: adService.getActiveAd,
  trackAdImpression: adService.trackAdImpression,
  trackAdClick: adService.trackAdClick,
  uploadAdImage: adService.uploadAdImage,
};
