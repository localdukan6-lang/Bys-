
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

function labelName(key) {
    return key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    if (Array.isArray(value)) {
        return value.map(v =>
            typeof v === "object" ? JSON.stringify(v) : String(v)
        ).join(", ");
    }

    if (typeof value === "object") {
        return Object.entries(value)
            .map(([k, v]) => `${labelName(k)}: ${formatValue(v)}`)
            .join(" | ");
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    return String(value);
}

function row(label, value) {
    const formatted = formatValue(value);

    return formatted
        ? `<tr>
             <th>${esc(label)}</th>
             <td>${esc(formatted)}</td>
           </tr>`
        : "";
}

function section(title, content) {
    const value = formatValue(content);

    return value
        ? `<section class="detail-section">
             <h3>${esc(title)}</h3>
             <div class="content">${esc(value)}</div>
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
// DYNAMIC JOB FIELDS
// --------------------------------------------------

const hiddenJobFields = new Set([
    "id",
    "_id",
    "createdAt",
    "updatedAt",
    "created_at",
    "updated_at",
    "deletedAt",
    "deleted_at",
    "isDeleted",
    "is_deleted",
    "adminId",
    "userId",
    "password"
]);

const linkFields = {
    applyLink: "Apply Online",
    notificationLink: "Download Notification",
    officialLink: "Official Website",
    syllabusLink: "Syllabus"
};

const longFields = {
    description: "Job Description",
    responsibilities: "Job Responsibilities",
    howToApply: "How to Apply",
    additionalInformation: "Additional Information"
};

function renderAllJobFields(j) {

    let html = "";

    for (const [key, value] of Object.entries(j)) {

        if (hiddenJobFields.has(key)) continue;

        if (value === null || value === undefined || value === "") {
            continue;
        }

        if (linkFields[key] || longFields[key]) continue;

        html += row(labelName(key), value);
    }

    return html;
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
// LOAD JOB
// --------------------------------------------------

async function load() {

    if (!id) {
        box.innerHTML = `
            <h2>Job Not Selected</h2>
            <p>Please select a job from the home page.</p>
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

        box.innerHTML = `

            <h2>${esc(j.title || "Job Details")}</h2>

            <p>
                <b>${esc(j.organization || "")}</b>
                <span class="badge">${esc(j.category || "")}</span>
                <span class="badge">${esc(j.status || "")}</span>
            </p>

            <section class="detail-section">

                <h3>Complete Job Information</h3>

                <table class="detail-table">

                    ${renderAllJobFields(j)}

                </table>

            </section>

            ${section("Job Description", j.description)}
            ${section("Job Responsibilities", j.responsibilities)}
            ${section("How to Apply", j.howToApply)}
            ${section("Additional Information", j.additionalInformation)}

            <section class="detail-section">

                <h3>Important Links</h3>

                <div class="important-links">

                    ${Object.entries(linkFields).map(
                        ([key, label]) => link(label, j[key])
                    ).join("")}

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

                        <h3>Quick Job Application</h3>

                        <p>
                            Fill in your basic details to apply for this job.
                        </p>

                        <form id="applyForm">

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
                                Mobile Number *
                                <input name="mobile"
                                    type="tel"
                                    required
                                    inputmode="numeric"
                                    maxlength="15"
                                    autocomplete="tel">
                            </label>

                            <label>
                                Email
                                <input name="email"
                                    type="email"
                                    maxlength="150">
                            </label>

                            <label>
                                Date of Birth *
                                <input name="dob"
                                    type="date"
                                    required>
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
                                Qualification *
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
                                Experience *
                                <select name="experienceStatus" required>
                                    <option value="">Select Experience</option>
                                    <option value="Fresher">Fresher</option>
                                    <option value="Experienced">Experienced</option>
                                </select>
                            </label>

                            <label>
                                Experience (Years)
                                <input name="experienceYears"
                                    type="number"
                                    min="0"
                                    max="60"
                                    value="0">
                            </label>

                            <label>
                                Current / Previous Company
                                <input name="company"
                                    maxlength="150">
                            </label>

                            <label class="wide">
                                Full Address *
                                <textarea name="address"
                                    rows="2"
                                    required
                                    maxlength="500"></textarea>
                            </label>

                            <label>
                                District *
                                <input name="district"
                                    required maxlength="100">
                            </label>

                            <label>
                                State *
                                <input name="state"
                                    required maxlength="100">
                            </label>

                            <label>
                                PIN Code *
                                <input name="pincode"
                                    required
                                    inputmode="numeric"
                                    maxlength="6">
                            </label>
                             <label class="wide">
                                 Message / Description
                                   <textarea
                                   name="message"
                                   rows="4"
                                   maxlength="2000"
                                   placeholder="यहाँ अपनी अतिरिक्त जानकारी, अनुभव या कोई अन्य बात लिखें..."></textarea>
                            </label>
                            <label class="wide">
                                <input type="checkbox"
                                    name="declaration"
                                    value="Yes"
                                    required>
                                I confirm that the information provided
                                is correct.
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

    for (const key of Object.keys(data)) {
        if (typeof data[key] === "string") {
            data[key] = data[key].trim();
        }
    }

    data.mobile = cleanNumber(data.mobile);

    if (!validMobile(data.mobile)) {
        msg.textContent = "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।";
        msg.className = "message error";
        return;
    }

    if (!/^\d{6}$/.test(data.pincode)) {
        msg.textContent = "कृपया सही 6 अंकों का PIN Code दर्ज करें।";
        msg.className = "message error";
        return;
    }

    if (data.experienceStatus === "Fresher") {
        data.experienceYears = "0";
    }

    if (
        !/^\d+$/.test(data.experienceYears) ||
        Number(data.experienceYears) > 60
    ) {
        msg.textContent = "कृपया सही Experience दर्ज करें।";
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

        console.error("Application Error:", err);

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
