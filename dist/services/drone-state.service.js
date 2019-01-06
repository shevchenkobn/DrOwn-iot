"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const util_service_1 = require("./util.service");
const telemetry_updater_service_1 = require("./telemetry-updater.service");
const events_1 = require("events");
var DroneStatus;
(function (DroneStatus) {
    DroneStatus[DroneStatus["WAITING"] = 0] = "WAITING";
    DroneStatus[DroneStatus["TAKING_CARGO"] = 1] = "TAKING_CARGO";
    DroneStatus[DroneStatus["RELEASING_CARGO"] = 2] = "RELEASING_CARGO";
    DroneStatus[DroneStatus["MOVING"] = 3] = "MOVING";
})(DroneStatus = exports.DroneStatus || (exports.DroneStatus = {}));
var DisconnectReason;
(function (DisconnectReason) {
    DisconnectReason[DisconnectReason["BATTERY_CHARGE"] = 0] = "BATTERY_CHARGE";
})(DisconnectReason = exports.DisconnectReason || (exports.DisconnectReason = {}));
class InMemoryDroneState extends events_1.EventEmitter {
    get connected() {
        return this._connected;
    }
    set status(value) {
        if (typeof value !== 'number' || !DroneStatus[value]) {
            throw new TypeError(`Bad status value ${value}`);
        }
        this._status = value;
    }
    set latitude(value) {
        if (!isLatitude(value)) {
            throw new TypeError(`Bad latitude value ${value}`);
        }
        this._latitude = value;
    }
    set longitude(value) {
        if (!isLongitude(value)) {
            throw new TypeError(`Bad longitude value ${value}`);
        }
        this._longitude = value;
    }
    set batteryCharge(value) {
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
    set load(value) {
        if (value < 0) {
            throw new TypeError('Load cannot be negative!');
        }
        this._load = value;
    }
    constructor(argv, config) {
        super();
        this._connected = false;
        this._snapshotPath = path.resolve(argv.snapshotPath || config.get('snapshotPath'));
        this._passwordPath = argv.passwordPath || config.get('passwordPath');
        this._updater = new telemetry_updater_service_1.TelemetryUpdaterService(this);
    }
    async connect() {
        if (this._connected) {
            console.warn('Drone state is initialized', this);
            return;
        }
        const serializedSnapshot = await fs_1.promises.readFile(this._snapshotPath, {
            encoding: 'utf8',
        });
        const snapshot = yaml.safeLoad(serializedSnapshot, {
            filename: this._snapshotPath,
        });
        if (!isDeviceId(snapshot.deviceId)) {
            throw new TypeError(`Device ID is bad ${snapshot.deviceId}`);
        }
        this._deviceId = snapshot.deviceId;
        this._status = DroneStatus.WAITING;
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
        }
        else {
            this._latitude = this._baseLatitude;
        }
        if (snapshot.longitude !== undefined) {
            if (!isLongitude(snapshot.longitude)) {
                throw new TypeError(`Longitude is bad ${snapshot.longitude}`);
            }
            this._longitude = snapshot.longitude;
        }
        else {
            this._longitude = this._baseLongitude;
        }
        if (snapshot.batteryCharge !== undefined) {
            if (!isCharge(snapshot.batteryCharge)) {
                throw new TypeError(`Battery charge is bad ${snapshot.batteryCharge}`);
            }
            this._batteryCharge = snapshot.batteryCharge;
        }
        else {
            this._batteryCharge = 100;
        }
        if (!this._closeCallback) {
            this._closeCallback = () => this.disconnect();
            util_service_1.bindOnExitHandler(this._closeCallback);
        }
        this._connected = true;
        this._updater.start();
    }
    async disconnect() {
        if (!this._connected) {
            console.warn('Drone state is not initialized', this);
            return;
        }
        const serializedSnapshot = yaml.safeDump({
            deviceId: this._deviceId,
            baseLongitude: this._baseLongitude,
            baseLatitude: this._baseLatitude,
            enginePower: this._enginePower,
            batteryPower: this._batteryPower,
            loadCapacity: this._loadCapacity,
            canCarryLiquids: this._canCarryLiquids,
            latitude: this._latitude,
            longitude: this._longitude,
            batteryCharge: this._batteryCharge,
            load: this._load,
        });
        try {
            await fs_1.promises.writeFile(this._snapshotPath, serializedSnapshot);
        }
        catch (err) {
            console.error('Failed to write snapshot');
            console.error('\n\n', serializedSnapshot, '\n\n');
            throw err;
        }
        this._connected = false;
        this._updater.stop();
    }
    async getDeviceId() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._deviceId);
    }
    async getStatus() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._status);
    }
    async hasPassword() {
        if (!this._connected) {
            await this.connect();
        }
        try {
            await fs_1.promises.access(this._passwordPath, fs_1.constants.F_OK | fs_1.constants.W_OK | fs_1.constants.R_OK);
            return true;
        }
        catch (err) {
            console.warn('Hasn\'t password:', err);
            return false;
        }
    }
    async getPassword() {
        if (!this._connected) {
            await this.connect();
        }
        return fs_1.promises.readFile(this._passwordPath, {
            encoding: 'utf8',
        });
    }
    async setPassword(password) {
        if (!this._connected) {
            await this.connect();
        }
        await fs_1.promises.writeFile(this._passwordPath, password);
    }
    async getBaseCoords() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve([this._baseLatitude, this._baseLongitude]);
    }
    async getBaseLatitude() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._baseLatitude);
    }
    async getBaseLongitude() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._baseLongitude);
    }
    async getEnginePower() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._enginePower);
    }
    async getBatteryPower() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._batteryPower);
    }
    async getLoadCapacity() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._loadCapacity);
    }
    async canCarryLiquids() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._canCarryLiquids);
    }
    async getBatteryCharge() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._batteryCharge);
    }
    async getLongitude() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._longitude);
    }
    async getLatitude() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._latitude);
    }
    async getCoords() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve([this._latitude, this._longitude]);
    }
    async getLoad() {
        if (!this._connected) {
            await this.connect();
        }
        return Promise.resolve(this._load);
    }
}
exports.InMemoryDroneState = InMemoryDroneState;
function isCharge(value, skipNegative = false) {
    return typeof value === 'number' && ((skipNegative || value >= 0) && value <= 100);
}
function isLongitude(value) {
    return typeof value === 'number' && (value >= -180 && value <= 180);
}
function isLatitude(value) {
    return typeof value === 'number' && (value >= -90 && value <= 90);
}
function isPositive(value) {
    return typeof value === 'number' && value > 0;
}
const deviceIdRegex = /^[\da-fA-F]{12}/;
function isDeviceId(value) {
    return typeof value === 'string' && deviceIdRegex.test(value);
}
//# sourceMappingURL=drone-state.service.js.map