import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking, 
  Platform,
  Alert
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import { EditDeviceModal } from '../../components/EditDeviceModal';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { getStatusColor, GasStatus } from '../../constants/thresholds';
import { 
  ArrowLeft, 
  Home, 
  Flame, 
  Activity, 
  Wifi, 
  WifiOff, 
  MapPin, 
  Edit3, 
  PhoneCall, 
  Radio, 
  Layers, 
  ShieldAlert, 
  Cpu, 
  Calendar,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Unlink
} from 'lucide-react-native';

export default function DeviceDetailsScreen() {
  const { mac } = useLocalSearchParams<{ mac: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { devices, secondaryNodes, triggerEmergencyAlert, unassignDevice } = useAdmin();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [editModalVisible, setEditModalVisible] = useState(false);

  const decodedMac = mac ? decodeURIComponent(mac).toUpperCase() : '';
  const device = devices.find(d => d.mac.toUpperCase() === decodedMac) || devices[0];

  if (!device) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <Text style={styles.notFoundText}>Device Node Not Found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={COLORS.textPrimary} size={18} style={{ marginRight: 6 }} />
          <Text style={styles.backButtonText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const handleForceUnassign = () => {
    if (!isAdmin) return;
    Alert.alert(
      'Force Unassign Sensor',
      `Are you sure you want to disconnect "${device.label || device.mac}" from ${device.resident_name || 'Resident'}?\n\nThe sensor will immediately become an unassigned Community Sensor.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Force Unassign',
          style: 'destructive',
          onPress: async () => {
            const res = await unassignDevice(device.mac);
            if (res.success) {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              Alert.alert('Sensor Unassigned', `Device ${device.mac} is now an unassigned Community Sensor.`);
            } else {
              Alert.alert('Error', res.error || 'Failed to unassign sensor.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation Header */}
      <View style={styles.topNav}>
        <TouchableOpacity 
          style={styles.navBackBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft color={COLORS.textPrimary} size={20} />
        </TouchableOpacity>
        
        <View style={styles.navTitleCol}>
          <Text style={styles.navTitle}>SENSOR NODE DETAILS</Text>
          <Text style={styles.navSubtitle}>{device.house_name}</Text>
        </View>

        <View style={[styles.navStatusBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}>
          <Text style={[styles.navStatusText, { color: statusTheme.color }]}>
            {statusTheme.badgeText}
          </Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 }
        ]} 
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: PRIMARY CORE NODE (N1) */}
        <View style={[styles.coreCard, isDanger && styles.dangerGlow]}>
          <View style={styles.coreHeader}>
            <View style={styles.coreIconBg}>
              <Cpu color={COLORS.primary} size={22} />
            </View>
            <View style={styles.coreInfoCol}>
              <View style={styles.coreTagRow}>
                <View style={styles.coreNodePill}>
                  <Text style={styles.coreNodePillText}>PRIMARY CORE NODE (N1)</Text>
                </View>
                <View style={styles.macPill}>
                  <Text style={styles.macPillText}>{device.mac}</Text>
                </View>
              </View>
              <Text style={styles.coreHouseName}>{device.house_name}</Text>
              <Text style={styles.coreLabel}>{device.label}</Text>
            </View>
          </View>

          {/* Core Node Telemetry Reading */}
          <View style={styles.telemetryBox}>
            <View style={styles.telemetryStatCol}>
              <Text style={styles.telemetryLabel}>MQ-2 GAS / SMOKE LEVEL</Text>
              <View style={styles.telemetryValueRow}>
                <Text style={[styles.telemetryNumber, { color: statusTheme.color }]}>{ppm}</Text>
                <Text style={styles.telemetryUnit}>PPM</Text>
              </View>
            </View>

            <View style={styles.telemetryDivider} />

            <View style={styles.telemetryStatCol}>
              <Text style={styles.telemetryLabel}>OPTICAL FLAME</Text>
              <View style={styles.flameRow}>
                <Flame color={device.flame ? COLORS.danger : COLORS.normal} size={22} style={{ marginRight: 6 }} />
                <Text style={[styles.flameText, { color: device.flame ? COLORS.danger : COLORS.normal }]}>
                  {device.flame ? 'FLAME ON' : 'NO FLAME'}
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

          {/* Admin Edit & Unassign Buttons */}
          {isAdmin && (
            <View style={styles.adminButtonsRow}>
              <TouchableOpacity 
                style={[styles.adminEditBtn, Boolean(device.profile_id) && { flex: 1 }]}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.8}
              >
                <Edit3 color={COLORS.primary} size={16} style={{ marginRight: 8 }} />
                <Text style={styles.adminEditBtnText}>Configure Node</Text>
              </TouchableOpacity>

              {Boolean(device.profile_id) && (
                <TouchableOpacity 
                  style={styles.adminUnassignBtn}
                  onPress={handleForceUnassign}
                  activeOpacity={0.8}
                >
                  <Unlink color={COLORS.danger} size={15} style={{ marginRight: 6 }} />
                  <Text style={styles.adminUnassignBtnText}>Unassign</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* SECTION 2: LOCATION & RESIDENT AUTO-SYNC */}
        <Text style={styles.sectionHeading}>HOUSEHOLD LOCATION & PROFILE</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconCol}>
              <Home color={COLORS.primary} size={18} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Assigned Resident Profile</Text>
              <Text style={styles.infoValue}>{device.resident_name || 'Community Household'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconCol}>
              <MapPin color={COLORS.accent} size={18} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Subdivision Address (Auto-Synced)</Text>
              <Text style={styles.infoValue}>{device.block_lot || 'Block 1 Lot 1'}</Text>
              <Text style={styles.coordSub}>
                Coordinates: Lat {(device.latitude || 14.1777).toFixed(4)}, Lng {(device.longitude || 121.2551).toFixed(4)}
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
                  <PhoneCall color={COLORS.normal} size={18} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Emergency Contact</Text>
                  <Text style={[styles.infoValue, { color: COLORS.primary }]}>
                    {device.resident_phone} (Tap to Call)
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* SECTION 3: SECONDARY NODES (N2 & N3) */}
        <View style={styles.secondarySectionHeader}>
          <Layers color={COLORS.accent} size={18} style={{ marginRight: 6 }} />
          <Text style={styles.sectionHeading}>SECONDARY SENSOR NODES (N2 & N3)</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Satellite telemetry received from secondary sensor channels in the mesh network
        </Text>

        {/* Node 2 (N2) Card */}
        {(() => {
          const n2 = secondaryNodes.N2;
          const n2Theme = getStatusColor(n2.status);
          return (
            <View style={[styles.secondaryNodeCard, n2.status === 'Danger' && styles.dangerGlow]}>
              <View style={styles.secondaryHeaderRow}>
                <View style={styles.secondaryTitleCol}>
                  <View style={styles.channelBadge}>
                    <Text style={styles.channelBadgeText}>CHANNEL N2</Text>
                  </View>
                  <Text style={styles.secondaryNodeTitle}>{n2.name}</Text>
                </View>

                <View style={[styles.statusBadgeSmall, { backgroundColor: n2Theme.bg, borderColor: n2Theme.border }]}>
                  <Text style={[styles.statusBadgeTextSmall, { color: n2Theme.color }]}>
                    {n2Theme.badgeText}
                  </Text>
                </View>
              </View>

              <View style={styles.secondaryTelemetryRow}>
                <View style={styles.secondaryStatBox}>
                  <Text style={styles.secondaryStatLabel}>N2 GAS LEVEL</Text>
                  <View style={styles.secondaryValueRow}>
                    <Text style={[styles.secondaryNumber, { color: n2Theme.color }]}>{n2.ppm}</Text>
                    <Text style={styles.secondaryUnit}>PPM</Text>
                  </View>
                </View>

                <View style={styles.secondaryStatBox}>
                  <Text style={styles.secondaryStatLabel}>N2 OPTICAL FLAME</Text>
                  <View style={styles.secondaryFlameRow}>
                    <Flame color={n2.flame ? COLORS.danger : COLORS.normal} size={18} style={{ marginRight: 4 }} />
                    <Text style={[styles.secondaryFlameText, { color: n2.flame ? COLORS.danger : COLORS.normal }]}>
                      {n2.flame ? 'FLAME ON' : 'NO FLAME'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.secondaryProgressBarBackground}>
                <View 
                  style={[
                    styles.secondaryProgressBarFill, 
                    { 
                      width: `${Math.min(100, Math.max(5, (n2.ppm / 2000) * 100))}%`,
                      backgroundColor: n2Theme.color 
                    }
                  ]} 
                />
              </View>

              <View style={styles.secondaryFooterRow}>
                <Radio color={COLORS.accent} size={12} style={{ marginRight: 4 }} />
                <Text style={styles.secondaryFooterText}>
                  MQTT Key: N2_Gas / N2_Fire • Live Stream
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Node 3 (N3) Card */}
        {(() => {
          const n3 = secondaryNodes.N3;
          const n3Theme = getStatusColor(n3.status);
          return (
            <View style={[styles.secondaryNodeCard, n3.status === 'Danger' && styles.dangerGlow]}>
              <View style={styles.secondaryHeaderRow}>
                <View style={styles.secondaryTitleCol}>
                  <View style={styles.channelBadge}>
                    <Text style={styles.channelBadgeText}>CHANNEL N3</Text>
                  </View>
                  <Text style={styles.secondaryNodeTitle}>{n3.name}</Text>
                </View>

                <View style={[styles.statusBadgeSmall, { backgroundColor: n3Theme.bg, borderColor: n3Theme.border }]}>
                  <Text style={[styles.statusBadgeTextSmall, { color: n3Theme.color }]}>
                    {n3Theme.badgeText}
                  </Text>
                </View>
              </View>

              <View style={styles.secondaryTelemetryRow}>
                <View style={styles.secondaryStatBox}>
                  <Text style={styles.secondaryStatLabel}>N3 GAS LEVEL</Text>
                  <View style={styles.secondaryValueRow}>
                    <Text style={[styles.secondaryNumber, { color: n3Theme.color }]}>{n3.ppm}</Text>
                    <Text style={styles.secondaryUnit}>PPM</Text>
                  </View>
                </View>

                <View style={styles.secondaryStatBox}>
                  <Text style={styles.secondaryStatLabel}>N3 OPTICAL FLAME</Text>
                  <View style={styles.secondaryFlameRow}>
                    <Flame color={n3.flame ? COLORS.danger : COLORS.normal} size={18} style={{ marginRight: 4 }} />
                    <Text style={[styles.secondaryFlameText, { color: n3.flame ? COLORS.danger : COLORS.normal }]}>
                      {n3.flame ? 'FLAME ON' : 'NO FLAME'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.secondaryProgressBarBackground}>
                <View 
                  style={[
                    styles.secondaryProgressBarFill, 
                    { 
                      width: `${Math.min(100, Math.max(5, (n3.ppm / 2000) * 100))}%`,
                      backgroundColor: n3Theme.color 
                    }
                  ]} 
                />
              </View>

              <View style={styles.secondaryFooterRow}>
                <Radio color={COLORS.accent} size={12} style={{ marginRight: 4 }} />
                <Text style={styles.secondaryFooterText}>
                  MQTT Key: N3_Gas / N3_Fire • Live Stream
                </Text>
              </View>
            </View>
          );
        })()}

        {/* SECTION 4: ACTIONS */}
        <View style={styles.actionButtonsCol}>
          <TouchableOpacity 
            style={styles.mapActionBtn}
            onPress={() => router.push({
              pathname: '/(tabs)/map',
              params: { focusMac: device.mac }
            })}
            activeOpacity={0.8}
          >
            <Compass color={COLORS.accent} size={18} style={{ marginRight: 8 }} />
            <Text style={styles.mapActionBtnText}>Locate Node on Community Map</Text>
          </TouchableOpacity>

          {isDanger && (
            <TouchableOpacity 
              style={styles.emergencyActionBtn}
              onPress={() => triggerEmergencyAlert(device)}
              activeOpacity={0.8}
            >
              <ShieldAlert color={COLORS.white} size={18} style={{ marginRight: 8 }} />
              <Text style={styles.emergencyActionBtnText}>Trigger Emergency Alarm & Dispatch</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Edit Device & Assign Household Modal */}
      <EditDeviceModal
        visible={editModalVisible}
        device={device}
        onClose={() => setEditModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  notFoundText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  backButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  navBackBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    marginRight: SPACING.md,
  },
  navTitleCol: {
    flex: 1,
  },
  navTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  navSubtitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  navStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  navStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  coreCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.md,
  },
  dangerGlow: {
    borderColor: COLORS.danger,
    ...SHADOWS.dangerGlow,
  },
  coreHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  coreIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  coreInfoCol: {
    flex: 1,
  },
  coreTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  coreNodePill: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coreNodePillText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  macPill: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  macPillText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  coreHouseName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  coreLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  telemetryBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    marginBottom: SPACING.md,
  },
  telemetryStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorderSubtle,
    marginHorizontal: SPACING.sm,
  },
  telemetryLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  telemetryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  telemetryNumber: {
    fontSize: 26,
    fontWeight: '900',
    marginRight: 4,
  },
  telemetryUnit: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  flameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  flameText: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  adminButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.xs,
  },
  adminEditBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  adminEditBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  adminUnassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  adminUnassignBtnText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeading: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: SPACING.md,
  },
  secondarySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  infoCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoIconCol: {
    width: 32,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
  secondaryNodeCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  secondaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  secondaryTitleCol: {
    flex: 1,
  },
  channelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  channelBadgeText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '800',
  },
  secondaryNodeTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '800',
  },
  secondaryTelemetryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  secondaryStatBox: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  secondaryStatLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  secondaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  secondaryNumber: {
    fontSize: 20,
    fontWeight: '900',
    marginRight: 4,
  },
  secondaryUnit: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  secondaryFlameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  secondaryFlameText: {
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryProgressBarBackground: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  secondaryProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  secondaryFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryFooterText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  actionButtonsCol: {
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  mapActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingVertical: 14,
  },
  mapActionBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  emergencyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    ...SHADOWS.md,
  },
  emergencyActionBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
});
