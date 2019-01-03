import { NetworkingService } from './networking.service';
import { InMemoryDroneState } from './drone-state.service';
import { bindCallbackOnExit } from './util.service';
import { IConfigGetter } from './config-loader.service';
import { Arguments } from 'yargs';
import { IArgv } from './arg-parser.service';

export class TelemetryReporterService {
  private _isReporting: boolean;
  private _period: number;
  private _interval?: NodeJS.Timeout;
  private _onExit?: () => void;
  private _network: NetworkingService;
  private _drone: InMemoryDroneState;

  constructor(
    network: NetworkingService,
    drone: InMemoryDroneState,
    argv: Arguments<IArgv>,
    config: IConfigGetter,
  ) {
    this._period = argv.reportPeriod || config.get('reportPeriod');
    this._network = network;
    this._drone = drone;
    this._isReporting = false;

    bindCallbackOnExit(() => this.stop());
  }

  async start() {
    if (this._interval) {
      return;
    }
    const emitter = await this._network.getEmitter();
    this._interval = setInterval(async () => {
      try {
        emitter.emit('telemetry', {
          longitude: await this._drone.getLongitude(),
          latitude: await this._drone.getLatitude(),
          batteryCharge: await this._drone.getBatteryCharge(),
        });
      } catch (err) {
        console.error('Telemetry report error', err);
      }
    }, this._period);
    if (!this._onExit) {
      this._onExit = () => {
        if (!this._interval) {
          return;
        }
        clearInterval(this._interval);
        this._interval = undefined;
      };
      bindCallbackOnExit(this._onExit);
    }
  }

  stop() {
    if (this._onExit) {
      this._onExit();
    } else {
      console.warn('Telemetry reporting did\'t started and stopped');
    }
  }
}
