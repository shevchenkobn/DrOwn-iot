import { DroneOrderStatus, IDroneAction } from './index';
import { IOrderInfo, QueueManager } from '../main/queue-manager';
import { HashOnlyMap } from 'eq-collections';
import {
  DroneStatus,
  InMemoryDroneState,
} from '../services/drone-state.service';
import { TelemetryUpdaterService } from '../services/telemetry-updater.service';

export class TakeCargoAction implements IDroneAction {
  protected _queue: QueueManager;
  protected _orders: HashOnlyMap<IOrderInfo, NodeJS.Timeout>;

  constructor(queueManager: QueueManager) {
    this._queue = queueManager;
    this._orders = new HashOnlyMap<IOrderInfo, NodeJS.Timeout>(
      order => order.droneOrderId,
    );
  }

  public beforeEnqueue(order: IOrderInfo): Promise<DroneOrderStatus> {
    return Promise.resolve(DroneOrderStatus.ENQUEUED);
  }

  public run(order: IOrderInfo): Promise<DroneOrderStatus> {
    return new Promise(async (resolve, reject) => {
      const drone = this._queue.drone as InMemoryDroneState;
      if (await drone.getLoad() !== 0) {
        resolve(DroneOrderStatus.HAS_LOAD);
        return;
      }
      const loadCapacity = await drone.getLoadCapacity();
      const delay = Math.random() * loadCapacity;
      const chargeDelta = 2
        * (delay / loadCapacity)
        * TelemetryUpdaterService.getChargeDeltaForSecond(
          await drone.getBatteryPower(),
        );
      drone.status = DroneStatus.TAKING_CARGO;
      console.log(`Loading ${delay} weight...`);
      const timeout = setTimeout(async () => {
        drone.load = delay;
        drone.batteryCharge = await drone.getBatteryCharge() - chargeDelta;
        drone.status = DroneStatus.WAITING;
        this.cancel(order);
        console.log('Loaded.');
        resolve(DroneOrderStatus.DONE);
      }, delay);
      this._orders.set(order, timeout);
    });
  }

  public cancel(order: IOrderInfo): boolean {
    if (!this._orders.has(order)) {
      return false;
    }
    const timeout = this._orders.get(order) as NodeJS.Timeout;
    clearTimeout(timeout);
    this._orders.delete(order);
    return true;
  }
}
