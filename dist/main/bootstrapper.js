"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_loader_service_1 = require("../services/config-loader.service");
const drone_state_service_1 = require("../services/drone-state.service");
const networking_service_1 = require("../services/networking.service");
const telemetry_reporter_service_1 = require("../services/telemetry-reporter.service");
const queue_manager_1 = require("./queue-manager");
async function bootstrap(argv) {
    const config = await config_loader_service_1.loadConfig(argv);
    const initPromises = [];
    const drone = new drone_state_service_1.InMemoryDroneState(argv, config);
    initPromises.push(drone.connect());
    const networkService = new networking_service_1.NetworkingService(argv, config, drone);
    initPromises.push(networkService.getSocket());
    const reporter = new telemetry_reporter_service_1.TelemetryReporterService(networkService, drone, argv, config);
    initPromises.push(reporter.start());
    const results = await Promise.all(initPromises);
    const queueManager = new queue_manager_1.QueueManager(networkService, drone);
    await queueManager.start();
}
exports.bootstrap = bootstrap;
//# sourceMappingURL=bootstrapper.js.map