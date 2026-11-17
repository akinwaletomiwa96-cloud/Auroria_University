console.log("AURORIA AUTH.JS IS LOADED");
/* =========================================
   AURORIA UNIVERSITY - LOGIN & REGISTER
   Frontend: HTML, CSS and JavaScript
   Backend: Java Spring Boot
   Database: MySQL
   ========================================= */

// Change these URLs if your Spring Boot controllers
// use different endpoint paths.
const API_BASE_URL = window.AURORIA_CONFIG?.apiBaseUrl || "http://localhost:8080";
const REGISTER_URL = `${API_BASE_URL}/api/auth/register`;
const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;

// Show or hide password fields.
document.querySelectorAll(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.password);

    if (!input) return;

    const showing = input.type === "text";

    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
    button.setAttribute(
      "aria-label",
      showing ? "Show password" : "Hide password",
    );
  });
});

// Display form feedback safely.
function showNotice(message, type = "error") {
  const notice = document.getElementById("auth-notice");

  if (!notice) return;

  notice.textContent = message;
  notice.className = `notice ${type}`;
}

// Password strength validation.
function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// Registration.
const registerForm = document.getElementById("register-form");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!registerForm.reportValidity()) return;

    const fullName = document.getElementById("full-name").value.trim();

    const email = document.getElementById("register-email").value.trim();

    const phone = document.getElementById("phone").value.trim();

    const password = document.getElementById("register-password").value;

    const confirmPassword = document.getElementById("confirm-password").value;

    if (fullName.length < 2) {
      showNotice("Please enter your full name.");
      return;
    }

    if (!/^[+0-9()\- ]{7,25}$/.test(phone)) {
      showNotice("Please enter a valid phone number.");
      return;
    }

    if (!isStrongPassword(password)) {
      showNotice(
        "Use at least 8 characters, including uppercase, " +
        "lowercase, a number and a special character.",
      );
      return;
    }

    if (password !== confirmPassword) {
      showNotice("Your passwords do not match.");
      return;
    }

    const button = registerForm.querySelector('button[type="submit"]');

    const originalButtonHTML = button.innerHTML;

    button.disabled = true;
    button.textContent = "Creating account...";
    showNotice("");

    try {
      const response = await fetch(REGISTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));
      const payload = result.data && typeof result.data === "object" ? result.data : result;

      if (!response.ok) {
        throw new Error(
          payload.message || payload.error || "Registration failed. Please check your details.",
        );
      }

      showNotice(
        payload.message || result.message || "Your account has been created successfully.",
        "success",
      );

      registerForm.reset();

      // Redirect to login after successful registration.
      // Remove this timeout if you prefer manual navigation.
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);

      showNotice(
        error instanceof TypeError
          ? "Cannot connect to the server. Check that " +
          "Spring Boot is running and CORS is configured."
          : error.message,
      );
    } finally {
      button.disabled = false;
      button.innerHTML = originalButtonHTML;
    }
  });
}

// =========================================
// ROLE-BASED NAVIGATION
// =========================================
function getDashboardByRole(role) {
  const normalizedRole = String(role || "")
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, "")
    .replace(/[\s-]+/g, "_");

  const dashboards = {
    APPLICANT: "dashboard.html",
    STUDENT: "dashboard.html",
    ADMISSIONS_OFFICER: "../University/index.html",
    ADMIN: "../Admin/index.html"
  };

  return dashboards[normalizedRole] || null;
}

// Login.
const loginForm = document.getElementById("login-form");

// Start with empty login fields.
if (loginForm) {
  loginForm.reset();

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");

  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!loginForm.reportValidity()) return;

    const email = document.getElementById("login-email").value.trim();

    const password = document.getElementById("login-password").value;

    const button = loginForm.querySelector('button[type="submit"]');

    const originalButtonHTML = button.innerHTML;

    button.disabled = true;
    button.textContent = "Signing in...";
    showNotice("");

    try {
      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));
      const payload = result.data && typeof result.data === "object" ? result.data : result;
      const user = payload.user || payload.student || payload.account || payload;

      if (!response.ok) {
        throw new Error(payload.message || payload.error || "Invalid email or password.");
      }

      const userId = user.userId ?? user.id ?? payload.userId ?? payload.id ?? result.userId ?? result.id;
      if (userId == null || !Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
        throw new Error("Login response did not include a valid user ID. Check the Spring Boot login response.");
      }

      const token = payload.token || payload.accessToken || payload.access_token || payload.jwt ||
        payload.auth?.token || payload.tokens?.accessToken ||
        user.token || user.accessToken || user.access_token || user.jwt ||
        result.token || result.accessToken || result.access_token || result.jwt;
      if (token) {
        localStorage.setItem("token", String(token));
        localStorage.setItem("authToken", String(token));
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
      }

      const savedUser = {
        userId: Number(userId),
        fullName: user.fullName || user.name || payload.fullName || result.fullName || "Student",
        email: user.email || payload.email || result.email || email,
        role: user.roleName || user.role?.name || user.role || payload.roleName || payload.role?.name || payload.role || result.roleName || result.role || "STUDENT"
      };
      localStorage.setItem("userId", String(userId));
      localStorage.setItem("user", JSON.stringify(savedUser));

      const roleName = String(savedUser.role || "STUDENT").toUpperCase();

      console.log("LOGIN RESPONSE:", payload);
      console.log("SAVED USER:", savedUser);
      console.log("DETECTED ROLE:", savedUser.role);

      const destination = getDashboardByRole(savedUser.role);

      if (!destination) {
        showNotice("Your account role is not recognised.");
        return;
      }

      showNotice(
        `Welcome, ${savedUser.fullName}! Redirecting...`,
        "success"
      );

      window.location.replace(destination);

    } catch (error) {
      console.error("Login error:", error);

      showNotice(
        error instanceof TypeError
          ? "Cannot connect to the server. Check that " +
          "Spring Boot is running and CORS is configured."
          : error.message,
      );
    } finally {
      button.disabled = false;
      button.innerHTML = originalButtonHTML;
    }
  });
}
