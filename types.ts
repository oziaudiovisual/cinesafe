// Add global declaration for Leaflet (loaded via CDN)
declare global {
  var L: any;
}

export enum EquipmentStatus {
  SAFE = 'SAFE',
  STOLEN = 'STOLEN',
  LOST = 'LOST',
  TRANSFER_PENDING = 'TRANSFER_PENDING',
}

export enum EquipmentCategory {
  CAMERA = 'Câmera',
  LENS = 'Lente',
  AUDIO = 'Áudio',
  LIGHTING = 'Iluminação',
  DRONE = 'Drone',
  ACCESSORY = 'Acessório',
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Equipment {
  id: string;
  ownerId: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  value?: number; // Estimated value of the item
  
  // Rental
  isForRent: boolean;
  rentalPricePerDay?: number;
  
  // Sales
  isForSale: boolean;
  salePrice?: number;

  imageUrl?: string;
  invoiceUrl?: string; // URL for the uploaded invoice image
  description?: string;
  purchaseDate: string;
  theftLocation?: Coordinates;
  theftDate?: string;
  theftAddress?: string; // AI generated or reverse geocoded
  pendingTransferTo?: string; // ID of user the transfer is pending to
  ownerProfile?: {
    name: string;
    avatarUrl: string;
    location: string;
    contactPhone?: string;
  };
}

export interface UsageStats {
    serialChecks: { count: number, month: string };
    contactReveals: { count: number, month: string };
}

export interface NotificationStats {
  rentalInterest: number;
  saleInterest: number;
  stolenAlerts: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  location: string;
  reputationPoints: number; // For ranking
  isVerified: boolean;
  contactPhone?: string; // Public contact phone (WhatsApp)
  role: 'admin' | 'user'; // RBAC field
  isBlocked?: boolean; // Access control
  checksCount?: number; // Total serial numbers checked (Lifetime)
  reportsCount?: number; // Total thefts reported
  inventoryCount?: number; // UI helper for lists
  
  // Network
  connections?: string[]; // Array of User IDs (Trusted Network)
  transactionHistory?: { [partnerId: string]: number }; // New: Tracks total value transacted with a partner

  // Referral & Limits
  referralCode?: string;
  referredBy?: string;
  referralCount?: number; // Number of people invited
  usageStats?: UsageStats; // Monthly usage tracking
  
  // Lifetime received messages stats (persists after deletion)
  notificationStats?: NotificationStats;
}

// Updated Notification Types
export type NotificationType = 
  | 'RENTAL_INTEREST' 
  | 'SALE_INTEREST' 
  | 'STOLEN_FOUND' 
  | 'CONNECTION_REQUEST' 
  | 'ITEM_TRANSFER';

export interface Notification {
  id: string;
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhone?: string;
  fromUserAvatar?: string;     
  fromUserReputation?: number; 
  fromUserConnectionsCount?: number; // Added
  itemId?: string;
  itemName?: string;
  itemImage?: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  message?: string;
  expiresAt?: string; // ISO String for auto-deletion/hiding
  actionPayload?: {
    equipmentId?: string;
    requesterId?: string;
    transactionValue?: number; // New: For tracking sale value during transfer
  };
}

export interface RentalListing {
  equipmentId: string;
  ownerName: string;
  ownerAvatar: string;
  equipment: Equipment;
  distance: string; // Mocked distance
}

export interface Ad {
  id: string;
  advertiserName: string; // Used for "Brand" or internal name
  
  // Visuals for Composite Banner
  tagline?: string;
  title: string;
  priceOld?: string;
  priceNew?: string;
  buttonText: string;
  imageUrl: string; // Product PNG (transparent background)
  
  linkUrl?: string;
  startDate: string; // ISO String
  endDate: string;   // ISO String
  weight: number;    // 1 to 10
  active: boolean;
  impressions: number;
  clicks: number;
}

// FIX: Added missing type definitions used in services.
export interface MarketplaceFilters {
  category?: string;
  searchQuery?: string;
  uf?: string;
  city?: string;
}

export interface DetailedStats {
  totalItems: number;
  safeItemsCount: number;
  totalValue: number;
  stolenItems: number;
  recoveredItems: number;
  recoveredValue: number;
  rentalOffers: number;
  saleOffers: number;
  itemsForRentCount: number;
  itemsForSaleCount: number;
}
