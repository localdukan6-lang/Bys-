
const API = "https://bys-9pma.onrender.com";

const form = document.getElementById("workerForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

document.getElementById("year").textContent =
    new Date().getFullYear();

// --------------------------------------------------
// MESSAGE
// --------------------------------------------------

function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = type;
    formMessage.style.display = message ? "block" : "none";
}

// --------------------------------------------------
// FIELD HELPERS
// --------------------------------------------------

function getValue(...ids) {
    for (const id of ids) {
        const element =
            document.getElementById(id) ||
            form.elements.namedItem(id);

        if (element) {
            if (element.type === "checkbox") {
                return element.checked;
            }

            if (element.type === "radio") {
                const selected = form.querySelector(
                    `input[name="${id}"]:checked`
                );
                return selected ? selected.value.trim() : "";
            }

            return String(element.value || "").trim();
        }
    }

    return "";
}

// Collect all named form controls as a safety net.
// This helps retain additional fields added to the HTML later.
function collectFormFields() {
    const fields = {};

    for (const element of form.elements) {
        if (!element.name || element.disabled) continue;

        if (element.type === "checkbox") {
            fields[element.name] = element.checked;
        } else if (element.type === "radio") {
            if (element.checked) {
                fields[element.name] = element.value;
            }
        } else if (element.type !== "submit" && element.type !== "button") {
            fields[element.name] = String(element.value || "").trim();
        }
    }

    return fields;
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
// FORM DATA
// --------------------------------------------------

function buildRegistrationData() {
    const mobile = cleanNumber(getValue("mobile"));
    const whatsapp = cleanNumber(getValue("whatsapp"));
    const alternateMobile = cleanNumber(
        getValue("alternateMobile")
    );

    const data = {
        // Existing fields - backward compatibility
        name: getValue("name"),
        mobile: mobile,
        whatsapp: whatsapp,
        email: getValue("email"),
        state: getValue("state"),
        district: getValue("district"),
        address: getValue("address"),
        qualification: getValue("qualification"),
        experience: getValue("experience"),
        workType: getValue("workType"),
        message: getValue("message"),

        // Personal details
        fatherName: getValue("fatherName"),
        motherName: getValue("motherName"),
        dob: getValue("dob"),
        gender: getValue("gender"),
        maritalStatus: getValue("maritalStatus"),
        category: getValue("category"),
        otherCategory: getValue("otherCategory", "categoryOther"),
        nationality: getValue("nationality"),

        // Contact details
        alternateMobile: alternateMobile,

        // Address details
        country: getValue("country"),
        city: getValue("city"),
        tehsil: getValue("tehsil"),
        postOffice: getValue("postOffice"),
        pincode: getValue("pincode"),

        // Education details
        otherQualification: getValue(
            "otherQualification",
            "qualificationOther"
        ),
        course: getValue("course"),
        institute: getValue("institute"),
        passingYear: getValue("passingYear"),
        percentage: getValue("percentage"),

        // Work experience details
        employmentStatus: getValue("employmentStatus"),
        company: getValue("company"),
        designation: getValue("designation"),
        industry: getValue("industry"),
        otherIndustry: getValue("otherIndustry", "industryOther"),

        // Job preferences
        otherWorkType: getValue("otherWorkType", "workTypeOther"),
        preferredLocation: getValue("preferredLocation"),
        expectedSalary: getValue("expectedSalary"),
        preferredShift: getValue("preferredShift"),
        relocation: getValue("relocation"),

        // Skills and additional information
        skills: getValue("skills"),

        consent: Boolean(
            document.getElementById("consent")?.checked
        )
    };

    // Retain any additional named fields from the HTML form.
    // Explicit fields above take priority.
    return {
        ...collectFormFields(),
        ...data
    };
}

// --------------------------------------------------
// SUBMIT PROTECTION
// --------------------------------------------------

let isSubmitting = false;

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (isSubmitting) return;

    showMessage("", "");

    const data = buildRegistrationData();

    // Validate mobile
    if (!validMobile(data.mobile)) {
        showMessage(
            "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।",
            "error"
        );
        return;
    }

    // Validate WhatsApp
    if (data.whatsapp && !validMobile(data.whatsapp)) {
        showMessage(
            "कृपया सही WhatsApp नंबर दर्ज करें।",
            "error"
        );
        return;
    }

    // Validate alternate mobile
    if (
        data.alternateMobile &&
        !validMobile(data.alternateMobile)
    ) {
        showMessage(
            "कृपया सही Alternate Mobile Number दर्ज करें।",
            "error"
        );
        return;
    }

    // Required fields
    if (
        !data.name ||
        !data.state ||
        !data.district ||
        !data.address ||
        !data.qualification ||
        !data.experience ||
        !data.workType
    ) {
        showMessage(
            "कृपया सभी जरूरी जानकारी भरें।",
            "error"
        );
        return;
    }

    // Consent
    if (!data.consent) {
        showMessage(
            "कृपया फॉर्म जमा करने से पहले पुष्टि स्वीकार करें।",
            "error"
        );
        return;
    }

    // Disable repeated submissions
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const response = await fetch(
            `${API}/api/workers/register`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        let result = {};

        try {
            result = await response.json();
        } catch {
            result = {};
        }

        // Duplicate registration
        if (response.status === 409) {
            showMessage(
                result.message ||
                "आपका Worker Registration पहले से मौजूद है। एक मोबाइल नंबर से केवल एक Registration किया जा सकता है।",
                "error"
            );
            return;
        }

        // Other server errors
        if (!response.ok) {
            showMessage(
                result.message ||
                "Registration जमा नहीं हो पाया। कृपया दोबारा प्रयास करें।",
                "error"
            );
            return;
        }

        // Success
        showMessage(
            `Registration सफलतापूर्वक जमा हो गया। Registration ID: ${result.registrationId || ""}`,
            "success"
        );

        form.reset();

    } catch (error) {
        console.error("Worker Registration Error:", error);

        showMessage(
            "Server से संपर्क नहीं हो पाया। कृपया थोड़ी देर बाद प्रयास करें।",
            "error"
        );

    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Registration";
    }
});
