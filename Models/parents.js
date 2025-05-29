import mongoose from 'mongoose';
// const { encrypt, decrypt } = require('./cryptoUtils'); 
import  {dbConnections}  from "../Database/db.js"; 
import branch from './branch.js';

// Define the schema for the School model
const ParentSchema = new mongoose.Schema({
  parentName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true 
  },
  password: {
    type: String,
    required: true
  },
  email:{
    type: String,
    required: true
  },
  schoolMobile:{
    type: String
  },
  fullAccess: {
    type:Boolean,
    default:false
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }]
});



export default dbConnections.db2.model('Parent', ParentSchema);
