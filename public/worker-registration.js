
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
// SUBMIT PROTECTION
// --------------------------------------------------

let isSubmitting = false;

form.addEventListener("submit", async function (e) {

    e.preventDefault();

    if (isSubmitting) {
        return;
    }

    showMessage("", "");

    const mobile = cleanNumber(
        document.getElementById("mobile").value
    );

    const whatsapp = cleanNumber(
        document.getElementById("whatsapp").value
    );

    // Validate mobile
    if (!validMobile(mobile)) {

        showMessage(
            "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।",
            "error"
        );

        return;
    }

    // Validate WhatsApp
    if (whatsapp && !validMobile(whatsapp)) {

        showMessage(
            "कृपया सही WhatsApp नंबर दर्ज करें।",
            "error"
        );

        return;
    }

    // Form data
    const data = {

        name: document.getElementById("name").value.trim(),

        mobile: mobile,

        whatsapp: whatsapp,

        email: document.getElementById("email").value.trim(),

        state: document.getElementById("state").value.trim(),

        district: document.getElementById("district").value.trim(),

        address: document.getElementById("address").value.trim(),

        qualification: document.getElementById("qualification").value,

        experience: document.getElementById("experience").value,

        workType: document.getElementById("workType").value,

        message: document.getElementById("message").value.trim()
    };

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
    if (!document.getElementById("consent").checked) {

        showMessage(
            "कृपया फॉर्म जमा करने से पहले पुष्टि स्वीकार करें।",
            "error"
        );

        return;
    }

    // Disable repeated clicks
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

        let result;

        try {
            result = await response.json();
        } catch {
            result = {};
        }

        // --------------------------------------------------
        // DUPLICATE REGISTRATION
        // HTTP 409
        // --------------------------------------------------

        if (response.status === 409) {

            showMessage(
                result.message ||
                "आपका Worker Registration पहले से मौजूद है। एक मोबाइल नंबर से केवल एक Registration किया जा सकता है।",
                "error"
            );

            return;
        }

        // Other errors
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

        console.error(
            "Worker Registration Error:",
            error
        );

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
