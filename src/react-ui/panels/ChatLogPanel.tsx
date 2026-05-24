import { useEffect, useReducer, useRef } from "react";
import { SidePanel } from "../components/SidePanel";
import { useEngine } from "../EngineContext";

export interface ChatLogPanelProps {
    open: boolean;
    onClose: () => void;
}

/**
 * 後輩キャラとの会話履歴を読み返せるパネル。
 * doc/25_MISSION_SYSTEM.md §3.3 の「会話ログ」を実装する。
 *
 * - GuidePanel と同じ SidePanel パターン（左からスライドイン）
 * - 履歴は時系列（古い→新しい）で表示
 * - パネルを開いたタイミングで最新エントリへスクロール
 * - ChatHistory.onChange を購読して、開いている間に新規エントリが追加されても反映する
 */
export function ChatLogPanel({ open, onClose }: ChatLogPanelProps) {
    const { chatHistory } = useEngine();
    const [, forceUpdate] = useReducer((x: number) => (x + 1) | 0, 0);
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => chatHistory.onChange(forceUpdate), [chatHistory]);

    // 開いた瞬間（および新規エントリ追加時）に最新まで自動スクロール
    const entries = chatHistory.getEntries();
    useEffect(() => {
        if (!open) return;
        const el = bodyRef.current;
        if (el) {
            // SidePanel の sg-sidepanel-body 内でスクロールするため、親まで遡って scrollTop を最大に
            const scroller = el.closest(".sg-sidepanel-body") as HTMLElement | null;
            if (scroller) scroller.scrollTop = scroller.scrollHeight;
        }
    }, [open, entries.length]);

    return (
        <div className={`sg-chatlog-panel${open ? " is-open" : ""}`}>
            <SidePanel open={open} title="会話ログ" onClose={onClose}>
                <div ref={bodyRef} className="sg-chatlog-body">
                    {entries.length === 0 ? (
                        <p className="sg-chatlog-empty">まだ会話履歴はありません。</p>
                    ) : (
                        entries.map((entry, entryIdx) => (
                            <div key={`${entry.scriptId}-${entryIdx}`} className="sg-chatlog-entry">
                                <div className="sg-chatlog-speaker">{entry.speakerName}</div>
                                {entry.lines.map((line, lineIdx) => (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: 行は表示順固定の静的リスト
                                    <p key={lineIdx} className="sg-chatlog-line">
                                        {line}
                                    </p>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </SidePanel>
        </div>
    );
}
