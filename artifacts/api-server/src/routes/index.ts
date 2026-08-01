import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import modelsRouter from "./models/index.js";
import conversationsRouter from "./conversations/index.js";
import settingsRouter from "./settings.js";
import adminRouter from "./admin.js";
import { imagesRouter } from "./images.js";
import workflowsRouter from "./workflows.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modelsRouter);
router.use(conversationsRouter);
router.use(settingsRouter);
router.use(adminRouter);
router.use(workflowsRouter);
router.use("/images", imagesRouter);

export default router;
