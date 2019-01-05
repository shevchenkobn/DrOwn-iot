import { Arguments } from 'yargs';
import { IArgv } from './arg-parser.service';
import { IConfigGetter } from './config-loader.service';
import { promises as fs, constants as fsConst } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { bindCallbackOnExit } from './util.service';
import { TelemetryUpdaterService } from './telemetry-updater.service';
import { EventEmitter } from 'events';

export interface IDroneState extends EventEmitter {
  readonly connected: boolean;

  getLongitude(): Promise<number>;

  getLatitude(): Promise<number>;

  getCoords(): Promise<[number, number]>;

  getBatteryCharge(): Promise<number>;

  getLoad(): Promise<number>;

  getDeviceId(): Promise<string>;

  getPassword(): Promise<string>;

  hasPassword(): Promise<boolean>;

  setPassword(password: string): Promise<void>;

  getEnginePower(): Promise<number>;

  getBatteryPower(): Promise<number>;

  getLoadCapacity(): Promise<number>;

  canCarryLiquids(): Promise<boolean>;

  getBaseLongitude(): Promise<number>;

  getBaseLatitude(): Promise<number>;

  getBaseCoords(): Promise<[number, number]>;

  connect(): Promise<void>;

  disconnect(): Promise<void>;
}

export enum DisconnectReason {
  BATTERY_CHARGE,
}

export class InMemoryDroneState extends EventEmitter implements IDroneState {
  private _deviceId!: string;
  private _enginePower!: number;
  private _batteryPower!: number;
  private _loadCapacity!: number;
  private _baseLongitude!: number;
  private _baseLatitude!: number;
  private _canCarryLiquids!: boolean;
  private _batteryCharge!: number;
  private _longitude!: number;
  private _latitude!: number;
  private _load!: number;

  private _updater: TelemetryUpdaterService;
  private _connected: boolean;
  private _snapshotPath: string;
  private _passwordPath: string;
  private _closeCallback?: () => void;

  get connected() {
    return this._connected;
  }

  set latitude(value: number) {
    if (!isLatitude(value)) {
      throw new TypeError(`Bad latitude value ${value}`);
    }
    this._latitude = value;
  }

  set longitude(value: number) {
    if (!isLongitude(value)) {
      throw new TypeError(`Bad longitude value ${value}`);
    }
    this._longitude = value;
  }

  set batteryCharge(value: number) {
    if (!isCharge(value, true)) {
      throw new TypeError(`Bad battery charge value ${value}`);
    }
    if (value <= 0) {
      this._batteryCharge = 0;
      console.log('Disconnecting due to battery going down');
      this.emit('disconnecting', DisconnectReason.BATTERY_CHARGE);
      this.disconnect().then(() => {
        console.log('Drone is disconnected');
      });
    }
    this._batteryCharge = value;
  }

  set load(value: number) {
    if (value < 0) {
      throw new TypeError('Load cannot be negative!');
    }
    this._load = value;
  }

  constructor(argv: Arguments<IArgv>, config: IConfigGetter) {
    super();
    this._connected = false;
    this._snapshotPath = path.resolve(argv.snapshotPath || config.get('snapshotPath'));
    this._passwordPath = config.has('passwordPath')
      ? config.get('passwordPath')
      : argv.passwordPath;
    this._updater = new TelemetryUpdaterService(this);
  }

  public async connect(): Promise<void> {
    if (this._connected) {
      console.warn('Drone state is initialized', this);
      return;
    }
    const serializedSnapshot = await fs.readFile(this._snapshotPath, {
      encoding: 'utf8',
    });
    const snapshot = yaml.safeLoad(serializedSnapshot, {
      filename: this._snapshotPath,
    });
    if (!isDeviceId(snapshot.deviceId)) {
      throw new TypeError(`Device ID is bad ${snapshot.deviceId}`);
    }
    this._deviceId = snapshot.deviceId;

    if (!isLongitude(snapshot.baseLongitude)) {
      throw new TypeError(`Base longitude is bad ${snapshot.baseLongitude}`);
    }
    this._baseLongitude = snapshot.baseLongitude;
    if (!isLongitude(snapshot.baseLatitude)) {
      throw new TypeError(`Base latitude is bad ${snapshot.baseLatitude}`);
    }
    this._baseLatitude = snapshot.baseLatitude;
    if (!isPositive(snapshot.enginePower)) {
      throw new TypeError(`Engine power is bad ${snapshot.enginePower}`);
    }
    this._enginePower = snapshot.enginePower;
    if (!isPositive(snapshot.batteryPower)) {
      throw new TypeError(`Battery power is bad ${snapshot.batteryPower}`);
    }
    this._batteryPower = snapshot.batteryPower;
    if (!isPositive(snapshot.loadCapacity)) {
      throw new TypeError(`Load capacity is bad ${snapshot.loadCapacity}`);
    }
    this._loadCapacity = snapshot.loadCapacity;
    if (typeof snapshot.canCarryLiquids !== 'boolean') {
      throw new TypeError(`Can carry liquids is bad ${snapshot.canCarryLiquids}`);
    }
    this._canCarryLiquids = snapshot.canCarryLiquids;
    this._load = isPositive(snapshot.load) ? snapshot.load : 0;

    if (snapshot.latitude !== undefined) {
      if (!isLatitude(snapshot.latitude)) {
        throw new TypeError(`Latitude is bad ${snapshot.latitude}`);
      }
      this._latitude = snapshot.latitude;
    } else {
      this._latitude = this._baseLatitude;
    }
    if (snapshot.longitude !== undefined) {
      if (!isLongitude(snapshot.longitude)) {
        throw new TypeError(`Longitude is bad ${snapshot.longitude}`);
      }
      this._longitude = snapshot.longitude;
    } else {
      this._longitude = this._baseLongitude;
    }
    if (snapshot.batteryCharge !== undefined) {
      if (!isCharge(snapshot.batteryCharge)) {
        throw new TypeError(`Battery charge is bad ${snapshot.batteryCharge}`);
      }
      this._batteryCharge = snapshot.batteryCharge;
    } else {
      this._batteryCharge = 100;
    }

    if (!this._closeCallback) {
      this._closeCallback = () => this.disconnect();
      bindCallbackOnExit(this._closeCallback);
    }
    this._connected = true;
    this._updater.start();
  }

  public async disconnect(): Promise<void> {
    if (!this._connected) {
      console.warn('Drone state is not initialized', this);
      return;
    }
    const serializedSnapshot = yaml.safeDump({
      baseLongitude: this._baseLongitude,
      baseLatitude: this._baseLatitude,
      enginePower: this._enginePower,
      batteryPower: this._batteryPower,
      loadCapacity: this._loadCapacity,
      canCarryLiquids: this._canCarryLiquids,

      latitude: this._latitude,
      longitude: this._longitude,
      batteryCharge: this._batteryCharge,
    });
    try {
      await fs.writeFile(this._snapshotPath, serializedSnapshot);
    } catch (err) {
      console.error('Failed to write snapshot');
      console.error('\n\n', serializedSnapshot, '\n\n');
      throw err;
    }
    this._connected = false;
    this._updater.stop();
  }

  public async getDeviceId(): Promise<string> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._deviceId);
  }

  public async hasPassword(): Promise<boolean> {
    if (!this._connected) {
      await this.connect();
    }
    try {
      await fs.access(
        this._passwordPath,
        fsConst.F_OK | fsConst.W_OK | fsConst.R_OK,
      );
      return true;
    } catch (err) {
      console.warn('Hasn\'t password:', err);
      return false;
    }
  }

  public async getPassword(): Promise<string> {
    if (!this._connected) {
      await this.connect();
    }
    return fs.readFile(this._passwordPath, {
      encoding: 'utf8',
    });
  }

  public async setPassword(password: string): Promise<void> {
    if (!this._connected) {
      await this.connect();
    }
    await fs.writeFile(this._passwordPath, password);
  }

  public async getBaseCoords(): Promise<[number, number]> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(
      [this._baseLatitude, this._baseLongitude] as [number, number],
    );
  }

  public async getBaseLatitude(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._baseLatitude);
  }

  public async getBaseLongitude(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._baseLongitude);
  }

  public async getEnginePower(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._enginePower);
  }

  public async getBatteryPower(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._batteryPower);
  }

  public async getLoadCapacity(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._loadCapacity);
  }

  public async canCarryLiquids(): Promise<boolean> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._canCarryLiquids);
  }

  public async getBatteryCharge(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._batteryCharge);
  }

  public async getLongitude(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._longitude);
  }

  public async getLatitude(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._latitude);
  }

  public async getCoords(): Promise<[number, number]> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(
      [this._latitude, this._longitude] as [number, number],
    );
  }

  public async getLoad(): Promise<number> {
    if (!this._connected) {
      await this.connect();
    }
    return Promise.resolve(this._load);
  }
}

function isCharge(value: any, skipNegative = false) {
  return typeof value === 'number' && (
    (skipNegative || value >= 0) && value <= 100
  );
}

function isLongitude(value: any) {
  return typeof value === 'number' && (
    value >= -180 && value <= 180
  );
}

function isLatitude(value: any) {
  return typeof value === 'number' && (
    value >= -90 && value <= 90
  );
}

function isPositive(value: any) {
  return typeof value === 'number' && value > 0;
}

const deviceIdRegex = /^[\da-fA-F]{12}/;

function isDeviceId(value: any) {
  return typeof value === 'string' && deviceIdRegex.test(value);
}
