import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Linking,
  Platform 
} from 'react-native';
import { IncidentRecord } from '../utils/supabase';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  PhoneCall,
  Radio,
  Cpu,
  Calendar
} from 'lucide-react-native';

interface IncidentCardProps {
  incident: IncidentRecord;
  onResolve?: (incidentId: number, notes: string) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onResolve }) => {
  const [isExpanded, setIsExpanded] = useState(incident.status === 'Active');
  const [resolveNote, setResolveNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const isActive = incident.status === 'Active';
  const isFire = incident.alert_type === 'FIRE';

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleConfirmResolve = () => {
    if (onResolve) {
      onResolve(incident.id, resolveNote.trim() || 'Verified and resolved on duty');
      setIsResolving(false);
    }
  };

  const handleCall = (number?: string) => {
    if (!number) return;
    const cleanNumber = number.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {});
  };

  return (
    <View style={[
      styles.card, 
      isActive ? styles.activeCard : styles.resolvedCard
    ]}>
      {/* Top Header: Badges & Expand Arrow */}
      <TouchableOpacity 
        style={styles.cardHeader} 
        onPress={() => setIsExpanded(prev => !prev)}
        activeOpacity={0.8}
      >
        <View style={styles.badgeRow}>
          <View style={[
            styles.statusTag, 
            { 
              backgroundColor: isActive ? COLORS.dangerBg : 'rgba(16, 185, 129, 0.12)', 
              borderColor: isActive ? COLORS.dangerBorder : 'rgba(16, 185, 129, 0.3)' 
            }
          ]}>
            <Text style={[styles.statusTagText, { color: isActive ? COLORS.danger : COLORS.normal }]}>
              {isActive ? 'ACTIVE ALARM' : 'RESOLVED'}
            </Text>
          </View>

          <View style={[styles.alertTypeTag, { borderColor: isFire ? COLORS.dangerBorder : COLORS.warningBorder }]}>
            {isFire ? (
              <Flame color={COLORS.danger} size={13} style={{ marginRight: 4 }} />
            ) : (
              <AlertTriangle color={COLORS.warning} size={13} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.alertTypeText, { color: isFire ? COLORS.danger : COLORS.warning }]}>
              {isFire ? 'FIRE ALARM' : (incident.alert_type || 'GAS / SMOKE LEAK')}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.timeTag}>
            <Clock color={COLORS.textMuted} size={12} style={{ marginRight: 4 }} />
            <Text style={styles.timeTagText}>{formatDateTime(incident.start_time)}</Text>
          </View>
          {isExpanded ? (
            <ChevronUp color={COLORS.textMuted} size={18} />
          ) : (
            <ChevronDown color={COLORS.textMuted} size={18} />
          )}
        </View>
      </TouchableOpacity>

      {/* Main Household & Hardware Row */}
      <View style={styles.householdInfoBlock}>
        <View style={styles.houseNameRow}>
          <MapPin color={COLORS.primary} size={17} style={{ marginRight: 6 }} />
          <Text style={styles.houseName} numberOfLines={1}>
            {incident.house_name || 'Community Household'}
          </Text>
        </View>

        <View style={styles.metaChipsRow}>
          {incident.block_lot && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{incident.block_lot}</Text>
            </View>
          )}

          {incident.device_mac && (
            <View style={styles.metaChip}>
              <Radio color={COLORS.accent} size={10} style={{ marginRight: 3 }} />
              <Text style={styles.metaChipMacText}>{incident.device_mac}</Text>
            </View>
          )}

          {incident.device_label && (
            <Text style={styles.deviceLabelText} numberOfLines={1}>
              • {incident.device_label}
            </Text>
          )}
        </View>
      </View>

      {/* Reading Bar */}
      <View style={styles.readingBar}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>TRIGGER SENSOR LEVEL</Text>
          <View style={styles.statValueRow}>
            <Text style={[styles.statValue, { color: isActive ? COLORS.danger : (incident.ppm_at_trigger > 450 ? COLORS.warning : COLORS.normal) }]}>
              {incident.ppm_at_trigger ?? 0}
            </Text>
            <Text style={styles.statUnit}>PPM</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>ASSIGNED RESIDENT</Text>
          <Text style={styles.residentNameText} numberOfLines={1}>
            {incident.resident_name || 'Community Resident'}
          </Text>
          {incident.resident_phone && (
            <TouchableOpacity 
              style={styles.residentPhoneRow} 
              onPress={() => handleCall(incident.resident_phone)}
              activeOpacity={0.7}
            >
              <PhoneCall color={COLORS.primary} size={11} style={{ marginRight: 3 }} />
              <Text style={styles.residentPhoneText}>{incident.resident_phone}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Expandable Details and Resolution Section */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {incident.notes && (
            <View style={styles.notesBox}>
              <View style={styles.notesHeader}>
                <FileText color={COLORS.textSecondary} size={13} style={{ marginRight: 4 }} />
                <Text style={styles.notesLabel}>Incident Log & Action Taken</Text>
              </View>
              <Text style={styles.notesText}>{incident.notes}</Text>
            </View>
          )}

          {incident.end_time && (
            <View style={styles.resolvedMetaRow}>
              <UserCheck color={COLORS.normal} size={14} style={{ marginRight: 6 }} />
              <Text style={styles.resolvedMetaText}>
                Resolved at {formatDateTime(incident.end_time)}
                {incident.resolved_by ? ` by ${incident.resolved_by}` : ''}
              </Text>
            </View>
          )}

          {/* Inline Resolution Box for Active Incidents */}
          {isActive && onResolve && (
            <View style={styles.resolveActionContainer}>
              {isResolving ? (
                <View style={styles.resolveForm}>
                  <TextInput
                    style={styles.resolveInput}
                    placeholder="Enter dispatch notes, cause, or clearance info..."
                    placeholderTextColor={COLORS.textMuted}
                    value={resolveNote}
                    onChangeText={setResolveNote}
                  />
                  <View style={styles.formBtnRow}>
                    <TouchableOpacity 
                      style={styles.cancelBtn}
                      onPress={() => setIsResolving(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.confirmResolveBtn}
                      onPress={handleConfirmResolve}
                    >
                      <CheckCircle2 color={COLORS.white} size={14} style={{ marginRight: 4 }} />
                      <Text style={styles.confirmResolveBtnText}>Confirm Resolve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.openResolveBtn}
                  onPress={() => setIsResolving(true)}
                  activeOpacity={0.8}
                >
                  <CheckCircle2 color={COLORS.white} size={15} style={{ marginRight: 6 }} />
                  <Text style={styles.openResolveBtnText}>Resolve Incident & Clear Alarm</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  activeCard: {
    borderColor: COLORS.danger,
    ...SHADOWS.dangerGlow,
  },
  resolvedCard: {
    borderColor: COLORS.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertTypeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeTagText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  householdInfoBlock: {
    marginBottom: SPACING.sm,
  },
  houseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  houseName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  metaChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 4,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  metaChipText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  metaChipMacText: {
    color: COLORS.accent,
    fontSize: 9.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  deviceLabelText: {
    color: COLORS.textMuted,
    fontSize: 11,
    flex: 1,
  },
  readingBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
  },
  statCol: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorderSubtle,
    marginHorizontal: SPACING.sm,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    marginRight: 4,
  },
  statUnit: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  residentNameText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  residentPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  residentPhoneText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorderSubtle,
    paddingTop: SPACING.sm,
  },
  notesBox: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorderSubtle,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notesLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  notesText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 16,
  },
  resolvedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  resolvedMetaText: {
    color: COLORS.normal,
    fontSize: 11,
    fontWeight: '600',
  },
  resolveActionContainer: {
    marginTop: SPACING.xs,
  },
  resolveForm: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  resolveInput: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    color: COLORS.textPrimary,
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  formBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  cancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmResolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.normal,
    paddingVertical: 7,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
  },
  confirmResolveBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  openResolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    paddingVertical: 10,
    ...SHADOWS.sm,
  },
  openResolveBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
