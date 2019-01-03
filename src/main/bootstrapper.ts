import { loadConfig } from '../services/config-loader.service';
import { IArgv } from '../services/arg-parser.service';
import { Arguments } from 'yargs';
import { InMemoryDroneState } from '../services/drone-state.service';
import { NetworkingService } from '../services/networking.service';
import { TelemetryReporterService } from '../services/telemetry-reporter.service';

export async function bootstrap(argv: Arguments<IArgv>) {
  const config = await loadConfig(argv);

  const initPromises = [];

  const drone = new InMemoryDroneState(argv, config);
  initPromises.push(drone.connect());

  const networkService = new NetworkingService(argv, config, drone);
  initPromises.push(networkService.getEmitter());

  const reporter = new TelemetryReporterService(
    networkService,
    drone,
    argv,
    config,
  );
  initPromises.push(reporter.start());

  const results = await Promise.all(initPromises as Promise<any>[]);
}
