import { Arguments } from 'yargs';
import { IArgv } from './arg-parser.service';
import { IConfigGetter } from './config-loader.service';
import * as url from 'url';
import * as SocketIO from 'socket.io-client';
import axios from 'axios';
import { IDroneState } from './drone-state.service';
import Socket = SocketIOClient.Socket;
import { bindOnExitHandler, sleep } from './util.service';
import Emitter = SocketIOClient.Emitter;

export class NetworkingService {
  public static readonly PASSWORD_PATH = '/api/v1/drones/authorize';
  public static readonly SOCKETIO_PATH = '/socket.io';
  public static readonly SOCKETIO_NSP = '/drones';

  private _disconnecting: boolean;
  private _onClose?: () => void;
  private _url: string;
  private _io?: Socket;
  private _ioPromise?: Promise<Socket>;
  private _drone: IDroneState;

  constructor(
    argv: Arguments<IArgv>,
    config: IConfigGetter,
    state: IDroneState,
  ) {
    const urlString = argv.url || config.get('serverUrl');
    // Validate url
    url.parse(urlString as any);
    this._url = urlString as string;
    if (this._url[this._url.length - 1] === '/') {
      throw new Error('URL mustn\'t finished with a slash');
    }

    this._drone = state;
    this._disconnecting = false;
  }

  getSocket(): Promise<Socket> {
    if (this._io) {
      return Promise.resolve(this._io);
    }
    if (this._ioPromise) {
      const promise = this._ioPromise;
      return new Promise((resolve, reject) => {
        promise.then(resolve, reject);
      });
    }
    this._ioPromise = new Promise(async (resolve, reject) => {
      try {
        this._io =
          SocketIO.connect(this._url + NetworkingService.SOCKETIO_NSP, {
            path: NetworkingService.SOCKETIO_PATH,
            timeout: 10000,
            agent: false,
            query: {
              'device-id': await this._drone.getDeviceId(),
              password: await this.getOrUpdatePassword(),
            },
          });
        this._io.on('connect', () => {
          if (!this._onClose) {
            this._onClose = () => {
              this._disconnecting = true;
              if (this._io) {
                this._io.disconnect();
              }
            };
            bindOnExitHandler(this._onClose);
          }
        });
        this._io.on('reconnect_error', (reason: any) => {
          if (!this._disconnecting) {
            console.log(`Disconnected due to ${reason}. Reconnecting...`);
            this.reconnect();
          }
        });
        this._io.on('error', (err: any) => {
          console.log(`Error ${err}.`);
        });
        resolve(this._io);
        this._ioPromise = undefined;
      } catch (err) {
        reject(err);
      }
    });
    return this._ioPromise;
  }

  private reconnect() {
    this.getSocket().catch(err => {
      console.error('Error while reconnecting', err);
      if (!this._disconnecting) {
        this.reconnect();
      }
    });
  }

  private async getOrUpdatePassword() {
    let password: string;
    if (await this._drone.hasPassword()) {
      password = await this._drone.getPassword();
    } else {
      console.log(this._url);
      const response = await axios.post(
        this._url + NetworkingService.PASSWORD_PATH,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            'device-id': await this._drone.getDeviceId(),
          },
        },
      );
      password = response.data.password;
      await this._drone.setPassword(password);
    }
    return password;
  }
}
