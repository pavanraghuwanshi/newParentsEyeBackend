import { History } from "../../Models/history.model.js";
import { Device } from "../../Models/device.model.js";
import axios from "axios";
import { configDotenv } from "dotenv";
configDotenv();

let position = [],devices = [];
const fetchData = async () => {
  const positionUrl = process.env.POSITION_URL;
  const devicesUrl = process.env.DEVICES_URL;
  const username = process.env.USER_NAME;
  const password = process.env.PASS_WORD;
  try {
    const [positionResponse, devicesResponse] = await Promise.all([
      axios.get(positionUrl, { auth: { username, password } }),
      axios.get(devicesUrl, { auth: { username, password } })
    ]);

    position = positionResponse.data.map((dataItem) => {
      dataItem.speed = dataItem.speed * 2
      return dataItem
    });
    devices = devicesResponse.data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error.message);
  }
}

 fetchData()
 setInterval(() => {
  fetchData()
 }, 5000);

 // Function to get the latest data
 export const getData = () => {
  try {
    return {position,devices};
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}



export const fetchGPSdata = async () => {
 
  try {
    // Make the fetch request
    console.log("Fetching data from GPS device...");
    const {position} = getData();
    const data = position;

    if (data.length > 0) {
      const savePromises = data.map(dataItem => {
        if (dataItem.attributes.distance < 500) {
          // dataItem.attributes.distance = 0;
          // dataItem.speed = dataItem.speed * 2
          const dataDoc = new History(dataItem);
          return dataDoc.save();
        }
      });
  
      await Promise.all(savePromises);
    }

   

    // console.log("data from GPS device ",data)
    // for (const gpsdata of data) {

    //   const {speed,longitude,latitude,course,deviceId,deviceTime } = gpsdata
    //   const { ignition,distance,totalDistance,event} = gpsdata.attributes

    //   const device = await Device.findOne({deviceId:deviceId})
    //   let category = " "
    //   if (device) {
    //     category = device.category
    //   }
    // console.log("count", speed,longitude,latitude,course,deviceId,deviceTime,ignition,distance,totalDistance,category,event)
    // console.log("device",category)
    // const newData = new History({ speed, longitude,latitude,course,deviceId,category,deviceTime,ignition,distance,totalDistance,event });
    // await newData.save(); 
    // }
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error.message);
  }
};

export const updateDeviceTotalDistance = async () => {
  try {
    const devices = await Device.find();

    for (const device of devices) {
      const totalDistance = await History.aggregate([
        {
          $match: {
            deviceId: Number(device.deviceId),
            createdAt: { $gte: new Date(device.TDTime) },
          },
        },
        {
          $sort: { createdAt: 1 },
        },
        {
          $group: {
            _id: "$deviceId",
            firstTotalDistance: { $first: "$attributes.totalDistance" },
            lastTotalDistance: { $last: "$attributes.totalDistance" },
            lastCreatedAt: { $max: "$createdAt" },
          },
        },
        {
          $project: {
            _id: 1,
            calculatedTotalDistance: {
              $subtract: ["$lastTotalDistance", "$firstTotalDistance"],
            },
            lastCreatedAt: 1,
          },
        },
      ]);

      if (totalDistance.length > 0) {
        const calculatedDistance = (totalDistance[0].calculatedTotalDistance / 1000).toFixed(2);
        const updatedTotalDistance = (parseFloat(device.TD) + parseFloat(calculatedDistance)).toFixed(2);

        device.TD = updatedTotalDistance;
        device.TDTime = totalDistance[0].lastCreatedAt;

        await device.save();
        // console.log(`Device ${device.deviceId} updated with TD: ${device.TD}`);
      }
    }
  } catch (error) {
    console.error("Error updating device total distance:", error);
  }
};


// export const updateDeviceTotalDistance = async () => {
//   const devices = await Device.find();
//    devices.map(async device => {
//     const totalDistance = await History.aggregate([
//       {
//         $match: { 
//         deviceId: Number(device.deviceId),
//         createdAt: { $gte: new Date(device.TDTime) }
//        }
//       },
//       {
//         $group: { _id: "$deviceId", totalDistance: { $sum: "$attributes.distance" },lastCreatedAt: { $max: "$createdAt" } } 
//       }
//     ]);

//     if (totalDistance.length > 0) {
//       totalDistance[0].totalDistance = ((totalDistance[0].totalDistance)/1000).toFixed(2);
//       const updatedTotalDistance = (parseFloat(device.TD) + parseFloat(totalDistance[0].totalDistance)).toFixed(2);
//       device.TD = updatedTotalDistance;
//       device.TDTime = totalDistance[0].lastCreatedAt;
//       // console.log("totalDistance",totalDistance[0].totalDistance)
//       // console.log("device",device)
//        return device.save();
//     }
//   });
// }