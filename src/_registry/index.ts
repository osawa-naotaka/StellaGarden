/**
 * 全エンティティ・アイテム・地形定義を登録する集約ファイル。
 * App エントリで `import "./_registry"` するだけで全レジストリが揃う。
 *
 * 各モジュールは副作用 import で自己登録する設計のため、ここでは順序を保証することと、
 * App.tsx 側に登録モジュールが大量に並ぶのを防ぐことが目的。
 */

import "./entities/Bonfire";
import "./entities/Chest";
import "./entities/Clay";
import "./entities/CompostBin";
import "./entities/Crops";
import "./entities/Forge";
import "./entities/Kiln";
import "./entities/MeteoricIron";
import "./entities/Pipe";
import "./entities/Rail";
import "./entities/SoakingBasket";
import "./entities/Stone";
import "./entities/Tree";
import "./entities/WarpGate";
import "./entities/Workbench";
import "./entities/facilities";
import "./entities/ManualProcessing";
import "./items/Dirt";
import "./items/Fertilizers";
import "./items/Materials";
import "./items/Tools";
import "./items/WateringCan";
import "./terrains/GrassDirtSoilWetSoil";
