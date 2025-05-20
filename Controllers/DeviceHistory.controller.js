import axios from "axios";
import { History } from "../Models/history.model.js";
import { Device } from "../Models/device.model.js";
import { configDotenv } from "dotenv";
configDotenv();


export const deviceHistoryByTime = async (req, res) => {
  const { deviceId, from, to } = req.query;

  const formattedFromDateStr = from.replace(" ", "+");
  const formattedToDateStr = to.replace(" ", "+");

  if (!deviceId || !from || !to) {
    return res.status(400).json({
      message: "All fields are required",
    });
  }
  try {
    const cursor = History.find({
      deviceId,
      createdAt: {
        $gte: formattedFromDateStr, // From date (greater than or equal)
        $lte: formattedToDateStr, // To date (less than or equal)
      },
    }).lean().cursor();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
    });
    res.write('{"message":"See your device history.","success":true,"deviceHistory":[');

    let isFirstDocument = true;
    for await (const doc of cursor) {
      if (!isFirstDocument) {
        res.write(","); // Add a comma between documents
      } else {
        isFirstDocument = false;
      }
      res.write(JSON.stringify(doc));
    }

    res.write("]}");
    res.end();
  } catch (error) {
    res.status(500).json({
      message: "Error",
      error: error.message,
    });
  }
};

export const historyPlayback = async (req, res) => {
  const { deviceId, from, to } = req.query;
  
  if (!deviceId || !from || !to) {
    return res.status(400).json({
      message: "All fields are required: deviceId, from, to",
      success: false,
    });
  }
  
  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        message: "Invalid date format. Use ISO 8601 format (e.g., '2024-09-24T00:41:17.000Z').",
        success: false,
      });
    }

    const cursor = History.find({
      deviceId,
      createdAt: { $gte: fromDate, $lte: toDate },
      speed: { $gt: 2 },
      "attributes.ignition": true,
    })
    .select('-_id attributes.ignition attributes.distance attributes.totalDistance deviceId latitude longitude speed course createdAt')
      .lean()
      .batchSize(5000)
      .cursor();

    // Set response headers for streaming
    res.setHeader("Content-Type", "application/json");
    res.write('{"message": "See Your Device History Playback Data", "success": true, "deviceHistory": [');

    let isFirstDocument = true;

    // Stream documents to the client
    for await (const doc of cursor) {
      if (!isFirstDocument) {
        res.write(","); // Add a comma between documents
      } else {
        isFirstDocument = false;
      }
      res.write(JSON.stringify(doc));
    }

    // End the response
    res.write("]}");
    res.end();
  } catch (error) {
    console.error("Error fetching playback data:", error);
    res.status(500).json({
      message: "An error occurred while fetching playback data.",
      error: error.message,
      success: false,
    });
  }
};

export const deviceTripsWithRoute = async (req, res) => {
  const { deviceId, from, to } = req.query;

  const formattedFromDateStr = from.replace(" ", "+");
  const formattedToDateStr = to.replace(" ", "+");

  if (!deviceId || !from || !to) {
    return res.status(400).json({
      message: "Missing required query parameters: deviceId, from, to",
      success: false,
    });
  }

  try {
    const cursor = History.find({
      deviceId,
      createdAt: { $gte: formattedFromDateStr, $lte: formattedToDateStr },
    })
      .lean()
      .cursor();

    let currentTrip = [];

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
    });

    res.write('{"message":"Device trips retrieved successfully.","success":true,"deviceDataByTrips":[');

    let firstChunk = true;

    for await (const doc of cursor) {
      if (doc.attributes.ignition === false) {
        if (currentTrip.length > 0) {
          if (!firstChunk) res.write(',');
          res.write(JSON.stringify(currentTrip));
          currentTrip = [];
          firstChunk = false;
        }
      } else if (doc.attributes.ignition === true) {
        currentTrip.push(doc);
      }
    }

    if (currentTrip.length > 0) {
      if (!firstChunk) res.write(',');
      res.write(JSON.stringify(currentTrip));
    }

    res.write(']}');
    res.end();
  } catch (error) {
    console.error("Error fetching device trips:", error);
    res.status(500).json({
      message: "An error occurred while fetching device trips.",
      error: error.message,
    });
  }
};

export const showOnlyDeviceTripStartingPointAndEndingPoint = async (req, res) => {
  const { deviceId, from, to } = req.query;
  const formattedFromDateStr = new Date(from.replace(" ", "+")).toISOString(); 
  const formattedToDateStr = new Date(to.replace(" ", "+")).toISOString();

  try {
    // Fetch data using lean() for better performance
    const deviceDataByDateRange = History.find({
      deviceId,
      createdAt: { $gte: formattedFromDateStr, $lte: formattedToDateStr },
    }).select('-_id deviceId createdAt latitude longitude attributes.distance attributes.totalDistance speed attributes.ignition ').lean().cursor();

    const vehicleNumber = await Device.findOne({ deviceId }).select('name TD -_id').lean(); // Use lean() here as well

    const deviceDataByTrips = [];
    let ignitionOnValue = [];

    // Collect data into trips based on ignition status
    for await (const record of deviceDataByDateRange) {
      if (record.attributes.ignition) {
        ignitionOnValue.push({
          deviceId: record.deviceId,
          createdAt: record.createdAt,
          latitude: record.latitude,
          longitude: record.longitude,
          distance: record.attributes.distance,
          totalDistance: record.attributes.totalDistance,
          speed: record.speed,
        });
      } else if (ignitionOnValue.length > 0) {
        deviceDataByTrips.push([...ignitionOnValue]);
        ignitionOnValue = [];
      }
    }

    if (ignitionOnValue.length > 0) {
      deviceDataByTrips.push([...ignitionOnValue]);
    }

    if (!deviceDataByTrips.length) {
      return res.status(404).json({
        message: "No Trip Found",
        success: false,
      });
    }

    const finalTrip = deviceDataByTrips.map((trip) => {
      const speeds = trip.map((element) => element.speed);
      const maxSpeed = Math.max(...speeds);
      const avgSpeed = speeds.reduce((acc, curr) => acc + curr, 0) / speeds.length;

      const startTime = trip[0].createdAt;
      const endTime = trip.length > 1 ? trip[trip.length - 1].createdAt : "Running";
      const start = new Date(startTime);
      const end = new Date(endTime);

      const totalTimeMillis = end - start;
      const totalMinutes = Math.floor(totalTimeMillis / (1000 * 60));
      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;

      const duration = `${totalHours}h ${remainingMinutes}m`;

      const coveredDistance = ((trip[trip.length - 1].totalDistance - trip[0].totalDistance)/1000).toFixed(2);
      return {
        deviceId: trip[0].deviceId,
        name: vehicleNumber.name,
        startTime: startTime,
        maxSpeed: maxSpeed,
        avgSpeed: avgSpeed,
        duration: duration,
        startLongitude: trip[0].longitude,
        startLatitude: trip[0].latitude,
        // distance: (trip.reduce((sum, obj) => sum + obj.distance, 0) / 1000).toFixed(2) + " KM",
        distance: coveredDistance + " KM",
        // totalDistance: (trip[trip.length - 1].totalDistance / 1000).toFixed(2) + " KM",
        totalDistance: vehicleNumber.TD + " KM",
        endLongitude: trip.length > 1 ? trip[trip.length - 1].longitude : "Running",
        endLatitude: trip.length > 1 ? trip[trip.length - 1].latitude : "Running",
        endTime: endTime,
      };
    });

    return res.status(200).json({
      message: "See your device trips",
      success: true,
      finalTrip,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error",
      error: error.message,
    });
  }
};

export const deviceStopage = async (req, res) => {
  const { deviceId, from, to } = req.query;

  const formattedFromDateStr = new Date(from.replace(" ", "+")).toISOString();
  const formattedToDateStr = new Date(to.replace(" ", "+")).toISOString();

  try {
    const deviceDataByDateRange = History.find(
      {
        deviceId,
        createdAt: {
          $gte: formattedFromDateStr,
          $lte: formattedToDateStr,
        },
      },
      {
        speed: 1,
        "attributes.ignition": 1,
        longitude: 1,
        latitude: 1,
        course: 1,
        deviceId: 1,
        distance: 1,
        totalDistance: 1,
        createdAt: 1,
      }
    ).lean().cursor(); // Use lean for better performance

    const finalDeviceDataByStopage = [];
    let currentStopage = null;

    for await (const record of deviceDataByDateRange) {
      const ignition = record.attributes.ignition;

      if (ignition) {
        // Finalize current stoppage if it exists
        if (currentStopage) {
          finalDeviceDataByStopage.push(currentStopage);
          currentStopage = null; // Reset for the next stoppage
        }
      } else {
        // Initialize or update current stoppage
        if (!currentStopage) {
          currentStopage = {
            speed: record.speed,
            ignition: false,
            longitude: record.longitude,
            latitude: record.latitude,
            course: record.course,
            deviceId: record.deviceId,
            distance: record.distance,
            totalDistance: record.totalDistance,
            arrivalTime: record.createdAt,
            departureTime: null,
          };
        }
        // Update departureTime to the latest stoppage time
        currentStopage.departureTime = record.createdAt;
      }
    }

    // If there's an ongoing stoppage after the loop ends, add it
    if (currentStopage) {
      finalDeviceDataByStopage.push(currentStopage);
    }

    if (!finalDeviceDataByStopage.length) {
      return res.status(404).json({
        message: "No Stopage Found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "See your device trips",
      success: true,
      finalDeviceDataByStopage,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error",
      error: error.message,
    });
  }
};

export const liveData = async (req, res) => {
  const { userr, pass } = req.body;
  console.log(userr, pass);
  let deviceListData;
  (async function () {
    try {
      const url = process.env.DEVICES_URL;
      const username = userr;
      const password = pass;

      const response = await axios.get(url, {
        auth: { username: username, password: password },
      });
      deviceListData = response.data;
      // console.log("AAAAAAAAAAAAA",deviceListData)
      // console.log('API response data:', devicelist);
    } catch (error) {
      console.error("Error fetching devices from devices API:", error);
      return res.status(401).json({
        message: "Error fetching devices from devices API:",
        error,
      });
    }
  })();

  (async function () {
    try {
      const url = process.env.POSITION_URL;
      const username = userr;
      const password = pass;

      const response = await axios.get(url, {
        auth: { username: username, password: password },
      });
      const data = response.data;
      // console.log("data from GPS device ",data)
      const deviceListDataMap = new Map(
        deviceListData.map((item) => [item.id, item])
      );

      const mergedData = data.map((obj1) => {
        const match = deviceListDataMap.get(obj1.deviceId);
        return {
          speed: obj1.speed,
          longitude: obj1.longitude,
          latitude: obj1.latitude,
          course: obj1.course,
          deviceId: obj1.deviceId,
          deviceTime: obj1.deviceTime,
          attributes: obj1.attributes,
          category: match ? match.category : null,
          status: match ? match.status : null,
          lastUpdate: match ? match.lastUpdate : null,
          name: match ? match.name : null,
          uniqueId: match ? match.uniqueId : null,
        };
      });

      // console.log("device",mergedData)
      // console.log("All device data", mergedData);
      // socket.emit("all device data", mergedData);
      console.log("all device data");
      return res.status(201).json({
        message: "Live Devices Data",
        success: true,
        data: mergedData,
      });
    } catch (error) {
      console.error(
        "There was a problem with the fetch operation:",
        error.message
      );
      return res.status(401).json({
        message: "Error fetching devices from devices API:",
        error,
      });
    }
  })();
};

export const todayDistance = async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setUTCHours(0, 0, 0, 0)); // Start of today
  const endOfDay = new Date(today.setUTCHours(23, 59, 59, 999)); // End of today

  try {
    // Aggregation query to calculate total distance for each device today
    const result = await History.aggregate([
      { 
        $match: {
          createdAt: { $gte: startOfDay, $lt: endOfDay }
        }
      },
      {
        $group: {
          _id: "$deviceId", // Group by deviceId
          totalDistance: { $sum: "$attributes.distance" } // Sum of distances for each device
        }
      }
    ]);

    // If no results, return an empty array
    if (result.length === 0) {
      return res.status(200).json({
        message: "Success",
        data: []
      });
    }

    // Format the response as an array of deviceId and totalDistance
    const data = result.map(item => ({
      deviceId: item._id,
      distance: (item.totalDistance / 1000).toFixed(2) // Convert to kilometers and format
    }));

    return res.status(200).json({
      message: "Success",
      data
    });
  } catch (error) {
    res.status(500).json({
      message: "Error",
      error: error.message,
    });
  }
};