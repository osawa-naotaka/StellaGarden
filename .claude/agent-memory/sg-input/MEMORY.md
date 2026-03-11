# sg-input エージェント メモリ

## InteractionSystem.ts の高さ比較関数

- `isFlat3x3`, `isSafeToAdd3x3`, `isSafeToRemove3x3`, `revertNearbyInvalidTerrain` の全てで `getGroundSurfacePosition` を使う（`getSurfacePosition` は水面高さを返すため不適切）
- `case "dirt"` では `getSurfacePosition` ではなく `getGroundSurfacePosition` で地面位置を取得し、地面の terrainType（grass/dirt）で判定する

## IVoxelReader の主要メソッド

- `getSurfacePosition`: 最上層のボクセル位置（水を含む）
- `getGroundSurfacePosition`: 水タイルを無視した最上層の地面位置（dirt/grass/soil 等）
