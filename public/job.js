
const API = "https://bys-9pma.onrender.com";

const box = document.getElementById("jobDetails");

document.getElementById("year").textContent =
    new Date().getFullYear();

const id = new URLSearchParams(location.search).get("id");

const esc = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

function getValue(obj, ...keys) {
    for (const key of keys) {
        const value = obj[key];
        if (value !== undefined && value !== null && value !== "") {
            return Array.isArray(value) ? value.join(", ") : value;
        }
    }
    return "";
}

function row(label, value) {
    return value !== ""
        ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`
        : "";
}

function section(title, content) {
    return content
        ? `<section class="detail-section">
             <h3>${esc(title)}</h3>
             <div class="content">${esc(content)}</div>
           </section>`
        : "";
}

function link(label, url) {
    if (!url) return "";

    try {
        const u = new URL(url);

        if (!["http:", "https:"].includes(u.protocol)) {
            return "";
        }

        return `<a href="${esc(u.href)}"
                   target="_blank"
                   rel="noopener noreferrer">${esc(label)}</a>`;
    } catch {
        return "";
    }
}

// --------------------------------------------------
// MOBILE VALIDATION
// --------------------------------------------------

function cleanNumber(value) {
    let mobile = String(value || "").replace(/\D/g, "");

    if (mobile.length === 12 && mobile.startsWith("91")) {
        mobile = mobile.slice(2);
    }

    if (mobile.length === 11 && mobile.startsWith("0")) {
        mobile = mobile.slice(1);
    }

    return mobile;
}

function validMobile(value) {
    return /^[6-9]\d{9}$/.test(value);
}

// --------------------------------------------------
// LOAD JOB DETAILS
// --------------------------------------------------

async function load() {

    if (!id) {
        box.innerHTML = `
            <h2>Job Not Selected</h2>
            <p>Please return to the home page and select a job.</p>
        `;
        return;
    }

    try {

        const r = await fetch(
            `${API}/api/jobs/${encodeURIComponent(id)}`
        );

        const j = await r.json();

        if (!r.ok) {
            throw new Error(j.message || "Unable to load job.");
        }

        const closed = [
            "Application Closed",
            "Result Declared"
        ].includes(j.status);

        // Job details - include experience and other fields
        box.innerHTML = `
            <h2>${esc(j.title)}</h2>

            <p>
                <b>${esc(j.organization)}</b>
                &nbsp;
                <span class="badge">${esc(j.category)}</span>
                <span class="badge">${esc(j.status)}</span>
            </p>

            <table class="detail-table">

                ${row("Organization", j.organization)}
                ${row("Job Title", j.title)}
                ${row("Category", j.category)}
                ${row("Department", j.department)}
                ${row("Job Type", getValue(j, "jobType", "employmentType"))}
                ${row("Work Mode", getValue(j, "workMode", "workLocation"))}
                ${row("Location", j.location)}

                ${row("Total Vacancies", j.vacancies)}
                ${row("Qualification", j.qualification)}
                ${row("Required Skills", getValue(j, "requiredSkills", "skills"))}

                ${row("Experience Required", getValue(j, "experience", "experienceRequired", "experienceLevel"))}
                ${row("Age Limit", j.ageLimit)}
                ${row("Salary", j.salary)}

                ${row("Application Fee", j.applicationFee)}
                ${row("Selection Process", j.selectionProcess)}

                ${row("Application Start", j.startDate)}
                ${row("Last Date", j.lastDate)}
                ${row("Exam Date", j.examDate)}
                ${row("Interview Date", j.interviewDate)}
                ${row("Result Date", j.resultDate)}

                ${row("Current Status", j.status)}

            </table>

            ${section("Job Description", j.description)}
            ${section("Job Responsibilities", j.responsibilities)}
            ${section("Required Skills", getValue(j, "requiredSkills", "skills"))}
            ${section("Experience Details", getValue(j, "experience", "experienceRequired", "experienceLevel"))}
            ${section("How to Apply", j.howToApply)}
            ${section("Additional Information", j.additionalInformation)}

            <section class="detail-section">

                <h3>Important Links</h3>

                <div class="important-links">
                    ${link("Apply Online", j.applyLink)}
                    ${link("Download Notification", j.notificationLink)}
                    ${link("Official Website", j.officialLink)}
                    ${link("Syllabus", j.syllabusLink)}
                </div>

            </section>

            ${
                closed
                ? `
                    <p class="message">
                        Applications are currently closed for this job.
                    </p>
                `
                : `
                    <section class="apply-box">

                        <h3>Job Application Form</h3>

                        <p>
                            Please complete all required information
                            carefully before submitting your application.
                        </p>

                        <form id="applyForm">

                            <h4>1. Personal Information</h4>

                            <label>
                                Full Name *
                                <input name="applicantName"
                                    required maxlength="100"
                                    autocomplete="name">
                            </label>

                            <label>
                                Father's Name *
                                <input name="fatherName"
                                    required maxlength="100">
                            </label>

                            <label>
                                Mother's Name
                                <input name="motherName"
                                    maxlength="100">
                            </label>

                            <label>
                                Date of Birth *
                                <input name="dob"
                                    type="date" required>
                            </label>

                            <label>
                                Gender *
                                <select name="gender" required>
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </label>

                            <label>
                                Marital Status
                                <select name="maritalStatus">
                                    <option value="">Select</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Other">Other</option>
                                </select>
                            </label>

                            <label>
                                Category
                                <select name="applicantCategory">
                                    <option value="">Select Category</option>
                                    <option value="General">General</option>
                                    <option value="OBC">OBC</option>
                                    <option value="SC">SC</option>
                                    <option value="ST">ST</option>
                                    <option value="EWS">EWS</option>
                                    <option value="Other">Other</option>
                                </select>
                            </label>

                            <label>
                                Nationality
                                <input name="nationality"
                                    value="Indian" maxlength="50">
                            </label>

                            <h4>2. Contact Information</h4>

                            <label>
                                Mobile Number *
                                <input name="mobile"
                                    type="tel"
                                    required
                                    inputmode="numeric"
                                    maxlength="15"
                                    autocomplete="tel">
                            </label>

                            <label>
                                Alternate Mobile Number
                                <input name="alternateMobile"
                                    type="tel"
                                    inputmode="numeric"
                                    maxlength="15">
                            </label>

                            <label>
                                Email Address *
                                <input name="email"
                                    type="email"
                                    required
                                    maxlength="150"
                                    autocomplete="email">
                            </label>

                            <h4>3. Address Information</h4>

                            <label class="wide">
                                Full Address *
                                <textarea name="address"
                                    rows="3"
                                    required
                                    maxlength="500"></textarea>
                            </label>

                            <label>
                                State *
                                <input name="state"
                                    required maxlength="100">
                            </label>

                            <label>
                                District *
                                <input name="district"
                                    required maxlength="100">
                            </label>

                            <label>
                                City / Village *
                                <input name="city"
                                    required maxlength="100">
                            </label>

                            <label>
                                PIN Code *
                                <input name="pincode"
                                    required
                                    inputmode="numeric"
                                    maxlength="6">
                            </label>

                            <h4>4. Educational Qualification</h4>

                            <label>
                                Highest Qualification *
                                <select name="qualification" required>
                                    <option value="">Select Qualification</option>
                                    <option value="10th">10th</option>
                                    <option value="12th">12th</option>
                                    <option value="ITI">ITI</option>
                                    <option value="Diploma">Diploma</option>
                                    <option value="Graduation">Graduation</option>
                                    <option value="Post Graduation">Post Graduation</option>
                                    <option value="B.Tech">B.Tech</option>
                                    <option value="Other">Other</option>
                                </select>
                            </label>

                            <label>
                                Course / Trade / Stream
                                <input name="course"
                                    maxlength="150">
                            </label>

                            <label>
                                Passing Year
                                <input name="passingYear"
                                    type="number"
                                    min="1950"
                                    max="2100">
                            </label>

                            <label>
                                University / Board / Institute
                                <input name="institute"
                                    maxlength="200">
                            </label>

                            <label>
                                Percentage / CGPA
                                <input name="percentage"
                                    maxlength="20">
                            </label>

                            <h4>5. Work Experience</h4>

                            <label>
                                Experience Status *
                                <select name="experienceStatus" required>
                                    <option value="">Select</option>
                                    <option value="Fresher">Fresher</option>
                                    <option value="Experienced">Experienced</option>
                                </select>
                            </label>

                            <label>
                                Total Experience (Years)
                                <input name="experienceYears"
                                    type="number"
                                    min="0"
                                    max="60"
                                    value="0">
                            </label>

                            <label>
                                Additional Experience (Months)
                                <input name="experienceMonths"
                                    type="number"
                                    min="0"
                                    max="11"
                                    value="0">
                            </label>

                            <label>
                                Current / Previous Company
                                <input name="company"
                                    maxlength="150">
                            </label>

                            <label>
                                Previous Job Designation
                                <input name="designation"
                                    maxlength="150">
                            </label>

                            <label class="wide">
                                Skills
                                <textarea name="applicantSkills"
                                    rows="3"
                                    maxlength="1000"
                                    placeholder="Enter your skills"></textarea>
                            </label>

                            <h4>6. Resume and Additional Information</h4>

                            <label class="wide">
                                Resume / CV Link
                                <input name="resumeLink"
                                    type="url"
                                    maxlength="500"
                                    placeholder="Google Drive or other resume link">
                            </label>

                            <label class="wide">
                                Additional Message
                                <textarea name="message"
                                    rows="4"
                                    maxlength="1000"></textarea>
                            </label>

                            <label class="wide">
                                <input type="checkbox"
                                    name="declaration"
                                    value="Yes"
                                    required>
                                I declare that the information provided
                                above is correct.
                            </label>

                            <div class="wide">
                                <button
                                    class="primary"
                                    type="submit"
                                    id="applySubmitBtn">
                                    Submit Application
                                </button>
                            </div>

                        </form>

                        <p id="applyMessage"
                            class="message"
                            role="status"
                            aria-live="polite"></p>

                    </section>
                `
            }
        `;

        const form = document.getElementById("applyForm");

        if (form) {
            form.addEventListener("submit", submitApplication);
        }

    } catch (e) {

        box.innerHTML = `
            <h2>Unable to load job</h2>
            <p>${esc(e.message || "Please try again later.")}</p>
        `;
    }
}

// --------------------------------------------------
// SUBMIT APPLICATION
// --------------------------------------------------

let isSubmitting = false;

async function submitApplication(e) {

    e.preventDefault();

    if (isSubmitting) return;

    const form = e.currentTarget;
    const msg = document.getElementById("applyMessage");
    const submitBtn = document.getElementById("applySubmitBtn");

    msg.textContent = "";
    msg.className = "message";

    const data = Object.fromEntries(
        new FormData(form).entries()
    );

    // Clean text fields
    for (const key of Object.keys(data)) {
        if (typeof data[key] === "string") {
            data[key] = data[key].trim();
        }
    }

    data.mobile = cleanNumber(data.mobile);

    if (data.alternateMobile) {
        data.alternateMobile = cleanNumber(data.alternateMobile);
    }

    if (!validMobile(data.mobile)) {
        msg.textContent = "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।";
        msg.className = "message error";
        return;
    }

    if (
        data.alternateMobile &&
        !validMobile(data.alternateMobile)
    ) {
        msg.textContent = "Alternate Mobile Number सही दर्ज करें।";
        msg.className = "message error";
        return;
    }

    if (!/^\d{6}$/.test(data.pincode)) {
        msg.textContent = "कृपया सही 6 अंकों का PIN Code दर्ज करें।";
        msg.className = "message error";
        return;
    }

    if (
        data.experienceYears === "" ||
        data.experienceMonths === ""
    ) {
        msg.textContent = "कृपया अपना Experience दर्ज करें।";
        msg.className = "message error";
        return;
    }

    if (
        data.experienceStatus === "Fresher" &&
        (
            Number(data.experienceYears) > 0 ||
            Number(data.experienceMonths) > 0
        )
    ) {
        msg.textContent =
            "Fresher के लिए Experience Years और Months शून्य रखें।";
        msg.className = "message error";
        return;
    }

    isSubmitting = true;

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {

        const r = await fetch(
            `${API}/api/jobs/${encodeURIComponent(id)}/apply`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        let out = {};

        try {
            out = await r.json();
        } catch {}

        if (r.status === 409) {

            msg.textContent =
                out.message ||
                "आप इस Job के लिए पहले ही Application जमा कर चुके हैं।";

            msg.className = "message error";
            return;
        }

        if (!r.ok) {

            msg.textContent =
                out.message ||
                "Application जमा नहीं हो पाया। कृपया दोबारा प्रयास करें।";

            msg.className = "message error";
            return;
        }

        msg.textContent =
            `${out.message || "Application submitted successfully!"} Application ID: ${out.applicationId || ""}`;

        msg.className = "message success";

        form.reset();

    } catch (err) {

        console.error("Job Application Error:", err);

        msg.textContent =
            "Server से संपर्क नहीं हो पाया। कृपया थोड़ी देर बाद प्रयास करें।";

        msg.className = "message error";

    } finally {

        isSubmitting = false;

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
    }
}

load();
