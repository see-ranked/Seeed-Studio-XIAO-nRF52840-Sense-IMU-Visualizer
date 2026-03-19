# XIAO MG24 Sense IMU BLE Transmitter

Seeed Studio XIAO MG24 SenseのLSM6DS3 IMUセンサーからデータを読み取り、BLE経由でリアルタイム送信するプロジェクトです。

**データフォーマットはSeeed Studio XIAO nRF52840 Senseと完全互換**です。

## 🎯 機能

- **6軸IMUセンサー**: 加速度（3軸）とジャイロスコープ（3軸）のデータ取得
- **温度センサー**: LSM6DS3内蔵の温度センサーからデータ取得
- **デュアル出力**:
  - **シリアル出力**: JSON形式（デバッグ・開発用）
  - **BLE送信**: 12バイトのバイナリ形式（効率的なワイヤレス通信）
- **Nordic UART Service (NUS)互換**: nRF52840と同じBLEサービスを使用
- **20Hzサンプリングレート**: リアルタイムデータストリーミング

## 📋 必要なもの

### ハードウェア

- [Seeed Studio XIAO MG24 Sense](https://www.seeedstudio.com/Seeed-XIAO-MG24-Sense-p-6247.html)
- USB Type-Cケーブル

### ソフトウェア

- **Arduino IDE 2.x** 以降
- **Silicon Labs Arduino Core** (v3.0.0以降)
- **Seeed_Arduino_LSM6DS3** ライブラリ

## 📁 プロジェクト構成

```
Seeed-Studio-XIAO-MG24-Sense/
├── XIAO_MG24_IMU/
│   ├── XIAO_MG24_IMU.ino   # メインArduinoスケッチ
│   ├── gatt_db.h            # GATT DBハンドル定義（必須）
│   └── gatt_db.c            # GATTデータベース実装（必須）
├── gatt_configuration.btconf  # GATT設定（Simplicity Studio参照用）
└── README.md                  # このファイル
```

> [!IMPORTANT]
> `gatt_db.h` と `gatt_db.c` は **スケッチフォルダ（`XIAO_MG24_IMU/`）に必ず配置**してください。
> これらはGATTサービス（Nordic UART Service）の定義を含みます。

## 🚀 セットアップ

### 1. Arduino IDEの準備

#### 1.1 Silicon Labs Boards パッケージのインストール

1. Arduino IDEを起動
2. `File` → `Preferences` を開く
3. `Additional Boards Manager URLs` に以下を追加:
   ```
   https://siliconlabs.github.io/arduino_board_manager/package_arduinosilabs_index.json
   ```
4. `Tools` → `Board` → `Boards Manager` を開く
5. "Silicon Labs" で検索
6. **Silicon Labs Boards** をインストール

#### 1.2 LSM6DS3ライブラリのインストール

1. `Tools` → `Manage Libraries` を開く
2. "Seeed LSM6DS3" で検索
3. **Seeed Arduino LSM6DS3** をインストール

### 2. ボード設定

Arduino IDEで以下の設定を行います：

1. **ボード**: `Tools` → `Board` → `Silicon Labs Boards` → `Seeed Studio XIAO MG24 (Sense)`
2. **Protocol stack**: `Tools` → `Protocol stack` → **`BLE (Silabs)`** ⚠️ 重要！
3. **Port**: XIAO MG24が接続されているCOMポートを選択

> [!IMPORTANT]
> **Protocol stackは必ず `BLE (Silabs)` を選択してください。** `BLE (Arduino)` では動作しません。

### 3. gatt_db.c の重要な設定

`gatt_db.c` の先頭にある `GATT_HEADER` マクロが正しく定義されていることを確認してください：

```c
// ✅ 正しい（staticなし → グローバルシンボルとしてGSDKライブラリを上書き）
#define GATT_HEADER(F) F

// ❌ 誤り（staticあり → GSDKのデフォルトGATT DBが使われNUSが見つからない）
#define GATT_HEADER(F) static F
```

> [!CAUTION]
> `static` が残っていると、BLE接続はできてもNUSサービスが見つからず、
> データ送信が `0x1101 (INVALID_HANDLE)` エラーになります。

### 4. ファームウェアのアップロード

1. XIAO MG24 SenseをUSBケーブルでPCに接続
2. Arduino IDEで `XIAO_MG24_IMU.ino` を開く
3. `Verify` ボタンでコンパイルエラーがないか確認
4. `Upload` ボタンでファームウェアをアップロード

## 🔍 動作確認

### シリアルモニターでの確認

1. `Tools` → `Serial Monitor` を開く
2. ボーレートを **115200** に設定
3. 以下のような出力が表示されることを確認:

```
XIAO MG24 Sense IMU BLE Transmitter
LSM6DS3 initialized successfully!
BLE initialized successfully!
[BLE] Boot event received!
[BLE] create_set status=0x0 handle=0
[BLE] set_data status=0x0
[BLE] scan_resp status=0x0
[BLE] adv_start status=0x0
[BLE] Advertising started: XIAO_MG24_IMU
[BLE] SM configured (no pairing required)
[DIAG] bootEvent=YES advStarted=YES connected=NO notify=NO adv_handle=0
[DIAG] gattdb_nus_tx(23) read status=0x0 [OK - GATT DB OK]
{"accel":{"x":0.123,"y":-0.045,"z":1.012},"gyro":{"x":0.012,"y":-0.023,"z":0.001},"temp":25.30,"timestamp":12345}
...
```

### BLE接続の確認（スマートフォン）

1. スマートフォンにBLEスキャナアプリをインストール
   - Android/iOS: [nRF Connect](https://www.nordicsemi.com/Products/Development-tools/nRF-Connect-for-mobile)

2. アプリでBLEデバイスをスキャン

3. **XIAO_MG24_IMU** という名前のデバイスを探す

4. デバイスに接続後、以下の手順でデータを受信:
   - **Nordic UART Service** (UUID: `6E400001-...`) を展開
   - **TX Characteristic** (UUID: `6E400003-...`) の **▼ボタン（Subscribe/Notify）** をタップ
   - 12バイトのバイナリデータが定期的に受信されることを確認

> [!NOTE]
> 接続しただけではデータは届きません。**Notificationをsubscribeしてから**データが送信されます。

## 🖥️ Visualizerの使用

IMUデータをリアルタイムで3Dビジュアライズするウェブアプリがあります。

### 起動方法

```
Seeed-Studio-XIAO-nRF52840-Sense_v03/
└── visualizer/
    ├── start_visualizer.bat  ← これをダブルクリック
    ├── index.html
    ├── app.js
    └── style.css
```

1. **`start_visualizer.bat`** をダブルクリック（自動でサーバー起動＋ブラウザ開く）
2. ブラウザで **`http://localhost:8080/`** が開く
3. **📶 Bluetooth** を選択 → **「Bluetoothに接続」** をクリック
4. デバイス一覧から **XIAO_MG24_IMU** を選択

> [!IMPORTANT]
> Web Bluetooth APIは **`file://` では動作しません**。必ず `http://localhost:8080/` を使用してください。
> Chrome または Edge ブラウザが必要です。

### 手動でサーバーを起動する場合

```powershell
cd "path/to/visualizer"
python -m http.server 8080
```

## 📊 データフォーマット

### シリアル出力（JSON形式）

```json
{
  "accel": {
    "x": 0.123,  // G (重力加速度単位)
    "y": -0.045,
    "z": 1.012
  },
  "gyro": {
    "x": 0.012,  // °/s
    "y": -0.023,
    "z": 0.001
  },
  "temp": 25.3,      // ℃
  "timestamp": 12345 // ミリ秒
}
```

### BLE送信（バイナリ形式 - 12バイト）

nRF52840実装と完全互換のバイナリフォーマット:

| バイト | 内容 | エンコーディング |
|--------|------|------------------|
| 0-4 | 加速度 (X, Y, Z) | 13ビット符号付き整数 × 3軸（ビットパッキング） |
| 5-9 | ジャイロ (X, Y, Z) | 13ビット符号付き整数 × 3軸（ビットパッキング） |
| 10-11 | 温度 | 整数部8ビット + 小数部8ビット |

## 🔧 トラブルシューティング

### BLEデバイスが検出されない

**症状**: BLEスキャナでデバイス名が見つからない

**解決方法**:
1. `Protocol stack` が **BLE (Silabs)** に設定されているか確認
2. シリアルモニターで `[BLE] Advertising started: XIAO_MG24_IMU` を確認
3. シリアルモニターで `[DIAG] advStarted=YES` が出ていること確認
4. スマートフォンのBluetoothをOFF/ONして再スキャン

### Notificationエラー: BLE send error: 0x1101

**症状**: BLE接続後に `BLE send error: 0x1101` が出る

**原因A: NUSサービスがGATT DBに存在しない**
- シリアルで `[DIAG] gattdb_nus_tx(23) read status=0x1101 [ERR - GATT DB BROKEN]` が出る
- **解決**: `gatt_db.c` の `GATT_HEADER` から `static` を削除（→ `#define GATT_HEADER(F) F`）

**原因B: Notificationがsubscribeされていない（正常な動作）**
- シリアルで `[DIAG] connected=YES notify=NO` の状態
- **解決**: スキャナアプリ（nRF Connect等）でTX CharacteristicのNotificationを有効化

### Web Bluetoothで接続できない（Visualizer）

**症状**: ブラウザからBluetooth接続に失敗する

**確認事項**:
1. `localhost:8080` からアクセスしているか（`file://` は不可）
2. Chrome または Edge ブラウザを使用しているか
3. `start_visualizer.bat` でサーバーが起動しているか（コマンドウィンドウが開いているか）
4. デバイスが他のデバイス（スマートフォン等）に接続中でないか

### コンパイルエラー: `gatt_db.h: No such file`

**解決方法**: `gatt_db.h` と `gatt_db.c` をスケッチフォルダ（`XIAO_MG24_IMU/`）に配置する

### BLE接続後すぐに切断される

**症状**: 接続したがすぐ切れる（シリアルで `[BLE] Bonding failed!` が出る）

**解決方法**: Security Manager設定がアップデートされているか確認（`sl_bt_sm_configure` が `setup()` または `sl_bt_evt_system_boot_id` ハンドラ内にあること）

## 🎓 技術仕様

### LSM6DS3 IMUセンサー

- **加速度計**: 範囲 ±2g（デフォルト）、I2Cアドレス: 0x6A
- **ジャイロスコープ**: 範囲 ±245 dps（デフォルト）
- **インターフェース**: I2C

### BLE仕様

- **BLEバージョン**: Bluetooth 5.3
- **デバイス名**: `XIAO_MG24_IMU`（ADVパケットに手動設定）
- **サービス**: Nordic UART Service (NUS)
- **Service UUID**: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- **TX Characteristic UUID**: `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`（Notify）
- **RX Characteristic UUID**: `6E400002-B5A3-F393-E0A9-E50E24DCCA9E`（Write）
- **アドバタイジング間隔**: 160 × 0.625ms = 100ms
- **送信間隔**: 50ms（20Hz）
- **データサイズ**: 12バイト/パケット
- **ペアリング**: 不要（No I/O、Non-bondable）

### BLE実装のポイント

| 項目 | 実装内容 |
|------|----------|
| ADVパケット | `sl_bt_legacy_advertiser_set_data` で Flags + デバイス名を手動設定 |
| Scan Response | NUSサービスUUIDを含む（Web Bluetooth互換性のため） |
| GATT DB | `gatt_db.c` をグローバルシンボルとして配置しGSDKデフォルトを上書き |
| Security Manager | No I/O、Non-bondable設定でペアリング不要 |
| Notification | CCCD subscribeされた後のみ送信（`sl_bt_evt_gatt_server_characteristic_status_id` で管理） |

## 📚 参考資料

- [Seeed Studio XIAO MG24 Sense Wiki](https://wiki.seeedstudio.com/xiao_mg24_getting_started/)
- [Silicon Labs Arduino Core GitHub](https://github.com/SiliconLabs/arduino)
- [LSM6DS3 Datasheet](https://www.st.com/resource/en/datasheet/lsm6ds3.pdf)
- [Nordic UART Service Specification](https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/libraries/bluetooth_services/services/nus.html)

## 📝 ライセンス

MIT License
