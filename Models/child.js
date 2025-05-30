import mongoose from 'mongoose';
import { dbConnections } from "../Database/db.js";

const childSchema = new mongoose.Schema({
  childName: {
    type: String,
    required: true
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
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true
  },
  parentMobile: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'child'
  },
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }]
});

export default dbConnections.db2.model('Child', childSchema);
