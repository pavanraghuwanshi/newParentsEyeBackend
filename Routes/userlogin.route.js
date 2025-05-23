import express from 'express';
import { addAdmin, loginUser } from '../Controllers/User.Controller.js';

const router = express.Router();


router.post("/login",loginUser);
router.post("/superadmin",addAdmin);

export default router;