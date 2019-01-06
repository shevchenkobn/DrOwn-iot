"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const eq_collections_1 = require("eq-collections");
const drone_state_service_1 = require("../services/drone-state.service");
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
        return MoveAction.KM_PER_DEGREE * (longitude - droneLongitude);
    }
    async getLatitudeDistance(latitude) {
        const droneLatitude = await this._queue.drone.getLatitude();
        return MoveAction.KM_PER_DEGREE * (latitude - droneLatitude);
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
            const targetLongitude = Number(order.longitude);
            const targetLatitude = Number(order.latitude);
            const latitudeChange = await this.getLatitudeDistance(targetLatitude);
            const longitudeChange = await this.getLongitudeDistance(targetLongitude);
            const [distance, hours] = await this.getDistanceAndHours(latitudeChange, longitudeChange);
            // tslint:disable-next-line:max-line-length
            console.log(`Will arrive in ${hours * 60} minutes to (${order.latitude}, ${order.longitude})`);
            let counter = hours * 3600 * (1000 / MoveAction.UPDATE_PERIOD);
            const latitudeDelta = latitudeChange / counter / MoveAction.KM_PER_DEGREE;
            const longitudeDelta = longitudeChange
                / counter
                / MoveAction.KM_PER_DEGREE;
            drone.status = drone_state_service_1.DroneStatus.MOVING;
            const interval = setInterval(async () => {
                counter -= 1;
                if (counter < 0) {
                    drone.latitude = targetLatitude;
                    drone.longitude = targetLongitude;
                    drone.status = drone_state_service_1.DroneStatus.WAITING;
                    this.cancel(order);
                    console.log('Arrived');
                    resolve(index_1.DroneOrderStatus.DONE);
                }
                else {
                    drone.latitude = await drone.getLatitude() + latitudeDelta;
                    drone.longitude = await drone.getLongitude() + longitudeDelta;
                }
                drone.batteryCharge =
                    await drone.getBatteryCharge() - 2 * powerConsumptionPerPeriod;
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
    * MoveAction.KM_PER_DEGREE
    / 6
    / 1000;
MoveAction.UPDATE_PERIOD = 1000 / 60;
exports.MoveAction = MoveAction;
//# sourceMappingURL=move.action.js.map