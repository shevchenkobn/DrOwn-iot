#!/usr/bin/node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const argv = yargs
    .usage('Run it to emulate delivery drone')
    .version().alias('v', 'version')
    .help('help').alias('h', 'help')
    .option('url', {
    alias: 'u',
    string: true,
    demandOption: true,
    description: 'Path to url of the server',
})
    .argv;
//# sourceMappingURL=index.js.map