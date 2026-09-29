# 📡 H-Fire IoT Sensor Mesh — Firmware System v2.0

This directory contains the completely re-engineered, production-ready C++ Arduino firmware for all 3 ESP32 nodes in the **H-Fire Community Fire & Hazardous Gas Monitoring System**.

---

## 🏗️ System Architecture & Workflow

```mermaid
flowchart TD
    subgraph Satellites["Autonomous Satellite Nodes"]
        N2["Node 2 (Living Room)<br/>• MQ-2 (GPIO 34) • Flame (GPIO 32)<br/>• Buzzer (GPIO 25) • OLED (0x3C)<br/>• ESP-NOW Sender (ID: 2)"]
        N3["Node 3 (Bedroom / Ext)<br/>• MQ-2 (GPIO 34) • Flame (GPIO 32)<br/>• Buzzer (GPIO 25) • OLED (0x3C)<br/>• ESP-NOW Sender (ID: 3)"]
    end

    subgraph Gateway["Core Gateway Node"]
        N1["Node 1 (Core Gateway - Kitchen)<br/>• MQ-2 (GPIO 34) • Flame (GPIO 32)<br/>• Buzzer (GPIO 25) • OLED (0x3C)<br/>• ESP-NOW Receiver<br/>• 4-Second Stale Watchdog<br/>• WiFiManager Captive Portal<br/>• HiveMQ TLS :8883 MQTT Client"]
    end

    subgraph CloudApp["Cloud & Mobile App"]
        Broker[("HiveMQ Cloud Broker<br/>Topic: hfire/house1/data")]
        App["H-Fire Admin Mobile App & Bridge<br/>• Realtime 3-Sector HUD<br/>• Auto-Dismiss Siren<br/>• Offline Detection"]
    end

    N2 -->|ESP-NOW (Auto-Channel Lock)| N1
    N3 -->|ESP-NOW (Auto-Channel Lock)| N1
    N1 -->|Secure MQTT TLS JSON| Broker
    Broker -->|WSS Stream| App
```

---

## 🚀 Key Improvements & Problem Solvings in v2.0

| Problem in Old Firmware | How Firmware v2.0 Solves It |
| :--- | :--- |
| **Stale Data Stuck on App**: When Node 2 or 3 died, the last warning/danger reading stayed stuck on the app forever. | **Integrated 4-Second Stale Watchdog**: Core Node 1 monitors `last_seen` timestamps. If no packet is received for > 4.0s, it automatically resets `N2_Gas = 0`, `N2_Fire = 0`, and sends `N2_Online = 0` to immediately mark the sector `[Offline]` and silence alarms. |
| **Erratic Channel Hopping**: Satellites hopped Wi-Fi channels on every missed packet, spending 90% of time on the wrong channel. | **Smart Auto-Channel Lock**: Satellites only hop after 5 consecutive failed packets. Once an acknowledgment is received from Core Node 1, the channel is locked. |
| **Mismatched Safety Thresholds**: Old code used 1000/2000 PPM, while the mobile app and bridge use 450/1500 PPM. | **Unified Threshold Standards**: All nodes use Safe $\le 450$ PPM, Warning $451 - 1500$ PPM, and Danger $> 1500$ PPM or Flame detected. |
| **Noisy ADC Sensor Jumps**: Floating analog readings caused false alarms. | **10-Sample Moving Average**: Smooths analog ADC noise on GPIO 34. |
| **Blocking Network Reconnection**: Wi-Fi/MQTT drops stalled local sensing and buzzer alarms. | **Zero-Delay Asynchronous Loops**: Local sensor reading, buzzer siren, and OLED HUD run via `millis()`. Sensing and local alarms never freeze even if Wi-Fi disconnects. |
| **Local Autonomy**: Satellites were dumb transmitters. | **Autonomous Sector Protection**: Satellites sound their local buzzer and show warning/danger alerts on their OLED screen even if Core Gateway is offline. |

---

## 📂 Firmware File Structure

```text
esp32/firmware_v2/
├── Main_Core_Node_N1/
│   └── Main_Core_Node_N1.ino      <-- Flash to Master ESP32 (Kitchen / Gateway)
├── Secondary_Node_N2/
│   └── Secondary_Node_N2.ino      <-- Flash to Satellite 2 (Living Room)
└── Secondary_Node_N3/
    └── Secondary_Node_N3.ino      <-- Flash to Satellite 3 (Bedroom / Sector 3)
```

---

## 🔌 Hardware Pinout (Identical on All 3 Nodes)

| Component | Pin on ESP32 | Notes |
| :--- | :--- | :--- |
| **MQ-2 Gas/Smoke (AO)** | `GPIO 34` | ADC1 Channel 6 (Analog Input, 0 - 4095) |
| **Optical Flame Sensor (DO)** | `GPIO 32` | Digital Input (Pulled HIGH on flame) |
| **Active Buzzer / Piezo** | `GPIO 25` | Digital Output (High = Siren Active) |
| **OLED SDA** | `GPIO 21` | I2C Data (Address `0x3C`) |
| **OLED SCL** | `GPIO 22` | I2C Clock |
| **OLED VCC / GND** | `3.3V / GND` | Power Supply |
| **BOOT Button** | `GPIO 0` | Hold 3 seconds on Node 1 to reset Wi-Fi |

---

## 📦 Required Arduino IDE Libraries

Install these libraries from the **Arduino IDE Library Manager** (`Ctrl + Shift + I`):

1. **PubSubClient** (by Nick O'Leary)
2. **WiFiManager** (by tzapu)
3. **Adafruit SSD1306** (by Adafruit)
4. **Adafruit GFX Library** (by Adafruit)

---

## ⚡ Step-by-Step Flashing Instructions

### 1. Flash Core Node 1 (`Main_Core_Node_N1.ino`)
1. Connect Core ESP32 via USB.
2. Select Board: **ESP32 Dev Module**.
3. Upload `Main_Core_Node_N1.ino`.
4. Open Serial Monitor at **115200 baud**.
5. **On Boot**: The OLED screen and Serial Monitor will immediately display the **Core MAC Address** for 4 seconds so you can easily record it or connect it in the mobile app.
6. If Wi-Fi is not yet configured, the OLED will show:
   * **MAC Address** of your Core Node
   * Connect your phone to Wi-Fi AP: **`H-Fire-Setup`**
   * Open browser to **`192.168.4.1`** and enter your home/office Wi-Fi details.
7. Core Node will connect to Wi-Fi and HiveMQ Cloud, and begin listening for N2/N3.

### 2. Flash Satellite Node 2 (`Secondary_Node_N2.ino`)
1. Connect Node 2 ESP32 via USB.
2. Upload `Secondary_Node_N2.ino`.
3. It will boot, show `Sector 2 (Living Room)`, automatically synchronize channel with Core Node 1, and transmit telemetry every 500ms.

### 3. Flash Satellite Node 3 (`Secondary_Node_N3.ino`)
1. Connect Node 3 ESP32 via USB.
2. Upload `Secondary_Node_N3.ino`.
3. It will boot, show `Sector 3 (Bedroom)`, automatically synchronize channel with Core Node 1, and transmit telemetry every 500ms.

---

## 📊 Live MQTT Telemetry Output Schema

Core Node 1 transmits the following unified JSON bundle to HiveMQ topic **`hfire/house1/data`**:

```json
{
  "mac": "20:50:0D:33:68:0C",
  "N1_Gas": 135,
  "N1_Fire": 0,
  "N2_Gas": 110,
  "N2_Fire": 0,
  "N2_Online": 1,
  "N3_Gas": 0,
  "N3_Fire": 0,
  "N3_Online": 0,
  "status": "Normal"
}
```

* When Node 2 or 3 goes offline, `N_Online` becomes `0`, and `N_Gas` / `N_Fire` reset to `0`, ensuring the mobile app immediately cancels sirens and alerts.
