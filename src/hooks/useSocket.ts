import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { DoseEvent } from '../lib/sartex/simulator';
import { PRODUCT_MAP } from '../lib/sartex/products';

const SOCKET_URL = 'http://localhost:3001';

interface UseSocketResult {
  socket: Socket | null;
  isConnected: boolean;
  activeProducts: Record<string, any>;
  latestEvent: DoseEvent | null;
  history: DoseEvent[];
  mode: 'simulation' | 'real';
  setMode: (mode: 'simulation' | 'real') => void;
  targets: Record<number, number>;
  setTargets: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}

export function useSocket(): UseSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeProducts, setActiveProducts] = useState<Record<string, any>>({});
  const [latestEvent, setLatestEvent] = useState<DoseEvent | null>(null);
  const [history, setHistory] = useState<DoseEvent[]>([]);
  const [mode, setMode] = useState<'simulation' | 'real'>('simulation');
  const [targets, setTargets] = useState<Record<number, number>>({});

  // Au montage, lire depuis localStorage pour éviter le Hydration Mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sartex_mode');
      if (saved === 'real') setMode('real');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sartex_mode', mode);
  }, [mode]);
  // Fetch initial history
  useEffect(() => {
    fetch(`${SOCKET_URL}/api/history?limit=2000`)
      .then(res => res.json())
      .then((data: any[]) => {
        const formattedHistory = data.map(d => {
          const product = Object.values(PRODUCT_MAP).find(p => p.name === d.product_name);
          // Gérer le format SQLite "YYYY-MM-DD HH:MM:SS" ou le format ISO
          const safeTimestamp = d.timestamp.includes(' ') 
            ? d.timestamp.replace(' ', 'T') + 'Z' 
            : d.timestamp;

          return {
            id: d.id.toString(),
            batchId: `B-${d.id.toString().padStart(5, '0')}`,
            productId: product?.id || 'CHTT-AB35',
            volume: d.actual_volume,
            target: d.target_volume,
            duration: d.duration_seconds,
            timestamp: new Date(safeTimestamp).getTime(),
            anomaly: d.is_anomaly === 1
          } as DoseEvent;
        });
        setHistory(formattedHistory.reverse()); // Plus ancien au plus récent
      })
      .catch(err => console.error("Erreur fetch history:", err));

    // Fetch initial targets
    fetch(`${SOCKET_URL}/api/admin/targets`)
      .then(res => res.json())
      .then((data: any[]) => {
        const t: Record<number, number> = {};
        data.forEach(d => { t[d.id] = d.target; });
        setTargets(t);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL);
    setSocket(socketInstance);

    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    socketInstance.on('products:state', (states: any[]) => {
      const newActive: Record<string, any> = {};
      states.forEach(state => { 
        const product = Object.values(PRODUCT_MAP).find(p => p.name === state.productName);
        if (product) {
          newActive[product.id] = state; 
        }
      });
      setActiveProducts(newActive);
    });

    socketInstance.on('dosage:complete', (data: any) => {
      const product = Object.values(PRODUCT_MAP).find(p => p.name === data.productName);
      if (product) {
        const event: DoseEvent = {
          id: data.id.toString(),
          batchId: `B-${data.id.toString().padStart(5, '0')}`,
          productId: product.id,
          volume: data.actualVolume,
          target: data.targetVolume,
          duration: data.durationSeconds,
          timestamp: Date.now(),
          anomaly: data.isAnomaly === 1
        };
        setLatestEvent(event);
        setHistory(prev => [...prev, event]);
      }
    });

    // Quand l'admin fait un reset, vider toutes les données locales
    socketInstance.on('admin:reset', () => {
      setHistory([]);
      setLatestEvent(null);
      setActiveProducts({});
      console.log('🔄 [Client] Données locales réinitialisées');
    });

    socketInstance.on('admin:targetUpdated', (data: { productId: number, target: number }) => {
      setTargets(prev => ({ ...prev, [data.productId]: data.target }));
    });

    return () => { socketInstance.disconnect(); };
  }, []);

  // Handle mode changes
  useEffect(() => {
    fetch(`${SOCKET_URL}/api/simulator/${mode === 'simulation' ? 'start' : 'stop'}`, { method: 'POST' }).catch(console.error);
  }, [mode]);

  return { socket, isConnected, activeProducts, latestEvent, history, mode, setMode, targets, setTargets };
}
