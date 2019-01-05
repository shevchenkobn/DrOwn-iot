import { NetworkingService } from './networking.service';
import { IDroneState, InMemoryDroneState } from './drone-state.service';
import { bindOnExitHandler } from './util.service';
import { IConfigGetter } from './config-loader.service';
import { Arguments } from 'yargs';
import { IArgv } from './arg-parser.service';
import Emitter = SocketIOClient.Emitter;
import Socket = SocketIOClient.Socket;

export class TelemetryReporterService {
  private _period: number;
  private _interval?: NodeJS.Timeout;
  private _onExit?: () => void;
  private _network: NetworkingService;
  private _drone: IDroneState;

  private _socket?: Socket;
  private _onConnect?: (emitter: Emitter) => void;
  private _onReconnectFailed?: () => void;

  constructor(
    network: NetworkingService,
    drone: IDroneState,
    argv: Arguments<IArgv>,
    config: IConfigGetter,
  ) {
    this._period = argv.reportPeriod || config.get('reportPeriod');
    this._network = network;
    this._drone = drone;
  }

  async start() {
    if (this._interval) {
      return;
    }
    this._socket = await this._network.getSocket();
    if (this._interval && this._onExit) {
      this._onExit();
    }
    this._interval = setInterval(async () => {
      try {
        const [longitude, latitude, batteryCharge, status] = await Promise.all([
          this._drone.getLongitude(),
          this._drone.getLatitude(),
          this._drone.getBatteryCharge(),
          this._drone.getStatus(),
        ]);
        this._socket!.emit('telemetry', {
          status,
          longitude,
          latitude,
          batteryCharge,
        });
      } catch (err) {
        console.error('Telemetry report error', err);
      }
    }, this._period);
    this._onConnect = () => {
      if (!this._onExit) {
        this._onExit = () => {
          if (this._interval) {
            this.stop();
          }
        };
        bindOnExitHandler(this._onExit);
      }
      this._drone.on('disconnecting', this._onExit);
    };
    this._socket.on('connect', this._onConnect);
    this._onReconnectFailed = () => {
      this.stop();
    };
    this._socket.on('reconnect_failed', this._onReconnectFailed);
  }

  stop() {
    if (!this._interval) {
      console.warn('Telemetry reporter is not started!');
      return;
    }

    this._socket!.removeEventListener('connect', this._onConnect);
    this._onConnect = undefined;
    clearInterval(this._interval);
    this._interval = undefined;
    this._socket!.removeEventListener(
      'reconnect_failed',
      this._onReconnectFailed,
    );
    this._onReconnectFailed = undefined;
    this._drone.removeListener('disconnecting', this._onExit!);
  }
}
