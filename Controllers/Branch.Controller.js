import  School  from "../Models/school.js";
import findSameUsername from "../Utils/findSameUsername.js";
import { decrypt, encrypt, comparePassword } from "../Utils/crypto.js";
import Branch from "../Models/branch.js";
import mongoose from "mongoose";

export const addBranch = async (req, res) => {
     const {
       branchName,
       username,
       password,
       email,
       address,
       phone,
       schoolId
     } = req.body;

     const role = req.user.role;
     
     console.log("role", role);

 if (role !== 'school' && role !== 'superAdmin') {
  return res.status(403).json({ message: 'You are not a valid user.' });
}


   
     try {
       const school = await School.findById(schoolId);
       if (!school) {
         return res.status(404).json({ message: "School not found" });
       }
   
       const existingUserByUsername = await findSameUsername(username);
if (existingUserByUsername.exists) {
  return res.status(400).json({ message: "This username already exists" });
}

     const encryptedPassword = encrypt(password);
   
       // Create new branch
       const newBranch = new Branch({
         branchName,
         username,
         password:encryptedPassword,
         email,
         address,
         phone,
         schoolId
       });
   
       await newBranch.save();
   
       res.status(201).json({ message: "Branch added successfully", branch: newBranch });
   
     } catch (err) {
       res.status(500).json({ message: err.message });
     }
   };

export const getBranches = async (req, res) => {
  const { id } = req.user;
  const {role} = req.user;

  const ObjectId = mongoose.Types.ObjectId;
  let Branches;

  try {

      if(role=='superAdmin'){
         Branches = await Branch.find().populate("schoolId","schoolName");
      }else if(role =='school'){
         Branches = await Branch.find({schoolId: new ObjectId(id)}).populate("schoolId","schoolName");
      }

    if (!Branches) {
      return res.status(404).json({ message: "Branches not found" });
    }


    Branches.forEach(branch => {
      const decryptedPassword = decrypt(branch.password);
      branch.password = decryptedPassword;
    });

    res.status(200).json({ Branches});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateBranch = async (req, res) => {

  const { role } = req.user;
  const { id } = req.params;
  const { branchName, username, password, email, address, phone } = req.body;

   if (role !== 'school' && role !== 'superAdmin') {
  return res.status(403).json({ message: 'You are not a valid user.' });
}

  try {
    if (username) {
      const existingUserByUsername = await findSameUsername(username);
      if (existingUserByUsername.exists) {
        return res.status(400).json({ message: "Username already exists" });
      }
    }

    const updatedBranch = await Branch.findByIdAndUpdate(
      id,
      { branchName, username, password: encrypt(password), email, address, phone },
      { new: true }
    );

    if (!updatedBranch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.status(200).json(updatedBranch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteBranch = async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;

  if (role !== 'school' && role !== 'superAdmin') {
    return res.status(403).json({ message: 'You are not a valid user.' });
  }

  try {
    const deletedBranch = await Branch.findByIdAndDelete(id);

    if (!deletedBranch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.status(200).json({ message: "Branch deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

