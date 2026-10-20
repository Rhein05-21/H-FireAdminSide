import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CommunityMap } from '../../components/CommunityMap';
import { useAdmin } from '../../context/AdminContext';
import { DeviceRecord } from '../../utils/supabase';

export default function MapScreen() {
  const { devices, triggerEmergencyAlert } = useAdmin();
  const { focusMac } = useLocalSearchParams<{ focusMac?: string }>();

  const handleSelectDevice = (device: DeviceRecord) => {
    if (device.current_status === 'Danger') {
      triggerEmergencyAlert(device);
    }
  };

  return (
    <View style={styles.container}>
      <CommunityMap
        devices={devices}
        initialFocusMac={focusMac}
        onSelectDevice={handleSelectDevice}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
});
