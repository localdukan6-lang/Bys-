
const API = "https://bys-9pma.onrender.com";

const form = document.getElementById("workerForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

document.getElementById("year").textContent =
    new Date().getFullYear();

function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = type;
}

function cleanNumber(value) {
    return String(value || "").replace(/\D/g, "");
}

form.addEventListener("submit", async function (e) {

    e.preventDefault();

    showMessage("", "");

    const mobile = cleanNumber(
        document.getElementById("mobile").value
    );

    const whatsapp = cleanNumber(
        document.getElementById("whatsapp").value
    );

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        showMessage(
            "Please enter a valid 10 digit mobile number.",
            "error"
        );
        return;
    }

    if (whatsapp && !/^[6-9]\d{9}$/.test(whatsapp)) {
        showMessage(
            "Please enter a valid WhatsApp number.",
            "error"
        );
        return;
    }

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

    if (!data.name || !data.state || !data.district || !data.address) {
        showMessage(
            "Please fill all required fields.",
            "error"
        );
        return;
    }

    if (!document.getElementById("consent").checked) {
        showMessage(
            "Please accept the confirmation before submitting.",
            "error"
        );
        return;
    }

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

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Registration failed."
            );
        }

        showMessage(
            result.message || "Registration submitted successfully!",
            "success"
        );

        form.reset();

    } catch (error) {

        console.error("Worker Registration Error:", error);

        showMessage(
            error.message || "Server error. Please try again later.",
            "error"
        );

    } finally {

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Registration";

    }

});
