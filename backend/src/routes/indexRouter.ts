import type { Request, Response } from 'express';
import type { CommandResult, Status } from '../lib/serverContoller.js';

import { Router } from 'express';

import { formatDate } from '../lib/date.js';
import controller from '../lib/serverContoller.js';

const router = Router();

router.post('/start', async (req: Request, res: Response) => {
  const result: CommandResult = await controller.start();

  switch (result) {
    case 'success':
      res.sendStatus(204);
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

router.post('/stop', async (req: Request, res: Response) => {
  const result: CommandResult = await controller.stop();

  switch (result) {
    case 'success':
      res.sendStatus(204);
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

  // Initial assumes that server is initially inactive
  let status: Status = 'inactive';
  res.write(`data: ${status}\n\n`);

  req.on('close', () => {
    res.end();
  });

  const _updateInterval = 10000; // 10 seconds
  while (true) {
    const newStatus: Status = await controller.checkStatus();

    if (newStatus !== status) {
      status = newStatus;
      res.write(`data: ${status}\n\n`);
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
