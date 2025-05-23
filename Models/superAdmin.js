import mongoose from 'mongoose';
import  {dbConnections}  from "../Database/db.js"; 

// const { encrypt, decrypt } = require('./cryptoUtils');
const superAdminSchema = new mongoose.Schema({
  username: { type: String, required: true,lowercase: true ,unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
  },
  role: {
    type: String,
    default: 'superAdmin',
  },
});



export default dbConnections.db2.model('superAdmin', superAdminSchema);
