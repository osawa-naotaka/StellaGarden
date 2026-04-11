import type { IEventBroker, IGameTimeReader } from "../_boundary/interfaces";

/** リアルタイム1日の長さ（ms）。ゲーム内1日 = 10分。 */
// const DAY_DURATION_MS = 600_000;
const DAY_DURATION_MS = 10_000;

/** ゲーム内の朝5時に相当する経過時間（ms）。 */
const DAWN_TIME_MS = (DAY_DURATION_MS * 5) / 24;

/**
 * ゲーム内時間を管理するクラス。
 *
 * - ゲーム内1日 = リアルタイム10分（600,000ms）
 * - ゲーム開始時は朝5時直後からスタート（初回の day_changed は10分後）
 * - tick(deltaMS, broker) を毎フレーム呼ぶことで時間を進める
 * - 朝5時（ゲーム内）を通過したとき broker.publish("day_changed", {}) を発行する
 */
export class GameTime implements IGameTimeReader {
    /** ゲーム開始からの経過時間（ms）。朝5時直後からスタート。 */
    private elapsedMs: number;

    constructor(initialElapsedMs?: number) {
        this.elapsedMs = initialElapsedMs ?? DAWN_TIME_MS;
    }

    /** 現在の経過時間を返す（セーブ用）。 */
    getElapsedMs(): number {
        return this.elapsedMs;
    }

    /**
     * 毎フレーム呼び出す。deltaMS 分だけ時間を進め、朝5時を通過した場合は
     * day_changed イベントを発行する。
     */
    tick(deltaMS: number, broker: IEventBroker): void {
        const prevDay = Math.floor((this.elapsedMs - DAWN_TIME_MS) / DAY_DURATION_MS);
        this.elapsedMs += deltaMS;
        const curDay = Math.floor((this.elapsedMs - DAWN_TIME_MS) / DAY_DURATION_MS);

        if (curDay > prevDay) {
            broker.publish("day_changed", {});
        }
    }

    /** 現在のゲーム内時刻を 0.0〜1.0 の正規化値で返す（0.0 = 朝5時、1.0 = 翌朝5時直前）。 */
    get normalizedDayTime(): number {
        return ((this.elapsedMs - DAWN_TIME_MS) % DAY_DURATION_MS) / DAY_DURATION_MS;
    }

    /** 現在のゲーム内時刻を "HH:MM" 形式の文字列で返す（例: "05:00", "23:30"）。 */
    get currentTimeString(): string {
        const totalHours = this.normalizedDayTime * 24 + 5; // 朝5時を起点に0.0〜1.0 → 5〜29時
        const hour = Math.floor(totalHours) % 24;
        const minute = Math.floor((totalHours % 1) * 60);
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }

    /** 経過した日数（ゲーム開始を0日目とする）。 */
    get dayCount(): number {
        return Math.floor((this.elapsedMs - DAWN_TIME_MS) / DAY_DURATION_MS);
    }
}
