"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const release_cargo_action_1 = require("./release-cargo.action");
const move_action_1 = require("./move.action");
const take_cargo_action_1 = require("./take-cargo.action");
var DroneOrderAction;
(function (DroneOrderAction) {
    DroneOrderAction[DroneOrderAction["STOP_AND_WAIT"] = 0] = "STOP_AND_WAIT";
    DroneOrderAction[DroneOrderAction["MOVE_TO_LOCATION"] = 1] = "MOVE_TO_LOCATION";
    DroneOrderAction[DroneOrderAction["TAKE_CARGO"] = 2] = "TAKE_CARGO";
    DroneOrderAction[DroneOrderAction["RELEASE_CARGO"] = 3] = "RELEASE_CARGO";
})(DroneOrderAction = exports.DroneOrderAction || (exports.DroneOrderAction = {}));
var DroneOrderStatus;
(function (DroneOrderStatus) {
    DroneOrderStatus[DroneOrderStatus["STARTED"] = 0] = "STARTED";
    DroneOrderStatus[DroneOrderStatus["ERROR"] = 1] = "ERROR";
    DroneOrderStatus[DroneOrderStatus["ENQUEUED"] = 2] = "ENQUEUED";
    DroneOrderStatus[DroneOrderStatus["SKIPPED"] = 3] = "SKIPPED";
    DroneOrderStatus[DroneOrderStatus["DONE"] = 4] = "DONE";
    DroneOrderStatus[DroneOrderStatus["TOO_FAR_GEO"] = 5] = "TOO_FAR_GEO";
    DroneOrderStatus[DroneOrderStatus["HAS_LOAD"] = 6] = "HAS_LOAD";
    DroneOrderStatus[DroneOrderStatus["HAS_NO_LOAD"] = 7] = "HAS_NO_LOAD";
})(DroneOrderStatus = exports.DroneOrderStatus || (exports.DroneOrderStatus = {}));
function getActions(queueManager) {
    const map = new Map([
        [DroneOrderAction.TAKE_CARGO, new take_cargo_action_1.TakeCargoAction(queueManager)],
        [DroneOrderAction.RELEASE_CARGO, new release_cargo_action_1.ReleaseCargoAction(queueManager)],
        [DroneOrderAction.MOVE_TO_LOCATION, new move_action_1.MoveAction(queueManager)],
    ]);
    return map;
}
exports.getActions = getActions;
//# sourceMappingURL=index.js.map