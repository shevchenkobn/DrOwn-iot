import * as config from 'config';
import { IArgv } from './arg-parser.service';
import { Arguments } from 'yargs';

export interface IConfigGetter {
  get<T>(path: string): T;
  has<T>(path: string): T;
}

export async function loadConfig(argv: Arguments<IArgv>) {
  return config as IConfigGetter;
}
