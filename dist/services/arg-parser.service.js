"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
function parseArgs(args = process.argv.slice(2)) {
    return yargs(args)
        .usage('Run it to emulate git add delivery drone')
        .version().alias('v', 'version')
        .help('help').alias('h', 'help')
        .option('url', {
        alias: 'u',
        string: true,
        demandOption: false,
        description: 'Path to url of the server',
    })
        .option('passwordPath', {
        alias: ['p', 'password'],
        string: true,
        demandOption: false,
        description: 'Path to url of the server',
    })
        .option('snapshotPath', {
        alias: ['s', 'snapshot'],
        string: true,
        demandOption: false,
        description: 'Path to snapshot file of drone state',
    })
        .option('reportPeriod', {
        alias: ['p', 'period'],
        number: true,
        demandOption: false,
        description: 'Period of telemetry report in ms',
    })
        .argv;
}
exports.parseArgs = parseArgs;
//# sourceMappingURL=arg-parser.service.js.map