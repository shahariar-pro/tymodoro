/**
 * stats-view.js - Statistics modal and interactive calendar heatmap view
 */
import { openModal } from "./modals.js";
import { getStatsSummary } from "../stats.js";

export function showStatsModal(sessions, settings, completedTodosCount, totalTodosCount, currentCalendarDate) {
  const summary = getStatsSummary(sessions, settings.weekStart || "mon");

  const formattedDate = currentCalendarDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const contentHtml = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${summary.totalSessions}</div>
        <div class="stat-label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.weekSessions}</div>
        <div class="stat-label">This Week</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.monthSessions}</div>
        <div class="stat-label">This Month</div>
      </div>
      <div class="stat-card">
        <i data-lucide="clock" style="margin: 0 auto 0.5rem; display: block; width: 20px; height: 20px;"></i>
        <div class="stat-number">${summary.totalMinutes}</div>
        <div class="stat-label">Total Minutes</div>
      </div>
      <div class="stat-card">
        <i data-lucide="check-square" style="margin: 0 auto 0.5rem; display: block; width: 20px; height: 20px;"></i>
        <div class="stat-number">${completedTodosCount}</div>
        <div class="stat-label">Tasks Completed (${formattedDate})</div>
      </div>
      <div class="stat-card">
        <i data-lucide="list-todo" style="margin: 0 auto 0.5rem; display: block; width: 20px; height: 20px;"></i>
        <div class="stat-number">${totalTodosCount}</div>
        <div class="stat-label">Total Tasks (${formattedDate})</div>
      </div>
    </div>
  `;

  openModal("Statistics", contentHtml);
}

export function renderCalendar(displayDate, selectedDate, sessions, settings, onSelectDate) {
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const monthYearEl = document.getElementById("currentMonthYear");
  if (monthYearEl) {
    monthYearEl.textContent = displayDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  const calendarGrid = document.getElementById("calendarGrid");
  if (!calendarGrid) return;
  calendarGrid.innerHTML = "";

  const summary = getStatsSummary(sessions, settings.weekStart || "mon");
  const dailyData = summary.dailyData || {};

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Day labels
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayLabels.forEach((label) => {
    const labelEl = document.createElement("div");
    labelEl.style.textAlign = "center";
    labelEl.style.fontWeight = "600";
    labelEl.style.color = "var(--text-muted)";
    labelEl.style.fontSize = "0.75rem";
    labelEl.textContent = label;
    calendarGrid.appendChild(labelEl);
  });

  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    calendarGrid.appendChild(document.createElement("div"));
  }

  const todayStr = new Date().toDateString();
  const selectedDateStr = selectedDate ? selectedDate.toDateString() : "";

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toDateString();

    const dayEl = document.createElement("button");
    dayEl.className = "calendar-day";
    dayEl.type = "button";
    dayEl.textContent = String(day);

    if (dateStr === todayStr) {
      dayEl.classList.add("today");
    }

    if (dateStr === selectedDateStr) {
      dayEl.classList.add("active");
    }

    const sessionCount = dailyData[dateStr] || 0;
    if (sessionCount >= 5) {
      dayEl.style.background = "var(--success)";
      dayEl.style.color = "#ffffff";
    } else if (sessionCount >= 3) {
      dayEl.style.opacity = "0.7";
      dayEl.style.background = "var(--accent)";
      dayEl.style.color = "var(--bg-primary)";
    } else if (sessionCount >= 1) {
      dayEl.style.background = "var(--accent)";
      dayEl.style.color = "var(--bg-primary)";
    }

    dayEl.addEventListener("click", () => {
      if (typeof onSelectDate === "function") {
        onSelectDate(date);
      }
    });

    calendarGrid.appendChild(dayEl);
  }
}
