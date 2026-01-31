# セットアップガイド

このガイドでは、XIAO nRF52840 Sense IMUプロジェクトのセットアップ手順を詳しく説明します。

## 目次

1. [Arduino IDE のインストール](#1-arduino-ide-のインストール)
2. [ボードサポートの追加](#2-ボードサポートの追加)
3. [ライブラリのインストール](#3-ライブラリのインストール)
4. [ファームウェアのアップロード](#4-ファームウェアのアップロード)
5. [Webビジュアライザーのセットアップ](#5-webビジュアライザーのセットアップ)

---

## 1. Arduino IDE のインストール

### Windows

1. [Arduino公式サイト](https://www.arduino.cc/en/software)にアクセス
2. **Windows Win 10 and newer** をダウンロード
3. インストーラーを実行し、指示に従ってインストール

### macOS

1. [Arduino公式サイト](https://www.arduino.cc/en/software)にアクセス
2. **macOS Intel** または **macOS Apple Silicon** をダウンロード
3. `.dmg` ファイルを開き、Applicationsフォルダにドラッグ

### Linux

```bash
# Ubuntuの場合
sudo apt update
sudo apt install arduino

# または公式サイトからダウンロード
wget https://downloads.arduino.cc/arduino-ide/arduino-ide_latest_Linux_64bit.AppImage
chmod +x arduino-ide_latest_Linux_64bit.AppImage
./arduino-ide_latest_Linux_64bit.AppImage
```

---

## 2. ボードサポートの追加

XIAO nRF52840 Senseを使用するには、Seeed nRF52ボードサポートを追加する必要があります。

### 手順

1. Arduino IDE を起動

2. **ファイル** → **環境設定**（macOSでは **Arduino IDE** → **Preferences**）を開く

3. **追加のボードマネージャのURL** フィールドに以下のURLを追加:
   ```
   https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json
   ```
   
   > **Note**: 既に他のURLが入力されている場合は、カンマで区切って追加してください。

4. **OK** をクリック

5. **ツール** → **ボード** → **ボードマネージャ** を開く

6. 検索ボックスに `Seeed nRF52` と入力

7. **Seeed nRF52 Boards** を見つけて **インストール** をクリック

8. インストールが完了するまで待つ（数分かかる場合があります）

### 確認

**ツール** → **ボード** → **Seeed nRF52 Boards** に **Seeed XIAO nRF52840 Sense** が表示されていることを確認してください。

---

## 3. ライブラリのインストール

LSM6DS3 IMUセンサーを使用するには、専用のライブラリが必要です。

### 手順

1. **スケッチ** → **ライブラリをインクルード** → **ライブラリを管理** を開く

2. 検索ボックスに `LSM6DS3` と入力

3. **Seeed_Arduino_LSM6DS3** by Seeed Studio を見つける

4. **インストール** をクリック

5. 依存関係のインストールを求められた場合は **Install All** をクリック

### 確認

**スケッチ** → **ライブラリをインクルード** のリストに **LSM6DS3** が表示されていることを確認してください。

---

## 4. ファームウェアのアップロード

### 手順

1. XIAO nRF52840 SenseをUSB-Cケーブルでパソコンに接続

2. Arduino IDE で `XIAO_nRF52840_IMU/XIAO_nRF52840_IMU.ino` を開く

3. **ツール** メニューで以下を設定:
   - **ボード**: Seeed nRF52 Boards → **Seeed XIAO nRF52840 Sense**
   - **シリアルポート**: 適切なCOMポート（Windows: COM3など、macOS: /dev/cu.usbmodem*、Linux: /dev/ttyACM*）

4. **アップロード** ボタン（→）をクリック

5. コンパイルとアップロードが完了するまで待つ

### トラブルシューティング

#### ポートが見つからない

**Windows:**
```
デバイスマネージャーを開き、「ポート (COM と LPT)」を確認
```

**macOS/Linux:**
```bash
ls /dev/cu.* # macOS
ls /dev/ttyACM* # Linux
```

#### アップロードに失敗する

1. ボードのRSTボタンを2回素早く押してブートローダーモードに入る
2. 再度アップロードを試す

---

## 5. Webビジュアライザーのセットアップ

Webビジュアライザーを使用するには、ローカルWebサーバーを起動する必要があります。

### 方法1: Python（最も簡単）

#### Python 3がインストールされているか確認

```bash
python --version
# または
python3 --version
```

#### サーバーを起動

```bash
cd visualizer
python -m http.server 8000
# または
python3 -m http.server 8000
```

#### ブラウザで開く

```
http://localhost:8000
```

### 方法2: Node.js

#### Node.jsがインストールされているか確認

```bash
node --version
```

#### http-serverを使用

```bash
cd visualizer
npx -y http-server -p 8000
```

#### ブラウザで開く

```
http://localhost:8000
```

### 方法3: 直接ファイルを開く

Chrome または Edge ブラウザで `visualizer/index.html` を直接開くこともできます。

**注意**: ファイルプロトコル（`file://`）では一部の機能が制限される場合があります。

---

## 動作確認

### シリアルモニターでの確認

1. Arduino IDE で **ツール** → **シリアルモニタ** を開く
2. ボーレートを **115200** に設定
3. JSON形式のデータが表示されることを確認:
   ```json
   {"accel":{"x":0.123,"y":-0.045,"z":9.812},"gyro":{"x":0.012,"y":-0.023,"z":0.001},"temp":25.3,"timestamp":12345}
   ```

### Webビジュアライザーでの確認

1. ブラウザで `http://localhost:8000` を開く
2. **シリアルポートに接続** ボタンをクリック
3. XIAO nRF52840のポートを選択
4. 以下が表示されることを確認:
   - 3Dモデルが表示される
   - センサーデータが更新される
   - グラフが動く

---

## 次のステップ

セットアップが完了したら、以下を試してみてください:

1. **ボードを動かす**: 3Dモデルが追従することを確認
2. **データを観察**: 加速度とジャイロの値の変化を観察
3. **コードをカスタマイズ**: サンプリングレートや表示方法を変更

---

## サポート

問題が発生した場合は、[README.md](../README.md)のトラブルシューティングセクションを参照してください。
