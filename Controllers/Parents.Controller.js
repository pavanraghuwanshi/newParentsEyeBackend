
import { populate } from 'dotenv';
import Parent from '../Models/parents.js';
import School from '../Models/school.js';
import { encrypt } from '../Utils/crypto.js';
import findSameUsername  from '../Utils/findSameUsername.js';

export const addParent = async (req, res) => {
  const {
    parentName,
    username,
    password,
    email,
    schoolMobile,
    fullAccess,
    schoolId,
    branchId,
  } = req.body;

  const role = req.user.role;
  console.log("role", role);

  if (role !== 'school' && role !== 'superAdmin') {
    return res.status(403).json({ message: 'You are not authorized to perform this action.' });
  }

  try {
   
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    
    const existingUser = await findSameUsername(username);
    if (existingUser.exists) {
      return res.status(400).json({ message: "This username already exists" });
    }

  
    const encryptedPassword = encrypt(password);

 
    const newParent = new Parent({
      parentName,
      username,
      password: encryptedPassword,
      email,
      schoolMobile,
      fullAccess: fullAccess || false,
      schoolId,
      branchId,
    });

    await newParent.save();

    res.status(201).json({ message: "Parent added successfully", parent: newParent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Get all parents
export const getParents = async (req, res) => {

  const { id } = req.user;
  const { role, AssignedBranch } = req.user;

  try {
    let parents;

    if (role === 'superAdmin') {
    parents = await Parent.find().populate("schoolId", "schoolName").populate("branchId", "branchName");
} else if (role === 'school') {
    parents = await Parent.find({ schoolId:id }).populate("schoolId", "schoolName").populate("branchId", "branchName");
} else if (role === 'branchGroup') {
    parents = await Parent.find({ branchId: { $in: AssignedBranch }}).populate("schoolId", "schoolName").populate("branchId", "branchName");
}else if (role === 'branch') {
    parents = await Parent.find({ branchId: id}).populate("schoolId", "schoolName").populate("branchId", "branchName");
}

    if (!parents) {
      return res.status(404).json({ message: "parents not found" });
    }
    return res.status(200).json({ parents });
   
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get parent by ID
// export const getParentById = async (req, res) => {
//   try {
//     const parent = await Parent.findById(req.params.id)
//       .populate('schoolId', 'schoolName')
//       .populate('branchId', 'branchName')
//       .populate('branches', 'branchName');
    
//     if (!parent) {
//       return res.status(404).json({ message: 'Parent not found' });
//     }

//     res.status(200).json(parent);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// Update parent by ID
export const updateParent = async (req, res) => {
  const { role } = req.user;
  const { id } = req.params;
  const {parentName,
    username,
    password,
    email,
    schoolMobile,
    fullAccess,
    schoolId,
    branchId, } = req.body;

  if (role !== 'school' && role !== 'superAdmin' && role !== 'branchGroup' && role !== 'branch') {
    return res.status(403).json({ message: 'You are not a valid user.' });
  }

  try {
    if (username) {
      const existingUserByUsername = await findSameUsername(username);
      if (existingUserByUsername.exists) {
        return res.status(400).json({ message: "Username already exists" });
      }
    }

    const updateData = {
     parentName,
    username,
    password,
    email,
    schoolMobile,
    fullAccess,
    schoolId,
    branchId,
    };

    if (password) {
      updateData.password = encrypt(password);
    }

    const updatedParent = await Parent.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedParent) {
      return res.status(404).json({ message: "Parent not found" });
    }

    res.status(200).json(updatedParent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Delete parent by ID
export const deleteParent = async (req, res) => {
  try {
    const deletedParent = await Parent.findByIdAndDelete(req.params.id);

    if (!deletedParent) {
      return res.status(404).json({ message: 'Parent not found' });
    }

    res.status(200).json({ message: 'Parent deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
