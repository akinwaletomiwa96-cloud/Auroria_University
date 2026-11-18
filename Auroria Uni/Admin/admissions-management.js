
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
        review: id => `/api/admissions/applications/${encodeURIComponent(id)}/review`,
        status: id => `/api/admissions/applications/${encodeURIComponent(id)}/status`,
        verifyDocument: id => `/api/admissions/documents/${encodeURIComponent(id)}/verify`,
        documentFile: id => `/api/admissions/documents/${encodeURIComponent(id)}/file`,
        messages: id => `/api/communication/application/${encodeURIComponent(id)}/messages`,
        sendMessage: "/api/communication/messages",
        deleteApplication: id =>
            `/api/admissions/applications/${encodeURIComponent(id)}`
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

    let activeDocumentUrl = null;
    let activeDocumentName = "";

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const asArray = value => Array.isArray(value) ? value : [];

    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

    const titleCase = value =>
        String(value || "UNKNOWN")
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());

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

    const initials = name =>
        String(name || "A")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0] || "")
            .join("")
            .toUpperCase() || "A";

    function statusClass(value) {
        const status = String(value || "").toUpperCase();

        if (["APPROVED", "VERIFIED", "ACCEPTED"].includes(status)) {
            return "success";
        }

        if (status === "REJECTED") return "danger";

        if (["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(status)) {
            return "warning";
        }

        return "info";
    }

    function badge(value) {
        return `<span class="status-badge ${statusClass(value)}">
            ${esc(titleCase(value))}
        </span>`;
    }

    function storedUser() {
        for (const key of ["user", "currentUser", "adminUser", "loggedInUser"]) {
            try {
                const value = JSON.parse(localStorage.getItem(key) || "null");
                if (value && typeof value === "object") return value;
            } catch (_) { }
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

        const headers = { Accept: "application/json" };

        if (json) headers["Content-Type"] = "application/json";
        if (token) headers.Authorization = `Bearer ${token}`;

        return headers;
    }

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                ...authHeaders(options.body !== undefined),
                ...(options.headers || {})
            }
        });

        if (response.status === 204) return null;

        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            const message = payload && typeof payload === "object"
                ? payload.message || payload.error || `Request failed (${response.status})`
                : payload || `Request failed (${response.status})`;

            throw new Error(message);
        }

        return payload;
    }

    function notify(message, type = "success") {
        const region = document.getElementById("toastRegion");

        if (!region) {
            window.alert(message);
            return;
        }

        const toast = document.createElement("div");
        toast.className = `toast ${type === "error" ? "error" : "success"}`;
        toast.textContent = message;
        region.appendChild(toast);

        window.setTimeout(() => toast.remove(), 4200);
    }

    function setAdmissionsNavigation() {
        const title = document.getElementById("pageTitle");
        if (title) title.textContent = "Admissions Management";

        $$(".nav-link[data-page]").forEach(link => {
            link.classList.toggle("active", link.dataset.page === "admissions");
        });

        document.title = "Admissions Management | Auroria University";
    }

    function showPageError(error) {
        PAGE.innerHTML = `
            <section class="am-error card">
                <div class="empty-icon">!</div>
                <strong>Unable to load admissions</strong>
                <p>${esc(error?.message || "An unexpected error occurred.")}</p>
                <button class="btn-primary" type="button" data-am-action="refresh">
                    Try again
                </button>
            </section>`;
    }

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

            const matchesSearch = !term || searchable.includes(term);

            const matchesStatus =
                state.status === "ALL" ||
                String(app.applicationStatus || "").toUpperCase() === state.status;

            const matchesIntake =
                state.intake === "ALL" ||
                String(app.intake || "") === state.intake;

            return matchesSearch && matchesStatus && matchesIntake;
        });

        const maxPage = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
        state.page = Math.min(state.page, maxPage);
    }

    function renderShell() {
        setAdmissionsNavigation();
        PAGE.innerHTML = `
            <div class="am-loading card">
                <span class="am-spinner"></span>
                <strong>Loading admissions records…</strong>
            </div>`;
    }

    function statCard(label, value, note, icon, tone) {
        return `
            <article class="am-stat-card">
                <div class="am-stat-top">
                    <span>${esc(label)}</span>
                    <span class="am-stat-icon ${tone}">${icon}</span>
                </div>
                <strong>${Number(value || 0).toLocaleString()}</strong>
                <small>${esc(note)}</small>
            </article>`;
    }

    function render() {
        setAdmissionsNavigation();

        const overview = state.overview || {};
        const intakes = [...new Set(
            state.applications.map(app => app.intake).filter(Boolean)
        )];

        const start = (state.page - 1) * state.pageSize;
        const rows = state.filtered.slice(start, start + state.pageSize);
        const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));

        PAGE.innerHTML = `
            <section class="am-page">

                <div class="page-heading am-heading">
                    <div>
                        <span class="eyebrow">ADMISSIONS OFFICE</span>
                        <h2>Admissions Management</h2>
                        <p>Review applications, verify documents, make admission decisions and contact applicants.</p>
                    </div>
                    <button class="btn-secondary" type="button" data-am-action="refresh">
                        ↻ Refresh data
                    </button>
                </div>

                <div class="am-stats-grid">
                    ${statCard("Total applications", overview.totalApplications, "Submitted applications", "▤", "green")}
                    ${statCard("Pending applications", overview.pendingApplications, "Awaiting initial review", "◷", "orange")}
                    ${statCard("Approved applications", overview.approvedApplications, "Approved by admissions", "✓", "blue")}
                    ${statCard("Rejected applications", overview.rejectedApplications, "Unsuccessful applications", "×", "red")}
                    ${statCard("Pending documents", overview.pendingDocuments, "Require document verification", "▧", "purple")}
                </div>

                <section class="card am-table-card">
                    <div class="am-section-heading">
                        <div>
                            <h3>Application register</h3>
                            <p>${state.filtered.length} matching application${state.filtered.length === 1 ? "" : "s"}</p>
                        </div>
                        <span class="am-record-count">${state.applications.length} total records</span>
                    </div>

                    <div class="am-toolbar">
                        <label class="am-search">
                            <span>⌕</span>
                            <input id="amSearch" type="search"
                                value="${esc(state.search)}"
                                placeholder="Search name, reference, email or course…">
                        </label>

                        <select class="filter-select" id="amStatusFilter" aria-label="Filter by status">
                            ${["ALL", "SUBMITTED", "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]
                .map(value => `
                                    <option value="${value}" ${state.status === value ? "selected" : ""}>
                                        ${value === "ALL" ? "All statuses" : esc(titleCase(value))}
                                    </option>`).join("")}
                        </select>

                        <select class="filter-select" id="amIntakeFilter" aria-label="Filter by intake">
                            <option value="ALL">All intakes</option>
                            ${intakes.map(value => `
                                <option value="${esc(value)}" ${state.intake === value ? "selected" : ""}>
                                    ${esc(value)}
                                </option>`).join("")}
                        </select>
                    </div>

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
                                ${rows.length ? rows.map(app => `
                                    <tr>
                                        <td>
                                            <div class="am-person">
                                                <span class="am-avatar">${esc(initials(app.applicantName))}</span>
                                                <span>
                                                    <strong>${esc(app.applicantName || "Unknown applicant")}</strong>
                                                    <small>${esc(app.applicantEmail || "Email unavailable")}</small>
                                                </span>
                                            </div>
                                        </td>
                                        <td><strong class="am-reference">${esc(app.referenceCode || "—")}</strong></td>
                                        <td>${esc(app.courseName || "—")}</td>
                                        <td>${esc([app.intake, app.academicYear].filter(Boolean).join(" · ") || "—")}</td>
                                        <td>${fmtDate(app.submittedAt)}</td>
                                        <td>${badge(app.applicationStatus)}</td>
                                        <td>
                                           <div class="am-row-actions">
    <button class="btn-secondary am-view-button"
        type="button" data-am-action="review"
        data-id="${esc(app.applicationId)}">
        Review
    </button>

    <button class="btn-danger am-delete-button"
        type="button" data-am-action="delete-application"
        data-id="${esc(app.applicationId)}">
        Delete
    </button>
</div>
                                        </td>
                                    </tr>`).join("") : `
                                    <tr><td colspan="7">
                                        <div class="empty-state">
                                            <div class="empty-icon">▤</div>
                                            <strong>No applications found</strong>
                                            <p>Try changing your search or filters.</p>
                                        </div>
                                    </td></tr>`}
                            </tbody>
                        </table>
                    </div>

                    <div class="am-pagination">
                        <span>
                            Showing ${state.filtered.length ? start + 1 : 0}–${Math.min(start + state.pageSize, state.filtered.length)}
                            of ${state.filtered.length}
                        </span>
                        <div>
                            <button class="btn-secondary" type="button" data-am-action="prev" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
                            <span>Page ${state.page} of ${pages}</span>
                            <button class="btn-secondary" type="button" data-am-action="next" ${state.page >= pages ? "disabled" : ""}>Next</button>
                        </div>
                    </div>
                </section>

                <section class="am-recent-grid">
                    <div class="card am-recent-card">
                        <div class="am-section-heading">
                            <div><h3>Recently submitted</h3><p>Latest applications received</p></div>
                        </div>
                        ${asArray(overview.recentApplications).length ? `
                            <div class="am-recent-list">
                                ${overview.recentApplications.slice(0, 5).map(item => `
                                    <button type="button" class="am-recent-row"
                                        data-am-action="review" data-id="${esc(item.applicationId)}">
                                        <span class="am-avatar">${esc(initials(item.applicantName))}</span>
                                        <span class="am-recent-info">
                                            <strong>${esc(item.applicantName || "Unknown applicant")}</strong>
                                            <small>${esc(item.referenceCode || "")} · ${esc(item.courseName || "")}</small>
                                        </span>
                                        <span class="am-recent-date">${fmtDate(item.submittedAt)}</span>
                                    </button>`).join("")}
                            </div>` : `<div class="empty-state">No recent applications.</div>`}
                    </div>

                    <div class="card am-guidance-card">
                        <span class="eyebrow">REVIEW CHECKLIST</span>
                        <h3>Before approving an application</h3>
                        <ul>
                            <li>Review the applicant's personal information.</li>
                            <li>Check submitted academic qualifications.</li>
                            <li>Verify every uploaded document.</li>
                            <li>Confirm the applicant meets programme requirements.</li>
                        </ul>
                        <p class="am-guidance-note">
                            Approval requires at least one submitted document and all submitted documents to be verified.
                        </p>
                    </div>
                </section>
            </section>`;
    }

    /* =====================================================
       REVIEW DATA
    ===================================================== */

    async function reviewApplication(id) {
        try {
            state.selected = id;
            state.review = await api(ENDPOINTS.review(id));

            try {
                state.messages = asArray(await api(ENDPOINTS.messages(id)));
            } catch (error) {
                state.messages = [];
                notify(`Application loaded, but message history could not be retrieved: ${error.message}`, "error");
            }

            openReviewDialog();
        } catch (error) {
            notify(error.message || "Could not load application review.", "error");
        }
    }

    async function refreshReview() {
        if (!state.selected) return;

        state.review = await api(ENDPOINTS.review(state.selected));

        try {
            state.messages = asArray(await api(ENDPOINTS.messages(state.selected)));
        } catch (_) {
            state.messages = [];
        }

        openReviewDialog();
    }

    /* =====================================================
       DOCUMENT VERIFICATION
    ===================================================== */

    async function updateDocument(id, status) {
        let notes = "";

        if (status === "REJECTED") {
            notes = window.prompt("Enter the reason this document is being rejected:", "");
            if (notes === null) return;
            notes = notes.trim();

            if (!notes) {
                notify("A reason is required when rejecting a document.", "error");
                return;
            }
        } else if (status === "VERIFIED") {
            notes = window.prompt("Optional verification note:", "") ?? "";
        }

        try {
            await api(ENDPOINTS.verifyDocument(id), {
                method: "PATCH",
                body: JSON.stringify({
                    status,
                    notes: notes.trim() || null
                })
            });

            notify(`Document ${status.toLowerCase()} successfully.`);
            await refreshReview();
            await loadOverviewOnly();
        } catch (error) {
            notify(error.message, "error");
        }
    }

    /* =====================================================
       APPLICATION DECISION
    ===================================================== */

    async function updateApplicationStatus(status) {
        if (!state.selected || state.busy) return;

        const currentStatus = String(
            state.review?.applicationStatus || ""
        ).toUpperCase();

        if (["APPROVED", "REJECTED"].includes(currentStatus)) {
            notify("This application already has a final decision.", "error");
            return;
        }

        let reviewNotes = "";

        if (status === "REJECTED") {
            reviewNotes = window.prompt(
                "Enter the reason for rejecting this application:"
            );

            if (reviewNotes === null) return;
            reviewNotes = reviewNotes.trim();

            if (!reviewNotes) {
                notify("A rejection reason is required.", "error");
                return;
            }
        }

        if (!["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status)) {
            notify("Invalid application status.", "error");
            return;
        }

        if (!window.confirm(
            status === "APPROVED"
                ? "Approve this application? This decision is intended to be final."
                : status === "REJECTED"
                    ? "Reject this application? This decision is intended to be final."
                    : `Change application status to ${titleCase(status)}?`
        )) return;

        state.busy = true;

        try {
            const result = await api(ENDPOINTS.status(state.selected), {
                method: "PATCH",
                body: JSON.stringify({ status, reviewNotes })
            });

            notify(
                result?.message ||
                `Application status updated to ${titleCase(status)}.`
            );

            await refreshReview();
            await loadOverviewOnly();
        } catch (error) {
            notify(error.message || "Could not update application status.", "error");
        } finally {
            state.busy = false;
        }
    }

    async function loadOverviewOnly() {
        try {
            state.overview = await api(ENDPOINTS.overview);
            render();
        } catch (_) { }
    }

    /* =====================================================
       DOCUMENT PREVIEW — EMBEDDED IN REVIEW DIALOG
    ===================================================== */

    async function openDocument(id, download = false) {
        try {
            const response = await fetch(
                `${API_BASE}${ENDPOINTS.documentFile(id)}`,
                { headers: authHeaders() }
            );

            if (!response.ok) {
                const contentType = response.headers.get("content-type") || "";
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

            const docRecord = asArray(state.review?.documents).find(item =>
                String(item.documentId) === String(id)
            );

            const fileName = docRecord?.fileName || `application-document-${id}`;

            if (download) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();

                window.setTimeout(() => URL.revokeObjectURL(url), 30000);
                return;
            }

            const viewer = $("#amDocumentViewer");
            const preview = $("#amDocumentPreview");
            const title = $("#amDocumentTitle");

            if (!viewer || !preview || !title) {
                throw new Error("The embedded document viewer could not be found.");
            }

            closeDocumentViewer();

            activeDocumentUrl = URL.createObjectURL(blob);
            activeDocumentName = fileName;
            title.textContent = fileName;

            const type = (blob.type || "").toLowerCase();

            if (type.includes("pdf") || fileName.toLowerCase().endsWith(".pdf")) {
                preview.innerHTML = `
                    <iframe
                        src="${activeDocumentUrl}"
                        class="am-document-frame"
                        title="Applicant document preview">
                    </iframe>`;
            } else if (type.startsWith("image/")) {
                preview.innerHTML = `
                    <img
                        src="${activeDocumentUrl}"
                        class="am-document-image"
                        alt="Applicant document preview">`;
            } else {
                preview.innerHTML = `
                    <div class="am-document-unsupported">
                        <div class="empty-icon">▤</div>
                        <h3>Preview unavailable</h3>
                        <p>This file type cannot be previewed here. You can download it instead.</p>
                        <button type="button" class="btn-primary"
                            data-am-action="download-active-document">
                            Download document
                        </button>
                    </div>`;
            }

            viewer.hidden = false;
            viewer.scrollIntoView({ behavior: "smooth", block: "start" });

        } catch (error) {
            console.error("Document preview error:", error);
            notify(error.message || "Unable to open document.", "error");
        }
    }

    function closeDocumentViewer() {
        const viewer = $("#amDocumentViewer");
        const preview = $("#amDocumentPreview");

        if (viewer) viewer.hidden = true;
        if (preview) preview.innerHTML = "";

        if (activeDocumentUrl) {
            URL.revokeObjectURL(activeDocumentUrl);
            activeDocumentUrl = null;
        }

        activeDocumentName = "";
    }

    /* =====================================================
       MESSAGES
    ===================================================== */

    function renderMessages() {
        if (!state.messages.length) {
            return `<div class="empty-state">No messages have been sent for this application yet.</div>`;
        }

        return `
            <div class="am-message-list">
                ${state.messages.map(message => `
                    <article class="am-message-item">
                        <div class="am-message-meta">
                            <strong>${esc(message.senderName || "Admissions")}</strong>
                            <span>${fmtDateTime(message.sentAt)}</span>
                        </div>
                        <h4>${esc(message.subject || "Message")}</h4>
                        <p>${esc(message.body || "")}</p>
                        <small>
                            Delivery: ${esc(titleCase(message.emailStatus || "UNKNOWN"))}
                            ${message.read ? " · Read by applicant" : " · Not yet read"}
                        </small>
                    </article>`).join("")}
            </div>`;
    }

    async function sendApplicantMessage(form) {
        const staffId = currentStaffId();

        if (!Number.isInteger(staffId) || staffId <= 0) {
            notify("Your staff user ID could not be read. Sign out and sign in again.", "error");
            return;
        }

        const recipientId = Number(state.review?.userId);

        if (!Number.isInteger(recipientId) || recipientId <= 0) {
            notify("The applicant user ID is missing from the review response.", "error");
            return;
        }

        const data = new FormData(form);
        const subject = String(data.get("subject") || "").trim();
        const body = String(data.get("body") || "").trim();

        if (!subject || !body) {
            notify("Enter both a subject and a message.", "error");
            return;
        }

        const button = $("button[type='submit']", form);
        if (button) {
            button.disabled = true;
            button.textContent = "Sending…";
        }

        try {
            await api(ENDPOINTS.sendMessage, {
                method: "POST",
                body: JSON.stringify({
                    senderId: staffId,
                    recipientId,
                    applicationId: Number(state.review.applicationId),
                    messageType: data.get("messageType") || "GENERAL",
                    subject,
                    body
                })
            });

            notify("Message saved and email delivery attempted.");
            form.reset();

            state.messages = asArray(
                await api(ENDPOINTS.messages(state.selected))
            );

            openReviewDialog();
        } catch (error) {
            notify(error.message, "error");
        } finally {
            const currentButton = $("#amMessageForm button[type='submit']");
            if (currentButton) {
                currentButton.disabled = false;
                currentButton.textContent = "Send message";
            }
        }
    }


    /* =====================================================
   DELETE APPLICATION
===================================================== */

    async function deleteApplication(id) {
        if (!id || state.busy) return;

        const app = state.applications.find(item =>
            String(item.applicationId) === String(id)
        );

        if (!app) {
            notify("Application could not be found.", "error");
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete application ${app.referenceCode || id} belonging to ${app.applicantName || "this applicant"}?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        state.busy = true;

        try {
            await api(ENDPOINTS.deleteApplication(id), {
                method: "DELETE"
            });

            // Close the review dialog if the deleted application is open.
            if (String(state.selected) === String(id)) {
                closeReview();
                state.selected = null;
                state.review = null;
                state.messages = [];
            }

            notify("Application deleted successfully.");

            await loadData();

        } catch (error) {
            notify(error.message || "Unable to delete application.", "error");
        } finally {
            state.busy = false;
        }
    }

    /* =====================================================
       REVIEW DIALOG
    ===================================================== */

    function openReviewDialog() {
        const review = state.review || {};
        const app = review.application || review;
        const details = review.applicantDetails || review.applicant || {};
        const academics = asArray(review.academicRecords || review.academics);
        const documents = asArray(review.documents);

        const applicationStatus = String(
            app.applicationStatus || review.applicationStatus || "PENDING"
        ).toUpperCase();

        const isFinalDecision = ["APPROVED", "REJECTED"].includes(applicationStatus);

        const canApprove =
            documents.length > 0 &&
            documents.every(doc =>
                String(doc.verificationStatus || "").toUpperCase() === "VERIFIED"
            );

        const dialog = document.getElementById("amReviewDialog")
            || document.createElement("dialog");

        dialog.id = "amReviewDialog";
        dialog.className = "am-review-dialog";

        if (!dialog.isConnected) document.body.appendChild(dialog);

        const detailItem = (label, value) => `
            <div class="am-detail-item">
                <span>${esc(label)}</span>
                <strong>${esc(value || "Not provided")}</strong>
            </div>`;

        const academicRows = academics.length
            ? academics.map(record => `
                <tr>
                    <td>${esc(record.institutionName || "—")}</td>
                    <td>${esc(record.qualificationName || "—")}</td>
                    <td>${esc(record.examinationBody || "—")}</td>
                    <td>${esc(record.subjectName || "—")}</td>
                    <td>${esc(record.gradeObtained || "—")}</td>
                    <td>${badge(record.verificationStatus || "PENDING")}</td>
                </tr>`).join("")
            : `<tr><td colspan="6"><div class="empty-state">No academic records were submitted.</div></td></tr>`;

        const documentRows = documents.length
            ? documents.map(doc => {
                const docStatus = String(doc.verificationStatus || "PENDING").toUpperCase();

                return `
                    <div class="am-document-row">
                        <div class="am-document-icon">▤</div>

                        <div class="am-document-info">
                            <strong>${esc(titleCase(doc.documentType || "Document"))}</strong>
                            <small>${esc(doc.fileName || "Unnamed file")}</small>
                            <small>Uploaded: ${fmtDateTime(doc.uploadedAt)}</small>
                            ${badge(docStatus)}
                            ${doc.verificationNotes
                        ? `<p class="am-document-notes">${esc(doc.verificationNotes)}</p>`
                        : ""}
                        </div>

                        <div class="am-document-actions">
                            <button type="button" class="btn-secondary"
                                data-am-action="open-document"
                                data-id="${esc(doc.documentId)}">View</button>

                            <button type="button" class="btn-secondary"
                                data-am-action="download-document"
                                data-id="${esc(doc.documentId)}">Download</button>

                            ${docStatus !== "VERIFIED" ? `
                                <button type="button" class="btn-primary"
                                    data-am-action="verify-document"
                                    data-status="VERIFIED"
                                    data-id="${esc(doc.documentId)}">Verify</button>` : ""}

                            ${docStatus !== "REJECTED" ? `
                                <button type="button" class="btn-danger"
                                    data-am-action="verify-document"
                                    data-status="REJECTED"
                                    data-id="${esc(doc.documentId)}">Reject</button>` : ""}

                            ${docStatus !== "PENDING" ? `
                                <button type="button" class="btn-secondary"
                                    data-am-action="verify-document"
                                    data-status="PENDING"
                                    data-id="${esc(doc.documentId)}">Reset</button>` : ""}
                        </div>
                    </div>`;
            }).join("")
            : `<div class="empty-state">
                <div class="empty-icon">▤</div>
                <strong>No documents submitted</strong>
                <p>This applicant has not uploaded any documents.</p>
            </div>`;

        const reviewNotes = review.reviewNotes || app.reviewNotes || "";

        dialog.innerHTML = `
            <div class="am-review-header">
                <div>
                    <span class="eyebrow">APPLICATION REVIEW</span>
                    <h2>${esc(app.applicantName || review.applicantName || "Unknown applicant")}</h2>
                    <p>Reference: ${esc(app.referenceCode || review.referenceCode || "—")}</p>
                </div>

                <button type="button" class="dialog-close"
                    data-am-action="close-review" aria-label="Close review">×</button>
            </div>

            <div class="am-review-summary">
                <div><span>Application status</span>${badge(applicationStatus)}</div>
                <div><span>Programme</span><strong>${esc(app.courseName || review.courseName || "—")}</strong></div>
                <div><span>Submitted</span><strong>${fmtDate(app.submittedAt || review.submittedAt)}</strong></div>
            </div>

            <div class="am-review-body">

                <section class="am-review-section">
                    <div class="am-section-heading">
                        <div><h3>Applicant information</h3><p>Personal and contact details</p></div>
                    </div>

                    <div class="am-detail-grid">
                        ${detailItem("Full name", app.applicantName || review.applicantName)}
                        ${detailItem("Email address", app.applicantEmail || review.applicantEmail)}
                        ${detailItem("Date of birth", fmtDate(details.dateOfBirth))}
                        ${detailItem("Gender", details.gender)}
                        ${detailItem("Nationality", details.nationality)}
                        ${detailItem("Residential address", details.residentialAddress || details.address)}
                        ${detailItem("City", details.city)}
                        ${detailItem("State / Region", details.stateOrRegion || details.state)}
                        ${detailItem("Country", details.country)}
                        ${detailItem("Emergency contact", details.emergencyContactName)}
                        ${detailItem("Emergency phone", details.emergencyContactPhone)}
                    </div>

                    ${Object.keys(details).length === 0 ? `
                        <p class="am-inline-warning">
                            Applicant personal details were not included in the review response.
                            Check the backend review DTO and applicant-details query.
                        </p>` : ""}
                </section>

                <section class="am-review-section">
                    <div class="am-section-heading">
                        <div><h3>Application details</h3><p>Programme and admission information</p></div>
                    </div>

                    <div class="am-detail-grid">
                        ${detailItem("Reference code", app.referenceCode || review.referenceCode)}
                        ${detailItem("Programme", app.courseName || review.courseName)}
                        ${detailItem("Intake", app.intake || review.intake)}
                        ${detailItem("Academic year", app.academicYear || review.academicYear)}
                        ${detailItem(
            "Estimated fee",
            app.estimatedFee == null && review.estimatedFee == null
                ? "—"
                : Number(app.estimatedFee ?? review.estimatedFee).toLocaleString()
        )}
                        ${detailItem("Application ID", app.applicationId || review.applicationId)}
                    </div>
                </section>

                <section class="am-review-section">
                    <div class="am-section-heading">
                        <div><h3>Academic records</h3><p>Submitted qualifications and examination results</p></div>
                        <span class="am-record-count">${academics.length} record(s)</span>
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
                            <tbody>${academicRows}</tbody>
                        </table>
                    </div>
                </section>

                <section class="am-review-section">
                    <div class="am-section-heading">
                        <div><h3>Uploaded documents</h3><p>Review and verify applicant documents</p></div>
                        <span class="am-doc-summary">${documents.length} document(s)</span>
                    </div>

                    ${documentRows}

                    <section id="amDocumentViewer" class="am-document-viewer" hidden>
                        <div class="am-document-viewer-header">
                            <div>
                                <span class="eyebrow">DOCUMENT PREVIEW</span>
                                <h3 id="amDocumentTitle">Document</h3>
                            </div>
                            <div class="am-document-viewer-actions">
                                <button type="button" class="btn-secondary"
                                    data-am-action="download-active-document">Download</button>
                                <button type="button" class="btn-danger"
                                    data-am-action="close-document">Close preview</button>
                            </div>
                        </div>
                        <div id="amDocumentPreview" class="am-document-preview"></div>
                    </section>
                </section>

                <section class="am-review-section">
                    <div class="am-section-heading">
                        <div><h3>Admission decision</h3><p>Review and update the application's status</p></div>
                    </div>

                    ${isFinalDecision ? `
                        <div class="am-final-decision ${applicationStatus.toLowerCase()}">
                            <div class="am-final-icon">${applicationStatus === "APPROVED" ? "✓" : "!"}</div>
                            <div>
                                <strong>Application ${esc(applicationStatus)}</strong>
                                <p>This application has received its final decision. Its status cannot be changed.</p>

                                ${reviewNotes ? `
                                    <div class="am-review-reason">
                                        <strong>Review notes / rejection reason</strong>
                                        <p>${esc(reviewNotes)}</p>
                                    </div>` : ""}

                                <small>
                                    Decision email status:
                                    ${esc(review.decisionEmailStatus || "Not supplied by backend")}
                                </small>
                            </div>
                        </div>
                    ` : `
                        <div class="am-decision-panel">
                            <div>
                                <strong>Current status</strong>
                                ${badge(applicationStatus)}
                                <small>
                                    ${canApprove
                ? "All submitted documents have been verified."
                : documents.length === 0
                    ? "At least one document is required before approval."
                    : "Every submitted document must be verified before approval."}
                                </small>
                            </div>

                            <div class="am-decision-actions">
                                <button type="button" class="btn-secondary"
                                    data-am-action="set-status" data-status="PENDING"
                                    ${state.busy ? "disabled" : ""}>Pending</button>

                                <button type="button" class="btn-secondary"
                                    data-am-action="set-status" data-status="UNDER_REVIEW"
                                    ${state.busy ? "disabled" : ""}>Under review</button>

                                <button type="button" class="btn-primary"
                                    data-am-action="set-status" data-status="APPROVED"
                                    ${!canApprove || state.busy ? "disabled" : ""}>Approve</button>

                                <button type="button" class="btn-danger"
                                    data-am-action="set-status" data-status="REJECTED"
                                    ${state.busy ? "disabled" : ""}>Reject</button>
                            </div>
                        </div>
                    `}
                </section>

                <section class="am-review-section">
                    <div class="am-section-heading">
                        <div><h3>Applicant communication</h3><p>View messages and contact the applicant</p></div>
                        <button type="button" class="btn-secondary"
                            data-am-action="reload-messages">Refresh messages</button>
                    </div>

                    ${renderMessages()}

                    <form id="amMessageForm" class="am-message-form">
                        <div class="am-message-form-grid">
                            <label>
                                Message type
                                <select class="form-control" name="messageType">
                                    <option value="GENERAL">General</option>
                                </select>
                            </label>

                            <label>
                                Subject
                                <input class="form-control" type="text" name="subject"
                                    maxlength="180" placeholder="Enter message subject" required>
                            </label>
                        </div>

                        <label>
                            Message
                            <textarea class="form-control" name="body" rows="5"
                                placeholder="Write your message to the applicant..." required></textarea>
                        </label>

                        <div class="am-message-submit">
                            <small>The system will save the message and attempt email delivery.</small>
                            <button type="submit" class="btn-primary">Send message</button>
                        </div>
                    </form>
                </section>
            </div>`;

        if (!dialog.open) dialog.showModal();
    }

    function closeReview() {
        closeDocumentViewer();

        const dialog = document.getElementById("amReviewDialog");
        if (dialog?.open) dialog.close();
    }

    function routeToAdmissions() {
        setAdmissionsNavigation();

        if (!state.applications.length && !state.loading) {
            loadData();
        } else {
            render();
        }
    }

    /* =====================================================
       NAVIGATION
    ===================================================== */

    document.addEventListener("click", event => {
        const nav = event.target.closest("[data-page='admissions']");
        if (!nav) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        if (location.hash !== "#admissions") {
            history.pushState(null, "", "#admissions");
        }

        routeToAdmissions();

        document.getElementById("sidebar")?.classList.remove("open");
    }, true);

    window.addEventListener("hashchange", () => {
        if (location.hash.replace(/^#/, "").toLowerCase() === "admissions") {
            routeToAdmissions();
        }
    });

    /* =====================================================
       SEARCH
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
            input.setSelectionRange(state.search.length, state.search.length);
        }
    });

    PAGE.addEventListener("change", event => {
        if (event.target.id === "amStatusFilter") {
            state.status = event.target.value;
        }

        if (event.target.id === "amIntakeFilter") {
            state.intake = event.target.value;
        }

        if (["amStatusFilter", "amIntakeFilter"].includes(event.target.id)) {
            state.page = 1;
            applyFilters();
            render();
        }
    });

    /* =====================================================
       BUTTON ACTIONS
    ===================================================== */

    document.addEventListener("click", async event => {
        const button = event.target.closest("[data-am-action]");
        if (!button) return;

        const action = button.dataset.amAction;
        const id = button.dataset.id;
        
        if (action === "refresh") return loadData();
        if (action === "review") return reviewApplication(id);
        if (action === "delete-application") return deleteApplication(id);

        if (action === "prev") {
            state.page = Math.max(1, state.page - 1);
            return render();
        }

        if (action === "next") {
            state.page += 1;
            return render();
        }

        if (action === "close-review") return closeReview();

        if (action === "open-document") return openDocument(id, false);
        if (action === "download-document") return openDocument(id, true);

        if (action === "close-document") return closeDocumentViewer();

        if (action === "download-active-document") {
            const doc = asArray(state.review?.documents).find(item =>
                item.fileName === activeDocumentName
            );

            if (doc) return openDocument(doc.documentId, true);
            return notify("The document record could not be found.", "error");
        }

        if (action === "verify-document") {
            return updateDocument(id, button.dataset.status);
        }

        if (action === "set-status") {
            return updateApplicationStatus(button.dataset.status);
        }

        if (action === "reload-messages") {
            try {
                state.messages = asArray(
                    await api(ENDPOINTS.messages(state.selected))
                );
                openReviewDialog();
            } catch (error) {
                notify(error.message, "error");
            }
        }
    });

    document.addEventListener("submit", event => {
        if (event.target?.id !== "amMessageForm") return;
        event.preventDefault();
        sendApplicantMessage(event.target);
    });

    /* =====================================================
       INITIALIZE
    ===================================================== */

    if (location.hash.replace(/^#/, "").toLowerCase() === "admissions") {
        routeToAdmissions();
    }

})();
