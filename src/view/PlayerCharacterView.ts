import { AnimatedSprite, Assets, Spritesheet } from "pixi.js";
import type { Direction8 } from "../_boundary/interfaces";

export class PlayerCharacterView {
    readonly top: AnimatedSprite;

    private currentFacing_: Direction8 = "down";
    private currentMoving_: boolean = false;

    constructor() {
        const sheet = Assets.get<Spritesheet>(
            "/assets/16x16-All-Animations-Sheet.spritesheet.json"
        );
        const textures = sheet.animations["Idle_down"];
        const sprite = new AnimatedSprite(textures);
        sprite.anchor.set(0.5, 1.0);
        sprite.animationSpeed = 0.1;
        sprite.play();
        this.top = sprite;
    }

    tick(facing: Direction8, isMoving: boolean): void {
        if (facing === this.currentFacing_ && isMoving === this.currentMoving_) {
            return;
        }
        this.currentFacing_ = facing;
        this.currentMoving_ = isMoving;

        const sheet = Assets.get<Spritesheet>(
            "/assets/16x16-All-Animations-Sheet.spritesheet.json"
        );

        const animName = `${isMoving ? "Walk" : "Idle"}_${facing}`;
        const textures = sheet.animations[animName] ?? sheet.animations["Idle_down"];

        this.top.textures = textures;
        this.top.play();
    }
}
