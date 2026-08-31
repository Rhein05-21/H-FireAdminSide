import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Switch 
} from 'react-native';
import { useAdmin } from '../context/AdminContext';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { 
  Zap, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Volume2, 
  RotateCcw, 
  X, 
  Sliders, 
  Radio, 
  Activity 
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TestSimulatorModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { 
    isSimulatorVisible, 
    setSimulatorVisible, 
    devices, 
    simulateDeviceTelemetry, 
    resetAllToSafeSimulation,
    triggerEmergencyAlert 
  } = useAdmin();

  const [selectedMac, setSelectedMac] = useState(devices[0]?.mac || '');
  const [customPpm, setCustomPpm] = useState('1850');
  const [customFlame, setCustomFlame] = useState(true);

  if (!isSimulatorVisible) return null;

  const currentDevice = devices.find(d => d.mac === selectedMac) || devices[0];

  const handleApplyCustom = () => {
    const ppm = parseInt(customPpm, 10) || 120;
    if (currentDevice) {
      simulateDeviceTelemetry(currentDevice.mac, ppm, customFlame);
    }
  };

  const handleTriggerPreset = (ppm: number, flame: boolean) => {
    if (currentDevice) {
      simulateDeviceTelemetry(currentDevice.mac, ppm, flame);
    }
  };

  const handleForceSiren = () => {
    if (currentDevice) {
      triggerEmergencyAlert(currentDevice);
    }
  };

  return (
    <Modal
      visible={isSimulatorVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setSimulatorVisible(false)}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Sliders color={COLORS.primary} size={22} style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.title}>IoT Telemetry Simulator</Text>
                <Text style={styles.subtitle}>Test sirens, maps, and alarms in Expo Go</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={() => setSimulatorVisible(false)}
            >
              <X color={COLORS.textMuted} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={[styles.scrollBody, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
          >
            {/* 1. Target Household Selector */}
            <Text style={styles.sectionTitle}>SELECT TARGET NODE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceChips}>
              {devices.map((device) => {
                const isSelected = (device.mac === (selectedMac || devices[0]?.mac));
                return (
                  <TouchableOpacity
                    key={device.mac}
                    style={[
                      styles.deviceChip,
                      isSelected && styles.deviceChipSelected
                    ]}
                    onPress={() => setSelectedMac(device.mac)}
                  >
                    <Text style={[
                      styles.deviceChipText,
                      isSelected && styles.deviceChipTextSelected
                    ]} numberOfLines={1}>
                      {device.house_name.split('-')[0]}
                    </Text>
                    <Text style={styles.chipPpm}>{device.current_ppm ?? 0} PPM</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Current Target Info */}
            <View style={styles.targetCard}>
              <Text style={styles.targetName}>{currentDevice?.house_name}</Text>
              <Text style={styles.targetSub}>{currentDevice?.label} • {currentDevice?.mac}</Text>
            </View>

            {/* 2. One-Tap Quick Action Presets */}
            <Text style={styles.sectionTitle}>QUICK SCENARIO PRESETS</Text>
            <View style={styles.presetsGrid}>
              <TouchableOpacity 
                style={[styles.presetBtn, { borderColor: COLORS.normalBorder }]}
                onPress={() => handleTriggerPreset(110, false)}
              >
                <CheckCircle2 color={COLORS.normal} size={20} />
                <Text style={[styles.presetTitle, { color: COLORS.normal }]}>Safe / Normal</Text>
                <Text style={styles.presetDesc}>110 PPM • Flame Off</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.presetBtn, { borderColor: COLORS.warningBorder }]}
                onPress={() => handleTriggerPreset(720, false)}
              >
                <AlertTriangle color={COLORS.warning} size={20} />
                <Text style={[styles.presetTitle, { color: COLORS.warning }]}>Gas / Smoke Alert</Text>
                <Text style={styles.presetDesc}>720 PPM • Warning</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.presetBtn, { borderColor: COLORS.dangerBorder }]}
                onPress={() => handleTriggerPreset(1950, true)}
              >
                <Flame color={COLORS.danger} size={20} />
                <Text style={[styles.presetTitle, { color: COLORS.danger }]}>Critical Fire Spike</Text>
                <Text style={styles.presetDesc}>1950 PPM • Flame Active</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.presetBtn, { borderColor: COLORS.primary }]}
                onPress={handleForceSiren}
              >
                <Volume2 color={COLORS.primary} size={20} />
                <Text style={[styles.presetTitle, { color: COLORS.primary }]}>Force Community Siren</Text>
                <Text style={styles.presetDesc}>Test Modal & Audio</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Custom Value Injector */}
            <Text style={styles.sectionTitle}>CUSTOM TELEMETRY INJECTOR</Text>
            <View style={styles.customForm}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Gas Level (PPM):</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={customPpm}
                  onChangeText={setCustomPpm}
                  placeholder="e.g. 1800"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Optical Flame Tripped:</Text>
                <Switch
                  value={customFlame}
                  onValueChange={setCustomFlame}
                  trackColor={{ false: '#374151', true: COLORS.danger }}
                  thumbColor={COLORS.white}
                />
              </View>

              <TouchableOpacity 
                style={styles.applyBtn}
                onPress={handleApplyCustom}
                activeOpacity={0.8}
              >
                <Zap color={COLORS.white} size={18} style={{ marginRight: 6 }} />
                <Text style={styles.applyBtnText}>Inject Telemetry to Selected Node</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Global Reset */}
            <TouchableOpacity 
              style={styles.resetBtn}
              onPress={resetAllToSafeSimulation}
              activeOpacity={0.8}
            >
              <RotateCcw color={COLORS.textSecondary} size={18} style={{ marginRight: 6 }} />
              <Text style={styles.resetBtnText}>Reset All Community Nodes to Safe (Normal)</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: COLORS.cardBorder,
    maxHeight: '85%',
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    paddingBottom: 40,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  deviceChips: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  deviceChip: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: SPACING.sm,
    minWidth: 120,
  },
  deviceChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  deviceChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  deviceChipTextSelected: {
    color: COLORS.white,
  },
  chipPpm: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  targetCard: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    marginBottom: SPACING.md,
  },
  targetName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  targetSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  presetBtn: {
    width: '47%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  presetDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  customForm: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    marginBottom: SPACING.lg,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 8,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 100,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  resetBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 10,
  },
  resetBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
