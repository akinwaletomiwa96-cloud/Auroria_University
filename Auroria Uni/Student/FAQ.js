document.addEventListener("DOMContentLoaded", () => {


    
/* =========================================
   AURORIA UNIVERSITY - ENQUIRY FORM
   Spring Boot + MySQL
   ========================================= */

const enquiryForm = document.getElementById("faq-contact-form");
const enquiryNotice = document.getElementById("contact-form-notice");

if (enquiryForm && enquiryNotice) {
    enquiryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!enquiryForm.reportValidity()) {
            return;
        }

        const formData = new FormData(enquiryForm);

        const enquiry = {
            fullName: formData.get("name").trim(),
            email: formData.get("email").trim(),
            phoneNumber: formData.get("phone").trim(),
            enquiryTopic: formData.get("topic"),
            subject: formData.get("subject").trim(),
            message: formData.get("message").trim()
        };

        const submitButton = enquiryForm.querySelector(
            'button[type="submit"]'
        );

        const originalButtonHTML = submitButton.innerHTML;

        submitButton.disabled = true;
        submitButton.textContent = "Sending enquiry...";
        enquiryNotice.textContent = "Submitting your enquiry...";
        enquiryNotice.classList.remove("success");

        try {
            const token = localStorage.getItem("token") || localStorage.getItem("authToken");
            const headers = { "Content-Type": "application/json", Accept: "application/json" };
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(
                `${window.AURORIA_CONFIG?.apiBaseUrl || "http://localhost:8080"}/api/enquiries`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify(enquiry)
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message || result.error || "Unable to submit your enquiry."
                );
            }

            const reference = result.enquiryId ?? result.referenceCode ?? result.id;
            const successMessage = result.message || "Your enquiry has been submitted successfully.";
            enquiryNotice.textContent = reference
                ? `${successMessage} Reference number: ${reference}`
                : successMessage;

            enquiryNotice.classList.add("success");

            enquiryForm.reset();

        } catch (error) {
            console.error("Enquiry submission error:", error);

            enquiryNotice.textContent =
                error.message ||
                "Unable to connect to the server. Please try again.";

        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    });
}

  // FAQ ACCORDION
  const faqItems = [...document.querySelectorAll(".faq-item")];

  faqItems.forEach(item => {
    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");

    question.addEventListener("click", () => {
      const willOpen = question.getAttribute("aria-expanded") !== "true";

      // Keep one answer open at a time.
      faqItems.forEach(other => {
        other.querySelector(".faq-question").setAttribute("aria-expanded", "false");
        other.querySelector(".faq-answer").hidden = true;
      });

      if (willOpen) {
        question.setAttribute("aria-expanded", "true");
        answer.hidden = false;
      }
    });
  });

  // SEARCH AND CATEGORY FILTER
  const searchInput = document.getElementById("faq-search");
  const filterButtons = [...document.querySelectorAll(".faq-filter")];
  const noResults = document.getElementById("faq-no-results");
  const resetButton = document.getElementById("faq-reset");
  let selectedCategory = "all";

  function filterFAQs() {
    const term = (searchInput?.value || "").trim().toLowerCase();
    let visibleCount = 0;

    faqItems.forEach(item => {
      const category = item.dataset.category;
      const text = item.textContent.toLowerCase();
      const categoryMatches =
        selectedCategory === "all" || category === selectedCategory;
      const searchMatches = !term || text.includes(term);
      const visible = categoryMatches && searchMatches;

      item.hidden = !visible;

      if (!visible) {
        item.querySelector(".faq-question").setAttribute("aria-expanded", "false");
        item.querySelector(".faq-answer").hidden = true;
      } else {
        visibleCount++;
      }
    });

    if (noResults) noResults.hidden = visibleCount > 0;
  }

  filterButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;

      filterButtons.forEach(filter => {
        const active = filter === button;
        filter.classList.toggle("active", active);
        filter.setAttribute("aria-pressed", String(active));
      });

      filterFAQs();
    });

    button.setAttribute(
      "aria-pressed",
      String(button.classList.contains("active"))
    );
  });

  searchInput?.addEventListener("input", filterFAQs);

  function resetFAQs() {
    selectedCategory = "all";
    if (searchInput) searchInput.value = "";

    filterButtons.forEach(button => {
      const active = button.dataset.category === "all";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    filterFAQs();
  }

  resetButton?.addEventListener("click", resetFAQs);

  // FOOTER YEAR
  const year = document.getElementById("faq-year");
  if (year) year.textContent = new Date().getFullYear();

  // BACK TO TOP
  document.getElementById("faq-back-top")?.addEventListener("click", event => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
