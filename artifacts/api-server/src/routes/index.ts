import { Router, type IRouter } from "express";
import healthRouter from "./health";
import problemsRouter from "./problems";
import judgeRouter from "./judge";
import traceRouter from "./trace";

const router: IRouter = Router();

router.use(healthRouter);
router.use(problemsRouter);
router.use(judgeRouter);
router.use(traceRouter);

export default router;
