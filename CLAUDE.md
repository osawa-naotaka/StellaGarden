# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

**重要**: Claude Codeとのやり取りは**常に日本語で行ってください**。回答、説明、コメント、エラーメッセージなど、全ての出力を日本語で提供してください。

## プロジェクト基本情報

**重要**: Claude Code起動時に doc 以下のファイルを読み込み、プロジェクトの全体像を理解してください。

## Claude Code作業指針

### 言語設定
- **全ての回答・説明を日本語で行う**
- Markdownファイルはすべて日本語で記述
- コードはすべて英語で記述
- エラーメッセージや説明も英語で提供

### ファイル作成・編集方針
- 既存ファイルの編集を優先し、新規作成は最小限に
- コード規約・スタイルは既存コードに合わせる
- セキュリティベストプラクティスの遵守（秘匿情報の保護）

---

## サブエージェントを使った分散コード編集

### 原則

**機能追加・修正の依頼を受けたとき、コードを直接書く前に必ず以下を行う:**

1. `doc/07_RE_ARCHETECTURE.md` を読み、アーキテクチャを把握する
2. タスクがどのモジュール（engine / view / input / lib）に属するかを特定する
3. 複数モジュールにまたがる場合は、モジュールごとにサブエージェントを分割して並列実行する

### サブエージェントへの指示テンプレート

```
あなたは StellaGarden の [担当モジュール] 担当エージェントです。

## 必ず最初に読むファイル
1. doc/07_RE_ARCHETECTURE.md
2. src/_boundary/events.ts
3. src/_boundary/interfaces.ts
4. [担当ファイル一覧]

## タスク
[具体的な実装内容]

## 制約
- engine/ の具体クラスを直接 import しないこと（インターフェース経由のみ）
- EventBroker 経由でないモジュール間通信を追加しないこと
- view/ は terrain_changed / inventory_changed 等 engine 発行イベントを購読しないこと
  （tick() で毎フレーム完全描画する方針のため）
- engine/ItemDefs.ts と engine/TerrainDefs.ts は純粋データ定数なので import して構わない
- 新しいイベントが必要な場合は src/_boundary/events.ts を先に更新すること
```

### モジュール分割の判断基準

| タスクの性質 | アプローチ |
|---|---|
| engine ロジックのみ（地形・インベントリ・農業） | engine エージェント1体 |
| view のみ（UI・描画） | view エージェント1体 |
| input + engine（新しい操作の追加） | input エージェントと engine エージェントを並列 |
| _boundary 変更を伴う（新イベント・新インターフェース） | 先に _boundary を自分で更新してからエージェントに委譲 |
| 単一ファイルの軽微な修正 | サブエージェント不要、直接編集 |

### 各モジュールが読む必須ファイル

- **engine エージェント**: `_boundary/events.ts`, `_boundary/interfaces.ts`, `engine/**`
- **view エージェント**: `_boundary/events.ts`, `_boundary/interfaces.ts`, `view/**`
- **input エージェント**: `_boundary/events.ts`, `input/**`
- **lib エージェント**: `_boundary/interfaces.ts`, `lib/**`

### 注意事項

- `_boundary/` の変更（新イベント追加・インターフェース変更）は全モジュールに影響するため、サブエージェントに委譲せず自分で行ってから各エージェントを起動する
- サブエージェントは `src/**` の Edit/Write 権限が必要（`.claude/settings.json` で設定済み）
- ビルド確認（`bun run build`）は全エージェント完了後に自分で行う
