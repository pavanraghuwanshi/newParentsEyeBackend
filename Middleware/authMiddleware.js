import jwt from 'jsonwebtoken';
import  Superadmin  from '../Models/superAdmin.js';
import  {School}  from '../Models/school.js';
import Branch from '../Models/branch.js';
import mongoose from 'mongoose';

const authenticateUser = async (req, res, next) => {
    try {
        const authorization = req.headers['authorization'];

        if (!authorization) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }
        const token = authorization.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded || !decoded.id) {
            return res.status(400).json({ message: 'Invalid token. pavan' });
        }

        // Check in Superadmin collection
        const ObjectId = mongoose.Types.ObjectId;
        let user = await Superadmin.findById(new ObjectId(decoded.id));
        if (user) {
            req.user = user;
            req.userType = 'Superadmin';
            return next();
        }

        // Check in School collection
        user = await School.findById(decoded.id);
        if (user) {
            req.user = user;
            req.userType = 'School';
            return next();
        }

        // Check in Branch collection
        user = await Branch.findById(decoded.id);
        if (user) {
            req.user = user;
            req.userType = 'Branch';
            return next();
        }

        // If user not found in any collection
        return res.status(404).json({ message: 'User not found.' });

    } catch (error) {
        // console.error(error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ message: 'Invalid token pavan.' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired.' });
        }
        return res.status(500).json({ message: 'Server error pavan.' });
    }
};

export default authenticateUser;
