# StellaGarden アーキテクチャ専門家 メモリ

## 詳細ノートへのリンク
- [engine/ モジュール詳細](./engine-module.md)

## 重要なアーキテクチャ原則
- 依存方向: `view/input → model(App.tsx) → engine → lib`（一方向）
- Phase 1〜5 全完了済み。`model/GameState.ts` は削除済み。`App.tsx` が DI コンテナ。
- `_boundary/` が全モジュールの境界定義を管理（events.ts / interfaces.ts / constants.ts）

## engine/ モジュール構成（7ファイル）
- `ItemDefs.ts`: アイテム定義（純粋定数。view/input から直接 import 可）
- `TerrainDefs.ts`: ボクセルビットフィールド定義・デコード関数（純粋。直接 import 可）
- `Inventory.ts`: IInventoryWriter 実装。ツールバー10スロット + インベントリ64スロット
- `PlayerState.ts`: IPlayerStateWriter 実装。位置・ズーム管理。Inventory を内包
- `GameTime.ts`: IGameTimeReader 実装。10秒/日（開発短縮）。day_changed イベント発行
- `CropSystem.ts`: dryWetSoil / advanceDayAllCrops の純粋関数。IVoxelWriter 引数
- `TerrainGenerator.ts`: 初期化専用。VoxelMap 具体クラスを直接受け取る（例外）

## 重要な設計パターン
- `setEventBroker()` 後注入パターン: Inventory / PlayerState / VoxelMap で採用。地形生成中のイベント洪水を防ぐ
- TerrainGenerator のみ VoxelMap 具体クラスを直接参照（初期化専用のため意図的例外）
- addItem は満杯時 false を返す → インタラクト全体キャンセルに使用
- setPointerPosInWorld は高頻度のため EventBroker を経由しない（意図的例外）
