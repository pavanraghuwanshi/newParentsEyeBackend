import {School} from "../Models/school.js";
import findSameUsername from "../Utils/LiveDataFromOldApp/findSameUsername.js";
import { decrypt, encrypt, comparePassword } from "../Utils/LiveDataFromOldApp/crypto.js";




export const addSchool = async (req, res) => {

    //  const user = req.user.role;
  const { schoolName, username, password, email, schoolMobile, branchName } = req.body;

  try {
    
    const existingUserByUsername = await findSameUsername(username);
    if (existingUserByUsername.exists) {
      return res.status(400).json({ message: "Username already exists" });
    }

  
    const newSchool = new School({ schoolName, username, password, email, schoolMobile, branchName });

    const school = await newSchool.save();
   
    res.status(201).json({
      school: school,
     
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const getSchools = async (req, res) => {
  try {
    const schools = await School.find();

    schools?.forEach(school => {
      const decryptedPassword = decrypt(school.password);
      school.password = decryptedPassword;
    });

    res.status(200).json(schools);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
