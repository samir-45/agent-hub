import { Router, type IRouter } from "express";
import healthRouter from "./health";
import modelsRouter from "./models";
import conversationsRouter from "./conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modelsRouter);
router.use(conversationsRouter);

export default router;
