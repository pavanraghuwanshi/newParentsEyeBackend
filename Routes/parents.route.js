import express from 'express';
import { addParent, getParents } from '../Controllers/Parents.Controller.js';
import authenticateUser from '../Middleware/authMiddleware.js';

const router = express.Router();

router.post('/parent',authenticateUser,addParent);
router.get('/parent',authenticateUser,getParents);
router.put('/parent/:id',authenticateUser,);
router.delete('/branch/:id',authenticateUser,);

export default router;