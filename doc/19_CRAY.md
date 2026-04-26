# 粘土（Clay）システム設計

> 本ドキュメントは粘土システムの正式仕様を記述する。  
> 水システムについては `10_RIVER.md`、灌漑との関係は `16_IRRIGATION.md`、セーブ仕様については `14_SAVE_SYSTEM.md` を正とし、本書はそれらと整合する形で読むこと。

## 1. 設計方針

### 1.1 背景

- 粘土は炉（粘土×8）・浸漬槽（粘土×2）の建材として必要（doc/11_TOOL.md §8.1）
- 焼きレンガ（石組み導水路の素材）の原料にもなる（doc/16_IRRIGATION.md §6.3）
- 川の堆積作用で再供給される設定で、再生成あり・シャベルで採取

### 1.2 本仕様で決定したこと

- **表現方式**: `dirt` 地形 + `ENTITY_TYPES.clay` エンティティ（既存 stone/tree と同型）
- **水辺の定義**: `y = horizonHeight` の地表タイルで、4近傍（上下左右）のうち少なくとも1つが水（`h < horizonHeight`）となる陸地タイル
  - これは `10_RIVER.md` の**水面＝海面方式**と整合する定義であり、旧来の水源ブロックやフラッドフィル前提ではない
- **水辺は `grass` ではなく `dirt`** にする（地形生成時のルール変更）
- **粘土は大河周辺の水辺にのみ** 初期配置・再生成される（支流には配置しない）
- **再生成方式**: 大河水辺セルのインデックスを `VoxelMap` に保存し、毎日ランダム選択
- **スプライト**: `ss_sprite_086.png`

---

## 2. 水辺の定義と dirt 化

### 2.1 水辺の判定

```
isWaterside(x, z) =
    hm[x, z] == horizonHeight
    AND ∃ (nx, nz) ∈ 4-neighbors of (x, z) where hm[nx, nz] < horizonHeight
```

この判定は、`10_RIVER.md` の「地形の高さが海面未満なら水が存在する」というルールをそのまま利用している。  
したがって、粘土の発生条件は「川・湖・海に隣接する海面高さの陸地」であり、独立した水シミュレーションを必要としない。
```

### 2.2 `createVoxelMap()` の変更

現行ロジック（`src/engine/TerrainGenerator.ts`）:

```
if h >= horizonHeight:
    for y=0..h-1: dirt
    set (x, h, z) = grass
```

変更後:

```
if h >= horizonHeight:
    for y=0..h-1: dirt
    if h == horizonHeight AND 4-neighbor に h < horizonHeight が存在:
        set (x, h, z) = dirt  ← 水辺
    else:
        set (x, h, z) = grass
```

### 2.3 既存機能への影響

- 水辺の `placeEntities` による tree/stone 配置はもともと `grass`/`soil` のみ対象のため、dirt 化により自動的に樹木・石が出現しなくなる（仕様的にも望ましい）
- 水辺の dirt に `hoes` を使っても耕作可能（`GrassDirt.ts` は grass/dirt 両方に同じハンドラを登録済み）

---

## 3. 粘土の初期配置

### 3.1 アルゴリズム

```
function placeClay(voxelMap, hm, majorRivers, opt):
    # Step 1: 大河パスに隣接する水辺セルを列挙
    const riversideSet = new Set<number>()
    for river in majorRivers:
        for idx in river.path:
            for 4近傍 nidx:
                if nidx が範囲内:
                    if hm[nidx] == horizonHeight:   # 水辺
                        riversideSet.add(nidx)

    # Step 2: ランダムに CLAY_RATE の割合で粘土エンティティを配置
    const CLAY_RATE = 0.35
    const rng = alea("clay_initial")
    for idx in riversideSet:
        if rng() < CLAY_RATE:
            pos = { x: idx % W, y: horizonHeight, z: (idx / W) | 0 }
            voxel = voxelMap.get(pos)
            if terrain(voxel) == dirt AND entity(voxel) == none:
                voxelMap.set(voxel | ENTITY_TYPES.clay << 8, pos)

    return Uint32Array.from(riversideSet)   # 再生成レジストリとして VoxelMap へ
```

### 3.2 呼び出し順

```
generateTerrain():
    hm = computeHeightmap(...)
    { major, tributaries } = generateRivers(...)          ← 戻り値を分離
    hm = elodeRiverside(hm, [...major, ...tributaries])
    voxelMap = createVoxelMap(hm, opt)                    ← 水辺 dirt 化
    riversideCells = placeClay(voxelMap, hm, major, opt)  ← 新規
    voxelMap.setRiversideCells(riversideCells)
    placeEntities(voxelMap)
    return voxelMap
```

---

## 4. 粘土の再生成

### 4.1 再生成レジストリ

- `VoxelMap.riversideCells: Uint32Array` — 初期配置時に決まった大河水辺セルのインデックス配列
- 地形生成時に一度確定し、以後変更しない
- セーブデータに含める（`VoxelMapSaveData.riversideCells: Uint32Array`）
- これは voxel 本体とは別の**補助メタデータ**であり、`14_SAVE_SYSTEM.md` の最新セーブ仕様に従って保存・復元する

### 4.2 `regenerateClay(voxelMap)` 仕様

```
export function regenerateClay(voxelMap: VoxelMap): void {
    const REGEN_PER_DAY = 8
    const cells = voxelMap.riversideCells
    if (cells.length === 0) return

    for i = 0 to REGEN_PER_DAY:
        idx = cells[random % cells.length]
        pos = { x: idx % W, y: horizonHeight, z: (idx / W) | 0 }
        voxel = voxelMap.get(pos)
        terrain = getTerrainTypeFromVoxel(voxel)
        entity = getEntityTypeFromVoxel(voxel)

        # 条件: dirt ＋ エンティティなし のみ復活
        if terrain == dirt AND entity == none:
            voxelMap.set(setEntityTypeInVoxel(voxel, ENTITY_TYPES.clay), pos)
}
```

### 4.3 スキップ条件（再生成しない）

| 状態 | 理由 |
|---|---|
| `terrain == soil / wetSoil` | プレイヤーが耕して畑にしている（16_IRRIGATION §6.2） |
| `entity != none` | 既に粘土 or 他のエンティティが載っている |
| `terrain != dirt`（例: dirtアイテムで盛られた、他の地形に変化） | 水辺でなくなった扱い |

### 4.4 トリガ

`App.tsx` で `day_changed` を購読し、既存の `processDailyTick(voxelMap)` に続けて `regenerateClay(voxelMap)` を呼ぶ。

---

## 5. 粘土エンティティの挙動

### 5.1 採取（右クリック + shovel）

- エンティティを消す（dirt テレインはそのまま残る）
- インベントリに `clay` アイテムを 1 個追加
- インベントリ満杯の場合はエンティティを消さず、採取キャンセル

### 5.2 その他ツールの扱い

- `hoes` → 無効（`GrassDirt.ts` がエンティティ有りの場合 false を返すため）
- `axe` / `pickaxe` / `sickle` → 無効（clay エンティティの onInteract で対応ツールのみ処理）

### 5.3 スプライト

- `ss_sprite_086.png` を 1 枚、オフセット `(0, 0)` で描画

---

## 6. データ構造とセーブ

### 6.1 TerrainDefs.ts の変更

```typescript
export const ENTITY_TYPES = {
    // ...
    compost_bin_done: 25,
    clay: 26,  // 新規
} as const;
```

### 6.2 ItemDefs.ts の変更

```typescript
export type ItemId =
    // ...
    | "charcoal"
    | "clay";  // 新規
```

### 6.3 VoxelMap の変更

```typescript
export class VoxelMap {
    // ...
    private riversideCells_: Uint32Array = new Uint32Array(0);

    get riversideCells(): Uint32Array { return this.riversideCells_; }
    setRiversideCells(cells: Uint32Array): void { this.riversideCells_ = cells; }
}
```

### 6.4 SaveSystem の変更

```typescript
export interface VoxelMapSaveData {
    width: number;
    height: number;
    depth: number;
    horizonHeight: number;
    voxels: BigUint64Array;
    riversideCells: Uint32Array;  // 新規
}
```

セーブ時: `voxelMap.riversideCells` をそのまま保存。
ロード時: `voxelMap.setRiversideCells(sd.riversideCells)` で復元。

**互換性**: セーブデータのバージョンを 1 → 2 に上げ、旧バージョンは破棄する（既存方針と同じ）。

補足:
- `14_SAVE_SYSTEM.md` の最新整理では、`VoxelMap` は `BigUint64Array` 前提で扱う
- `riversideCells` は `ChestStorage` や `ForgeStorage` と同様に、ゲーム進行上意味のある永続データとして保存対象に含める
- UI状態や一時的な描画状態は保存対象ではないため、粘土システム側で考慮する必要はない

---

## 7. パラメータ一覧

| パラメータ | 値 | 意味 |
|---|---|---|
| `CLAY_RATE` | 0.35 | 初期配置時に水辺を粘土化する確率 |
| `REGEN_PER_DAY` | 8 | 1 日あたりの再生成試行回数 |
| スプライト | `ss_sprite_086.png` | 粘土エンティティ & 粘土アイテムアイコン |

※ これらの値は、`16_IRRIGATION.md` における「川辺の土地のゾーニング」とも関係する。  
粘土の供給量が多すぎると川辺を粘土採取専用にする意味が薄れ、少なすぎると導水路・炉・浸漬槽の建設が詰まりやすくなるため、プレイ感を見ながら調整する。

いずれもプレイ感を見て調整する。

---

## 8. 実装計画

1. `ENTITY_TYPES.clay` と `ItemId "clay"` の追加
2. `VoxelMap` に `riversideCells` フィールドと getter/setter を追加
3. `TerrainGenerator.ts` を拡張
   - `generateRivers()` の戻り値を `{ major, tributaries }` に変更
   - `createVoxelMap()` で水辺判定 → dirt 化
   - `placeClay()` を新規追加
4. `src/_registry/entities/Clay.ts` を新規作成（エンティティ + アイテム両方を登録）
5. `src/engine/ClaySystem.ts` を新規作成（`regenerateClay`）
6. `src/App.tsx`
   - `import "./_registry/entities/Clay"`
   - `day_changed` ハンドラに `regenerateClay(voxelMap)` を追加
7. `src/lib/SaveSystem.ts`
   - `VoxelMapSaveData` に `riversideCells` を追加
   - `CURRENT_SAVE_VERSION` を 1 → 2 に上げる
   - `App.tsx` のセーブ/ロード処理で往復
8. `bun run build` で検証

---

## 9. 今後の検討事項

- [ ] `CLAY_RATE` と `REGEN_PER_DAY` の最終調整（プレイテスト後）
- [ ] 焼きレンガのレシピ実装（炉 + 粘土 + 木材）— 本ドキュメントの範囲外
- [ ] 粘土が枯渇するようなマップケース（大河が極端に短い等）の扱い
- [ ] 粘土のスタック上限（現在は `maxStack: 64` で想定）
- [ ] `10_RIVER.md` の川生成パラメータ変更時に、粘土の初期配置密度をどう再調整するか
- [ ] `14_SAVE_SYSTEM.md` の今後の拡張（差分保存や複数スロット）に対して `riversideCells` をどう扱うか
