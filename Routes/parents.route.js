import express from 'express';
import { addParent, getParents, updateParent, deleteParent } from '../Controllers/Parents.Controller.js';
import authenticateUser from '../Middleware/authMiddleware.js';

const router = express.Router();

router.post('/parent',authenticateUser,addParent);
router.get('/parent',authenticateUser,getParents);
router.put('/parent/:id',authenticateUser,updateParent);
router.delete('/parent/:id',authenticateUser,deleteParent);

export default router;