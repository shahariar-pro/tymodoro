/**
 * toasts.js - Transient user notifications / toasts
 */

let container = null;

function ensureContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, duration = 4000, type = "info") {
  if (typeof document === "undefined") return;
  const parent = ensureContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  parent.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  const remove = () => {
    toast.classList.remove("toast-visible");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };

  toast.addEventListener("click", remove);

  if (duration > 0) {
    setTimeout(remove, duration);
  }

  return remove;
}
