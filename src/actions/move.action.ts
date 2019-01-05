import { DroneOrderStatus, IDroneAction } from './index';
import { HashOnlyMap } from 'eq-collections';
import { IOrderInfo, QueueManager } from '../main/queue-manager';
import {
  DroneStatus,
  InMemoryDroneState,
} from '../services/drone-state.service';
import { TelemetryUpdaterService } from '../services/telemetry-updater.service';

export class MoveAction implements IDroneAction {
  public static readonly KM_PER_DEGREE = 111;
  public static readonly KM_PER_HOUR_PER_ENGINE_POWER_UNIT = Math.sqrt(2)
    * MoveAction.KM_PER_DEGREE
    / 6
    / 1000;
  public static readonly UPDATE_PERIOD = 1000 / 60;
  protected _queue: QueueManager;
  protected _orders: HashOnlyMap<IOrderInfo, NodeJS.Timeout>;

  constructor(queueManager: QueueManager) {
    this._queue = queueManager;
    this._orders = new HashOnlyMap<IOrderInfo, NodeJS.Timeout>(
      order => order.droneOrderId,
    );
  }

  public async beforeEnqueue(order: IOrderInfo): Promise<DroneOrderStatus> {
    return await this.canReachLocation(order)
      ? DroneOrderStatus.ENQUEUED
      : DroneOrderStatus.TOO_FAR_GEO;
  }

  private async canReachLocation(order: IOrderInfo) {
    const drone = this._queue.drone as InMemoryDroneState;
    const batteryCharge = await drone.getBatteryCharge();
    const powerConsumptionPerHour = TelemetryUpdaterService
      .getChargeDeltaForSecond(batteryCharge) * 3600;

    const targetLongitude = order.longitude as number;
    const targetLatitude = order.latitude as number;
    const [distance, hours] = await this.getDistanceAndHours(
      await this.getLatitudeDistance(targetLatitude),
      await this.getLongitudeDistance(targetLongitude),
    );

    return powerConsumptionPerHour * 2 * hours <= batteryCharge;
  }

  private async getDistanceAndHours(
    latitudeDistance: number,
    longitudeDistance: number,
  ) {
    const drone = this._queue.drone as InMemoryDroneState;
    const enginePower = await drone.getEnginePower();
    const distance = Math.sqrt(latitudeDistance ** 2 + longitudeDistance ** 2);
    return [
      distance,
      distance / (
        MoveAction.KM_PER_HOUR_PER_ENGINE_POWER_UNIT * enginePower
      ),
    ];
  }

  private async getLongitudeDistance(longitude: number) {
    const droneLongitude = await this._queue.drone.getLongitude();
    return MoveAction.KM_PER_DEGREE * (
      longitude - droneLongitude
    );
  }

  private async getLatitudeDistance(latitude: number) {
    const droneLatitude = await this._queue.drone.getLatitude();
    return MoveAction.KM_PER_DEGREE * (
      latitude - droneLatitude
    );
  }

  public run(order: IOrderInfo): Promise<DroneOrderStatus> {
    return new Promise(async resolve => {
      if (!await this.canReachLocation(order)) {
        resolve(DroneOrderStatus.TOO_FAR_GEO);
        return;
      }
      const drone = this._queue.drone as InMemoryDroneState;
      const batteryCharge = await drone.getBatteryCharge();
      const powerConsumptionPerPeriod = TelemetryUpdaterService
        .getChargeDeltaForSecond(batteryCharge) * (
        MoveAction.UPDATE_PERIOD / 1000
      );

      const targetLongitude = Number(order.longitude);
      const targetLatitude = Number(order.latitude);

      const latitudeChange = await this.getLatitudeDistance(targetLatitude);
      const longitudeChange = await this.getLongitudeDistance(targetLongitude);
      const [distance, hours] = await this.getDistanceAndHours(
        latitudeChange,
        longitudeChange,
      );
      let counter = hours * 3600 * (
        1000 / MoveAction.UPDATE_PERIOD
      );
      const latitudeDelta = latitudeChange / counter;
      const longitudeDelta = longitudeChange / counter;
      drone.status = DroneStatus.MOVING;
      const interval = setInterval(async () => {
        counter -= 1;
        if (counter === 0) {
          drone.latitude = targetLatitude;
          drone.longitude = targetLongitude;
          drone.status = DroneStatus.WAITING;
          this._orders.delete(order);
        } else {
          drone.latitude = await drone.getLatitude() + latitudeDelta;
          drone.longitude = await drone.getLongitude() + longitudeDelta;
        }
        drone.batteryCharge =
          await drone.getBatteryCharge() - 2 * powerConsumptionPerPeriod;
      }, MoveAction.UPDATE_PERIOD);
      this._orders.set(order, interval);
    });
  }

  public cancel(order: IOrderInfo): boolean {
    if (!this._orders.has(order)) {
      return false;
    }
    const interval = this._orders.get(order) as NodeJS.Timeout;
    clearInterval(interval);
    this._orders.delete(order);
    return true;
  }
}
