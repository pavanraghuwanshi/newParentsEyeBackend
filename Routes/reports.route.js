import express from 'express';
const router = express.Router();
import { getStatusReport, getCustomReport, getSummaryReport, distanceReport, getIdleReports, vehiclelog, getGeofenceReport, dayReport, geofenceReportsByTimeRange, travelSummaryReport, tripSummaryReport, } from '../Controllers/Reports.Controller.js';
import authenticateUser from '../Middleware/authMiddleware.js';

router.get('/status', authenticateUser, getStatusReport);
router.get('/custom', authenticateUser, getCustomReport);
router.get('/summary', authenticateUser, getSummaryReport);
router.get('/travel-summary-report', authenticateUser, travelSummaryReport);
router.get('/trip-summary-report', authenticateUser, tripSummaryReport);
router.post('/distance',authenticateUser, distanceReport);
router.post('/dayreport', authenticateUser,dayReport);
router.get('/vehiclelog', authenticateUser, vehiclelog);
router.get('/geofence', authenticateUser, getGeofenceReport);
router.post('/geofence-by-time-range', authenticateUser, geofenceReportsByTimeRange);
router.get('/idleSummary', authenticateUser, getIdleReports);

export default router;