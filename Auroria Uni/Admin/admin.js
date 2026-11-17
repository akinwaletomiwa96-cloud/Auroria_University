
(() => {
    "use strict";

    /* =====================================================
       AURORIA UNIVERSITY ADMIN DASHBOARD
    ===================================================== */

    const API_BASE = window.AURORIA_CONFIG?.apiBaseUrl
        || "http://localhost:8080";

    /*
       IMPORTANT:
       Only add endpoint paths here after confirming that
       the corresponding Spring Boot controller exists.
    */
    const API = {
        overview: "/api/admin/overview",
        students: null,
        staff: null,
        admissions: null,
        applications: null,
        courses: null,
        departments: null,
        academics: null,
        finance: null,
        communications: null,
        reports: null,
        website: null,
        audit: null,
        notifications: null,
        profile: null,
        settings: null
    };

    const PAGE_TITLES = {
        overview: "Dashboard Overview",
        students: "Student Management",
        staff: "Staff Management",
        admissions: "Admissions Management",
        applications: "Applications",
        courses: "Courses & Departments",
        academics: "Academic Management",
        finance: "Payments & Finance",
        communications: "Communications",
        reports: "Reports & Analytics",
        website: "Website Management",
        audit: "Audit Logs",
        notifications: "Notifications",
        profile: "My Profile",
        settings: "System Settings"
    };

    const PAGE_DESCRIPTIONS = {
        overview: "Monitor university activities, statistics and recent updates.",
        students: "Manage student accounts, profiles and academic information.",
        staff: "Manage university employees, staff accounts and permissions.",
        admissions: "Oversee admissions operations and admission officers.",
        applications: "View and monitor submitted admission applications.",
        courses: "Manage university courses, departments and fees.",
        academics: "Manage academic sessions, semesters and academic records.",
        finance: "Monitor payments, transactions and outstanding fees.",
        communications: "Manage university announcements and communications.",
        reports: "Review university performance and generate reports.",
        website: "Manage public-facing university website content.",
        audit: "Review administrative activity and system changes.",
        notifications: "View your administrative notifications.",
        profile: "View and manage your administrator profile.",
        settings: "Manage university and system configuration."
    };

    const state = {
        currentPage: "overview",
        currentData: [],
        searchTerm: "",
        currentFilter: "all",
        confirmCallback: null,
        isLoading: false
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    const pageContent = $("#pageContent");
    const pageTitle = $("#pageTitle");
    const sidebar = $("#sidebar");
    const detailDialog = $("#detailDialog");
    const confirmDialog = $("#confirmDialog");

    /* =====================================================
       UTILITIES
    ===================================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function getInitials(name) {
        return String(name || "Administrator")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0]?.toUpperCase() || "")
            .join("") || "AD";
    }

    function showToast(message, type = "success") {
        const region = $("#toastRegion");
        if (!region) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.textContent = message;

        region.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 4500);
    }

    function showAlert(message) {
        const alert = $("#globalAlert");
        if (!alert) return;

        alert.textContent = message;
        alert.classList.remove("hidden");
    }

    function hideAlert() {
        $("#globalAlert")?.classList.add("hidden");
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function formatCurrency(value) {
        const amount = Number(value);

        if (!Number.isFinite(amount)) return "—";

        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 2
        }).format(amount);
    }

    function normaliseStatus(value) {
        return String(value || "unknown")
            .trim()
            .toLowerCase()
            .replaceAll("_", " ")
            .replaceAll("-", " ");
    }

    function statusBadge(status) {
        const clean = normaliseStatus(status);

        let type = "info";

        if (
            ["active", "approved", "accepted", "paid",
                "verified", "completed", "success"].includes(clean)
        ) {
            type = "success";
        } else if (
            ["pending", "submitted", "under review",
                "processing", "draft"].includes(clean)
        ) {
            type = "warning";
        } else if (
            ["rejected", "inactive", "failed",
                "suspended", "cancelled"].includes(clean)
        ) {
            type = "danger";
        }

        return `<span class="status-badge ${type}">
            ${escapeHTML(clean)}
        </span>`;
    }

    /* =====================================================
       AUTHENTICATION / ADMIN PROFILE
    ===================================================== */

    function readStoredUser() {
        const possibleKeys = ["user", "currentUser"];

        for (const key of possibleKeys) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;

                const parsed = JSON.parse(raw);

                if (parsed && typeof parsed === "object") {
                    return parsed;
                }
            } catch {
                // Ignore malformed stored values.
            }
        }

        return null;
    }

    function initialiseAdminProfile() {
        const user = readStoredUser();

        const name =
            user?.fullName ||
            user?.name ||
            user?.username ||
            "Administrator";

        const role = String(
            user?.roleName ||
            user?.role ||
            user?.userRole ||
            ""
        ).toUpperCase();
        /*
           This is a frontend safety check only.
           Backend Spring Security must enforce the actual role.
        */

        if (role && !["ADMIN", "ADMINISTRATOR", "SUPER_ADMIN"].includes(role)) {
            showAlert(
                "The saved account does not have an administrator role. " +
                "Please sign in using an authorized administrator account."
            );
        }

        $("#headerName").textContent = name;
        $("#sidebarAdminName").textContent = name;

        $("#headerAvatar").textContent = getInitials(name);
        $("#sidebarAvatar").textContent = getInitials(name);

        $("#year").textContent = new Date().getFullYear();
    }

    function logout() {
        const confirmed = window.confirm(
            "Are you sure you want to sign out?"
        );

        if (!confirmed) return;

        /*
           Clear the known authentication storage keys.
           Add any other keys used by your auth.js here.
        */

        [
            "user",
            "currentUser",
            "userId",
            "user_id",
            "token",
            "authToken"
        ].forEach(key => localStorage.removeItem(key));

        sessionStorage.clear();

        window.location.href = "../Login/login.html";
    }

    /* =====================================================
       API REQUEST HANDLER
    ===================================================== */

    async function request(path, options = {}) {
        if (!path) {
            throw new Error(
                "This feature's backend endpoint has not been configured yet."
            );
        }

        const headers = {
            "Accept": "application/json",
            ...(options.headers || {})
        };

        if (
            options.body &&
            !(options.body instanceof FormData)
        ) {
            headers["Content-Type"] = "application/json";
        }

        const token =
            localStorage.getItem("token") ||
            localStorage.getItem("authToken");

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
            `${API_BASE}${path}`,
            {
                ...options,
                credentials: "include",
                headers
            }
        );

        const contentType =
            response.headers.get("content-type") || "";

        const result = contentType.includes("application/json")
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            const message =
                result?.message ||
                result?.error ||
                result ||
                `Request failed (${response.status})`;

            throw new Error(
                typeof message === "string"
                    ? message
                    : `Request failed (${response.status})`
            );
        }

        return result;
    }

    async function loadEndpoint(page) {
        const endpoint = API[page];

        if (!endpoint) {
            return {
                configured: false,
                data: []
            };
        }

        const result = await request(endpoint);

        const data = Array.isArray(result)
            ? result
            : result?.content ||
            result?.data ||
            result?.items ||
            [];

        return {
            configured: true,
            data: Array.isArray(data) ? data : [],
            raw: result
        };
    }

    /* =====================================================
       NAVIGATION
    ===================================================== */

    function setActiveNavigation(page) {
        $$(".nav-link").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });
    }

    async function navigate(page) {
        if (!PAGE_TITLES[page]) return;

        state.currentPage = page;
        state.searchTerm = "";
        state.currentFilter = "all";

        setActiveNavigation(page);

        pageTitle.textContent = PAGE_TITLES[page];

        sidebar.classList.remove("open");
        hideAlert();

        window.history.replaceState(
            { page },
            "",
            `#${page}`
        );

        await renderPage(page);
    }

    /* =====================================================
       PAGE RENDERING
    ===================================================== */

    async function renderPage(page) {
        pageContent.innerHTML = `
            <div class="loading-state">
                Loading ${escapeHTML(PAGE_TITLES[page])}...
            </div>
        `;

        try {
            if (page === "overview") {
                await renderOverview();
                return;
            }

            if (page === "courses") {
                await renderCourses();
                return;
            }

            if (page === "profile") {
                await renderProfile();
                return;
            }

            await renderManagementPage(page);

        } catch (error) {
            console.error(`Failed to render ${page}:`, error);

            pageContent.innerHTML = `
                <div class="error-state">
                    <strong>Unable to load this section</strong>
                    ${escapeHTML(error.message)}
                    <br>
                    <button class="btn-secondary"
                        data-action="retry-page">
                        Try again
                    </button>
                </div>
            `;
        }
    }

    /* =====================================================
       OVERVIEW
    ===================================================== */


    async function renderOverview() {
        const overview = await request(API.overview);

        const metrics = [
            {
                label: "Registered students",
                value: overview.totalStudents,
                icon: "♙",
                note: "Applicant accounts"
            },
            {
                label: "Staff members",
                value: overview.totalStaff,
                icon: "♧",
                note: "University employees"
            },
            {
                label: "Total applications",
                value: overview.totalApplications,
                icon: "▤",
                note: "Submitted applications"
            },
            {
                label: "Pending applications",
                value: overview.pendingApplications,
                icon: "◷",
                note: "Awaiting a decision"
            },
            {
                label: "Approved applications",
                value: overview.approvedApplications,
                icon: "✓",
                note: "Successful applications"
            },
            {
                label: "Rejected applications",
                value: overview.rejectedApplications,
                icon: "✕",
                note: "Unsuccessful applications"
            },
            {
                label: "Courses",
                value: overview.totalCourses,
                icon: "▣",
                note: "University programmes"
            },
            {
                label: "Departments",
                value: overview.totalDepartments,
                icon: "⌂",
                note: "Academic departments"
            }
        ];

        const cards = metrics.map(metric => `
        <article class="stat-card">
            <div class="stat-top">
                <span class="stat-label">
                    ${escapeHTML(metric.label)}
                </span>

                <span class="stat-icon">
                    ${metric.icon}
                </span>
            </div>

            <strong class="stat-value">
                ${Number(metric.value ?? 0).toLocaleString("en-NG")}
            </strong>

            <div class="stat-note">
                ${escapeHTML(metric.note)}
            </div>
        </article>
    `).join("");

        const registrations = (overview.recentRegistrations || [])
            .map(user => `
            <div class="activity-item">
                <div class="activity-icon">♙</div>

                <div class="activity-content">
                    <strong>${escapeHTML(user.fullName)}</strong>
                    <p>${escapeHTML(user.email)}</p>
                    <span>${formatDate(user.registeredAt)}</span>
                </div>
            </div>
        `).join("");

        const activity = (overview.recentActivity || [])
            .map(item => `
            <div class="activity-item">
                <div class="activity-icon">▤</div>

                <div class="activity-content">
                    <strong>${escapeHTML(item.title)}</strong>
                    <p>${escapeHTML(item.description)}</p>
                    <span>${formatDate(item.createdAt)}</span>
                </div>
            </div>
        `).join("");

        const applications = (overview.recentApplications || [])
            .map(application => `
            <tr>
                <td>
                    <strong>
                        ${escapeHTML(application.applicantName)}
                    </strong>
                </td>

                <td>
                    ${escapeHTML(application.referenceCode)}
                </td>

                <td>
                    ${escapeHTML(application.courseName)}
                </td>

                <td>
                    ${statusBadge(application.applicationStatus)}
                </td>

                <td>
                    ${formatDate(application.submittedAt)}
                </td>
            </tr>
        `).join("");

        pageContent.innerHTML = `
        <section class="page-heading">
            <div>
                <span class="eyebrow">
                    UNIVERSITY ADMINISTRATION
                </span>

                <h2>
                    Welcome back,
                    ${escapeHTML($("#headerName")?.textContent || "Administrator")}
                </h2>

                <p>
                    Monitor university operations and
                    administrative activities.
                </p>
            </div>

            <button class="btn-secondary"
                data-action="refresh-page">
                ↻ Refresh
            </button>
        </section>

        <section class="stats-grid">
            ${cards}
        </section>

        <section class="content-grid">

            <div class="card">
                <div class="card-header">
                    <div>
                        <h3>Recent university activity</h3>
                        <p>Latest activity across the university</p>
                    </div>
                </div>

                <div class="activity-list">
                    ${activity || `
                        <div class="empty-state">
                            No recent activity available.
                        </div>
                    `}
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div>
                        <h3>Quick actions</h3>
                        <p>Frequently used administration sections</p>
                    </div>
                </div>

                <div class="quick-actions">
                    <button class="btn-secondary"
                        data-page="students">
                        ♙ Manage students
                    </button>

                    <button class="btn-secondary"
                        data-page="staff">
                        ♧ Manage staff
                    </button>

                    <button class="btn-secondary"
                        data-page="applications">
                        ▤ View applications
                    </button>

                    <button class="btn-secondary"
                        data-page="courses">
                        ▣ Manage courses
                    </button>
                </div>
            </div>

        </section>

        <section class="two-column-grid">

            <div class="card">
                <div class="card-header">
                    <div>
                        <h3>Recent applications</h3>
                        <p>Latest submitted applications</p>
                    </div>

                    <button class="btn-secondary"
                        data-page="applications">
                        View all
                    </button>
                </div>

                ${applications ? `
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Applicant</th>
                                    <th>Reference</th>
                                    <th>Course</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${applications}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        No submitted applications found.
                    </div>
                `}
            </div>

            <div class="card">
                <div class="card-header">
                    <div>
                        <h3>Recent registrations</h3>
                        <p>New student accounts</p>
                    </div>
                </div>

                <div class="activity-list">
                    ${registrations || `
                        <div class="empty-state">
                            No recent registrations found.
                        </div>
                    `}
                </div>
            </div>

        </section>

        <section class="card">
            <div class="card-header">
                <div>
                    <h3>Additional statistics</h3>
                    <p>Other university operations requiring attention</p>
                </div>
            </div>

            <div class="stats-grid">
                <article class="stat-card">
                    <span class="stat-label">Draft applications</span>
                    <strong class="stat-value">
                        ${Number(overview.draftApplications ?? 0).toLocaleString("en-NG")}
                    </strong>
                </article>

                <article class="stat-card">
                    <span class="stat-label">Pending documents</span>
                    <strong class="stat-value">
                        ${Number(overview.pendingDocuments ?? 0).toLocaleString("en-NG")}
                    </strong>
                </article>

                <article class="stat-card">
                    <span class="stat-label">New enquiries</span>
                    <strong class="stat-value">
                        ${Number(overview.newEnquiries ?? 0).toLocaleString("en-NG")}
                    </strong>
                </article>

                <article class="stat-card">
                    <span class="stat-label">Admissions officers</span>
                    <strong class="stat-value">
                        ${Number(overview.totalAdmissionsOfficers ?? 0).toLocaleString("en-NG")}
                    </strong>
                </article>
            </div>
        </section>
    `;
    }


    /* =====================================================
       MANAGEMENT PAGES
    ===================================================== */

    const TABLE_CONFIG = {
        students: {
            name: "Students",
            description: PAGE_DESCRIPTIONS.students,
            columns: ["Student", "Email", "Course", "Status"],
            fields: ["fullName", "email", "courseName", "status"],
            search: "Search students..."
        },

        staff: {
            name: "Staff members",
            description: PAGE_DESCRIPTIONS.staff,
            columns: ["Staff member", "Email", "Role", "Status"],
            fields: ["fullName", "email", "role", "status"],
            search: "Search staff..."
        },

        admissions: {
            name: "Admissions operations",
            description: PAGE_DESCRIPTIONS.admissions,
            columns: ["Applicant", "Reference", "Course", "Status"],
            fields: ["applicantName", "referenceCode", "courseName", "status"],
            search: "Search admissions..."
        },

        applications: {
            name: "Applications",
            description: PAGE_DESCRIPTIONS.applications,
            columns: ["Applicant", "Reference", "Course", "Status"],
            fields: ["applicantName", "referenceCode", "courseName", "applicationStatus"],
            search: "Search applications..."
        },

        academics: {
            name: "Academic records",
            description: PAGE_DESCRIPTIONS.academics,
            columns: ["Student", "Course", "Academic year", "Status"],
            fields: ["studentName", "courseName", "academicYear", "status"],
            search: "Search academic records..."
        },

        finance: {
            name: "Payments",
            description: PAGE_DESCRIPTIONS.finance,
            columns: ["Reference", "Student", "Amount", "Status"],
            fields: ["reference", "studentName", "amount", "status"],
            search: "Search payments..."
        },

        communications: {
            name: "Communications",
            description: PAGE_DESCRIPTIONS.communications,
            columns: ["Subject", "Recipient", "Date", "Status"],
            fields: ["subject", "recipient", "createdAt", "status"],
            search: "Search communications..."
        },

        reports: {
            name: "Reports",
            description: PAGE_DESCRIPTIONS.reports,
            columns: ["Report", "Category", "Created", "Status"],
            fields: ["name", "category", "createdAt", "status"],
            search: "Search reports..."
        },

        website: {
            name: "Website content",
            description: PAGE_DESCRIPTIONS.website,
            columns: ["Content", "Category", "Last updated", "Status"],
            fields: ["title", "category", "updatedAt", "status"],
            search: "Search website content..."
        },

        audit: {
            name: "Audit logs",
            description: PAGE_DESCRIPTIONS.audit,
            columns: ["Administrator", "Action", "Record", "Date"],
            fields: ["adminName", "action", "record", "createdAt"],
            search: "Search audit logs..."
        },

        notifications: {
            name: "Notifications",
            description: PAGE_DESCRIPTIONS.notifications,
            columns: ["Title", "Message", "Date", "Status"],
            fields: ["title", "message", "createdAt", "status"],
            search: "Search notifications..."
        }
    };

    async function renderManagementPage(page) {
        const config = TABLE_CONFIG[page];

        if (!config) {
            renderUnavailablePage(page);
            return;
        }

        const result = await loadEndpoint(page);

        state.currentData = result.data;

        const rows = result.data.map((item, index) => {
            return `
                <tr>
                    ${config.fields.map(field => {
                let value = item?.[field];

                if (field.toLowerCase().includes("date") ||
                    field === "createdAt" ||
                    field === "updatedAt") {
                    value = formatDate(value);
                }

                if (field.toLowerCase().includes("amount")) {
                    value = formatCurrency(value);
                }

                if (field.toLowerCase().includes("status")) {
                    return `<td>${statusBadge(value)}</td>`;
                }

                return `
                            <td>
                                ${escapeHTML(value ?? "—")}
                            </td>
                        `;
            }).join("")}

                    <td>
                        <button class="btn-secondary"
                            data-action="view-record"
                            data-index="${index}">
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        pageContent.innerHTML = `
            <section class="page-heading">
                <div>
                    <span class="eyebrow">ADMINISTRATION</span>
                    <h2>${escapeHTML(config.name)}</h2>
                    <p>${escapeHTML(config.description)}</p>
                </div>

                <button class="btn-secondary"
                    data-action="refresh-page">
                    ↻ Refresh
                </button>
            </section>

            <section class="card">

                <div class="table-toolbar">

                    <div class="toolbar-left">
                        <div class="search-box">
                            <input
                                type="search"
                                id="tableSearch"
                                placeholder="${escapeHTML(config.search)}">
                        </div>
                    </div>

                    <div class="toolbar-right">
                        <span class="form-hint">
                            ${result.configured
                ? `${result.data.length} records loaded`
                : "API not configured"}
                        </span>
                    </div>

                </div>

                ${result.configured && result.data.length ? `
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    ${config.columns.map(column =>
                    `<th>${escapeHTML(column)}</th>`
                ).join("")}
                                    <th>Action</th>
                                </tr>
                            </thead>

                            <tbody id="tableBody">
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-icon">▤</div>
                        <strong>
                            ${result.configured
                ? "No records found"
                : "Backend connection required"}
                        </strong>
                        ${result.configured
                ? "There are currently no records to display."
                : "The frontend is ready. Connect this section to its real Spring Boot endpoint to load records."}
                    </div>
                `}
            </section>
        `;

        $("#tableSearch")?.addEventListener("input", event => {
            filterTable(event.target.value);
        });
    }

    function filterTable(value) {
        const term = String(value || "").toLowerCase();

        $$("#tableBody tr").forEach(row => {
            row.hidden = !row.textContent
                .toLowerCase()
                .includes(term);
        });
    }

    /* =====================================================
       COURSES AND DEPARTMENTS
    ===================================================== */

    async function renderCourses() {
        const result = await loadEndpoint("courses");

        state.currentData = result.data;

        pageContent.innerHTML = `
            <section class="page-heading">
                <div>
                    <span class="eyebrow">ACADEMIC STRUCTURE</span>
                    <h2>Courses & Departments</h2>
                    <p>
                        Manage university programmes, departments,
                        availability and estimated tuition fees.
                    </p>
                </div>

                <button class="btn-primary"
                    data-action="create-course">
                    + Add course
                </button>
            </section>

            <section class="two-column-grid">

                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3>Courses</h3>
                            <p>University programmes</p>
                        </div>
                    </div>

                    ${result.configured && result.data.length ? `
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Course</th>
                                        <th>Fee</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${result.data.map((course, index) => `
                                        <tr>
                                            <td>
                                                <span class="table-primary">
                                                    ${escapeHTML(
            course.courseName ||
            course.name ||
            "Unnamed course"
        )}
                                                </span>
                                            </td>

                                            <td>
                                                ${escapeHTML(
            formatCurrency(
                course.estimatedFee ??
                course.fee
            )
        )}
                                            </td>

                                            <td>
                                                ${statusBadge(
            course.status ||
            (course.available
                ? "active"
                : "inactive")
        )}
                                            </td>

                                            <td>
                                                <button class="btn-secondary"
                                                    data-action="view-course"
                                                    data-index="${index}">
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="empty-state">
                            <strong>
                                ${result.configured
                ? "No courses found"
                : "Courses API not connected"}
                            </strong>
                            Connect the courses endpoint to manage
                            actual university programmes.
                        </div>
                    `}
                </div>

                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3>Departments</h3>
                            <p>University academic departments</p>
                        </div>
                    </div>

                    <div class="empty-state">
                        <strong>Department management</strong>
                        A separate departments endpoint has not
                        yet been configured.
                    </div>

                    <button class="btn-secondary"
                        data-action="departments-info">
                        Department settings
                    </button>
                </div>

            </section>
        `;
    }

    /* =====================================================
       PROFILE
    ===================================================== */

    async function renderProfile() {
        const user = readStoredUser() || {};

        pageContent.innerHTML = `
            <section class="page-heading">
                <div>
                    <span class="eyebrow">PERSONAL ACCOUNT</span>
                    <h2>My Profile</h2>
                    <p>View your administrator account information.</p>
                </div>
            </section>

            <section class="card">
                <div class="detail-list">

                    <div class="detail-item">
                        <span>Full name</span>
                        <strong>
                            ${escapeHTML(
            user.fullName ||
            user.name ||
            "Not available"
        )}
                        </strong>
                    </div>

                    <div class="detail-item">
                        <span>Email address</span>
                        <strong>
                            ${escapeHTML(user.email || "Not available")}
                        </strong>
                    </div>

                    <div class="detail-item">
                        <span>Account role</span>
                        <strong>
                            ${escapeHTML(
            user.role ||
            user.userRole ||
            "Not available"
        )}
                        </strong>
                    </div>

                    <div class="detail-item">
                        <span>Account status</span>
                        <strong>
                            ${escapeHTML(
            user.accountStatus ||
            user.status ||
            "Not available"
        )}
                        </strong>
                    </div>

                </div>

                <p class="form-hint" style="margin-top:18px">
                    Profile editing will be enabled after connecting
                    the actual administrator profile endpoint.
                </p>
            </section>
        `;
    }

    /* =====================================================
       UNAVAILABLE / UNIMPLEMENTED SECTIONS
    ===================================================== */

    function renderUnavailablePage(page) {
        pageContent.innerHTML = `
            <section class="page-heading">
                <div>
                    <span class="eyebrow">ADMINISTRATION</span>
                    <h2>${escapeHTML(PAGE_TITLES[page])}</h2>
                    <p>${escapeHTML(PAGE_DESCRIPTIONS[page])}</p>
                </div>
            </section>

            <section class="card">
                <div class="empty-state">
                    <div class="empty-icon">⚙</div>
                    <strong>Section structure ready</strong>
                    This section needs its backend functionality
                    and database integration before it can manage
                    real university records.
                </div>
            </section>
        `;
    }

    /* =====================================================
       DETAIL DIALOG
    ===================================================== */

    function openDetail(title, content) {
        $("#dialogTitle").textContent = title;
        $("#dialogContent").innerHTML = content;

        if (!detailDialog.open) {
            detailDialog.showModal();
        }
    }

    function closeDetail() {
        if (detailDialog.open) {
            detailDialog.close();
        }
    }

    function viewRecord(index) {
        const item = state.currentData[index];

        if (!item) return;

        const content = Object.entries(item)
            .map(([key, value]) => `
                <div class="detail-item">
                    <span>${escapeHTML(
                key.replace(/([A-Z])/g, " $1")
            )}</span>

                    <strong>
                        ${escapeHTML(
                typeof value === "object"
                    ? JSON.stringify(value)
                    : value ?? "—"
            )}
                    </strong>
                </div>
            `).join("");

        openDetail(
            "Record details",
            `<div class="detail-list">${content}</div>`
        );
    }

    /* =====================================================
       CONFIRMATION DIALOG
    ===================================================== */

    function confirmAction(title, message, callback) {
        $("#confirmTitle").textContent = title;

        $("#confirmContent").textContent = message;

        state.confirmCallback = callback;

        if (!confirmDialog.open) {
            confirmDialog.showModal();
        }
    }

    function closeConfirm() {
        if (confirmDialog.open) {
            confirmDialog.close();
        }

        state.confirmCallback = null;
    }

    /* =====================================================
       EVENT HANDLING
    ===================================================== */

    document.addEventListener("click", async event => {
        const pageButton = event.target.closest("[data-page]");

        if (pageButton) {
            event.preventDefault();
            await navigate(pageButton.dataset.page);
            return;
        }

        const actionButton = event.target.closest("[data-action]");

        if (!actionButton) return;

        const action = actionButton.dataset.action;

        switch (action) {
            case "refresh-page":
            case "retry-page":
                await renderPage(state.currentPage);
                break;

            case "close-dialog":
                closeDetail();
                break;

            case "close-confirm":
                closeConfirm();
                break;

            case "view-record":
            case "view-course":
                viewRecord(Number(actionButton.dataset.index));
                break;

            case "create-course":
                showToast(
                    "Course creation requires a confirmed backend endpoint.",
                    "error"
                );
                break;

            case "departments-info":
                showToast(
                    "Department management requires its backend endpoint.",
                    "error"
                );
                break;
        }
    });

    $("#confirmActionButton")?.addEventListener("click", async () => {
        if (typeof state.confirmCallback !== "function") {
            closeConfirm();
            return;
        }

        const callback = state.confirmCallback;

        try {
            await callback();
            closeConfirm();
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    $("#logoutButton")?.addEventListener("click", logout);

    $("#mobileMenu")?.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 850 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !event.target.closest("#mobileMenu")
        ) {
            sidebar.classList.remove("open");
        }
    });

    detailDialog?.addEventListener("click", event => {
        if (event.target === detailDialog) {
            closeDetail();
        }
    });

    confirmDialog?.addEventListener("click", event => {
        if (event.target === confirmDialog) {
            closeConfirm();
        }
    });

    window.addEventListener("hashchange", () => {
        const page = window.location.hash.slice(1);

        if (PAGE_TITLES[page] && page !== state.currentPage) {
            navigate(page);
        }
    });

    /* =====================================================
       INITIALISATION
    ===================================================== */

    async function initialise() {
        initialiseAdminProfile();

        const requestedPage = window.location.hash.slice(1);

        const firstPage = PAGE_TITLES[requestedPage]
            ? requestedPage
            : "overview";

        await navigate(firstPage);

        console.log("AURORIA ADMIN DASHBOARD INITIALISED");
    }

    initialise();

})();
