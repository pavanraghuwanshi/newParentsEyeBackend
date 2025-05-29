import BranchGroup from "../Models/branchGroup.js";
import  School  from "../Models/school.js";
import { decrypt, encrypt } from "../Utils/crypto.js";
import findSameUsername from "../Utils/findSameUsername.js";


export const addBranchGroup = async (req, res) => {
     const {
       branchGroupName,
       username,
       password,
       AssignedBranch,
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
       const newBranchGroup = new BranchGroup({
         branchGroupName,
         username,
         password:encryptedPassword,
         AssignedBranch,
         email,
         address,
         phone,
         schoolId
       });
   
       await newBranchGroup.save();
   
       res.status(201).json({ message: "Branch added successfully", branchGroup: newBranchGroup });
   
     } catch (err) {
       res.status(500).json({ message: err.message });
     }
   };

export const getBranchGroups = async (req, res) => {
  const role = req.user.role;
  
  try {
    
    let BranchGroups;
    if(role=='superAdmin'){
         BranchGroups = await BranchGroup.find().populate("schoolId","schoolName");
      }else if(role =='school'){
         BranchGroups = await BranchGroup.find({schoolId: new ObjectId(id)}).populate("schoolId","schoolName");
      }

    if (!BranchGroups || BranchGroups.length === 0) {
      return res.status(404).json({ message: "Branches not found" });
    }


    BranchGroups.forEach(branchgroup => {
      const decryptedPassword = decrypt(branchgroup.password);
      branchgroup.password = decryptedPassword;
    });

    
    res.status(200).json(BranchGroups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export const updateBranchGroup = async (req, res) => {

  const { role } = req.user;
  const { id } = req.params;
  const { branchGroupName, username, password, email, address, phone } = req.body;

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

    const updatedBranchGroup = await BranchGroup.findByIdAndUpdate(
      id,
      { branchGroupName, username, password: encrypt(password), email, address, phone },
      { new: true }
    );

    if (!updatedBranchGroup) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.status(200).json(updatedBranchGroup);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteBranchGroup = async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;

  if (role !== 'school' && role !== 'superAdmin') {
    return res.status(403).json({ message: 'You are not a valid user.' });
  }

  try {
    const deletedBranchGroup = await BranchGroup.findByIdAndDelete(id);

    if (!deletedBranchGroup) {
      return res.status(404).json({ message: "Branch Group not found" });
    }

    res.status(200).json({ message: "Branch Group deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
