/*
 * ============================================================
 *  Clinical Sanctuary — Arduino Sensor Firmware
 * ============================================================
 *
 *  HARDWARE SETUP:
 *  - Arduino Uno/Nano
 *  - 2x MPU6050 (I2C) — Left & Right shoulder
 *  - 1x Flex sensor — Back (spine), with 10kΩ voltage divider
 *  - 1x HC-05 Bluetooth module — TX/RX
 *
 *  WIRING:
 *  ┌─────────────────────────────────────────────────┐
 *  │  MPU6050 #1 (Left Shoulder)                     │
 *  │    VCC  → 5V                                    │
 *  │    GND  → GND                                   │
 *  │    SDA  → A4                                    │
 *  │    SCL  → A5                                    │
 *  │    AD0  → GND  (I2C address: 0x68)              │
 *  │                                                  │
 *  │  MPU6050 #2 (Right Shoulder)                    │
 *  │    VCC  → 5V                                    │
 *  │    GND  → GND                                   │
 *  │    SDA  → A4                                    │
 *  │    SCL  → A5                                    │
 *  │    AD0  → 3.3V (I2C address: 0x69)              │
 *  │                                                  │
 *  │  Flex Sensor (Back)                             │
 *  │    One end  → 5V                                │
 *  │    Other end → A0 + 10kΩ resistor to GND        │
 *  │                                                  │
 *  │  HC-05 Bluetooth                                │
 *  │    VCC → 5V                                     │
 *  │    GND → GND                                    │
 *  │    TX  → Pin 10 (Arduino RX via SoftwareSerial) │
 *  │    RX  → Pin 11 (Arduino TX via voltage divider)│
 *  │    NOTE: Use voltage divider for RX (5V→3.3V)  │
 *  └─────────────────────────────────────────────────┘
 *
 *  DATA PROTOCOL (sent over Bluetooth Serial at 9600 baud):
 *  "L:<pitch>,<roll>|R:<pitch>,<roll>|F:<flexValue>\n"
 *
 *  Example output:
 *  L:12.5,3.2|R:10.8,-1.5|F:450
 *  L:5.1,1.0|R:6.3,0.8|F:220
 *
 *  LIBRARIES REQUIRED:
 *  - Wire.h (built-in)
 *  - SoftwareSerial.h (built-in)
 *
 * ============================================================
 */

#include <Wire.h>
#include <SoftwareSerial.h>

// HC-05 Bluetooth on pins 10 (RX), 11 (TX)
SoftwareSerial BTSerial(10, 11);

// MPU6050 I2C addresses
#define MPU_LEFT_ADDR  0x68  // AD0 → GND
#define MPU_RIGHT_ADDR 0x69  // AD0 → 3.3V

// Flex sensor analog pin
#define FLEX_PIN A0

// Calibration offsets (set during calibration)
float leftPitchOffset = 0, leftRollOffset = 0;
float rightPitchOffset = 0, rightRollOffset = 0;
int flexBaseline = 200;  // Baseline flex reading when sitting straight

// Complementary filter coefficient
#define ALPHA 0.96

// Variables for complementary filter
float leftPitch = 0, leftRoll = 0;
float rightPitch = 0, rightRoll = 0;

unsigned long lastTime = 0;
const int SEND_INTERVAL = 100; // Send data every 100ms (10Hz)

void setup() {
  Serial.begin(9600);     // USB Serial for debugging
  BTSerial.begin(9600);   // HC-05 default baud rate
  Wire.begin();

  // Initialize both MPU6050 sensors
  initMPU(MPU_LEFT_ADDR);
  initMPU(MPU_RIGHT_ADDR);

  delay(1000);

  // Auto-calibrate on startup
  calibrate();

  Serial.println("Clinical Sanctuary Sensor Ready");
  BTSerial.println("READY");
}

void loop() {
  unsigned long now = millis();

  if (now - lastTime >= SEND_INTERVAL) {
    lastTime = now;

    float dt = SEND_INTERVAL / 1000.0;

    // Read Left Shoulder MPU6050
    float lax, lay, laz, lgx, lgy, lgz;
    readMPU(MPU_LEFT_ADDR, lax, lay, laz, lgx, lgy, lgz);

    float lAccPitch = atan2(lay, sqrt(lax * lax + laz * laz)) * 180.0 / PI;
    float lAccRoll  = atan2(-lax, laz) * 180.0 / PI;

    leftPitch = ALPHA * (leftPitch + lgx * dt) + (1 - ALPHA) * lAccPitch;
    leftRoll  = ALPHA * (leftRoll + lgy * dt) + (1 - ALPHA) * lAccRoll;

    float lp = leftPitch - leftPitchOffset;
    float lr = leftRoll - leftRollOffset;

    // Read Right Shoulder MPU6050
    float rax, ray, raz, rgx, rgy, rgz;
    readMPU(MPU_RIGHT_ADDR, rax, ray, raz, rgx, rgy, rgz);

    float rAccPitch = atan2(ray, sqrt(rax * rax + raz * raz)) * 180.0 / PI;
    float rAccRoll  = atan2(-rax, raz) * 180.0 / PI;

    rightPitch = ALPHA * (rightPitch + rgx * dt) + (1 - ALPHA) * rAccPitch;
    rightRoll  = ALPHA * (rightRoll + rgy * dt) + (1 - ALPHA) * rAccRoll;

    float rp = rightPitch - rightPitchOffset;
    float rr = rightRoll - rightRollOffset;

    // Read Flex Sensor
    int flexRaw = analogRead(FLEX_PIN);

    // Build and send data string
    // Protocol: "L:<pitch>,<roll>|R:<pitch>,<roll>|F:<flexValue>"
    String data = "L:";
    data += String(lp, 1);
    data += ",";
    data += String(lr, 1);
    data += "|R:";
    data += String(rp, 1);
    data += ",";
    data += String(rr, 1);
    data += "|F:";
    data += String(flexRaw);

    // Send via Bluetooth
    BTSerial.println(data);

    // Also print to USB Serial for debugging
    Serial.println(data);
  }
}

// ===== MPU6050 Functions =====

void initMPU(uint8_t addr) {
  // Wake up MPU6050
  Wire.beginTransmission(addr);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // Wake up
  Wire.endTransmission(true);

  // Set accelerometer range to ±2g
  Wire.beginTransmission(addr);
  Wire.write(0x1C);
  Wire.write(0x00);
  Wire.endTransmission(true);

  // Set gyroscope range to ±250°/s
  Wire.beginTransmission(addr);
  Wire.write(0x1B);
  Wire.write(0x00);
  Wire.endTransmission(true);

  // Set digital low-pass filter
  Wire.beginTransmission(addr);
  Wire.write(0x1A);
  Wire.write(0x03); // ~44Hz bandwidth
  Wire.endTransmission(true);
}

void readMPU(uint8_t addr, float &ax, float &ay, float &az,
             float &gx, float &gy, float &gz) {
  Wire.beginTransmission(addr);
  Wire.write(0x3B); // Start at ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(addr, (uint8_t)14, (uint8_t)true);

  int16_t rawAx = Wire.read() << 8 | Wire.read();
  int16_t rawAy = Wire.read() << 8 | Wire.read();
  int16_t rawAz = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read(); // Skip temperature
  int16_t rawGx = Wire.read() << 8 | Wire.read();
  int16_t rawGy = Wire.read() << 8 | Wire.read();
  int16_t rawGz = Wire.read() << 8 | Wire.read();

  // Convert to physical units
  ax = rawAx / 16384.0;  // g (±2g range)
  ay = rawAy / 16384.0;
  az = rawAz / 16384.0;
  gx = rawGx / 131.0;    // °/s (±250°/s range)
  gy = rawGy / 131.0;
  gz = rawGz / 131.0;
}

void calibrate() {
  Serial.println("Calibrating... Hold still in upright position.");

  float lp_sum = 0, lr_sum = 0;
  float rp_sum = 0, rr_sum = 0;
  int flex_sum = 0;
  int samples = 50;

  for (int i = 0; i < samples; i++) {
    float lax, lay, laz, lgx, lgy, lgz;
    readMPU(MPU_LEFT_ADDR, lax, lay, laz, lgx, lgy, lgz);
    lp_sum += atan2(lay, sqrt(lax * lax + laz * laz)) * 180.0 / PI;
    lr_sum += atan2(-lax, laz) * 180.0 / PI;

    float rax, ray, raz, rgx, rgy, rgz;
    readMPU(MPU_RIGHT_ADDR, rax, ray, raz, rgx, rgy, rgz);
    rp_sum += atan2(ray, sqrt(rax * rax + raz * raz)) * 180.0 / PI;
    rr_sum += atan2(-rax, raz) * 180.0 / PI;

    flex_sum += analogRead(FLEX_PIN);
    delay(20);
  }

  leftPitchOffset = lp_sum / samples;
  leftRollOffset = lr_sum / samples;
  rightPitchOffset = rp_sum / samples;
  rightRollOffset = rr_sum / samples;
  flexBaseline = flex_sum / samples;

  leftPitch = 0;
  leftRoll = 0;
  rightPitch = 0;
  rightRoll = 0;

  Serial.print("Calibration done. Flex baseline: ");
  Serial.println(flexBaseline);
}
