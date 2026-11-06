const API = "https://bys-9pma.onrender.com";

// Current Year
const yearElement = document.getElementById("year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}


// ALL JOB CATEGORIES

const categories = [

    { id: "jobList10th", names: ["10th", "10th pass", "matric", "high school"] },

    { id: "jobList12th", names: ["12th", "12th pass", "intermediate", "inter"] },

    { id: "jobListITI", names: ["iti"] },

    { id: "jobListDiploma", names: ["diploma", "polytechnic"] },

    { id: "jobListUneducated", names: ["uneducated", "no qualification", "illiterate", "अनपढ़", "अशिक्षित"] },

    { id: "jobListGraduate", names: ["graduate", "graduation", "graduated"] },

    { id: "jobListBSc", names: ["b.sc", "bsc", "bachelor of science"] },

    { id: "jobListBCom", names: ["b.com", "bcom", "bachelor of commerce"] },

    { id: "jobListBA", names: ["b.a", "ba", "bachelor of arts"] },

    { id: "jobListBTech", names: ["b.tech", "btech", "bachelor of technology"] },

    { id: "jobListPostGraduate", names: ["post graduate", "postgraduate", "pg", "master"] },

    { id: "jobListOther", names: ["other", "any qualification", "all qualification"] }

];


// ESCAPE HTML

function esc(s = "") {

    return String(s).replace(/[&<>"']/g, c => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"

    }[c]));

}


// NORMALIZE TEXT

function normalize(value) {

    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

}


// JOB DATE SORTING

function getJobDate(job) {

    const date = job.createdAt || job.updatedAt || job.date || "";

    const parsed = new Date(date).getTime();

    return Number.isFinite(parsed) ? parsed : 0;

}


// JOB CARD

function jobCard(job) {

    return `

        <div class="job-link">

            <a href="job.html?id=${encodeURIComponent(job._id)}">

                <strong>${esc(job.title || "Untitled Job")}</strong>

            </a>

            <span class="job-meta">

                <span class="badge">
                    ${esc(job.category || "Job")}
                </span>

                <span class="badge">
                    ${esc(job.status || "Available")}
                </span>

                ${job.qualification ? `
                    <span class="badge">
                        ${esc(job.qualification)}
                    </span>
                ` : ""}

                ${job.lastDate ? `
                    <span>
                        Last Date: ${esc(job.lastDate)}
                    </span>
                ` : ""}

            </span>

        </div>

    `;

}


// SHOW MESSAGE

function showMessage(id, message) {

    const element = document.getElementById(id);

    if (element) {

        element.innerHTML = `
            <p class="empty">${esc(message)}</p>
        `;

    }

}


// QUALIFICATION MATCHING

function matchesQualification(job, category) {

    const qualification = normalize(job.qualification);

    const names = category.names.map(normalize);

    if (!qualification) return false;

    return names.some(name =>

        qualification === name ||
        qualification.includes(name) ||
        name.includes(qualification)

    );

}


// CLEAR ALL JOB BOXES

function clearAllBoxes() {

    const latest = document.getElementById("jobListLatest");

    if (latest) {
        latest.innerHTML = "";
    }

    categories.forEach(category => {

        const element = document.getElementById(category.id);

        if (element) {
            element.innerHTML = "";
        }

    });

}


// DISPLAY LATEST JOBS

function displayLatestJobs(jobs) {

    const latestElement = document.getElementById("jobListLatest");

    if (!latestElement) return;

    latestElement.innerHTML = "";

    if (!jobs.length) {

        latestElement.innerHTML = `
            <p class="empty">
                No latest jobs available right now.
            </p>
        `;

        return;

    }

    jobs.forEach(job => {

        latestElement.innerHTML += jobCard(job);

    });

}


// DISPLAY QUALIFICATION JOBS

function displayQualificationJobs(jobs) {

    categories.forEach(category => {

        const element = document.getElementById(category.id);

        if (element) {
            element.innerHTML = "";
        }

    });


    jobs.forEach(job => {

        const matchedCategories = categories.filter(category =>

            matchesQualification(job, category)

        );

        matchedCategories.forEach(category => {

            const element = document.getElementById(category.id);

            if (element) {

                element.innerHTML += jobCard(job);

            }

        });

    });


    // EMPTY CATEGORY MESSAGE

    categories.forEach(category => {

        const element = document.getElementById(category.id);

        if (element && !element.innerHTML.trim()) {

            element.innerHTML = `
                <p class="empty">
                    No jobs available right now.
                </p>
            `;

        }

    });

}


// MAIN LOAD JOBS FUNCTION

async function loadJobs() {

    const searchInput = document.getElementById("searchInput");

    const categoryFilter = document.getElementById("categoryFilter");


    const q = searchInput
        ? searchInput.value.trim()
        : "";


    const selectedCategory = categoryFilter
        ? categoryFilter.value
        : "";


    const params = new URLSearchParams();


    if (q) {
        params.set("q", q);
    }

    if (selectedCategory) {
        params.set("category", selectedCategory);
    }


    // LOADING MESSAGE

    showMessage("jobListLatest", "Loading Latest Jobs...");

    categories.forEach(category => {

        showMessage(category.id, "Loading jobs...");

    });


    try {

        const res = await fetch(
            `${API}/api/jobs?${params.toString()}`
        );


        const jobs = await res.json();


        if (!res.ok) {

            throw new Error(
                jobs.message || "Could not load jobs"
            );

        }


        if (!Array.isArray(jobs)) {

            throw new Error("Invalid jobs data received from server");

        }


        // SORT NEWEST JOB FIRST

        jobs.sort((a, b) => getJobDate(b) - getJobDate(a));


        // DISPLAY ALL JOBS IN LATEST SECTION

        displayLatestJobs(jobs);


        // DISPLAY QUALIFICATION-WISE JOBS

        displayQualificationJobs(jobs);


    } catch (error) {

        console.error("Job Loading Error:", error);


        showMessage(
            "jobListLatest",
            error.message || "Unable to load latest jobs."
        );


        categories.forEach(category => {

            showMessage(
                category.id,
                error.message || "Please try again later."
            );

        });

    }

}


// SEARCH BUTTON

const searchBtn = document.getElementById("searchBtn");

if (searchBtn) {

    searchBtn.addEventListener("click", loadJobs);

}


// ENTER KEY SEARCH

const searchInput = document.getElementById("searchInput");

if (searchInput) {

    searchInput.addEventListener("keydown", e => {

        if (e.key === "Enter") {

            loadJobs();

        }

    });

}


// GOVERNMENT / PRIVATE FILTER

const categoryFilter = document.getElementById("categoryFilter");

if (categoryFilter) {

    categoryFilter.addEventListener("change", loadJobs);

}


// INITIAL JOB LOADING

loadJobs();


// AUTO REFRESH EVERY 5 MINUTES

setInterval(() => {

    loadJobs();

}, 5 * 60 * 1000);
