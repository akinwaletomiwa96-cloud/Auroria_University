const API_BASE_URL = `${window.AURORIA_CONFIG?.apiBaseUrl || "http://localhost:8080"}/api`;

const params = new URLSearchParams(window.location.search);
const courseId = params.get("id");

const loading = document.getElementById("detailLoading");
const errorBox = document.getElementById("detailError");
const errorMessage = document.getElementById("detailErrorMessage");
const details = document.getElementById("courseDetails");

function field(object, ...names) {
    for (const name of names) {
        if (object && object[name] !== undefined && object[name] !== null) {
            return object[name];
        }
    }
    return null;
}

function text(id, value, fallback = "Not specified") {
    document.getElementById(id).textContent =
        value === null || value === undefined || value === ""
            ? fallback
            : String(value);
}

function feeText(value) {
    if (value === null || value === undefined || value === "") {
        return "Contact the university";
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? new Intl.NumberFormat(window.AURORIA_CONFIG?.locale || "en-NG", {
            style: "currency",
            currency: window.AURORIA_CONFIG?.currency || "NGN",
            maximumFractionDigits: 2
        }).format(number)
        : String(value);
}

function durationText(value) {
    if (value === null || value === undefined || value === "") {
        return "Not specified";
    }

    return `${value} ${Number(value) === 1 ? "year" : "years"}`;
}

function showError(message) {
    loading.hidden = true;
    details.hidden = true;
    errorBox.hidden = false;
    errorMessage.textContent = message;
}

async function loadCourseDetails() {
    if (!courseId) {
        showError("No course was selected. Please return to the courses page.");
        return;
    }

    try {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(
            `${API_BASE_URL}/courses/${encodeURIComponent(courseId)}`,
            { headers }
        );

        if (!response.ok) {
            throw new Error(`The server returned HTTP ${response.status}.`);
        }

        const course = await response.json();

        text("detailCode", field(course, "courseCode", "course_code"), "No course code");
        text("detailName", field(course, "courseName", "course_name"), "Untitled Course");
        text("detailDescription", field(course, "description"),
            "Contact Auroria University for more information about this programme.");

        const department = field(course, "department");
        text("detailDepartment",
            field(course, "departmentName", "department_name") ??
            field(department, "departmentName", "department_name", "name"));

        text("detailFaculty",
            field(course, "facultyName", "faculty_name") ??
            field(department, "facultyName", "faculty_name"));

        text("detailLevel", field(course, "courseLevel", "course_level"));
        text("detailDuration",
            durationText(field(course, "durationYears", "duration_years")));
        text("detailFee",
            feeText(field(course, "estimatedFee", "estimated_fee")));

        const available = field(course, "available", "isAvailable", "is_available");
        const availabilityBadge = document.getElementById("detailAvailability");

        if (available === true || available === 1 || available === "1" || available === "true") {
            availabilityBadge.textContent = "Available";
            availabilityBadge.className = "availability-badge available";
        } else if (available === false || available === 0 || available === "0" || available === "false") {
            availabilityBadge.textContent = "Unavailable";
            availabilityBadge.className = "availability-badge unavailable";
        } else {
            availabilityBadge.textContent = "Status not specified";
            availabilityBadge.className = "availability-badge status-unknown";
        }

        text("detailRequirements",
            field(course, "admissionRequirements", "admission_requirements"),
            "Admission requirements have not been provided. Please contact Auroria University.");

        loading.hidden = true;
        details.hidden = false;

        const courseName = field(course, "courseName", "course_name");
        document.title = `${courseName || "Course Details"} | Auroria University`;
    } catch (error) {
        console.error("Unable to load course details:", error);
        showError("Unable to load this course. " + error.message);
    }
}

const currentYear = document.getElementById("currentYear");
if (currentYear) currentYear.textContent = new Date().getFullYear();

loadCourseDetails();
