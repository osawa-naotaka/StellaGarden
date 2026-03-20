# sg-input エージェント メモリ

## InteractionSystem.ts の高さ比較関数

- `isFlat3x3`, `isSafeToAdd3x3`, `isSafeToRemove3x3`, `revertNearbyInvalidTerrain` の全てで `getGroundSurfacePosition` を使う（`getSurfacePosition` は水面高さを返すため不適切）
- `case "dirt"` では `getSurfacePosition` ではなく `getGroundSurfacePosition` で地面位置を取得し、地面の terrainType（grass/dirt）で判定する

## IVoxelReader の主要メソッド

- `getSurfacePosition`: 最上層のボクセル位置（水を含む）
- `getGroundSurfacePosition`: 水タイルを無視した最上層の地面位置（dirt/grass/soil 等）

## open_craft_ui イベントの発行パターン

- `createInteractionHandler` 内、`switch (tool)` の直前で作業台エンティティを検出する
- `entityType === ENTITY_TYPES.workbench` の場合はそのままクラフトUI発行
- `entityType === ENTITY_TYPES.facility_part` の場合は `findFacilityAnchor` でアンカーの `def.id` が `"workbench"` かを確認してから発行
- axe/pickaxe ツール時は撤去操作を優先するため `open_craft_ui` を発行せず `switch` に処理を委ねる
