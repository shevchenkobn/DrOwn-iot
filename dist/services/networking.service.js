"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const SocketIO = require("socket.io-client");
const axios_1 = require("axios");
const util_service_1 = require("./util.service");
class NetworkingService {
    constructor(argv, config, state) {
        const urlString = config.has('serverUrl')
            ? config.get('serverUrl')
            : argv.url;
        // Validate url
        url.parse(urlString);
        this._url = urlString;
        if (this._url[this._url.length - 1] === '/') {
            throw new Error('URL mustn\'t finished with a slash');
        }
        this._drone = state;
        this._disconnecting = false;
    }
    async getSocket() {
        if (this._io) {
            if (!this._io.connected) {
                this._io.connect();
            }
            return this._io;
        }
        this._io = SocketIO(this._url + NetworkingService.SOCKETIO_NSP, {
            path: NetworkingService.SOCKETIO_PATH,
            timeout: 10000,
            query: {
                password: await this.getOrUpdatePassword(),
            },
        });
        this._io.on('connect', () => {
            console.debug('connect one');
        });
        this._io.on('connect', () => {
            console.debug('connect two');
            if (!this._onClose) {
                this._onClose = () => {
                    this._disconnecting = true;
                    if (this._io) {
                        this._io.disconnect();
                    }
                };
                util_service_1.bindCallbackOnExit(this._onClose);
            }
        });
        this._io.on('reconnect_error', (reason) => {
            if (!this._disconnecting) {
                console.log(`Disconnected due to ${reason}. Reconnecting...`);
                this.reconnect();
            }
        });
        return this._io;
    }
    reconnect() {
        this.getSocket().catch(err => {
            console.error('Error while reconnecting', err);
            if (!this._disconnecting) {
                this.reconnect();
            }
        });
    }
    async getOrUpdatePassword() {
        let password;
        if (await this._drone.hasPassword()) {
            password = await this._drone.getPassword();
        }
        else {
            const response = await axios_1.default.post(this._url + NetworkingService.PASSWORD_PATH, null, {
                params: {
                    'device-id': await this._drone.getDeviceId(),
                },
            });
            password = response.data;
            await this._drone.setPassword(password);
        }
        return password;
    }
}
NetworkingService.PASSWORD_PATH = '/api/v1/drones/authorize';
NetworkingService.SOCKETIO_PATH = '/socket.io';
NetworkingService.SOCKETIO_NSP = '/drones';
exports.NetworkingService = NetworkingService;
//# sourceMappingURL=networking.service.js.map