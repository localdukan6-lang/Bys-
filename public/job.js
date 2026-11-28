
const API = "https://bys-9pma.onrender.com";

const box = document.getElementById("jobDetails");

document.getElementById("year").textContent =
    new Date().getFullYear();

const id = new URLSearchParams(location.search).get("id");

const esc = s =>
    String(s || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

function row(label, value) {
    return value
        ? `<tr><th>${label}</th><td>${esc(value)}</td></tr>`
        : "";
}

function section(title, content) {
    return content
        ? `<section class="detail-section">
             <h3>${title}</h3>
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
                   rel="noopener noreferrer">${label}</a>`;
    } catch {
        return "";
    }
}

// --------------------------------------------------
// MOBILE NORMALIZATION
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
            <h2>Job not selected</h2>
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
                ${row("Category", j.category)}
                ${row("Location", j.location)}
                ${row("Total Vacancies", j.vacancies)}
                ${row("Qualification", j.qualification)}
                ${row("Age Limit", j.ageLimit)}
                ${row("Salary", j.salary)}
                ${row("Application Fee", j.applicationFee)}
                ${row("Selection Process", j.selectionProcess)}
                ${row("Application Start", j.startDate)}
                ${row("Last Date", j.lastDate)}
                ${row("Exam Date", j.examDate)}
                ${row("Current Status", j.status)}
            </table>

            ${section("Job Description", j.description)}
            ${section("How to Apply", j.howToApply)}

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

                        <h3>Submit Your Interest / Application</h3>

                        <p>
                            Fill this form to register your interest
                            with BYS ASSOCIATE JOB. If the employer has
                            a separate official application link, use
                            the Apply Online button above as well.
                        </p>

                        <form id="applyForm">

                            <label>
                                Full Name *
                                <input
                                    name="applicantName"
                                    required
                                    maxlength="100"
                                >
                            </label>

                            <label>
                                Mobile Number *
                                <input
                                    name="mobile"
                                    type="tel"
                                    required
                                    inputmode="numeric"
                                    maxlength="15"
                                    autocomplete="tel"
                                >
                            </label>

                            <label>
                                Email
                                <input
                                    name="email"
                                    type="email"
                                    maxlength="150"
                                >
                            </label>

                            <label>
                                Qualification
                                <input
                                    name="qualification"
                                    maxlength="100"
                                >
                            </label>

                            <label class="wide">
                                Message
                                <textarea
                                    name="message"
                                    rows="3"
                                    maxlength="1000"
                                ></textarea>
                            </label>

                            <div class="wide">
                                <button
                                    class="primary"
                                    type="submit"
                                    id="applySubmitBtn"
                                >
                                    Submit Application
                                </button>
                            </div>

                        </form>

                        <p
                            id="applyMessage"
                            class="message"
                            role="status"
                            aria-live="polite"
                        ></p>

                    </section>
                `
            }
        `;

        const form = document.getElementById("applyForm");

        if (form) {
            form.addEventListener(
                "submit",
                submitApplication
            );
        }

    } catch (e) {

        box.innerHTML = `
            <h2>Unable to load job</h2>
            <p>${esc(e.message || "Please try again later.")}</p>
        `;
    }
}

// --------------------------------------------------
// SUBMIT JOB APPLICATION
// --------------------------------------------------

let isSubmitting = false;

async function submitApplication(e) {

    e.preventDefault();

    if (isSubmitting) {
        return;
    }

    const form = e.currentTarget;

    const msg = document.getElementById("applyMessage");

    const submitBtn = document.getElementById("applySubmitBtn");

    msg.textContent = "";
    msg.className = "message";

    const data = Object.fromEntries(
        new FormData(form).entries()
    );

    data.applicantName = String(
        data.applicantName || ""
    ).trim();

    data.mobile = cleanNumber(data.mobile);

    data.email = String(data.email || "").trim();

    data.qualification = String(
        data.qualification || ""
    ).trim();

    data.message = String(
        data.message || ""
    ).trim();

    // Validate mobile
    if (!validMobile(data.mobile)) {

        msg.textContent =
            "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।";

        return;
    }

    if (!data.applicantName) {

        msg.textContent =
            "कृपया अपना पूरा नाम दर्ज करें।";

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

        let out;

        try {
            out = await r.json();
        } catch {
            out = {};
        }

        // Duplicate application
        if (r.status === 409) {

            msg.textContent =
                out.message ||
                "आप इस Job के लिए पहले ही Application जमा कर चुके हैं। एक मोबाइल नंबर से एक Job में केवल एक Application स्वीकार किया जाएगा।";

            msg.className = "message error";

            return;
        }

        // Other server errors
        if (!r.ok) {

            msg.textContent =
                out.message ||
                "Application जमा नहीं हो पाया। कृपया दोबारा प्रयास करें।";

            msg.className = "message error";

            return;
        }

        // Successful application
        msg.textContent =
            `${out.message || "Application submitted successfully!"} Your Application ID: ${out.applicationId || ""}`;

        msg.className = "message success";

        form.reset();

    } catch (err) {

        console.error(
            "Job Application Error:",
            err
        );

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
