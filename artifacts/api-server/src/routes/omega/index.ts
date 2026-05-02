// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import hostsRouter from "./hosts";
import eventsRouter from "./events";
import dashboardRouter from "./dashboard";
import chatRouter from "./chat";
import keyloggerRouter from "./keylogger";
import processesRouter from "./processes";
import screenshotsRouter from "./screenshots";
import toolsRouter from "./tools";
import systemInfoRouter from "./system-info";
import windowsRouter from "./windows";
import clipboardRouter from "./clipboard";
import messagesRouter from "./messages";
import remoteCommandsRouter from "./remote-commands";

const router: IRouter = Router();

router.use(hostsRouter);
router.use(eventsRouter);
router.use(dashboardRouter);
router.use(chatRouter);
router.use(keyloggerRouter);
router.use(processesRouter);
router.use(screenshotsRouter);
router.use(toolsRouter);
router.use(systemInfoRouter);
router.use(windowsRouter);
router.use(clipboardRouter);
router.use(messagesRouter);
router.use(remoteCommandsRouter);

export default router;
