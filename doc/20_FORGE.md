# 炉（Forge）と鍛造フロー設計

## 1. 設計方針

### 1.1 背景

- 現行の鍛造フロー（doc/11_TOOL.md §3.3）は「炉で加熱 → トングで掴む → 金床に移動 → ハンマーで叩く」の4段階で、チルな農業ゲームというコンセプトに対して手数が多い
- 炉のエンティティ自体は実装済みだが、加熱処理を実行するための UI が未実装
- チェストUI（`view/ChestView.ts` + `engine/ChestStorage.ts`）という再利用可能な UI パターンが既に存在する
- 炭焼き窯（Kiln）に「燃焼中アニメーション + 日経過でステージ遷移」のパターンが既にあり、炉にも同じ手法が適用できる

### 1.2 新しい鍛造フロー

```
隕鉄 ×1 → 【炉 + 木炭で加熱】 → 赤熱した隕鉄 ×1
赤熱した隕鉄 ×1 → 【金床にインタラクト】 → 刃 ×1
```

doc/11_TOOL.md §3.3 の現行フローを**このドキュメントの内容で置き換える**（トング・ハンマー・金床ハンマー打ちの工程を廃止）。

### 1.3 本仕様で決定したこと

- **炉 UI**: チェスト UI と同じレイアウト思想で、左側にインベントリ（+ツールバー）、右側に炉スロット3つ（原材料・燃料・結果）を表示する
- **スロット容量**: 各スロット最大64個（インベントリと同じスタック上限）
- **燃焼判定**: 原材料スロットと燃料スロットの両方に1個以上アイテムがある場合のみ燃焼アニメーションを表示。片方でも空なら消火状態の静止スプライト
- **加熱処理**: ゲーム内1日の切り替わり（朝5時、`day_changed` イベント）で、両スロットに1個以上ある場合に原材料1個 + 燃料1個を消費し、結果スロットに赤熱した隕鉄を1個追加する（B案: 毎日1個ずつ処理、途中中断可能）
- **UI はいつでも開ける**: 燃焼中でも消火中でも左クリックで開ける。スロット操作もいつでも可能
- **原材料スロット**: 隕鉄（`meteoric_iron`）のみ受け付ける
- **燃料スロット**: 木炭（`charcoal`）のみ受け付ける
- **結果スロット**: 赤熱した隕鉄（`hot_meteoric_iron`）のみ。maxStack = 64
- **冷却なし**: ゲーム簡略化のため、赤熱した隕鉄は冷えない（永続スタック可）
- **トング・ハンマーは未使用**: `RecipeDefs.ts` の定義は残すが、鍛造フローには登場しない
- **鉄塊（`iron_ingot`）のリサイクル経路は将来対応**: 本仕様では扱わない
- **燃焼中スプライト**: `ss_sprite_070_1.png` / `ss_sprite_070_2.png` / `ss_sprite_070_3.png`（3フレームアニメ、Kiln と同じ手法）
- **消火中スプライト**: 既存の `ss_sprite_069.png`（変更なし）

---

## 2. アイテム定義の変更

### 2.1 新規アイテム: 赤熱した隕鉄

| 項目 | 値 |
|---|---|
| `itemId` | `hot_meteoric_iron` |
| スプライト | 未定（ss_sprite_???.png を追加予定） |
| `maxStack` | 64 |
| 用途 | 金床にインタラクトして刃を得る |
| 冷却 | なし（永続） |

登録場所: `src/_registry/items/Materials.ts`

### 2.2 既存アイテム（変更なし）

| `itemId` | 役割 |
|---|---|
| `meteoric_iron` | 炉の原材料スロットに入れる。maxStack=64 |
| `charcoal` | 炉の燃料スロットに入れる |
| `blade` | 金床で hot_meteoric_iron から鍛造される。maxStack=1（現行踏襲） |
| `tongs` | レシピ定義は残すが未使用 |
| `hammer` / `stone_hammer` | レシピ定義は残すが未使用 |

---

## 3. エンティティ定義の変更

### 3.1 新規エンティティ: 燃焼中の炉（`forge_burning`）

Kiln の `kiln` / `kiln_burning` パターンに倣う。

| 項目 | 値 |
|---|---|
| `ENTITY_TYPES.forge_burning` | 新規追加（TerrainDefs.ts の entity type ID を割り当てる） |
| スプライト | `ss_sprite_070_1.png` / `ss_sprite_070_2.png` / `ss_sprite_070_3.png`（3フレーム、300ms 間隔） |
| サイズ | 2x2（既存の `forge` と同じ） |
| インタラクト | `onPrimaryInteract`: 左クリックで炉UIを開く／`onInteract` での撤去は不可（燃焼中は触れない前提） |

### 3.2 既存エンティティ: 消火中の炉（`forge`）

既存の `Forge.ts` を以下のように拡張する。

| 変更点 | 内容 |
|---|---|
| `onPrimaryInteract` を追加 | 左クリックで炉UIを開く（`open_forge_ui` イベント発行） |
| 配置時の初期ステート | `ENTITY_TYPES.forge`（消火中）で配置する。現行のまま |
| `onInteract`（ピッケル撤去） | 現行のまま。ただし ForgeStorage 側の削除処理を追加 |

### 3.3 消火/燃焼の遷移ロジック

Forge は Kiln と違い、**日経過で遷移するのではなく、スロット状態から毎 tick 判定する**：

```
each tick:
    for each forge position:
        if ingredientSlot.count > 0 AND fuelSlot.count > 0:
            voxelMap.setEntityType → forge_burning
        else:
            voxelMap.setEntityType → forge
```

この判定は `ForgeStorage.setSlot()` の呼び出しタイミングで行えば十分（毎 tick 全炉走査は不要）。`day_changed` での自動消費後にも同様の再判定を入れる。

### 3.4 金床（`anvil`）のインタラクト追加

現在の `anvil` は撤去しかできない（`facilities.ts:52` の `registerAxeRemovableFacility`）。本仕様で `onPrimaryInteract` を追加する。

| 条件 | 挙動 |
|---|---|
| プレイヤーが選択中のツール = `hot_meteoric_iron` | 1個消費して `blade` を1個インベントリに追加 |
| それ以外 | 何もしない（false を返す） |

インベントリに空きがない場合は消費せず失敗とする（`addItems` の既存挙動に従う）。

---

## 4. ForgeStorage（新規エンジンシステム）

### 4.1 配置場所と責務

- ファイル: `src/engine/ForgeStorage.ts`
- 設計: `ChestStorage.ts` とほぼ同構造（座標キーで3スロットの配列を保持）
- スロット数: 3（`ingredient` / `fuel` / `output`）

### 4.2 API 概略

```typescript
export type ForgeSlotKind = "ingredient" | "fuel" | "output";

export class ForgeStorage {
    create(pos: Pos2D): void;
    remove(pos: Pos2D): void;
    isEmpty(pos: Pos2D): boolean;
    getSlot(pos: Pos2D, kind: ForgeSlotKind): ItemStack | null;
    setSlot(pos: Pos2D, kind: ForgeSlotKind, stack: ItemStack | null): void;
    getSlots(pos: Pos2D): { ingredient: ItemStack|null; fuel: ItemStack|null; output: ItemStack|null } | undefined;

    /** 両スロットにアイテムがあるか（燃焼中判定用）。 */
    isBurning(pos: Pos2D): boolean;

    /** day_changed 時に全炉を走査し、両スロットに在庫があれば1個ずつ消費して output を加算する。 */
    advanceDayAllForges(voxelMap: IVoxelWriter): void;

    toSaveData(): ...;
    loadSaveData(data: ...): void;
}
```

### 4.3 日経過処理（`advanceDayAllForges`）

疑似コード:

```
for each (pos, slots) in forges:
    if slots.ingredient == null || slots.fuel == null: continue
    if slots.output != null && slots.output.count >= 64: continue       # 結果スロット満杯
    if slots.output != null && slots.output.itemId != "hot_meteoric_iron": continue   # 想定外

    # 消費
    slots.ingredient.count -= 1
    if slots.ingredient.count == 0: slots.ingredient = null
    slots.fuel.count -= 1
    if slots.fuel.count == 0: slots.fuel = null

    # 追加
    if slots.output == null:
        slots.output = { itemId: "hot_meteoric_iron", count: 1 }
    else:
        slots.output.count += 1

    # 燃焼状態の再判定（スロット更新後、消火に切り替わる場合あり）
    updateForgeBurningState(voxelMap, pos, slots)
```

`App.tsx` で `day_changed` 購読リストに `forgeStorage.advanceDayAllForges(voxelMap)` を追加する。

### 4.4 スロットのバリデーション

`ForgeStorage.setSlot()` では受け入れるアイテム種別を検証する：

| スロット | 許容 `itemId` |
|---|---|
| `ingredient` | `meteoric_iron` のみ |
| `fuel` | `charcoal` のみ |
| `output` | `hot_meteoric_iron` のみ（プレイヤーが出力スロットに入れる操作は取り出しのみ。UI側で許容操作を制限する） |

UI 側（ForgeView）でドラッグ可否を制御し、バリデーションは ForgeStorage 側でも最終チェックとして実施する。

---

## 5. UI 実装（ForgeView）

### 5.1 参考実装

`view/ChestView.ts` をテンプレートとする。

### 5.2 レイアウト

```
┌────────────────────────────────────────┐
│ Forge                                  │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┐  ┌─────┐ │
│ │  │  │  │  │  │  │  │  │  │ 材料 │ │ ← 原材料スロット（隕鉄のみ）
│ ├──┼──┼──┼──┼──┼──┼──┼──┤  ├─────┤ │
│ │  │  │  │  │  │  │  │  │  │ 燃料 │ │ ← 燃料スロット（木炭のみ）
│ ├──┼──┼──┼──┼──┼──┼──┼──┤  ├─────┤ │
│ │  │  │  │  │  │  │  │  │  │ 結果 │ │ ← 結果スロット（赤熱隕鉄）
│ ├──┼──┼──┼──┼──┼──┼──┼──┤  └─────┘ │
│ │  │  │  │  │  │  │  │  │           │
│ ├──┼──┼──┼──┼──┼──┼──┼──┤           │  左: 8×8 インベントリ
│ │  │  │  │  │  │  │  │  │           │
│ ├──┼──┼──┼──┼──┼──┼──┼──┤           │
│ │  │  │  │  │  │  │  │  │           │
│ ├──┼──┼──┼──┼──┼──┼──┼──┤           │
│ │  │  │  │  │  │  │  │  │           │
│ ├──┼──┼──┼──┼──┼──┼──┼──┤           │
│ │  │  │  │  │  │  │  │  │           │
│ └──┴──┴──┴──┴──┴──┴──┴──┘           │
│ ──────────────────────────────────── │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┬──┐       │
│ │  │  │  │  │  │  │  │  │  │       │ ← ツールバー（9スロット）
│ └──┴──┴──┴──┴──┴──┴──┴──┴──┘       │
└────────────────────────────────────────┘
```

### 5.3 操作

インベントリ UI と同じピックアップ/プレース操作に従う（12_UI.md §3.2 のマウス操作を踏襲）。加えて：

| 操作 | 条件 | 挙動 |
|---|---|---|
| 原材料スロットに置く（左/右クリック） | カーソルが `meteoric_iron` 以外を持っている | 拒否（何もしない） |
| 燃料スロットに置く（左/右クリック） | カーソルが `charcoal` 以外を持っている | 拒否（何もしない） |
| 結果スロットに置く | 常に | 拒否（取り出し専用スロット） |
| 結果スロットから取る | 常に | 許可 |
| UI を閉じる（E キー） | ピックアップ中なら元スロットに戻す | 既存と同じ |

### 5.4 UI の配置指定

`UIState` に `"forge"` モードを追加し、`open_forge_ui` イベントで pos を保持したまま ForgeView.show(pos) を呼ぶ（ChestView と同様）。

### 5.5 燃焼アニメーションはエンティティ側で表現

ForgeView は UI ダイアログ内のスロットのみ描画する。炉本体のアニメーション（燃焼中ゆらぎ）はフィールド側（`forge_burning` エンティティの `getSprites()`）で既に処理されるため、UI 側では不要。

---

## 6. イベント定義の追加

`src/_boundary/events.ts` に追加する：

```typescript
/** 炉を左クリックして炉UIを開く。
 *  発行: Forge.ts / ForgeBurning.ts の onPrimaryInteract。購読: App.tsx → ForgeView.show(pos)。 */
open_forge_ui: { pos: Pos2D };
```

`open_chest_ui` と同じカテゴリ（UI イベント）に配置する。

---

## 7. セーブ・ロード

`ForgeStorage` は `ChestStorage` と同じく `toSaveData()` / `loadSaveData()` を実装する。`lib/SaveSystem.ts` のセーブペイロードに `forgeStorage` フィールドを追加する。

配置済みの炉は voxel に `ENTITY_TYPES.forge` または `ENTITY_TYPES.forge_burning` が書き込まれているため、ロード時：
1. voxel から炉位置を走査
2. 各位置に対して `forgeStorage.loadSaveData` で復元されたスロットを対応付ける
3. スロット状態から `forge_burning` / `forge` の整合性を再判定して voxel を更新

---

## 8. 作業フロー（プレイヤー視点）

```
1. 炉を設置する（既存：粘土×8 + 石×4 で素手クラフト）
2. 炉を左クリックしてUIを開く
3. 原材料スロットに隕鉄を入れる / 燃料スロットに木炭を入れる
4. UIを閉じる → 両方埋まっていれば自動点火（燃焼中スプライト + アニメ）
5. ゲーム内の朝5時を跨ぐたびに、隕鉄1個 + 木炭1個 → 赤熱した隕鉄1個
6. 炉を再度開いて結果スロットから赤熱した隕鉄を回収
7. 赤熱した隕鉄をツールバーにセット、金床を左クリック → 刃1個
8. 刃 + 木材 → 作業台 → 鉄の道具（既存の Tools.ts レシピ）
```

---

## 9. 11_TOOL.md への反映状況

本ドキュメントで定義した鍛造フローは、`doc/11_TOOL.md` に反映済みである。

反映済みの主な内容:
- 中間素材テーブルの刃レシピを `隕鉄 →【炉】→ 赤熱した隕鉄 →【金床】→ 刃` に更新
- 刃の鍛造レシピを、トング・ハンマーを経由しない新フローに更新
- 鍛造の手順を、新しい2ステップフローに更新
- 推奨建設順序から、トング・石のハンマーを必須扱いしない形に整理
- `11_TOOL.md` 側で、本ドキュメントの内容を正とする形に整理

したがって、鍛造フローに関する正規仕様は以下のように読む。

- **炉UI・内部スロット・日次処理・燃焼状態の扱い** → `20_FORGE.md`
- **クラフト進行全体の中での位置づけ** → `11_TOOL.md`

両者に矛盾がある場合は、炉の個別仕様については本ドキュメントを優先する。

---

## 10. 今後の検討事項

- [ ] `hot_meteoric_iron` のスプライト（`ss_sprite_???.png`）を決定
- [ ] `ENTITY_TYPES.forge_burning` の ID 割り当て（TerrainDefs.ts）
- [ ] 鉄塊（`iron_ingot`）のリサイクル経路 — 炉の原材料スロットに `iron_ingot` も許容する拡張
- [ ] 結果スロットが満杯のとき、燃料・原材料を消費しないのか、それとも燃料だけ空焚きして消費するのか
- [ ] 将来: 焼きレンガの焼成など、炉を汎用加熱施設にする場合のレシピシステム化
- [ ] 燃焼中でもピッケル撤去を許可するか（現状は消火中のみ撤去可の想定）
- [ ] トング・ハンマーのレシピを完全廃止するタイミング（現状はレシピ定義のみ残す）
- [ ] UI を開いたまま `day_changed` を跨いだ場合の UX — tick で自動描画更新されるが、視覚的なフィードバック（生成エフェクト等）が必要か
