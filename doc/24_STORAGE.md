# 24_STORAGE.md — ストレージ追加ガイド

> **対象**: 新しい施設用ストレージ（チェスト類・加工施設類）を追加するときの作法
> **前提知識**: `doc/13_RE_RE_ARCHETECTURE.md`（Registry パターン）、`doc/14_SAVE_SYSTEM.md`（セーブ）
> **読者**: コード生成 LLM（Claude Code 等）。手順を機械的に再現できる粒度で記述する。

---

## 1. 全体像

ストレージは「**配置型施設のスロット状態を保持する engine 層のクラス**」である。配置インスタンスごとに固有のスロット群（インベントリ・入出力・利用ツール 等）を持つものを指す。プレイヤーインベントリ (`engine/Inventory.ts`) は別系統なのでこのドキュメントの対象外。

ストレージは2系統に分かれる:

| 系統 | 例 | 基底クラス | 管理方法 |
|---|---|---|---|
| **座標ベース** | Chest / Forge / Workbench | `engine/KeyedSlotStorage<TSlots>` 継承 | `Map<string, TSlots>` を pos でキー化 |
| **グローバル単一** | WarpGate | プレーンクラス（基底なし） | フラットなフィールドを直接保持 |

**新規ストレージは原則として座標ベース系統で書く。** 座標を持たない単一インスタンス系（地球側出荷ゲートのような特殊用途）だけ後者を選ぶ。

---

## 2. `KeyedSlotStorage<TSlots>` が提供する共通機能

実装ファイル: `src/engine/KeyedSlotStorage.ts`

### 派生クラスで必須実装する3つの抽象メソッド

| メソッド | 役割 |
|---|---|
| `protected createDefaultSlots(): TSlots` | `create(pos)` が呼ばれた時に作るスロット初期値 |
| `protected isSlotsEmpty(slots: TSlots): boolean` | `isEmpty(pos)` の判定 |
| `protected cloneSlots(slots: TSlots): TSlots` | セーブ・ロード時のディープコピー |

### 基底が提供する共通 API（派生で書かない）

| API | 内容 |
|---|---|
| `create(pos)` | 既存しなければ新規スロットを作る |
| `remove(pos)` | エントリ削除 |
| `isEmpty(pos)` | 空判定（pos が存在しないなら true） |
| `getSlots(pos)` | 内部参照を直接返す（書き換えは派生 set 系メソッド経由のこと） |
| `toSaveData()` | `Array<{key, slots}>` 形式 |
| `loadSaveData(data)` | 上記形式から復元 |
| `onDailyTick(voxelMap)` | day_changed 時に呼ばれる。**デフォルトは no-op**。日次処理がある施設だけ override する |

### 派生クラス内で使える protected ヘルパー

| ヘルパー | 用途 |
|---|---|
| `key(pos)` / `posFromKey(key)` | 内部 Map のキー文字列変換 |
| `entries()` | 全エントリ走査（`onDailyTick` の典型実装で使う） |
| `getRaw(pos)` | 内部 Map の生スロットを取得（固有 setter / getter で使う） |

---

## 3. 新規ストレージ追加手順（座標ベース）

`Xxx` を新ストレージ名（例: `Kiln`、`CompostBin`）に置き換えて適用する。

### 3.1 engine/XxxStorage.ts を新設

```ts
import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { KeyedSlotStorage } from "./KeyedSlotStorage";

export interface XxxSlots {
    input: ItemStack | null;
    output: ItemStack | null;
}

export class XxxStorage extends KeyedSlotStorage<XxxSlots> {
    protected createDefaultSlots(): XxxSlots {
        return { input: null, output: null };
    }

    protected isSlotsEmpty(slots: XxxSlots): boolean {
        return slots.input === null && slots.output === null;
    }

    protected cloneSlots(slots: XxxSlots): XxxSlots {
        return { ...slots };
    }

    // 固有 API: バリデーション付き setter（必要なら）
    setInput(pos: Pos2D, stack: ItemStack | null): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.input = stack;
    }

    // 日次処理が必要なら override（不要なら書かなくてよい）
    override onDailyTick(_voxelMap: IVoxelWriter): void {
        for (const [key, slots] of this.entries()) {
            // 例: input → output 変換ロジック
        }
    }
}
```

#### `TSlots` の型を選ぶ判断基準

| 状況 | 推奨型 | 例 |
|---|---|---|
| 同型スロットが固定長 | `(ItemStack \| null)[]` | `ChestStorage`（64スロット） |
| 用途が違う名前付きスロット | `interface { kindA, kindB }` | `ForgeStorage`（ingredient/fuel/output） |
| 単一スロット | `interface { tool }` | `WorkbenchStorage` |

#### voxelMap 副作用を持つメソッドの書き方

`voxelMap` は**メソッド引数で受け取る**こと。`KeyedSlotStorage` 自体は voxelMap を持たない。`ForgeStorage.setSlot(pos, kind, stack, voxelMap)` がこのパターン。

#### 個別バリデーション（itemId allowList、count==1 制約等）

派生クラス側の固有 setter 内で `console.warn` してから `return` で no-op 化する。`ForgeStorage` / `WorkbenchStorage` の `setSlot` / `setTool` を参照。

### 3.2 lib/SaveSystem.ts に型定義追加

```ts
// SaveData interface に追加
export interface SaveData {
    // ... 既存 ...
    xxxStorage: XxxStorageSaveData;
}

// セクション末尾に新設
export interface XxxStorageSaveData {
    items: Array<{ key: string; slots: XxxSlots }>;
}
```

**`CURRENT_SAVE_VERSION` を +1 する**こと。これを忘れると旧セーブを読み込んだときに `xxxStorage` が undefined で参照され、ロード処理が落ちる。

> 注: 既存4ストレージは型名のばらつきがある（`{chests}` `{forges}` `{workbenches}` `{slots}`）。新規追加では一貫して `{items}` または明示的な意味のある名前で良い。**`Array<{key, slots: TSlots}>` 形式を維持する**ことだけ守る（`toSaveData()` の戻り値と一致させる）。

### 3.3 react-ui/EngineContext.tsx の EngineRefs に追加

```ts
import type { XxxStorage } from "../engine/XxxStorage";

export interface EngineRefs {
    // ... 既存 ...
    xxxStorage: XxxStorage;
}
```

### 3.4 react-ui/hooks/gameEngineBoot.ts に初期化追加

```ts
import { XxxStorage } from "../../engine/XxxStorage";
import { setXxxStorage } from "../../_registry/entities/Xxx";

export interface Storages {
    // ... 既存 ...
    xxxStorage: XxxStorage;
}

export function bootstrapStorages(saveData: SaveData | null): Storages {
    // ... 既存 ...
    const xxxStorage = new XxxStorage();
    if (saveData) xxxStorage.loadSaveData(saveData.xxxStorage.items);
    setXxxStorage(xxxStorage);

    return { /* 既存 */, xxxStorage };
}
```

### 3.5 react-ui/hooks/buildSaveData.ts にスナップショット追加

```ts
import type { XxxStorage } from "../../engine/XxxStorage";

export interface SaveSnapshotDeps {
    // ... 既存 ...
    xxxStorage: XxxStorage;
}

export function buildSaveData(deps: SaveSnapshotDeps): Omit<SaveData, "version" | "timestamp"> {
    const { /* 既存 */, xxxStorage } = deps;
    return {
        // ... 既存 ...
        xxxStorage: { items: xxxStorage.toSaveData() },
    };
}
```

### 3.6 react-ui/hooks/useGameEngine.ts に配線追加

`bootstrapStorages` の戻り値分解と `setEngineRefs` への引き渡し:

```ts
const { /* 既存 */, xxxStorage } = bootstrapStorages(saveData);
// ...
setEngineRefs({ /* 既存 */, xxxStorage });
```

`buildSaveData` 呼び出しに `xxxStorage` を渡す（`performSave` 内のオブジェクト）。

**`onDailyTick` を override したストレージなら**、`dailyTickStorages` 配列に追加:

```ts
const dailyTickStorages = [chestStorage, forgeStorage, workbenchStorage, xxxStorage];
```

`onDailyTick` を override しないストレージは追加しなくてよい（基底の no-op が呼ばれるだけで実害はないが、配列を意味通りに保つため override したものだけ載せる）。

### 3.7 _registry/entities/Xxx.ts を新設

既存の `_registry/entities/Chest.ts` / `Forge.ts` / `Workbench.ts` を雛形にする。

```ts
import type { XxxStorage } from "../../engine/XxxStorage";
import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

let xxxStorage: XxxStorage | null = null;

/** bootstrapStorages から XxxStorage を注入する。 */
export function setXxxStorage(storage: XxxStorage): void {
    xxxStorage = storage;
}

registerEntity({
    entityType: ENTITY_TYPES.xxx,
    getSprites(): EntitySpriteInfo[] {
        return [["xxx.png", 0, 0]];
    },
    onInteract(ctx: InteractionContext): boolean {
        // axe / pickaxe で撤去するパターンは removeFacilityAtPos を使う
        // 撤去成功時に xxxStorage?.remove(pos) を呼ぶ
    },
    onPrimaryInteract(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_xxx_ui", { pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z } });
        return true;
    },
});

registerItem({
    itemId: "xxx",
    displayName: "Xxx",
    spriteName: "xxx.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.xxx,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: "xxx.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.xxx, { w: 1, h: 1 });
            xxxStorage?.create(pos);
        },
    },
});
```

#### DI スロットの注意

`let xxxStorage: XxxStorage | null = null` はモジュールスコープのミュータブル状態。`xxxStorage?.create(pos)` のように **必ず `?.` でガード**する。`bootstrapStorages` が呼ばれる前に `onPlace` が走ることはない設計だが、防御として明示する。

### 3.8 _registry/index.ts に副作用 import を追加

```ts
import "./entities/Xxx";
```

これを忘れると registerEntity / registerItem が呼ばれず、エンティティが認識されない。

### 3.9 UI パネル（サイドバーUI が必要な場合）

1. `_boundary/events.ts` に `open_xxx_ui: { pos: Pos2D };` を追加
2. `react-ui/panels/XxxPanel.tsx` を新設（既存の `ChestPanel.tsx` 等を雛形に）
3. パネル内で `useEngine().xxxStorage` 経由でアクセス
4. パネル登録は `registerPanel()` を呼ぶ（`react-ui/PanelRegistry.tsx` 参照）
5. `react-ui/SgUiRoot.tsx` 等が新パネルを認識する経路を確認

### 3.10 ビルド確認

```sh
bun run build
```

型エラーが出たら、上記手順のどこかで配線が漏れている。**最も多い漏れは 3.4（gameEngineBoot.ts への追加忘れ）と 3.5（buildSaveData.ts への追加忘れ）**。

---

## 4. 既存ストレージ実装の参照表

| 用途 | 参照すべき実装 |
|---|---|
| 単純なインベントリ（固定長配列スロット） | `engine/ChestStorage.ts` |
| 用途別の名前付きスロット + voxelMap 副作用 + day 処理 | `engine/ForgeStorage.ts` |
| 単一スロット + itemId allowList + count 制約 | `engine/WorkbenchStorage.ts` |
| 座標を持たないグローバル単一ストレージ | `engine/WarpGateStorage.ts`（KeyedSlotStorage **未使用**） |

---

## 5. アンチパターン

- **`KeyedSlotStorage` に PixiJS / view 依存を持ち込む** — engine 層は描画非依存（`doc/07_RE_ARCHETECTURE.md` 参照）。スプライト関連は `_registry/entities/Xxx.ts` 側で扱う。
- **voxelMap をメソッド引数で受け取らず、ストレージ内に保持する** — 疎結合とテスト容易性を損なう。`ForgeStorage.setSlot` / `onDailyTick` のように引数で受け取る。
- **`getSlots(pos)` の戻り値を呼び出し側で直接書き換える** — 内部参照を直接返している。書き換えは必ず派生クラスの `setXxx(pos, ...)` 経由で行う。
- **セーブ形式を非互換に変えるのに `CURRENT_SAVE_VERSION` を上げない** — ロード時の `version` チェックで弾かれず、壊れたデータで起動して落ちる。
- **`_registry/index.ts` への import 追加忘れ** — エンティティが世界に存在できない（型エラーは出ないので発見が遅れる）。
- **`dailyTickStorages` への追加を `onDailyTick` を override していないストレージに対して行う** — 配列の意味（"日次処理を持つストレージ群"）が壊れる。override していないなら載せない。

---

## 6. チェックリスト（座標ベース系統）

```
[ ] engine/XxxStorage.ts 作成（KeyedSlotStorage 継承、3抽象メソッド実装）
[ ] lib/SaveSystem.ts に XxxStorageSaveData 追加 + SaveData に xxxStorage 追加 + CURRENT_SAVE_VERSION +1
[ ] react-ui/EngineContext.tsx の EngineRefs に xxxStorage 追加
[ ] react-ui/hooks/gameEngineBoot.ts の Storages / bootstrapStorages に xxxStorage 追加
[ ] react-ui/hooks/buildSaveData.ts の SaveSnapshotDeps と戻り値に xxxStorage 追加
[ ] react-ui/hooks/useGameEngine.ts の bootstrapStorages 分解 / setEngineRefs / buildSaveData 呼び出しに反映
[ ] (onDailyTick を override したなら) useGameEngine.ts の dailyTickStorages 配列に追加
[ ] _registry/entities/Xxx.ts 新設（DI スロット + setXxxStorage + registerEntity + registerItem）
[ ] _registry/index.ts に "./entities/Xxx" の副作用 import 追加
[ ] (UI が必要なら) _boundary/events.ts に open_xxx_ui イベント追加
[ ] (UI が必要なら) react-ui/panels/XxxPanel.tsx 新設 + registerPanel
[ ] bun run build で型エラーなしを確認
```
