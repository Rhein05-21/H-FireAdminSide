/**
 * ============================================================================
 * 🔥 H-FIRE IOT SYSTEM — SATELLITE SECTOR NODE 2 (LIVING ROOM)
 * ============================================================================
 * Architecture: Autonomous Satellite Mesh Sensor
 * Board: ESP32 Dev Module (WROOM-32)
 *
 * Core Responsibilities:
 *  1. Reads local MQ-2 Gas/Smoke (GPIO 34) and Optical Flame Sensor (GPIO 32)
 *     with 10-sample ADC noise filtering.
 *  2. Local Autonomous Alarm: Instantly sounds local buzzer (GPIO 25) if gas 
 *     or fire is detected, even if Core Gateway is offline or unreachable.
 *  3. SSD1306 OLED Screen: Real-time sector status, gas level, and mesh link.
 *  4. High-Reliability ESP-NOW Transmission: Sends telemetry packet to Core 
 *     Gateway (MAC: 20:50:0D:33:68:0C) every 500ms.
 *  5. Smart Auto-Channel Lock: Automatically detects Core Node's Wi-Fi channel
 *     by testing channels 1-13 on boot and locks once Core acknowledges.
 * ============================================================================
 */

#include <esp_now.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_wifi.h>

// ============================================================================
// 1. HARDWARE PIN DEFINITIONS & OLED CONFIGURATION
// ============================================================================
#define SCREEN_WIDTH      128
#define SCREEN_HEIGHT     64
#define OLED_RESET        -1
#define OLED_I2C_ADDRESS  0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

const int PIN_MQ2_GAS = 34;   // Analog ADC1_CH6 (MQ-2 Analog Out)
const int PIN_FLAME   = 32;   // Digital In (Optical Flame Sensor)
const int PIN_BUZZER  = 25;   // Digital Out (Piezo / Active Buzzer)

// ============================================================================
// 2. SYSTEM-WIDE TELEMETRY THRESHOLDS (Aligned with H-Fire Admin App)
// ============================================================================
const int THRESHOLD_SAFE_PPM   = 450;    // Normal ambient baseline
const int THRESHOLD_DANGER_PPM = 1500;   // Critical hazard threshold

// ============================================================================
// 3. TARGET CORE GATEWAY MAC ADDRESS (NODE 1)
// ============================================================================
uint8_t coreGatewayAddress[] = {0x20, 0x50, 0x0D, 0x33, 0x68, 0x0C};

// ============================================================================
// 4. ESP-NOW PACKET DEFINITION
// ============================================================================
typedef struct __attribute__((packed)) {
  uint8_t  node_id;        // Always 2 for this node
  uint16_t gas_level;      // Smoothed PPM reading
  bool     flame_status;   // true = Flame detected
  uint32_t uptime_seconds; // Node uptime (heartbeat)
} SensorPacket;

SensorPacket myPacket;
esp_now_peer_info_t peerInfo;

// Network & Timer Controllers
unsigned long lastSensorReadMillis = 0;
unsigned long lastBeepToggleMillis = 0;
bool buzzerBeepState = false;

// Channel Auto-Discovery & Lock
int  currentWiFiChannel = 1;
bool isMeshLinked = false;
int  consecutiveFailures = 0;
const int MAX_FAILURES_BEFORE_HOP = 5;

// ============================================================================
// 5. ESP-NOW SEND CALLBACK (Smart Channel Auto-Lock)
// ============================================================================
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  if (status == ESP_NOW_SEND_SUCCESS) {
    isMeshLinked = true;
    consecutiveFailures = 0;
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_HOP) {
      isMeshLinked = false;
      // Hop to next Wi-Fi channel (1 to 13) to locate Core Gateway's router channel
      currentWiFiChannel = (currentWiFiChannel % 13) + 1;
      
      esp_wifi_set_promiscuous(true);
      esp_wifi_set_channel(currentWiFiChannel, WIFI_SECOND_CHAN_NONE);
      esp_wifi_set_promiscuous(false);

      peerInfo.channel = currentWiFiChannel;
      esp_now_mod_peer(&peerInfo);

      consecutiveFailures = 0;
    }
  }
}

// ============================================================================
// 6. MULTI-SAMPLE SENSOR READING
// ============================================================================
int readSmoothedMQ2() {
  long sum = 0;
  const int SAMPLES = 10;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(PIN_MQ2_GAS);
    delayMicroseconds(200);
  }
  return (int)(sum / SAMPLES);
}

bool readFlameSensor() {
  return (digitalRead(PIN_FLAME) == HIGH);
}

// ============================================================================
// 7. BUZZER CONTROLLER (Local Autonomous Alarm)
// ============================================================================
void manageLocalBuzzer(bool isWarning, bool isDanger) {
  unsigned long now = millis();

  if (isDanger) {
    // Continuous High Alarm on Danger
    digitalWrite(PIN_BUZZER, HIGH);
  } else if (isWarning) {
    // Pulsed Beeps on Warning (500ms ON, 500ms OFF)
    if (now - lastBeepToggleMillis >= 500) {
      lastBeepToggleMillis = now;
      buzzerBeepState = !buzzerBeepState;
      digitalWrite(PIN_BUZZER, buzzerBeepState ? HIGH : LOW);
    }
  } else {
    digitalWrite(PIN_BUZZER, LOW);
    buzzerBeepState = false;
  }
}

// ============================================================================
// 8. OLED DISPLAY RENDERER
// ============================================================================
void updateOledHUD(const char* statusText, bool isWarning, bool isDanger) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Header: Sector Name + Wi-Fi Channel
  display.setCursor(0, 0);
  display.print(F("SECTOR 2 (LIVING RM)"));
  display.setCursor(102, 0);
  display.print(F("C:"));
  display.print(currentWiFiChannel);

  display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

  // Telemetry Rows
  display.setCursor(0, 14);
  display.print(F("Gas / Smoke: "));
  display.print(myPacket.gas_level);
  display.print(F(" PPM"));

  display.setCursor(0, 26);
  display.print(F("Flame State: "));
  if (myPacket.flame_status) {
    display.print(F("[!DETECTED!]"));
  } else {
    display.print(F("Clear"));
  }

  display.setCursor(0, 38);
  display.print(F("Mesh Gateway: "));
  if (isMeshLinked) {
    display.print(F("LINKED (OK)"));
  } else {
    display.print(F("SEARCHING..."));
  }

  // Footer Banner
  display.drawLine(0, 49, 128, 49, SSD1306_WHITE);
  display.setCursor(10, 53);
  display.setTextSize(1);
  if (isDanger) {
    display.print(F(">> DANGER DETECTED <<"));
  } else if (isWarning) {
    display.print(F(">> WARNING: LEAK <<"));
  } else {
    display.print(F("Status: SECTOR SAFE"));
  }

  display.display();
}

// ============================================================================
// 9. MAIN SETUP ROUTINE
// ============================================================================
void setup() {
  Serial.begin(115200);

  pinMode(PIN_FLAME, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // Initialize OLED
  Wire.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
    Serial.println(F("SSD1306 Init Failed!"));
    for (;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(15, 20);
  display.println(F("H-FIRE NODE 2"));
  display.setCursor(10, 35);
  display.println(F("Sector: Living Room"));
  display.display();
  delay(1500);

  // Wi-Fi Station Mode for ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Set initial channel
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(currentWiFiChannel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  // Initialize ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println(F("Error initializing ESP-NOW"));
    return;
  }

  esp_now_register_send_cb((esp_now_send_cb_t)OnDataSent);

  // Register Core Gateway as Peer
  memcpy(peerInfo.peer_addr, coreGatewayAddress, 6);
  peerInfo.channel = currentWiFiChannel;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println(F("Failed to add peer"));
    return;
  }

  myPacket.node_id = 2; // Node ID 2
}

// ============================================================================
// 10. MAIN LOOP (Zero Blocking Delays)
// ============================================================================
void loop() {
  unsigned long now = millis();

  // Read Sensors & Transmit every 500ms
  if (now - lastSensorReadMillis >= 500) {
    lastSensorReadMillis = now;

    // 1. Read Sensors
    myPacket.gas_level      = readSmoothedMQ2();
    myPacket.flame_status   = readFlameSensor();
    myPacket.uptime_seconds = (uint32_t)(now / 1000);

    // 2. Evaluate Local Hazards
    bool isDanger  = (myPacket.flame_status || myPacket.gas_level >= THRESHOLD_DANGER_PPM);
    bool isWarning = (!isDanger && myPacket.gas_level > THRESHOLD_SAFE_PPM);
    const char* statusText = isDanger ? "DANGER" : (isWarning ? "WARNING" : "SAFE");

    // 3. Transmit to Core Gateway via ESP-NOW
    esp_now_send(coreGatewayAddress, (uint8_t *)&myPacket, sizeof(myPacket));

    // 4. Drive Local Alarm & OLED
    manageLocalBuzzer(isWarning, isDanger);
    updateOledHUD(statusText, isWarning, isDanger);
  }
}
