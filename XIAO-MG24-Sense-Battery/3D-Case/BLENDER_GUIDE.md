# Blender編集ガイド

## BlenderでSTEP/STLファイルを開く

Blenderは既に経験があるとのことなので、XIAO-MG24-Sense-Batteryケースの3Dモデルを編集する方法を説明します。

## ファイルのインポート

### STLファイルをインポート

1. Blenderを起動
2. デフォルトのキューブを削除（`X` → `Delete`）
3. `File > Import > Stl (.stl)` を選択
4. `output/XIAO_MG24_Case.stl` を選択
5. `Import STL` をクリック

### STEPファイルをインポート（アドオン必要）

Blenderは標準ではSTEPファイルに対応していませんが、以下の方法で開けます:

#### 方法1: FreeCADで変換

1. FreeCADで `XIAO_MG24_Case.step` を開く
2. `File > Export` → `STL Mesh (*.stl)` を選択
3. Blenderで開く

#### 方法2: CAD Sketcher アドオン（有料）

- https://www.cadsketcher.com/
- STEP/IGESファイルを直接インポート可能

#### 方法3: OBJファイルを使用

1. `export_case.py` でOBJファイルを生成
2. Blenderで `File > Import > Wavefront (.obj)` を選択
3. `output/XIAO_MG24_Case.obj` をインポート

## 基本的な編集

### スケールの確認

インポート後、サイズが正しいか確認:

1. オブジェクトを選択
2. `N` キーでプロパティパネルを表示
3. `Dimensions` を確認:
   - X: 49.5mm (0.0495m)
   - Y: 58mm (0.058m)
   - Z: 25mm (0.025m)

### 編集モードに入る

1. オブジェクトを選択
2. `Tab` キーで編集モードに切り替え
3. 頂点・辺・面を選択して編集

### よくある編集

#### 角の丸みを調整

STLファイルは既にメッシュ化されているため、角の丸みを変更するには:

1. 編集モードで角の頂点を選択
2. `Alt + S` でスムーズ/シャープ調整
3. または `Modifier > Subdivision Surface` を追加

#### ベルトスロットのサイズ変更

1. 編集モードでスロット部分の面を選択
2. `S` キー → `X` または `Y` でスケール
3. `G` キーで移動

#### 壁の厚さを変更

1. `Modifier > Solidify` を追加
2. `Thickness` を調整
3. `Apply` で確定

## 高度な編集

### ブーリアン演算で穴を追加

新しい穴やスロットを追加する場合:

1. `Shift + A` → `Mesh > Cube` で立方体を追加
2. 穴を開けたい位置に移動・スケール
3. ケースオブジェクトを選択
4. `Modifier > Boolean` を追加
5. `Operation: Difference` を選択
6. `Object` で立方体を選択
7. `Apply` で確定

### テキストやロゴを追加

1. `Shift + A` → `Text` でテキストを追加
2. 編集モードで文字を入力
3. `Object > Convert to > Mesh` でメッシュ化
4. ブーリアン演算でケースに埋め込む

### スムーズシェーディング

表面を滑らかに見せる:

1. オブジェクトモードでケースを選択
2. 右クリック → `Shade Smooth`
3. または `Object > Shade Smooth`

## エクスポート

### STLファイルとして保存（3Dプリント用）

1. `File > Export > Stl (.stl)`
2. ファイル名を入力
3. `Export STL` をクリック

### OBJファイルとして保存

1. `File > Export > Wavefront (.obj)`
2. ファイル名を入力
3. `Export OBJ` をクリック

## 注意点

### メッシュの品質

- STLファイルはポリゴンメッシュなので、細かい調整は難しい
- パラメトリックな変更は `case_design.py` で行う方が簡単
- Blenderは主に視覚的な確認や装飾的な追加に使用

### 単位の設定

Blenderはデフォルトでメートル単位:
- 1 Blender Unit = 1m
- ケースは約0.05m × 0.06m × 0.025m

### 3Dプリント用の確認

エクスポート前に確認:

1. `3D Print Toolbox` アドオンを有効化
2. `Edit > Preferences > Add-ons` で検索
3. `3D-Print Toolbox` にチェック
4. サイドバー（`N`キー）に `3D-Print` タブが表示される
5. `Check All` でメッシュの問題を確認

## CadQueryとの使い分け

| 作業 | CadQuery | Blender |
|------|----------|---------|
| 寸法の変更 | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 穴の位置変更 | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 装飾的な追加 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| テキスト追加 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| レンダリング | ⭐ | ⭐⭐⭐⭐⭐ |
| 視覚的確認 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**推奨ワークフロー**:
1. CadQueryで基本設計とパラメータ調整
2. Blenderで視覚的確認と装飾追加
3. STLエクスポートしてJLCPCBへ発注

## 参考リンク

- **Blender公式**: https://www.blender.org/
- **3D Print Toolbox**: https://docs.blender.org/manual/en/latest/addons/mesh/3d_print_toolbox.html
- **Blender for 3D Printing**: https://www.blender.org/features/modeling/
