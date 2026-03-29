import { AnimatedSprite, Assets, Spritesheet } from "pixi.js";
import type { Direction8 } from "../_boundary/interfaces";

export class PlayerCharacterView {
    readonly top: AnimatedSprite;

    private currentFacing_: Direction8 = "down";
    private currentMoving_: boolean = false;

    constructor() {
        const sheet = Assets.get<Spritesheet>(
            "/assets/16x16-Idle-Sheet.spritesheet.json"
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

        const idleSheet = Assets.get<Spritesheet>(
            "/assets/16x16-Idle-Sheet.spritesheet.json"
        );
        const walkSheet = Assets.get<Spritesheet>(
            "/assets/16x16-Walk-Sheet.spritesheet.json"
        );

        let animName = "Idle_down";
        let scaleX = 1.0;
        if (isMoving) {
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
          this.top.textures = walkSheet.animations[animName];            
        } else {
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
          this.top.textures = idleSheet.animations[animName];
        }

        this.top.scale.set(scaleX, 1.0);
        this.top.play();
    }
}
