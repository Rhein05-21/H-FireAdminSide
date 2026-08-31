import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  RefreshControl, 
  Linking 
} from 'react-native';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import { DeviceCard } from '../../components/DeviceCard';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { getStatusColor, GasStatus } from '../../constants/thresholds';
import { DeviceRecord } from '../../utils/supabase';
import { 
  ShieldAlert, 
  Flame, 
  CheckCircle2, 
  Search, 
  PhoneCall, 
  AlertTriangle, 
  Layers,
  Radio,
  WifiOff,
  X,
  ArrowRight
} from 'lucide-react-native';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const { 
    devices, 
    incidents, 
    communityStatus, 
    refreshData, 
    triggerEmergencyAlert 
  } = useAdmin();
  const { profile, role } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isNormalDismissed, setIsNormalDismissed] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setIsNormalDismissed(false);
    await refreshData();
    setRefreshing(false);
  };

  // Metrics
  const totalCount = devices.length;
  const normalCount = devices.filter(d => d.current_status === 'Normal').length;
  const warningCount = devices.filter(d => d.current_status === 'Warning').length;
  const dangerCount = devices.filter(d => d.current_status === 'Danger').length;
  const offlineCount = devices.filter(d => d.current_status === 'Offline').length;
  const activeIncidentsCount = incidents.filter(i => i.status === 'Active').length;

  const filteredDevices = devices.filter(device => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      (device.house_name && device.house_name.toLowerCase().includes(q)) ||
      (device.label && device.label.toLowerCase().includes(q)) ||
      (device.mac && device.mac.toLowerCase().includes(q)) ||
      (device.block_lot && device.block_lot.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'alerts') return device.current_status === 'Danger' || device.current_status === 'Warning';
    if (filterStatus === 'normal') return device.current_status === 'Normal';
    if (filterStatus === 'offline') return device.current_status === 'Offline';
    return true;
  });

  const statusTheme = getStatusColor(communityStatus);

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Top Community Status Banner */}
        {(!isNormalDismissed || communityStatus !== 'Normal') && (
          <View style={[
            styles.statusBanner, 
            { backgroundColor: statusTheme.bg, borderColor: statusTheme.border },
            communityStatus === 'Danger' && styles.statusBannerGlow
          ]}>
            <View style={styles.statusBannerContent}>
              <View style={styles.statusBannerLeft}>
                {communityStatus === 'Danger' ? (
                  <Flame color={COLORS.danger} size={28} />
                ) : communityStatus === 'Warning' ? (
                  <AlertTriangle color={COLORS.warning} size={28} />
                ) : (
                  <CheckCircle2 color={COLORS.normal} size={28} />
                )}
                <View style={styles.statusTextCol}>
                  <Text style={[styles.statusBannerTitle, { color: statusTheme.color }]}>
                    {communityStatus === 'Danger' ? 'CRITICAL HAZARD DETECTED' : 
                     communityStatus === 'Warning' ? 'COMMUNITY WARNING ALERT' : 'ALL SYSTEMS NORMAL'}
                  </Text>
                  <Text style={styles.statusBannerSubtitle}>
                    {communityStatus === 'Danger' 
                      ? `${activeIncidentsCount} active emergency event(s) requiring response.`
                      : communityStatus === 'Warning'
                      ? 'Elevated gas/smoke concentration detected in sector.'
                      : 'All monitored residential IoT nodes operating safely.'}
                  </Text>
                </View>
              </View>

              {communityStatus === 'Normal' && (
                <TouchableOpacity 
                  style={styles.bannerCloseBtn}
                  onPress={() => setIsNormalDismissed(true)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <X color={COLORS.textMuted} size={18} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Metric Counters Grid */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity 
            style={[styles.metricCard, filterStatus === 'all' && styles.activeMetricCard]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={styles.metricNumber}>{totalCount}</Text>
            <Text style={styles.metricLabel}>Total Nodes</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.metricCard, filterStatus === 'normal' && styles.activeMetricCard]}
            onPress={() => setFilterStatus('normal')}
          >
            <Text style={[styles.metricNumber, { color: COLORS.normal }]}>{normalCount}</Text>
            <Text style={styles.metricLabel}>Safe</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.metricCard, filterStatus === 'alerts' && styles.activeMetricCard]}
            onPress={() => setFilterStatus('alerts')}
          >
            <Text style={[styles.metricNumber, { color: COLORS.warning }]}>{warningCount}</Text>
            <Text style={styles.metricLabel}>Warning</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.metricCard, filterStatus === 'alerts' && styles.activeMetricCard]}
            onPress={() => setFilterStatus('alerts')}
          >
            <Text style={[styles.metricNumber, { color: COLORS.danger }]}>{dangerCount}</Text>
            <Text style={styles.metricLabel}>Critical</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar & Filter Chips */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrapper}>
            <Search color={COLORS.textMuted} size={18} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search house name, lot, label..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsRow}>
          {[
            { key: 'all', label: 'All Nodes' },
            { key: 'alerts', label: `Active Alerts (${warningCount + dangerCount})` },
            { key: 'normal', label: 'Safe Environment' },
            { key: 'offline', label: `Offline (${offlineCount})` },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filterStatus === f.key && styles.filterChipSelected]}
              onPress={() => setFilterStatus(f.key)}
            >
              <Text style={[styles.filterChipText, filterStatus === f.key && styles.filterChipTextSelected]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Device Cards List */}
        <View style={styles.devicesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              DEPLOYED SENSORS ({filteredDevices.length})
            </Text>
            <TouchableOpacity 
              style={styles.viewMapButton}
              onPress={() => router.push('/(tabs)/map')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMapLink}>View on Map</Text>
              <ArrowRight color={COLORS.primary} size={14} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {filteredDevices.length === 0 ? (
            <View style={styles.emptyCard}>
              <WifiOff color={COLORS.textMuted} size={32} />
              <Text style={styles.emptyTitle}>No Nodes Found</Text>
              <Text style={styles.emptySub}>No devices match the current search or filter criteria.</Text>
            </View>
          ) : (
            filteredDevices.map(device => (
              <DeviceCard
                key={device.mac}
                device={device}
                onPress={() => {
                  router.push({
                    pathname: '/device/[mac]',
                    params: { mac: device.mac }
                  });
                }}
              />
            ))
          )}
        </View>

        {/* Emergency Hotline Quick Dialer Bar */}
        <View style={styles.hotlinesCard}>
          <Text style={styles.hotlineCardTitle}>EMERGENCY DISPATCH HOTLINES</Text>
          <View style={styles.hotlineActions}>
            <TouchableOpacity 
              style={[styles.hotlineButton, { backgroundColor: '#DC2626' }]}
              onPress={() => handleCall('911')}
            >
              <PhoneCall color={COLORS.white} size={16} style={{ marginRight: 6 }} />
              <Text style={styles.hotlineButtonText}>Dial 911 (BFP)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.hotlineButton, { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#475569' }]}
              onPress={() => handleCall('88884321')}
            >
              <ShieldAlert color={COLORS.accent} size={16} style={{ marginRight: 6 }} />
              <Text style={[styles.hotlineButtonText, { color: COLORS.accent }]}>Guard Gate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  statusBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  statusBannerGlow: {
    ...SHADOWS.dangerGlow,
  },
  statusBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  statusTextCol: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  statusBannerTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusBannerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  bannerCloseBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeMetricCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  metricNumber: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  searchRow: {
    marginBottom: SPACING.sm,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterChipsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  filterChip: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: SPACING.sm,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: COLORS.white,
    fontWeight: '700',
  },
  devicesSection: {
    marginBottom: SPACING.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewMapLink: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  hotlinesCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  hotlineCardTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  hotlineActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  hotlineButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  hotlineButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
