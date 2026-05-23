import type { GameEventMap } from "../_boundary/events";
import { getFertilizerTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "./VoxelDefs";

/**
 * ミッションシステムの静的定義。
 *
 * doc/25_MISSION_SYSTEM.md §4（並列フラグモデル）と §5（ミッションリスト）に対応する。
 *
 * - 各サブミッションは GameEventMap のイベント発火で達成判定される
 * - predicate を指定すれば、同じイベントでも条件で絞り込める
 * - dialogue は後輩キャラの会話（配列の各要素を 1 ターン分として、クリックで読み進める想定）
 */

/**
 * ミッション達成のトリガ条件。
 * - eventType: 購読する EventBroker のイベント名
 * - predicate: オプショナル。packet が条件を満たすかを判定する（未指定なら無条件で達成）
 */
type MissionTriggerFor<K extends keyof GameEventMap> = {
    readonly eventType: K;
    readonly predicate?: (packet: GameEventMap[K]) => boolean;
};

/** Discriminated union。GameEventMap の全イベント名のいずれか。 */
export type MissionTrigger = { [K in keyof GameEventMap]: MissionTriggerFor<K> }[keyof GameEventMap];

/** サブミッション定義。 */
export interface SubMissionDef {
    readonly id: string;
    readonly order: number;
    readonly text: string;
    readonly trigger: MissionTrigger;
    /** 後輩キャラの会話。クリックで読み進める想定。Phase 2 時点では空配列でもよい。 */
    readonly dialogue?: ReadonlyArray<string>;
}

/** メインミッション定義。 */
export interface MissionDef {
    readonly id: string;
    readonly order: number;
    readonly title: string;
    readonly subs: ReadonlyArray<SubMissionDef>;
    /** ミッション開始時の会話。 */
    readonly dialogue?: ReadonlyArray<string>;
    /** ミッション完了時の会話。 */
    readonly completionDialogue?: ReadonlyArray<string>;
}

// ─── ヘルパー: 共通トリガ生成器 ─────────────────────────────────────────

/** inventory_changed で指定アイテムが count 以上になった時を判定。 */
function itemObtained(itemId: string, minCount = 1): MissionTrigger {
    return {
        eventType: "inventory_changed",
        predicate: (p) => p.stack !== null && p.stack.itemId === itemId && p.stack.count >= minCount,
    };
}

/** crop_planted で指定 cropType（= 種アイテムの itemId）が植えられた時。 */
function cropPlanted(cropType: string): MissionTrigger {
    return {
        eventType: "crop_planted",
        predicate: (p) => p.cropType === cropType,
    };
}

/** crop_harvested で指定 itemId が収穫された時。 */
function cropHarvested(itemId: string): MissionTrigger {
    return {
        eventType: "crop_harvested",
        predicate: (p) => p.itemId === itemId,
    };
}

/** entity_placed で指定 itemId（= entityType）が配置された時。 */
function entityPlaced(entityType: string): MissionTrigger {
    return {
        eventType: "entity_placed",
        predicate: (p) => p.entityType === entityType,
    };
}

/** item_shipped で指定 itemId が 1 個以上出荷された時。 */
function itemShipped(itemId: string): MissionTrigger {
    return {
        eventType: "item_shipped",
        predicate: (p) => (p.items.get(itemId) ?? 0) > 0,
    };
}

/** 指定 itemId の Tier が初めてアンロックされた時。
 *  プレイヤーが Tier の存在に気づかず安いポイントで出荷してしまう罠を避けるため、
 *  出荷ミッションは原則これを使う（doc/22 の Tier 構造に対応）。 */
function tierUnlocked(itemId: string): MissionTrigger {
    return {
        eventType: "tier_unlocked",
        predicate: (p) => p.itemId === itemId,
    };
}

/** terrain_changed で変化後の voxel が soil 地形（耕作完了）になった時。 */
function tilledSoil(): MissionTrigger {
    return {
        eventType: "terrain_changed",
        predicate: (p) => getTerrainTypeFromVoxel(p.voxel) === TERRAIN_TYPES.soil,
    };
}

/** terrain_changed で変化後の voxel に肥料が付与された時。 */
function fertilizerApplied(): MissionTrigger {
    return {
        eventType: "terrain_changed",
        predicate: (p) => getFertilizerTypeFromVoxel(p.voxel) > 0,
    };
}

// ─── ミッション定義 ─────────────────────────────────────────────────────

/** M-01: ようこそ、Stella Garden へ */
const M_01: MissionDef = {
    id: "M-01",
    order: 1,
    title: "この惑星を歩いてみよう",
    subs: [
        { id: "M-01-1", order: 1, text: "WASD で歩いてみよう", trigger: { eventType: "player_move" } },
        { id: "M-01-2", order: 2, text: "マウスホイールでズームしてみよう", trigger: { eventType: "zoom_change" } },
        { id: "M-01-3", order: 3, text: "E キーでインベントリを開いてみよう", trigger: { eventType: "toggle_inventory" } },
    ],
};

/** M-02: 食糧を確保しよう */
const M_02: MissionDef = {
    id: "M-02",
    order: 2,
    title: "じゃがいもを 1 つ収穫しよう",
    subs: [
        { id: "M-02-1", order: 1, text: "くわで草地を耕そう", trigger: tilledSoil() },
        { id: "M-02-2", order: 2, text: "じゃがいもを植えよう", trigger: cropPlanted("potato") },
        { id: "M-02-3", order: 3, text: "成熟したじゃがいもを鎌で収穫しよう", trigger: cropHarvested("potato") },
    ],
};

/** M-03: 地球へ最初の出荷をしよう。Tier 2（大豆）アンロックを完了条件にする。 */
const M_03: MissionDef = {
    id: "M-03",
    order: 3,
    title: "じゃがいもを地球へ送ろう",
    subs: [
        { id: "M-03-1", order: 1, text: "転移ゲートを設置しよう", trigger: entityPlaced("warp_gate") },
        { id: "M-03-2", order: 2, text: "じゃがいもを出荷して大豆ラインを開放しよう", trigger: tierUnlocked("soybeans") },
    ],
};

/** M-04: 土地を整えよう */
const M_04: MissionDef = {
    id: "M-04",
    order: 4,
    title: "素材を集めて土地を整えよう",
    subs: [
        { id: "M-04-1", order: 1, text: "シャベルで土を削ってみよう", trigger: itemObtained("dirt") },
        { id: "M-04-2", order: 2, text: "斧で木を切ろう", trigger: { eventType: "tree_felled" } },
        { id: "M-04-3", order: 3, text: "ピッケルで石を採取しよう", trigger: itemObtained("stone") },
    ],
};

/** M-05: 作業台を立てよう */
const M_05: MissionDef = {
    id: "M-05",
    order: 5,
    title: "クラフトの拠点を作ろう",
    subs: [
        { id: "M-05-1", order: 1, text: "木材を 4 つ集めよう", trigger: itemObtained("trunk", 4) },
        { id: "M-05-2", order: 2, text: "作業台をクラフトしよう", trigger: itemObtained("workbench") },
        { id: "M-05-3", order: 3, text: "作業台を設置しよう", trigger: entityPlaced("workbench") },
    ],
};

/** M-06: 肥料を作ろう */
const M_06: MissionDef = {
    id: "M-06",
    order: 6,
    title: "畑を肥やそう",
    subs: [
        { id: "M-06-1", order: 1, text: "焚き火を作って設置しよう", trigger: entityPlaced("bonfire") },
        { id: "M-06-2", order: 2, text: "焚き火で草木灰を作ろう", trigger: itemObtained("plant_ashes") },
        { id: "M-06-3", order: 3, text: "畑に草木灰を撒こう", trigger: fertilizerApplied() },
        { id: "M-06-4", order: 4, text: "堆肥場を作って設置しよう", trigger: entityPlaced("compost_bin") },
    ],
};

/** M-07: 連作障害に対処しよう（輪作・ひまわり） */
const M_07: MissionDef = {
    id: "M-07",
    order: 7,
    title: "ひまわりで土地をリセットしよう",
    subs: [
        { id: "M-07-1", order: 1, text: "ひまわりを植えよう", trigger: cropPlanted("sunflower_seed") },
        { id: "M-07-2", order: 2, text: "じょうろで水やりしよう", trigger: { eventType: "crop_watered" } },
        { id: "M-07-3", order: 3, text: "ひまわりを収穫しよう", trigger: cropHarvested("sunflower_seed") },
    ],
};

/** M-08: 大豆を育てよう */
const M_08: MissionDef = {
    id: "M-08",
    order: 8,
    title: "大豆を収穫しよう",
    subs: [
        { id: "M-08-1", order: 1, text: "大豆の種を植えよう", trigger: cropPlanted("soybeans") },
        { id: "M-08-2", order: 2, text: "毎日じょうろで水やりしよう", trigger: { eventType: "crop_watered" } },
        { id: "M-08-3", order: 3, text: "大豆を収穫しよう", trigger: cropHarvested("soybeans") },
    ],
};

/** M-09: 大豆を脱穀して出荷しよう。Tier 3b（大豆油）アンロックを完了条件にする
 *  （同時に Tier 3a 亜麻仁油もアンロックされるが、ミッションの流れ上、後続が大豆ラインなので大豆油側を見る）。 */
const M_09: MissionDef = {
    id: "M-09",
    order: 9,
    title: "大豆を地球へ送ろう",
    subs: [
        { id: "M-09-1", order: 1, text: "硬木の歯を作業台でクラフトしよう", trigger: itemObtained("hardwood_teeth") },
        { id: "M-09-2", order: 2, text: "脱穀機を作って設置しよう", trigger: entityPlaced("threshing_machine") },
        { id: "M-09-3", order: 3, text: "脱穀機で大豆を脱穀しよう", trigger: itemObtained("soybeans") },
        { id: "M-09-4", order: 4, text: "大豆を出荷して油ラインを開放しよう", trigger: tierUnlocked("soybean_oil") },
    ],
};

/** M-10: 鉄製道具を作ろう */
const M_10: MissionDef = {
    id: "M-10",
    order: 10,
    title: "刃を打って金属道具を手に入れよう",
    subs: [
        { id: "M-10-1", order: 1, text: "隕鉄をピッケルで採取しよう", trigger: itemObtained("meteoric_iron") },
        { id: "M-10-2", order: 2, text: "川沿いで粘土を採取しよう", trigger: itemObtained("clay") },
        { id: "M-10-3", order: 3, text: "炭焼き窯を作って設置しよう", trigger: entityPlaced("kiln") },
        { id: "M-10-4", order: 4, text: "炭焼き窯で木炭を作ろう", trigger: itemObtained("charcoal") },
        { id: "M-10-5", order: 5, text: "炉を作って設置しよう", trigger: entityPlaced("forge") },
        { id: "M-10-6", order: 6, text: "石の金床を作って設置しよう", trigger: entityPlaced("anvil") },
        { id: "M-10-7", order: 7, text: "炉で隕鉄を加熱しよう", trigger: itemObtained("hot_meteoric_iron") },
        { id: "M-10-8", order: 8, text: "金床で刃を打とう", trigger: itemObtained("blade") },
    ],
};

/** M-11: 板を作ろう */
const M_11: MissionDef = {
    id: "M-11",
    order: 11,
    title: "割り刃を使って板を作ろう",
    subs: [
        { id: "M-11-1", order: 1, text: "刃から割り刃を作ろう", trigger: itemObtained("froe") },
        { id: "M-11-2", order: 2, text: "木材から板を作ろう", trigger: itemObtained("board") },
    ],
};

/** M-12: 灌漑を整えよう */
const M_12: MissionDef = {
    id: "M-12",
    order: 12,
    title: "畝間水路で水やりを自動化しよう",
    subs: [
        { id: "M-12-1", order: 1, text: "畝間水路をクラフトしよう", trigger: itemObtained("furrow_canal") },
        { id: "M-12-2", order: 2, text: "川沿いに畝間水路を配置しよう", trigger: entityPlaced("furrow_canal") },
    ],
};

/** M-13: 油を搾ろう */
const M_13: MissionDef = {
    id: "M-13",
    order: 13,
    title: "搾油機で大豆油を作ろう",
    subs: [
        { id: "M-13-1", order: 1, text: "のみを作ろう", trigger: itemObtained("chisel") },
        { id: "M-13-2", order: 2, text: "のみで木ネジ棒を作ろう", trigger: itemObtained("screw_rod") },
        { id: "M-13-3", order: 3, text: "搾油機を作って設置しよう", trigger: entityPlaced("screw_presses") },
        { id: "M-13-4", order: 4, text: "搾油機で大豆油を作ろう", trigger: itemObtained("soybean_oil") },
        { id: "M-13-5", order: 5, text: "大豆油を出荷しよう", trigger: itemShipped("soybean_oil") },
    ],
};

/** M-14: 亜麻を育てよう。Tier 4（糸）アンロックを完了条件にする。 */
const M_14: MissionDef = {
    id: "M-14",
    order: 14,
    title: "亜麻仁油を地球へ送ろう",
    subs: [
        { id: "M-14-1", order: 1, text: "亜麻の種を植えよう", trigger: cropPlanted("flaxseed") },
        { id: "M-14-2", order: 2, text: "亜麻を収穫しよう", trigger: cropHarvested("flaxseed") },
        { id: "M-14-3", order: 3, text: "亜麻の種から亜麻仁油を搾ろう", trigger: itemObtained("flaxseed_oil") },
        { id: "M-14-4", order: 4, text: "亜麻仁油を出荷して糸ラインを開放しよう", trigger: tierUnlocked("thread") },
    ],
};

/** M-15: 糸を作って出荷しよう。Tier 5（布）アンロックを完了条件にする。 */
const M_15: MissionDef = {
    id: "M-15",
    order: 15,
    title: "亜麻糸を出荷しよう",
    subs: [
        { id: "M-15-1", order: 1, text: "浸漬槽を作って設置しよう", trigger: entityPlaced("soaking_basket") },
        { id: "M-15-2", order: 2, text: "亜麻の茎を浸漬してレッティングしよう", trigger: itemObtained("processed_flax") },
        { id: "M-15-3", order: 3, text: "叩き台を作って繊維分離しよう", trigger: itemObtained("flax_fiber") },
        { id: "M-15-4", order: 4, text: "紡ぎ車を作って糸を紡ごう", trigger: itemObtained("thread") },
        { id: "M-15-5", order: 5, text: "糸を出荷して布ラインを開放しよう", trigger: tierUnlocked("cloth") },
    ],
};

/** M-16: 布を織って出荷しよう。Tier 6b（袋詰め大豆）アンロックを完了条件にする
 *  （同時に Tier 6a 袋詰めじゃがいももアンロックされるが、ゴールが袋詰め大豆なので大豆側を見る）。 */
const M_16: MissionDef = {
    id: "M-16",
    order: 16,
    title: "布を出荷しよう",
    subs: [
        { id: "M-16-1", order: 1, text: "織機を作って設置しよう", trigger: entityPlaced("loom") },
        { id: "M-16-2", order: 2, text: "糸から布を織ろう", trigger: itemObtained("cloth") },
        { id: "M-16-3", order: 3, text: "布を出荷して袋詰めラインを開放しよう", trigger: tierUnlocked("bagged_soybeans") },
    ],
};

/** M-17: 袋詰め大豆を出荷しよう ★ゴール */
const M_17: MissionDef = {
    id: "M-17",
    order: 17,
    title: "全生産チェーンを結集して袋詰め大豆を送ろう",
    subs: [
        { id: "M-17-1", order: 1, text: "亜麻の袋をクラフトしよう", trigger: itemObtained("bag") },
        { id: "M-17-2", order: 2, text: "大豆を袋詰めしよう", trigger: itemObtained("bagged_soybeans") },
        { id: "M-17-3", order: 3, text: "袋詰め大豆を出荷しよう", trigger: itemShipped("bagged_soybeans") },
    ],
};

/** 全ミッション定義（order 昇順）。 */
export const ALL_MISSIONS: ReadonlyArray<MissionDef> = [
    M_01,
    M_02,
    M_03,
    M_04,
    M_05,
    M_06,
    M_07,
    M_08,
    M_09,
    M_10,
    M_11,
    M_12,
    M_13,
    M_14,
    M_15,
    M_16,
    M_17,
];
