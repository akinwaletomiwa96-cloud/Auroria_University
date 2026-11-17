AURORIA UNIVERSITY — FRONTEND FIX PASS
======================================

This package contains the frontend only. The Spring Boot source code and live database are not included, so API compatibility must be verified against the running backend before a demo or deployment.

CONFIGURATION
-------------
- API host and display currency are configured in app-config.js.
- Default API host: http://localhost:8080
- Default currency: NGN (en-NG). Change the defaults in app-config.js if the university's approved fee currency is different.
- For a different backend host, change apiBaseUrl in app-config.js. Do not change endpoint paths unless the Spring Boot controllers use different mappings.

FRONTEND ENDPOINT CONTRACTS TO VERIFY
-------------------------------------
- POST /api/auth/register
- POST /api/auth/login
- GET /api/courses?availableOnly=false
- GET /api/departments
- GET /api/courses/{courseId}
- POST /api/enquiries
- GET /api/student/courses (currently not used; the dashboard loads /api/courses)
- GET /api/applications/user/{userId}
- POST /api/applications/with-documents (multipart parts: application JSON and repeated resultFiles)
- Student dashboard optional routes: /api/student/profile, /api/student/academic-records, /api/student/documents, /api/student/payments, /api/student/notifications, /api/admission-requirements, /api/student/enquiries.

LOGIN RESPONSE EXPECTATION
--------------------------
The login frontend accepts a response containing a positive numeric userId (or id), optionally wrapped in data or user/student/account. It stores an optional bearer token if returned as token, accessToken, access_token or jwt. If the backend uses a different response shape, update auth.js to match the actual DTO rather than guessing.

APPLICATION UPLOAD EXPECTATION
------------------------------
POST /api/applications/with-documents must accept multipart/form-data with:
- application: application/json containing userId, courseId, intake, academicYear, applicantDetails and academicQualifications.
- resultFiles: one file per academic qualification.
The backend must validate file types and size, associate each file with the correct qualification, store files safely, generate a unique reference code, and set verification status server-side. Never trust client-side validation as a security boundary.

SECURITY / PRODUCTION NOTES
---------------------------
- Client-side role checks only control navigation. Spring Security must enforce role and ownership permissions on every protected endpoint.
- Passwords must be hashed on the server (e.g. BCrypt or Argon2); never store plaintext passwords.
- Configure CORS for the exact deployed frontend origin. Do not use wildcard origins with credentialed requests.
- Use HTTPS and a production API URL before deployment.
- Validate and store uploaded files outside the public web root; enforce file size/type limits on the server.
- Avoid putting long-lived refresh tokens in localStorage. The current frontend stores a bearer access token only when the login response supplies one; choose an appropriate secure session/token strategy in Spring Security.

DEMO TEST PLAN
--------------
1. Start MariaDB and Spring Boot; confirm /api/courses and /api/departments return successful JSON.
2. Register a new account and confirm duplicate email is rejected by the backend.
3. Log in; confirm the response contains a positive user ID and, if protected routes require it, a bearer access token.
4. Open the student dashboard and confirm the name, course list and application history load.
5. Submit an enquiry and confirm one enquiry row is created (the FAQ form now has one submit handler).
6. Submit an application with one result file per qualification; confirm a unique reference code and persisted document metadata.
7. Test mobile navigation on all public pages, including Escape, outside click, link selection and resize to desktop.
8. Test all course search/filter links from the homepage.

NOT IMPLEMENTED IN THIS FRONTEND PACKAGE
----------------------------------------
- Admin and admissions officer dashboards. Staff logins are no longer sent to nonexistent HTML pages; they receive a clear message instead.
- Server-side API behavior, database migrations, payment processing, email verification and production hosting. These require the Spring Boot project and deployment configuration.
