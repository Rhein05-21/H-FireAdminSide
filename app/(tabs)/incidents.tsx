import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  RefreshControl,
  Platform,
  Modal
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
  Filter,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight
} from 'lucide-react-native';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatYYYYMMDD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isSameDay = (dateStr: string, targetYYYYMMDD: string) => {
  try {
    const d = new Date(dateStr);
    return formatYYYYMMDD(d) === targetYYYYMMDD;
  } catch {
    return false;
  }
};

const isToday = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
  } catch {
    return false;
  }
};

const isWithinDays = (dateStr: string, days: number) => {
  try {
    const d = new Date(dateStr).getTime();
    const now = Date.now();
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    return d >= cutoff && d <= now;
  } catch {
    return false;
  }
};

const isThisMonth = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } catch {
    return false;
  }
};

export default function IncidentLogsScreen() {
  const { incidents, devices, resolveIncident, refreshData } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<string>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string | null>(null); // 'YYYY-MM-DD'
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Map of incident counts per day string (YYYY-MM-DD)
  const incidentDatesMap = useMemo(() => {
    const map = new Map<string, number>();
    incidents.forEach(inc => {
      if (inc.start_time) {
        try {
          const key = formatYYYYMMDD(new Date(inc.start_time));
          map.set(key, (map.get(key) || 0) + 1);
        } catch {
          // ignore invalid date
        }
      }
    });
    return map;
  }, [incidents]);

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

        // Date filter
        if (dateFilterMode === 'today' && !isToday(incident.start_time)) {
          return false;
        }
        if (dateFilterMode === '7days' && !isWithinDays(incident.start_time, 7)) {
          return false;
        }
        if (dateFilterMode === 'month' && !isThisMonth(incident.start_time)) {
          return false;
        }
        if (dateFilterMode === 'custom' && customDate && !isSameDay(incident.start_time, customDate)) {
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
  }, [incidents, selectedHousehold, searchQuery, dateFilterMode, customDate]);

  const activeIncidentsCount = incidents.filter(i => i.status === 'Active').length;
  const resolvedIncidentsCount = incidents.filter(i => i.status === 'Resolved').length;

  const renderCalendarDays = () => {
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const cells = [];

    // Blank cells before the 1st day of month
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calendarDayCell} />);
    }

    // Days of month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = dateFilterMode === 'custom' && customDate === dateStr;
      const isCurrentDay = formatYYYYMMDD(new Date()) === dateStr;
      const count = incidentDatesMap.get(dateStr) || 0;

      cells.push(
        <TouchableOpacity
          key={`day-${day}`}
          style={[
            styles.calendarDayCell,
            isCurrentDay && styles.calendarDayCellToday,
            isSelected && styles.calendarDayCellSelected
          ]}
          onPress={() => {
            setCustomDate(dateStr);
            setDateFilterMode('custom');
            setDatePickerVisible(false);
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.calendarDayText,
            isCurrentDay && styles.calendarDayTextToday,
            isSelected && styles.calendarDayTextSelected
          ]}>
            {day}
          </Text>
          {count > 0 && (
            <View style={[styles.incidentDot, isSelected && styles.incidentDotSelected]}>
              <Text style={styles.incidentDotText}>{count > 9 ? '9+' : count}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return cells;
  };

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

      {/* Date Filter Bar & Date Picker Trigger */}
      <View style={styles.dateFilterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateFilterContent}
        >
          {/* Preset: All Time */}
          <TouchableOpacity
            style={[
              styles.dateFilterChip,
              dateFilterMode === 'all' && styles.dateFilterChipActive
            ]}
            onPress={() => {
              setDateFilterMode('all');
              setCustomDate(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateFilterChipText, dateFilterMode === 'all' && styles.dateFilterChipTextActive]}>
              All Dates
            </Text>
          </TouchableOpacity>

          {/* Preset: Today */}
          <TouchableOpacity
            style={[
              styles.dateFilterChip,
              dateFilterMode === 'today' && styles.dateFilterChipActive
            ]}
            onPress={() => {
              setDateFilterMode('today');
              setCustomDate(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateFilterChipText, dateFilterMode === 'today' && styles.dateFilterChipTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          {/* Preset: Past 7 Days */}
          <TouchableOpacity
            style={[
              styles.dateFilterChip,
              dateFilterMode === '7days' && styles.dateFilterChipActive
            ]}
            onPress={() => {
              setDateFilterMode('7days');
              setCustomDate(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateFilterChipText, dateFilterMode === '7days' && styles.dateFilterChipTextActive]}>
              Past 7 Days
            </Text>
          </TouchableOpacity>

          {/* Preset: This Month */}
          <TouchableOpacity
            style={[
              styles.dateFilterChip,
              dateFilterMode === 'month' && styles.dateFilterChipActive
            ]}
            onPress={() => {
              setDateFilterMode('month');
              setCustomDate(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateFilterChipText, dateFilterMode === 'month' && styles.dateFilterChipTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>

          {/* Custom Date Picker Button */}
          <TouchableOpacity
            style={[
              styles.datePickerBtn,
              dateFilterMode === 'custom' && styles.datePickerBtnActive
            ]}
            onPress={() => {
              if (customDate) {
                const parts = customDate.split('-');
                if (parts.length === 3) {
                  setCalendarYear(parseInt(parts[0], 10));
                  setCalendarMonth(parseInt(parts[1], 10) - 1);
                }
              }
              setDatePickerVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Calendar 
              color={dateFilterMode === 'custom' ? COLORS.white : COLORS.accent} 
              size={13} 
              style={{ marginRight: 5 }} 
            />
            <Text style={[styles.datePickerBtnText, dateFilterMode === 'custom' && styles.datePickerBtnTextActive]}>
              {dateFilterMode === 'custom' && customDate ? customDate : 'Pick Date'}
            </Text>
            {dateFilterMode === 'custom' && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  setDateFilterMode('all');
                  setCustomDate(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 6 }}
              >
                <X color={COLORS.white} size={13} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </ScrollView>
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
              {searchQuery || selectedHousehold !== 'all' || dateFilterMode !== 'all' ? 'No Matching Incident Logs' : 'No Incidents Recorded'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedHousehold !== 'all' || dateFilterMode !== 'all'
                ? 'No incident history found for the selected date, filter, or search term.'
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

      {/* Date Picker Interactive Modal */}
      <Modal
        visible={datePickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarModalCard}>
            {/* Calendar Header with Month/Year Navigation */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear(prev => prev - 1);
                  } else {
                    setCalendarMonth(prev => prev - 1);
                  }
                }}
                style={styles.calNavBtn}
              >
                <ChevronLeft color={COLORS.textPrimary} size={18} />
              </TouchableOpacity>

              <Text style={styles.calendarMonthYearText}>
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear(prev => prev + 1);
                  } else {
                    setCalendarMonth(prev => prev + 1);
                  }
                }}
                style={styles.calNavBtn}
              >
                <ChevronRight color={COLORS.textPrimary} size={18} />
              </TouchableOpacity>
            </View>

            {/* Weekday Row */}
            <View style={styles.calendarWeekdaysRow}>
              {WEEKDAY_NAMES.map(w => (
                <Text key={w} style={styles.calendarWeekdayText}>{w}</Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.calendarDaysGrid}>
              {renderCalendarDays()}
            </View>

            {/* Modal Actions */}
            <View style={styles.calendarActionsRow}>
              <TouchableOpacity
                style={styles.calQuickBtn}
                onPress={() => {
                  const todayStr = formatYYYYMMDD(new Date());
                  setCustomDate(todayStr);
                  setDateFilterMode('custom');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.calQuickBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calClearBtn}
                onPress={() => {
                  setCustomDate(null);
                  setDateFilterMode('all');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.calClearBtnText}>Clear Date</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calCloseBtn}
                onPress={() => setDatePickerVisible(false)}
              >
                <Text style={styles.calCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  dateFilterSection: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  dateFilterContent: {
    gap: SPACING.xs,
    alignItems: 'center',
  },
  dateFilterChip: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateFilterChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
  dateFilterChipText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  dateFilterChipTextActive: {
    color: COLORS.accent,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  datePickerBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  datePickerBtnText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  datePickerBtnTextActive: {
    color: COLORS.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  calendarModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  calNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  calendarMonthYearText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
    paddingHorizontal: 4,
  },
  calendarWeekdayText: {
    width: 36,
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 4,
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  calendarDayCellToday: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  calendarDayCellSelected: {
    backgroundColor: COLORS.accent,
  },
  calendarDayText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  calendarDayTextToday: {
    color: COLORS.accent,
    fontWeight: '800',
  },
  calendarDayTextSelected: {
    color: COLORS.white,
    fontWeight: '800',
  },
  incidentDot: {
    position: 'absolute',
    bottom: 2,
    minWidth: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  incidentDotSelected: {
    backgroundColor: COLORS.white,
  },
  incidentDotText: {
    color: COLORS.white,
    fontSize: 7.5,
    fontWeight: '900',
  },
  calendarActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorderSubtle,
  },
  calQuickBtn: {
    flex: 1,
    backgroundColor: COLORS.primaryMuted,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  calQuickBtnText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  calClearBtn: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  calClearBtnText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  calCloseBtn: {
    flex: 1,
    backgroundColor: COLORS.cardBorder,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  calCloseBtnText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});
