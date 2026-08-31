import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING } from '../../constants/theme';
import { Mail, ArrowLeft, Send } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your registered admin email.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        Alert.alert('Reset Failed', error.message);
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[
      styles.container,
      { 
        paddingTop: Math.max(insets.top, 20) + 8,
        paddingBottom: Math.max(insets.bottom, 20) + 12
      }
    ]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft color={COLORS.textPrimary} size={20} />
        <Text style={styles.backBtnText}>Back to Sign In</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.title}>Password Recovery</Text>
        <Text style={styles.subtitle}>
          Enter your admin email address to receive instructions and a secure link to reset your account password.
        </Text>

        {submitted ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Reset Email Dispatched</Text>
            <Text style={styles.successText}>
              If an account is associated with {email}, you will receive password reset instructions shortly.
            </Text>
            <TouchableOpacity style={styles.returnBtn} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.returnBtnText}>Return to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Admin Email</Text>
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

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Send color={COLORS.white} size={18} style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Send Reset Link</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  backBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
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
  submitBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  successBox: {
    backgroundColor: COLORS.normalBg,
    borderWidth: 1,
    borderColor: COLORS.normalBorder,
    borderRadius: 12,
    padding: SPACING.lg,
  },
  successTitle: {
    color: COLORS.normal,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  successText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  returnBtn: {
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  returnBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
});
