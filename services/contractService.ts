import { db, storage } from './firebase';
import {
  collection, doc, setDoc, updateDoc,
  query, where, onSnapshot
} from 'firebase/firestore';
import { Contract, EquipmentStatus, Equipment, User } from '../types';
import { equipmentService } from './equipmentService';
import { processImageForWebP, resilientUpload } from '../utils/imageProcessor';

interface CreateContractInput {
  type: 'rental' | 'sale';
  owner: User;                 // dono do equipamento (cria)
  counterparty: { id: string; name: string; avatarUrl: string };
  equipment: Equipment;
  value: number;
  pickupDate?: string;
  returnDate?: string;
  chatId?: string;
}

export const contractService = {
  // O dono cria a proposta. Para VENDA, marca o item como TRANSFER_PENDING para o
  // comprador (o status != SAFE já o remove do marketplace). O item só troca de
  // dono quando o comprador ACEITA.
  createContract: async (input: CreateContractInput): Promise<string | null> => {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const contract: Contract = {
        id,
        type: input.type,
        status: 'proposed',
        parties: [input.owner.id, input.counterparty.id],
        ownerId: input.owner.id,
        ownerName: input.owner.name,
        ownerAvatar: input.owner.avatarUrl,
        counterpartyId: input.counterparty.id,
        counterpartyName: input.counterparty.name,
        counterpartyAvatar: input.counterparty.avatarUrl,
        equipmentId: input.equipment.id,
        equipmentName: input.equipment.name,
        equipmentImage: input.equipment.imageUrl,
        value: input.value,
        ...(input.type === 'rental' ? { pickupDate: input.pickupDate, returnDate: input.returnDate } : {}),
        ...(input.chatId ? { chatId: input.chatId } : {}),
        createdAt: now,
        updatedAt: now,
      };
      // Remove undefined (o Firestore rejeita o doc inteiro com undefined)
      const clean = Object.fromEntries(Object.entries(contract).filter(([, v]) => v !== undefined)) as Contract;
      await setDoc(doc(db, 'contracts', id), clean);

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
    const q = query(collection(db, 'contracts'), where('parties', 'array-contains', userId));
    return onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => d.data() as Contract)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      cb(list);
    }, () => cb([]));
  },

  // Aceite pelo counterparty. VENDA -> transfere a posse (o comprador vira dono).
  acceptContract: async (contract: Contract): Promise<boolean> => {
    try {
      if (contract.type === 'sale') {
        const ok = await equipmentService.transferEquipmentOwnership(
          contract.equipmentId, contract.counterpartyId, contract.value
        );
        if (!ok) return false;
        await updateDoc(doc(db, 'contracts', contract.id), { status: 'completed', updatedAt: new Date().toISOString() });
      } else {
        await updateDoc(doc(db, 'contracts', contract.id), { status: 'active', updatedAt: new Date().toISOString() });
      }
      return true;
    } catch (e) {
      console.error('acceptContract error:', e);
      return false;
    }
  },

  // Recusa (counterparty) ou cancelamento (dono) de uma proposta. Na venda, devolve
  // o item ao marketplace (status SAFE).
  closeContract: async (contract: Contract, status: 'declined' | 'cancelled'): Promise<boolean> => {
    try {
      if (contract.type === 'sale') {
        await equipmentService.cancelTransfer(contract.equipmentId);
      }
      await updateDoc(doc(db, 'contracts', contract.id), { status, updatedAt: new Date().toISOString() });
      return true;
    } catch (e) {
      console.error('closeContract error:', e);
      return false;
    }
  },

  // Aluguel ativo -> marca como concluído (equipamento devolvido).
  completeRental: async (contract: Contract): Promise<boolean> => {
    try {
      await updateDoc(doc(db, 'contracts', contract.id), { status: 'completed', updatedAt: new Date().toISOString() });
      return true;
    } catch (e) {
      console.error('completeRental error:', e);
      return false;
    }
  },

  // Quem paga anexa o comprovante (imagem ou PDF). Pode ser antes ou depois.
  attachPaymentProof: async (contract: Contract, file: File, uploaderId: string): Promise<boolean> => {
    try {
      const isPdf = file.type === 'application/pdf';
      const blob: Blob = isPdf ? file : await processImageForWebP(file);
      const ext = isPdf ? 'pdf' : 'webp';
      const path = `contracts/${contract.id}/payment_${Date.now()}.${ext}`;
      const url = await resilientUpload(storage.ref(path), blob);
      if (!url) return false;
      await updateDoc(doc(db, 'contracts', contract.id), {
        paymentProofUrl: url,
        paymentStatus: 'submitted',
        paymentSubmittedBy: uploaderId,
        paymentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (e) {
      console.error('attachPaymentProof error:', e);
      return false;
    }
  },

  // Quem recebe confirma o pagamento.
  confirmPayment: async (contractId: string): Promise<boolean> => {
    try {
      await updateDoc(doc(db, 'contracts', contractId), { paymentStatus: 'confirmed', updatedAt: new Date().toISOString() });
      return true;
    } catch (e) {
      console.error('confirmPayment error:', e);
      return false;
    }
  },
};
