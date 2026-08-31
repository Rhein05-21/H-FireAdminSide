import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { 
  supabase, 
  isSupabaseConfigured, 
  DeviceRecord, 
  IncidentRecord, 
  GasLogRecord,
  ProfileRecord 
} from '../utils/supabase';
import { 
  getStatusFromPPM, 
  GasStatus, 
  THRESHOLDS, 
  EmergencyHotline, 
  DEFAULT_EMERGENCY_HOTLINES 
} from '../constants/thresholds';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import mqtt from 'mqtt';
import { useAuth } from './AuthContext';

// Configure notification behavior for active app state
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

export interface SecondaryNodeTelemetry {
  id: string;
  name: string;
  gasKey: string;
  fireKey: string;
  ppm: number;
  flame: boolean;
  status: GasStatus;
  last_seen: string;
}

export interface SecondaryNodesState {
  N2: SecondaryNodeTelemetry;
  N3: SecondaryNodeTelemetry;
}

interface AdminContextType {
  devices: DeviceRecord[];
  incidents: IncidentRecord[];
  gasLogs: GasLogRecord[];
  profiles: ProfileRecord[];
  hotlines: EmergencyHotline[];
  secondaryNodes: SecondaryNodesState;
  communityStatus: GasStatus;
  activeEmergency: IncidentRecord | DeviceRecord | null;
  isSirenPlaying: boolean;
  isSimulatorVisible: boolean;
  bridgeHeartbeat: string | null;
  refreshData: () => Promise<void>;
  resolveIncident: (incidentId: number, notes?: string) => Promise<void>;
  dispatchEmergencyResponse: (incidentId: number | string) => void;
  silenceSiren: () => void;
  triggerEmergencyAlert: (target: IncidentRecord | DeviceRecord) => void;
  setSimulatorVisible: (visible: boolean) => void;
  simulateDeviceTelemetry: (mac: string, ppm: number, flame: boolean) => Promise<void>;
  resetAllToSafeSimulation: () => Promise<void>;
  updateDeviceConfig: (mac: string, label: string, profileId: string | null) => Promise<{ success: boolean; error?: string }>;
  unassignDevice: (mac: string) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (userId: string, newRole: any) => Promise<{ success: boolean; error?: string }>;
  saveHotline: (hotline: EmergencyHotline) => Promise<void>;
  deleteHotline: (id: string) => Promise<void>;
  resetHotlinesToDefault: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, role } = useAuth();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [gasLogs, setGasLogs] = useState<GasLogRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [hotlines, setHotlines] = useState<EmergencyHotline[]>(DEFAULT_EMERGENCY_HOTLINES);
  const [secondaryNodes, setSecondaryNodes] = useState<SecondaryNodesState>({
    N2: {
      id: 'N2',
      name: 'Secondary Sensor Node 2 (N2)',
      gasKey: 'N2_Gas',
      fireKey: 'N2_Fire',
      ppm: 0,
      flame: false,
      status: 'Normal',
      last_seen: new Date().toISOString(),
    },
    N3: {
      id: 'N3',
      name: 'Secondary Sensor Node 3 (N3)',
      gasKey: 'N3_Gas',
      fireKey: 'N3_Fire',
      ppm: 0,
      flame: false,
      status: 'Normal',
      last_seen: new Date().toISOString(),
    },
  });
  const [communityStatus, setCommunityStatus] = useState<GasStatus>('Normal');
  const [activeEmergency, setActiveEmergency] = useState<IncidentRecord | DeviceRecord | null>(null);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [isSimulatorVisible, setSimulatorVisible] = useState(false);
  const [bridgeHeartbeat, setBridgeHeartbeat] = useState<string | null>(new Date().toISOString());

  // Load cached emergency hotlines from local storage
  useEffect(() => {
    AsyncStorage.getItem('hfire_emergency_hotlines').then(val => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHotlines(parsed);
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);

  const soundRef = useRef<Audio.Sound | null>(null);
  const hapticsIntervalRef = useRef<any>(null);
  const latestTelemetryMapRef = useRef<Record<string, { ppm: number; flame: boolean; status: GasStatus; timestamp: number }>>({});

  // Overall Community Status Evaluator (Driven by LIVE device readings)
  useEffect(() => {
    const hasDanger = devices.some(d => d.current_status === 'Danger');
    const hasWarning = devices.some(d => d.current_status === 'Warning');

    if (hasDanger) {
      setCommunityStatus('Danger');
    } else if (hasWarning) {
      setCommunityStatus('Warning');
    } else {
      setCommunityStatus('Normal');
    }
  }, [devices]);

  const silencedUntilRef = useRef<number>(0);
  const lastNotificationTimeRef = useRef<number>(0);
  const currentSirenTypeRef = useRef<string>('');

  // Audio Siren & Haptic Vibration Manager
  const startSiren = useCallback(async (alarmType: 'fire' | 'smoke' = 'fire') => {
    try {
      // If already playing the same siren type cleanly, do not reload/restart
      if (currentSirenTypeRef.current === alarmType && soundRef.current !== null) {
        return;
      }

      setIsSirenPlaying(true);

      if (Platform.OS !== 'web') {
        if (hapticsIntervalRef.current) clearInterval(hapticsIntervalRef.current);
        hapticsIntervalRef.current = setInterval(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }, 1200);
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {
          // ignore
        }
        soundRef.current = null;
      }

      const audioSource = alarmType === 'smoke'
        ? require('../assets/Smoke Alarm Sound.mp3')
        : require('../assets/Fire Alarm.mp3');

      const { sound } = await Audio.Sound.createAsync(
        audioSource,
        { isLooping: true, volume: 1.0, shouldPlay: true }
      );
      soundRef.current = sound;
      currentSirenTypeRef.current = alarmType;
    } catch (err) {
      console.warn('Audio/Haptics playback info:', err);
    }
  }, []);

  const silenceSiren = useCallback(async () => {
    setIsSirenPlaying(false);
    currentSirenTypeRef.current = '';
    silencedUntilRef.current = Date.now() + 60000;
    setActiveEmergency(null);

    if (hapticsIntervalRef.current) {
      clearInterval(hapticsIntervalRef.current);
      hapticsIntervalRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // ignore
      }
      soundRef.current = null;
    }

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('incidents')
          .update({ 
            status: 'Resolved', 
            end_time: new Date().toISOString(),
            notes: 'Silenced and cleared by Admin' 
          })
          .eq('status', 'Active');
      } catch (e) {}
    }
  }, []);

  const triggerEmergencyAlert = useCallback((target: IncidentRecord | DeviceRecord) => {
    // If snoozed by Admin resolution/silence, do not re-trip
    if (Date.now() < silencedUntilRef.current) {
      return;
    }

    setActiveEmergency(target);
    const isFire = 'alert_type' in target 
      ? target.alert_type === 'FIRE' 
      : Boolean((target as DeviceRecord).flame);
    startSiren(isFire ? 'fire' : 'smoke');

    // Throttle Admin system notification banner (at most once every 30s per incident)
    const now = Date.now();
    if (now - lastNotificationTimeRef.current > 30000) {
      lastNotificationTimeRef.current = now;

      const house = 'house_name' in target ? (target.house_name || 'Community Household') : 'Community Household';
      const alertType = 'alert_type' in target ? target.alert_type : (isFire ? 'FIRE ALARM' : 'GAS / SMOKE LEAK');
      const ppm = 'ppm_at_trigger' in target ? target.ppm_at_trigger : ('current_ppm' in target ? target.current_ppm : 0);

      Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 [COMMAND CENTER] CRITICAL: ${alertType}`,
          body: `EMERGENCY at ${house}! Gas/Smoke: ${ppm} PPM. Tap to open tactical map & dispatch response.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 500, 250, 500],
          channelId: 'emergency-alerts',
          data: { target },
        } as any,
        trigger: null,
      }).catch(() => {});
    }
  }, [startSiren]);

  const lastAdminGuardUpdateRef = useRef<number>(0);
  const updatePersistentAdminGuardNotification = useCallback((n1Ppm: number, n1Flame: boolean, n2Ppm: number = 0, n2Flame: boolean = false, n3Ppm: number = 0, n3Flame: boolean = false) => {
    if (Platform.OS !== 'android') return;
    const now = Date.now();
    if (now - lastAdminGuardUpdateRef.current < 4000) return;
    lastAdminGuardUpdateRef.current = now;

    const maxPpm = Math.max(n1Ppm, n2Ppm, n3Ppm);
    const anyFlame = n1Flame || n2Flame || n3Flame;
    const statusText = maxPpm > 1500 || anyFlame ? '🚨 DANGER EVENT' : (maxPpm > 450 ? '⚠️ ELEVATED SENSORS' : '🛡️ COMMUNITY SAFE');
    const bodyText = `Sector 1: ${n1Ppm} PPM | Sector 2: ${n2Ppm} PPM | Sector 3: ${n3Ppm} PPM • Flame: ${anyFlame ? '🔥 DETECTED' : 'Safe'}`;

    Notifications.scheduleNotificationAsync({
      identifier: 'hfire-admin-persistent-guard',
      content: {
        title: `${statusText} • Max: ${maxPpm} PPM`,
        body: bodyText,
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true,
        autoDismiss: false,
        channelId: 'admin-guard',
      } as any,
      trigger: null,
    }).catch(() => {});
  }, []);

  // Fetch Live Data from Supabase
  const refreshData = async () => {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Parallel fetch Profiles, Devices, Incidents, Gas Logs, and All App Settings
      const [
        { data: profData },
        { data: devData },
        { data: incData },
        { data: logsData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('devices').select('*'),
        supabase.from('incidents').select('*').order('start_time', { ascending: false }).limit(50),
        supabase.from('gas_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('app_settings').select('*'),
      ]);

      const loadedProfiles = (profData || []) as ProfileRecord[];
      const loadedLogs = (logsData || []) as GasLogRecord[];
      const allSettings = (settingsData || []) as any[];
      setProfiles(loadedProfiles);
      setGasLogs(loadedLogs);

      // Parse live telemetry broadcast & device configurations from app_settings
      const liveTelemetryMap: Record<string, { ppm: number; flame: boolean; status: GasStatus; timestamp: string }> = {};
      const deviceConfigMap: Record<string, { label?: string; profileId?: string; houseName?: string; blockLot?: string; lat?: number; lng?: number }> = {};

      allSettings.forEach(s => {
        if (s.key && (s.key.startsWith('telemetry_') || s.key === 'live_telemetry' || s.key === 'mqtt_data')) {
          try {
            const parsed = JSON.parse(s.value);
            const rawMac = parsed.mac || s.key.replace(/^telemetry_/i, '');
            const macKey = String(rawMac).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const formattedMac = macKey.length === 12 
              ? macKey.match(/.{1,2}/g)?.join(':') || rawMac.toUpperCase()
              : (rawMac ? rawMac.toUpperCase() : '20:50:0D:33:68:0C');

            // Extract N1 (Core Node) PPM & Flame
            const n1Ppm = parsed.N1_Gas !== undefined ? Number(parsed.N1_Gas) :
                          parsed.n1_gas !== undefined ? Number(parsed.n1_gas) :
                          parsed.ppm !== undefined ? Number(parsed.ppm) :
                          parsed.gas !== undefined ? Number(parsed.gas) :
                          parsed.smoke !== undefined ? Number(parsed.smoke) :
                          parsed.ppm_level !== undefined ? Number(parsed.ppm_level) :
                          undefined;

            const n1Flame = parsed.N1_Fire !== undefined ? (Number(parsed.N1_Fire) === 1 || Boolean(parsed.N1_Fire)) :
                            parsed.n1_fire !== undefined ? (Number(parsed.n1_fire) === 1 || Boolean(parsed.n1_fire)) :
                            Boolean(parsed.flame ?? (parsed.fire === 1));

            if (n1Ppm !== undefined && !isNaN(n1Ppm)) {
              const status = parsed.status || (n1Ppm > 1500 || n1Flame ? 'Danger' : (n1Ppm > 450 ? 'Warning' : 'Normal'));
              liveTelemetryMap[formattedMac] = {
                ppm: n1Ppm,
                flame: n1Flame,
                status: status as GasStatus,
                timestamp: parsed.timestamp || s.updated_at || new Date().toISOString(),
              };
            }

            // Extract N2 & N3 Telemetry if present in broadcast
            if (parsed.N2_Gas !== undefined || parsed.n2_gas !== undefined) {
              const n2Ppm = Number(parsed.N2_Gas ?? parsed.n2_gas ?? 0);
              const n2Flame = parsed.N2_Fire !== undefined ? (Number(parsed.N2_Fire) === 1 || Boolean(parsed.N2_Fire)) : false;
              const n2Status = n2Ppm > 1500 || n2Flame ? 'Danger' : (n2Ppm > 450 ? 'Warning' : 'Normal');
              setSecondaryNodes(prev => ({
                ...prev,
                N2: {
                  ...prev.N2,
                  ppm: n2Ppm,
                  flame: n2Flame,
                  status: n2Status,
                  last_seen: parsed.timestamp || s.updated_at || new Date().toISOString(),
                }
              }));

              if (n2Status === 'Danger' && !activeEmergency && Date.now() >= silencedUntilRef.current) {
                triggerEmergencyAlert({
                  id: Date.now(),
                  device_mac: formattedMac,
                  status: 'Active',
                  ppm_at_trigger: n2Ppm,
                  alert_type: n2Flame ? 'FIRE' : 'GAS / SMOKE LEAK',
                  house_name: 'Household Sector 2 (Living Room)',
                  start_time: new Date().toISOString(),
                } as IncidentRecord);
              }
            }

            if (parsed.N3_Gas !== undefined || parsed.n3_gas !== undefined) {
              const n3Ppm = Number(parsed.N3_Gas ?? parsed.n3_gas ?? 0);
              const n3Flame = parsed.N3_Fire !== undefined ? (Number(parsed.N3_Fire) === 1 || Boolean(parsed.N3_Fire)) : false;
              const n3Status = n3Ppm > 1500 || n3Flame ? 'Danger' : (n3Ppm > 450 ? 'Warning' : 'Normal');
              setSecondaryNodes(prev => ({
                ...prev,
                N3: {
                  ...prev.N3,
                  ppm: n3Ppm,
                  flame: n3Flame,
                  status: n3Status,
                  last_seen: parsed.timestamp || s.updated_at || new Date().toISOString(),
                }
              }));

              if (n3Status === 'Danger' && !activeEmergency && Date.now() >= silencedUntilRef.current) {
                triggerEmergencyAlert({
                  id: Date.now(),
                  device_mac: formattedMac,
                  status: 'Active',
                  ppm_at_trigger: n3Ppm,
                  alert_type: n3Flame ? 'FIRE' : 'GAS / SMOKE LEAK',
                  house_name: 'Household Sector 3 (Bedroom/Ext)',
                  start_time: new Date().toISOString(),
                } as IncidentRecord);
              }
            }
          } catch {}
        } else if (s.key && s.key.startsWith('device_config_')) {
          try {
            const parsed = JSON.parse(s.value);
            if (parsed.mac) {
              deviceConfigMap[parsed.mac.toUpperCase()] = parsed;
            }
          } catch {}
        } else if (s.key === 'emergency_hotlines') {
          try {
            const parsed = JSON.parse(s.value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHotlines(parsed);
              AsyncStorage.setItem('hfire_emergency_hotlines', s.value).catch(() => {});
            }
          } catch {}
        }
      });

      // 2. Map Devices from both devices table, live gas_logs, and telemetry broadcasts
      const devList = ((devData || []) as any[]).filter(d => 
        d.mac !== '20:50:0D:33:68:02' && 
        d.mac !== '20:50:0D:33:68:03' &&
        !d.house_name?.includes('Household Sector 2') &&
        !d.house_name?.includes('Household Sector 3')
      );
      const allMacs = new Set<string>([
        '20:50:0D:33:68:0C',
      ]);
      devList.forEach(d => { if (d.mac) allMacs.add(d.mac.toUpperCase()); });
      loadedLogs.forEach(l => { 
        if (l.device_mac && l.device_mac !== '20:50:0D:33:68:02' && l.device_mac !== '20:50:0D:33:68:03') {
          allMacs.add(l.device_mac.toUpperCase()); 
        }
      });
      Object.keys(liveTelemetryMap).forEach(mac => {
        if (mac !== '20:50:0D:33:68:02' && mac !== '20:50:0D:33:68:03') {
          allMacs.add(mac);
        }
      });

      const mappedDevices: DeviceRecord[] = Array.from(allMacs).map((mac, index) => {
        const d = devList.find(item => item.mac?.toUpperCase() === mac);
        const latestLog = loadedLogs.find(l => l.device_mac?.toUpperCase() === mac);
        const liveTel = liveTelemetryMap[mac];
        const customConfig = deviceConfigMap[mac];

        // Resolve assigned resident profile without forced fallback
        let profileId: string | undefined = undefined;
        if (customConfig && customConfig.profileId !== undefined) {
          // Explicit setting in device config (null = explicitly unassigned)
          profileId = customConfig.profileId ? customConfig.profileId : undefined;
        } else if (d && d.profile_id !== undefined) {
          // Explicit setting in devices table (null/empty = unassigned)
          profileId = d.profile_id || undefined;
        } else {
          // Check if any resident profile explicitly has this device_mac assigned in profiles table
          const profileWithMac = loadedProfiles.find(p => p.device_mac?.toUpperCase() === mac);
          profileId = profileWithMac?.id || undefined;
        }

        const linkedProfile = profileId ? loadedProfiles.find(p => p.id === profileId) : undefined;

        const lastSeenStr = liveTel?.timestamp || d?.last_seen || latestLog?.created_at || new Date().toISOString();
        const isOnline = (Date.now() - new Date(lastSeenStr).getTime()) < THRESHOLDS.OFFLINE_TIMEOUT_MS;

        // Auto-assign location from resident profile if linked
        const lat = linkedProfile?.latitude || customConfig?.lat || d?.latitude || (14.1777 + (index * 0.0012));
        const lng = linkedProfile?.longitude || customConfig?.lng || d?.longitude || (121.2551 + (index * 0.0015));
        const blockLot = linkedProfile?.block_lot || customConfig?.blockLot || d?.block_lot || (mac === '20:50:0D:33:68:0C' ? 'Block 1 Lot 1' : `Block 1 Lot ${index + 1}`);

        // Automatically set Household Name based on assigned resident profile
        let houseName = '';
        if (linkedProfile?.name) {
          const pName = linkedProfile.name.trim();
          houseName = pName.toLowerCase().includes('household') ? pName : `${pName} Household`;
        } else if (customConfig?.houseName && !customConfig.houseName.includes('Main Household')) {
          houseName = customConfig.houseName;
        } else if (d?.house_name && !d.house_name.includes('Main Household')) {
          houseName = d.house_name;
        } else {
          houseName = mac === '20:50:0D:33:68:0C' ? 'Community Core Node 1' : `Sensor Node (${mac.slice(-5)})`;
        }

        const label = customConfig?.label || d?.label || (
          mac === '20:50:0D:33:68:0C' 
            ? 'Main Core MQ-2 & Optical Flame' 
            : `Satellite Sensor Node (${mac.slice(-5)})`
        );

        const recentLocal = latestTelemetryMapRef.current[mac];
        const isLocalFresh = recentLocal !== undefined && (Date.now() - recentLocal.timestamp < 30000);

        const currentPpm = liveTel !== undefined 
          ? liveTel.ppm 
          : (isLocalFresh ? recentLocal.ppm : (latestLog !== undefined ? latestLog.ppm_level : (d?.current_ppm ?? 0)));
        
        const flameDetected = liveTel !== undefined 
          ? liveTel.flame 
          : (isLocalFresh ? recentLocal.flame : Boolean(d?.flame));

        const status = liveTel !== undefined 
          ? liveTel.status 
          : (isLocalFresh ? recentLocal.status : (latestLog ? (latestLog.status as GasStatus) : getStatusFromPPM(currentPpm, flameDetected, isOnline)));

        return {
          mac,
          house_name: houseName,
          label,
          profile_id: profileId,
          block_lot: blockLot,
          latitude: lat,
          longitude: lng,
          last_seen: lastSeenStr,
          current_ppm: currentPpm,
          flame: flameDetected,
          current_status: status,
          resident_name: linkedProfile?.name || 'Unassigned (Community Sensor)',
          resident_phone: linkedProfile?.emergency_hotline || 'N/A',
        };
      });

      setDevices(mappedDevices);

      // 3. Map Incidents
      if (incData) {
        const mappedIncidents: IncidentRecord[] = (incData as any[]).map(inc => {
          const linkedProfile = loadedProfiles.find(p => p.id === inc.profile_id);
          const linkedDev = mappedDevices.find(d => d.mac === inc.device_mac);
          const houseName = linkedProfile?.name 
            ? (linkedProfile.name.toLowerCase().includes('household') ? linkedProfile.name : `${linkedProfile.name} Household`)
            : (linkedDev?.house_name || 'Community Household');

          return {
            ...inc,
            house_name: houseName,
            block_lot: linkedProfile?.block_lot || linkedDev?.block_lot || 'Block 1 Lot 1',
            resident_name: linkedProfile?.name || linkedDev?.resident_name || 'Community Resident',
            resident_phone: linkedProfile?.emergency_hotline || linkedDev?.resident_phone || '0917-000-0000',
            device_label: linkedDev?.label || 'IoT Smoke/Gas Sensor',
          };
        });
        setIncidents(mappedIncidents);

        const active = mappedIncidents.find(i => i.status === 'Active');
        if (active && !activeEmergency) {
          triggerEmergencyAlert(active);
        }
      }

      // 4. Heartbeat
      const hb = allSettings.find(s => s.key === 'bridge_heartbeat');
      if (hb) {
        setBridgeHeartbeat(hb.value);
      }
    } catch (e) {
      console.warn('Error refreshing Supabase data:', e);
    }
  };

  // Realtime Supabase Subscriptions & Direct HiveMQ MQTT Stream
  useEffect(() => {
    refreshData();

    // 1.5-second periodic poll to guarantee immediate realtime synchronization
    const pollInterval = setInterval(() => {
      refreshData();
    }, 1500);

    // Direct HiveMQ WebSocket Connection for 0ms Live Telemetry
    let mqttClient: any = null;
    try {
      const brokerUrl = 'wss://16e51255d95244c2b069b92cf77ebf81.s1.eu.hivemq.cloud:8884/mqtt';
      mqttClient = mqtt.connect(brokerUrl, {
        username: 'RheinTigle',
        password: '052105@Rhein',
        clientId: `hfire_mobile_${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        reconnectPeriod: 2000,
      });

      mqttClient.on('connect', () => {
        mqttClient.subscribe(['#', 'hfire/#', 'hfire/house1/data']);
      });

      mqttClient.on('message', (_topic: string, message: any) => {
        try {
          const raw = message.toString().trim();
          if (!raw.startsWith('{')) return;
          const data = JSON.parse(raw);

          let nodePpm: number | null = null;
          let nodeFlame: boolean = false;
          let nodeMac = '20:50:0D:33:68:0C';

          if (data.mac) {
            nodeMac = String(data.mac).toUpperCase();
          }

          // Check for N1_Gas or custom sector keys
          const nGasKey = Object.keys(data).find(k => /^N\d+_Gas$/i.test(k));
          const nFireKey = Object.keys(data).find(k => /^N\d+_Fire$/i.test(k));

          if (nGasKey && data[nGasKey] !== undefined) {
            nodePpm = Number(data[nGasKey] ?? 0);
            nodeFlame = nFireKey ? (Number(data[nFireKey] ?? 0) === 1) : false;
          } else if (data.ppm !== undefined) {
            nodePpm = Number(data.ppm);
            nodeFlame = Boolean(data.flame ?? (data.fire === 1));
          } else if (data.gas !== undefined) {
            nodePpm = Number(data.gas);
            nodeFlame = Boolean(data.flame ?? (data.fire === 1));
          } else if (data.ppm_level !== undefined) {
            nodePpm = Number(data.ppm_level);
            nodeFlame = Boolean(data.flame);
          } else if (data.smoke !== undefined) {
            nodePpm = Number(data.smoke);
            nodeFlame = Boolean(data.flame);
          }

          // 1. Process Core Node (N1 or general payload)
          if (nodePpm !== null && !isNaN(nodePpm)) {
            const nodeStatus = nodePpm > 1500 || nodeFlame ? 'Danger' : (nodePpm > 450 ? 'Warning' : 'Normal');

            // Cache in latestTelemetryMapRef to protect against database polling overwrite
            latestTelemetryMapRef.current[nodeMac] = {
              ppm: nodePpm,
              flame: nodeFlame,
              status: nodeStatus,
              timestamp: Date.now(),
            };

            setDevices(prev => {
              const updated = [...prev];
              const existingIndex = updated.findIndex(d => d.mac === nodeMac);
              if (existingIndex >= 0) {
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  current_ppm: nodePpm!,
                  flame: nodeFlame,
                  current_status: nodeStatus,
                  last_seen: new Date().toISOString(),
                };
              }
              return updated;
            });

            if (nodeStatus === 'Normal') {
              silencedUntilRef.current = 0;
            }

            if (nodeStatus === 'Danger' || nodeStatus === 'Warning') {
              Promise.resolve(supabase.from('gas_logs').insert([{
                device_mac: nodeMac,
                ppm_level: nodePpm,
                status: nodeStatus,
                created_at: new Date().toISOString(),
              }])).catch(() => {});
            }

            if (nodeStatus === 'Danger') {
              const matchedDev = devices.find(d => d.mac === nodeMac);
              const alertType = nodeFlame ? 'FIRE' : (nodePpm > 1500 ? 'FIRE / DENSE SMOKE' : 'GAS / SMOKE LEAK');

              Promise.resolve(supabase.from('incidents').insert([{
                device_mac: nodeMac,
                status: 'Active',
                ppm_at_trigger: nodePpm,
                alert_type: alertType,
                profile_id: matchedDev?.profile_id || null,
                start_time: new Date().toISOString(),
                notes: `${alertType} (${nodePpm} PPM, Flame: ${nodeFlame}) live detection.`,
              }])).catch(() => {});

              triggerEmergencyAlert({
                id: Date.now(),
                device_mac: nodeMac,
                status: 'Active',
                ppm_at_trigger: nodePpm,
                alert_type: alertType,
                house_name: matchedDev?.house_name || 'Community Household',
                start_time: new Date().toISOString(),
              } as IncidentRecord);
            }
          }

          // 2. Process Secondary Node 2 (N2)
          let n2Ppm = 0;
          let n2Flame = false;
          let n3Ppm = 0;
          let n3Flame = false;

          const n2GasKey = Object.keys(data).find(k => /^N2_Gas$/i.test(k));
          const n2FireKey = Object.keys(data).find(k => /^N2_Fire$/i.test(k));
          if (n2GasKey !== undefined || n2FireKey !== undefined) {
            n2Ppm = Number(data[n2GasKey || ''] ?? 0);
            n2Flame = Number(data[n2FireKey || ''] ?? 0) === 1;
            const n2Status = n2Ppm > 1500 || n2Flame ? 'Danger' : (n2Ppm > 450 ? 'Warning' : 'Normal');
            setSecondaryNodes(prev => ({
              ...prev,
              N2: {
                ...prev.N2,
                ppm: n2Ppm,
                flame: n2Flame,
                status: n2Status,
                last_seen: new Date().toISOString(),
              },
            }));

            if (n2Status === 'Danger') {
              triggerEmergencyAlert({
                id: Date.now(),
                device_mac: '20:50:0D:33:68:0C',
                status: 'Active',
                ppm_at_trigger: n2Ppm,
                alert_type: n2Flame ? 'FIRE' : 'GAS / SMOKE LEAK',
                house_name: 'Household Sector 2 (Living Room)',
                start_time: new Date().toISOString(),
              } as IncidentRecord);
            }
          }

          // 3. Process Secondary Node 3 (N3)
          const n3GasKey = Object.keys(data).find(k => /^N3_Gas$/i.test(k));
          const n3FireKey = Object.keys(data).find(k => /^N3_Fire$/i.test(k));
          if (n3GasKey !== undefined || n3FireKey !== undefined) {
            n3Ppm = Number(data[n3GasKey || ''] ?? 0);
            n3Flame = Number(data[n3FireKey || ''] ?? 0) === 1;
            const n3Status = n3Ppm > 1500 || n3Flame ? 'Danger' : (n3Ppm > 450 ? 'Warning' : 'Normal');
            setSecondaryNodes(prev => ({
              ...prev,
              N3: {
                ...prev.N3,
                ppm: n3Ppm,
                flame: n3Flame,
                status: n3Status,
                last_seen: new Date().toISOString(),
              },
            }));

            if (n3Status === 'Danger') {
              triggerEmergencyAlert({
                id: Date.now(),
                device_mac: '20:50:0D:33:68:0C',
                status: 'Active',
                ppm_at_trigger: n3Ppm,
                alert_type: n3Flame ? 'FIRE' : 'GAS / SMOKE LEAK',
                house_name: 'Household Sector 3 (Bedroom/Ext)',
                start_time: new Date().toISOString(),
              } as IncidentRecord);
            }
          }

          // Live Dynamic 24/7 Command Center Guard Notification update
          updatePersistentAdminGuardNotification(nodePpm ?? 0, nodeFlame, n2Ppm, n2Flame, n3Ppm, n3Flame);
        } catch {}
      });
    } catch (e) {
      console.warn('Direct MQTT connect info:', e);
    }

    const channel = supabase
      .channel('admin_live_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        const row = payload.new as any;
        if (row?.key && row.key.startsWith('telemetry_')) {
          try {
            const parsed = JSON.parse(row.value);
            const mac = parsed.mac?.toUpperCase();
            if (mac) {
              setDevices(prev => prev.map(d => {
                if (d.mac === mac) {
                  return {
                    ...d,
                    current_ppm: Number(parsed.ppm ?? 0),
                    flame: Boolean(parsed.flame),
                    current_status: parsed.status || 'Normal',
                    last_seen: parsed.timestamp || row.updated_at || new Date().toISOString(),
                  };
                }
                return d;
              }));
            }
          } catch {}
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newIncident = payload.new as IncidentRecord;
          setIncidents(prev => [newIncident, ...prev]);
          if (newIncident.status === 'Active') {
            triggerEmergencyAlert(newIncident);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as IncidentRecord;
          setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
          if (updated.status === 'Resolved') {
            silenceSiren();
            setActiveEmergency(null);
          }
        }
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      if (mqttClient) {
        try { mqttClient.end(); } catch {}
      }
      supabase.removeChannel(channel);
      silenceSiren();
    };
  }, [triggerEmergencyAlert, silenceSiren]);

  // Resolve Incident Action (Writes to Supabase)
  const resolveIncident = async (incidentId: number | string, notes: string = 'Resolved and inspected by Admin') => {
    try {
      // Forcefully stop siren and dismiss modal immediately
      await silenceSiren();
      setActiveEmergency(null);

      const now = new Date().toISOString();

      if (isSupabaseConfigured && typeof incidentId === 'number' && incidentId > 0) {
        await supabase
          .from('incidents')
          .update({
            status: 'Resolved',
            end_time: now,
            notes,
            resolved_by: profile?.name || profile?.id || 'Monitoring Admin',
          })
          .eq('id', incidentId);
      }

      setIncidents(prev => prev.map(inc => {
        if (inc.id === incidentId) {
          return { 
            ...inc, 
            status: 'Resolved', 
            end_time: now, 
            notes, 
            resolved_by: profile?.name || 'Admin' 
          };
        }
        return inc;
      }));

      // Reset all spiked device readings
      setDevices(prev => prev.map(d => ({
        ...d,
        current_status: (d.current_ppm ?? 0) > 450 ? 'Warning' : 'Normal',
        flame: false,
      })));
    } catch (e) {
      console.error('Error resolving incident:', e);
    }
  };

  const dispatchEmergencyResponse = (incidentId: number | string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    console.log(`Dispatched response for incident: ${incidentId}`);
  };

  // Telemetry Simulator
  const simulateDeviceTelemetry = async (mac: string, ppm: number, flame: boolean) => {
    const status = getStatusFromPPM(ppm, flame, true);
    const timestamp = new Date().toISOString();
    const targetDevice = devices.find(d => d.mac === mac);

    // 0. Cache in latestTelemetryMapRef so periodic polling preserves the reading
    latestTelemetryMapRef.current[mac] = {
      ppm,
      flame,
      status,
      timestamp: Date.now(),
    };

    // 1. Update local device state
    setDevices(prev => prev.map(d => {
      if (d.mac === mac) {
        return {
          ...d,
          current_ppm: ppm,
          flame,
          current_status: status,
          last_seen: timestamp,
        };
      }
      return d;
    }));

    // 2. Insert into Supabase gas_logs and app_settings
    if (isSupabaseConfigured) {
      try {
        await Promise.all([
          supabase.from('gas_logs').insert([{
            device_mac: mac,
            ppm_level: ppm,
            status: status === 'Offline' ? 'Normal' : status,
            profile_id: targetDevice?.profile_id || null,
            created_at: timestamp,
          }]),
          supabase.from('devices').upsert({
            mac,
            current_ppm: ppm,
            flame,
            last_seen: timestamp,
          }, { onConflict: 'mac' }),
          supabase.from('app_settings').upsert({
            key: `telemetry_${mac.replace(/:/g, '')}`,
            value: JSON.stringify({ mac, ppm, flame, status, timestamp }),
            updated_at: timestamp,
          }, { onConflict: 'key' }),
        ]);
      } catch {
        // ignore
      }
    }

    // 3. Create active incident if Danger
    if (status === 'Danger') {
      const alertType = flame ? 'FIRE' : 'GAS / SMOKE LEAK';
      let incidentId = Date.now();

      if (isSupabaseConfigured) {
        try {
          const { data: inserted } = await supabase.from('incidents').insert([{
            device_mac: mac,
            status: 'Active',
            ppm_at_trigger: ppm,
            alert_type: alertType,
            profile_id: targetDevice?.profile_id || null,
            start_time: timestamp,
            notes: 'Emergency trigger generated from Simulator',
          }]).select('id').maybeSingle();

          if (inserted?.id) {
            incidentId = inserted.id;
          }
        } catch {
          // ignore
        }
      }

      const simulatedIncident: IncidentRecord = {
        id: incidentId,
        device_mac: mac,
        status: 'Active',
        ppm_at_trigger: ppm,
        alert_type: alertType,
        profile_id: targetDevice?.profile_id,
        notes: `Simulated ${alertType} alarm test.`,
        start_time: timestamp,
        house_name: targetDevice?.house_name || 'Household Node',
      };

      setIncidents(prev => [simulatedIncident, ...prev]);
      triggerEmergencyAlert(simulatedIncident);
    }
  };

  const resetAllToSafeSimulation = async () => {
    silenceSiren();
    setActiveEmergency(null);

    const now = new Date().toISOString();

    Object.keys(latestTelemetryMapRef.current).forEach(mac => {
      latestTelemetryMapRef.current[mac] = {
        ppm: 125,
        flame: false,
        status: 'Normal',
        timestamp: Date.now(),
      };
    });

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('incidents')
          .update({ status: 'Resolved', end_time: now, notes: 'Cleared via Admin Simulator' })
          .eq('status', 'Active');
      } catch {
        // ignore
      }
    }

    setDevices(prev => prev.map(d => ({
      ...d,
      current_ppm: 125,
      current_status: 'Normal',
      flame: false,
      last_seen: now,
    })));

    setIncidents(prev => prev.map(i => i.status === 'Active' ? {
      ...i,
      status: 'Resolved',
      end_time: now,
      notes: 'Cleared via Admin Reset',
    } : i));
  };

  // Device Label & Household Profile Assignment (Admin Only)
  const updateDeviceConfig = async (
    mac: string, 
    label: string, 
    profileId: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (role !== 'admin') {
      return { 
        success: false, 
        error: 'Permission Denied: Only users with the Admin role can rename device labels and assign households.' 
      };
    }

    try {
      const targetMac = mac.toUpperCase();
      const targetProfile = profileId ? profiles.find(p => p.id === profileId) : undefined;
      
      const newLabel = label.trim() || (targetMac === '20:50:0D:33:68:0C' ? 'Main Core MQ-2 & Optical Flame' : `Sensor Node (${targetMac.slice(-5)})`);
      
      // Automatically set Household Name based on assigned resident profile
      let newHouseName = '';
      if (targetProfile?.name) {
        const pName = targetProfile.name.trim();
        newHouseName = pName.toLowerCase().includes('household') ? pName : `${pName} Household`;
      } else {
        newHouseName = targetMac === '20:50:0D:33:68:0C' ? 'Community Core Node 1' : `Sensor Node (${targetMac.slice(-5)})`;
      }
      
      // Auto-assign location from resident profile
      const newBlockLot = targetProfile?.block_lot || 'Block 1 Lot 1';
      const newLat = targetProfile?.latitude || 14.1777;
      const newLng = targetProfile?.longitude || 121.2551;
      const now = new Date().toISOString();

      // 1. Immediately update in-memory devices state
      setDevices(prev => prev.map(d => {
        if (d.mac === targetMac) {
          return {
            ...d,
            label: newLabel,
            profile_id: profileId || undefined,
            house_name: newHouseName,
            block_lot: newBlockLot,
            latitude: newLat,
            longitude: newLng,
            resident_name: targetProfile?.name || 'Unassigned (Community Sensor)',
            resident_phone: targetProfile?.emergency_hotline || 'N/A',
          };
        }
        return d;
      }));

      // 2. Persist to Supabase Database & Realtime App Settings
      if (isSupabaseConfigured) {
        const dbOperations: any[] = [
          supabase.from('devices').upsert({
            mac: targetMac,
            label: newLabel,
            profile_id: profileId || null,
            house_name: newHouseName,
            block_lot: newBlockLot,
            latitude: newLat,
            longitude: newLng,
            last_seen: now,
          }, { onConflict: 'mac' }),

          supabase.from('app_settings').upsert({
            key: `device_config_${targetMac.replace(/:/g, '')}`,
            value: JSON.stringify({
              mac: targetMac,
              label: newLabel,
              profileId: profileId || null,
              houseName: newHouseName,
              blockLot: newBlockLot,
              lat: newLat,
              lng: newLng,
            }),
            updated_at: now,
          }, { onConflict: 'key' }),
        ];

        // If unassigning, clear device_mac from any profile previously mapped to this MAC
        if (!profileId) {
          dbOperations.push(
            supabase.from('profiles').update({ device_mac: null, updated_at: now }).eq('device_mac', targetMac)
          );
        } else {
          // Clear any previous profile with this MAC, then assign to target profile
          dbOperations.push(
            supabase.from('profiles').update({ device_mac: null, updated_at: now }).eq('device_mac', targetMac),
            supabase.from('profiles').update({ device_mac: targetMac, updated_at: now }).eq('id', profileId)
          );
        }

        await Promise.all(dbOperations);
      }

      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating device config:', err);
      return { success: false, error: err?.message || 'Failed to update device configuration' };
    }
  };

  // Force Unassign Device (Admin Only)
  const unassignDevice = async (
    mac: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (role !== 'admin') {
      return { 
        success: false, 
        error: 'Permission Denied: Only Administrators can unassign devices.' 
      };
    }

    try {
      const targetMac = mac.toUpperCase();
      const defaultHouseName = targetMac === '20:50:0D:33:68:0C' ? 'Community Core Node 1' : `Sensor Node (${targetMac.slice(-5)})`;
      const defaultLabel = targetMac === '20:50:0D:33:68:0C' ? 'Main Core MQ-2 & Optical Flame' : `Satellite Sensor Node (${targetMac.slice(-5)})`;
      const now = new Date().toISOString();

      // 1. Immediately update in-memory devices state
      setDevices(prev => prev.map(d => {
        if (d.mac === targetMac) {
          return {
            ...d,
            label: defaultLabel,
            profile_id: undefined,
            house_name: defaultHouseName,
            resident_name: 'Unassigned (Community Sensor)',
            resident_phone: 'N/A',
          };
        }
        return d;
      }));

      // 2. Persist unassign across Supabase tables
      if (isSupabaseConfigured) {
        await Promise.all([
          // Clear profile_id in devices
          supabase.from('devices').upsert({
            mac: targetMac,
            label: defaultLabel,
            profile_id: null,
            house_name: defaultHouseName,
            block_lot: 'Block 1 Lot 1',
            last_seen: now,
          }, { onConflict: 'mac' }),

          // Clear device_mac on any linked user profile
          supabase.from('profiles').update({
            device_mac: null,
            updated_at: now,
          }).eq('device_mac', targetMac),

          // Explicitly save profileId: null in app_settings
          supabase.from('app_settings').upsert({
            key: `device_config_${targetMac.replace(/:/g, '')}`,
            value: JSON.stringify({
              mac: targetMac,
              label: defaultLabel,
              profileId: null,
              houseName: defaultHouseName,
              blockLot: 'Block 1 Lot 1',
              lat: 14.1777,
              lng: 121.2551,
            }),
            updated_at: now,
          }, { onConflict: 'key' }),
        ]);
      }

      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Error unassigning device:', err);
      return { success: false, error: err?.message || 'Failed to unassign device' };
    }
  };

  // Update User Role (Admin Only: assign admin, hoa, guard, or resident)
  const updateUserRole = async (
    userId: string, 
    newRole: any
  ): Promise<{ success: boolean; error?: string }> => {
    if (role !== 'admin') {
      return { 
        success: false, 
        error: 'Permission Denied: Only Administrators can modify user roles.' 
      };
    }

    try {
      const isAdminRole = newRole === 'admin';
      const now = new Date().toISOString();

      // 1. Immediately update in-memory profiles state
      setProfiles(prev => prev.map(p => {
        if (p.id === userId) {
          return {
            ...p,
            role: newRole,
            is_admin: isAdminRole,
            updated_at: now,
          };
        }
        return p;
      }));

      // 2. Persist role update in Supabase
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('profiles')
          .update({
            role: newRole,
            is_admin: isAdminRole,
            updated_at: now,
          })
          .eq('id', userId);

        if (error) {
          console.error('Error updating user role in Supabase:', error);
          return { success: false, error: error.message };
        }
      }

      await refreshData();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating user role:', err);
      return { success: false, error: err?.message || 'Failed to update user role' };
    }
  };

  // Emergency Hotlines Manager (Create, Edit, Delete, Restore Defaults)
  const saveHotline = async (hotline: EmergencyHotline) => {
    let updated: EmergencyHotline[];
    const existingIdx = hotlines.findIndex(h => h.id === hotline.id);
    if (existingIdx >= 0) {
      updated = [...hotlines];
      updated[existingIdx] = { ...hotline };
    } else {
      const newId = hotline.id || String(Date.now());
      updated = [...hotlines, { ...hotline, id: newId }];
    }

    setHotlines(updated);
    const json = JSON.stringify(updated);
    await AsyncStorage.setItem('hfire_emergency_hotlines', json).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('app_settings').upsert({
          key: 'emergency_hotlines',
          value: json,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      } catch (err) {
        console.warn('Failed to save emergency hotlines to Supabase:', err);
      }
    }
  };

  const deleteHotline = async (id: string) => {
    const updated = hotlines.filter(h => h.id !== id);
    setHotlines(updated);
    const json = JSON.stringify(updated);
    await AsyncStorage.setItem('hfire_emergency_hotlines', json).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('app_settings').upsert({
          key: 'emergency_hotlines',
          value: json,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      } catch (err) {
        console.warn('Failed to delete hotline from Supabase:', err);
      }
    }
  };

  const resetHotlinesToDefault = async () => {
    setHotlines(DEFAULT_EMERGENCY_HOTLINES);
    const json = JSON.stringify(DEFAULT_EMERGENCY_HOTLINES);
    await AsyncStorage.setItem('hfire_emergency_hotlines', json).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('app_settings').upsert({
          key: 'emergency_hotlines',
          value: json,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      } catch (err) {
        console.warn('Failed to reset hotlines in Supabase:', err);
      }
    }
  };

  return (
    <AdminContext.Provider
      value={{
        devices,
        incidents,
        gasLogs,
        profiles,
        hotlines,
        secondaryNodes,
        communityStatus,
        activeEmergency,
        isSirenPlaying,
        isSimulatorVisible,
        bridgeHeartbeat,
        refreshData,
        resolveIncident,
        dispatchEmergencyResponse,
        silenceSiren,
        triggerEmergencyAlert,
        setSimulatorVisible,
        simulateDeviceTelemetry,
        resetAllToSafeSimulation,
        updateDeviceConfig,
        unassignDevice,
        updateUserRole,
        saveHotline,
        deleteHotline,
        resetHotlinesToDefault,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
