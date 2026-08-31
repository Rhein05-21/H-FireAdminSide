import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  RefreshControl,
  Platform 
} from 'react-native';
import { useAdmin } from '../../context/AdminContext';
import { IncidentCard } from '../../components/IncidentCard';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { 
  ClipboardList, 
  Search, 
  X, 
  Home, 
  ShieldAlert, 
  ShieldCheck, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle,
  Flame,
  Filter
} from 'lucide-react-native';

export default function IncidentLogsScreen() {
  const { incidents, devices, resolveIncident, refreshData } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Unique list of households with devices
  const households = useMemo(() => {
    const map = new Map<string, { houseName: string; mac: string }>();
    devices.forEach(d => {
      if (d.house_name) {
        map.set(d.house_name, { houseName: d.house_name, mac: d.mac });
      }
    });
    return Array.from(map.values());
  }, [devices]);

  // Filtered & Sorted Incidents
  const filteredIncidents = useMemo(() => {
    return incidents
      .filter(incident => {
        // Household chip filter
        if (selectedHousehold !== 'all' && incident.house_name !== selectedHousehold) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchHouse = incident.house_name?.toLowerCase().includes(q);
          const matchResident = incident.resident_name?.toLowerCase().includes(q);
          const matchBlock = incident.block_lot?.toLowerCase().includes(q);
          const matchMac = incident.device_mac?.toLowerCase().includes(q);
          const matchAlert = incident.alert_type?.toLowerCase().includes(q);
          const matchNotes = incident.notes?.toLowerCase().includes(q);

          if (!matchHouse && !matchResident && !matchBlock && !matchMac && !matchAlert && !matchNotes) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [incidents, selectedHousehold, searchQuery]);

  const activeIncidentsCount = incidents.filter(i => i.status === 'Active').length;
  const resolvedIncidentsCount = incidents.filter(i => i.status === 'Resolved').length;

  return (
    <View style={styles.container}>
      {/* Top Header Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTitleRow}>
          <ClipboardList color={COLORS.primary} size={18} style={{ marginRight: 6 }} />
          <Text style={styles.summaryTitle}>COMMUNITY INCIDENT AUDIT TRAIL</Text>
        </View>
        <Text style={styles.summarySubtitle}>
          Real-time safety history and alarm logs across all monitored households with IoT units
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>TOTAL LOGS</Text>
            <Text style={styles.metricVal}>{incidents.length}</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>ACTIVE ALERTS</Text>
            <Text style={[styles.metricVal, { color: activeIncidentsCount > 0 ? COLORS.danger : COLORS.normal }]}>
              {activeIncidentsCount}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>MONITORED HOMES</Text>
            <Text style={[styles.metricVal, { color: COLORS.accent }]}>
              {devices.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchWrapper}>
          <Search color={COLORS.textMuted} size={16} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search logs by household, resident, block/lot, MAC..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X color={COLORS.textMuted} size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Household Filter Chips (Horizontal Scroller) */}
      {households.length > 0 && (
        <View style={styles.filterChipsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsContent}
          >
            <TouchableOpacity
              style={[
                styles.chipBtn,
                selectedHousehold === 'all' && styles.activeChipBtn
              ]}
              onPress={() => setSelectedHousehold('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selectedHousehold === 'all' && styles.activeChipText]}>
                All Households ({incidents.length})
              </Text>
            </TouchableOpacity>

            {households.map((h) => {
              const isSelected = selectedHousehold === h.houseName;
              const houseIncidentCount = incidents.filter(i => i.house_name === h.houseName).length;

              return (
                <TouchableOpacity
                  key={h.houseName}
                  style={[
                    styles.chipBtn,
                    isSelected && styles.activeChipBtn
                  ]}
                  onPress={() => setSelectedHousehold(h.houseName)}
                  activeOpacity={0.7}
                >
                  <Home color={isSelected ? COLORS.primary : COLORS.textMuted} size={12} style={{ marginRight: 4 }} />
                  <Text style={[styles.chipText, isSelected && styles.activeChipText]} numberOfLines={1}>
                    {h.houseName} ({houseIncidentCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Incident Log Feed */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {filteredIncidents.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle2 color={COLORS.normal} size={44} />
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedHousehold !== 'all' ? 'No Matching Incident Logs' : 'No Incidents Recorded'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedHousehold !== 'all'
                ? 'No incident history found for the selected filter or search term.'
                : 'All community households with H-Fire sensor nodes are operating under safe atmospheric conditions.'}
            </Text>
          </View>
        ) : (
          filteredIncidents.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onResolve={(id, notes) => resolveIncident(id, notes)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  summaryCard: {
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summarySubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: SPACING.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    gap: SPACING.sm,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  searchSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 9 : 4,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingVertical: 4,
  },
  filterChipsContainer: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorderSubtle,
  },
  filterChipsContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeChipBtn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  activeChipText: {
    color: COLORS.white,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  emptyState: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
