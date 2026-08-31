import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  Linking, 
  Modal, 
  ActivityIndicator, 
  Platform,
  TextInput,
  KeyboardAvoidingView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth, UserRole } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { isDevEnvironment } from '../../utils/env';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { EmergencyHotline, DEFAULT_EMERGENCY_HOTLINES } from '../../constants/thresholds';
import { UserDirectoryModal } from '../../components/UserDirectoryModal';
import { EditHotlineModal } from '../../components/EditHotlineModal';
import { 
  User, 
  ShieldCheck, 
  Bell, 
  Sliders, 
  LogOut, 
  PhoneCall, 
  Radio, 
  Database,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  X,
  UserPlus,
  Users,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Edit3,
  Plus,
  Flame,
  ShieldAlert,
  Activity,
  Building,
  RotateCcw
} from 'lucide-react-native';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { profile, role, signOut, isConfigured, setDemoRole, registerPushToken, registerOfficer } = useAuth();
  const { 
    bridgeHeartbeat, 
    setSimulatorVisible, 
    hotlines, 
    saveHotline, 
    deleteHotline, 
    resetHotlinesToDefault,
    profiles 
  } = useAdmin();
  const [pushStatus, setPushStatus] = useState<string>('Ready');
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Admin Officer Registration Modal State
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regRole, setRegRole] = useState<UserRole>('admin');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  // Admin User Directory Modal State
  const [userDirectoryVisible, setUserDirectoryVisible] = useState(false);

  // Hotline Edit / Add Modal State
  const [hotlineModalVisible, setHotlineModalVisible] = useState(false);
  const [selectedHotline, setSelectedHotline] = useState<EmergencyHotline | null>(null);

  const handleOpenLogout = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setLogoutModalVisible(true);
  };

  const handleConfirmSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      setLogoutModalVisible(false);
      router.replace('/(auth)/login');
    } catch {
      setIsLoggingOut(false);
    }
  };

  const handleOpenRegisterModal = () => {
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegShowPassword(false);
    setRegRole('admin');
    setRegError('');
    setRegSuccessMsg('');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setRegisterModalVisible(true);
  };

  const handleRegisterOfficer = async () => {
    const trimmedName = regName.trim();
    const trimmedEmail = regEmail.trim();
    if (!trimmedName) {
      setRegError('Please enter the officer’s full name.');
      return;
    }
    if (!trimmedEmail || !regPassword) {
      setRegError('Please enter both an email address and password.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }

    setRegError('');
    setIsRegistering(true);

    try {
      const { error } = await registerOfficer(trimmedEmail, regPassword, trimmedName, regRole);
      if (error) {
        setRegError(error.message || 'Failed to register officer account.');
      } else {
        const roleLabel = regRole === 'admin' ? 'Chief Administrator' : regRole === 'hoa' ? 'HOA Officer' : 'Security Guard';
        setRegSuccessMsg(`Account for "${trimmedName}" (${roleLabel}) has been created successfully.`);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setTimeout(() => {
          setRegisterModalVisible(false);
          setRegSuccessMsg('');
          setRegName('');
          setRegEmail('');
          setRegPassword('');
        }, 1600);
      }
    } catch (err: any) {
      setRegError(err?.message || 'An unexpected error occurred during registration.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleTestPush = async () => {
    setPushStatus('Registering...');
    const token = await registerPushToken();
    if (token) {
      setPushStatus('Token Registered');
      Alert.alert('Push Notifications Ready', `Device registered with token:\n${token.slice(0, 25)}...`);
    } else {
      setPushStatus('Ready (Expo Go Simulated)');
      Alert.alert('Notification Test', 'Push alert permissions verified. Community sirens will trigger within the app.');
    }
  };

  const formatHeartbeat = (iso: string | null) => {
    if (!iso) return 'Not connected';
    try {
      const diffSecs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSecs < 60) return `Active (${diffSecs}s ago)`;
      return `${Math.floor(diffSecs / 60)}m ago`;
    } catch {
      return 'Active';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <User color={COLORS.white} size={28} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.name || 'Administrator'}</Text>
            <Text style={styles.profileEmail}>{profile?.email || 'admin@hfire.community'}</Text>
            <View style={styles.roleTag}>
              <ShieldCheck color={COLORS.primary} size={12} style={{ marginRight: 4 }} />
              <Text style={styles.roleTagText}>{role.toUpperCase()} ACCESS</Text>
            </View>
          </View>
        </View>

        {/* 1. Quick Role Switcher (ONLY in Expo Go Dev - NEVER in built APKs whether preview or production) */}
        {isDevEnvironment() && (
          <>
            <Text style={styles.sectionHeader}>SWITCH ACTIVE MONITORING ROLE (EXPO GO DEV ONLY)</Text>
            <View style={styles.roleSelectorRow}>
              {(['admin', 'hoa', 'guard'] as UserRole[]).map((r) => {
                const isSelected = role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleSelectBtn, isSelected && styles.roleSelectBtnActive]}
                    onPress={() => setDemoRole(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.roleSelectBtnText, isSelected && styles.roleSelectBtnTextActive]}>
                      {r === 'admin' ? '🛡️ Admin' : r === 'hoa' ? '🏢 HOA' : '👮 Guard'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* 2. Admin-Only Officer & Access Management (CAN ONLY BE SEEN BY ADMIN - NEITHER HOA NOR GUARD) */}
        {role === 'admin' && (
          <>
            <Text style={styles.sectionHeader}>COMMAND & USER DIRECTORY (ADMIN ONLY)</Text>
            <View style={styles.cardGroup}>
              <TouchableOpacity 
                style={styles.settingsRow} 
                onPress={() => setUserDirectoryVisible(true)}
                activeOpacity={0.75}
              >
                <View style={styles.settingIconCol}>
                  <Users color={COLORS.primary} size={20} />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>All Users & Device Registry</Text>
                  <Text style={styles.settingSub}>
                    Inspect roles, contact details, and connected IoT hardware nodes
                  </Text>
                </View>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{profiles.length} Users</Text>
                </View>
                <ChevronRight color={COLORS.textMuted} size={18} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity 
                style={styles.settingsRow} 
                onPress={handleOpenRegisterModal}
                activeOpacity={0.75}
              >
                <View style={styles.settingIconCol}>
                  <UserPlus color={COLORS.accent} size={20} />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Register New Officer / Admin</Text>
                  <Text style={styles.settingSub}>Create authorized Admin, HOA, or Guard accounts</Text>
                </View>
                <ChevronRight color={COLORS.textMuted} size={18} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* 2. System Status & Services */}
        <Text style={styles.sectionHeader}>BACKEND SERVICES & REALTIME</Text>
        <View style={styles.cardGroup}>
          <View style={styles.settingsRow}>
            <View style={styles.settingIconCol}>
              <Database color={COLORS.primary} size={20} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Supabase Database & Auth</Text>
              <Text style={styles.settingSub}>
                {isConfigured ? 'Connected to Cloud Instance' : 'Local Demo & Mock Storage Mode'}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: isConfigured ? COLORS.normalBg : COLORS.warningBg }]}>
              <Text style={[styles.statusPillText, { color: isConfigured ? COLORS.normal : COLORS.warning }]}>
                {isConfigured ? 'LIVE' : 'DEMO'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingsRow}>
            <View style={styles.settingIconCol}>
              <Radio color={COLORS.accent} size={20} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>HiveMQ MQTT Bridge</Text>
              <Text style={styles.settingSub}>
                Heartbeat: {formatHeartbeat(bridgeHeartbeat)}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: COLORS.normalBg }]}>
              <Text style={[styles.statusPillText, { color: COLORS.normal }]}>ONLINE</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingsRow} onPress={handleTestPush}>
            <View style={styles.settingIconCol}>
              <Bell color={COLORS.warning} size={20} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Push Notification Broadcast</Text>
              <Text style={styles.settingSub}>Tap to register / test notification token</Text>
            </View>
            <Text style={styles.actionLinkText}>{pushStatus}</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Testing Tools (Dev Mode Only - Expo Go Only) */}
        {isDevEnvironment() && (
          <>
            <Text style={styles.sectionHeader}>DEVELOPER & TESTING TOOLS (EXPO GO DEV ONLY)</Text>
            <View style={styles.cardGroup}>
              <TouchableOpacity 
                style={styles.settingsRow} 
                onPress={() => setSimulatorVisible(true)}
                activeOpacity={0.75}
              >
                <View style={styles.settingIconCol}>
                  <Sliders color={COLORS.primary} size={20} />
                </View>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>IoT Telemetry Simulator</Text>
                  <Text style={styles.settingSub}>Trigger live gas spikes, optical flame, and sirens</Text>
                </View>
                <ChevronRight color={COLORS.textMuted} size={18} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* 4. Emergency Directory (Editable for Admins) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>EMERGENCY DIRECTORY</Text>
          {role === 'admin' && (
            <View style={styles.headerActionsRow}>
              <TouchableOpacity 
                style={styles.headerActionBtn}
                onPress={() => {
                  setSelectedHotline(null);
                  setHotlineModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Plus color={COLORS.primary} size={14} style={{ marginRight: 3 }} />
                <Text style={styles.headerActionText}>Add Hotline</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.headerActionBtn, { marginLeft: 6 }]}
                onPress={() => {
                  Alert.alert(
                    'Reset Directory',
                    'Reset all emergency hotlines back to default system values?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Reset', style: 'destructive', onPress: resetHotlinesToDefault }
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <RotateCcw color={COLORS.textMuted} size={12} style={{ marginRight: 3 }} />
                <Text style={[styles.headerActionText, { color: COLORS.textMuted }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.cardGroup}>
          {hotlines.map((hotline, idx) => {
            const IconComp = hotline.icon === 'flame' ? Flame :
                             hotline.icon === 'shield-alert' ? ShieldAlert :
                             hotline.icon === 'cross' ? Activity :
                             hotline.icon === 'building' ? Building :
                             PhoneCall;

            return (
              <React.Fragment key={hotline.id || hotline.name}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.hotlineRow}>
                  <View style={styles.settingIconCol}>
                    <IconComp color={COLORS.danger} size={18} />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>{hotline.name}</Text>
                    <Text style={styles.settingSub}>
                      {hotline.description ? `${hotline.number} • ${hotline.description}` : hotline.number}
                    </Text>
                  </View>

                  <View style={styles.hotlineActionRow}>
                    <TouchableOpacity 
                      style={styles.callLinkBtn}
                      onPress={() => Linking.openURL(`tel:${hotline.number.replace(/[^0-9+]/g, '')}`).catch(() => {})}
                      activeOpacity={0.7}
                    >
                      <PhoneCall color={COLORS.danger} size={13} style={{ marginRight: 4 }} />
                      <Text style={[styles.actionLinkText, { color: COLORS.danger }]}>Call</Text>
                    </TouchableOpacity>

                    {role === 'admin' && (
                      <TouchableOpacity 
                        style={styles.editHotlineIconBtn}
                        onPress={() => {
                          setSelectedHotline(hotline);
                          setHotlineModalVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Edit3 color={COLORS.primary} size={15} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.signOutBtn}
          onPress={handleOpenLogout}
          activeOpacity={0.8}
        >
          <LogOut color={COLORS.danger} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.signOutBtnText}>Log Out from Monitoring Center</Text>
        </TouchableOpacity>

        <Text style={styles.versionFooter}>
          H-Fire Admin v1.0.0 • Expo SDK 54 • Supabase Auth & Realtime
        </Text>
      </ScrollView>

      {/* Admin User & IoT Device Directory Modal */}
      {role === 'admin' && (
        <UserDirectoryModal 
          visible={userDirectoryVisible}
          onClose={() => setUserDirectoryVisible(false)}
        />
      )}

      {/* Admin Editable Emergency Hotline Modal */}
      <EditHotlineModal
        visible={hotlineModalVisible}
        onClose={() => {
          setHotlineModalVisible(false);
          setSelectedHotline(null);
        }}
        hotline={selectedHotline}
        onSave={saveHotline}
        onDelete={deleteHotline}
      />

      {/* Admin-Only Officer Registration Modal (Accessible strictly by Chief Admin) */}
      {role === 'admin' && (
        <Modal
          visible={registerModalVisible}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={() => {
            if (!isRegistering) setRegisterModalVisible(false);
          }}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.regModalContainer}>
              {/* Top Close Button */}
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => setRegisterModalVisible(false)}
                disabled={isRegistering}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <X color={COLORS.textMuted} size={18} />
              </TouchableOpacity>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: SPACING.xs }}
              >
                {/* Icon Header */}
                <View style={styles.regModalIconRing}>
                  <View style={styles.regModalIconBg}>
                    <UserPlus color={COLORS.primary} size={24} />
                  </View>
                </View>

                {/* Title & Message */}
                <Text style={styles.modalTitle}>Register Authorized Officer</Text>
                <Text style={styles.modalMessage}>
                  Provision an official command account with role-based access to the H-Fire monitoring center.
                </Text>

                {regError ? (
                  <View style={styles.regErrorBox}>
                    <AlertCircle color={COLORS.danger} size={16} style={{ marginRight: 8 }} />
                    <Text style={styles.regErrorText}>{regError}</Text>
                  </View>
                ) : null}

                {regSuccessMsg ? (
                  <View style={styles.regSuccessBox}>
                    <CheckCircle2 color={COLORS.normal} size={16} style={{ marginRight: 8 }} />
                    <Text style={styles.regSuccessText}>{regSuccessMsg}</Text>
                  </View>
                ) : null}

                {/* Full Name Input */}
                <View style={styles.regInputGroup}>
                  <Text style={styles.regInputLabel}>Officer Full Name</Text>
                  <View style={styles.regInputWrapper}>
                    <User color={COLORS.textMuted} size={18} style={styles.regInputIcon} />
                    <TextInput
                      style={styles.regTextInput}
                      placeholder="e.g. Captain Juan Dela Cruz"
                      placeholderTextColor={COLORS.textMuted}
                      value={regName}
                      onChangeText={name => { setRegName(name); setRegError(''); }}
                      autoCapitalize="words"
                      editable={!isRegistering}
                    />
                  </View>
                </View>

                {/* Email Address Input */}
                <View style={styles.regInputGroup}>
                  <Text style={styles.regInputLabel}>Official Email Address</Text>
                  <View style={styles.regInputWrapper}>
                    <Mail color={COLORS.textMuted} size={18} style={styles.regInputIcon} />
                    <TextInput
                      style={styles.regTextInput}
                      placeholder="officer@community.gov"
                      placeholderTextColor={COLORS.textMuted}
                      value={regEmail}
                      onChangeText={email => { setRegEmail(email); setRegError(''); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!isRegistering}
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.regInputGroup}>
                  <Text style={styles.regInputLabel}>Temporary Account Password</Text>
                  <View style={styles.regInputWrapper}>
                    <Lock color={COLORS.textMuted} size={18} style={styles.regInputIcon} />
                    <TextInput
                      style={styles.regTextInput}
                      placeholder="Min. 6 characters"
                      placeholderTextColor={COLORS.textMuted}
                      value={regPassword}
                      onChangeText={pwd => { setRegPassword(pwd); setRegError(''); }}
                      secureTextEntry={!regShowPassword}
                      autoCapitalize="none"
                      editable={!isRegistering}
                    />
                    <TouchableOpacity 
                      onPress={() => setRegShowPassword(prev => !prev)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                      style={{ padding: 4 }}
                    >
                      {regShowPassword ? (
                        <EyeOff color={COLORS.textMuted} size={18} />
                      ) : (
                        <Eye color={COLORS.textMuted} size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Role Picker */}
                <View style={styles.regInputGroup}>
                  <Text style={styles.regInputLabel}>Assigned Operational Role</Text>
                  <View style={styles.regRolePickerRow}>
                    {(['admin', 'hoa', 'guard'] as UserRole[]).map((r) => {
                      const isSelected = regRole === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[styles.regRoleChip, isSelected && styles.regRoleChipSelected]}
                          onPress={() => setRegRole(r)}
                          disabled={isRegistering}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.regRoleChipText, isSelected && styles.regRoleChipTextSelected]}>
                            {r === 'admin' ? '🛡️ Admin' : r === 'hoa' ? '🏢 HOA' : '👮 Guard'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Role Description Card */}
                <View style={styles.regRoleDescCard}>
                  <Text style={styles.regRoleDescTitle}>
                    {regRole === 'admin' ? '🛡️ Administrator Access' : regRole === 'hoa' ? '🏢 HOA Officer Access' : '👮 Security Guard Access'}
                  </Text>
                  <Text style={styles.regRoleDescBody}>
                    {regRole === 'admin' 
                      ? 'Full operational authority: siren dispatch, device configuration, threshold parameters, and officer provisioning.'
                      : regRole === 'hoa'
                      ? 'Executive monitoring access: live tactical safety map, fleet status, and incident resolution tracking.'
                      : 'Gate & patrol access: live multi-node gas and optical flame alarm alerts with instant siren dispatch.'}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity 
                    style={styles.modalCancelBtn}
                    onPress={() => setRegisterModalVisible(false)}
                    disabled={isRegistering}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalConfirmBtn, { backgroundColor: COLORS.primary }]}
                    onPress={handleRegisterOfficer}
                    disabled={isRegistering}
                    activeOpacity={0.8}
                  >
                    {isRegistering ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <>
                        <UserPlus color={COLORS.white} size={16} style={{ marginRight: 6 }} />
                        <Text style={styles.modalConfirmBtnText}>Create Account</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Themed Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          if (!isLoggingOut) setLogoutModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Top Close Button */}
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setLogoutModalVisible(false)}
              disabled={isLoggingOut}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <X color={COLORS.textMuted} size={18} />
            </TouchableOpacity>

            {/* Icon Header */}
            <View style={styles.modalIconRing}>
              <View style={styles.modalIconBg}>
                <LogOut color={COLORS.danger} size={24} />
              </View>
            </View>

            {/* Title & Message */}
            <Text style={styles.modalTitle}>Sign Out Confirmation</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to log out from H-Fire Admin Monitoring? You will need to sign in again to access emergency operations.
            </Text>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setLogoutModalVisible(false)}
                disabled={isLoggingOut}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalConfirmBtn}
                onPress={handleConfirmSignOut}
                disabled={isLoggingOut}
                activeOpacity={0.8}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <LogOut color={COLORS.white} size={16} style={{ marginRight: 6 }} />
                    <Text style={styles.modalConfirmBtnText}>Log Out</Text>
                  </>
                )}
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
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  profileEmail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  roleTagText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerActionText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  badgePill: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  badgePillText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  hotlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  hotlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  editHotlineIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  roleSelectorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  roleSelectBtn: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  roleSelectBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  roleSelectBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  roleSelectBtnTextActive: {
    color: COLORS.white,
  },
  cardGroup: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  settingIconCol: {
    width: 36,
    alignItems: 'center',
  },
  settingTextCol: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  settingTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  settingSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actionLinkText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorderSubtle,
    marginLeft: 52,
  },
  signOutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  signOutBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  versionFooter: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    padding: SPACING.xxl,
    alignItems: 'center',
    position: 'relative',
    ...SHADOWS.lg,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: 0.3,
  },
  modalMessage: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  modalConfirmBtn: {
    flex: 1.2,
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...SHADOWS.md,
  },
  modalConfirmBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
  regModalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    padding: SPACING.xl,
    paddingTop: SPACING.xxl,
    position: 'relative',
    ...SHADOWS.lg,
  },
  regModalIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  regModalIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  regErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  regErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  regSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.normalBg,
    borderWidth: 1,
    borderColor: COLORS.normalBorder,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  regSuccessText: {
    flex: 1,
    color: COLORS.normal,
    fontSize: 12,
    fontWeight: '700',
  },
  regInputGroup: {
    marginBottom: SPACING.md,
  },
  regInputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  regInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
  },
  regInputIcon: {
    marginRight: SPACING.sm,
  },
  regTextInput: {
    flex: 1,
    color: COLORS.textPrimary,
    paddingVertical: 11,
    fontSize: 13,
  },
  regRolePickerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  regRoleChip: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  regRoleChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  regRoleChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  regRoleChipTextSelected: {
    color: COLORS.white,
  },
  regRoleDescCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    marginBottom: SPACING.lg,
  },
  regRoleDescTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  regRoleDescBody: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
