import type { Request, Response } from 'express';
import type { Status } from '../lib/serverContoller.js';

import { Router } from 'express';

import { formatDate } from '../lib/date.js';
import controller from '../lib/serverContoller.js';

const router = Router();

router.post('/start', async (req: Request, res: Response) => {
  const runCode: number = await controller.start();

  switch (runCode) {
    case 0:
      res.sendStatus(200);
      console.log(
        `${formatDate(new Date(Date.now()))}: Successfully started server`
      );
      break;
    case 1:
      res.sendStatus(400);
      console.log("Server's already started");
      break;
    default: // like -1
      res.sendStatus(500);
  }
});

router.post('/stop', async (req: Request, res: Response) => {
  const stopCode: number = await controller.stop();

  switch (stopCode) {
    case 0:
      res.sendStatus(200);
      console.log(
        `${formatDate(new Date(Date.now()))}: Successfully stopped server`
      );
      break;
    case 1:
      res.sendStatus(400);
      console.log("Server isn't running");
      break;
    default: // like -1
      res.sendStatus(500);
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

export default router;
