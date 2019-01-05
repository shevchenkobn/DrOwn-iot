#!/usr/bin/node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrapper_1 = require("./main/bootstrapper");
const arg_parser_service_1 = require("./services/arg-parser.service");
const argv = arg_parser_service_1.parseArgs();
bootstrapper_1.bootstrap(argv).catch(err => {
    console.error(err);
    process.emit('SIGINT', 'SIGINT');
});
//# sourceMappingURL=index.js.map