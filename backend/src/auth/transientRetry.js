const transientCodes = new Set(['P1001','P1017','P2024','ECONNRESET','ECONNREFUSED','ETIMEDOUT']);
export const isTransientConnectionError = error => transientCodes.has(error?.code);
export async function retryRead(operation, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  try { return await operation(); } catch (error) {
    if (!isTransientConnectionError(error)) throw error;
    await sleep(1500);
    return operation();
  }
}
export async function transactionBeforeStart(prisma, callback, options, sleep) {
  let started = false;
  const run = () => prisma.$transaction(async tx => { started = true; return callback(tx); }, options);
  try { return await run(); } catch (error) {
    if (started || !isTransientConnectionError(error)) throw error;
    await (sleep || (ms => new Promise(resolve => setTimeout(resolve, ms))))(1500);
    return run();
  }
}
