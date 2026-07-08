import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { IBGEService } from '../services/ibge';
import { Icons } from './Icons';
import { CineSafeLogo } from './CineSafeLogo';

interface UF {
  id: number;
  sigla: string;
  nome: string;
}

interface City {
  id: number;
  nome: string;
}

/**
 * Gate obrigatório de localização.
 *
 * O cadastro por e-mail exige estado + cidade, mas o login com Google pula essa
 * etapa (o perfil nasce com `location: 'Brasil'`). Este modal — renderizado via
 * React Portal por cima de toda a aplicação autenticada (montado no `Layout`) —
 * bloqueia o acesso até o usuário informar Estado e Cidade. Não há como fechá-lo
 * (sem X, sem clique no backdrop, sem Esc): só o botão "Finalizar acesso" o dispensa.
 */
export const LocationGateModal: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [ufs, setUfs] = useState<UF[]>([]);
  const [selectedUf, setSelectedUf] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [loadingCities, setLoadingCities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Localização ausente: OAuth grava o placeholder 'Brasil' e pula cidade/estado.
  // Formato válido é "Cidade - UF".
  const isLocationMissing = !!user && (!user.location || user.location === 'Brasil' || !user.location.includes(' - '));

  // Carrega UFs quando o gate está ativo.
  useEffect(() => {
    if (isLocationMissing && ufs.length === 0) {
      IBGEService.getUFs().then(setUfs);
    }
  }, [isLocationMissing, ufs.length]);

  // Carrega cidades ao trocar de UF.
  useEffect(() => {
    if (!selectedUf) { setCities([]); return; }
    setLoadingCities(true);
    setSelectedCity('');
    IBGEService.getCitiesByUF(selectedUf).then(data => {
      setCities(data);
      setLoadingCities(false);
    });
  }, [selectedUf]);

  // Trava o scroll do body enquanto o gate está aberto.
  useEffect(() => {
    if (!isLocationMissing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isLocationMissing]);

  if (!isLocationMissing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedUf || !selectedCity) {
      setError('Selecione seu estado e sua cidade para continuar.');
      return;
    }
    if (!user) return;

    setSaving(true);
    const location = `${selectedCity} - ${selectedUf}`;
    const ok = await userService.updateUserProfile(user.id, { location });
    if (ok) {
      // refreshUser atualiza user.location → isLocationMissing vira false → modal desmonta.
      await refreshUser();
    } else {
      setError('Não foi possível salvar. Verifique sua conexão e tente novamente.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-brand-950/80 backdrop-blur-md animate-fade-in font-sans">
      {/* Mesh gradients de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-accent-secondary/10 rounded-full blur-[120px] animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-accent-primary/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="glass-card w-full max-w-md p-6 md:p-8 rounded-[2rem] relative z-10 border border-white/10 shadow-2xl flex flex-col items-center">
        <CineSafeLogo className="w-[38%] mb-4" />

        <div className="w-14 h-14 rounded-2xl bg-accent-primary/20 flex items-center justify-center text-accent-primary mb-4">
          <Icons.MapPin className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-1">Onde você está?</h2>
        <p className="text-brand-400 text-sm text-center mb-6">
          Precisamos da sua localização para conectar você com pessoas e equipamentos da sua região. É rápido e obrigatório para continuar.
        </p>

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm flex items-center gap-3 animate-fade-in">
            <Icons.AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">Estado</label>
            <div className="relative group">
              <Icons.MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors pointer-events-none" />
              <select
                className="w-full glass-input rounded-xl py-3.5 pl-14 pr-6 text-white font-medium appearance-none cursor-pointer"
                value={selectedUf}
                onChange={e => setSelectedUf(e.target.value)}
                required
              >
                <option value="" disabled>Selecione seu estado</option>
                {ufs.map(uf => (
                  <option key={uf.id} value={uf.sigla}>{uf.nome} ({uf.sigla})</option>
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
              <select
                className="w-full glass-input rounded-xl py-3.5 px-6 text-white font-medium appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                required
                disabled={!selectedUf || loadingCities}
              >
                <option value="" disabled>{!selectedUf ? 'Selecione o estado primeiro' : 'Selecione sua cidade'}</option>
                {cities.map(city => (
                  <option key={city.id} value={city.nome}>{city.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !selectedUf || !selectedCity}
            className="w-full bg-gradient-to-r from-accent-primary to-accent-blue text-brand-950 font-bold py-4 rounded-xl hover:shadow-glow hover:scale-[1.02] transition-all mt-2 text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {saving ? (
              <>
                <span className="w-5 h-5 border-2 border-brand-950/30 border-t-brand-950 rounded-full animate-spin"></span>
                Salvando...
              </>
            ) : 'Finalizar acesso'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
