

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../components/Icons';
import { IBGEService } from '../services/ibge.ts';
import { CineSafeLogo } from '../components/CineSafeLogo';
import { storeReferral } from '../services/auth';

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

  // Persiste o ?ref para sobreviver ao redirect do OAuth (Google). O cadastro por
  // e-mail usa o referralCode direto; o Google recupera do localStorage no getSession.
  useEffect(() => { if (referralCode) storeReferral(referralCode); }, [referralCode]);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();
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

    setSubmitting(true);
    // Pass referral code if exists
    const err = await register(formData.email, formData.password, formData.name, fullLocation, referralCode || undefined);
    if (err) {
      setError(err);
      setSubmitting(false);
    } else {
      setSuccessMsg('Cadastro realizado! Enviamos um e-mail de confirmação para você. Verifique sua caixa de entrada (e spam) para ativar sua conta e fazer login.');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const err = await loginWithGoogle();
    // Em caso de sucesso o navegador é redirecionado; só voltamos aqui em erro.
    if (err) {
      setError(err);
      setGoogleLoading(false);
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

      <div className="glass-card max-w-md w-full p-6 rounded-[2rem] relative z-10 border border-white/10 shadow-2xl flex flex-col items-center my-auto">

          <div className="mb-3 text-center flex flex-col items-center w-full">
            <CineSafeLogo className="w-[42%] mb-1.5 transition-transform duration-500" />
            <h2 className="text-base font-bold text-white">Crie sua conta</h2>
          </div>

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm flex items-center gap-3 animate-fade-in">
              <Icons.AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {successMsg && (
            <div className="w-full bg-green-500/10 border border-green-500/20 text-green-400 p-6 rounded-2xl mb-2 text-center animate-fade-in">
              <Icons.CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="font-bold mb-2">Sucesso!</p>
              <p className="text-sm">{successMsg}</p>
              <Link to="/login" className="block mt-4 bg-green-500 hover:bg-green-400 text-brand-950 font-bold py-3 rounded-xl transition-colors">
                Ir para o Login
              </Link>
            </div>
          )}

          {!successMsg && (
            <form onSubmit={handleSubmit} className="w-full space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Nome Completo</label>
            <div className="relative group">
                <Icons.User className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                <input
                  type="text"
                  required
                  className="w-full glass-input rounded-xl py-3 pl-14 pr-6 text-white placeholder-brand-600 font-medium"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Estado</label>
              <div className="relative group">
                <Icons.MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors pointer-events-none" />
                 <select
                    className="w-full glass-input rounded-xl py-3 pl-14 pr-6 text-white placeholder-brand-600 font-medium appearance-none"
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
            <div className="space-y-1">
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
                    className="w-full glass-input rounded-xl py-3 pl-6 pr-6 text-white placeholder-brand-600 font-medium disabled:opacity-50"
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

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">E-mail</label>
            <div className="relative group">
                <Icons.Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                <input
                  type="email"
                  required
                  className="w-full glass-input rounded-xl py-3 pl-14 pr-6 text-white placeholder-brand-600 font-medium"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Senha</label>
            <div className="relative group">
                <Icons.Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                <input
                  type="password"
                  required
                  className="w-full glass-input rounded-xl py-3 pl-14 pr-6 text-white placeholder-brand-600 font-medium"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.02] transition-all mt-2 text-base flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                Criando conta...
              </>
            ) : 'Criar Conta'}
          </button>
        </form>
        )}

        {!successMsg && (
        <div className="w-full mt-4">
            <div className="relative flex items-center mb-3">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-brand-500 text-xs font-bold uppercase tracking-wider">Ou cadastre-se com</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                type="button"
                className="w-full bg-white text-brand-950 font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-brand-950/30 border-t-brand-950 rounded-full animate-spin"></span>
                    Conectando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {!successMsg && (
        <div className="mt-4 text-center w-full">
          <div className="text-sm text-brand-400">
            Já tem conta?{' '}
            <Link to="/login" className="text-accent-primary hover:text-white font-bold transition-colors">
              Fazer Login
            </Link>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
