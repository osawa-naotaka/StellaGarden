import type { GameEventMap } from "../_boundary/events";
import type { ICartStorageWriter, IInventoryWriter, IPlayerStateReader, IVoxelWriter } from "../_boundary/interfaces";
import { getEntityDef, type InteractionContext } from "../_registry/EntityRegistry";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import { getItemDef } from "../_registry/ItemRegistry";
import { getTerrainDef } from "../_registry/TerrainRegistry";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../engine/VoxelDefs";
import type { EventBroker } from "../lib/Event";
import type { UIState } from "../view/UIState";

/** インタラクションハンドラを EventBroker に登録し、解除用の dispose 関数を返す。 */
export function createInteractionHandler(
    voxelMap: IVoxelWriter,
    inventory: IInventoryWriter,
    eventBroker: EventBroker<GameEventMap>,
    uiState: UIState,
    playerState: IPlayerStateReader,
    cartStorage: ICartStorageWriter,
): () => void {
    const INTERACT_RANGE = 5; // タイル

    // 左クリック: ツール使用（収穫・撤去・植え付け・掘削等）
    const d1 = eventBroker.subscribe("interact_world", (packet) => {
        if (uiState.mode === "placement") return;
        if (uiState.isPaused) return;
        const distX = packet.pos.x - playerState.posInWorld.x;
        const distZ = packet.pos.z - playerState.posInWorld.z;
        if (Math.abs(distX) > INTERACT_RANGE || Math.abs(distZ) > INTERACT_RANGE) return;
        const tool = inventory.selectedTool;

        // 台車検出: voxel 外管理のため通常のパスより先に判定する。
        // カートが存在するタイルでは下層の voxel エンティティ（レール等）への操作を遮断する。
        // 例: 斧でカートをクリックしても、カートが空でなければ撤去しないが、下のレールも撤去させない。
        const cartReadOnly = cartStorage.findAt(packet.pos, 0.5);
        if (cartReadOnly) {
            if (tool === "axe") {
                const cart = cartStorage.getByIdWritable(cartReadOnly.id);
                if (cart?.isInventoryEmpty() && cart.attachmentSlot === null) {
                    cartStorage.remove(cart.id);
                    inventory.addItems([{ itemId: "cart", count: 1 }]);
                }
            }
            return;
        }

        const interactPos = voxelMap.getSurfacePosition(packet.pos);
        const voxel = voxelMap.get(interactPos);
        const terrainType = getTerrainTypeFromVoxel(voxel);

        let entityType = getEntityTypeFromVoxel(voxel);
        let anchorPos = { x: interactPos.x, z: interactPos.z };

        // パス1: EntityRegistry — エンティティベース
        if (entityType !== ENTITY_TYPES.none) {
            let anchorVoxel = voxel;
            if (entityType === ENTITY_TYPES.facility_part) {
                const anchor = findFacilityAnchor(voxelMap, packet.pos.x, packet.pos.z);
                anchorVoxel = voxelMap.getSurface({ x: anchor.anchorX, z: anchor.anchorZ });
                entityType = anchor.entityType;
                anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            }
            const ctx: InteractionContext = { voxelMap, inventory, eventBroker, interactPos, anchorPos, voxel: anchorVoxel, tool };

            const entityDef = getEntityDef(entityType);
            if (entityDef.onInteract?.(ctx)) return;
        }

        // パス2: ItemRegistry — アイテムベース
        if (tool) {
            const ctx: InteractionContext = { voxelMap, inventory, eventBroker, interactPos, anchorPos, voxel, tool };

            const itemDef = getItemDef(tool);
            if (itemDef?.onItemUse?.(ctx)) return;
        }

        // パス3: TerrainRegistry — 地形ベース
        const terrainDef = getTerrainDef(terrainType);
        const ctx: InteractionContext = { voxelMap, inventory, eventBroker, interactPos, anchorPos, voxel, tool };
        if (terrainDef?.onInteract?.(ctx)) return;
    });

    // 右クリック: 施設UIの起動等
    const d2 = eventBroker.subscribe("open_facility_ui", (packet) => {
        // placement モード中だけは右クリックを通さない（配置プレビュー継続のため）。
        // それ以外のサイドバー UI 表示中は通し、UIState 側の open_xxx_ui ハンドラが
        // モードを上書きすることで「古い UI 閉じる → 新 UI 開く」を成立させる。
        if (uiState.mode === "placement") return;
        const distX = packet.pos.x - playerState.posInWorld.x;
        const distZ = packet.pos.z - playerState.posInWorld.z;
        if (Math.abs(distX) > INTERACT_RANGE || Math.abs(distZ) > INTERACT_RANGE) return;

        // 台車検出: voxel 外管理のため施設パスより先に判定する
        const cartReadOnly = cartStorage.findAt(packet.pos, 0.5);
        if (cartReadOnly) {
            eventBroker.publish("open_cart_ui", { cartId: cartReadOnly.id });
            return;
        }

        const interactPos = voxelMap.getSurfacePosition(packet.pos);
        const voxel = voxelMap.get(interactPos);
        const terrainType = getTerrainTypeFromVoxel(voxel);

        if (terrainType === TERRAIN_TYPES.waterSource) return;

        const { entityType, anchorX, anchorZ } = findFacilityAnchor(voxelMap, packet.pos.x, packet.pos.z);
        const ctx: InteractionContext = {
            voxelMap,
            inventory,
            eventBroker,
            interactPos,
            voxel,
            tool: inventory.selectedTool,
            anchorPos: { x: anchorX, z: anchorZ },
        };

        const entityDef = getEntityDef(entityType);
        entityDef.onOpenFacilityUI?.(ctx);
    });

    return () => {
        d1();
        d2();
    };
}
