import type { Request, Response } from 'express';
import type { CommandResult, Status } from '../lib/serverContoller.js';

import EventEmitter from 'node:events';
import { Router } from 'express';

import { formatDate } from '../lib/date.js';
import controller from '../lib/serverContoller.js';

const router = Router();
const commandStartEmitter = new EventEmitter();

router.post('/start', async (req: Request, res: Response) => {
  const result: CommandResult = await controller.start();

  switch (result) {
    case 'success':
      res.sendStatus(202);
      console.log(
        `${formatDate(new Date(Date.now()))}: Successfully started server`
      );
      break;
    case 'ignored':
      res.sendStatus(409);
      break;
    default: // like -1
      res.status(500).json({
        error: result.error,
      });
  }
});

router.get('/start/status', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  req.on('close', () => res.end());
  commandStartEmitter.on('cancel', () => {
    res.write('data: cancelled\n\n');
    res.end();
  });

  let status: Status = 'starting';
  res.write(`data: starting\n\n`);

  // Start checking and sending only after minutes have passed
  const delay = 1000 * 60 * 3;
  await new Promise((resolve) => setTimeout(resolve, delay));

  while (status !== 'healthy') {
    status = await controller.checkStatus();
  }

  res.write(`data: ${status}\n\n`);
  res.end();
});

router.post('/stop', async (req: Request, res: Response) => {
  const result: CommandResult = await controller.stop();

  switch (result) {
    case 'success':
      res.sendStatus(204);
      commandStartEmitter.emit('cancel');
      console.log(
        `${formatDate(new Date(Date.now()))}: Successfully stopped server`
      );
      break;
    case 'ignored':
      res.sendStatus(409);
      break;
    default: // like -1
      res.status(500).json({
        error: result.error,
      });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  const status: Status = await controller.checkStatus();
  res.status(200).send(status);
});

router.get('/presence', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  req.on('close', () => {
    res.end();
  });

  // Initial assumes that server is inactive and has 0 players
  let currentStatus: Status = 'inactive';
  let currentPlayerCount: number = 0;
  res.write(`data: ${currentStatus}\n\n`);

  const _updateInterval = 10000; // 10 seconds
  while (true) {
    const newStatus: Status = await controller.checkStatus();

    if (newStatus === 'healthy') {
      const _players: string[] | CommandResult = await controller.getPlayers();

      const newPlayerCount = Array.isArray(_players) ? _players.length : 0;

      if (
        currentStatus !== newStatus ||
        currentPlayerCount !== newPlayerCount
      ) {
        currentStatus = newStatus;
        currentPlayerCount = newPlayerCount;
        res.write(`data: ${currentStatus} ${currentPlayerCount}\n\n`);
      }
    } else {
      if (currentStatus !== newStatus) {
        currentStatus = newStatus;
        res.write(`data: ${currentStatus}\n\n`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, _updateInterval));
  }
});

router.get('/players', async (req: Request, res: Response) => {
  const result: string[] | CommandResult = await controller.getPlayers();

  // FIX: (low) Add custom type soon (e.g. PlayerCommandResult)
  // - works for now
  if (result === 'success') {
    throw new Error("This string type literal isn't supported");
  }

  if (result === 'ignored') {
    return res.sendStatus(409);
  } else if (Array.isArray(result)) {
    return res.status(200).json(result);
  } else {
    res.status(500).json({
      error: result.error,
    });
  }
});

export default router;
