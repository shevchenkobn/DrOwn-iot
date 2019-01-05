"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const eq_collections_1 = require("eq-collections");
const telemetry_updater_service_1 = require("../services/telemetry-updater.service");
class MoveAction {
    constructor(queueManager) {
        this._queue = queueManager;
        this._orders = new eq_collections_1.HashOnlyMap(order => order.droneOrderId);
    }
    async beforeEnqueue(order) {
        return await this.canReachLocation(order)
            ? index_1.DroneOrderStatus.ENQUEUED
            : index_1.DroneOrderStatus.TOO_FAR_GEO;
    }
    async canReachLocation(order) {
        const drone = this._queue.drone;
        const batteryCharge = await drone.getBatteryCharge();
        const powerConsumptionPerHour = telemetry_updater_service_1.TelemetryUpdaterService
            .getChargeDeltaForSecond(batteryCharge) * 3600;
        const targetLongitude = order.longitude;
        const targetLatitude = order.latitude;
        const [distance, hours] = await this.getDistanceAndHours(await this.getLatitudeDistance(targetLatitude), await this.getLongitudeDistance(targetLongitude));
        return powerConsumptionPerHour * 2 * hours <= batteryCharge;
    }
    async getDistanceAndHours(latitudeDistance, longitudeDistance) {
        const drone = this._queue.drone;
        const enginePower = await drone.getEnginePower();
        const distance = Math.sqrt(latitudeDistance ** 2 + longitudeDistance ** 2);
        return [
            distance,
            distance / (MoveAction.KM_PER_HOUR_PER_ENGINE_POWER_UNIT * enginePower),
        ];
    }
    async getLongitudeDistance(longitude) {
        const droneLongitude = await this._queue.drone.getLongitude();
        return MoveAction.KM_PER_DEGREE * (droneLongitude - longitude);
    }
    async getLatitudeDistance(latitude) {
        const droneLatitude = await this._queue.drone.getLatitude();
        return MoveAction.KM_PER_DEGREE * (droneLatitude - latitude);
    }
    run(order) {
        return new Promise(async (resolve) => {
            if (!await this.canReachLocation(order)) {
                resolve(index_1.DroneOrderStatus.TOO_FAR_GEO);
                return;
            }
            const drone = this._queue.drone;
            const batteryCharge = await drone.getBatteryCharge();
            const powerConsumptionPerPeriod = telemetry_updater_service_1.TelemetryUpdaterService
                .getChargeDeltaForSecond(batteryCharge) * (MoveAction.UPDATE_PERIOD / 1000);
            const targetLongitude = order.longitude;
            const targetLatitude = order.latitude;
            const latitudeChange = await this.getLatitudeDistance(targetLatitude);
            const longitudeChange = await this.getLongitudeDistance(targetLongitude);
            const [distance, hours] = await this.getDistanceAndHours(latitudeChange, longitudeChange);
            let counter = hours * 3600 * (1000 / MoveAction.UPDATE_PERIOD);
            const latitudeDelta = latitudeChange / counter;
            const longitudeDelta = latitudeChange / counter;
            const interval = setInterval(() => {
                counter -= 1;
                if (counter === 0) {
                    drone.latitude = targetLatitude;
                    drone.longitude = targetLongitude;
                }
                else {
                    drone.latitude += latitudeDelta;
                    drone.longitude += longitudeDelta;
                }
                drone.batteryCharge -= 2 * powerConsumptionPerPeriod;
            }, MoveAction.UPDATE_PERIOD);
            this._orders.set(order, interval);
        });
    }
    cancel(order) {
        if (!this._orders.has(order)) {
            return false;
        }
        const interval = this._orders.get(order);
        clearInterval(interval);
        this._orders.delete(order);
        return true;
    }
}
MoveAction.KM_PER_DEGREE = 111;
MoveAction.KM_PER_HOUR_PER_ENGINE_POWER_UNIT = Math.sqrt(2)
    * 3600
    * MoveAction.KM_PER_DEGREE
    / 6
    / 1000;
MoveAction.UPDATE_PERIOD = 1000 / 60;
exports.MoveAction = MoveAction;
//# sourceMappingURL=move.action.js.map