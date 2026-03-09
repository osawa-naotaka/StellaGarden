# 川と水のシステム設計

## 1. 設計方針

### 1.1 背景

川はゲーム内の主要な動力源（水車）であり、灌漑の要でもある。プレイヤーが土地を削ったり盛ったりできるため、川の水が地形変更に応じて自然に振る舞う仕組みが必要になる。

### 1.2 採用方針

**水源永続＋フラッドフィル方式**を採用する（04_FEASIBILITY_STUDY.md の案E）。

- 水源は破壊不能な特殊ブロックとして地形生成時に配置
- 水源から低い方へフラッドフィル（BFS）で水が広がる
- 地形変更時にフラッドフィルを再計算し、水の広がりを更新
- 窪地は水で満たされる（Depression Filling）

詳細な検討経緯は 04_FEASIBILITY_STUDY.md「川と水のシステム設計」セクションを参照。

---

## 2. 地形生成時の川生成アルゴリズム

### 2.1 全体フロー

```
1. ハイトマップ生成（既存・シンプレックスノイズ）
2. ハイトマップ → ボクセル書き込み（既存）
3. ★ 川パス生成（既存の貪欲ウォークを流用）
4. ★ 高さプロファイルの単調減少化
5. ★ 渓谷カービング（パスに沿って地形を掘り下げ）
6. ★ 水源ブロック配置（各川の春点に配置）
7. ★ フラッドフィルで水タイル配置
8. 樹木配置（既存・川の後に実行）
```

ステップ3は既存の貪欲ウォークをそのまま流用する。既存アルゴリズムは「目標までの距離 + ノイズ値」のスコアで次セルを選ぶ方式で、自然な蛇行を生成できている。

他の手法（海→上流方式）も検討したが、「上流に向かって伸ばす」際の方向選択基準の設計が難しく、不自然な結果になりやすいため不採用とした。

### 2.2 ステップ3: 川パス生成（既存アルゴリズムの流用）

既存の貪欲ウォーク（bigbadwofl方式）をそのまま使用する。

1. 高地の上位30%からランダムに春点（水源位置）を選択
2. 各春点から最寄りの海岸／海セルへ向かって貪欲ウォーク
3. `score = 目標までの距離 + ノイズ値 × 重み` で次セルを選択
4. 結果としてパス配列 `path = [p0, p1, ..., pN]`（春点→海岸）が得られる

**変更点**: 既存コードではパスのセルを直接水タイルに変換していたが、新方式ではパスを中間データとして保持し、後続ステップで渓谷カービングと水配置に使う。

### 2.3 ステップ4: 高さプロファイルの単調減少化

貪欲ウォークは大域的には下るが、局所的に登りが発生しうる。これを2パスの走査で補正する。

```
入力: path[0..N], heightmap hm[]

// パス上の各セルの高さを取得
for i = 0 to N:
    pathHeight[i] = hm[path[i]]

// パス1: 後方→前方走査
// 「これ以降の最小高さ」を各セルに設定し、先に下がった後に登る箇所を除去
minSoFar = seaLevel
for i = N to 0:
    pathHeight[i] = min(pathHeight[i], minSoFar)
    minSoFar = pathHeight[i]

// パス2: 前方走査で単調減少を保証
// 前のセルより高い箇所を前のセルの高さに揃える
for i = 1 to N:
    if pathHeight[i] > pathHeight[i-1]:
        pathHeight[i] = pathHeight[i-1]
```

補正後の `pathHeight` は春点から海岸に向かって単調減少するプロファイルとなる。

### 2.4 ステップ5: 渓谷カービング

パスに沿って地形を掘り下げ、自然な谷を形成する。

#### 川底のカービング

```
for each cell index i in path:
    (x, z) = coordinates of path[i]
    riverBedHeight = pathHeight[i]

    // 地形が川底より高い場合、掘り下げる
    if hm[z * W + x] > riverBedHeight:
        hm[z * W + x] = riverBedHeight
```

#### 谷壁のカービング

川の周囲にも傾斜をつけ、自然な渓谷を形成する。

```
定数:
    VALLEY_RADIUS = 4        // 谷壁の影響範囲（セル数）
    VALLEY_SLOPE  = 1.5      // 谷壁の傾斜（1セルあたりの高さ増加）

for each cell index i in path:
    (px, pz) = coordinates of path[i]
    riverBedHeight = pathHeight[i]

    for each (nx, nz) within VALLEY_RADIUS of (px, pz):
        dist = euclidean distance from (nx, nz) to nearest path cell
        valleyFloor = riverBedHeight + dist * VALLEY_SLOPE

        idx = nz * W + nx
        if hm[idx] > valleyFloor:
            hm[idx] = valleyFloor
```

**「nearest path cell」の計算**: パスの全セルとの距離を毎回計算するのはコストが高い。実装上は、各パスセルについて周囲 VALLEY_RADIUS 内のセルを走査し、既に掘られた値より低い場合のみ更新する方式で十分。

```
for each cell index i in path:
    (px, pz) = coordinates of path[i]
    riverBedHeight = pathHeight[i]

    for dx = -VALLEY_RADIUS to +VALLEY_RADIUS:
        for dz = -VALLEY_RADIUS to +VALLEY_RADIUS:
            (nx, nz) = (px + dx, pz + dz)
            if out of bounds: continue

            dist = sqrt(dx*dx + dz*dz)
            if dist > VALLEY_RADIUS: continue

            valleyFloor = riverBedHeight + dist * VALLEY_SLOPE
            idx = nz * W + nx
            if hm[idx] > valleyFloor:
                hm[idx] = valleyFloor
```

#### カービング後のボクセル再書き込み

ハイトマップを変更した後、影響範囲のボクセルを再書き込みする。これは既存の `writeHeightmap` と同様の処理で、変更があったセルのみ対象とする。

### 2.5 ステップ6: 水源ブロック配置

各川の春点に水源ブロックを配置する。

```
for each spring in springs:
    (x, z) = coordinates of spring
    y = pathHeight[0]  // 春点の高さ（カービング後）
    map.set(TERRAIN_TYPES.waterSource, { x, y, z })
```

水源ブロックは以下の性質を持つ：
- 破壊不能（プレイヤーのシャベル等で除去できない）
- 上に土を盛ることもできない
- フラッドフィルの起点として機能する

### 2.6 ステップ7: フラッドフィルで水タイル配置

水源から水を広げて川と湖を形成する。

#### フラッドフィルの選択肢

フラッドフィルには2つの手法がある。

**選択肢A: 下りのみ伝播**

水は隣接する自分以下の高さにのみ広がる。窪地に到達しても水位は上がらない。

```
queue = [全水源の位置]
visited = Set()

while queue not empty:
    cell = queue.dequeue()
    for each neighbor of cell:
        if visited(neighbor): continue
        if terrainHeight(neighbor) <= waterLevel(cell):
            placeWater(neighbor)
            visited.add(neighbor)
            queue.enqueue(neighbor)
```

- 実装が最も簡単（単純BFS）
- 渓谷は単調減少に掘られているため、川の流れとしては十分機能する
- ダムで水を溜めるゲームプレイには対応できない

**選択肢B: 窪地充填あり（Depression Filling）← 採用**

窪地に到達した水は、出口（rim）の高さまで溜まる。これにより、プレイヤーがダムを作って水を溜める、掘った穴に水が溜まる、といった自然な挙動が実現できる。

```
function floodFillWithDepression(sources):
    pq = MinPriorityQueue()    // 低い高さ優先
    waterLevel = new Map()     // 各セルの水面高さ
    visited = Set()

    // 全水源をキューに投入
    for each source:
        pq.push(source.pos, source.groundHeight)
        waterLevel[source.pos] = source.groundHeight
        visited.add(source.pos)

    while pq not empty:
        (cell, level) = pq.popMin()

        for each neighbor of cell:
            if visited(neighbor): continue
            visited.add(neighbor)

            groundH = terrainHeight(neighbor)
            // 水面は「流入元の水面」と「地面の高さ」の高い方
            newLevel = max(groundH, level)
            waterLevel[neighbor] = newLevel

            // 地面より水面が高い = 水で満たされている
            if newLevel > groundH:
                placeWater(neighbor, surface = newLevel)

            pq.push(neighbor, newLevel)
```

選択肢Bを採用する理由：
- ダムや堰で水を溜めるゲームプレイは自動化システム設計（堰＋導水路）の前提
- プレイヤーが掘った穴に水が自然に溜まる挙動は直感的
- 計算コストは O(N log N) で、400×400 = 160,000セルでも数十ミリ秒で完了
- 渓谷が適切にカービングされていれば、結果は選択肢Aとほぼ同じ（窪地がなければ差が出ない）

#### フラッドフィルの適用範囲

**地形生成時**: マップ全体に対してフラッドフィルを1回実行。

**ゲーム中（地形変更時）**: 変更箇所の周辺のみ局所的に再計算。具体的には：
1. 変更箇所を含むチャンクと隣接チャンクの水タイルを除去
2. その範囲内の水源を起点にフラッドフィルを再実行
3. 範囲外から流入する水は、範囲境界に水タイルがあればそこも起点に追加

局所再計算の詳細設計は実装フェーズで決定する。

---

## 3. テレインタイプの追加

### 3.1 水源タイル（waterSource）

`TERRAIN_TYPES` に新しいタイプを追加する。

```typescript
// engine/TerrainDefs.ts に追加
waterSource: <エンコード値>
```

水源タイルの性質：
- 描画は水タイル（water）と同じスプライトを使用（または水源であることを示す微妙な視覚的差異を追加）
- `InteractionSystem` で操作対象外（シャベル等で除去不可）
- フラッドフィルの起点として認識される

### 3.2 水タイル（water）の扱い変更

既存の水タイル（water）は「フラッドフィルによって配置された水」として扱う。

- 地形変更時にフラッドフィルで再計算され、追加・除去される
- プレイヤーが直接操作することはできない（掘る・盛るの対象外）
- プレイヤーが水を除去したい場合は、堤防を作って水の流れを遮断する

---

## 4. ゲーム中の水の再計算

### 4.1 トリガー

以下の操作が行われた場合に水の再計算を実行する：

- `terrain_changed` イベント発生時（土を掘る・盛る）
- 将来的に堰・水門の開閉時

### 4.2 再計算のフロー

```
1. terrain_changed イベントを受信
2. 変更箇所の周辺の水タイルを除去（水源は除去しない）
3. 周辺の水源を収集
4. 水源を起点にフラッドフィル（Depression Filling）を再実行
5. 結果に基づいて水タイルを配置/除去
6. 変更があったセルについて terrain_changed イベントを発行（描画更新用）
```

### 4.3 パフォーマンス考慮

- プレイヤーは1タイルずつ操作するため、再計算の頻度は低い
- 局所再計算により、影響範囲外のセルは再計算しない
- 必要に応じてデバウンス（短時間に複数の地形変更があった場合にまとめて再計算）を導入可能

---

## 5. 水車との連携（概要）

水車の動力計算は将来の実装だが、川システムとの連携点を明記しておく。

- 水車は水タイルに隣接して設置する
- 動力は水の「落差」に比例する：隣接する水タイル間の高低差が大きいほど動力が大きい
- 水源に近い上流ほど落差が大きく、下流（海に近い平坦な部分）ほど落差が小さい
- 堰で水位を上げることで、堰の下流側に大きな落差を人工的に作り出せる

---

## 6. 今後の検討事項

- [ ] `TERRAIN_TYPES.waterSource` のエンコード値の決定
- [ ] 水源タイルのスプライト（水と区別するか、同一にするか）
- [ ] 渓谷カービングのパラメータ調整（VALLEY_RADIUS, VALLEY_SLOPE）
- [ ] フラッドフィルの局所再計算の範囲決定アルゴリズム
- [ ] 複数の川が合流する場合の処理（パスが交差した場合）
- [ ] 水タイルのスプライトに流れの方向を持たせるかどうか
- [ ] 堰・水門ブロックのフラッドフィルでの扱い（壁として機能する特殊タイル）
- [ ] ノーリア（揚水装置）の仕様設計
