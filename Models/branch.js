import mongoose from 'mongoose';
// const { encrypt, decrypt } = require('./cryptoUtils'); 
import  {dbConnections}  from "../Database/db.js"; 

const branchSchema = new mongoose.Schema({
  branchName: {
    type: String,
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
 schoolMobile:{
    type: String,
   default: ''
  },
  username:{
    type: String,
   default: ''
  },
  password:{
    type: String,
    default: ''
  },
  email:{
    type: String,
    default: ''
  },
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }]
});




export default dbConnections.db2.model('Branch', branchSchema);
