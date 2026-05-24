import { useCallback, useEffect, useRef, useState } from "react";
import type { TimeSpeed } from "../../view/UIState";
import { useEngine } from "../EngineContext";

/**
 * ADV 型会話モーダル。doc/25_MISSION_SYSTEM.md §3.2 を実装する。
 *
 * - dialog_requested イベント受信でモーダルを開く
 * - 画面下部に横長セリフ枠、左端にバストアップ立ち絵（Phase 2 ではプレースホルダ）
 * - 任意のクリックで次のセリフへ進む
 * - 最終セリフをクリックすると dialog_finished を発行してモーダルを閉じる
 * - 表示中は uiState.setTimeSpeed("paused") でゲーム時間を停止
 *   会話終了時に開始前のスピードへ復帰する（"fast" 中に割り込まれたら "fast" に戻る）
 * - Ctrl キーホールドで高速再生（80ms 間隔で自動進行）
 *
 * 連続表示の挙動: dialog_finished を publish した直後に MissionSystem が次の
 * dialog_requested を publish した場合、subscribe コールバックが同期的に呼ばれて
 * 新しいスクリプトに置き換わる。React の自動バッチングにより視覚的なチラつきは発生しない。
 */

interface DialogScript {
    scriptId: string;
    speakerName: string;
    lines: ReadonlyArray<string>;
}

const FAST_FORWARD_INTERVAL_MS = 80;

export function DialogView() {
    const { eventBroker, uiState, missionSystem } = useEngine();
    const [script, setScript] = useState<DialogScript | null>(null);
    const [lineIndex, setLineIndex] = useState(0);
    const [ctrlHeld, setCtrlHeld] = useState(false);

    // 会話開始前の時間スピードを保存する（連続表示中は最初に保存した値を維持）
    const prevSpeedRef = useRef<TimeSpeed | null>(null);

    // dialog_requested を購読してモーダルを開く + マウント時に現在メインの opening を発火
    useEffect(() => {
        const dispose = eventBroker.subscribe("dialog_requested", (packet) => {
            if (prevSpeedRef.current === null) {
                prevSpeedRef.current = uiState.timeSpeed;
                uiState.setTimeSpeed("paused");
            }
            setScript({ scriptId: packet.scriptId, speakerName: packet.speakerName, lines: packet.lines });
            setLineIndex(0);
        });
        // subscribe 登録後に呼ぶことで、初回 opening の publish が確実に subscribe コールバックへ届く。
        // 既に triggeredDialogs に入っているスクリプトは MissionSystem 側で重複防止される。
        missionSystem.triggerOpeningForCurrentMain();
        return dispose;
    }, [eventBroker, uiState, missionSystem]);

    // 終了処理: スピード復帰 + dialog_finished 発行
    // 注意: publish は同期的に MissionSystem などのリスナーを呼び出すため、
    // ここから即座に次の dialog_requested が発火する可能性がある。
    // その場合、上の subscribe コールバックが同じ React コールスタック内で
    // setScript(newScript) を呼び、最終的に新しいスクリプトが表示される。
    const closeDialog = useCallback(
        (finishedId: string) => {
            setScript(null);
            setLineIndex(0);
            if (prevSpeedRef.current !== null) {
                uiState.setTimeSpeed(prevSpeedRef.current);
                prevSpeedRef.current = null;
            }
            eventBroker.publish("dialog_finished", { scriptId: finishedId });
        },
        [eventBroker, uiState],
    );

    // 1 ステップ進める。最終行で呼ばれたら終了。
    const advance = useCallback(() => {
        if (script === null) return;
        if (lineIndex < script.lines.length - 1) {
            setLineIndex((i) => i + 1);
        } else {
            closeDialog(script.scriptId);
        }
    }, [script, lineIndex, closeDialog]);

    // Ctrl キー押下状態の監視
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Control") setCtrlHeld(true);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Control") setCtrlHeld(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    // Ctrl ホールド中は一定間隔で自動進行
    useEffect(() => {
        if (!ctrlHeld || script === null) return;
        const interval = window.setInterval(() => {
            advance();
        }, FAST_FORWARD_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [ctrlHeld, script, advance]);

    if (script === null) return null;

    const isLastLine = lineIndex >= script.lines.length - 1;

    return (
        <div className="sg-dialog-overlay" onClick={advance}>
            <div className="sg-dialog-window">
                <div className="sg-dialog-portrait">
                    <span className="sg-dialog-portrait-placeholder">立ち絵</span>
                </div>
                <div className="sg-dialog-body">
                    <div className="sg-dialog-speaker">{script.speakerName}</div>
                    <div className="sg-dialog-text">{script.lines[lineIndex]}</div>
                    <div className={`sg-dialog-marker${isLastLine ? " is-last" : ""}`}>▼</div>
                </div>
            </div>
        </div>
    );
}
