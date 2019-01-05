import { DisconnectReason, InMemoryDroneState } from './drone-state.service';
import { bindOnExitHandler } from './util.service';

export class TelemetryUpdaterService {
  public static readonly INTERVAL = 1000;

  public static getChargeDeltaForSecond(batteryPower: number) {
    return (
      batteryPower / (
        48 * 3600
      )
    ) / batteryPower * 100;
  }

  protected _drone: InMemoryDroneState;
  private _interval?: NodeJS.Timeout;
  private _onClose?: () => void;
  private _onDisconnect?: (reason: DisconnectReason) => void;
  private _chargeDelta?: number;

  constructor(drone: InMemoryDroneState) {
    this._drone = drone;
    this._drone.connect().then(async () => {
      const batteryPower = await this._drone.getBatteryPower();
      this._chargeDelta =
        TelemetryUpdaterService.getChargeDeltaForSecond(batteryPower)
        * 1000
        / TelemetryUpdaterService.INTERVAL;
    });
  }

  start() {
    if (this._interval) {
      return;
    }
    this._interval = setInterval(async () => {
      if (typeof this._chargeDelta !== 'number') {
        return;
      }
      const currentDelta = this._chargeDelta + (
        this._chargeDelta * (
          await this._drone.getLoad()
          / await this._drone.getLoadCapacity()
        )
      );
      this._drone.batteryCharge =
        await this._drone.getBatteryCharge() - currentDelta;
    }, TelemetryUpdaterService.INTERVAL);
    this._onDisconnect = reason => {
      this.stop();
    };
    this._drone.on('disconnecting', this._onDisconnect);
    if (!this._onClose) {
      this._onClose = () => {
        if (this._interval) {
          this.stop();
        }
      };
      bindOnExitHandler(this._onClose);
    }
  }

  stop() {
    if (!this._interval) {
      console.warn('Telemetry updater is not started');
      return;
    }
    clearInterval(this._interval);
    this._interval = undefined;
    this._drone.removeListener('disconnecting', this._onDisconnect!);
    this._onDisconnect = undefined;
  }
}
