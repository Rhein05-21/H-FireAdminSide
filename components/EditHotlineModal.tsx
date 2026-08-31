import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Alert,
  Dimensions
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { EmergencyHotline } from '../constants/thresholds';
import { 
  PhoneCall, 
  Phone,
  Flame, 
  ShieldAlert, 
  Trash2, 
  X, 
  Building, 
  Activity, 
  AlertCircle,
  Save,
  FileText,
  Sparkles,
  Check
} from 'lucide-react-native';

interface EditHotlineModalProps {
  visible: boolean;
  onClose: () => void;
  hotline: EmergencyHotline | null;
  onSave: (hotline: EmergencyHotline) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const EditHotlineModal: React.FC<EditHotlineModalProps> = ({
  visible,
  onClose,
  hotline,
  onSave,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const isEditing = Boolean(hotline);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>('phone-call');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (hotline) {
      setName(hotline.name || '');
      setNumber(hotline.number || '');
      setDescription(hotline.description || '');
      setIcon(hotline.icon || 'phone-call');
    } else {
      setName('');
      setNumber('');
      setDescription('');
      setIcon('phone-call');
    }
    setErrorMsg('');
  }, [hotline, visible]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedNumber = number.trim();

    if (!trimmedName) {
      setErrorMsg('Please enter a department or facility name.');
      return;
    }
    if (!trimmedNumber) {
      setErrorMsg('Please enter a valid emergency telephone or mobile number.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      await onSave({
        id: hotline?.id || String(Date.now()),
        name: trimmedName,
        number: trimmedNumber,
        description: description.trim() || undefined,
        icon,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save emergency hotline.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!hotline?.id || !onDelete) return;

    Alert.alert(
      'Delete Hotline',
      `Are you sure you want to remove "${hotline.name}" from the community directory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            setLoading(true);
            try {
              await onDelete(hotline.id);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              }
              onClose();
            } catch (err: any) {
              setErrorMsg(err?.message || 'Failed to delete hotline.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const CATEGORIES = [
    { key: 'flame', label: 'Fire Response', color: '#EF4444', icon: Flame },
    { key: 'shield-alert', label: 'Guard / Security', color: '#06B6D4', icon: ShieldAlert },
    { key: 'cross', label: 'Medical / Red Cross', color: '#10B981', icon: Activity },
    { key: 'phone-call', label: 'Direct Hotline', color: '#3B82F6', icon: PhoneCall },
    { key: 'building', label: 'Admin / Municipal', color: '#F59E0B', icon: Building },
  ];

  const selectedCategory = CATEGORIES.find(c => c.key === icon) || CATEGORIES[3];
  const HeaderIconComp = selectedCategory.icon;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 16) }]}>
          {/* Header Row */}
          <View style={styles.modalHeader}>
            <View style={[styles.headerIconRing, { borderColor: `${selectedCategory.color}50` }]}>
              <View style={[styles.headerIconBg, { backgroundColor: `${selectedCategory.color}20` }]}>
                <HeaderIconComp color={selectedCategory.color} size={22} />
              </View>
            </View>

            <View style={styles.headerTitlesCol}>
              <View style={styles.tagBadgeRow}>
                <View style={[styles.tagBadge, { backgroundColor: `${selectedCategory.color}20`, borderColor: selectedCategory.color }]}>
                  <Text style={[styles.tagBadgeText, { color: selectedCategory.color }]}>
                    {isEditing ? 'MODIFY HOTLINE' : 'NEW HOTLINE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.modalTitleText}>
                {isEditing ? 'Edit Emergency Hotline' : 'Add Emergency Hotline'}
              </Text>
              <Text style={styles.modalSubtitleText}>
                Configure speed-dial routing and operational description
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.closeCircleBtn}
              onPress={onClose}
              disabled={loading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <X color={COLORS.textMuted} size={18} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {errorMsg ? (
              <View style={styles.errorAlert}>
                <AlertCircle color={COLORS.danger} size={16} style={{ marginRight: 8 }} />
                <Text style={styles.errorAlertText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Input 1: Name */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>FACILITY / DEPARTMENT NAME <Text style={styles.requiredStar}>*</Text></Text>
              <View style={styles.inputWrapper}>
                <Building color={COLORS.textMuted} size={16} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.inputControl}
                  placeholder="e.g. Bureau of Fire Protection (BFP)"
                  placeholderTextColor={COLORS.textMuted}
                  value={name}
                  onChangeText={t => { setName(t); setErrorMsg(''); }}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Input 2: Number */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>EMERGENCY PHONE / HOTLINE NUMBER <Text style={styles.requiredStar}>*</Text></Text>
              <View style={styles.inputWrapper}>
                <Phone color={COLORS.textMuted} size={16} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.inputControl}
                  placeholder="e.g. 911 or (02) 8888-4321 or 0917-000-0000"
                  placeholderTextColor={COLORS.textMuted}
                  value={number}
                  onChangeText={t => { setNumber(t); setErrorMsg(''); }}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Input 3: Scope / Description */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>OPERATIONAL SCOPE / SUBTITLE (OPTIONAL)</Text>
              <View style={styles.inputWrapper}>
                <FileText color={COLORS.textMuted} size={16} style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.inputControl}
                  placeholder="e.g. 24/7 Fire & Rescue Dispatch / Sector 4"
                  placeholderTextColor={COLORS.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  autoCapitalize="sentences"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Category Icon Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>DEPARTMENT CATEGORY & ICON</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => {
                  const isSelected = icon === cat.key;
                  const IconComp = cat.icon;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoryCard,
                        isSelected && {
                          borderColor: cat.color,
                          backgroundColor: `${cat.color}18`,
                        }
                      ]}
                      onPress={() => {
                        setIcon(cat.key);
                        if (Platform.OS !== 'web') {
                          Haptics.selectionAsync().catch(() => {});
                        }
                      }}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <View style={[
                        styles.categoryIconCircle, 
                        { backgroundColor: isSelected ? cat.color : COLORS.inputBackground }
                      ]}>
                        <IconComp 
                          color={isSelected ? COLORS.white : COLORS.textMuted} 
                          size={15} 
                        />
                      </View>
                      <Text 
                        style={[
                          styles.categoryCardText,
                          isSelected && { color: COLORS.textPrimary, fontWeight: '800' }
                        ]}
                        numberOfLines={1}
                      >
                        {cat.label}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: cat.color }]}>
                          <Check color={COLORS.white} size={10} strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Live Directory Preview Card */}
            <View style={styles.previewBox}>
              <View style={styles.previewHeader}>
                <Sparkles color={COLORS.accent} size={12} style={{ marginRight: 4 }} />
                <Text style={styles.previewHeaderText}>LIVE DIRECTORY PREVIEW</Text>
              </View>
              <View style={styles.previewCard}>
                <View style={[styles.previewIconWrap, { backgroundColor: `${selectedCategory.color}20` }]}>
                  <HeaderIconComp color={selectedCategory.color} size={18} />
                </View>
                <View style={styles.previewTextCol}>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {name.trim() || 'Facility Name'}
                  </Text>
                  <Text style={styles.previewSub} numberOfLines={1}>
                    {number.trim() || 'Phone Number'}
                    {description.trim() ? ` • ${description.trim()}` : ''}
                  </Text>
                </View>
                <View style={styles.previewCallBtn}>
                  <PhoneCall color={COLORS.danger} size={12} style={{ marginRight: 4 }} />
                  <Text style={styles.previewCallText}>Call</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.modalFooter}>
            {isEditing && onDelete && (
              <TouchableOpacity 
                style={styles.deleteIconButton}
                onPress={handleDelete}
                disabled={loading}
                activeOpacity={0.75}
              >
                <Trash2 color={COLORS.danger} size={18} />
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.cancelOutlineBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelOutlineText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.saveSolidBtn}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Save color={COLORS.white} size={16} style={{ marginRight: 6 }} />
                  <Text style={styles.saveSolidText}>
                    {isEditing ? 'Save Changes' : 'Create Hotline'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
  },
  headerIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitlesCol: {
    flex: 1,
  },
  tagBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalTitleText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  modalSubtitleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  closeCircleBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: SPACING.sm,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorAlertText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  requiredStar: {
    color: COLORS.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
  },
  inputLeadingIcon: {
    marginRight: SPACING.sm,
  },
  inputControl: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    paddingVertical: 11,
  },
  categoryGrid: {
    gap: 6,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    position: 'relative',
  },
  categoryIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  categoryCardText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBox: {
    marginTop: SPACING.sm,
    backgroundColor: '#101726',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    padding: SPACING.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  previewHeaderText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  previewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  previewTextCol: {
    flex: 1,
  },
  previewTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  previewSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  previewCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginLeft: SPACING.xs,
  },
  previewCallText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
  },
  deleteIconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelOutlineBtn: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelOutlineText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  saveSolidBtn: {
    flex: 1.5,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...SHADOWS.md,
  },
  saveSolidText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
});

