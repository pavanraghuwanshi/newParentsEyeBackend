// // Import necessary modules
// import mongoose from "mongoose";

// // Define an asynchronous function to establish a database connection
// const DBconnection = async () => {
//     try {
//         // Attempt to connect to MongoDB using the URI from environment variables
//         await mongoose.connect(process.env.MONGODB_URL);
//         console.log("Connected to MongoDB successfully");
//     } catch (error) {
//         // If connection fails, log the error and exit the process
//         console.error("Error connecting to MongoDB:", error.message);
//         process.exit(1);  // Exit with a failure code
//     }
// }

// // Export the DBconnection function as the default export
// export default DBconnection;import mongoose from 'mongoose';

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const dbConnections = {
  db1: null,
  db2: null,
};

const connectDB = async () => {
  try {
    if (!dbConnections.db1) {
      dbConnections.db1 = mongoose.createConnection(process.env.MONGO_URI_1);
      dbConnections.db1.on('connected', () => console.log('Connected to Database 1'));
      dbConnections.db1.on('error', (err) => console.error('Database 1 connection error:', err));
    }

    if (!dbConnections.db2) {
      dbConnections.db2 = mongoose.createConnection(process.env.MONGO_URI_2);
      dbConnections.db2.on('connected', () => console.log('Connected to Database 2'));
      dbConnections.db2.on('error', (err) => console.error('Database 2 connection error:', err));
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Immediately connect to databases
connectDB().then(() => {
  console.log('All databases connected successfully.');
}).catch((err) => {
  console.error('Error connecting databases:', err);
});

// ✅ Export the already connected databases
export { dbConnections };
