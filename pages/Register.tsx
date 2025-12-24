

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../components/Icons';
import { IBGEService } from '../services/ibge.ts';
import { CineSafeLogo } from '../components/CineSafeLogo';

interface UF {
  id: number;
  sigla: string;
  nome: string;
}

interface City {
  id: number;
  nome: string;
}

export const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  
  // Location State
  const [ufs, setUfs] = useState<UF[]>([]);
  const [selectedUf, setSelectedUf] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [loadingCities, setLoadingCities] = useState(false);

  // Referral
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');

  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  // Load UFs on mount
  useEffect(() => {
    const loadUfs = async () => {
      const data = await IBGEService.getUFs();
      setUfs(data);
    };
    loadUfs();
  }, []);

  // Load Cities when UF changes
  useEffect(() => {
    const loadCities = async () => {
      if (selectedUf) {
        setLoadingCities(true);
        const data = await IBGEService.getCitiesByUF(selectedUf);
        setCities(data);
        setLoadingCities(false);
        setSelectedCity('');
      } else {
        setCities([]);
      }
    };
    loadCities();
  }, [selectedUf]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    if (!selectedUf || !selectedCity) {
        setError("Por favor, selecione seu estado e cidade.");
        return;
    }

    const fullLocation = `${selectedCity} - ${selectedUf}`;
    
    // Pass referral code if exists
    const err = await register(formData.email, formData.password, formData.name, fullLocation, referralCode || undefined);
    if (err) {
      setError(err);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-brand-950 font-sans">
      {/* Mesh Gradients Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-accent-secondary/10 rounded-full blur-[120px] animate-float"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-accent-primary/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>
         <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-blue-600/10 rounded-full blur-[100px] animate-float" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="glass-card max-w-md w-full p-8 md:p-10 rounded-[2.5rem] relative z-10 border border-white/10 shadow-2xl flex flex-col items-center">
        
        <div className="mb-8 text-center flex flex-col items-center w-full">
          <CineSafeLogo className="w-1/2 mb-6" />
          <h1 className="text-3xl font-bold text-white tracking-tight">Crie sua conta</h1>
          <p className="text-brand-300 mt-2">Junte-se a milhares de profissionais.</p>
          {referralCode && (
              <div className="mt-4 text-xs bg-accent-primary/10 text-accent-primary py-1.5 px-3 rounded-full inline-block font-bold">
                  Você foi convidado!
              </div>
          )}
        </div>

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3 animate-fade-in">
            <Icons.AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Nome Completo</label>
            <div className="relative group">
                <Icons.User className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                <input 
                  type="text" 
                  required
                  className="w-full glass-input rounded-2xl py-4 pl-14 pr-6 text-white placeholder-brand-600 font-medium"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Estado</label>
              <div className="relative group">
                <Icons.MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors pointer-events-none" />
                 <select
                    className="w-full glass-input rounded-2xl py-4 pl-14 pr-6 text-white placeholder-brand-600 font-medium appearance-none"
                    value={selectedUf}
                    onChange={(e) => setSelectedUf(e.target.value)}
                    required
                >
                    <option value="" disabled>UF</option>
                    {ufs.map(uf => (
                        <option key={uf.id} value={uf.sigla}>{uf.sigla}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Cidade</label>
              <div className="relative group">
                {loadingCities && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
                )}
                 <input 
                    type="text" 
                    required
                    list="city-options"
                    disabled={!selectedUf}
                    placeholder={!selectedUf ? "Selecione UF" : "Sua cidade"}
                    className="w-full glass-input rounded-2xl py-4 pl-6 pr-6 text-white placeholder-brand-600 font-medium disabled:opacity-50"
                    value={selectedCity}
                    onChange={e => setSelectedCity(e.target.value)}
                />
                <datalist id="city-options">
                    {cities.map(city => (
                        <option key={city.id} value={city.nome} />
                    ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">E-mail</label>
            <div className="relative group">
                <Icons.Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                <input 
                  type="email" 
                  required
                  className="w-full glass-input rounded-2xl py-4 pl-14 pr-6 text-white placeholder-brand-600 font-medium"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Senha</label>
            <div className="relative group">
                <Icons.Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                <input 
                  type="password" 
                  required
                  className="w-full glass-input rounded-2xl py-4 pl-14 pr-6 text-white placeholder-brand-600 font-medium"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold py-4 rounded-2xl hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.02] transition-all mt-4 text-lg"
          >
            Criar Conta
          </button>
        </form>

        <div className="mt-8 text-center w-full">
          <div className="text-sm text-brand-400">
            Já tem conta?{' '}
            <Link to="/login" className="text-accent-primary hover:text-white font-bold transition-colors">
              Fazer Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};