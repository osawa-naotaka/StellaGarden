import { ENTITY_TYPES, getEntityTypeFromVoxel } from "../../engine/VoxelDefs";
import type { CartStorage } from "../../engine/CartStorage";
import { type EntitySpriteInfo, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

let cartStorage: CartStorage | null = null;

/** App / hooks 層から CartStorage を注入する。 */
export function setCartStorage(storage: CartStorage): void {
    cartStorage = storage;
}

registerEntity({
    entityType: ENTITY_TYPES.cart,

    getEntitySize(_variant) {
        return { w: 1, h: 1 };
    },

    // 台車は voxelMap に描画されないため空配列を返す
    getSprites(_voxel: bigint): EntitySpriteInfo[] {
        return [];
    },

    // onInteract / onOpenFacilityUI は実装しない。
    // 台車は voxel として存在しないため、InteractionSystem 側で
    // CartStorage.findAt を使って台車ヒット判定→撤去・UI開放を行う。
});

registerItem({
    itemId: "cart",
    displayName: "台車",
    spriteName: "cart_h.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.cart,
        fieldSpriteName: "cart_h.png",
        canPlace(voxelMap, pos, _variant) {
            // rail エンティティの上のみ配置可
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surfacePos);
            return getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.rail;
        },
        onPlace(_voxelMap, pos, _variant) {
            // voxel には何も書かない。CartStorage に登録するだけ。
            cartStorage?.spawn(pos);
        },
    },
});
