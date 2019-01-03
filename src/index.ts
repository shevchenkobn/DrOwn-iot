#!/usr/bin/node
import { bootstrap } from './main/bootstrapper';
import { parseArgs } from './services/arg-parser.service';

const argv = parseArgs();

bootstrap(argv).catch(err => {
  console.error(err);
  process.emit('SIGINT', 'SIGINT');
});
