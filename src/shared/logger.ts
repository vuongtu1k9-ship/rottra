export function createLogger(namespace: string) {
  return {
    info: (...args: any[]) => console.log(`[INFO] [${namespace}]`, ...args),
    warn: (...args: any[]) => console.warn(`[WARN] [${namespace}]`, ...args),
    error: (...args: any[]) => console.error(`[ERROR] [${namespace}]`, ...args),
    debug: (...args: any[]) => console.debug(`[DEBUG] [${namespace}]`, ...args),
  };
}
