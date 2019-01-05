"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlers = [];
const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
function bindOnExitHandler(handler) {
    if (handlers.length === 0) {
        const cb = (...args) => {
            execHandlers(args);
            process.removeListener('beforeExit', cb);
        };
        process.once('beforeExit', cb);
        for (const signal of signals) {
            const cb = (...args) => {
                execHandlers(args);
                removeHandlers(cb);
                setTimeout(() => process.exit(0), 1000);
            };
            process.once(signal, cb);
        }
    }
    handlers.push(handler);
}
exports.bindOnExitHandler = bindOnExitHandler;
function execHandlers(args) {
    for (const handler of handlers) {
        handler(...args);
    }
}
function removeHandlers(handler) {
    for (const signal of signals) {
        process.removeListener(signal, handler);
    }
}
function hasOnExitHandler(handler) {
    return handlers.indexOf(handler) !== -1;
}
exports.hasOnExitHandler = hasOnExitHandler;
function unbindOnExitHandler(callback) {
    const i = handlers.indexOf(callback);
    if (i === -1) {
        return false;
    }
    handlers.splice(i, 1);
    return true;
}
exports.unbindOnExitHandler = unbindOnExitHandler;
function sleep(ms) {
    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            resolve();
            clearTimeout(timeout);
        }, ms);
    });
}
exports.sleep = sleep;
//# sourceMappingURL=util.service.js.map