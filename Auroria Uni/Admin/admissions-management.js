/* =========================================================
   AURORIA UNIVERSITY — ADMIN ADMISSIONS MANAGEMENT
   Load AFTER admin.js
========================================================= */
(() => {
    "use strict";

    const API_BASE = window.AURORIA_CONFIG?.apiBaseUrl
        || "http://localhost:8080";

    const PAGE = document.getElementById("pageContent");
    if (!PAGE) return;

    const ENDPOINTS = {
        overview: "/api/admissions/overview",
        applications: "/api/admissions/applications",

        review: id =>
            `/api/admissions/applications/${encodeURIComponent(id)}/review`,

        status: id =>
            `/api/admissions/applications/${encodeURIComponent(id)}/status`,

        verifyDocument: id =>
            `/api/admissions/documents/${encodeURIComponent(id)}/verify`,

        documentFile: id =>
            `/api/admissions/documents/${encodeURIComponent(id)}/file`,

        messages: id =>
            `/api/communication/application/${encodeURIComponent(id)}/messages`,

        sendMessage: "/api/communication/messages"
    };

    const state = {
        overview: null,
        applications: [],
        filtered: [],
        search: "",
        status: "ALL",
        intake: "ALL",
        page: 1,
        pageSize: 10,
        selected: null,
        review: null,
        messages: [],
        loading: false,
        busy: false
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    const esc = value =>
        String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    const asArray = value =>
        Array.isArray(value) ? value : [];

    const fmtDate = value => {
        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? esc(value)
            : date.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
    };

    const fmtDateTime = value => {
        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? esc(value)
            : date.toLocaleString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
    };

    const titleCase = value =>
        String(value || "UNKNOWN")
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

    const statusClass = value => {
        const status = String(value || "").toUpperCase();

        if (["APPROVED", "VERIFIED", "ACCEPTED"].includes(status)) {
            return "success";
        }

        if (status === "REJECTED") return "danger";

        if (["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(status)) {
            return "warning";
        }

        return "info";
    };

    const badge = value =>
        `<span class="status-badge ${statusClass(value)}">
            ${esc(titleCase(value))}
        </span>`;

    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    function storedUser() {
        for (const key of [
            "user",
            "currentUser",
            "adminUser",
            "loggedInUser"
        ]) {
            try {
                const value = JSON.parse(
                    localStorage.getItem(key) || "null"
                );

                if (value && typeof value === "object") {
                    return value;
                }
            } catch (_) {
                // Ignore malformed local storage values.
            }
        }

        return {};
    }

    function currentStaffId() {
        const user = storedUser();

        const candidates = [
            user.userId,
            user.id,
            user.user_id,
            user.userID,
            localStorage.getItem("userId"),
            localStorage.getItem("user_id")
        ];

        const id = candidates.find(value =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        );

        return id === undefined ? null : Number(id);
    }

    function authHeaders(json = false) {
        const token =
            localStorage.getItem("token") ||
            localStorage.getItem("authToken");

        const headers = {
            Accept: "application/json"
        };

        if (json) {
            headers["Content-Type"] = "application/json";
        }

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    /* =====================================================
       API REQUEST FUNCTION
    ===================================================== */

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,

            headers: {
                ...authHeaders(options.body !== undefined),
                ...(options.headers || {})
            }
        });

        if (response.status === 204) {
            return null;
        }

        const contentType =
            response.headers.get("content-type") || "";

        const payload = contentType.includes("application/json")
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            const message =
                payload && typeof payload === "object"
                    ? payload.message ||
                    payload.error ||
                    `Request failed (${response.status})`
                    : payload ||
                    `Request failed (${response.status})`;

            throw new Error(message);
        }

        return payload;
    }

    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    function notify(message, type = "success") {
        const region = document.getElementById("toastRegion");

        if (!region) {
            window.alert(message);
            return;
        }

        const toast = document.createElement("div");

        toast.className =
            `toast ${type === "error" ? "error" : "success"}`;

        toast.textContent = message;

        region.appendChild(toast);

        window.setTimeout(() => toast.remove(), 4200);
    }

    /* =====================================================
       NAVIGATION
    ===================================================== */

    function setAdmissionsNavigation() {
        const title = document.getElementById("pageTitle");

        if (title) {
            title.textContent = "Admissions Management";
        }

        $$(".nav-link[data-page]").forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.page === "admissions"
            );
        });

        document.title =
            "Admissions Management | Auroria University";
    }

    function showPageError(error) {
        PAGE.innerHTML = `
            <section class="am-error card">
                <div class="empty-icon">!</div>

                <strong>Unable to load admissions</strong>

                <p>
                    ${esc(
            error?.message ||
            "An unexpected error occurred."
        )}
                </p>

                <button
                    class="btn-primary"
                    type="button"
                    data-am-action="refresh">
                    Try again
                </button>
            </section>
        `;
    }

    /* =====================================================
       LOAD ADMISSIONS DATA
    ===================================================== */

    async function loadData() {
        state.loading = true;

        renderShell();

        try {
            const [overview, applications] = await Promise.all([
                api(ENDPOINTS.overview),
                api(ENDPOINTS.applications)
            ]);

            state.overview = overview || {};
            state.applications = asArray(applications);

            applyFilters();

            state.loading = false;

            render();

        } catch (error) {
            state.loading = false;
            showPageError(error);
        }
    }

    function applyFilters() {
        const term = state.search.trim().toLowerCase();

        state.filtered = state.applications.filter(app => {
            const searchable = [
                app.applicantName,
                app.applicantEmail,
                app.referenceCode,
                app.courseName,
                app.intake,
                app.academicYear
            ].join(" ").toLowerCase();

            const matchesSearch =
                !term || searchable.includes(term);

            const matchesStatus =
                state.status === "ALL" ||
                String(app.applicationStatus || "").toUpperCase()
                === state.status;

            const matchesIntake =
                state.intake === "ALL" ||
                String(app.intake || "") === state.intake;

            return matchesSearch &&
                matchesStatus &&
                matchesIntake;
        });

        const maxPage = Math.max(
            1,
            Math.ceil(state.filtered.length / state.pageSize)
        );

        state.page = Math.min(state.page, maxPage);
    }

    function renderShell() {
        setAdmissionsNavigation();

        PAGE.innerHTML = `
            <div class="am-loading card">
                <span class="am-spinner"></span>
                <strong>Loading admissions records…</strong>
            </div>
        `;
    }

    /* =====================================================
   DASHBOARD STATISTICS
===================================================== */

    function statCard(label, value, note, icon, tone) {
        return `
            <article class="am-stat-card">
                <div class="am-stat-top">
                    <span>${esc(label)}</span>
                    <span class="am-stat-icon ${tone}">
                        ${icon}
                    </span>
                </div>

                <strong>
                    ${Number(value || 0).toLocaleString()}
                </strong>

                <small>${esc(note)}</small>
            </article>
        `;
    }

    /* =====================================================
       RENDER ADMISSIONS PAGE
    ===================================================== */

    function render() {
        setAdmissionsNavigation();

        const overview = state.overview || {};

        const intakes = [
            ...new Set(
                state.applications
                    .map(app => app.intake)
                    .filter(Boolean)
            )
        ];

        const start = (state.page - 1) * state.pageSize;

        const rows = state.filtered.slice(
            start,
            start + state.pageSize
        );

        const pages = Math.max(
            1,
            Math.ceil(state.filtered.length / state.pageSize)
        );

        PAGE.innerHTML = `
            <section class="am-page">

                <div class="page-heading am-heading">
                    <div>
                        <span class="eyebrow">
                            ADMISSIONS OFFICE
                        </span>

                        <h2>Admissions Management</h2>

                        <p>
                            Review applications, verify submitted
                            documents, make admission decisions
                            and contact applicants.
                        </p>
                    </div>

                    <button
                        class="btn-secondary"
                        type="button"
                        data-am-action="refresh">
                        ↻ Refresh data
                    </button>
                </div>

                <!-- STATISTICS -->

                <div class="am-stats-grid">

                    ${statCard(
            "Total applications",
            overview.totalApplications,
            "Submitted applications",
            "▤",
            "green"
        )}

                    ${statCard(
            "Pending applications",
            overview.pendingApplications,
            "Awaiting initial review",
            "◷",
            "orange"
        )}

                    ${statCard(
            "Approved applications",
            overview.approvedApplications,
            "Approved by admissions",
            "✓",
            "blue"
        )}

                    ${statCard(
            "Rejected applications",
            overview.rejectedApplications,
            "Unsuccessful applications",
            "×",
            "red"
        )}

                    ${statCard(
            "Pending documents",
            overview.pendingDocuments,
            "Require document verification",
            "▧",
            "purple"
        )}

                </div>

                <!-- APPLICATION REGISTER -->

                <section class="card am-table-card">

                    <div class="am-section-heading">

                        <div>
                            <h3>Application register</h3>

                            <p>
                                ${state.filtered.length}
                                matching application${state.filtered.length === 1 ? "" : "s"}
                            </p>
                        </div>

                        <span class="am-record-count">
                            ${state.applications.length} total records
                        </span>

                    </div>

                    <!-- SEARCH AND FILTERS -->

                    <div class="am-toolbar">

                        <label class="am-search">
                            <span>⌕</span>

                            <input
                                id="amSearch"
                                type="search"
                                value="${esc(state.search)}"
                                placeholder="Search name, reference, email or course…">
                        </label>

                        <select
                            class="filter-select"
                            id="amStatusFilter"
                            aria-label="Filter by application status">

                            ${[
                "ALL",
                "SUBMITTED",
                "PENDING",
                "UNDER_REVIEW",
                "APPROVED",
                "REJECTED"
            ].map(value => `
                                <option
                                    value="${value}"
                                    ${state.status === value ? "selected" : ""}>
                                    ${value === "ALL"
                    ? "All statuses"
                    : esc(titleCase(value))
                }
                                </option>
                            `).join("")}

                        </select>

                        <select
                            class="filter-select"
                            id="amIntakeFilter"
                            aria-label="Filter by intake">

                            <option value="ALL">
                                All intakes
                            </option>

                            ${intakes.map(value => `
                                <option
                                    value="${esc(value)}"
                                    ${state.intake === value ? "selected" : ""}>
                                    ${esc(value)}
                                </option>
                            `).join("")}

                        </select>

                    </div>

                    <!-- APPLICATION TABLE -->

                    <div class="table-wrapper">

                        <table class="data-table am-table">

                            <thead>
                                <tr>
                                    <th>Applicant</th>
                                    <th>Reference</th>
                                    <th>Programme</th>
                                    <th>Intake</th>
                                    <th>Submitted</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>

                            <tbody>

                                ${rows.length
                ? rows.map(app => `
                                            <tr>

                                                <td>
                                                    <div class="am-person">

                                                        <span class="am-avatar">
                                                            ${esc(initials(app.applicantName))}
                                                        </span>

                                                        <span>
                                                            <strong>
                                                                ${esc(app.applicantName || "Unknown applicant")}
                                                            </strong>

                                                            <small>
                                                                ${esc(app.applicantEmail || "Email unavailable")}
                                                            </small>
                                                        </span>

                                                    </div>
                                                </td>

                                                <td>
                                                    <strong class="am-reference">
                                                        ${esc(app.referenceCode || "—")}
                                                    </strong>
                                                </td>

                                                <td>
                                                    ${esc(app.courseName || "—")}
                                                </td>

                                                <td>
                                                    ${esc(
                    [
                        app.intake,
                        app.academicYear
                    ].filter(Boolean).join(" · ") || "—"
                )}
                                                </td>

                                                <td>
                                                    ${fmtDate(app.submittedAt)}
                                                </td>

                                                <td>
                                                    ${badge(app.applicationStatus)}
                                                </td>

                                                <td>
                                                    <button
                                                        class="btn-secondary am-view-button"
                                                        type="button"
                                                        data-am-action="review"
                                                        data-id="${esc(app.applicationId)}">
                                                        Review
                                                    </button>
                                                </td>

                                            </tr>
                                        `).join("")
                : `
                                            <tr>
                                                <td colspan="7">
                                                    <div class="empty-state">
                                                        <div class="empty-icon">▤</div>
                                                        <strong>No applications found</strong>
                                                        <p>
                                                            Try changing your search or filters.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        `
            }

                            </tbody>

                        </table>

                    </div>

                    <!-- PAGINATION -->

                    <div class="am-pagination">

                        <span>
                            Showing
                            ${state.filtered.length ? start + 1 : 0}–${Math.min(
                start + state.pageSize,
                state.filtered.length
            )}
                            of ${state.filtered.length}
                        </span>

                        <div>

                            <button
                                class="btn-secondary"
                                type="button"
                                data-am-action="prev"
                                ${state.page <= 1 ? "disabled" : ""}>
                                Previous
                            </button>

                            <span>
                                Page ${state.page} of ${pages}
                            </span>

                            <button
                                class="btn-secondary"
                                type="button"
                                data-am-action="next"
                                ${state.page >= pages ? "disabled" : ""}>
                                Next
                            </button>

                        </div>

                    </div>

                </section>

                <!-- RECENT APPLICATIONS AND CHECKLIST -->

                <section class="am-recent-grid">

                    <div class="card am-recent-card">

                        <div class="am-section-heading">
                            <div>
                                <h3>Recently submitted</h3>
                                <p>Latest applications received</p>
                            </div>
                        </div>

                        ${asArray(overview.recentApplications).length
                ? `
                                    <div class="am-recent-list">

                                        ${overview.recentApplications
                    .slice(0, 5)
                    .map(item => `
                                                <button
                                                    type="button"
                                                    class="am-recent-row"
                                                    data-am-action="review"
                                                    data-id="${esc(item.applicationId)}">

                                                    <span class="am-avatar">
                                                        ${esc(initials(item.applicantName))}
                                                    </span>

                                                    <span class="am-recent-info">
                                                        <strong>
                                                            ${esc(item.applicantName || "Unknown applicant")}
                                                        </strong>

                                                        <small>
                                                            ${esc(item.referenceCode || "")}
                                                            ·
                                                            ${esc(item.courseName || "")}
                                                        </small>
                                                    </span>

                                                    <span class="am-recent-date">
                                                        ${fmtDate(item.submittedAt)}
                                                    </span>

                                                </button>
                                            `).join("")}

                                    </div>
                                `
                : `
                                    <div class="empty-state">
                                        No recent applications.
                                    </div>
                                `
            }

                    </div>

                    <div class="card am-guidance-card">

                        <span class="eyebrow">
                            REVIEW CHECKLIST
                        </span>

                        <h3>Before approving an application</h3>

                        <ul>
                            <li>
                                Review the applicant's personal information.
                            </li>

                            <li>
                                Check submitted academic qualifications.
                            </li>

                            <li>
                                Verify every uploaded document.
                            </li>

                            <li>
                                Confirm the applicant meets the programme requirements.
                            </li>
                        </ul>

                        <p class="am-guidance-note">
                            The backend blocks approval until at least
                            one document is submitted and all submitted
                            documents are verified.
                        </p>

                    </div>

                </section>

            </section>
        `;
    }

    function initials(name) {
        return String(name || "A")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0] || "")
            .join("")
            .toUpperCase() || "A";
    }

    /* =====================================================
   DASHBOARD STATISTICS
===================================================== */

    function statCard(label, value, note, icon, tone) {
        return `
            <article class="am-stat-card">
                <div class="am-stat-top">
                    <span>${esc(label)}</span>
                    <span class="am-stat-icon ${tone}">
                        ${icon}
                    </span>
                </div>

                <strong>
                    ${Number(value || 0).toLocaleString()}
                </strong>

                <small>${esc(note)}</small>
            </article>
        `;
    }

    /* =====================================================
       RENDER ADMISSIONS PAGE
    ===================================================== */

    function render() {
        setAdmissionsNavigation();

        const overview = state.overview || {};

        const intakes = [
            ...new Set(
                state.applications
                    .map(app => app.intake)
                    .filter(Boolean)
            )
        ];

        const start = (state.page - 1) * state.pageSize;

        const rows = state.filtered.slice(
            start,
            start + state.pageSize
        );

        const pages = Math.max(
            1,
            Math.ceil(state.filtered.length / state.pageSize)
        );

        PAGE.innerHTML = `
            <section class="am-page">

                <div class="page-heading am-heading">
                    <div>
                        <span class="eyebrow">
                            ADMISSIONS OFFICE
                        </span>

                        <h2>Admissions Management</h2>

                        <p>
                            Review applications, verify submitted
                            documents, make admission decisions
                            and contact applicants.
                        </p>
                    </div>

                    <button
                        class="btn-secondary"
                        type="button"
                        data-am-action="refresh">
                        ↻ Refresh data
                    </button>
                </div>

                <!-- STATISTICS -->

                <div class="am-stats-grid">

                    ${statCard(
            "Total applications",
            overview.totalApplications,
            "Submitted applications",
            "▤",
            "green"
        )}

                    ${statCard(
            "Pending applications",
            overview.pendingApplications,
            "Awaiting initial review",
            "◷",
            "orange"
        )}

                    ${statCard(
            "Approved applications",
            overview.approvedApplications,
            "Approved by admissions",
            "✓",
            "blue"
        )}

                    ${statCard(
            "Rejected applications",
            overview.rejectedApplications,
            "Unsuccessful applications",
            "×",
            "red"
        )}

                    ${statCard(
            "Pending documents",
            overview.pendingDocuments,
            "Require document verification",
            "▧",
            "purple"
        )}

                </div>

                <!-- APPLICATION REGISTER -->

                <section class="card am-table-card">

                    <div class="am-section-heading">

                        <div>
                            <h3>Application register</h3>

                            <p>
                                ${state.filtered.length}
                                matching application${state.filtered.length === 1 ? "" : "s"}
                            </p>
                        </div>

                        <span class="am-record-count">
                            ${state.applications.length} total records
                        </span>

                    </div>

                    <!-- SEARCH AND FILTERS -->

                    <div class="am-toolbar">

                        <label class="am-search">
                            <span>⌕</span>

                            <input
                                id="amSearch"
                                type="search"
                                value="${esc(state.search)}"
                                placeholder="Search name, reference, email or course…">
                        </label>

                        <select
                            class="filter-select"
                            id="amStatusFilter"
                            aria-label="Filter by application status">

                            ${[
                "ALL",
                "SUBMITTED",
                "PENDING",
                "UNDER_REVIEW",
                "APPROVED",
                "REJECTED"
            ].map(value => `
                                <option
                                    value="${value}"
                                    ${state.status === value ? "selected" : ""}>
                                    ${value === "ALL"
                    ? "All statuses"
                    : esc(titleCase(value))
                }
                                </option>
                            `).join("")}

                        </select>

                        <select
                            class="filter-select"
                            id="amIntakeFilter"
                            aria-label="Filter by intake">

                            <option value="ALL">
                                All intakes
                            </option>

                            ${intakes.map(value => `
                                <option
                                    value="${esc(value)}"
                                    ${state.intake === value ? "selected" : ""}>
                                    ${esc(value)}
                                </option>
                            `).join("")}

                        </select>

                    </div>

                    <!-- APPLICATION TABLE -->

                    <div class="table-wrapper">

                        <table class="data-table am-table">

                            <thead>
                                <tr>
                                    <th>Applicant</th>
                                    <th>Reference</th>
                                    <th>Programme</th>
                                    <th>Intake</th>
                                    <th>Submitted</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>

                            <tbody>

                                ${rows.length
                ? rows.map(app => `
                                            <tr>

                                                <td>
                                                    <div class="am-person">

                                                        <span class="am-avatar">
                                                            ${esc(initials(app.applicantName))}
                                                        </span>

                                                        <span>
                                                            <strong>
                                                                ${esc(app.applicantName || "Unknown applicant")}
                                                            </strong>

                                                            <small>
                                                                ${esc(app.applicantEmail || "Email unavailable")}
                                                            </small>
                                                        </span>

                                                    </div>
                                                </td>

                                                <td>
                                                    <strong class="am-reference">
                                                        ${esc(app.referenceCode || "—")}
                                                    </strong>
                                                </td>

                                                <td>
                                                    ${esc(app.courseName || "—")}
                                                </td>

                                                <td>
                                                    ${esc(
                    [
                        app.intake,
                        app.academicYear
                    ].filter(Boolean).join(" · ") || "—"
                )}
                                                </td>

                                                <td>
                                                    ${fmtDate(app.submittedAt)}
                                                </td>

                                                <td>
                                                    ${badge(app.applicationStatus)}
                                                </td>

                                                <td>
                                                    <button
                                                        class="btn-secondary am-view-button"
                                                        type="button"
                                                        data-am-action="review"
                                                        data-id="${esc(app.applicationId)}">
                                                        Review
                                                    </button>
                                                </td>

                                            </tr>
                                        `).join("")
                : `
                                            <tr>
                                                <td colspan="7">
                                                    <div class="empty-state">
                                                        <div class="empty-icon">▤</div>
                                                        <strong>No applications found</strong>
                                                        <p>
                                                            Try changing your search or filters.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        `
            }

                            </tbody>

                        </table>

                    </div>

                    <!-- PAGINATION -->

                    <div class="am-pagination">

                        <span>
                            Showing
                            ${state.filtered.length ? start + 1 : 0}–${Math.min(
                start + state.pageSize,
                state.filtered.length
            )}
                            of ${state.filtered.length}
                        </span>

                        <div>

                            <button
                                class="btn-secondary"
                                type="button"
                                data-am-action="prev"
                                ${state.page <= 1 ? "disabled" : ""}>
                                Previous
                            </button>

                            <span>
                                Page ${state.page} of ${pages}
                            </span>

                            <button
                                class="btn-secondary"
                                type="button"
                                data-am-action="next"
                                ${state.page >= pages ? "disabled" : ""}>
                                Next
                            </button>

                        </div>

                    </div>

                </section>

                <!-- RECENT APPLICATIONS AND CHECKLIST -->

                <section class="am-recent-grid">

                    <div class="card am-recent-card">

                        <div class="am-section-heading">
                            <div>
                                <h3>Recently submitted</h3>
                                <p>Latest applications received</p>
                            </div>
                        </div>

                        ${asArray(overview.recentApplications).length
                ? `
                                    <div class="am-recent-list">

                                        ${overview.recentApplications
                    .slice(0, 5)
                    .map(item => `
                                                <button
                                                    type="button"
                                                    class="am-recent-row"
                                                    data-am-action="review"
                                                    data-id="${esc(item.applicationId)}">

                                                    <span class="am-avatar">
                                                        ${esc(initials(item.applicantName))}
                                                    </span>

                                                    <span class="am-recent-info">
                                                        <strong>
                                                            ${esc(item.applicantName || "Unknown applicant")}
                                                        </strong>

                                                        <small>
                                                            ${esc(item.referenceCode || "")}
                                                            ·
                                                            ${esc(item.courseName || "")}
                                                        </small>
                                                    </span>

                                                    <span class="am-recent-date">
                                                        ${fmtDate(item.submittedAt)}
                                                    </span>

                                                </button>
                                            `).join("")}

                                    </div>
                                `
                : `
                                    <div class="empty-state">
                                        No recent applications.
                                    </div>
                                `
            }

                    </div>

                    <div class="card am-guidance-card">

                        <span class="eyebrow">
                            REVIEW CHECKLIST
                        </span>

                        <h3>Before approving an application</h3>

                        <ul>
                            <li>
                                Review the applicant's personal information.
                            </li>

                            <li>
                                Check submitted academic qualifications.
                            </li>

                            <li>
                                Verify every uploaded document.
                            </li>

                            <li>
                                Confirm the applicant meets the programme requirements.
                            </li>
                        </ul>

                        <p class="am-guidance-note">
                            The backend blocks approval until at least
                            one document is submitted and all submitted
                            documents are verified.
                        </p>

                    </div>

                </section>

            </section>
        `;
    }

    function initials(name) {
        return String(name || "A")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0] || "")
            .join("")
            .toUpperCase() || "A";
    }

    /* =====================================================
   MESSAGE HISTORY
===================================================== */

    function renderMessages() {
        if (!state.messages.length) {
            return `
                <div class="empty-state">
                    No messages have been sent for this application yet.
                </div>
            `;
        }

        return `
            <div class="am-message-list">

                ${state.messages.map(message => `
                    <article class="am-message-item">

                        <div class="am-message-meta">

                            <strong>
                                ${esc(message.senderName || "Admissions")}
                            </strong>

                            <span>
                                ${fmtDateTime(message.sentAt)}
                            </span>

                        </div>

                        <h4>
                            ${esc(message.subject || "Message")}
                        </h4>

                        <p>
                            ${esc(message.body || "")}
                        </p>

                        <small>
                            Delivery:
                            ${esc(titleCase(message.emailStatus || "UNKNOWN"))}

                            ${message.read
                ? " · Read by applicant"
                : " · Not yet read"}
                        </small>

                    </article>
                `).join("")}

            </div>
        `;
    }

    /* =====================================================
       LOAD APPLICATION REVIEW
    ===================================================== */

    async function reviewApplication(id) {
        try {
            state.selected = id;

            state.review = await api(
                ENDPOINTS.review(id)
            );

            try {
                state.messages = asArray(
                    await api(ENDPOINTS.messages(id))
                );

            } catch (error) {
                state.messages = [];

                notify(
                    `Application loaded, but message history could not be retrieved: ${error.message}`,
                    "error"
                );
            }

            openReviewDialog();

        } catch (error) {
            notify(
                error.message || "Could not load application review.",
                "error"
            );
        }
    }

    async function refreshReview() {
        if (!state.selected) return;

        state.review = await api(
            ENDPOINTS.review(state.selected)
        );

        try {
            state.messages = asArray(
                await api(ENDPOINTS.messages(state.selected))
            );

        } catch (_) {
            state.messages = [];
        }

        openReviewDialog();
    }

    /* =====================================================
       VERIFY OR REJECT DOCUMENTS
    ===================================================== */

    async function updateDocument(id, status) {

        const notes = status === "PENDING"
            ? ""
            : window.prompt(
                status === "REJECTED"
                    ? "Enter the reason this document is being rejected:"
                    : "Optional verification note:",
                ""
            );

        if (notes === null) return;

        try {
            await api(
                ENDPOINTS.verifyDocument(id),
                {
                    method: "PATCH",

                    body: JSON.stringify({
                        status,
                        notes: notes.trim() || null
                    })
                }
            );

            notify(
                `Document ${status.toLowerCase()} successfully.`
            );

            await refreshReview();
            await loadOverviewOnly();

        } catch (error) {
            notify(error.message, "error");
        }
    }

    /* =====================================================
       UPDATE APPLICATION STATUS
    ===================================================== */

    async function updateApplicationStatus(status) {
        if (!state.selected) return;

        const confirmation = status === "APPROVED"
            ? "Approve this application? The backend will check that every submitted document is verified."
            : status === "REJECTED"
                ? "Reject this application?"
                : `Change this application's status to ${titleCase(status)}?`;

        if (!window.confirm(confirmation)) return;

        try {
            await api(
                ENDPOINTS.status(state.selected),
                {
                    method: "PATCH",

                    body: JSON.stringify({
                        status
                    })
                }
            );

            notify(
                `Application status changed to ${titleCase(status)}.`
            );

            await loadData();
            await refreshReview();

        } catch (error) {
            notify(error.message, "error");
        }
    }

    /* =====================================================
       REFRESH OVERVIEW
    ===================================================== */

    async function loadOverviewOnly() {
        try {
            state.overview = await api(
                ENDPOINTS.overview
            );

            render();

        } catch (_) {
            // Keep the current overview visible.
        }
    }

    /* =====================================================
       OPEN OR DOWNLOAD APPLICANT DOCUMENT
    ===================================================== */
    async function openDocument(id, download = false) {
        let previewWindow = null;
        let objectUrl = null;

        if (!download) {
            previewWindow = window.open("about:blank", "_blank");

            if (!previewWindow) {
                notify(
                    "Preview blocked. Allow pop-ups for this site and try again.",
                    "error"
                );
                return;
            }

            previewWindow.document.body.innerHTML =
                "<p style='font-family:Arial;padding:24px'>Loading document preview...</p>";
        }

        try {
            const response = await fetch(
                `${API_BASE}${ENDPOINTS.documentFile(id)}`,
                {
                    headers: authHeaders()
                }
            );

            if (!response.ok) {
                const contentType =
                    response.headers.get("content-type") || "";

                let message = `Unable to retrieve document (${response.status}).`;

                if (contentType.includes("application/json")) {
                    const error = await response.json();
                    message = error.message || error.error || message;
                } else {
                    const errorText = await response.text();
                    if (errorText) message = errorText;
                }

                throw new Error(message);
            }

            const blob = await response.blob();

            objectUrl = URL.createObjectURL(blob);

            const doc = asArray(state.review?.documents).find(item =>
                String(item.documentId) === String(id)
            );

            const fileName =
                doc?.fileName || `application-document-${id}`;

            if (download) {
                const link = document.createElement("a");

                link.href = objectUrl;
                link.download = fileName;

                document.body.appendChild(link);
                link.click();
                link.remove();

            } else if (previewWindow && !previewWindow.closed) {
                previewWindow.location.href = objectUrl;
            } else {
                throw new Error("The preview window was closed.");
            }

            window.setTimeout(() => {
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                }
            }, 10 * 60 * 1000);

        } catch (error) {
            if (previewWindow && !previewWindow.closed) {
                previewWindow.close();
            }

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }

            console.error("Document opening error:", error);

            notify(
                error.message || "An error occurred while opening the document.",
                "error"
            );
        }
    }

    /* =====================================================
       SEND MESSAGE TO APPLICANT
    ===================================================== */

    async function sendApplicantMessage(form) {

        const staffId = currentStaffId();

        if (!Number.isInteger(staffId) || staffId <= 0) {
            notify(
                "Your staff user ID could not be read from local storage. Sign out and sign in again, then retry.",
                "error"
            );

            return;
        }

        const recipientId = Number(
            state.review?.userId
        );

        if (!Number.isInteger(recipientId) || recipientId <= 0) {
            notify(
                "The applicant user ID is missing from the application review response.",
                "error"
            );

            return;
        }

        const data = new FormData(form);

        const subject = String(
            data.get("subject") || ""
        ).trim();

        const body = String(
            data.get("body") || ""
        ).trim();

        if (!subject || !body) {
            notify(
                "Enter both a subject and a message.",
                "error"
            );

            return;
        }

        const button = $("button[type='submit']", form);

        if (button) {
            button.disabled = true;
            button.textContent = "Sending…";
        }

        try {
            await api(
                ENDPOINTS.sendMessage,
                {
                    method: "POST",

                    body: JSON.stringify({
                        senderId: staffId,
                        recipientId,

                        applicationId: Number(
                            state.review.applicationId
                        ),

                        messageType:
                            data.get("messageType") || "GENERAL",

                        subject,
                        body
                    })
                }
            );

            notify(
                "Message saved and email delivery attempted."
            );

            form.reset();

            state.messages = asArray(
                await api(
                    ENDPOINTS.messages(state.selected)
                )
            );

            openReviewDialog();

        } catch (error) {
            notify(error.message, "error");

        } finally {
            const currentButton =
                $("#amMessageForm button[type='submit']");

            if (currentButton) {
                currentButton.disabled = false;
                currentButton.textContent = "Send message";
            }
        }
    }


    /* =====================================================
       OPEN APPLICATION REVIEW DIALOG
    ===================================================== */

    function openReviewDialog() {
        const app = state.review;

        if (!app) {
            notify("Application review information is unavailable.", "error");
            return;
        }

        let dialog = document.getElementById("amReviewDialog");

        if (!dialog) {
            dialog = document.createElement("dialog");
            dialog.id = "amReviewDialog";
            document.body.appendChild(dialog);
        }

        const details = app.applicantDetails || {};

        const academics = asArray(app.academicRecords);
        const documents = asArray(app.documents);

        const documentVerified = documents.length > 0 &&
            documents.every(doc =>
                String(doc.verificationStatus || "").toUpperCase() === "VERIFIED"
            );

        const canApprove = documents.length > 0 && documentVerified;

        const applicationStatus = String(
            app.applicationStatus || "PENDING"
        ).toUpperCase();

        const detailItem = (label, value) => `
        <div class="am-detail-item">
            <span>${esc(label)}</span>
            <strong>${esc(value || "Not provided")}</strong>
        </div>
    `;

        const academicRows = academics.length
            ? academics.map(record => `
            <tr>
                <td>${esc(record.institutionName || "—")}</td>
                <td>${esc(record.qualificationName || "—")}</td>
                <td>${esc(record.examinationBody || "—")}</td>
                <td>${esc(record.subjectName || "—")}</td>
                <td>${esc(record.gradeObtained || "—")}</td>
                <td>${badge(record.verificationStatus || "PENDING")}</td>
            </tr>
        `).join("")
            : `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        No academic records were submitted.
                    </div>
                </td>
            </tr>
        `;

        const documentRows = documents.length
            ? documents.map(doc => {
                const docStatus = String(
                    doc.verificationStatus || "PENDING"
                ).toUpperCase();

                return `
                <div class="am-document-row">

                    <div class="am-document-icon">
                        ▤
                    </div>

                    <div class="am-document-info">

                        <strong>
                            ${esc(titleCase(doc.documentType || "Document"))}
                        </strong>

                        <small>
                            ${esc(doc.fileName || "Unnamed file")}
                        </small>

                        <small>
                            Uploaded: ${fmtDateTime(doc.uploadedAt)}
                        </small>

                        ${badge(docStatus)}

                        ${doc.verificationNotes
                        ? `<p>${esc(doc.verificationNotes)}</p>`
                        : ""
                    }

                    </div>

                    <div class="am-document-actions">

                        <button
                            type="button"
                            class="btn-secondary"
                            data-am-action="open-document"
                            data-id="${esc(doc.documentId)}">
                            View
                        </button>

                        <button
                            type="button"
                            class="btn-secondary"
                            data-am-action="download-document"
                            data-id="${esc(doc.documentId)}">
                            Download
                        </button>

                        ${docStatus !== "VERIFIED"
                        ? `
                                    <button
                                        type="button"
                                        class="btn-primary"
                                        data-am-action="verify-document"
                                        data-status="VERIFIED"
                                        data-id="${esc(doc.documentId)}">
                                        Verify
                                    </button>
                                `
                        : ""
                    }

                        ${docStatus !== "REJECTED"
                        ? `
                                    <button
                                        type="button"
                                        class="btn-danger"
                                        data-am-action="verify-document"
                                        data-status="REJECTED"
                                        data-id="${esc(doc.documentId)}">
                                        Reject
                                    </button>
                                `
                        : ""
                    }

                        ${docStatus !== "PENDING"
                        ? `
                                    <button
                                        type="button"
                                        class="btn-secondary"
                                        data-am-action="verify-document"
                                        data-status="PENDING"
                                        data-id="${esc(doc.documentId)}">
                                        Reset
                                    </button>
                                `
                        : ""
                    }

                    </div>

                </div>
            `;
            }).join("")
            : `
            <div class="empty-state">
                <div class="empty-icon">▤</div>
                <strong>No documents submitted</strong>
                <p>
                    This applicant has not uploaded any documents.
                </p>
            </div>
        `;

        dialog.innerHTML = `
        <div class="am-review-header">

            <div>
                <span class="eyebrow">
                    APPLICATION REVIEW
                </span>

                <h2>
                    ${esc(app.applicantName || "Unknown applicant")}
                </h2>

                <p>
                    Reference:
                    ${esc(app.referenceCode || "—")}
                </p>
            </div>

            <button
                type="button"
                class="dialog-close"
                data-am-action="close-review"
                aria-label="Close review">
                ×
            </button>

        </div>

        <div class="am-review-summary">

            <div>
                <span>Application status</span>
                ${badge(applicationStatus)}
            </div>

            <div>
                <span>Programme</span>
                <strong>${esc(app.courseName || "—")}</strong>
            </div>

            <div>
                <span>Submitted</span>
                <strong>${fmtDate(app.submittedAt)}</strong>
            </div>

        </div>

        <div class="am-review-body">

            <!-- PERSONAL INFORMATION -->

            <section class="am-review-section">

                <div class="am-section-heading">
                    <div>
                        <h3>Applicant information</h3>
                        <p>Personal and contact details</p>
                    </div>
                </div>

                <div class="am-detail-grid">

                    ${detailItem("Full name", app.applicantName)}

                    ${detailItem("Email address", app.applicantEmail)}

                    ${detailItem("Date of birth", fmtDate(details.dateOfBirth))}

                    ${detailItem("Gender", details.gender)}

                    ${detailItem("Nationality", details.nationality)}

                    ${detailItem("Residential address", details.residentialAddress)}

                    ${detailItem("City", details.city)}

                    ${detailItem("State / Region", details.stateOrRegion)}

                    ${detailItem("Country", details.country)}

                    ${detailItem("Emergency contact", details.emergencyContactName)}

                    ${detailItem("Emergency phone", details.emergencyContactPhone)}

                </div>

                ${!app.applicantDetails
                ? `
                            <p class="am-inline-warning">
                                Applicant personal details have not been
                                submitted or could not be retrieved.
                            </p>
                        `
                : ""
            }

            </section>

            <!-- APPLICATION INFORMATION -->

            <section class="am-review-section">

                <div class="am-section-heading">
                    <div>
                        <h3>Application details</h3>
                        <p>Programme and admission information</p>
                    </div>
                </div>

                <div class="am-detail-grid">

                    ${detailItem("Reference code", app.referenceCode)}

                    ${detailItem("Programme", app.courseName)}

                    ${detailItem("Intake", app.intake)}

                    ${detailItem("Academic year", app.academicYear)}

                    ${detailItem(
                "Estimated fee",
                app.estimatedFee == null
                    ? "—"
                    : Number(app.estimatedFee).toLocaleString()
            )}

                    ${detailItem("Application ID", app.applicationId)}

                </div>

            </section>

            <!-- ACADEMIC RECORDS -->

            <section class="am-review-section">

                <div class="am-section-heading">
                    <div>
                        <h3>Academic records</h3>
                        <p>
                            Submitted qualifications and examination results
                        </p>
                    </div>

                    <span class="am-record-count">
                        ${academics.length} record(s)
                    </span>
                </div>

                <div class="table-wrapper">

                    <table class="am-compact-table">

                        <thead>
                            <tr>
                                <th>Institution</th>
                                <th>Qualification</th>
                                <th>Exam body</th>
                                <th>Subject</th>
                                <th>Grade</th>
                                <th>Verification</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${academicRows}
                        </tbody>

                    </table>

                </div>

                <p class="am-inline-warning">
                    Academic record verification is currently read-only
                    because the backend does not expose an academic
                    verification endpoint.
                </p>

            </section>

            <!-- DOCUMENTS -->

            <section class="am-review-section">

                <div class="am-section-heading">

                    <div>
                        <h3>Uploaded documents</h3>
                        <p>
                            Review and verify applicant documents
                        </p>
                    </div>

                    <span class="am-doc-summary">
                        ${documents.length} document(s)
                    </span>

                </div>

                ${documentRows}

            </section>

            <!-- ADMISSION DECISION -->

            <section class="am-review-section">

                <div class="am-section-heading">
                    <div>
                        <h3>Admission decision</h3>
                        <p>Update the application's review status</p>
                    </div>
                </div>

                <div class="am-decision-panel">

                    <div>
                        <strong>Current status</strong>

                        ${badge(applicationStatus)}

                        <small>
                            ${canApprove
                ? "All submitted documents have been verified."
                : documents.length === 0
                    ? "At least one document is required before approval."
                    : "Every submitted document must be verified before approval."
            }
                        </small>
                    </div>

                    <div class="am-decision-actions">

                        <button
                            type="button"
                            class="btn-secondary"
                            data-am-action="set-status"
                            data-status="PENDING">
                            Pending
                        </button>

                        <button
                            type="button"
                            class="btn-secondary"
                            data-am-action="set-status"
                            data-status="UNDER_REVIEW">
                            Under review
                        </button>

                        <button
                            type="button"
                            class="btn-primary"
                            data-am-action="set-status"
                            data-status="APPROVED"
                            ${canApprove ? "" : "disabled"}>
                            Approve
                        </button>

                        <button
                            type="button"
                            class="btn-danger"
                            data-am-action="set-status"
                            data-status="REJECTED">
                            Reject
                        </button>

                    </div>

                </div>

            </section>

            <!-- COMMUNICATION -->

            <section class="am-review-section">

                <div class="am-section-heading">

                    <div>
                        <h3>Applicant communication</h3>
                        <p>
                            View messages and contact the applicant
                        </p>
                    </div>

                    <button
                        type="button"
                        class="btn-secondary"
                        data-am-action="reload-messages">
                        Refresh messages
                    </button>

                </div>

                ${renderMessages()}

                <form
                    id="amMessageForm"
                    class="am-message-form">

                    <div class="am-message-form-grid">

                        <label>
                            Message type

                            <select
                                class="form-control"
                                name="messageType">

                                <option value="GENERAL">
                                    General
                                </option>

                            </select>
                        </label>

                        <label>
                            Subject

                            <input
                                class="form-control"
                                type="text"
                                name="subject"
                                maxlength="180"
                                placeholder="Enter message subject"
                                required>
                        </label>

                    </div>

                    <label>
                        Message

                        <textarea
                            class="form-control"
                            name="body"
                            rows="5"
                            placeholder="Write your message to the applicant..."
                            required></textarea>
                    </label>

                    <div class="am-message-submit">

                        <small>
                            The system will save the message and attempt
                            email delivery.
                        </small>

                        <button
                            type="submit"
                            class="btn-primary">
                            Send message
                        </button>

                    </div>

                </form>

            </section>

        </div>
    `;

        if (!dialog.open) {
            dialog.showModal();
        }
    }

    /* =====================================================
       CLOSE REVIEW DIALOG
    ===================================================== */

    function closeReview() {
        const dialog =
            document.getElementById("amReviewDialog");

        if (dialog?.open) {
            dialog.close();
        }
    }

    /* =====================================================
   NAVIGATE TO ADMISSIONS PAGE
===================================================== */

    function routeToAdmissions() {
        setAdmissionsNavigation();

        if (!state.applications.length && !state.loading) {
            loadData();
        } else {
            render();
        }
    }

    /* =====================================================
       INTERCEPT ADMISSIONS SIDEBAR NAVIGATION
    ===================================================== */

    document.addEventListener("click", event => {

        const nav = event.target.closest(
            "[data-page='admissions']"
        );

        if (!nav) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        if (location.hash !== "#admissions") {
            history.pushState(
                null,
                "",
                "#admissions"
            );
        }

        routeToAdmissions();

        const sidebar =
            document.getElementById("sidebar");

        if (sidebar) {
            sidebar.classList.remove("open");
        }

    }, true);

    /* =====================================================
       HANDLE HASH CHANGES
    ===================================================== */

    window.addEventListener("hashchange", () => {

        if (
            location.hash
                .replace(/^#/, "")
                .toLowerCase() === "admissions"
        ) {
            routeToAdmissions();
        }

    });

    /* =====================================================
       SEARCH APPLICATIONS
    ===================================================== */

    PAGE.addEventListener("input", event => {

        if (event.target.id !== "amSearch") return;

        state.search = event.target.value;
        state.page = 1;

        applyFilters();

        render();

        const input = $("#amSearch", PAGE);

        if (input) {
            input.focus();

            input.setSelectionRange(
                state.search.length,
                state.search.length
            );
        }

    });

    /* =====================================================
       APPLICATION FILTERS
    ===================================================== */

    PAGE.addEventListener("change", event => {

        if (event.target.id === "amStatusFilter") {
            state.status = event.target.value;
        }

        if (event.target.id === "amIntakeFilter") {
            state.intake = event.target.value;
        }

        if (
            ["amStatusFilter", "amIntakeFilter"]
                .includes(event.target.id)
        ) {
            state.page = 1;

            applyFilters();

            render();
        }

    });

    /* =====================================================
       ALL ADMISSIONS BUTTON ACTIONS
    ===================================================== */

    document.addEventListener("click", async event => {

        const button = event.target.closest(
            "[data-am-action]"
        );

        if (!button) return;

        const action = button.dataset.amAction;
        const id = button.dataset.id;

        if (action === "refresh") {
            return loadData();
        }

        if (action === "review") {
            return reviewApplication(id);
        }

        if (action === "prev") {
            state.page = Math.max(
                1,
                state.page - 1
            );

            return render();
        }

        if (action === "next") {
            state.page += 1;

            return render();
        }

        if (action === "close-review") {
            return closeReview();
        }

        if (action === "open-document") {
            return openDocument(id, false);
        }

        if (action === "download-document") {
            return openDocument(id, true);
        }

        if (action === "verify-document") {
            return updateDocument(
                id,
                button.dataset.status
            );
        }

        if (action === "set-status") {
            return updateApplicationStatus(
                button.dataset.status
            );
        }

        if (action === "reload-messages") {

            try {
                state.messages = asArray(
                    await api(
                        ENDPOINTS.messages(state.selected)
                    )
                );

                openReviewDialog();

            } catch (error) {
                notify(error.message, "error");
            }
        }

    });

    /* =====================================================
       MESSAGE FORM SUBMISSION
    ===================================================== */

    document.addEventListener("submit", event => {

        if (event.target?.id !== "amMessageForm") {
            return;
        }

        event.preventDefault();

        sendApplicantMessage(event.target);

    });

    /* =====================================================
       INITIALIZE
    ===================================================== */

    if (
        location.hash
            .replace(/^#/, "")
            .toLowerCase() === "admissions"
    ) {
        routeToAdmissions();
    }

})();