import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { Icons } from '../components/Icons';
import { IBGEService } from '../services/ibge';
import { useNavigate } from 'react-router-dom';

interface UF {
  id: number;
  sigla: string;
  nome: string;
}

interface City {
  id: number;
  nome: string;
}

export const Profile: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ name: '', contactPhone: '' });
    const [ufs, setUfs] = useState<UF[]>([]);
    const [selectedUf, setSelectedUf] = useState('');
    const [cities, setCities] = useState<City[]>([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);

    useEffect(() => { IBGEService.getUFs().then(setUfs); }, []);
    useEffect(() => { if (user) { setFormData({ name: user.name || '', contactPhone: user.contactPhone || '' }); setAvatarPreview(user.avatarUrl); if (user.location && user.location.includes(' - ')) { const parts = user.location.split(' - '); const uf = parts.pop(); const city = parts.join(' - '); if (uf) setSelectedUf(uf); if (city) setSelectedCity(city); } else if (user.location) { setSelectedCity(user.location); } } }, [user]);
    useEffect(() => { if (selectedUf) { IBGEService.getCitiesByUF(selectedUf).then(setCities); } else { setCities([]); } }, [selectedUf]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files && e.target.files[0]) { 
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        } 
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true); setSuccessMsg(''); setErrorMsg('');
        if (!selectedUf || !selectedCity) { setErrorMsg("Selecione Estado e Cidade."); setLoading(false); return; }
        if (!formData.contactPhone || formData.contactPhone.trim() === '') { setErrorMsg("O WhatsApp é obrigatório."); setLoading(false); return; }
        
        const fullLocation = `${selectedCity} - ${selectedUf}`;
        let finalAvatarUrl = user.avatarUrl;

        try {
            if (avatarFile) {
                const url = await userService.uploadUserAvatar(avatarFile, user.id);
                if (url) finalAvatarUrl = url;
            }
        } catch (e: any) {
            if (e.message === 'CORS_CONFIG_ERROR') setErrorMsg("Falha de Upload: Erro de CORS. Verifique a configuração do servidor.");
            else setErrorMsg("Erro no upload do avatar.");
            setLoading(false); return;
        }

        const success = await userService.updateUserProfile(user.id, { name: formData.name, location: fullLocation, contactPhone: formData.contactPhone, avatarUrl: finalAvatarUrl });
        if (success) {
            await refreshUser();
            setSuccessMsg('Perfil atualizado! Redirecionando...');
            setTimeout(() => navigate('/'), 1500);
        } else {
            setErrorMsg('Erro ao atualizar perfil.');
            setLoading(false);
        }
    };
    
    return (
        <div className="max-w-2xl mx-auto py-10">
            <h1 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                <Icons.Settings className="w-8 h-8 text-brand-400" /> Editar Perfil
            </h1>

            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5">
                {successMsg && <div className="bg-green-500/20 text-green-400 p-4 rounded-xl mb-6 text-center font-bold border border-green-500/30">{successMsg}</div>}
                {errorMsg && <div className="bg-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-center font-bold border border-red-500/30">{errorMsg}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand-700 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-brand-800 flex items-center justify-center text-brand-500"><Icons.User className="w-12 h-12" /></div>
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Icons.Camera className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        <p className="text-xs text-brand-400 mt-2">Toque para alterar a foto</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-brand-400 uppercase ml-1">Nome Completo</label>
                        <div className="relative group">
                            <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5" />
                            <input type="text" className="w-full glass-input rounded-xl py-3 pl-12 pr-4 text-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-brand-400 uppercase ml-1">Estado</label>
                            <div className="relative group">
                                <Icons.MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-4 h-4 pointer-events-none" />
                                <select className="w-full glass-input rounded-xl py-3 pl-10 pr-8 appearance-none cursor-pointer" value={selectedUf} onChange={e => setSelectedUf(e.target.value)} required>
                                    <option value="" disabled>UF</option>
                                    {ufs.map(uf => <option key={uf.id} value={uf.sigla}>{uf.sigla}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-brand-400 uppercase ml-1">Cidade</label>
                            <div className="relative group">
                                <select className="w-full glass-input rounded-xl py-3 px-4 appearance-none cursor-pointer disabled:opacity-50" value={selectedCity} onChange={e => setSelectedCity(e.target.value)} required disabled={!selectedUf}>
                                    <option value="">Selecione</option>
                                    {cities.map(city => <option key={city.id} value={city.nome}>{city.nome}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-brand-400 uppercase ml-1">WhatsApp (DDD + Número)</label>
                        <div className="relative group">
                            <Icons.MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5" />
                            <input type="tel" className="w-full glass-input rounded-xl py-3 pl-12 pr-4 text-white" placeholder="11999999999" value={formData.contactPhone} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} required />
                        </div>
                        <p className="text-[10px] text-brand-500 ml-1">Essencial para que outros usuários entrem em contato.</p>
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-accent-primary hover:bg-cyan-400 text-brand-950 font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6">
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </form>
            </div>
        </div>
    );
};