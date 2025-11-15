// App State
let isRunning = false
let currentSession = "work"
let timeLeft = 25 * 60
let totalTime = 25 * 60
let timerInterval
let soundEnabled = true
let notificationPermission = false
let sessionCount = 0
let audioContext
const lucide = window.lucide
let startTime = null
let pausedTime = 0
let isTabVisible = true
let showCompleted = true
let editingTodoId = null
let todoListVisible = false
let whiteNoiseEnabled = false
let currentNoise = null
let noiseGainNode = null
let noiseVolume = 0.3
let currentNoiseTab = "regular"
let currentTheme = "dark"
let themePreviewActive = null
let floatingWidgetVisible = false
const floatingWidgetX = 0
const floatingWidgetY = 0
let isDraggingWidget = false
const dragOffsetX = 0
const dragOffsetY = 0
let calendarVisible = false
const currentDate = new Date()
let floatingWindow = null // Add floating window reference and management

let selectedSessionTask = null
let sessionMode = "quick" // "quick" or "task"

const sessionData = {
  startTime: null,
  sessionType: "work",
  minCompletionPercent: 90,
}

// Settings
let settings = {
  focusTime: 25,
  shortBreakTime: 5,
  longBreakTime: 15,
  longBreakAfter: 4,
}

const themes = [
  { name: "leather", colors: ["#d4793e", "#c65d1b", "#a8623d"] },
  { name: "diner", colors: ["#8ba8d8", "#9b8b6f", "#6b9b7d"] },
  { name: "alpine", colors: ["#e8e6e1", "#f5f2ed", "#c8c5bd"] },
  { name: "dualshot", colors: ["#4a4a4a", "#3a3a3a", "#2a2a2a"] },
  { name: "fundamentals", colors: ["#a8c686", "#b8a366", "#8a7665"] },
  { name: "our theme", colors: ["#ff3333", "#ffcc00", "#ffffff"] },
  { name: "bz mode", colors: ["#0066ff", "#00ccff", "#ffffff"] },
  { name: "evil eye", colors: ["#00ccff", "#000000", "#ffffff"] },
  { name: "menthol", colors: ["#00ff99", "#00cc66", "#ffffff"] },
  { name: "comfy", colors: ["#e0e0e0", "#f5f5f5", "#d9d9d9"] },
  { name: "trackday", colors: ["#cc3333", "#6699cc", "#99ccff"] },
  { name: "muted", colors: ["#d0d0d0", "#b0b0b0", "#c0c0c0"] },
  { name: "red samurai", colors: ["#cc3333", "#ff0000", "#ffffff"] },
  { name: "sweden", colors: ["#ffff00", "#00ccff", "#ffffff"] },
  { name: "passion fruit", colors: ["#ff9999", "#ff6699", "#ffffff"] },
  { name: "suisei", colors: ["#ffffff", "#ffcc00", "#ff9933"] },
  { name: "striker", colors: ["#0066ff", "#66ccff", "#ffffff"] },
  { name: "cy red", colors: ["#cc3333", "#ff6666", "#000000"] },
  { name: "grand prix", colors: ["#ffff00", "#d0d0d0", "#404040"] },
  { name: "dekb", colors: ["#cc3333", "#00ff00", "#0066ff"] },
  { name: "hedge", colors: ["#99dd66", "#ccff99", "#ffffff"] },
]

let stats = {
  totalSessions: 0,
  weekSessions: 0,
  monthSessions: 0,
  totalMinutes: 0,
  todaySessions: 0,
  dailyData: {}, // Track by date
  longestStreak: 0,
  currentStreak: 0,
}

// Todos
let todos = []

// White noise generators
const noiseGenerators = {
  storm: () => generateStormSound(),
  forest: () => generateForestSound(),
  ocean: () => generateOceanSound(),
  coffee: () => generateCoffeeShopSound(),
  fire: () => generateFireSound(),
  wind: () => generateWindSound(),
  gamma40: () => generateBinauralBeat(40),
  beta20: () => generateBinauralBeat(20),
  alpha10: () => generateBinauralBeat(10),
  theta6: () => generateBinauralBeat(6),
  delta3: () => generateBinauralBeat(3),
  focus15: () => generateBinauralBeat(15),
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await requestNotificationPermission()
  loadSettings()
  loadStats()
  loadTodos()
  loadTheme()
  updateDisplay()
  renderTodos()
  updateTodoProgress()
  updateTodoListLayout()
  initializeCalendar()
  setupCalendarDayClick() // Call the new setup function

  document.addEventListener("click", initAudioContext, { once: true })
  document.addEventListener("touchstart", initAudioContext, { once: true })

  const todoInput = document.getElementById("todoInput")
  todoInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTodo()
    }
  })

  document.addEventListener("visibilitychange", handleVisibilityChange)

  // Floating widget drag support
  setupFloatingWidgetDrag()
})

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
}

async function requestNotificationPermission() {
  if ("Notification" in window) {
    try {
      if (Notification.permission === "default") {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
        const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0

        if (isIOS || isMac) {
          const userWantsNotifications = confirm(
            "TYMODORO would like to send you notifications when your focus sessions and breaks are complete. Allow notifications?",
          )
          if (userWantsNotifications) {
            const permission = await Notification.requestPermission()
            notificationPermission = permission === "granted"
          }
        } else {
          const permission = await Notification.requestPermission()
          notificationPermission = permission === "granted"
        }
      } else {
        notificationPermission = Notification.permission === "granted"
      }
      return notificationPermission
    } catch (error) {
      console.error("Error requesting notification permission:", error)
      return false
    }
  }
  return false
}

function showNotification(title, body) {
  if (notificationPermission && soundEnabled) {
    try {
      new Notification(title, {
        body: body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "tymodoro-notification",
        requireInteraction: false,
      })
    } catch (error) {
      console.error("Error showing notification:", error)
    }
  }
}

// Settings Management
function loadSettings() {
  const savedSettings = localStorage.getItem("tymodoro-settings")
  if (savedSettings) {
    settings = JSON.parse(savedSettings)
  }
  timeLeft = settings.focusTime * 60
  totalTime = settings.focusTime * 60
}

function saveSettings() {
  localStorage.setItem("tymodoro-settings", JSON.stringify(settings))
}

function loadTheme() {
  const savedTheme = localStorage.getItem("tymodoro-theme")
  if (savedTheme) {
    currentTheme = savedTheme
    document.body.setAttribute("data-theme", currentTheme)
  }
  updateThemeSelector()
}

function previewTheme(theme) {
  themePreviewActive = currentTheme
  document.body.setAttribute("data-theme", theme)
}

function revertTheme() {
  if (themePreviewActive) {
    document.body.setAttribute("data-theme", themePreviewActive)
    themePreviewActive = null
  }
}

function setTheme(theme) {
  currentTheme = theme
  document.body.setAttribute("data-theme", theme)
  localStorage.setItem("tymodoro-theme", theme)
  updateThemeSelector()
  hideThemeSelector()
  themePreviewActive = null
}

function renderThemeList(searchTerm = "") {
  const themeList = document.getElementById("themeList")
  const filteredThemes = searchTerm
    ? themes.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : themes

  themeList.innerHTML = filteredThemes
    .map(theme => `
      <div class="theme-list-item ${theme.name === currentTheme ? "active" : ""}" 
           onclick="setTheme('${theme.name}')"
           onmouseenter="previewTheme('${theme.name}')"
           onmouseleave="revertTheme()">
        <span class="theme-name">${theme.name}</span>
        <div class="theme-color-circles">
          ${theme.colors.map(color => `<div class="color-circle" style="background-color: ${color};"></div>`).join("")}
        </div>
      </div>
    `)
    .join("")
}

function filterThemes(searchTerm) {
  renderThemeList(searchTerm)
}

function showThemeSelector() {
  closeAllPanels()
  document.getElementById("themeSelector").style.display = "block"
  renderThemeList()
  document.getElementById("themeSearchInput").value = ""
}


function updateThemeSelector() {
  const themeOptions = document.querySelectorAll(".theme-option")
  themeOptions.forEach((option) => {
    if (option.dataset.theme === currentTheme) {
      option.classList.add("active")
    } else {
      option.classList.remove("active")
    }
  })
}

function hideThemeSelector() {
  document.getElementById("themeSelector").style.display = "none"
}

// Stats Management
function loadStats() {
  const savedStats = localStorage.getItem("tymodoro-stats")
  if (savedStats) {
    stats = JSON.parse(savedStats)
  }
  updateStatsDisplay()
}

function saveStats() {
  localStorage.setItem("tymodoro-stats", JSON.stringify(stats))
  updateStatsDisplay()
}

function updateStatsDisplay() {
  // Stats are shown in modal
}

function initializeCalendar() {
  updateCalendarDisplay()
}

function updateCalendarDisplay() {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  document.getElementById("currentMonthYear").textContent = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const calendarGrid = document.getElementById("calendarGrid")
  calendarGrid.innerHTML = ""

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Add day labels
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  dayLabels.forEach((label) => {
    const labelEl = document.createElement("div")
    labelEl.style.textAlign = "center"
    labelEl.style.fontWeight = "600"
    labelEl.style.color = "var(--text-muted)"
    labelEl.style.fontSize = "0.75rem"
    labelEl.textContent = label
    calendarGrid.appendChild(labelEl)
  })

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarGrid.appendChild(document.createElement("div"))
  }

  // Add days
  const today = new Date()
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement("button")
    dayEl.className = "calendar-day"
    dayEl.textContent = day

    const date = new Date(year, month, day)
    const dateStr = date.toDateString()
    dayEl.dataset.date = dateStr // Add data-date attribute

    if (dateStr === today.toDateString()) {
      dayEl.classList.add("today")
    }

    // Add session count coloring
    if (stats.dailyData && stats.dailyData[dateStr]) {
      const sessionCount = stats.dailyData[dateStr]
      if (sessionCount >= 5) {
        dayEl.style.background = "var(--success)"
      } else if (sessionCount >= 3) {
        dayEl.style.opacity = "0.7"
        dayEl.style.background = "var(--accent)"
      } else if (sessionCount >= 1) {
        dayEl.style.background = "var(--accent)"
      }
    }

    calendarGrid.appendChild(dayEl)
  }
}

function prevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1)
  updateCalendarDisplay()
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1)
  updateCalendarDisplay()
}

function toggleCalendar() {
  calendarVisible = !calendarVisible
  const calendarSection = document.getElementById("calendarSection")
  const mainContent = document.getElementById("mainContent")

  if (calendarVisible) {
    calendarSection.classList.remove("hidden")
    mainContent.classList.add("with-calendar")
    mainContent.classList.remove("timer-only")
  } else {
    calendarSection.classList.add("hidden")
    mainContent.classList.remove("with-calendar")
    mainContent.classList.add("timer-only")
  }
}

// Todo Management
function loadTodos() {
  const savedTodos = localStorage.getItem("tymodoro-todos")
  const todayKey = new Date().toDateString()

  if (savedTodos) {
    const todoData = JSON.parse(savedTodos)
    if (todoData.date === todayKey) {
      todos = todoData.todos || []
    } else {
      todos = []
      saveTodos()
    }
  }
}

function saveTodos() {
  const todayKey = new Date().toDateString()
  const todoData = {
    date: todayKey,
    todos: todos,
  }
  localStorage.setItem("tymodoro-todos", JSON.stringify(todoData))
}

function addTodo() {
  const input = document.getElementById("todoInput")
  const priority = document.getElementById("todoPriority").value
  const text = input.value.trim()

  if (text === "") return

  const todo = {
    id: Date.now(),
    text: text,
    priority: priority,
    completed: false,
    createdAt: new Date().toISOString(),
  }

  todos.unshift(todo)
  input.value = ""

  saveTodos()
  renderTodos()
  updateTodoProgress()
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id)
  if (todo) {
    todo.completed = !todo.completed
    saveTodos()
    renderTodos()
    updateTodoProgress()
  }
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id)
  saveTodos()
  renderTodos()
  updateTodoProgress()
}

function clearCompleted() {
  todos = todos.filter((t) => !t.completed)
  saveTodos()
  renderTodos()
  updateTodoProgress()
}

function renderTodos() {
  const todoList = document.getElementById("todoList")
  const filteredTodos = showCompleted ? todos : todos.filter((t) => !t.completed)

  if (filteredTodos.length === 0) {
    const emptyMessage = showCompleted
      ? "No tasks for today yet.<br>Add your first task to get started!"
      : "No active tasks.<br>Great job staying on top of things!"

    todoList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle"></i>
        <p>${emptyMessage}</p>
      </div>
    `
    lucide.createIcons()
    return
  }

  todoList.innerHTML = `
    <div class="completed-toggle" onclick="toggleCompletedVisibility()">
      <input type="checkbox" ${showCompleted ? "checked" : ""} readonly>
      <label>Show completed tasks</label>
    </div>
    ${filteredTodos
      .map(
        (todo, index) => `
      <div class="todo-item ${todo.completed ? "completed" : ""}" 
           draggable="true" 
           data-id="${todo.id}"
           data-index="${index}"
           ondragstart="handleDragStart(event)"
           ondragover="handleDragOver(event)"
           ondrop="handleDrop(event)"
           ondragend="handleDragEnd(event)">
        <div class="todo-priority-indicator ${todo.priority}"></div>
        <div class="todo-checkbox ${todo.completed ? "checked" : ""}" onclick="toggleTodo(${todo.id})">
          ${todo.completed ? '<i data-lucide="check"></i>' : ""}
        </div>
        ${
          editingTodoId === todo.id
            ? `
          <textarea class="todo-edit-input" 
                 id="editInput${todo.id}" maxlength="100"
                 onkeydown="handleEditKeydown(event, ${todo.id})"
                 onblur="cancelEdit()">${escapeHtml(todo.text)}</textarea>
        `
            : `
          <div class="todo-text" ondblclick="startEdit(${todo.id})">${escapeHtml(todo.text)}</div>
        `
        }
        <div class="todo-actions">
          ${
            editingTodoId === todo.id
              ? `
            <button class="todo-action-btn save" onclick="saveEdit(${todo.id})" title="Save">
              <i data-lucide="check"></i>
            </button>
            <button class="todo-action-btn cancel" onclick="cancelEdit()" title="Cancel">
              <i data-lucide="x"></i>
            </button>
          `
              : `
            <button class="todo-action-btn" onclick="addSubtask(${todo.id})" title="Add subtask">
              <i data-lucide="plus"></i>
            </button>
            <button class="todo-action-btn" onclick="startEdit(${todo.id})" title="Edit task">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="todo-action-btn" onclick="deleteTodo(${todo.id})" title="Delete task">
              <i data-lucide="trash-2"></i>
            </button>
          `
          }
        </div>
      </div>
      ${
        todo.subtasks && todo.subtasks.length > 0
          ? `
      <div class="subtasks-container">
        ${todo.subtasks
          .map(
            subtask => `
        <div class="subtask-item ${subtask.completed ? "completed" : ""}">
          <div class="subtask-checkbox ${subtask.completed ? "checked" : ""}" onclick="toggleSubtask(${todo.id}, ${subtask.id})">
            ${subtask.completed ? '<i data-lucide="check"></i>' : ""}
          </div>
          <span class="subtask-text">${escapeHtml(subtask.text)}</span>
          <button class="subtask-delete-btn" onclick="deleteSubtask(${todo.id}, ${subtask.id})">
            <i data-lucide="x"></i>
          </button>
        </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }
    `,
      )
      .join("")}
  `

  lucide.createIcons()
}

function updateTodoProgress() {
  const completed = todos.filter((t) => t.completed).length
  const total = todos.length
  const progressText = `${completed}/${total} completed`

  document.getElementById("todoProgress").textContent = progressText

  const clearBtn = document.getElementById("clearCompletedBtn")
  const hasCompleted = completed > 0
  clearBtn.disabled = !hasCompleted
  clearBtn.style.opacity = hasCompleted ? "1" : "0.5"
}

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

function addSubtask(parentTodoId) {
  const todo = todos.find(t => t.id === parentTodoId)
  if (!todo) return
  
  if (!todo.subtasks) todo.subtasks = []
  
  const subtaskText = prompt("Add a subtask:")
  if (!subtaskText || subtaskText.trim() === "") return
  
  const subtask = {
    id: Date.now(),
    text: subtaskText.trim(),
    completed: false
  }
  
  todo.subtasks.push(subtask)
  saveTodos()
  renderTodos()
}

function toggleSubtask(parentTodoId, subtaskId) {
  const todo = todos.find(t => t.id === parentTodoId)
  if (!todo || !todo.subtasks) return
  
  const subtask = todo.subtasks.find(s => s.id === subtaskId)
  if (subtask) {
    subtask.completed = !subtask.completed
    saveTodos()
    renderTodos()
  }
}

function deleteSubtask(parentTodoId, subtaskId) {
  const todo = todos.find(t => t.id === parentTodoId)
  if (!todo || !todo.subtasks) return
  
  todo.subtasks = todo.subtasks.filter(s => s.id !== subtaskId)
  saveTodos()
  renderTodos()
}

function setupCalendarDayClick() {
  document.querySelectorAll(".calendar-day").forEach(day => {
    day.addEventListener("click", function() {
      const dateStr = this.dataset.date
      if (dateStr) {
        showTasksForDate(dateStr)
      }
    })
  })
}

function showTasksForDate(dateStr) {
  // Find tasks for this date or show option to add new task
  closeAllPanels()
  document.getElementById("modalTitle").textContent = `Tasks for ${new Date(dateStr).toLocaleDateString()}`
  document.getElementById("modalContent").innerHTML = `
    <div class="date-tasks">
      <p style="color: var(--text-muted); margin-bottom: 1rem;">Click "Go to Todo List" to manage tasks for this date.</p>
      <button class="apply-btn" onclick="goToTodoListTab()">Go to Todo List</button>
    </div>
  `
  document.getElementById("modalOverlay").style.display = "flex"
}

function goToTodoListTab() {
  hideModal()
  toggleTodoList()
}


async function toggleTimer() {
  if (!isRunning && currentSession === "work" && !selectedSessionTask) {
    // If starting a new work session without a selected task, show mode selector
    showSessionMode()
    return
  }
  
  // ... existing timer code ...
  if (isRunning) {
    clearInterval(timerInterval)
    pausedTime += Date.now() - startTime
    setIsRunning(false)
  } else {
    await requestNotificationPermission()
    startTime = Date.now()
    sessionData.startTime = Date.now()
    sessionData.sessionType = currentSession

    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime + pausedTime) / 1000)
      timeLeft = totalTime - elapsed
      updateDisplay()

      if (timeLeft <= 0) {
        clearInterval(timerInterval)
        setIsRunning(false)
        pausedTime = 0
        playBeep(1000, 800)
        completeSession()
      }
    }, 100)
    setIsRunning(true)
  }
  updateFloatingWindow() // Sync after state change
}

function setIsRunning(running) {
  isRunning = running
  const playIcon = document.getElementById("playIcon")
  const floatingPlayIcon = document.getElementById("floatingPlayIcon")
  const timerStatus = document.getElementById("timerStatus")

  if (running) {
    playIcon.setAttribute("data-lucide", "pause")
    if (floatingPlayIcon) floatingPlayIcon.setAttribute("data-lucide", "pause")
    timerStatus.textContent = "In Progress"
  } else {
    playIcon.setAttribute("data-lucide", "play")
    if (floatingPlayIcon) floatingPlayIcon.setAttribute("data-lucide", "play")
    timerStatus.textContent = "Ready to Start"
  }
  lucide.createIcons()
}

function completeSession() {
  if (currentSession === "work") {
    sessionCount++
    stats.totalSessions++
    stats.weekSessions++
    stats.monthSessions++
    stats.todaySessions++
    stats.totalMinutes += settings.focusTime

    const today = new Date().toDateString()
    if (!stats.dailyData) stats.dailyData = {}
    stats.dailyData[today] = (stats.dailyData[today] || 0) + 1

    showNotification("TYMODORO", `Amazing! You completed a ${settings.focusTime}-minute deep focus session!`)

    if (sessionCount % settings.longBreakAfter === 0) {
      setSession("longBreak")
    } else {
      setSession("shortBreak")
    }
  } else {
    const breakType = currentSession === "shortBreak" ? "Quick" : "Extended"
    const breakTime = currentSession === "shortBreak" ? settings.shortBreakTime : settings.longBreakTime
    showNotification(
      "TYMODORO",
      `Great! You completed your ${breakTime}-minute ${breakType.toLowerCase()} recharge break!`,
    )
    setSession("work")
  }
  saveStats()
  updateCalendarDisplay()
  // Reset task selection after a work session
  selectedSessionTask = null
  sessionMode = "quick"
}

function setSession(session) {
  currentSession = session
  
  // Reset task selection if switching to break or if not starting a work session with a selected task
  if (session !== "work" || !selectedSessionTask) {
      selectedSessionTask = null
      sessionMode = "quick"
  }

  const sessionLabel = document.getElementById("sessionLabel")
  const floatingLabel = document.getElementById("floatingSessionLabel")

  startTime = null
  pausedTime = 0

  if (session === "work") {
    timeLeft = settings.focusTime * 60
    totalTime = settings.focusTime * 60
    
    // Use selected task if available
    if (selectedSessionTask) {
        sessionLabel.textContent = selectedSessionTask.text
        if (floatingLabel) floatingLabel.textContent = selectedSessionTask.text.substring(0, 15)
    } else {
        sessionLabel.textContent = "Deep Focus Session"
        if (floatingLabel) floatingLabel.textContent = "Deep Focus"
    }
  } else if (session === "shortBreak") {
    timeLeft = settings.shortBreakTime * 60
    totalTime = settings.shortBreakTime * 60
    sessionLabel.textContent = "Quick Recharge"
    if (floatingLabel) floatingLabel.textContent = "Break"
  } else {
    timeLeft = settings.longBreakTime * 60
    totalTime = settings.longBreakTime * 60
    sessionLabel.textContent = "Extended Break"
    if (floatingLabel) floatingLabel.textContent = "Break"
  }
  updateDisplay()
  updateFloatingWindow() // Sync after session change
}

function resetTimer() {
  clearInterval(timerInterval)
  setIsRunning(false)
  setSession(currentSession)
}

function skipSession() {
  const percentComplete = ((totalTime - timeLeft) / totalTime) * 100

  if (currentSession === "work" && percentComplete < 90) {
    // Show confirmation modal
    document.getElementById("sessionPercent").textContent = Math.round(percentComplete)
    document.getElementById("skipModalOverlay").style.display = "flex"
  } else {
    // Session meets threshold or is a break, skip directly
    clearInterval(timerInterval)
    setIsRunning(false)
    completeSession()
  }
}

function handleSkipConfirm(event) {
  if (event && event.target !== event.currentTarget) return
  cancelSkip()
}

function confirmSkip() {
  document.getElementById("skipModalOverlay").style.display = "none"
  clearInterval(timerInterval)
  setIsRunning(false)
  // Session skipped without counting
  setSession(currentSession)
}

function cancelSkip() {
  document.getElementById("skipModalOverlay").style.display = "none"
}

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const displayText = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

  document.getElementById("timerDisplay").textContent = displayText
  document.getElementById("floatingTimerTime").textContent = displayText

  const progress = ((totalTime - timeLeft) / totalTime) * 100
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (progress / 100) * circumference
  document.getElementById("progressCircle").style.strokeDashoffset = offset
  updateFloatingWindow() // Sync timer state with floating window
}

// Sound Functions
function playBeep(frequency = 800, duration = 500) {
  if (!soundEnabled || !audioContext) return

  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = frequency
    oscillator.type = "sine"

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration / 1000)
  } catch (error) {
    console.error("Error playing beep:", error)
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled
  const indicator = document.getElementById("soundIndicator")
  const icon = indicator.querySelector("i")

  if (soundEnabled) {
    indicator.classList.remove("muted")
    icon.setAttribute("data-lucide", "bell")
  } else {
    indicator.classList.add("muted")
    icon.setAttribute("data-lucide", "bell-off")
  }
  lucide.createIcons()
}

// Modal Functions
function showStats() {
  closeAllPanels()

  const completedTodos = todos.filter((t) => t.completed).length
  const totalTodos = todos.length

  document.getElementById("modalTitle").textContent = "Statistics"
  document.getElementById("modalContent").innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${stats.totalSessions}</div>
        <div class="stat-label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.weekSessions}</div>
        <div class="stat-label">This Week</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.monthSessions}</div>
        <div class="stat-label">This Month</div>
      </div>
      <div class="stat-card">
        <i data-lucide="clock" style="margin: 0 auto 0.5rem; display: block; width: 20px; height: 20px;"></i>
        <div class="stat-number">${stats.totalMinutes}</div>
        <div class="stat-label">Total Minutes</div>
      </div>
      <div class="stat-card">
        <i data-lucide="check-square" style="margin: 0 auto 0.5rem; display: block; width: 20px; height: 20px;"></i>
        <div class="stat-number">${completedTodos}</div>
        <div class="stat-label">Tasks Completed Today</div>
      </div>
      <div class="stat-card">
        <i data-lucide="list-todo" style="margin: 0 auto 0.5rem; display: block; width: 20px; height: 20px;"></i>
        <div class="stat-number">${totalTodos}</div>
        <div class="stat-label">Total Tasks Today</div>
      </div>
    </div>
  `
  document.getElementById("modalOverlay").style.display = "flex"
  lucide.createIcons()
}

function showSettings() {
  closeAllPanels()

  document.getElementById("modalTitle").textContent = "Settings"
  document.getElementById("modalContent").innerHTML = `
    <div class="setting-group">
      <label class="setting-label" id="focusLabel">Focus Session: ${settings.focusTime} minutes</label>
      <input type="range" class="slider" min="1" max="60" value="${settings.focusTime}" 
             oninput="updateSetting('focusTime', this.value)" id="focusSlider">
    </div>
    <div class="setting-group">
      <label class="setting-label" id="shortBreakLabel">Quick Break: ${settings.shortBreakTime} minutes</label>
      <input type="range" class="slider" min="1" max="30" value="${settings.shortBreakTime}" 
             oninput="updateSetting('shortBreakTime', this.value)" id="shortBreakSlider">
    </div>
    <div class="setting-group">
      <label class="setting-label" id="longBreakLabel">Extended Break: ${settings.longBreakTime} minutes</label>
      <input type="range" class="slider" min="1" max="60" value="${settings.longBreakTime}" 
             oninput="updateSetting('longBreakTime', this.value)" id="longBreakSlider">
    </div>
    <div class="setting-group">
      <label class="setting-label" id="longBreakAfterLabel">Sessions until Extended Break: ${settings.longBreakAfter}</label>
      <input type="range" class="slider" min="1" max="10" value="${settings.longBreakAfter}" 
             oninput="updateSetting('longBreakAfter', this.value)" id="longBreakAfterSlider">
    </div>
    <button class="apply-btn" onclick="applySettings()">Apply Settings</button>
  `
  document.getElementById("modalOverlay").style.display = "flex"
}

function showAbout() {
  closeAllPanels()

  document.getElementById("modalTitle").textContent = "About"
  document.getElementById("modalContent").innerHTML = `
    <div class="about-content">
      <h3>Created by Dewan Shahariar Hossen</h3>
      <p>A passionate developer who believes in the power of focused work and mindful breaks. This Pomodoro timer is designed to help you achieve your goals with style and efficiency!</p>
      
      <div class="contact-links">
        <a href="https://www.linkedin.com/in/dewan-shahariar" target="_blank" class="contact-link">
          <i data-lucide="linkedin"></i>
          LinkedIn Profile
        </a>
        <a href="mailto:shahariar.professional@gmail.com" class="contact-link">
          <i data-lucide="mail"></i>
          Email Me
        </a>
      </div>
      
      <div class="motivational-message">
        <p>"Every great achievement starts with a single focused session. You've got this! Keep pushing forward, one Pomodoro at a time!"</p>
      </div>
    </div>
  `
  document.getElementById("modalOverlay").style.display = "flex"
  lucide.createIcons()
}

function updateSetting(key, value) {
  settings[key] = Number.parseInt(value)

  const labelMap = {
    focusTime: "focusLabel",
    shortBreakTime: "shortBreakLabel",
    longBreakTime: "longBreakLabel",
    longBreakAfter: "longBreakAfterLabel",
  }

  const labelId = labelMap[key]
  const label = document.getElementById(labelId)

  if (label) {
    const labelText = {
      focusTime: "Focus Session",
      shortBreakTime: "Quick Break",
      longBreakTime: "Extended Break",
      longBreakAfter: "Sessions until Extended Break",
    }

    const unit = key === "longBreakAfter" ? "" : " minutes"
    label.textContent = `${labelText[key]}: ${value}${unit}`
  }
}

function applySettings() {
  saveSettings()
  if (!isRunning) {
    setSession(currentSession)
  }
  hideModal()
}

function hideModal(event) {
  if (event && event.target !== event.currentTarget) return
  document.getElementById("modalOverlay").style.display = "none"
}

function showFloatingWidget() {
  floatingWidgetVisible = !floatingWidgetVisible
  const widget = document.getElementById("floatingWidget")

  if (floatingWidgetVisible) {
    widget.classList.add("active")
  } else {
    widget.classList.remove("active")
  }
}

function closeFloatingWidget() {
  floatingWidgetVisible = false
  document.getElementById("floatingWidget").classList.remove("active")
}

function toggleTimerFromWidget() {
  toggleTimer()
}

function skipSessionFromWidget() {
  skipSession()
}

function setupFloatingWidgetDrag() {
  const widget = document.getElementById("floatingWidget")
  const handle = widget.querySelector(".floating-widget-header")

  let startX = 0
  let startY = 0

  handle.style.cursor = "grab"
  handle.addEventListener("mousedown", (e) => {
    isDraggingWidget = true
    startX = e.clientX - widget.getBoundingClientRect().left
    startY = e.clientY - widget.getBoundingClientRect().top
    handle.style.cursor = "grabbing"
    widget.style.transition = "none"
  })

  document.addEventListener("mousemove", (e) => {
    if (isDraggingWidget) {
      const newX = e.clientX - startX
      const newY = e.clientY - startY

      const maxX = window.innerWidth - widget.offsetWidth
      const maxY = window.innerHeight - widget.offsetHeight

      widget.style.right = "auto"
      widget.style.bottom = "auto"
      widget.style.left = Math.max(0, Math.min(newX, maxX)) + "px"
      widget.style.top = Math.max(0, Math.min(newY, maxY)) + "px"
    }
  })

  document.addEventListener("mouseup", () => {
    isDraggingWidget = false
    handle.style.cursor = "grab"
    widget.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  })
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.target.matches("input, textarea")) {
    e.preventDefault()
    toggleTimer()
  } else if (e.code === "KeyR" && !e.target.matches("input, textarea")) {
    e.preventDefault()
    resetTimer()
  } else if (e.code === "Escape") {
    hideModal()
    hideThemeSelector()
    hideSessionMode() // Close session mode on escape
    hideTaskSelector() // Close task selector on escape
  }
})

function handleVisibilityChange() {
  isTabVisible = !document.hidden

  if (isRunning) {
    if (isTabVisible) {
      const elapsed = Math.floor((Date.now() - startTime + pausedTime) / 1000)
      timeLeft = totalTime - elapsed
      updateDisplay()

      if (timeLeft <= 0) {
        clearInterval(timerInterval)
        setIsRunning(false)
        pausedTime = 0
        playBeep(1000, 800)
        completeSession()
      }
    }
  }
}

function toggleCompletedVisibility() {
  showCompleted = !showCompleted
  renderTodos()
  updateTodoProgress()
}

function startEdit(id) {
  editingTodoId = id
  renderTodos()
  setTimeout(() => {
    const input = document.getElementById(`editInput${id}`)
    if (input) {
      input.focus()
      input.select()
    }
  }, 0)
}

function saveEdit(id) {
  const input = document.getElementById(`editInput${id}`)
  const newText = input.value.trim()

  if (newText === "") {
    cancelEdit()
    return
  }

  const todo = todos.find((t) => t.id === id)
  if (todo) {
    todo.text = newText
    saveTodos()
  }

  editingTodoId = null
  renderTodos()
}

function cancelEdit() {
  editingTodoId = null
  renderTodos()
}

function handleEditKeydown(event, id) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    saveEdit(id)
  } else if (event.key === "Escape") {
    cancelEdit()
  }
}

// Drag and drop
let draggedElement = null

function handleDragStart(event) {
  draggedElement = event.target
  event.target.classList.add("dragging")
  event.dataTransfer.effectAllowed = "move"
  event.dataTransfer.setData("text/html", event.target.outerHTML)
}

function handleDragOver(event) {
  event.preventDefault()
  event.dataTransfer.dropEffect = "move"

  const afterElement = getDragAfterElement(event.currentTarget.parentNode, event.clientY)
  const dragging = document.querySelector(".dragging")

  if (afterElement == null) {
    event.currentTarget.parentNode.appendChild(dragging)
  } else {
    event.currentTarget.parentNode.insertBefore(dragging, afterElement)
  }
}

function handleDrop(event) {
  event.preventDefault()

  const draggedId = Number.parseInt(draggedElement.dataset.id)
  const targetElement = event.target.closest(".todo-item")
  if (!targetElement) return // Handle cases where drop target is not a todo-item

  const targetId = Number.parseInt(targetElement.dataset.id)

  if (draggedId !== targetId) {
    reorderTodos(draggedId, targetId)
  }
}

function handleDragEnd(event) {
  event.target.classList.remove("dragging")
  draggedElement = null
  renderTodos()
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".todo-item:not(.dragging)")]

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child }
      } else {
        return closest
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element
}

function reorderTodos(draggedId, targetId) {
  const draggedIndex = todos.findIndex((t) => t.id === draggedId)
  const targetIndex = todos.findIndex((t) => t.id === targetId)

  if (draggedIndex > -1 && targetIndex > -1) {
    const [draggedTodo] = todos.splice(draggedIndex, 1)
    todos.splice(targetIndex, 0, draggedTodo)
    saveTodos()
    renderTodos()
  }
}

function toggleTodoList() {
  todoListVisible = !todoListVisible
  updateTodoListLayout()

  const toggleBtn = document.getElementById("todoToggleBtn")
  const icon = toggleBtn.querySelector("i")

  if (todoListVisible) {
    icon.setAttribute("data-lucide", "list-todo")
    toggleBtn.classList.remove("active")
  } else {
    icon.setAttribute("data-lucide", "list-x")
    toggleBtn.classList.add("active")
  }

  lucide.createIcons()
}

function updateTodoListLayout() {
  const mainContent = document.getElementById("mainContent")
  const todoSection = document.getElementById("todoSection")

  if (todoListVisible) {
    todoSection.classList.remove("hidden")
    mainContent.classList.add("with-todos")
    mainContent.classList.remove("timer-only")
  } else {
    todoSection.classList.add("hidden")
    mainContent.classList.remove("with-todos")
    mainContent.classList.add("timer-only")
  }
}

// White Noise Functions
function toggleWhiteNoise() {
  const controls = document.getElementById("whiteNoiseControls")
  const btn = document.getElementById("whiteNoiseBtn")

  if (controls.style.display === "none" || !controls.style.display) {
    closeAllPanels()
    controls.style.display = "block"
    btn.classList.add("active")
  } else {
    controls.style.display = "none"
    btn.classList.remove("active")

    if (whiteNoiseEnabled && currentNoise) {
      currentNoise.stop()
      currentNoise = null
      whiteNoiseEnabled = false
      updateWhiteNoiseButton()
    }
  }

  updateWhiteNoiseButton()
}

function switchNoiseTab(tab) {
  currentNoiseTab = tab

  document.querySelectorAll(".noise-tab").forEach((tabBtn) => {
    tabBtn.classList.remove("active")
  })
  document.getElementById(tab + "Tab").classList.add("active")

  document.querySelectorAll(".noise-content").forEach((content) => {
    content.classList.add("hidden")
  })
  document.getElementById(tab + "Content").classList.remove("hidden")

  if (currentNoise) {
    currentNoise.stop()
    currentNoise = null
    whiteNoiseEnabled = false
    updateWhiteNoiseButton()

    document.querySelectorAll(".noise-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
  }
}

function selectNoise(noiseType) {
  if (!audioContext) {
    initAudioContext()
  }

  if (currentNoise) {
    currentNoise.stop()
    currentNoise = null
  }

  document.querySelectorAll(".noise-btn").forEach((btn) => {
    btn.classList.remove("active")
  })

  const selectedBtn = document.querySelector(`[data-sound="${noiseType}"]`)

  if (whiteNoiseEnabled && selectedBtn.classList.contains("active")) {
    whiteNoiseEnabled = false
    updateWhiteNoiseButton()
    return
  }

  selectedBtn.classList.add("active")
  whiteNoiseEnabled = true

  currentNoise = noiseGenerators[noiseType]()
  updateWhiteNoiseButton()
}

function updateNoiseVolume(value) {
  noiseVolume = value / 100
  if (noiseGainNode) {
    noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime)
  }

  if (value == 0 && whiteNoiseEnabled) {
    if (currentNoise) {
      currentNoise.stop()
      currentNoise = null
    }
    whiteNoiseEnabled = false
    updateWhiteNoiseButton()

    document.querySelectorAll(".noise-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
  }
}

function updateWhiteNoiseButton() {
  const btn = document.getElementById("whiteNoiseBtn")

  if (whiteNoiseEnabled) {
    btn.classList.add("active")
  } else {
    btn.classList.remove("active")
  }

  lucide.createIcons()
}

// Enhanced White Noise Generators
function generateStormSound() {
  const bufferSize = audioContext.sampleRate * 3
  const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  for (let i = 0; i < bufferSize; i++) {
    const rain = (Math.random() * 2 - 1) * 0.3
    const thunder = Math.random() > 0.998 ? (Math.random() * 2 - 1) * 0.8 : 0
    const wind = Math.sin(i * 0.001) * 0.2

    leftChannel[i] = rain + thunder + wind
    rightChannel[i] = rain + thunder * 0.8 + wind * 0.9
  }

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true

  noiseGainNode = audioContext.createGain()
  noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime)

  const filter = audioContext.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.setValueAtTime(600, audioContext.currentTime)

  source.connect(filter)
  filter.connect(noiseGainNode)
  noiseGainNode.connect(audioContext.destination)

  source.start()
  return source
}

function generateForestSound() {
  const bufferSize = audioContext.sampleRate * 4
  const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  for (let i = 0; i < bufferSize; i++) {
    const birds = Math.random() > 0.995 ? Math.sin(i * 0.1) * 0.3 : 0
    const leaves = (Math.random() * 2 - 1) * 0.1 * Math.sin(i * 0.002)
    const water = Math.sin(i * 0.005) * 0.05

    leftChannel[i] = birds + leaves + water
    rightChannel[i] = birds * 0.8 + leaves * 1.1 + water
  }

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true

  noiseGainNode = audioContext.createGain()
  noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime)

  const filter = audioContext.createBiquadFilter()
  filter.type = "bandpass"
  filter.frequency.setValueAtTime(800, audioContext.currentTime)
  filter.Q.setValueAtTime(0.5, audioContext.currentTime)

  source.connect(filter)
  filter.connect(noiseGainNode)
  noiseGainNode.connect(audioContext.destination)

  source.start()
  return source
}

function generateOceanSound() {
  const bufferSize = audioContext.sampleRate * 6
  const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  for (let i = 0; i < bufferSize; i++) {
    const wave1 = Math.sin(i * 0.008) * 0.4
    const wave2 = Math.sin(i * 0.012) * 0.3
    const foam = (Math.random() * 2 - 1) * 0.15

    leftChannel[i] = wave1 + wave2 + foam
    rightChannel[i] = wave1 * 0.9 + wave2 * 1.1 + foam * 0.8
  }

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true

  noiseGainNode = audioContext.createGain()
  noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime)

  const filter = audioContext.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.setValueAtTime(400, audioContext.currentTime)

  source.connect(filter)
  filter.connect(noiseGainNode)
  noiseGainNode.connect(audioContext.destination)

  source.start()
  return source
}

function generateCoffeeShopSound() {
  const bufferSize = audioContext.sampleRate * 3
  const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  for (let i = 0; i < bufferSize; i++) {
    const chatter = Math.sin(i * 0.003) * 0.15
    const machine = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.4 : 0
    const ambience = (Math.random() * 2 - 1) * 0.1

    leftChannel[i] = chatter + machine + ambience
    rightChannel[i] = chatter * 0.9 + machine * 0.7 + ambience * 1.1
  }

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true

  noiseGainNode = audioContext.createGain()
  noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime)

  const filter = audioContext.createBiquadFilter()
  filter.type = "bandpass"
  filter.frequency.setValueAtTime(1200, audioContext.currentTime)
  filter.Q.setValueAtTime(1, audioContext.currentTime)

  source.connect(filter)
  filter.connect(noiseGainNode)
  noiseGainNode.connect(audioContext.destination)

  source.start()
  return source
}

function generateFireSound() {
  const bufferSize = audioContext.sampleRate * 3
  const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  for (let i = 0; i < bufferSize; i++) {
    const crackle = Math.random() > 0.99 ? (Math.random() * 2 - 1) * 0.5 : 0
    const base = (Math.random() * 2 - 1) * 0.08
    const pop = Math.random() > 0.999 ? (Math.random() * 2 - 1) * 0.3 : 0

    leftChannel[i] = crackle + base + pop
    rightChannel[i] = crackle * 0.8 + base * 1.1 + pop * 0.9
  }

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true

  noiseGainNode = audioContext.createGain()
  noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime)

  const filter = audioContext.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.setValueAtTime(250, audioContext.currentTime)

  source.connect(filter)
  filter.connect(noiseGainNode)
  noiseGainNode.connect(audioContext.destination)

  source.start()
  return source
}

function generateWindSound() {
  const bufferSize = audioContext.sampleRate * 4
  const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  for (let i = 0; i < bufferSize; i++) {
    const wind1 = Math.sin(i * 0.001) * 0.3
    const wind2 = Math.sin(i * 0.0015) * 0.2
    const highWind = (Math.random() * 2 - 1) * 0.12

    leftChannel[i] = wind1 + wind2 + highWind
    rightChannel[i] = wind1 * 0.9 + wind2 * 1.1 + highWind * 0.8
  }

  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true

  noiseGainNode = audioContext.createGain()
  noiseGainNode.gain.setValueAtTime(noiseVolume, audioContext.currentTime)

  const filter = audioContext.createBiquadFilter()
  filter.type = "highpass"
  filter.frequency.setValueAtTime(150, audioContext.currentTime)

  source.connect(filter)
  filter.connect(noiseGainNode)
  noiseGainNode.connect(audioContext.destination)

  source.start()
  return source
}

function generateBinauralBeat(frequency) {
  const baseFreq = 200
  const leftFreq = baseFreq
  const rightFreq = baseFreq + frequency

  const leftOsc = audioContext.createOscillator()
  const rightOsc = audioContext.createOscillator()

  const leftGain = audioContext.createGain()
  const rightGain = audioContext.createGain()
  const merger = audioContext.createChannelMerger(2)

  noiseGainNode = audioContext.createGain()
  noiseGainNode.gain.setValueAtTime(noiseVolume * 0.3, audioContext.currentTime)

  leftOsc.frequency.setValueAtTime(leftFreq, audioContext.currentTime)
  rightOsc.frequency.setValueAtTime(rightFreq, audioContext.currentTime)

  leftOsc.type = "sine"
  rightOsc.type = "sine"

  leftGain.gain.setValueAtTime(1, audioContext.currentTime)
  rightGain.gain.setValueAtTime(1, audioContext.currentTime)

  leftOsc.connect(leftGain)
  leftGain.connect(merger, 0, 0)

  rightOsc.connect(rightGain)
  rightGain.connect(merger, 0, 1)

  merger.connect(noiseGainNode)
  noiseGainNode.connect(audioContext.destination)

  leftOsc.start()
  rightOsc.start()

  return {
    stop: () => {
      leftOsc.stop()
      rightOsc.stop()
    },
  }
}

function closeAllPanels() {
  document.getElementById("themeSelector").style.display = "none"
  document.getElementById("whiteNoiseControls").style.display = "none"
  document.getElementById("modalOverlay").style.display = "none"
  document.getElementById("skipModalOverlay").style.display = "none"
}

function openFloatingWindow() {
  const width = 380
  const height = 480
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  floatingWindow = window.open(
    "float-timer.html",
    "TYMODOROTimer",
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,menubar=no,toolbar=no,location=no,status=no`,
  )

  if (!floatingWindow) {
    alert("Could not open floating timer. Make sure pop-ups are enabled.")
  }
}

function updateFloatingWindow() {
  if (floatingWindow && !floatingWindow.closed) {
    floatingWindow.postMessage(
      {
        type: "updateTimer",
        timeLeft: timeLeft,
        totalTime: totalTime,
        currentSession: currentSession,
        isRunning: isRunning,
      },
      "*",
    )
  }
}

window.addEventListener("message", (event) => {
  if (event.data.type === "sessionComplete") {
    completeSession()
  } else if (event.data.type === "skipSession") {
    skipSession()
  } else if (event.data.type === "requestSync") {
    updateFloatingWindow()
  }
})

function showSessionMode() {
  document.getElementById("sessionModeOverlay").style.display = "flex"
}

function hideSessionMode() {
  document.getElementById("sessionModeOverlay").style.display = "none"
}

function handleSessionModeConfirm(event) {
  if (event && event.target !== event.currentTarget) return
}

function startQuickSession() {
  selectedSessionTask = null
  sessionMode = "quick"
  setSession("work")
  hideSessionMode()
  updateSessionLabel()
}

function showTaskSelector() {
  const activeTodos = todos.filter(t => !t.completed)
  let content = `
    <div class="task-list">
  `
  
  if (activeTodos.length === 0) {
    content += '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No active tasks. Start a quick session instead!</p>'
  } else {
    content += activeTodos
      .map(task => `
        <button class="task-select-btn" onclick="selectTaskForSession(${task.id}, '${escapeHtml(task.text)}')">
          <i data-lucide="check"></i>
          <span>${escapeHtml(task.text)}</span>
        </button>
      `)
      .join("")
  }
  
  content += '</div>'
  document.getElementById("taskSelectorContent").innerHTML = content
  document.getElementById("taskSelectorOverlay").style.display = "flex"
  lucide.createIcons()
}

function hideTaskSelector() {
  document.getElementById("taskSelectorOverlay").style.display = "none"
}

function handleTaskSelectorConfirm(event) {
  if (event && event.target !== event.currentTarget) return
}

function selectTaskForSession(taskId, taskText) {
  selectedSessionTask = { id: taskId, text: taskText }
  sessionMode = "task"
  setSession("work")
  hideTaskSelector()
  hideSessionMode()
  updateSessionLabel()
}

function updateSessionLabel() {
  const sessionLabel = document.getElementById("sessionLabel")
  const floatingLabel = document.getElementById("floatingSessionLabel")
  
  if (sessionMode === "task" && selectedSessionTask) {
    sessionLabel.textContent = selectedSessionTask.text
    if (floatingLabel) floatingLabel.textContent = selectedSessionTask.text.substring(0, 15)
  } else {
    sessionLabel.textContent = "Deep Focus Session"
    if (floatingLabel) floatingLabel.textContent = "Deep Focus"
  }
}
