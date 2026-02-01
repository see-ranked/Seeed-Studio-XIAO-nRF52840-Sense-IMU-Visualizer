/*
 * XIAO nRF52840 Sense IMU Display Project
 * 
 * このスケッチは、LSM6DS3 IMUセンサーから加速度、ジャイロスコープ、
 * 温度データを読み取り、JSON形式でシリアル出力およびBLE送信します。
 * 
 * 必要なライブラリ:
 * - Seeed_Arduino_LSM6DS3 (https://github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3)
 * - Adafruit_TinyUSB_Arduino (Seeed nRF52ボードパッケージに含まれる)
 * 
 * ボード設定:
 * - ボード: Seeed XIAO nRF52840 Sense
 * - ボーレート: 115200
 */

#include "LSM6DS3.h"
#include "Wire.h"
#include <bluefruit.h>

// LSM6DS3センサーオブジェクトを作成（I2C通信）
LSM6DS3 imu(I2C_MODE, 0x6A);  // I2Cアドレス: 0x6A

// BLE UART サービス
BLEUart bleuart;

// サンプリング間隔（ミリ秒）
const int SAMPLE_INTERVAL = 50;  // 20Hz - BLE送信のため間隔を長く

// 前回のサンプリング時刻
unsigned long lastSampleTime = 0;

// バイナリエンコード関数

// 13ビットエンコード: 符号付き整数 (範囲: -256.0 to +255.9375)
int16_t encode13bit(float value) {
  // 小数4bitにスケーリング (×16)
  int16_t scaled = (int16_t)(value * 16.0);
  // 13bitマスク (符号拡張を保持)
  return scaled & 0x1FFF;
}

// 温度エンコード: 整数8bit + 小数8bit
uint16_t encodeTemp(float temp) {
  int8_t intPart = (int8_t)temp;
  uint8_t fracPart = (uint8_t)((temp - intPart) * 256.0);
  return ((uint16_t)intPart << 8) | fracPart;
}


void setup() {
  // シリアル通信を初期化
  Serial.begin(115200);

  // シリアル接続を待機（最大3秒）
  unsigned long startTime = millis();
  while (!Serial && (millis() - startTime < 3000)) {
    delay(10);
  }

  Serial.println("XIAO nRF52840 Sense IMU Display");
  Serial.println("Initializing LSM6DS3 sensor...");

  // IMUセンサーを初期化
  if (imu.begin() != 0) {
    Serial.println("ERROR: Failed to initialize LSM6DS3!");
    Serial.println("Please check:");
    Serial.println("- Seeed_Arduino_LSM6DS3 library is installed");
    Serial.println("- Board is XIAO nRF52840 Sense (not regular nRF52840)");
    while (1) {
      delay(1000);
    }
  }

  Serial.println("LSM6DS3 initialized successfully!");

  // BLE初期化
  Serial.println("Initializing BLE...");
  
  // Bluefruitを初期化
  Bluefruit.begin();
  Bluefruit.setTxPower(4);  // 送信パワー設定 (-40, -30, -20, -16, -12, -8, -4, 0, 4)
  Bluefruit.setName("XIAO_IMU");

  // BLE UART サービスを開始
  bleuart.begin();

  // アドバタイズ設定
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(bleuart);
  Bluefruit.Advertising.addName();

  // アドバタイズ開始
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244);  // 単位: 0.625ms
  Bluefruit.Advertising.setFastTimeout(30);    // 30秒後にスローアドバタイズに切り替え
  Bluefruit.Advertising.start(0);              // 0 = 無期限にアドバタイズ

  Serial.println("BLE initialized successfully!");
  Serial.println("Device name: XIAO_IMU");
  Serial.println("Starting data stream...");
  Serial.println();

  delay(100);
}

void loop() {
  unsigned long currentTime = millis();

  // サンプリング間隔をチェック
  if (currentTime - lastSampleTime >= SAMPLE_INTERVAL) {
    lastSampleTime = currentTime;

    // 加速度データを読み取り（m/s²）
    float accelX = imu.readFloatAccelX();
    float accelY = imu.readFloatAccelY();
    float accelZ = imu.readFloatAccelZ();

    // ジャイロスコープデータを読み取り（度/秒）
    float gyroX = imu.readFloatGyroX();
    float gyroY = imu.readFloatGyroY();
    float gyroZ = imu.readFloatGyroZ();

    // 温度データを読み取り（℃）
    float temperature = imu.readTempC();

    // シリアル用JSON（完全版）
    String jsonData = "{";
    jsonData += "\"accel\":{";
    jsonData += "\"x\":" + String(accelX, 3);
    jsonData += ",\"y\":" + String(accelY, 3);
    jsonData += ",\"z\":" + String(accelZ, 3);
    jsonData += "},";
    jsonData += "\"gyro\":{";
    jsonData += "\"x\":" + String(gyroX, 3);
    jsonData += ",\"y\":" + String(gyroY, 3);
    jsonData += ",\"z\":" + String(gyroZ, 3);
    jsonData += "},";
    jsonData += "\"temp\":" + String(temperature, 2);
    jsonData += ",\"timestamp\":" + String(currentTime);
    jsonData += "}";

    // シリアル出力
    Serial.println(jsonData);

    // BLE送信（バイナリ形式 - 12バイト）
    if (Bluefruit.connected()) {
      uint8_t bleData[12];
      
      // 加速度データをエンコード
      uint16_t ax = encode13bit(accelX);
      uint16_t ay = encode13bit(accelY);
      uint16_t az = encode13bit(accelZ);
      
      // ビットパッキング: 加速度 (5バイト)
      bleData[0] = ax & 0xFF;
      bleData[1] = ((ax >> 8) & 0x1F) | ((ay & 0x07) << 5);
      bleData[2] = (ay >> 3) & 0xFF;
      bleData[3] = ((ay >> 11) & 0x03) | ((az & 0x3F) << 2);
      bleData[4] = (az >> 6) & 0x7F;
      
      // ジャイロデータをエンコード
      uint16_t gx = encode13bit(gyroX);
      uint16_t gy = encode13bit(gyroY);
      uint16_t gz = encode13bit(gyroZ);
      
      // ビットパッキング: ジャイロ (5バイト)
      bleData[5] = gx & 0xFF;
      bleData[6] = ((gx >> 8) & 0x1F) | ((gy & 0x07) << 5);
      bleData[7] = (gy >> 3) & 0xFF;
      bleData[8] = ((gy >> 11) & 0x03) | ((gz & 0x3F) << 2);
      bleData[9] = (gz >> 6) & 0x7F;
      
      // 温度データをエンコード (2バイト)
      uint16_t temp = encodeTemp(temperature);
      bleData[10] = temp >> 8;
      bleData[11] = temp & 0xFF;
      
      // バイナリデータを送信
      bleuart.write(bleData, 12);
      delay(30);
    }
  }
}