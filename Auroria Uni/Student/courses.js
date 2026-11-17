const API_BASE_URL = `${window.AURORIA_CONFIG?.apiBaseUrl || "http://localhost:8080"}/api`;

const COURSES_API = `${API_BASE_URL}/courses?availableOnly=false`;
const DEPARTMENTS_API = `${API_BASE_URL}/departments`;

let allCourses = [];
let allDepartments = [];

const courseGrid = document.getElementById("courseGrid");
const departmentList = document.getElementById("departmentList");

const courseSearch = document.getElementById("courseSearch");
const departmentFilter = document.getElementById("departmentFilter");
const levelFilter = document.getElementById("levelFilter");
const availabilityFilter = document.getElementById("availabilityFilter");

const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");


function extractArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.content)) return data.content;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.items)) return data.items;

    return [];
}


function getField(object, ...names) {
    for (const name of names) {
        if (object && object[name] !== undefined && object[name] !== null) {
            return object[name];
        }
    }

    return null;
}


function getCourseName(course) {
    return getField(course, "course_name", "courseName")
        || "Untitled Course";
}


function getCourseCode(course) {
    return getField(course, "course_code", "courseCode")
        || "No course code";
}


function getDepartmentId(course) {
    const nestedDepartment = getField(course, "department");

    return getField(course, "department_id", "departmentId")
        ?? getField(nestedDepartment, "department_id", "departmentId", "id");
}


function findDepartmentById(departmentId) {
    if (departmentId === null || departmentId === undefined) {
        return null;
    }

    return allDepartments.find(department => {
        const id = getField(
            department,
            "department_id",
            "departmentId",
            "id"
        );

        return String(id) === String(departmentId);
    }) || null;
}


function getDepartmentName(course) {
    const nestedDepartment = getField(course, "department");

    const directName = getField(
        course,
        "department_name",
        "departmentName"
    );

    const nestedName = getField(
        nestedDepartment,
        "department_name",
        "departmentName",
        "name"
    );

    if (directName || nestedName) {
        return directName || nestedName;
    }

    const department = findDepartmentById(getDepartmentId(course));

    return department
        ? getField(
            department,
            "department_name",
            "departmentName",
            "name"
        ) || "Department not specified"
        : "Department not specified";
}


function getFacultyName(course) {
    const nestedDepartment = getField(course, "department");

    const directFaculty = getField(
        course,
        "faculty_name",
        "facultyName"
    );

    const nestedFaculty = getField(
        nestedDepartment,
        "faculty_name",
        "facultyName"
    );

    if (directFaculty || nestedFaculty) {
        return directFaculty || nestedFaculty;
    }

    const department = findDepartmentById(getDepartmentId(course));

    return department
        ? getField(department, "faculty_name", "facultyName")
            || "Not specified"
        : "Not specified";
}


function getCourseLevel(course) {
    return getField(course, "course_level", "courseLevel")
        || "Not specified";
}


function isCourseAvailable(course) {
    const value = getField(
        course,
        "available",
        "is_available",
        "isAvailable"
    );

    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;

    if (typeof value === "string") {
        const normalized = value.toLowerCase().trim();

        if (["true", "1", "yes", "available"].includes(normalized)) {
            return true;
        }

        if (["false", "0", "no", "unavailable"].includes(normalized)) {
            return false;
        }
    }

    return null;
}


function getDuration(course) {
    const duration = getField(course, "duration_years", "durationYears");

    if (duration === null || duration === "") {
        return "Not specified";
    }

    return `${duration} ${Number(duration) === 1 ? "year" : "years"}`;
}


function getFee(course) {
    const fee = getField(course, "estimated_fee", "estimatedFee");

    if (fee === null || fee === "") {
        return "Contact the university";
    }

    const numericFee = Number(fee);

    if (!Number.isFinite(numericFee)) {
        return String(fee);
    }

    return new Intl.NumberFormat(window.AURORIA_CONFIG?.locale || "en-NG", {
        style: "currency",
        currency: window.AURORIA_CONFIG?.currency || "NGN",
        maximumFractionDigits: 2
    }).format(numericFee);
}


function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


function courseDescription(course) {
    return getField(course, "description") ||
        "Contact Auroria University for more information about this programme.";
}


async function loadPageData() {
    errorState.hidden = true;
    emptyState.hidden = true;

    courseGrid.innerHTML =
        '<div class="loading-message">Loading courses...</div>';

    departmentList.innerHTML =
        '<div class="loading-message">Loading departments...</div>';

    resultCount.textContent = "Loading courses...";

    try {
        // Load courses first because they are essential to the page.
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        const requestHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        const coursesResponse = await fetch(COURSES_API, { headers: requestHeaders });

        if (!coursesResponse.ok) {
            throw new Error(
                `Courses API returned HTTP ${coursesResponse.status}.`
            );
        }

        const coursesData = await coursesResponse.json();

        allCourses = extractArray(coursesData);

        // Department information is optional.
        // A missing departments endpoint must not block courses.
        try {
            const departmentsResponse = await fetch(DEPARTMENTS_API, { headers: requestHeaders });

            if (departmentsResponse.ok) {
                const departmentsData = await departmentsResponse.json();

                allDepartments = extractArray(departmentsData);
            } else {
                console.warn(
                    `Departments API returned HTTP ${departmentsResponse.status}.`
                );

                allDepartments = [];
            }
        } catch (departmentError) {
            console.warn(
                "Could not load departments:",
                departmentError
            );

            allDepartments = [];
        }

        populateDepartmentFilter();
        populateLevelFilter();
        renderDepartments();

        // Homepage department links pass a readable slug (e.g. ?department=computing).
        const requestedDepartment = new URLSearchParams(window.location.search).get("department");
        if (requestedDepartment) {
            const slug = requestedDepartment.trim().toLowerCase().replace(/[-_]+/g, " ");
            const match = allDepartments.find(department => {
                const name = String(getField(department, "department_name", "departmentName", "name") || "").toLowerCase();
                return name === slug || name.includes(slug) || slug.includes(name);
            });
            if (match) {
                const id = getField(match, "department_id", "departmentId", "id");
                departmentFilter.value = String(id);
            } else {
                courseSearch.value = requestedDepartment.replace(/[-_]+/g, " ");
            }
        }
        applyFilters();

    } catch (error) {
        console.error("Unable to load courses:", error);

        courseGrid.innerHTML = "";
        departmentList.innerHTML = "";

        resultCount.textContent = "Courses unavailable";
        errorState.hidden = false;

        if (errorMessage) {
            errorMessage.textContent =
                "Check that your Java backend is running and the courses API is correct. "
                + error.message;
        }
    }
}


function populateDepartmentFilter() {
    departmentFilter.innerHTML =
        '<option value="">All Departments</option>';

    allDepartments.forEach(department => {
        const id = getField(
            department,
            "department_id",
            "departmentId",
            "id"
        );

        const name = getField(
            department,
            "department_name",
            "departmentName",
            "name"
        );

        if (id === null || !name) return;

        const option = document.createElement("option");

        option.value = id;
        option.textContent = name;

        departmentFilter.appendChild(option);
    });
}


function populateLevelFilter() {
    levelFilter.innerHTML =
        '<option value="">All Levels</option>';

    const levels = [
        ...new Set(
            allCourses
                .map(course =>
                    getField(course, "course_level", "courseLevel")
                )
                .filter(level =>
                    level !== null && String(level).trim() !== ""
                )
                .map(level => String(level))
        )
    ].sort((a, b) => a.localeCompare(b));

    levels.forEach(level => {
        const option = document.createElement("option");

        option.value = level;
        option.textContent = level;

        levelFilter.appendChild(option);
    });
}


function renderDepartments() {
    if (allDepartments.length === 0) {
        departmentList.innerHTML =
            '<p class="empty-inline">Department information is currently unavailable.</p>';

        return;
    }

    departmentList.innerHTML = allDepartments.map((department, index) => {
        const id = getField(
            department,
            "department_id",
            "departmentId",
            "id"
        );

        const name = getField(
            department,
            "department_name",
            "departmentName",
            "name"
        ) || "Unnamed Department";

        const faculty = getField(
            department,
            "faculty_name",
            "facultyName"
        ) || "Faculty not specified";

        const description = getField(department, "description")
            || "Explore courses offered by this department.";

        const courseCount = allCourses.filter(course =>
            String(getDepartmentId(course)) === String(id)
        ).length;

        return `
            <button class="department-card"
                    type="button"
                    data-department-id="${escapeHTML(id ?? "")}">

                <span class="department-number">
                    ${String(index + 1).padStart(2, "0")}
                </span>

                <span class="department-arrow">↗</span>

                <h3>${escapeHTML(name)}</h3>

                <p class="department-faculty">
                    ${escapeHTML(faculty)}
                </p>

                <p class="department-description">
                    ${escapeHTML(description)}
                </p>

                <span class="department-course-count">
                    ${courseCount}
                    ${courseCount === 1 ? "course" : "courses"}
                    <span>→</span>
                </span>
            </button>
        `;
    }).join("");

    departmentList.querySelectorAll(".department-card").forEach(card => {
        card.addEventListener("click", () => {
            departmentFilter.value = card.dataset.departmentId;

            applyFilters();

            document.getElementById("courseExplorer")?.scrollIntoView({
                behavior: "smooth"
            });
        });
    });
}


function renderCourses(courses) {
    if (courses.length === 0) {
        courseGrid.innerHTML = "";
        emptyState.hidden = false;

        return;
    }

    emptyState.hidden = true;

    courseGrid.innerHTML = courses.map(course => {
        const courseId = getField(
            course,
            "course_id",
            "courseId",
            "id"
        );

        return `
            <article class="course-card">

                <div class="card-accent"></div>

                <div class="course-card-top">
                    <span class="course-code">
                        ${escapeHTML(getCourseCode(course))}
                    </span>

                    <span class="card-symbol" aria-hidden="true">✦</span>
                </div>

                <div class="course-card-content">
                    <span class="course-category">
                        ${escapeHTML(getDepartmentName(course))}
                    </span>

                    <h3>${escapeHTML(getCourseName(course))}</h3>
                </div>

                <div class="course-card-bottom">

                    <div class="course-fee">
                        <span>Estimated fee</span>

                        <strong>${escapeHTML(getFee(course))}</strong>
                    </div>

                    <a class="details-button"
                       href="course-details.html?id=${encodeURIComponent(courseId ?? "")}">
                        View Details <span>↗</span>
                    </a>

                </div>
            </article>
        `;
    }).join("");
}


function applyFilters() {
    const searchTerm = courseSearch.value.trim().toLowerCase();

    const selectedDepartment = departmentFilter.value;
    const selectedLevel = levelFilter.value;
    const selectedAvailability = availabilityFilter.value;

    const filteredCourses = allCourses.filter(course => {
        const name = getCourseName(course).toLowerCase();
        const code = getCourseCode(course).toLowerCase();
        const department = getDepartmentName(course).toLowerCase();
        const description = courseDescription(course).toLowerCase();

        const matchesSearch =
            !searchTerm ||
            name.includes(searchTerm) ||
            code.includes(searchTerm) ||
            department.includes(searchTerm) ||
            description.includes(searchTerm);

        const matchesDepartment =
            !selectedDepartment ||
            String(getDepartmentId(course)) === selectedDepartment;

        const matchesLevel =
            !selectedLevel ||
            String(getCourseLevel(course)) === selectedLevel;

        const available = isCourseAvailable(course);

        const matchesAvailability =
            !selectedAvailability ||
            (
                selectedAvailability === "true" &&
                available === true
            ) ||
            (
                selectedAvailability === "false" &&
                available === false
            );

        return matchesSearch &&
            matchesDepartment &&
            matchesLevel &&
            matchesAvailability;
    });

    resultCount.textContent =
        `${filteredCourses.length} ${
            filteredCourses.length === 1 ? "course" : "courses"
        } found`;

    renderCourses(filteredCourses);
}


function resetFilters() {
    courseSearch.value = "";
    departmentFilter.value = "";
    levelFilter.value = "";
    availabilityFilter.value = "";

    applyFilters();
}


// Search and filter listeners
courseSearch.addEventListener("input", applyFilters);

departmentFilter.addEventListener("change", applyFilters);

levelFilter.addEventListener("change", applyFilters);

availabilityFilter.addEventListener("change", applyFilters);


// Filter reset button
document.getElementById("resetFilters")
    ?.addEventListener("click", resetFilters);


// Empty-state clear filters button
document.getElementById("clearEmptyFilters")
    ?.addEventListener("click", resetFilters);


// Retry loading button
document.getElementById("retryButton")
    ?.addEventListener("click", loadPageData);


// Footer year
const currentYear = document.getElementById("currentYear");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}


// Start loading the page
loadPageData();