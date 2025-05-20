import mongoose from 'mongoose';
import  {dbConnections}  from "../Database/db.js"; 

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  uniqueId: {
    type: String,
    required: true,
    unique: true
  },
  sim: {
    type: String,
    default: ""
  },
  speed: {
    type: String,
    default: ""
  },
  average: {
    type: String,
    default: ""
  },
  Driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null,
    set: v => v === "" ? null : v,
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: ""
  }],
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: ""

  }],
  geofences: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Geofence',
    default: ""
  }],
  model: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    default: ""
  },
  installationdate: {
    type: String,
    default: ""
  },
  subStart: {
    type: String,
    default: ""
  },
  expirationdate: {
    type: String,
    default: ""
  },
  extenddate: {
    type: String,
    default: null
  },
  inactiveDate: {
    type: String,
    default: null
  },
  modifiedDate: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    require: true
  },
  deviceId: {
    type: String,
    // required: true, 
    // unique: true
  },
  positionId: {
    type: String,
    // required: true, 
  },
  status: {
    type: String,
    // required: true, 
  },
  lastUpdate: {
    type: String,
    // required: true, 
  },
  TD: {
    type: Number,
    default: 0 
  },
  TDTime: {
    type: Date,
    default: Date.now() 
  },

}, {
  timestamps: true
}
);

const Device = dbConnections.db2.model('Device', deviceSchema);
export { Device };
