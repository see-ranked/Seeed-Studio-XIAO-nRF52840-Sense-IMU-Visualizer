/*
 * XIAO nRF52840 Sense IMU Display Project
 * 
 * このスケッチは、LSM6DS3 IMUセンサーから加速度、ジャイロスコープ、
 * 温度データを読み取り、JSON形式でシリアル出力します。
 * 
 * 必要なライブラリ:
 * - Seeed_Arduino_LSM6DS3 (https://github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3)
 * 
 * ボード設定:
 * - ボード: Seeed XIAO nRF52840 Sense
 * - ボーレート: 115200
 */

#include "LSM6DS3.h"
#include "Wire.h"

// LSM6DS3センサーオブジェクトを作成（I2C通信）
LSM6DS3 imu(I2C_MODE, 0x6A);  // I2Cアドレス: 0x6A

// サンプリング間隔（ミリ秒）
const int SAMPLE_INTERVAL = 10;  // 100Hz (1000ms / 100 = 10ms)

// 前回のサンプリング時刻
unsigned long lastSampleTime = 0;

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

    // JSON形式で出力
    Serial.print("{");

    // 加速度データ
    Serial.print("\"accel\":{");
    Serial.print("\"x\":");
    Serial.print(accelX, 3);
    Serial.print(",\"y\":");
    Serial.print(accelY, 3);
    Serial.print(",\"z\":");
    Serial.print(accelZ, 3);
    Serial.print("},");

    // ジャイロスコープデータ
    Serial.print("\"gyro\":{");
    Serial.print("\"x\":");
    Serial.print(gyroX, 3);
    Serial.print(",\"y\":");
    Serial.print(gyroY, 3);
    Serial.print(",\"z\":");
    Serial.print(gyroZ, 3);
    Serial.print("},");

    // 温度データ
    Serial.print("\"temp\":");
    Serial.print(temperature, 2);

    // タイムスタンプ
    Serial.print(",\"timestamp\":");
    Serial.print(currentTime);

    Serial.println("}");
  }
}
