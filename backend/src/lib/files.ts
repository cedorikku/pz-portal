import type { URL } from 'node:url';

import fs from 'node:fs';
import path from 'node:path';
type PathLike = string | URL;

export const loadComposeFile = (): PathLike => {
  if (!process.env.COMPOSE_FILE) {
    throw new Error('COMPOSE_FILE is not defined in your environment');
  }

  const composeFile = path.resolve(process.env.COMPOSE_FILE);
  try {
    const stats = fs.statSync(composeFile);
    if (!stats.isFile()) throw new Error('The compose file does not exist');
  } catch (err) {
    console.error(err);
  }

  return composeFile;
};
