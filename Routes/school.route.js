import express from 'express';

import { addSchool, getSchools, updateSchool,deleteSchool } from '../Controllers/School.Controller.js';
import authenticateUser from '../middleware/authMiddleware.js';


const router = express.Router();



router.post('/school',authenticateUser, addSchool);
router.get('/school',authenticateUser, getSchools);
router.put('/school/:id',authenticateUser, updateSchool);
router.delete('/school/:id',authenticateUser, deleteSchool);




export default router;