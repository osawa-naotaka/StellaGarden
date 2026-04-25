import { AnimatedSprite, Assets, type Spritesheet } from "pixi.js";
import { PIXEL_PER_TILE } from "../_boundary/constants";
import type { Direction8 } from "../_boundary/interfaces";

export class PlayerCharacterView {
    readonly top: AnimatedSprite;

    private currentFacing_: Direction8 = "down";
    private currentMoving_: boolean = false;
    private currentHolding_: boolean = false;

    constructor() {
        const sheet = Assets.get<Spritesheet>("/assets/16x16-Idle-Sheet.spritesheet.json");
        const textures = sheet.animations.Idle_down;
        const sprite = new AnimatedSprite(textures);
        sprite.anchor.set(0.5, 1.0);
        sprite.scale.set(PIXEL_PER_TILE / 16);
        sprite.animationSpeed = 0.1;
        sprite.play();
        this.top = sprite;
    }

    tick(facing: Direction8, isMoving: boolean, isHolding: boolean): void {
        if (facing === this.currentFacing_ && isMoving === this.currentMoving_ && isHolding === this.currentHolding_) {
            return;
        }
        this.currentFacing_ = facing;
        this.currentMoving_ = isMoving;
        this.currentHolding_ = isHolding;

        const idleSheet = Assets.get<Spritesheet>("/assets/16x16-Idle-Sheet.spritesheet.json");
        const walkSheet = Assets.get<Spritesheet>("/assets/16x16-Walk-Sheet.spritesheet.json");

        let animName = "Idle_down";
        let scaleX = 1.0;
        let sheet = idleSheet;

        if (isHolding) {
            const interactSheet = Assets.get<Spritesheet>("/assets/16x16-Interact-Sheet.spritesheet.json");
            if (interactSheet) {
                sheet = interactSheet;
                switch (facing) {
                    case "down":
                        animName = "Interact_down";
                        break;
                    case "down_right":
                        animName = "Interact_down_right";
                        break;
                    case "right":
                        animName = "Interact_right";
                        break;
                    case "up_right":
                        animName = "Interact_up_right";
                        break;
                    case "up":
                        animName = "Interact_up";
                        break;
                    case "up_left":
                        animName = "Interact_up_right";
                        scaleX = -1.0;
                        break;
                    case "left":
                        animName = "Interact_right";
                        scaleX = -1.0;
                        break;
                    case "down_left":
                        animName = "Interact_down_right";
                        scaleX = -1.0;
                        break;
                }
                if (!sheet.animations[animName]) {
                    sheet = idleSheet;
                    animName = "Idle_down";
                    scaleX = 1.0;
                }
            }
            // interactSheet が null/undefined の場合は sheet = idleSheet のまま（Idle_down フォールバック）
        } else if (isMoving) {
            sheet = walkSheet;
            switch (facing) {
                case "down":
                    animName = "Walk_down";
                    break;
                case "down_right":
                    animName = "Walk_down_right";
                    break;
                case "right":
                    animName = "Walk_right";
                    break;
                case "up_right":
                    animName = "Walk_up_right";
                    break;
                case "up":
                    animName = "Walk_up";
                    break;
                case "up_left":
                    animName = "Walk_up_right";
                    scaleX = -1.0;
                    break;
                case "left":
                    animName = "Walk_right";
                    scaleX = -1.0;
                    break;
                case "down_left":
                    animName = "Walk_down_right";
                    scaleX = -1.0;
                    break;
            }
        } else {
            sheet = idleSheet;
            switch (facing) {
                case "down":
                    animName = "Idle_down";
                    break;
                case "down_right":
                    animName = "Idle_down_right";
                    break;
                case "right":
                    animName = "Idle_right";
                    break;
                case "up_right":
                    animName = "Idle_up_right";
                    break;
                case "up":
                    animName = "Idle_up";
                    break;
                case "up_left":
                    animName = "Idle_up_right";
                    scaleX = -1.0;
                    break;
                case "left":
                    animName = "Idle_right";
                    scaleX = -1.0;
                    break;
                case "down_left":
                    animName = "Idle_down_right";
                    scaleX = -1.0;
                    break;
            }
        }

        this.top.textures = sheet.animations[animName];
        this.top.scale.set((scaleX * PIXEL_PER_TILE) / 16, PIXEL_PER_TILE / 16);
        this.top.play();
    }
}
