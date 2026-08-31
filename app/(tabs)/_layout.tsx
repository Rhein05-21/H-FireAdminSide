import React from 'react';
import { Tabs } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { LayoutDashboard, Map, ShieldAlert, Settings, ClipboardList } from 'lucide-react-native';
import { useAdmin } from '../../context/AdminContext';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { incidents, communityStatus } = useAdmin();
  const insets = useSafeAreaInsets();
  const activeCount = incidents.filter(i => i.status === 'Active').length;

  // Dynamically calculate bottom padding for both Android (3-button / gesture) & iPhone (Home indicator)
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 12);
  const tabHeight = 54 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: communityStatus === 'Danger' ? COLORS.danger : COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.cardBackground,
          borderTopColor: COLORS.cardBorder,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: COLORS.cardBackground,
        },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: () => (
            <View style={styles.headerBrandContainer}>
              <Image 
                source={require('../../assets/h-fire_logo.png')} 
                style={styles.headerBrandLogo} 
                resizeMode="contain" 
              />
              <View>
                <Text style={styles.headerBrandTitle}>H-FIRE MONITORING</Text>
                <Text style={styles.headerBrandSub}>Centralized IoT Safety Operations</Text>
              </View>
            </View>
          ),
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Community Map',
          headerTitle: 'COMMUNITY SAFETY MAP',
          tabBarIcon: ({ color, size }) => (
            <Map color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'Incident Logs',
          headerTitle: 'INCIDENT LOGS',
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <ClipboardList color={color} size={22} />
              {activeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{activeCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'SYSTEM SETTINGS',
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={22} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBrandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  headerBrandLogo: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  headerBrandTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerBrandSub: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
