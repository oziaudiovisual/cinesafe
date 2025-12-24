

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipmentService } from '../services/equipmentService';
import { userService } from '../services/userService';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { Equipment, EquipmentCategory, EquipmentStatus, User, Notification } from '../types';

export const useInventory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // Data State
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [connections, setConnections] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', brand: '', model: '', serialNumber: '', category: EquipmentCategory.CAMERA, isForRent: false, rentalPrice: 0, isForSale: false, salePrice: 0, description: '', value: 0 });
    const [formErrors, setFormErrors] = useState<string[]>([]);
    
    // File State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const invoiceFileInputRef = useRef<HTMLInputElement>(null);

    // Modals State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalProcessing, setModalProcessing] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ title: string; message: string; action: () => Promise<void>; isDestructive: boolean; confirmLabel: string; }>({ title: '', message: '', action: async () => {}, isDestructive: false, confirmLabel: '' });
    
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [itemToTransfer, setItemToTransfer] = useState<Equipment | null>(null);
    const [selectedConnectionId, setSelectedConnectionId] = useState('');
    const [transferType, setTransferType] = useState<'free' | 'valued'>('free');
    const [transactionValue, setTransactionValue] = useState<number>(0);
    
    const [recoverModalOpen, setRecoverModalOpen] = useState(false);
    const [itemToRecover, setItemToRecover] = useState<Equipment | null>(null);
    const [showReferralModal, setShowReferralModal] = useState(false);
    
    const [filterCategory, setFilterCategory] = useState<string>('ALL');

    const TOP_AV_BRANDS = ["Sony", "Canon", "Blackmagic Design", "Nikon", "Panasonic", "ARRI", "RED", "DJI", "Sennheiser", "Shure", "Rode", "Aputure", "Godox", "Sigma", "Fujifilm", "GoPro", "Zeiss", "Leica", "Hasselblad", "Insta360", "Tamron", "Manfrotto", "SmallRig", "Zoom"];

    useEffect(() => {
        if (user) {
            refreshData();
            loadConnections();
        }
    }, [user]);

    useEffect(() => {
        const errors: string[] = [];
        const isListing = formData.isForSale || formData.isForRent;
        if (formData.isForSale && (!formData.salePrice || formData.salePrice <= 0)) errors.push("O preço de venda deve ser maior que zero.");
        if (formData.isForRent && (!formData.rentalPrice || formData.rentalPrice <= 0)) errors.push("O preço do aluguel deve ser maior que zero.");
        if (isListing && !previewImage) errors.push("Uma imagem é obrigatória para listar um item.");
        if (isListing && (!formData.description || formData.description.trim().length < 10)) errors.push("Uma descrição de pelo menos 10 caracteres é necessária.");
        if(!formData.brand || !formData.model || !formData.serialNumber) errors.push("Marca, Modelo e Serial são obrigatórios.");
        setFormErrors(errors);
    }, [formData, previewImage]);

    const refreshData = async () => {
        if (!user) return;
        setLoading(true);
        const userEq = await equipmentService.getUserEquipment(user.id);
        setEquipment(userEq);
        setLoading(false);
    };

    const loadConnections = async () => {
        if (!user) return;
        const list = await userService.getConnections(user.id);
        setConnections(list);
    };

    const resetForm = () => {
        setFormData({ name: '', brand: '', model: '', serialNumber: '', category: EquipmentCategory.CAMERA, isForRent: false, rentalPrice: 0, isForSale: false, salePrice: 0, description: '', value: 0 });
        setEditingId(null); setIsAdding(false); setPreviewImage(null); setSelectedFile(null);
        setInvoiceFile(null); setInvoicePreview(null);
    };

    const handleAddNewClick = async () => {
        if (isAdding) { resetForm(); return; }
        if (!user) return;
        const canAdd = await userService.checkLimit(user.id, 'inventory');
        if (canAdd) setIsAdding(true);
        else setShowReferralModal(true);
    };

    const handleEditClick = (item: Equipment) => {
        setFormData({ name: item.name, brand: item.brand, model: item.model, serialNumber: item.serialNumber, category: item.category, isForRent: item.isForRent, rentalPrice: item.rentalPricePerDay || 0, isForSale: item.isForSale || false, salePrice: item.salePrice || 0, description: item.description || '', value: item.value || 0 });
        setPreviewImage(item.imageUrl || null);
        setInvoicePreview(item.invoiceUrl || null);
        setEditingId(item.id);
        setIsAdding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCorsError = () => {
        setModalConfig({ title: "Falha de Upload: Ação Necessária", message: "O envio do arquivo foi bloqueado por uma política de segurança (CORS). O domínio 'https://cinesafe.netlify.app' precisa ser adicionado à lista de permissões de CORS do bucket do Firebase.", isDestructive: true, confirmLabel: "Entendi", action: async () => setModalOpen(false) });
        setModalOpen(true);
    };
    // FIX: Add React namespace for FormEvent type
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || formErrors.length > 0) return;
        const itemId = editingId || crypto.randomUUID();
        
        if (formData.serialNumber) {
            setUploadingImage(true);
            const existingItem = await equipmentService.checkSerial(formData.serialNumber);
            setUploadingImage(false);
            if (existingItem && (!editingId || existingItem.id !== editingId)) {
                setModalConfig({ title: existingItem.ownerId === user.id ? "Item já cadastrado" : "Serial Indisponível", message: existingItem.ownerId === user.id ? "Você já possui este item." : "Serial já registrado por outro usuário.", isDestructive: false, confirmLabel: "Entendi", action: async () => setModalOpen(false) });
                setModalOpen(true);
                return;
            }
        }

        setUploadingImage(true);
        let finalImageUrl = previewImage;
        let finalInvoiceUrl = invoicePreview;
        
        try {
            if (selectedFile) finalImageUrl = await equipmentService.uploadEquipmentImage(selectedFile, user.id);
            if (invoiceFile) finalInvoiceUrl = await equipmentService.uploadInvoiceImage(invoiceFile, user.id, itemId);
            else if (invoicePreview === null) finalInvoiceUrl = null;
        } catch (e: any) {
            if (e.message === 'CORS_CONFIG_ERROR') handleCorsError();
            else { setModalConfig({ title: "Erro de Upload", message: "Erro desconhecido.", isDestructive: true, confirmLabel: "Fechar", action: async () => setModalOpen(false) }); setModalOpen(true); }
            setUploadingImage(false);
            return;
        }

        if (!finalImageUrl) finalImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.brand || 'Item')}&background=222&color=fff&size=400`;
        setUploadingImage(false);

        const commonData = { name: formData.name || `${formData.brand} ${formData.model}`, brand: formData.brand, model: formData.model, serialNumber: formData.serialNumber, category: formData.category, isForRent: formData.isForRent, rentalPricePerDay: Number(formData.rentalPrice), isForSale: formData.isForSale, salePrice: Number(formData.salePrice), description: formData.description, imageUrl: finalImageUrl, value: Number(formData.value), invoiceUrl: finalInvoiceUrl ?? null };
        
        if (editingId) {
            const existing = equipment.find(e => e.id === editingId);
            if (existing) await equipmentService.updateEquipment({ ...existing, ...commonData });
        } else {
            await equipmentService.addEquipment({ ...commonData, id: itemId, ownerId: user.id, status: EquipmentStatus.SAFE, purchaseDate: new Date().toISOString().split('T')[0] });
        }
        await refreshData();
        resetForm();
    };

    const promptDelete = (id: string) => {
        setModalConfig({ title: "Excluir Equipamento", message: "Tem certeza que deseja excluir este equipamento permanentemente?", isDestructive: true, confirmLabel: "Excluir", action: async () => { const success = await equipmentService.deleteEquipment(id); if (success) { await refreshData(); setModalOpen(false); } } });
        setModalOpen(true);
    };

    const handleTransferClick = (item: Equipment) => {
        if (connections.length === 0) {
            setModalConfig({ title: "Rede Vazia", message: "Adicione pessoas à sua rede primeiro.", confirmLabel: "Ir para Minha Rede", isDestructive: false, action: async () => { setModalOpen(false); navigate('/network'); } });
            setModalOpen(true);
            return;
        }
        setItemToTransfer(item);
        setTransactionValue(item.value || 0);
        setTransferModalOpen(true);
    };

    const confirmTransfer = async () => {
        if (!user || !itemToTransfer || !selectedConnectionId) return;
        setModalProcessing(true);
        const targetUser = connections.find(c => c.id === selectedConnectionId);
        if (!targetUser) return;
        
        const value = transferType === 'valued' ? transactionValue : 0;
        const message = value > 0 ? `${user.name} iniciou a transferência de ${itemToTransfer.name} por ${value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.` : `${user.name} iniciou a transferência de ${itemToTransfer.name}.`;
        
        const notification: Notification = { id: crypto.randomUUID(), toUserId: targetUser.id, fromUserId: user.id, fromUserName: user.name, fromUserAvatar: user.avatarUrl, fromUserReputation: user.reputationPoints, itemId: itemToTransfer.id, itemName: itemToTransfer.name, itemImage: itemToTransfer.imageUrl, type: 'ITEM_TRANSFER', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), read: false, message: message, actionPayload: { equipmentId: itemToTransfer.id, transactionValue: value } };
        
        await notificationService.createNotification(notification);
        await equipmentService.updateEquipment({ ...itemToTransfer, status: EquipmentStatus.TRANSFER_PENDING, pendingTransferTo: selectedConnectionId, isForRent: false, isForSale: false });
        await refreshData();
        
        setTransferModalOpen(false); setItemToTransfer(null); setSelectedConnectionId(''); setTransferType('free'); setTransactionValue(0); setModalProcessing(false);
        setModalConfig({ title: "Solicitação Enviada", message: "Aguardando aceite do destinatário (24h).", confirmLabel: "OK", isDestructive: false, action: async () => setModalOpen(false) });
        setModalOpen(true);
    };

    const handleCancelTransfer = (item: Equipment) => {
        setModalConfig({ title: "Cancelar Transferência", message: "Cancelar a transferência pendente?", isDestructive: true, confirmLabel: "Sim, Cancelar", action: async () => { const success = await equipmentService.cancelTransfer(item.id); if (success) { await refreshData(); setModalOpen(false); } } });
        setModalOpen(true);
    };

    const confirmRecovery = async (viaApp: boolean) => {
        if (!itemToRecover) return;
        setModalProcessing(true);
        const success = await equipmentService.recoverEquipment(itemToRecover, viaApp);
        if (success) { await refreshData(); setRecoverModalOpen(false); setItemToRecover(null); }
        setModalProcessing(false);
    };
    // FIX: Add React namespace for ChangeEvent type
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; setSelectedFile(file); const reader = new FileReader(); reader.onloadend = () => setPreviewImage(reader.result as string); reader.readAsDataURL(file); } };
    // FIX: Add React namespace for ChangeEvent type
    const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; setInvoiceFile(file); setInvoicePreview(URL.createObjectURL(file)); } };
    // FIX: Add React namespace for MouseEvent type
    const handleRemoveInvoice = (e: React.MouseEvent) => { e.stopPropagation(); setInvoiceFile(null); setInvoicePreview(null); if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = ''; };

    return {
        equipment, connections, loading,
        isAdding, editingId, formData, formErrors, setFormData,
        previewImage, selectedFile, uploadingImage, invoicePreview, fileInputRef, invoiceFileInputRef,
        modalOpen, modalConfig, modalProcessing, setModalOpen,
        transferModalOpen, setTransferModalOpen, itemToTransfer, selectedConnectionId, setSelectedConnectionId, transferType, setTransferType, transactionValue, setTransactionValue,
        recoverModalOpen, setRecoverModalOpen, itemToRecover, setItemToRecover,
        showReferralModal, setShowReferralModal,
        filterCategory, setFilterCategory,
        refreshData, resetForm, handleAddNewClick, handleEditClick, handleSubmit,
        handleFileChange, handleInvoiceFileChange, handleRemoveInvoice,
        promptDelete, handleTransferClick, confirmTransfer, handleCancelTransfer, confirmRecovery,
        handleModalConfirm: async () => { setModalProcessing(true); await modalConfig.action(); setModalProcessing(false); },
        toTitleCase: (str: string) => str.replace(/\w\S*/g, text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()),
        handleRentToggle: (checked: boolean) => { setFormData(prev => ({ ...prev, isForRent: checked })); },
        handleSaleToggle: (checked: boolean) => { setFormData(prev => ({ ...prev, isForSale: checked })); },
        TOP_AV_BRANDS
    };
};
