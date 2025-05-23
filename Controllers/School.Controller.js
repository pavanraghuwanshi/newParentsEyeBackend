import {School} from "../Models/school.js";
import findSameUsername from "../Utils/findSameUsername.js";
import { decrypt, encrypt, comparePassword } from "../Utils/crypto.js";




export const addSchool = async (req, res) => {

     const role = req.user.role;
  const { schoolName, username, password, email, schoolMobile, branchName } = req.body;

  if(role!=="superAdmin") return res.status(403).json({ message: "You are not authorized to add a school" });
  if (!schoolName || !username || !password) {
    return res.status(400).json({ message: "Please enter all required fields" });
  }

  try {
    
    const existingUserByUsername = await findSameUsername(username);
    if (existingUserByUsername.exists) {
      return res.status(400).json({ message: "Username already exists" });
    }

  
    const newSchool = new School({ schoolName, username, password:encrypt(password), email, schoolMobile, branchName });

    const school = await newSchool.save();
   
    res.status(201).json({
      school: school,
     
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const getSchools = async (req, res) => {

  const role = req.user.role;
  if(role!=="superAdmin") return res.status(403).json({ message: "You are not authorized to view schools" });
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

export const updateSchool = async (req, res) => {
  const role = req.user.role;
  if(role!=="superAdmin") return res.status(403).json({ message: "You are not authorized to update a school" });
  const { id } = req.params;
  const { schoolName, username, password, email, schoolMobile } = req.body;

  try {
    if(username){ 
    const existingUserByUsername = await findSameUsername(username);
      if (existingUserByUsername.exists) {
        return res.status(400).json({ message: "Username already exists" });
      }
    }

    const updatedSchool = await School.findByIdAndUpdate(
      id,
      { schoolName, username, password: encrypt(password), email, schoolMobile },
      { new: true }
    );

    if (!updatedSchool) {
      return res.status(404).json({ message: "School not found" });
    }

    res.status(200).json(updatedSchool);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteSchool = async (req, res) => {
  const role = req.user.role;
  if(role!=="superAdmin") return res.status(403).json({ message: "You are not authorized to delete a school" });
  const { id } = req.params;

  try {
    const deletedSchool = await School.findByIdAndDelete(id);

    if (!deletedSchool) {
      return res.status(404).json({ message: "School not found" });
    }

    res.status(200).json({ message: "School deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
