import React, { useEffect, useState, useRef } from 'react';
import { userService } from '../services/userService';
import { adService } from '../services/adService';
import { User, Ad } from '../types';
import { Icons } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { createPortal } from 'react-dom';

const generateUUID = () => crypto.randomUUID();

export const AdminDashboard: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'ads'>('users');
    const [loading, setLoading] = useState(true);
    const [globalStats, setGlobalStats] = useState({ users: 0, equipment: 0, stolen: 0, value: 0 });
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

    useEffect(() => { loadData(); }, []);
    useEffect(() => { const { title, buttonText, startDate, endDate } = adForm; const hasRequiredText = title && buttonText && startDate && endDate; const hasImage = !!adImagePreview; setIsAdFormValid(!!hasRequiredText && hasImage); }, [adForm, adImagePreview]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allUsers, allAds, stats] = await Promise.all([
                userService.getAllUsers(),
                adService.getAllAds(),
                userService.getGlobalDetailedStats().then(s => ({ users: 0, equipment: s.totalItems, stolen: s.stolenItems, value: s.totalValue })),
            ]);
            const usersCount = (await getDocs(collection(db, 'users'))).size; 
            setUsers(allUsers);
            setAds(allAds);
            setGlobalStats({...stats, users: usersCount});
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

    return (
        <div className="space-y-8 pb-12">
            <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} isDestructive={modalConfig.isDestructive} confirmLabel={modalConfig.confirmLabel} />
            <header className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Icons.Lock className="w-8 h-8 text-accent-warning" /> Painel Admin
                </h1>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="Usuários Totais" value={globalStats.users.toString()} icon={Icons.Users} color="text-blue-400" />
                <StatCard label="Equipamentos" value={globalStats.equipment.toString()} icon={Icons.Camera} color="text-accent-primary" />
                <StatCard label="Itens Roubados" value={globalStats.stolen.toString()} icon={Icons.ShieldAlert} color="text-red-500" />
                <StatCard label="Valor Protegido" value={globalStats.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })} icon={Icons.Banknote} color="text-green-400" />
            </div>

            <div className="flex gap-4 border-b border-white/10">
                <button onClick={() => setActiveTab('users')} className={`px-6 py-3 font-bold text-sm transition-colors relative ${activeTab === 'users' ? 'text-white' : 'text-brand-400 hover:text-white'}`}>
                    Gerenciar Usuários
                    {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-1 bg-accent-primary rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('ads')} className={`px-6 py-3 font-bold text-sm transition-colors relative ${activeTab === 'ads' ? 'text-white' : 'text-brand-400 hover:text-white'}`}>
                    Gerenciar Anúncios
                    {activeTab === 'ads' && <div className="absolute bottom-0 left-0 w-full h-1 bg-accent-secondary rounded-t-full"></div>}
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
                                        <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Imagem do Produto (PNG Transparente)</label>
                                        <div className="aspect-[4/3] bg-black/30 rounded-2xl border-2 border-dashed border-brand-700 flex flex-col items-center justify-center cursor-pointer hover:border-accent-secondary/50 transition-colors relative overflow-hidden group" onClick={() => fileInputRef.current?.click()}>
                                            {adImagePreview ? (
                                                <img src={adImagePreview} alt="Preview" className="w-full h-full object-contain p-4" />
                                            ) : (
                                                <div className="text-center p-4">
                                                    <Icons.Image className="w-10 h-10 text-brand-600 mx-auto mb-2" />
                                                    <span className="text-sm text-brand-500">Clique para upload (600px de altura)</span>
                                                </div>
                                            )}
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/png" onChange={handleAdFileChange} />
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