import { COLORS } from './theme';

export type GasStatus = 'Normal' | 'Warning' | 'Danger' | 'Offline';
export type AlertType = 'NONE' | 'GAS / SMOKE LEAK' | 'FIRE';

export const THRESHOLDS = {
  NORMAL_MAX_PPM: 450,
  WARNING_MAX_PPM: 1500,
  DANGER_MIN_PPM: 1501,
  OFFLINE_TIMEOUT_MS: 120000, // 2 minutes without heartbeat = offline
};

export const getStatusFromPPM = (ppm: number, flame: boolean = false, isOnline: boolean = true): GasStatus => {
  if (!isOnline) return 'Offline';
  if (flame || ppm > THRESHOLDS.WARNING_MAX_PPM) {
    return 'Danger';
  }
  if (ppm > THRESHOLDS.NORMAL_MAX_PPM) {
    return 'Warning';
  }
  return 'Normal';
};

export const getStatusColor = (status: GasStatus) => {
  switch (status) {
    case 'Danger':
      return {
        color: COLORS.danger,
        bg: COLORS.dangerBg,
        border: COLORS.dangerBorder,
        badgeText: 'CRITICAL DANGER',
      };
    case 'Warning':
      return {
        color: COLORS.warning,
        bg: COLORS.warningBg,
        border: COLORS.warningBorder,
        badgeText: 'WARNING',
      };
    case 'Normal':
      return {
        color: COLORS.normal,
        bg: COLORS.normalBg,
        border: COLORS.normalBorder,
        badgeText: 'NORMAL',
      };
    case 'Offline':
    default:
      return {
        color: COLORS.offline,
        bg: COLORS.offlineBg,
        border: COLORS.cardBorder,
        badgeText: 'OFFLINE',
      };
  }
};

export interface EmergencyHotline {
  id: string;
  name: string;
  number: string;
  description?: string;
  icon?: 'flame' | 'shield-alert' | 'cross' | 'phone-call' | 'building' | string;
}

export const DEFAULT_EMERGENCY_HOTLINES: EmergencyHotline[] = [
  { id: '1', name: 'Bureau of Fire Protection (BFP)', number: '911', description: 'National Fire & Emergency Response', icon: 'flame' },
  { id: '2', name: 'Community Guardhouse', number: '(02) 8888-4321', description: 'Subdivision Main Gate Security', icon: 'shield-alert' },
  { id: '3', name: 'Red Cross Emergency', number: '143', description: 'Medical & Disaster Relief Response', icon: 'cross' },
  { id: '4', name: 'Subdivision Admin Office', number: '(02) 8888-1234', description: 'HOA Management Operations', icon: 'phone-call' },
];

export const EMERGENCY_HOTLINES = DEFAULT_EMERGENCY_HOTLINES;
