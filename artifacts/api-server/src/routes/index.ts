import { Router, type IRouter } from "express";
import healthRouter from "./health";
import travelPlacesRouter from "./travelPlaces";

const router: IRouter = Router();

router.use(healthRouter);
router.use(travelPlacesRouter);

export default router;
