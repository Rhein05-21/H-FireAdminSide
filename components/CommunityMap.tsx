import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Linking,
  Platform,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { DeviceRecord } from '../utils/supabase';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { EditDeviceModal } from './EditDeviceModal';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { getStatusColor, GasStatus } from '../constants/thresholds';
import { 
  Home, 
  Flame, 
  Crosshair, 
  ShieldAlert, 
  MapPin, 
  Activity, 
  Navigation, 
  Edit3, 
  PhoneCall, 
  ChevronRight, 
  Layers, 
  Wifi, 
  WifiOff, 
  Compass, 
  X, 
  AlertTriangle,
  CheckCircle2,
  Radio,
  Cpu
} from 'lucide-react-native';

interface CommunityMapProps {
  devices: DeviceRecord[];
  onSelectDevice?: (device: DeviceRecord) => void;
}

export const CommunityMap: React.FC<CommunityMapProps> = ({ 
  devices, 
  onSelectDevice,
}) => {
  const router = useRouter();
  const { secondaryNodes } = useAdmin();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(devices[0] || null);
  const [filter, setFilter] = useState<'all' | 'hazard' | 'online'>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceRecord | null>(null);

  const totalCount = devices.length;
  const dangerCount = devices.filter(d => d.current_status === 'Danger').length;
  const warningCount = devices.filter(d => d.current_status === 'Warning').length;
  const normalCount = devices.filter(d => d.current_status === 'Normal').length;

  const filteredDevices = devices.filter(d => {
    if (filter === 'hazard') return d.current_status === 'Danger' || d.current_status === 'Warning';
    if (filter === 'online') return d.current_status !== 'Offline';
    return true;
  });

  const focusOnDevice = (device: DeviceRecord) => {
    setSelectedDevice(device);
    onSelectDevice?.(device);
  };

  const focusOnEmergency = () => {
    const dangerDevice = devices.find(d => d.current_status === 'Danger') ||
                         devices.find(d => d.current_status === 'Warning');
    if (dangerDevice) {
      focusOnDevice(dangerDevice);
    } else if (devices.length > 0) {
      focusOnDevice(devices[0]);
    }
  };

  const openGoogleMaps = (lat?: number, lng?: number) => {
    const latitude = lat || 14.1777;
    const longitude = lng || 121.2551;
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(() => {});
    });
  };

  const activeTheme = selectedDevice ? getStatusColor(selectedDevice.current_status || 'Normal') : getStatusColor('Normal');
  const n1Ppm = selectedDevice?.current_ppm ?? 0;
  const n2Ppm = secondaryNodes?.N2?.ppm ?? 0;
  const n3Ppm = secondaryNodes?.N3?.ppm ?? 0;

  const n2Theme = getStatusColor(secondaryNodes?.N2?.status || 'Normal');
  const n3Theme = getStatusColor(secondaryNodes?.N3?.status || 'Normal');

  return (
    <View style={styles.container}>
      {/* Top Header with Hazard Summary */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.title}>COMMUNITY SAFETY MAP</Text>
          <Text style={styles.subtitle}>Subdivision Sector & GPS Hazard Visualizer</Text>
        </View>

        <TouchableOpacity 
          style={[styles.emergencyFocusBtn, dangerCount > 0 && styles.emergencyFocusBtnActive]}
          onPress={focusOnEmergency}
          activeOpacity={0.8}
        >
          <Crosshair color={dangerCount > 0 ? COLORS.danger : COLORS.accent} size={15} style={{ marginRight: 6 }} />
          <Text style={[styles.emergencyFocusText, dangerCount > 0 && { color: COLORS.danger }]}>
            {dangerCount > 0 ? 'Jump to Hazard' : 'Recenter Map'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Metrics & Filter Pills */}
      <View style={styles.summaryBar}>
        <TouchableOpacity 
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
            All Nodes ({totalCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.filterPill, 
            filter === 'hazard' && styles.filterPillActiveHazard,
            (dangerCount > 0 || warningCount > 0) && styles.filterPillHazardGlow
          ]}
          onPress={() => setFilter('hazard')}
        >
          <Flame color={dangerCount > 0 ? COLORS.danger : COLORS.warning} size={12} style={{ marginRight: 4 }} />
          <Text style={[styles.filterPillText, (dangerCount > 0 || warningCount > 0) && { color: COLORS.danger }]}>
            Hazards ({dangerCount + warningCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterPill, filter === 'online' && styles.filterPillActive]}
          onPress={() => setFilter('online')}
        >
          <CheckCircle2 color={COLORS.normal} size={12} style={{ marginRight: 4 }} />
          <Text style={[styles.filterPillText, filter === 'online' && styles.filterPillTextActive]}>
            Safe ({normalCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Map Visual Canvas (Sector Grid & Markers) */}
      <View style={styles.mapCanvasContainer}>
        {/* Sector Blueprint Grid Background */}
        <View style={styles.sectorBlueprint}>
          <View style={styles.sectorPerimeter}>
            {/* Street Lines */}
            <View style={styles.blueprintStreetH1} />
            <View style={styles.blueprintStreetH2} />
            <View style={styles.blueprintStreetV1} />
            <View style={styles.blueprintStreetV2} />

            {/* Sector Labels */}
            <Text style={styles.sectorLabelTopLeft}>SECTOR A (MAIN GATED RESIDENCES)</Text>
            <Text style={styles.sectorLabelBottomRight}>SECTOR B (PERIMETER & ACCESS)</Text>

            {/* Subdivision Guard Gate Indicator */}
            <View style={styles.guardGateMarker}>
              <ShieldAlert color={COLORS.accent} size={12} style={{ marginRight: 4 }} />
              <Text style={styles.guardGateText}>MAIN GUARD GATE</Text>
            </View>

            {/* Visual Interactive Device Pins on Map with N1, N2, N3 readings */}
            {filteredDevices.map((device, idx) => {
              const isSelected = selectedDevice?.mac === device.mac;
              const statusTheme = getStatusColor(device.current_status || 'Normal');
              const isDanger = device.current_status === 'Danger';
              
              const topPos = 45 + (idx * 75);
              const leftPos = 30 + (idx * 55);

              return (
                <TouchableOpacity
                  key={device.mac}
                  style={[
                    styles.mapPinContainer,
                    { top: topPos, left: leftPos },
                    isSelected && styles.mapPinSelected,
                  ]}
                  onPress={() => focusOnDevice(device)}
                  activeOpacity={0.8}
                >
                  {/* Pin Callout Card */}
                  <View style={[
                    styles.pinCalloutCard, 
                    { borderColor: statusTheme.color, backgroundColor: COLORS.cardBackground },
                    isSelected && { borderColor: COLORS.primary, backgroundColor: '#131D31' },
                    isDanger && styles.pinDangerGlow
                  ]}>
                    <View style={styles.pinCalloutTop}>
                      {device.flame ? (
                        <Flame color={COLORS.danger} size={13} style={{ marginRight: 4 }} />
                      ) : (
                        <Home color={statusTheme.color} size={13} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.pinHouseText, isSelected && { color: COLORS.white }]} numberOfLines={1}>
                        {device.house_name}
                      </Text>
                    </View>

                    {/* N1, N2, N3 Channels Pill Row */}
                    <View style={styles.pinChannelsRow}>
                      <View style={[styles.channelPill, { backgroundColor: statusTheme.bg }]}>
                        <Text style={[styles.channelPillText, { color: statusTheme.color }]}>
                          N1:{device.current_ppm ?? 0}
                        </Text>
                      </View>
                      <View style={[styles.channelPill, { backgroundColor: n2Theme.bg }]}>
                        <Text style={[styles.channelPillText, { color: n2Theme.color }]}>
                          N2:{secondaryNodes.N2.ppm ?? 0}
                        </Text>
                      </View>
                      <View style={[styles.channelPill, { backgroundColor: n3Theme.bg }]}>
                        <Text style={[styles.channelPillText, { color: n3Theme.color }]}>
                          N3:{secondaryNodes.N3.ppm ?? 0}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Pin Point Needle */}
                  <View style={[styles.pinNeedle, { backgroundColor: isSelected ? COLORS.primary : statusTheme.color }]} />
                  <View style={[styles.pinDot, { backgroundColor: statusTheme.color }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Nodes List Carousel */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {filteredDevices.map((device) => {
          const isSelected = selectedDevice?.mac === device.mac;
          const statusTheme = getStatusColor(device.current_status || 'Normal');
          const isDanger = device.current_status === 'Danger';

          return (
            <TouchableOpacity
              key={device.mac}
              style={[
                styles.nodeChip,
                { borderColor: isSelected ? COLORS.primary : statusTheme.border },
                isSelected && styles.nodeChipSelected,
                isDanger && styles.nodeChipDanger
              ]}
              onPress={() => focusOnDevice(device)}
              activeOpacity={0.8}
            >
              <View style={[styles.chipIconBg, { backgroundColor: statusTheme.bg }]}>
                {device.flame ? (
                  <Flame color={COLORS.danger} size={16} />
                ) : (
                  <Home color={statusTheme.color} size={16} />
                )}
              </View>

              <View style={styles.chipTextCol}>
                <Text style={[styles.chipTitle, isSelected && { color: COLORS.white }]} numberOfLines={1}>
                  {device.house_name}
                </Text>
                <Text style={styles.chipChannelsSub}>
                  N1: {device.current_ppm ?? 0} • N2: {secondaryNodes.N2.ppm} • N3: {secondaryNodes.N3.ppm} PPM
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom Floating Node Inspector (Displaying N1, N2, and N3) */}
      {selectedDevice && (
        <View style={[styles.inspectorCard, selectedDevice.current_status === 'Danger' && styles.inspectorDangerGlow]}>
          {/* Header */}
          <View style={styles.inspectorHeader}>
            <View style={{ flex: 1, marginRight: SPACING.sm }}>
              <View style={styles.inspectorHouseRow}>
                <Home color={COLORS.primary} size={18} style={{ marginRight: 6 }} />
                <Text style={styles.inspectorTitle} numberOfLines={1}>
                  {selectedDevice.house_name}
                </Text>
              </View>
              <Text style={styles.inspectorSub}>
                {selectedDevice.label} • {selectedDevice.block_lot || 'Block 1 Lot 1'}
              </Text>
            </View>

            <View style={[styles.inspectorStatusBadge, { backgroundColor: activeTheme.bg, borderColor: activeTheme.border }]}>
              <Text style={[styles.inspectorStatusText, { color: activeTheme.color }]}>
                {activeTheme.badgeText}
              </Text>
            </View>
          </View>

          {/* 3-Channel Sensor Matrix (N1, N2, N3) */}
          <View style={styles.channelsGrid}>
            {/* Channel N1 */}
            <View style={[styles.channelCard, { borderColor: activeTheme.border }]}>
              <View style={styles.channelHeaderRow}>
                <Text style={styles.channelHeaderTitle}>CHANNEL N1 (CORE)</Text>
                <Flame color={selectedDevice.flame ? COLORS.danger : COLORS.normal} size={13} />
              </View>
              <Text style={[styles.channelPpmVal, { color: activeTheme.color }]}>
                {n1Ppm} <Text style={styles.channelPpmUnit}>PPM</Text>
              </Text>
              <Text style={[styles.channelFlameStatus, { color: selectedDevice.flame ? COLORS.danger : COLORS.textMuted }]}>
                {selectedDevice.flame ? 'FLAME ON' : 'No Flame'}
              </Text>
            </View>

            {/* Channel N2 */}
            <View style={[styles.channelCard, { borderColor: n2Theme.border }]}>
              <View style={styles.channelHeaderRow}>
                <Text style={styles.channelHeaderTitle}>CHANNEL N2 (NODE 2)</Text>
                <Flame color={secondaryNodes.N2.flame ? COLORS.danger : COLORS.normal} size={13} />
              </View>
              <Text style={[styles.channelPpmVal, { color: n2Theme.color }]}>
                {n2Ppm} <Text style={styles.channelPpmUnit}>PPM</Text>
              </Text>
              <Text style={[styles.channelFlameStatus, { color: secondaryNodes.N2.flame ? COLORS.danger : COLORS.textMuted }]}>
                {secondaryNodes.N2.flame ? 'FLAME ON' : 'No Flame'}
              </Text>
            </View>

            {/* Channel N3 */}
            <View style={[styles.channelCard, { borderColor: n3Theme.border }]}>
              <View style={styles.channelHeaderRow}>
                <Text style={styles.channelHeaderTitle}>CHANNEL N3 (NODE 3)</Text>
                <Flame color={secondaryNodes.N3.flame ? COLORS.danger : COLORS.normal} size={13} />
              </View>
              <Text style={[styles.channelPpmVal, { color: n3Theme.color }]}>
                {n3Ppm} <Text style={styles.channelPpmUnit}>PPM</Text>
              </Text>
              <Text style={[styles.channelFlameStatus, { color: secondaryNodes.N3.flame ? COLORS.danger : COLORS.textMuted }]}>
                {secondaryNodes.N3.flame ? 'FLAME ON' : 'No Flame'}
              </Text>
            </View>
          </View>

          {/* Action Row (Clean without test siren) */}
          <View style={styles.inspectorActionsRow}>
            {/* Action 1: GPS Navigation */}
            <TouchableOpacity 
              style={styles.gpsBtn}
              onPress={() => openGoogleMaps(selectedDevice.latitude, selectedDevice.longitude)}
              activeOpacity={0.8}
            >
              <Navigation color={COLORS.accent} size={15} style={{ marginRight: 6 }} />
              <Text style={styles.gpsBtnText}>Navigate (GPS)</Text>
            </TouchableOpacity>

            {/* Action 2: View Details Page */}
            <TouchableOpacity 
              style={styles.detailsPageBtn}
              onPress={() => {
                router.push({
                  pathname: '/device/[mac]',
                  params: { mac: selectedDevice.mac }
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.detailsPageBtnText}>Subsystem Details</Text>
              <ChevronRight color={COLORS.white} size={15} style={{ marginLeft: 2 }} />
            </TouchableOpacity>

            {/* Action 3: Admin Reassign Button */}
            {isAdmin && (
              <TouchableOpacity 
                style={styles.adminReassignBtn}
                onPress={() => {
                  setEditingDevice(selectedDevice);
                  setEditModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Edit3 color={COLORS.primary} size={15} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Edit Device Modal (Admin Only) */}
      <EditDeviceModal
        visible={editModalVisible}
        device={editingDevice}
        onClose={() => {
          setEditModalVisible(false);
          setEditingDevice(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitleCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  emergencyFocusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  emergencyFocusBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: COLORS.danger,
  },
  emergencyFocusText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  filterPillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  filterPillActiveHazard: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerBg,
  },
  filterPillHazardGlow: {
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  filterPillText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  mapCanvasContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  sectorBlueprint: {
    flex: 1,
    padding: SPACING.md,
  },
  sectorPerimeter: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.6)',
    borderRadius: 14,
    borderStyle: 'dashed',
    position: 'relative',
  },
  blueprintStreetH1: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  blueprintStreetH2: {
    position: 'absolute',
    top: '70%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  blueprintStreetV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '40%',
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  blueprintStreetV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '75%',
    width: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  sectorLabelTopLeft: {
    position: 'absolute',
    top: 8,
    left: 10,
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectorLabelBottomRight: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guardGateMarker: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  guardGateText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '800',
  },
  mapPinContainer: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  mapPinSelected: {
    zIndex: 20,
  },
  pinCalloutCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 140,
    ...SHADOWS.md,
  },
  pinDangerGlow: {
    borderColor: COLORS.danger,
    ...SHADOWS.dangerGlow,
  },
  pinCalloutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pinHouseText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  pinChannelsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  channelPill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  channelPillText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  pinNeedle: {
    width: 2,
    height: 10,
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipsScroll: {
    gap: SPACING.sm,
    paddingVertical: 4,
    marginBottom: SPACING.md,
  },
  nodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    minWidth: 220,
  },
  nodeChipSelected: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  nodeChipDanger: {
    borderColor: COLORS.danger,
  },
  chipIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  chipTextCol: {
    flex: 1,
  },
  chipTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipChannelsSub: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  inspectorCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    ...SHADOWS.lg,
  },
  inspectorDangerGlow: {
    borderColor: COLORS.danger,
    ...SHADOWS.dangerGlow,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  inspectorHouseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectorTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  inspectorSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  inspectorStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  inspectorStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  channelsGrid: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  channelCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: SPACING.sm,
    borderWidth: 1,
  },
  channelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  channelHeaderTitle: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
  channelPpmVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  channelPpmUnit: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  channelFlameStatus: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  inspectorActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  gpsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 10,
    paddingVertical: 11,
  },
  gpsBtnText: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  detailsPageBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    ...SHADOWS.sm,
  },
  detailsPageBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  adminReassignBtn: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 10,
  },
});
