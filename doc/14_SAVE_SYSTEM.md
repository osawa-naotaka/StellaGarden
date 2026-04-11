# セーブシステム設計書

> **目的**: ブラウザ側にゲーム状態を永続化し、リロード時に前回の状態を復元する。
> **ステータス**: 実装中

---

## 概要

IndexedDB を使い、ゲーム状態（VoxelMap・プレイヤー情報・インベントリ・ゲーム内時刻・チェストストレージ）をブラウザに保存する。リロード時にデータが存在すれば復元し、存在しなければ新規生成（従来どおり）を行う。

---

## 保存対象

| データ | 型 | サイズ見積もり | 備考 |
|---|---|---|---|
| VoxelMap | `Uint32Array` (400×12×400) | ~7.7MB | バイナリのまま保存 |
| PlayerState | position, zoom, facing | 数十バイト | |
| Inventory | toolbar(10) + inventory(64) スロット | ~数KB | |
| GameTime | `elapsedMs` (number) | 8バイト | |
| ChestStorage | `Map<string, (ItemStack\|null)[]>` | 可変 | チェスト数に依存 |

---

## 保存先

**IndexedDB** を使用する。

- localStorage は 5~10MB 制限で VoxelMap（~7.7MB）が入らない
- IndexedDB はバイナリ（`Uint32Array`）をそのまま格納でき、容量制限も数百MB〜GB 単位
- 非同期 API のためメインスレッドをブロックしない

---

## DB スキーマ

```
DB名: "stella-garden"
バージョン: 1

オブジェクトストア:
  "saveData"  ← 全セーブデータを1レコードで保存（キー: "autosave"）
```

### セーブデータ構造

```typescript
interface SaveData {
    version: number;  // セーブデータバージョン（現在: 1）
    timestamp: number;  // 保存日時（Date.now()）
    voxelMap: {
        width: number;
        height: number;
        depth: number;
        horizonHeight: number;
        voxels: Uint32Array;
    };
    playerState: {
        posInWorld: Pos2D;
        zoomLevel: number;
        facing: Direction8;
    };
    inventory: {
        toolbarSlots: (ItemStack | null)[];
        inventorySlots: (ItemStack | null)[];
        selectedIndex: number;
    };
    gameTime: {
        elapsedMs: number;
    };
    chestStorage: {
        chests: Array<{ key: string; slots: (ItemStack | null)[] }>;
    };
}
```

---

## 保存タイミング

| トリガー | 説明 |
|---|---|
| 定期保存（60秒ごと） | ゲームループ内でタイマーを管理し、60秒経過ごとにセーブを実行 |

- `beforeunload` イベントでの保存は行わない（IndexedDB の非同期処理は完了保証が弱いため）
- 定期保存のみで十分シンプルかつ安全

---

## ロード時のフロー

```
App.tsx init()
  ├── IndexedDB からセーブデータをロード
  ├── データあり → 復元
  │   ├── VoxelMap: メタデータ + voxels 配列から復元
  │   ├── PlayerState: 復元した位置・ズーム・向きで生成
  │   ├── Inventory: 復元したスロットで生成
  │   ├── GameTime: elapsedMs を復元
  │   └── ChestStorage: Map を復元
  └── データなし → 新規ゲーム
      ├── generateTerrain() で地形生成
      └── デフォルト値で各オブジェクト生成
```

---

## 実装配置

```
src/
  lib/
    SaveSystem.ts    ← IndexedDB ラッパー（save / load 関数）
```

`lib/` に配置する理由:
- IndexedDB 操作はゲームロジック（engine）にも描画（view/PixiJS）にも依存しない
- 汎用ユーティリティとして独立

各エンジンクラスへのシリアライズ/デシリアライズ用メソッド追加は行わない。`SaveSystem.ts` 側で各オブジェクトから直接フィールドを読み取り、復元時はコンストラクタ引数で渡す方式とする。

---

## バージョニング

- セーブデータに `version` フィールドを持つ（初版: `1`）
- 将来データ構造が変わった場合、`version` を見てマイグレーション処理を行う
- マイグレーション不能な場合はセーブデータを破棄して新規ゲームを開始する

---

## 将来の拡張

- **差分保存**: VoxelMap が巨大化した場合、チャンク単位の差分保存を検討
- **複数セーブスロット**: DB キー（現在は `"autosave"` 固定）を変えるだけで対応可能
- **手動セーブ**: UIボタンからの任意タイミング保存
