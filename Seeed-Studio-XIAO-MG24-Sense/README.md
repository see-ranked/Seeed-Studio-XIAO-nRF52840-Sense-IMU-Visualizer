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
- **Silicon Labs Arduino Core**
- **Seeed_Arduino_LSM6DS3** ライブラリ

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

### 3. GATT設定のインポート（オプション）

Silicon Labs BLE stackを使用する場合、GATT設定ファイルをインポートすることで、BLEサービスとキャラクタリスティックが自動生成されます。

#### Simplicity Studioを使用する場合:

1. Simplicity Studio 5をインストール
2. プロジェクトを作成
3. `gatt_configuration.btconf` をインポート
4. GATT Configuratorで確認・編集
5. 生成された `gatt_db.h` と `gatt_db.c` をArduinoスケッチのフォルダにコピー

#### Arduino IDEのみを使用する場合:

Arduino IDEでコンパイルすると、Silicon Labs Arduino Coreが自動的にGATT設定を処理します。`gatt_configuration.btconf` ファイルがスケッチフォルダにあれば、自動的に読み込まれます。

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
Initializing LSM6DS3 sensor...
LSM6DS3 initialized successfully!
Initializing BLE...
BLE initialized successfully!
Device name: XIAO_IMU_MG24
Starting data stream...

{"accel":{"x":0.123,"y":-0.045,"z":9.812},"gyro":{"x":0.012,"y":-0.023,"z":0.001},"temp":25.30,"timestamp":12345}
{"accel":{"x":0.125,"y":-0.043,"z":9.815},"gyro":{"x":0.010,"y":-0.025,"z":0.002},"temp":25.31,"timestamp":12395}
...
```

### BLE接続の確認

1. スマートフォンにBLEスキャナアプリをインストール
   - Android: [nRF Connect](https://play.google.com/store/apps/details?id=no.nordicsemi.android.mcp)
   - iOS: [nRF Connect](https://apps.apple.com/app/nrf-connect/id1054362403)

2. アプリでBLEデバイスをスキャン

3. **XIAO_IMU_MG24** という名前のデバイスを探す

4. デバイスに接続

5. **Nordic UART Service** (UUID: `6E400001-...`) が表示されることを確認

6. **TX Characteristic** (UUID: `6E400003-...`) のNotificationを有効化

7. 12バイトのバイナリデータが定期的に送信されることを確認

## 📊 データフォーマット

### シリアル出力（JSON形式）

```json
{
  "accel": {
    "x": 0.123,  // m/s²
    "y": -0.045,
    "z": 9.812
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

#### エンコーディング詳細

**13ビットエンコード（加速度・ジャイロ）**:
- 範囲: -256.0 ～ +255.9375
- 精度: 0.0625（1/16）
- 計算式: `encoded_value = (int16_t)(float_value * 16.0) & 0x1FFF`

**温度エンコード**:
- 整数部: 8ビット符号付き整数
- 小数部: 8ビット符号なし整数（0-255 → 0.0-0.996）
- 計算式: `encoded_temp = (int8_t << 8) | (uint8_t)((frac) * 256.0)`

## 🔧 コンパイル方法

### Arduino IDEでのコンパイル

1. スケッチを開く
2. `Sketch` → `Verify/Compile` (Ctrl+R)
3. コンパイルが成功することを確認

### Arduino CLIでのコンパイル（上級者向け）

```powershell
# Arduino CLIをインストール（未インストールの場合）
# https://arduino.github.io/arduino-cli/

# ボードパッケージをインストール
arduino-cli core install SiliconLabs:silabs

# ライブラリをインストール
arduino-cli lib install "Seeed Arduino LSM6DS3"

# コンパイル
arduino-cli compile --fqbn SiliconLabs:silabs:xiao_mg24_sense:protocol_stack=ble_silabs XIAO_MG24_IMU

# アップロード
arduino-cli upload -p COM3 --fqbn SiliconLabs:silabs:xiao_mg24_sense:protocol_stack=ble_silabs XIAO_MG24_IMU
```

> [!NOTE]
> `COM3` は実際の接続ポートに置き換えてください。

## 🔧 トラブルシューティング

### Arduino IDEでボードが見つからない

**症状**: Boards Managerに "Silicon Labs" が表示されない

**解決方法**:
1. Preferencesの `Additional Boards Manager URLs` を確認
2. Boards Managerを再読み込み（閉じて開き直す）
3. Arduino IDEを再起動

### IMUセンサーの初期化に失敗

**症状**: シリアルモニターに "ERROR: Failed to initialize LSM6DS3!" と表示

**解決方法**:
1. ボードが **XIAO MG24 Sense** であることを確認（通常のMG24ではない）
2. `Seeed_Arduino_LSM6DS3` ライブラリがインストールされているか確認
3. ボードを再接続して再試行

### BLEで接続できない

**症状**: BLEスキャナでデバイスが見つからない

**解決方法**:
1. `Protocol stack` が **BLE (Silabs)** に設定されているか確認
2. シリアルモニターで "BLE Advertising started" メッセージを確認
3. スマートフォンのBluetoothをOFF/ONして再スキャン
4. ファームウェアを再アップロード

### コンパイルエラー: "gatt_db.h: No such file"

**症状**: コンパイル時に `gatt_db.h` が見つからないエラー

**解決方法**:
1. `gatt_configuration.btconf` がスケッチフォルダ（`XIAO_MG24_IMU/`）にあることを確認
2. Arduino IDEを再起動
3. クリーンビルド: `Sketch` → `Clean Build Folder` を実行してから再コンパイル

### データが表示されない

**症状**: BLE接続は成功するがデータが受信できない

**解決方法**:
1. TX Characteristic (UUID: `6E400003-...`) のNotificationが有効になっているか確認
2. シリアルモニターでJSONデータが出力されているか確認
3. BLE接続を切断して再接続

## 📁 プロジェクト構成

```
Seeed-Studio-XIAO-MG24-Sense/
├── XIAO_MG24_IMU/
│   ├── XIAO_MG24_IMU.ino          # メインArduinoスケッチ
│   └── gatt_configuration.btconf  # GATT設定ファイル
└── README.md                       # このファイル
```

## 🎓 技術仕様

### LSM6DS3 IMUセンサー

- **加速度計**:
  - 範囲: ±2g / ±4g / ±8g / ±16g（設定可能）
  - デフォルト: ±2g
- **ジャイロスコープ**:
  - 範囲: ±125 / ±245 / ±500 / ±1000 / ±2000 dps（設定可能）
  - デフォルト: ±245 dps
- **温度センサー**: 内蔵
- **インターフェース**: I2C（アドレス: 0x6A）

### BLE仕様

- **BLEバージョン**: Bluetooth 5.3
- **サービス**: Nordic UART Service (NUS)
- **Service UUID**: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- **TX Characteristic UUID**: `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`
- **RX Characteristic UUID**: `6E400002-B5A3-F393-E0A9-E50E24DCCA9E`
- **デバイス名**: `XIAO_IMU_MG24`
- **送信間隔**: 50ms（20Hz）
- **データサイズ**: 12バイト/パケット

## 📚 参考資料

- [Seeed Studio XIAO MG24 Sense Wiki](https://wiki.seeedstudio.com/xiao_mg24_getting_started/)
- [Silicon Labs Arduino Core GitHub](https://github.com/SiliconLabs/arduino)
- [LSM6DS3 Datasheet](https://www.st.com/resource/en/datasheet/lsm6ds3.pdf)
- [Nordic UART Service Specification](https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/libraries/bluetooth_services/services/nus.html)
- [参考実装: XIAO nRF52840 Sense](https://github.com/see-ranked/Seeed-Studio-XIAO-nRF52840-Sense-IMU-Visualizer)

## 📝 ライセンス

MIT License

## 🤝 貢献

バグ報告や機能追加の提案は、GitHubのIssuesでお願いします。

## 📧 お問い合わせ

質問や問題がある場合は、GitHubのIssuesまたはDiscussionsをご利用ください。
