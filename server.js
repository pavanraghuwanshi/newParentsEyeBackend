import express from "express";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import { fetchGPSdata } from "./Utils/LiveDataFromOldApp/fetchGPSdata.js";
import {dbConnections} from "./Database/db.js";
import historyRoute from "./Routes/deviceHistory.route.js";
import reportRoute from "./Routes/reports.route.js";
import schoolRoute from "./Routes/school.route.js";
import userRoute from "./Routes/userlogin.route.js";
import branchRoute from "./Routes/branch.route.js";
import dotenv from 'dotenv';
dotenv.config();


const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());




app.get("/", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "This is new ParentsEye Backend Server",
        status: 200,
        statusText: "OK",
    });
});


// Use routes
app.use("/history", historyRoute)
app.use("/reports", reportRoute)
app.use("/api", schoolRoute);
app.use("/api", branchRoute);
app.use("/auth", userRoute);

// const io = setupSocket(server);



// setInterval(() => {
//     AlertFetching(io)
// }, 10000); 

setInterval(() => {
    // fetchGPSdata();
}, 10000);


// Start server and connect to database
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    try {
        console.log(`Server is listening on port ${PORT}`);
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
});
