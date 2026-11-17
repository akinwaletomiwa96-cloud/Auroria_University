
(() => {
    "use strict";

    const API_BASE = window.AURORIA_CONFIG?.apiBaseUrl || "http://localhost:8080";

    const params = new URLSearchParams(window.location.search);
    const form = document.getElementById("applicationForm");
    const sections = [...document.querySelectorAll(".form-section")];
    const previousButton = document.getElementById("previousButton");
    const nextButton = document.getElementById("nextButton");
    const submitButton = document.getElementById("submitButton");
    const message = document.getElementById("formMessage");
    const courseSelect = document.getElementById("courseId");
    const recordsContainer = document.getElementById("academicRecords");

    let currentStep = 1;


    const currentYear = document.getElementById("currentYear");
    if (currentYear) currentYear.textContent = new Date().getFullYear();

    function getStoredUser() {
        for (const key of ["loggedInUser", "user", "currentUser"]) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;

            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") return parsed;
            } catch {
                // Ignore invalid stored JSON.
            }
        }

        return null;
    }

    function getUserId() {
        const user = getStoredUser();

        const candidates = [
            user?.userId,
            user?.id,
            user?.studentId,
            localStorage.getItem("userId"),
            localStorage.getItem("studentId"),
            localStorage.getItem("loggedInUserId")
        ];

        for (const candidate of candidates) {
            if (/^\d+$/.test(String(candidate ?? "")) && Number(candidate) > 0) {
                return Number(candidate);
            }
        }

        return null;
    }

    function showMessage(text, isError = true) {
        message.textContent = text;
        message.style.color = isError ? "#c0392b" : "#21804a";
    }

    async function loadCourses() {
        try {
            const response = await fetch(`${API_BASE}/api/courses`);

            if (!response.ok) {
                throw new Error("Could not load courses.");
            }

            const data = await response.json();

            const courses = Array.isArray(data)
                ? data
                : data.content ?? data.courses ?? [];

            courseSelect.replaceChildren();

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = courses.length
                ? "Choose a course"
                : "No courses available";

            courseSelect.appendChild(placeholder);

            for (const course of courses) {
                const id = course.courseId ?? course.id;
                const name = course.courseName ?? course.name ?? course.title;

                if (id == null || !name) continue;

                const option = document.createElement("option");
                option.value = String(id);
                option.textContent = name;
                courseSelect.appendChild(option);
            }

            const requestedId = params.get("courseId");

            if (requestedId) {
                courseSelect.value = requestedId;
            }
        } catch (error) {
            courseSelect.replaceChildren();

            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Could not load courses";

            courseSelect.appendChild(option);

            showMessage(
                `${error.message} Check that Spring Boot is running on port 8080.`
            );
        }
    }

    function renderStep() {
        sections.forEach(section => {
            section.classList.toggle(
                "active",
                Number(section.dataset.step) === currentStep
            );
        });

        document.querySelectorAll("[data-step-indicator]").forEach(item => {
            const step = Number(item.dataset.stepIndicator);

            item.classList.toggle("active", step === currentStep);
            item.classList.toggle("done", step < currentStep);

            item.querySelector(".step-dot").textContent =
                step < currentStep ? "✓" : String(step);
        });

        previousButton.hidden = currentStep === 1;
        nextButton.hidden = currentStep === 3;
        submitButton.hidden = currentStep !== 3;

        document.getElementById("progressFill").style.width =
            `${currentStep / sections.length * 100}%`;

        showMessage("");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    // ==========================================
    // APPLICATION FORM VALIDATION
    // ==========================================

    function validateTextOnly(value) {
        // Allows letters, spaces, apostrophes, hyphens and accented characters.
        return /^[\p{L}\p{M}]+(?:[\s'’-][\p{L}\p{M}]+)*$/u.test(value.trim());
    }

    function validatePhone(value) {
        // Allows an optional international + and digits.
        // Spaces, hyphens and brackets are also accepted.
        const cleaned = value.replace(/[\s()-]/g, "");

        return /^\+?[0-9]{7,15}$/.test(cleaned);
    }

    function validateEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
    }

    function validateAcademicYear(value) {
        const match = value.trim().match(/^(\d{4})\s*\/\s*(\d{4})$/);

        if (!match) return false;

        const firstYear = Number(match[1]);
        const secondYear = Number(match[2]);

        return (
            firstYear >= new Date().getFullYear() &&
            firstYear <= new Date().getFullYear() + 10 &&
            secondYear === firstYear + 1
        );
    }

    function validateExaminationYear(value) {
        const year = Number(value);
        const currentYear = new Date().getFullYear();

        return (
            /^\d{4}$/.test(String(value).trim()) &&
            year >= 1950 &&
            year <= currentYear
        );
    }

    function getCustomValidationError(field) {
        const name = field.name || field.id;
        const value = field.value.trim();

        if (!value) {
            return field.required ? "This field is required." : "";
        }

        // Fields that should contain names or words only.
        const textOnlyFields = [
            "fullName",
            "firstName",
            "lastName",
            "nationality",
            "state",
            "stateOrRegion",
            "city",
            "country",
            "emergencyName"
        ];

        if (textOnlyFields.includes(name)) {
            if (!validateTextOnly(value)) {
                return "Please enter letters only. Numbers and special characters are not allowed.";
            }
        }

        // Phone number fields.
        const phoneFields = [
            "phone",
            "emergencyPhone",
            "emergencyContactPhone"
        ];

        if (phoneFields.includes(name)) {
            if (!validatePhone(value)) {
                return "Enter a valid phone number containing 7–15 digits.";
            }
        }

        // Email fields, if present.
        if (
            name.toLowerCase().includes("email") ||
            field.type === "email"
        ) {
            if (!validateEmail(value)) {
                return "Enter a valid email address.";
            }
        }

        // Examination number: letters, digits, hyphens and slashes.
        if (name === "examinationNumber") {
            if (!/^[a-zA-Z0-9/-]{3,30}$/.test(value)) {
                return "Enter a valid examination number (3–30 characters).";
            }
        }

        // Examination year.
        if (name === "examinationYear") {
            if (!validateExaminationYear(value)) {
                return `Enter a valid examination year between 1950 and ${new Date().getFullYear()}.`;
            }
        }

        // Academic year.
        if (name === "academicYear") {
            if (!validateAcademicYear(value)) {
                return "Use the format YYYY/YYYY, with consecutive years. Example: 2027/2028.";
            }
        }

        // Date of birth cannot be in the future.
        if (
            name === "dateOfBirth" ||
            field.type === "date"
        ) {
            const selectedDate = new Date(value + "T00:00:00");

            if (Number.isNaN(selectedDate.getTime())) {
                return "Enter a valid date.";
            }

            if (selectedDate > new Date()) {
                return "Date of birth cannot be in the future.";
            }
        }

        // Prevent unusually short or long text entries.
        if (field.minLength > 0 && value.length < field.minLength) {
            return `Enter at least ${field.minLength} characters.`;
        }

        if (field.maxLength > 0 && value.length > field.maxLength) {
            return `Enter no more than ${field.maxLength} characters.`;
        }

        return "";
    }

    function validateField(field) {
        field.setCustomValidity("");

        const error = getCustomValidationError(field);

        if (error) {
            field.setCustomValidity(error);
            field.classList.add("invalid");
            field.classList.remove("valid");
            return false;
        }

        if (!field.checkValidity()) {
            field.classList.add("invalid");
            field.classList.remove("valid");
            return false;
        }

        field.classList.remove("invalid");
        field.classList.add("valid");

        return true;
    }

    function validateSection(step) {
        const section = sections[step - 1];

        if (!section) return false;

        const fields = [
            ...section.querySelectorAll("input, select, textarea")
        ];

        for (const field of fields) {
            if (field.disabled) continue;

            if (field.type === "file") {
                if (field.required && !field.files.length) {
                    field.closest(".academic-record")
                        ?.querySelector(".choose-file")
                        ?.focus();

                    showMessage(
                        "Please upload a result document for each qualification."
                    );

                    return false;
                }

                continue;
            }

            if (!validateField(field)) {
                field.reportValidity();
                field.focus();
                return false;
            }
        }

        return true;
    }

    // ==========================================
    // LIVE FIELD VALIDATION
    // ==========================================

    form.addEventListener("input", event => {
        const field = event.target;

        if (!field.matches("input, select, textarea")) return;

        // Validate once the applicant starts entering information.
        if (field.value.trim() !== "") {
            validateField(field);
        } else {
            field.setCustomValidity("");
            field.classList.remove("valid", "invalid");
        }
    });

    form.addEventListener("change", event => {
        const field = event.target;

        if (!field.matches("input, select, textarea")) return;

        validateField(field);
    });

    form.addEventListener("blur", event => {
        const field = event.target;

        if (!field.matches("input, select, textarea")) return;

        if (field.value.trim() !== "") {
            validateField(field);
        }
    }, true);

    nextButton.addEventListener("click", () => {
        if (!validateSection(currentStep)) return;

        currentStep = Math.min(currentStep + 1, sections.length);
        renderStep();
    });

    previousButton.addEventListener("click", () => {
        currentStep = Math.max(currentStep - 1, 1);
        renderStep();
    });

    function configureUpload(record) {
        const input = record.querySelector(".result-file-input");
        const choose = record.querySelector(".choose-file");
        const selected = record.querySelector(".file-selected");
        const fileName = record.querySelector(".file-name");
        const remove = record.querySelector(".remove-file");

        choose.addEventListener("click", () => input.click());

        input.addEventListener("change", () => {
            const file = input.files[0];

            if (!file) return;

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "application/pdf"
            ];

            if (!allowedTypes.includes(file.type)) {
                input.value = "";
                showMessage("Choose a JPG, PNG, WEBP or PDF file.");
                return;
            }

            if (file.size > 8 * 1024 * 1024) {
                input.value = "";
                showMessage("Your result file must be 8 MB or smaller.");
                return;
            }

            fileName.textContent = file.name;
            selected.hidden = false;
            choose.hidden = true;

            showMessage("");
        });

        remove.addEventListener("click", () => {
            input.value = "";
            selected.hidden = true;
            choose.hidden = false;
        });
    }

    function updateQualificationNumbers() {
        const records = [
            ...recordsContainer.querySelectorAll(".academic-record")
        ];

        records.forEach((record, index) => {
            record.querySelector(".record-top h3").textContent =
                `Qualification ${index + 1}`;

            record.querySelector(".remove-record").hidden =
                records.length === 1;
        });
    }

    function setupRecord(record) {
        configureUpload(record);

        record.querySelector(".remove-record").addEventListener("click", () => {
            if (
                recordsContainer.querySelectorAll(".academic-record").length <= 1
            ) {
                return;
            }

            record.remove();
            updateQualificationNumbers();
            showMessage("");
        });
    }

    document.getElementById("addRecord").addEventListener("click", () => {
        const template =
            recordsContainer.querySelector(".academic-record");

        const clone = template.cloneNode(true);

        clone.querySelectorAll("input").forEach(input => {
            input.value = "";
        });

        clone.querySelectorAll("select").forEach(select => {
            select.selectedIndex = 0;
        });

        clone.querySelector(".file-selected").hidden = true;
        clone.querySelector(".file-name").textContent = "";
        clone.querySelector(".choose-file").hidden = false;

        recordsContainer.appendChild(clone);

        setupRecord(clone);
        updateQualificationNumbers();

        clone.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    function getInputValue(container, name) {
        return container.querySelector(`[name="${name}"]`).value.trim();
    }

    function collectApplication() {
        const qualifications = [
            ...recordsContainer.querySelectorAll(".academic-record")
        ].map(record => ({
            institutionName: getInputValue(record, "institutionName"),
            qualificationName: getInputValue(record, "qualificationName"),
            examinationBody: getInputValue(record, "examinationBody"),
            examinationNumber: getInputValue(record, "examinationNumber"),
            examinationYear: Number(
                getInputValue(record, "examinationYear")
            )
        }));

        return {
            userId: getUserId(),
            courseId: Number(
                document.getElementById("courseId").value
            ),
            intake: document.getElementById("intake").value,
            academicYear: document.getElementById("academicYear").value.trim(),

            applicantDetails: {
                dateOfBirth: document.getElementById("dateOfBirth").value,
                gender: document.getElementById("gender").value,
                nationality: document.getElementById("nationality").value.trim(),
                residentialAddress: document.getElementById("address").value.trim(),
                city: document.getElementById("city").value.trim(),
                stateOrRegion: document.getElementById("state").value.trim(),
                country: document.getElementById("country").value.trim(),
                emergencyContactName: document.getElementById("emergencyName").value.trim(),
                emergencyContactPhone: document.getElementById("emergencyPhone").value.trim()
            },

            academicQualifications: qualifications
        };
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (currentStep !== 3 || !validateSection(3)) return;

        // Validate all earlier steps before sending.
        for (const step of [1, 2]) {
            if (!validateSection(step)) {
                currentStep = step;
                renderStep();
                return;
            }
        }

        const application = collectApplication();

        if (!application.userId) {
            showMessage("Your user ID could not be found. Please sign in again.");
            return;
        }

        const records = [
            ...recordsContainer.querySelectorAll(".academic-record")
        ];

        const uploads = records.map(record =>
            record.querySelector(".result-file-input").files[0]
        );

        submitButton.disabled = true;
        submitButton.textContent = "Submitting…";
        showMessage("");

        try {
            /*
             * BACKEND REQUIREMENT:
             * Implement POST /api/applications/with-documents in Spring Boot.
             *
             * Expected multipart parts:
             *   application: JSON application data
             *   resultFiles: one uploaded file for each qualification
             *
             * The backend must save application details, uploaded document metadata,
             * and academic qualification details. It must set verification status
             * to PENDING on the server, not accept a status chosen by the applicant.
             */
            const formData = new FormData();

            formData.append(
                "application",
                new Blob(
                    [JSON.stringify(collectApplication())],
                    { type: "application/json" }
                )
            );

            document.querySelectorAll('input[type="file"][name="resultFile"]')
                .forEach(input => {
                    if (input.files && input.files[0]) {
                        formData.append("resultFiles", input.files[0]);
                    }
                });

            const response = await fetch(
                `${API_BASE}/api/applications/with-documents`,
                {
                    method: "POST",
                    headers: (() => {
                        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                        return token ? { Authorization: `Bearer ${token}` } : {};
                    })(),
                    body: formData
                }
            );
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    result.error ||
                    result.data?.message ||
                    result.data?.error ||
                    `Submission failed (${response.status}).`
                );
            }

            const payload = result.data && typeof result.data === "object" ? result.data : result;
            const referenceCode =
                payload.referenceCode ??
                payload.bookingCode ??
                payload.application?.referenceCode ??
                payload.application?.bookingCode;

            const confirmation = document.createElement("div");
            confirmation.className = "summary-card";

            const icon = document.createElement("span");
            icon.className = "summary-icon";
            icon.textContent = "✓";

            const content = document.createElement("div");

            const heading = document.createElement("strong");
            heading.textContent = "Application received";

            const detail = document.createElement("p");
            detail.textContent = referenceCode
                ? `Reference code: ${referenceCode}. Your uploaded result is awaiting admissions verification.`
                : "Your application was accepted. Your uploaded result is awaiting admissions verification.";

            content.append(heading, detail);
            confirmation.append(icon, content);
 

            form.replaceChildren(confirmation);

            const dashboardLink = document.createElement("a");
            dashboardLink.className = "primary-button";
            dashboardLink.href = "dashboard.html";
            dashboardLink.textContent = "Return to dashboard";
            dashboardLink.style.marginTop = "18px";
            dashboardLink.style.textDecoration = "none";

            form.append(dashboardLink);
        } catch (error) {
            showMessage(
                `${error.message} Make sure the Spring Boot upload endpoint has been implemented.`
            );

            submitButton.disabled = false;
            submitButton.innerHTML =
                'Submit application <span aria-hidden="true">→</span>';
        }
    });

    if (!getUserId()) {
        window.location.replace("login.html?next=application-form.html");
        return;
    }

    // Always start a new application from Step 1.
    function initializeFreshForm() {

        // Remove any old saved application draft.
        const userId = getUserId();

        if (userId) {
            localStorage.removeItem(
                `auroria_application_draft_v1_${userId}`
            );
        }

        // Reset all form fields.
        form.reset();

        // Always start at the first step.
        currentStep = 1;

        // Keep only one empty academic qualification card.
        const firstRecord =
            recordsContainer.querySelector(".academic-record");

        if (firstRecord) {
            recordsContainer.replaceChildren(firstRecord);

            firstRecord.querySelectorAll("input, select, textarea")
                .forEach(field => {
                    field.value = "";
                });

            const fileInput =
                firstRecord.querySelector(".result-file-input");

            if (fileInput) fileInput.value = "";

            const fileSelected =
                firstRecord.querySelector(".file-selected");

            if (fileSelected) fileSelected.hidden = true;

            const fileName =
                firstRecord.querySelector(".file-name");

            if (fileName) fileName.textContent = "";

            const chooseFile =
                firstRecord.querySelector(".choose-file");

            if (chooseFile) chooseFile.hidden = false;

            setupRecord(firstRecord);
        }

        updateQualificationNumbers();

        // Display Step 1 immediately.
        renderStep();
    }

    // Require login before initializing.
    if (!getUserId()) {
        window.location.replace("login.html?next=application-form.html");
        return;
    }

    initializeFreshForm();

    loadCourses();
})();
