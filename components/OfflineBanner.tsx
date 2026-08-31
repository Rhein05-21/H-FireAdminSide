import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  ActivityIndicator, 
  Platform,
  AppState,
  AppStateStatus 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react-native';

// Zero-dependency connectivity checker using lightweight timeout fetch
async function pingInternet(): Promise<boolean> {
  // If web browser explicitly says navigator is offline
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'onLine' in navigator) {
    if (!navigator.onLine) return false;
  }

  const endpoints = [
    'https://clients3.google.com/generate_204',
    'https://1.1.1.1/cdn-cgi/trace',
    'https://httpbin.org/status/204'
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (response.ok || response.status === 204 || response.status === 200) {
        return true;
      }
    } catch {
      // Continue to next backup endpoint
    }
  }

  return false;
}

export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showReconnectedBadge, setShowReconnectedBadge] = useState<boolean>(false);

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const reconnectedTimerRef = useRef<any>(null);

  const checkConnection = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) {
      setIsChecking(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }

    const online = await pingInternet();
    setIsChecking(false);

    setIsOnline(prev => {
      // If transitioning from offline -> online, show brief success badge
      if (!prev && online) {
        setShowReconnectedBadge(true);
        if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
        reconnectedTimerRef.current = setTimeout(() => {
          setShowReconnectedBadge(false);
        }, 3000);

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
      return online;
    });

    return online;
  }, []);

  // Initial check and periodic polling
  useEffect(() => {
    checkConnection();

    // Check every 3 seconds when offline, every 10 seconds when online
    const interval = setInterval(() => {
      checkConnection();
    }, isOnline ? 10000 : 3000);

    // Listen for app state changes (resume from background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkConnection();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Web online/offline event listeners
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => checkConnection();
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        clearInterval(interval);
        sub.remove();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
      };
    }

    return () => {
      clearInterval(interval);
      sub.remove();
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
    };
  }, [checkConnection, isOnline]);

  // Handle slide animation when offline or when reconnected badge is showing
  const isVisible = !isOnline || showReconnectedBadge;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Start pulsing icon while offline
      if (!isOnline) {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.5,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 700,
              useNativeDriver: true,
            }),
          ])
        );
        loop.start();
        return () => loop.stop();
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, isOnline, slideAnim, pulseAnim]);

  if (isOnline && !showReconnectedBadge) {
    return null;
  }

  const isReconnectedState = isOnline && showReconnectedBadge;

  return (
    <Animated.View 
      style={[
        styles.bannerContainer, 
        { 
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20) + 4,
          transform: [{ translateY: slideAnim }],
          backgroundColor: isReconnectedState ? '#065F46' : '#7F1D1D',
          borderColor: isReconnectedState ? COLORS.normal : COLORS.danger,
        }
      ]}
    >
      <View style={styles.bannerContent}>
        {isReconnectedState ? (
          <View style={styles.iconRingSuccess}>
            <Wifi color={COLORS.normal} size={16} />
          </View>
        ) : (
          <Animated.View style={[styles.iconRingWarning, { opacity: pulseAnim }]}>
            <WifiOff color={COLORS.danger} size={16} />
          </Animated.View>
        )}

        <View style={styles.textCol}>
          <Text style={styles.bannerTitle}>
            {isReconnectedState ? 'ONLINE — Connection Restored' : 'NO INTERNET CONNECTION'}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {isReconnectedState 
              ? 'Realtime MQTT sensor telemetry & cloud sync resumed.' 
              : 'Offline Mode: Live sensor stream paused. Emergency hotlines active.'}
          </Text>
        </View>

        {!isReconnectedState && (
          <TouchableOpacity 
            style={styles.retryBtn}
            onPress={() => checkConnection(true)}
            disabled={isChecking}
            activeOpacity={0.75}
          >
            {isChecking ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <RefreshCw color={COLORS.white} size={12} style={{ marginRight: 4 }} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    paddingHorizontal: SPACING.md,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    ...SHADOWS.lg,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconRingWarning: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  iconRingSuccess: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  textCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  bannerTitle: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  retryBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
});
