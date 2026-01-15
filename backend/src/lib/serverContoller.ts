import child_process from 'node:child_process';
import { promisify } from 'node:util';

import { loadComposeFile } from './files.js';
const execPromise = promisify(child_process.exec);

const COMPOSE_FILE = loadComposeFile();
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'server-1';
const RCON_PASSWORD = process.env.RCON_PASSWORD;

export type CommandResult = 'success' | 'ignored' | { error: string | object };
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

export async function start(): Promise<CommandResult> {
  const status: Status = await checkStatus();

  // Server already running
  if (status === 'starting' || status === 'healthy') return 'ignored';

  try {
    await execPromise(`docker compose -f ${COMPOSE_FILE} up -d`);
    return 'success';
  } catch (err) {
    console.error(`Error running docker container: ${err}`);
    return { error: err! };
  }
}

export async function stop(): Promise<CommandResult> {
  const status: Status = await checkStatus();

  // Server isn't running
  if (status === 'inactive') return 'ignored';

  try {
    await execPromise(`docker compose -f ${COMPOSE_FILE} down`);
    return 'success';
  } catch (err) {
    console.error(`Error stopping docker container: ${err}`);
    return { error: err! };
  }
}

/*
 * Output format when running players command in rcon
 *
 * Example 1 (No players connected):
 * > Players Connected (0):
 *
 * Example 2 (Players connected):
 * > Players Connected (2):
 * > - Player 1
 * > - Player 2
 */
export async function getPlayers(): Promise<string[] | CommandResult> {
  const status: Status = await checkStatus();

  // Server isn't running
  if (status === 'inactive') return 'ignored';

  // Port is defaulteded to 27015
  const players: string[] = [];
  try {
    if (!RCON_PASSWORD) {
      throw new Error('RCON_PASSWORD is not set');
    }

    const { stdout: rawString } = await execPromise(
      `docker exec ${CONTAINER_NAME} rcon-cli -a 127.0.0.1:27015 -p ${RCON_PASSWORD} players`
    );

    const lines = rawString.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const name = lines[i].substring(1, lines[i].length);
      if (!name.trim()) continue;
      players.push(name);
    }

    return players;
  } catch (err) {
    if (err && /connection refused/i.test(err.toString())) {
      return 'ignored';
    }

    console.error(err);
    return { error: err! };
  }
}

export default {
  checkStatus,
  getPlayers,
  start,
  stop,
};
