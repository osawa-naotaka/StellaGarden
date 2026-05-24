import type { IEventBroker } from "../_boundary/interfaces";
import type { ChatHistorySaveData } from "../lib/SaveSchema";

/**
 * 会話ログエントリ。1 つの ADV 会話（dialog_requested 1 回分）に対応する。
 * scriptId は MissionSystem 側で "${mainId}:opening" / "${mainId}:completion" 形式で発行される。
 */
export interface ChatEntry {
    readonly scriptId: string;
    readonly speakerName: string;
    readonly lines: ReadonlyArray<string>;
}

/**
 * 後輩キャラとの会話履歴を保持する。doc/25_MISSION_SYSTEM.md §3.3 の「会話ログ」を実装する。
 *
 * - dialog_requested イベントを購読し、発行された会話を時系列で蓄積する
 * - BackLog ボタンから開ける ChatLogPanel が、このクラスから履歴を読んで表示する
 * - 履歴は全件保持する（doc/25 §4 ユーザー判断: 「全履歴を保持しましょう。そんなに莫大にはならないはず」）
 * - セーブ/ロード対応
 *
 * 重複防止は MissionSystem.triggeredDialogs 側で行うため、ChatHistory 側は届いたものを淡々と蓄積する。
 */
export class ChatHistory {
    private entries: ChatEntry[];
    private changeListeners: Set<() => void> = new Set();

    constructor(init?: ChatHistorySaveData) {
        this.entries = init ? init.entries.map((e) => ({ scriptId: e.scriptId, speakerName: e.speakerName, lines: [...e.lines] })) : [];
    }

    /**
     * EventBroker を購読する。dialog_requested を受信するたびにエントリを追加する。
     * 戻り値の dispose 関数で購読解除する。
     */
    subscribeEvents(broker: IEventBroker): () => void {
        return broker.subscribe("dialog_requested", (packet) => {
            this.entries.push({
                scriptId: packet.scriptId,
                speakerName: packet.speakerName,
                lines: [...packet.lines],
            });
            this.notifyChange();
        });
    }

    /** 現在の履歴を時系列（古い→新しい）で返す。 */
    getEntries(): ReadonlyArray<ChatEntry> {
        return this.entries;
    }

    /**
     * 状態変更時に呼ばれるリスナーを登録する。React UI 側で再描画トリガとして使う。
     * 戻り値の dispose 関数で解除する。
     */
    onChange(listener: () => void): () => void {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }

    /** セーブ用に内部状態を返す。 */
    toSaveData(): ChatHistorySaveData {
        return {
            entries: this.entries.map((e) => ({
                scriptId: e.scriptId,
                speakerName: e.speakerName,
                lines: [...e.lines],
            })),
        };
    }

    private notifyChange(): void {
        for (const listener of this.changeListeners) listener();
    }
}
