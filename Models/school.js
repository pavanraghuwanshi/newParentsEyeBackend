import mongoose from 'mongoose';
// const { encrypt, decrypt } = require('./cryptoUtils'); 
import  {dbConnections}  from "../Database/db.js"; 

// Define the schema for the School model
const schoolSchema = new mongoose.Schema({
  schoolName: {
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
  role: {
    type: String,
    default: "school"
  },
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }]
});


export const School = dbConnections.db2.model("School", schoolSchema);