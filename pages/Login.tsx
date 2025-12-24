
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../components/Icons';
import { CineSafeLogo } from '../components/CineSafeLogo';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = await login(email, password);
    if (err) setError(err);
    else navigate('/');
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-brand-950 font-sans relative">
      <div className="min-h-full flex items-center justify-center p-4">
        {/* Mesh Gradients Background - Fixed to viewport */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-accent-secondary/10 rounded-full blur-[120px] animate-float"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-accent-primary/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>
           <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-blue-600/10 rounded-full blur-[100px] animate-float" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="glass-card max-w-md w-full p-8 md:p-10 rounded-[2.5rem] relative z-10 border border-white/10 shadow-2xl flex flex-col items-center my-auto">
          
          <div className="mb-8 text-center flex flex-col items-center w-full">
            <CineSafeLogo className="w-[71%] mb-6 transition-transform duration-500" />
          </div>

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3 animate-fade-in">
              <Icons.AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-400 uppercase tracking-widest ml-4">E-mail</label>
              <div className="relative group">
                  <Icons.Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                  <input 
                  type="email" 
                  required
                  className="w-full glass-input rounded-2xl py-4 pl-14 pr-6 text-white placeholder-brand-600 font-medium"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-accent-primary to-accent-blue text-brand-950 font-bold py-4 rounded-2xl hover:shadow-glow hover:scale-[1.02] transition-all mt-4 text-lg"
            >
              Entrar
            </button>
          </form>

          <div className="mt-8 text-center w-full">
            <div className="text-sm text-brand-400">
              Não tem conta?{' '}
              <Link to="/register" className="text-accent-primary hover:text-white font-bold transition-colors">
                Cadastrar agora
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
