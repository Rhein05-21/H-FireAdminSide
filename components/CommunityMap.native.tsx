import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Platform 
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { DeviceRecord } from '../utils/supabase';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { getStatusColor } from '../constants/thresholds';
import { 
  Home, 
  Flame, 
  Layers, 
  Crosshair, 
  ShieldAlert,
  Compass,
  Radio,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CommunityMapProps {
  devices: DeviceRecord[];
  initialFocusMac?: string;
  onSelectDevice?: (device: DeviceRecord) => void;
  onTriggerEmergency?: (device: DeviceRecord) => void;
}

export const CommunityMap: React.FC<CommunityMapProps> = ({ 
  devices, 
  initialFocusMac,
  onSelectDevice,
  onTriggerEmergency 
}) => {
  const insets = useSafeAreaInsets();
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPage, setDropdownPage] = useState(1);
  const DROPDOWN_PAGE_SIZE = 5;

  const totalPages = Math.max(1, Math.ceil(devices.length / DROPDOWN_PAGE_SIZE));
  const paginatedDevices = devices.slice(
    (dropdownPage - 1) * DROPDOWN_PAGE_SIZE,
    dropdownPage * DROPDOWN_PAGE_SIZE
  );

  const mapRef = useRef<MapView | null>(null);

  const initialRegion = {
    latitude: devices[0]?.latitude || 14.1777,
    longitude: devices[0]?.longitude || 121.2551,
    latitudeDelta: 0.006,
    longitudeDelta: 0.006,
  };

  const focusOnDevice = useCallback((device: DeviceRecord) => {
    setSelectedDevice(device);
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: device.latitude,
        longitude: device.longitude,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      }, 500);
    }
  }, []);

  // Find all nodes belonging to the SAME household
  const getSameHouseholdDevices = useCallback((curr: DeviceRecord | null) => {
    if (!curr) return [];
    return devices.filter(d => {
      if (curr.profile_id && d.profile_id && curr.profile_id === d.profile_id) return true;
      if (curr.house_name && d.house_name && curr.house_name.trim().toLowerCase() === d.house_name.trim().toLowerCase()) return true;
      if (curr.block_lot && d.block_lot && curr.block_lot.trim().toLowerCase() === d.block_lot.trim().toLowerCase()) return true;
      return false;
    });
  }, [devices]);

  // Locate household node handler: locates / cycles nodes of the SAME household, or re-centers on the current node
  const locateHouseholdNode = useCallback(() => {
    if (!selectedDevice || devices.length === 0) return;

    const sameHouseholdDevices = getSameHouseholdDevices(selectedDevice);

    if (sameHouseholdDevices.length > 1) {
      // Cycle to the next device/node of the same household
      const currentIdx = sameHouseholdDevices.findIndex(d => d.mac === selectedDevice.mac);
      const nextIdx = (currentIdx + 1) % sameHouseholdDevices.length;
      focusOnDevice(sameHouseholdDevices[nextIdx]);
    } else {
      // Re-center on this household device position
      focusOnDevice(selectedDevice);
    }
  }, [devices, selectedDevice, getSameHouseholdDevices, focusOnDevice]);

  // Synchronize and focus device on initial load, parameter change, or list update
  useEffect(() => {
    if (devices.length === 0) {
      setSelectedDevice(null);
      return;
    }

    // 1. Explicit initialFocusMac
    if (initialFocusMac) {
      const target = devices.find(d => d.mac.toUpperCase() === initialFocusMac.toUpperCase());
      if (target) {
        focusOnDevice(target);
        return;
      }
    }

    // 2. Keep selected device updated
    if (selectedDevice) {
      const fresh = devices.find(d => d.mac === selectedDevice.mac);
      if (fresh) {
        setSelectedDevice(fresh);
        return;
      }
    }

    // 3. Fallback: prioritize hazard or first device (never random!)
    const hazard = devices.find(d => d.current_status === 'Danger') || devices.find(d => d.current_status === 'Warning');
    focusOnDevice(hazard || devices[0]);
  }, [devices, initialFocusMac]);

  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a202c' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a202c' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  ];

  return (
    <View style={styles.container}>
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        mapType={mapType}
        showsUserLocation={true}
        showsCompass={true}
      >
        {devices.map((device) => {
          const statusTheme = getStatusColor(device.current_status || 'Normal');
          const isDanger = device.current_status === 'Danger';

          return (
            <Marker
              key={device.mac}
              coordinate={{ latitude: device.latitude, longitude: device.longitude }}
              onPress={() => setSelectedDevice(device)}
            >
              <View style={[
                styles.markerPin, 
                { backgroundColor: statusTheme.color },
                isDanger && styles.dangerMarkerGlow
              ]}>
                {device.flame ? (
                  <Flame color={COLORS.white} size={14} />
                ) : (
                  <Home color={COLORS.white} size={14} />
                )}
              </View>

              <Callout tooltip onPress={() => onSelectDevice?.(device)}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{device.house_name}</Text>
                  <Text style={styles.calloutSubtitle}>{device.label}</Text>
                  <View style={styles.calloutPpmRow}>
                    <Text style={[styles.calloutPpm, { color: statusTheme.color }]}>
                      {device.current_ppm ?? 0} PPM
                    </Text>
                    <Text style={[styles.calloutStatus, { color: statusTheme.color }]}>
                      {statusTheme.badgeText}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Device Selector Dropdown with Pagination */}
      <View style={[styles.nativeDropdownContainer, { top: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity
          style={[styles.nativeDropdownTrigger, dropdownOpen && styles.nativeDropdownTriggerActive]}
          onPress={() => setDropdownOpen(prev => !prev)}
          activeOpacity={0.8}
        >
          <View style={[styles.triggerIconBg, { backgroundColor: getStatusColor(selectedDevice?.current_status || 'Normal').bg }]}>
            {selectedDevice?.flame ? (
              <Flame color={COLORS.danger} size={14} />
            ) : (
              <Home color={getStatusColor(selectedDevice?.current_status || 'Normal').color} size={14} />
            )}
          </View>

          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.triggerHouseText} numberOfLines={1}>
              {selectedDevice?.house_name || 'Select a Device'}
            </Text>
            <Text style={styles.triggerSubText} numberOfLines={1}>
              {selectedDevice ? `${selectedDevice.label} • ${selectedDevice.current_ppm ?? 0} PPM` : 'Tap to choose node'}
            </Text>
          </View>

          <View style={styles.chevronWrap}>
            {dropdownOpen ? (
              <ChevronUp color={COLORS.accent} size={16} />
            ) : (
              <ChevronDown color={COLORS.textMuted} size={16} />
            )}
          </View>
        </TouchableOpacity>

        {dropdownOpen && (
          <View style={styles.nativeDropdownPanel}>
            <ScrollView
              style={styles.nativeDropdownScrollList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {paginatedDevices.map((device) => {
                const isSelected = selectedDevice?.mac === device.mac;
                const statusTheme = getStatusColor(device.current_status || 'Normal');

                return (
                  <TouchableOpacity
                    key={device.mac}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                    onPress={() => {
                      focusOnDevice(device);
                      setDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.itemIconBg, { backgroundColor: statusTheme.bg }]}>
                      {device.flame ? (
                        <Flame color={COLORS.danger} size={12} />
                      ) : (
                        <Home color={statusTheme.color} size={12} />
                      )}
                    </View>

                    <View style={styles.itemTextCol}>
                      <Text style={[styles.itemHouseName, isSelected && { color: COLORS.accent }]} numberOfLines={1}>
                        {device.house_name}
                      </Text>
                      <Text style={styles.itemDetailsSub} numberOfLines={1}>
                        {device.label} • {device.block_lot || 'Unit'}
                      </Text>
                    </View>

                    <View style={[styles.itemPpmBadge, { backgroundColor: statusTheme.bg, borderColor: statusTheme.border }]}>
                      <Text style={[styles.itemPpmText, { color: statusTheme.color }]}>
                        {device.current_ppm ?? 0} PPM
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.paginationBar}>
              <TouchableOpacity
                style={[styles.pageBtn, dropdownPage <= 1 && styles.pageBtnDisabled]}
                onPress={() => setDropdownPage(p => Math.max(1, p - 1))}
                disabled={dropdownPage <= 1}
                activeOpacity={0.7}
              >
                <ChevronLeft color={dropdownPage <= 1 ? COLORS.textMuted : COLORS.white} size={12} />
                <Text style={[styles.pageBtnText, dropdownPage <= 1 && styles.pageBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>

              <Text style={styles.pageInfoText}>
                Page {dropdownPage}/{totalPages} ({devices.length} total)
              </Text>

              <TouchableOpacity
                style={[styles.pageBtn, dropdownPage >= totalPages && styles.pageBtnDisabled]}
                onPress={() => setDropdownPage(p => Math.min(totalPages, p + 1))}
                disabled={dropdownPage >= totalPages}
                activeOpacity={0.7}
              >
                <Text style={[styles.pageBtnText, dropdownPage >= totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                <ChevronRight color={dropdownPage >= totalPages ? COLORS.textMuted : COLORS.white} size={12} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Map Control Buttons */}
      <View style={[styles.controlsRow, { top: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity 
          style={styles.controlBtn}
          onPress={() => setMapType(prev => prev === 'standard' ? 'satellite' : 'standard')}
          activeOpacity={0.8}
        >
          <Layers color={COLORS.textPrimary} size={18} />
        </TouchableOpacity>
      </View>

      {/* Selected Device Floating Inspector Bottom Card */}
      {selectedDevice && (
        <View style={[styles.inspectorCard, { bottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.inspectorHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inspectorTitle}>{selectedDevice.house_name}</Text>
              <Text style={styles.inspectorSub}>{selectedDevice.block_lot} • {selectedDevice.label}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedDevice(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inspectorStatsRow}>
            <View style={styles.inspectorStat}>
              <Text style={styles.inspectorStatLabel}>PPM READING</Text>
              <Text style={[styles.inspectorStatValue, { color: getStatusColor(selectedDevice.current_status || 'Normal').color }]}>
                {selectedDevice.current_ppm ?? 0} PPM
              </Text>
            </View>
            <View style={styles.inspectorStat}>
              <Text style={styles.inspectorStatLabel}>STATUS</Text>
              <Text style={[styles.inspectorStatValue, { color: getStatusColor(selectedDevice.current_status || 'Normal').color }]}>
                {selectedDevice.current_status?.toUpperCase()}
              </Text>
            </View>
          </View>

          {onTriggerEmergency && (
            <TouchableOpacity 
              style={styles.inspectorActionBtn}
              onPress={() => onTriggerEmergency(selectedDevice)}
              activeOpacity={0.8}
            >
              <ShieldAlert color={COLORS.white} size={16} style={{ marginRight: 6 }} />
              <Text style={styles.inspectorActionText}>Test Community Siren for this Node</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  dangerMarkerGlow: {
    borderColor: '#FEE2E2',
    borderWidth: 3,
    ...SHADOWS.dangerGlow,
  },
  calloutContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    width: 180,
  },
  calloutTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  calloutSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  calloutPpmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  calloutPpm: {
    fontWeight: '800',
    fontSize: 13,
  },
  calloutStatus: {
    fontWeight: '700',
    fontSize: 11,
  },
  controlsRow: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  controlBtn: {
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  nativeDropdownContainer: {
    position: 'absolute',
    left: SPACING.md,
    right: 76,
    zIndex: 99,
  },
  nativeDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1.5,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...SHADOWS.md,
  },
  nativeDropdownTriggerActive: {
    borderColor: COLORS.accent,
  },
  triggerIconBg: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  triggerHouseText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  triggerSubText: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  chevronWrap: {
    paddingLeft: 2,
  },
  nativeDropdownPanel: {
    marginTop: 6,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    padding: 8,
    ...SHADOWS.lg,
  },
  nativeDropdownScrollList: {
    maxHeight: 180,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131D31',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 5,
  },
  dropdownItemSelected: {
    borderColor: COLORS.accent,
    backgroundColor: '#1E2D4A',
  },
  itemIconBg: {
    width: 22,
    height: 22,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  itemTextCol: {
    flex: 1,
    marginRight: 6,
  },
  itemHouseName: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  itemDetailsSub: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  itemPpmBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  itemPpmText: {
    fontSize: 9,
    fontWeight: '700',
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    gap: 2,
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  pageBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  pageInfoText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  inspectorCard: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.lg,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  inspectorTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  inspectorSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  inspectorStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  inspectorStat: {
    flex: 1,
  },
  inspectorStatLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inspectorStatValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  inspectorActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    borderRadius: 10,
  },
  inspectorActionText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
