import React, { useState, useMemo } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Linking, 
  Platform,
  FlatList,
  Dimensions
} from 'react-native';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { ProfileRecord, DeviceRecord } from '../utils/supabase';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { getStatusColor, THRESHOLDS } from '../constants/thresholds';
import { 
  Users, 
  ShieldCheck, 
  Shield, 
  Flame, 
  User, 
  Home, 
  Phone, 
  Mail, 
  MapPin, 
  Cpu, 
  Radio, 
  Bell, 
  ChevronRight, 
  X, 
  Search, 
  Activity, 
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react-native';
import { router } from 'expo-router';

interface UserDirectoryModalProps {
  visible: boolean;
  onClose: () => void;
}

type RoleFilter = 'all' | 'admin' | 'hoa' | 'guard' | 'resident' | 'with_device';

export const UserDirectoryModal: React.FC<UserDirectoryModalProps> = ({
  visible,
  onClose,
}) => {
  const { profiles, devices } = useAdmin();
  const { profile: currentAdminProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<RoleFilter>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Merge loaded profiles with any active demo/admin profile fallback if empty
  const allProfiles = useMemo(() => {
    let list: ProfileRecord[] = [...profiles];
    if (list.length === 0 && currentAdminProfile) {
      list = [currentAdminProfile];
    }
    // Remove duplicate profiles by ID or email
    const seen = new Set<string>();
    return list.filter(p => {
      const key = (p.id || p.email || p.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [profiles, currentAdminProfile]);

  // Find linked devices for a user profile
  const getLinkedDevicesForProfile = (p: ProfileRecord): DeviceRecord[] => {
    const pName = p.name?.trim().toLowerCase();
    const pId = p.id;
    const pBlock = p.block_lot?.trim().toLowerCase();

    return devices.filter(d => {
      if (pId && d.profile_id === pId) return true;
      if (pName && d.resident_name?.trim().toLowerCase() === pName) return true;
      if (pBlock && d.block_lot?.trim().toLowerCase() === pBlock) return true;
      return false;
    });
  };

  // Filter and search
  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allProfiles.filter(p => {
      const pRole = (p.role || (p.is_admin ? 'admin' : 'resident')).toLowerCase();
      const linkedDevs = getLinkedDevicesForProfile(p);
      const isResident = pRole !== 'admin' && pRole !== 'hoa' && pRole !== 'guard';

      // Role filter check
      if (selectedRoleFilter === 'admin' && pRole !== 'admin') return false;
      if (selectedRoleFilter === 'hoa' && pRole !== 'hoa') return false;
      if (selectedRoleFilter === 'guard' && pRole !== 'guard') return false;
      if (selectedRoleFilter === 'resident' && !isResident) return false;
      if (selectedRoleFilter === 'with_device' && linkedDevs.length === 0) return false;

      // Query search check
      if (!query) return true;

      const matchName = (p.name || '').toLowerCase().includes(query);
      const matchEmail = (p.email || '').toLowerCase().includes(query);
      const matchPhone = (p.emergency_hotline || '').toLowerCase().includes(query);
      const matchBlock = (p.block_lot || '').toLowerCase().includes(query);
      const matchAddress = (p.address || '').toLowerCase().includes(query);
      const matchRole = pRole.includes(query);
      const matchMac = linkedDevs.some(d => d.mac?.toLowerCase().includes(query) || d.label?.toLowerCase().includes(query));

      return matchName || matchEmail || matchPhone || matchBlock || matchAddress || matchRole || matchMac;
    });
  }, [allProfiles, devices, searchQuery, selectedRoleFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = allProfiles.length;
    const admins = allProfiles.filter(p => (p.role === 'admin' || (p.is_admin && !p.role))).length;
    const hoas = allProfiles.filter(p => p.role === 'hoa').length;
    const guards = allProfiles.filter(p => p.role === 'guard').length;
    const residents = total - admins - hoas - guards;
    const withDevice = allProfiles.filter(p => getLinkedDevicesForProfile(p).length > 0).length;

    return { total, admins, hoas, guards, residents: Math.max(0, residents), withDevice };
  }, [allProfiles, devices]);

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {});
  };

  const handleOpenDevice = (mac: string) => {
    onClose();
    router.push(`/device/${encodeURIComponent(mac)}`);
  };

  const formatLastSeen = (isoStr?: string) => {
    if (!isoStr) return 'Not recorded';
    try {
      const diffSecs = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
      if (diffSecs < 60) return `Active (${diffSecs}s ago)`;
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      return `${Math.floor(diffSecs / 3600)}h ago`;
    } catch {
      return 'Online';
    }
  };

  const renderRoleBadge = (rawRole?: string, isAdmin?: boolean) => {
    const roleKey = (rawRole || (isAdmin ? 'admin' : 'resident')).toLowerCase();

    if (roleKey === 'admin') {
      return (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: COLORS.primary }]}>
          <ShieldCheck color={COLORS.primary} size={12} style={{ marginRight: 4 }} />
          <Text style={[styles.roleBadgeText, { color: COLORS.primary }]}>ADMINISTRATOR</Text>
        </View>
      );
    }
    if (roleKey === 'hoa') {
      return (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: COLORS.accent }]}>
          <Shield color={COLORS.accent} size={12} style={{ marginRight: 4 }} />
          <Text style={[styles.roleBadgeText, { color: COLORS.accent }]}>HOA OFFICER</Text>
        </View>
      );
    }
    if (roleKey === 'guard') {
      return (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: COLORS.warning }]}>
          <Flame color={COLORS.warning} size={12} style={{ marginRight: 4 }} />
          <Text style={[styles.roleBadgeText, { color: COLORS.warning }]}>SECURITY GUARD</Text>
        </View>
      );
    }
    return (
      <View style={[styles.roleBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: COLORS.normal }]}>
        <Home color={COLORS.normal} size={12} style={{ marginRight: 4 }} />
        <Text style={[styles.roleBadgeText, { color: COLORS.normal }]}>RESIDENTIAL OWNER</Text>
      </View>
    );
  };

  const renderUserCard = (user: ProfileRecord) => {
    const linkedDevices = getLinkedDevicesForProfile(user);
    const hasDevice = linkedDevices.length > 0;
    const isExpanded = expandedUserId === user.id;
    const roleKey = (user.role || (user.is_admin ? 'admin' : 'resident')).toLowerCase();

    return (
      <View key={user.id || user.email} style={styles.userCard}>
        {/* User Card Header */}
        <TouchableOpacity 
          style={styles.userHeaderRow}
          onPress={() => setExpandedUserId(isExpanded ? null : user.id)}
          activeOpacity={0.8}
        >
          <View style={[
            styles.avatarCircle,
            roleKey === 'admin' && { backgroundColor: COLORS.primary },
            roleKey === 'hoa' && { backgroundColor: COLORS.accent },
            roleKey === 'guard' && { backgroundColor: COLORS.warning },
            roleKey !== 'admin' && roleKey !== 'hoa' && roleKey !== 'guard' && { backgroundColor: COLORS.normal }
          ]}>
            <Text style={styles.avatarLetter}>{(user.name || 'U').charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.userInfoCol}>
            <View style={styles.userNameRow}>
              <Text style={styles.userNameText}>{user.name || 'Anonymous User'}</Text>
              {renderRoleBadge(user.role, user.is_admin)}
            </View>
            <Text style={styles.userEmailText}>{user.email || 'No email registered'}</Text>
          </View>

          <ChevronRight 
            color={COLORS.textMuted} 
            size={18} 
            style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {/* Quick Info Strip */}
        <View style={styles.infoStrip}>
          <View style={styles.infoStripItem}>
            <MapPin color={COLORS.textSecondary} size={13} style={{ marginRight: 4 }} />
            <Text style={styles.infoStripText} numberOfLines={1}>
              {user.block_lot || user.address || 'Subdivision Block unassigned'}
            </Text>
          </View>

          {user.emergency_hotline ? (
            <TouchableOpacity 
              style={styles.phoneLinkBtn}
              onPress={() => handleCall(user.emergency_hotline)}
              activeOpacity={0.7}
            >
              <Phone color={COLORS.primary} size={12} style={{ marginRight: 4 }} />
              <Text style={styles.phoneLinkText}>{user.emergency_hotline}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Connected IoT Hardware Section */}
        {hasDevice ? (
          <View style={styles.hardwareContainer}>
            <View style={styles.hardwareHeaderRow}>
              <View style={styles.hardwareBadge}>
                <Radio color={COLORS.primary} size={12} style={{ marginRight: 4 }} />
                <Text style={styles.hardwareBadgeText}>
                  {linkedDevices.length === 1 ? 'PAIRED IOT SENSOR NODE' : `${linkedDevices.length} PAIRED SENSOR NODES`}
                </Text>
              </View>
            </View>

            {linkedDevices.map((dev) => {
              const status = dev.current_status || 'Normal';
              const statusCfg = getStatusColor(status);
              const ppm = dev.current_ppm ?? 0;
              const hasFlame = Boolean(dev.flame);

              return (
                <View key={dev.mac} style={styles.deviceItemBox}>
                  <View style={styles.deviceItemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceLabelText}>{dev.label || 'IoT Air Quality Node'}</Text>
                      <View style={styles.macPill}>
                        <Cpu color={COLORS.textMuted} size={11} style={{ marginRight: 4 }} />
                        <Text style={styles.macPillText}>MAC: {dev.mac}</Text>
                      </View>
                    </View>

                    {/* Status Pill */}
                    <View style={[styles.sensorStatusPill, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                      <Text style={[styles.sensorStatusPillText, { color: statusCfg.color }]}>
                        {status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Telemetry Metrics */}
                  <View style={styles.telemetryGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>GAS / SMOKE LEVEL</Text>
                      <Text style={[styles.metricVal, { color: statusCfg.color }]}>
                        {ppm} <Text style={styles.metricUnit}>PPM</Text>
                      </Text>
                    </View>

                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>OPTICAL FLAME</Text>
                      <Text style={[styles.metricVal, { color: hasFlame ? COLORS.danger : COLORS.normal }]}>
                        {hasFlame ? '🔥 FLAME ACTIVE' : '🛡️ SAFE'}
                      </Text>
                    </View>
                  </View>

                  {/* Device GPS & Action */}
                  <View style={styles.deviceFooterRow}>
                    <View style={styles.gpsInfo}>
                      <Clock color={COLORS.textMuted} size={11} style={{ marginRight: 4 }} />
                      <Text style={styles.gpsText}>{formatLastSeen(dev.last_seen)}</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.inspectBtn}
                      onPress={() => handleOpenDevice(dev.mac)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.inspectBtnText}>Inspect Live Node</Text>
                      <ExternalLink color={COLORS.primary} size={12} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.noDeviceBox}>
            <Cpu color={COLORS.textMuted} size={14} style={{ marginRight: 6 }} />
            <Text style={styles.noDeviceText}>No hardware IoT node assigned to this user profile</Text>
          </View>
        )}

        {/* Expanded Profile Deep-Dive Information */}
        {isExpanded && (
          <View style={styles.expandedContainer}>
            <View style={styles.expandedDivider} />
            <Text style={styles.expandedTitle}>PROFILE METADATA & TELEMETRY</Text>
            
            <View style={styles.expandedGrid}>
              <View style={styles.expandedItem}>
                <Text style={styles.expandedItemLabel}>System User ID</Text>
                <Text style={styles.expandedItemVal} numberOfLines={1}>{user.id || 'N/A'}</Text>
              </View>

              <View style={styles.expandedItem}>
                <Text style={styles.expandedItemLabel}>Push Alert Token</Text>
                <Text style={styles.expandedItemVal}>
                  {user.push_token ? '🟢 Registered for Emergency Sirens' : '⚪ Token Not Registered'}
                </Text>
              </View>

              <View style={styles.expandedItem}>
                <Text style={styles.expandedItemLabel}>Coordinates</Text>
                <Text style={styles.expandedItemVal}>
                  {user.latitude && user.longitude 
                    ? `Lat: ${user.latitude.toFixed(4)}, Lng: ${user.longitude.toFixed(4)}`
                    : 'Auto-mapped to subdivision center'}
                </Text>
              </View>

              <View style={styles.expandedItem}>
                <Text style={styles.expandedItemLabel}>Last Synced</Text>
                <Text style={styles.expandedItemVal}>{formatLastSeen(user.updated_at)}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalWrapper}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBg}>
                <Users color={COLORS.primary} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>User & IoT Device Registry</Text>
                <Text style={styles.headerSub}>
                  Command overview of registered officers, residents, and connected nodes
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <X color={COLORS.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            {/* Quick Stats Strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statPill}>
                <Text style={styles.statPillVal}>{stats.total}</Text>
                <Text style={styles.statPillLabel}>Users</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={[styles.statPillVal, { color: COLORS.primary }]}>{stats.admins}</Text>
                <Text style={styles.statPillLabel}>Admins</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={[styles.statPillVal, { color: COLORS.accent }]}>{stats.hoas}</Text>
                <Text style={styles.statPillLabel}>HOA</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={[styles.statPillVal, { color: COLORS.warning }]}>{stats.guards}</Text>
                <Text style={styles.statPillLabel}>Guards</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={[styles.statPillVal, { color: COLORS.normal }]}>{stats.withDevice}</Text>
                <Text style={styles.statPillLabel}>IoT Linked</Text>
              </View>
            </View>

            {/* Live Search Input */}
            <View style={styles.searchWrapper}>
              <Search color={COLORS.textMuted} size={16} style={{ marginRight: SPACING.sm }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search name, email, phone, block/lot, or device MAC..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X color={COLORS.textMuted} size={16} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
              {[
                { key: 'all', label: `All (${stats.total})` },
                { key: 'admin', label: `🛡️ Admins (${stats.admins})` },
                { key: 'hoa', label: `🏢 HOA (${stats.hoas})` },
                { key: 'guard', label: `👮 Guards (${stats.guards})` },
                { key: 'resident', label: `🏠 Residents (${stats.residents})` },
                { key: 'with_device', label: `📡 IoT Linked (${stats.withDevice})` },
              ].map(tab => {
                const isSelected = selectedRoleFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    onPress={() => setSelectedRoleFilter(tab.key as RoleFilter)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* User List */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {filteredProfiles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Users color={COLORS.textMuted} size={42} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.emptyTitle}>No matching users found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery 
                    ? `No users match "${searchQuery}". Try searching with a different term.`
                    : 'No users registered under this category.'}
                </Text>
              </View>
            ) : (
              filteredProfiles.map(renderUserCard)
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalWrapper: {
    width: '100%',
    height: '92%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  headerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  statsStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  statPillVal: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  statPillLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingVertical: 10,
  },
  filterTabsRow: {
    gap: 8,
    paddingRight: SPACING.lg,
  },
  filterChip: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  userCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarLetter: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
  },
  userInfoCol: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userNameText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  userEmailText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginTop: SPACING.md,
  },
  infoStripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoStripText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  phoneLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  phoneLinkText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  hardwareContainer: {
    marginTop: SPACING.md,
    backgroundColor: '#131B2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    padding: SPACING.md,
  },
  hardwareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  hardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hardwareBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  deviceItemBox: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    marginTop: SPACING.xs,
  },
  deviceItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  deviceLabelText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  macPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  macPillText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sensorStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  sensorStatusPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  deviceFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorderSubtle,
  },
  gpsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  inspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inspectBtnText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  noDeviceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  noDeviceText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  expandedContainer: {
    marginTop: SPACING.md,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorderSubtle,
    marginBottom: SPACING.sm,
  },
  expandedTitle: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  expandedGrid: {
    gap: 6,
  },
  expandedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedItemLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  expandedItemVal: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: '60%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
});
