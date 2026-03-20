---
name: CraftSystem と RecipeDefs の追加
description: src/engine/CraftSystem.ts と src/engine/RecipeDefs.ts が新規作成された（2026-03-20）
type: project
---

src/engine/RecipeDefs.ts と src/engine/CraftSystem.ts が新規追加された。

**Why:** クラフト機能の実装。ICraftSystem インターフェースは _boundary/interfaces.ts に定義済み。

**How to apply:** engine の担当ファイル一覧に CraftSystem.ts と RecipeDefs.ts を含める。
getAvailableRecipes は station="workbench" のとき全レシピ（素手含む）を返す設計。
craft() は toolbarSlots → inventorySlots の順に素材を消費する。
