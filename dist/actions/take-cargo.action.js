"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const eq_collections_1 = require("eq-collections");
const drone_state_service_1 = require("../services/drone-state.service");
const telemetry_updater_service_1 = require("../services/telemetry-updater.service");
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
            const loadCapacity = await drone.getLoadCapacity();
            const delay = Math.random() * loadCapacity;
            const chargeDelta = 2
                * (delay / loadCapacity)
                * telemetry_updater_service_1.TelemetryUpdaterService.getChargeDeltaForSecond(await drone.getBatteryPower());
            drone.status = drone_state_service_1.DroneStatus.TAKING_CARGO;
            console.log(`Loading ${delay} weight...`);
            const timeout = setTimeout(async () => {
                drone.load = delay;
                drone.batteryCharge = await drone.getBatteryCharge() - chargeDelta;
                drone.status = drone_state_service_1.DroneStatus.WAITING;
                this.cancel(order);
                console.log('Loaded.');
                resolve(index_1.DroneOrderStatus.DONE);
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