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
  }
});

// superAdminSchema.pre('save', async function(next) {
//   if (this.isModified('password')) {
//     this.password = encrypt(this.password);
//   }
//   next();
// });
// superAdminSchema.methods.comparePassword = function(candidatePassword) {
//   const decryptedPassword = decrypt(this.password);
//   return candidatePassword === decryptedPassword;
// };


export default dbConnections.db1.model('superAdmin', superAdminSchema);
