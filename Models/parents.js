import mongoose from 'mongoose';
// const { encrypt, decrypt } = require('./cryptoUtils'); 
import  {dbConnections}  from "../Database/db.js"; 

// Define the schema for the School model
const ParentSchema = new mongoose.Schema({
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
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }]
});

// schoolSchema.pre('save', async function(next) {
//   if (this.isModified('password')) {
//     this.password = encrypt(this.password);
//   }
//   next();
// });

// schoolSchema.methods.comparePassword = function(candidatePassword) {
//   const decryptedPassword = decrypt(this.password);
//   return candidatePassword === decryptedPassword;
// };


export default dbConnections.db1.model('Parent', ParentSchema);
