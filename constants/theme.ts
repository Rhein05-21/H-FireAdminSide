export const COLORS = {
  // Backgrounds
  background: '#0B0F19',
  backgroundSecondary: '#111827',
  cardBackground: '#1F2937',
  cardBackgroundHover: '#374151',
  cardBorder: '#374151',
  cardBorderSubtle: '#1E293B',

  // Text
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#111827',

  // Brand / Accents
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  primaryMuted: 'rgba(59, 130, 246, 0.15)',
  accent: '#06B6D4',
  accentMuted: 'rgba(6, 182, 212, 0.15)',

  // Status Colors
  normal: '#10B981', // Safe Green
  normalBg: 'rgba(16, 185, 129, 0.15)',
  normalBorder: '#059669',

  warning: '#F59E0B', // Orange Alert
  warningBg: 'rgba(245, 158, 11, 0.15)',
  warningBorder: '#D97706',

  danger: '#EF4444', // Red Fire / Gas Emergency
  dangerBg: 'rgba(239, 68, 68, 0.2)',
  dangerBorder: '#DC2626',
  dangerGlow: 'rgba(239, 68, 68, 0.5)',

  offline: '#6B7280', // Gray Offline
  offlineBg: 'rgba(107, 114, 128, 0.15)',

  // UI Elements
  inputBackground: '#1E293B',
  inputBorder: '#334155',
  inputBorderFocus: '#3B82F6',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.75)',
  dangerOverlay: 'rgba(185, 28, 28, 0.88)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 8,
  },
  dangerGlow: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },
};
