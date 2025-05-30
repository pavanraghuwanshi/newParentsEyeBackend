import express from 'express';
import authenticateUser from '../Middleware/authMiddleware.js';
import { addChild, deleteChild, getChilds, updateChild } from '../Controllers/Child.Controller.js';

const router = express.Router();

router.post('/child',authenticateUser,addChild);
router.get('/child',authenticateUser,getChilds);
router.put('/child/:id',authenticateUser,updateChild);
router.delete('/child/:ids',authenticateUser,deleteChild);

export default router;