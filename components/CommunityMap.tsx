import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const SECTOR_LOT_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '10%', left: '6%' },
  { top: '10%', left: '42%' },
  { top: '22%', left: '20%' },
  { top: '42%', left: '6%' },
  { top: '42%', left: '42%' },
  { top: '54%', left: '20%' },
  { top: '10%', left: '76%' },
  { top: '24%', left: '60%' },
  { top: '42%', left: '76%' },
  { top: '72%', left: '42%' },
  { top: '72%', left: '76%' },
  { top: '72%', left: '18%' },
];

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
  const [isAutoTour, setIsAutoTour] = useState(false);
  const [viewMode, setViewMode] = useState<'googleMaps' | 'blueprint'>('googleMaps');
  const [mapLayer, setMapLayer] = useState<'satellite' | 'roadmap'>('satellite');

  const chipsScrollRef = useRef<ScrollView | null>(null);

  const totalCount = devices.length;
  const dangerCount = devices.filter(d => d.current_status === 'Danger').length;
  const warningCount = devices.filter(d => d.current_status === 'Warning').length;
  const normalCount = devices.filter(d => d.current_status === 'Normal').length;

  const filteredDevices = devices.filter(d => {
    if (filter === 'hazard') return d.current_status === 'Danger' || d.current_status === 'Warning';
    if (filter === 'online') return d.current_status !== 'Offline';
    return true;
  });

  const focusOnDevice = useCallback((device: DeviceRecord, notifyParent: boolean = true) => {
    setSelectedDevice(device);
    if (notifyParent) {
      onSelectDevice?.(device);
    }
    // Auto-scroll the horizontal chips carousel to the focused device
    const targetIdx = filteredDevices.findIndex(d => d.mac === device.mac);
    if (targetIdx >= 0 && chipsScrollRef.current) {
      chipsScrollRef.current.scrollTo({
        x: Math.max(0, targetIdx * 230 - 30),
        animated: true,
      });
    }
  }, [filteredDevices, onSelectDevice]);

  // Synchronize and auto-select a random device on initial load or update
  useEffect(() => {
    if (devices.length === 0) {
      setSelectedDevice(null);
      return;
    }
    if (!selectedDevice) {
      const randomIndex = Math.floor(Math.random() * devices.length);
      focusOnDevice(devices[randomIndex], false);
    } else {
      const fresh = devices.find(d => d.mac === selectedDevice.mac);
      if (fresh) {
        setSelectedDevice(fresh);
      } else {
        const randomIndex = Math.floor(Math.random() * devices.length);
        focusOnDevice(devices[randomIndex], false);
      }
    }
  }, [devices]);

  // Locate random device handler: jumps to a random device (different from current)
  const locateRandomDevice = useCallback((fromAuto: boolean = false) => {
    const candidateList = filteredDevices.length > 0 ? filteredDevices : devices;
    if (!candidateList || candidateList.length === 0) return;

    let targetDevice: DeviceRecord;
    if (candidateList.length === 1) {
      targetDevice = candidateList[0];
    } else {
      // Pick a random device different from the currently selected one
      const pool = candidateList.filter(d => d.mac !== selectedDevice?.mac);
      const candidates = pool.length > 0 ? pool : candidateList;
      const randomIndex = Math.floor(Math.random() * candidates.length);
      targetDevice = candidates[randomIndex];
    }

    focusOnDevice(targetDevice, !fromAuto);
  }, [devices, filteredDevices, selectedDevice, focusOnDevice]);

  // Automatic cycle / tour through random devices
  useEffect(() => {
    if (!isAutoTour) return;
    const interval = setInterval(() => {
      locateRandomDevice(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoTour, locateRandomDevice]);

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
      {/* Top Header with Hazard Summary & Device Locator */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.title}>COMMUNITY SAFETY MAP</Text>
          <Text style={styles.subtitle}>Subdivision Sector & GPS Hazard Visualizer</Text>
        </View>

        <View style={styles.headerActionsRow}>
          <TouchableOpacity 
            style={styles.locateBtn}
            onPress={() => {
              setIsAutoTour(false);
              locateRandomDevice(false);
            }}
            activeOpacity={0.8}
          >
            <Compass color={COLORS.accent} size={15} style={{ marginRight: 6 }} />
            <Text style={styles.locateBtnText}>Locate Devices</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.autoTourBtn, isAutoTour && styles.autoTourBtnActive]}
            onPress={() => setIsAutoTour(prev => !prev)}
            activeOpacity={0.8}
          >
            <Radio color={isAutoTour ? COLORS.primary : COLORS.textMuted} size={13} style={{ marginRight: 4 }} />
            <Text style={[styles.autoTourBtnText, isAutoTour && styles.autoTourBtnTextActive]}>
              {isAutoTour ? 'Auto: ON' : 'Auto'}
            </Text>
          </TouchableOpacity>
        </View>
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

        {/* View Mode Toggle: Google Map vs Blueprint */}
        <View style={styles.viewModeToggleRow}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'googleMaps' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('googleMaps')}
            activeOpacity={0.8}
          >
            <Compass color={viewMode === 'googleMaps' ? COLORS.white : COLORS.accent} size={12} style={{ marginRight: 4 }} />
            <Text style={[styles.viewModeBtnText, viewMode === 'googleMaps' && styles.viewModeBtnTextActive]}>
              Google Map
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'blueprint' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('blueprint')}
            activeOpacity={0.8}
          >
            <Layers color={viewMode === 'blueprint' ? COLORS.white : COLORS.textMuted} size={12} style={{ marginRight: 4 }} />
            <Text style={[styles.viewModeBtnText, viewMode === 'blueprint' && styles.viewModeBtnTextActive]}>
              Blueprint
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Interactive Map Visual Canvas (Google Maps or Sector Blueprint) */}
      <View style={styles.mapCanvasContainer}>
        {viewMode === 'googleMaps' && Platform.OS === 'web' ? (
          <View style={styles.webGoogleMapWrapper}>
            {/* Real Interactive Google Maps Satellite / Streets view */}
            {React.createElement('iframe', {
              key: `${selectedDevice?.mac || 'default'}-${mapLayer}`,
              src: `https://maps.google.com/maps?q=${selectedDevice?.latitude || 14.1777},${selectedDevice?.longitude || 121.2551}&t=${mapLayer === 'satellite' ? 'k' : 'm'}&z=18&ie=UTF8&iwloc=&output=embed`,
              style: {
                width: '100%',
                height: '100%',
                border: 'none',
              },
              title: "Google Satellite Map",
              loading: "lazy",
            })}

            {/* Floating Satellite / Road toggle on top-right of map */}
            <View style={styles.mapFloatingLayerControls}>
              <TouchableOpacity
                style={[styles.layerTogglePill, mapLayer === 'satellite' && styles.layerTogglePillActive]}
                onPress={() => setMapLayer(mapLayer === 'satellite' ? 'roadmap' : 'satellite')}
                activeOpacity={0.8}
              >
                <Layers color={COLORS.white} size={12} style={{ marginRight: 4 }} />
                <Text style={styles.layerTogglePillText}>
                  {mapLayer === 'satellite' ? 'Satellite' : 'Roads'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom floating GPS info badge */}
            <View style={styles.mapFloatingCoordBadge}>
              <Text style={styles.mapFloatingCoordText}>
                📍 {selectedDevice?.house_name || 'Community Node'} • Lat {(selectedDevice?.latitude || 14.1777).toFixed(4)}, Lng {(selectedDevice?.longitude || 121.2551).toFixed(4)}
              </Text>
            </View>
          </View>
        ) : (
          /* Sector Blueprint Grid Background */
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
                
                const lotPos = SECTOR_LOT_POSITIONS[idx % SECTOR_LOT_POSITIONS.length];
                const topPos = lotPos.top;
                const leftPos = lotPos.left;

                return (
                  <TouchableOpacity
                    key={device.mac}
                    style={[
                      styles.mapPinContainer,
                      { top: topPos as any, left: leftPos as any },
                      isSelected && styles.mapPinSelected,
                    ]}
                    onPress={() => {
                      setIsAutoTour(false);
                      focusOnDevice(device, true);
                    }}
                    activeOpacity={0.8}
                  >
                    {/* Pin Callout Card */}
                    <View style={[
                      styles.pinCalloutCard, 
                      { borderColor: statusTheme.color, backgroundColor: COLORS.cardBackground },
                      isSelected && { borderColor: COLORS.accent, backgroundColor: '#131D31' },
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
                        {isSelected && (
                          <View style={styles.locatedBadge}>
                            <Text style={styles.locatedBadgeText}>LOCATED</Text>
                          </View>
                        )}
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
                    <View style={[styles.pinNeedle, { backgroundColor: isSelected ? COLORS.accent : statusTheme.color }]} />
                    <View style={[
                      styles.pinDot, 
                      { backgroundColor: statusTheme.color },
                      isSelected && styles.pinDotSelected
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Nodes List Carousel */}
      <ScrollView 
        ref={chipsScrollRef}
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
                { borderColor: isSelected ? COLORS.accent : statusTheme.border },
                isSelected && styles.nodeChipSelected,
                isDanger && styles.nodeChipDanger
              ]}
              onPress={() => {
                setIsAutoTour(false);
                focusOnDevice(device, true);
              }}
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
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    ...SHADOWS.sm,
  },
  locateBtnText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  autoTourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  autoTourBtnActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  autoTourBtnText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  autoTourBtnTextActive: {
    color: COLORS.white,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  viewModeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  viewModeBtnText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  viewModeBtnTextActive: {
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
    minHeight: 320,
    ...SHADOWS.md,
  },
  webGoogleMapWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    width: '100%',
    minHeight: 320,
  },
  mapFloatingLayerControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  layerTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    ...SHADOWS.sm,
  },
  layerTogglePillActive: {
    borderColor: COLORS.accent,
  },
  layerTogglePillText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  mapFloatingCoordBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    zIndex: 10,
  },
  mapFloatingCoordText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
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
    zIndex: 30,
    transform: [{ scale: 1.05 }],
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
  locatedBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  locatedBadgeText: {
    color: COLORS.accent,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  pinDotSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.white,
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
