
const API = "https://bys-9pma.onrender.com";

const jobDetails = document.getElementById("jobDetails");
const yearElement = document.getElementById("year");

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}

// --------------------------------------------------
// SAFE HTML
// --------------------------------------------------

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// --------------------------------------------------
// GET JOB ID FROM URL
// Supports: job-details.html?id=123
// --------------------------------------------------

function getJobId() {

    const params = new URLSearchParams(window.location.search);

    return params.get("id") ||
           params.get("jobId") ||
           params.get("job");
}

// --------------------------------------------------
// DISPLAY JOB DETAILS
// --------------------------------------------------

function displayJob(job) {

    if (!job || typeof job !== "object") {
        throw new Error("Invalid job information received.");
    }

    const fields = [
        ["Organization", job.organization],
        ["Category", job.category],
        ["Qualification", job.qualification],
        ["Location", job.location],
        ["Salary", job.salary],
        ["Vacancies", job.vacancies],
        ["Job Type", job.jobType],
        ["Eligibility", job.eligibility],
        ["Last Date", job.lastDate]
    ];

    const detailsHTML = fields
        .filter(([label, value]) =>
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        )
        .map(([label, value]) => `
            <div class="detail-item">
                <strong>${escapeHTML(label)}:</strong>
                <span>${escapeHTML(value)}</span>
            </div>
        `)
        .join("");

    const description = job.description || "";
    const extraDescription = job.message || "";

    jobDetails.innerHTML = `
        <div class="job-detail-content">

            <h2>${escapeHTML(job.title || "Job Details")}</h2>

            <div class="job-status">
                ${escapeHTML(job.status || "Application Started")}
            </div>

            ${detailsHTML}

            ${description ? `
                <section class="job-description">
                    <h3>Job Description</h3>
                    <p>${escapeHTML(description).replace(/\n/g, "<br>")}</p>
                </section>
            ` : ""}

            ${extraDescription ? `
                <section>
                    <h3>Additional Information</h3>
                    <p>${escapeHTML(extraDescription).replace(/\n/g, "<br>")}</p>
                </section>
            ` : ""}

            <div class="job-actions">
                <a href="apply.html?id=${encodeURIComponent(job._id)}"
                   class="apply-btn">
                   Apply Now
                </a>
            </div>

        </div>
    `;
}

// --------------------------------------------------
// LOAD JOB DETAILS FROM API
// --------------------------------------------------

async function loadJobDetails() {

    const jobId = getJobId();

    if (!jobId || !/^\d+$/.test(jobId)) {

        jobDetails.innerHTML = `
            <p class="error">
                Invalid Job ID. Please open the job again from Latest Jobs.
            </p>
        `;

        return;
    }

    jobDetails.innerHTML = "<p>Loading job details...</p>";

    try {

        const response = await fetch(
            `${API}/api/jobs/${encodeURIComponent(jobId)}`,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error("Server returned an invalid response.");
        }

        if (!response.ok) {
            throw new Error(
                result.message || `Server Error: ${response.status}`
            );
        }

        displayJob(result);

    } catch (error) {

        console.error("Job Details Error:", error);

        jobDetails.innerHTML = `
            <div class="error">
                <h3>Unable to Load Job Details</h3>
                <p>${escapeHTML(error.message)}</p>
                <button type="button" onclick="loadJobDetails()">
                    Try Again
                </button>
                <p>
                    <a href="index.html">← Back to Latest Jobs</a>
                </p>
            </div>
        `;
    }
}

// --------------------------------------------------
// START
// --------------------------------------------------

loadJobDetails();
