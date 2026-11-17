/* Shared responsive navigation for all public Auroria pages. */
(() => {
  "use strict";

  function initialiseNavigation() {
    document.querySelectorAll(".shared-site-header").forEach((header) => {
      const toggle = header.querySelector(".shared-menu-toggle");
      const nav = header.querySelector(".about-nav");
      if (!toggle || !nav) return;

      const closeMenu = ({ restoreFocus = false } = {}) => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
        if (restoreFocus) toggle.focus();
      };

      toggle.addEventListener("click", () => {
        const isOpen = toggle.getAttribute("aria-expanded") !== "true";
        nav.classList.toggle("is-open", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute(
          "aria-label",
          isOpen ? "Close navigation menu" : "Open navigation menu"
        );
      });

      nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => closeMenu());
      });

      document.addEventListener("click", (event) => {
        if (!header.contains(event.target)) closeMenu();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
          closeMenu({ restoreFocus: true });
        }
      });

      const desktopQuery = window.matchMedia("(min-width: 821px)");
      const handleBreakpoint = (event) => {
        if (event.matches) closeMenu();
      };
      if (desktopQuery.addEventListener) {
        desktopQuery.addEventListener("change", handleBreakpoint);
      } else {
        desktopQuery.addListener(handleBreakpoint);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseNavigation, { once: true });
  } else {
    initialiseNavigation();
  }
})();
