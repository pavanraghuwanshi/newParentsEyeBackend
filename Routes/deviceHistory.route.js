import express from "express";
import { deviceHistoryByTime, deviceStopage, deviceTripsWithRoute, historyPlayback, liveData, showOnlyDeviceTripStartingPointAndEndingPoint, todayDistance } from "../Controllers/DeviceHistory.controller.js";

const router = express.Router();

router.get("/device-history-by-time", deviceHistoryByTime);
router.get("/device-history-playback", historyPlayback);
router.get("/device-trips-with-route", deviceTripsWithRoute);
router.get("/show-only-device-trips-startingpoint-endingpoint", showOnlyDeviceTripStartingPointAndEndingPoint);
router.get("/device-stopage", deviceStopage);
router.post("/live-data", liveData);
router.get('/todayDistance', todayDistance);


export default router;