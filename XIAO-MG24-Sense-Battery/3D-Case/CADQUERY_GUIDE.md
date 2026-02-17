# CadQuery 使い方ガイド

## CadQueryとは

CadQueryは、Pythonコードで3Dモデルを作成できるパラメトリックCADライブラリです。コードでモデルを定義するため、寸法の変更や調整が非常に簡単です。

## インストール方法

### 方法1: CQ-Editor（推奨）

最も簡単な方法は、CQ-Editorという統合環境を使用することです。

1. **ダウンロード**
   - https://github.com/CadQuery/CQ-editor/releases
   - Windows用: `CQ-editor-Windows-x64-3.x.x.zip` をダウンロード

2. **インストール**
   - ZIPファイルを解凍
   - `CQ-editor.exe` を実行

3. **使い方**
   - `File > Open` で `case_design.py` を開く
   - 緑色の実行ボタン（▶）をクリック
   - 右側の3Dビューでモデルを確認

### 方法2: Python環境にインストール

既存のPython環境がある場合:

```powershell
pip install cadquery
pip install cadquery-ocp  # 3Dカーネル
```

## パラメータの調整方法

### 基本的な調整

`case_design.py` を開き、以下のセクションを編集します:

```python
# ============================================================================
# PARAMETERS - Adjust these values to customize the case
# ============================================================================
```

### よく調整するパラメータ

#### 1. ケースのサイズ調整

```python
# 壁の厚さを変更（強度を上げたい場合）
WALL_THICKNESS = 3.0  # デフォルト: 2.5mm

# 内部の高さを変更（部品が収まらない場合）
INTERNAL_HEIGHT = 22.0  # デフォルト: 20mm

# 全体の高さを変更
TOTAL_HEIGHT = 27.0  # デフォルト: 25mm
```

#### 2. 角の丸みを調整

```python
# より丸くしたい場合
CORNER_RADIUS = 10.0  # デフォルト: 8mm

# 角ばった形にしたい場合
CORNER_RADIUS = 5.0
```

#### 3. ベルトスロットの調整

```python
# ベルト幅を変更（太いベルトを使う場合）
BELT_WIDTH = 45.0  # デフォルト: 40mm

# ベルト厚さを変更
BELT_THICKNESS = 4.0  # デフォルト: 3mm

# クリアランスを増やす（きつい場合）
BELT_CLEARANCE = 1.0  # デフォルト: 0.5mm
```

#### 4. ネジ穴の調整

```python
# ネジ穴を大きくする（ネジが通らない場合）
SCREW_HOLE_DIAMETER = 3.5  # デフォルト: 3.2mm

# ナットの窪みを深くする
HEX_NUT_DEPTH = 3.0  # デフォルト: 2.9mm
```

### 取り付け穴の位置を変更

PCBの取り付け穴位置が異なる場合:

```python
# 相対座標で指定（左下の穴を原点とする）
HOLE_POSITIONS = [
    (0, 0),           # 左下
    (0, 44),          # 左上
    (36.5, 44),       # 右上
    (36.5, 0),        # 右下
]
```

## ファイルのエクスポート

### CQ-Editorから

1. モデルを表示した状態で `File > Export` を選択
2. ファイル形式を選択:
   - **STEP**: JLCPCB用（推奨）
   - **STL**: 3Dプリンター用
   - **OBJ**: Blender用
3. `output` フォルダに保存

### Pythonスクリプトから

`case_design.py` の最後の部分のコメントを外す:

```python
# Export to STEP format (for JLCPCB)
cq.exporters.export(result, "output/XIAO_MG24_Case.step")

# Export to STL format (for 3D printing preview)
cq.exporters.export(result, "output/XIAO_MG24_Case.stl")

# Export to OBJ format (for Blender)
cq.exporters.export(result, "output/XIAO_MG24_Case.obj")
```

そして実行:

```powershell
cd "c:\Users\okita\Documents\Antigravity\XIAO-MG24-Sense-Battery\3D-Case"
python case_design.py
```

## 高度なカスタマイズ

### ベルトスロットの位置を変更

`add_belt_slots()` 関数内の `slot_z_position` を調整:

```python
# スロットを上の方に移動
slot_z_position = BOTTOM_THICKNESS + INTERNAL_HEIGHT * 0.7

# スロットを下の方に移動
slot_z_position = BOTTOM_THICKNESS + INTERNAL_HEIGHT * 0.3
```

### 水平スロットのみ/垂直スロットのみにする

不要なスロットの `case = case.cut(...)` 行をコメントアウト:

```python
# 水平スロットのみ（左右）
case = case.cut(horizontal_slot_left)
case = case.cut(horizontal_slot_right)
# case = case.cut(vertical_slot_front)  # コメントアウト
# case = case.cut(vertical_slot_back)   # コメントアウト
```

### 蓋（リッド）を追加

現在のデザインは底面のみですが、蓋を追加する場合:

```python
def create_lid():
    """Create a removable lid for the case."""
    lid_thickness = 2.0
    
    lid = (
        cq.Workplane("XY")
        .box(CASE_WIDTH, CASE_LENGTH, lid_thickness, centered=(True, True, False))
        .edges("|Z")
        .fillet(CORNER_RADIUS)
    )
    
    return lid

# メイン部分に追加
lid = create_lid()
show_object(lid)
```

## トラブルシューティング

### エラー: "No module named 'cadquery'"

```powershell
pip install cadquery
```

### エラー: "show_object is not defined"

- CQ-Editorで実行してください
- または、`show_object(result)` の行をコメントアウトしてエクスポートのみ実行

### モデルが表示されない

1. CQ-Editorで実行ボタン（▶）を押したか確認
2. エラーメッセージを確認（下部のコンソール）
3. Pythonの構文エラーがないか確認

### エクスポートしたファイルが開けない

- **STEP**: FreeCAD、Fusion 360、SolidWorksなどで開く
- **STL**: Blender、MeshLab、Curaなどで開く
- **OBJ**: Blender、3ds Maxなどで開く

## 参考リンク

- **CadQuery公式ドキュメント**: https://cadquery.readthedocs.io/
- **CQ-Editor GitHub**: https://github.com/CadQuery/CQ-editor
- **チュートリアル**: https://cadquery.readthedocs.io/en/latest/examples.html
- **コミュニティ**: https://github.com/CadQuery/cadquery/discussions

## 次のステップ

1. パラメータを調整してモデルを確認
2. STEPファイルをエクスポート
3. [JLCPCB_ORDER_GUIDE.md](JLCPCB_ORDER_GUIDE.md) を参照して発注
