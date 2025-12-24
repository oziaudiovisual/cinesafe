
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { equipmentService } from '../services/equipmentService';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { Equipment, EquipmentCategory, Notification } from '../types';
import { Icons } from '../components/Icons';
import { IBGEService } from '../services/ibge';
import { useAuth } from '../context/AuthContext';
import { ReferralModal } from '../components/ReferralModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { UserAvatar } from '../components/UserAvatar';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

export const Rentals: React.FC = () => {
    const { user } = useAuth();
    const [rentals, setRentals] = useState<Equipment[]>([]);
    
    // Pagination State
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    
    const [isFetching, setIsFetching] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState(''); // Only kept for UI input, filtered locally now or needs full text solution
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [ufs, setUfs] = useState<{id: number; sigla: string; nome: string;}[]>([]);
    const [cities, setCities] = useState<{id: number; nome: string;}[]>([]);
    const [selectedUf, setSelectedUf] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [loadingCities, setLoadingCities] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; confirmLabel: string; }>({ title: '', message: '', action: async () => {}, confirmLabel: '' });
    const [modalProcessing, setModalProcessing] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isFetching) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                // Trigger load more
                fetchRentals(false);
            }
        });
        if (node) observer.current.observe(node);
    }, [isFetching, hasMore]);

    useEffect(() => { IBGEService.getUFs().then(setUfs); }, []);
    useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500); return () => clearTimeout(timer); }, [searchQuery]);
    useEffect(() => { if (selectedUf) { setLoadingCities(true); IBGEService.getCitiesByUF(selectedUf).then(data => { setCities(data); setLoadingCities(false); setSelectedCity(''); }); } else { setCities([]); setSelectedCity(''); } }, [selectedUf]);
    
    // Reset when filters change
    useEffect(() => { 
        setRentals([]); 
        setLastDoc(null);
        setHasMore(true);
        // We need to trigger the first fetch after reset.
        // Using a timeout to ensure state is cleared or use a separate "resetAndFetch" function.
        // A cleaner way is to call fetchRentals(true) directly here.
        fetchRentals(true);
    }, [filterCategory, selectedUf, selectedCity]); // Removed debouncedSearch from query trigger as we can't search text effectively server side

    const fetchRentals = async (isReset: boolean = false) => {
        if (isFetching) return;
        setIsFetching(true);
        
        try {
            const filters = { 
                category: filterCategory || undefined, 
                // searchQuery: debouncedSearch || undefined, // Disabled Client-Side Search for Performance/Native Pagination compliance
                uf: selectedUf || undefined, 
                city: selectedCity || undefined 
            };
            
            // If resetting, start from null. Otherwise use current lastDoc.
            const cursor = isReset ? null : lastDoc;

            const result = await equipmentService.getRentalsPaginated(cursor, 12, filters);
            
            setRentals(prev => isReset ? result.data : [...prev, ...result.data]);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch (error) {
            console.error(error);
        } finally {
            setIsFetching(false);
        }
    };

    const handleInterest = async (item: Equipment) => {
        if (!user || item.ownerId === user.id) return;
        const canContact = await userService.checkLimit(user.id, 'contact');
        if (!canContact) { setShowReferralModal(true); return; }
        setModalConfig({
            title: "Enviar Interesse",
            message: `Deseja avisar ao proprietário ${item.ownerProfile?.name || ''} que você tem interesse em alugar "${item.name}"?`,
            confirmLabel: "Enviar Notificação",
            action: async () => {
                const notification: Notification = { id: crypto.randomUUID(), toUserId: item.ownerId, fromUserId: user.id, fromUserName: user.name, fromUserPhone: user.contactPhone, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, fromUserConnectionsCount: user.connections?.length || 0, itemId: item.id, itemName: item.name, itemImage: item.imageUrl, type: 'RENTAL_INTEREST', createdAt: new Date().toISOString(), read: false, message: `Tenho interesse em alugar seu item ${item.name}.` };
                await notificationService.createNotification(notification);
                await userService.incrementUsage(user.id, 'contact');
                setModalOpen(false);
            }
        });
        setModalOpen(true);
    };

    const handleModalConfirm = async () => { setModalProcessing(true); await modalConfig.action(); setModalProcessing(false); };
    
    // Client-side filtering for search query if absolutely necessary for small lists,
    // otherwise strictly follow "Remove filter by searchQuery" as requested.
    // Assuming strict removal per prompt instructions for the service, but let's keep the UI clean.
    // We will show all items fetched.
    const displayedRentals = rentals; 

    return (
        <div className="space-y-8 relative pb-10">
            <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} confirmLabel={modalConfig.confirmLabel} />
            <ReferralModal isOpen={showReferralModal} onClose={() => setShowReferralModal(false)} reason="contact" />
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Icons.ShoppingBag className="w-8 h-8 text-accent-secondary" />
                        Alugar Equipamentos
                    </h1>
                    <p className="text-brand-400 mt-1">Encontre o que você precisa perto de você.</p>
                </div>
                {/* Search Bar Removed or disabled as per instructions to rely on native pagination/filters, 
                    or kept visual but functionality limited until full text search service is added. 
                    I'll keep the UI but show a tooltip or make it clear it's limited. */}
                <div className="relative w-full md:w-96 group opacity-50 pointer-events-none" title="Busca textual temporariamente desativada para otimização">
                    <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-secondary transition-colors" />
                    <input type="text" disabled className="w-full glass-input rounded-xl py-3 pl-12 pr-4 text-sm" placeholder="Busca textual em manutenção..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
            </header>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="relative group">
                    <Icons.MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-4 h-4 pointer-events-none" />
                    <select className="w-full glass-input rounded-xl py-3 pl-10 pr-8 text-sm appearance-none cursor-pointer" value={selectedUf} onChange={e => setSelectedUf(e.target.value)}>
                        <option value="">Todo o Brasil</option>
                        {ufs.map(uf => <option key={uf.id} value={uf.sigla}>{uf.nome}</option>)}
                    </select>
               </div>
               <div className="relative group">
                    <select className="w-full glass-input rounded-xl py-3 px-4 text-sm appearance-none cursor-pointer disabled:opacity-50" value={selectedCity} onChange={e => setSelectedCity(e.target.value)} disabled={!selectedUf || loadingCities}>
                        <option value="">Todas as Cidades</option>
                        {cities.map(city => <option key={city.id} value={city.nome}>{city.nome}</option>)}
                    </select>
               </div>
               <div className="relative group col-span-2">
                    <select className="w-full glass-input rounded-xl py-3 px-4 text-sm appearance-none cursor-pointer" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="">Todas as Categorias</option>
                        {Object.values(EquipmentCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedRentals.map((item, index) => {
                    const isLast = index === displayedRentals.length - 1;
                    const isOwner = user?.id === item.ownerId;
                    return (
                        <div key={`${item.id}-${index}`} ref={isLast ? lastElementRef : null} className="glass-card rounded-[2rem] overflow-hidden group hover:border-accent-secondary/30 transition-all duration-300 flex flex-col">
                            <div className="aspect-[4/3] relative overflow-hidden bg-black/40">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-transparent to-transparent opacity-60"></div>
                                <div className="absolute bottom-4 left-4 right-4">
                                    <h3 className="text-xl font-bold text-white leading-tight drop-shadow-lg truncate">{item.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-md border border-white/10">{item.brand}</span>
                                        <span className="text-xs text-brand-300 font-mono">{item.model}</span>
                                    </div>
                                </div>
                                <div className="absolute top-4 right-4 bg-accent-secondary text-brand-950 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                                    R$ {item.rentalPricePerDay?.toLocaleString('pt-BR')}/dia
                                </div>
                            </div>
                            
                            <div className="p-5 flex-1 flex flex-col">
                                {item.ownerProfile?.location && (
                                    <div className="flex items-center gap-1.5 text-xs text-brand-400 mb-4">
                                        <Icons.MapPin className="w-3.5 h-3.5" />
                                        <span className="truncate">{item.ownerProfile.location}</span>
                                    </div>
                                )}
                                
                                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {item.ownerProfile && <UserAvatar user={{ name: item.ownerProfile.name, avatarUrl: item.ownerProfile.avatarUrl }} />}
                                        <span className="text-sm text-brand-300 font-medium truncate max-w-[100px]">{item.ownerProfile?.name?.split(' ')[0] || "Proprietário"}</span>
                                    </div>
                                    {isOwner ? (
                                        <span className="text-xs font-bold text-brand-500 bg-brand-900 px-3 py-1.5 rounded-lg border border-brand-700">Seu Anúncio</span>
                                    ) : (
                                        <button onClick={() => handleInterest(item)} className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg border border-white/10 transition-colors flex items-center gap-2">
                                            Tenho Interesse <Icons.ArrowRight className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {isFetching && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-secondary"></div>
                </div>
            )}
            
            {!isFetching && rentals.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <Icons.ShoppingBag className="w-16 h-16 mx-auto mb-4 text-brand-600" />
                    <p className="text-brand-400 font-medium">Nenhum item encontrado para aluguel com estes filtros.</p>
                </div>
            )}
        </div>
    );
};
