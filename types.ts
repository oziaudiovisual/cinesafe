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
  theftAddress?: string; // Reverse geocoded (OpenStreetMap/Nominatim)
  pendingTransferTo?: string; // ID of user the transfer is pending to
  ownerProfile?: {
    name: string;
    avatarUrl: string;
    location: string;
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
  contactPhone?: string; // Public contact phone
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
  | 'CONNECTION_ACCEPTED'
  | 'ITEM_TRANSFER'
  | 'RENTAL_OVERDUE'
  | 'RAFFLE_TICKET'
  | 'RAFFLE_WINNER';

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

export type ContractType = 'rental' | 'sale';
export type ContractStatus = 'proposed' | 'active' | 'completed' | 'declined' | 'cancelled';

export interface Contract {
  id: string;
  type: ContractType;
  status: ContractStatus;
  parties: string[]; // [ownerId, counterpartyId] — para query e regras
  ownerId: string;   // dono do equipamento (locador/vendedor), cria o contrato
  ownerName: string;
  ownerAvatar: string;
  counterpartyId: string; // locatário/comprador, aceita
  counterpartyName: string;
  counterpartyAvatar: string;
  equipmentId: string;
  equipmentName: string;
  equipmentImage?: string;
  value: number;        // aluguel: valor total do período; venda: preço
  pickupDate?: string;  // aluguel: dia da retirada (ISO date)
  returnDate?: string;  // aluguel: dia da devolução (ISO date)
  chatId?: string;      // liga o contrato à conversa
  // Pagamento (flexível: pode ser anexado antes ou depois). Sem status = pendente.
  paymentStatus?: 'submitted' | 'confirmed';
  paymentProofUrl?: string;   // comprovante (imagem/PDF) no Storage
  paymentSubmittedBy?: string;
  paymentAt?: string;
  // Fluxo de não-devolução (aluguel atrasado): aviso -> prazo -> alerta público.
  overdueNoticeAt?: string;   // quando o dono notificou o atraso (inicia o prazo)
  publicAlert?: boolean;      // dono escalou para alerta público
  publicAlertAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Alerta público de não-devolução (visível à comunidade e no perfil do locatário).
export interface ReturnAlert {
  id: string;          // = contractId (determinístico)
  contractId: string;
  renterId: string;    // quem não devolveu
  renterName: string;
  renterAvatar: string;
  ownerId: string;     // quem emitiu
  ownerName: string;
  equipmentName: string;
  equipmentImage?: string;
  agreedReturnDate: string;
  raisedAt: string;
  status: 'active' | 'resolved';
  resolvedAt?: string;
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
  transactionsCount?: number;   // impacto global: transações fechadas
  transactedValue?: number;     // impacto global: valor total movimentado
}

// --- SORTEIOS ---

export type RaffleStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface Raffle {
  id: string;
  title: string;              // "Câmera Sony A7III"
  description: string;        // Descrição do prêmio
  prizeImageUrl?: string;     // Foto do prêmio (Storage)
  status: RaffleStatus;
  createdBy: string;          // admin userId
  startDate: string;          // ISO — início do período de participação
  endDate: string;            // ISO — fim (data do sorteio)
  createdAt: string;
  updatedAt: string;
  // Resultado
  winnerId?: string;          // userId do vencedor
  winnerName?: string;        // snapshot
  winnerAvatar?: string;      // snapshot
  drawnAt?: string;           // ISO da realização do sorteio
  // Contadores (denormalizados para exibição rápida)
  totalTickets: number;       // soma de todos os tickets
  totalParticipants: number;  // quantos usuários distintos participam
}

export interface RaffleTicket {
  id: string;
  raffleId: string;           // FK → raffles
  userId: string;             // quem ganhou este ticket
  userName: string;           // snapshot
  userAvatar: string;         // snapshot
  source: 'signup' | 'referral'; // como ganhou: cadastro ou convite
  referredUserId?: string;    // se source='referral', quem foi o convidado
  referredUserName?: string;  // snapshot
  createdAt: string;
}
