import React, { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { User, Notification } from '../types';
import { Icons } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';

export const Network: React.FC = () => {
    const { user } = useAuth();
    const [connections, setConnections] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [loadingConnections, setLoadingConnections] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; confirmLabel: string; isDestructive?: boolean; }>({ title: '', message: '', action: async () => {}, confirmLabel: '' });
    const [modalProcessing, setModalProcessing] = useState(false);

    useEffect(() => { if (user) loadConnections(); }, [user]);
    useEffect(() => { const timer = setTimeout(() => { if (searchQuery.trim().length >= 2 && user) handleSearch(); else setSearchResults([]); }, 500); return () => clearTimeout(timer); }, [searchQuery]);

    const loadConnections = async () => {
        if (!user) return;
        setLoadingConnections(true);
        const list = await userService.getConnections(user.id);
        setConnections(list);
        setLoadingConnections(false);
    };

    const handleSearch = async () => {
        if (!user) return;
        setIsSearching(true);
        const results = await userService.searchUsers(searchQuery, user.id);
        setSearchResults(results);
        setIsSearching(false);
    };

    const handleConnect = async (targetUser: User) => {
        if (!user) return;
        if (connections.some(c => c.id === targetUser.id)) {
            setModalConfig({ title: "Já Conectados", message: `Você e ${targetUser.name} já fazem parte da mesma rede de confiança.`, confirmLabel: "OK", isDestructive: false, action: async () => setModalOpen(false) });
            setModalOpen(true);
            return;
        }
        setModalConfig({
            title: "Enviar Convite",
            message: `Deseja enviar um convite de conexão para ${targetUser.name}?`,
            confirmLabel: "Enviar",
            isDestructive: false,
            action: async () => {
                const notification: Notification = { id: crypto.randomUUID(), toUserId: targetUser.id, fromUserId: user.id, fromUserName: user.name, fromUserPhone: user.contactPhone, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, fromUserConnectionsCount: user.connections?.length || 0, type: 'CONNECTION_REQUEST', createdAt: new Date().toISOString(), read: false, message: `${user.name} quer te adicionar à Rede de Confiança dele.`, actionPayload: { requesterId: user.id } };
                await notificationService.createNotification(notification);
                setModalConfig({ title: "Convite Enviado", message: `Sua solicitação foi enviada para ${targetUser.name}.`, confirmLabel: "OK", isDestructive: false, action: async () => setModalOpen(false) });
            }
        });
        setModalOpen(true);
    };
    
    const handleDisconnect = async (targetUser: User) => {
        if (!user) return;
        setModalConfig({ title: "Desfazer Conexão", message: `Tem certeza que deseja remover ${targetUser.name} da sua rede?`, confirmLabel: "Desconectar", isDestructive: true, action: async () => { const success = await userService.removeConnection(user.id, targetUser.id); if (success) { setConnections(prev => prev.filter(c => c.id !== targetUser.id)); setModalOpen(false); } } });
        setModalOpen(true);
    };
    
    const handleModalConfirm = async () => { setModalProcessing(true); await modalConfig.action(); setModalProcessing(false); };
    const isConnected = (targetId: string) => connections.some(c => c.id === targetId);

    return (
        <div className="space-y-8 pb-10">
            <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} confirmLabel={modalConfig.confirmLabel} isDestructive={modalConfig.isDestructive} />
            <header>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Icons.Users className="w-8 h-8 text-accent-secondary" /> Minha Rede
                </h1>
                <p className="text-brand-400 mt-1">Construa conexões de confiança. Uma rede forte facilita transferências e aumenta sua segurança.</p>
            </header>

            {/* Search Section */}
            <div className="glass-card p-6 rounded-[2rem] border border-white/5">
                <div className="relative group mb-6">
                    <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-secondary transition-colors" />
                    <input type="text" className="w-full glass-input rounded-xl py-4 pl-12 pr-4 text-white placeholder-brand-600 font-medium" placeholder="Encontrar pessoas por nome..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent-secondary border-t-transparent rounded-full animate-spin"></div>}
                </div>

                {searchResults.length > 0 && (
                    <div className="space-y-3 animate-fade-in">
                        <h3 className="text-xs font-bold text-brand-500 uppercase tracking-widest ml-1 mb-2">Resultados da Busca</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.map(resultUser => (
                                <div key={resultUser.id} className="bg-brand-900/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-accent-secondary/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-800 overflow-hidden border border-brand-600">
                                            <img src={resultUser.avatarUrl} alt={resultUser.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">{resultUser.name}</h4>
                                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-brand-400">
                                                <span className="flex items-center gap-1 text-accent-gold"><Icons.Trophy className="w-3 h-3" /> {resultUser.reputationPoints} XP</span>
                                                <span className="w-1 h-1 bg-brand-700 rounded-full"></span>
                                                <span className="flex items-center gap-1"><Icons.Users className="w-3 h-3" /> {resultUser.connections?.length || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {isConnected(resultUser.id) ? (
                                        <span className="text-xs font-bold text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">Conectado</span>
                                    ) : (
                                        <button onClick={() => handleConnect(resultUser)} className="text-xs font-bold bg-accent-secondary text-brand-950 px-3 py-1.5 rounded-lg hover:bg-white transition-colors">Conectar</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* My Connections */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Icons.Link className="w-5 h-5 text-accent-primary" /> Suas Conexões ({connections.length})
                </h2>
                {loadingConnections ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse"></div>)}
                    </div>
                ) : connections.length === 0 ? (
                    <div className="text-center py-12 opacity-50 border border-dashed border-brand-700 rounded-[2rem]">
                        <Icons.Users className="w-12 h-12 mx-auto mb-3 text-brand-600" />
                        <p className="text-brand-400">Sua rede está vazia. Busque por colegas acima.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {connections.map(conn => (
                            <div key={conn.id} className="glass-card p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-accent-primary/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-brand-800 overflow-hidden border-2 border-brand-700 group-hover:border-accent-primary transition-colors">
                                        <img src={conn.avatarUrl} alt={conn.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">{conn.name}</h4>
                                        <div className="flex items-center gap-2 text-xs font-bold text-brand-400 uppercase mt-0.5">
                                            <span className="flex items-center gap-1 text-accent-gold"><Icons.Trophy className="w-3 h-3" /> {conn.reputationPoints} XP</span>
                                            <span className="w-1 h-1 bg-brand-700 rounded-full"></span>
                                            <span className="flex items-center gap-1"><Icons.Users className="w-3 h-3" /> {conn.connections?.length || 0}</span>
                                        </div>
                                        {/* Transaction History Badge */}
                                        {user && user.transactionHistory && user.transactionHistory[conn.id] > 0 && (
                                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded-md w-fit border border-green-500/20">
                                                <Icons.Banknote className="w-3 h-3" />
                                                <span>R$ {user.transactionHistory[conn.id].toLocaleString('pt-BR', { notation: 'compact' })} transacionados</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => handleDisconnect(conn)} className="text-brand-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors" title="Desconectar">
                                    <Icons.Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};