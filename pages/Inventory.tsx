import React from 'react';
import { Icons } from '../components/Icons';
import { EquipmentCategory, EquipmentStatus } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { ReferralModal } from '../components/ReferralModal';
import { useInventory } from '../hooks/useInventory';
import { createPortal } from 'react-dom';

export const Inventory: React.FC = () => {
    const {
        equipment, connections, isAdding, editingId, formData, formErrors, setFormData,
        previewImage, uploadingImage, invoicePreview, fileInputRef, invoiceFileInputRef,
        modalOpen, modalConfig, modalProcessing, setModalOpen,
        transferModalOpen, setTransferModalOpen, itemToTransfer, selectedConnectionId, setSelectedConnectionId, transferType, setTransferType, transactionValue, setTransactionValue,
        recoverModalOpen, setRecoverModalOpen, itemToRecover, setItemToRecover,
        showReferralModal, setShowReferralModal,
        filterCategory, setFilterCategory,
        resetForm, handleAddNewClick, handleEditClick, handleSubmit,
        handleFileChange, handleInvoiceFileChange, handleRemoveInvoice,
        promptDelete, handleTransferClick, confirmTransfer, handleCancelTransfer, confirmRecovery,
        handleModalConfirm, toTitleCase, handleRentToggle, handleSaleToggle, TOP_AV_BRANDS
    } = useInventory();

    const groupedEquipment = equipment.reduce((acc, item) => { const cat = item.category || 'Outros'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {} as Record<string, typeof equipment>);

    return (
      <div className="space-y-8 pb-12">
        <ConfirmModal isOpen={modalOpen} title={modalConfig.title} message={modalConfig.message} onConfirm={handleModalConfirm} onCancel={() => setModalOpen(false)} isProcessing={modalProcessing} isDestructive={modalConfig.isDestructive} confirmLabel={modalConfig.confirmLabel} />
        <ReferralModal isOpen={showReferralModal} onClose={() => setShowReferralModal(false)} reason="inventory" />
        
        {/* Transfer Modal */}
        {transferModalOpen && itemToTransfer && createPortal(
            <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-brand-950/90 backdrop-blur-xl animate-fade-in">
                <div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] relative border border-white/10 shadow-2xl">
                    <button onClick={() => setTransferModalOpen(false)} className="absolute top-4 right-4 text-brand-400 hover:text-white"><Icons.X className="w-6 h-6" /></button>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-accent-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-accent-primary"><Icons.ArrowRight className="w-8 h-8" /></div>
                        <h3 className="text-2xl font-bold text-white">Transferir Propriedade</h3>
                        <p className="text-brand-400 text-sm mt-2">Envie "{itemToTransfer.name}" para a conta de outro profissional.</p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Destinatário (Sua Rede)</label>
                            <select className="w-full glass-input rounded-xl p-3" value={selectedConnectionId} onChange={e => setSelectedConnectionId(e.target.value)}>
                                <option value="">Selecione um contato...</option>
                                {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Tipo de Transação</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setTransferType('free')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${transferType === 'free' ? 'bg-accent-primary text-brand-950 border-accent-primary' : 'bg-brand-900 text-brand-400 border-white/10'}`}>Gratuita / Doação</button>
                                <button onClick={() => setTransferType('valued')} className={`p-3 rounded-xl border text-sm font-bold transition-all ${transferType === 'valued' ? 'bg-accent-primary text-brand-950 border-accent-primary' : 'bg-brand-900 text-brand-400 border-white/10'}`}>Venda / Valor</button>
                            </div>
                        </div>
                        {transferType === 'valued' && (
                            <div>
                                <label className="block text-xs font-bold text-brand-400 uppercase mb-2">Valor da Transação (R$)</label>
                                <input type="number" className="w-full glass-input rounded-xl p-3" value={transactionValue} onChange={e => setTransactionValue(Number(e.target.value))} />
                            </div>
                        )}
                        <button onClick={confirmTransfer} disabled={!selectedConnectionId || modalProcessing} className="w-full bg-accent-primary hover:bg-cyan-400 text-brand-950 font-bold py-4 rounded-xl mt-4 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                            {modalProcessing && <div className="w-4 h-4 border-2 border-brand-950 border-t-transparent rounded-full animate-spin" />} Confirmar Transferência
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* Recover Modal */}
        {recoverModalOpen && itemToRecover && createPortal(
            <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-brand-950/90 backdrop-blur-xl animate-fade-in">
                <div className="glass-card max-w-md w-full p-8 rounded-[2.5rem] relative border border-white/10 shadow-2xl">
                    <h3 className="text-2xl font-bold text-white mb-4 text-center">Item Recuperado! 🎉</h3>
                    <p className="text-brand-300 text-center mb-6">Que ótima notícia! Como você recuperou este item?</p>
                    <div className="space-y-3">
                        <button onClick={() => confirmRecovery(true)} disabled={modalProcessing} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all">Através do Cine Safe</button>
                        <button onClick={() => confirmRecovery(false)} disabled={modalProcessing} className="w-full bg-brand-700 hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition-all">Outros meios (Polícia, etc)</button>
                        <button onClick={() => setRecoverModalOpen(false)} className="w-full text-brand-400 font-bold py-2">Cancelar</button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Icons.Camera className="w-8 h-8 text-accent-primary" /> Meu Inventário</h1>
                <p className="text-brand-400 mt-1">Gerencie seus equipamentos e proteja seu patrimônio.</p>
            </div>
            <button onClick={handleAddNewClick} className="bg-accent-primary hover:bg-cyan-400 text-brand-950 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all group">
                <Icons.Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Novo Item
            </button>
        </header>

        {isAdding && (<div className="glass-card p-8 rounded-3xl animate-fade-in border border-white/10 mb-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white">{editingId ? 'Editar Equipamento' : 'Novo Equipamento'}</h2><button onClick={resetForm} className="text-brand-400 hover:text-white"><Icons.X /></button></div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                        <div className="aspect-square rounded-2xl bg-black/20 border-2 border-dashed border-brand-700 flex flex-col items-center justify-center relative overflow-hidden group hover:border-accent-primary/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            {previewImage ? (<img src={previewImage} alt="Preview" className="w-full h-full object-contain p-2" />) : (<><Icons.Upload className="w-10 h-10 text-brand-500 mb-2 group-hover:text-accent-primary transition-colors" /><span className="text-sm text-brand-400 font-medium">Carregar Foto</span></>)}
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            {uploadingImage && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div></div>}
                        </div>
                        <div className="bg-black/20 border border-brand-700 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden cursor-pointer hover:border-accent-primary/50 transition-colors" onClick={() => invoiceFileInputRef.current?.click()}>
                            {invoicePreview ? (
                                <div className="relative w-full h-full flex flex-col items-center">
                                    <Icons.FileText className="w-8 h-8 text-green-400 mb-2" />
                                    <span className="text-xs text-green-400 font-bold truncate w-full">Nota Anexada</span>
                                    <button onClick={handleRemoveInvoice} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white hover:bg-red-600"><Icons.X className="w-3 h-3" /></button>
                                </div>
                            ) : (
                                <>
                                    <Icons.FileText className="w-8 h-8 text-brand-500 mb-2" />
                                    <span className="text-xs text-brand-400 font-bold">Anexar Nota Fiscal (Opcional)</span>
                                </>
                            )}
                            <input type="file" ref={invoiceFileInputRef} onChange={handleInvoiceFileChange} className="hidden" accept="image/*,application/pdf" />
                        </div>
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Marca</label><input list="brands" className="w-full glass-input rounded-xl p-3 mt-1" placeholder="Ex: Sony" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} onBlur={() => setFormData(prev => ({...prev, brand: toTitleCase(prev.brand)}))} required /><datalist id="brands">{TOP_AV_BRANDS.map(b => <option key={b} value={b} />)}</datalist></div>
                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Modelo</label><input className="w-full glass-input rounded-xl p-3 mt-1" placeholder="Ex: A7S III" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} required /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Nº de Série</label><input className="w-full glass-input rounded-xl p-3 mt-1 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="S/N do equipamento" value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} required disabled={!!editingId} />{editingId && <span className="text-[10px] text-brand-500 ml-1 flex items-center gap-1"><Icons.Lock className="w-3 h-3" /> Imutável</span>}</div>
                            <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Categoria</label><select className="w-full glass-input rounded-xl p-3 mt-1" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as EquipmentCategory })}>{Object.values(EquipmentCategory).map(c => <option key={c} value={c} className="text-black">{c}</option>)}</select></div>
                        </div>
                        <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Valor Estimado (R$)</label><input type="number" className="w-full glass-input rounded-xl p-3 mt-1" placeholder="0,00" value={formData.value} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} /></div>
                        <div><label className="text-xs font-bold text-brand-400 uppercase ml-1">Descrição</label><textarea className="w-full glass-input rounded-xl p-3 mt-1 h-24 resize-none" placeholder="Detalhes, condições, acessórios inclusos..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                        <div className="flex gap-4 pt-2">
                            <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${formData.isForRent ? 'bg-accent-primary/20 border-accent-primary text-white' : 'bg-black/20 border-white/10 text-brand-400 hover:border-white/20'}`}><input type="checkbox" className="hidden" checked={formData.isForRent} onChange={e => handleRentToggle(e.target.checked)} /><Icons.ShoppingBag className={formData.isForRent ? 'text-accent-primary' : ''} /><div className="text-left"><span className="block font-bold text-sm">Disponível para Aluguel</span><span className="text-xs opacity-70">Listar no marketplace</span></div></label>
                            <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${formData.isForSale ? 'bg-green-500/20 border-green-500 text-white' : 'bg-black/20 border-white/10 text-brand-400 hover:border-white/20'}`}><input type="checkbox" className="hidden" checked={formData.isForSale} onChange={e => handleSaleToggle(e.target.checked)} /><Icons.Tag className={formData.isForSale ? 'text-green-500' : ''} /><div className="text-left"><span className="block font-bold text-sm">Disponível para Venda</span><span className="text-xs opacity-70">Listar para compradores</span></div></label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {formData.isForRent && <div><label className="text-xs font-bold text-accent-primary uppercase ml-1">Valor Diária (R$)</label><input type="number" className="w-full glass-input rounded-xl p-3 mt-1 border-accent-primary/50" placeholder="0,00" value={formData.rentalPrice} onChange={e => setFormData({ ...formData, rentalPrice: Number(e.target.value) })} /></div>}
                            {formData.isForSale && <div><label className="text-xs font-bold text-green-500 uppercase ml-1">Valor de Venda (R$)</label><input type="number" className="w-full glass-input rounded-xl p-3 mt-1 border-green-500/50" placeholder="0,00" value={formData.salePrice} onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })} /></div>}
                        </div>
                    </div>
                </div>
                {formErrors.length > 0 && <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl space-y-1">{formErrors.map((err, i) => <p key={i} className="text-red-400 text-xs font-bold flex items-center gap-2"><Icons.AlertTriangle className="w-3 h-3" /> {err}</p>)}</div>}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl font-bold text-brand-400 hover:text-white hover:bg-white/5 transition-colors">Cancelar</button>
                    <button type="submit" disabled={uploadingImage || formErrors.length > 0} className="px-8 py-3 rounded-xl font-bold bg-accent-primary text-brand-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">{uploadingImage ? 'Salvando...' : 'Salvar Equipamento'}</button>
                </div>
            </form>
        </div>)}

        {equipment.length > 0 && (<div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            <button onClick={() => setFilterCategory('ALL')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filterCategory === 'ALL' ? 'bg-white text-brand-950' : 'bg-white/5 text-brand-400 hover:bg-white/10'}`}>Todos</button>
            {Object.keys(groupedEquipment).map(cat => (<button key={cat} onClick={() => setFilterCategory(cat)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-white text-brand-950' : 'bg-white/5 text-brand-400 hover:bg-white/10'}`}>{cat} ({groupedEquipment[cat].length})</button>))}
        </div>)}

        <div className="space-y-10">
            {Object.entries(groupedEquipment).filter(([cat]) => filterCategory === 'ALL' || filterCategory === cat).map(([category, items]) => (
                <div key={category} className="animate-fade-in">
                    <h3 className="text-lg font-bold text-brand-300 mb-4 flex items-center gap-2 px-2"><span className="w-2 h-2 rounded-full bg-accent-primary"></span> {category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {(items as any[]).map(item => (
                            <div key={item.id} className="glass-card group rounded-3xl overflow-hidden hover:border-accent-primary/30 transition-all duration-500 relative">
                                <div className="aspect-video bg-black/40 relative overflow-hidden">
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-transparent to-transparent opacity-80"></div>
                                    <div className="absolute top-3 right-3 flex gap-2">
                                        {item.status === EquipmentStatus.STOLEN && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-lg shadow-red-500/20"><Icons.ShieldAlert className="w-3 h-3" /> ROUBADO</span>}
                                        {item.status === EquipmentStatus.TRANSFER_PENDING && <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-lg shadow-blue-500/20"><Icons.Clock className="w-3 h-3" /> EM TRANSFERÊNCIA</span>}
                                        {item.isForRent && item.status === EquipmentStatus.SAFE && <span className="bg-accent-primary text-brand-950 text-[10px] font-bold px-2 py-1 rounded-md shadow-lg shadow-cyan-500/20">ALUGUEL</span>}
                                        {item.isForSale && item.status === EquipmentStatus.SAFE && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg shadow-green-500/20">VENDA</span>}
                                    </div>
                                    {item.invoiceUrl && (
                                        <a href={item.invoiceUrl} target="_blank" rel="noopener noreferrer" className="absolute top-3 left-3 bg-white/10 hover:bg-white/20 backdrop-blur-md p-1.5 rounded-lg text-white transition-colors" title="Ver Nota Fiscal">
                                            <Icons.FileText className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                                <div className="p-5 relative">
                                    <div className="mb-4">
                                        <h4 className="text-lg font-bold text-white leading-tight mb-1 truncate">{item.name}</h4>
                                        <p className="text-xs text-brand-400 font-mono tracking-wider">S/N: {item.serialNumber}</p>
                                    </div>
                                    {item.status === EquipmentStatus.TRANSFER_PENDING ? (
                                        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                            <p className="text-xs text-blue-300 font-bold mb-2 text-center">Aguardando aceite...</p>
                                            <button onClick={() => handleCancelTransfer(item)} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-colors">Cancelar Transferência</button>
                                        </div>
                                    ) : item.status === EquipmentStatus.STOLEN ? (
                                        <button onClick={() => { setItemToRecover(item); setRecoverModalOpen(true); }} className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"><Icons.ShieldCheck className="w-4 h-4" /> Marcar como Recuperado</button>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                            <button onClick={() => handleEditClick(item)} className="bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl font-bold text-xs border border-white/5 transition-colors flex items-center justify-center gap-2"><Icons.Pencil className="w-3 h-3" /> Editar</button>
                                            <button onClick={() => handleTransferClick(item)} className="bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl font-bold text-xs border border-white/5 transition-colors flex items-center justify-center gap-2"><Icons.ArrowRight className="w-3 h-3" /> Transferir</button>
                                            <button onClick={() => promptDelete(item.id)} className="col-span-2 text-red-400 hover:text-red-300 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"><Icons.Trash2 className="w-3 h-3" /> Excluir Item</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {equipment.length === 0 && !isAdding && (
                <div className="text-center py-20 opacity-50">
                    <Icons.Camera className="w-16 h-16 mx-auto mb-4 text-brand-600" />
                    <p className="text-brand-400 font-medium">Seu inventário está vazio.</p>
                </div>
            )}
        </div>
      </div>
    );
};