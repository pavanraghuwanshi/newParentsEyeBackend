import mongoose from 'mongoose';
import  {dbConnections}  from "../Database/db.js"; 

const branchSchema = new mongoose.Schema({
  branchGroupName: {
    type: String,
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  AssignedBranch:[{
     type:mongoose.Schema.Types.ObjectId,
     ref:'Branch'
  }],
 phoneNo:{
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


export default dbConnections.db2.model('BranchGroup', branchSchema);
