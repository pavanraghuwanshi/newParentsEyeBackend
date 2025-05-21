import express from 'express';

import { addSchool } from '../Controllers/School.Controller.js';


const router = express.Router();



router.post('/school', addSchool);




export default router;