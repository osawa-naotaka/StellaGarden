# セーブシステム設計書

> 本ドキュメントは旧セーブ仕様を、現在のデータ構造と最新設計に合わせて更新したものである。  
> 特に `13_RE_RE_ARCHETECTURE.md`、`19_CRAY.md`、`20_FORGE.md` の内容を反映し、旧来の `uint32` 前提・最小構成の保存仕様を見直している。

---

## 1. 目的

ブラウザ上で動作する Stella Garden のゲーム状態を永続化し、リロードや再訪問時に前回の状態を復元できるようにする。

本セーブシステムの目的は以下の通り。

- プレイヤーの進行状況を安全に保存する
- 地形・インベントリ・施設ストレージなどの複雑な状態を破綻なく復元する
- 今後の機能追加に耐えられるバージョニング構造を持つ
- ブラウザゲームとして現実的な容量・速度で運用できるようにする

---

## 2. 基本方針

### 2.1 保存先

保存先は **IndexedDB** を使用する。

理由:

- `localStorage` では容量が不足しやすい
- TypedArray をそのまま扱いやすい
- 非同期で保存できる
- 将来的なデータ拡張にも対応しやすい

### 2.2 保存単位

基本は **1つの autosave レコード** に全体状態を保存する。

- 初期実装では複数セーブスロットは持たない
- 将来的にキーを増やすことで複数スロット化可能
- 差分保存は現時点では採用しない

### 2.3 保存タイミング

- 定期保存
- 明示的な重要イベント後の保存は将来検討
- `beforeunload` 依存はしない

現時点では、**一定間隔の自動保存**を基本とする。

### 2.4 バージョニング

セーブデータには `version` を持たせる。  
互換性が壊れる変更が入った場合はバージョンを上げる。

- 読み込み可能ならマイグレーション
- 難しい場合は破棄して新規開始

---

## 3. 旧仕様からの主な変更点

旧仕様では以下の前提があった。

- `VoxelMap` は `Uint32Array`
- 保存対象は `VoxelMap / PlayerState / Inventory / GameTime / ChestStorage` が中心
- 地形以外の追加ストレージは少ない
- UI状態や新規施設ストレージは未考慮

最新仕様では、以下の点を更新する必要がある。

### 3.1 VoxelMap のビット幅更新

旧仕様の `uint32` 前提は古い。  
現在はボクセル表現の拡張が進んでおり、少なくとも設計上は **64bit 前提** を見込む必要がある。

そのため、セーブ対象の voxel 配列は以下を正とする。

- `BigUint64Array`

### 3.2 riversideCells の保存追加

粘土再生成システムにより、`VoxelMap` は単なる voxel 配列だけでなく、  
**大河沿い水辺セルのレジストリ** を持つ。

これを保存しないと、ロード後に粘土再生成が破綻する。

### 3.3 ForgeStorage の保存追加

炉は単なる地図上エンティティではなく、内部に3スロットのストレージを持つ。

- 原材料
- 燃料
- 結果

したがって、`ForgeStorage` を保存対象に追加する必要がある。

### 3.4 UI状態は保存対象外

`UIState` は一時的な表示状態であり、セーブ対象にしない。

例:
- インベントリを開いていたか
- 配置モード中だったか
- 炉UIを開いていたか

これらはロード時に初期状態へ戻す。

---

## 4. 保存対象

現時点での保存対象は以下。

| データ | 内容 | 保存対象 |
|---|---|---|
| VoxelMap | 地形・地上エンティティ・各種ビット情報 | 必須 |
| riversideCells | 粘土再生成用の水辺セル一覧 | 必須 |
| PlayerState | プレイヤー位置・ズーム等 | 必須 |
| Inventory | ツールバー・インベントリ・選択状態 | 必須 |
| GameTime | 経過時間・日付進行 | 必須 |
| ChestStorage | チェストの中身 | 必須 |
| ForgeStorage | 炉の中身 | 必須 |
| その他施設ストレージ | 将来追加 | 拡張対象 |

---

## 5. 保存しないもの

以下は保存対象に含めない。

| データ | 理由 |
|---|---|
| UIState | 一時状態であり、ロード時に初期化すべき |
| PixiJS の描画状態 | 再生成可能 |
| EventBroker の購読状態 | 再構築可能 |
| キャッシュ類 | 再生成可能 |
| 一時的なホバー状態 | 再生成不要 |
| 開いているダイアログ | ロード時に閉じた状態でよい |

---

## 6. データ構造

## 6.1 SaveData 全体構造

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-58
interface SaveData {
    version: number;
    timestamp: number;

    voxelMap: VoxelMapSaveData;
    playerState: PlayerStateSaveData;
    inventory: InventorySaveData;
    gameTime: GameTimeSaveData;

    chestStorage: ChestStorageSaveData;
    forgeStorage: ForgeStorageSaveData;
}
```

---

## 6.2 VoxelMapSaveData

最新仕様では `VoxelMap` は voxel 配列に加えて `riversideCells` を持つ。

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-20
interface VoxelMapSaveData {
    width: number;
    height: number;
    depth: number;
    horizonHeight: number;
    voxels: BigUint64Array;
    riversideCells: Uint32Array;
}
```

### 各項目の意味

- `width`, `height`, `depth`
  - マップサイズ
- `horizonHeight`
  - 水面判定に必要
- `voxels`
  - 地形・エンティティ・各種ビットを含む本体
- `riversideCells`
  - 粘土再生成用の大河沿いセル一覧

---

## 6.3 PlayerStateSaveData

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-16
interface PlayerStateSaveData {
    posInWorld: { x: number; z: number };
    zoomLevel: number;
}
```

### 補足

旧仕様では `facing` を含める案があったが、現在の設計では必須でない。  
もし実装上保持しているなら追加してよいが、現時点の必須項目は以下で十分。

- ワールド座標
- ズームレベル

`pointerPosInWorld` のような一時入力状態は保存しない。

---

## 6.4 InventorySaveData

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-20
interface ItemStackSaveData {
    itemId: string;
    count: number;
}

interface InventorySaveData {
    toolbarSlots: (ItemStackSaveData | null)[];
    inventorySlots: (ItemStackSaveData | null)[];
    selectedIndex: number;
}
```

### 補足

- `itemId` は registry 側で解決する
- `selectedTool` は `selectedIndex` から復元できるため保存不要
- スロット数はロード時に妥当性チェックする

---

## 6.5 GameTimeSaveData

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-10
interface GameTimeSaveData {
    elapsedMs: number;
}
```

### 補足

- ゲーム内日付や時刻は `elapsedMs` から復元する
- 日跨ぎ判定ロジックはロード後に通常どおり機能する

---

## 6.6 ChestStorageSaveData

チェストは位置ごとにスロット配列を持つ。

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-20
interface ChestEntrySaveData {
    key: string;
    slots: (ItemStackSaveData | null)[];
}

interface ChestStorageSaveData {
    chests: ChestEntrySaveData[];
}
```

### `key` について

`key` は座標由来の文字列キーを想定する。  
実装側で `Pos2D` と相互変換できる形式であること。

例:
- `"x,z"`
- `"x:10,z:20"`

形式は実装に合わせるが、**安定して往復できること**が条件。

---

## 6.7 ForgeStorageSaveData

炉は位置ごとに3スロットを持つ。

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-28
interface ForgeSlotsSaveData {
    ingredient: ItemStackSaveData | null;
    fuel: ItemStackSaveData | null;
    output: ItemStackSaveData | null;
}

interface ForgeEntrySaveData {
    key: string;
    slots: ForgeSlotsSaveData;
}

interface ForgeStorageSaveData {
    forges: ForgeEntrySaveData[];
}
```

### 補足

- `ingredient` には `meteoric_iron`
- `fuel` には `charcoal`
- `output` には `hot_meteoric_iron`

が入る想定だが、保存形式自体は汎用的にしておく。

---

## 7. DB スキーマ

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-12
DB名: "stella-garden"
バージョン: 2

オブジェクトストア:
  "saveData"

キー:
  "autosave"
```

### バージョンを 2 とする理由

旧仕様から以下の互換性破壊があるため。

- voxel 配列の型見直し
- `riversideCells` の追加
- `forgeStorage` の追加

そのため、旧版セーブとの完全互換は前提にしない。  
必要なら `version: 1` を読み込んで破棄する。

---

## 8. 保存タイミング

## 8.1 基本方針

一定間隔で自動保存する。

例:
- 30秒ごと
- 60秒ごと

実際の間隔は `App.tsx` 側の運用に合わせる。

### 推奨方針

- 頻繁すぎる保存は避ける
- しかしブラウザゲームとして、長時間未保存も避ける
- 30〜60秒程度が現実的

## 8.2 保存トリガー候補

現時点の正式運用は定期保存だが、将来的には以下も候補。

- 日付変更時
- 施設配置後
- クラフト完了後
- 明示的な手動保存
- 設定画面からの保存

ただし、初期段階では複雑化を避けるため、**定期保存のみでも十分**。

---

## 9. ロード時のフロー

## 9.1 全体フロー

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-18
App.tsx init()
  ├── IndexedDB から autosave をロード
  ├── データあり
  │   ├── version を確認
  │   ├── VoxelMap を復元
  │   ├── riversideCells を復元
  │   ├── PlayerState を復元
  │   ├── Inventory を復元
  │   ├── GameTime を復元
  │   ├── ChestStorage を復元
  │   ├── ForgeStorage を復元
  │   └── 炉の見た目状態を再判定
  └── データなし
      └── 新規ゲーム生成
```

## 9.2 VoxelMap の復元

- サイズ情報を使って `VoxelMap` を生成
- `voxels` を流し込む
- `riversideCells` を設定する

## 9.3 ChestStorage / ForgeStorage の復元

- 保存データから内部マップを復元
- 座標キーとスロット内容を再構築する

## 9.4 炉の見た目再判定

`ForgeStorage` を復元した後、各炉について以下を再判定する。

- 原材料あり
- 燃料あり

両方あるなら `forge_burning`、そうでなければ `forge` にする。

これは voxel 側の見た目状態とストレージ状態の整合を取るために必要。

---

## 10. セーブ/ロードAPIの責務

## 10.1 SaveSystem の責務

`SaveSystem.ts` は以下を担当する。

- DB のオープン
- セーブデータの保存
- セーブデータの読み込み
- セーブデータの削除
- バージョン確認
- 必要最低限の整形

## 10.2 SaveSystem が持たない責務

以下は `SaveSystem.ts` に持たせない。

- ゲームロジックの判断
- EventBroker の再接続
- UIの復元
- 描画キャッシュの復元
- 施設状態の高レベル再計算

これらは `App.tsx` や各システム側で行う。

---

## 11. 実装配置

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-12
src/
  lib/
    SaveSystem.ts
```

### 理由

- IndexedDB 操作はゲームロジックそのものではない
- 描画にも依存しない
- 汎用的な永続化ユーティリティとして独立させるのが自然

---

## 12. シリアライズ方針

## 12.1 基本方針

各クラスに重い `serialize()` / `deserialize()` を持たせるのではなく、  
`SaveSystem.ts` 側で必要なフィールドを読み書きする。

### 利点

- 各クラスの責務が増えすぎない
- 保存形式の変更を1箇所に寄せやすい
- セーブデータ構造を俯瞰しやすい

## 12.2 TypedArray の扱い

保存時は `BigUint64Array` や `Uint32Array` をそのまま保存する。  
IndexedDB はこれらを扱える前提で設計する。

必要なら内部で `ArrayBuffer` ベースに変換してもよいが、  
設計上は **TypedArray を保持したまま保存する** 方針とする。

---

## 13. バージョニング方針

## 13.1 version フィールド

全セーブデータに `version` を持たせる。

```/dev/null/StellaGarden/doc/14_SAVE_SYSTEM.md#L1-6
{
  version: 2,
  timestamp: 1234567890,
  ...
}
```

## 13.2 読み込み時の扱い

| version | 扱い |
|---|---|
| 2 | 正常読み込み |
| 1 | 旧仕様。原則破棄または限定対応 |
| 不明 | 破棄 |

## 13.3 互換性破壊の例

以下のような変更が入ったら version を上げる。

- voxel ビット構造の変更
- 新しい必須ストレージの追加
- 既存ストレージ形式の変更
- 座標キー形式の変更

---

## 14. エラーハンドリング

## 14.1 保存失敗時

- コンソールに詳細ログ
- 必要なら軽い通知
- ゲーム進行自体は止めない

## 14.2 ロード失敗時

- セーブデータ破損として扱う
- ログを出す
- 新規ゲーム生成へフォールバックする

## 14.3 部分破損時

可能なら全体破棄よりも安全にフォールバックしたいが、  
初期段階では複雑化を避け、**整合性が怪しい場合は新規開始**を優先する。

---

## 15. 将来の拡張

## 15.1 複数セーブスロット

現在は `"autosave"` 固定だが、将来的には以下のように拡張可能。

- `"slot1"`
- `"slot2"`
- `"slot3"`

## 15.2 手動セーブ

UIから任意タイミングで保存する機能を追加可能。

## 15.3 差分保存

マップや施設がさらに大規模化した場合は検討対象。

ただし現時点では:

- 実装が複雑
- バグ要因が増える
- フィージビリティ段階では過剰

のため採用しない。

## 15.4 追加ストレージ対応

今後、以下のような施設ストレージが増える可能性がある。

- 加工機械ストレージ
- 堆肥場の内部状態
- 浸漬槽の進行状態
- 自動化設備の内部インベントリ
- 物流台車の積載状態

その場合は `SaveData` に新しいセクションを追加する。

---

## 16. 現時点での正式な整理

### 正式仕様
- 保存先は IndexedDB
- autosave 1本構成
- `version: 2`
- `VoxelMap` は `BigUint64Array` 前提
- `riversideCells` を保存する
- `ChestStorage` を保存する
- `ForgeStorage` を保存する
- UI状態は保存しない
- ロード後に炉の見た目状態を再判定する

### 旧仕様として扱うもの
- `Uint32Array` 前提の voxel 保存
- `riversideCells` を持たない VoxelMap 保存
- `ForgeStorage` を含まない保存構造
- UI状態まで保存する前提
- 最小構成だけを想定した version 1 の設計

---

## 17. まとめ

最新の Stella Garden のセーブシステムは、  
単なる地形保存ではなく、

- 拡張された voxel データ
- 粘土再生成用レジストリ
- チェストストレージ
- 炉ストレージ

まで含めた、**複数システム横断の永続化基盤**である。

その一方で、UI状態や描画キャッシュのような一時情報は保存せず、  
**ゲームとして意味のある状態だけを保存する** 方針を取る。

これにより、設計はシンプルさを保ちつつ、  
今後の灌漑・加工・自動化の拡張にも耐えられる構造になる。