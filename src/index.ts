#!/usr/bin/node
import * as yargs from 'yargs';

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
