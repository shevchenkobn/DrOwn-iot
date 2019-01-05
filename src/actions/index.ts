import {
  IDroneState,
  InMemoryDroneState,
} from '../services/drone-state.service';
import { IOrderInfo, QueueManager } from '../main/queue-manager';
import { ReleaseCargoAction } from './release-cargo.action';
import { MoveAction } from './move.action';
import { TakeCargoAction } from './take-cargo.action';

export enum DroneOrderAction {
  STOP_AND_WAIT = 0,
  MOVE_TO_LOCATION = 1,
  TAKE_CARGO = 2,
  RELEASE_CARGO = 3,
}

export enum DroneOrderStatus {
  STARTED = 0,
  ERROR = 1,
  ENQUEUED = 2,
  SKIPPED = 3,
  DONE = 4,
  TOO_FAR_GEO = 5,
  HAS_LOAD = 6,
  HAS_NO_LOAD = 7,
}

export interface IDroneAction {
  beforeEnqueue(order: IOrderInfo): Promise<DroneOrderStatus>;
  run(order: IOrderInfo): Promise<DroneOrderStatus>;
  cancel(order: IOrderInfo): boolean;
}

export function getActions(queueManager: QueueManager) {
  const map = new Map<DroneOrderAction, IDroneAction>([
    [DroneOrderAction.TAKE_CARGO, new TakeCargoAction(queueManager)],
    [DroneOrderAction.RELEASE_CARGO, new ReleaseCargoAction(queueManager)],
    [DroneOrderAction.MOVE_TO_LOCATION, new MoveAction(queueManager)],
  ]);
  return map as ReadonlyMap<DroneOrderAction, IDroneAction>;
}
