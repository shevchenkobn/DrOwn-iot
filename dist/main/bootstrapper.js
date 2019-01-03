"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_loader_service_1 = require("../services/config-loader.service");
async function bootstrap(argv) {
    const config = await config_loader_service_1.loadConfig(argv);
    console.log(config);
}
exports.bootstrap = bootstrap;
//# sourceMappingURL=bootstrapper.js.map