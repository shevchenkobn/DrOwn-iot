"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const actions_1 = require("../actions");
const util_service_1 = require("../services/util.service");
class QueueManager {
    constructor(network, drone) {
        this._network = network;
        this._drone = drone;
        this._orderQueue = [];
        this._actions = actions_1.getActions(this);
    }
    get drone() {
        return this._drone;
    }
    get orderQueue() {
        return this._orderQueue;
    }
    skip(order) {
        const i = this._orderQueue.findIndex(o => o.droneOrderId === order.droneOrderId);
        if (i < 0) {
            return false;
        }
        this._orderQueue.splice(i, 1);
        if (this._socket) {
            this._socket.emit(QueueManager.STATUS_EVENT, order.droneOrderId, actions_1.DroneOrderStatus.SKIPPED);
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
            if (order.action === actions_1.DroneOrderAction.STOP_AND_WAIT) {
                const queue = this._orderQueue.slice();
                this._orderQueue.length = 0;
                for (const order of queue) {
                    const action = this._actions.get(order.action);
                    action.cancel(order);
                    if (this._socket) {
                        this._socket.emit(QueueManager.STATUS_EVENT, order.droneOrderId, actions_1.DroneOrderStatus.SKIPPED);
                    }
                }
                return;
            }
            const status = await this.beforeEnqueueStatus(order);
            if (status !== actions_1.DroneOrderStatus.ENQUEUED) {
                cb(status);
                return;
            }
            cb(actions_1.DroneOrderStatus.ENQUEUED);
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
            util_service_1.bindOnExitHandler(this._onExit);
        }
    }
    async runQueue() {
        if (this._orderQueue.length === 0) {
            return;
        }
        while (this._orderQueue.length > 0) {
            const order = this._orderQueue.shift();
            const action = this._actions.get(order.action);
            const status = await action.run(order);
            if (this._socket) {
                this._socket.emit(QueueManager.STATUS_EVENT, status);
            }
            else {
                break;
            }
        }
    }
    stop() {
        if (!this._socket) {
            console.warn('Queue is not started');
            return;
        }
        this._socket.removeEventListener(QueueManager.ORDER_EVENT, this._onOrder);
        this._onOrder = undefined;
        this._socket.removeEventListener('reconnect_failed', this._onReconnectFailed);
        this._onReconnectFailed = undefined;
        this._socket = undefined;
    }
    async beforeEnqueueStatus(order) {
        const action = this._actions.get(order.action);
        if (this._checkingOrder) {
            await this._checkingOrder;
        }
        this._checkingOrder = action.beforeEnqueue(order);
        return await this._checkingOrder;
    }
}
QueueManager.STATUS_EVENT = 'order-change';
QueueManager.ORDER_EVENT = 'order';
exports.QueueManager = QueueManager;
//# sourceMappingURL=queue-manager.js.map