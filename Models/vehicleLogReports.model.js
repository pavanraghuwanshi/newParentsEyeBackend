import mongoose from "mongoose";

const vehicleChangeSchema = new mongoose.Schema({
  name: {
    type: String,
    default: null
  },
  deviceId: {
    type: Number,
    default: null
  },
  oldSimno: {
    type: String,
    default: null
  },
  newSimno: {
    type: String,
    default: null
  },
  oldImei: {
    type: String,
    default: null
  },
  newImei: {
    type: String,
    default: null
  },
  previousSubscriptionStartDate: {
    type: Date,
    default: null
  },
  previousSubscriptionDueDate: {
    type: Date,
    default: null
  },
  newSubscriptionStartDate: {
    type: Date,
    default: null
  },
  newSubscriptionDueDate: {
    type: Date,
    default: null
  },
  newTimezone: {
    type: String,
    default: null
  },
  oldTimezone: {
    type: String,
    default: null
  },
  ignNotConnectedChange: {
    type: Boolean,
    default: null
  },
  ignWirePositive: {
    type: Boolean,
    default: null
  },
  inactiveDate: {
    type: Date,
    default: null
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  message: {
    type: String,
    default: null
  },
  added: {
    type: Date,
    default: null
  },
  activeDate: {
    type: Date,
    default: null
  },
  autoRenewal: {
    type: Boolean,
    default: null
  },
  oldName: {
    type: String,
    default: null
  },
  newName: {
    type: String,
    default: null
  }
},
{
  timestamps:true
});

const VehicleChange = mongoose.model('VehicleChange', vehicleChangeSchema);

export  { VehicleChange };
