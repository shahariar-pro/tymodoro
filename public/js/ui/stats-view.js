/**
 * stats-view.js - Comprehensive Statistics Dashboard and Calendar Heatmap
 * Hand-written responsive, theme-aware inline SVG charts (7/30/90 days activity,
 * 24-hour focus histogram), daily goal progress, streaks, tag and task breakdowns.
 */
import { openModal } from "./modals.js";
import {
  getStatsSummary,
  getDailyGoalProgress,
  getDailyActivity,
  getHistogramByHour,
  getTagBreakdown,
  getTaskBreakdown,
} from "../stats.js";
import { getAllTodos } from "../tasks.js";

let activeActivityDays = 7;

function formatHoursMinutes(totalMinutes) {
  const mins = Math.max(0, totalMinutes || 0);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) return `${remMins}m`;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

export function showStatsModal(
  sessions,
  settings,
  completedTodosCount,
  totalTodosCount,
  currentCalendarDate,
) {
  const weekStart = settings.weekStart || "mon";
  const dailyGoal = settings.dailyGoal || 4;
  const allTodos = getAllTodos();

  const summary = getStatsSummary(sessions, weekStart);
  const goalProgress = getDailyGoalProgress(sessions, dailyGoal);
  const tagBreakdown = getTagBreakdown(sessions);
  const taskBreakdown = getTaskBreakdown(sessions, allTodos);
  const hourHistogram = getHistogramByHour(sessions);

  // Peak focus hour calculation
  let peakHour = null;
  let peakCount = 0;
  hourHistogram.forEach((count, h) => {
    if (count > peakCount) {
      peakCount = count;
      peakHour = h;
    }
  });

  const formatHourLabel = (h) => {
    if (h === 0) return "12:00 AM";
    if (h === 12) return "12:00 PM";
    return h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`;
  };

  const peakHourText =
    peakHour !== null && peakCount > 0
      ? `You focus best around <strong>${formatHourLabel(peakHour)}</strong> (${peakCount} session${peakCount === 1 ? "" : "s"})`
      : "Complete sessions to discover your peak focus hours!";

  const contentHtml = `
    <div class="stats-dashboard">
      <!-- 1. Key Metrics Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${summary.todaySessions}</div>
          <div class="stat-sub">${formatHoursMinutes(summary.todaySessions * (settings.focusTime || 25))}</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${summary.weekSessions}</div>
          <div class="stat-sub">${formatHoursMinutes(summary.weekSessions * (settings.focusTime || 25))}</div>
          <div class="stat-label">This Week</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${summary.monthSessions}</div>
          <div class="stat-sub">${formatHoursMinutes(summary.monthSessions * (settings.focusTime || 25))}</div>
          <div class="stat-label">This Month</div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-number">${summary.totalSessions}</div>
          <div class="stat-sub">${formatHoursMinutes(summary.totalMinutes)}</div>
          <div class="stat-label">Total Focus</div>
        </div>
      </div>

      <!-- 2. Goal Progress & Streaks Banner -->
      <div class="goal-streak-banner">
        <div class="goal-card">
          <div class="goal-header">
            <span class="goal-title"><i data-lucide="target"></i> Daily Goal</span>
            <span class="goal-ratio">${goalProgress.todayCount} / ${goalProgress.goal} sessions</span>
          </div>
          <div class="progress-bar-track" role="progressbar" aria-valuenow="${goalProgress.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Daily goal progress">
            <div class="progress-bar-fill" style="width: ${goalProgress.percent}%;"></div>
          </div>
          <div class="goal-footer">
            <span>${goalProgress.percent}% achieved today</span>
            ${goalProgress.achieved ? '<span class="goal-badge">Goal Reached! 🎉</span>' : ""}
          </div>
        </div>

        <div class="streak-card">
          <div class="streak-item">
            <div class="streak-icon"><i data-lucide="flame"></i></div>
            <div class="streak-info">
              <div class="streak-val">${summary.currentStreak} day${summary.currentStreak === 1 ? "" : "s"}</div>
              <div class="streak-lbl">Current Streak</div>
            </div>
          </div>
          <div class="streak-divider"></div>
          <div class="streak-item">
            <div class="streak-icon trophy"><i data-lucide="award"></i></div>
            <div class="streak-info">
              <div class="streak-val">${summary.longestStreak} day${summary.longestStreak === 1 ? "" : "s"}</div>
              <div class="streak-lbl">Best Streak</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Daily Activity Bar Chart -->
      <div class="dashboard-section">
        <div class="section-header">
          <h3 class="section-title"><i data-lucide="bar-chart-2"></i> Activity History</h3>
          <div class="chart-filter-tabs">
            <button class="chart-tab ${activeActivityDays === 7 ? "active" : ""}" data-days="7">7 Days</button>
            <button class="chart-tab ${activeActivityDays === 30 ? "active" : ""}" data-days="30">30 Days</button>
            <button class="chart-tab ${activeActivityDays === 90 ? "active" : ""}" data-days="90">90 Days</button>
          </div>
        </div>
        <div class="chart-container" id="activityChartContainer">
          ${renderActivityChartSvg(sessions, activeActivityDays)}
        </div>
      </div>

      <!-- 4. Hour-of-Day Focus Histogram -->
      <div class="dashboard-section">
        <div class="section-header">
          <h3 class="section-title"><i data-lucide="clock"></i> When You Focus Best</h3>
        </div>
        <div class="histogram-desc">${peakHourText}</div>
        <div class="chart-container">
          ${renderHourHistogramSvg(hourHistogram)}
        </div>
      </div>

      <!-- 5. Per-Tag Breakdown -->
      <div class="dashboard-section">
        <h3 class="section-title"><i data-lucide="tag"></i> Focus by Category</h3>
        ${
          tagBreakdown.length === 0
            ? '<div class="empty-stats-note">No tags recorded yet. Add tags like <code>Work</code>, <code>Study</code>, or <code>Design</code> to your tasks!</div>'
            : `
          <div class="table-responsive">
            <table class="stats-table" aria-label="Focus time by tag">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th style="text-align: right;">Sessions</th>
                  <th style="text-align: right;">Focus Time</th>
                </tr>
              </thead>
              <tbody>
                ${tagBreakdown
                  .map(
                    (item) => `
                  <tr>
                    <td><span class="task-tag-badge">${escapeHtml(item.tag)}</span></td>
                    <td style="text-align: right; font-weight: 600;">${item.sessions}</td>
                    <td style="text-align: right; color: var(--text-secondary);">${formatHoursMinutes(item.minutes)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        }
      </div>

      <!-- 6. Per-Task Pomodoro Counts -->
      <div class="dashboard-section">
        <h3 class="section-title"><i data-lucide="check-square"></i> Focus by Task</h3>
        ${
          taskBreakdown.length === 0
            ? '<div class="empty-stats-note">Select a task while focusing to track time per task!</div>'
            : `
          <div class="table-responsive">
            <table class="stats-table" aria-label="Focus time by task">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Tag</th>
                  <th style="text-align: right;">Pomodoros</th>
                  <th style="text-align: right;">Time</th>
                </tr>
              </thead>
              <tbody>
                ${taskBreakdown
                  .map(
                    (t) => `
                  <tr>
                    <td style="font-weight: 500;">${escapeHtml(t.taskName)}</td>
                    <td>${t.tag ? `<span class="task-tag-badge">${escapeHtml(t.tag)}</span>` : '<span style="color: var(--text-muted);">-</span>'}</td>
                    <td style="text-align: right; font-weight: 600;">${t.sessions}</td>
                    <td style="text-align: right; color: var(--text-secondary);">${formatHoursMinutes(t.minutes)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    </div>
  `;

  openModal("Statistics Dashboard", contentHtml);

  // Wire chart tabs
  document.querySelectorAll(".chart-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chart-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeActivityDays = parseInt(btn.dataset.days, 10);
      const chartBox = document.getElementById("activityChartContainer");
      if (chartBox) {
        chartBox.innerHTML = renderActivityChartSvg(sessions, activeActivityDays);
      }
    });
  });

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/**
 * Hand-written inline SVG bar chart for 7, 30, or 90 days
 */
function renderActivityChartSvg(sessions, days = 7) {
  const data = getDailyActivity(sessions, days);
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  const width = 500;
  const height = 160;
  const padLeft = 32;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 28;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const barWidth = Math.max(2, Math.floor((chartWidth / data.length) * 0.7));
  const step = chartWidth / data.length;

  let barsSvg = "";
  let labelsSvg = "";

  data.forEach((d, idx) => {
    const x = padLeft + idx * step + (step - barWidth) / 2;
    const barH = Math.round((d.count / maxCount) * chartHeight);
    const y = padTop + chartHeight - barH;

    barsSvg += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="${days <= 30 ? 3 : 1}" fill="var(--accent)" opacity="${d.count > 0 ? 1 : 0.2}">
        <title>${d.dateStr}: ${d.count} sessions (${formatHoursMinutes(d.minutes)})</title>
      </rect>
    `;

    // Only print text labels if enough space (all for 7d, every 5 for 30d, every 15 for 90d)
    const showLabel =
      days === 7 ||
      (days === 30 && (idx === 0 || idx === 14 || idx === 29)) ||
      (days === 90 && (idx === 0 || idx === 44 || idx === 89));

    if (showLabel) {
      const textLabel = days === 7 ? d.dayName : d.shortDate;
      labelsSvg += `
        <text x="${x + barWidth / 2}" y="${height - 8}" font-size="10" fill="var(--text-muted)" text-anchor="middle" font-family="Inter, sans-serif">
          ${textLabel}
        </text>
      `;
    }
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="stats-svg-chart" role="img" aria-label="${days}-day activity chart">
      <desc>${days}-day focus session activity history</desc>
      <!-- Gridlines -->
      <line x1="${padLeft}" y1="${padTop}" x2="${width - padRight}" y2="${padTop}" stroke="var(--border)" stroke-dasharray="3 3" opacity="0.6"/>
      <line x1="${padLeft}" y1="${padTop + chartHeight / 2}" x2="${width - padRight}" y2="${padTop + chartHeight / 2}" stroke="var(--border)" stroke-dasharray="3 3" opacity="0.6"/>
      <line x1="${padLeft}" y1="${padTop + chartHeight}" x2="${width - padRight}" y2="${padTop + chartHeight}" stroke="var(--border)"/>
      
      <!-- Axis Labels -->
      <text x="${padLeft - 6}" y="${padTop + 4}" font-size="9" fill="var(--text-muted)" text-anchor="end" font-family="Inter, sans-serif">${maxCount}</text>
      <text x="${padLeft - 6}" y="${padTop + chartHeight + 3}" font-size="9" fill="var(--text-muted)" text-anchor="end" font-family="Inter, sans-serif">0</text>
      
      ${barsSvg}
      ${labelsSvg}
    </svg>
  `;
}

/**
 * Hand-written inline SVG for 24-hour focus histogram
 */
function renderHourHistogramSvg(histogram) {
  const maxCount = Math.max(1, ...histogram);
  const width = 500;
  const height = 130;
  const padLeft = 32;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 26;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const step = chartWidth / 24;
  const barWidth = Math.max(3, Math.floor(step * 0.65));

  let barsSvg = "";
  let labelsSvg = "";

  histogram.forEach((count, hour) => {
    const x = padLeft + hour * step + (step - barWidth) / 2;
    const barH = Math.round((count / maxCount) * chartHeight);
    const y = padTop + chartHeight - barH;

    barsSvg += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="2" fill="var(--accent)" opacity="${count > 0 ? 0.9 : 0.15}">
        <title>${hour}:00 - ${hour + 1}:00: ${count} sessions</title>
      </rect>
    `;

    if (hour % 4 === 0) {
      const lbl = hour === 0 ? "12A" : hour === 12 ? "12P" : hour > 12 ? `${hour - 12}P` : `${hour}A`;
      labelsSvg += `
        <text x="${x + barWidth / 2}" y="${height - 8}" font-size="9" fill="var(--text-muted)" text-anchor="middle" font-family="Inter, sans-serif">
          ${lbl}
        </text>
      `;
    }
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="stats-svg-chart" role="img" aria-label="Hour of day focus histogram">
      <desc>Focus sessions completed per hour of day from midnight to 11 PM</desc>
      <line x1="${padLeft}" y1="${padTop + chartHeight}" x2="${width - padRight}" y2="${padTop + chartHeight}" stroke="var(--border)"/>
      ${barsSvg}
      ${labelsSvg}
    </svg>
  `;
}

/**
 * Interactive Productivity Calendar Heatmap
 */
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
