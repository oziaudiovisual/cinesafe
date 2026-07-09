import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { equipmentService } from '../services/equipmentService';
import { Equipment, EquipmentCategory } from '../types';
import { Icons } from '../components/Icons';
import { CineSafeLogo } from '../components/CineSafeLogo';
import { formatCurrency } from '../utils/formatters';

// Página pública (aberta a qualquer visitante). A pessoa pode navegar pela
// vitrine, mas qualquer AÇÃO (ver detalhes, ter interesse, anunciar, verificar
// serial etc.) exige login/cadastro. Todos os botões levam para /login ou /register.
export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rentals, sales] = await Promise.all([
          equipmentService.getRentalsPaginated(null, 24, {}),
          equipmentService.getSalesPaginated(null, 24, {}),
        ]);
        // Deduplica por item: um equipamento que está para aluguel E venda aparece
        // uma única vez (com as duas etiquetas), em vez de duplicado.
        const byId = new Map<string, Equipment>();
        [...rentals.data, ...sales.data].forEach(item => {
          if (!byId.has(item.id)) byId.set(item.id, item);
        });
        const combined = Array.from(byId.values());
        // Embaralha (Fisher-Yates) para exibir itens aleatórios a cada visita
        for (let i = combined.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combined[i], combined[j]] = [combined[j], combined[i]];
        }
        if (mounted) setListings(combined);
      } catch (e) {
        // Degrada com elegância: se a leitura pública falhar, a página segue
        // mostrando o hero e as chamadas para ação (sem quebrar).
        console.warn('Vitrine pública indisponível:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const goToLogin = () => navigate('/login');
  const goToRegister = () => navigate('/register');

  const filtered = useMemo(
    () => (filterCategory ? listings.filter(it => it.category === filterCategory) : listings),
    [listings, filterCategory]
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-brand-950 font-sans text-brand-50 custom-scrollbar">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent-secondary/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[-10%] w-[55%] h-[55%] bg-accent-primary/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Public Top Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-brand-950/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <CineSafeLogo size={34} />
          <div className="flex items-center gap-2 md:gap-3">
            <Link to="/login" className="px-4 py-2 rounded-xl text-sm font-bold text-brand-200 hover:text-white hover:bg-white/5 transition-colors">
              Entrar
            </Link>
            <Link to="/register" className="px-4 py-2 rounded-xl text-sm font-bold bg-accent-primary text-brand-950 hover:bg-cyan-300 transition-colors shadow-lg shadow-cyan-500/20">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pb-24">
        {/* Hero */}
        <section className="pt-14 md:pt-20 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-brand-300 mb-6">
            <Icons.ShieldCheck className="w-4 h-4 text-accent-primary" /> Segurança para o audiovisual
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
            Alugue, compre e proteja <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-glow-text">equipamentos de fotografia e vídeo</span>
          </h1>
          <p className="text-brand-300 text-lg max-w-2xl mx-auto mb-8">
            O marketplace dos profissionais de audiovisual: câmeras, lentes, drones e áudio de gente
            verificada. Com inventário protegido e verificação antirroubo por número de série.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={goToRegister} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-accent-primary text-brand-950 font-bold hover:bg-cyan-300 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
              Criar conta grátis <Icons.ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={goToLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all">
              Já tenho conta
            </button>
          </div>
        </section>

        {/* Search (gated) */}
        <form
          onSubmit={(e) => { e.preventDefault(); goToLogin(); }}
          className="relative max-w-2xl mx-auto mb-10 group"
          title="Entre para buscar equipamentos"
        >
          <Icons.Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-500 w-5 h-5" />
          <input
            type="text"
            readOnly
            onFocus={goToLogin}
            onClick={goToLogin}
            placeholder="Buscar câmeras, lentes, drones... (entre para buscar)"
            className="w-full glass-input rounded-2xl py-4 pl-14 pr-32 text-sm cursor-pointer"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl bg-accent-primary text-brand-950 text-sm font-bold hover:bg-cyan-300 transition-colors">
            Buscar
          </button>
        </form>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6 justify-start md:justify-center">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filterCategory === '' ? 'bg-white text-brand-950' : 'bg-white/5 text-brand-400 hover:bg-white/10'}`}
          >
            Todos
          </button>
          {Object.values(EquipmentCategory).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-white text-brand-950' : 'bg-white/5 text-brand-400 hover:bg-white/10'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalog */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Icons.ShoppingBag className="w-6 h-6 text-accent-primary" /> Vitrine
            </h2>
            <span className="text-xs text-brand-500 font-medium hidden sm:flex items-center gap-1">
              <Icons.Lock className="w-3 h-3" /> Entre para negociar
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-72 rounded-[2rem] bg-white/5 animate-pulse"></div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-[2.5rem] border border-white/5">
              <Icons.Camera className="w-14 h-14 mx-auto mb-4 text-brand-600" />
              <p className="text-brand-300 font-bold mb-1">A vitrine está começando agora.</p>
              <p className="text-brand-500 text-sm mb-6">Crie sua conta e seja um dos primeiros a anunciar seus equipamentos.</p>
              <button onClick={goToRegister} className="px-6 py-3 rounded-xl bg-accent-primary text-brand-950 font-bold hover:bg-cyan-300 transition-colors">
                Anunciar meu equipamento
              </button>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.slice(0, 6).map((item, index) => {
                return (
                  <div
                    key={`${item.id}-${index}`}
                    onClick={goToLogin}
                    className="glass-card rounded-[2rem] overflow-hidden group cursor-pointer flex flex-col transition-all duration-300 hover:border-accent-primary/30"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-black/40">
                      <img src={item.imageUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-transparent to-transparent opacity-60"></div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-xl font-bold text-white leading-tight drop-shadow-lg truncate">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-md border border-white/10">{item.brand}</span>
                          <span className="text-xs text-brand-300 font-mono">{item.model}</span>
                        </div>
                      </div>
                      <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
                        {item.isForRent && <span className="bg-accent-primary text-brand-950 text-[10px] font-bold px-2 py-1 rounded-md shadow-lg">ALUGUEL</span>}
                        {item.isForSale && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg">VENDA</span>}
                      </div>
                      <div className="absolute top-4 right-4 flex flex-col gap-1.5 items-end">
                        {item.isForRent && (
                          <span className="bg-accent-primary text-brand-950 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                            {formatCurrency(item.rentalPricePerDay ?? 0)}/dia
                          </span>
                        )}
                        {item.isForSale && (
                          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                            {formatCurrency(item.salePrice ?? 0)}
                          </span>
                        )}
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
                        <span className="text-sm text-brand-300 font-medium truncate max-w-[120px]">
                          {item.ownerProfile?.name?.split(' ')[0] || 'Profissional'}
                        </span>
                        <span className="text-xs font-bold bg-white/5 text-white px-4 py-2 rounded-lg border border-white/10 flex items-center gap-2">
                          Ver <Icons.ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length > 6 && (
              <div className="text-center mt-8">
                <button onClick={goToRegister} className="px-8 py-3 rounded-xl bg-white/5 text-white font-bold border border-white/10 hover:bg-accent-primary/10 hover:border-accent-primary/30 transition-all inline-flex items-center gap-2">
                  Ver todos os {filtered.length} equipamentos <Icons.ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
            </>
          )}
        </section>

        {/* Why CineSafe */}
        <section className="pt-16">
          <h2 className="text-3xl font-bold text-white text-center mb-3">Por que usar o Cine Safe?</h2>
          <p className="text-brand-400 text-center mb-10 max-w-xl mx-auto">Uma plataforma feita para proteger e movimentar o patrimônio de quem vive de audiovisual.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Feature icon={Icons.Camera} title="Inventário protegido" text="Cadastre seus equipamentos com foto, nota fiscal e número de série." />
            <Feature icon={Icons.Search} title="Verificação antirroubo" text="Consulte o número de série antes de comprar um equipamento usado." />
            <Feature icon={Icons.ShoppingBag} title="Aluguel e venda" text="Anuncie e encontre equipamentos perto de você, sem intermediário." />
            <Feature icon={Icons.Users} title="Rede de confiança" text="Conecte-se a profissionais verificados e transfira itens com segurança." />
          </div>
        </section>

        {/* How it works */}
        <section className="pt-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10">Como funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Step n="1" title="Crie sua conta" text="Cadastro grátis em segundos com e-mail e senha." />
            <Step n="2" title="Cadastre seus itens" text="Monte seu inventário e ative aluguel ou venda quando quiser." />
            <Step n="3" title="Negocie com segurança" text="Fale com pessoas verificadas e feche negócio com confiança." />
          </div>
        </section>

        {/* Final CTA */}
        <section className="pt-16">
          <div className="glass-card rounded-[2.5rem] p-10 md:p-14 text-center border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 relative z-10">Pronto para proteger seu equipamento?</h2>
            <p className="text-brand-300 mb-8 relative z-10">Crie sua conta gratuita e comece a usar todas as funcionalidades.</p>
            <button onClick={goToRegister} className="relative z-10 px-10 py-4 rounded-2xl bg-accent-primary text-brand-950 font-bold hover:bg-cyan-300 transition-all shadow-lg shadow-cyan-500/20 inline-flex items-center gap-2">
              Criar conta grátis <Icons.ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <CineSafeLogo size={28} />
          <p className="text-brand-500 text-xs">© {new Date().getFullYear()} Cine Safe. Segurança no Audiovisual.</p>
          <div className="flex items-center gap-4 text-sm font-bold">
            <Link to="/login" className="text-brand-300 hover:text-white transition-colors">Entrar</Link>
            <Link to="/register" className="text-accent-primary hover:text-cyan-300 transition-colors">Criar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Feature: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({ icon: Icon, title, text }) => (
  <div className="glass-card rounded-[2rem] p-6 border border-white/5 hover:border-accent-primary/20 transition-colors">
    <div className="w-12 h-12 rounded-xl bg-accent-primary/15 flex items-center justify-center text-accent-primary mb-4">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
    <p className="text-brand-400 text-sm leading-relaxed">{text}</p>
  </div>
);

const Step: React.FC<{ n: string; title: string; text: string }> = ({ n, title, text }) => (
  <div className="glass-card rounded-[2rem] p-6 border border-white/5 relative">
    <div className="w-10 h-10 rounded-full bg-accent-primary text-brand-950 font-extrabold flex items-center justify-center mb-4">{n}</div>
    <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
    <p className="text-brand-400 text-sm leading-relaxed">{text}</p>
  </div>
);
