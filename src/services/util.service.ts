const handlers: ((...args: any[]) => any)[] = [];
const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'] as NodeJS.Signals[];
export function bindOnExitHandler(handler: (...args: any[]) => any) {
  if (handlers.length === 0) {
    const cb = (...args: any[]) => {
      execHandlers(args);
      process.removeListener('beforeExit', cb);
    };
    process.once('beforeExit', cb);
    for (const signal of signals) {
      const cb = (...args: any[]) => {
        execHandlers(args);
        removeHandlers(cb);
        setTimeout(() => process.exit(0), 1000);
      };
      process.once(signal, cb);
    }
  }
  handlers.push(handler);
}

function execHandlers(args: any[]) {
  for (const handler of handlers) {
    handler(...args);
  }
}

function removeHandlers(handler: (...args: any[]) => any) {
  for (const signal of signals) {
    process.removeListener(signal, handler);
  }
}

export function hasOnExitHandler(handler: (...args: any) => any) {
  return handlers.indexOf(handler) !== -1;
}

export function unbindOnExitHandler(callback: (...args: any) => any) {
  const i = handlers.indexOf(callback);
  if (i === -1) {
    return false;
  }
  handlers.splice(i, 1);
  return true;
}

export function sleep(ms: number) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      resolve();
      clearTimeout(timeout);
    }, ms);
  });
}
