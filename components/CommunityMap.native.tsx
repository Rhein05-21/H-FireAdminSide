import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
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
  Radio
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CommunityMapProps {
  devices: DeviceRecord[];
  onSelectDevice?: (device: DeviceRecord) => void;
  onTriggerEmergency?: (device: DeviceRecord) => void;
}

export const CommunityMap: React.FC<CommunityMapProps> = ({ 
  devices, 
  onSelectDevice,
  onTriggerEmergency 
}) => {
  const insets = useSafeAreaInsets();
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const mapRef = useRef<MapView | null>(null);

  const initialRegion = {
    latitude: 14.6000,
    longitude: 120.9845,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
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

  const locateRandomDevice = useCallback(() => {
    if (!devices || devices.length === 0) return;
    if (devices.length === 1) {
      focusOnDevice(devices[0]);
      return;
    }
    const pool = devices.filter(d => d.mac !== selectedDevice?.mac);
    const candidates = pool.length > 0 ? pool : devices;
    const randomIndex = Math.floor(Math.random() * candidates.length);
    focusOnDevice(candidates[randomIndex]);
  }, [devices, selectedDevice, focusOnDevice]);

  // Synchronize and auto-select a random device on initial load
  useEffect(() => {
    if (devices.length === 0) {
      setSelectedDevice(null);
      return;
    }
    if (!selectedDevice) {
      const randomIndex = Math.floor(Math.random() * devices.length);
      focusOnDevice(devices[randomIndex]);
    } else {
      const fresh = devices.find(d => d.mac === selectedDevice.mac);
      if (fresh) {
        setSelectedDevice(fresh);
      }
    }
  }, [devices]);

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
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={darkMapStyle}
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

      {/* Map Control Buttons */}
      <View style={styles.controlsRow}>
        <TouchableOpacity 
          style={[styles.controlBtn, styles.locateBtn]}
          onPress={locateRandomDevice}
          activeOpacity={0.8}
        >
          <Compass color={COLORS.accent} size={18} style={{ marginRight: 6 }} />
          <Text style={styles.locateBtnText}>Locate Devices</Text>
        </TouchableOpacity>

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
  locateBtn: {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.accent,
  },
  locateBtnText: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 12,
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
