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
    completionDialogue: ["お疲れさまでした、先輩。これで基本操作はばっちりですね！", "次は食糧の確保です。せっかくの惑星ですから、農業を始めてみましょう。"],
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
        "さあ、いよいよ農業のお時間です！まずはじゃがいもを収穫するのが目標ですよ。",
        "ツールバーから『くわ』を選んで、草地をクリックすると耕せます。",
        "このように、アイテムを使う場合は、アイテムをツールバーに移動させ、それを選択し土地をクリックします。",
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
        "インベントリを開き、転移ゲートを右クリックすることで、フィールドの任意の場所にクリックで置くことができます。",
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
    completionDialogue: ["素材がたっぷり揃いましたね、先輩！", "次はいよいよクラフトの拠点、作業台を立てましょう。"],
};

/** M-05: 作業台を立てよう */
const M_05: MissionDef = {
    id: "M-05",
    order: 5,
    title: "クラフトの拠点を作ろう",
    subs: [
        { id: "M-05-1", order: 1, text: "木材を 4 つ集めよう", trigger: itemObtained("trunk", 4) },
        { id: "M-05-2", order: 2, text: "インベントリから作業台をクラフトしよう", trigger: itemObtained("workbench") },
        { id: "M-05-3", order: 3, text: "インベントリから作業台を設置しよう", trigger: entityPlaced("workbench") },
    ],
    dialogue: [
        "ここからは『作業台』が大活躍します。",
        "木材を 4 つ集めて作業台をクラフトして、それを地面に設置すれば完成です。",
        "インベントリを開いて、作成ボタンを長押しすることで、選んだアイテムのクラフトができます",
        "設置した作業台は右クリックで開けますよ。レシピがたくさん並ぶので、ぜひ覗いてみてください。",
    ],
    completionDialogue: ["立派な作業台ですね！これで本格的なクラフトが始められます。", "次は土を肥やしましょう。育つ作物の量がぐっと変わってきますよ。"],
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
        "焚き火に茎や木の幹を入れると草木灰ができます。これを畑に撒くと立派な肥料になりますよ。",
        "あと、堆肥場も用意しておきましょう。落ち葉を入れておくと、ゆっくり堆肥に変わっていきます。",
    ],
    completionDialogue: ["お疲れさまでした、先輩。これで土がぐっと豊かになりますよ。", "次は連作障害に気をつけましょう。ちょっと特別な作物を育てます。"],
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
        "違う作物を育てれば土地は疲れないのですが、その代わり育てる日数が長くかかってしまいます",
        "そこで活躍するのが『ひまわり』。土地のリフレッシュを助けてくれる作物なんですよ。",
        "植えて、水をあげて、収穫するだけです。農作物中では最短の3日で育ちます。意外と簡単ですよ。",
    ],
    completionDialogue: ["ひまわり、綺麗でしたね。種は次の栽培にも使えますよ。", "土壌の準備が整ったので、いよいよ次は大豆に挑戦です！"],
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
    completionDialogue: ["大豆、見事に実りましたね！", "でもこれは茎付きの状態なので、このままでは出荷できないんです。次のステップで脱穀しましょう。"],
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
    completionDialogue: ["大豆を地球へ送れましたね！油の取引先が開きました。", "次は金属道具を作って、もっといろいろなことができるようにしましょう。"],
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
    completionDialogue: ["お疲れさまでした、立派な刃ですね！", "金属道具が手に入ると、ぐっとできることが増えますよ。"],
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
    completionDialogue: ["板が作れるようになりましたね！", "これで搾油機や織機など、もっと高度な施設も作れるようになります。"],
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
        "川沿いに水路を設置すると、毎朝、隣接した3タイル先までの畑へ自動で水が流れていきますよ。",
        "灌漑の第一歩、さっそく設置してみましょう。",
    ],
    completionDialogue: ["これで毎日の水やりがぐっと楽になりますね！", "自分が組んだ仕組みで作物が育つのって、なんだか嬉しいです。"],
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
        "搾油機は右クリックすることでメニューを開けます。",
        "大豆をスロットに入れ、ボタンを長押しすることで大豆油と油粕に加工できます。",
        "絞った大豆油は需要が高いので、いい値で買い取ってもらえますよ。",
    ],
    completionDialogue: ["立派な大豆油ですね！", "これからは加工品でも稼げるようになりますよ。次は亜麻に挑戦してみましょう。"],
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
    completionDialogue: ["亜麻仁油の出荷、お疲れさまでした！", "いよいよ繊維加工の領域に入っていきます。楽しみですね。"],
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
        "浸漬槽は水辺にしか置けないので注意してください。",
        "糸が出荷できるようになると、布の取引先も開きますよ。",
    ],
    completionDialogue: ["糸を出荷できましたね！繊維工業の入り口です。", "次は糸から布を織りましょう。"],
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
    dialogue: ["糸を織機にかけて、布にしていきましょう。", "布が出荷できるようになると、いよいよ袋詰め製品の取引先が開きますよ。", "ゴールまでもう一歩です！"],
    completionDialogue: ["布の出荷、ありがとうございます！", "これで全ての素材が揃いました。最後の大仕事、袋詰め大豆の出荷を目指しましょう！"],
};

/** M-17: 袋詰め大豆を出荷しよう ★第一の集大成（包装の達成）。
 *  最終ゴール演出は発酵軸の醤油（M-26）へ移設したため、ここは節目の会話にとどめ次のステップへ繋ぐ。 */
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
        "ここまでの集大成です、先輩。",
        "亜麻から袋を作って、その中に大豆を詰めて、地球へ送りましょう。",
        "これまで育ててきた農業、加工、繊維、すべてが結集する瞬間ですね。わたし、ちょっとワクワクしちゃいます！",
    ],
    completionDialogue: [
        "やりましたーー！袋詰め大豆、無事に地球へ届きました！",
        "包装まで含めた完全なサプライチェーンが回るって、すごいことですよ。第一の大きな目標達成です！",
        "ここから先は、この仕組みを『広げる』番です。水車の力で加工や運搬を自動化していきましょう。",
    ],
};

// ─── 自動化編（M-18〜M-21・doc/25 §5.3） ──────────────────────────────────
// 袋詰め大豆ラインを規模拡大する終盤コンテンツ。板・金属・ロープが前提。

/** cart_worked で指定 action の作業が台車によって行われた時（手動操作とは区別される）。 */
function cartWorked(action: "harvest" | "plant" | "fertilize"): MissionTrigger {
    return { eventType: "cart_worked", predicate: (p) => p.action === action };
}

/** M-18: 水の力で動力を作ろう（水車・シャフト） */
const M_18: MissionDef = {
    id: "M-18",
    order: 18,
    title: "水車を回して動力をつなごう",
    subs: [
        { id: "M-18-1", order: 1, text: "板から木製歯車・ベベルギア・シャフトを作ろう", trigger: itemObtained("shaft") },
        { id: "M-18-2", order: 2, text: "水車をクラフトして水面に設置しよう", trigger: entityPlaced("waterwheel") },
        { id: "M-18-3", order: 3, text: "シャフトを敷いて動力を伝えよう", trigger: entityPlaced("shaft") },
    ],
    dialogue: [
        "ここからは自動化のお話です、先輩。手作業の畑が広がってくると、毎日の加工が大変になってきますよね。",
        "そこで『水車』の出番です。水の上に置くだけで、ずっと回り続けて動力を生んでくれるんですよ。",
        "板から木製歯車やシャフトを作って、水車から機械まで動力を運ぶ道をつなぎましょう。",
    ],
    completionDialogue: ["水車が回り始めましたね！この動力で、いろんな機械を動かせるようになりますよ。", "まずは脱穀を自動化してみましょう。"],
};

/** M-19: 加工を自動化しよう（水動力加工機械） */
const M_19: MissionDef = {
    id: "M-19",
    order: 19,
    title: "ボタンを押さずに脱穀しよう",
    subs: [
        { id: "M-19-1", order: 1, text: "金床で扱き歯を鍛造しよう", trigger: itemObtained("iron_teeth") },
        { id: "M-19-2", order: 2, text: "ドラムを作って自動脱穀機をクラフトしよう", trigger: itemObtained("auto_thresher") },
        { id: "M-19-3", order: 3, text: "自動脱穀機を設置してシャフトにつなごう", trigger: entityPlaced("auto_thresher") },
        {
            id: "M-19-4",
            order: 4,
            text: "朝 5 時の自動加工で大豆を脱穀しよう",
            trigger: { eventType: "auto_processed", predicate: (p) => p.itemId === "auto_thresher" },
        },
    ],
    dialogue: [
        "自動脱穀機は、手動の脱穀機とちがって、ボタンを押し続けなくてもいいんです。",
        "シャフトで動力をつないでおけば、毎朝 5 時に入れておいた材料をまとめて加工してくれますよ。",
        "扱き歯を金床で鍛えて、ドラムを組んで…少し手間ですが、一度作れば後がぐっと楽になります。",
    ],
    completionDialogue: ["勝手に脱穀が進んでいきますね！朝起きたら出来上がっている、っていう感じです。", "次はアイテムの運搬も自動化してみましょう。"],
};

/** M-20: アイテムの運搬を自動化しよう（レール・ウインチ・台車・ステーション） */
const M_20: MissionDef = {
    id: "M-20",
    order: 20,
    title: "台車でアイテムを自動で運ぼう",
    subs: [
        { id: "M-20-1", order: 1, text: "糸からロープを作りレールをクラフトしよう", trigger: itemObtained("rail") },
        { id: "M-20-2", order: 2, text: "レールを敷設しよう", trigger: entityPlaced("rail") },
        { id: "M-20-3", order: 3, text: "ウインチを終点に設置して動力をつなごう", trigger: entityPlaced("winch") },
        { id: "M-20-4", order: 4, text: "台車をレールに置こう", trigger: entityPlaced("cart") },
        { id: "M-20-5", order: 5, text: "ステーションを設置して積み下ろししよう", trigger: { eventType: "station_fired" } },
    ],
    dialogue: [
        "加工はできるようになりましたが、材料を運ぶのもなかなか手間ですよね。",
        "レールを敷いて、ウインチで台車を引っぱれば、アイテムを自動で運べるようになります。ケーブルカーみたいなものですね。",
        "線路脇に『ステーション』を置くと、台車が通るたびに積み下ろししてくれますよ。",
    ],
    completionDialogue: ["台車がコトコト走って、荷物を運んでくれていますね。眺めているだけで楽しいです。", "最後は、畑仕事そのものも台車に任せてみましょう。"],
};

/** M-21: 農作業を自動化しよう（台車アタッチメント） */
const M_21: MissionDef = {
    id: "M-21",
    order: 21,
    title: "台車に畑仕事を任せよう",
    subs: [
        {
            id: "M-21-1",
            order: 1,
            text: "台車のアタッチメント欄に鎌を装着しよう",
            trigger: { eventType: "cart_attachment_set", predicate: (p) => p.itemId === "sickle" },
        },
        { id: "M-21-2", order: 2, text: "台車を畑に通して自動収穫しよう", trigger: cartWorked("harvest") },
        { id: "M-21-3", order: 3, text: "アタッチメントを外し、台車に肥料を積んで自動で施肥しよう", trigger: cartWorked("fertilize") },
        { id: "M-21-4", order: 4, text: "台車に種を積んで自動で植え付けしよう", trigger: cartWorked("plant") },
    ],
    dialogue: [
        "台車は荷物を運ぶだけじゃないんです。畑の上を通らせると、農作業もしてくれるんですよ。",
        "アタッチメント欄に『鎌』を入れると、通った左右の畑を自動で収穫してくれます。",
        "逆にアタッチメントを空にして、台車に肥料や種を積んでおくと、通りながら施肥や植え付けをしてくれますよ。",
        "畑の間を縫うようにレールを敷けば、農作業がほとんど自動になります。",
    ],
    completionDialogue: [
        "すごい…台車が通るだけで、収穫も植え付けもできちゃうんですね！",
        "これで生産規模をどんどん広げられます。お疲れさまでした、先輩。",
        "さあ、次はいよいよ新しい挑戦——『発酵』の世界です。塩づくりから始めましょう。",
    ],
};

// ─── 発酵編（M-22〜M-28・doc/25 §5.4 / doc/26） ────────────────────────────
// 第3の生産軸。塩 → 麹 → 味噌 → 醤油（最終ゴール）と、嗜好品の麦焼酎・酢。

/** M-22: 海辺で塩を作ろう（塩田）。塩を出荷して味噌・酒酢ラインを開放する。 */
const M_22: MissionDef = {
    id: "M-22",
    order: 22,
    title: "塩田で塩を採ろう",
    subs: [
        { id: "M-22-1", order: 1, text: "塩田をクラフトして水際に設置しよう", trigger: entityPlaced("saltpan") },
        { id: "M-22-2", order: 2, text: "貯まった塩を回収しよう", trigger: itemObtained("salt") },
        { id: "M-22-3", order: 3, text: "塩を出荷して発酵品ラインを開放しよう", trigger: tierUnlocked("miso") },
    ],
    dialogue: [
        "ここからは『発酵』、第3の生産軸です。その入口が『塩』なんですよ。",
        "塩田を水際に置いておくと、お日さまの力でゆっくり塩が貯まっていきます。燃料も動力もいりません。",
        "塩を地球へ送ると、味噌やお酒の取引先が開きます。発酵は待つ工程が多いので、早回しもうまく使ってくださいね。",
    ],
    completionDialogue: ["塩が出荷できましたね！これで発酵の世界の扉が開きました。", "次は麹のもとになる『麦』を育てましょう。"],
};

/** M-23: 麦を育てよう */
const M_23: MissionDef = {
    id: "M-23",
    order: 23,
    title: "麹の材料となる麦を収穫しよう",
    subs: [
        { id: "M-23-1", order: 1, text: "麦の種を植えよう", trigger: cropPlanted("wheat") },
        { id: "M-23-2", order: 2, text: "毎日じょうろで水やりしよう", trigger: { eventType: "crop_watered" } },
        { id: "M-23-3", order: 3, text: "麦を収穫しよう", trigger: cropHarvested("wheat") },
    ],
    dialogue: [
        "麦は大豆や亜麻と同じように育てられますよ。種をまいて、毎日水やりするだけです。",
        "収穫すると麦粒と麦わらが採れます。麦わらは焚き火で草木灰にもできるので、無駄になりません。",
        "麦粒は次の麹づくりに使います。一部は種として残しておきましょうね。",
    ],
    completionDialogue: ["麦が実りましたね！いよいよ麹づくりに入ります。", "麦を蒸してから、麹室で仕込みますよ。"],
};

/** M-24: 麹を仕込もう（焚き火で蒸す・麹室）。麹は中間素材なので出荷サブは持たない。 */
const M_24: MissionDef = {
    id: "M-24",
    order: 24,
    title: "麹を仕込もう",
    subs: [
        { id: "M-24-1", order: 1, text: "焚き火の素材スロットで麦を蒸して蒸麦を作ろう", trigger: itemObtained("steamed_wheat") },
        { id: "M-24-2", order: 2, text: "麹室をクラフトして設置しよう", trigger: entityPlaced("koji_muro") },
        { id: "M-24-3", order: 3, text: "蒸麦と麹（種）を仕込んで麹を作ろう", trigger: itemObtained("koji") },
    ],
    dialogue: [
        "麹は、味噌もお醤油もお酒も、ぜんぶの土台になる大事な中間素材です。出荷はせず、自分の仕込みに使いますよ。",
        "まずは焚き火に麦を入れて『蒸麦』を作ります。焚き火に素材スロットが増えているので、そこに麦を入れてくださいね。",
        "蒸麦を麹室に仕込むと麹ができます。",
    ],
    completionDialogue: ["麹ができましたね！これで発酵食品が一気に作れるようになります。", "まずは三つの素材が合わさる『味噌』から挑戦しましょう。"],
};

/** M-25: 味噌を仕込んで出荷しよう ★三軸合流。味噌を出荷して醤油ラインを開放する。 */
const M_25: MissionDef = {
    id: "M-25",
    order: 25,
    title: "大豆・塩・麹を合わせて味噌を醸そう",
    subs: [
        { id: "M-25-1", order: 1, text: "焚き火で大豆を蒸して蒸し大豆を作ろう", trigger: itemObtained("steamed_soybeans") },
        { id: "M-25-2", order: 2, text: "発酵桶をクラフトして設置しよう", trigger: entityPlaced("fermentation_vat") },
        { id: "M-25-3", order: 3, text: "蒸し大豆・塩・麹を仕込んで味噌を熟成させよう", trigger: itemObtained("miso") },
        { id: "M-25-4", order: 4, text: "味噌を出荷して醤油ラインを開放しよう", trigger: tierUnlocked("soy_sauce") },
    ],
    dialogue: [
        "いよいよ味噌づくりです！蒸し大豆・塩・麹、三つの軸が合わさる集大成ですよ。",
        "発酵桶に材料を仕込んだら、あとは熟成を待つだけ。樽が静かに発酵していく様子、なんだか落ち着きます。",
        "味噌を出荷すると、いちばんの高級品『醤油』の取引先が開きますよ。",
    ],
    completionDialogue: ["味噌、いい色に仕上がりましたね！布よりもいいお値段で買ってもらえます。", "次はこの惑星の最高級品、醤油を目指しましょう。"],
};

/** M-26: 醤油を搾って出荷しよう ★四軸合流・現スコープの最終ゴール。 */
const M_26: MissionDef = {
    id: "M-26",
    order: 26,
    title: "最高級品・醤油を完成させよう",
    subs: [
        { id: "M-26-1", order: 1, text: "焚き火で麦を炒って炒り麦を作ろう", trigger: itemObtained("roasted_wheat") },
        { id: "M-26-2", order: 2, text: "蒸し大豆・炒り麦・塩・麹を仕込んで醤油もろみを熟成させよう", trigger: itemObtained("soy_sauce_moromi") },
        { id: "M-26-3", order: 3, text: "搾油機で醤油もろみを搾ろう", trigger: itemObtained("soy_sauce") },
        { id: "M-26-4", order: 4, text: "醤油を出荷しよう", trigger: itemShipped("soy_sauce") },
    ],
    dialogue: [
        "ついに最終目標、醤油づくりです、先輩。",
        "大豆・麦・塩・麹——四つの軸ぜんぶが合わさる、いちばん長くて贅沢な工程です。",
        "発酵桶で醤油もろみを熟成させたら、搾油機で搾ります。油を搾るのと同じ要領ですよ。",
    ],
    completionDialogue: [
        "やりましたーー！醤油、無事に地球へ届きました！",
        "塩から始まった発酵の道のり、ぜんぶ繋がりましたね。これがこの惑星で作れる、いまの最高級品です。",
        "農業も、加工も、繊維も、発酵も——先輩と一緒にここまで来られて、わたし本当に嬉しいです。",
        "このあとは、麦焼酎やお酢なんかの嗜好品づくりも待っています。ゆっくり楽しんでいきましょうね。",
    ],
};

/** M-27: 麦焼酎を蒸留して出荷しよう（麦もろみ→蒸留器→樽熟成）。 */
const M_27: MissionDef = {
    id: "M-27",
    order: 27,
    title: "麦もろみを蒸留して麦焼酎を造ろう",
    subs: [
        { id: "M-27-1", order: 1, text: "麹と蒸麦を発酵桶に仕込んで麦もろみを作ろう", trigger: itemObtained("wheat_moromi") },
        { id: "M-27-2", order: 2, text: "蒸留器をクラフトして設置しよう", trigger: entityPlaced("distiller") },
        { id: "M-27-3", order: 3, text: "麦もろみを蒸留して麦焼酎を作ろう", trigger: itemObtained("shochu") },
        { id: "M-27-4", order: 4, text: "麦焼酎を発酵桶で樽熟成させよう", trigger: itemObtained("aged_shochu") },
        { id: "M-27-5", order: 5, text: "麦焼酎を出荷しよう", trigger: itemShipped("shochu") },
    ],
    dialogue: [
        "ここからは嗜好品づくり。まずは麦のお酒、麦焼酎です。",
        "発酵桶で『麦もろみ』を仕込んで、蒸留器にかけると麦焼酎ができます。蒸留器は燃料を使いますよ。",
        "できた焼酎を発酵桶に戻して『樽熟成』させると、寝かせた日数だけ品質が上がって、お値段もぐっと上がります。",
    ],
    completionDialogue: [
        "麦焼酎、いい香りですね…！寝かせるほど価値が上がるので、じっくり育てる楽しみがあります。",
        "残るはお酢です。最後にもうひとつ醸してみましょう。",
    ],
};

/** M-28: 酢を醸そう（麦もろみから酢酸発酵） */
const M_28: MissionDef = {
    id: "M-28",
    order: 28,
    title: "麦もろみから酢を醸そう",
    subs: [
        { id: "M-28-1", order: 1, text: "麦もろみを発酵桶で酢酸発酵させよう（空気に触れさせる）", trigger: itemObtained("vinegar") },
        { id: "M-28-2", order: 2, text: "酢を出荷しよう", trigger: itemShipped("vinegar") },
    ],
    dialogue: [
        "最後はお酢です。お酒と同じ麦もろみから作れるんですよ。",
        "お酢は空気に触れさせて発酵させます。発酵桶で麦もろみを仕込めば大丈夫です。",
        "毎日の食卓に欠かせない調味料ですから、お値段は控えめですが、安定して売れる品です。",
    ],
    completionDialogue: [
        "お酢もできましたね！これで発酵の品はひととおり揃いました。",
        "塩、味噌、醤油、お酒にお酢——この惑星は、すっかり豊かな生産拠点になりましたね。",
        "ここまで本当にお疲れさまでした、先輩。これからもこの星で、ゆっくり過ごしていきましょう。",
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
    M_18,
    M_19,
    M_20,
    M_21,
    M_22,
    M_23,
    M_24,
    M_25,
    M_26,
    M_27,
    M_28,
];
