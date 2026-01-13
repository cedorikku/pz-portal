import child_process from 'node:child_process';
import { promisify } from 'node:util';

import { loadComposeFile } from './files.js';
const execPromise = promisify(child_process.exec);

const COMPOSE_FILE = loadComposeFile();
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'server-1';

export type Status = 'failed' | 'healthy' | 'inactive' | 'starting';

export async function checkStatus(): Promise<Status> {
  const command = `docker container inspect --format '{{json .State.Health}}' ${CONTAINER_NAME}`;

  // The name of the container is tightly coupled with its definition in compose
  try {
    const { stdout } = await execPromise(command);

    const healthJson = JSON.parse(stdout);
    const status = healthJson['Status'];

    // Either:
    // - 'starting'
    // - 'healthy'
    return status;
  } catch (err) {
    // inactive'
    if (err && /no such container/i.test(err.toString())) {
      return 'inactive';
    }

    // error
    console.error(err);
    return 'failed';
  }
}

export async function start(): Promise<number> {
  const status: Status = await checkStatus();

  // Server already running
  if (status === 'starting' || status === 'healthy') return 1;

  try {
    await execPromise(`docker compose -f ${COMPOSE_FILE} up -d`);
    return 0;
  } catch (err) {
    console.error(`Error running docker: ${err}`);
    return -1;
  }
}

export async function stop(): Promise<number> {
  const status: Status = await checkStatus();

  // Server isn't running
  if (status === 'inactive') return 1;

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
  start,
  stop,
};
