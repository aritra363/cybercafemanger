// -------------------------------------------------------------
// Cyber Manager — ui.js
// Handles navigation, sidebar behaviour, themes, and router init
// -------------------------------------------------------------

window.CM = window.CM || {};
window.CM.Views = window.CM.Views || {
  Dashboard: {},
  POS: {},
  Inventory: {},
  Sales: {},
  Expenses: {},
};

CM.UI = (() => {
  // --- Helper shortcuts ---
  const sb = () => document.getElementById("sidebar");
  const bd = () => document.getElementById("backdrop");
  const isMobile = () => {
    const route = document.body.getAttribute('data-page') || '';
    if (route === 'pos') {
      return window.matchMedia("(max-width: 934px)").matches;
    }
    return window.matchMedia("(max-width: 767px)").matches;
  };
  const setBodyScroll = (allow) =>
    (document.body.style.overflow = allow ? "" : "hidden");

  // Ensure backdrop exists in DOM
  function ensureBackdrop() {
    let b = bd();
    if (!b) {
      b = document.createElement("div");
      b.id = "backdrop";
      b.className = "hidden fixed inset-0 bg-black/40 z-30 transition-opacity";
      document.body.appendChild(b);
    }
    return b;
  }

  // --- Sidebar Controls ---
  function openSidebar() {
    const sidebar = sb();
    const backdrop = ensureBackdrop();
    sidebar.classList.remove("-translate-x-full");
    sidebar.classList.add("fixed", "z-40");
    backdrop.classList.remove("hidden");
    setBodyScroll(false);
  }

  function closeSidebar() {
    const sidebar = sb();
    const backdrop = ensureBackdrop();
    sidebar.classList.add("-translate-x-full");
    backdrop.classList.add("hidden");
    sidebar.classList.remove("fixed");
    setBodyScroll(true);
  }

  function toggleSidebar(force) {
    if (!isMobile()) return; // Only applies to mobile
    const sidebar = sb();
    const hidden = sidebar.classList.contains("-translate-x-full");
    if (typeof force === "boolean") {
      force ? openSidebar() : closeSidebar();
    } else {
      hidden ? openSidebar() : closeSidebar();
    }
  }

  // --- Navigation ---
  function initNav() {
    document.querySelectorAll(".navlink").forEach((btn) => {
      btn.addEventListener("click", () => {
        const route = btn.getAttribute("data-route");
        CM.Router.go(route);
        if (isMobile()) closeSidebar();
      });
    });
  }

  // --- Mobile Header ---
  function initMobileHeader() {
    const btn = document.getElementById("btnMobileNav");
    const backdrop = ensureBackdrop();
    if (btn) btn.addEventListener("click", () => toggleSidebar());
    if (backdrop) backdrop.addEventListener("click", () => closeSidebar());
  }

  // --- Theme Buttons ---
  function initThemeButtons() {
    // Color theme buttons
    document.querySelectorAll(".color-theme-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const theme = b.dataset.theme;
        CM.State = CM.State || {};
        CM.State.colorTheme = theme;
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("cm:colorTheme", theme);
        
        // Update active indicator
        document.querySelectorAll(".color-theme-btn").forEach(btn => btn.classList.remove("active-theme"));
        b.classList.add("active-theme");
      });
    });

    // Design theme buttons
    document.querySelectorAll(".design-theme-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const theme = b.dataset.theme;
        CM.State = CM.State || {};
        CM.State.designTheme = theme;
        document.documentElement.setAttribute("data-design-theme", theme);
        localStorage.setItem("cm:designTheme", theme);
        
        // Update active indicator
        document.querySelectorAll(".design-theme-btn").forEach(btn => btn.classList.remove("active-theme"));
        b.classList.add("active-theme");
        
        // Update icons based on design theme
        updateIconsForDesignTheme(theme);
      });
    });

    // Apply saved themes on load
    const savedColor = localStorage.getItem("cm:colorTheme") || "sunset";
    const savedDesign = localStorage.getItem("cm:designTheme") || "glass-modern";
    
    document.documentElement.setAttribute("data-theme", savedColor);
    document.documentElement.setAttribute("data-design-theme", savedDesign);
    
    // Clear all active indicators first
    document.querySelectorAll(".active-theme").forEach(btn => btn.classList.remove("active-theme"));
    
    // Set active indicators for saved themes
    document.querySelector(`.color-theme-btn[data-theme="${savedColor}"]`)?.classList.add("active-theme");
    document.querySelector(`.design-theme-btn[data-theme="${savedDesign}"]`)?.classList.add("active-theme");
    
    // Update icons on initial load
    updateIconsForDesignTheme(savedDesign);
  }

  // --- Update icons based on design theme ---
  function updateIconsForDesignTheme(theme) {
    const iconMap = {
      "glass-modern": { edit: "pencil", delete: "trash", filter: "filter", low: "alert-circle" },
      "neumorphic-soft": { edit: "edit-3", delete: "trash-2", filter: "sliders", low: "alert-circle" },
      "gradient-bold": { edit: "edit", delete: "x-circle", filter: "settings", low: "alert-circle" },
      "brutalist-sharp": { edit: "edit", delete: "trash", filter: "settings", low: "alert-circle" },
      "minimalist-clean": { edit: "pen-tool", delete: "x", filter: "filter", low: "alert-circle" },
      "retro-neon": { edit: "edit-2", delete: "trash-2", filter: "sliders", low: "alert-triangle" },
      "material-design": { edit: "edit-2", delete: "delete", filter: "settings", low: "alert-circle" }
    };

    const icons = iconMap[theme] || iconMap["glass-modern"];

    // Update edit and delete icons in tables
    document.querySelectorAll("[data-edit]").forEach(btn => {
      const lucideIcon = btn.querySelector("[data-lucide]");
      if (lucideIcon) {
        lucideIcon.setAttribute("data-lucide", icons.edit);
      }
    });

    document.querySelectorAll("[data-del]").forEach(btn => {
      const lucideIcon = btn.querySelector("[data-lucide]");
      if (lucideIcon) {
        lucideIcon.setAttribute("data-lucide", icons.delete);
      }
    });

    // Update filter icons
    document.querySelectorAll("[data-filter]").forEach(btn => {
      const lucideIcon = btn.querySelector("[data-lucide]");
      if (lucideIcon) {
        lucideIcon.setAttribute("data-lucide", icons.filter);
      }
    });

    // Update low stock indicators - update icon only, preserve text
    document.querySelectorAll(".badge-low i").forEach(icon => {
      icon.setAttribute("data-lucide", icons.low);
    });

    // Recreate Lucide icons
    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  };

  // --- Active nav state ---
  function setActive(route) {
    document.querySelectorAll(".navlink").forEach((b) => {
      const active = b.getAttribute("data-route") === route;
      b.classList.toggle("bg-[var(--muted)]", active);
      b.classList.toggle("text-[var(--primary)]", active);
    });
  }

  // --- Toast ---
  function toast(msg, type = "info", title = "") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    
    let bgClass, borderClass, titleColor;
    if (type === "success") {
      bgClass = "bg-green-600";
      borderClass = "border-green-700";
      titleColor = "text-white";
    } else if (type === "error") {
      bgClass = "bg-red-600";
      borderClass = "border-red-700";
      titleColor = "text-white";
    } else if (type === "warning") {
      bgClass = "bg-yellow-500";
      borderClass = "border-yellow-600";
      titleColor = "text-white";
    } else {
      bgClass = "bg-[var(--card)]";
      borderClass = "border-[var(--border)]";
      titleColor = "text-[var(--text)]";
    }

    const el = document.createElement("div");
    el.className = `${bgClass} rounded-lg shadow-lg text-sm border ${borderClass} overflow-hidden animate-in slide-in-from-right`;
    
    const titleEl = title ? `<div class="font-semibold ${titleColor} mb-1">${title}</div>` : "";
    const msgColor = type === "info" ? "text-[var(--text)]" : "text-white";
    
    el.innerHTML = `
      <div class="px-4 py-3">
        ${titleEl}
        <div class="${msgColor}">${msg}</div>
      </div>
    `;
    
    root.appendChild(el);
    
    const timeoutId = setTimeout(() => {
      if (root.contains(el)) root.removeChild(el);
    }, 3500);
    
    // Allow dismissing by clicking
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      clearTimeout(timeoutId);
      if (root.contains(el)) root.removeChild(el);
    });
  }

  // --- Router ---
  CM.Router = {
    go(route) {
      CM.State = CM.State || {};
      CM.State.route = route;
      setActive(route);
      
      // Close any open modals before navigating
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot) {
        modalRoot.innerHTML = '';
      }
      
      // Clear all event listeners from view root by cloning it
      // This removes any accumulated listeners from previous pages
      const view = document.getElementById('view');
      if (view) {
        const freshView = view.cloneNode(false);
        view.parentNode.replaceChild(freshView, view);
      }
      
      // Set data-page attribute for route-aware mobile detection
      document.body.setAttribute('data-page', route);
      
      // Close sidebar and ensure body scroll is enabled when leaving any page
      closeSidebar();
      setBodyScroll(true);
      
      // For POS below 934px, ensure sidebar is hidden
      if (route === 'pos' && window.matchMedia("(max-width: 934px)").matches) {
        closeSidebar();
      }

      const v = CM.Views;
      switch (route) {
        case "dashboard":
          v.Dashboard?.render?.();
          break;
        case "pos":
          v.POS?.render?.();
          break;
        case "inventory":
          v.Inventory?.render?.();
          break;
        case "sales":
          v.Sales?.render?.();
          break;
        case "expenses":
          v.Expenses?.render?.();
          break;
      }

      if (typeof lucide !== "undefined" && lucide.createIcons)
        lucide.createIcons();
    },
  };

  // --- Initialize everything ---
  function init() {
    const sidebar = sb();
    const backdrop = ensureBackdrop();

    // Initial layout depending on device
    if (isMobile()) {
      sidebar.classList.add("-translate-x-full");
      backdrop.classList.add("hidden");
    } else {
      sidebar.classList.remove("-translate-x-full");
      backdrop.classList.add("hidden");
    }

    initNav();
    initMobileHeader();
    initThemeButtons();

    // Reset layout when resizing
    window.addEventListener(
      "resize",
      () => {
        if (!isMobile()) {
          // Desktop or Tablet
          closeSidebar();
          sidebar.classList.remove("-translate-x-full");
        } else {
          // Mobile
          closeSidebar();
        }
      },
      { passive: true }
    );
  }

  return { init, toast, toggleSidebar, updateIconsForDesignTheme };
})();

// Make toast globally accessible
window.CM.toast = CM.UI.toast;
