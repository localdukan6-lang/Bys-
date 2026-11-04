const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  organization: { type: String, default: "" },
  category: { type: String, enum: ["Government", "Private"], default: "Private" },
  location: { type: String, default: "India" },
  vacancies: { type: String, default: "" },
  qualification: { type: String, default: "" },
  ageLimit: { type: String, default: "" },
  salary: { type: String, default: "" },
  applicationFee: { type: String, default: "" },
  selectionProcess: { type: String, default: "" },
  startDate: { type: String, default: "" },
  lastDate: { type: String, default: "" },
  examDate: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Upcoming", "Application Started", "Last Date Extended", "Application Closed", "Admit Card Released", "Exam Date Announced", "Answer Key Released", "Result Declared"],
    default: "Application Started"
  },
  description: { type: String, default: "" },
  howToApply: { type: String, default: "" },
  applyLink: { type: String, default: "" },
  notificationLink: { type: String, default: "" },
  officialLink: { type: String, default: "" },
  syllabusLink: { type: String, default: "" },
  featured: { type: Boolean, default: false }
}, { timestamps: true });

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, unique: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  applicantName: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  qualification: { type: String, default: "" },
  message: { type: String, default: "" },
  status: { type: String, enum: ["Pending", "Under Review", "Approved", "Rejected"], default: "Pending" }
}, { timestamps: true });

module.exports = {
  Job: mongoose.model("Job", jobSchema),
  Application: mongoose.model("Application", applicationSchema)
};
