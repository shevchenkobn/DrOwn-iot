"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_service_1 = require("./util.service");
class TelemetryReporterService {
    constructor(network, drone, argv, config) {
        this._period = argv.reportPeriod || config.get('reportPeriod');
        this._network = network;
        this._drone = drone;
    }
    async start() {
        if (this._interval) {
            return;
        }
        this._socket = await this._network.getSocket();
        this._onConnect = (emitter) => {
            if (this._interval && this._onExit) {
                this._onExit();
            }
            this._interval = setInterval(async () => {
                try {
                    const [longitude, latitude, batteryCharge] = await Promise.all([
                        this._drone.getLongitude(),
                        this._drone.getLatitude(),
                        this._drone.getBatteryCharge(),
                    ]);
                    emitter.emit('telemetry', {
                        longitude,
                        latitude,
                        batteryCharge,
                    });
                }
                catch (err) {
                    console.error('Telemetry report error', err);
                }
            }, this._period);
            if (!this._onExit) {
                this._onExit = () => {
                    if (this._interval) {
                        this.stop();
                    }
                };
                util_service_1.bindCallbackOnExit(this._onExit);
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
        this._socket.removeEventListener('connect', this._onConnect);
        this._onConnect = undefined;
        clearInterval(this._interval);
        this._interval = undefined;
        this._socket.removeEventListener('reconnect_failed', this._onReconnectFailed);
        this._onReconnectFailed = undefined;
        this._drone.removeListener('disconnecting', this._onExit);
    }
}
exports.TelemetryReporterService = TelemetryReporterService;
//# sourceMappingURL=telemetry-reporter.service.js.map