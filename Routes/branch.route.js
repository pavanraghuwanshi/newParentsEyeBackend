import express from 'express';
import { addBranch, getBranches, updateBranch,deleteBranch } from '../Controllers/Branch.Controller.js';
import authenticateUser from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/branch',authenticateUser,addBranch);
router.get('/branch',authenticateUser,getBranches);
router.put('/branch/:id',authenticateUser,updateBranch);
router.delete('/branch/:id',authenticateUser,deleteBranch);

export default router;