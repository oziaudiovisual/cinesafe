import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { contractService } from '../services/contractService';
import { Contract, ContractStatus } from '../types';
import { Icons } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';
import { AdBanner } from '../components/AdBanner';
import { useAd } from '../hooks/useAd';

const STATUS_META: Record<ContractStatus, { label: string; cls: string }> = {
  proposed: { label: 'Proposta', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  active: { label: 'Ativo', cls: 'bg-accent-primary/20 text-accent-primary border-accent-primary/30' },
  completed: { label: 'Concluído', cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
  declined: { label: 'Recusado', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-brand-700 text-brand-300 border-white/10' },
};

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const day = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const paymentLabel = (s?: string) => (s === 'confirmed' ? 'Pagamento confirmado' : s === 'submitted' ? 'Comprovante enviado' : 'Pagamento pendente');
const paymentCls = (s?: string) => (s === 'confirmed' ? 'text-green-400' : s === 'submitted' ? 'text-blue-400' : 'text-amber-400');
const GRACE_MS = 48 * 60 * 60 * 1000; // prazo antes de poder emitir alerta público
const overdueDays = (c: Contract) => {
  if (c.type !== 'rental' || c.status !== 'active' || !c.returnDate) return 0;
  const diff = Date.now() - new Date(c.returnDate + 'T23:59:59').getTime();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
};
const graceOver = (c: Contract) => !!c.overdueNoticeAt && (Date.now() - new Date(c.overdueNoticeAt).getTime() >= GRACE_MS);

export const Contracts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; confirmLabel: string; isDestructive?: boolean; action: () => Promise<void> }>({ title: '', message: '', confirmLabel: '', action: async () => {} });
  const { ad } = useAd();

  useEffect(() => {
    if (!user) return;
    const unsub = contractService.subscribeUserContracts(user.id, setContracts);
    return () => unsub();
  }, [user]);

  if (!user) return null;

  // Deriva do estado ao vivo para o detalhe atualizar após anexar/confirmar pagamento.
  const detail = contracts.find(c => c.id === detailId) || null;

  const otherParty = (c: Contract) => (c.ownerId === user.id
    ? { name: c.counterpartyName, avatar: c.counterpartyAvatar }
    : { name: c.ownerName, avatar: c.ownerAvatar });
  const iAmOwner = (c: Contract) => c.ownerId === user.id;

  const ask = (title: string, message: string, confirmLabel: string, action: () => Promise<void>, isDestructive = false) => {
    setModalConfig({ title, message, confirmLabel, isDestructive, action });
    setModalOpen(true);
  };
  const runModal = async () => { setProcessing(true); await modalConfig.action(); setProcessing(false); setModalOpen(false); };

  const onAccept = (c: Contract) => ask(
    'Aceitar contrato',
    c.type === 'sale'
      ? `Ao aceitar, "${c.equipmentName}" passa para o seu inventário. Confirmar a compra por ${brl(c.value)}?`
      : `Confirmar o aluguel de "${c.equipmentName}" por ${brl(c.value)}?`,
    'Aceitar',
    async () => { await contractService.acceptContract(c); }
  );
  const onDecline = (c: Contract) => ask('Recusar contrato', `Recusar a proposta de "${c.equipmentName}"?`, 'Recusar', async () => { await contractService.closeContract(c, 'declined'); }, true);
  const onCancel = (c: Contract) => ask('Cancelar contrato', `Cancelar sua proposta de "${c.equipmentName}"?`, 'Cancelar proposta', async () => { await contractService.closeContract(c, 'cancelled'); }, true);
  const onComplete = (c: Contract) => ask('Concluir aluguel', `Marcar o aluguel de "${c.equipmentName}" como devolvido/concluído?`, 'Concluir', async () => { await contractService.completeRental(c); });
  const onNotifyOverdue = (c: Contract) => ask('Notificar atraso', `Avisar ${c.counterpartyName} de que "${c.equipmentName}" está atrasado? Ele terá um prazo (48h) para resolver antes de qualquer alerta público.`, 'Notificar', async () => { await contractService.sendOverdueNotice(c, user); });
  const onPublicAlert = (c: Contract) => ask('Emitir alerta público', `Isto torna PÚBLICO à comunidade que ${c.counterpartyName} não devolveu "${c.equipmentName}". É uma ação séria, visível a todos, e fica no perfil dele até a devolução. Confirmar?`, 'Emitir alerta', async () => { await contractService.raisePublicAlert(c, user); }, true);

  const pendingForMe = contracts.filter(c => c.status === 'proposed' && !iAmOwner(c));
  const sentByMe = contracts.filter(c => c.status === 'proposed' && iAmOwner(c));
  const active = contracts.filter(c => c.status === 'active');
  const history = contracts.filter(c => ['completed', 'declined', 'cancelled'].includes(c.status));

  const Card: React.FC<{ c: Contract }> = ({ c }) => {
    const other = otherParty(c);
    const st = STATUS_META[c.status];
    return (
      <div className="glass-card rounded-3xl border border-white/5 overflow-hidden">
        <div className="p-5 flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-black/40 overflow-hidden shrink-0 border border-white/5">
            {c.equipmentImage ? <img src={c.equipmentImage} alt={c.equipmentName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-600"><Icons.Camera className="w-6 h-6" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${c.type === 'sale' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-accent-primary/20 text-accent-primary border-accent-primary/30'}`}>{c.type === 'sale' ? 'Venda' : 'Aluguel'}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
            </div>
            <h3 className="text-white font-bold leading-tight truncate">{c.equipmentName}</h3>
            <p className="text-xs text-brand-400 mt-0.5">{iAmOwner(c) ? 'Com' : 'De'} {other.name} • <span className="text-white font-bold">{brl(c.value)}</span></p>
            {c.type === 'rental' && (
              <p className="text-xs text-brand-500 mt-1 flex items-center gap-1"><Icons.Calendar className="w-3 h-3" /> Retirada {day(c.pickupDate)} → Devolução {day(c.returnDate)}</p>
            )}
            {['proposed', 'active', 'completed'].includes(c.status) && (
              <p className="text-xs mt-1 flex items-center gap-1">
                <Icons.Banknote className="w-3 h-3 text-brand-500" />
                <span className={paymentCls(c.paymentStatus)}>{paymentLabel(c.paymentStatus)}</span>
              </p>
            )}
            {overdueDays(c) > 0 && (
              <p className="text-xs mt-1 flex items-center gap-1 text-red-400 font-bold">
                <Icons.AlertTriangle className="w-3 h-3" /> Atrasado há {overdueDays(c)} dia{overdueDays(c) > 1 ? 's' : ''}
                {c.publicAlert && <span className="text-red-500 uppercase ml-1">· Alerta público</span>}
              </p>
            )}
          </div>
        </div>
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          <button onClick={() => setDetailId(c.id)} className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2"><Icons.FileText className="w-3.5 h-3.5" /> Ver / Imprimir</button>
          {c.chatId && <button onClick={() => navigate('/chat', { state: { openChatId: c.chatId } })} className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2"><Icons.MessageCircle className="w-3.5 h-3.5" /> Conversa</button>}
          {c.status === 'proposed' && !iAmOwner(c) && (
            <>
              <button onClick={() => onAccept(c)} className="text-xs font-bold bg-accent-primary hover:bg-cyan-300 text-brand-950 px-3 py-2 rounded-lg flex items-center gap-2"><Icons.CheckCircle className="w-3.5 h-3.5" /> Aceitar</button>
              <button onClick={() => onDecline(c)} className="text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg border border-red-500/20">Recusar</button>
            </>
          )}
          {c.status === 'proposed' && iAmOwner(c) && (
            <button onClick={() => onCancel(c)} className="text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg border border-red-500/20">Cancelar proposta</button>
          )}
          {c.status === 'active' && c.type === 'rental' && iAmOwner(c) && (
            <button onClick={() => onComplete(c)} className="text-xs font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg flex items-center gap-2"><Icons.CheckCircle className="w-3.5 h-3.5" /> Marcar como devolvido</button>
          )}
          {c.status === 'active' && c.type === 'rental' && iAmOwner(c) && overdueDays(c) > 0 && !c.publicAlert && (
            !c.overdueNoticeAt ? (
              <button onClick={() => onNotifyOverdue(c)} className="text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-3 py-2 rounded-lg border border-amber-500/20 flex items-center gap-2"><Icons.AlertTriangle className="w-3.5 h-3.5" /> Notificar atraso</button>
            ) : graceOver(c) ? (
              <button onClick={() => onPublicAlert(c)} className="text-xs font-bold bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg flex items-center gap-2"><Icons.Siren className="w-3.5 h-3.5" /> Emitir alerta público</button>
            ) : (
              <span className="text-xs font-medium text-amber-400/80 px-2 py-2 flex items-center gap-1"><Icons.Clock className="w-3.5 h-3.5" /> Aviso enviado · aguardando prazo</span>
            )
          )}
        </div>
      </div>
    );
  };

  const Section: React.FC<{ title: string; list: Contract[]; hint?: string }> = ({ title, list, hint }) => (
    list.length === 0 ? null : (
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-brand-400 uppercase tracking-widest">{title} {hint && <span className="text-brand-600 normal-case font-medium">· {hint}</span>}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{list.map(c => <Card key={c.id} c={c} />)}</div>
      </div>
    )
  );

  return (
    <div className="space-y-8 pb-12">
      <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={runModal} onCancel={() => setModalOpen(false)} isProcessing={processing} confirmLabel={modalConfig.confirmLabel} isDestructive={modalConfig.isDestructive} />

      <header>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Icons.FileText className="w-8 h-8 text-accent-primary" /> Contratos</h1>
        <p className="text-brand-400 mt-1">Aluguéis e vendas fechados dentro do app, com registro para as duas partes.</p>
      </header>

      {ad && <div className="mb-6"><AdBanner ad={ad} /></div>}

      {contracts.length === 0 ? (
        <div className="glass-card p-12 rounded-[2.5rem] text-center border border-white/5">
          <Icons.FileText className="w-14 h-14 mx-auto mb-4 text-brand-700" />
          <p className="text-brand-300 font-bold mb-1">Nenhum contrato ainda.</p>
          <p className="text-brand-500 text-sm">Abra uma conversa em Mensagens e clique em <span className="text-white font-bold">Fechar negócio</span> para propor um aluguel ou venda.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Aguardando você" list={pendingForMe} hint="propostas para aceitar" />
          <Section title="Propostas enviadas" list={sentByMe} hint="aguardando a outra parte" />
          <Section title="Ativos" list={active} />
          <Section title="Histórico" list={history} />
        </div>
      )}

      {detail && <ContractDetail contract={detail} currentUserId={user.id} onClose={() => setDetailId(null)} />}
    </div>
  );
};

const ContractDetail: React.FC<{ contract: Contract; currentUserId: string; onClose: () => void }> = ({ contract: c, currentUserId, onClose }) => {
  const st = STATUS_META[c.status];
  const isReceiver = c.ownerId === currentUserId;     // dono do item recebe o pagamento
  const isPayer = c.counterpartyId === currentUserId; // locatário/comprador paga
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const canManagePayment = ['proposed', 'active', 'completed'].includes(c.status);

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await contractService.attachPaymentProof(c, file, currentUserId);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const handleConfirm = async () => { await contractService.confirmPayment(c.id); };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-brand-950/90 backdrop-blur-xl animate-fade-in" onClick={onClose}>
      <div className="glass-card max-w-lg w-full p-8 rounded-[2rem] relative border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-brand-400 hover:text-white print:hidden"><Icons.X className="w-6 h-6" /></button>
        <div id="contract-print" className="text-brand-100">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Contrato de {c.type === 'sale' ? 'Compra e Venda' : 'Aluguel'}</h2>
            <p className="text-xs text-brand-500 mt-1">Cine Safe • Nº {c.id.slice(0, 8).toUpperCase()}</p>
            <span className={`inline-block mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
          </div>

          <dl className="space-y-3 text-sm">
            <Row label="Equipamento" value={c.equipmentName} />
            <Row label={c.type === 'sale' ? 'Vendedor' : 'Locador'} value={c.ownerName} />
            <Row label={c.type === 'sale' ? 'Comprador' : 'Locatário'} value={c.counterpartyName} />
            <Row label="Valor" value={brl(c.value)} />
            {c.type === 'rental' && <Row label="Retirada" value={day(c.pickupDate)} />}
            {c.type === 'rental' && <Row label="Devolução" value={day(c.returnDate)} />}
            <Row label="Pagamento" value={paymentLabel(c.paymentStatus)} />
            <Row label="Criado em" value={new Date(c.createdAt).toLocaleString('pt-BR')} />
          </dl>

          <p className="text-[11px] text-brand-500 mt-6 leading-relaxed">
            Este documento registra o acordo entre as partes dentro da plataforma Cine Safe. {c.type === 'sale' ? 'A aceitação transfere a propriedade do equipamento ao comprador no sistema.' : 'O locatário se compromete a devolver o equipamento na data acordada.'}
          </p>
        </div>

        {/* Comprovante de pagamento (flexível: antes ou depois) */}
        {canManagePayment && (
          <div className="mt-6 pt-4 border-t border-white/10 print:hidden">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Icons.Banknote className="w-4 h-4 text-accent-primary" /> Comprovante de pagamento</h3>
            <p className="text-xs mb-3">
              <span className={paymentCls(c.paymentStatus)}>{paymentLabel(c.paymentStatus)}</span>
              {c.paymentAt && c.paymentStatus ? <span className="text-brand-500"> · {new Date(c.paymentAt).toLocaleDateString('pt-BR')}</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {c.paymentProofUrl && (
                <a href={c.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2"><Icons.FileText className="w-3.5 h-3.5" /> Ver comprovante</a>
              )}
              {isPayer && c.paymentStatus !== 'confirmed' && (
                <>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleAttach} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs font-bold bg-accent-primary hover:bg-cyan-300 text-brand-950 px-3 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                    {uploading ? 'Enviando...' : (c.paymentProofUrl ? 'Trocar comprovante' : 'Anexar comprovante')}
                  </button>
                </>
              )}
              {isReceiver && c.paymentStatus === 'submitted' && (
                <button onClick={handleConfirm} className="text-xs font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg flex items-center gap-2"><Icons.CheckCircle className="w-3.5 h-3.5" /> Confirmar recebimento</button>
              )}
            </div>
            {isPayer && <p className="text-[11px] text-brand-500 mt-2">Anexe o comprovante quando pagar {c.ownerName} — pode ser antes da retirada ou depois, como vocês combinarem.</p>}
            {isReceiver && c.paymentStatus === 'submitted' && <p className="text-[11px] text-brand-500 mt-2">Confira o comprovante enviado e confirme o recebimento.</p>}
          </div>
        )}

        <button onClick={() => window.print()} className="w-full mt-6 bg-accent-primary hover:bg-cyan-300 text-brand-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 print:hidden">
          <Icons.FileText className="w-4 h-4" /> Imprimir / Salvar PDF
        </button>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
    <dt className="text-brand-400">{label}</dt>
    <dd className="text-white font-bold text-right">{value}</dd>
  </div>
);
