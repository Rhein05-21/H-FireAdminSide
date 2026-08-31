import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DeviceRecord } from '../utils/supabase';
import { getStatusColor, GasStatus } from '../constants/thresholds';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { 
  Home, 
  Flame, 
  Activity, 
  Wifi, 
  WifiOff, 
  MapPin,
  ChevronRight
} from 'lucide-react-native';

interface DeviceCardProps {
  device: DeviceRecord;
  onPress?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onPress }) => {
  const status: GasStatus = device.current_status || 'Normal';
  const statusTheme = getStatusColor(status);
  const ppm = device.current_ppm ?? 0;
  const isOnline = status !== 'Offline';

  const formatLastSeen = (timestamp: string) => {
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Online';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { borderColor: status === 'Danger' ? COLORS.danger : COLORS.cardBorder },
        status === 'Danger' && styles.dangerCardGlow
      ]} 
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top Header: House Name and Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.houseInfoCol}>
          <View style={styles.houseTitleRow}>
            <Home color={COLORS.primary} size={18} style={{ marginRight: 6 }} />
            <Text style={styles.houseName} numberOfLines={1}>
              {device.house_name}
            </Text>
          </View>
          {device.block_lot && (
            <View style={styles.locationRow}>
              <MapPin color={COLORS.textMuted} size={12} style={{ marginRight: 4 }} />
              <Text style={styles.blockLotText}>{device.block_lot}</Text>
            </View>
          )}
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}>
          <Text style={[styles.statusBadgeText, { color: statusTheme.color }]}>
            {statusTheme.badgeText}
          </Text>
        </View>
      </View>

      {/* Sensor Label and Hardware MAC */}
      <View style={styles.metaRow}>
        <Text style={styles.labelText}>{device.label}</Text>
        <Text style={styles.macText}>{device.mac}</Text>
      </View>

      {/* Middle Telemetry Reading: PPM and Flame State */}
      <View style={styles.telemetryContainer}>
        <View style={styles.ppmBox}>
          <View style={styles.ppmHeader}>
            <Activity color={statusTheme.color} size={16} style={{ marginRight: 4 }} />
            <Text style={styles.ppmTitle}>GAS / SMOKE LEVEL</Text>
          </View>
          <View style={styles.ppmValueRow}>
            <Text style={[styles.ppmValue, { color: statusTheme.color }]}>
              {ppm}
            </Text>
            <Text style={styles.ppmUnit}>PPM</Text>
          </View>
        </View>

        {device.flame ? (
          <View style={styles.flameActiveBox}>
            <Flame color={COLORS.white} size={20} />
            <Text style={styles.flameActiveText}>FLAME ON</Text>
          </View>
        ) : (
          <View style={styles.flameNormalBox}>
            <Flame color={COLORS.textMuted} size={18} />
            <Text style={styles.flameNormalText}>No Flame</Text>
          </View>
        )}
      </View>

      {/* Progress / PPM Bar Indicator */}
      <View style={styles.progressBarBackground}>
        <View 
          style={[
            styles.progressBarFill, 
            { 
              width: `${Math.min(100, Math.max(5, (ppm / 2000) * 100))}%`,
              backgroundColor: statusTheme.color 
            }
          ]} 
        />
      </View>

      {/* Footer: Online/Offline indicator and Tap to View Details */}
      <View style={styles.footerRow}>
        <View style={styles.onlineStatusRow}>
          {isOnline ? (
            <Wifi color={COLORS.normal} size={14} style={{ marginRight: 4 }} />
          ) : (
            <WifiOff color={COLORS.offline} size={14} style={{ marginRight: 4 }} />
          )}
          <Text style={styles.lastSeenText}>
            {formatLastSeen(device.last_seen)}
          </Text>
        </View>

        <View style={styles.detailsLinkRow}>
          <Text style={styles.detailsLinkText}>Node Details</Text>
          <ChevronRight color={COLORS.primary} size={14} style={{ marginLeft: 2 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  dangerCardGlow: {
    borderWidth: 1.5,
    ...SHADOWS.dangerGlow,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  houseInfoCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  houseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  houseName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  blockLotText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  headerActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  editIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  editBtnText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  labelText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  macText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  telemetryContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ppmBox: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  ppmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ppmTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ppmValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ppmValue: {
    fontSize: 22,
    fontWeight: '900',
    marginRight: 4,
  },
  ppmUnit: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  flameActiveBox: {
    width: 100,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  flameActiveText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 11,
    marginTop: 2,
  },
  flameNormalBox: {
    width: 100,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  flameNormalText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastSeenText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  detailsLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsLinkText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
