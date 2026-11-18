
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
        applicants: "/api/admin/applicants",
        staff: "/api/admin/staff",
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
        applicants: "Applicant Management",
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
        applicants: "Manage applicant accounts, profiles and application information.",
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


        [
            "user",
            "currentUser",
            "userId",
            "user_id",
            "token",
            "authToken"
        ].forEach(key => {
            localStorage.removeItem(key);
        });

        sessionStorage.clear();

        window.location.href = "../Student/login.html";
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

            if (page === "applicants") {
                await renderApplicantManagement();
                return;
            }

            if (page === "staff") {
                await renderStaffManagement();
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

        const safeArray = value =>
            Array.isArray(value) ? value : [];

        const number = value =>
            Number.isFinite(Number(value))
                ? Number(value).toLocaleString("en-NG")
                : "0";

        const recentApplications =
            safeArray(overview.recentApplications);

        const recentRegistrations =
            safeArray(overview.recentRegistrations);

        const recentActivity =
            safeArray(overview.recentActivity);

        const primaryMetrics = [
            {
                label: "Registered Applicants",
                value: overview.totalApplicants ?? overview.totalStudents,
                icon: "♙",
                description: "Applicant accounts",
            },
            {
                label: "Staff Members",
                value: overview.totalStaff,
                icon: "♧",
                description: "University employees",
                color: "blue"
            },
            {
                label: "Applications",
                value: overview.totalApplications,
                icon: "▤",
                description: "Total applications",
                color: "purple"
            },
            {
                label: "Pending Applications",
                value: overview.pendingApplications,
                icon: "◷",
                description: "Awaiting review",
                color: "orange"
            }
        ];

        const secondaryMetrics = [
            {
                label: "Approved",
                value: overview.approvedApplications,
                color: "success"
            },
            {
                label: "Rejected",
                value: overview.rejectedApplications,
                color: "danger"
            },
            {
                label: "Courses",
                value: overview.totalCourses,
                color: "info"
            },
            {
                label: "Departments",
                value: overview.totalDepartments,
                color: "neutral"
            }
        ];

        const metricCards = primaryMetrics.map(metric => `
        <article class="overview-stat-card">
            <div class="overview-stat-top">
                <div>
                    <span class="overview-stat-label">
                        ${escapeHTML(metric.label)}
                    </span>

                    <strong class="overview-stat-value">
                        ${number(metric.value)}
                    </strong>
                </div>

                <span class="overview-stat-icon ${metric.color}">
                    ${metric.icon}
                </span>
            </div>

            <div class="overview-stat-description">
                ${escapeHTML(metric.description)}
            </div>
        </article>
    `).join("");

        const secondaryCards = secondaryMetrics.map(metric => `
        <div class="overview-mini-stat">
            <div class="overview-mini-indicator ${metric.color}"></div>

            <div>
                <span>${escapeHTML(metric.label)}</span>
                <strong>${number(metric.value)}</strong>
            </div>
        </div>
    `).join("");

        const applicationRows = recentApplications.map(application => `
        <tr>
            <td>
                <div class="overview-applicant">
                    <span class="overview-small-avatar">
                        ${escapeHTML(
            getInitials(application.applicantName)
        )}
                    </span>

                    <div>
                        <strong>
                            ${escapeHTML(
            application.applicantName || "Unknown applicant"
        )}
                        </strong>

                        <span>
                            ${escapeHTML(
            application.referenceCode || "No reference"
        )}
                        </span>
                    </div>
                </div>
            </td>

            <td>
                ${escapeHTML(application.courseName || "—")}
            </td>

            <td>
                ${statusBadge(application.applicationStatus)}
            </td>

            <td>
                ${formatDate(application.submittedAt)}
            </td>
        </tr>
    `).join("");

        const registrationItems = recentRegistrations.map(user => `
        <div class="overview-registration">
            <span class="overview-small-avatar">
                ${escapeHTML(getInitials(user.fullName))}
            </span>

            <div class="overview-registration-info">
                <strong>
                    ${escapeHTML(user.fullName || "Unknown user")}
                </strong>

                <span>
                    ${escapeHTML(user.email || "No email available")}
                </span>
            </div>

            <time>
                ${formatDate(user.createdAt)}
            </time>
        </div>
    `).join("");

        const activityItems = recentActivity.map(item => `
        <div class="overview-timeline-item">
            <span class="overview-timeline-icon">•</span>

            <div class="overview-timeline-content">
                <strong>
                    ${escapeHTML(item.title || "University activity")}
                </strong>

                <p>
                    ${escapeHTML(item.description || "")}
                </p>

                <time>
                    ${formatDate(item.date)}
                </time>
            </div>
        </div>
    `).join("");

        const currentDate = new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        pageContent.innerHTML = `
        <section class="overview-welcome">
            <div class="overview-welcome-content">
                <span class="overview-welcome-label">
                    AURORIA UNIVERSITY
                </span>

                <h2>
                    Welcome back,
                    ${escapeHTML(
            $("#headerName")?.textContent || "Administrator"
        )}
                </h2>

                <p>
                    Here's what's happening across your university today.
                    Stay informed and keep operations running smoothly.
                </p>

                <div class="overview-welcome-date">
                    <span>◷</span>
                    ${escapeHTML(currentDate)}
                </div>
            </div>

            <div class="overview-welcome-actions">
                <button class="overview-refresh-button"
                    data-action="refresh-page">
                    ↻ Refresh dashboard
                </button>
            </div>

            <div class="overview-decoration overview-decoration-one"></div>
            <div class="overview-decoration overview-decoration-two"></div>
        </section>

        <section class="overview-section">
            <div class="overview-section-heading">
                <div>
                    <span class="eyebrow">AT A GLANCE</span>
                    <h3>University overview</h3>
                </div>
            </div>

            <div class="overview-stats-grid">
                ${metricCards}
            </div>
        </section>

        <section class="overview-section">
            <div class="overview-section-heading">
                <div>
                    <span class="eyebrow">APPLICATION PERFORMANCE</span>
                    <h3>Admissions summary</h3>
                </div>

                <button class="btn-secondary"
                    data-page="applications">
                    View applications →
                </button>
            </div>

            <div class="overview-secondary-grid">
                ${secondaryCards}

                <div class="overview-mini-stat">
                    <div class="overview-mini-indicator warning"></div>

                    <div>
                        <span>Draft applications</span>
                        <strong>${number(overview.draftApplications)}</strong>
                    </div>
                </div>

                <div class="overview-mini-stat">
                    <div class="overview-mini-indicator info"></div>

                    <div>
                        <span>Pending documents</span>
                        <strong>${number(overview.pendingDocuments)}</strong>
                    </div>
                </div>

                <div class="overview-mini-stat">
                    <div class="overview-mini-indicator purple"></div>

                    <div>
                        <span>New enquiries</span>
                        <strong>${number(overview.newEnquiries)}</strong>
                    </div>
                </div>

                <div class="overview-mini-stat">
                    <div class="overview-mini-indicator neutral"></div>

                    <div>
                        <span>Admissions officers</span>
                        <strong>${number(overview.totalAdmissionsOfficers)}</strong>
                    </div>
                </div>
            </div>
        </section>

        <section class="overview-section">
            <div class="overview-section-heading">
                <div>
                    <span class="eyebrow">UNIVERSITY OPERATIONS</span>
                    <h3>Management centre</h3>
                    <p>Quick access to frequently used administration tools.</p>
                </div>
            </div>

            <div class="overview-quick-grid">

                <button class="overview-quick-card" data-page="applicants">
    <span class="overview-quick-icon green">♙</span>
    <span>
        <strong>Applicants</strong>
        <small>Manage applicant accounts</small>
    </span>
    <span class="overview-quick-arrow">→</span>
</button>

                <button class="overview-quick-card" data-page="staff">
                    <span class="overview-quick-icon blue">♧</span>
                    <span>
                        <strong>Staff management</strong>
                        <small>Manage university personnel</small>
                    </span>
                    <span class="overview-quick-arrow">→</span>
                </button>

                <button class="overview-quick-card" data-page="applications">
                    <span class="overview-quick-icon purple">▤</span>
                    <span>
                        <strong>Applications</strong>
                        <small>Monitor admission applications</small>
                    </span>
                    <span class="overview-quick-arrow">→</span>
                </button>

                <button class="overview-quick-card" data-page="courses">
                    <span class="overview-quick-icon orange">▣</span>
                    <span>
                        <strong>Courses & departments</strong>
                        <small>Manage academic programmes</small>
                    </span>
                    <span class="overview-quick-arrow">→</span>
                </button>

            </div>
        </section>

        <section class="overview-bottom-grid">

            <div class="card overview-panel">
                <div class="overview-panel-heading">
                    <div>
                        <span class="eyebrow">LATEST SUBMISSIONS</span>
                        <h3>Recent applications</h3>
                        <p>Recently submitted admission applications.</p>
                    </div>

                    <button class="overview-text-button"
                        data-page="applications">
                        View all →
                    </button>
                </div>

                ${applicationRows ? `
                    <div class="table-wrapper">
                        <table class="data-table overview-table">
                            <thead>
                                <tr>
                                    <th>Applicant</th>
                                    <th>Programme</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${applicationRows}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-icon">▤</div>
                        <strong>No recent applications</strong>
                        Submitted applications will appear here.
                    </div>
                `}
            </div>

            <div class="card overview-panel">
                <div class="overview-panel-heading">
                    <div>
                        <span class="eyebrow">LATEST ACTIVITY</span>
                        <h3>University activity</h3>
                        <p>Recent administrative updates.</p>
                    </div>
                </div>

                <div class="overview-timeline">
                    ${activityItems || `
                        <div class="empty-state">
                            <strong>No recent activity</strong>
                            University activity will appear here.
                        </div>
                    `}
                </div>
            </div>

        </section>

        <section class="card overview-registrations-panel">
            <div class="overview-panel-heading">
                <div>
                    <span class="eyebrow">NEW ACCOUNTS</span>
<h3>Recent applicant registrations</h3>
<p>Latest applicants who created university accounts.</p>
                </div>

                <button class="overview-text-button" data-page="applicants">
    Manage applicants →
</button>
            </div>

            <div class="overview-registration-list">
                ${registrationItems || `
                    <div class="empty-state">
                        <strong>No recent registrations</strong>
                        New student accounts will appear here.
                    </div>
                `}
            </div>
        </section>
    `;
    }

    async function renderApplicantManagement(page = 0) {
        const search = $("#applicantSearch")?.value || "";
        const status = $("#applicantStatusFilter")?.value || "all";

        pageContent.innerHTML = `
        <div class="loading-state">Loading applicant records...</div>
    `;

        const query = new URLSearchParams({
            search,
            status,
            page: String(page),
            size: "10"
        });

        const result = await request(
            `${API.applicants}?${query.toString()}`
        );

        // Accept common Spring Boot response formats.
        const applicants = Array.isArray(result)
            ? result
            : Array.isArray(result.applicants)
                ? result.applicants
                : Array.isArray(result.content)
                    ? result.content
                    : Array.isArray(result.data)
                        ? result.data
                        : Array.isArray(result.items)
                            ? result.items
                            : [];

        const stats = result.statistics || {};

        state.currentData = applicants;

        const totalPages = Number(result.totalPages ?? 0);
        const currentPage = Number(result.page ?? result.number ?? page);
        const totalElements = Number(
            result.totalElements ?? result.total ?? applicants.length
        );

        const statCards = [
            {
                label: "Total applicants",
                value: stats.totalApplicants ?? stats.total ?? totalElements,
                icon: "♙",
                color: "green"
            },
            {
                label: "Active accounts",
                value: stats.activeApplicants ?? stats.active ?? 0,
                icon: "✓",
                color: "blue"
            },
            {
                label: "Inactive accounts",
                value: stats.inactiveApplicants ?? stats.inactive ?? 0,
                icon: "◷",
                color: "orange"
            },
            {
                label: "Unverified emails",
                value: stats.unverifiedApplicants ?? stats.unverified ?? 0,
                icon: "✉",
                color: "purple"
            }
        ];

        const statHTML = statCards.map(card => `
        <article class="overview-stat-card applicant-stat-card">
            <div class="overview-stat-top">
                <div>
                    <span class="overview-stat-label">
                        ${escapeHTML(card.label)}
                    </span>
                    <strong class="overview-stat-value">
                        ${Number(card.value || 0).toLocaleString("en-NG")}
                    </strong>
                </div>
                <span class="overview-stat-icon ${card.color}">
                    ${card.icon}
                </span>
            </div>
        </article>
    `).join("");

        const rows = applicants.map(applicant => {
            const id = applicant.userId ?? applicant.id;

            return `
            <tr>
                <td>
                    <div class="overview-applicant">
                        <span class="overview-small-avatar">
                            ${escapeHTML(getInitials(applicant.fullName))}
                        </span>
                        <div>
                            <strong>
                                ${escapeHTML(applicant.fullName || "Unnamed applicant")}
                            </strong>
                            <span>
                                Applicant #${escapeHTML(id ?? "—")}
                            </span>
                        </div>
                    </div>
                </td>

                <td>
                    <div class="applicant-contact-cell">
                        <strong>${escapeHTML(applicant.email || "—")}</strong>
                        <span>${escapeHTML(applicant.phone || "No phone number")}</span>
                    </div>
                </td>

                <td>${statusBadge(applicant.accountStatus)}</td>

                <td>
                    ${applicant.emailVerified
                    ? '<span class="applicant-verification verified">Verified</span>'
                    : '<span class="applicant-verification unverified">Not verified</span>'
                }
                </td>

                <td>${formatDate(applicant.createdAt)}</td>

                <td>
                    <button
                        class="btn-secondary"
                        data-action="view-applicant"
                        data-applicant-id="${escapeHTML(id ?? "")}">
                        View profile
                    </button>
                </td>
            </tr>
        `;
        }).join("");

        pageContent.innerHTML = `
        <div class="applicant-management">

            <section class="page-heading applicant-page-heading">
                <div>
                    <span class="eyebrow">APPLICANT ADMINISTRATION</span>
                    <h2>Applicant Management</h2>
                    <p>
                        View applicant accounts, monitor registration
                        details and inspect personal profiles.
                    </p>
                </div>

                <button class="btn-secondary" data-action="refresh-page">
                    ↻ Refresh
                </button>
            </section>

            <section class="applicant-stat-grid">
                ${statHTML}
            </section>

            <section class="card applicant-management-panel">

                <div class="applicant-panel-heading">
                    <div>
                        <span class="eyebrow">APPLICANT DIRECTORY</span>
                        <h3>All applicants</h3>
                        <p>
                            ${totalElements.toLocaleString("en-NG")}
                            matching applicant records
                        </p>
                    </div>
                </div>

                <div class="applicant-toolbar">

                    <div class="applicant-search">
                        <span>⌕</span>
                        <input
                            type="search"
                            id="applicantSearch"
                            placeholder="Search name, email, phone or applicant ID..."
                            value="${escapeHTML(search)}"
                        >
                    </div>

                    <div class="applicant-filters">
                        <select id="applicantStatusFilter">
                            <option value="all" ${status === "all" ? "selected" : ""}>
                                All statuses
                            </option>
                            <option value="active" ${status === "active" ? "selected" : ""}>
                                Active
                            </option>
                            <option value="inactive" ${status === "inactive" ? "selected" : ""}>
                                Inactive
                            </option>
                            <option value="suspended" ${status === "suspended" ? "selected" : ""}>
                                Suspended
                            </option>
                        </select>

                        <button class="btn-primary" data-action="search-applicants">
                            Apply filters
                        </button>
                    </div>
                </div>

                ${applicants.length ? `
                    <div class="table-wrapper">
                        <table class="data-table applicant-management-table">
                            <thead>
                                <tr>
                                    <th>Applicant</th>
                                    <th>Contact information</th>
                                    <th>Account status</th>
                                    <th>Email verification</th>
                                    <th>Registered</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-icon">♙</div>
                        <strong>No applicants found</strong>
                        Try changing your search or status filter.
                    </div>
                `}

                <div class="applicant-pagination">
                    <span>
                        Page ${totalPages ? currentPage + 1 : 0}
                        of ${totalPages}
                    </span>

                    <div>
                        <button
                            class="btn-secondary"
                            data-action="applicant-page"
                            data-page-number="${currentPage - 1}"
                            ${currentPage <= 0 ? "disabled" : ""}>
                            Previous
                        </button>

                        <button
                            class="btn-secondary"
                            data-action="applicant-page"
                            data-page-number="${currentPage + 1}"
                            ${currentPage + 1 >= totalPages ? "disabled" : ""}>
                            Next
                        </button>
                    </div>
                </div>

            </section>
        </div>
    `;
    }


    async function viewApplicantDetails(userId) {
        const result = await request(
            `${API.applicants}/${encodeURIComponent(userId)}`
        );

        const applicant =
            result.applicant ||
            result.user ||
            result.data?.applicant ||
            result.data?.user ||
            result.data ||
            {};

        const profile = result.profile || result.data?.profile || {};

        const details = [
            ["Applicant ID", applicant.userId ?? applicant.id],
            ["Full name", applicant.fullName],
            ["Email address", applicant.email],
            ["Phone number", applicant.phone],
            ["Account status", applicant.accountStatus],
            ["Email verified", applicant.emailVerified ? "Yes" : "No"],
            ["Registration date", formatDate(applicant.createdAt)],
            ["Last updated", formatDate(applicant.updatedAt)]
        ];

        const profileDetails = [
            ["Date of birth", formatDate(profile.dateOfBirth)],
            ["Nationality", profile.nationality],
            ["State of origin", profile.stateOfOrigin],
            ["Emergency contact", profile.emergencyContact],
            ["Address", profile.address]
        ];

        const detailRows = items => items.map(([label, value]) => `
        <div class="detail-item">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value ?? "Not provided")}</strong>
        </div>
    `).join("");

        openDetail(
            "Applicant profile",
            `
            <div class="applicant-detail-profile">
                <span class="overview-small-avatar">
                    ${escapeHTML(getInitials(applicant.fullName))}
                </span>

                <div>
                    <strong>
                        ${escapeHTML(applicant.fullName || "Applicant")}
                    </strong>
                    <span>
                        Applicant #${escapeHTML(applicant.userId ?? applicant.id ?? "—")}
                    </span>
                </div>
            </div>

            <h4 class="applicant-detail-heading">Account information</h4>
            <div class="detail-list">
                ${detailRows(details)}
            </div>

            <h4 class="applicant-detail-heading">Personal information</h4>
            <div class="detail-list">
                ${detailRows(profileDetails)}
            </div>
        `
        );
    }

    async function viewStudentDetails(userId) {
        const result = await request(
            `${API.students}/${encodeURIComponent(userId)}`
        );

        const student = result.student || {};
        const profile = result.profile || {};

        const details = [
            ["Student ID", student.userId],
            ["Full name", student.fullName],
            ["Email address", student.email],
            ["Phone number", student.phone],
            ["Account status", student.accountStatus],
            ["Email verified", student.emailVerified ? "Yes" : "No"],
            ["Registration date", formatDate(student.createdAt)],
            ["Last updated", formatDate(student.updatedAt)]
        ];

        const profileDetails = [
            ["Date of birth", formatDate(profile.dateOfBirth)],
            ["Nationality", profile.nationality],
            ["State of origin", profile.stateOfOrigin],
            ["Emergency contact", profile.emergencyContact],
            ["Address", profile.address]
        ];

        const detailRows = items => items.map(([label, value]) => `
        <div class="detail-item">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value ?? "Not provided")}</strong>
        </div>
    `).join("");

        openDetail(
            "Student profile",
            `
            <div class="student-detail-profile">
                <span class="overview-small-avatar">
                    ${escapeHTML(getInitials(student.fullName))}
                </span>

                <div>
                    <strong>${escapeHTML(student.fullName || "Student")}</strong>
                    <span>Student #${escapeHTML(student.userId)}</span>
                </div>
            </div>

            <h4 class="student-detail-heading">Account information</h4>
            <div class="detail-list">
                ${detailRows(details)}
            </div>

            <h4 class="student-detail-heading">Personal information</h4>
            <div class="detail-list">
                ${detailRows(profileDetails)}
            </div>
        `
        );
    }

    /* =====================================================
       STAFF MANAGEMENT
    ===================================================== */

    async function renderStaffManagement(page = 0) {
        const search = $("#staffSearch")?.value || "";
        const status = $("#staffStatusFilter")?.value || "all";

        pageContent.innerHTML = `
        <div class="loading-state">Loading staff records...</div>
    `;

        const query = new URLSearchParams({
            search,
            status,
            page: String(page),
            size: "10"
        });

        const result = await request(
            `${API.staff}?${query.toString()}`
        );

        const staff = Array.isArray(result.staff)
            ? result.staff
            : [];

        const stats = result.statistics || {};

        state.currentData = staff;

        const totalPages = Number(result.totalPages || 0);
        const currentPage = Number(result.page ?? page);
        const totalElements = Number(
            result.totalElements ?? staff.length
        );

        const statCards = [
            {
                label: "Total staff",
                value: stats.totalStaff ?? totalElements,
                icon: "♧",
                color: "green"
            },
            {
                label: "Active accounts",
                value: stats.activeStaff ?? 0,
                icon: "✓",
                color: "blue"
            },
            {
                label: "Inactive accounts",
                value: stats.inactiveStaff ?? 0,
                icon: "◷",
                color: "orange"
            },
            {
                label: "Unverified emails",
                value: stats.unverifiedStaff ?? 0,
                icon: "✉",
                color: "purple"
            }
        ];

        const statHTML = statCards.map(card => `
        <article class="overview-stat-card applicant-stat-card">
            <div class="overview-stat-top">
                <div>
                    <span class="overview-stat-label">
                        ${escapeHTML(card.label)}
                    </span>

                    <strong class="overview-stat-value">
                        ${Number(card.value || 0).toLocaleString("en-NG")}
                    </strong>
                </div>

                <span class="overview-stat-icon ${card.color}">
                    ${card.icon}
                </span>
            </div>
        </article>
    `).join("");

        const rows = staff.map(member => `
        <tr>
            <td>
                <div class="overview-applicant">
                    <span class="overview-small-avatar">
                        ${escapeHTML(getInitials(member.fullName))}
                    </span>

                    <div>
                        <strong>
                            ${escapeHTML(member.fullName || "Unnamed staff member")}
                        </strong>
                        <span>
                            Staff #${escapeHTML(member.userId ?? "—")}
                        </span>
                    </div>
                </div>
            </td>

            <td>
                <div class="applicant-contact-cell">
                    <strong>${escapeHTML(member.email || "—")}</strong>
                    <span>${escapeHTML(member.phone || "No phone number")}</span>
                </div>
            </td>

            <td>
                ${statusBadge(member.role)}
            </td>

            <td>
                ${statusBadge(member.accountStatus)}
            </td>

            <td>
                ${member.emailVerified
                ? '<span class="applicant-verification verified">Verified</span>'
                : '<span class="applicant-verification unverified">Not verified</span>'
            }
            </td>

            <td>${formatDate(member.createdAt)}</td>

            <td>
                <button
                    class="btn-secondary"
                    data-action="view-staff"
                    data-staff-id="${escapeHTML(member.userId ?? "")}">
                    View profile
                </button>
            </td>
        </tr>
    `).join("");

        pageContent.innerHTML = `
        <div class="applicant-management">

            <section class="page-heading applicant-page-heading">
                <div>
                    <span class="eyebrow">UNIVERSITY PERSONNEL</span>
                    <h2>Staff Management</h2>
                    <p>
                        View staff accounts, inspect employee information
                        and monitor account status and permissions.
                    </p>
                </div>
<button class="btn-primary" data-action="create-staff">
    + Add Admissions Officer
</button>
                <button class="btn-secondary" data-action="refresh-page">
                    ↻ Refresh
                </button>
            </section>

            <section class="applicant-stat-grid">
                ${statHTML}
            </section>

            <section class="card applicant-management-panel">

                <div class="applicant-panel-heading">
                    <div>
                        <span class="eyebrow">STAFF DIRECTORY</span>
                        <h3>All staff members</h3>
                        <p>
                            ${totalElements.toLocaleString("en-NG")}
                            matching staff accounts
                        </p>
                    </div>
                </div>

                <div class="applicant-toolbar">

                    <div class="applicant-search">
                        <span>⌕</span>
                        <input
                            type="search"
                            id="staffSearch"
                            placeholder="Search name, email, phone, role or staff ID..."
                            value="${escapeHTML(search)}">
                    </div>

                    <div class="applicant-filters">
                        <select id="staffStatusFilter">
                            <option value="all" ${status === "all" ? "selected" : ""}>
                                All statuses
                            </option>
                            <option value="active" ${status === "active" ? "selected" : ""}>
                                Active
                            </option>
                            <option value="inactive" ${status === "inactive" ? "selected" : ""}>
                                Inactive
                            </option>
                            <option value="suspended" ${status === "suspended" ? "selected" : ""}>
                                Suspended
                            </option>
                        </select>

                        <button class="btn-primary" data-action="search-staff">
                            Apply filters
                        </button>
                    </div>
                </div>

                ${staff.length ? `
                    <div class="table-wrapper">
                        <table class="data-table applicant-management-table">
                            <thead>
                                <tr>
                                    <th>Staff member</th>
                                    <th>Contact information</th>
                                    <th>Role</th>
                                    <th>Account status</th>
                                    <th>Email verification</th>
                                    <th>Registered</th>
                                    <th>Action</th>
                                </tr>
                            </thead>

                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-icon">♧</div>
                        <strong>No staff members found</strong>
                        Try changing your search or status filter.
                    </div>
                `}

                <div class="applicant-pagination">
                    <span>
                        Page ${totalPages ? currentPage + 1 : 0}
                        of ${totalPages}
                    </span>

                    <div>
                        <button
                            class="btn-secondary"
                            data-action="staff-page"
                            data-page-number="${currentPage - 1}"
                            ${currentPage <= 0 ? "disabled" : ""}>
                            Previous
                        </button>

                        <button
                            class="btn-secondary"
                            data-action="staff-page"
                            data-page-number="${currentPage + 1}"
                            ${currentPage + 1 >= totalPages ? "disabled" : ""}>
                            Next
                        </button>
                    </div>
                </div>

            </section>
        </div>
    `;
    }


    async function viewStaffDetails(userId) {
        const result = await request(
            `${API.staff}/${encodeURIComponent(userId)}`
        );

        const member = result.staff || {};

        const details = [
            ["Staff ID", member.userId],
            ["Full name", member.fullName],
            ["Email address", member.email],
            ["Phone number", member.phone],
            ["Role", member.role],
            ["Account status", member.accountStatus],
            ["Email verified", member.emailVerified ? "Yes" : "No"],
            ["Registration date", formatDate(member.createdAt)],
            ["Last updated", formatDate(member.updatedAt)]
        ];

        const detailRows = details.map(([label, value]) => `
        <div class="detail-item">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value ?? "Not provided")}</strong>
        </div>
    `).join("");

        openDetail(
            "Staff profile",
            `
            <div class="applicant-detail-profile">
                <span class="overview-small-avatar">
                    ${escapeHTML(getInitials(member.fullName))}
                </span>

                <div>
                    <strong>
                        ${escapeHTML(member.fullName || "Staff member")}
                    </strong>
                    <span>
                        Staff #${escapeHTML(member.userId ?? "—")}
                    </span>
                </div>
            </div>

            <h4 class="applicant-detail-heading">
                Staff account information
            </h4>

            <div class="detail-list">
                ${detailRows}
            </div>
        `
        );
    }

    /* =====================================================
       MANAGEMENT PAGES
    ===================================================== */

    const TABLE_CONFIG = {
        applicants: {
            name: "Applicants",
            description: PAGE_DESCRIPTIONS.applicants,
            columns: [
                "Applicant",
                "Email",
                "Phone",
                "Account Status"
            ],
            fields: [
                "fullName",
                "email",
                "phone",
                "accountStatus"
            ],
            search: "Search applicants by name, email or phone..."
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

    function openCreateStaffForm() {
        openDetail(
            "Register Admissions Officer",
            `
        <form id="createStaffForm" class="staff-registration-form" novalidate>

            <div class="staff-form-intro">
                <span class="staff-form-icon">♙</span>
                <div>
                    <h3>Create staff account</h3>
                    <p>Register a new member of the Auroria admissions team.</p>
                </div>
            </div>

            <div class="staff-form-section">
                <div class="staff-form-section-heading">
                    <span>01</span>
                    <div>
                        <h4>Personal information</h4>
                        <p>Enter the officer's contact details.</p>
                    </div>
                </div>

                <div class="staff-form-grid">

                    <div class="staff-field staff-field-full">
                        <label for="staffFullName">Full name <span>*</span></label>
                        <input
                            id="staffFullName"
                            name="fullName"
                            type="text"
                            minlength="2"
                            maxlength="80"
                            autocomplete="name"
                            placeholder="e.g. Adebayo Johnson"
                            pattern="[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]{0,78}[A-Za-zÀ-ÖØ-öø-ÿ]"
                            required
                        >
                        <small>Use the officer's full legal name.</small>
                    </div>

                    <div class="staff-field">
                        <label for="staffEmail">Email address <span>*</span></label>
                        <input
                            id="staffEmail"
                            name="email"
                            type="email"
                            maxlength="254"
                            autocomplete="email"
                            placeholder="officer@auroria.edu"
                            required
                        >
                        <small>Must be a unique email address.</small>
                    </div>

                    <div class="staff-field">
                        <label for="staffPhone">Phone number <span>*</span></label>
                        <input
                            id="staffPhone"
                            name="phone"
                            type="tel"
                            inputmode="tel"
                            maxlength="16"
                            autocomplete="tel"
                            placeholder="+2348012345678"
                            pattern="\+?[1-9][0-9]{6,14}"
                            title="Enter 7–15 digits, optionally starting with +."
                            required
                        >
                        <small>Include the country code where possible.</small>
                    </div>

                </div>
            </div>

            <div class="staff-form-section">
                <div class="staff-form-section-heading">
                    <span>02</span>
                    <div>
                        <h4>Account security</h4>
                        <p>Create a secure initial password.</p>
                    </div>
                </div>

                <div class="staff-form-grid">

                    <div class="staff-field staff-field-full">
                        <label for="staffPassword">Password <span>*</span></label>

                        <div class="staff-password-wrap">
                            <input
                                id="staffPassword"
                                name="password"
                                type="password"
                                minlength="12"
                                maxlength="72"
                                autocomplete="new-password"
                                placeholder="Create a strong password"
                                required
                            >
                            <button
                                type="button"
                                class="staff-password-toggle"
                                data-action="toggle-staff-password"
                                data-target="staffPassword"
                                aria-label="Show password"
                            >Show</button>
                        </div>

                        <div class="staff-password-meter">
                            <div class="staff-password-meter-track">
                                <span id="staffPasswordMeter"></span>
                            </div>
                            <span id="staffPasswordStrength">Password strength</span>
                        </div>

                        <div class="staff-password-rules">
                            <span data-rule="length">○ At least 12 characters</span>
                            <span data-rule="upper">○ One uppercase letter</span>
                            <span data-rule="lower">○ One lowercase letter</span>
                            <span data-rule="number">○ One number</span>
                            <span data-rule="special">○ One special character</span>
                        </div>
                    </div>

                    <div class="staff-field staff-field-full">
                        <label for="staffConfirmPassword">
                            Confirm password <span>*</span>
                        </label>

                        <div class="staff-password-wrap">
                            <input
                                id="staffConfirmPassword"
                                name="confirmPassword"
                                type="password"
                                minlength="12"
                                maxlength="72"
                                autocomplete="new-password"
                                placeholder="Enter the password again"
                                required
                            >
                            <button
                                type="button"
                                class="staff-password-toggle"
                                data-action="toggle-staff-password"
                                data-target="staffConfirmPassword"
                                aria-label="Show password"
                            >Show</button>
                        </div>

                        <small id="staffPasswordMatch">
                            Both passwords must match.
                        </small>
                    </div>

                    <div class="staff-field staff-field-full">
                        <label>Assigned role</label>
                        <div class="staff-role-preview">
                            <span class="staff-role-icon">♧</span>
                            <div>
                                <strong>Admissions Officer</strong>
                                <small>ADMISSIONS_OFFICER</small>
                            </div>
                            <span class="staff-role-fixed">Fixed role</span>
                        </div>
                    </div>

                </div>
            </div>

            <div class="staff-form-notice">
                <strong>Account creation notice</strong>
                <p>
                    The account will be created as active. Email verification
                    will remain pending until the officer completes verification.
                </p>
            </div>

            <div class="staff-form-actions">
                <button
                    type="button"
                    class="btn-secondary"
                    data-action="close-dialog"
                >Cancel</button>

                <button
                    type="submit"
                    class="btn-primary staff-submit-button"
                >
                    Create staff account
                </button>
            </div>

        </form>
        `
        );
    }


    function getPasswordRules(password) {
        return {
            length: password.length >= 12 && password.length <= 72,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[^A-Za-z0-9\s]/.test(password)
        };
    }

    function isStrongStaffPassword(password) {
        const rules = getPasswordRules(password);

        return Object.values(rules).every(Boolean)
            && !/\s/.test(password)
            && new TextEncoder().encode(password).length <= 72;
    }

    function updateStaffPasswordUI() {
        const password = $("#staffPassword")?.value || "";
        const confirm = $("#staffConfirmPassword")?.value || "";

        const rules = getPasswordRules(password);

        Object.entries(rules).forEach(([name, passed]) => {
            const element = $(`[data-rule="${name}"]`);

            if (!element) return;

            element.classList.toggle("passed", passed);
            element.textContent =
                `${passed ? "✓" : "○"} ${{
                    length: "At least 12 characters",
                    upper: "One uppercase letter",
                    lower: "One lowercase letter",
                    number: "One number",
                    special: "One special character"
                }[name]}`;
        });

        const score = Object.values(rules).filter(Boolean).length;

        const meter = $("#staffPasswordMeter");
        const strength = $("#staffPasswordStrength");

        if (meter) {
            meter.style.width = `${score * 20}%`;
            meter.dataset.strength =
                score <= 2 ? "weak" :
                    score <= 4 ? "medium" : "strong";
        }

        if (strength) {
            strength.textContent =
                !password ? "Password strength" :
                    score <= 2 ? "Weak password" :
                        score <= 4 ? "Moderate password" :
                            "Strong password";
        }

        const matchMessage = $("#staffPasswordMatch");

        if (matchMessage) {
            const matches = confirm.length > 0 && password === confirm;

            matchMessage.textContent =
                !confirm ? "Both passwords must match." :
                    matches ? "Passwords match." :
                        "Passwords do not match.";

            matchMessage.classList.toggle("matched", matches);
            matchMessage.classList.toggle(
                "not-matched",
                confirm.length > 0 && !matches
            );
        }
    }



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

            case "search-staff":
                await renderStaffManagement(0);
                break;

            case "staff-page":
                await renderStaffManagement(
                    Number(actionButton.dataset.pageNumber)
                );
                break;

            case "view-staff":
                try {
                    await viewStaffDetails(actionButton.dataset.staffId);
                } catch (error) {
                    showToast(error.message, "error");
                }
                break;
            case "close-dialog":
                closeDetail();
                break;

            case "create-staff":
                openCreateStaffForm();
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

            case "search-applicants":
                await renderApplicantManagement(0);
                break;

            case "applicant-page":
                await renderApplicantManagement(
                    Number(actionButton.dataset.pageNumber)
                );
                break;

            case "view-applicant":
                try {
                    await viewApplicantDetails(
                        actionButton.dataset.applicantId
                    );
                } catch (error) {
                    showToast(error.message, "error");
                }
                break;

            case "toggle-staff-password": {
                const input = document.getElementById(
                    actionButton.dataset.target
                );

                if (!input) break;

                const showing = input.type === "password";

                input.type = showing ? "text" : "password";
                actionButton.textContent = showing ? "Hide" : "Show";
                actionButton.setAttribute(
                    "aria-label",
                    showing ? "Hide password" : "Show password"
                );

                break;
            }


            case "departments-info":
                showToast(
                    "Department management requires its backend endpoint.",
                    "error"
                );
                break;
        }
    });


    document.addEventListener("input", event => {
        if (
            event.target.matches("#staffPassword") ||
            event.target.matches("#staffConfirmPassword")
        ) {
            updateStaffPasswordUI();
        }
    });

    document.addEventListener("submit", async event => {
        if (event.target.id !== "createStaffForm") return;

        event.preventDefault();

        const form = event.target;

        const fullName = $("#staffFullName").value.trim();
        const email = $("#staffEmail").value.trim().toLowerCase();
        const phone = $("#staffPhone").value.trim();
        const password = $("#staffPassword").value;
        const confirmPassword = $("#staffConfirmPassword").value;

        const namePattern =
            /^[\p{L}][\p{L} .'-]{0,78}[\p{L}]$/u;

        const emailPattern =
            /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

        const phonePattern = /^\+?[1-9]\d{6,14}$/;

        if (!namePattern.test(fullName)) {
            showToast(
                "Enter a valid full name using at least two letters.",
                "error"
            );
            $("#staffFullName").focus();
            return;
        }

        if (fullName.length > 80) {
            showToast("Full name cannot exceed 80 characters.", "error");
            return;
        }

        if (email.length > 254 || !emailPattern.test(email)) {
            showToast("Enter a valid email address.", "error");
            $("#staffEmail").focus();
            return;
        }

        if (!phonePattern.test(phone)) {
            showToast(
                "Enter a valid international phone number.",
                "error"
            );
            $("#staffPhone").focus();
            return;
        }

        if (!isStrongStaffPassword(password)) {
            showToast(
                "Your password does not meet all security requirements.",
                "error"
            );
            $("#staffPassword").focus();
            return;
        }

        if (password !== confirmPassword) {
            showToast("Passwords do not match.", "error");
            $("#staffConfirmPassword").focus();
            return;
        }

        if (!form.reportValidity()) return;

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Creating account...";

        try {
            const result = await request(API.staff, {
                method: "POST",
                body: JSON.stringify({
                    fullName,
                    email,
                    phone,
                    password
                })
            });

            closeDetail();

            showToast(
                result.message || "Admissions officer registered successfully."
            );

            await renderStaffManagement(0);

        } catch (error) {
            showToast(error.message, "error");

            submitButton.disabled = false;
            submitButton.textContent = "Create staff account";
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
