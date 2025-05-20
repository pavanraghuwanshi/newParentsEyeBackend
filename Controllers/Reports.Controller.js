import { Device } from "../Models/device.model.js";
import { History } from "../Models/history.model.js";
import moment from "moment";
import { VehicleChange } from "../models/vehicleLogReports.model.js";
// import Alert from "../models/alert.model.js";

export const getStatusReport = async (req, res) => {
  try {
    const { deviceId, period } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        message: "Device ID is required",
        success: false
      });
    }

    let fromDate;
    let toDate = new Date();

    // IST offset is +5:30
    const IST_HOUR_OFFSET = 5;
    const IST_MINUTE_OFFSET = 30;

    switch (period) {
      case "Today":
        fromDate = new Date();
        fromDate.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0); // Start of today IST
        toDate.setHours(23, 59, 59, 999); // End of today
        break;
      case "Yesterday":
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 1);
        fromDate.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        toDate = new Date(fromDate);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "This Week":
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - fromDate.getDay());
        fromDate.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "Previous Week":
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - fromDate.getDay() - 7);
        fromDate.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + 6);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "This Month":
        fromDate = new Date();
        fromDate.setDate(1);
        fromDate.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "Previous Month":
        fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1);
        fromDate.setDate(1);
        fromDate.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        toDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "Custom":
        if (!req.query.fromDate || !req.query.toDate) {
          return res.status(400).json({
            message: "From date and to date are required for custom period",
            success: false
          });
        }
        fromDate = new Date(req.query.fromDate);
        fromDate.setHours(fromDate.getHours() + IST_HOUR_OFFSET, fromDate.getMinutes() + IST_MINUTE_OFFSET);
        toDate = new Date(req.query.toDate);
        toDate.setHours(toDate.getHours() + IST_HOUR_OFFSET, toDate.getMinutes() + IST_MINUTE_OFFSET, 59, 999);
        break;
      default:
        return res.status(400).json({
          message: "Invalid period selection",
          success: false,
        });
    }

    // Add logging to debug date ranges
    console.log('Query date range:', {
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      deviceId
    });

    const historyData = await History.aggregate([
      {
        $match: {
          deviceId: Number(deviceId),
          createdAt: {
            $gte: fromDate,
            $lte: toDate,
          }
        }
      },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: null,
          data: {
            $push: {
              _id: "$_id",
              createdAt: "$createdAt",
              latitude: "$latitude",
              longitude: "$longitude",
              address: "$address",
              speed: "$speed",
              attributes: "$attributes"
            }
          }
        }
      },
      { $unwind: "$data" },
      {
        $project: {
          "data._id": 1,
          "data.createdAt": 1,
          "data.latitude": 1,
          "data.longitude": 1,
          "data.address": 1,
          "data.speed": 1,
          "data.attributes": 1
        }
      }
    ]);

    // Add logging to debug query results
    console.log('Query results:', {
      resultCount: historyData?.length || 0
    });

    if (!historyData || !historyData.length) {
      return res.status(404).json({
        message: "No data found for the selected period",
        success: false
      });
    }

    const typesOnly = [];
    let previousType = null;
    let startTime = null;
    let currentSegment = {
      totalDistance: 0,
      totalSpeed: 0,
      speedCount: 0,
      maxSpeed: 0,
      startLocation: null,
      startAddress: null,
      initialFuelLevel: null,
      startTotalDistance: 0
    };

    for (let i = 0; i < historyData.length; i++) {
      const item = historyData[i].data;

      if (!item.attributes) {
        console.warn(`Missing attributes for item at index ${i}`);
        continue;
      }

      // Determine status type based on ignition and speed
      let type;
      if (item.attributes.ignition) {
        if (item.speed > 60) {
          type = "Overspeed";
        } else if (item.speed > 1) {
          type = "Ignition On";
        } else {
          type = "Idle";
        }
      } else {
        type = "Ignition Off";
      }

      // Start new segment if status changes or at start
      if (type !== previousType || !startTime) {
        if (startTime && previousType) {
          // Calculate segment metrics
          const duration = Math.floor((new Date(item.createdAt) - new Date(startTime)) / 1000);
          const avgSpeed = currentSegment.speedCount > 0 ?
            currentSegment.totalSpeed / currentSegment.speedCount : 0;

          const segmentDistance = Math.max(0, item.attributes.totalDistance - currentSegment.startTotalDistance);

          typesOnly.push({
            ouid: item._id,
            vehicleStatus: previousType,
            time: formatDuration(duration),
            distance: previousType === "Ignition Off" ? 0 : Number(segmentDistance.toFixed(2)),
            maxSpeed: previousType === "Ignition Off" ? 0 : Number(currentSegment.maxSpeed.toFixed(2)),
            averageSpeed: previousType === "Ignition Off" ? 0 : Number(avgSpeed.toFixed(2)),
            startLocation: currentSegment.startLocation,
            endLocation: `${item.latitude}, ${item.longitude}`,
            startAddress: currentSegment.startAddress,
            endAddress: item.address,
            startDateTime: startTime,
            endDateTime: item.createdAt,
            totalKm: Number((item.attributes.totalDistance / 1000 || 0).toFixed(2)),
            duration: duration,
            consumption: null,
            initialFuelLevel: currentSegment.initialFuelLevel,
            finalFuelLevel: item.attributes?.fuel,
            kmpl: null,
            driverInfos: null
          });
        }

        // Initialize new segment
        startTime = item.createdAt;
        currentSegment = {
          totalDistance: 0,
          totalSpeed: 0,
          speedCount: 0,
          maxSpeed: 0,
          startLocation: `${item.latitude}, ${item.longitude}`,
          startAddress: item.address,
          initialFuelLevel: item.attributes?.fuel,
          startTotalDistance: item.attributes.totalDistance || 0
        };
      }

      // Update current segment metrics
      if (item.speed > 0) {
        currentSegment.totalSpeed += item.speed;
        currentSegment.speedCount++;
        currentSegment.maxSpeed = Math.max(currentSegment.maxSpeed, item.speed);
      }

      previousType = type;

      // Handle last segment
      if (i === historyData.length - 1 && startTime) {
        const duration = Math.floor((new Date(item.createdAt) - new Date(startTime)) / 1000);
        const avgSpeed = currentSegment.speedCount > 0 ?
          currentSegment.totalSpeed / currentSegment.speedCount : 0;

        const segmentDistance = Math.max(0, item.attributes.totalDistance - currentSegment.startTotalDistance);

        typesOnly.push({
          ouid: item._id,
          vehicleStatus: type,
          time: formatDuration(duration),
          distance: type === "Ignition Off" ? 0 : Number(segmentDistance.toFixed(2)),
          maxSpeed: type === "Ignition Off" ? 0 : Number(currentSegment.maxSpeed.toFixed(2)),
          averageSpeed: type === "Ignition Off" ? 0 : Number(avgSpeed.toFixed(2)),
          startLocation: currentSegment.startLocation,
          endLocation: `${item.latitude}, ${item.longitude}`,
          startAddress: currentSegment.startAddress,
          endAddress: item.address,
          startDateTime: startTime,
          endDateTime: item.createdAt,
          totalKm: Number((item.attributes.totalDistance / 1000 || 0).toFixed(2)),
          duration: duration,
          consumption: null,
          initialFuelLevel: currentSegment.initialFuelLevel,
          finalFuelLevel: item.attributes?.fuel,
          kmpl: null,
          driverInfos: null
        });
      }
    }

    function formatDuration(totalSeconds) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours}H ${minutes}M ${seconds}S`;
    }

    return res.status(200).json({ data: typesOnly, success: true });
  } catch (error) {
    console.error('Error in getStatusReport:', error);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};

export const getCustomReport = async (req, res) => {
  try {
    const { deviceId, period, page = 1, limit = 20 } = req.query; // Added pagination parameters
    let from;
    let to = new Date(); // Default to current date for 'to'

    // Define 'from' and 'to' based on the selected period
    switch (period) {
      case "Today":
        from = new Date();
        from.setHours(0, 0, 0, 0); // Start of today
        break;
      case "Yesterday":
        from = new Date();
        from.setDate(from.getDate() - 1); // Yesterday's date
        from.setHours(0, 0, 0, 0); // Start of yesterday
        to.setHours(0, 0, 0, 0); // End of yesterday
        break;
      case "This Week":
        from = new Date();
        from.setDate(from.getDate() - from.getDay()); // Set to start of the week (Sunday)
        from.setHours(0, 0, 0, 0);
        break;
      case "Previous Week":
        from = new Date();
        const dayOfWeek = from.getDay();
        from.setDate(from.getDate() - dayOfWeek - 7); // Start of the previous week
        from.setHours(0, 0, 0, 0);
        to.setDate(from.getDate() + 6); // End of the previous week
        to.setHours(23, 59, 59, 999);
        break;
      case "This Month":
        from = new Date();
        from.setDate(1); // Start of the month
        from.setHours(0, 0, 0, 0);
        break;
      case "Previous Month":
        from = new Date();
        from.setMonth(from.getMonth() - 1); // Previous month
        from.setDate(1); // Start of the previous month
        from.setHours(0, 0, 0, 0);
        to = new Date(from.getFullYear(), from.getMonth() + 1, 0); // End of the previous month
        to.setHours(23, 59, 59, 999);
        break;
      case "Custom":
        from = req.query.from; // For custom, you should pass the dates from the request
        to = req.query.to;
        break;
      default:
        return res.status(400).json({
          message: "Invalid period selection",
          success: false,
        });
    }

    const formattedFromDateStr = from.toISOString(); // '2024-09-24T00:41:17.000+00:00'
    const formattedToDateStr = to.toISOString(); // '2024-09-24T00:41:17.000+00:00'

    const historyData = await History.find({
      deviceId,
      deviceTime: {
        $gte: formattedFromDateStr,
        $lte: formattedToDateStr,
      },
    })
      .skip((page - 1) * limit) // Pagination: skip documents
      .limit(parseInt(limit)); // Pagination: limit documents

    const totalCount = await History.countDocuments({
      deviceId,
      deviceTime: {
        $gte: formattedFromDateStr,
        $lte: formattedToDateStr,
      },
    });

    if (!deviceId) {
      return res.status(400).json({
        message: "Device ID is required",
        success: false,
      });
    }

    if (!historyData.length) {
      return res.status(404).json({
        message: `No ${period} 's history found for the given device IDs`,
        success: false,
      });
    }

    res.status(200).json({
      message: "Custom report fetched successfully",
      success: true,
      deviceId,
      data: historyData,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching device report:", error);
    res.status(500).json({
      message: "Error fetching device report",
      success: false,
      error: error.message,
    });
  }
};

export const getSummaryReport = async (req, res) => {
  try {
    const { period } = req.query; // Removed pagination parameters
    const deviceIds = req.query.deviceIds.split(",").map(Number);
    console.log(deviceIds);
    let from;
    let to = new Date(); // Default to current date for 'to'

    // Define 'from' and 'to' based on the selected period
    switch (period) {
      case "Today":
        from = new Date();
        from.setHours(0, 0, 0, 0); // Start of today
        break;
      case "Yesterday":
        from = new Date();
        from.setDate(from.getDate() - 1); // Yesterday's date
        from.setHours(0, 0, 0, 0); // Start of yesterday
        to.setHours(0, 0, 0, 0); // End of yesterday
        break;
      case "This Week":
        from = new Date();
        from.setDate(from.getDate() - from.getDay()); // Set to start of the week (Sunday)
        from.setHours(0, 0, 0, 0);
        break;
      case "Previous Week":
        from = new Date();
        const dayOfWeek = from.getDay();
        from.setDate(from.getDate() - dayOfWeek - 7); // Start of the previous week
        from.setHours(0, 0, 0, 0);
        to.setDate(from.getDate() + 6); // End of the previous week
        to.setHours(23, 59, 59, 999);
        break;
      case "This Month":
        from = new Date();
        from.setDate(1); // Start of the month
        from.setHours(0, 0, 0, 0);
        break;
      case "Previous Month":
        from = new Date();
        from.setMonth(from.getMonth() - 1); // Previous month
        from.setDate(1); // Start of the previous month
        from.setHours(0, 0, 0, 0);
        to = new Date(from.getFullYear(), from.getMonth() + 1, 0); // End of the previous month
        to.setHours(23, 59, 59, 999);
        break;
      case "Custom":
        from = req.query.from; // For custom, you should pass the dates from the request
        to = req.query.to;
        break;
      default:
        return res.status(400).json({
          message: "Invalid period selection",
          success: false,
        });
    }

    const formattedFromDateStr = from.toISOString(); // '2024-09-24T00:41:17.000+00:00'
    const formattedToDateStr = to.toISOString(); // '2024-09-24T00:41:17.000+00:00'

    const historyData = await History.find({
      deviceId: { $in: deviceIds },
      deviceTime: {
        $gte: formattedFromDateStr,
        $lte: formattedToDateStr,
      },
    });

    if (!deviceIds || !deviceIds.length) {
      return res.status(400).json({
        message: "Device IDs are required",
        success: false,
      });
    }

    if (!historyData.length) {
      return res.status(404).json({
        message: `No ${period}'s history found for the given device IDs`,
        success: false,
      });
    }

    const summaryData = deviceIds.map((deviceId) => {
      const deviceHistory = historyData.filter(
        (item) => item.deviceId === deviceId
      );

      if (deviceHistory.length === 0) {
        return {
          deviceId: deviceId,
          deviceName: null,
          distance: 0,
          averageSpeed: 0,
          maxSpeed: 0,
          spentFuel: 0,
          startOdometer: 0,
          endOdometer: 0,
          startTime: null,
          endTime: null,
        };
      }

      const sortedHistory = deviceHistory.sort(
        (a, b) => new Date(a.deviceTime) - new Date(b.deviceTime)
      );
      const firstRecord = sortedHistory[0];
      const lastRecord = sortedHistory[sortedHistory.length - 1];

      let totalDistance = 0;
      let totalSpeed = 0;
      let maxSpeed = 0;
      let totalFuel = 0;

      for (let i = 1; i < sortedHistory.length; i++) {
        // Start from 1 to skip the first iteration
        const curr = sortedHistory[i];
        const prev = sortedHistory[i - 1];

        // Update max speed
        maxSpeed = Math.max(maxSpeed, curr.speed || 0);

        // Accumulate speed for average calculation
        totalSpeed += curr.speed || 0;

        // Calculate fuel consumption
        totalFuel += calculateFuelConsumption(prev, curr);

        // Calculate odometer difference
        const odometerDiff =
          (lastRecord?.attributes.odometer || 0) -
          (firstRecord?.attributes.odometer || 0);

        // If odometer data is available and valid, use it for distance calculation
        if (odometerDiff > 0) {
          totalDistance = odometerDiff;
        }
      }

      return {
        deviceId: deviceId,
        deviceName: firstRecord.deviceName,
        distance: totalDistance,
        averageSpeed: totalSpeed / (sortedHistory.length - 1),
        maxSpeed: maxSpeed,
        spentFuel: totalFuel,
        startOdometer: firstRecord?.attributes.odometer || 0,
        endOdometer: lastRecord?.attributes.odometer || 0,
        startTime: firstRecord.deviceTime,
        endTime: lastRecord.deviceTime,
      };
    });

    // Helper function to calculate fuel consumption between two points
    function calculateFuelConsumption(prevRecord, currRecord) {
      const fuelConsumed = prevRecord.fuel || 0;
      return fuelConsumed;
    }

    res.status(200).json({
      message: "Summary report fetched successfully",
      success: true,
      data: summaryData,
    });
  } catch (error) {
    console.error("Error fetching summary report:", error);
    res.status(500).json({
      message: "Error fetching summary report",
      success: false,
      error: error.message,
    });
  }
};

export const distanceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    let { deviceIds } = req.body;
    deviceIds = deviceIds.map(id => Number(id));

    // Validate inputs
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({
        message: "Invalid or missing 'deviceIds'. It should be a non-empty array.",
        success: false,
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Both 'startDate' and 'endDate' are required.",
        success: false,
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid 'startDate' or 'endDate'. Please provide valid dates.",
        success: false,
      });
    }

    // Query the data using aggregation
    const distanceData = await History.aggregate([
      {
        $match: {
          deviceId: { $in: deviceIds },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $project: {
          deviceId: 1,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalDistanceInKM: { $divide: ["$attributes.totalDistance", 1000] }, // Convert to kilometers
        },
      },
      {
        $group: {
          _id: { deviceId: "$deviceId", date: "$date" },
          firstDistance: { $first: "$totalDistanceInKM" },
          lastDistance: { $last: "$totalDistanceInKM" },
        },
      },
      {
        $project: {
          deviceId: "$_id.deviceId",
          date: "$_id.date",
          dailyDistance: { $subtract: ["$lastDistance", "$firstDistance"] }, // Calculate difference in KM
        },
      },
      {
        $group: {
          _id: "$deviceId",
          distances: {
            $push: {
              date: "$date",
              totalDistance: { $round: ["$dailyDistance", 2] }, // Round to 2 decimals
            },
          },
        },
      },
      {
        $project: {
          deviceId: "$_id",
          distances: 1,
          _id: 0,
        },
      },
    ]);

    // Extract deviceIds found in the DB
    const foundDeviceIds = distanceData.map((device) => device.deviceId);

    // Find missing deviceIds
    const missingDeviceIds = deviceIds.filter(id => !foundDeviceIds.includes(id));

    // Format the data to the required response structure
    const formattedData = distanceData.map((device) => {
      const formattedDevice = { deviceId: device.deviceId };

      // Sort distances by date
      device.distances.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Add each date and its distance to the formattedDevice object
      device.distances.forEach((entry) => {
        formattedDevice[entry.date] = entry.totalDistance.toFixed(2);
      });
      return formattedDevice;
    });

    // Append missing deviceIds with a "No data found" message
    missingDeviceIds.forEach((id) => {
      formattedData.push({
        deviceId: id,
        message: "No data found for this device",
      });
    });

    return res.status(200).json({
      message: "Distance report generated successfully",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching distance report:", error);
    return res.status(500).json({
      message: "An error occurred while fetching the distance report. Please try again later.",
      success: false,
      error: error.message,
    });
  }
};


export const dayReport = async (req, res) => {
  try {
    const { deviceId, startDate, endDate } = req.body;

    // Validate deviceId
    if (!deviceId) {
      return res.status(400).json({
        message: "Invalid or missing 'deviceId'.",
        success: false,
      });
    }

    // Validate startDate and endDate
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Both 'startDate' and 'endDate' are required.",
        success: false,
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set to the end of the day

    // Query the database
    const historyData = await History.find({
      deviceId: deviceId,
      deviceTime: {
        $gte: start,
        $lte: end,
      },
    }).select("deviceTime attributes.distance attributes.ignition");

    // If no data found, return a 404
    if (historyData.length === 0) {
      return res.status(404).json({
        message: "No Record Found",
        success: false,
      });
    }

    // Object to hold results by date
    const report = {};

    // Loop through the history data to calculate distances and ignition times
    historyData.forEach((item) => {
      const {
        deviceTime,
        attributes: { ignition, distance },
      } = item;

      // Parse the device time to get the date
      const date = deviceTime.toISOString().split("T")[0];

      // Initialize entry for the date if it doesn't exist
      if (!report[date]) {
        report[date] = {
          deviceId,
          date,
          ignitionOn: null,
          ignitionOff: null,
          totalDistance: 0,
          duration: null, // Add duration field
        };
      }

      // Accumulate total distance
      report[date].totalDistance += distance;

      // Update ignition states
      if (ignition) {
        // If ignition is on
        if (!report[date].ignitionOn) {
          report[date].ignitionOn = deviceTime.toISOString(); // Set ignitionOn
        }
        report[date].ignitionOff = null; // Reset ignitionOff when ignition is on
      } else {
        // If ignition is off
        if (report[date].ignitionOn && !report[date].ignitionOff) {
          report[date].ignitionOff = deviceTime.toISOString(); // Set ignitionOff if it was previously on

          // Calculate duration only if ignitionOn and ignitionOff are set
          const ignitionOnTime = new Date(report[date].ignitionOn);
          const ignitionOffTime = new Date(report[date].ignitionOff);
          const durationInMilliseconds = ignitionOffTime - ignitionOnTime;

          // Convert duration to hours and minutes
          const durationHours = Math.floor((durationInMilliseconds / (1000 * 60 * 60)) % 24);
          const durationMinutes = Math.floor((durationInMilliseconds / (1000 * 60)) % 60);
          report[date].duration = `${durationHours}h ${durationMinutes}m`; // Format as "Xh Ym"
        }
      }
    });

    // Convert the report object into an array and format distance
    const reportArray = Object.values(report).map((entry) => ({
      ...entry,
      totalDistance: (entry.totalDistance / 1000).toFixed(2) + " KM", // Convert to KM
    }));

    return res.status(200).json({
      message: "Day report generated successfully",
      data: reportArray,
    });
  } catch (error) {
    console.error("Error generating day report:", error);
    return res.status(500).json({
      message:
        "An error occurred while generating the day report. Please try again later.",
      success: false,
      error: error.message,
    });
  }
};

export const getIdleReports = async (req, res) => {
  try {
    const { period } = req.query;
    const deviceIds = req.query.deviceIds.split(",").map(Number);
    let from;
    let to = new Date();
    to.setHours(23, 59, 59, 999); // Set time to 23:59:59.999
    const IST_HOUR_OFFSET = 5;
    const IST_MINUTE_OFFSET = 30;

    switch (period) {
      case "Today":
        from = new Date();
        from.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0); // Start of today IST
        to = new Date(to.getTime() + 5.5 * 60 * 60 * 1000); // Adjust to IST (UTC+5:30)
        break;
      case "Yesterday":
        from = new Date();
        from.setDate(from.getDate() - 1);
        from.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        to = new Date(from);
        to.setHours(23, 59, 59, 999);
        to = new Date(to.getTime() + 5.5 * 60 * 60 * 1000); // Adjust to IST (UTC+5:30)
        break;
      case "This Week":
        from = new Date();
        from.setDate(from.getDate() - from.getDay());
        from.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        to.setHours(23, 59, 59, 999);
        to = new Date(to.getTime() + 5.5 * 60 * 60 * 1000); // Adjust to IST (UTC+5:30)
        break;
      case "Previous Week":
        from = new Date();
        from.setDate(from.getDate() - from.getDay() - 7);
        from.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        to = new Date(from);
        to.setDate(to.getDate() + 6);
        to.setHours(23, 59, 59, 999);
        to = new Date(to.getTime() + 5.5 * 60 * 60 * 1000); // Adjust to IST (UTC+5:30)
        break;
      case "This Month":
        from = new Date();
        from.setDate(1);
        from.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        to.setHours(23, 59, 59, 999);
        to = new Date(to.getTime() + 5.5 * 60 * 60 * 1000); // Adjust to IST (UTC+5:30)
        break;
      case "Previous Month":
        from = new Date();
        from.setMonth(from.getMonth() - 1);
        from.setDate(1);
        from.setHours(IST_HOUR_OFFSET, IST_MINUTE_OFFSET, 0, 0);
        to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
        to.setHours(23, 59, 59, 999);
        to = new Date(to.getTime() + 5.5 * 60 * 60 * 1000); // Adjust to IST (UTC+5:30)
        break;
      case "Custom":
        if (!req.query.from || !req.query.to) {
          return res.status(400).json({
            message: "From date and to date are required for custom period",
            success: false
          });
        }
        from = new Date(req.query.from);
        to = new Date(req.query.to);
        break;
      default:
        return res.status(400).json({
          message: "Invalid period selection",
          success: false,
        });
    }

    const formattedFromDateStr = from.toISOString();
    const formattedToDateStr = to.toISOString();

    const deviceReports = await Promise.all(
      deviceIds.map(async (deviceId) => {
        const historyData = await History.find({
          deviceId,
          createdAt: {
            $gte: formattedFromDateStr,
            $lte: formattedToDateStr,
          },
          'attributes.ignition': true,
          speed: { $lte: 2 },
        })
        .sort({ createdAt: 1 }) 
        .select('-_id attribute.ignition latitude longitude speed createdAt ');
          // return historyData

        let previousCreatedAt = null;
        const idleArray = [];
        const idleObj = {
          latitude:'',
          longitude:'',
          speed:null,
          idleStartTime:'',
          idleEndTime:'',
          duration:'',
        }

        for (const element of historyData) {
          if (previousCreatedAt == null) {
            idleObj.idleStartTime = element.createdAt;
            idleObj.latitude = element.latitude;
            idleObj.longitude = element.longitude;
            idleObj.speed = element.speed;

            previousCreatedAt = element.createdAt;
          } else if (((element.createdAt) - previousCreatedAt) <= 30000 ){
            previousCreatedAt = element.createdAt;
          } else {
            idleObj.idleEndTime = previousCreatedAt;
            // Calculate duration in milliseconds
            const durationMs = idleObj.idleEndTime - idleObj.idleStartTime;
            const totalSeconds = Math.floor(durationMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const duration = `${hours}h ${minutes}m ${seconds}s`;
            idleObj.duration = duration;

            idleArray.push({...idleObj})
            
            idleObj.idleStartTime = '';
            idleObj.latitude = '';
            idleObj.longitude = '';
            idleObj.speed = '';
            idleObj.idleEndTime = '';
            idleObj.duration = '';

            previousCreatedAt = null;
          }

        }
        idleObj.idleEndTime = previousCreatedAt;

        // Calculate duration in milliseconds
        const durationMs = idleObj.idleEndTime - idleObj.idleStartTime;
        const totalSeconds = Math.floor(durationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const duration = `${hours}h ${minutes}m ${seconds}s`;
        idleObj.duration = duration;

        idleArray.push({...idleObj})

        return {
          deviceId,
          idleArray,
        };
      })
    );

    return res.status(200).json({
      message: "Idle report fetched successfully",
      success: true,
      data: deviceReports,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Error fetching Idle report",
      success: false,
      error: error.message,
    });
  }
};

export const getGeofenceReport = async (req, res) => {
  try {
    const {
      deviceIds,
      FromDate,
      ToDate,
      period,
      limit = 10,
      page = 1,
    } = req.query;
    const parsedDeviceIds = deviceIds.split(",").map(Number);
    let from;
    let to = new Date(); // Default to current date for 'to'

    // Define 'from' and 'to' based on the selected period
    switch (period) {
      case "Today":
        from = new Date();
        from.setHours(0, 0, 0, 0); // Start of today
        break;
      case "Yesterday":
        from = new Date();
        from.setDate(from.getDate() - 1); // Yesterday's date
        from.setHours(0, 0, 0, 0); // Start of yesterday
        to.setHours(0, 0, 0, 0); // End of yesterday
        break;
      case "This Week":
        from = new Date();
        from.setDate(from.getDate() - from.getDay()); // Set to start of the week (Sunday)
        from.setHours(0, 0, 0, 0);
        break;
      case "Previous Week":
        from = new Date();
        const dayOfWeek = from.getDay();
        from.setDate(from.getDate() - dayOfWeek - 7); // Start of the previous week
        from.setHours(0, 0, 0, 0);
        to.setDate(from.getDate() + 6); // End of the previous week
        to.setHours(23, 59, 59, 999);
        break;
      case "This Month":
        from = new Date();
        from.setDate(1); // Start of the month
        from.setHours(0, 0, 0, 0);
        break;
      case "Previous Month":
        from = new Date();
        from.setMonth(from.getMonth() - 1); // Previous month
        from.setDate(1); // Start of the previous month
        from.setHours(0, 0, 0, 0);
        to = new Date(from.getFullYear(), from.getMonth() + 1, 0); // End of the previous month
        to.setHours(23, 59, 59, 999);
        break;
      case "Custom":
        from = new Date(req.query.from); // For custom, you should pass the dates from the request
        to = new Date(req.query.to);
        break;
      default:
        return res.status(400).json({
          message: "Invalid period selection",
          success: false,
        });
    }

    const query = {
      deviceId: { $in: parsedDeviceIds },
      deviceTime: {
        $gte: FromDate, // Ensure the date is in Date format
        $lte: ToDate, // Ensure the date is in Date format
      },
      "attributes.alarm": { $in: ["geofenceEnter", "geofenceExit"] },
    };

    const historyData = await History.find(query).sort({ deviceTime: 1 });

    const geofenceReports = {};
    const lastSeenEvents = {}; // Store the last seen events by deviceId and alarm type

    // Fetch device names for the corresponding deviceIds
    const devices = await Device.find({ deviceId: { $in: parsedDeviceIds } });
    // console.log(devices)
    const deviceMap = devices.reduce((acc, device) => {
      acc[device.deviceId] = device.name; // Map deviceId to device name
      return acc;
    }, {});

    // Initialize reports for all devices in the deviceIds array
    parsedDeviceIds.forEach((deviceId) => {
      geofenceReports[deviceId] = {
        name: deviceMap[deviceId] || deviceId, // Use device name if available, otherwise fallback to deviceId
        events: [], // Array to store geofenceEnter and geofenceExit pairs
      };
    });

    // Helper function to calculate halt time
    const calculateHaltTime = (inTime, outTime) => {
      const inDate = new Date(inTime);
      const outDate = new Date(outTime);
      if (isNaN(inDate) || isNaN(outDate)) {
        throw new Error("Invalid date values provided for inTime or outTime");
      }
      const duration = (outDate - inDate) / 1000; // duration in seconds
      return new Date(duration * 1000).toISOString().substr(11, 8); // Format to "HH:mm:ss"
    };

    // Iterate through the history data and process geofence entries and exits
    historyData.forEach((entry) => {
      const { deviceId, deviceTime, attributes, _id } = entry;
      const alarmType = attributes.alarm;
      let previousTotalDistance;
      const report = geofenceReports[deviceId];

      const eventKey = `${deviceId}-${alarmType}-${deviceTime}`; // Unique key to track duplicates

      // Check if this event is a duplicate
      if (lastSeenEvents[eventKey]) {
        // Skip duplicate entry
        return;
      }

      // Mark the current event as the last seen for this device and alarm type
      lastSeenEvents[eventKey] = true;

      if (alarmType === "geofenceEnter") {
        // console.log(entry.attributes.totalDistance);
        previousTotalDistance = entry.attributes.totalDistance;
        // console.log(previousTotalDistance);
        // Store the 'geofenceEnter' event
        report.events.push({
          name: report.name, // Use the device name from the report
          ouid: _id,
          inTime: deviceTime.toLocaleString(),
          inLoc: [entry.longitude, entry.latitude], // Assuming these attributes exist
          outTime: null, // Initially set to null, will be updated on corresponding geofenceExit
          outLoc: null, // Initially set to null, will be updated on corresponding geofenceExit
          haltTime: "0:00:00",
          distance: 0,
          totalDistance: entry.attributes.totalDistance,
        });
      } else if (alarmType === "geofenceExit") {
        // Find the latest 'geofenceEnter' without a corresponding 'geofenceExit'
        const lastEvent = report.events
          .slice()
          .reverse()
          .find((e) => e.outTime === null);
        // console.log('Last Event:', lastEvent); // Log the last event for debugging
        if (lastEvent) {
          // Update the event with 'geofenceExit' details
          lastEvent.outTime = new Date(deviceTime).toLocaleString(); // Ensure deviceTime is a Date object
          lastEvent.outLoc = [entry.longitude, entry.latitude]; // Assuming these attributes exist
          const inTime = new Date(lastEvent.inTime);
          const outTime = new Date(deviceTime);
          lastEvent.haltTime = calculateHaltTime(inTime, outTime);
          lastEvent.distance =
            entry.attributes.totalDistance - lastEvent.totalDistance; // Calculate distance based on current totalDistance and previous one
        } else {
          console.warn(
            `No matching 'geofenceEnter' found for deviceId: ${deviceId} at time: ${deviceTime}`
          );
        }
      }
    });

    // Convert reports to array and paginate the results
    const reportsArray = Object.values(geofenceReports).flatMap(
      (report) => report.events.map(({ totalDistance, ...event }) => event) // to remove totalDistance property from event object
    );
    const totalReports = reportsArray.length;
    const paginatedReports = reportsArray.slice(
      (page - 1) * limit,
      page * limit
    );

    res.status(200).json({
      message: "Geofence report fetched successfully",
      success: true,
      data: {
        reports: paginatedReports,
        pagination: {
          total: totalReports,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalReports / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching geofence report:", error);
    res.status(500).json({
      message: "Error fetching geofence report",
      success: false,
      error: error.message,
    });
  }
};

export const geofenceReportsByTimeRange = async (req, res) => {
  const { deviceId,fromDate,toDate} = req.body;
  try {
    if (!deviceId ||!fromDate ||!toDate) {
      return res.status(400).json({
        message: "Invalid request parameters",
        success: false,
      });
    }
    const geofenceData = await Alert.find({
      deviceId,
      type: { $in: ["geofenceExited", "geofenceEntered"] },
      createdAt: {
        $gte: new Date(new Date(fromDate).getTime() - (5.5 * 60 * 60 * 1000)),
        $lte: new Date(new Date(toDate).getTime() - (5.5 * 60 * 60 * 1000)),
      },
    })
    if (geofenceData.length > 0) {
      return res.status(200).json({
        message: "Geofence data fetched successfully",
        success: true,
        data: geofenceData
      })
    }
    else {
      return res.status(404).json({
        message: "No geofence data found for the provided parameters",
        success: false,
      });
    }
  } catch (error) {
    return res.status(404).json({
      message: "Error fetching geofence data",
      success: false,
      error: error.message
    })
  }
}

export const vehiclelog = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attribute, period, from, to } = req.query;

    let fromDate,
      toDate = new Date();

    switch (period) {
      case "Today":
        fromDate = new Date();
        fromDate.setHours(0, 0, 0, 0);
        break;
      case "Yesterday":
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 1);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(0, 0, 0, 0);
        break;
      case "This Week":
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - fromDate.getDay());
        fromDate.setHours(0, 0, 0, 0);
        break;
      case "Previous Week":
        fromDate = new Date();
        const dayOfWeek = fromDate.getDay();
        fromDate.setDate(fromDate.getDate() - dayOfWeek - 7);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setDate(fromDate.getDate() + 6);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "This Month":
        fromDate = new Date();
        fromDate.setDate(1);
        fromDate.setHours(0, 0, 0, 0);
        break;
      case "Previous Month":
        fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1);
        fromDate.setDate(1);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "Custom":
        fromDate = new Date(from);
        toDate = new Date(to);
        break;
      default:
        return res.status(400).json({
          message: "Invalid period selection",
          success: false,
        });
    }

    // const formattedFromDateStr = fromDate.toISOString();
    // const formattedToDateStr = toDate.toISOString();

    const query = {
      changedBy: userId,
      createdAt: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    const attributesToSelect =
      attribute === "all" ? {} : { [attribute]: 1, createdAt: 1 };

    const vehicleChanges = await VehicleChange.find(query).select(
      attributesToSelect
    );

    if (!vehicleChanges || vehicleChanges.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No changes found for the selected period",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vehicle changes fetched successfully for the selected period",
      data: vehicleChanges,
    });
  } catch (error) {
    console.error("Error fetching vehicle changes:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching vehicle changes",
      error: error.message,
    });
  }
};

export const travelSummaryReport = async (req, res) => {
  try {
    const { deviceIds, from, to } = req.query;
    if (!deviceIds || !from || !to) {
      return res.status(400).json({ message: "Missing required parameters: deviceIds, from, or to" });
    }
    const parsedDeviceIds = deviceIds.split(",").map(Number);
    if (parsedDeviceIds.some(isNaN)) {
      return res.status(400).json({ message: "Invalid deviceIds format" });
    }
    const vehicleNumber = await Device.find({ deviceId: {$in: parsedDeviceIds} }).select('name TD deviceId -_id').lean(); // Use lean() here as well

    const results = await History.aggregate([
      {
        $match: {
          deviceId: { $in: parsedDeviceIds },
          createdAt: {
            $gte: new Date(from),
            $lte: new Date(to),
          },
        },
      },
      { $sort: { deviceId: 1, createdAt: 1 } },
      {
        $group: {
          _id: "$deviceId",
          records: {
            $push: {
              ignition: "$attributes.ignition",
              createdAt: "$createdAt",
              totalDistance: "$attributes.totalDistance",
              speed: "$speed",
              latitude: "$latitude",
              longitude: "$longitude",
            },
          },
        },
      },
      {
        $addFields: {
          firstIgnition: { $arrayElemAt: ["$records", 0] },
          lastIgnition: { $arrayElemAt: ["$records", -1] },
        },
      },
      {
        $project: {
          _id: 0,
          deviceId: "$_id",
          firstIgnition: 1,
          lastIgnition: 1,
          records: 1,
        },
      },
    ]);

    if (results.length === 0) {
      return res.status(404).json({ message: "No records found for the provided deviceIds and date range." });
    }
    
    const reportData = results.map((device) => {
      const ignitionOnFilter = device.records.filter(record => record.ignition == true)
      if (ignitionOnFilter.length == 0) return null;
      
      const firstRecord = device.firstIgnition;
      const lastRecord = device.lastIgnition;
      const totalDistance = (lastRecord.totalDistance - firstRecord.totalDistance) / 1000;
      
      const runningDuration = calculateDuration(device.records.filter((r) => r.ignition === true && r.speed > 2));
      const stopDuration = calculateDuration(device.records.filter((r) => r.ignition === false));
      const idleDuration = calculateDuration(device.records.filter((r) => (r.ignition === true && r.speed <=2) ));

      const maxSpeed = Math.max(...device.records.map((r) => r.speed));
      const avgSpeed = (device.records.filter((r) => r.ignition === true && r.speed > 2)).reduce((acc, curr) => acc + curr.speed, 0) / (device.records.filter((r) => r.ignition === true && r.speed > 2)).length;


      function getDayWiseTrips(data) {
        let groupedData = {};
      
        // Group data by date
        data.forEach(entry => {
          if (!entry.createdAt) return;
      
          const dateStr = typeof entry.createdAt === "string"
            ? entry.createdAt
            : new Date(entry.createdAt).toISOString();
      
          const date = dateStr.split("T")[0]; // Extract date (YYYY-MM-DD)
      
          if (!groupedData[date]) {
            groupedData[date] = [];
          }
          groupedData[date].push(entry);
        });
      
        let dayWiseTrips = [];
      
        // Process each day's data
        Object.keys(groupedData).forEach(date => {
          const records = groupedData[date];
      
          records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
          const firstIgnition = records.find(entry => entry.ignition === true);
          const lastIgnition = [...records].reverse().find(entry => entry.ignition === true);
      
          if (!firstIgnition || !lastIgnition) return;
      
          const distance = ((lastIgnition.totalDistance - firstIgnition.totalDistance) / 1000).toFixed(2);

          const runningDuration = calculateDuration(records.filter((r) => r.ignition === true && r.speed > 2));
          const stopDuration = calculateDuration(records.filter((r) => r.createdAt >= firstIgnition.createdAt && r.createdAt <= lastIgnition.createdAt && r.ignition === false));
          const idleDuration = calculateDuration(records.filter((r) => (r.ignition === true && r.speed <2) ));

          const maxSpeed = Math.max(...records.map((r) => r.speed));
          const avgSpeed = (records.filter((r) => r.ignition === true && r.speed > 2)).reduce((acc, curr) => acc + curr.speed, 0) / (records.filter((r) => r.ignition === true && r.speed > 2)).length;
    
    
          dayWiseTrips.push({
            date,
            startTime: firstIgnition.createdAt,
            endTime: lastIgnition.createdAt,
            distance: `${distance} KM`,
            startLatitude: firstIgnition.latitude,
            startLongitude: firstIgnition.longitude,
            endLatitude: lastIgnition.latitude,
            endLongitude: lastIgnition.longitude,
            maxSpeed,
            avgSpeed,
            workingHours: getDuration(firstIgnition.createdAt, lastIgnition.createdAt),
            runningTime: runningDuration,
            stopTime: stopDuration,
            idleTime: idleDuration,
          });
        });
      
        return dayWiseTrips;
      }
      
      // Function to calculate duration between start and end time
      function getDuration(start, end) {
        const startTime = new Date(start);
        const endTime = new Date(end);
        const duration = (endTime - startTime) / 1000; // Convert to seconds
      
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
      
        return `${hours}h ${minutes}m`;
      }
      // Helper function to calculate time duration (in H:M:S format)
      function calculateDuration(records) {
        if (records.length < 2) return "0H 0M 0S"; // If there are less than 2 records, return 0 duration
      
          const days = Math.floor((records.length*10) / (24 * 60 * 60));
          const remainingAfterDays = (records.length*10) % (24 * 60 * 60);
          
          const hours = Math.floor(remainingAfterDays / (60 * 60));
          const remainingAfterHours = remainingAfterDays % (60 * 60);
          
          const minutes = Math.floor(remainingAfterHours / 60);
          const remainingSeconds = remainingAfterHours % 60;

          return `${days}D, ${hours}H, ${minutes}M, ${remainingSeconds}S`;

      }

      const vName = vehicleNumber.find((v) => v.deviceId == device.deviceId);
      return {
        name: vName?.name,
        startLat: ignitionOnFilter[0].latitude,
        startLong: ignitionOnFilter[0].longitude,
        distance: totalDistance.toFixed(2),
        running: runningDuration,
        idle: idleDuration,
        stop: stopDuration,
        maxSpeed,
        avgSpeed,
        endLat: ignitionOnFilter[ignitionOnFilter.length-1].latitude,
        endLong: ignitionOnFilter[ignitionOnFilter.length-1].longitude,
        endLocation: lastRecord.location,
        driverName: firstRecord.driverName,
        driverPhoneNo: firstRecord.driverPhoneNo,
        dayWiseTrips: getDayWiseTrips(device.records)
      };
    }).filter(item => item !== null);

    return res.status(200).json({ reportData });

  } catch (error) {
    console.error("Error generating report:", error);
    return res.status(500).json({ message: "An error occurred while generating the report", error: error.message });
  }
};

export const tripSummaryReport = async (req, res) => {
  try {
    const { deviceIds, from, to } = req.query;
    if (!deviceIds || !from || !to) {
      return res.status(400).json({ message: "Missing required parameters: deviceIds, from, or to" });
    }
    const parsedDeviceIds = deviceIds.split(",").map(Number);
    if (parsedDeviceIds.some(isNaN)) {
      return res.status(400).json({ message: "Invalid deviceIds format" });
    }
    const vehicleNumber = await Device.find({ deviceId: {$in: parsedDeviceIds} }).select('name TD deviceId -_id').lean(); // Use lean() here as well

    const results = await History.aggregate([
      {
        $match: {
          deviceId: { $in: parsedDeviceIds },
          createdAt: {
            $gte: new Date(from),
            $lte: new Date(to),
          },
        },
      },
      { $sort: { deviceId: 1, createdAt: 1 } },
      {
        $group: {
          _id: "$deviceId",
          records: {
            $push: {
              ignition: "$attributes.ignition",
              createdAt: "$createdAt",
              totalDistance: "$attributes.totalDistance",
              speed: "$speed",
              latitude: "$latitude",
              longitude: "$longitude",
            },
          },
        },
      },
      {
        $addFields: {
          firstIgnition: { $arrayElemAt: ["$records", 0] },
          lastIgnition: { $arrayElemAt: ["$records", -1] },
        },
      },
      {
        $project: {
          _id: 0,
          deviceId: "$_id",
          firstIgnition: 1,
          lastIgnition: 1,
          records: 1,
        },
      },
    ]);

    if (results.length === 0) {
      return res.status(404).json({ message: "No records found for the provided deviceIds and date range." });
    }
    
    const reportData = results.map((device) => {
      const ignitionOnFilter = device.records.filter(record => record.ignition == true)
      if (ignitionOnFilter.length == 0) return null;

      const firstRecord = device.firstIgnition;
      const lastRecord = device.lastIgnition;
      const totalDistance = (lastRecord.totalDistance - firstRecord.totalDistance) / 1000;

      // Helper function to calculate time duration (in H:M:S format)
      function calculateDuration(records) {
        if (records.length < 2) return "0H 0M 0S"; // If there are less than 2 records, return 0 duration

          const days = Math.floor((records.length*10) / (24 * 60 * 60));
          const remainingAfterDays = (records.length*10) % (24 * 60 * 60);
          
          const hours = Math.floor(remainingAfterDays / (60 * 60));
          const remainingAfterHours = remainingAfterDays % (60 * 60);
          
          const minutes = Math.floor(remainingAfterHours / 60);
          const remainingSeconds = remainingAfterHours % 60;

          return `${days}D, ${hours}H, ${minutes}M, ${remainingSeconds}S`;

      }

      
      const runningDuration = calculateDuration(device.records.filter((r) => r.ignition === true && r.speed > 2));
      const stopDuration = calculateDuration(device.records.filter((r) => r.ignition === false));
      const idleDuration = calculateDuration(device.records.filter((r) => (r.ignition === true && r.speed <2) ));

      const maxSpeed = Math.max(...device.records.map((r) => r.speed));
      
      const avgSpeed = (device.records.filter((r) => r.ignition === true && r.speed > 2)).reduce((acc, curr) => acc + curr.speed, 0) / (device.records.filter((r) => r.ignition === true && r.speed > 2)).length;


      const deviceDataByTrips = [];
      let ignitionOnValue = [];

    // Collect data into trips based on ignition status
      for (const record of device.records) {
        if (record.ignition) {
          ignitionOnValue.push({
            createdAt: record.createdAt,
            latitude: record.latitude,
            longitude: record.longitude,
            totalDistance: record.totalDistance,
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

      const finalTrip = deviceDataByTrips.map((trip) => {
        // console.log(trip)
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
          startTime: startTime,
          maxSpeed: maxSpeed,
          avgSpeed: avgSpeed,
          duration: duration,
          startLongitude: trip[0].longitude,
          startLatitude: trip[0].latitude,
          distance: coveredDistance + " KM",
          endLongitude: trip.length > 1 ? trip[trip.length - 1].longitude : "Running",
          endLatitude: trip.length > 1 ? trip[trip.length - 1].latitude : "Running",
          endTime: endTime,
        };
      });

      const vName = vehicleNumber.find((v) => v.deviceId == device.deviceId);





      return {
        name: vName?.name,
        startLat: ignitionOnFilter[0].latitude,
        startLong: ignitionOnFilter[0].longitude,
        distance: totalDistance.toFixed(2),
        running: runningDuration,
        idle: idleDuration,
        stop: stopDuration,
        maxSpeed,
        avgSpeed,
        endLat: ignitionOnFilter[ignitionOnFilter.length-1].latitude,
        endLong: ignitionOnFilter[ignitionOnFilter.length-1].longitude,
        endLocation: lastRecord.location,
        driverName: firstRecord.driverName,
        driverPhoneNo: firstRecord.driverPhoneNo,
        trips:finalTrip
      };
    }).filter(item => item !== null);

    return res.json({ reportData });

  } catch (error) {
    console.error("Error generating report:", error);
    return res.status(500).json({ message: "An error occurred while generating the report", error: error.message });
  }
};

// export const getIdleReports by yash = async (req, res) => {
//   try {
//     const { period, page = 1, limit = 20 } = req.query;
//     const deviceIds = req.query.deviceIds.split(",").map(Number);
//     let from;
//     let to = new Date();

//     switch (period) {
//       case "Today":
//         from = new Date();
//         from.setHours(0, 0, 0, 0);
//         break;
//       case "Yesterday":
//         from = new Date();
//         from.setDate(from.getDate() - 1);
//         from.setHours(0, 0, 0, 0);
//         to.setHours(0, 0, 0, 0);
//         break;
//       case "This Week":
//         from = new Date();
//         from.setDate(from.getDate() - from.getDay());
//         from.setHours(0, 0, 0, 0);
//         break;
//       case "Previous Week":
//         from = new Date();
//         const dayOfWeek = from.getDay();
//         from.setDate(from.getDate() - dayOfWeek - 7);
//         from.setHours(0, 0, 0, 0);
//         to.setDate(from.getDate() + 6);
//         to.setHours(23, 59, 59, 999);
//         break;
//       case "This Month":
//         from = new Date();
//         from.setDate(1);
//         from.setHours(0, 0, 0, 0);
//         break;
//       case "Previous Month":
//         from = new Date();
//         from.setMonth(from.getMonth() - 1);
//         from.setDate(1);
//         from.setHours(0, 0, 0, 0);
//         to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
//         to.setHours(23, 59, 59, 999);
//         break;
//       case "Custom":
//         from = req.query.from;
//         to = req.query.to;
//         break;
//       default:
//         return res.status(400).json({
//           message: "Invalid period selection",
//           success: false,
//         });
//     }

//     const formattedFromDateStr = from.toISOString();
//     const formattedToDateStr = to.toISOString();

//     // Use Promise.all to fetch data for all devices
//     const deviceReports = await Promise.all(
//       deviceIds.map(async (deviceId) => {
//         const historyData = await History.find({
//           deviceId,
//           createdAt: {
//             $gte: formattedFromDateStr,
//             $lte: formattedToDateStr,
//           },
//         })
//           .skip((page - 1) * limit)
//           .limit(parseInt(limit));

//         const typesOnly = [];
//         let previousType = null;
//         let totalDurationSeconds = 0; // Initialize totalDurationSeconds for this device

//         for (const item of historyData) {
//           let type;

//           if (item.attributes.ignition) {
//             if (item.speed > 60) {
//               type = "Overspeed";
//             } else if (item.speed > 0) {
//               type = "Ignition On";
//             } else {
//               type = "Idle";
//             }
//           } else {
//             type = "Ignition Off";
//           }

//           if (type !== previousType) {
//             const previousOdometer =
//               typesOnly.length > 0
//                 ? typesOnly[typesOnly.length - 1].totalKm
//                 : 0;
//             const currentOdometer = item.attributes.odometer || 0;

//             if (type === "Idle" || type === "Ignition Off") {
//               const durationSeconds =
//                 typesOnly.length > 0
//                   ? (new Date(item.deviceTime).getTime() -
//                     new Date(
//                       historyData[typesOnly.length - 1].deviceTime
//                     ).getTime()) /
//                   1000
//                   : 0;

//               // Add durationSeconds to totalDurationSeconds
//               totalDurationSeconds += durationSeconds;

//               typesOnly.push({
//                 ouid: item._id,
//                 vehicleStatus: type,
//                 durationSeconds: durationSeconds, // Add this duration to the current object
//                 // distance: currentOdometer - previousOdometer,
//                 location: `${item.latitude || 0}, ${item.longitude || 0}`,
//                 // startAddress: typesOnly.length > 0 ? historyData[typesOnly.length - 1]?.address || null : null,
//                 address: item.address || null,

//                 arrivalTime:
//                   typesOnly.length > 0
//                     ? historyData[typesOnly.length - 1]?.deviceTime ||
//                     item.deviceTime
//                     : item.deviceTime,
//                 departureTime: item.deviceTime || null,
//               });
//             }

//             previousType = type;
//           }
//         }

//         return {
//           deviceId,
//           data: typesOnly,
//           totalDurationSeconds, // Add the totalDurationSeconds for this device
//           // pagination: {
//           //     total: typesOnly.length,
//           //     page: parseInt(page),
//           //     limit: parseInt(limit),
//           //     totalPages: Math.ceil(typesOnly.length / limit),
//           // },
//         };
//       })
//     );

//     res.status(200).json({
//       message: "Status report fetched successfully",
//       success: true,
//       data: deviceReports,
//     });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       message: "Error fetching alert report",
//       success: false,
//       error: error.message,
//     });
//   }
// };
