import { DroneOrderStatus, IDroneAction } from './index';
import { IOrderInfo, QueueManager } from '../main/queue-manager';
import { HashOnlyMap } from 'eq-collections';
import { InMemoryDroneState } from '../services/drone-state.service';

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
      const delay = Math.random() * (await drone.getLoadCapacity());
      const chargeDelta = 0.25 * delay;
      const timeout = setTimeout(() => {
        drone.load = delay;
        drone.batteryCharge -= chargeDelta;
        resolve(DroneOrderStatus.DONE);
        this._orders.delete(order);
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
