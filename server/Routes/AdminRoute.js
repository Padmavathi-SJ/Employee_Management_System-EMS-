import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";

// Workaround for __dirname in ES modules
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

router.post("/adminLogin", (req, res) => {
  const sql = "SELECT * FROM admin WHERE email = ? and password = ?";
  con.query(sql, [req.body.email, req.body.password], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query Error" });
    if (result.length > 0) {
      const email = result[0].email;
      const token = jwt.sign({ role: "admin", email: email }, "jwt_secret_key", {
        expiresIn: "1d",
      });
      res.cookie("token", token);
      return res.json({ loginStatus: true });
    } else {
      return res.json({ loginStatus: false, Error: "Wrong email or password" });
    }
  });
});

router.post("/add_category", (req, res) => {
  const sql = "INSERT INTO category (`name`) VALUES (?)";
  con.query(sql, [req.body.category], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true });
  });
});

router.get("/category", (req, res) => {
  const sql = "SELECT * FROM category";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

// Configure multer to handle file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // specify the folder where images will be stored
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // timestamp-based unique filename
  },
});

const upload = multer({ storage: storage });

// API endpoint to handle profile picture upload
router.post("/add_employee", upload.single("profile_picture"), (req, res) => {
  const { id, name, department, role, salary, dob, qualification, address, experience } = req.body;
  const profilePicture = req.file ? req.file.filename : null; // Use the filename of the uploaded image

  // Check if all required fields are provided
  if (!id || !name || !department || !role || !salary || !dob || !qualification || !address || !experience) {
    return res.json({ Status: false, Error: "Missing required fields" });
  }

  // SQL query to insert employee data along with the profile picture filename
  const sql = `INSERT INTO employees (id, name, department, role, salary, dob, qualification, address, experience, profile_picture)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  con.query(sql, [id, name, department, role, salary, dob, qualification, address, experience, profilePicture], (err, result) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }
    return res.json({ Status: true, Message: "Employee added successfully" });
  });
});

router.get("/employees", (req, res) => {
  const sql = "SELECT id, profile_picture, name, department, role FROM employees";

  con.query(sql, (err, result) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }
    return res.json({ Status: true, Result: result });
  });
});

router.get("/employees/:id", (req, res) => {
  const { id } = req.params;

  const sql = "SELECT id, profile_picture, name, department, role FROM employees WHERE id = ?";
  con.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.status(500).json({ Status: false, Error: "Query Error" });
    }
    if (result.length === 0) {
      return res.status(404).json({ Status: false, Error: "Employee not found." });
    }
    return res.json({ Status: true, Result: result[0] });
  });
});

// Update employee
router.put("/employees/:id", upload.single("profile_picture"), (req, res) => {
  const { name, department, role } = req.body;
  const profilePicture = req.file ? req.file.filename : null;

  let sql = `UPDATE employees SET name=?, department=?, role=?`;
  const params = [name, department, role];

  if (profilePicture) {
    sql += `, profile_picture=?`;
    params.push(profilePicture);
  }

  sql += ` WHERE id=?`;
  params.push(req.params.id);

  con.query(sql, params, (err, result) => {
    if (err) {
      console.error("Error updating employee:", err);
      return res.status(500).json({ Status: false, Error: "Database Error" });
    }

    if (profilePicture) {
      // If a new profile picture was uploaded, remove the old one
      const oldProfilePictureQuery = "SELECT profile_picture FROM employees WHERE id = ?";
      con.query(oldProfilePictureQuery, [req.params.id], (err, oldResult) => {
        if (err) {
          console.error("Error fetching old profile picture:", err);
        } else {
          const oldProfilePicture = oldResult[0].profile_picture;
          if (oldProfilePicture) {
            const filePath = path.join(__dirname, "../uploads", oldProfilePicture);
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                console.error("Error deleting old profile picture:", unlinkErr);
              }
            });
          }
        }
      });
    }

    res.json({ Status: true, Message: "Employee updated successfully." });
  });
});

// Delete employee
router.delete("/employees/:id", (req, res) => {
  const { id } = req.params;

  // Step 1: Fetch the employee to get the profile picture
  const fetchSql = "SELECT profile_picture FROM employees WHERE id = ?";
  con.query(fetchSql, [id], (fetchErr, fetchResult) => {
    if (fetchErr) {
      console.error("Error fetching employee:", fetchErr);
      return res.json({ Status: false, Error: "Failed to fetch employee details" });
    }

    if (fetchResult.length === 0) {
      return res.json({ Status: false, Error: "Employee not found" });
    }

    const profilePicture = fetchResult[0].profile_picture;

    // Step 2: Delete the employee from the database
    const deleteSql = "DELETE FROM employees WHERE id = ?";
    con.query(deleteSql, [id], (deleteErr, deleteResult) => {
      if (deleteErr) {
        console.error("Error deleting employee:", deleteErr);
        return res.json({ Status: false, Error: "Failed to delete employee" });
      }

      if (deleteResult.affectedRows === 0) {
        return res.json({ Status: false, Error: "Employee not found" });
      }

      // Step 3: Remove the profile picture file if it exists
      if (profilePicture) {
        const filePath = path.join(__dirname, "../uploads", profilePicture);
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Error deleting profile picture:", unlinkErr);
          }
        });
      }

      return res.json({ Status: true, Message: "Employee deleted successfully" });
    });
  });
});

export { router as adminRouter };
