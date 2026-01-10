import child_process from 'node:child_process';
import { promisify } from 'node:util';

import { loadComposeFile } from './files.js';
const execPromise = promisify(child_process.exec);

const COMPOSE_FILE = loadComposeFile();
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'server-1';

export async function checkStatus(): Promise<boolean> {
  try {
    // The name of the container is tightly coupled with its definition in compose
    await execPromise(`docker ps | grep ${CONTAINER_NAME}`);
    return true;
  } catch {
    return false;
  }
}

export async function run(): Promise<number> {
  const isActive = await checkStatus();

  // Server already running
  if (isActive) return 1;

  try {
    await execPromise(`docker compose -f ${COMPOSE_FILE} up -d`);
    return 0;
  } catch (err) {
    console.error(`Error running docker: ${err}`);
    return -1;
  }
}

export async function stop(): Promise<number> {
  const isActive = await checkStatus();

  // Server isn't running
  if (!isActive) return 1;

  try {
    await execPromise(`docker compose -f ${COMPOSE_FILE} down`);
    return 0;
  } catch (err) {
    console.error(`Error stopping docker: ${err}`);
    return -1;
  }
}

export default {
  checkStatus,
  run,
  stop,
};
