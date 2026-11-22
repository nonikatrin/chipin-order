// src/store/usePOStore.ts
import { create } from 'zustand';

interface POStore {
  stats: { label: string; value: string | number }[];
  orders: { id: string; buyer: string; status: string; total: string }[];
  setOrders: (orders: any[]) => void;
}

export const usePOStore = create<POStore>((set) => ({
  // Initial Mock Data
  stats: [
    { label: 'Total Buyers', value: '128' },
    { label: 'Total Portions', value: '450' },
    { label: 'Total Revenue', value: 'Rp 12.5M' },
    { label: 'New PO', value: '+5' },
  ],
  orders: [
    { id: 'PO-001', buyer: 'Alice', status: 'Pending', total: 'Rp 50.000' },
    { id: 'PO-002', buyer: 'Bob', status: 'Completed', total: 'Rp 120.000' },
  ],
  setOrders: (newOrders) => set({ orders: newOrders }),
}));