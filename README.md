# XIAO nRF52840 Sense IMU Display Project

Seeed Studio XIAO nRF52840 SenseのLSM6DS3 IMUセンサーからデータを読み取り、リアルタイムで表示するプロジェクトです。

![XIAO nRF52840 Sense](https://files.seeedstudio.com/wiki/XIAO-BLE/102010469_Front-14.jpg)

## 🎯 機能

- ✅ **6軸IMUデータ取得**: 3軸加速度計 + 3軸ジャイロスコープ
- ✅ **温度センサー**: 内蔵温度センサーのデータ取得
- ✅ **シリアル出力**: JSON形式でのデータ出力（115200 bps）
- ✅ **3Dビジュアライゼーション**: リアルタイムで姿勢を3D表示
- ✅ **グラフ表示**: 加速度とジャイロのリアルタイムグラフ
- ✅ **Web Serial API**: ブラウザから直接シリアルポートに接続

## 📋 必要なもの

### ハードウェア
- [Seeed Studio XIAO nRF52840 Sense](https://www.seeedstudio.com/Seeed-XIAO-BLE-Sense-nRF52840-p-5253.html)
- USB-Cケーブル

### ソフトウェア
- [Arduino IDE](https://www.arduino.cc/en/software) (v1.8.19以降 または v2.x)
- Chrome または Edge ブラウザ（Web Serial API対応）

## 🚀 セットアップ

### 1. Arduino IDE の準備

#### ボードサポートの追加

1. Arduino IDE を開く
2. **ファイル** → **環境設定** を開く
3. **追加のボードマネージャのURL** に以下を追加:
   ```
   https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json
   ```
4. **ツール** → **ボード** → **ボードマネージャ** を開く
5. "Seeed nRF52" を検索してインストール

#### ライブラリのインストール

1. **スケッチ** → **ライブラリをインクルード** → **ライブラリを管理** を開く
2. "LSM6DS3" を検索
3. **Seeed_Arduino_LSM6DS3** をインストール

### 2. ファームウェアのアップロード

1. `XIAO_nRF52840_IMU/XIAO_nRF52840_IMU.ino` を開く
2. **ツール** → **ボード** → **Seeed nRF52 Boards** → **Seeed XIAO nRF52840 Sense** を選択
3. **ツール** → **シリアルポート** → 適切なCOMポートを選択
4. **アップロード** ボタンをクリック

### 3. 動作確認（シリアルモニター）

1. **ツール** → **シリアルモニタ** を開く
2. ボーレートを **115200** に設定
3. 以下のようなJSON形式のデータが表示されることを確認:
   ```json
   {"accel":{"x":0.123,"y":-0.045,"z":9.812},"gyro":{"x":0.012,"y":-0.023,"z":0.001},"temp":25.3,"timestamp":12345}
   ```

### 4. Webビジュアライザーの起動

#### 方法1: Pythonを使用（推奨）

```bash
cd visualizer
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開く

#### 方法2: Node.jsを使用

```bash
cd visualizer
npx -y http-server -p 8000
```

ブラウザで `http://localhost:8000` を開く

#### 方法3: 直接ファイルを開く

`visualizer/index.html` をChromeまたはEdgeブラウザで直接開く

### 5. Webビジュアライザーの使用

1. **シリアルポートに接続** ボタンをクリック
2. XIAO nRF52840のポートを選択
3. リアルタイムでデータが表示されます:
   - 3Dモデルがボードの姿勢に合わせて回転
   - 加速度とジャイロのグラフが更新
   - センサー値が数値で表示

## 📊 データフォーマット

シリアル出力は以下のJSON形式です:

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
  "temp": 25.3,  // ℃
  "timestamp": 12345  // ミリ秒
}
```

## 🎨 Webビジュアライザーの機能

### 3Dビジュアライゼーション
- Three.jsを使用した3D表示
- リアルタイムで姿勢（Roll, Pitch, Yaw）を計算
- 相補フィルターによるノイズ除去

### グラフ表示
- Chart.jsを使用したリアルタイムグラフ
- 加速度とジャイロの3軸データを同時表示
- 最大50データポイントを表示

### センサーデータ表示
- 加速度（X, Y, Z軸）
- ジャイロスコープ（X, Y, Z軸）
- 温度
- サンプルレート
- 受信パケット数

## 🔧 トラブルシューティング

### Arduino IDE でボードが見つからない

- USB-Cケーブルがデータ転送対応か確認
- ドライバーが正しくインストールされているか確認
- ボードをリセット（RSTボタンを2回素早く押す）

### IMUセンサーの初期化に失敗

```
ERROR: Failed to initialize LSM6DS3!
```

**原因と対処法:**
- **間違ったボード**: XIAO nRF52840 Sense（Senseあり）を選択しているか確認
- **ライブラリ未インストール**: Seeed_Arduino_LSM6DS3ライブラリをインストール
- **ハードウェア不良**: 別のボードで試す

### Webビジュアライザーで接続できない

**Web Serial API非対応:**
- Chrome または Edge ブラウザを使用
- ブラウザを最新版に更新

**ポートが見つからない:**
- Arduinoのシリアルモニターを閉じる（ポートが占有されている）
- ボードが正しく接続されているか確認

### データが表示されない

- ボーレートが115200になっているか確認
- シリアルモニターでデータが出力されているか確認
- ブラウザのコンソール（F12）でエラーを確認

## 📁 プロジェクト構成

```
Seeed-Studio-XIAO-nRF52840-Sense/
├── XIAO_nRF52840_IMU/
│   └── XIAO_nRF52840_IMU.ino    # Arduinoファームウェア
├── visualizer/
│   ├── index.html                # Webビジュアライザー
│   ├── style.css                 # スタイルシート
│   └── app.js                    # アプリケーションロジック
├── docs/
│   └── SETUP.md                  # 詳細セットアップガイド
└── README.md                     # このファイル
```

## 🎓 技術仕様

### LSM6DS3 IMUセンサー
- **加速度計範囲**: ±2g, ±4g, ±8g, ±16g（デフォルト: ±2g）
- **ジャイロ範囲**: ±125, ±250, ±500, ±1000, ±2000 °/s（デフォルト: ±2000 °/s）
- **サンプリングレート**: 最大1.6 kHz（このプロジェクト: 100 Hz）
- **通信方式**: I2C（アドレス: 0x6A）

### 姿勢推定アルゴリズム
- **相補フィルター**: 加速度計とジャイロのデータを融合
- **フィルター係数**: α = 0.98
- **更新周期**: リアルタイム（約100 Hz）

## 📚 参考資料

- [XIAO nRF52840 Sense Wiki](https://wiki.seeedstudio.com/XIAO_BLE/)
- [LSM6DS3 データシート](https://www.st.com/resource/en/datasheet/lsm6ds3.pdf)
- [Web Serial API ドキュメント](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [Three.js ドキュメント](https://threejs.org/docs/)
- [Chart.js ドキュメント](https://www.chartjs.org/docs/latest/)

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🤝 貢献

バグ報告や機能リクエストは、GitHubのIssuesでお願いします。

## 📧 お問い合わせ

質問や提案がある場合は、Issuesまたはプルリクエストでお知らせください。

---

**Enjoy coding! 🎉**
