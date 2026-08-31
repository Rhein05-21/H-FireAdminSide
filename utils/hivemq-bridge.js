const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const http = require('http');

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file.');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

const HIVEMQ_URL = process.env.EXPO_PUBLIC_HIVEMQ_BROKER 
  ? `wss://${process.env.EXPO_PUBLIC_HIVEMQ_BROKER}:${process.env.EXPO_PUBLIC_HIVEMQ_PORT || 8884}/mqtt`
  : null;

const TOPIC_CONFIG = process.env.EXPO_PUBLIC_HIVEMQ_TOPIC || '#';

console.log('🚀 Starting H-Fire Admin IoT Bridge...');
console.log('📡 Subscribing to Broker:', process.env.EXPO_PUBLIC_HIVEMQ_BROKER);
console.log('🎯 Topic Subscription: ALL TOPICS (#)');

// 1. Heartbeat updater to app_settings
if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
  setInterval(async () => {
    try {
      await supabase.from('app_settings').upsert({ 
        key: 'bridge_heartbeat', 
        value: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });
    } catch (e) {
      console.warn('Heartbeat update warning:', e.message);
    }
  }, 30000);
}

// 2. Broadcast Push Notifications to Admins and Guards
async function sendPushNotification(houseName, alertType, ppm) {
  try {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('push_token')
      .or('role.eq.admin,role.eq.hoa,role.eq.guard,is_admin.eq.true');

    const { data: userTokens } = await supabase
      .from('user_push_tokens')
      .select('token');

    const tokens = new Set();

    (adminProfiles || []).forEach(p => {
      if (p.push_token) tokens.add(p.push_token);
    });

    (userTokens || []).forEach(t => {
      if (t.token) tokens.add(t.token);
    });

    if (tokens.size === 0) {
      console.log('ℹ️ No active push tokens found to broadcast.');
      return;
    }

    const messages = Array.from(tokens).map(token => ({
      to: token,
      sound: 'default',
      title: `🚨 EMERGENCY: ${alertType} DETECTED`,
      body: `${houseName}: Critical hazard detected (${ppm} PPM)! Immediate response required.`,
      data: { houseName, alertType, ppm, type: 'emergency' },
      priority: 'high',
      channelId: 'emergency-alerts',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    console.log(`📡 Broadcasted emergency push notification to ${messages.length} device(s).`);
  } catch (err) {
    console.error('Push Notification Error:', err.message);
  }
}

// 3. HiveMQ MQTT Client Connection
if (HIVEMQ_URL) {
  const client = mqtt.connect(HIVEMQ_URL, {
    username: process.env.EXPO_PUBLIC_HIVEMQ_USERNAME,
    password: process.env.EXPO_PUBLIC_HIVEMQ_PASSWORD,
    clientId: `hfire_bridge_${Math.random().toString(16).slice(2, 10)}`,
  });

  client.on('connect', () => {
    console.log('✅ Admin Bridge successfully connected to HiveMQ Cloud!');
    client.subscribe(['#'], (err) => {
      if (!err) console.log('📡 Subscribed to ALL MQTT topics (#) across the broker!');
    });
  });

  async function processTelemetryItem(data, topic, timestamp) {
    if (!data || typeof data !== 'object') return;

    // 1. Check all possible MAC address field variations
    let mac = data.mac || 
              data.device_mac || 
              data.core_mac || 
              data.coreMac || 
              data.core || 
              data.node_mac || 
              data.nodeMac || 
              data.deviceId || 
              data.sensorId || 
              data.sender || 
              data.addr || 
              data.id;
    
    // 2. If not in payload, check if topic contains a MAC address pattern (XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX)
    if (!mac && topic) {
      const topicMacMatch = topic.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
      if (topicMacMatch) {
        mac = topicMacMatch[0];
      }
    }

    // 3. Fallback to your primary Core Node MAC
    if (!mac) {
      mac = '20:50:0D:33:68:0C';
    }

    mac = mac.toUpperCase().replace(/-/g, ':');
    const ppm = Number(data.ppm ?? data.ppm_level ?? data.gas ?? data.smoke ?? data.reading ?? 0);
    const flame = data.flame === true || data.flame === 1 || data.flameDetected === true || data.fire === true;

    // Find linked profile and house info
    const { data: dev } = await supabase
      .from('devices')
      .select('profile_id, house_name, label')
      .eq('mac', mac)
      .maybeSingle();

    let profileId = dev?.profile_id || null;
    let houseName = dev?.house_name;

    // If device is not yet registered in Supabase, find primary profile (e.g. Rhein B Tigle) to link it
    if (!dev) {
      const { data: defaultProfile } = await supabase.from('profiles').select('id, name').limit(1).maybeSingle();
      profileId = defaultProfile?.id || null;
      houseName = defaultProfile?.name ? `${defaultProfile.name} (Core Node)` : `Core Node (${mac.slice(-5)})`;
    }

    // Update devices table last_seen
    const { error: devErr } = await supabase.from('devices').upsert({
      mac,
      last_seen: timestamp,
      label: dev?.label || data.label || 'ESP32 Gas & Flame Sensor',
      house_name: dev?.house_name || data.house_name || houseName || 'Community Household',
      profile_id: profileId,
    }, { onConflict: 'mac' });
    if (devErr) console.error('❌ Supabase devices upsert error:', devErr.message);

    // Determine Status
    let status = 'Normal';
    let alertType = 'NONE';
    if (ppm > 1500 || flame) {
      status = 'Danger';
      alertType = flame ? 'FIRE' : 'FIRE / DENSE SMOKE';
    } else if (ppm > 450) {
      status = 'Warning';
      alertType = 'GAS / SMOKE LEAK';
    }

    // 1. Insert into gas_logs table ONLY IF Warning or Danger (Never spam normal ambient readings)
    if (status === 'Warning' || status === 'Danger') {
      const { error: logErr } = await supabase.from('gas_logs').insert([{
        device_mac: mac,
        ppm_level: ppm,
        status,
        profile_id: profileId,
        created_at: timestamp,
      }]);
      if (logErr) console.error('❌ Supabase gas_logs insert error:', logErr.message);
    }

    // Upsert live telemetry state to app_settings for 100% unrestricted live frontend feed
    await supabase.from('app_settings').upsert({
      key: `telemetry_${mac}`,
      value: JSON.stringify({ mac, ppm, flame, status, timestamp }),
      updated_at: timestamp,
    }, { onConflict: 'key' });

    // Handle Hazard Incidents (Gas Leak & Fire Alarms with Node Labeling)
    if (status === 'Danger' || status === 'Warning') {
      const nodeLabel = data.label || (mac === '20:50:0D:33:68:0C' ? 'Core Node 1 (Main Sensor Unit)' : `Secondary Node (${mac})`);
      const { data: existingIncident } = await supabase
        .from('incidents')
        .select('id')
        .eq('device_mac', mac)
        .eq('status', 'Active')
        .maybeSingle();

      if (existingIncident) {
        await supabase.from('incidents').update({
          ppm_at_trigger: ppm,
          alert_type: alertType,
          start_time: timestamp,
          notes: `[${nodeLabel}] ${alertType} detected at ${ppm} PPM (Flame: ${flame ? 'YES' : 'NO'}).`,
        }).eq('id', existingIncident.id);
      } else {
        await supabase.from('incidents').insert([{
          device_mac: mac,
          status: 'Active',
          ppm_at_trigger: ppm,
          alert_type: alertType,
          profile_id: profileId,
          start_time: timestamp,
          notes: `[${nodeLabel}] ${alertType} detected at ${ppm} PPM (Flame: ${flame ? 'YES' : 'NO'}).`,
        }]);
      }
      }

      if (status === 'Danger') {
        await sendPushNotification(houseName, alertType, ppm);
      }
    }
  }

  client.on('message', async (topic, payload) => {
    const rawPayload = payload.toString().trim();
    const timestamp = new Date().toISOString();

    // Check if payload is plain text status (e.g., "Core System Online", "Ping")
    if (!rawPayload.startsWith('{') && !rawPayload.startsWith('[')) {
      console.log(`ℹ️ [System Event] [${topic}]: "${rawPayload}"`);

      // Update primary core device
      await supabase.from('devices').upsert({
        mac: '20:50:0D:33:68:0C',
        last_seen: timestamp,
        label: 'ESP32 Main Core Node',
        house_name: 'Main Household',
      }, { onConflict: 'mac' });
      return;
    }

    console.log(`📩 [MQTT Packet] [${topic}]: ${rawPayload}`);

    try {
      const data = JSON.parse(rawPayload);

      // Handle Core Multi-Node Bundle Format: {"N1_Gas":571, "N1_Fire":0, "N2_Gas":0, "N2_Fire":0, "N3_Gas":0, "N3_Fire":0}
      const hasNKeys = Object.keys(data).some(k => /^N\d+_Gas$/i.test(k));
      if (hasNKeys) {
        for (let i = 1; i <= 20; i++) {
          const gasKey = Object.keys(data).find(k => k.toLowerCase() === `n${i}_gas`);
          const fireKey = Object.keys(data).find(k => k.toLowerCase() === `n${i}_fire`);
          if (gasKey && data[gasKey] !== undefined) {
            const nodeMac = i === 1 
              ? '20:50:0D:33:68:0C' 
              : `20:50:0D:33:68:0${i}`;
            
            const nodePpm = Number(data[gasKey] ?? 0);
            const nodeFlame = Number(data[fireKey] ?? 0) === 1;
            const nodeLabel = i === 1 ? 'Main Core MQ-2 & Optical Flame' : `Sector Node ${i} Gas & Flame`;
            const nodeHouseName = i === 1 ? 'Main Household (Core Node 1)' : `Household Sector ${i} (Node ${i})`;

            await processTelemetryItem({
              mac: nodeMac,
              ppm: nodePpm,
              flame: nodeFlame,
              label: nodeLabel,
              house_name: nodeHouseName,
            }, topic, timestamp);
          }
        }
        return;
      }

      // Handle Array of nodes [ { mac: '...', ppm: 0 }, ... ]
      if (Array.isArray(data)) {
        for (const item of data) {
          await processTelemetryItem(item, topic, timestamp);
        }
        return;
      }

      // Handle Envelope with child nodes/sensors { core: '...', nodes: [...] }
      const childList = data.nodes || data.devices || data.sensors || data.readings || data.data;
      if (Array.isArray(childList)) {
        for (const item of childList) {
          await processTelemetryItem(item, topic, timestamp);
        }
        return;
      }

      // Handle Single Node Object
      await processTelemetryItem(data, topic, timestamp);
    } catch (e) {
      console.warn('⚠️ Payload parsing note:', e.message);
    }
  });

  client.on('error', (err) => {
    console.error('HiveMQ Error:', err.message);
  });
} else {
  console.log('ℹ️ HiveMQ credentials not found in .env.');
}

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'admin-bridge-active', 
    timestamp: new Date().toISOString(),
    supabaseConnected: Boolean(supabaseUrl),
    mqttConnected: Boolean(HIVEMQ_URL)
  }));
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`ℹ️ Port ${PORT} already bound; MQTT telemetry bridge is running.`);
  } else {
    console.error('HTTP Server error:', e.message);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Healthcheck listening on port ${PORT}`);
});
