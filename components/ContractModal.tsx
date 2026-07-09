import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { equipmentService } from '../services/equipmentService';
import { contractService } from '../services/contractService';
import { Equipment, EquipmentStatus, User, ContractType, PaymentTiming } from '../types';
import { Icons } from '../components/Icons';
import { CurrencyInput } from '../components/CurrencyInput';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  owner: User;
  counterparty: { id: string; name: string; avatarUrl: string };
  chatId?: string;
  onCreated?: (summary: string, contractId: string) => void;
}

export const ContractModal: React.FC<ContractModalProps> = ({ isOpen, onClose, owner, counterparty, chatId, onCreated }) => {
  const [items, setItems] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [type, setType] = useState<ContractType>('rental');
  const [value, setValue] = useState<number>(0);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>('antecipado');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const PIX_STORAGE_KEY = `cinesafe_pix_${owner.id}`;

  useEffect(() => {
    if (!isOpen) return;
    equipmentService.getUserEquipment(owner.id).then(list => {
      setItems(list.filter(e => e.status === EquipmentStatus.SAFE));
    });
    // reset
    setEquipmentId(''); setType('rental'); setValue(0);
    setPickupDate(''); setPickupTime(''); setReturnDate(''); setReturnTime('');
    setPaymentTiming('antecipado'); setPaymentDueDate('');
    setError('');
    // Prefill da chave PIX (lembrada neste dispositivo p/ não redigitar toda vez).
    let savedPix = '';
    try { savedPix = localStorage.getItem(PIX_STORAGE_KEY) || ''; } catch { /* ignore */ }
    setPixKey(savedPix);
  }, [isOpen, owner.id]);

  if (!isOpen) return null;

  const selected = items.find(i => i.id === equipmentId);

  const handleSubmit = async () => {
    setError('');
    if (!selected) { setError('Selecione um equipamento.'); return; }
    if (!value || value <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (type === 'rental') {
      if (!pickupDate || !returnDate) { setError('Informe as datas de retirada e devolução.'); return; }
      if (!pickupTime || !returnTime) { setError('Informe os horários de retirada e devolução.'); return; }
      if (new Date(`${returnDate}T${returnTime}`) < new Date(`${pickupDate}T${pickupTime}`)) { setError('A devolução não pode ser antes da retirada.'); return; }
      if (paymentTiming === 'data' && !paymentDueDate) { setError('Informe a data combinada para o pagamento.'); return; }
      if (!pixKey.trim()) { setError('Informe sua chave PIX para o locatário poder pagar.'); return; }
    }
    setSaving(true);
    const id = await contractService.createContract({
      type, owner, counterparty, equipment: selected, value,
      pickupDate: type === 'rental' ? pickupDate : undefined,
      pickupTime: type === 'rental' ? pickupTime : undefined,
      returnDate: type === 'rental' ? returnDate : undefined,
      returnTime: type === 'rental' ? returnTime : undefined,
      paymentTiming: type === 'rental' ? paymentTiming : undefined,
      paymentDueDate: type === 'rental' && paymentTiming === 'data' ? paymentDueDate : undefined,
      pixKey: pixKey.trim() || undefined,
      chatId,
    });
    setSaving(false);
    if (!id) { setError('Não foi possível criar o contrato. Tente novamente.'); return; }
    try { if (pixKey.trim()) localStorage.setItem(PIX_STORAGE_KEY, pixKey.trim()); } catch { /* ignore */ }
    if (onCreated) {
      const money = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      onCreated(
        type === 'rental'
          ? `📄 Proposta de ALUGUEL de "${selected.name}" — ${money} • retirada ${new Date(pickupDate).toLocaleDateString('pt-BR')}, devolução ${new Date(returnDate).toLocaleDateString('pt-BR')}.`
          : `📄 Proposta de VENDA de "${selected.name}" — ${money}.`,
        id
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

          {/* Datas e horários (aluguel) */}
          {type === 'rental' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Retirada</label>
                  <input type="date" className="w-full glass-input rounded-xl p-3 mb-2" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
                  <input type="time" className="w-full glass-input rounded-xl p-3" value={pickupTime} onChange={e => setPickupTime(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Devolução</label>
                  <input type="date" className="w-full glass-input rounded-xl p-3 mb-2" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                  <input type="time" className="w-full glass-input rounded-xl p-3" value={returnTime} onChange={e => setReturnTime(e.target.value)} />
                </div>
              </div>

              {/* Combinação de pagamento */}
              <div>
                <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Quando o locatário paga</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { k: 'antecipado', label: 'Antecipado' },
                    { k: 'na_retirada', label: 'Na retirada' },
                    { k: 'na_devolucao', label: 'Na devolução' },
                    { k: 'data', label: 'Em data combinada' },
                  ] as { k: PaymentTiming; label: string }[]).map(opt => (
                    <button key={opt.k} type="button" onClick={() => setPaymentTiming(opt.k)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${paymentTiming === opt.k ? 'bg-accent-primary text-brand-950 border-accent-primary' : 'bg-brand-900 text-brand-400 border-white/10'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {paymentTiming === 'data' && (
                  <input type="date" className="w-full glass-input rounded-xl p-3 mt-2" value={paymentDueDate} onChange={e => setPaymentDueDate(e.target.value)} />
                )}
                <p className="text-[11px] text-brand-500 mt-1.5">Ex.: devolver amanhã mas pagar só semana que vem → escolha "Em data combinada".</p>
              </div>
            </>
          )}

          {/* Chave PIX do recebedor */}
          <div>
            <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Sua chave PIX {type === 'sale' && <span className="lowercase font-medium text-brand-500">(opcional)</span>}</label>
            <input type="text" className="w-full glass-input rounded-xl p-3" placeholder="CPF, e-mail, telefone ou chave aleatória" value={pixKey} onChange={e => setPixKey(e.target.value)} />
            <p className="text-[11px] text-brand-500 mt-1.5">{type === 'rental' ? 'O locatário usa essa chave para te pagar via PIX.' : 'Opcional — para o comprador te pagar via PIX.'}</p>
          </div>

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
