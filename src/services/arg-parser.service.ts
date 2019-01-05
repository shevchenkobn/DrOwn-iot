import * as yargs from 'yargs';
import { Arguments } from 'yargs';

export interface IArgv {
  snapshotPath: string;
  url?: string;
  passwordPath: string;
  reportPeriod: number;
}

export function parseArgs(args = process.argv.slice(2)) {
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
      alias: ['i', 'period'],
      number: true,
      demandOption: false,
      default: 2000,
      description: 'Period of telemetry report in ms',
    })
    .argv as Arguments<IArgv>;
}
