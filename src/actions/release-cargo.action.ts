import { DroneOrderStatus, IDroneAction } from './index';
import { IOrderInfo, QueueManager } from '../main/queue-manager';
import { HashOnlyMap } from 'eq-collections';
import {
  DroneStatus,
  InMemoryDroneState,
} from '../services/drone-state.service';
import { TelemetryUpdaterService } from '../services/telemetry-updater.service';

export class ReleaseCargoAction implements IDroneAction {
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
      const load = await drone.getLoad();
      if (load === 0) {
        resolve(DroneOrderStatus.HAS_NO_LOAD);
        return;
      }
      const chargeDelta = 2
        * (load / await drone.getLoadCapacity())
        * TelemetryUpdaterService.getChargeDeltaForSecond(
          await drone.getBatteryPower(),
        );
      drone.status = DroneStatus.RELEASING_CARGO;
      console.log(`Unloading ${load} weight...`);
      const timeout = setTimeout(async () => {
        drone.load = 0;
        drone.batteryCharge = await drone.getBatteryCharge() - chargeDelta;
        drone.status = DroneStatus.WAITING;
        this.cancel(order);
        console.log('Unloaded.');
        resolve(DroneOrderStatus.DONE);
      }, load / 2);
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
