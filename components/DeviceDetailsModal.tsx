import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Linking,
  Platform 
} from 'react-native';
import { DeviceRecord } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { getStatusColor, GasStatus } from '../constants/thresholds';
import { 
  Home, 
  Flame, 
  Activity, 
  Wifi, 
  WifiOff, 
  MapPin, 
  Edit3, 
  X, 
  PhoneCall, 
  Radio, 
  ShieldAlert,
  Calendar,
  Cpu
} from 'lucide-react-native';

interface DeviceDetailsModalProps {
  visible: boolean;
  device: DeviceRecord | null;
  onClose: () => void;
  onEdit: (device: DeviceRecord) => void;
  onTriggerEmergency?: (device: DeviceRecord) => void;
}

export const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({
  visible,
  device,
  onClose,
  onEdit,
  onTriggerEmergency,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  if (!device) return null;

  const status: GasStatus = device.current_status || 'Normal';
  const statusTheme = getStatusColor(status);
  const ppm = device.current_ppm ?? 0;
  const isOnline = status !== 'Offline';
  const isDanger = status === 'Danger';

  const formatLastSeen = (timestamp: string) => {
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Active now (Realtime)';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours} hour(s) ago`;
    } catch {
      return 'Unknown';
    }
  };

  const handleCall = (number?: string) => {
    if (!number) return;
    const cleanNumber = number.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, isDanger && styles.dangerCardBorder]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <View style={styles.houseTitleRow}>
                <Home color={COLORS.primary} size={20} style={{ marginRight: 6 }} />
                <Text style={styles.houseName} numberOfLines={1}>
                  {device.house_name}
                </Text>
              </View>
              <Text style={styles.deviceSubTitle}>{device.label}</Text>
            </View>

            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X color={COLORS.textMuted} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Status & Telemetry Highlight Box */}
            <View style={[styles.telemetryCard, { borderColor: statusTheme.border }]}>
              <View style={styles.telemetryHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}>
                  <Text style={[styles.statusBadgeText, { color: statusTheme.color }]}>
                    {statusTheme.badgeText}
                  </Text>
                </View>

                <View style={styles.onlineBadge}>
                  {isOnline ? (
                    <>
                      <Wifi color={COLORS.normal} size={13} style={{ marginRight: 4 }} />
                      <Text style={[styles.onlineText, { color: COLORS.normal }]}>Online</Text>
                    </>
                  ) : (
                    <>
                      <WifiOff color={COLORS.offline} size={13} style={{ marginRight: 4 }} />
                      <Text style={[styles.onlineText, { color: COLORS.offline }]}>Offline</Text>
                    </>
                  )}
                </View>
              </View>

              {/* PPM and Flame Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>MQ-2 SENSOR LEVEL</Text>
                  <View style={styles.statValueRow}>
                    <Text style={[styles.statValue, { color: statusTheme.color }]}>{ppm}</Text>
                    <Text style={styles.statUnit}>PPM</Text>
                  </View>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>OPTICAL FLAME</Text>
                  <View style={styles.flameStatusRow}>
                    <Flame color={device.flame ? COLORS.danger : COLORS.normal} size={20} style={{ marginRight: 4 }} />
                    <Text style={[styles.flameStatusText, { color: device.flame ? COLORS.danger : COLORS.normal }]}>
                      {device.flame ? 'FLAME ACTIVE' : 'NO FLAME'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Progress Bar */}
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
            </View>

            {/* Hardware & Sensor Info */}
            <Text style={styles.sectionTitle}>HARDWARE INFORMATION</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconCol}>
                  <Cpu color={COLORS.primary} size={16} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Device Label</Text>
                  <Text style={styles.infoValue}>{device.label}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconCol}>
                  <Radio color={COLORS.accent} size={16} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Hardware MAC Address</Text>
                  <Text style={styles.macValue}>{device.mac}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconCol}>
                  <Calendar color={COLORS.textMuted} size={16} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Telemetry Heartbeat</Text>
                  <Text style={styles.infoValue}>{formatLastSeen(device.last_seen)}</Text>
                </View>
              </View>
            </View>

            {/* Household & Location Info */}
            <Text style={styles.sectionTitle}>HOUSEHOLD & LOCATION</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconCol}>
                  <Home color={COLORS.primary} size={16} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Assigned Resident Profile</Text>
                  <Text style={styles.infoValue}>{device.resident_name || 'Community Household'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconCol}>
                  <MapPin color={COLORS.accent} size={16} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Subdivision Location (Auto-Synced)</Text>
                  <Text style={styles.infoValue}>{device.block_lot || 'Block 1 Lot 1'}</Text>
                  <Text style={styles.coordSub}>
                    Lat: {(device.latitude || 14.1777).toFixed(4)}, Lng: {(device.longitude || 121.2551).toFixed(4)}
                  </Text>
                </View>
              </View>

              {device.resident_phone && (
                <>
                  <View style={styles.divider} />
                  <TouchableOpacity 
                    style={styles.infoRow}
                    onPress={() => handleCall(device.resident_phone)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.infoIconCol}>
                      <PhoneCall color={COLORS.normal} size={16} />
                    </View>
                    <View style={styles.infoTextCol}>
                      <Text style={styles.infoLabel}>Emergency Contact Phone</Text>
                      <Text style={[styles.infoValue, { color: COLORS.primary }]}>
                        {device.resident_phone} (Tap to Call)
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.footerActions}>
            {isDanger && onTriggerEmergency && (
              <TouchableOpacity 
                style={styles.emergencyBtn}
                onPress={() => {
                  onClose();
                  onTriggerEmergency(device);
                }}
                activeOpacity={0.8}
              >
                <ShieldAlert color={COLORS.white} size={16} style={{ marginRight: 6 }} />
                <Text style={styles.emergencyBtnText}>View Emergency Siren</Text>
              </TouchableOpacity>
            )}

            {isAdmin ? (
              <TouchableOpacity 
                style={styles.editBtn}
                onPress={() => {
                  onClose();
                  onEdit(device);
                }}
                activeOpacity={0.8}
              >
                <Edit3 color={COLORS.white} size={16} style={{ marginRight: 6 }} />
                <Text style={styles.editBtnText}>Edit Node & Assign Household</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.closeActionBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.closeActionBtnText}>Close Details</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  dangerCardBorder: {
    borderColor: COLORS.danger,
    ...SHADOWS.dangerGlow,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  headerTitleCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  houseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  houseName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  deviceSubTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollContent: {
    flexGrow: 0,
    marginBottom: SPACING.md,
  },
  telemetryCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 10,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    marginRight: 4,
  },
  statUnit: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  flameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  flameStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  infoCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoIconCol: {
    width: 28,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  macValue: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  coordSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorderSubtle,
  },
  footerActions: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    borderRadius: 12,
    ...SHADOWS.md,
  },
  emergencyBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    ...SHADOWS.md,
  },
  editBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  closeActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 10,
    borderRadius: 12,
  },
  closeActionBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
