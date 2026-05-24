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
    dialogue: [
        "先輩、新しい惑星にようこそ！わたしも一緒に来られて嬉しいです。",
        "まずはこの星を歩いてみましょうか？WASD キーで移動できますよ。",
        "マウスホイールで拡大縮小もできます。気になる場所があったら近づいてみてくださいね。",
        "E キーを押すと、持ち物（インベントリ）を確認できます。後で使うので、開き方を覚えておきましょう。",
    ],
    completionDialogue: [
        "お疲れさまでした、先輩。これで基本操作はばっちりですね！",
        "次は食糧の確保です。せっかくの惑星ですから、農業を始めてみましょう。",
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
    dialogue: [
        "さあ、いよいよ農業のお時間です！まずはじゃがいもを 1　つ収穫するのが目標ですよ。",
        "ツールバーから『くわ』を選んで、草地をクリックすると耕せます。",
        "耕した土の上で『じゃがいも』を使えば植え付けできますよ。育つまで少しかかりますから、気長に待ちましょう。",
    ],
    completionDialogue: [
        "やりましたね、先輩！立派なじゃがいもです！",
        "自分で育てた作物を収穫する瞬間って、なんだか感動しちゃいますね。",
        "次はこのじゃがいもを地球へ送って、最初の出荷をしてみましょう。",
    ],
};

/** M-03: 地球へ最初の出荷をしよう。Tier 2（大豆）アンロックを完了条件にする。 */
const M_03: MissionDef = {
    id: "M-03",
    order: 3,
    title: "じゃがいもを地球へ送ろう",
    subs: [
        { id: "M-03-1", order: 1, text: "転移ゲートを設置しよう", trigger: entityPlaced("warp_gate") },
        { id: "M-03-2", order: 2, text: "じゃがいもを64個出荷して大豆ラインを開放しよう", trigger: tierUnlocked("soybeans") },
    ],
    dialogue: [
        "収穫したじゃがいも、いよいよ地球へ送る番です！",
        "『転移ゲート』を設置すると、そこに入れたものを毎日朝 5 時に地球へ送れますよ。",
        "出荷の実績が積み上がると、新しい取引先がどんどん増えていきます。最初の一歩、頑張りましょう！",
    ],
    completionDialogue: [
        "やりましたね、先輩！初めての出荷、大成功です！",
        "ジャガイモが評価されて、大豆を買ってくれる取引先も新しく開きましたよ。",
        "次は土地を本格的に整えていきましょう。",
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
    dialogue: [
        "ここからは少しずつ拠点づくりを進めていきましょう。",
        "シャベルで土を削ったり、斧で木を切ったり、ピッケルで石を採取したり…素材集めの基本ですね。",
        "無理せず、必要なぶんだけ集めれば大丈夫ですよ。",
    ],
    completionDialogue: [
        "素材がたっぷり揃いましたね、先輩！",
        "次はいよいよクラフトの拠点、作業台を立てましょう。",
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
    dialogue: [
        "ここからは『作業台』が大活躍します。",
        "木材を 4 つ集めて作業台をクラフトして、それを地面に設置すれば完成です。",
        "設置した作業台は右クリックで開けますよ。レシピがたくさん並ぶので、ぜひ覗いてみてください。",
    ],
    completionDialogue: [
        "立派な作業台ですね！これで本格的なクラフトが始められます。",
        "次は土を肥やしましょう。育つ作物の量がぐっと変わってきますよ。",
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
    dialogue: [
        "美味しい作物を育てるには、土も育ててあげる必要があります。",
        "焚き火に茎を入れると草木灰ができます。これを畑に撒くと立派な肥料になりますよ。",
        "あと、堆肥場も用意しておきましょう。茎を入れておくと、ゆっくり堆肥に変わっていきます。",
    ],
    completionDialogue: [
        "お疲れさまでした、先輩。これで土がぐっと豊かになりますよ。",
        "次は連作障害に気をつけましょう。ちょっと特別な作物を育てます。",
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
    dialogue: [
        "同じ作物ばかり続けて育てると、土地が疲れてしまうんです。",
        "そこで活躍するのが『ひまわり』。土地のリフレッシュを助けてくれる作物なんですよ。",
        "植えて、水をあげて、収穫するだけです。意外と簡単ですよ。",
    ],
    completionDialogue: [
        "ひまわり、綺麗でしたね。種は次の栽培にも使えますよ。",
        "土壌の準備が整ったので、いよいよ次は大豆に挑戦です！",
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
    dialogue: [
        "大豆は中盤の主役です。育てるところから加工まで、しっかり覚えていきましょう。",
        "種を植えて、毎日忘れずに水やりをすれば、ちゃんと育ってくれますよ。",
        "じゃがいもより少し時間がかかりますが、そのぶん収穫の喜びも大きいです。",
    ],
    completionDialogue: [
        "大豆、見事に実りましたね！",
        "でもこれは茎付きの状態なので、このままでは出荷できないんです。次のステップで脱穀しましょう。",
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
    dialogue: [
        "収穫した茎付き大豆から、豆だけを取り出します。これが『脱穀』ですね。",
        "まず作業台で『硬木の歯』を作って、それを使って脱穀機を組み立てましょう。",
        "脱穀した大豆を地球へ送ると、油の取引先が新しく開きますよ。",
    ],
    completionDialogue: [
        "大豆を地球へ送れましたね！油の取引先が開きました。",
        "次は金属道具を作って、もっといろいろなことができるようにしましょう。",
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
    dialogue: [
        "ここからは少しタフな工程です。金属道具を一通り作ります。",
        "隕鉄をピッケルで採取して、粘土を川沿いで集めて、炭焼き窯と炉と金床を順番に組み立てます。",
        "炉で隕鉄を加熱して、金床で形を整えると刃ができますよ。手順は多いですが、ひとつずつ進めれば大丈夫です。",
    ],
    completionDialogue: [
        "お疲れさまでした、立派な刃ですね！",
        "金属道具が手に入ると、ぐっとできることが増えますよ。",
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
    dialogue: [
        "刃から『割り刃』を作って、それで木材を板に加工しましょう。",
        "板はいろいろな施設の材料になるので、ここで作れるようになっておくと便利ですよ。",
        "割り刃は作業台にツールとして装着して使うんです。覚えておいてくださいね。",
    ],
    completionDialogue: [
        "板が作れるようになりましたね！",
        "これで搾油機や織機など、もっと高度な施設も作れるようになります。",
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
    dialogue: [
        "毎日の水やりって、けっこう大変ですよね。そこで『畝間水路』の出番です。",
        "川沿いに水路を設置すると、隣接した畑へ自動で水が流れていきますよ。",
        "灌漑の第一歩、さっそく設置してみましょう。",
    ],
    completionDialogue: [
        "これで毎日の水やりがぐっと楽になりますね！",
        "自分が組んだ仕組みで作物が育つのって、なんだか嬉しいです。",
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
    dialogue: [
        "いよいよ『搾油機』を作って、大豆油を絞ります。",
        "のみを作って木ネジ棒を加工、そして搾油機を組み立てるという流れですね。",
        "絞った大豆油は需要が高いので、いい値で買い取ってもらえますよ。",
    ],
    completionDialogue: [
        "立派な大豆油ですね！",
        "これからは加工品でも稼げるようになりますよ。次は亜麻に挑戦してみましょう。",
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
    dialogue: [
        "亜麻はちょっと特殊な作物です。種から油、茎から繊維と、両方使えるんですよ。",
        "まずは亜麻を育てて、種から亜麻仁油を絞ってみましょう。",
        "亜麻仁油を出荷すると、いよいよ糸を扱える取引先が開きますよ。",
    ],
    completionDialogue: [
        "亜麻仁油の出荷、お疲れさまでした！",
        "いよいよ繊維加工の領域に入っていきます。楽しみですね。",
    ],
};

/** M-15: 糸を作って出荷しよう。Tier 5（布）アンロックを完了条件にする。 */
const M_15: MissionDef = {
    id: "M-15",
    order: 15,
    title: "亜麻糸を出荷しよう",
    subs: [
        { id: "M-15-1", order: 1, text: "浸漬槽を水辺に作って設置しよう", trigger: entityPlaced("soaking_basket") },
        { id: "M-15-2", order: 2, text: "亜麻の茎を浸漬してレッティングしよう", trigger: itemObtained("processed_flax") },
        { id: "M-15-3", order: 3, text: "叩き台を作って繊維分離しよう", trigger: itemObtained("flax_fiber") },
        { id: "M-15-4", order: 4, text: "紡ぎ車を作って糸を紡ごう", trigger: itemObtained("thread") },
        { id: "M-15-5", order: 5, text: "糸を出荷して布ラインを開放しよう", trigger: tierUnlocked("cloth") },
    ],
    dialogue: [
        "亜麻の茎を繊維に変える工程は、けっこう手間がかかります。",
        "浸漬槽で茎を浸して、叩いて繊維を取り出して、紡ぎ車で糸にする…一手間ずつですね。",
        "糸が出荷できるようになると、布の取引先も開きますよ。",
    ],
    completionDialogue: [
        "糸を出荷できましたね！繊維工業の入り口です。",
        "次は糸から布を織りましょう。",
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
    dialogue: [
        "糸を織機にかけて、布にしていきましょう。",
        "布が出荷できるようになると、いよいよ袋詰め製品の取引先が開きますよ。",
        "ゴールまでもう一歩です！",
    ],
    completionDialogue: [
        "布の出荷、ありがとうございます！",
        "これで全ての素材が揃いました。最後の大仕事、袋詰め大豆の出荷を目指しましょう！",
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
    dialogue: [
        "いよいよ最終ミッションです、先輩。",
        "亜麻から袋を作って、その中に大豆を詰めて、地球へ送りましょう。",
        "これまで育ててきた農業、加工、繊維、すべてが結集する瞬間ですね。わたし、ちょっとワクワクしちゃいます！",
    ],
    completionDialogue: [
        "やりましたーー！袋詰め大豆、無事に地球へ届きました！",
        "これでこの惑星は、本格的な投資に値する場所だって証明できました。",
        "先輩、本当にお疲れさまでした。一緒にここまで来られて、わたし、すごく嬉しいです。",
        "これからもこの星で、ゆっくりとした暮らしを続けていきましょうね。",
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
