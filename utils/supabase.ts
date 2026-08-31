import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kbibptqedyxymojyqnia.supabase.co';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = 
  Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder'));

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface ProfileRecord {
  id: string;
  name: string;
  email?: string;
  role?: string;
  is_admin?: boolean;
  block_lot?: string;
  latitude?: number;
  longitude?: number;
  push_token?: string;
  emergency_hotline?: string;
  address?: string;
  location_url?: string;
  updated_at?: string;
}

export interface DeviceRecord {
  mac: string;
  house_name: string;
  label: string;
  profile_id?: string;
  block_lot?: string;
  latitude: number;
  longitude: number;
  last_seen: string;
  created_at?: string;
  current_ppm?: number;
  current_status?: 'Normal' | 'Warning' | 'Danger' | 'Offline';
  flame?: boolean;
  resident_name?: string;
  resident_phone?: string;
}

export interface GasLogRecord {
  id: number;
  device_mac: string;
  ppm_level: number;
  status: 'Normal' | 'Warning' | 'Danger';
  profile_id?: string;
  created_at: string;
}

export interface IncidentRecord {
  id: number;
  device_mac: string;
  status: 'Active' | 'Resolved';
  ppm_at_trigger: number;
  alert_type: string;
  notes?: string;
  resolved_by?: string;
  profile_id?: string;
  start_time: string;
  end_time?: string;
  house_name?: string;
  block_lot?: string;
  resident_name?: string;
  resident_phone?: string;
  device_label?: string;
}
