# Registry パターン設計書

> **目的**: エンティティ・アイテム・地形の振る舞いをそれぞれ1定義1ファイルに集約し、メンテナンス性を向上させる。
> **ステータス**: 全 Registry 移行完了（EntityRegistry / ItemRegistry / TerrainRegistry）

---

## 背景と課題

### 移行前の問題点

エンティティの振る舞いが複数ファイルの巨大 switch 文に分散していた:

| ファイル | 責務 | 問題 |
|---|---|---|
| `input/InteractionSystem.ts` | インタラクション（植え付け・収穫・伐採等） | ~440行の switch。作物ごとにほぼ同一のロジックがコピペされていた |
| `view/renderer/TerrainSpriteResolver.ts` | スプライト解決 | エンティティ追加のたびに case が増えていた |
| `engine/CropSystem.ts` | 日次処理（成長・水切れ・枯死） | 汎用ロジックだが、将来エンティティ固有の日次処理が必要になる |

### 移行後の成果

- `InteractionSystem.ts`: **~440行 → 58行**。switch 文を完全除去し、4パスディスパッチのみに
- `TerrainSpriteResolver.ts`: エンティティスプライトは全て EntityRegistry 経由。個別 case は Registry 呼び出しに統合
- 新要素追加は `_registry/` に1ファイル追加 + App.tsx で import するだけ

### 将来の要件

`doc/11_TOOL.md` に記載された将来のエンティティは、現在の作物とは根本的に異なるロジックを持つ:

- **炭焼き窯**: 使い捨て施設。着火後に時間経過で変化し、最終的に消滅して木炭を生成
- **炉**: 複数ステップの鍛造プロセス。アイテム投入 → 加熱 → 金床で成形
- **焚き火**: アイテム投入 → 別アイテム生産（木材 → 草木灰）

これらはデータテーブルでは表現しきれず、エンティティごとに固有のロジックが必要。

---

## 設計

### Registry の位置づけ

```
src/
  _boundary/            ← モジュール間インターフェース定義（既存）
  _registry/            ← 振る舞い定義の集約
    EntityRegistry.ts   ← エンティティ定義の型 + 登録/取得 API
    ItemRegistry.ts     ← アイテム使用定義の型 + 登録/取得 API
    TerrainRegistry.ts  ← 地形インタラクション定義の型 + 登録/取得 API
    facilityUtil.ts     ← 施設撤去の共有ユーティリティ
    entities/           ← 各エンティティの定義ファイル
      Potato.ts, Tree.ts, Workbench.ts, Forge.ts, Stone.ts, ...
      facilities.ts     ← axe 撤去のみの施設を一括登録
    items/              ← 各アイテム使用の定義ファイル
      Fertilizers.ts, Dirt.ts, WateringCan.ts, ...
    terrains/           ← 各地形インタラクションの定義ファイル
      GrassDirt.ts, SoilWetSoil.ts, ...
  engine/
  view/
  input/
  lib/
```

`_registry/` は `_boundary/` と同格の共有領域であり、全モジュールから参照可能。

- `_boundary/` = モジュール間の **通信インターフェース**（型・イベント・定数）
- `_registry/` = エンティティ・アイテム・地形の **振る舞い定義**（スプライト・ロジック・パラメータ）

### 3つの Registry の役割分担

| Registry | 管理対象 | キー | 主な責務 |
|---|---|---|---|
| EntityRegistry | 地図上のエンティティ（作物・施設・木・石） | `entityType` | スプライト解決 + onInteract（対象が自分の時） |
| ItemRegistry | ワールドに使用するアイテム（植え付け・肥料・水やり等） | `itemId` | onItemUse（アイテムをワールドに使用する時） |
| TerrainRegistry | 地形タイプに対する操作（掘る・耕す等） | `terrainType` | onInteract（この地形タイプが操作対象の時） |

**ディスパッチ順序（3パス）:**
```
パス1: EntityRegistry — エンティティベース（entityType で引く）
  → 例: 成熟した potato を shovel で収穫、workbench を右クリックでクラフトUI
パス2: ItemRegistry — アイテムベース（tool の itemId で引く）
  → 例: potato アイテムで soil に植え付け、compost で施肥、watering_can で水やり
パス3: TerrainRegistry — 地形ベース（terrainType で引く）
  → 例: shovel で grass/dirt を掘削、hoes で grass → soil
```

**同名の区別:**
- `TERRAIN_TYPES.dirt` = 地形としての土（TerrainRegistry が管理）
- `ItemId "dirt"` = インベントリアイテムとしての土ブロック（ItemRegistry が管理）
- これらは別概念であり、異なる Registry に登録される

### スプライト解決の責務分離

| 対象 | スプライト解決 | 理由 |
|---|---|---|
| エンティティ | EntityRegistry（`getSprites`） | 中心1タイルの voxel → スプライト。シンプル |
| 地形 | TerrainSpriteResolver.ts に残す | 近傍9タイルの高さパターン + 遷移テーブル依存。地形タイプ間で相互依存あり（soil は grass ベース + オーバーレイ等）。Registry 化すると共有ロジックの配置が複雑化する |

地形スプライトは将来スプライトシステム自体をリファクタリングする際に改めて検討する。

### EntityDef 型設計

```typescript
export type EntitySpriteInfo = [string, number, number]; // [spriteName, offset-x, offset-y]

export interface InteractionContext {
    voxelMap: IVoxelWriter;
    inventory: IInventoryWriter;
    eventBroker: IEventBroker;
    surfacePos: Pos3D;
    voxel: number;
    tool: ItemId | null;
}

export interface EntityDef {
    readonly entityType: number;

    /** voxel からスプライト情報を返す */
    getSprites(voxel: number): EntitySpriteInfo[];

    /** このエンティティが対象地点に存在する時に呼ばれる（例: 収穫）。
     *  true を返すと処理済みとしてフォールバックをスキップする。 */
    onInteract?(ctx: InteractionContext): boolean;
}
```

アイテム使用（植え付け等）は `ItemRegistry` に `registerItem()` で登録する。
1つのファイル内で `registerEntity()` と `registerItem()` の両方を呼ぶことで、
エンティティの全側面を1ファイルに集約する原則は維持される。

```typescript
// 例: Potato.ts
registerEntity({ entityType: ENTITY_TYPES.potato, getSprites(...) { ... }, onInteract(...) { ... } });
registerItem({ itemId: "potato", onItemUse(...) { ... } });
```

### ディスパッチ

InteractionSystem でのインタラクション処理は3段階で行う。各パスのハンドラが `true` を返した場合、後続パスはスキップされる。`false` を返した（または未定義の）場合、次のパスに進む。

```
パス1: EntityRegistry — エンティティベース
  getEntityDef(entityType)?.onInteract(ctx)
  → 例: 成熟した potato を shovel で収穫、workbench をクリックでクラフトUI

パス2: ItemRegistry — アイテムベース
  getItemDef(tool)?.onItemUse(ctx)
  → 例: potato アイテムで植え付け、compost で施肥、watering_can で水やり

パス3: TerrainRegistry — 地形ベース
  getTerrainDef(terrainType)?.onInteract(ctx)
  → 例: shovel で grass/dirt を掘削、hoes で grass → soil
```

**注**: facility_part はパス1の前にアンカーの entityType に解決される。

### ツール・エンティティ・地形の関係

| ツール | 対象 | 操作 | ディスパッチ |
|---|---|---|---|
| shovel | potato（成熟） | 収穫 | パス1（EntityRegistry） |
| shovel | grass/dirt 地面 | 掘削 | パス3（TerrainRegistry） |
| potato | 空の耕地 | 植え付け | パス2（ItemRegistry） |
| watering_can | soil | 水やり | パス2（ItemRegistry） |
| compost | soil/wetSoil | 施肥 | パス2（ItemRegistry） |
| axe | tree | 伐採 | パス1（EntityRegistry） |
| axe | 施設 | 撤去 | パス1（EntityRegistry） |
| hoes | grass | 耕作 | パス3（TerrainRegistry） |
| dirt | grass/dirt | 土盛り | パス2（ItemRegistry） |

---

## 移行計画

### EntityRegistry（完了）

| 段階 | 対象 | 状態 |
|---|---|---|
| 1 | Potato | 完了 |
| 2 | Soy, Flax, Sunflower | 完了 |
| 3 | Tree | 完了 |
| 4 | 施設（Workbench, Forge, 他7施設） | 完了 |
| 5 | Stone | 完了 |

### ItemRegistry（完了）

| 段階 | 対象 | 状態 |
|---|---|---|
| 6 | ItemRegistry.ts 作成 | 完了 |
| 7 | Fertilizers（compost, plant_ashes, oil_cake） | 完了 |
| 8 | WateringCan | 完了 |
| 9 | Dirt | 完了 |

### TerrainRegistry（完了）

| 段階 | 対象 | 状態 |
|---|---|---|
| 10 | TerrainRegistry.ts 作成 | 完了 |
| 11 | GrassDirt（shovel 掘削 + hoes 耕作） | 完了 |
| 12 | SoilWetSoil（hoes エンティティ削除） | 完了 |

### 配置モード + ITEM_DEFS 分離（完了）

| 段階 | 対象 | 状態 |
|---|---|---|
| 13-19 | ItemDef に placement 統合、App.tsx 簡素化、ITEM_DEFS 配置フィールド除去 | 完了 |
| 20 | ITEM_DEFS の spriteName / maxStack を ItemRegistry に統合、ITEM_DEFS 廃止 | 完了 |
| 21 | PlayerState.setEventBroker() に player_move / zoom_change 購読を統合 | 完了 |

### UIState 導入（次フェーズ）

App.tsx の UI 状態管理（インベントリ開閉、配置モード、クラフトUI）を UIState クラスに集約する。

**設計原則: 「イベント → UIState 更新 → view は tick で UIState を読む」**

これはゲームロジック側で採用済みの「イベント → エンジン状態更新 → view は tick で状態を読む」と同じパターンの UI 版。

```
toggle_inventory / open_craft_ui イベント
       ↓
  UIState.mode を更新
       ↓
  各 view は tick() で UIState.mode を読んで表示制御
  （Toolbar: mode=normal で visible、InventoryView: mode=inventory/craft で表示、等）
```

**UIState の型:**
```typescript
type UIMode = "normal" | "inventory" | "craft" | "placement";

class UIState {
    mode: UIMode = "normal";
    craftStation: CraftStation = "hand";
    placementItemId: ItemId | null = null;
    placementSourceSlot: SlotRef | null = null;

    subscribeEvents(broker, deps): () => void;
    enterPlacementMode(itemId, sourceSlot, info): void;
    confirmPlacement(pos): void;
    cancelPlacement(): void;
}
```

**InteractionSystem の配置モード対応:**
- 現在の「配置モード中は InteractionSystem を dispose して再生成」パターンを廃止
- InteractionSystem 内で `uiState.mode === "placement"` なら早期 return する
- InteractionSystem は常に active

| 段階 | 対象 | 内容 |
|---|---|---|
| 22 | UIState クラスを作成 | 完了 |
| 23 | Toolbar / InventoryView に UIState を DI | 完了 |
| 24 | InteractionSystem に UIState を DI | 完了 |
| 25 | App.tsx を簡素化 | 完了 |
| 26 | UIState を純粋データ化 | 完了（Elm アーキテクチャ風。副作用は各 view が実行） |

### 保留

- **CropSystem.ts**: `processDailyTick` は全タイル走査ループ（400x400 = 160,000回）のため、現時点では Registry 化しない。`CROP_DEFS` テーブルによる汎用ロジックを維持する。
- **地形スプライト**: TerrainSpriteResolver.ts に残す（近傍依存・相互依存のため）。

---

## コーディング規約（追加分）

1. **新エンティティは `_registry/entities/` にファイルを作成し、`registerEntity()` で登録する**
2. **新アイテム使用は `_registry/items/` にファイルを作成し、`registerItem()` で登録する**
3. **新地形インタラクションは `_registry/terrains/` にファイルを作成し、`registerTerrain()` で登録する**
4. **定義ファイルは1ファイルに全側面（スプライト・インタラクション・パラメータ）を含む**
5. **`onInteract` / `onItemUse` は処理の成否を `boolean` で返す**
6. **Registry の型定義（`EntityRegistry.ts` 等）の変更は全登録済み定義に影響するため慎重に行う**
7. **個別定義ファイルの変更は局所的であり、他の定義に影響しない**
8. **同名の概念は Registry で分離する**: `TERRAIN_TYPES.dirt`（地形）と `ItemId "dirt"`（アイテム）は別の Registry に登録される

---

## 新要素の追加方法

### エンティティの追加

エンティティには **作物型**（農地で育てるもの）と **施設型**（フィールドに配置する構造物）の2種類がある。いずれも手順の骨格は同じ。

#### 手順

**1. `engine/TerrainDefs.ts` の `ENTITY_TYPES` に番号を追加する**

```typescript
export const ENTITY_TYPES = {
    // ... 既存 ...
    my_entity: 20,  // ← 既存番号と重複しない値を割り当てる
} as const;
```

**2. `engine/ItemDefs.ts` の `ItemId` 型に必要なアイテム ID を追加する**

```typescript
export type ItemId =
    // ... 既存 ...
    | "my_entity"   // 施設アイテム、または作物の種アイテム
    | "my_harvest"; // 収穫物（別アイテムが必要な場合）
```

**3. `_registry/entities/MyEntity.ts` を作成する**

`registerEntity()` でスプライト・インタラクションを登録する。  
アイテムが関連する場合は同じファイル内で `registerItem()` も呼び、**全側面を1ファイルに集約する**。

```typescript
// 作物型の例
import { ENTITY_TYPES, ... } from "../../engine/TerrainDefs";
import { registerEntity, type InteractionContext } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.my_entity,

    getSprites(voxel: number) {
        // voxel 値（成長段階等）を見てスプライト名・オフセットを返す
        return [["ss_sprite_XXX.png", 0, -8]];
    },

    onInteract(ctx: InteractionContext): boolean {
        // 右クリック: 収穫・撤去等
        // 未処理の場合は false を返す（次のパスへ進む）
        if (ctx.tool !== "shovel") return false;
        // ... 収穫ロジック ...
        return true;
    },

    // 施設型の場合: 左クリックで UI を開く
    onPrimaryInteract(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_craft_ui", { pos: ... });
        return true;
    },
});

// アイテムとして使用する場合（種の植え付け、施設の配置 等）
registerItem({
    itemId: "my_entity",
    spriteName: "ss_sprite_YYY.png",
    maxStack: 64,

    // ワールドに使用する操作（植え付け等）がある場合
    onItemUse(ctx: InteractionContext): boolean {
        // ... ロジック ...
        return true;
    },

    // 施設型の場合: 配置情報を設定する
    placement: {
        entityType: ENTITY_TYPES.my_entity,
        entitySize: { w: 2, h: 1 },
        fieldSpriteName: "ss_sprite_ZZZ.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.my_entity, { w: 2, h: 1 });
        },
    },
});
```

**4. `src/App.tsx` で import する**

```typescript
import "./_registry/entities/MyEntity";
```

エンティティ定義ファイルを import するだけで `registerEntity()` / `registerItem()` の副作用が実行され、Registry に登録される。

---

### アイテムのみの追加（エンティティ不要）

収穫物・素材・中間生産物など、フィールドエンティティを持たないアイテムを追加する場合。

**1. `engine/ItemDefs.ts` の `ItemId` 型に ID を追加する**

```typescript
export type ItemId =
    // ... 既存 ...
    | "charcoal";
```

**2. 既存の `_registry/items/*.ts` に `registerItem()` を追記する（または新ファイルを作成する）**

同カテゴリの素材なら `Materials.ts` 等に1行追加するだけでよい。  
ワールド使用が必要（`onItemUse`）なら新ファイルを作成し `App.tsx` で import する。

```typescript
// Materials.ts への追記例
registerItem({ itemId: "charcoal", spriteName: "ss_sprite_NNN.png", maxStack: 64 });
```

---

### クラフトレシピの追加

**1. 成果物アイテムが未登録なら `engine/ItemDefs.ts` の `ItemId` に追加する**（上記「アイテムのみの追加」参照）

**2. `engine/RecipeDefs.ts` の `RECIPES` 配列にレシピオブジェクトを追加する**

```typescript
export const RECIPES: readonly RecipeDef[] = [
    // ... 既存 ...
    {
        id: "charcoal",             // レシピを一意に識別する文字列
        station: "bonfire",         // クラフトステーション（"hand" / "workbench" / 任意の施設名）
        ingredients: [
            { itemId: "trunk", count: 2 },
        ],
        result: { itemId: "charcoal", count: 4 },
    },
];
```

`station` に使うクラフトステーション名は `_boundary/interfaces.ts` の `CraftStation` 型で管理されている。新しいステーションを追加する場合はその型定義も更新が必要。

---

## 検討課題（未着手）

### GUI ウィジェットの入力とロジックの分離

**現状**: InventoryView 等の GUI ウィジェットが「レイアウト構築 + 描画 + 入力ハンドリング + 状態管理 + ビジネスロジック」の5責務を1クラスに持っている。

**気持ち悪さの本質**: 描画（view）と入力（input）が一体化しており、さらにピックアップ状態管理やスロット移動ルールといったロジックも混在している。

**PixiJS の制約**: GUI ウィジェットでは「どのスロットがクリックされたか」の判定が描画レイアウトに依存するため、入力と描画の完全分離は PixiJS の仕組みに逆らうことになり、コストが高い。

**推奨アプローチ（将来）**: 入力と描画は一体のままでよいが、**ロジックを Model に分離**する。

```
InventoryModel（新規）: ピックアップ状態、スロット移動ルール
InventoryView（既存）: レイアウト + 描画 + 入力 → InventoryModel を操作
```

InventoryView はクリック時に「どのスロットが押されたか」を判定し、`inventoryModel.pickUp(ref)` 等を呼ぶ。tick では `inventoryModel` の状態を見て描画する。

**ゲームワールド側**: 既に分離済み（InputHandler → EventBroker → Registry → 状態変更 → TopView が tick で描画）。問題なし。

**優先度**: 低（フィージビリティスタディ段階では現状で許容範囲。機能開発を優先する）。
