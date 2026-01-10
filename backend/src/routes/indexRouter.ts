import type { Request, Response } from 'express';

import { Router } from 'express';

import controller from '../lib/serverContoller.js';

const router = Router();

router.post('/run', async (req: Request, res: Response) => {
  const runCode: number = await controller.run();

  switch (runCode) {
    case 0:
      res.sendStatus(200);
      console.log(
        `${new Date(Date.now()).toDateString()}: Successfully started server`
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
        `${new Date(Date.now()).toDateString()}: Successfully stopped server`
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

router.get('/is-active', async (req: Request, res: Response) => {
  const isActive: boolean = await controller.checkStatus();
  res.status(200).send(isActive);
});

export default router;
