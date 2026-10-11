import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Image,
  Modal,
  Keyboard 
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth, UserRole } from '../../context/AuthContext';
import { isDevEnvironment } from '../../utils/env';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { Flame, Shield, Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, loginAsDemo } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Themed Auth Error Modal State
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const triggerErrorModal = (title: string, message: string) => {
    Keyboard.dismiss();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      const msg = 'Please enter both your email address and password to continue.';
      setErrorMsg(msg);
      triggerErrorModal('Missing Credentials', msg);
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const { error } = await signIn(trimmedEmail, password);
      if (error) {
        setErrorMsg(error.message);
        const raw = (error.message || '').toLowerCase();
        if (raw.includes('access denied') || raw.includes('resident')) {
          triggerErrorModal(
            'Access Denied (Resident Account)',
            'This account is registered as a Subdivision Resident. Resident accounts cannot access the H-Fire Admin Command Center.\n\nPlease open the H-Fire Resident Mobile App to access your household monitoring.'
          );
        } else if (raw.includes('invalid login credentials') || raw.includes('invalid') || raw.includes('wrong') || raw.includes('credentials')) {
          triggerErrorModal(
            'Incorrect Password or Email',
            'The password or email address you entered is incorrect. Please check your credentials and try again.'
          );
        } else if (raw.includes('email not confirmed')) {
          triggerErrorModal(
            'Email Not Verified',
            'Your email address has not been confirmed. Please check your inbox for confirmation instructions.'
          );
        } else if (raw.includes('network') || raw.includes('fetch') || raw.includes('timeout') || raw.includes('connection')) {
          triggerErrorModal(
            'No Internet Connection',
            'Unable to reach Supabase authentication servers. Please verify that Wi-Fi or Cellular data is enabled and try again.'
          );
        } else {
          triggerErrorModal(
            'Authentication Failed',
            error.message || 'Unable to sign in. Please verify your connection and credentials.'
          );
        }
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected authentication error occurred.';
      setErrorMsg(msg);
      triggerErrorModal('Sign In Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (roleToUse: UserRole) => {
    setLoading(true);
    await loginAsDemo(roleToUse);
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent,
            { 
              paddingTop: Math.max(insets.top, 24) + 12,
              paddingBottom: Math.max(insets.bottom, 24) + 24
            }
          ]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <Image 
            source={require('../../assets/h-fire_logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
          <Text style={styles.appTitle}>H-FIRE ADMIN</Text>
          <Text style={styles.appSubtitle}>Centralized IoT Fire & Gas Command Center</Text>
        </View>

        {/* Main Card */}
        <View style={styles.authCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Officer Sign In</Text>
            <Text style={styles.cardSub}>Enter your credentials to access operations</Text>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Official Email Address</Text>
            <View style={styles.inputWrapper}>
              <Mail color={COLORS.textMuted} size={18} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="admin@community.gov"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Password</Text>
            <View style={styles.inputWrapper}>
              <Lock color={COLORS.textMuted} size={18} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                style={styles.eyeIconBtn}
              >
                {showPassword ? (
                  <EyeOff color={COLORS.textMuted} size={18} />
                ) : (
                  <Eye color={COLORS.textMuted} size={18} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.forgotBtn}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotBtnText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Access Monitoring Center</Text>
                <ArrowRight color={COLORS.white} size={18} style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 1-Tap Quick Testing / Demo Access (Expo Go Dev Mode Only - Never in APK builds) */}
        {isDevEnvironment() && (
          <View style={styles.demoSection}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR 1-TAP DEMO TESTING (EXPO GO DEV ONLY)</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.demoGrid}>
              <TouchableOpacity 
                style={styles.demoBtn} 
                onPress={() => handleQuickDemo('admin')}
                activeOpacity={0.75}
              >
                <ShieldCheck color={COLORS.primary} size={20} />
                <Text style={styles.demoBtnText}>Chief Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.demoBtn} 
                onPress={() => handleQuickDemo('hoa')}
                activeOpacity={0.75}
              >
                <Shield color={COLORS.accent} size={20} />
                <Text style={styles.demoBtnText}>HOA Officer</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.demoBtn} 
                onPress={() => handleQuickDemo('guard')}
                activeOpacity={0.75}
              >
                <Flame color={COLORS.warning} size={20} />
                <Text style={styles.demoBtnText}>Security Guard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Themed Auth Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Top Close Button */}
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setErrorModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <X color={COLORS.textMuted} size={18} />
            </TouchableOpacity>

            {/* Icon Header */}
            <View style={styles.modalIconRing}>
              <View style={styles.modalIconBg}>
                <Lock color={COLORS.danger} size={26} />
              </View>
            </View>

            {/* Title & Message */}
            <Text style={styles.modalTitle}>{errorModalTitle}</Text>
            <Text style={styles.modalMessage}>{errorModalMessage}</Text>

            {/* Action Buttons */}
            <TouchableOpacity 
              style={styles.modalPrimaryBtn}
              onPress={() => setErrorModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPrimaryBtnText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalSecondaryBtn}
              onPress={() => {
                setErrorModalVisible(false);
                router.push('/(auth)/forgot-password');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalSecondaryBtnText}>Forgot your password?</Text>
            </TouchableOpacity>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoImage: {
    width: 86,
    height: 86,
    marginBottom: SPACING.md,
  },
  appTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  appSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.md,
  },
  cardHeader: {
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  cardSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
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
  eyeIconBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: SPACING.xs,
  },
  submitBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  demoSection: {
    marginTop: SPACING.xxl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.cardBorderSubtle,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginHorizontal: SPACING.sm,
    letterSpacing: 0.5,
  },
  demoGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  demoBtn: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  demoBtnText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: COLORS.danger,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  modalPrimaryBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
  modalSecondaryBtn: {
    paddingVertical: SPACING.xs,
  },
  modalSecondaryBtnText: {
    color: COLORS.accent,
    fontWeight: '600',
    fontSize: 13,
  },
});
