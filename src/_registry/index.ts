/**
 * 全エンティティ・アイテム・地形定義を登録する集約ファイル。
 * App エントリで `import "./_registry"` するだけで全レジストリが揃う。
 *
 * 各モジュールは副作用 import で自己登録する設計のため、ここでは順序を保証することと、
 * App.tsx 側に登録モジュールが大量に並ぶのを防ぐことが目的。
 */

import "./entities/Chest";
import "./entities/Clay";
import "./entities/Crops";
import "./entities/Forge";
import "./entities/MeteoricIron";
import "./entities/FurrowCanal";
import "./entities/Rail";
import "./entities/Cart";
import "./entities/Shaft";
import "./entities/Stone";
import "./entities/Tree";
import "./entities/WarpGate";
import "./entities/Waterwheel";
import "./entities/Winch";
import "./entities/Workbench";
import "./entities/ManualProcessing";
import "./entities/DailyProcessing";
import "./items/Dirt";
import "./items/Fertilizers";
import "./items/Materials";
import "./items/Tools";
import "./items/WateringCan";
import "./terrains/GrassDirtSoilWetSoil";
