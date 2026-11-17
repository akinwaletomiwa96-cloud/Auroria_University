(() => {
    "use strict";

    /* =====================================================
         CONFIGURATION
      ===================================================== */

    const API_BASE = "http://localhost:8080";

    const API = {
        me: "/api/staff/me",

        profile: "/api/profile",

        overview: "/api/admissions/overview",

        applications: "/api/admissions/applications",

        documents: "/api/admissions/documents",

        decisions: "/api/admissions/decisions",

        enquiries: "/api/admissions/enquiries",

        notifications: "/api/staff/notifications",

        reports: "/api/admissions/reports",

        messages: "/api/communication/messages",

        sentMessages: "/api/communication/staff",
    };

    /* =====================================================
         DOM
      ===================================================== */

    const $ = (selector, root = document) => root.querySelector(selector);

    const $$ = (selector, root = document) => [
        ...root.querySelectorAll(selector),
    ];

    const pageContent = $("#pageContent");

    const dialog = $("#detailDialog");

    const dialogContent = $("#dialogContent");

    /* =====================================================
         STATE
      ===================================================== */

    const state = {
        page: "overview",

        user: {},

        profile: {},

        applications: [],

        sentMessages: [],

        documents: [],

        enquiries: [],

        notifications: [],

        courses: [],

        applicationSearch: "",

        applicationStatus: "all",

        documentStatus: "all",

        enquiryStatus: "all",

        overview: null,

        selectedApplication: null,

        loading: false,

        loaded: false,
    };

    let activeDocumentObjectUrl = null;

    /* =====================================================
         STORAGE
      ===================================================== */

    function storedUser() {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch {
            return {};
        }
    }

    function getToken() {
        return (
            localStorage.getItem("token") || localStorage.getItem("authToken") || ""
        );
    }

    function userId() {
        return (
            state.user?.userId ||
            state.user?.id ||
            state.profile?.userId ||
            state.profile?.id ||
            storedUser()?.userId ||
            storedUser()?.id ||
            localStorage.getItem("userId") ||
            localStorage.getItem("user_id") ||
            ""
        );
    }

    /* =====================================================
         HELPERS
      ===================================================== */

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function val(object, keys, fallback = "") {
        if (!object) return fallback;

        for (const key of keys) {
            const value = object[key];

            if (value !== null && value !== undefined && value !== "") {
                return value;
            }
        }

        return fallback;
    }

    function arr(value) {
        if (Array.isArray(value)) {
            return value;
        }

        if (Array.isArray(value?.data)) {
            return value.data;
        }

        if (Array.isArray(value?.content)) {
            return value.content;
        }

        if (Array.isArray(value?.items)) {
            return value.items;
        }

        return [];
    }

    function title(value) {
        return String(value || "")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function initials(value) {
        return String(value || "AO")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0] || "")
            .join("")
            .toUpperCase();
    }

    function date(value) {
        if (!value) return "—";

        const result = new Date(value);

        if (Number.isNaN(result.getTime())) {
            return "—";
        }

        return result.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    function statusClass(value) {
        const status = String(value || "")
            .toLowerCase()
            .replace(/[_\s]+/g, "-");

        const known = [
            "draft",
            "submitted",
            "pending",
            "approved",
            "rejected",
            "verified",
            "unverified",
            "under-review",
            "processing",
            "completed",
            "failed"
        ];

        return known.includes(status) ? status : "pending";
    }

    function pill(value) {
        const status = title(value || "Pending");

        return `
            <span class="status status-${statusClass(value)}">
                ${esc(status)}
            </span>
        `;
    }

    function toast(message, type = "") {
        let region = $("#toastRegion");

        if (!region) return;

        const item = document.createElement("div");

        item.className = `toast ${type}`;

        item.textContent = message;

        region.appendChild(item);

        setTimeout(() => item.remove(), 4000);
    }

    function empty(heading, message) {
        return `
            <div class="empty-state">

                <div class="empty-icon">◇</div>

                <h3>${esc(heading)}</h3>

                <p>${esc(message)}</p>

            </div>
        `;
    }

    function heading(name, description, action = "") {
        return `
            <div class="page-heading">

                <div>

                    <h2>${esc(name)}</h2>

                    <p>${esc(description)}</p>

                </div>

                ${action}

            </div>
        `;
    }

    function phead(name, description = "") {
        return `
            <div class="panel-heading">

                <div>

                    <h3>${esc(name)}</h3>

                    ${description ? `<p>${esc(description)}</p>` : ""}

                </div>

            </div>
        `;
    }

    /* =====================================================
         API REQUEST
      ===================================================== */

    async function request(path, options = {}) {
        const headers = {
            Accept: "application/json",

            ...options.headers,
        };

        if (options.body) {
            headers["Content-Type"] = "application/json";
        }

        const token = getToken();

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
        });

        const text = await response.text();

        let result = {};

        try {
            result = text ? JSON.parse(text) : {};
        } catch {
            result = text;
        }

        if (!response.ok) {
            const message =
                result?.message ||
                result?.error ||
                result ||
                `Request failed (${response.status})`;

            throw new Error(
                typeof message === "string"
                    ? message
                    : `Request failed (${response.status})`,
            );
        }

        return result;
    }
    async function fetchDocumentBlob(url) {
        const headers = {};
        const token = getToken();

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Document download failed (${response.status})`);
        }

        return response.blob();
    }


    async function optional(path) {
        try {
            return await request(path);
        } catch (error) {
            console.warn(`Optional endpoint failed: ${path}`, error.message);

            return null;
        }
    }

    /* =====================================================
         LOAD DATA
      ===================================================== */

    async function load() {
        state.loading = true;

        state.user = storedUser();

        try {
            if (userId()) {
                const profileResult = await optional(
                    `${API.profile}/${encodeURIComponent(userId())}`,
                );

                if (profileResult) {
                    state.profile = {
                        ...(profileResult.data || profileResult),
                    };
                }
            }

            const results = await Promise.all([
                optional(API.applications),

                optional(API.documents),

                Promise.resolve([]),

                Promise.resolve([]),

                optional("/api/courses"),

                optional(API.overview),

                userId()
                    ? optional(`${API.sentMessages}/${encodeURIComponent(userId())}/sent`)
                    : Promise.resolve([]),
            ]);

            state.applications = arr(results[0]);

            state.documents = arr(results[1]);

            state.enquiries = arr(results[2]);

            state.notifications = arr(results[3]);

            state.courses = arr(results[4]);

            state.overview = results[5] ? results[5].data || results[5] : null;

            state.sentMessages = arr(results[6]);

            state.loading = false;

            state.loaded = true;

            updateChrome();

            render();
        } catch (error) {
            state.loading = false;

            console.error("Admissions dashboard loading failed:", error);

            pageContent.innerHTML = `
                <section class="panel">

                    <div class="empty-state">

                        <div class="empty-icon">!</div>

                        <h3>Could not load admissions portal</h3>

                        <p>
                            Check that your Spring Boot backend is running
                            at ${esc(API_BASE)}.
                        </p>

                        <button
                            class="btn btn-primary"
                            onclick="location.reload()"
                        >
                            Try again
                        </button>

                    </div>

                </section>
            `;
        }
    }

    /* =====================================================
         USER INFORMATION
      ===================================================== */

    function officerName() {
        return val(
            state.profile,
            ["fullName", "name"],
            val(state.user, ["fullName", "name", "username"], "Admissions Officer"),
        );
    }

    function updateChrome() {
        const name = officerName();

        const avatar = initials(name);

        if ($("#headerName")) {
            $("#headerName").textContent = name;
        }

        if ($("#headerAvatar")) {
            $("#headerAvatar").textContent = avatar;
        }

        const pendingApplicationsCount =
            state.overview?.pendingApplications ??
            pendingApplications().length;

        if ($("#pendingApplicationCount")) {
            $("#pendingApplicationCount").textContent =
                pendingApplicationsCount;
        }

        if ($("#pendingEnquiryCount")) {
            const pendingEnquiries = state.enquiries.filter(enquiry => {
                const status = String(enquiry.status || "PENDING").toUpperCase();
                return !["ANSWERED", "CLOSED", "RESOLVED"].includes(status);
            }).length;

            $("#pendingEnquiryCount").textContent = pendingEnquiries;
        }

        const unread = state.notifications.filter(
            (item) =>
                !item.read && String(item.status || "").toLowerCase() !== "read",
        ).length;

        $("#notificationDot")?.classList.toggle("hidden", unread === 0);

        $("#topNotificationDot")?.classList.toggle("hidden", unread === 0);
    }

    /* =====================================================
         NAVIGATION
      ===================================================== */

    function go(page) {
        state.page = page;

        $$(".nav-link").forEach((button) => {
            button.classList.toggle("active", button.dataset.page === page);
        });

        const titles = {
            overview: "Admissions overview",

            applications: "Application management",

            "application-review": "Application review",

            documents: "Document verification",

            decisions: "Admission decisions",

            enquiries: "Student enquiries",

            reports: "Admissions reports",

            notifications: "Notifications",

            profile: "My profile",

            communications: "Communication centre",
        };

        $("#pageTitle").textContent = titles[page] || "Admissions portal";

        $("#sidebar")?.classList.remove("open");

        $("#globalAlert")?.classList.add("hidden");

        render();

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    /* =====================================================
         RENDER
      ===================================================== */

    function render() {
        if (!pageContent) return;

        if (!state.loaded) {
            pageContent.innerHTML = `
                <div class="loading-state">
                    Loading admissions information...
                </div>
            `;

            return;
        }

        const pages = {
            overview,

            applications,

            "application-review": applicationReview,

            documents,

            decisions,

            enquiries,

            communications: communicationCentre,

            reports,

            notifications,

            profile,
        };

        pageContent.innerHTML = (pages[state.page] || overview)();
    }

    /* =====================================================
         STATISTICS
      ===================================================== */

    function stat(label, value, symbol, description) {
        return `
            <article class="stat-card">

                <div class="stat-top">

                    <p>${esc(label)}</p>

                    <span class="stat-icon">
                        ${symbol}
                    </span>

                </div>

                <strong>${esc(value)}</strong>

                <p>${esc(description)}</p>

            </article>
        `;
    }

    function applicationStatus(application) {
        return String(
            val(application, ["status", "applicationStatus"], "pending")
        )
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .trim();
    }

    function pendingApplications() {
        return state.applications.filter(item =>
            [
                "submitted",
                "pending",
                "under review",
                "processing"
            ].includes(applicationStatus(item))
        );
    }

    /* =====================================================
         OVERVIEW
      ===================================================== */
    function overview() {
        const data = state.overview || {};

        const total = data.totalApplications ?? state.applications.length;

        const pending = data.pendingApplications ?? pendingApplications().length;

        const approved =
            data.approvedApplications ??
            state.applications.filter(
                (item) => applicationStatus(item) === "approved",
            ).length;

        const rejected =
            data.rejectedApplications ??
            state.applications.filter(
                (item) => applicationStatus(item) === "rejected",
            ).length;

        const pendingDocs = data.pendingDocuments ?? 0;

        const latest = Array.isArray(data.recentApplications)
            ? data.recentApplications
            : [...state.applications]
                .sort(
                    (a, b) =>
                        new Date(val(b, ["submittedAt", "createdAt"], 0)) -
                        new Date(val(a, ["submittedAt", "createdAt"], 0)),
                )
                .slice(0, 5);

        return `

        <section class="welcome-banner">

            <div>

                <span class="welcome-tag">
                    ADMISSIONS MANAGEMENT
                </span>

                <h2>
                    Welcome back, ${esc(officerName().split(" ")[0])}.
                </h2>

                <p>
                    Manage applications, verify documents and
                    support prospective Auroria students.
                </p>

            </div>

        </section>

        <div class="grid stats-grid">

            ${stat("Total applications", total, "▤", "Applications received")}

            ${stat("Awaiting review", pending, "◷", "Require attention")}

            ${stat(
            "Approved applications",
            approved,
            "✓",
            "Admission approved",
        )}

            ${stat(
            "Rejected applications",
            rejected,
            "×",
            "Unsuccessful applications",
        )}

            ${stat(
            "Pending documents",
            pendingDocs,
            "▧",
            "Require verification",
        )}

        </div>

        <div class="grid dashboard-grid">

            <section class="panel">

                ${phead(
            "Recent applications",
            "Latest applications received by the university",
        )}

                ${latest.length
                ? `

                        <div class="table-wrap">

                            <table>

                                <thead>

                                    <tr>
                                        <th>Applicant</th>
                                        <th>Programme</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>

                                </thead>

                                <tbody>

                                    ${latest
                    .map(
                        (application) => `

                                        <tr>

                                            <td>
                                                <strong>
                                                    ${esc(applicantName(application))}
                                                </strong>
                                            </td>

                                            <td>
                                                ${esc(courseName(application))}
                                            </td>

                                            <td>
                                                ${date(
                            val(
                                application,
                                [
                                    "submittedAt",
                                    "createdAt",
                                ],
                                "",
                            ),
                        )}
                                            </td>

                                            <td>
                                                ${pill(applicationStatus(application))}
                                            </td>

                                            <td>
                                                <button
                                                    class="table-action"
                                                    data-action="review"
                                                    data-id="${esc(applicationId(application))}"
                                                >
                                                    Review
                                                </button>
                                            </td>

                                        </tr>

                                    `,
                    )
                    .join("")}

                                </tbody>

                            </table>

                        </div>

                    `
                : empty(
                    "No applications yet",
                    "New student applications will appear here.",
                )
            }

            </section>

            <section class="panel">

                ${phead("Quick actions", "Frequently used admissions tasks")}

                <div class="activity-item">

                    <span class="activity-marker">▤</span>

                    <div>
                        <strong>Review applications</strong>
                        <p>Open the application management area.</p>

                        <button
                            class="table-action"
                            data-page="applications"
                        >
                            Open applications →
                        </button>
                    </div>

                </div>

                <div class="activity-item">

    <span class="activity-marker">✉</span>

    <div>
        <strong>Communication centre</strong>
        <p>Send messages and admission updates to applicants.</p>

        <button class="table-action" data-page="communications">
            Open communication centre →
        </button>
    </div>

</div>

                <div class="activity-item">

                    <span class="activity-marker">▧</span>

                    <div>
                        <strong>Verify documents</strong>
                        <p>Review submitted applicant documents.</p>

                        <button
                            class="table-action"
                            data-page="documents"
                        >
                            Open documents →
                        </button>
                    </div>

                </div>

                <div class="activity-item">

                    <span class="activity-marker">✉</span>

                    <div>
                        <strong>Respond to enquiries</strong>
                        <p>Handle student questions and requests.</p>

                        <button
                            class="table-action"
                            data-page="enquiries"
                        >
                            Open enquiries →
                        </button>
                    </div>

                </div>

            </section>

        </div>

    `;
    }

    /* =====================================================
         APPLICATION HELPERS
      ===================================================== */

    function applicationId(application) {
        return val(application, ["applicationId", "id"], "");
    }

    function applicantName(application) {
        return val(
            application,
            ["applicantName", "fullName", "studentName", "name"],
            val(application?.applicant, ["fullName", "name"], "Unknown applicant"),
        );
    }

    function applicantEmail(application) {
        return val(
            application,
            ["email", "applicantEmail"],
            val(application?.applicant, ["email"], "Not provided"),
        );
    }

    function courseName(application) {
        return val(
            application,
            ["courseName", "courseTitle", "programName"],
            val(
                application?.course,
                ["name", "courseName", "title"],
                "Unknown programme",
            ),
        );
    }

    function reference(application) {
        return val(
            application,
            [
                "bookingCode",
                "referenceCode",
                "applicationReference",
                "referenceNumber",
                "applicationNumber",
            ],
            "Not assigned",
        );
    }

    function documentsForApplication(application) {
        // Prefer documents returned by the application review endpoint.
        if (Array.isArray(application?.documents) && application.documents.length > 0) {
            return application.documents;
        }

        // Fallback to the previously loaded documents.
        const appId = String(applicationId(application));
        const applicantId = String(applicationUserId(application));

        return state.documents.filter((document) => {
            const documentAppId = val(
                document,
                ["applicationId"],
                val(document.application, ["applicationId", "id"], ""),
            );

            const documentApplicantId = val(
                document,
                ["userId", "applicantUserId", "studentId"],
                val(document.user, ["userId", "id"], ""),
            );

            if (documentAppId) {
                return String(documentAppId) === appId;
            }

            return (
                applicantId &&
                documentApplicantId &&
                String(documentApplicantId) === applicantId
            );
        });
    }

    function documentVerification(application) {
        const documents = documentsForApplication(application);

        if (documents.length === 0) {
            return {
                allowed: false,
                reason: "No documents have been submitted.",
                documents: [],
            };
        }

        const rejected = documents.filter(
            (document) =>
                String(
                    val(document, ["status", "verificationStatus"], "PENDING"),
                ).toUpperCase() === "REJECTED",
        );

        if (rejected.length > 0) {
            return {
                allowed: false,
                reason: `${rejected.length} document(s) have been rejected.`,
                documents,
            };
        }

        const pending = documents.filter(
            (document) =>
                String(
                    val(document, ["status", "verificationStatus"], "PENDING"),
                ).toUpperCase() !== "VERIFIED",
        );

        if (pending.length > 0) {
            return {
                allowed: false,
                reason: `${pending.length} document(s) are still awaiting verification.`,
                documents,
            };
        }

        return {
            allowed: true,
            reason: "All submitted documents have been verified.",
            documents,
        };
    }

    function getApplicant(application) {
        const details =
            application?.applicantDetails ||
            application?.applicant ||
            {};

        return {
            ...details,

            dateOfBirth: val(
                details,
                ["dateOfBirth", "dob", "birthDate"],
                ""
            ),

            gender: val(
                details,
                ["gender"],
                ""
            ),

            nationality: val(
                details,
                ["nationality"],
                ""
            ),

            residentialAddress: val(
                details,
                ["residentialAddress", "address"],
                ""
            ),

            city: val(
                details,
                ["city"],
                ""
            ),

            stateOrRegion: val(
                details,
                ["stateOrRegion", "state", "stateOfOrigin"],
                ""
            ),

            country: val(
                details,
                ["country"],
                ""
            ),

            emergencyContactName: val(
                details,
                ["emergencyContactName", "emergencyName"],
                ""
            ),

            emergencyContactPhone: val(
                details,
                ["emergencyContactPhone", "emergencyPhone"],
                ""
            )
        };
    }

    /* =====================================================
         APPLICATION MANAGEMENT
      ===================================================== */

    function applications() {
        const list = state.applications.filter((application) => {
            const text = `

                ${applicantName(application)}

                ${applicantEmail(application)}

                ${courseName(application)}

                ${reference(application)}

            `.toLowerCase();

            const matchesSearch = text.includes(
                state.applicationSearch.toLowerCase(),
            );

            const matchesStatus =
                state.applicationStatus === "all" ||
                applicationStatus(application) === state.applicationStatus;

            return matchesSearch && matchesStatus;
        });

        return `

            ${heading(
            "Application management",
            "Review, search and manage student admission applications.",
        )}


            <section class="panel">

                ${phead(
            "All applications",
            `${list.length} applications displayed`,
        )}


                <div class="toolbar">

                    <div class="search-field">

                        <input
                            id="applicationSearch"
                            type="search"
                            placeholder="Search applicant, email, course or reference..."
                            value="${esc(state.applicationSearch)}"
                        >

                    </div>


                    <div class="filter-field">

                        <select id="applicationStatus">

                            <option value="all">
                                All statuses
                            </option>

                            <option value="pending"
                                ${state.applicationStatus === "pending" ? "selected" : ""}>
                                Pending
                            </option>

                            <option value="under review"
                                ${state.applicationStatus === "under review" ? "selected" : ""}>
                                Under review
                            </option>

                            <option value="approved"
                                ${state.applicationStatus === "approved" ? "selected" : ""}>
                                Approved
                            </option>

                            <option value="rejected"
                                ${state.applicationStatus === "rejected" ? "selected" : ""}>
                                Rejected
                            </option>

                        </select>

                    </div>

                </div>


                ${list.length
                ? `

                        <div class="table-wrap">

                            <table>

                                <thead>

                                    <tr>
                                        <th>Applicant</th>
                                        <th>Email</th>
                                        <th>Programme</th>
                                        <th>Reference</th>
                                        <th>Date submitted</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>

                                </thead>


                                <tbody>

                                    ${list
                    .map(
                        (application) => `

                                        <tr>

                                            <td>
                                                <strong>
                                                    ${esc(applicantName(application))}
                                                </strong>
                                            </td>

                                            <td>
                                                ${esc(applicantEmail(application))}
                                            </td>

                                            <td>
                                                ${esc(courseName(application))}
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
                                    "createdAt",
                                ],
                                "",
                            ),
                        )}
                                            </td>

                                            <td>
    ${pill(applicationStatus(application))}
</td>
                                            <td>

                                                <button
                                                    class="table-action"
                                                    data-action="review"
                                                    data-id="${esc(applicationId(application))}"
                                                >
                                                    Review
                                                </button>

                                            </td>

                                        </tr>

                                    `,
                    )
                    .join("")}

                                </tbody>

                            </table>

                        </div>

                    `
                : empty(
                    "No applications found",
                    "Try changing your search or filter.",
                )
            }

            </section>

        `;
    }

    /* =====================================================
         APPLICATION REVIEW
      ===================================================== */

    async function reviewApplication(id) {
        const application = state.applications.find(
            item => String(applicationId(item)) === String(id)
        );

        if (!application) {
            toast("Application not found.", "error");
            return;
        }

        try {
            toast("Loading complete application details...");

            const results = await Promise.allSettled([
                request(
                    `${API.applications}/${encodeURIComponent(id)}/review`
                ),

                request(
                    `/api/applications/${encodeURIComponent(id)}/applicant-details`
                ),

                request(
                    `/api/applications/${encodeURIComponent(id)}/academic-records`
                )
            ]);

            if (results[0].status === "rejected") {
                throw results[0].reason;
            }

            const unwrap = result =>
                result?.data !== undefined ? result.data : result;

            const review = unwrap(results[0].value) || {};

            const applicantDetails =
                results[1].status === "fulfilled"
                    ? unwrap(results[1].value)
                    : null;

            const academicRecords =
                results[2].status === "fulfilled"
                    ? arr(unwrap(results[2].value))
                    : [];

            state.selectedApplication = {
                ...application,
                ...review,

                applicantDetails:
                    applicantDetails || review.applicantDetails || {},

                academicRecords:
                    academicRecords.length
                        ? academicRecords
                        : arr(review.academicRecords)
            };

            if (results[1].status === "rejected") {
                console.warn(
                    "Applicant details endpoint failed:",
                    results[1].reason
                );
            }

            if (results[2].status === "rejected") {
                console.warn(
                    "Academic records endpoint failed:",
                    results[2].reason
                );
            }

            go("application-review");

        } catch (error) {
            console.error("Failed to load application review:", error);

            toast(
                error.message || "Could not load application details.",
                "error"
            );
        }
    }
    function applicationReview() {
        const application = state.selectedApplication;

        if (!application) {
            return `
            <section class="panel">
                <h3>No application selected</h3>
                <p>Please return to application management and select an application.</p>
                <button class="btn btn-primary"
                    data-action="back-applications">
                    Back to applications
                </button>
            </section>
        `;
        }

        const applicant = getApplicant(application);
        console.log("SELECTED APPLICATION:", application);
        console.log("APPLICANT OBJECT:", applicant);
        console.log("ALL LOADED DOCUMENTS:", state.documents);
        console.log(
            "DOCUMENTS FOR THIS APPLICATION:",
            documentsForApplication(application),
        );
        const verification = documentVerification(application);

        const id = applicationId(application);

        const currentStatus = applicationStatus(application)
            .toUpperCase()
            .replace(/[\s-]+/g, "_");

        const isFinalDecision = ["APPROVED", "REJECTED"].includes(currentStatus);

        const documentRows = verification.documents.length
            ? verification.documents.map((document) => {
                const documentId = val(document, ["documentId", "id"], "");
                const fileName = val(
                    document,
                    ["documentName", "fileName", "name"],
                    "Applicant document"
                );
                const docStatus = String(
                    val(document, ["status", "verificationStatus"], "PENDING")
                ).toUpperCase();

                return `
            <div class="document-row">
                <div class="document-main">
                    <div class="document-icon">▧</div>
                    <div>
                        <strong>${esc(fileName)}</strong>
                        <p>${esc(title(val(
                    document,
                    ["documentType", "type"],
                    "Supporting document"
                )))}</p>
                    </div>
                </div>

                <div class="document-actions">
                    ${pill(docStatus)}

                    <button class="btn btn-secondary btn-small"
                        data-action="preview-review-document"
                        data-id="${esc(documentId)}">
                        Preview
                    </button>

                    <button class="btn btn-success btn-small"
                        data-action="verify-document"
                        data-id="${esc(documentId)}"
                        ${docStatus === "VERIFIED" ? "disabled" : ""}>
                        Verify
                    </button>

                    <button class="btn btn-danger btn-small"
                        data-action="reject-document"
                        data-id="${esc(documentId)}"
                        ${docStatus === "REJECTED" ? "disabled" : ""}>
                        Reject
                    </button>
                </div>
            </div>
        `;
            }).join("")
            : empty(
                "No documents submitted",
                "This applicant has not submitted any documents."
            );
        return `
        <div class="application-review-page">

            <div class="review-topbar">
                <button class="btn btn-secondary"
                    data-action="back-applications">
                    ← Back to applications
                </button>

                <span class="review-reference">
                    ${esc(reference(application))}
                </span>
            </div>

            <section class="review-hero">
                <div>
                    <span class="eyebrow">ADMISSIONS WORKSPACE</span>

                    <h2>${esc(applicantName(application))}</h2>

                    <p>
                        Review applicant information, verify documents
                        and make an admission decision.
                    </p>
                </div>

                <div class="review-hero-status">
                    <small>Current application status</small>
                    ${pill(currentStatus)}
                </div>
            </section>

            <div class="review-layout">

                <main class="review-main">

                    <section class="panel review-card">
                        <div class="review-card-heading">
                            <div>
                                <span class="eyebrow">01 / APPLICATION</span>
                                <h3>Application information</h3>
                            </div>
                        </div>

                        <div class="info-grid">
                            <div class="info-item">
                                <small>Applicant name</small>
                                <strong>${esc(applicantName(application))}</strong>
                            </div>

                            <div class="info-item">
                                <small>Email address</small>
                                <strong>${esc(applicantEmail(application))}</strong>
                            </div>

                            <div class="info-item">
                                <small>Programme</small>
                                <strong>${esc(courseName(application))}</strong>
                            </div>

                            <div class="info-item">
                                <small>Application reference</small>
                                <strong>${esc(reference(application))}</strong>
                            </div>

                            <div class="info-item">
                                <small>Date submitted</small>
                                <strong>${date(
            val(
                application,
                ["submittedAt", "createdAt"],
                "",
            ),
        )}</strong>
                            </div>

                            <div class="info-item">
                                <small>Intake</small>
                                <strong>${esc(
            val(application, ["intake"], "Not specified"),
        )}</strong>
                            </div>
                        </div>
                    </section>

                    <section class="panel review-card">

    <div class="review-card-heading">
        <div>
            <span class="eyebrow">02 / APPLICANT</span>
            <h3>Personal information</h3>
            <p>Information submitted by the applicant in this application.</p>
        </div>
    </div>

    <div class="info-grid">

        <div class="info-item">
            <small>Full name</small>
            <strong>${esc(applicantName(application))}</strong>
        </div>

        <div class="info-item">
            <small>Email address</small>
            <strong>${esc(applicantEmail(application))}</strong>
        </div>

        <div class="info-item">
            <small>Date of birth</small>
            <strong>${date(applicant.dateOfBirth)}</strong>
        </div>

        <div class="info-item">
            <small>Gender</small>
            <strong>${esc(val(applicant, ["gender"], "Not provided"))}</strong>
        </div>

        <div class="info-item">
            <small>Nationality</small>
            <strong>${esc(val(applicant, ["nationality"], "Not provided"))}</strong>
        </div>

        <div class="info-item">
            <small>Residential address</small>
            <strong>${esc(val(applicant, ["residentialAddress"], "Not provided"))}</strong>
        </div>

        <div class="info-item">
            <small>City</small>
            <strong>${esc(val(applicant, ["city"], "Not provided"))}</strong>
        </div>

        <div class="info-item">
            <small>State / Region</small>
            <strong>${esc(val(applicant, ["stateOrRegion"], "Not provided"))}</strong>
        </div>

        <div class="info-item">
            <small>Country</small>
            <strong>${esc(val(applicant, ["country"], "Not provided"))}</strong>
        </div>

        <div class="info-item">
            <small>Emergency contact name</small>
            <strong>${esc(val(applicant, ["emergencyContactName"], "Not provided"))}</strong>
        </div>

        <div class="info-item">
            <small>Emergency contact phone</small>
            <strong>${esc(val(applicant, ["emergencyContactPhone"], "Not provided"))}</strong>
        </div>

    </div>

</section>
<section class="panel review-card">

    <div class="review-card-heading">
        <div>
            <span class="eyebrow">03 / ACADEMICS</span>
            <h3>Academic qualifications</h3>
            <p>Educational history submitted with this application.</p>
        </div>
    </div>

    ${Array.isArray(application.academicRecords) &&
                application.academicRecords.length
                ? application.academicRecords
                    .map(
                        (record, index) => `

            <div class="academic-record-card">

                <h4>Qualification ${index + 1}</h4>

                <div class="info-grid">

                    <div class="info-item">
                        <small>Institution</small>
                        <strong>
                            ${esc(val(record, ["institutionName"], "Not provided"))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Qualification</small>
                        <strong>
                            ${esc(val(record, ["qualificationName"], "Not provided"))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Examination body</small>
                        <strong>
                            ${esc(val(record, ["examinationBody"], "Not provided"))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Examination number</small>
                        <strong>
                            ${esc(val(record, ["examinationNumber"], "Not provided"))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Examination year</small>
                        <strong>
                            ${esc(val(record, ["examinationYear"], "Not provided"))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Verification status</small>
                        ${pill(val(record, ["verificationStatus"], "Pending"))}
                    </div>

                </div>

            </div>

        `,
                    )
                    .join("")
                : empty(
                    "No academic records found",
                    "No academic qualifications were returned for this application.",
                )
            }

</section>

                    <section class="panel review-card">
                        <div class="review-card-heading">
                            <div>
                                <span class="eyebrow">03 / DOCUMENTS</span>
                                <h3>Document verification</h3>
                                <p>Check the applicant's submitted documents.</p>
                            </div>

                           
                        </div>

                        <div class="verification-banner ${verification.allowed
                ? "verification-approved"
                : "verification-warning"
            }">

                            <strong>
                                ${verification.allowed
                ? "✓ Documents verified"
                : "⚠ Approval unavailable"
            }
                            </strong>

                            <p>${esc(verification.reason)}</p>
                        </div>

                        <div class="review-document-list">
                            ${documentRows}
                        </div>
                        <div id="reviewDocumentPreview" class="review-document-preview hidden"></div>
                    </section>

                    <section class="panel review-card">
                        <div class="review-card-heading">
                            <div>
                                <span class="eyebrow">04 / OFFICER NOTES</span>
                                <h3>Admissions review notes</h3>
                                <p>Record your observations about this application.</p>
                            </div>
                        </div>

                        <div class="field">
                            <label for="reviewNotes">Review notes</label>

                            <textarea
                                id="reviewNotes"
                                placeholder="Enter your review notes..."
                            >${esc(
                val(
                    application,
                    ["reviewNotes", "officerNotes"],
                    "",
                ),
            )}</textarea>
                        </div>
                    </section>

                </main>

                <aside class="review-sidebar">

                    <section class="panel review-decision-card">
                        <span class="eyebrow">FINAL STEP</span>

                        <h3>Admission decision</h3>

                        <p class="review-decision-description">
                            Update the application status after reviewing
                            the applicant's information and documents.
                        </p>

                        <div class="review-decision-status">
                            <small>Current status</small>
                            ${pill(currentStatus)}
                        </div>

                        <div class="review-decision-actions">

                            <button
                                class="btn btn-primary"
                                data-action="start-review"
                                data-id="${esc(id)}"
                               ${isFinalDecision || currentStatus === "UNDER_REVIEW" ? "disabled" : ""}
                            >
                                Mark under review
                            </button>

                            <button
                                class="btn btn-success"
                                data-action="approve"
                                data-id="${esc(id)}"
                                ${isFinalDecision || !verification.allowed ? "disabled" : ""}
                                title="${esc(verification.reason)}"
                            >
                                ✓ Approve application
                            </button>

                            <button
                                class="btn btn-danger"
                                data-action="reject"
                                data-id="${esc(id)}"
                                ${isFinalDecision ? "disabled" : ""}
                            >
                                Reject application
                            </button>

                        </div>

                        ${!verification.allowed
                ? `
                            <div class="decision-hint">
                                Approval is disabled until the required
                                document verification is complete.
                            </div>
                        `
                : ""
            }
                    </section>

                </aside>

            </div>
        </div>
    `;
    }

    /* =====================================================
         APPLICATION DECISIONS
      ===================================================== */


    async function updateApplicationStatus(id, status) {
        const listApplication = state.applications.find(
            item => String(applicationId(item)) === String(id)
        );

        const reviewApplication =
            state.selectedApplication &&
                String(applicationId(state.selectedApplication)) === String(id)
                ? state.selectedApplication
                : null;

        if (!listApplication && !reviewApplication) {
            toast("Application not found.", "error");
            return;
        }

        const application = {
            ...(listApplication || {}),
            ...(reviewApplication || {})
        };

        const currentStatus = applicationStatus(application)
            .toUpperCase()
            .replace(/[\s-]+/g, "_");

        if (["APPROVED", "REJECTED"].includes(currentStatus)) {
            toast("This application already has a final decision.", "error");
            return;
        }

        if (!["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status)) {
            toast("Invalid application status.", "error");
            return;
        }

        const notes = $("#reviewNotes")?.value.trim() || "";

        if (status === "REJECTED" && !notes) {
            toast("Please provide a rejection reason in the review notes.", "error");
            return;
        }

        if (status === "APPROVED") {
            const verification = documentVerification(application);

            if (!verification.allowed) {
                toast(`Cannot approve: ${verification.reason}`, "error");
                return;
            }
        }

        const recipientId = applicationUserId(application);
        const senderId = userId();

        if (status !== "UNDER_REVIEW" && (!senderId || !recipientId)) {
            toast("Could not identify the applicant or admissions officer.", "error");
            return;
        }

        if (
            !confirm(
                `Are you sure you want to mark this application as ${title(status)}?`
            )
        ) {
            return;
        }

        try {
            // Save the application decision first.
            await request(
                `${API.applications}/${encodeURIComponent(id)}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status,
                        reviewNotes: notes
                    })
                }
            );

            // Under-review status does not require a decision message.
            if (status === "UNDER_REVIEW") {
                toast("Application marked as under review.", "success");

                await load();
                go("applications");
                return;
            }

            const approved = status === "APPROVED";

            const messageType = approved ? "ACCEPTANCE" : "REJECTION";

            const subject = approved
                ? "Official Admission Offer – Auroria University"
                : "Application Decision – Auroria University";

            const applicant = applicantName(application);
            const programme = courseName(application);
            const referenceCode = reference(application);

            const body = approved
                ? `Dear ${applicant},

Congratulations!

We are pleased to inform you that your application to Auroria University has been APPROVED.

Application Reference: ${referenceCode}
Programme: ${programme}

Your application has successfully passed the admissions review process.

Please log in to your student dashboard to review your admission information and any further instructions from the university.

We congratulate you on this achievement and look forward to welcoming you to Auroria University.

Kind regards,
Admissions Office
Auroria University`
                : `Dear ${applicant},

Thank you for applying to Auroria University.

After careful consideration of your application, we regret to inform you that your application has been UNSUCCESSFUL.

Application Reference: ${referenceCode}
Programme: ${programme}

Reason provided by the Admissions Office:
${notes}

Thank you for considering Auroria University.

Kind regards,
Admissions Office
Auroria University`;

            // The status is already saved. Handle message failure separately
            // so the officer is not misled into repeating the decision.
            try {
                await request(API.messages, {
                    method: "POST",
                    body: JSON.stringify({
                        senderId: Number(senderId),
                        recipientId: Number(recipientId),
                        applicationId: Number(id),
                        messageType,
                        subject,
                        body
                    })
                });

                toast(
                    approved
                        ? "Application approved and applicant message sent."
                        : "Application rejected and applicant message sent.",
                    "success"
                );

            } catch (messageError) {
                console.error(
                    "Decision saved, but applicant message failed:",
                    messageError
                );

                toast(
                    `Decision saved successfully, but the message could not be sent: ${messageError.message}`,
                    "error"
                );
            }

            await load();
            go("applications");

        } catch (error) {
            console.error("Application status update failed:", error);

            toast(
                `Could not update application status: ${error.message}`,
                "error"
            );
        }
    }


    /* =====================================================
     DOCUMENT VERIFICATION
    ===================================================== */

    async function verifyDocument(id, status = "VERIFIED") {
        const documentId = String(id);
        const nextStatus = String(status).toUpperCase();

        if (!["VERIFIED", "REJECTED"].includes(nextStatus)) {
            toast("Invalid document status.", "error");
            return;
        }

        const document = state.documents.find(
            item => String(val(item, ["documentId", "id"], "")) === documentId
        );

        if (!document) {
            toast("Document not found. Refresh the page and try again.", "error");
            return;
        }

        let verificationNotes = "";

        if (nextStatus === "REJECTED") {
            verificationNotes = prompt(
                "Enter the reason for rejecting this document:"
            );

            if (verificationNotes === null) return;

            verificationNotes = verificationNotes.trim();

            if (!verificationNotes) {
                toast("A rejection reason is required.", "error");
                return;
            }
        }

        try {
            await request(`${API.documents}/${id}/verify`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: status,
                    verificationNotes: ""
                })
            });

            toast(
                nextStatus === "VERIFIED"
                    ? "Document verified successfully."
                    : "Document rejected successfully.",
                "success"
            );

            await load();

            if (state.selectedApplication) {
                await reviewApplication(
                    applicationId(state.selectedApplication)
                );
            } else {
                go("documents");
            }
        } catch (error) {
            console.error("Document verification failed:", error);
            toast(`Could not update document: ${error.message}`, "error");
        }
    }

    function viewDocument(id) {
        previewReviewDocument(id);
    }

    async function previewReviewDocument(id) {
        const documentId = String(id);

        const document =
            state.documents.find(
                item => String(val(item, ["documentId", "id"], "")) === documentId
            ) ||
            documentsForApplication(state.selectedApplication).find(
                item => String(val(item, ["documentId", "id"], "")) === documentId
            );

        if (!document) {
            toast("Document not found.", "error");
            return;
        }

        try {
            let fileUrl = val(
                document,
                ["fileUrl", "downloadUrl"],
                `${API.documents}/${encodeURIComponent(documentId)}/file`
            );

            // The backend returns paths such as /api/admissions/documents/3/file.
            // Convert relative paths into complete URLs before fetching.
            if (!/^https?:\/\//i.test(fileUrl)) {
                fileUrl = `${API_BASE}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
            }

            const blob = await fetchDocumentBlob(fileUrl);

            if (activeDocumentObjectUrl) {
                URL.revokeObjectURL(activeDocumentObjectUrl);
                activeDocumentObjectUrl = null;
            }

            activeDocumentObjectUrl = URL.createObjectURL(blob);

            const preview =
                $("#reviewDocumentPreview") ||
                $("#documentPagePreview");

            if (!preview) {
                toast("Document preview container was not found in the page.", "error");
                return;
            }

            const fileName = val(
                document,
                ["fileName", "documentName", "name"],
                "Applicant document"
            );

            const safeFileName = esc(fileName);
            const mimeType = String(
                val(document, ["mimeType"], blob.type || "")
            ).toLowerCase();

            let content;

            if (mimeType.startsWith("image/")) {
                content = `
                    <img
                        src="${activeDocumentObjectUrl}"
                        alt="${safeFileName}"
                        style="display:block;max-width:100%;max-height:70vh;margin:auto;object-fit:contain;"
                    >
                `;
            } else if (
                mimeType.includes("pdf") ||
                /\.pdf$/i.test(fileName)
            ) {
                content = `
                    <iframe
                        src="${activeDocumentObjectUrl}"
                        title="${safeFileName}"
                        style="width:100%;height:70vh;border:0;"
                    ></iframe>
                `;
            } else {
                content = `
                    <p>This file type cannot be previewed in the browser.</p>
                `;
            }

            preview.innerHTML = `
                <div class="document-preview-content">
                    <div class="document-preview-header">
                        <strong>${safeFileName}</strong>

                        <button
                            type="button"
                            class="btn btn-secondary btn-small"
                            data-action="close-document-preview">
                            Close preview
                        </button>
                    </div>

                    <div class="document-preview-body">
                        ${content}
                    </div>

                    <a
                        href="${activeDocumentObjectUrl}"
                        download="${safeFileName}">
                        Download original document
                    </a>
                </div>
            `;

            preview.classList.remove("hidden");
        } catch (error) {
            console.error("Document preview failed:", error);
            toast(`Could not open document: ${error.message}`, "error");
        }
    }

    /* =====================================================
         DECISIONS
      ===================================================== */

    function decisions() {
        const approved = state.applications.filter(
            (item) => applicationStatus(item) === "approved",
        );

        const rejected = state.applications.filter(
            (item) => applicationStatus(item) === "rejected",
        );

        const pending = pendingApplications();

        return `

            ${heading(
            "Admission decisions",
            "Review final decisions and monitor application outcomes.",
        )}


            <div class="grid stats-grid">

                ${stat(
            "Approved",
            approved.length,
            "✓",
            "Successful applications",
        )}

                ${stat(
            "Rejected",
            rejected.length,
            "×",
            "Unsuccessful applications",
        )}

                ${stat(
            "Awaiting decision",
            pending.length,
            "◷",
            "Still under review",
        )}

                ${stat(
            "Total processed",
            approved.length + rejected.length,
            "▤",
            "Final decisions",
        )}

            </div>


            <section class="panel">

                ${phead(
            "Decision records",
            "All applications and their current outcomes",
        )}


                <div class="table-wrap">

                    <table>

                        <thead>

                            <tr>
                                <th>Applicant</th>
                                <th>Programme</th>
                                <th>Reference</th>
                                <th>Decision</th>
                                <th>Date submitted</th>
                                <th>Action</th>
                            </tr>

                        </thead>


                        <tbody>

                            ${state.applications.length
                ? state.applications
                    .map(
                        (application) => `

                                    <tr>

                                        <td>
                                            <strong>
                                                ${esc(applicantName(application))}
                                            </strong>
                                        </td>

                                        <td>
                                            ${esc(courseName(application))}
                                        </td>

                                        <td>
                                            ${esc(reference(application))}
                                        </td>

                                        <td>
                                            ${pill(applicationStatus(application))}
                                        </td>

                                        <td>
                                            ${date(
                            val(
                                application,
                                ["submittedAt", "createdAt"],
                                "",
                            ),
                        )}
                                        </td>

                                        <td>

                                            <button
                                                class="table-action"
                                                data-action="review"
                                                data-id="${esc(applicationId(application))}"
                                            >
                                                Review
                                            </button>

                                        </td>

                                    </tr>

                                `,
                    )
                    .join("")
                : `
                                    <tr>
                                        <td colspan="6">
                                            ${empty(
                    "No decision records",
                    "Application decisions will appear here.",
                )}
                                        </td>
                                    </tr>
                                `
            }

                        </tbody>

                    </table>

                </div>

            </section>

        `;
    }


    /* =====================================================
       DOCUMENT MANAGEMENT
    ===================================================== */

    function documents() {
        const list = state.documents.filter(document => {
            const status = String(
                val(document, ["status", "verificationStatus"], "PENDING")
            ).toLowerCase();

            return state.documentStatus === "all" ||
                status === state.documentStatus.toLowerCase();
        });

        return `
        ${heading(
            "Document verification",
            "Review and verify documents submitted by applicants."
        )}

        <section class="panel">
            ${phead(
            "Submitted documents",
            `${list.length} documents displayed`
        )}

            <div class="toolbar">
                <div class="filter-field">
                    <select id="documentStatus">
                        <option value="all">All documents</option>
                        <option value="PENDING"
                            ${state.documentStatus === "PENDING" ? "selected" : ""}>
                            Pending
                        </option>
                        <option value="VERIFIED"
                            ${state.documentStatus === "VERIFIED" ? "selected" : ""}>
                            Verified
                        </option>
                        <option value="REJECTED"
                            ${state.documentStatus === "REJECTED" ? "selected" : ""}>
                            Rejected
                        </option>
                    </select>
                </div>
            </div>

            ${list.length ? `
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Applicant</th>
                                <th>Document</th>
                                <th>Document type</th>
                                <th>Uploaded</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${list.map(document => {
            const id = val(document, ["documentId", "id"], "");
            const status = String(
                val(document, ["status", "verificationStatus"], "PENDING")
            ).toUpperCase();

            return `
                                    <tr>
                                        <td>
                                            <strong>${esc(
                val(document, ["applicantName", "studentName"], "Applicant")
            )}</strong>
                                        </td>

                                        <td>${esc(
                val(document, ["fileName", "documentName"], "Document")
            )}</td>

                                        <td>${esc(title(
                val(document, ["documentType", "type"], "Supporting document")
            ))}</td>

                                        <td>${date(
                val(document, ["uploadedAt", "createdAt"], "")
            )}</td>

                                        <td>${pill(status)}</td>

                                        <td>
                                            <button class="table-action"
                                                data-action="preview-document"
                                                data-id="${esc(id)}">
                                                Preview
                                            </button>

                                            <button class="table-action"
                                                data-action="verify-document"
                                                data-id="${esc(id)}"
                                                ${status === "VERIFIED" ? "disabled" : ""}>
                                                Verify
                                            </button>

                                            <button class="table-action"
                                                data-action="reject-document"
                                                data-id="${esc(id)}"
                                                ${status === "REJECTED" ? "disabled" : ""}>
                                                Reject
                                            </button>
                                        </td>
                                    </tr>
                                `;
        }).join("")}
                        </tbody>
                    </table>
                </div>
            ` : empty(
            "No documents found",
            "Documents matching this filter will appear here."
        )}

            <div id="documentPagePreview" class="review-document-preview hidden"></div>
        </section>
    `;
    }


    /* =====================================================
         ENQUIRIES
      ===================================================== */

    function enquiries() {
        const list = state.enquiries.filter((enquiry) => {
            const status = String(val(enquiry, ["status"], "pending")).toLowerCase();

            return state.enquiryStatus === "all" || status === state.enquiryStatus;
        });

        return `

            ${heading(
            "Student enquiries",
            "Respond to questions and requests from prospective and current students.",
        )}


            <section class="panel">

                ${phead("Enquiry inbox", `${list.length} enquiries displayed`)}


                <div class="toolbar">

                    <div class="filter-field">

                        <select id="enquiryStatus">

                            <option value="all">
                                All enquiries
                            </option>

                            <option value="pending">
                                Pending
                            </option>

                            <option value="answered">
                                Answered
                            </option>

                            <option value="closed">
                                Closed
                            </option>

                        </select>

                    </div>

                </div>


                ${list.length
                ? list
                    .map(
                        (enquiry) => `

                        <div class="activity-item">

                            <span class="activity-marker">
                                ✉
                            </span>

                            <div style="flex:1">

                                <strong>
                                    ${esc(
                            val(
                                enquiry,
                                ["subject", "title"],
                                "Student enquiry",
                            ),
                        )}
                                </strong>

                                <p>
                                    From:
                                    ${esc(
                            val(
                                enquiry,
                                ["studentName", "applicantName"],
                                "Unknown student",
                            ),
                        )}
                                </p>

                                <p>
                                    ${esc(
                            val(
                                enquiry,
                                ["message", "description"],
                                "",
                            ),
                        )}
                                </p>

                                <p>
                                    ${date(
                            val(
                                enquiry,
                                ["createdAt", "submittedAt"],
                                "",
                            ),
                        )}
                                </p>

                                <div style="margin-top:10px">

                                    ${pill(val(enquiry, ["status"], "Pending"))}

                                    <button
                                        class="btn btn-secondary btn-small"
                                        data-action="reply-enquiry"
                                        data-id="${esc(val(enquiry, ["enquiryId", "id"], ""))}"
                                    >
                                        Open enquiry
                                    </button>

                                </div>

                            </div>

                        </div>

                    `,
                    )
                    .join("")
                : empty(
                    "No enquiries found",
                    "Student enquiries will appear here.",
                )
            }

            </section>

        `;
    }

    function replyEnquiry(id) {
        const enquiry = state.enquiries.find(
            (item) => String(val(item, ["enquiryId", "id"], "")) === String(id),
        );

        if (!enquiry) {
            toast("Enquiry not found.", "error");

            return;
        }

        dialogContent.innerHTML = `

            <span class="eyebrow">
                STUDENT SUPPORT
            </span>

            <h2 style="margin-top:10px">
                ${esc(val(enquiry, ["subject", "title"], "Student enquiry"))}
            </h2>


            <div class="review-section">

                <div class="info-grid">

                    <div class="info-item">
                        <small>Student</small>
                        <strong>
                            ${esc(
            val(
                enquiry,
                ["studentName", "applicantName"],
                "Unknown student",
            ),
        )}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Status</small>
                        ${pill(val(enquiry, ["status"], "Pending"))}
                    </div>

                </div>

                <div class="field" style="margin-top:15px">

                    <label>Original message</label>

                    <textarea readonly>${esc(
            val(enquiry, ["message", "description"], ""),
        )}</textarea>

                </div>


                <div class="field">

                    <label for="enquiryReply">
                        Your response
                    </label>

                    <textarea
                        id="enquiryReply"
                        placeholder="Write your response..."
                    >${esc(val(enquiry, ["response", "reply"], ""))}</textarea>

                </div>

            </div>


            <div class="detail-actions">

                <button
                    class="btn btn-primary"
                    data-action="send-enquiry-reply"
                    data-id="${esc(id)}"
                >
                    Send response
                </button>

                <button
                    class="btn btn-secondary"
                    data-action="close-enquiry"
                    data-id="${esc(id)}"
                >
                    Close enquiry
                </button>

            </div>

        `;

        $("#dialogTitle").textContent = "Enquiry details";

        if (!dialog.open) {
            dialog.showModal();
        }
    }

    async function sendEnquiryReply(id) {
        const response = $("#enquiryReply")?.value.trim() || "";

        if (response.length < 2) {
            toast("Please enter a response.", "error");

            return;
        }

        try {
            await request(`${API.enquiries}/${encodeURIComponent(id)}/reply`, {
                method: "POST",

                body: JSON.stringify({
                    response,
                }),
            });

            toast("Response sent successfully.", "success");

            dialog.close();

            await load();

            go("enquiries");
        } catch (error) {
            toast(`Could not send response: ${error.message}`, "error");
        }
    }

    async function closeEnquiry(id) {
        try {
            await request(`${API.enquiries}/${encodeURIComponent(id)}/close`, {
                method: "PATCH",
            });

            toast("Enquiry closed.", "success");

            dialog.close();

            await load();

            go("enquiries");
        } catch (error) {
            toast(`Could not close enquiry: ${error.message}`, "error");
        }
    }

    /* =====================================================
         REPORTS
      ===================================================== */

    function reports() {
        const total = state.applications.length;

        const count = (status) =>
            state.applications.filter((item) => applicationStatus(item) === status)
                .length;

        const approved = count("approved");

        const rejected = count("rejected");

        const pending = pendingApplications().length;

        const percentage = (value) =>
            total ? Math.round((value / total) * 100) : 0;

        return `

            ${heading(
            "Admissions reports",
            "Review application statistics and admissions performance.",
        )}


            <div class="grid stats-grid">

                ${stat(
            "Total applications",
            total,
            "▤",
            "All received applications",
        )}

                ${stat(
            "Approval rate",
            `${percentage(approved)}%`,
            "✓",
            "Approved applications",
        )}

                ${stat(
            "Rejection rate",
            `${percentage(rejected)}%`,
            "×",
            "Rejected applications",
        )}

                ${stat(
            "Pending rate",
            `${percentage(pending)}%`,
            "◷",
            "Applications awaiting review",
        )}

            </div>


            <div class="grid report-grid">

                <section class="panel">

                    ${phead(
            "Application outcomes",
            "Distribution of application statuses",
        )}


                    ${reportBar("Approved", approved, total)}

                    ${reportBar("Rejected", rejected, total)}

                    ${reportBar("Pending / under review", pending, total)}

                </section>


                <section class="panel">

                    ${phead(
            "Document verification",
            "Document verification progress",
        )}


                    ${reportBar(
            "Verified",
            state.documents.filter(
                (item) =>
                    String(
                        val(item, ["status", "verificationStatus"], ""),
                    ).toLowerCase() === "verified",
            ).length,
            state.documents.length,
        )}


                    ${reportBar(
            "Rejected",
            state.documents.filter(
                (item) =>
                    String(
                        val(item, ["status", "verificationStatus"], ""),
                    ).toLowerCase() === "rejected",
            ).length,
            state.documents.length,
        )}


                    ${reportBar(
            "Pending",
            state.documents.filter(
                (item) =>
                    String(
                        val(
                            item,
                            ["status", "verificationStatus"],
                            "pending",
                        ),
                    ).toLowerCase() === "pending",
            ).length,
            state.documents.length,
        )}

                </section>

            </div>


            <section class="panel" style="margin-top:20px">

                ${phead(
            "Export application report",
            "Download the currently loaded application records as CSV.",
        )}

                <button
                    class="btn btn-primary"
                    data-action="export-report"
                >
                    ↓ Export CSV
                </button>

            </section>

        `;
    }

    function reportBar(label, value, total) {
        const percent = total ? Math.round((value / total) * 100) : 0;

        return `

            <div class="report-item">

                <div class="report-item-top">

                    <strong>${esc(label)}</strong>

                    <span>
                        ${value} (${percent}%)
                    </span>

                </div>

                <div class="report-bar">

                    <span style="width:${percent}%"></span>

                </div>

            </div>

        `;
    }

    /* =====================================================
       COMMUNICATION CENTRE
    ===================================================== */

    function applicationUserId(application) {
        return val(
            application,
            ["userId", "applicantUserId", "recipientId"],
            val(
                application?.applicantDetails,
                ["userId", "applicantUserId"],
                val(
                    application?.applicant,
                    ["userId", "id"],
                    val(application?.user, ["userId", "id"], "")
                )
            )
        );
    }

    function uniqueApplicants() {
        const applicants = new Map();

        state.applications.forEach(application => {
            const id = applicationUserId(application);

            if (!id) return;

            if (!applicants.has(String(id))) {
                applicants.set(String(id), {
                    id,
                    name: applicantName(application),
                    email: applicantEmail(application)
                });
            }
        });

        return [...applicants.values()];
    }

    function communicationCentre() {
        const applicants = uniqueApplicants();
        const messages = state.sentMessages || [];

        return `
        ${heading(
            "Communication centre",
            "Send official university messages directly to applicants."
        )}

        <div class="grid dashboard-grid">

            <section class="panel">
                ${phead(
            "Compose a message",
            "Messages will appear in the applicant's student dashboard."
        )}

                ${applicants.length ? `
                    <form id="communicationForm">

                        <div class="field">
                            <label for="messageRecipient">Select applicant</label>

                            <select id="messageRecipient" required>
                                <option value="">Choose an applicant</option>

                                ${applicants.map(applicant => `
                                    <option value="${esc(applicant.id)}">
                                        ${esc(applicant.name)} — ${esc(applicant.email)}
                                    </option>
                                `).join("")}
                            </select>
                        </div>

                        <div class="field">
                            <label for="messageApplication">
                                Related application (optional)
                            </label>

                            <select id="messageApplication">
                                <option value="">
                                    General message — no application linked
                                </option>
                            </select>
                        </div>

                        <div class="field">
                            <label for="messageType">Message category</label>

                            <select id="messageType" required>
                                <option value="GENERAL">General message</option>
                                <option value="STATUS_UPDATE">Application status update</option>
                                <option value="DOCUMENT_REQUEST">Request additional documents</option>
                                <option value="ACCEPTANCE">Official acceptance</option>
                                <option value="REJECTION">Official rejection</option>
                            </select>
                        </div>

                        <div class="field">
                            <label for="messageSubject">Subject</label>

                            <input
                                id="messageSubject"
                                type="text"
                                maxlength="200"
                                placeholder="Enter message subject"
                                required
                            >
                        </div>

                        <div class="field">
                            <label for="messageBody">Message</label>

                            <textarea
                                id="messageBody"
                                rows="7"
                                placeholder="Write your message to the applicant..."
                                required
                            ></textarea>
                        </div>

                        <p style="font-size:12px;color:var(--muted)">
                            Dashboard delivery is enabled.
                            University email delivery will be configured later.
                        </p>

                        <button
                            type="submit"
                            class="btn btn-primary"
                            id="sendApplicantMessage"
                        >
                            Send message
                        </button>

                    </form>
                ` : empty(
            "No applicants available",
            "Applicant records must be loaded before you can send messages."
        )}
            </section>

            <section class="panel">
                ${phead("Recently sent", "Your communication history")}

                ${messages.length ? messages.slice(0, 10).map(message => `
                    <div class="activity-item">
                        <span class="activity-marker">✉</span>

                        <div style="flex:1">
                            <strong>${esc(message.subject || "Untitled message")}</strong>

                            <p>To: ${esc(message.recipientName || "Applicant")}</p>

                            <p>${date(message.sentAt)}</p>

                            ${pill(message.emailStatus || "NOT_CONFIGURED")}
                        </div>
                    </div>
                `).join("") : empty(
            "No messages sent",
            "Messages you send will appear here."
        )}
            </section>

        </div>
    `;
    }

    function updateApplicationOptions(recipientId) {
        const select = $("#messageApplication");

        if (!select) return;

        const applications = state.applications.filter(application =>
            String(applicationUserId(application)) === String(recipientId)
        );

        select.innerHTML = `
        <option value="">
            General message — no application linked
        </option>

        ${applications.map(application => `
            <option value="${esc(applicationId(application))}">
                ${esc(reference(application))} — ${esc(courseName(application))}
            </option>
        `).join("")}
    `;
    }

    async function sendApplicantMessage(event) {
        event.preventDefault();

        const recipientId = $("#messageRecipient")?.value;
        const relatedApplicationId = $("#messageApplication")?.value;
        const messageType = $("#messageType")?.value;
        const subject = $("#messageSubject")?.value.trim();
        const body = $("#messageBody")?.value.trim();
        const senderId = userId();

        if (!senderId) {
            toast("Could not identify your staff account.", "error");
            return;
        }

        if (!recipientId || !subject || !body) {
            toast("Please complete all required fields.", "error");
            return;
        }

        const button = $("#sendApplicantMessage");

        if (button) {
            button.disabled = true;
            button.textContent = "Sending...";
        }

        try {
            await request(API.messages, {
                method: "POST",
                body: JSON.stringify({
                    senderId: Number(senderId),
                    recipientId: Number(recipientId),
                    applicationId: relatedApplicationId
                        ? Number(relatedApplicationId)
                        : null,
                    messageType,
                    subject,
                    body
                })
            });

            toast("Message sent successfully.", "success");

            $("#communicationForm")?.reset();

            await load();
            go("communications");

        } catch (error) {
            console.error("Applicant message failed:", error);

            toast(`Message could not be sent: ${error.message}`, "error");

            if (button) {
                button.disabled = false;
                button.textContent = "Send message";
            }
        }
    }

    /* =====================================================
       CSV EXPORT
    ===================================================== */

    function exportReport() {
        const headers = [
            "Applicant",
            "Email",
            "Programme",
            "Reference",
            "Status",
            "Submitted"
        ];

        const rows = state.applications.map(application => [
            applicantName(application),
            applicantEmail(application),
            courseName(application),
            reference(application),
            applicationStatus(application),
            val(application, ["submittedAt", "createdAt"], "")
        ]);

        const csv = [headers, ...rows]
            .map(row =>
                row.map(value =>
                    `"${String(value ?? "").replace(/"/g, '""')}"`
                ).join(",")
            )
            .join("\r\n");

        const blob = new Blob([csv], {
            type: "text/csv;charset=utf-8;"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "auroria-admissions-report.csv";
        link.click();

        URL.revokeObjectURL(url);

        toast("Admissions report exported.", "success");
    }

    /* =====================================================
         NOTIFICATIONS
      ===================================================== */

    function notifications() {
        return `

            ${heading(
            "Notifications",
            "Stay updated on applications, documents and admissions activities.",
        )}


            <section class="panel">

                ${phead("All notifications", "Latest admissions updates")}


                ${state.notifications.length
                ? state.notifications
                    .map(
                        (notification) => `

                        <div class="notification-row">

                            <span class="activity-marker">
                                ♧
                            </span>

                            <div class="row-main">

                                <strong>
                                    ${esc(
                            val(
                                notification,
                                ["title", "subject"],
                                "Admissions update",
                            ),
                        )}
                                </strong>

                                <p>
                                    ${esc(
                            val(
                                notification,
                                ["message", "description", "body"],
                                "",
                            ),
                        )}
                                </p>

                                <p>
                                    ${date(
                            val(
                                notification,
                                ["createdAt", "date"],
                                "",
                            ),
                        )}
                                </p>

                            </div>

                        </div>

                    `,
                    )
                    .join("")
                : empty("No notifications", "You're all caught up.")
            }

            </section>

        `;
    }

    /* =====================================================
         PROFILE
      ===================================================== */

    function profile() {
        const person = {
            ...state.user,
            ...state.profile,
        };

        return `

            ${heading(
            "My profile",
            "View your admissions officer account information.",
        )}


            <section class="panel profile-card">

                <div class="profile-avatar">
                    ${esc(initials(officerName()))}
                </div>

                <div>

                    <h2>
                        ${esc(officerName())}
                    </h2>

                    <p>
                        Admissions Officer
                    </p>

                </div>

            </section>


            <section class="panel">

                ${phead(
            "Account information",
            "Your registered staff information",
        )}


                <div class="info-grid">

                    <div class="info-item">
                        <small>Full name</small>
                        <strong>
                            ${esc(officerName())}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Email address</small>
                        <strong>
                            ${esc(val(person, ["email"], "Not provided"))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Phone number</small>
                        <strong>
                            ${esc(val(person, ["phone", "phoneNumber"], "Not provided"))}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Account ID</small>
                        <strong>
                            ${esc(userId() || "Not available")}
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Department</small>
                        <strong>
                            Admissions
                        </strong>
                    </div>

                    <div class="info-item">
                        <small>Account role</small>
                        <strong>
                            ADMISSIONS_OFFICER
                        </strong>
                    </div>

                </div>

            </section>

        `;
    }

    /* =====================================================
         EVENT LISTENERS
      ===================================================== */

    document.addEventListener("click", async (event) => {
        const pageButton = event.target.closest("[data-page]");

        if (pageButton) {
            event.preventDefault();

            go(pageButton.dataset.page);

            return;
        }

        const button = event.target.closest("[data-action]");

        if (!button) return;

        const { action, id } = button.dataset;

        switch (action) {
            case "close-dialog":
                dialog.close();

                break;

            case "review":
                reviewApplication(id);

                break;

            case "start-review":
                await updateApplicationStatus(id, "UNDER_REVIEW");

                break;

            case "back-applications":
                go("applications");
                break;

            case "preview-review-document":
                previewReviewDocument(id);
                break;


            case "approve":
                await updateApplicationStatus(id, "APPROVED");

                break;

            case "reject":
                await updateApplicationStatus(id, "REJECTED");

                break;

            case "verify-document":
                await verifyDocument(id, "VERIFIED");

                break;

            case "reject-document":
                await verifyDocument(id, "REJECTED");

                break;

            case "view-document":
                viewDocument(id);

                break;

            case "open-documents":
                go("documents");
                break;

            case "reply-enquiry":
                replyEnquiry(id);

                break;

            case "preview-document":
                previewReviewDocument(id);
                break;

            case "close-review-preview":
            case "close-document-preview": {
                $("#reviewDocumentPreview")?.classList.add("hidden");
                $("#documentPagePreview")?.classList.add("hidden");

                if (activeDocumentObjectUrl) {
                    URL.revokeObjectURL(activeDocumentObjectUrl);
                    activeDocumentObjectUrl = null;
                }

                break;
            }
            case "send-enquiry-reply":
                await sendEnquiryReply(id);

                break;

            case "close-enquiry":
                await closeEnquiry(id);

                break;

            case "export-report":
                exportReport();

                break;
        }

    });

    /* =====================================================
     COMMUNICATION CENTRE EVENTS
    ===================================================== */

    document.addEventListener("change", (event) => {
        if (event.target.id === "messageRecipient") {
            updateApplicationOptions(event.target.value);
        }
    });

    document.addEventListener("submit", async (event) => {
        if (event.target.id === "communicationForm") {
            await sendApplicantMessage(event);
        }
    });

    /* =====================================================
         SEARCH
      ===================================================== */

    document.addEventListener("input", (event) => {
        if (event.target.id === "applicationSearch") {
            state.applicationSearch = event.target.value;

            const position = event.target.selectionStart;

            render();

            const input = $("#applicationSearch");

            input?.focus();

            if (input && position !== null) {
                input.setSelectionRange(position, position);
            }
        }
    });

    /* =====================================================
         FILTERS
      ===================================================== */

    document.addEventListener("change", (event) => {
        if (event.target.id === "applicationStatus") {
            state.applicationStatus = event.target.value;

            render();
        }

        if (event.target.id === "documentStatus") {
            state.documentStatus = event.target.value;

            render();
        }

        if (event.target.id === "enquiryStatus") {
            state.enquiryStatus = event.target.value;

            render();
        }
    });

    /* =====================================================
         MOBILE MENU
      ===================================================== */

    $("#mobileMenu")?.addEventListener("click", () => {
        $("#sidebar")?.classList.toggle("open");
    });

    /* =====================================================
         LOGOUT
      ===================================================== */

    $("#logoutButton")?.addEventListener("click", () => {


        localStorage.removeItem("token");

        localStorage.removeItem("authToken");

        localStorage.removeItem("user");

        localStorage.removeItem("userId");

        localStorage.removeItem("user_id");

        window.location.href = "../Student/login.html";
    });

    /* =====================================================
         INITIALIZATION
      ===================================================== */

    const year = $("#year");

    if (year) {
        year.textContent = new Date().getFullYear();
    }

    load();
})();


