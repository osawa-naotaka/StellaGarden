---
name: craft_ui_implementation
description: CraftPane.ts 新規作成と InventoryView.ts タブ化によるクラフトUI実装の詳細
type: project
---

2026-03-20 に実装。

**Why:** クラフトシステム（CraftSystem / RecipeDefs）は engine 側に既に実装済みで、view 側のUIが未実装だったため追加。

**変更ファイル:**
- `src/view/CraftPane.ts` — 新規作成。クラフトタブ右ペイン（レシピグリッド＋素材表示）
- `src/view/InventoryView.ts` — タブバー追加（Inventory / Craft）、CraftPane 統合
- `src/App.tsx` — CraftSystem インスタンス生成、InventoryView への DI、open_craft_ui イベント購読

**How to apply:** 次回 view/ の UI 拡張時は、CraftPane のパターン（RecipeIcon / MaterialRow 事前確保 + tick で alpha 更新）を参考にする。
