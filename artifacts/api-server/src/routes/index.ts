import { Router, type IRouter } from "express";
import healthRouter from "./health";
import modelsRouter from "./models";
import conversationsRouter from "./conversations";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modelsRouter);
router.use(conversationsRouter);
router.use(settingsRouter);

export default router;
