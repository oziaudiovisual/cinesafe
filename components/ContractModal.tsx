import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { equipmentService } from '../services/equipmentService';
import { contractService } from '../services/contractService';
import { Equipment, EquipmentStatus, User, ContractType } from '../types';
import { Icons } from '../components/Icons';
import { CurrencyInput } from '../components/CurrencyInput';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  owner: User;
  counterparty: { id: string; name: string; avatarUrl: string };
  chatId?: string;
  onCreated?: (summary: string) => void;
}

export const ContractModal: React.FC<ContractModalProps> = ({ isOpen, onClose, owner, counterparty, chatId, onCreated }) => {
  const [items, setItems] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [type, setType] = useState<ContractType>('rental');
  const [value, setValue] = useState<number>(0);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    equipmentService.getUserEquipment(owner.id).then(list => {
      setItems(list.filter(e => e.status === EquipmentStatus.SAFE));
    });
    // reset
    setEquipmentId(''); setType('rental'); setValue(0); setPickupDate(''); setReturnDate(''); setError('');
  }, [isOpen, owner.id]);

  if (!isOpen) return null;

  const selected = items.find(i => i.id === equipmentId);

  const handleSubmit = async () => {
    setError('');
    if (!selected) { setError('Selecione um equipamento.'); return; }
    if (!value || value <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (type === 'rental') {
      if (!pickupDate || !returnDate) { setError('Informe as datas de retirada e devolução.'); return; }
      if (new Date(returnDate) < new Date(pickupDate)) { setError('A devolução não pode ser antes da retirada.'); return; }
    }
    setSaving(true);
    const id = await contractService.createContract({
      type, owner, counterparty, equipment: selected, value,
      pickupDate: type === 'rental' ? pickupDate : undefined,
      returnDate: type === 'rental' ? returnDate : undefined,
      chatId,
    });
    setSaving(false);
    if (!id) { setError('Não foi possível criar o contrato. Tente novamente.'); return; }
    if (onCreated) {
      const money = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      onCreated(
        type === 'rental'
          ? `📄 Proposta de ALUGUEL de "${selected.name}" — ${money} • retirada ${new Date(pickupDate).toLocaleDateString('pt-BR')}, devolução ${new Date(returnDate).toLocaleDateString('pt-BR')}. Veja em Contratos.`
          : `📄 Proposta de VENDA de "${selected.name}" — ${money}. Aceite em Contratos para receber o equipamento.`
      );
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-brand-950/90 backdrop-blur-xl animate-fade-in">
      <div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] relative border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 text-brand-400 hover:text-white"><Icons.X className="w-6 h-6" /></button>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-accent-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-accent-primary"><Icons.FileText className="w-8 h-8" /></div>
          <h3 className="text-2xl font-bold text-white">Fechar negócio</h3>
          <p className="text-brand-400 text-sm mt-2">Contrato com <span className="text-white font-bold">{counterparty.name}</span></p>
        </div>

        <div className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setType('rental')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${type === 'rental' ? 'bg-accent-primary text-brand-950 border-accent-primary' : 'bg-brand-900 text-brand-400 border-white/10'}`}>Aluguel</button>
              <button onClick={() => setType('sale')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${type === 'sale' ? 'bg-green-500 text-white border-green-500' : 'bg-brand-900 text-brand-400 border-white/10'}`}>Venda</button>
            </div>
          </div>

          {/* Equipamento */}
          <div>
            <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Equipamento (do seu inventário)</label>
            <select className="w-full glass-input rounded-xl p-3" value={equipmentId} onChange={e => setEquipmentId(e.target.value)}>
              <option value="">Selecione...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            {items.length === 0 && <p className="text-xs text-brand-500 mt-1">Você não tem itens disponíveis no inventário.</p>}
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-bold text-brand-400 uppercase mb-2">{type === 'rental' ? 'Valor total do aluguel (R$)' : 'Valor de venda (R$)'}</label>
            <CurrencyInput className="w-full glass-input rounded-xl p-3" placeholder="0,00" value={value} onValueChange={setValue} />
          </div>

          {/* Datas (aluguel) */}
          {type === 'rental' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Retirada</label>
                <input type="date" className="w-full glass-input rounded-xl p-3" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Devolução</label>
                <input type="date" className="w-full glass-input rounded-xl p-3" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-xs font-bold flex items-center gap-2"><Icons.AlertTriangle className="w-3 h-3" /> {error}</p>}

          <button onClick={handleSubmit} disabled={saving} className="w-full bg-accent-primary hover:bg-cyan-300 text-brand-950 font-bold py-4 rounded-xl mt-2 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-brand-950 border-t-transparent rounded-full animate-spin" />}
            Enviar proposta
          </button>
          <p className="text-[11px] text-brand-500 text-center">A outra pessoa precisa aceitar para o contrato valer{type === 'sale' ? '. Ao aceitar, o equipamento passa para o inventário dela.' : '.'}</p>
        </div>
      </div>
    </div>,
    document.body
  );
};
