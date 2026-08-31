import React, { useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Linking, 
  ScrollView, 
  Platform,
  Image 
} from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { useAdmin } from '../context/AdminContext';
import { IncidentRecord, DeviceRecord } from '../utils/supabase';
import { 
  Flame, 
  VolumeX, 
  Volume2, 
  PhoneCall, 
  ShieldAlert, 
  CheckCircle2, 
  Radio, 
  AlertOctagon,
  Navigation,
  X 
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EMERGENCY_HOTLINES } from '../constants/thresholds';

export const EmergencyModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { 
    activeEmergency, 
    isSirenPlaying, 
    silenceSiren, 
    resolveIncident, 
    dispatchEmergencyResponse, 
    devices,
    hotlines 
  } = useAdmin();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (activeEmergency) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      );

      pulseLoop.start();
      glowLoop.start();

      return () => {
        pulseLoop.stop();
        glowLoop.stop();
      };
    }
  }, [activeEmergency]);

  if (!activeEmergency) return null;

  const isIncidentRecord = 'ppm_at_trigger' in activeEmergency;
  const incident = isIncidentRecord ? (activeEmergency as IncidentRecord) : null;
  const device = !isIncidentRecord 
    ? (activeEmergency as DeviceRecord) 
    : devices.find(d => d.mac === incident?.device_mac);

  const houseName = incident?.house_name || device?.house_name || 'Community Resident';
  const ppmValue = incident?.ppm_at_trigger ?? device?.current_ppm ?? 1500;
  const alertType = incident?.alert_type || (device?.flame ? 'FIRE' : 'CRITICAL GAS SPIKE');
  const locationDesc = device?.block_lot ? `${device.block_lot} (${device.label})` : (device?.label || 'Residential Sensor');

  const handleCall = (number: string) => {
    const cleanNumber = number.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {
      console.log(`Calling ${number}`);
    });
  };

  const handleResolve = async () => {
    await silenceSiren();
    if (incident?.id) {
      await resolveIncident(incident.id, 'Resolved via Emergency Modal action');
    }
  };

  const handleDispatch = () => {
    if (incident?.id) {
      dispatchEmergencyResponse(incident.id);
    }
  };

  return (
    <Modal
      visible={Boolean(activeEmergency)}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <Animated.View 
          style={[
            styles.glowContainer, 
            { opacity: glowAnim }
          ]} 
        />

        <View style={styles.modalContent}>
          <ScrollView 
            contentContainerStyle={[styles.scrollInner, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Badge */}
            <View style={styles.header}>
              <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
                <Image 
                  source={require('../assets/h-fire_logo.png')} 
                  style={{ width: 50, height: 50 }} 
                  resizeMode="contain" 
                />
              </Animated.View>
              <View style={styles.headerTextCol}>
                <Text style={styles.emergencyTag}>COMMUNITY SIREN ACTIVE</Text>
                <Text style={styles.emergencyTitle}>🚨 {alertType} ALARM</Text>
              </View>
            </View>

            {/* Incident Details Card */}
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Target Location</Text>
                <Text style={styles.detailValuePrimary}>{houseName}</Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sensor & Zone</Text>
                <Text style={styles.detailValue}>{locationDesc}</Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sensor Reading</Text>
                <View style={styles.ppmBadge}>
                  <Text style={styles.ppmBadgeText}>{ppmValue} PPM</Text>
                </View>
              </View>

              {device?.flame && (
                <>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Optical Flame Sensor</Text>
                    <Text style={styles.flameStatusText}>FLAME DETECTED</Text>
                  </View>
                </>
              )}
            </View>

            {/* Quick Emergency Action Buttons */}
            <View style={styles.actionsSection}>
              <Text style={styles.sectionHeading}>IMMEDIATE DISPATCH & HOTLINES</Text>

              <TouchableOpacity 
                style={[styles.actionBtn, styles.dispatchBtn]}
                onPress={handleDispatch}
                activeOpacity={0.8}
              >
                <Radio color={COLORS.white} size={20} style={{ marginRight: 8 }} />
                <Text style={styles.dispatchBtnText}>Broadcast Security Dispatch</Text>
              </TouchableOpacity>

              <View style={styles.hotlinesGrid}>
                {hotlines.slice(0, 4).map((h, index) => {
                  const isPrimary = index === 0;
                  return (
                    <TouchableOpacity 
                      key={h.id || h.name}
                      style={[
                        styles.hotlineBtn, 
                        isPrimary 
                          ? { backgroundColor: '#DC2626' } 
                          : { backgroundColor: '#1E293B', borderColor: '#475569', borderWidth: 1 }
                      ]}
                      onPress={() => handleCall(h.number)}
                      activeOpacity={0.8}
                    >
                      <PhoneCall 
                        color={isPrimary ? COLORS.white : COLORS.accent} 
                        size={16} 
                        style={{ marginRight: 6 }} 
                      />
                      <Text 
                        style={[
                          styles.hotlineBtnText, 
                          !isPrimary && { color: COLORS.accent }
                        ]}
                        numberOfLines={1}
                      >
                        {h.name.length > 20 ? `${h.name.slice(0, 18)}...` : h.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Silence and Resolve Footer */}
            <View style={styles.footerRow}>
              <TouchableOpacity 
                style={[
                  styles.silenceBtn, 
                  !isSirenPlaying && styles.silencedState
                ]}
                onPress={silenceSiren}
                activeOpacity={0.8}
              >
                {isSirenPlaying ? (
                  <>
                    <VolumeX color={COLORS.warning} size={18} style={{ marginRight: 6 }} />
                    <Text style={styles.silenceBtnText}>Mute Siren</Text>
                  </>
                ) : (
                  <>
                    <Volume2 color={COLORS.textSecondary} size={18} style={{ marginRight: 6 }} />
                    <Text style={[styles.silenceBtnText, { color: COLORS.textSecondary }]}>Siren Muted</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.resolveBtn}
                onPress={handleResolve}
                activeOpacity={0.8}
              >
                <CheckCircle2 color={COLORS.white} size={18} style={{ marginRight: 6 }} />
                <Text style={styles.resolveBtnText}>Resolve & Clear</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.danger,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    overflow: 'hidden',
    ...SHADOWS.dangerGlow,
  },
  scrollInner: {
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    ...SHADOWS.dangerGlow,
  },
  headerTextCol: {
    flex: 1,
  },
  emergencyTag: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  emergencyTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  detailsCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  detailValuePrimary: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  detailValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  detailDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorderSubtle,
    marginVertical: SPACING.md,
  },
  ppmBadge: {
    backgroundColor: COLORS.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  ppmBadgeText: {
    color: COLORS.danger,
    fontWeight: '800',
    fontSize: 14,
  },
  flameStatusText: {
    color: COLORS.danger,
    fontWeight: '800',
    fontSize: 13,
  },
  actionsSection: {
    marginBottom: SPACING.xl,
  },
  sectionHeading: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  dispatchBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  dispatchBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  hotlinesGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  hotlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  hotlineBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  silenceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  silencedState: {
    borderColor: COLORS.cardBorder,
    opacity: 0.7,
  },
  silenceBtnText: {
    color: COLORS.warning,
    fontWeight: '700',
    fontSize: 14,
  },
  resolveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.normal,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resolveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});
