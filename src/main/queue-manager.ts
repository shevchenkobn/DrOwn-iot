import { NetworkingService } from '../services/networking.service';
import { IDroneState } from '../services/drone-state.service';
import {
  DroneOrderAction,
  DroneOrderStatus,
  getActions,
  IDroneAction,
} from '../actions';
import { bindCallbackOnExit } from '../services/util.service';
import Socket = SocketIOClient.Socket;

export interface IOrderInfo {
  droneOrderId: string;
  action: DroneOrderAction;
  longitude?: number | undefined;
  latitude?: number | undefined;
}

export interface IOrderQueue {
  readonly drone: IDroneState;
  readonly orderQueue: ReadonlyArray<Readonly<IOrderInfo>>;

  skip(order: IOrderInfo): boolean;
}

export class QueueManager implements IOrderQueue {
  public static readonly STATUS_EVENT = 'order-change';
  public static readonly ORDER_EVENT = 'order';

  protected _network: NetworkingService;
  protected _drone: IDroneState;

  private _orderQueue: IOrderInfo[];
  private _actions: ReadonlyMap<DroneOrderAction, IDroneAction>;

  private _checkingOrder?: Promise<DroneOrderStatus>;

  get drone() {
    return this._drone;
  }

  get orderQueue() {
    return this._orderQueue;
  }

  private _socket?: Socket;
  private _onReconnectFailed?: () => void;
  private _onExit?: () => void;
  private _onOrder?: (
    order: IOrderInfo,
    cb: (status: DroneOrderStatus) => void,
  ) => void;

  constructor(network: NetworkingService, drone: IDroneState) {
    this._network = network;
    this._drone = drone;

    this._orderQueue = [];
    this._actions = getActions(this);
  }

  public skip(order: IOrderInfo): boolean {
    const i = this._orderQueue.findIndex(
      o => o.droneOrderId === order.droneOrderId,
    );
    if (i < 0) {
      return false;
    }
    this._orderQueue.splice(i, 1);
    if (this._socket) {
      this._socket.emit(
        QueueManager.STATUS_EVENT,
        order.droneOrderId,
        DroneOrderStatus.SKIPPED,
      );
    }
    return true;
  }

  async start() {
    if (this._socket) {
      console.warn('Queue already started');
      return;
    }
    this._socket = await this._network.getSocket();
    this._onOrder = async (order, cb) => {
      if (order.action === DroneOrderAction.STOP_AND_WAIT) {
        const queue = this._orderQueue.slice();
        this._orderQueue.length = 0;
        for (const order of queue) {
          const action = this._actions.get(order.action)!;
          action.cancel(order);
          if (this._socket) {
            this._socket.emit(
              QueueManager.STATUS_EVENT,
              order.droneOrderId,
              DroneOrderStatus.SKIPPED,
            );
          }
        }
        return;
      }
      const status = await this.beforeEnqueueStatus(order);
      if (status !== DroneOrderStatus.ENQUEUED) {
        cb(status);
        return;
      }
      cb(DroneOrderStatus.ENQUEUED);
      this._orderQueue.push(order);
      if (this._orderQueue.length > 1) {
        return;
      }
      this.runQueue().catch(err => {
        console.error('Error while running queue loop', err);
        process.emit('SIGINT', 'SIGINT');
      }).then(() => {
        console.debug('Queue was cleared');
      });
    };
    this._socket.on(QueueManager.ORDER_EVENT, this._onOrder);

    this._onReconnectFailed = () => {
      this.stop();
    };
    this._socket.on('reconnect_failed', this._onReconnectFailed);

    if (!this._onExit) {
      this._onExit = () => {
        this.stop();
      };
      bindCallbackOnExit(this._onExit);
    }
  }

  private async runQueue() {
    if (this._orderQueue.length === 0) {
      return;
    }
    while (this._orderQueue.length > 0) {
      const order = this._orderQueue.shift()!;
      const action = this._actions.get(order.action)!;
      const status = await action.run(order);
      if (this._socket) {
        this._socket.emit(QueueManager.STATUS_EVENT, status);
      } else {
        break;
      }
    }
  }

  stop() {
    if (!this._socket) {
      console.warn('Queue is not started');
      return;
    }

    this._socket.removeEventListener(QueueManager.ORDER_EVENT, this._onOrder!);
    this._onOrder = undefined;

    this._socket.removeEventListener(
      'reconnect_failed',
      this._onReconnectFailed!,
    );
    this._onReconnectFailed = undefined;

    this._socket = undefined;
  }

  protected async beforeEnqueueStatus(order: IOrderInfo) {
    const action = this._actions.get(order.action)!;
    if (this._checkingOrder) {
      await this._checkingOrder;
    }
    this._checkingOrder = action.beforeEnqueue(order);
    return await this._checkingOrder;
  }
}
