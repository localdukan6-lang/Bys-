const API = "https://bys-9pma.onrender.com";

document.getElementById("year").textContent = new Date().getFullYear();

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

function esc(s = "") {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function normalize(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function jobCard(job) {
    return `
        <div class="job-link">
            <a href="job.html?id=${encodeURIComponent(job._id)}">
                <strong>${esc(job.title)}</strong>
            </a>
            <span class="job-meta">
                <span class="badge">${esc(job.category)}</span>
                <span class="badge">${esc(job.status)}</span>
                ${job.lastDate ? "Last Date: " + esc(job.lastDate) : ""}
            </span>
        </div>
    `;
}

function showMessage(id, message) {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = `<p class="empty">${esc(message)}</p>`;
    }
}

function matchesQualification(job, category) {
    const qualification = normalize(job.qualification);
    const names = category.names.map(normalize);

    if (!qualification) return false;

    // Exact or partial qualification matching
    return names.some(name =>
        qualification === name ||
        qualification.includes(name) ||
        name.includes(qualification)
    );
}

async function loadJobs() {

    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");

    const q = searchInput ? searchInput.value.trim() : "";
    const selectedCategory = categoryFilter ? categoryFilter.value : "";

    const params = new URLSearchParams();

    if (q) params.set("q", q);
    if (selectedCategory) params.set("category", selectedCategory);

    categories.forEach(category => {
        showMessage(category.id, "Loading jobs...");
    });

    try {

        const res = await fetch(`${API}/api/jobs?${params.toString()}`);
        const jobs = await res.json();

        if (!res.ok) {
            throw new Error(jobs.message || "Could not load jobs");
        }

        // Clear all qualification boxes
        categories.forEach(category => {
            const element = document.getElementById(category.id);
            if (element) {
                element.innerHTML = "";
            }
        });

        // Qualification-wise job display
        jobs.forEach(job => {

            const matchedCategory = categories.find(category =>
                matchesQualification(job, category)
            );

            if (matchedCategory) {

                const element = document.getElementById(matchedCategory.id);

                if (element) {
                    element.innerHTML += jobCard(job);
                }
            }

        });

        // Show empty message for categories without jobs
        categories.forEach(category => {

            const element = document.getElementById(category.id);

            if (element && !element.innerHTML.trim()) {
                element.innerHTML = `
                    <p class="empty">No jobs available right now.</p>
                `;
            }

        });

    } catch (error) {

        categories.forEach(category => {
            showMessage(category.id, error.message || "Please try again later.");
        });

    }
}

// Search button
const searchBtn = document.getElementById("searchBtn");

if (searchBtn) {
    searchBtn.addEventListener("click", loadJobs);
}

// Enter key search
const searchInput = document.getElementById("searchInput");

if (searchInput) {
    searchInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            loadJobs();
        }
    });
}

// Government / Private filter
const categoryFilter = document.getElementById("categoryFilter");

if (categoryFilter) {
    categoryFilter.addEventListener("change", loadJobs);
}

// Load jobs when page opens
loadJobs();
