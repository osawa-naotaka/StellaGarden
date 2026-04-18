# StellaGarden 向け Copilot 指示

## ビルド・lint・テストコマンド

- `bun run dev` - Vite development server
- `bun run build` - TypeScript project build + Vite production build
- `bun run check` - Biome check with `--write` for `./src` and `./worker` (this command rewrites files)
- `bunx biome check ./src ./worker` - non-writing equivalent of the Biome check
- `bunx biome check src/App.tsx` - lint a single file

現在、`package.json` に `test` script やテストフレームワークは定義されていません。単体テストだけを実行する既存コマンドもありません。

## アーキテクチャ概要

- フロントエンドのエントリポイントは `src/router.tsx` です。React Router と MUI レイアウトを組み立て、実際のゲーム起動は `src/App.tsx` が担当します。
- `src/App.tsx` は単なる画面コンポーネントではなく、PixiJS アプリ初期化、`EventBroker` の作成、`engine/`・`view/`・`input/` の配線、registry の副作用 import、30秒ごとの IndexedDB 自動保存までまとめて担う DI コンテナです。
- モジュール境界の正規定義は `src/_boundary/` です。`events.ts` に全イベント型、`interfaces.ts` にモジュール間インターフェース、`constants.ts` に共有定数があります。`view/` と `input/` はここを通して `engine/` / `lib/` と接続します。
- ゲーム内の振る舞い定義は `src/_registry/` に集約されています。`EntityRegistry` / `ItemRegistry` / `TerrainRegistry` があり、各 entity/item/terrain は 1 ファイルずつ登録されます。新しい定義ファイルを追加しただけでは足りず、`src/App.tsx` の副作用 import にも追加しないと登録されません。
- データフローは「`input/` が `EventBroker` に publish → `engine/` が状態更新 → `view/` は tick ごとに Reader interface から状態を読む」です。`view/` は通常、`terrain_changed` や `inventory_changed` のような engine イベントを購読せず、毎フレーム再評価する前提です。
- UI も同じ思想で、`src/view/UIState.ts` が純粋データとして UI モードを保持し、イベントで更新され、各 view が tick で読みます。
- 永続化は2系統あります。ゲーム進行は `src/lib/SaveSystem.ts` が IndexedDB に保存し、サーバー API は `worker/index.ts` の Hono + D1 Worker が担当します。API 入出力型と DB schema は `type/types.ts` にまとまっています。

## 重要な規約

- 複数モジュールにまたがる変更は `_boundary/` から始めてください。新しいイベントは `src/_boundary/events.ts`、新しい共有型や cross-module interface は `src/_boundary/interfaces.ts` が正規の追加先です。
- `view/` から `engine/` の具体クラスを直接 import しません。`input/` も engine の具体クラスを直接操作せず、原則 `EventBroker` 経由で操作通知を送ります。例外的に `engine/TerrainDefs.ts` のような純粋定数・純粋関数ファイルは直接 import されています。
- `src/_registry/` はこのリポジトリの重要な設計パターンです。エンティティやアイテムの追加では巨大 switch を増やさず、既存 registry に定義を登録してください。インタラクションは `InteractionSystem` が Entity → Item → Terrain の順でディスパッチします。
- 座標系は `x/z` 平面です。`y` は高さ方向で、`Pos2D` は `{ x, z }` です。地形データは `bigint` ベースの voxel 値で扱われます。
- `EventBroker.subscribe()` の戻り値は dispose 関数です。`App.tsx` と同じように配列などへ保持し、cleanup で必ず解放してください。
- `bun run check` は lint だけでなく整形と import 整理も含めて書き換えます。変更を確認しながら進めたいときは先に `bunx biome check ...` を使う前提で考えると安全です。
