/**
 * modals.js - Modal manager with focus trap and accessibility
 */

let activeOpener = null;
let currentSkipConfirmCallback = null;
let currentSkipCancelCallback = null;

export function initModals() {
  const modalOverlay = document.getElementById("modalOverlay");
  const skipOverlay = document.getElementById("skipModalOverlay");

  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  if (skipOverlay) {
    skipOverlay.addEventListener("click", (e) => {
      if (e.target === skipOverlay) {
        closeSkipModal();
      }
    });

    const confirmBtn = skipOverlay.querySelector(".modal-btn.danger");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        const cb = currentSkipConfirmCallback;
        closeSkipModal();
        if (cb) cb();
      });
    }

    const cancelBtn = skipOverlay.querySelector(".modal-btn.cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        const cb = currentSkipCancelCallback;
        closeSkipModal();
        if (cb) cb();
      });
    }
  }

  // Global Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (skipOverlay && skipOverlay.style.display === "flex") {
        closeSkipModal();
      } else if (modalOverlay && modalOverlay.style.display === "flex") {
        closeModal();
      }
    }
  });
}

export function openModal(title, contentHtml, openerElement = null) {
  activeOpener = openerElement || document.activeElement;
  const overlay = document.getElementById("modalOverlay");
  const titleEl = document.getElementById("modalTitle");
  const contentEl = document.getElementById("modalContent");

  if (titleEl) titleEl.textContent = title;
  if (contentEl) contentEl.innerHTML = contentHtml;
  if (overlay) overlay.style.display = "flex";

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  // Focus trap
  trapFocus(overlay);
}

export function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  if (overlay) overlay.style.display = "none";
  if (activeOpener && typeof activeOpener.focus === "function") {
    activeOpener.focus();
    activeOpener = null;
  }
}

export function openSkipModal(percentComplete, onConfirm, onCancel) {
  currentSkipConfirmCallback = onConfirm;
  currentSkipCancelCallback = onCancel;
  const overlay = document.getElementById("skipModalOverlay");
  const percentEl = document.getElementById("sessionPercent");

  if (percentEl) percentEl.textContent = String(percentComplete);
  if (overlay) overlay.style.display = "flex";

  trapFocus(overlay);
}

export function closeSkipModal() {
  const overlay = document.getElementById("skipModalOverlay");
  if (overlay) overlay.style.display = "none";
  currentSkipConfirmCallback = null;
  currentSkipCancelCallback = null;
}

function trapFocus(container) {
  if (!container) return;
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length > 0) {
    focusable[0].focus();
  }
}
