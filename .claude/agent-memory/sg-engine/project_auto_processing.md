---
name: project_auto_processing
description: AutoProcessingStorage と自動脱穀機（auto_thresher）の実装（2026-05-18）
metadata:
  type: project
---

自動加工機の基盤 `AutoProcessingStorage` と最初の施設 `auto_thresher` を実装した。

**Why:** 水車・シャフトの動力を受けて day_changed 時に一括処理する自動加工施設の基盤が必要だったため。

**How to apply:** 同じパターンで新しい自動加工施設を追加する場合は `ProcessingRecipes.ts` の `AUTO_PROCESSING_DEFS` に追加し、`VoxelDefs.ts` の `ENTITY_TYPES`、`ItemDefs.ts` の `ITEM_IDS` にも追加する。`AutoProcessing.ts` で `registerAutoProcessingEntity()` を呼ぶ。

## 変更ファイル一覧

- `src/engine/VoxelDefs.ts` — `ENTITY_TYPES.auto_thresher: 37` を追加
- `src/engine/ItemDefs.ts` — `"auto_thresher"` を `ITEM_IDS` に追加
- `src/engine/ProcessingRecipes.ts` — `AutoProcessingDef` 型・`AUTO_PROCESSING_DEFS` 定数・`getAutoProcessingDef()` を追加
- `src/engine/AutoProcessingStorage.ts` — 新規作成（`KeyedSlotStorage<AutoProcessingSlots>` 派生）
- `src/_registry/entities/AutoProcessing.ts` — 新規作成（`registerAutoProcessingEntity()` ヘルパー + auto_thresher 登録）

## 動力判定の設計（拡張ポイント）

`getPowerConnectionPositions(anchorPos, size, _entityType)` が現状「外周4辺の全タイル」を返す。
将来 entityType ごとに「特定の 2 タイルだけ」を返したい場合はこの関数を変更する。
`_entityType` 引数は拡張用に既に受け取っている。

## 未完了の作業（別エージェント担当）

- `useGameEngine.ts` の `dailyTickStorages` 配列への `AutoProcessingStorage` 追加（view 側エージェント）
- `setAutoProcessingStorage()` の DI 呼び出し（view 側エージェント）
- `AutoProcessingPanel` UI コンポーネントの実装（view 側エージェント）
- `SaveSystem.ts` のセーブ/ロード対応（`AutoProcessingStorageSaveDataSchema`）
