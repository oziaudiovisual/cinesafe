import React, { useEffect, useState, useRef } from 'react';
import { userService } from '../services/userService';
import { Icons } from '../components/Icons';

interface ReportPoint {
  lat: number;
  lng: number;
  address: string;
  date: string;
  itemName: string;
}

interface Hotspot {
  name: string;
  count: number;
}

export const SafetyMap: React.FC = () => {
  const [reports, setReports] = useState<ReportPoint[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [recentThefts, setRecentThefts] = useState<ReportPoint[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    const loadData = async () => {
      const data = await userService.getCommunitySafetyData();
      setReports(data);
      
      // Process Hotspots (Grouping by City/Neighborhood from address string)
      const locationCounts: Record<string, number> = {};
      
      data.forEach(r => {
        if (!r.address) return;
        
        // Try to extract "Neighborhood - City"
        // Format varies: "Rua X, 123 - Bairro, Cidade - UF"
        // Simple heuristic: Take the part before " - UF"
        const parts = r.address.split(' - ');
        let locationKey = "Desconhecido";

        if (parts.length >= 3) {
            // Likely: [Street], [Neighborhood], [City], [UF] (depends on formatting)
            // Let's just take the City (2nd to last) or Neighborhood (3rd to last) if available
            // Strategy: Remove the UF (last part) and Street (first part) to find the "Area"
            const uf = parts[parts.length - 1];
            const city = parts[parts.length - 2];
            const neighborhood = parts.length > 3 ? parts[parts.length - 3] : null;
            
            if (neighborhood) {
                locationKey = `${neighborhood}, ${city} - ${uf}`;
            } else {
                locationKey = `${city} - ${uf}`;
            }
        } else {
            locationKey = r.address; // Fallback
        }

        locationCounts[locationKey] = (locationCounts[locationKey] || 0) + 1;
      });

      const sortedHotspots = Object.entries(locationCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5
      
      setHotspots(sortedHotspots);

      // Process Recent - Filter out "Item Recuperado/Histórico"
      const sortedRecent = [...data]
        .filter(item => item.itemName !== 'Item Recuperado/Histórico')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
        
      setRecentThefts(sortedRecent);
    };

    loadData();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current && reports.length > 0) {
       // Center on the most recent theft or default SP
       const center = reports[0] ? [reports[0].lat, reports[0].lng] : [-23.5505, -46.6333];

       const map = L.map(mapContainerRef.current).setView(center, 10);

       // Switch to Light Mode (CartoDB Positron) for "White" background
       L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
           attribution: '&copy; OpenStreetMap &copy; CARTO',
           maxZoom: 20
       }).addTo(map);

       // Add Heatmap-like Circles
       reports.forEach(r => {
           // Different color for recovered items vs active stolen
           const isRecovered = r.itemName === 'Item Recuperado/Histórico';
           
           L.circle([r.lat, r.lng], {
               color: isRecovered ? '#3b82f6' : '#ef4444', // Blue for history, Red for active
               fillColor: isRecovered ? '#3b82f6' : '#ef4444',
               fillOpacity: 0.5,
               radius: 300 // 300 meters radius
           }).addTo(map).bindPopup(`
               <div style="color: #333;">
                   <strong>${r.itemName}</strong><br/>
                   <small>${new Date(r.date).toLocaleDateString()}</small><br/>
                   ${r.address}
                   ${isRecovered ? '<br/><span style="color:blue; font-weight:bold;">Recuperado</span>' : ''}
               </div>
           `);
       });

       mapInstanceRef.current = map;
    }
  }, [reports]);

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Icons.Siren className="w-8 h-8 text-red-500" />
            Mapa de Segurança
          </h1>
          <p className="text-brand-400">Áreas de risco e histórico de incidentes na comunidade.</p>
        </div>
        
        <div className="bg-red-900/20 border border-red-500/30 px-4 py-2 rounded-lg flex items-center gap-3">
            <Icons.AlertTriangle className="text-red-500 w-5 h-5" />
            <div>
                <span className="block text-xs text-red-400 uppercase font-bold">Total de Ocorrências</span>
                <span className="text-xl font-bold text-white">{reports.length}</span>
            </div>
        </div>
      </div>

      {/* Main Map - Set bg-white for container */}
      <div className="bg-white rounded-xl border border-brand-700 overflow-hidden shadow-2xl relative h-[500px]">
         <div id="safety-map" ref={mapContainerRef} className="w-full h-full z-0 text-black"></div>
         <div className="absolute top-4 right-4 bg-brand-900/90 backdrop-blur border border-brand-600 p-4 rounded-lg z-[400] max-w-xs hidden md:block">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <Icons.MapPin className="w-4 h-4 text-red-500" /> Locais Críticos
            </h3>
            <ul className="space-y-2">
                {hotspots.map((h, idx) => (
                    <li key={idx} className="text-sm flex justify-between items-center text-brand-300">
                        <span className="truncate w-3/4">{h.name}</span>
                        <span className="bg-red-500/20 text-red-400 px-2 rounded-full text-xs font-bold">{h.count}</span>
                    </li>
                ))}
            </ul>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Hotspots List (Mobile Friendly) */}
        <div className="bg-brand-800 p-6 rounded-xl border border-brand-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Icons.BarChart className="w-5 h-5 text-accent-gold" />
                Cidades & Bairros Perigosos
            </h2>
            <div className="space-y-3">
                {hotspots.length === 0 ? (
                    <p className="text-brand-500 italic">Dados insuficientes para análise.</p>
                ) : (
                    hotspots.map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-brand-900 rounded-lg border border-brand-700">
                            <div className="flex items-center gap-3">
                                <span className="text-brand-500 font-mono font-bold">#{idx + 1}</span>
                                <span className="text-white font-medium">{h.name}</span>
                            </div>
                            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                {h.count} Roubos
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Recent Feed */}
        <div className="bg-brand-800 p-6 rounded-xl border border-brand-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Icons.ShieldAlert className="w-5 h-5 text-red-400" />
                Reportados Recentemente
            </h2>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {recentThefts.length === 0 ? (
                    <p className="text-brand-500 text-sm text-center py-4">Nenhum roubo ativo reportado recentemente.</p>
                ) : (
                    recentThefts.map((r, idx) => (
                        <div key={idx} className="p-3 border-l-2 border-red-500 bg-brand-900/50 pl-4">
                            <p className="text-white font-bold text-sm">{r.itemName}</p>
                            <p className="text-brand-400 text-xs mt-1">{r.address}</p>
                            <p className="text-brand-500 text-[10px] mt-1 uppercase tracking-wider">
                                {new Date(r.date).toLocaleDateString()}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};