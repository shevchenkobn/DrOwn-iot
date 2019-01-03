#!/usr/bin/node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const bootstrapper_1 = require("./main/bootstrapper");
const argv = yargs
    .usage('Run it to emulate git add delivery drone')
    .version().alias('v', 'version')
    .help('help').alias('h', 'help')
    // .option('url', {
    //   alias: 'u',
    //   string: true,
    //   demandOption: true,
    //   description: 'Path to url of the server',
    // })
    .argv;
bootstrapper_1.bootstrap(argv).catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map