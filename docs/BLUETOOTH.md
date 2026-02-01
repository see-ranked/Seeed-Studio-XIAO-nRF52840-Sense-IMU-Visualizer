# Bluetooth通信ガイド

## 概要

XIAO nRF52840 SenseのBLE（Bluetooth Low Energy）機能を使用して、ワイヤレスでIMUデータを送信できます。Web Bluetooth APIを使用してブラウザから直接BLE接続が可能です。

## 機能

✅ **BLE UART サービス**: Nordic UART Service互換  
✅ **デバイス名**: `XIAO_IMU`  
✅ **データ形式**: JSON（シリアルと同じ）  
✅ **接続方式選択**: WebインターフェースでSerial/Bluetoothを切り替え  

## 使用方法

### 1. Arduino ファームウェアのアップロード

#### 必要なライブラリ

Arduino Library Managerから以下をインストール:
- **Seeed_Arduino_LSM6DS3**
- **ArduinoBLE**

#### アップロード手順

```
1. Arduino IDEを開く
2. ボードを選択: Seeed XIAO nRF52840 Sense
3. ポートを選択
4. XIAO_nRF52840_IMU.ino を開く
5. アップロード
```

### 2. Webビジュアライザーでの接続

#### ブラウザ要件

- **Chrome 56+** または **Edge 79+**
- **HTTPS** または **localhost**（HTTPSでない場合はlocalhostのみ）

#### 接続手順

```
1. http://localhost:8000 を開く
2. "📶 Bluetooth" を選択
3. "Bluetoothに接続" ボタンをクリック
4. デバイス選択ダイアログで "XIAO_IMU" を選択
5. "ペア設定" をクリック
```

接続後、シリアル接続と同じようにデータが表示されます。

## BLE仕様

### Service UUID

```
6E400001-B5A3-F393-E0A9-E50E24DCCA9E (Nordic UART Service)
```

### Characteristics

**TX Characteristic** (デバイス → ブラウザ):
```
UUID: 6E400003-B5A3-F393-E0A9-E50E24DCCA9E
Properties: Read, Notify
```

**RX Characteristic** (ブラウザ → デバイス):
```
UUID: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E
Properties: Write
```

### データ形式

シリアルと同じJSON形式:

```json
{
  "accel": {"x": 0.123, "y": -0.045, "z": 9.812},
  "gyro": {"x": 0.012, "y": -0.023, "z": 0.001},
  "temp": 25.3,
  "timestamp": 12345
}
```

## トラブルシューティング

### デバイスが見つからない

**原因:**
- BLEアドバタイズが開始されていない
- デバイスが他のデバイスと接続中

**対策:**
1. XIA Oをリセット（リセットボタンを押す）
2. シリアルモニターで "BLE initialized successfully!" を確認
3. 他のBLE接続を切断

### 接続できない

**原因:**
- ブラウザがWeb Bluetooth APIをサポートしていない
- HTTPSでない（localhostでもない）

**対策:**
1. Chrome または Edge を使用
2. localhostまたはHTTPSで接続
3. ブラウザのBluetooth権限を確認

### データが受信できない

**原因:**
- 通知が有効化されていない
- JSONパースエラー

**対策:**
1. ブラウザのコンソールでエラーを確認
2. デバイスを再接続
3. シリアルモニターでデータ出力を確認

### 接続が頻繁に切れる

**原因:**
- 電波干渉
- 距離が遠い
- 電源不足

**対策:**
1. デバイスとPCの距離を近づける（1m以内推奨）
2. Wi-Fiルーターから離す
3. USB電源を確認

## Serial vs Bluetooth 比較

| 項目 | Serial (USB) | Bluetooth |
|------|-------------|-----------|
| **接続方法** | USBケーブル | ワイヤレス |
| **速度** | 115200 baud | ~1 Mbps |
| **遅延** | 低 | やや高 |
| **距離** | ケーブル長 | ~10m |
| **電力消費** | 低 | やや高 |
| **ブラウザ対応** | Chrome, Edge | Chrome, Edge |
| **セットアップ** | 簡単 | やや複雑 |

## 推奨用途

### Serial (USB) がおすすめ

- 開発・デバッグ時
- 高速・低遅延が必要
- 安定した接続が必要
- 電力消費を抑えたい

### Bluetooth がおすすめ

- デモ・プレゼンテーション
- ワイヤレスが必要
- 移動しながら使用
- 複数デバイスを切り替え

## セキュリティ

### 現在の実装

- **認証**: なし
- **暗号化**: BLE標準暗号化のみ
- **ペアリング**: 不要

### 注意事項

⚠️ **機密データを送信しないでください**  
⚠️ **公共の場所での使用に注意**  

### セキュリティ強化（将来の実装案）

- ペアリング必須化
- データ暗号化
- 認証トークン

## Web Bluetooth API について

### サポート状況

✅ **Chrome 56+** (Desktop, Android)  
✅ **Edge 79+** (Desktop)  
✅ **Opera 43+** (Desktop, Android)  
❌ **Firefox** (実験的サポートのみ)  
❌ **Safari** (未サポート)  

### HTTPS要件

Web Bluetooth APIはセキュリティ上の理由から、以下の環境でのみ動作:

- **HTTPS** サイト
- **localhost** (開発用)

## 技術詳細

### Arduino側の実装

```cpp
// BLE初期化
BLE.begin();
BLE.setLocalName("XIAO_IMU");
BLE.setAdvertisedService(uartService);

// データ送信
if (central && central.connected()) {
    txCharacteristic.writeValue(jsonData.c_str());
}
```

### JavaScript側の実装

```javascript
// デバイス検索
const device = await navigator.bluetooth.requestDevice({
    filters: [{ name: 'XIAO_IMU' }],
    optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
});

// 接続
const server = await device.gatt.connect();
const service = await server.getPrimaryService('6e400001-...');
const characteristic = await service.getCharacteristic('6e400003-...');

// 通知受信
await characteristic.startNotifications();
characteristic.addEventListener('characteristicvaluechanged', handleData);
```

## まとめ

Bluetooth通信により、ワイヤレスでIMUデータを可視化できます。開発時はSerial接続、デモ時はBluetooth接続と使い分けることで、柔軟な運用が可能です。
