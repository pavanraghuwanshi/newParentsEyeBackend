import School from  "../Models/school.js";
import Branch from '../Models/branch.js';
import Child from '../Models/child.js';
import findSameUsername from "../Utils/findSameUsername.js";
import { decrypt, encrypt } from "../Utils/crypto.js";
import { populate } from "dotenv";



export const addChild = async (req, res) => {
  const {
    childName,
    username,
    password,
    email,
    schoolMobile,
    schoolId,
    branchId,
    parentId,
  } = req.body;

  const role = req.user.role;
  console.log("role", role);

  if (role !== 'school' && role !== 'superAdmin' && role !== 'branch') {
    return res.status(403).json({ message: 'You are not authorized to perform this action.' });
  }

  try {
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const existingUser = await findSameUsername(username);
    if (existingUser.exists) {
      return res.status(400).json({ message: "This username already exists" });
    }

    const encryptedPassword = encrypt(password);

    const newChild = new Child({
      childName,
      username,
      password: encryptedPassword,
      email,
      schoolMobile,
      schoolId,
      branchId,
      parentId
    });

    await newChild.save();

    res.status(201).json({ message: "Child added successfully", child: newChild });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getChilds = async (req, res) => {
  const { id, role,AssignedBranch } = req.user;

//   const ObjectId = mongoose.Types.ObjectId;
  let children;

  try {
    if (role === "superAdmin") {
      children = await Child.find()
      .populate("schoolId", "schoolName")
      .populate("branchId", "branchName")
      .populate("parentId", "parentName");
    } else if (role === "school") {
      children = await Child.find({ schoolId: id })
        .populate("schoolId", "schoolName")
        .populate("branchId", "branchName")
        .populate("parentId", "parentName");
    } else if (role === "branchGroup") {
      children = await Child.find({ branchId: { $in: AssignedBranch } })
        .populate("schoolId", "schoolName")
        .populate("branchId", "branchName")
        .populate("parentId", "parentName");
    }else if (role === "branch") {
      children = await Child.find({ branchId: id})
        .populate("schoolId", "schoolName")
        .populate("branchId", "branchName")
        .populate("parentId", "parentName");
    }else if (role === "parent") {
      children = await Child.find({ parentId: id })
        .populate("schoolId", "schoolName")
        .populate("branchId", "branchName")
        populate("parentId", "parentName");
    }

    if (!children) {
      return res.status(404).json({ message: "Children not found" });
    }

    children.forEach(child => {
      const decryptedPassword = decrypt(child.password);
      child.password = decryptedPassword;
    });

    res.status(200).json({ children });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateChild = async (req, res) => {
  const { role } = req.user;
  const { id } = req.params;

  const {
    childName,
    username,
    password,
    email,
    schoolId,
    branchId,
    parentId,
    className,
    section,
    rollNumber,
    schoolMobile,

  } = req.body;

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
      childName,
      username,
      password,
      email,
      parentId,
      schoolId,
      branchId,
      className,
      section,
      rollNumber,
      schoolMobile
    };

    if (password) {
      updateData.password = encrypt(password);
    }

    const updatedChild = await Child.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedChild) {
      return res.status(404).json({ message: "Child not found" });
    }

    res.status(200).json(updatedChild);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteChild = async (req, res) => {
  const { ids } = req.params;
  const { role } = req.user;

  console.log("Requested IDs:", ids);

  if (!['school', 'superAdmin', 'branchGroup', 'branch', 'parent'].includes(role)) {
    return res.status(403).json({ message: 'You are not authorized to perform this action.' });
  }

  try {
    // Convert comma-separated string to array and validate ObjectIds
    const arrayOfIds = ids.split(',').map(id => id.trim());

    const deletedChildren = await Child.deleteMany({ _id: { $in: arrayOfIds } });


    if (!deletedChildren || deletedChildren.deletedCount === 0) {
      return res.status(404).json({ message: "Child not found" });
    }

    res.status(200).json({ message: "Children deleted successfully", deletedCount: deletedChildren.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
