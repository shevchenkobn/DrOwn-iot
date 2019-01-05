"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const eq_collections_1 = require("eq-collections");
class TakeCargoAction {
    constructor(queueManager) {
        this._queue = queueManager;
        this._orders = new eq_collections_1.HashOnlyMap(order => order.droneOrderId);
    }
    beforeEnqueue(order) {
        return Promise.resolve(index_1.DroneOrderStatus.ENQUEUED);
    }
    run(order) {
        return new Promise(async (resolve, reject) => {
            const drone = this._queue.drone;
            if (await drone.getLoad() !== 0) {
                resolve(index_1.DroneOrderStatus.HAS_LOAD);
                return;
            }
            const delay = Math.random() * (await drone.getLoadCapacity());
            const chargeDelta = 0.25 * delay;
            const timeout = setTimeout(async () => {
                drone.load = delay;
                drone.batteryCharge -= await drone.getBatteryCharge() - chargeDelta;
                resolve(index_1.DroneOrderStatus.DONE);
                this._orders.delete(order);
            }, delay);
            this._orders.set(order, timeout);
        });
    }
    cancel(order) {
        if (!this._orders.has(order)) {
            return false;
        }
        const timeout = this._orders.get(order);
        clearTimeout(timeout);
        this._orders.delete(order);
        return true;
    }
}
exports.TakeCargoAction = TakeCargoAction;
//# sourceMappingURL=take-cargo.action.js.map