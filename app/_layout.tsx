import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AdminProvider } from '../context/AdminContext';
import { EmergencyModal } from '../components/EmergencyModal';
import { TestSimulatorModal } from '../components/TestSimulatorModal';
import { OfflineBanner } from '../components/OfflineBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { COLORS } from '../constants/theme';
import { View, ActivityIndicator, Image, Text, StyleSheet } from 'react-native';

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// CONFIGURE NOTIFICATION BEHAVIOR AT MODULE ROOT FOR EXPO GO & STANDALONE
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

function RootLayoutNav() {
  const { isLoading, user, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Setup Notification Channel & Permissions on Startup
  useEffect(() => {
    async function setupNotifications() {
      if (Platform.OS === 'android') {
        // 1. Critical Alarm Channel
        await Notifications.setNotificationChannelAsync('emergency-alerts', {
          name: 'Emergency Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#FF3B30',
          sound: 'default',
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 2. Persistent Admin Safety Guard Channel (Keeps Command Center Active in Background)
        await Notifications.setNotificationChannelAsync('admin-guard', {
          name: 'H-Fire Command Center Guard',
          importance: Notifications.AndroidImportance.LOW,
          enableVibrate: false,
          showBadge: false,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 3. Post Persistent Sticky Admin Guard Notification
        await Notifications.scheduleNotificationAsync({
          identifier: 'hfire-admin-persistent-guard',
          content: {
            title: '🛡️ H-Fire Command Center Active',
            body: '24/7 Community sensor telemetry & incident monitoring is active in background.',
            priority: Notifications.AndroidNotificationPriority.LOW,
            sticky: true,
            autoDismiss: false,
          },
          trigger: null,
        }).catch(() => {});
      }
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    }
    setupNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const isAuthenticated = Boolean(user || profile);
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, profile, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image 
          source={require('../assets/h-fire_logo.png')} 
          style={styles.loadingLogo} 
          resizeMode="contain" 
        />
        <Text style={styles.loadingTitle}>H-FIRE ADMIN</Text>
        <Text style={styles.loadingSubtitle}>Community IoT Safety System</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.cardBackground,
        },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: COLORS.background,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="device/[mac]" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/forgot-password" options={{ title: 'Reset Password' }} />
      <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingLogo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  loadingTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  loadingSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AdminProvider>
            <StatusBar style="light" backgroundColor={COLORS.background} />
            <OfflineBanner />
            <RootLayoutNav />
            <EmergencyModal />
            <TestSimulatorModal />
          </AdminProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
