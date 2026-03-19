/*
 * XIAO MG24 Sense IMU BLE Transmitter
 * 
 * このスケッチは、LSM6DS3 IMUセンサーから加速度、ジャイロスコープ、
 * 温度データを読み取り、JSON形式で`シリアル出力およびBLE送信します。
 * 
 * データフォーマットはSeeed Studio XIAO nRF52840 Senseと互換性があります。
 * 
 * 必要なライブラリ:
 * - Seeed_Arduino_LSM6DS3 (https://github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3)
 * - Silicon Labs Arduino Core (BLE (Silabs) スタック)
 * 
 * ボード設定:
 * - ボード: Seeed Studio XIAO MG24 (Sense)
 * - Protocol stack: BLE (Silabs)
 * - ボーレート: 115200
 * 
 * 注意:
 * - gatt_db.h/gatt_db.c はスケッチフォルダに置かないこと
 *   (ボードパッケージ GSDK が内部で提供するため、二重定義エラーになる)
 * - gattdb_nus_tx は GSDK 内の gatt_db.h に #define マクロとして定義済み
 */

#include <LSM6DS3.h>
#include <Wire.h>

// BLE includes for Silicon Labs stack
#include "sl_bluetooth.h"
#include "gatt_db.h"  // GATTハンドル定義 (gattdb_nus_tx = 23 など)

// LSM6DS3センサーオブジェクトを作成（I2C通信）
LSM6DS3 imu(I2C_MODE, 0x6A);  // I2Cアドレス: 0x6A

// サンプリング間隔（ミリ秒）
const int SAMPLE_INTERVAL = 50;  // 20Hz - BLE送信のため間隔を長く

// 前回のサンプリング時刻
unsigned long lastSampleTime = 0;

// BLE接続ハンドル
uint8_t bleConnectionHandle = 0xFF;
uint8_t adv_set_handle = 0xFF; // アドバタイジング専用ハンドル
bool bleConnected = false;
bool bleNotifyEnabled = false; // CentralがNotificationをSubscribeしたか

// 診断用フラグ
bool bleBootEventReceived = false;
bool bleAdvStarted = false;
unsigned long lastDiagTime = 0;
const int DIAG_INTERVAL = 5000; // 5秒ごとにBLE状態を出力

// Nordic UART Service UUIDs
// Service: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
// TX Char: 6E400003-B5A3-F393-E0A9-E50E24DCCA9E (Notify)
// RX Char: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E (Write)

// GATT database handles
// gattdb_nus_tx は gatt_db.h に #define マクロとして定義済み (値: 23)

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

  Serial.println("XIAO MG24 Sense IMU BLE Transmitter");
  Serial.println("Initializing LSM6DS3 sensor...");

  // IMUセンサーを初期化
  if (imu.begin() != 0) {
    Serial.println("ERROR: Failed to initialize LSM6DS3!");
    Serial.println("Please check:");
    Serial.println("- Seeed_Arduino_LSM6DS3 library is installed");
    Serial.println("- Board is XIAO MG24 Sense");
    while (1) {
      delay(1000);
    }
  }

  Serial.println("LSM6DS3 initialized successfully!");

  // BLE初期化
  Serial.println("Initializing BLE...");

  // Silicon Labs BLE stackは自動的に初期化されます
  Serial.println("BLE initialized successfully!");
  Serial.println("Device name: XIAO_IMU_MG24");
  Serial.println("Starting data stream...");
  Serial.println();

  delay(100);
}

void loop() {
  unsigned long currentTime = millis();

  // ★診断: 5秒ごとにBLE状態をシリアル出力
  if (currentTime - lastDiagTime >= DIAG_INTERVAL) {
    lastDiagTime = currentTime;
    Serial.print("[DIAG] bootEvent=");
    Serial.print(bleBootEventReceived ? "YES" : "NO");
    Serial.print(" advStarted=");
    Serial.print(bleAdvStarted ? "YES" : "NO");
    Serial.print(" connected=");
    Serial.print(bleConnected ? "YES" : "NO");
    Serial.print(" notify=");
    Serial.print(bleNotifyEnabled ? "YES" : "NO");
    Serial.print(" adv_handle=");
    Serial.println(adv_set_handle, HEX);

    // GATT DB 検証: handle 23（gattdb_nus_tx）が存在するか確認
    uint8_t buf[4];
    size_t outLen;
    sl_status_t gattSc = sl_bt_gatt_server_read_attribute_value(gattdb_nus_tx, 0, sizeof(buf), &outLen, buf);
    Serial.print("[DIAG] gattdb_nus_tx(23) read status=0x");
    Serial.print(gattSc, HEX);
    Serial.println(gattSc == SL_STATUS_OK ? " [OK - GATT DB OK]" : " [ERR - GATT DB BROKEN]");
  }

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
    // bleConnected かつ bleNotifyEnabled の両方が必要
    if (bleConnected && bleNotifyEnabled) {
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

      // BLE経由でデータを送信（Notification）
      sl_status_t status = sl_bt_gatt_server_send_notification(
        bleConnectionHandle,
        gattdb_nus_tx,
        sizeof(bleData),
        bleData
      );

      if (status != SL_STATUS_OK) {
        Serial.print("BLE send error: 0x");
        Serial.println(status, HEX);
      }
    }
  }
}

// BLEイベントハンドラ
void sl_bt_on_event(sl_bt_msg_t *evt) {
  switch (SL_BT_MSG_ID(evt->header)) {
    case sl_bt_evt_system_boot_id:
      {
        bleBootEventReceived = true;
        Serial.println("[BLE] Boot event received!");

        // 1. アドバタイジングセットの作成
        sl_status_t sc = sl_bt_advertiser_create_set(&adv_set_handle);
        Serial.print("[BLE] create_set status=0x"); Serial.print(sc, HEX);
        Serial.print(" handle="); Serial.println(adv_set_handle, HEX);

        // 2. タイミング設定 (100ms間隔)
        sc = sl_bt_advertiser_set_timing(adv_set_handle, 160, 160, 0, 0);
        Serial.print("[BLE] set_timing status=0x"); Serial.println(sc, HEX);

        // 3. ADデータを手動設定（generate_dataのGATT DB依存を回避）
        //    Byte構成:
        //      [0x02, 0x01, 0x06]           = Flags (General Discoverable | BR/EDR Not Supported)
        //      [0x0E, 0x09, 'X','I','A','O','_','M','G','2','4','_','I','M','U']
        //                                   = Complete Local Name (13文字)
        const uint8_t adv_data[] = {
          0x02, 0x01, 0x06,                                        // Flags
          0x0E, 0x09,                                              // Length=14, Type=Complete Name
          'X','I','A','O','_','M','G','2','4','_','I','M','U'     // "XIAO_MG24_IMU"
        };
        sc = sl_bt_legacy_advertiser_set_data(adv_set_handle,
                                              sl_bt_advertiser_advertising_data_packet,
                                              sizeof(adv_data), adv_data);
        Serial.print("[BLE] set_data status=0x"); Serial.println(sc, HEX);

        // Scan Response: NUSサービスUUID (6E400001-B5A3-F393-E0A9-E50E24DCCA9E) を追加
        // Web Bluetooth の services フィルターに対応するために必要
        // UUID はリトルエンディアン順
        const uint8_t scan_resp[] = {
          0x11, 0x07,                                              // Length=17, Type=Complete 128-bit UUID list
          0x9e, 0xca, 0xdc, 0x24, 0x0e, 0xe5, 0xa9, 0xe0,       // 6E400001-B5A3-F393-
          0x93, 0xf3, 0xa3, 0xb5, 0x01, 0x00, 0x40, 0x6e        // E0A9-E50E24DCCA9E
        };
        sc = sl_bt_legacy_advertiser_set_data(adv_set_handle,
                                              sl_bt_advertiser_scan_response_packet,
                                              sizeof(scan_resp), scan_resp);
        Serial.print("[BLE] scan_resp status=0x"); Serial.println(sc, HEX);

        // 4. アドバタイジング開始
        sc = sl_bt_legacy_advertiser_start(adv_set_handle, sl_bt_advertiser_connectable_scannable);
        Serial.print("[BLE] adv_start status=0x"); Serial.println(sc, HEX);

        if (sc == SL_STATUS_OK) {
          bleAdvStarted = true;
          Serial.println("[BLE] Advertising started: XIAO_MG24_IMU");
        } else {
          Serial.println("[BLE] ERROR: Advertising failed to start!");
        }

        // 5. Security Manager設定（ペアリング不要・ボンディングなし）
        //    これがないと接続時にペアリング要求で切断される場合がある
        sl_bt_sm_configure(0, sl_bt_sm_io_capability_noinputnooutput);
        sl_bt_sm_set_bondable_mode(0);  // 非ボンダブル
        Serial.println("[BLE] SM configured (no pairing required)");
      }
      break;
      
    case sl_bt_evt_connection_opened_id:
      bleConnectionHandle = evt->data.evt_connection_opened.connection;
      bleConnected = true;
      Serial.print("[BLE] Connected! handle=");
      Serial.println(bleConnectionHandle, HEX);
      break;
      
    case sl_bt_evt_connection_closed_id:
      {
        uint8_t reason = evt->data.evt_connection_closed.reason;
        bleConnected = false;
        bleNotifyEnabled = false;  // Subscribeもリセット
        Serial.print("[BLE] Disconnected. reason=0x");
        Serial.println(reason, HEX);
        // 切断後: 手動ADデータで再アドバタイズ
        const uint8_t adv_data[] = {
          0x02, 0x01, 0x06,
          0x0E, 0x09,
          'X','I','A','O','_','M','G','2','4','_','I','M','U'
        };
        sl_bt_legacy_advertiser_set_data(adv_set_handle,
                                         sl_bt_advertiser_advertising_data_packet,
                                         sizeof(adv_data), adv_data);
        sl_bt_legacy_advertiser_start(adv_set_handle, sl_bt_advertiser_connectable_scannable);
      }
      break;

    // ★Notification Subscribe/Unsubscribe の検知
    case sl_bt_evt_gatt_server_characteristic_status_id:
      {
        uint16_t charHandle = evt->data.evt_gatt_server_characteristic_status.characteristic;
        uint8_t  statusFlags = evt->data.evt_gatt_server_characteristic_status.status_flags;
        uint16_t clientConfig = evt->data.evt_gatt_server_characteristic_status.client_config_flags;

        // NUS TX CCCD (gattdb_nus_tx = 23) の変化を監視
        if (charHandle == gattdb_nus_tx) {
          if (statusFlags == sl_bt_gatt_server_client_config) {
            if (clientConfig & sl_bt_gatt_notification) {
              // Notificationが有効になった
              bleNotifyEnabled = true;
              Serial.println("[BLE] Notification ENABLED by client!");
            } else {
              // Notificationが無効になった
              bleNotifyEnabled = false;
              Serial.println("[BLE] Notification DISABLED by client.");
            }
          }
        }
      }
      break;

    // ボンディング失敗ログ（診断用）
    case sl_bt_evt_sm_bonding_failed_id:
      Serial.print("[BLE] Bonding failed! reason=0x");
      Serial.println(evt->data.evt_sm_bonding_failed.reason, HEX);
      break;
  }
}