# XIAO-MG24-Sense-Battery ケース設計ガイド

## 概要

このディレクトリには、XIAO-MG24-Sense-Battery基板用のウェアラブルケースの3Dモデルファイルが含まれています。

### ケースの仕様

- **形状**: 角丸四角形（楕円に近い）
- **外形寸法**: 49.5mm × 58mm × 25mm（高さ）
- **内部空間**: 44.5mm × 53mm × 20mm（部品収納用）
- **壁厚**: 2.5mm
- **ベルト取り付け**: 40mm幅のゴムベルト用スロット（水平・垂直両方向対応）
- **固定方法**: M3ネジ × 4本（六角ナット埋め込み式）

### ファイル構成

```
3D-Case/
├── case_design.py          # CadQuery設計スクリプト（パラメトリック）
├── README.md               # このファイル
├── CADQUERY_GUIDE.md       # CadQueryの使い方と調整方法
├── JLCPCB_ORDER_GUIDE.md   # JLCPCB発注手順
└── output/                 # 生成されたファイル（STEP, STL, OBJ）
    ├── XIAO_MG24_Case.step
    ├── XIAO_MG24_Case.stl
    └── XIAO_MG24_Case.obj
```

## クイックスタート

### 1. CadQueryのインストール

```powershell
# Python環境がある場合
pip install cadquery

# CQ-Editor（推奨）をダウンロード
# https://github.com/CadQuery/CQ-editor/releases
# Windows用の実行ファイルをダウンロードして解凍
```

### 2. ケースモデルの生成

#### 方法A: CQ-Editorを使用（推奨）

1. CQ-Editorを起動
2. `case_design.py` を開く
3. 緑色の実行ボタンをクリック
4. 3Dビューでケースを確認
5. メニューから `File > Export` でSTEP/STL形式で保存

#### 方法B: コマンドラインから生成

```powershell
cd "c:\Users\okita\Documents\Antigravity\XIAO-MG24-Sense-Battery\3D-Case"

# Pythonスクリプトを編集してエクスポート行のコメントを外す
# 以下の行を有効化:
# cq.exporters.export(result, "output/XIAO_MG24_Case.step")

python case_design.py
```

### 3. パラメータの調整

`case_design.py` の上部にあるパラメータセクションを編集:

```python
# ケース寸法
WALL_THICKNESS = 2.5      # 壁の厚さ（mm）
INTERNAL_HEIGHT = 20.0    # 内部高さ（mm）
CORNER_RADIUS = 8.0       # 角の丸み（mm）

# ベルトスロット
BELT_WIDTH = 40.0         # ベルト幅（mm）
BELT_THICKNESS = 3.0      # ベルト厚さ（mm）
```

詳細は [CADQUERY_GUIDE.md](CADQUERY_GUIDE.md) を参照してください。

## JLCPCBへの発注

1. `output/XIAO_MG24_Case.step` ファイルを準備
2. [JLCPCB 3Dプリントサービス](https://cart.jlcpcb.com/quote?orderType=3d) にアクセス
3. STEPファイルをアップロード
4. 材質・色・仕上げを選択
5. 見積もりを確認して注文

詳細な手順は [JLCPCB_ORDER_GUIDE.md](JLCPCB_ORDER_GUIDE.md) を参照してください。

## 組み立て方法

### 必要な部品

- 3Dプリントされたケース × 1個
- M3ネジ（長さ: 底面厚2.5mm + PCB厚1.6mm + ナット厚2.4mm = 約8-10mm推奨）× 4本
- M3六角ナット × 4個
- 40mm幅ゴムベルト（腕時計用など）

### 組み立て手順

1. **ナットの埋め込み**
   - ケース底面の六角形の窪みにM3ナットを押し込む
   - 4箇所すべてにナットをセット

2. **PCBの取り付け**
   - PCBをケース内部に配置
   - 4つの取り付け穴を合わせる
   - 上からM3ネジで固定

3. **ベルトの取り付け**
   - 40mm幅のゴムベルトをスロットに通す
   - 水平方向（左右）または垂直方向（前後）のスロットを使用
   - 腕や足のサイズに合わせてベルトを調整

## トラブルシューティング

### ネジ穴が合わない

- `case_design.py` の `HOLE_POSITIONS` を確認
- PCBの実際の取り付け穴位置と一致しているか確認

### ベルトが通らない

- `BELT_WIDTH` と `BELT_CLEARANCE` を増やす
- 推奨: `BELT_CLEARANCE = 1.0` に変更

### 部品が収まらない

- `INTERNAL_HEIGHT` を増やす（例: 22mm, 25mm）
- `TOTAL_HEIGHT` も同時に調整

## 無料の編集ソフトウェア

### CQ-Editor（推奨）
- **用途**: CadQueryスクリプトの編集・実行
- **ダウンロード**: https://github.com/CadQuery/CQ-editor/releases
- **利点**: パラメトリック編集が簡単、リアルタイムプレビュー

### FreeCAD
- **用途**: STEPファイルの閲覧・編集
- **ダウンロード**: https://www.freecad.org/downloads.php
- **利点**: 完全無料、STEPファイルのパラメトリック編集可能

### Blender
- **用途**: STL/OBJファイルの編集、レンダリング
- **ダウンロード**: https://www.blender.org/download/
- **利点**: 既に経験がある、高度なモデリング機能

詳細な使い方は [CADQUERY_GUIDE.md](CADQUERY_GUIDE.md) を参照してください。

## ライセンス

このケース設計はオープンソースです。自由に改変・再配布できます。
