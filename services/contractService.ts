import { supabase } from './supabase';
import { Contract, EquipmentStatus, Equipment, User, ReturnAlert, Notification } from '../types';
import { equipmentService } from './equipmentService';
import { notificationService } from './notificationService';
import { processImageForWebP } from '../utils/imageProcessor';

// --- Mapper ---
const mapContractFromDb = (row: any): Contract => ({
  id: row.id,
  type: row.type,
  status: row.status,
  parties: row.parties,
  ownerId: row.owner_id,
  ownerName: row.owner_name,
  ownerAvatar: row.owner_avatar,
  counterpartyId: row.counterparty_id,
  counterpartyName: row.counterparty_name,
  counterpartyAvatar: row.counterparty_avatar,
  equipmentId: row.equipment_id,
  equipmentName: row.equipment_name,
  equipmentImage: row.equipment_image,
  value: Number(row.value),
  pickupDate: row.pickup_date,
  returnDate: row.return_date,
  chatId: row.chat_id,
  paymentStatus: row.payment_status,
  paymentProofUrl: row.payment_proof_url,
  paymentSubmittedBy: row.payment_submitted_by,
  paymentAt: row.payment_at,
  overdueNoticeAt: row.overdue_notice_at,
  publicAlert: row.public_alert,
  publicAlertAt: row.public_alert_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapContractToDb = (c: any): any => {
  const obj: any = {};
  if (c.id !== undefined) obj.id = c.id;
  if (c.type !== undefined) obj.type = c.type;
  if (c.status !== undefined) obj.status = c.status;
  if (c.parties !== undefined) obj.parties = c.parties;
  if (c.ownerId !== undefined) obj.owner_id = c.ownerId;
  if (c.ownerName !== undefined) obj.owner_name = c.ownerName;
  if (c.ownerAvatar !== undefined) obj.owner_avatar = c.ownerAvatar;
  if (c.counterpartyId !== undefined) obj.counterparty_id = c.counterpartyId;
  if (c.counterpartyName !== undefined) obj.counterparty_name = c.counterpartyName;
  if (c.counterpartyAvatar !== undefined) obj.counterparty_avatar = c.counterpartyAvatar;
  if (c.equipmentId !== undefined) obj.equipment_id = c.equipmentId;
  if (c.equipmentName !== undefined) obj.equipment_name = c.equipmentName;
  if (c.equipmentImage !== undefined) obj.equipment_image = c.equipmentImage;
  if (c.value !== undefined) obj.value = c.value;
  if (c.pickupDate !== undefined) obj.pickup_date = c.pickupDate;
  if (c.returnDate !== undefined) obj.return_date = c.returnDate;
  if (c.chatId !== undefined) obj.chat_id = c.chatId;
  if (c.paymentStatus !== undefined) obj.payment_status = c.paymentStatus;
  if (c.paymentProofUrl !== undefined) obj.payment_proof_url = c.paymentProofUrl;
  if (c.paymentSubmittedBy !== undefined) obj.payment_submitted_by = c.paymentSubmittedBy;
  if (c.paymentAt !== undefined) obj.payment_at = c.paymentAt;
  if (c.overdueNoticeAt !== undefined) obj.overdue_notice_at = c.overdueNoticeAt;
  if (c.publicAlert !== undefined) obj.public_alert = c.publicAlert;
  if (c.publicAlertAt !== undefined) obj.public_alert_at = c.publicAlertAt;
  if (c.createdAt !== undefined) obj.created_at = c.createdAt;
  if (c.updatedAt !== undefined) obj.updated_at = c.updatedAt;
  return obj;
};

interface CreateContractInput {
  type: 'rental' | 'sale';
  owner: User;
  counterparty: { id: string; name: string; avatarUrl: string };
  equipment: Equipment;
  value: number;
  pickupDate?: string;
  returnDate?: string;
  chatId?: string;
}

export const contractService = {
  createContract: async (input: CreateContractInput): Promise<string | null> => {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const contract: Contract = {
        id, type: input.type, status: 'proposed',
        parties: [input.owner.id, input.counterparty.id],
        ownerId: input.owner.id, ownerName: input.owner.name, ownerAvatar: input.owner.avatarUrl,
        counterpartyId: input.counterparty.id, counterpartyName: input.counterparty.name, counterpartyAvatar: input.counterparty.avatarUrl,
        equipmentId: input.equipment.id, equipmentName: input.equipment.name, equipmentImage: input.equipment.imageUrl,
        value: input.value,
        ...(input.type === 'rental' ? { pickupDate: input.pickupDate, returnDate: input.returnDate } : {}),
        ...(input.chatId ? { chatId: input.chatId } : {}),
        createdAt: now, updatedAt: now,
      };
      const dbContract = mapContractToDb(contract);
      const { error } = await supabase.from('contracts').insert(dbContract);
      if (error) { console.error('createContract insert error:', error); return null; }

      if (input.type === 'sale') {
        await equipmentService.updateEquipment({
          ...input.equipment,
          status: EquipmentStatus.TRANSFER_PENDING,
          pendingTransferTo: input.counterparty.id,
        });
      }
      return id;
    } catch (e) {
      console.error('createContract error:', e);
      return null;
    }
  },

  subscribeUserContracts: (userId: string, cb: (contracts: Contract[]) => void) => {
    const loadContracts = async () => {
      const { data: rows } = await supabase
        .from('contracts')
        .select('*')
        .contains('parties', [userId])
        .order('created_at', { ascending: false });
      cb((rows || []).map(mapContractFromDb));
    };
    loadContracts();

    const channel = supabase
      .channel(`contracts:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => { loadContracts(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  acceptContract: async (contract: Contract): Promise<boolean> => {
    try {
      if (contract.type === 'sale') {
        const ok = await equipmentService.transferEquipmentOwnership(
          contract.equipmentId, contract.counterpartyId, contract.value
        );
        if (!ok) return false;
        await supabase.from('contracts').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', contract.id);
      } else {
        await supabase.from('contracts').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', contract.id);
      }
      // Contador de impacto global
      const { data: stats } = await supabase.from('global_stats').select('*').eq('id', 'global').single();
      if (stats) {
        await supabase.from('global_stats').update({
          transactions_count: (stats.transactions_count || 0) + 1,
          transacted_value: (Number(stats.transacted_value) || 0) + (Number(contract.value) || 0),
        }).eq('id', 'global');
      }
      return true;
    } catch (e) {
      console.error('acceptContract error:', e);
      return false;
    }
  },

  getAllContracts: async (): Promise<Contract[]> => {
    const { data: rows } = await supabase.from('contracts').select('*').order('created_at', { ascending: false });
    return (rows || []).map(mapContractFromDb);
  },

  closeContract: async (contract: Contract, status: 'declined' | 'cancelled'): Promise<boolean> => {
    try {
      if (contract.type === 'sale') {
        await equipmentService.cancelTransfer(contract.equipmentId);
      }
      await supabase.from('contracts').update({ status, updated_at: new Date().toISOString() }).eq('id', contract.id);
      return true;
    } catch (e) {
      console.error('closeContract error:', e);
      return false;
    }
  },

  completeRental: async (contract: Contract): Promise<boolean> => {
    try {
      await supabase.from('contracts').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', contract.id);
      if (contract.publicAlert) {
        await supabase.from('return_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', contract.id);
      }
      return true;
    } catch (e) {
      console.error('completeRental error:', e);
      return false;
    }
  },

  sendOverdueNotice: async (contract: Contract, owner: User): Promise<boolean> => {
    try {
      const notif: Notification = {
        id: crypto.randomUUID(),
        toUserId: contract.counterpartyId,
        fromUserId: owner.id, fromUserName: owner.name,
        fromUserPhone: owner.contactPhone, fromUserAvatar: owner.avatarUrl,
        itemName: contract.equipmentName, itemImage: contract.equipmentImage,
        type: 'RENTAL_OVERDUE', createdAt: new Date().toISOString(), read: false,
        message: `O aluguel de "${contract.equipmentName}" venceu em ${contract.returnDate ? new Date(contract.returnDate).toLocaleDateString('pt-BR') : ''}. Por favor, devolva o equipamento ou combine a devolução para evitar um alerta público.`,
      };
      await notificationService.createNotification(notif);
      await supabase.from('contracts').update({ overdue_notice_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', contract.id);
      return true;
    } catch (e) {
      console.error('sendOverdueNotice error:', e);
      return false;
    }
  },

  raisePublicAlert: async (contract: Contract, owner: User): Promise<boolean> => {
    try {
      const alert: any = {
        id: contract.id, contract_id: contract.id,
        renter_id: contract.counterpartyId, renter_name: contract.counterpartyName, renter_avatar: contract.counterpartyAvatar,
        owner_id: owner.id, owner_name: owner.name,
        equipment_name: contract.equipmentName, equipment_image: contract.equipmentImage,
        agreed_return_date: contract.returnDate || '', raised_at: new Date().toISOString(), status: 'active',
      };
      const clean = Object.fromEntries(Object.entries(alert).filter(([, v]) => v !== undefined));
      await supabase.from('return_alerts').upsert(clean);
      await supabase.from('contracts').update({
        public_alert: true, public_alert_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', contract.id);
      await notificationService.createNotification({
        id: crypto.randomUUID(),
        toUserId: contract.counterpartyId, fromUserId: owner.id, fromUserName: owner.name, fromUserAvatar: owner.avatarUrl,
        itemName: contract.equipmentName, type: 'RENTAL_OVERDUE',
        createdAt: new Date().toISOString(), read: false,
        message: `Foi emitido um ALERTA PÚBLICO de não-devolução de "${contract.equipmentName}". Devolva o equipamento para encerrar o alerta.`,
      });
      return true;
    } catch (e) {
      console.error('raisePublicAlert error:', e);
      return false;
    }
  },

  subscribeCommunityAlerts: (cb: (alerts: ReturnAlert[]) => void) => {
    const loadAlerts = async () => {
      const { data: rows } = await supabase.from('return_alerts').select('*').eq('status', 'active');
      const alerts: ReturnAlert[] = (rows || []).map((r: any) => ({
        id: r.id, contractId: r.contract_id,
        renterId: r.renter_id, renterName: r.renter_name, renterAvatar: r.renter_avatar,
        ownerId: r.owner_id, ownerName: r.owner_name,
        equipmentName: r.equipment_name, equipmentImage: r.equipment_image,
        agreedReturnDate: r.agreed_return_date, raisedAt: r.raised_at,
        status: r.status, resolvedAt: r.resolved_at,
      })).sort((a: any, b: any) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime());
      cb(alerts);
    };
    loadAlerts();

    const channel = supabase
      .channel('return_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'return_alerts' }, () => { loadAlerts(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  attachPaymentProof: async (contract: Contract, file: File, uploaderId: string): Promise<boolean> => {
    try {
      const isPdf = file.type === 'application/pdf';
      const blob: Blob = isPdf ? file : await processImageForWebP(file);
      const ext = isPdf ? 'pdf' : 'webp';
      const path = `${contract.id}/payment_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('contracts').upload(path, blob, {
        contentType: isPdf ? 'application/pdf' : 'image/webp',
      });
      if (uploadError) { console.error('Payment proof upload error:', uploadError); return false; }
      const { data: { publicUrl } } = supabase.storage.from('contracts').getPublicUrl(path);
      
      await supabase.from('contracts').update({
        payment_proof_url: publicUrl,
        payment_status: 'submitted',
        payment_submitted_by: uploaderId,
        payment_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', contract.id);
      return true;
    } catch (e) {
      console.error('attachPaymentProof error:', e);
      return false;
    }
  },

  confirmPayment: async (contractId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('contracts').update({
        payment_status: 'confirmed', updated_at: new Date().toISOString()
      }).eq('id', contractId);
      return !error;
    } catch (e) {
      console.error('confirmPayment error:', e);
      return false;
    }
  },
};
