# engine/ モジュール詳細ノート

最終調査日: 2026-03-02

## ファイル一覧と役割

| ファイル | 実装インターフェース | 外部依存 | イベント発行 |
|---|---|---|---|
| ItemDefs.ts | なし（純粋定数） | なし | なし |
| TerrainDefs.ts | なし（純粋関数） | なし | なし |
| Inventory.ts | IInventoryWriter | ItemDefs | inventory_changed |
| PlayerState.ts | IPlayerStateWriter | Inventory, ChunkRenderer定数 | player_position_changed |
| GameTime.ts | IGameTimeReader | _boundary/interfaces | day_changed |
| CropSystem.ts | なし（純粋関数） | TerrainDefs, _boundary/interfaces | なし |
| TerrainGenerator.ts | なし（初期化関数） | lib/VoxelMap（具体クラス）, TerrainDefs | なし（broker未注入時） |

## ボクセルビットフィールド構造
- bits  0- 7: 地形タイプ (TERRAIN_TYPES: empty=0, water=1, grass=2, soil=3, wetSoil=4, dirt=5)
- bits  8-15: エンティティタイプ (ENTITY_TYPES: none=0, tree=1, potato=2)
- bits 16-18: 作物育成カウンタ (0=seed, 1〜5=potato_1〜potato_5)
- bits 19-31: 将来拡張用

## GameTime の時間設定
- DAY_DURATION_MS = 10_000（開発用短縮。本来は 600_000）
- 初期 elapsedMs = DAWN_TIME_MS = DAY_DURATION_MS * 5/24 ≒ 2083ms
- 初回 day_changed は約 9.6秒後（DAWN_TIME_MS から DAY_DURATION_MS 経過時）

## Inventory のデフォルトツールバー
スロット0: hand（固定）
スロット1: watering_can
スロット2: pickaxe
スロット3: axe
スロット4: sickle
スロット5: shovel
スロット6: hoes
スロット7: potato (64個)
スロット8-9: 空

## PlayerState の定数
- MOVE_SPEED = 10 タイル/秒
- MIN_ZOOM = 0.5, MAX_ZOOM = 4.0
- 移動範囲クランプ: CHUNK_RENDER_MARGIN を考慮

## TerrainGenerator の地形生成アルゴリズム
- ノイズシード "terrain" (scale=0.01): ハイトマップ
  - h < horizonHeight: 底から dirt、h〜horizonHeight は water
  - h >= horizonHeight: 底から dirt、表面のみ grass
- ノイズシード "forest" (scale=0.025): 森バイオーム判定 (閾値 >0.2)
- ノイズシード "tree" (scale=0.15): 木の配置 (閾値 >0.3、forest AND tree)
  - grass または soil の表面にのみ配置
