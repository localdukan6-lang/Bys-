require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const { Job, Application } = require("./models");

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || !process.env.ADMIN_PASSWORD || !process.env.MONGODB_URI) {
  console.error("Missing required environment variables. Copy .env.example to .env and configure it.");
  process.exit(1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.static(path.join(__dirname, "../public")));

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function adminAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Admin login required." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") throw new Error("Invalid role");
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

app.post("/api/admin/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const passwordMatches = typeof password === "string" &&
    await bcrypt.compare(password, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10));
  // Constant-time username comparison; password is compared against configured secret.
  const userMatches = typeof username === "string" &&
    crypto.timingSafeEqual(Buffer.from(username.padEnd(128).slice(0,128)), Buffer.from(expectedUser.padEnd(128).slice(0,128)));
  if (!userMatches || !passwordMatches) return res.status(401).json({ message: "Wrong username or password." });
  const token = jwt.sign({ role: "admin", username: expectedUser }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, username: expectedUser });
}));

app.get("/api/jobs", asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.category && ["Government", "Private"].includes(req.query.category)) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) filter.$or = [
    { title: { $regex: req.query.q, $options: "i" } },
    { organization: { $regex: req.query.q, $options: "i" } },
    { qualification: { $regex: req.query.q, $options: "i" } }
  ];
  const jobs = await Job.find(filter).sort({ featured: -1, createdAt: -1 }).lean();
  res.json(jobs);
}));

app.get("/api/jobs/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid job ID." });
  const job = await Job.findById(req.params.id).lean();
  if (!job) return res.status(404).json({ message: "Job not found." });
  res.json(job);
}));

app.post("/api/jobs/:id/apply", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid job ID." });
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ message: "Job not found." });
  if (["Application Closed", "Result Declared"].includes(job.status)) {
    return res.status(400).json({ message: "Applications are closed for this job." });
  }
  const { applicantName, mobile, email, qualification, message } = req.body;
  if (!applicantName || !mobile || !/^[0-9+\-\s]{10,15}$/.test(mobile)) {
    return res.status(400).json({ message: "Please enter your name and a valid mobile number." });
  }
  const applicationId = "BYS" + Date.now().toString().slice(-8) + crypto.randomBytes(2).toString("hex").toUpperCase();
  const application = await Application.create({
    applicationId, job: job._id, applicantName, mobile, email, qualification, message
  });
  res.status(201).json({ message: "Application submitted successfully.", applicationId: application.applicationId });
}));

// Admin-only endpoints
app.get("/api/admin/jobs", adminAuth, asyncHandler(async (req, res) => {
  res.json(await Job.find().sort({ createdAt: -1 }).lean());
}));

app.post("/api/admin/jobs", adminAuth, asyncHandler(async (req, res) => {
  const job = await Job.create(req.body);
  res.status(201).json(job);
}));

app.put("/api/admin/jobs/:id", adminAuth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid job ID." });
  const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!job) return res.status(404).json({ message: "Job not found." });
  res.json(job);
}));

app.delete("/api/admin/jobs/:id", adminAuth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid job ID." });
  await Job.findByIdAndDelete(req.params.id);
  await Application.deleteMany({ job: req.params.id });
  res.json({ message: "Job and its applications deleted." });
}));

app.get("/api/admin/applications", adminAuth, asyncHandler(async (req, res) => {
  const applications = await Application.find()
    .populate("job", "title organization")
    .sort({ createdAt: -1 }).lean();
  res.json(applications);
}));

app.patch("/api/admin/applications/:id/status", adminAuth, asyncHandler(async (req, res) => {
  const allowed = ["Pending", "Under Review", "Approved", "Rejected"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "Invalid status." });
  const application = await Application.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true })
    .populate("job", "title");
  if (!application) return res.status(404).json({ message: "Application not found." });
  res.json(application);
}));

app.get("/api/health", (req, res) => res.json({ ok: true, name: "BYS ASSOCIATE JOB API" }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ message: "Duplicate record." });
  res.status(500).json({ message: "Server error. Please try again later." });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`BYS ASSOCIATE JOB running on port ${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
