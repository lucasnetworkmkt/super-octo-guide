import { createClient } from '@supabase/supabase-js';
import { Reservation, MenuItem } from '../types';

// ATENÇÃO: Em um projeto real, use variáveis de ambiente (.env).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qjommaufbqszimakesfr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqb21tYXVmYnFzemltYWtlc2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDgyNzYsImV4cCI6MjA4NTEyNDI3Nn0.wDifnH7REU7CwjT5rZDeXM-ZXWKrWmRAWzddMeyJBtE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STORAGE_KEY = 'fuego_reservations';

// Fallback: LocalStorage Helpers (Garante funcionamento offline/demo)
const getLocalData = (): Reservation[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

const setLocalData = (data: Reservation[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/**
 * --- RESERVATION SERVICES ---
 * Includes Hybrid Fallback: Tries Supabase first, seamlessly falls back to LocalStorage if it fails.
 * This ensures the "Happy Path" for sales demos never breaks.
 */

export const fetchReservations = async (): Promise<Reservation[]> => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map DB columns (snake_case) to App types (camelCase)
    return data.map((item: any) => ({
      id: item.id,
      clientName: item.client_name,
      phone: item.phone || '',
      pax: `${item.pax} Pessoas`, // Convert int back to string format used in UI
      time: item.time,
      date: item.date,
      tableType: item.table_type || 'Salão Principal',
      status: item.status,
      createdAt: new Date(item.created_at).getTime()
    }));
  } catch (error) {
    console.warn('Supabase unreachable or tables missing. Using LocalStorage fallback for demo.', error);
    return getLocalData();
  }
};

export const createReservation = async (res: Omit<Reservation, 'id' | 'status' | 'createdAt'>): Promise<Reservation | null> => {
  // Try Supabase First
  try {
    // Parse "2 Pessoas" to integer 2 for DB
    const paxInt = parseInt(res.pax.replace(/\D/g, '')) || 2;

    const { data, error } = await supabase
      .from('reservations')
      .insert([{
        client_name: res.clientName,
        phone: res.phone,
        pax: paxInt,
        date: res.date,
        time: res.time,
        table_type: res.tableType,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      clientName: data.client_name,
      phone: data.phone,
      pax: `${data.pax} Pessoas`,
      time: data.time,
      date: data.date,
      tableType: data.table_type,
      status: data.status,
      createdAt: new Date(data.created_at).getTime()
    };
  } catch (error) {
    console.warn('Supabase insert failed. Using LocalStorage fallback for demo.', error);
    
    // Fallback Implementation (Simulates a successful server response)
    const newReservation: Reservation = {
      id: Math.random().toString(36).substr(2, 9),
      clientName: res.clientName,
      phone: res.phone,
      pax: res.pax, // Keep string for local storage
      time: res.time,
      date: res.date,
      tableType: res.tableType,
      status: 'pending',
      createdAt: Date.now()
    };

    const currentData = getLocalData();
    setLocalData([newReservation, ...currentData]);
    
    return newReservation;
  }
};

export const updateReservationStatusService = async (id: string, status: 'confirmed' | 'cancelled') => {
  try {
    const { error } = await supabase
      .from('reservations')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.warn('Supabase update failed. Using LocalStorage fallback for demo.', error);
    
    const currentData = getLocalData();
    const updatedData = currentData.map(r => 
      r.id === id ? { ...r, status } : r
    );
    setLocalData(updatedData);
  }
};
