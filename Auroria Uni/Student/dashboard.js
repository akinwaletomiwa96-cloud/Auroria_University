(() => {
    "use strict";

    const API_BASE = "http://localhost:8080";

    const API = {
        messages: "/api/communication/applicant",
        user: "/api/student/me",
        profile: "/api/profile",
        applications: "/api/applications",
        courses: "/api/courses",
        academics: "/api/student/academic-records",
        documents: "/api/student/documents",
        payments: "/api/student/payments",
        notifications: "/api/communication/applicant",
        requirements: "/api/admission-requirements",
        enquiries: "/api/student/enquiries"
    };

    /* =====================================================
       STORED USER
    ===================================================== */

    function getStoredUser() {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch (error) {
            console.error("Could not read saved user:", error);
            return {};
        }
    }

    /* =====================================================
       STATE
    ===================================================== */

    const state = {
        page: "overview",
        user: getStoredUser(),
        profile: {},
        courses: [],
        applications: [],
        notificationFilter: "all",
        selectedNotificationId: null,
        academics: [],
        documents: [],
        payments: [],
        notifications: [],
        requirements: [],
        enquiries: [],
        courseSearch: "",
        department: "all",
        applicationSearch: "",
        applicationStatus: "all",
        loaded: false
    };

    const $ = (selector, root = document) =>
        root?.querySelector(selector) || null;

    const $$ = (selector, root = document) =>
        [...(root?.querySelectorAll(selector) || [])];

    const pageContent = $("#pageContent");
    const dialog = $("#detailDialog");
    const dialogContent = $("#dialogContent");

    /* =====================================================
       GENERAL HELPERS
    ===================================================== */

    const esc = value =>
        String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);

    const val = (object, keys, fallback = "") => {
        for (const key of keys) {
            if (
                object &&
                object[key] !== undefined &&
                object[key] !== null &&
                object[key] !== ""
            ) {
                return object[key];
            }
        }

        return fallback;
    };

    const title = value =>
        String(value || "Unknown")
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, character => character.toUpperCase());

    const arr = data =>
        Array.isArray(data) ? data :
            Array.isArray(data?.content) ? data.content :
                Array.isArray(data?.data) ? data.data :
                    Array.isArray(data?.items) ? data.items :
                        [];

    const money = amount =>
        new Intl.NumberFormat("en-IE", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 2
        }).format(Number(amount) || 0);

    const date = value => {
        if (!value) return "—";

        const parsed = new Date(value);

        return Number.isNaN(parsed.getTime())
            ? String(value)
            : parsed.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
    };

    const initials = fullName =>
        String(fullName || "AU")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0] || "")
            .join("")
            .toUpperCase() || "AU";

    /* =====================================================
       USER HELPERS
    ===================================================== */

    const name = () => {
        const stored = getStoredUser();

        const fullName = val(
            state.profile,
            ["fullName", "name", "studentName"],
            val(
                state.user,
                ["fullName", "name", "studentName"],
                val(
                    stored,
                    ["fullName", "name", "studentName", "username"],
                    ""
                )
            )
        );

        return fullName || "Student";
    };


    const getUserId = () => {
        const stored = getStoredUser();

        // Prefer the actual account userId over profile/student IDs.
        const candidates = [
            state.user?.userId,
            stored?.userId,
            state.profile?.userId,
            state.user?.user?.userId,
            stored?.user?.userId,
            state.profile?.user?.userId,

            // Fallbacks for older login response formats.
            state.user?.id,
            stored?.id,
            state.profile?.id,
            localStorage.getItem("userId"),
            localStorage.getItem("user_id")
        ];

        return candidates.find(value =>
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) || "";
    };

    const courseName = course =>
        val(course, ["courseName", "name", "title", "programName"], "Untitled course");

    const courseId = course =>
        val(course, ["courseId", "id", "idCourse"], "");

    const department = course => {
        const value = val(
            course,
            ["departmentName", "department", "category", "faculty"],
            "General"
        );

        if (typeof value === "object" && value !== null) {
            return String(
                val(value, ["departmentName", "name", "title"], "General")
            );
        }

        return String(value);
    };
    const fee = course =>
        val(
            course,
            ["tuitionFee", "courseFee", "fee", "fees", "estimatedFee", "price"],
            0
        );

    const duration = course =>
        val(course, ["duration", "courseDuration", "durationYears"], "See details");

    const description = course =>
        val(
            course,
            ["description", "courseDescription", "overview"],
            "Explore this programme and build skills for your future career."
        );

    const reference = application =>
        val(
            application,
            [
                "bookingCode",
                "referenceCode",
                "applicationReference",
                "referenceNumber",
                "applicationNumber"
            ],
            "Pending"
        );

    const statusClass = status => {
        const normalized = String(status || "pending")
            .toLowerCase()
            .replace(/\s+/g, "-");

        const known = [
            "approved",
            "paid",
            "completed",
            "pending",
            "under-review",
            "processing",
            "rejected",
            "unpaid",
            "failed",
            "read",
            "available"
        ];

        return known.includes(normalized)
            ? `status-${normalized}`
            : "";
    };

    const pill = status => `
        <span class="status ${statusClass(status)}">
            ${esc(title(status))}
        </span>
    `;


    function isUnread(notification) {
        const readValue = notification?.read;

        const isRead =
            readValue === true ||
            String(readValue).toLowerCase() === "true" ||
            Boolean(notification?.readAt);

        return !isRead;
    }

    function unreadNotificationCount() {
        return state.notifications.filter(isUnread).length;
    }

    function unreadNotificationCount() {
        return state.notifications.filter(isUnread).length;
    }

    /* =====================================================
       API REQUESTS
    ===================================================== */

    async function request(path, options = {}) {
        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        if (options.body && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        const token =
            localStorage.getItem("token") ||
            localStorage.getItem("authToken");

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(API_BASE + path, {
            ...options,
            headers
        });

        const raw = await response.text();

        let data = null;

        if (raw) {
            try {
                data = JSON.parse(raw);
            } catch {
                data = raw;
            }
        }
        if (!response.ok) {
            const message =
                typeof data === "object" && data
                    ? val(
                        data,
                        [
                            "message",
                            "error",
                            "detail",
                            "errors",
                            "validationErrors"
                        ],
                        JSON.stringify(data)
                    )
                    : data || response.statusText;

            const error = new Error(
                `${response.status} ${message || "Request failed"}`
            );

            error.status = response.status;
            error.responseData = data;

            throw error;
        }

        return data;
    }

    async function optional(key, path) {
        try {
            return await request(path);
        } catch (error) {
            console.warn(`Could not load ${key}:`, error.message);
            return null;
        }
    }

    /* =====================================================
       LOAD PROFILE
    ===================================================== */

    async function loadProfile() {
        const userId = getUserId();
        const storedUser = getStoredUser();

        state.profile = {
            ...storedUser,
            ...state.user
        };

        if (!userId) {
            console.warn("Profile loading skipped: user ID missing.");
            return state.profile;
        }

        try {
            const result = await request(
                `${API.profile}/${encodeURIComponent(userId)}`
            );

            const profileData =
                result?.data?.profile ||
                result?.data ||
                result?.profile ||
                result ||
                {};

            state.profile = {
                ...state.profile,
                ...profileData
            };

            return state.profile;

        } catch (error) {
            console.error("Could not load profile:", error);
            return state.profile;
        }
    }

    /* =====================================================
       LOAD DASHBOARD
    ===================================================== */

    
async function load() {
    try {
        const storedUser = getStoredUser();

        state.user = {
            ...storedUser,
            ...state.user
        };

        // Load the profile before resolving the final account ID.
        await loadProfile();

        const userId = getUserId();

        if (!userId) {
            console.error(
                "Cannot load student messages: user ID is missing."
            );
        }

        const endpoints = {
            courses: API.courses,

            applications: userId
                ? `${API.applications}/user/${encodeURIComponent(userId)}`
                : null,

            notifications: userId
                ? `${API.notifications}/${encodeURIComponent(userId)}/messages`
                : null
        };

        const results = await Promise.all(
            Object.entries(endpoints).map(async ([key, path]) => {
                if (!path) {
                    return [key, null];
                }

                return [key, await optional(key, path)];
            })
        );

        results.forEach(([key, result]) => {
            if (result !== null) {
                state[key] = arr(result);
            }
        });

        console.log("STUDENT USER ID:", userId);
        console.log("LOADED APPLICATIONS:", state.applications);
        console.log("LOADED MESSAGES:", state.notifications);

        state.loaded = true;

        updateChrome();
        render();

    } catch (error) {
        console.error("Dashboard loading failed:", error);

        state.loaded = true;
        updateChrome();

        if (pageContent) {
            pageContent.innerHTML = `
                <div class="panel">
                    <div class="empty-state">
                        <div class="empty-icon">!</div>
                        <h3>Could not load dashboard</h3>
                        <p>${esc(error.message)}</p>
                    </div>
                </div>
            `;
        }
    }
}

    /* =====================================================
       UI HELPERS
    ===================================================== */

   
function updateChrome() {
    const currentName = name();

    const headerName = $("#headerName");
    const headerAvatar = $("#headerAvatar");
    const notificationBadge = $("#notificationBadge");
    const topNotificationDot = $("#topNotificationDot");

    if (headerName) {
        headerName.textContent = currentName;
    }

    if (headerAvatar) {
        headerAvatar.textContent = initials(currentName);
    }

    const unreadCount = unreadNotificationCount();

    if (notificationBadge) {
        notificationBadge.textContent = unreadCount;

        notificationBadge.classList.toggle(
            "hidden",
            unreadCount === 0
        );
    }

    if (topNotificationDot) {
        topNotificationDot.classList.toggle(
            "hidden",
            unreadCount === 0
        );
    }
}
    function toast(message, type = "") {
        let region = $("#toastRegion");

        if (!region) {
            region = document.createElement("div");
            region.id = "toastRegion";
            region.className = "toast-region";

            document.body.appendChild(region);
        }

        const element = document.createElement("div");

        element.className = `toast ${type}`;
        element.textContent = message;

        region.appendChild(element);

        setTimeout(() => element.remove(), 4000);
    }

    function go(page) {
        state.page = page;

        $$(".nav-link[data-page]").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

        const pageTitle = $("#pageTitle");
        const sidebar = $("#sidebar");
        const globalAlert = $("#globalAlert");

        if (pageTitle) {
            pageTitle.textContent = title(page);
        }

        sidebar?.classList.remove("open");
        globalAlert?.classList.add("hidden");

        render();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    function heading(titleText, subtitle, action = "") {
        return `
            <div class="page-heading">
                <div>
                    <p class="eyebrow">AURORIA STUDENT PORTAL</p>
                    <h1>${esc(titleText)}</h1>
                    <p class="subheading">${esc(subtitle)}</p>
                </div>
                ${action}
            </div>
        `;
    }

    function phead(titleText, subtitle = "", action = "") {
        return `
            <div class="panel-heading">
                <div>
                    <h2>${esc(titleText)}</h2>
                    ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
                </div>
                ${action}
            </div>
        `;
    }

    function empty(titleText, message, button = "", page = "") {
        return `
            <div class="empty-state">
                <div class="empty-icon">✧</div>
                <h3>${esc(titleText)}</h3>
                <p>${esc(message)}</p>

                ${button
                ? `
                            <button
                                class="btn btn-primary"
                                data-page="${esc(page)}"
                            >
                                ${esc(button)}
                            </button>
                        `
                : ""
            }
            </div>
        `;
    }

    function stat(icon, label, value, foot) {
        return `
            <article class="stat-card">
                <div class="stat-top">
                    <span class="stat-label">${esc(label)}</span>
                    <span class="stat-icon">${icon}</span>
                </div>
                <div class="stat-value">${esc(value)}</div>
                <div class="stat-foot">${esc(foot)}</div>
            </article>
        `;
    }

    /* =====================================================
       RENDER
    ===================================================== */


    function render() {
        if (!pageContent) {
            console.error(
                "Dashboard cannot render: #pageContent is missing."
            );
            return;
        }

        if (!state.loaded) {
            pageContent.innerHTML = `
            <div class="loading-panel">
                Loading dashboard…
            </div>
        `;
            return;
        }

        const pages = {
            overview,
            applications,
            courses,
            profile,
            payments,
            notifications,
            requirements,
            enquiries
        };

        const renderPage = pages[state.page] || overview;

        pageContent.innerHTML = renderPage();
    }


    /* =====================================================
       OVERVIEW
    ===================================================== */

    function overview() {
        const first =
            name().split(/\s+/)[0] || "Student";

        const pending = state.applications.filter(application =>
            /pending|review|processing/i.test(
                val(
                    application,
                    ["status", "applicationStatus"],
                    "pending"
                )
            )
        ).length;

        const approved = state.applications.filter(application =>
            /approved|accepted/i.test(
                val(
                    application,
                    ["status", "applicationStatus"],
                    ""
                )
            )
        ).length;

        const unread = unreadNotificationCount();

        const recent =
            state.applications.slice(0, 4);

        return `
            <div class="welcome-banner">
                <p class="eyebrow">YOUR FUTURE STARTS HERE</p>

                <h1>
                    Welcome back, ${esc(first)}.
                </h1>

                <p>
                    Explore programmes, review your applications,
                    and stay up to date with Auroria University.
                </p>

                <button
                    class="btn"
                    data-page="courses"
                >
                    Explore programmes →
                </button>
            </div>

            <div class="grid stats-grid">
                ${stat(
            "▤",
            "Applications",
            state.applications.length,
            "All submitted applications"
        )}

                ${stat(
            "◷",
            "Under review",
            pending,
            "Awaiting a decision"
        )}

                ${stat(
            "✓",
            "Approved",
            approved,
            "Offers and approvals"
        )}

                ${stat(
            "♧",
            "Unread notifications",
            unread,
            "Latest portal updates"
        )}
            </div>

            <div class="grid dashboard-grid">
                <div>

                    <section class="panel">
                        ${phead(
            "Quick actions",
            "Jump straight to what you need"
        )}

                        <div class="quick-actions">

                            <button
                                class="quick-action"
                                data-page="courses"
                            >
                                <span class="stat-icon">⌕</span>

                                <span>
                                    <strong>Find a course</strong>
                                    <small>Explore programmes</small>
                                </span>
                            </button>

                            <button
                                class="quick-action"
                                data-page="applications"
                            >
                                <span class="stat-icon">▤</span>

                                <span>
                                    <strong>My applications</strong>
                                    <small>Check progress</small>
                                </span>
                            </button>

                        </div>
                    </section>

                    <section class="panel">

                        ${phead(
            "Recent applications",
            "Your latest submitted applications",
            `
                            <button
                                class="link-button"
                                data-page="applications"
                            >
                                View all →
                            </button>
                            `
        )}

                        ${recent.length
                ? `
                                <div class="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Programme</th>
                                                <th>Reference</th>
                                                <th>Status</th>
                                                <th></th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            ${recent.map(application => `
                                                <tr>
                                                    <td>
                                                        <strong>
                                                            ${esc(
                    val(
                        application,
                        [
                            "courseName",
                            "courseTitle",
                            "programName"
                        ],
                        "Course application"
                    )
                )}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        ${esc(
                    reference(application)
                )}
                                                    </td>

                                                    <td>
                                                        ${pill(
                    val(
                        application,
                        [
                            "status",
                            "applicationStatus"
                        ],
                        "Pending"
                    )
                )}
                                                    </td>

                                                    <td>
                                                        <button
                                                            class="table-action"
                                                            data-action="application-detail"
                                                            data-id="${esc(
                    val(
                        application,
                        [
                            "applicationId",
                            "id"
                        ],
                        ""
                    )
                )}"
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join("")}
                                        </tbody>
                                    </table>
                                </div>
                                `
                : empty(
                    "No applications yet",
                    "When you apply, your application and reference will appear here.",
                    "Explore courses",
                    "courses"
                )
            }

                    </section>
                </div>

                <div>

                    <section class="panel">

                        ${phead(
                "Your student profile",
                "Account overview"
            )}

                        <div class="info-grid">

                            <div class="info-item">
                                <small>Full name</small>
                                <strong>${esc(name())}</strong>
                            </div>

                            <div class="info-item">
                                <small>Email</small>
                                <strong>
                                    ${esc(
                val(
                    state.profile,
                    ["email"],
                    val(
                        state.user,
                        ["email"],
                        "Not provided"
                    )
                )
            )}
                                </strong>
                            </div>

                            <div class="info-item">
                                <small>Account ID</small>
                                <strong>
                                    ${esc(
                getUserId() || "Not assigned"
            )}
                                </strong>
                            </div>

                            <div class="info-item">
                                <small>Status</small>
                                <strong>
                                    ${esc(
                title(
                    val(
                        state.profile,
                        ["accountStatus", "status"],
                        "Active"
                    )
                )
            )}
                                </strong>
                            </div>

                        </div>

                        <button
                            class="btn btn-secondary"
                            data-page="profile"
                            style="margin-top:18px"
                        >
                            View profile
                        </button>

                    </section>

                    <section class="panel">

                        ${phead(
                "Latest updates",
                "Notifications from your portal"
            )}

                        ${state.notifications.length
                ? state.notifications
                    .slice(0, 4)
                    .map(notification => `
                                        <div class="activity-item">
                                            <span class="activity-marker">
                                                ♧
                                            </span>

                                            <div>
                                                <strong>
                                                    ${esc(
                        val(
                            notification,
                            ["title", "subject"],
                            "Student update"
                        )
                    )}
                                                </strong>

                                                <p>
                                                    ${esc(
                        val(
                            notification,
                            [
                                "message",
                                "description",
                                "body"
                            ],
                            "You have a new update."
                        )
                    )}
                                                </p>
                                            </div>
                                        </div>
                                    `).join("")
                : empty(
                    "You're all caught up",
                    "New notifications will appear here."
                )
            }

                    </section>

                </div>
            </div>
        `;
    }

    /* =====================================================
       COURSES
    ===================================================== */

    function filteredCourses() {
        return state.courses.filter(course => {
            const searchText = `
                ${courseName(course)}
                ${department(course)}
                ${description(course)}
            `.toLowerCase();

            const matchesSearch =
                searchText.includes(
                    state.courseSearch.toLowerCase()
                );

            const matchesDepartment =
                state.department === "all" ||
                department(course).toLowerCase() ===
                state.department.toLowerCase();

            return matchesSearch && matchesDepartment;
        });
    }

    function courses() {
        const departments = [
            ...new Set(
                state.courses.map(department)
            )
        ].sort();

        const list = filteredCourses();

        return `
            ${heading(
            "Explore courses",
            "Discover a programme that fits your interests and career goals."
        )}

            <div class="toolbar">

                <div class="search-field">
                    <input
                        id="courseSearch"
                        type="search"
                        value="${esc(state.courseSearch)}"
                        placeholder="Search courses or departments…"
                    >
                </div>

                <div class="filter-field">
                    <select id="departmentFilter">

                        <option value="all">
                            All departments
                        </option>

                        ${departments.map(dept => `
                            <option
                                value="${esc(dept)}"
                                ${state.department.toLowerCase() ===
                dept.toLowerCase()
                ? "selected"
                : ""
            }
                            >
                                ${esc(dept)}
                            </option>
                        `).join("")}

                    </select>
                </div>

            </div>

            <div class="panel">

                ${phead(
                `${list.length} programme${list.length === 1 ? "" : "s"
                } found`,
                "Course fees are displayed in euros (€)."
            )}

                ${list.length
                ? `
                        <div class="grid course-grid">
                            ${list.map(courseCard).join("")}
                        </div>
                        `
                : empty(
                    "No matching courses",
                    "Try another search or department."
                )
            }

            </div>
        `;
    }

    function courseCard(course) {
        const id = courseId(course);
        const courseTitle = courseName(course);

        const symbol =
            /comput|software|data|technology|IT/i.test(courseTitle)
                ? "⌘"
                : /business|econom|account/i.test(courseTitle)
                    ? "▥"
                    : /health|medical|nurs/i.test(courseTitle)
                        ? "✚"
                        : "✧";

        return `
            <article class="course-card">

                <div class="course-art">
                    <span class="course-symbol">
                        ${symbol}
                    </span>

                    <span class="course-tag">
                        ${esc(department(course))}
                    </span>
                </div>

                <div class="course-body">

                    <div class="course-department">
                        ${esc(department(course))}
                    </div>

                    <h3>
                        ${esc(courseTitle)}
                    </h3>

                    <p class="course-description">
                        ${esc(description(course))}
                    </p>

                    <div class="course-meta">

                        <span>
                            Duration
                            <strong>
                                ${esc(duration(course))}
                            </strong>
                        </span>

                        <span>
                            Estimated fee
                            <strong class="course-fee">
                                ${money(fee(course))}
                            </strong>
                        </span>

                    </div>

                    <div class="course-actions">

                        <button
                            class="btn btn-secondary btn-small"
                            data-action="course-detail"
                            data-id="${esc(id)}"
                        >
                            Details
                        </button>

                        <button
                            class="btn btn-primary btn-small"
                            data-action="apply-course"
                            data-id="${esc(id)}"
                        >
                            Apply now
                        </button>

                    </div>

                </div>
            </article>
        `;
    }

    function findCourse(id) {
        return state.courses.find(course =>
            String(courseId(course)) === String(id)
        );
    }

    function courseDetail(id) {
        const course = findCourse(id);

        if (!course) {
            toast("Course details not found.", "error");
            return;
        }

        if (!dialog || !dialogContent) {
            toast(
                "The course details dialog is missing.",
                "error"
            );
            return;
        }

        dialogContent.innerHTML = `
            <p class="eyebrow">
                ${esc(department(course))}
            </p>

            <h2>
                ${esc(courseName(course))}
            </h2>

            <p>
                ${esc(description(course))}
            </p>

            <div class="detail-section">

                <h3>Programme details</h3>

                <div class="info-grid">

                    <div class="info-item">
                        <small>Duration</small>
                        <strong>
                            ${esc(duration(course))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Estimated tuition</small>
                        <strong>
                            ${money(fee(course))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Department</small>
                        <strong>
                            ${esc(department(course))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Course ID</small>
                        <strong>
                            ${esc(id || "Not provided")}
                        </strong>
                    </div>

                </div>
            </div>

            <div class="detail-actions">

                <button
                    class="btn btn-primary"
                    data-action="apply-course"
                    data-id="${esc(id)}"
                >
                    Apply for this course
                </button>

                <button
                    class="btn btn-secondary"
                    data-action="close-dialog"
                >
                    Close
                </button>

            </div>
        `;

        if (!dialog.open) {
            dialog.showModal();
        }
    }

    /* =====================================================
       APPLICATIONS
    ===================================================== */

    function applications() {
        const list = state.applications.filter(application => {
            const searchText = `
                ${val(
                application,
                ["courseName", "courseTitle", "programName"],
                ""
            )}
                ${reference(application)}
                ${val(
                application,
                ["status", "applicationStatus"],
                ""
            )}
            `.toLowerCase();

            const matchesSearch =
                searchText.includes(
                    state.applicationSearch.toLowerCase()
                );

            const currentStatus =
                String(
                    val(
                        application,
                        ["status", "applicationStatus"],
                        ""
                    )
                ).toLowerCase();

            const matchesStatus =
                state.applicationStatus === "all" ||
                currentStatus === state.applicationStatus;

            return matchesSearch && matchesStatus;
        });

        return `
            ${heading(
            "My applications",
            "Track your admissions journey and keep your reference codes safe.",
            `
                <button
                    class="btn btn-primary"
                    data-page="courses"
                >
                    ＋ New application
                </button>
                `
        )}

            <section class="panel">

                ${phead(
            "Application history",
            "Your submitted applications"
        )}

                <div class="toolbar">

                    <div class="search-field">
                        <input
                            id="applicationSearch"
                            type="search"
                            placeholder="Search programme or reference…"
                            value="${esc(state.applicationSearch)}"
                        >
                    </div>

                    <div class="filter-field">
                        <select id="applicationStatus">

                            <option value="all">
                                All statuses
                            </option>

                            ${[
                "pending",
                "under review",
                "approved",
                "rejected",
                "completed"
            ].map(status => `
                                <option
                                    value="${status}"
                                    ${state.applicationStatus === status
                    ? "selected"
                    : ""
                }
                                >
                                    ${title(status)}
                                </option>
                            `).join("")}

                        </select>
                    </div>

                </div>

                ${list.length
                ? `
                        <div class="table-wrap">

                            <table>

                                <thead>
                                    <tr>
                                        <th>Programme</th>
                                        <th>Reference code</th>
                                        <th>Date submitted</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    ${list.map(application => `
                                        <tr>

                                            <td>
                                                <strong>
                                                    ${esc(
                    val(
                        application,
                        [
                            "courseName",
                            "courseTitle",
                            "programName"
                        ],
                        "Course application"
                    )
                )}
                                                </strong>
                                            </td>

                                            <td>
                                                ${esc(reference(application))}
                                            </td>

                                            <td>
                                                ${date(
                    val(
                        application,
                        [
                            "submittedAt",
                            "applicationDate",
                            "createdAt",
                            "dateSubmitted"
                        ],
                        ""
                    )
                )}
                                            </td>

                                            <td>
                                                ${pill(
                    val(
                        application,
                        [
                            "status",
                            "applicationStatus"
                        ],
                        "Pending"
                    )
                )}
                                            </td>

                                            <td>
                                                <button
                                                    class="table-action"
                                                    data-action="application-detail"
                                                    data-id="${esc(
                    val(
                        application,
                        [
                            "applicationId",
                            "id"
                        ],
                        ""
                    )
                )}"
                                                >
                                                    View details
                                                </button>
                                            </td>

                                        </tr>
                                    `).join("")}

                                </tbody>

                            </table>

                        </div>
                        `
                : empty(
                    "No applications found",
                    "Applications you submit will be listed here.",
                    "Explore courses",
                    "courses"
                )
            }

            </section>
        `;
    }

    function appDetail(id) {
        const application = state.applications.find(item =>
            String(
                val(item, ["applicationId", "id"], "")
            ) === String(id)
        );

        if (!application) {
            toast(
                "Application details not found.",
                "error"
            );
            return;
        }

        if (!dialog || !dialogContent) {
            toast(
                "The application details dialog is missing.",
                "error"
            );
            return;
        }

        dialogContent.innerHTML = `
            <p class="eyebrow">
                APPLICATION DETAILS
            </p>

            <h2>
                ${esc(
            val(
                application,
                [
                    "courseName",
                    "courseTitle",
                    "programName"
                ],
                "Course application"
            )
        )}
            </h2>

            <div class="detail-section">

                <div class="info-grid">

                    <div class="info-item">
                        <small>Booking / reference code</small>
                        <strong>
                            ${esc(reference(application))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Status</small>
                        ${pill(
            val(
                application,
                ["status", "applicationStatus"],
                "Pending"
            )
        )}
                    </div>

                    <div class="info-item">
                        <small>Submitted</small>
                        <strong>
                            ${date(
            val(
                application,
                [
                    "submittedAt",
                    "applicationDate",
                    "createdAt"
                ],
                ""
            )
        )}
                        </strong>
                    </div>

                </div>
            </div>

            <div class="detail-actions">

                <button
                    class="btn btn-secondary"
                    data-action="copy-reference"
                    data-reference="${esc(reference(application))}"
                >
                    Copy reference
                </button>

                <button
                    class="btn btn-secondary"
                    data-action="close-dialog"
                >
                    Close
                </button>

            </div>
        `;

        if (!dialog.open) {
            dialog.showModal();
        }
    }

    function getApplicationCourseId(application) {
        return val(
            application,
            [
                "courseId",
                "course_id",
                "idCourse"
            ],
            val(
                application?.course,
                ["courseId", "id"],
                val(
                    application?.courseDetails,
                    ["courseId", "id"],
                    ""
                )
            )
        );
    }

    function hasAlreadyApplied(course) {
        const selectedId = String(courseId(course));

        const selectedName = courseName(course)
            .trim()
            .toLowerCase();

        return state.applications.some(application => {
            const existingId = getApplicationCourseId(application);

            // Compare course IDs whenever both are available.
            if (existingId && selectedId) {
                return String(existingId) === selectedId;
            }

            // Fallback for applications that don't contain a course ID.
            const existingName = val(
                application,
                [
                    "courseName",
                    "courseTitle",
                    "programName"
                ],
                val(
                    application?.course,
                    ["courseName", "name", "title"],
                    ""
                )
            );

            return existingName.trim().toLowerCase() === selectedName;
        });
    }
    function apply(id) {
        const course = findCourse(id);

        if (!course) {
            toast(
                "Course not found. Please refresh the page.",
                "error"
            );
            return;
        }

        const selectedCourseId = courseId(course);

        if (!selectedCourseId) {
            toast("Course ID is missing.", "error");
            return;
        }

        // RULE 1: Prevent applying for the same course twice.
        if (hasAlreadyApplied(course)) {
            toast(
                "You have already applied for this course. You cannot apply for the same course twice.",
                "error"
            );
            return;
        }

        // RULE 2: Maximum of three applications per student.
        if (state.applications.length >= 3) {
            toast(
                "You have reached the maximum limit of 3 course applications. You cannot apply for another course.",
                "error"
            );
            return;
        }

        // Save the selected course.
        localStorage.setItem(
            "selectedApplicationCourse",
            JSON.stringify({
                courseId: selectedCourseId,
                courseName: courseName(course)
            })
        );

        // Open the application form.
        window.location.href =
            `application-form.html?courseId=${encodeURIComponent(selectedCourseId)}`;
    }
    /* =====================================================
       PROFILE
    ===================================================== */

    function profileInfo(label, value) {
        return `
            <div class="profile-info-item">
                <span>${esc(label)}</span>
                <strong>
                    ${esc(value || "Not provided")}
                </strong>
            </div>
        `;
    }

    function profile() {
        const p = {
            ...getStoredUser(),
            ...state.user,
            ...state.profile
        };

        const fullName = val(
            p,
            ["fullName", "name", "studentName"],
            name()
        );

        const email = val(p, ["email"], "");
        const phone = val(
            p,
            ["phone", "phoneNumber", "telephone"],
            ""
        );

        const dob = val(
            p,
            ["dateOfBirth"],
            ""
        );

        const address = val(
            p,
            ["address", "homeAddress"],
            ""
        );

        const nationality = val(
            p,
            ["nationality"],
            ""
        );

        const stateOfOrigin = val(
            p,
            ["stateOfOrigin"],
            ""
        );

        const emergencyContact = val(
            p,
            ["emergencyContact"],
            ""
        );

        const accountId = val(
            p,
            ["userId", "id", "studentId"],
            getUserId()
        );

        const accountStatus = val(
            p,
            ["accountStatus", "status"],
            "Active"
        );

        return `
            ${heading(
            "My profile",
            "Manage your personal information and student account."
        )}

            <div class="profile-page">

                <section class="profile-hero panel">

                    <div
                        class="profile-hero-avatar"
                        id="profileHeroAvatar"
                    >
                        ${esc(initials(fullName))}
                    </div>

                    <div class="profile-hero-info">

                        <span class="profile-label">
                            STUDENT PROFILE
                        </span>

                        <h2 id="profileHeroName">
                            ${esc(fullName || "Your name")}
                        </h2>

                        <p id="profileHeroEmail">
                            ${esc(email || "No email available")}
                        </p>

                        <span class="profile-account-status">
                            ● ${esc(title(accountStatus))}
                        </span>

                    </div>

                    <button
                        class="btn btn-primary"
                        id="editProfileButton"
                        type="button"
                    >
                        ✎ Edit profile
                    </button>

                </section>

                <div class="profile-content-grid">

                    <section class="panel profile-details-panel">

                        ${phead(
            "Personal information",
            "Your registered personal details"
        )}

                        <div id="profileDisplayMode">

                            <div class="profile-info-grid">

                                ${profileInfo(
            "Full name",
            fullName
        )}

                                ${profileInfo(
            "Email address",
            email
        )}

                                ${profileInfo(
            "Phone number",
            phone
        )}

                                ${profileInfo(
            "Date of birth",
            dob ? date(dob) : ""
        )}

                                ${profileInfo(
            "Nationality",
            nationality
        )}

                                ${profileInfo(
            "State of origin",
            stateOfOrigin
        )}

                                ${profileInfo(
            "Residential address",
            address
        )}

                                ${profileInfo(
            "Emergency contact",
            emergencyContact
        )}

                                ${profileInfo(
            "Account ID",
            accountId
        )}

                            </div>

                        </div>

                        <form id="profileEditForm" class="profile-edit-form hidden" novalidate>

    <div class="profile-form-grid">

        <div class="field">
            <label for="profileFullName">Full name *</label>
            <input
                id="profileFullName"
                name="fullName"
                value="${esc(fullName)}"
                required
                minlength="2"
                maxlength="150"
                autocomplete="name"
            >
            <small class="field-error" id="fullNameError"></small>
        </div>

        <div class="field">
            <label for="profileEmail">Email address</label>
            <input
                id="profileEmail"
                type="email"
                value="${esc(email)}"
                readonly
                disabled
            >
        </div>

        <div class="field">
            <label for="profilePhone">Phone number *</label>
            <input
                id="profilePhone"
                name="phone"
                type="tel"
                value="${esc(phone)}"
                required
                maxlength="25"
                placeholder="+2348012345678"
                autocomplete="tel"
            >
            <small class="field-error" id="phoneError"></small>
        </div>

        <div class="field">
            <label for="profileDob">Date of birth *</label>
            <input
                id="profileDob"
                name="dateOfBirth"
                type="date"
                value="${esc(String(dob).slice(0, 10))}"
                required
            >
            <small class="field-error" id="dobError"></small>
        </div>

        <div class="field">
            <label for="profileNationality">Nationality *</label>
            <input
                id="profileNationality"
                name="nationality"
                value="${esc(nationality)}"
                required
                maxlength="60"
                placeholder="e.g. Nigerian"
            >
            <small class="field-error" id="nationalityError"></small>
        </div>

        <div class="field">
            <label for="profileState">State of origin *</label>
            <input
                id="profileState"
                name="stateOfOrigin"
                value="${esc(stateOfOrigin)}"
                required
                maxlength="60"
                placeholder="e.g. Lagos"
            >
            <small class="field-error" id="stateError"></small>
        </div>

        <div class="field">
            <label for="profileEmergency">Emergency contact *</label>
            <input
                id="profileEmergency"
                name="emergencyContact"
                type="tel"
                value="${esc(emergencyContact)}"
                required
                maxlength="25"
                placeholder="+2348012345678"
            >
            <small class="field-error" id="emergencyError"></small>
        </div>

        <div class="field profile-full-width">
            <label for="profileAddress">Residential address *</label>
            <textarea
                id="profileAddress"
                name="address"
                rows="3"
                required
                minlength="5"
                maxlength="300"
            >${esc(address)}</textarea>
            <small class="field-error" id="addressError"></small>
        </div>

    </div>

    <div class="profile-form-actions">

        <button
            type="button"
            class="btn btn-secondary"
            id="cancelProfileEdit"
        >
            Cancel
        </button>

        <button
            type="submit"
            class="btn btn-primary"
            id="saveProfileButton"
        >
            Save changes
        </button>

    </div>

</form>

                    </section>

                    <aside class="profile-preview panel">

                        ${phead(
            "Profile preview",
            "This is how your profile appears"
        )}

                        <div class="preview-card">

                            <div
                                class="preview-avatar"
                                id="previewAvatar"
                            >
                                ${esc(initials(fullName))}
                            </div>

                            <h3 id="previewName">
                                ${esc(fullName || "Your name")}
                            </h3>

                            <p id="previewEmail">
                                ${esc(email)}
                            </p>

                            <div class="preview-divider"></div>

                            <div class="preview-detail">
                                <span>Phone</span>
                                <strong id="previewPhone">
                                    ${esc(phone || "Not provided")}
                                </strong>
                            </div>

                            <div class="preview-detail">
                                <span>Nationality</span>
                                <strong id="previewNationality">
                                    ${esc(
            nationality || "Not provided"
        )}
                                </strong>
                            </div>

                            <div class="preview-detail">
                                <span>State of origin</span>
                                <strong id="previewState">
                                    ${esc(
            stateOfOrigin || "Not provided"
        )}
                                </strong>
                            </div>

                            <div class="preview-detail">
                                <span>Date of birth</span>
                                <strong id="previewDob">
                                    ${esc(
            dob
                ? date(dob)
                : "Not provided"
        )}
                                </strong>
                            </div>

                        </div>

                    </aside>

                </div>

            </div>
        `;
    }

    function enableProfileEditing() {
        const displayMode =
            $("#profileDisplayMode");

        const editForm =
            $("#profileEditForm");

        const editButton =
            $("#editProfileButton");

        if (!displayMode || !editForm) {
            console.error(
                "Profile editing elements are missing."
            );
            return;
        }

        displayMode.classList.add("hidden");
        editForm.classList.remove("hidden");

        editButton?.classList.add("hidden");

        updateProfilePreview();
    }

    function cancelProfileEditing() {
        render();
    }

    function updateProfilePreview() {
        const get = id =>
            document.getElementById(id)?.value.trim() || "";

        const fullName = get("profileFullName");

        const email =
            $("#profileEmail")?.value || "";

        const phone = get("profilePhone");

        const nationality =
            get("profileNationality");

        const origin =
            get("profileState");

        const dob =
            get("profileDob");

        const setText = (id, value) => {
            const element =
                document.getElementById(id);

            if (element) {
                element.textContent = value;
            }
        };

        setText(
            "previewName",
            fullName || "Your name"
        );

        setText(
            "previewEmail",
            email
        );

        setText(
            "previewPhone",
            phone || "Not provided"
        );

        setText(
            "previewNationality",
            nationality || "Not provided"
        );

        setText(
            "previewState",
            origin || "Not provided"
        );

        setText(
            "previewDob",
            dob ? date(dob) : "Not provided"
        );

        setText(
            "previewAvatar",
            initials(fullName)
        );

        setText(
            "profileHeroAvatar",
            initials(fullName)
        );

        setText(
            "profileHeroName",
            fullName || "Your name"
        );
    }
    function validateProfileForm() {
        const fields = {
            fullName: $("#profileFullName"),
            phone: $("#profilePhone"),
            dob: $("#profileDob"),
            nationality: $("#profileNationality"),
            state: $("#profileState"),
            emergency: $("#profileEmergency"),
            address: $("#profileAddress")
        };

        const errors = {
            fullName: $("#fullNameError"),
            phone: $("#phoneError"),
            dob: $("#dobError"),
            nationality: $("#nationalityError"),
            state: $("#stateError"),
            emergency: $("#emergencyError"),
            address: $("#addressError")
        };

        // Clear previous errors.
        Object.values(errors).forEach(element => {
            if (element) element.textContent = "";
        });

        Object.values(fields).forEach(field => {
            field?.classList.remove("invalid");
        });

        let valid = true;

        function reject(field, errorElement, message) {
            valid = false;

            if (field) {
                field.classList.add("invalid");
            }

            if (errorElement) {
                errorElement.textContent = message;
            }
        }

        const fullName = fields.fullName?.value.trim() || "";
        const phone = fields.phone?.value.trim() || "";
        const dob = fields.dob?.value || "";
        const nationality = fields.nationality?.value.trim() || "";
        const origin = fields.state?.value.trim() || "";
        const emergency = fields.emergency?.value.trim() || "";
        const address = fields.address?.value.trim() || "";

        // Full name
        if (fullName.length < 2) {
            reject(
                fields.fullName,
                errors.fullName,
                "Full name must contain at least 2 characters."
            );
        } else if (fullName.length > 150) {
            reject(
                fields.fullName,
                errors.fullName,
                "Full name cannot exceed 150 characters."
            );
        } else if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(fullName)) {
            reject(
                fields.fullName,
                errors.fullName,
                "Enter a valid name using letters only."
            );
        }

        // Phone number
        const phonePattern = /^\+?[0-9\s()-]{7,20}$/;

        if (!phone) {
            reject(
                fields.phone,
                errors.phone,
                "Phone number is required."
            );
        } else if (!phonePattern.test(phone)) {
            reject(
                fields.phone,
                errors.phone,
                "Enter a valid phone number."
            );
        } else if (phone.replace(/\D/g, "").length < 7 ||
            phone.replace(/\D/g, "").length > 15) {
            reject(
                fields.phone,
                errors.phone,
                "Phone number must contain 7–15 digits."
            );
        }

        // Date of birth
        if (!dob) {
            reject(
                fields.dob,
                errors.dob,
                "Date of birth is required."
            );
        } else {
            const selectedDate = new Date(`${dob}T00:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (
                Number.isNaN(selectedDate.getTime()) ||
                selectedDate > today
            ) {
                reject(
                    fields.dob,
                    errors.dob,
                    "Date of birth cannot be in the future."
                );
            }
        }

        // Nationality
        if (!nationality) {
            reject(
                fields.nationality,
                errors.nationality,
                "Nationality is required."
            );
        } else if (!/^[\p{L}\p{M}\s.'-]+$/u.test(nationality)) {
            reject(
                fields.nationality,
                errors.nationality,
                "Enter a valid nationality."
            );
        }

        // State of origin
        if (!origin) {
            reject(
                fields.state,
                errors.state,
                "State of origin is required."
            );
        } else if (!/^[\p{L}\p{M}\s.'-]+$/u.test(origin)) {
            reject(
                fields.state,
                errors.state,
                "Enter a valid state or region."
            );
        }

        // Emergency contact
        if (!emergency) {
            reject(
                fields.emergency,
                errors.emergency,
                "Emergency contact is required."
            );
        } else if (
            !phonePattern.test(emergency) ||
            emergency.replace(/\D/g, "").length < 7 ||
            emergency.replace(/\D/g, "").length > 15
        ) {
            reject(
                fields.emergency,
                errors.emergency,
                "Enter a valid emergency phone number."
            );
        }

        // Address
        if (address.length < 5) {
            reject(
                fields.address,
                errors.address,
                "Address must contain at least 5 characters."
            );
        } else if (address.length > 300) {
            reject(
                fields.address,
                errors.address,
                "Address cannot exceed 300 characters."
            );
        }

        if (!valid) {
            const firstInvalid = $(".invalid", $("#profileEditForm"));

            firstInvalid?.focus();
        }

        return valid;
    }

    async function saveProfile(event) {
        event.preventDefault();

        const form = event.target;

        if (!validateProfileForm()) {
            toast("Please correct the highlighted fields.", "error");
            return;
        }

        const userId = getUserId();

        if (!userId) {
            toast(
                "Your account ID could not be found.",
                "error"
            );
            return;
        }

        const payload = {
            fullName:
                $("#profileFullName")?.value.trim() || "",

            phone:
                $("#profilePhone")?.value.trim() || "",

            dateOfBirth:
                $("#profileDob")?.value || null,

            nationality:
                $("#profileNationality")?.value.trim() || "",

            stateOfOrigin:
                $("#profileState")?.value.trim() || "",

            emergencyContact:
                $("#profileEmergency")?.value.trim() || "",

            address:
                $("#profileAddress")?.value.trim() || ""
        };

        const button =
            $("#saveProfileButton");

        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        try {
            const result = await request(
                `${API.profile}/${encodeURIComponent(userId)}`,
                {
                    method: "PUT",
                    body: JSON.stringify(payload)
                }
            );

            const updated =
                result?.data || result || {};

            state.profile = {
                ...state.profile,
                ...payload,
                ...updated
            };

            state.user = {
                ...state.user,
                fullName: payload.fullName,
                phone: payload.phone
            };

            localStorage.setItem(
                "user",
                JSON.stringify(state.user)
            );

            updateChrome();

            toast(
                "Your profile was updated successfully.",
                "success"
            );

            render();

        } catch (error) {
            console.error(
                "Profile update failed:",
                error
            );

            toast(
                `Could not save profile: ${error.message}`,
                "error"
            );

            if (button) {
                button.disabled = false;
                button.textContent = "Save changes";
            }
        }
    }



    /* =====================================================
       PAYMENTS
    ===================================================== */

    function payments() {
        return `
            ${heading(
            "Payments",
            "Review payment records returned by the university system."
        )}

            <section class="panel">

                ${phead(
            "Payment history",
            "Amounts are displayed in euros (€)."
        )}

                ${state.payments.length
                ? `
                        <div class="table-wrap">
                            <table>

                                <thead>
                                    <tr>
                                        <th>Payment</th>
                                        <th>Reference</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    ${state.payments.map(payment => `
                                        <tr>

                                            <td>
                                                <strong>
                                                    ${esc(
                    val(
                        payment,
                        [
                            "description",
                            "purpose",
                            "paymentType"
                        ],
                        "University payment"
                    )
                )}
                                                </strong>
                                            </td>

                                            <td>
                                                ${esc(
                    val(
                        payment,
                        [
                            "reference",
                            "referenceCode",
                            "paymentReference"
                        ],
                        "—"
                    )
                )}
                                            </td>

                                            <td>
                                                ${date(
                    val(
                        payment,
                        [
                            "paymentDate",
                            "createdAt",
                            "date"
                        ],
                        ""
                    )
                )}
                                            </td>

                                            <td>
                                                <strong>
                                                    ${money(
                    val(
                        payment,
                        [
                            "amount",
                            "total",
                            "fee"
                        ],
                        0
                    )
                )}
                                                </strong>
                                            </td>

                                            <td>
                                                ${pill(
                    val(
                        payment,
                        [
                            "status",
                            "paymentStatus"
                        ],
                        "Pending"
                    )
                )}
                                            </td>

                                        </tr>
                                    `).join("")}

                                </tbody>

                            </table>
                        </div>
                        `
                : empty(
                    "No payments recorded",
                    "Payment records will appear here when available."
                )
            }

            </section>
        `;
    }
    /* =====================================================
   NOTIFICATION HELPERS
===================================================== */

    function formatMessageDate(value) {
        if (!value) return "Date unavailable";

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
            return String(value);
        }

        return parsed.toLocaleString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getNotification(messageId) {
        return state.notifications.find(notification =>
            String(notification.messageId) === String(messageId)
        );
    }


    /* =====================================================
       OPEN MESSAGE
    ===================================================== */

    async function openNotification(messageId) {
        const notification = getNotification(messageId);

        if (!notification) {
            toast("This message could not be found.", "error");
            return;
        }

        state.selectedNotificationId = messageId;

        // Show the message immediately.
        render();

        // Automatically mark unread messages as read.
        if (isUnread(notification)) {
            const userId = getUserId();

            if (!userId) return;

            try {
                const updated = await request(
                    `${API.notifications}/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}/read`,
                    {
                        method: "PATCH"
                    }
                );

                const updatedMessage =
                    updated?.data || updated || {};

                state.notifications = state.notifications.map(item =>
                    String(item.messageId) === String(messageId)
                        ? {
                            ...item,
                            ...updatedMessage,
                            read: true,
                            readAt: updatedMessage.readAt ||
                                new Date().toISOString()
                        }
                        : item
                );

                updateChrome();
                render();

            } catch (error) {
                console.error(
                    "Could not mark message as read:",
                    error
                );

                toast(
                    "Message opened, but its read status could not be updated.",
                    "error"
                );
            }
        }
    }


    /* =====================================================
       RETURN TO INBOX
    ===================================================== */

    function closeNotification() {
        state.selectedNotificationId = null;
        render();
    }


    /* =====================================================
       DELETE MESSAGE
    ===================================================== */

    async function deleteNotification(messageId) {
        const userId = getUserId();

        if (!userId || !messageId) {
            toast("Could not identify this message.", "error");
            return;
        }

        if (!window.confirm(
            "Are you sure you want to delete this message from your inbox?"
        )) {
            return;
        }

        try {
            await request(
                `${API.notifications}/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}`,
                {
                    method: "DELETE"
                }
            );

            state.notifications = state.notifications.filter(
                notification =>
                    String(notification.messageId) !== String(messageId)
            );

            state.selectedNotificationId = null;

            updateChrome();
            render();

            toast("Message deleted successfully.", "success");

        } catch (error) {
            console.error("Could not delete message:", error);

            toast(
                `Could not delete message: ${error.message}`,
                "error"
            );
        }
    }


    /* =====================================================
       NOTIFICATION INBOX
    ===================================================== */

    function notifications() {
        const unread = unreadNotificationCount();

        // If a message is selected, show its reading view.
        if (state.selectedNotificationId !== null) {
            const selected = getNotification(
                state.selectedNotificationId
            );

            if (selected) {
                return notificationDetail(selected);
            }

            state.selectedNotificationId = null;
        }

        const filteredNotifications = state.notifications.filter(
            notification => {
                const read = !isUnread(notification);

                if (state.notificationFilter === "unread") {
                    return !read;
                }

                if (state.notificationFilter === "read") {
                    return read;
                }

                return true;
            }
        );

        const filters = [
            {
                key: "all",
                label: "All messages",
                count: state.notifications.length
            },
            {
                key: "unread",
                label: "Unread",
                count: unread
            },
            {
                key: "read",
                label: "Read",
                count: state.notifications.length - unread
            }
        ];

        return `
        ${heading(
            "University correspondence",
            "View official communications and important messages from Auroria University."
        )}

        <section class="panel official-inbox">

            <div class="official-inbox-header">

                <div>
                    <span class="official-inbox-label">
                        STUDENT COMMUNICATIONS
                    </span>

                    <h2>Inbox</h2>

                    <p>
                        Your official university correspondence.
                    </p>
                </div>

                <div class="official-inbox-summary">
                    <strong>${state.notifications.length}</strong>
                    <span>Total messages</span>
                </div>

            </div>


            <div class="official-inbox-toolbar">

                <div class="official-inbox-count">
                    <span class="official-unread-dot"></span>

                    <strong>
                        ${unread} unread
                    </strong>
                </div>

                <div class="official-inbox-filters">

                    ${filters.map(filter => `
                        <button
                            type="button"
                            class="official-filter ${state.notificationFilter === filter.key
                ? "active"
                : ""
            }"
                            data-notification-filter="${filter.key}"
                        >
                            ${filter.label}

                            <span>
                                ${filter.count}
                            </span>
                        </button>
                    `).join("")}

                </div>

            </div>


            <div class="official-message-list">

                ${filteredNotifications.length

                ? filteredNotifications.map(notification => {
                    const read = !isUnread(notification);

                    const messageId = notification.messageId;

                    return `
                            <article class="official-message-row ${read ? "message-read" : "message-unread"
                        }">

                                <div class="official-message-indicator">
                                    ${read
                            ? '<span class="read-indicator">✓</span>'
                            : '<span class="unread-indicator"></span>'
                        }
                                </div>


                                <button
                                    type="button"
                                    class="official-message-main"
                                    data-action="notification-open"
                                    data-id="${esc(messageId)}"
                                >

                                    <div class="official-message-sender">
                                        <strong>
                                            ${esc(
                            notification.senderName ||
                            "Auroria University"
                        )}
                                        </strong>

                                        ${!read
                            ? '<span class="official-new-label">NEW</span>'
                            : ""
                        }
                                    </div>


                                    <div class="official-message-subject">
                                        ${esc(
                            notification.subject ||
                            "University correspondence"
                        )}
                                    </div>


                                    <div class="official-message-preview">
                                        ${esc(
                            notification.body ||
                            "No message preview available."
                        )}
                                    </div>

                                </button>


                                <div class="official-message-meta">

                                    <span class="official-message-date">
                                        ${esc(
                            notification.sentAt
                                ? date(notification.sentAt)
                                : "Date unavailable"
                        )}
                                    </span>

                                    <span class="official-message-category">
                                        ${esc(
                            title(
                                notification.messageType ||
                                "General"
                            )
                        )}
                                    </span>

                                    <button
                                        type="button"
                                        class="official-delete-button"
                                        data-action="notification-delete"
                                        data-id="${esc(messageId)}"
                                        aria-label="Delete message"
                                        title="Delete message"
                                    >
                                        ×
                                    </button>

                                </div>

                            </article>
                        `;
                }).join("")

                : `
                        <div class="official-inbox-empty">

                            <div class="official-empty-icon">
                                ✉
                            </div>

                            <h3>
                                ${state.notificationFilter === "unread"
                    ? "No unread messages"
                    : state.notificationFilter === "read"
                        ? "No read messages"
                        : "Your inbox is empty"
                }
                            </h3>

                            <p>
                                ${state.notificationFilter === "unread"
                    ? "You have read all your university messages."
                    : "Official communications from Auroria University will appear here."
                }
                            </p>

                        </div>
                    `
            }

            </div>

        </section>
    `;
    }


    /* =====================================================
       OPENED MESSAGE VIEW
    ===================================================== */

    function notificationDetail(notification) {
        const senderName =
            notification.senderName || "Auroria University";

        const recipientName =
            notification.recipientName || name();

        const recipientEmail =
            notification.recipientEmail ||
            val(state.profile, ["email"], "Not available");

        const senderEmail =
            notification.senderEmail || "";

        const messageId = notification.messageId;

        const read = !isUnread(notification);

        return `
        ${heading(
            "University correspondence",
            "Read your official communication from Auroria University."
        )}

        <section class="panel official-message-view">

            <div class="official-message-view-toolbar">

                <button
                    type="button"
                    class="official-back-button"
                    data-action="notification-back"
                >
                    ← Back to inbox
                </button>

                <div class="official-message-view-actions">

                    <span class="official-message-status ${read ? "status-read" : "status-unread"
            }">
                        ${read ? "✓ Read" : "● Unread"}
                    </span>

                    <button
                        type="button"
                        class="official-delete-button"
                        data-action="notification-delete"
                        data-id="${esc(messageId)}"
                        title="Delete message"
                    >
                        Delete
                    </button>

                </div>

            </div>


            <div class="official-message-document">

                <div class="official-letter-heading">

                    <div class="official-letter-crest">
                        <img style="width: 65px; height: 65px; object-fit: contain; flex-shrink: 0;"
                            src="image/auroria-crest.png"
                            alt="Auroria University crest"
                        >
                    </div>

                    <div>
                        <strong>AURORIA UNIVERSITY</strong>
                        <span>OFFICIAL UNIVERSITY COMMUNICATION</span>
                    </div>

                </div>


                <div class="official-letter-divider"></div>


                <div class="official-letter-reference">

                    <span>
                        UNIVERSITY CORRESPONDENCE
                    </span>

                    <span>
                        ${esc(
                notification.applicationReference
                    ? `Reference: ${notification.applicationReference}`
                    : `Message ID: ${messageId}`
            )}
                    </span>

                </div>


                <h2 class="official-letter-subject">
                    ${esc(
                notification.subject ||
                "University correspondence"
            )}
                </h2>


                <div class="official-letter-information">

                    <div class="official-letter-field">

                        <span>FROM</span>

                        <strong>
                            ${esc(senderName)}
                        </strong>

                        ${senderEmail
                ? `<small>${esc(senderEmail)}</small>`
                : ""
            }

                    </div>


                    <div class="official-letter-field">

                        <span>TO</span>

                        <strong>
                            ${esc(recipientName)}
                        </strong>

                        <small>
                            ${esc(recipientEmail)}
                        </small>

                    </div>


                    <div class="official-letter-field">

                        <span>DATE SENT</span>

                        <strong>
                            ${esc(formatMessageDate(notification.sentAt))}
                        </strong>

                    </div>


                    <div class="official-letter-field">

                        <span>COMMUNICATION TYPE</span>

                        <strong>
                            ${esc(
                title(
                    notification.messageType || "General"
                )
            )}
                        </strong>

                    </div>

                </div>


                <div class="official-letter-divider"></div>


                <div class="official-letter-body">

                    <p class="official-letter-greeting">
                        Dear ${esc(recipientName)},
                    </p>

                    <div class="official-letter-content">
                        ${esc(
                notification.body ||
                "No message content is available."
            ).replace(/\r?\n/g, "<br>")}
                    </div>

                </div>


                <div class="official-letter-signature">

                    <p>Yours sincerely,</p>

                    <strong>${esc(senderName)}</strong>

                    <span>
                        Auroria University
                    </span>

                </div>


                <div class="official-letter-footer">

                    <span>
                        AURORIA UNIVERSITY
                    </span>

                    <span>
                        Official Student Communication
                    </span>

                </div>

            </div>

        </section>
    `;
    }
    /* =====================================================
       REQUIREMENTS
    ===================================================== */

    function requirements() {
        const defaults = [
            [
                "Academic qualifications",
                "Provide the required school-leaving certificates and examination results for your chosen programme."
            ],
            [
                "Identity information",
                "Ensure your personal details match your official documents."
            ],
            [
                "Supporting documents",
                "Upload any programme-specific documents requested by admissions."
            ],
            [
                "Application review",
                "Submit accurate information and monitor your application reference."
            ]
        ];

        return `
            ${heading(
            "Entry requirements",
            "Review admissions guidance. Programme-specific rules may differ."
        )}

            <section class="panel">

                ${phead(
            "Admissions checklist",
            "Confirm exact requirements with the admissions team"
        )}

                <div class="requirement-list">

                    ${defaults.map(([titleText, descriptionText]) => `
                        <div class="requirement-item">

                            <span class="requirement-check">
                                ✓
                            </span>

                            <div>
                                <strong>
                                    ${titleText}
                                </strong>

                                <p>
                                    ${descriptionText}
                                </p>
                            </div>

                        </div>
                    `).join("")}

                </div>

            </section>
        `;
    }

    /* =====================================================
       ENQUIRIES
    ===================================================== */

    function enquiries() {
        return `
            ${heading(
            "Enquiries",
            "Send a question to the student support team."
        )}

            <div class="grid dashboard-grid">

                <section class="panel">

                    ${phead(
            "Contact student support",
            "Complete and submit the form"
        )}

                    <form id="enquiryForm">

                        <div class="field">

                            <label for="enquirySubject">
                                Subject
                            </label>

                            <input
                                id="enquirySubject"
                                name="subject"
                                required
                                maxlength="120"
                                placeholder="What do you need help with?"
                            >

                        </div>

                        <div class="field">

                            <label for="enquiryCategory">
                                Category
                            </label>

                            <select
                                id="enquiryCategory"
                                name="category"
                                required
                            >

                                <option value="">
                                    Choose a category
                                </option>

                                <option>Admissions</option>
                                <option>Applications</option>
                                <option>Courses and fees</option>
                                <option>Student profile</option>
                                <option>Technical support</option>
                                <option>Other</option>

                            </select>

                        </div>

                        <div class="field">

                            <label for="enquiryMessage">
                                Message
                            </label>

                            <textarea
                                id="enquiryMessage"
                                name="message"
                                required
                                minlength="10"
                                maxlength="2000"
                                placeholder="Write your question here…"
                            ></textarea>

                        </div>

                        <button
                            class="btn btn-primary"
                            type="submit"
                        >
                            Submit enquiry →
                        </button>

                    </form>

                </section>

                <section class="panel">

                    ${phead(
            "Your enquiries",

        )}

                    ${state.enquiries.length
                ? state.enquiries.map(enquiry => `
                                <div class="activity-item">

                                    <span class="activity-marker">
                                        ✉
                                    </span>

                                    <div>

                                        <strong>
                                            ${esc(
                    val(
                        enquiry,
                        ["subject", "title"],
                        "Enquiry"
                    )
                )}
                                        </strong>

                                        <p>
                                            ${esc(
                    val(
                        enquiry,
                        [
                            "message",
                            "description"
                        ],
                        ""
                    )
                )}
                                        </p>

                                    </div>

                                </div>
                            `).join("")
                : empty(
                    "No previous enquiries",

                )
            }

                </section>

            </div>
        `;
    }

    async function submitEnquiry(form) {
        const data = Object.fromEntries(
            new FormData(form).entries()
        );

        const button =
            form.querySelector(
                'button[type="submit"]'
            );

        if (button) {
            button.disabled = true;
            button.textContent = "Submitting…";
        }

        try {
            await request(API.enquiries, {
                method: "POST",
                body: JSON.stringify(data)
            });

            toast(
                "Enquiry submitted.",
                "success"
            );

            form.reset();

            await load();

            go("enquiries");

        } catch (error) {
            toast(
                `Enquiry could not be saved: ${error.message}`,
                "error"
            );

            if (button) {
                button.disabled = false;
                button.textContent = "Submit enquiry →";
            }
        }
    }

    /* =====================================================
       CLIPBOARD
    ===================================================== */

    async function copyText(value) {
        try {
            await navigator.clipboard.writeText(value);

            toast(
                "Copied to clipboard.",
                "success"
            );

        } catch {
            toast(
                `Copy this reference: ${value}`
            );
        }
    }

    /* =====================================================
       EVENT LISTENERS
    ===================================================== */

    document.addEventListener("click", event => {

        const pageButton =
            event.target.closest("[data-page]");

        if (pageButton) {
            event.preventDefault();

            go(pageButton.dataset.page);

            return;
        }
        const notificationFilter =
            event.target.closest("[data-notification-filter]");

        if (notificationFilter) {
            state.notificationFilter =
                notificationFilter.dataset.notificationFilter;

            render();
            return;
        }

        if (
            event.target.closest("#editProfileButton")
        ) {
            enableProfileEditing();
            return;
        }

        if (
            event.target.closest("#cancelProfileEdit")
        ) {
            cancelProfileEditing();
            return;
        }

        const button =
            event.target.closest("[data-action]");

        if (!button) return;

        const {
            action,
            id,
            reference: refValue
        } = button.dataset;

        if (action === "notification-open") {
            openNotification(id);
            return;
        }

        if (action === "notification-back") {
            closeNotification();
            return;
        }
        if (action === "notification-delete") {
            deleteNotification(id);
            return;
        }

        if (action === "course-detail") {
            courseDetail(id);

        } else if (action === "apply-course") {
            apply(id);

        } else if (
            action === "application-detail"
        ) {
            appDetail(id);

        } else if (
            action === "close-dialog" &&
            dialog?.open
        ) {
            dialog.close();

        } else if (
            action === "copy-reference"
        ) {
            copyText(refValue || "");
        }

    });

    document.addEventListener("input", event => {

        if (event.target.id === "courseSearch") {

            state.courseSearch =
                event.target.value;

            const position =
                event.target.selectionStart;

            render();

            const input =
                $("#courseSearch");

            input?.focus();

            if (
                input &&
                position !== null
            ) {
                input.setSelectionRange(
                    position,
                    position
                );
            }
        }

        if (
            event.target.id ===
            "applicationSearch"
        ) {
            state.applicationSearch =
                event.target.value;

            const position =
                event.target.selectionStart;

            render();

            const input =
                $("#applicationSearch");

            input?.focus();

            if (
                input &&
                position !== null
            ) {
                input.setSelectionRange(
                    position,
                    position
                );
            }
        }

        if (
            event.target.closest("#profileEditForm")
        ) {
            updateProfilePreview();
        }

    });

    document.addEventListener("change", event => {

        if (
            event.target.id ===
            "departmentFilter"
        ) {
            state.department =
                event.target.value;

            render();
        }

        if (
            event.target.id ===
            "applicationStatus"
        ) {
            state.applicationStatus =
                event.target.value;

            render();
        }

    });

    document.addEventListener("submit", event => {

        if (
            event.target.id === "enquiryForm"
        ) {
            event.preventDefault();

            submitEnquiry(event.target);
        }

        if (
            event.target.id ===
            "profileEditForm"
        ) {
            event.preventDefault();

            saveProfile(event);
        }

    });

    /* =====================================================
       MOBILE MENU
    ===================================================== */

    const mobileMenu =
        $("#mobileMenu");

    if (mobileMenu) {
        mobileMenu.addEventListener(
            "click",
            () => {
                $("#sidebar")
                    ?.classList.toggle("open");
            }
        );
    }

    /* =====================================================
       LOGOUT
    ===================================================== */

    const logoutButton =
        $("#logoutButton");

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            () => {

                localStorage.removeItem("token");
                localStorage.removeItem("authToken");
                localStorage.removeItem("user");
                localStorage.removeItem("userId");
                localStorage.removeItem("user_id");

                window.location.href =
                    "login.html";
            }
        );
    }

    /* =====================================================
       INITIALIZATION
    ===================================================== */

    const yearElement = $("#year");

    if (yearElement) {
        yearElement.textContent =
            new Date().getFullYear();
    }

    if (!pageContent) {
        console.error(
            "Dashboard initialization failed: #pageContent was not found in dashboard.html"
        );

        return;
    }

    load().catch(error => {
        console.error(
            "Dashboard loading failed:",
            error
        );

        pageContent.innerHTML = `
            <div class="panel">
                <div class="empty-state">
                    <div class="empty-icon">!</div>
                    <h3>Could not load dashboard</h3>
                    <p>
                        Check Spring Boot at
                        ${esc(API_BASE)}.
                    </p>
                </div>
            </div>
        `;
    });

})();