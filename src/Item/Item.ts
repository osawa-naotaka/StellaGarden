export type ItemType = "watering_can" | "pickaxe" | "axe" | "sickle" | "shovel" | "potato";

export abstract class Item {
    private readonly itemType: ItemType;

    constructor({ type }: { type: ItemType }) {
        this.itemType = type;
    }

    get type() {
        return this.itemType;
    }

    abstract get sprite(): string;
}
