import React, { useEffect, useState, useRef, useCallback } from 'react';
import { userService } from '../services/userService';
import { adService } from '../services/adService';
import { contractService } from '../services/contractService';
import { raffleService } from '../services/raffleService';
import { User, Ad, Contract, Equipment, Raffle, RaffleTicket } from '../types';
import { Icons } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { createPortal } from 'react-dom';

const generateUUID = () => crypto.randomUUID();
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TX_STATUS: Record<string, { label: string; cls: string }> = {
  proposed: { label: 'Proposta', cls: 'bg-amber-500/20 text-amber-300' },
  active: { label: 'Ativo', cls: 'bg-accent-primary/20 text-accent-primary' },
  completed: { label: 'Concluído', cls: 'bg-green-500/20 text-green-300' },
  declined: { label: 'Recusado', cls: 'bg-red-500/20 text-red-300' },
  cancelled: { label: 'Cancelado', cls: 'bg-brand-700 text-brand-300' },
};

export const AdminDashboard: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'ads' | 'transactions' | 'incidents' | 'raffles'>('users');
    const [loading, setLoading] = useState(true);
    const [globalStats, setGlobalStats] = useState({ users: 0, equipment: 0, stolen: 0, value: 0, transactions: 0 });
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [stolen, setStolen] = useState<Equipment[]>([]);
    const [recovered, setRecovered] = useState<any[]>([]);
    const [txFrom, setTxFrom] = useState('');
    const [txTo, setTxTo] = useState('');
    const [txSearch, setTxSearch] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [ads, setAds] = useState<Ad[]>([]);
    const [userFilter, setUserFilter] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedUserStats, setSelectedUserStats] = useState<{total: number, value: number, forRent: number, forSale: number, stolen: number} | null>(null);
    const [loadingUserStats, setLoadingUserStats] = useState(false);
    const [isAddingAd, setIsAddingAd] = useState(false);
    const [editingAdId, setEditingAdId] = useState<string | null>(null);
    const [adForm, setAdForm] = useState<Partial<Ad>>({ advertiserName: 'Cine Safe', tagline: 'OFERTA ESPECIAL', title: '', buttonText: 'Conferir', weight: 5, active: true });
    const [adImageFile, setAdImageFile] = useState<File | null>(null);
    const [adImagePreview, setAdImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAdFormValid, setIsAdFormValid] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalProcessing, setModalProcessing] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; isDestructive: boolean; confirmLabel: string; }>({ title: '', message: '', action: async () => {}, isDestructive: false, confirmLabel: '' });

    // --- Sorteios state ---
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [isAddingRaffle, setIsAddingRaffle] = useState(false);
    const [editingRaffleId, setEditingRaffleId] = useState<string | null>(null);
    const [raffleForm, setRaffleForm] = useState<Partial<Raffle>>({ title: '', description: '', status: 'draft' });
    const [raffleImageFile, setRaffleImageFile] = useState<File | null>(null);
    const [raffleImagePreview, setRaffleImagePreview] = useState<string | null>(null);
    const raffleFileInputRef = useRef<HTMLInputElement>(null);
    const [selectedRaffleDetail, setSelectedRaffleDetail] = useState<Raffle | null>(null);
    const [raffleTickets, setRaffleTickets] = useState<RaffleTicket[]>([]);
    const [raffleLeaderboard, setRaffleLeaderboard] = useState<{ userId: string; userName: string; userAvatar: string; ticketCount: number }[]>([]);
    // Roleta animada
    const [isDrawing, setIsDrawing] = useState(false);
    const [rouletteNames, setRouletteNames] = useState<string[]>([]);
    const [rouletteIndex, setRouletteIndex] = useState(0);
    const [drawnWinner, setDrawnWinner] = useState<{ winnerId: string; winnerName: string } | null>(null);

    useEffect(() => { loadData(); loadRaffles(); }, []);
    const loadRaffles = async () => { const r = await raffleService.getAllRaffles(); setRaffles(r); };
    useEffect(() => { const { title, buttonText, startDate, endDate } = adForm; const hasRequiredText = title && buttonText && startDate && endDate; const hasImage = !!adImagePreview; setIsAdFormValid(!!hasRequiredText && hasImage); }, [adForm, adImagePreview]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allUsers, allAds, detailed, allContracts, stolenResult, recoveredResult, usersCountResult] = await Promise.all([
                userService.getAllUsers(),
                adService.getAllAds(),
                userService.getGlobalDetailedStats(),
                contractService.getAllContracts(),
                supabase.from('equipment').select('*').eq('status', 'STOLEN'),
                supabase.from('theft_history').select('*').order('recovery_date', { ascending: false }),
                supabase.from('users').select('*', { count: 'exact', head: true }),
            ]);
            const usersCount = usersCountResult.count || 0;
            setUsers(allUsers);
            setAds(allAds);
            setGlobalStats({ users: usersCount, equipment: detailed.totalItems, stolen: detailed.stolenItems, value: detailed.totalValue, transactions: detailed.transactionsCount || 0 });
            setContracts(allContracts);
            setStolen((stolenResult.data || []).map((d: any) => ({ id: d.id, ownerId: d.owner_id, name: d.name, brand: d.brand, model: d.model, serialNumber: d.serial_number, category: d.category, status: d.status, value: d.value, isForRent: d.is_for_rent, isForSale: d.is_for_sale, imageUrl: d.image_url, purchaseDate: d.purchase_date, theftLocation: d.theft_location, theftDate: d.theft_date, theftAddress: d.theft_address, ownerProfile: d.owner_profile } as Equipment)));
            setRecovered((recoveredResult.data || []).sort((a: any, b: any) => new Date(b.recovery_date || 0).getTime() - new Date(a.recovery_date || 0).getTime()));
        } catch (error) { console.error("Falha ao carregar dados do painel:", error); }
        finally { setLoading(false); }
    };

    const handleCorsError = () => {
        setModalConfig({ title: "Falha de Upload: Ação Necessária", message: "O envio do arquivo foi bloqueado por uma política de segurança (CORS). Esta é uma configuração do lado do servidor que precisa ser ajustada no projeto Google Cloud.", isDestructive: true, confirmLabel: "Entendi", action: async () => setModalOpen(false) });
        setModalOpen(true);
    };

    const handleUserClick = async (user: User) => { setSelectedUser(user); setLoadingUserStats(true); const stats = await userService.getStats(user.id); setSelectedUserStats(stats); setLoadingUserStats(false); };
    const closeUserModal = () => { setSelectedUser(null); setSelectedUserStats(null); };
    const handleModalConfirm = async () => { setModalProcessing(true); await modalConfig.action(); setModalProcessing(false); };
    const handleDeleteUser = (targetUser: User, e: React.MouseEvent) => { e.stopPropagation(); setModalConfig({ title: "Excluir Usuário", message: `Tem certeza que deseja excluir ${targetUser.name} e todos os seus equipamentos?`, isDestructive: true, confirmLabel: "Excluir Usuário", action: async () => { await userService.deleteUser(targetUser.id); await loadData(); setModalOpen(false); if (selectedUser?.id === targetUser.id) closeUserModal(); } }); setModalOpen(true); };
    const handleToggleRole = (targetUser: User, e: React.MouseEvent) => { e.stopPropagation(); const newRole = targetUser.role === 'admin' ? 'user' : 'admin'; setModalConfig({ title: "Alterar Permissão", message: `Deseja alterar o cargo de ${targetUser.name} para ${newRole.toUpperCase()}?`, isDestructive: false, confirmLabel: "Confirmar", action: async () => { await userService.toggleUserRole(targetUser.id, newRole); await loadData(); setModalOpen(false); } }); setModalOpen(true); };
    const handleBlockUser = (targetUser: User, e: React.MouseEvent) => { e.stopPropagation(); const action = targetUser.isBlocked ? 'Desbloquear' : 'Bloquear'; setModalConfig({ title: `${action} Usuário`, message: `Tem certeza que deseja ${action.toLowerCase()} o acesso de ${targetUser.name}?`, isDestructive: !targetUser.isBlocked, confirmLabel: action, action: async () => { await userService.toggleUserBlock(targetUser.id, targetUser.isBlocked || false); await loadData(); setModalOpen(false); } }); setModalOpen(true); };
    const handleAdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; setAdImageFile(file); const reader = new FileReader(); reader.onload = () => setAdImagePreview(reader.result as string); reader.readAsDataURL(file); } };
    const resetAdForm = () => { setIsAddingAd(false); setEditingAdId(null); setAdForm({ weight: 5, active: true, tagline: 'OFERTA ESPECIAL', title: '', buttonText: 'Conferir' }); setAdImageFile(null); setAdImagePreview(null); };
    
    const handleSaveAd = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); let imageUrl = adImagePreview;
        try { if (adImageFile) imageUrl = await adService.uploadAdImage(adImageFile); } 
        catch (e: any) { if (e.message === 'CORS_CONFIG_ERROR') handleCorsError(); else alert("Ocorreu um erro desconhecido durante o upload."); setLoading(false); return; }
        if (!imageUrl) { alert("A imagem do produto é obrigatória."); setLoading(false); return; }
        try {
            const dataToSave: Partial<Ad> = { id: editingAdId || generateUUID(), title: adForm.title!, buttonText: adForm.buttonText!, imageUrl: imageUrl, advertiserName: adForm.advertiserName || 'Cine Safe', startDate: adForm.startDate!, endDate: adForm.endDate!, weight: adForm.weight || 1, active: adForm.active !== undefined ? adForm.active : true, impressions: adForm.impressions || 0, clicks: adForm.clicks || 0, };
            if (adForm.linkUrl) dataToSave.linkUrl = adForm.linkUrl; if (adForm.tagline) dataToSave.tagline = adForm.tagline; if (adForm.priceOld) dataToSave.priceOld = adForm.priceOld; if (adForm.priceNew) dataToSave.priceNew = adForm.priceNew;
            if (editingAdId) await adService.updateAd(dataToSave as Ad);
            else await adService.createAd(dataToSave as Ad);
            resetAdForm(); await loadData();
        } catch (error) { console.error("Falha ao salvar anúncio:", error); alert("Ocorreu um erro ao salvar o anúncio."); } 
        finally { setLoading(false); }
    };
    
    const handleEditAd = (ad: Ad) => { setAdForm(ad); setAdImagePreview(ad.imageUrl); setEditingAdId(ad.id); setIsAddingAd(true); };
    const handleDeleteAd = (ad: Ad) => { setModalConfig({ title: "Excluir Anúncio", message: "Tem certeza que deseja excluir esta campanha?", isDestructive: true, confirmLabel: "Excluir Anúncio", action: async () => { await adService.deleteAd(ad.id); await loadData(); setModalOpen(false); } }); setModalOpen(true); };

    const sortedUsers = [...users].filter(u => u.name.toLowerCase().includes(userFilter.toLowerCase()) || u.email.toLowerCase().includes(userFilter.toLowerCase())).sort((a, b) => (b.reputationPoints || 0) - (a.reputationPoints || 0));
    const emailById: Record<string, string> = {};
    users.forEach(u => { emailById[u.id] = u.email || ''; });
    const txQuery = txSearch.trim().toLowerCase();
    const filteredTx = contracts.filter(c => {
        if (txFrom && c.createdAt.slice(0, 10) < txFrom) return false;
        if (txTo && c.createdAt.slice(0, 10) > txTo) return false;
        if (!txQuery) return true;
        return [c.ownerName, c.counterpartyName, emailById[c.ownerId], emailById[c.counterpartyId]]
            .some(v => (v || '').toLowerCase().includes(txQuery));
    });
    const filteredTxTotal = filteredTx.reduce((s, c) => s + (Number(c.value) || 0), 0);

    return (
        <div className="space-y-8 pb-12">
            <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} isDestructive={modalConfig.isDestructive} confirmLabel={modalConfig.confirmLabel} />
            <header className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Icons.Lock className="w-8 h-8 text-accent-warning" /> Painel Admin
                </h1>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Usuários Totais" value={globalStats.users.toString()} icon={Icons.Users} color="text-blue-400" />
                <StatCard label="Equipamentos" value={globalStats.equipment.toString()} icon={Icons.Camera} color="text-accent-primary" />
                <StatCard label="Transações" value={globalStats.transactions.toString()} icon={Icons.ShoppingBag} color="text-accent-secondary" />
                <StatCard label="Itens Roubados" value={globalStats.stolen.toString()} icon={Icons.ShieldAlert} color="text-red-500" />
                <StatCard label="Valor Protegido" value={globalStats.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })} icon={Icons.Banknote} color="text-green-400" />
            </div>

            <div className="flex gap-4 border-b border-white/10 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('users')} className={`px-6 py-3 font-bold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'users' ? 'text-white' : 'text-brand-400 hover:text-white'}`}>
                    Usuários
                    {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-1 bg-accent-primary rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('transactions')} className={`px-6 py-3 font-bold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'transactions' ? 'text-white' : 'text-brand-400 hover:text-white'}`}>
                    Transações
                    {activeTab === 'transactions' && <div className="absolute bottom-0 left-0 w-full h-1 bg-accent-secondary rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('incidents')} className={`px-6 py-3 font-bold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'incidents' ? 'text-white' : 'text-brand-400 hover:text-white'}`}>
                    Roubos & Recuperações
                    {activeTab === 'incidents' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-500 rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('ads')} className={`px-6 py-3 font-bold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'ads' ? 'text-white' : 'text-brand-400 hover:text-white'}`}>
                    Anúncios
                    {activeTab === 'ads' && <div className="absolute bottom-0 left-0 w-full h-1 bg-accent-gold rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('raffles')} className={`px-6 py-3 font-bold text-sm transition-colors relative whitespace-nowrap ${activeTab === 'raffles' ? 'text-white' : 'text-brand-400 hover:text-white'}`}>
                    🎯 Sorteios
                    {activeTab === 'raffles' && <div className="absolute bottom-0 left-0 w-full h-1 bg-green-500 rounded-t-full"></div>}
                </button>
            </div>

            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="relative group">
                        <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                        <input type="text" className="w-full glass-input rounded-xl py-3 pl-12 pr-4 text-white" placeholder="Buscar usuário por nome ou email..." value={userFilter} onChange={e => setUserFilter(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedUsers.map(u => (
                            <div key={u.id} onClick={() => handleUserClick(u)} className={`glass-card p-6 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${u.isBlocked ? 'border-red-500/30 opacity-75 grayscale' : 'border-white/5 hover:border-accent-primary/30'}`}>
                                {u.isBlocked && <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase">Bloqueado</div>}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-brand-800 overflow-hidden border-2 border-brand-600">
                                        <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold truncate max-w-[150px]">{u.name}</h3>
                                        <p className="text-xs text-brand-400 truncate max-w-[150px]">{u.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-brand-700 text-brand-400'}`}>{u.role.toUpperCase()}</span>
                                            {u.isVerified && <Icons.CheckCircle className="w-3 h-3 text-blue-500" />}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center py-3 border-t border-b border-white/5 mb-4">
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-white">{u.reputationPoints}</p>
                                        <p className="text-[10px] text-brand-500 uppercase font-bold">XP</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-white">{u.inventoryCount || 0}</p>
                                        <p className="text-[10px] text-brand-500 uppercase font-bold">Itens</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-white">{u.reportsCount || 0}</p>
                                        <p className="text-[10px] text-brand-500 uppercase font-bold">Reports</p>
                                    </div>
                                </div>

                                <div className="flex justify-between gap-2">
                                    <button onClick={(e) => handleToggleRole(u, e)} className="flex-1 py-2 bg-brand-800 hover:bg-brand-700 text-xs font-bold rounded-lg transition-colors border border-white/5">{u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}</button>
                                    <button onClick={(e) => handleBlockUser(u, e)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors border ${u.isBlocked ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}>{u.isBlocked ? 'Desbloquear' : 'Bloquear'}</button>
                                    <button onClick={(e) => handleDeleteUser(u, e)} className="p-2 text-brand-500 hover:text-red-500 transition-colors"><Icons.Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'ads' && (
                <div className="space-y-8">
                    {!isAddingAd ? (
                        <button onClick={() => setIsAddingAd(true)} className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-brand-400 font-bold hover:border-accent-secondary hover:text-accent-secondary transition-all flex items-center justify-center gap-2">
                            <Icons.Plus className="w-5 h-5" /> Criar Nova Campanha
                        </button>
                    ) : (
                        <div className="glass-card p-8 rounded-3xl border border-white/10">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">{editingAdId ? 'Editar Anúncio' : 'Novo Anúncio'}</h2>
                                <button onClick={resetAdForm} className="text-brand-400 hover:text-white"><Icons.X /></button>
                            </div>
                            
                            <form onSubmit={handleSaveAd} className="space-y-6">
                                <div className="flex flex-col md:flex-row gap-8">
                                    <div className="w-full md:w-1/3">
                                        <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Imagem do Produto (WebP com fundo)</label>
                                        <div className="aspect-[4/3] bg-black/30 rounded-2xl border-2 border-dashed border-brand-700 flex flex-col items-center justify-center cursor-pointer hover:border-accent-secondary/50 transition-colors relative overflow-hidden group" onClick={() => fileInputRef.current?.click()}>
                                            {adImagePreview ? (
                                                <img src={adImagePreview} alt="Preview" className="w-full h-full object-contain p-4" />
                                            ) : (
                                                <div className="text-center p-4">
                                                    <Icons.Image className="w-10 h-10 text-brand-600 mx-auto mb-2" />
                                                    <span className="text-sm text-brand-500">Clique para upload (600px de altura)</span>
                                                </div>
                                            )}
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/webp,image/png,image/jpeg" onChange={handleAdFileChange} />
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Tag (Ex: BLACK MONTH)</label><input type="text" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.tagline || ''} onChange={e => setAdForm({...adForm, tagline: e.target.value})} /></div>
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Anunciante (Interno)</label><input type="text" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.advertiserName} onChange={e => setAdForm({...adForm, advertiserName: e.target.value})} /></div>
                                        </div>
                                        <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Título Principal</label><input type="text" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.title} onChange={e => setAdForm({...adForm, title: e.target.value})} placeholder="Ex: Sony Alpha 7 IV" /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Preço Antigo (Opcional)</label><input type="text" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.priceOld || ''} onChange={e => setAdForm({...adForm, priceOld: e.target.value})} placeholder="R$ 16.990" /></div>
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Preço Novo (Opcional)</label><input type="text" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.priceNew || ''} onChange={e => setAdForm({...adForm, priceNew: e.target.value})} placeholder="R$ 13.997" /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Texto do Botão</label><input type="text" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.buttonText} onChange={e => setAdForm({...adForm, buttonText: e.target.value})} /></div>
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Link de Destino</label><input type="url" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.linkUrl || ''} onChange={e => setAdForm({...adForm, linkUrl: e.target.value})} placeholder="https://..." /></div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Peso (1-10)</label><input type="number" min="1" max="10" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.weight} onChange={e => setAdForm({...adForm, weight: Number(e.target.value)})} /></div>
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Início</label><input type="date" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.startDate} onChange={e => setAdForm({...adForm, startDate: e.target.value})} /></div>
                                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Fim</label><input type="date" className="w-full glass-input rounded-xl p-3 mt-1" value={adForm.endDate} onChange={e => setAdForm({...adForm, endDate: e.target.value})} /></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
                                    <button type="button" onClick={resetAdForm} className="px-6 py-3 rounded-xl font-bold text-brand-400 hover:text-white transition-colors">Cancelar</button>
                                    <button type="submit" disabled={!isAdFormValid || loading} className="px-8 py-3 bg-accent-secondary hover:bg-white text-brand-950 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50">
                                        {loading ? 'Salvando...' : 'Salvar Campanha'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {ads.map(ad => (
                            <div key={ad.id} className="glass-card p-4 rounded-2xl border border-white/5 relative group">
                                <div className="absolute top-2 right-2 flex gap-2 z-20">
                                    <button onClick={() => handleEditAd(ad)} className="p-2 bg-brand-900 rounded-lg hover:text-accent-primary"><Icons.Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteAd(ad)} className="p-2 bg-brand-900 rounded-lg hover:text-red-500"><Icons.Trash2 className="w-4 h-4" /></button>
                                </div>
                                <div className="h-32 bg-black/20 rounded-xl mb-4 overflow-hidden relative">
                                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-contain" />
                                    <div className={`absolute bottom-2 right-2 px-2 py-1 rounded text-[10px] font-bold ${ad.active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {ad.active ? 'ATIVO' : 'INATIVO'}
                                    </div>
                                </div>
                                <h3 className="font-bold text-white truncate">{ad.title}</h3>
                                <div className="flex justify-between text-xs text-brand-400 mt-2">
                                    <span>Impressões: {ad.impressions}</span>
                                    <span>Cliques: {ad.clicks}</span>
                                    <span>Peso: {ad.weight}</span>
                                </div>
                                <p className="text-xs text-brand-500 mt-1">
                                    {new Date(ad.startDate).toLocaleDateString()} até {new Date(ad.endDate).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (
                <div className="space-y-4">
                    <div className="relative group">
                        <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-secondary transition-colors" />
                        <input type="text" className="w-full glass-input rounded-xl py-3 pl-12 pr-4 text-white" placeholder="Buscar por nome ou email do usuário..." value={txSearch} onChange={e => setTxSearch(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="text-xs font-bold text-brand-400 uppercase ml-1">De</label>
                            <input type="date" className="w-full glass-input rounded-xl p-3 mt-1" value={txFrom} onChange={e => setTxFrom(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-brand-400 uppercase ml-1">Até</label>
                            <input type="date" className="w-full glass-input rounded-xl p-3 mt-1" value={txTo} onChange={e => setTxTo(e.target.value)} />
                        </div>
                        {(txFrom || txTo || txSearch) && <button onClick={() => { setTxFrom(''); setTxTo(''); setTxSearch(''); }} className="px-4 py-3 text-xs font-bold text-brand-400 hover:text-white">Limpar</button>}
                        <div className="ml-auto text-right">
                            <p className="text-sm text-white font-bold">{filteredTx.length} transações</p>
                            <p className="text-xs text-brand-400">{brl(filteredTxTotal)} movimentados</p>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                        {filteredTx.length === 0 ? (
                            <p className="text-brand-500 text-center py-12 text-sm">Nenhuma transação no período.</p>
                        ) : filteredTx.map(c => {
                            const st = TX_STATUS[c.status] || { label: c.status, cls: 'bg-brand-700 text-brand-300' };
                            return (
                                <div key={c.id} className="p-4 flex items-center gap-3 flex-wrap hover:bg-white/5 transition-colors">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md shrink-0 ${c.type === 'sale' ? 'bg-green-500/20 text-green-300' : 'bg-accent-primary/20 text-accent-primary'}`}>{c.type === 'sale' ? 'Venda' : 'Aluguel'}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-white font-bold text-sm truncate">{c.equipmentName}</p>
                                        <p className="text-xs text-brand-400 truncate">{c.ownerName} → {c.counterpartyName}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-white font-bold text-sm">{brl(c.value)}</p>
                                        <p className="text-[10px] text-brand-500">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md shrink-0 ${st.cls}`}>{st.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'incidents' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-card rounded-2xl border border-red-500/20 p-5">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Icons.ShieldAlert className="w-5 h-5 text-red-400" /> Itens Roubados ({stolen.length})</h3>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                            {stolen.length === 0 ? <p className="text-brand-500 text-sm py-4 text-center">Nenhum item roubado ativo.</p> :
                                stolen.map(it => (
                                    <div key={it.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                                        <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden shrink-0">{it.imageUrl && <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-white font-bold text-sm truncate">{it.name}</p>
                                            <p className="text-xs text-brand-400 truncate">{it.theftAddress || 'Local não informado'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-red-400 font-bold text-xs">{brl(it.value || 0)}</p>
                                            <p className="text-[10px] text-brand-500">{it.theftDate ? new Date(it.theftDate).toLocaleDateString('pt-BR') : ''}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl border border-green-500/20 p-5">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Icons.ShieldCheck className="w-5 h-5 text-green-400" /> Itens Recuperados ({recovered.length})</h3>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                            {recovered.length === 0 ? <p className="text-brand-500 text-sm py-4 text-center">Nenhum item recuperado ainda.</p> :
                                recovered.map((r, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0"><Icons.ShieldCheck className="w-5 h-5 text-green-400" /></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-white font-bold text-sm">Recuperado {r.recoveredViaApp ? 'pelo app' : '(outros meios)'}</p>
                                            <p className="text-xs text-brand-400 truncate">{r.theftAddress || 'Local não informado'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-green-400 font-bold text-xs">{brl(r.equipmentValue || 0)}</p>
                                            <p className="text-[10px] text-brand-500">{r.recoveryDate ? new Date(r.recoveryDate).toLocaleDateString('pt-BR') : ''}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ========== SORTEIOS TAB ========== */}
            {activeTab === 'raffles' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Icons.Gift className="w-5 h-5 text-green-400" /> Gerenciar Sorteios</h2>
                        <button onClick={() => { setIsAddingRaffle(true); setEditingRaffleId(null); setRaffleForm({ title: '', description: '', status: 'draft' }); setRaffleImagePreview(null); setRaffleImageFile(null); }} className="bg-accent-primary text-brand-950 px-5 py-2 rounded-xl font-bold text-sm hover:bg-cyan-400 transition-colors flex items-center gap-2">
                            <Icons.Plus className="w-4 h-4" /> Novo Sorteio
                        </button>
                    </div>

                    {/* Formulário de criação/edição */}
                    {isAddingRaffle && (
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setLoading(true);
                            try {
                                let imageUrl: string | null | undefined = undefined;
                                if (raffleImageFile) {
                                    try {
                                        imageUrl = await raffleService.uploadPrizeImage(raffleImageFile);
                                    } catch (uploadErr) {
                                        console.warn('Upload da imagem falhou (cota excedida?), criando sorteio sem imagem:', uploadErr);
                                    }
                                } else if (editingRaffleId && raffleImagePreview && !raffleImagePreview.startsWith('data:')) {
                                    imageUrl = raffleImagePreview;
                                }
                                // Validar sorteio único ativo
                                if (raffleForm.status === 'active' && !editingRaffleId) {
                                    const existing = raffles.filter(r => r.status === 'active');
                                    if (existing.length > 0) {
                                        alert('Já existe um sorteio ativo. Encerre ou cancele o sorteio atual antes de ativar outro.');
                                        setLoading(false);
                                        return;
                                    }
                                }
                                if (editingRaffleId) {
                                    await raffleService.updateRaffle(editingRaffleId, {
                                        title: raffleForm.title,
                                        description: raffleForm.description,
                                        status: raffleForm.status as any,
                                        startDate: raffleForm.startDate,
                                        endDate: raffleForm.endDate,
                                        ...(imageUrl ? { prizeImageUrl: imageUrl } : {}),
                                    });
                                } else {
                                    await raffleService.createRaffle({
                                        title: raffleForm.title || '',
                                        description: raffleForm.description || '',
                                        status: raffleForm.status as any || 'draft',
                                        createdBy: currentUser!.id,
                                        startDate: raffleForm.startDate || new Date().toISOString().slice(0, 10),
                                        endDate: raffleForm.endDate || '',
                                        ...(imageUrl ? { prizeImageUrl: imageUrl } : {}),
                                    });
                                }
                                setIsAddingRaffle(false);
                                setEditingRaffleId(null);
                                const updated = await raffleService.getAllRaffles();
                                setRaffles(updated);
                            } catch (err) { console.error(err); alert('Erro ao salvar sorteio.'); }
                            setLoading(false);
                        }} className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
                            <h3 className="text-white font-bold">{editingRaffleId ? 'Editar Sorteio' : 'Novo Sorteio'}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-brand-400 text-xs font-bold uppercase block mb-1">Título do Prêmio *</label>
                                    <input type="text" required value={raffleForm.title || ''} onChange={e => setRaffleForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl py-2.5 px-4 text-white" placeholder="Ex: Câmera Sony A7III" />
                                </div>
                                <div>
                                    <label className="text-brand-400 text-xs font-bold uppercase block mb-1">Status</label>
                                    <select value={raffleForm.status || 'draft'} onChange={e => setRaffleForm(f => ({ ...f, status: e.target.value as any }))} className="w-full glass-input rounded-xl py-2.5 px-4 text-white">
                                        <option value="draft">Rascunho</option>
                                        <option value="active">Ativo</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-brand-400 text-xs font-bold uppercase block mb-1">Data Início *</label>
                                    <input type="date" required value={raffleForm.startDate || ''} onChange={e => setRaffleForm(f => ({ ...f, startDate: e.target.value }))} className="w-full glass-input rounded-xl py-2.5 px-4 text-white" />
                                </div>
                                <div>
                                    <label className="text-brand-400 text-xs font-bold uppercase block mb-1">Data do Sorteio *</label>
                                    <input type="date" required value={raffleForm.endDate || ''} onChange={e => setRaffleForm(f => ({ ...f, endDate: e.target.value }))} className="w-full glass-input rounded-xl py-2.5 px-4 text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="text-brand-400 text-xs font-bold uppercase block mb-1">Descrição</label>
                                <textarea value={raffleForm.description || ''} onChange={e => setRaffleForm(f => ({ ...f, description: e.target.value }))} className="w-full glass-input rounded-xl py-2.5 px-4 text-white resize-none" rows={3} placeholder="Descreva o prêmio e as regras..." />
                            </div>
                            <div>
                                <label className="text-brand-400 text-xs font-bold uppercase block mb-1">Imagem do Prêmio</label>
                                <input ref={raffleFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { setRaffleImageFile(e.target.files[0]); const r = new FileReader(); r.onload = () => setRaffleImagePreview(r.result as string); r.readAsDataURL(e.target.files[0]); } }} />
                                <div className="flex items-center gap-4">
                                    {raffleImagePreview && <img src={raffleImagePreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-white/10" />}
                                    <button type="button" onClick={() => raffleFileInputRef.current?.click()} className="bg-brand-800 text-white px-4 py-2 rounded-xl text-sm hover:bg-brand-700 border border-white/5">
                                        <Icons.Upload className="w-4 h-4 inline mr-1" /> {raffleImagePreview ? 'Trocar' : 'Upload'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={loading} className="bg-accent-primary text-brand-950 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-cyan-400 transition-colors disabled:opacity-50">
                                    {loading ? 'Salvando...' : (editingRaffleId ? 'Atualizar' : 'Criar Sorteio')}
                                </button>
                                <button type="button" onClick={() => { setIsAddingRaffle(false); setEditingRaffleId(null); }} className="bg-brand-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-700 border border-white/5">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Lista de sorteios */}
                    <div className="space-y-4">
                        {raffles.length === 0 && !isAddingRaffle && (
                            <div className="text-center py-12 text-brand-500">
                                <Icons.Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Nenhum sorteio cadastrado ainda.</p>
                            </div>
                        )}
                        {raffles.map(r => {
                            const statusLabels: Record<string, { label: string; cls: string }> = {
                                draft: { label: 'Rascunho', cls: 'bg-brand-700 text-brand-300' },
                                active: { label: 'Ativo', cls: 'bg-green-500/20 text-green-400' },
                                completed: { label: 'Concluído', cls: 'bg-accent-primary/20 text-accent-primary' },
                                cancelled: { label: 'Cancelado', cls: 'bg-red-500/20 text-red-400' },
                            };
                            const st = statusLabels[r.status] || statusLabels.draft;
                            const canDraw = r.status === 'active' && r.endDate <= new Date().toISOString().slice(0, 10) && !r.winnerId;
                            return (
                                <div key={r.id} className="glass-card rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-black/30 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                            {r.prizeImageUrl ? <img src={r.prizeImageUrl} alt="" className="w-full h-full object-cover" /> : <Icons.Gift className="w-7 h-7 text-brand-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                                            </div>
                                            <h3 className="text-white font-bold truncate">{r.title}</h3>
                                            <p className="text-brand-500 text-xs">{r.startDate} → {r.endDate} · {r.totalParticipants} participantes · {r.totalTickets} tickets</p>
                                            {r.winnerId && <p className="text-green-400 text-xs mt-1">🏆 Vencedor: {r.winnerName}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {canDraw && (
                                                <button onClick={async () => {
                                                    // Animação de roleta
                                                    const lb = await raffleService.getRaffleLeaderboard(r.id);
                                                    if (lb.length === 0) { alert('Nenhum participante neste sorteio.'); return; }
                                                    setSelectedRaffleDetail(r);
                                                    setRouletteNames(lb.map(e => e.userName));
                                                    setDrawnWinner(null);
                                                    setIsDrawing(true);
                                                    // Animar: ciclar nomes por 3 segundos
                                                    let idx = 0;
                                                    const interval = setInterval(() => { idx = (idx + 1) % lb.length; setRouletteIndex(idx); }, 100);
                                                    setTimeout(async () => {
                                                        clearInterval(interval);
                                                        const result = await raffleService.drawWinner(r.id);
                                                        if (result) {
                                                            const winnerIdx = lb.findIndex(e => e.userId === result.winnerId);
                                                            setRouletteIndex(winnerIdx >= 0 ? winnerIdx : 0);
                                                            setDrawnWinner(result);
                                                        }
                                                        setTimeout(async () => {
                                                            const updated = await raffleService.getAllRaffles();
                                                            setRaffles(updated);
                                                        }, 1000);
                                                    }, 3000);
                                                }} className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-400 transition-colors flex items-center gap-1">
                                                    🎲 Sortear
                                                </button>
                                            )}
                                            <button onClick={async () => {
                                                setSelectedRaffleDetail(r);
                                                const [tks, lb] = await Promise.all([raffleService.getRaffleTickets(r.id), raffleService.getRaffleLeaderboard(r.id)]);
                                                setRaffleTickets(tks);
                                                setRaffleLeaderboard(lb);
                                            }} className="bg-brand-800 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-brand-700 border border-white/5">
                                                Detalhes
                                            </button>
                                            <button onClick={() => { setEditingRaffleId(r.id); setRaffleForm(r); setRaffleImagePreview(r.prizeImageUrl || null); setIsAddingRaffle(true); }} className="p-2 text-brand-400 hover:text-white">
                                                <Icons.Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => {
                                                setModalConfig({ title: 'Excluir Sorteio', message: `Tem certeza que deseja excluir o sorteio "${r.title}" e todos os tickets?`, isDestructive: true, confirmLabel: 'Excluir', action: async () => { await raffleService.deleteRaffle(r.id); const updated = await raffleService.getAllRaffles(); setRaffles(updated); setModalOpen(false); } });
                                                setModalOpen(true);
                                            }} className="p-2 text-brand-500 hover:text-red-500">
                                                <Icons.Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Roulette Animation Modal */}
            {isDrawing && createPortal(
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-brand-950/95 backdrop-blur-xl animate-fade-in">
                    <div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center">
                        {!drawnWinner ? (
                            <>
                                <div className="mb-6">
                                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                                        <Icons.Gift className="w-10 h-10 text-green-400" />
                                    </div>
                                    <h2 className="text-white font-extrabold text-2xl mb-2">Sorteando...</h2>
                                    <p className="text-brand-400 text-sm">Selecionando o vencedor de "{selectedRaffleDetail?.title}"</p>
                                </div>
                                <div className="bg-black/40 rounded-2xl p-6 border border-accent-primary/30 shadow-lg shadow-accent-primary/10">
                                    <span className="text-accent-primary font-extrabold text-3xl animate-pulse">
                                        {rouletteNames[rouletteIndex] || '...'}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-6">
                                    <span className="text-6xl block mb-4">🎉</span>
                                    <h2 className="text-yellow-400 font-extrabold text-2xl mb-2">Temos um Vencedor!</h2>
                                    <p className="text-brand-400 text-sm">O sorteio de "{selectedRaffleDetail?.title}" foi realizado</p>
                                </div>
                                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl p-6 border border-yellow-500/30">
                                    <span className="text-yellow-400 font-extrabold text-3xl">
                                        🏆 {drawnWinner.winnerName}
                                    </span>
                                </div>
                                <button onClick={() => { setIsDrawing(false); setDrawnWinner(null); setSelectedRaffleDetail(null); }} className="mt-6 bg-accent-primary text-brand-950 px-8 py-3 rounded-xl font-bold hover:bg-cyan-400 transition-colors">
                                    Fechar
                                </button>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Raffle Detail Modal */}
            {selectedRaffleDetail && !isDrawing && createPortal(
                <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-brand-950/90 backdrop-blur-xl animate-fade-in" onClick={() => setSelectedRaffleDetail(null)}>
                    <div className="glass-card max-w-lg w-full p-6 rounded-[2.5rem] border border-white/10 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">{selectedRaffleDetail.title}</h2>
                            <button onClick={() => setSelectedRaffleDetail(null)} className="text-brand-400 hover:text-white"><Icons.X /></button>
                        </div>
                        <p className="text-brand-400 text-sm mb-4">{selectedRaffleDetail.description}</p>
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-brand-900/50 p-3 rounded-xl text-center border border-white/5">
                                <p className="text-xl font-bold text-white">{selectedRaffleDetail.totalParticipants}</p>
                                <p className="text-[10px] text-brand-500 uppercase font-bold">Participantes</p>
                            </div>
                            <div className="bg-brand-900/50 p-3 rounded-xl text-center border border-white/5">
                                <p className="text-xl font-bold text-white">{selectedRaffleDetail.totalTickets}</p>
                                <p className="text-[10px] text-brand-500 uppercase font-bold">Tickets</p>
                            </div>
                            <div className="bg-brand-900/50 p-3 rounded-xl text-center border border-white/5">
                                <p className="text-xl font-bold text-accent-primary">{selectedRaffleDetail.status}</p>
                                <p className="text-[10px] text-brand-500 uppercase font-bold">Status</p>
                            </div>
                        </div>
                        {raffleLeaderboard.length > 0 && (
                            <div>
                                <h3 className="text-white font-bold text-sm mb-3">Ranking de Tickets</h3>
                                <div className="space-y-2">
                                    {raffleLeaderboard.map((entry, i) => (
                                        <div key={entry.userId} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2 border border-white/5">
                                            <span className="text-brand-500 text-xs font-bold w-6 text-center">{i + 1}º</span>
                                            <img src={entry.userAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                                            <span className="text-white text-sm flex-1 truncate">{entry.userName}</span>
                                            <span className="text-accent-primary font-bold text-sm">{entry.ticketCount}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* User Details Modal */}
            {selectedUser && selectedUserStats && createPortal(
                <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-brand-950/90 backdrop-blur-xl animate-fade-in" onClick={closeUserModal}>
                    <div className="glass-card max-w-lg w-full p-8 rounded-[2.5rem] relative border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button onClick={closeUserModal} className="absolute top-4 right-4 text-brand-400 hover:text-white"><Icons.X /></button>
                        
                        <div className="text-center mb-8">
                            <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="w-24 h-24 rounded-full border-4 border-brand-700 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-white">{selectedUser.name}</h2>
                            <p className="text-brand-400">{selectedUser.email}</p>
                            <p className="text-sm text-brand-500 mt-1">{selectedUser.location}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-brand-900/50 p-4 rounded-xl text-center border border-white/5">
                                <p className="text-2xl font-bold text-white">{selectedUser.reputationPoints}</p>
                                <p className="text-[10px] text-brand-500 uppercase font-bold">Reputação</p>
                            </div>
                            <div className="bg-brand-900/50 p-4 rounded-xl text-center border border-white/5">
                                <p className="text-2xl font-bold text-white">{selectedUserStats.total}</p>
                                <p className="text-[10px] text-brand-500 uppercase font-bold">Itens Totais</p>
                            </div>
                            <div className="bg-brand-900/50 p-4 rounded-xl text-center border border-white/5">
                                <p className="text-xl font-bold text-green-400">{selectedUserStats.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}</p>
                                <p className="text-[10px] text-brand-500 uppercase font-bold">Patrimônio</p>
                            </div>
                            <div className="bg-brand-900/50 p-4 rounded-xl text-center border border-white/5">
                                <p className="text-xl font-bold text-red-400">{selectedUserStats.stolen}</p>
                                <p className="text-[10px] text-brand-500 uppercase font-bold">Roubados</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={(e) => handleDeleteUser(selectedUser, e)} className="flex-1 py-3 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors">Excluir Usuário</button>
                            <button onClick={(e) => handleBlockUser(selectedUser, e)} className="flex-1 py-3 bg-brand-800 text-brand-300 font-bold rounded-xl border border-white/5 hover:bg-brand-700 transition-colors">{selectedUser.isBlocked ? 'Desbloquear' : 'Bloquear'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const StatCard: React.FC<{ label: string, value: string, icon: React.ElementType, color: string }> = ({ label, value, icon: Icon, color }) => (
    <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-brand-900 flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <p className="text-xs text-brand-400 uppercase font-bold tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);