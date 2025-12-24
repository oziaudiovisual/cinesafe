import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { equipmentService } from '../services/equipmentService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { Equipment, EquipmentStatus } from '../types';
import { Icons } from '../components/Icons';

export const TheftReport: React.FC = () => {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [geoCoords, setGeoCoords] = useState<{lat: number, lng: number} | null>(null);
  const [address, setAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (user) {
        const loadSafeItems = async () => {
            const userEq = await equipmentService.getUserEquipment(user.id);
            setEquipment(userEq.filter(e => e.status === EquipmentStatus.SAFE));
        };
        loadSafeItems();
    }
  }, [user]);

  // Map Initialization Logic
  useEffect(() => {
    // Cleanup function to remove map instance when component unmounts or step changes
    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
        }
    };
  }, [step]);

  useEffect(() => {
    if (step === 2 && mapContainerRef.current && !mapInstanceRef.current) {
        // Default to Brazil center if geolocation fails initially
        const defaultLat = -23.5505; 
        const defaultLng = -46.6333;

        const initMap = (lat: number, lng: number) => {
            if (mapInstanceRef.current) return;

            setGeoCoords({ lat, lng });
            fetchAddress(lat, lng);

            const map = L.map(mapContainerRef.current!).setView([lat, lng], 15);
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                maxZoom: 20
            }).addTo(map);

            // Custom Icon
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(239,68,68,0.5);"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([lat, lng], { 
                draggable: true,
                icon: icon 
            }).addTo(map);
            
            marker.bindPopup("<b>Arraste-me</b> para o local exato.").openPopup();
            markerRef.current = marker;

            // Event: Drag End
            marker.on('dragend', async (e: any) => {
                const { lat, lng } = e.target.getLatLng();
                setGeoCoords({ lat, lng });
                await fetchAddress(lat, lng);
                map.panTo([lat, lng]);
            });

            // Event: Map Click
            map.on('click', async (e: any) => {
                const { lat, lng } = e.latlng;
                marker.setLatLng([lat, lng]);
                setGeoCoords({ lat, lng });
                await fetchAddress(lat, lng);
                map.panTo([lat, lng]);
            });

            mapInstanceRef.current = map;
            
            // Fix layout issues after render - Increased timeout to match fade-in animation
            setTimeout(() => {
                map.invalidateSize();
            }, 600);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    initMap(pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                    console.warn("Geolocation error:", err);
                    initMap(defaultLat, defaultLng); // Fallback
                },
                { enableHighAccuracy: true }
            );
        } else {
            initMap(defaultLat, defaultLng);
        }
    }
  }, [step]);
  
  const fetchAddress = async (lat: number, lng: number) => {
      setIsFetchingAddress(true);
      try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await response.json();
          if (data && data.display_name) {
              // Simplify address for display
              const parts = data.display_name.split(', ');
              const simpleAddress = parts.slice(0, 3).join(', ');
              setAddress(simpleAddress || data.display_name);
          } else {
              setAddress("Localização no mapa");
          }
      } catch (error) {
          setAddress("Endereço aproximado (mapa)");
      } finally {
          setIsFetchingAddress(false);
      }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const submitReport = async () => {
    if (!user) return;
    setProcessing(true);
    
    const allUserEq = await equipmentService.getUserEquipment(user.id);
    const updates = allUserEq.filter(item => selectedIds.has(item.id)).map(item => ({ ...item, status: EquipmentStatus.STOLEN, theftDate: new Date().toISOString(), theftLocation: geoCoords || undefined, theftAddress: address }));
    
    for (const item of updates) {
        await equipmentService.updateEquipment(item);
    }

    await userService.incrementUserStat(user.id, 'reportsCount');
    setProcessing(false);
    setStep(3);
  };
  
  const handleCenterOnPin = (e: React.MouseEvent) => {
      e.preventDefault();
      if(mapInstanceRef.current && geoCoords) {
          mapInstanceRef.current.setView([geoCoords.lat, geoCoords.lng], 15);
      }
  };

  const handleManualLocation = () => {
      // Fallback for manual trigger
      if (navigator.geolocation && mapInstanceRef.current && markerRef.current) {
          navigator.geolocation.getCurrentPosition((pos) => {
              const { latitude, longitude } = pos.coords;
              mapInstanceRef.current.setView([latitude, longitude], 15);
              markerRef.current.setLatLng([latitude, longitude]);
              setGeoCoords({ lat: latitude, lng: longitude });
              fetchAddress(latitude, longitude);
          });
      }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 pb-20">
        {step === 1 && (
            <div className="animate-fade-in space-y-8">
                <div className="text-center">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><Icons.ShieldAlert className="w-10 h-10 text-red-500" /></div>
                    <h1 className="text-3xl font-bold text-white mb-2">Reportar Roubo</h1>
                    <p className="text-brand-400">Selecione os itens que foram roubados ou furtados.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {equipment.length === 0 ? (
                        <div className="col-span-2 text-center p-8 border border-white/10 rounded-2xl bg-white/5">
                            <p className="text-brand-400">Você não tem equipamentos seguros para reportar.</p>
                        </div>
                    ) : (
                        equipment.map(item => (
                            <div key={item.id} onClick={() => toggleSelection(item.id)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4 ${selectedIds.has(item.id) ? 'bg-red-500/20 border-red-500' : 'bg-brand-900 border-white/10 hover:border-white/30'}`}>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedIds.has(item.id) ? 'border-red-500 bg-red-500 text-white' : 'border-brand-500'}`}>
                                    {selectedIds.has(item.id) && <Icons.CheckCircle className="w-4 h-4" />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold">{item.name}</h3>
                                    <p className="text-xs text-brand-400 font-mono">{item.serialNumber}</p>
                                </div>
                                <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-black/40" />
                            </div>
                        ))
                    )}
                </div>

                <button onClick={() => setStep(2)} disabled={selectedIds.size === 0} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/20 disabled:opacity-50 transition-all">
                    Continuar (Localização)
                </button>
            </div>
        )}

        {step === 2 && (
            <div className="animate-fade-in space-y-6 h-full flex flex-col">
                <div className="text-center mb-2">
                    <h2 className="text-2xl font-bold text-white">Onde aconteceu?</h2>
                    <p className="text-brand-400 text-sm">Arraste o pino ou clique no mapa para marcar o local.</p>
                </div>

                <div className="flex-1 min-h-[400px] bg-brand-900 rounded-2xl overflow-hidden relative border border-white/10">
                    <div ref={mapContainerRef} className="absolute inset-0 z-0" />
                    <button onClick={handleManualLocation} className="absolute bottom-4 right-4 bg-brand-800 p-3 rounded-full text-white shadow-lg z-[400] hover:bg-brand-700 border border-white/10" title="Minha localização atual">
                        <Icons.Navigation className="w-5 h-5" />
                    </button>
                </div>

                <div className="bg-brand-900 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                        <Icons.MapPin className="text-red-500 w-5 h-5" />
                        <span className="text-brand-400 text-xs font-bold uppercase tracking-widest">Local Selecionado</span>
                    </div>
                    {isFetchingAddress ? (
                        <div className="h-6 w-3/4 bg-white/10 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-white font-medium">{address}</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setStep(1)} className="bg-brand-800 hover:bg-brand-700 text-white font-bold py-4 rounded-xl transition-all">Voltar</button>
                    <button onClick={submitReport} disabled={processing || !geoCoords} className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {processing ? 'Registrando...' : 'Confirmar Reporte'}
                    </button>
                </div>
            </div>
        )}

        {step === 3 && (
            <div className="animate-fade-in text-center py-10">
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icons.CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Ocorrência Registrada</h2>
                <p className="text-brand-300 max-w-md mx-auto mb-8">
                    Seus itens foram marcados como ROUBADOS na base global. Se alguém tentar verificar o serial, receberá um alerta vermelho imediatamente.
                </p>
                <Link to="/" className="bg-brand-800 hover:bg-brand-700 text-white font-bold px-8 py-3 rounded-xl transition-all inline-block">
                    Voltar ao Início
                </Link>
            </div>
        )}
    </div>
  );
};