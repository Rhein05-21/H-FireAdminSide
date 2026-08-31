import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CommunityMap } from '../../components/CommunityMap';
import { useAdmin } from '../../context/AdminContext';
import { DeviceRecord } from '../../utils/supabase';

export default function MapScreen() {
  const { devices, triggerEmergencyAlert } = useAdmin();

  const handleSelectDevice = (device: DeviceRecord) => {
    if (device.current_status === 'Danger') {
      triggerEmergencyAlert(device);
    }
  };

  return (
    <View style={styles.container}>
      <CommunityMap
        devices={devices}
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
