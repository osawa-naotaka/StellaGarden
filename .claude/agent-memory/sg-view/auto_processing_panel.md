---
name: auto-processing-panel
description: AutoProcessingPanel の実装パターンと配線箇所の記録
metadata:
  type: project
---

AutoProcessingPanel（自動加工機械 UI）を実装した際の変更ファイル一覧と要点。

**Why:** シャフト動力で day_changed 時に一括処理する auto_thresher 等の専用パネルを追加。

**How to apply:** 同種のパネル追加タスクで参照すること。

## 変更ファイル

1. `src/view/UIState.ts` — UIMode に `"processing-auto"` 追加、`subscribeEvents` で `open_processing_auto_ui` を購読（d8 として追加）
2. `src/react-ui/EngineContext.tsx` — `EngineRefs` に `autoProcessingStorage: AutoProcessingStorage` 追加
3. `src/react-ui/hooks/gameEngineBoot.ts` — `Storages` 型と `bootstrapStorages` に `autoProcessingStorage` 追加、`setAutoProcessingStorage` 呼び出し追加
4. `src/react-ui/hooks/useGameEngine.ts` — `dailyTickStorages` 配列に `autoProcessingStorage` 追加、`setEngineRefs` と `buildSaveData` の引数に追加
5. `src/react-ui/hooks/buildSaveData.ts` — `SaveSnapshotDeps` と return オブジェクトに `autoProcessingStorage` 追加
6. `src/react-ui/panels/AutoProcessingPanel.tsx` — 新規作成（DailyProcessingPanel ベース）
7. `src/react-ui/SgUiRoot.tsx` — `import "./panels/AutoProcessingPanel"` を追加（自己登録パターン）

## AutoProcessingPanel の特徴

- 入力: `InventoryGrid` rows=2, cols=4（8スロット）
- 出力: `InventoryGrid` rows=4, cols=4（16スロット）
- 処理ボタンなし（自動進行）
- 動力インジケータ: `autoProcessingStorage.isPowered(pos, voxelMap)` を毎フレーム読み、`style={{ color: ... }}` で色切り替え
- `canPlaceTo("processing_output", _)` は false（出力への配置不可）
- `canPlaceTo("processing_input", stack)` は `autoProcessingStorage.canAcceptInput(pos, stack.itemId, voxelMap)` を返す
