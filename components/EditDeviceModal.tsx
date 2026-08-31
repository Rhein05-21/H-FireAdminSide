import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Platform 
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { DeviceRecord } from '../utils/supabase';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { 
  Tag, 
  MapPin, 
  X, 
  AlertCircle, 
  Save,
  Search,
  User,
  Users,
  Check
} from 'lucide-react-native';

interface EditDeviceModalProps {
  visible: boolean;
  device: DeviceRecord | null;
  onClose: () => void;
}

export const EditDeviceModal: React.FC<EditDeviceModalProps> = ({
  visible,
  device,
  onClose,
}) => {
  const { profiles, updateDeviceConfig } = useAdmin();
  const { role } = useAuth();

  const [label, setLabel] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (device) {
      setLabel(device.label || '');
      setSelectedProfileId(device.profile_id || null);
      setSearchQuery('');
      setErrorMessage('');
    }
  }, [device, visible]);

  if (!device) return null;

  // Filter out Admin profiles (Only real residents should be assignable)
  const residentProfiles = profiles.filter(p => {
    const pRole = p.role?.toLowerCase();
    const isAdminUser = p.is_admin === true || pRole === 'admin';
    return !isAdminUser;
  });

  // Apply search query filtering
  const filteredResidentProfiles = residentProfiles.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.block_lot?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q)
    );
  });

  const selectedProfile = selectedProfileId 
    ? profiles.find(p => p.id === selectedProfileId) 
    : undefined;

  const handleSave = async () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only administrators can modify device labels and household assignments.');
      return;
    }

    if (!label.trim()) {
      setErrorMessage('Please enter a descriptive label for this sensor node.');
      return;
    }

    setErrorMessage('');
    setSaving(true);

    try {
      const result = await updateDeviceConfig(device.mac, label.trim(), selectedProfileId);
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to save configuration');
      } else {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
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
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <View style={styles.macBadge}>
                <Text style={styles.macBadgeText}>{device.mac}</Text>
              </View>
              <Text style={styles.modalTitle}>Configure Sensor Node</Text>
            </View>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X color={COLORS.textMuted} size={20} />
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <AlertCircle color={COLORS.danger} size={16} style={{ marginRight: 6 }} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {!isAdmin && (
            <View style={styles.warningBanner}>
              <AlertCircle color={COLORS.warning} size={16} style={{ marginRight: 6 }} />
              <Text style={styles.warningBannerText}>
                You are viewing this node as {role?.toUpperCase()}. Only Administrators have permission to edit and assign devices.
              </Text>
            </View>
          )}

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Field 1: Device Custom Label */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DEVICE LABEL</Text>
              <View style={styles.inputWrapper}>
                <Tag color={COLORS.textMuted} size={18} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Main Core MQ-2 & Optical Flame"
                  placeholderTextColor={COLORS.textMuted}
                  value={label}
                  onChangeText={setLabel}
                  editable={isAdmin}
                />
              </View>
              <Text style={styles.inputHint}>
                A clear name describing the hardware unit or installation position.
              </Text>
            </View>

            {/* Field 2: Assign Household Profile */}
            <View style={styles.inputGroup}>
              <View style={styles.labelWithCountRow}>
                <Text style={styles.inputLabel}>ASSIGN HOUSEHOLD RESIDENT</Text>
                <Text style={styles.residentCountText}>
                  {residentProfiles.length} Resident{residentProfiles.length === 1 ? '' : 's'}
                </Text>
              </View>

              {/* Resident Search Bar */}
              <View style={styles.searchWrapper}>
                <Search color={COLORS.textMuted} size={16} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search resident by name, email, block/lot..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  editable={isAdmin}
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

              <View style={styles.profilesList}>
                {/* Option: Unassigned */}
                {(!searchQuery || 'unassigned'.includes(searchQuery.toLowerCase())) && (
                  <TouchableOpacity
                    style={[
                      styles.profileOption,
                      selectedProfileId === null && styles.profileOptionSelected
                    ]}
                    onPress={() => isAdmin && setSelectedProfileId(null)}
                    activeOpacity={0.7}
                    disabled={!isAdmin}
                  >
                    <View style={styles.profileRadio}>
                      {selectedProfileId === null && <View style={styles.profileRadioInner} />}
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={[styles.profileName, selectedProfileId === null && styles.profileNameSelected]}>
                        Unassigned Community Sensor
                      </Text>
                      <Text style={styles.profileSub}>No specific resident profile linked</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Filtered Resident Profiles from database (Excluding Admins) */}
                {filteredResidentProfiles.length === 0 && searchQuery ? (
                  <View style={styles.noResultsBox}>
                    <Users color={COLORS.textMuted} size={20} style={{ marginBottom: 4 }} />
                    <Text style={styles.noResultsTitle}>No matching resident found</Text>
                    <Text style={styles.noResultsSub}>Try searching with a different name or block/lot</Text>
                  </View>
                ) : (
                  filteredResidentProfiles.map((p) => {
                    const isSelected = selectedProfileId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.profileOption,
                          isSelected && styles.profileOptionSelected
                        ]}
                        onPress={() => isAdmin && setSelectedProfileId(p.id)}
                        activeOpacity={0.7}
                        disabled={!isAdmin}
                      >
                        <View style={styles.profileRadio}>
                          {isSelected && <View style={styles.profileRadioInner} />}
                        </View>
                        <View style={styles.profileInfo}>
                          <View style={styles.profileNameRow}>
                            <Text style={[styles.profileName, isSelected && styles.profileNameSelected]}>
                              {p.name}
                            </Text>
                            <View style={styles.residentTag}>
                              <Text style={styles.residentTagText}>RESIDENT</Text>
                            </View>
                          </View>
                          <Text style={styles.profileSub}>
                            {p.email || 'Resident Account'} {p.block_lot ? `• ${p.block_lot}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>

            {/* Auto Household Name & Location Sync Info Banner */}
            <View style={styles.locationSyncBox}>
              <View style={styles.locationSyncHeader}>
                <MapPin color={COLORS.accent} size={16} style={{ marginRight: 6 }} />
                <Text style={styles.locationSyncTitle}>AUTOMATIC HOUSEHOLD & LOCATION SYNC</Text>
              </View>
              <Text style={styles.locationSyncText}>
                {selectedProfile ? (
                  <>
                    Household name will automatically update to{' '}
                    <Text style={{ color: COLORS.textPrimary, fontWeight: '800' }}>
                      {selectedProfile.name.toLowerCase().includes('household') ? selectedProfile.name : `${selectedProfile.name} Household`}
                    </Text>
                    {'\n'}Location synced to{' '}
                    <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>
                      {selectedProfile.block_lot || 'Block 1 Lot 1'}
                    </Text>{' '}
                    (Lat: {(selectedProfile.latitude || 14.1777).toFixed(4)}, Lng: {(selectedProfile.longitude || 121.2551).toFixed(4)}) as configured in the resident side.
                  </>
                ) : (
                  'Currently unassigned. Linking a resident profile will automatically change the household name and synchronize the sensor to their address.'
                )}
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <Save color={COLORS.white} size={16} style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  headerTitleCol: {
    flex: 1,
  },
  macBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  macBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorBannerText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  warningBannerText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  formScroll: {
    flexGrow: 0,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  textInput: {
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  labelWithCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  residentCountText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginBottom: SPACING.xs,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingVertical: 6,
  },
  noResultsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 10,
    padding: SPACING.lg,
    marginTop: 4,
  },
  noResultsTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  noResultsSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  profilesList: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  profileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 10,
    padding: SPACING.md,
  },
  profileOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  profileRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  profileRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  profileName: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  profileNameSelected: {
    color: COLORS.white,
  },
  residentTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  residentTagText: {
    color: COLORS.normal,
    fontSize: 9,
    fontWeight: '800',
  },
  roleTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  profileSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  locationSyncBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  locationSyncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationSyncTitle: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationSyncText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: SPACING.xl,
    borderRadius: 10,
    ...SHADOWS.md,
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
