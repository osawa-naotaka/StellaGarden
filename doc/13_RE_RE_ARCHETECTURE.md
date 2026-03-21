# Entity Registry パターン設計書

> **目的**: エンティティの振る舞い（スプライト・インタラクション・日次処理）を1エンティティ1ファイルに集約し、メンテナンス性を向上させる。
> **ステータス**: 設計完了、Potato で検証中

---

## 背景と課題

### 現状の問題点

エンティティの振る舞いが複数ファイルの巨大 switch 文に分散している:

| ファイル | 責務 | 問題 |
|---|---|---|
| `input/InteractionSystem.ts` | インタラクション（植え付け・収穫・伐採等） | ~440行の switch。作物ごとにほぼ同一のロジックがコピペされている |
| `view/renderer/TerrainSpriteResolver.ts` | スプライト解決 | エンティティ追加のたびに case が増える |
| `engine/CropSystem.ts` | 日次処理（成長・水切れ・枯死） | 汎用ロジックだが、将来エンティティ固有の日次処理が必要になる |

新エンティティ追加時に3箇所以上を修正する必要があり、修正漏れのリスクが高い。

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
  _boundary/          ← モジュール間インターフェース定義（既存）
  _registry/          ← エンティティ定義の集約（新規）
    EntityRegistry.ts ← 型定義 + 登録/取得 API
    entities/         ← 各エンティティの定義ファイル
      Potato.ts
      Tree.ts         （将来）
      Workbench.ts    （将来）
      ...
  engine/
  view/
  input/
  lib/
```

`_registry/` は `_boundary/` と同格の共有領域であり、全モジュールから参照可能。

- `_boundary/` = モジュール間の **通信インターフェース**（型・イベント・定数）
- `_registry/` = エンティティの **振る舞い定義**（スプライト・ロジック・パラメータ）

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
    readonly itemId?: ItemId;

    /** voxel からスプライト情報を返す */
    getSprites(voxel: number): EntitySpriteInfo[];

    /** このエンティティが対象地点に存在する時に呼ばれる（例: 収穫）。
     *  true を返すと処理済みとしてフォールバックをスキップする。 */
    onInteract?(ctx: InteractionContext): boolean;

    /** このエンティティに対応するアイテムをツールとして使用した時に呼ばれる（例: 植え付け）。
     *  true を返すと処理済みとしてフォールバックをスキップする。 */
    onItemUse?(ctx: InteractionContext): boolean;
}
```

### 2パスディスパッチ

InteractionSystem でのインタラクション処理は3段階で行う:

```
パス1: エンティティベース
  getEntityDef(対象地点のentityType)?.onInteract(ctx)
  → 例: 成熟したじゃがいもを shovel で収穫

パス2: アイテムベース
  getEntityDefByItemId(手持ちツールのitemId)?.onItemUse(ctx)
  → 例: potato アイテムを soil に植え付け

パス3: フォールバック（既存 switch 文）
  → 未移行エンティティ、ツール固有の地形操作（掘る・耕す等）
```

各パスのハンドラが `true` を返した場合、後続パスはスキップされる。
`false` を返した（または未定義の）場合、次のパスに進む。

### ツールとエンティティの関係

ツールとエンティティは多対多の関係:

| ツール | 対象エンティティ | 操作 | ディスパッチ |
|---|---|---|---|
| shovel | potato（成熟） | 収穫 | パス1（エンティティベース） |
| shovel | 地面 | 掘削 | パス3（フォールバック） |
| potato | なし（空の耕地） | 植え付け | パス2（アイテムベース） |
| watering_can | なし（soil） | 水やり | パス3（フォールバック） |
| axe | tree | 伐採 | パス1（エンティティベース）※将来 |

**原則**: エンティティ固有の操作（収穫・植え付け等）は Registry に委譲し、地形に対する汎用操作（掘る・耕す・水やり等）はフォールバックの switch に残す。

---

## 移行計画

段階的にエンティティを Registry に移行する。各段階でビルド確認を行う。

| 段階 | 対象 | 内容 |
|---|---|---|
| 1（本タスク） | Potato | スプライト + 植え付け + 収穫 |
| 2 | Soy, Flax, Sunflower | 他の作物を同様に移行 |
| 3 | Tree | 伐採ロジックの移行 |
| 4 | 施設（Workbench, Forge 等） | 施設固有ロジックの移行 |
| 5 | Stone | 採掘ロジックの移行 |

### CropSystem.ts の扱い

`processDailyTick` は全タイル走査ループ（400x400 = 160,000回）のため、現時点では Registry 化しない。`CROP_DEFS` テーブルによる汎用ロジックを維持する。将来、エンティティ固有の日次処理が必要になった時点で、パフォーマンス設計を含めて検討する。

---

## コーディング規約（追加分）

1. **新エンティティは `_registry/entities/` にファイルを作成し、`registerEntity()` で登録する**
2. **エンティティファイルは1ファイルに全側面（スプライト・インタラクション・パラメータ）を含む**
3. **`onInteract` / `onItemUse` は処理の成否を `boolean` で返す**
4. **`_registry/EntityRegistry.ts` の型変更は全エンティティに影響するため慎重に行う**
5. **`_registry/entities/` 内の個別ファイル変更は局所的であり、他エンティティに影響しない**
