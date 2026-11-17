"use strict";

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // APPLICATION DOCUMENT CHECKLIST
    // ==========================================

    

    // ==========================================
    // FOOTER YEAR
    // ==========================================

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }
});