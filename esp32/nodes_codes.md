1. CORE NODE (NODE 1) - I-upload sa main ESP32
(Ito yung kumokonekta sa Wi-Fi at sumasalo ng data)

C++
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiManager.h>
#include <esp_now.h>
#include <esp_wifi.h> 

// --- OLED Settings ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- HiveMQ Credentials ---
const char* mqtt_server = "16e51255d95244c2b069b92cf77ebf81.s1.eu.hivemq.cloud";
const char* mqtt_user = "RheinTigle";
const char* mqtt_pass = "052105@Rhein";
const char* topic_data = "hfire/house1/data";
const char* topic_status = "hfire/house1/status";

// --- ESP32 Pins ---
const int MQ2_PIN = 34;    
const int FLAME_PIN = 32;  
const int BUZZER_PIN = 25; 
const int BOOT_BUTTON = 0; 

// --- Thresholds ---
const int SAFE_LIMIT = 1000;
const int DANGER_LIMIT = 2000;

// --- Network & Timer Variables ---
WiFiClientSecure espClient;
PubSubClient client(espClient);
String deviceMac = "";
unsigned long lastSensorReadTime = 0;
unsigned long lastMqttReconnectTime = 0;
unsigned long lastBeepTime = 0;
bool beepState = false;

// --- Data Storage para sa lahat ng Nodes ---
int nodeGas[4] = {0, 0, 0, 0};
bool nodeFire[4] = {false, false, false, false};

typedef struct struct_message {
  int node_id;
  int gas_level;
  bool flame_status;
} struct_message;

struct_message incomingReadings;

// --- ESP-NOW Receive Callback ---
void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
  memcpy(&incomingReadings, incomingData, sizeof(incomingReadings));
  int id = incomingReadings.node_id;
  
  if (id == 2 || id == 3) {
    nodeGas[id] = incomingReadings.gas_level;
    nodeFire[id] = incomingReadings.flame_status;
  }
}

// --- WiFi Setup ---
void configModeCallback (WiFiManager *myWiFiManager) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println(F("WiFi Setup Mode"));
  display.println(F("Connect: H-Fire-Setup"));
  display.display();
}

void setup_wifi() {
  WiFiManager wm;
  wm.setAPCallback(configModeCallback);
  wm.setConfigPortalTimeout(60); 

  if (!wm.autoConnect("H-Fire-Setup")) {
    Serial.println("WiFi Failed. Proceeding OFFLINE");
  } else {
    Serial.println("WiFi connected");
  }
  
  deviceMac = WiFi.macAddress();
  espClient.setInsecure(); 
}

void checkManualReset() {
  if (digitalRead(BOOT_BUTTON) == LOW) {
    unsigned long startTime = millis();
    while (digitalRead(BOOT_BUTTON) == LOW) {
      if (millis() - startTime > 3000) { 
        WiFiManager wm;
        wm.resetSettings(); 
        WiFi.disconnect(true, true); 
        delay(2000);
        ESP.restart(); 
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(FLAME_PIN, INPUT_PULLUP); 
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BOOT_BUTTON, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    for(;;);
  }
  
  // WAKE UP ANTENNA PARA SA MAC ADDRESS
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 
  delay(200); 
  
  String myMac = WiFi.macAddress();
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 10);
  display.println(F("CORE NODE STARTING"));
  display.setCursor(0, 30);
  display.println(F("MAC ADDRESS:"));
  display.setCursor(0, 45);
  display.println(myMac); 
  display.display();
  delay(4000); 

  setup_wifi(); 
  
  // I-disable ang Power Save para makasalo online
  esp_wifi_set_ps(WIFI_PS_NONE); 
  
  client.setServer(mqtt_server, 8883);

  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }
  esp_now_register_recv_cb((esp_now_recv_cb_t)OnDataRecv); 
}

void loop() {
  unsigned long currentMillis = millis();
  checkManualReset();

  if (WiFi.status() == WL_CONNECTED && !client.connected()) {
    if (currentMillis - lastMqttReconnectTime > 5000) {
      lastMqttReconnectTime = currentMillis;
      if (client.connect(deviceMac.c_str(), mqtt_user, mqtt_pass)) {
        client.publish(topic_status, "Core System Online");
      }
    }
  }
  if (client.connected()) {
    client.loop();
  }

  if (currentMillis - lastSensorReadTime > 500) {
    lastSensorReadTime = currentMillis;

    nodeGas[1] = analogRead(MQ2_PIN);
    nodeFire[1] = (digitalRead(FLAME_PIN) == HIGH); 

    bool isDanger = false;
    bool isWarning = false;

    for (int i = 1; i <= 3; i++) {
      if (nodeGas[i] >= DANGER_LIMIT || nodeFire[i] == true) {
        isDanger = true;
      } 
      else if (nodeGas[i] > SAFE_LIMIT && nodeGas[i] < DANGER_LIMIT) {
        isWarning = true;
      }
    }

    if (isDanger) digitalWrite(BUZZER_PIN, HIGH);
    else if (!isWarning) {
      digitalWrite(BUZZER_PIN, LOW);
      beepState = false;
    }

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print(F("H-FIRE CORE "));
    if (WiFi.status() == WL_CONNECTED) display.print(F("[WIFI]"));
    else display.print(F("[OFFLINE]"));
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

    for (int i = 1; i <= 3; i++) {
      display.setCursor(0, 10 + (i * 12));
      display.print(F("N")); 
      display.print(i);
      display.print(F(": "));
      display.print(nodeGas[i]);
      display.print(F("ppm "));
      
      if (nodeFire[i]) display.print(F("[FIRE!]"));
      else if (nodeGas[i] >= DANGER_LIMIT) display.print(F("[GAS!]"));
      else display.print(F("[OK]"));
    }
    display.display();

    if (client.connected()) {
      String jsonPayload = "{";
      jsonPayload += "\"N1_Gas\":" + String(nodeGas[1]) + ", \"N1_Fire\":" + String(nodeFire[1]) + ", ";
      jsonPayload += "\"N2_Gas\":" + String(nodeGas[2]) + ", \"N2_Fire\":" + String(nodeFire[2]) + ", ";
      jsonPayload += "\"N3_Gas\":" + String(nodeGas[3]) + ", \"N3_Fire\":" + String(nodeFire[3]);
      jsonPayload += "}";
      client.publish(topic_data, jsonPayload.c_str());
    }
  }

  bool isWarningState = false;
  bool isDangerState = false;
  for (int i = 1; i <= 3; i++) {
    if (nodeGas[i] >= DANGER_LIMIT || nodeFire[i]) isDangerState = true;
    else if (nodeGas[i] > SAFE_LIMIT && nodeGas[i] < DANGER_LIMIT) isWarningState = true;
  }
  
  if (isWarningState && !isDangerState) {
    if (currentMillis - lastBeepTime > 500) {
      lastBeepTime = currentMillis;
      beepState = !beepState;
      digitalWrite(BUZZER_PIN, beepState ? HIGH : LOW);
    }
  }
}
2. NODE 2 (LIVING ROOM)
(Nakapasok na rito ang 20:50:0D:33:68:0C)

C++
#include <esp_now.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_wifi.h> 

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

const int MQ2_PIN = 34;    
const int FLAME_PIN = 32;  
const int BUZZER_PIN = 25; 

const int SAFE_LIMIT = 1000;
const int DANGER_LIMIT = 2000;

// ANG MAC ADDRESS NG CORE NODE MO:
uint8_t coreNodeAddress[] = {0x20, 0x50, 0x0D, 0x33, 0x68, 0x0C}; 

typedef struct struct_message {
  int node_id;    
  int gas_level;
  bool flame_status;
} struct_message;

struct_message myData;
esp_now_peer_info_t peerInfo;

unsigned long lastSensorReadTime = 0;
unsigned long lastBeepTime = 0;
bool beepState = false;
String currentStatus = "SAFE";

// --- THE ANTENNA HOPPING VARIABLES ---
int currentChannel = 1;
volatile bool hopChannel = false; 

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS) {
    hopChannel = true; 
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(FLAME_PIN, INPUT_PULLUP); 
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    for(;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 25);
  display.println(F("Node 2 Starting"));
  display.display();
  delay(2000);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 

  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(currentChannel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (esp_now_init() != ESP_OK) return;

  esp_now_register_send_cb((esp_now_send_cb_t) OnDataSent);
  
  memcpy(peerInfo.peer_addr, coreNodeAddress, 6);
  peerInfo.channel = currentChannel; 
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK) return;

  myData.node_id = 2; // ITO AY NODE 2
}

void loop() {
  unsigned long currentMillis = millis();

  // --- ANTENNA HOPPING LOGIC ---
  if (hopChannel == true) {
    currentChannel = (currentChannel % 13) + 1; 
    
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(currentChannel, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);

    peerInfo.channel = currentChannel;
    esp_now_mod_peer(&peerInfo);

    hopChannel = false; 
  }

  if (currentMillis - lastSensorReadTime > 500) {
    lastSensorReadTime = currentMillis;

    myData.gas_level = analogRead(MQ2_PIN);
    myData.flame_status = (digitalRead(FLAME_PIN) == HIGH); 

    esp_now_send(coreNodeAddress, (uint8_t *) &myData, sizeof(myData));
    
    if (myData.gas_level >= DANGER_LIMIT || myData.flame_status) {
      currentStatus = "DANGER";
      digitalWrite(BUZZER_PIN, HIGH); 
    } 
    else if (myData.gas_level > SAFE_LIMIT && myData.gas_level < DANGER_LIMIT) {
      currentStatus = "WARNING";
    } 
    else {
      currentStatus = "SAFE";
      digitalWrite(BUZZER_PIN, LOW);
      beepState = false;
    }

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    
    display.print(F("NODE 2 (LIVING RM)"));
    
    display.setCursor(105, 0);
    display.print(F("CH:"));
    display.print(currentChannel); 
    
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

    display.setCursor(0, 18);
    display.print(F("Gas PPM : "));
    display.print(myData.gas_level);
    display.setCursor(0, 30);
    if (myData.flame_status) display.print(F("IR Flame: DETECTED!"));
    else display.print(F("IR Flame: CLEAR"));

    display.setTextSize(2);
    if (currentStatus == "SAFE") display.setCursor(40, 45);
    else if (currentStatus == "WARNING") display.setCursor(20, 45);
    else display.setCursor(25, 45);
    
    display.print(currentStatus);
    display.display();
  }

  if (currentStatus == "WARNING") {
    if (currentMillis - lastBeepTime > 500) {
      lastBeepTime = currentMillis;
      beepState = !beepState;
      digitalWrite(BUZZER_PIN, beepState ? HIGH : LOW);
    }
  }
}
3. NODE 3 (KITCHEN)
(Nandito na rin ang MAC address at naka-set na as NODE 3)

C++
#include <esp_now.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_wifi.h> 

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

const int MQ2_PIN = 34;    
const int FLAME_PIN = 32;  
const int BUZZER_PIN = 25; 

const int SAFE_LIMIT = 1000;
const int DANGER_LIMIT = 2000;

// ANG MAC ADDRESS NG CORE NODE MO:
uint8_t coreNodeAddress[] = {0x20, 0x50, 0x0D, 0x33, 0x68, 0x0C}; 

typedef struct struct_message {
  int node_id;    
  int gas_level;
  bool flame_status;
} struct_message;

struct_message myData;
esp_now_peer_info_t peerInfo;

unsigned long lastSensorReadTime = 0;
unsigned long lastBeepTime = 0;
bool beepState = false;
String currentStatus = "SAFE";

// --- THE ANTENNA HOPPING VARIABLES ---
int currentChannel = 1;
volatile bool hopChannel = false; 

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS) {
    hopChannel = true; 
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(FLAME_PIN, INPUT_PULLUP); 
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    for(;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 25);
  display.println(F("Node 3 Starting"));
  display.display();
  delay(2000);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 

  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(currentChannel, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (esp_now_init() != ESP_OK) return;

  esp_now_register_send_cb((esp_now_send_cb_t) OnDataSent);
  
  memcpy(peerInfo.peer_addr, coreNodeAddress, 6);
  peerInfo.channel = currentChannel; 
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK) return;

  myData.node_id = 3; // ITO AY NODE 3
}

void loop() {
  unsigned long currentMillis = millis();

  // --- ANTENNA HOPPING LOGIC ---
  if (hopChannel == true) {
    currentChannel = (currentChannel % 13) + 1; 
    
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(currentChannel, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);

    peerInfo.channel = currentChannel;
    esp_now_mod_peer(&peerInfo);

    hopChannel = false; 
  }

  if (currentMillis - lastSensorReadTime > 500) {
    lastSensorReadTime = currentMillis;

    myData.gas_level = analogRead(MQ2_PIN);
    myData.flame_status = (digitalRead(FLAME_PIN) == HIGH); 

    esp_now_send(coreNodeAddress, (uint8_t *) &myData, sizeof(myData));
    
    if (myData.gas_level >= DANGER_LIMIT || myData.flame_status) {
      currentStatus = "DANGER";
      digitalWrite(BUZZER_PIN, HIGH); 
    } 
    else if (myData.gas_level > SAFE_LIMIT && myData.gas_level < DANGER_LIMIT) {
      currentStatus = "WARNING";
    } 
    else {
      currentStatus = "SAFE";
      digitalWrite(BUZZER_PIN, LOW);
      beepState = false;
    }

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    
    display.print(F("NODE 3 (KITCHEN)"));
    
    display.setCursor(105, 0);
    display.print(F("CH:"));
    display.print(currentChannel); 
    
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

    display.setCursor(0, 18);
    display.print(F("Gas PPM : "));
    display.print(myData.gas_level);
    display.setCursor(0, 30);
    if (myData.flame_status) display.print(F("IR Flame: DETECTED!"));
    else display.print(F("IR Flame: CLEAR"));

    display.setTextSize(2);
    if (currentStatus == "SAFE") display.setCursor(40, 45);
    else if (currentStatus == "WARNING") display.setCursor(20, 45);
    else display.setCursor(25, 45);
    
    display.print(currentStatus);
    display.display();
  }

  if (currentStatus == "WARNING") {
    if (currentMillis - lastBeepTime > 500) {
      lastBeepTime = currentMillis;
      beepState = !beepState;
      digitalWrite(BUZZER_PIN, beepState ? HIGH : LOW);
    }
  }
}