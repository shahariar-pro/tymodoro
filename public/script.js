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
const currentDate = new Date() // For calendar month/year navigation
let currentCalendarDate = new Date() // For selected date's todos
let floatingWindow = null 
let currentTaskId = null // ID of the task linked to the timer

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
let allTodos = {} // Store all todos, keyed by date string

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
  loadTodos() // This will now load todos for the current date
  loadTheme()
  updateDisplay()
  renderTodos()
  updateTodoProgress()
  updateTodoListLayout()
  initializeCalendar()

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
  updateFloatingWindow() // Send theme change to floating window
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

function showThemeSelector() {
  closeAllPanels()
  document.getElementById("themeSelector").style.display = "block"
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
  const selectedDateStr = currentCalendarDate.toDateString()

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement("button")
    dayEl.className = "calendar-day"
    dayEl.textContent = day

    const date = new Date(year, month, day)
    const dateStr = date.toDateString()

    if (dateStr === today.toDateString()) {
      dayEl.classList.add("today")
    }
    
    if (dateStr === selectedDateStr) {
      dayEl.classList.add("active")
    }
    
    dayEl.onclick = () => selectCalendarDate(date)

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

function selectCalendarDate(date) {
    currentCalendarDate = date
    updateCalendarDisplay() // Re-render calendar to show 'active' date
    renderTodos() // Re-render todo list for the selected date
    updateTodoProgress()
    
    // Update todo list title
    const todoTitle = document.getElementById("todoTitle")
    const todayStr = new Date().toDateString()
    if (date.toDateString() === todayStr) {
        todoTitle.innerHTML = `<i data-lucide="check-square"></i> Today's Focus`
    } else {
        todoTitle.innerHTML = `<i data-lucide="check-square"></i> Focus for ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    lucide.createIcons()
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
  const savedTodos = localStorage.getItem("tymodoro-all-todos")
  if (savedTodos) {
    allTodos = JSON.parse(savedTodos)
  }
  // Ensure current date has an entry if it doesn't
  const dateKey = currentCalendarDate.toDateString()
  if (!allTodos[dateKey]) {
      allTodos[dateKey] = []
  }
}

function saveTodos() {
  localStorage.setItem("tymodoro-all-todos", JSON.stringify(allTodos))
}

function getTodosForCurrentDate() {
    const dateKey = currentCalendarDate.toDateString()
    if (!allTodos[dateKey]) {
        allTodos[dateKey] = []
    }
    return allTodos[dateKey]
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
    subtasks: [] // Add subtasks array
  }

  const todos = getTodosForCurrentDate()
  todos.unshift(todo)

  input.value = ""
  saveTodos()
  renderTodos()
  updateTodoProgress()
}

function toggleTodo(id) {
  const todos = getTodosForCurrentDate()
  const todo = todos.find((t) => t.id === id)
  if (todo) {
    todo.completed = !todo.completed
    saveTodos()
    renderTodos()
    updateTodoProgress()
  }
}

function deleteTodo(id) {
  const dateKey = currentCalendarDate.toDateString()
  allTodos[dateKey] = allTodos[dateKey].filter((t) => t.id !== id)
  
  if (currentTaskId === id) {
      currentTaskId = null // Deselect if deleted
      updateSessionLabel()
  }
  
  saveTodos()
  renderTodos()
  updateTodoProgress()
}

function clearCompleted() {
  const dateKey = currentCalendarDate.toDateString()
  allTodos[dateKey] = allTodos[dateKey].filter((t) => !t.completed)
  
  if (currentTaskId && !allTodos[dateKey].find(t => t.id === currentTaskId)) {
      currentTaskId = null // Deselect if cleared
      updateSessionLabel()
  }

  saveTodos()
  renderTodos()
  updateTodoProgress()
}

function addSubtask(parentId) {
    const input = document.getElementById(`subtaskInput${parentId}`)
    const text = input.value.trim()
    if (text === "") return

    const subtask = {
        id: Date.now(),
        text: text,
        completed: false
    }

    const todos = getTodosForCurrentDate()
    const parentTodo = todos.find(t => t.id === parentId)
    if (parentTodo) {
        parentTodo.subtasks.push(subtask)
        saveTodos()
        renderTodos() // Re-render to show new subtask
    }
}

function toggleSubtask(parentId, subtaskId) {
    const todos = getTodosForCurrentDate()
    const parentTodo = todos.find(t => t.id === parentId)
    if (parentTodo) {
        const subtask = parentTodo.subtasks.find(st => st.id === subtaskId)
        if (subtask) {
            subtask.completed = !subtask.completed
            saveTodos()
            renderTodos()
        }
    }
}

function deleteSubtask(parentId, subtaskId) {
    const todos = getTodosForCurrentDate()
    const parentTodo = todos.find(t => t.id === parentId)
    if (parentTodo) {
        parentTodo.subtasks = parentTodo.subtasks.filter(st => st.id !== subtaskId)
        saveTodos()
        renderTodos()
    }
}

function selectTask(id) {
    if (currentTaskId === id) {
        // Deselect if clicking the same task
        currentTaskId = null
    } else {
        currentTaskId = id
    }
    updateSessionLabel()
    renderTodos() // Re-render to show selection highlight
}

function updateSessionLabel() {
    const sessionLabel = document.getElementById("sessionLabel")
    let labelText = "Deep Focus Session" // Default

    if (currentSession === "shortBreak") {
        labelText = "Quick Recharge"
    } else if (currentSession === "longBreak") {
        labelText = "Extended Break"
    } else if (currentTaskId) {
        const todos = getTodosForCurrentDate()
        const task = todos.find(t => t.id === currentTaskId)
        if (task) {
            labelText = task.text
        }
    }
    
    sessionLabel.textContent = labelText
    updateFloatingWindow() // Sync label change
}


function renderTodos() {
  const todoList = document.getElementById("todoList")
  const todos = getTodosForCurrentDate()
  const filteredTodos = showCompleted ? todos : todos.filter((t) => !t.completed)

  if (filteredTodos.length === 0) {
    const emptyMessage = showCompleted
      ? "No tasks for this day yet.<br>Add your first task to get started!"
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
      <div class="todo-item-wrapper ${currentTaskId === todo.id ? 'selected' : ''}" 
           draggable="true" 
           data-id="${todo.id}"
           data-index="${index}"
           ondragstart="handleDragStart(event)"
           ondragover="handleDragOver(event)"
           ondrop="handleDrop(event)"
           ondragend="handleDragEnd(event)">
           
        <div class="todo-item">
          <div class="todo-priority-indicator ${todo.priority}"></div>
          <div class="todo-checkbox ${todo.completed ? "checked" : ""}" onclick="event.stopPropagation(); toggleTodo(${todo.id})">
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
            <div class="todo-text" onclick="selectTask(${todo.id})">${escapeHtml(todo.text)}</div>
          `
          }
          <div class="todo-actions">
            ${
              editingTodoId === todo.id
                ? `
              <button class="todo-action-btn save" onclick="event.stopPropagation(); saveEdit(${todo.id})" title="Save">
                <i data-lucide="check"></i>
              </button>
              <button class="todo-action-btn cancel" onclick="event.stopPropagation(); cancelEdit()" title="Cancel">
                <i data-lucide="x"></i>
              </button>
            `
                : `
              <button class="todo-action-btn" onclick="event.stopPropagation(); startEdit(${todo.id})" title="Edit task">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="todo-action-btn" onclick="event.stopPropagation(); deleteTodo(${todo.id})" title="Delete task">
                <i data-lucide="trash-2"></i>
              </button>
            `
            }
          </div>
        </div>
        
        <div class="subtask-list">
            ${todo.subtasks.map(st => `
                <div classclass="subtask-item ${st.completed ? 'completed' : ''}">
                    <div class="subtask-checkbox ${st.completed ? 'checked' : ''}" onclick="event.stopPropagation(); toggleSubtask(${todo.id}, ${st.id})">
                        ${st.completed ? '<i data-lucide="check" style="width: 12px; height: 12px;"></i>' : ''}
                    </div>
                    <span class="subtask-text">${escapeHtml(st.text)}</span>
                    <button class="subtask-delete-btn" onclick="event.stopPropagation(); deleteSubtask(${todo.id}, ${st.id})">
                        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                </div>
            `).join('')}
        </div>
        
        <div class="subtask-input-container">
            <input type="text" class="subtask-input" id="subtaskInput${todo.id}" placeholder="Add subtask..."
                   onkeydown="if(event.key === 'Enter') { event.preventDefault(); addSubtask(${todo.id}); }">
            <button class="add-subtask-btn" onclick="event.stopPropagation(); addSubtask(${todo.id})">
                <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
            </button>
        </div>
      </div>
    `,
      )
      .join("")}
  `

  lucide.createIcons()
}


function updateTodoProgress() {
  const todos = getTodosForCurrentDate()
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

async function toggleTimer() {
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
}

function setSession(session) {
  currentSession = session
  startTime = null
  pausedTime = 0

  if (session === "work") {
    timeLeft = settings.focusTime * 60
    totalTime = settings.focusTime * 60
  } else if (session === "shortBreak") {
    timeLeft = settings.shortBreakTime * 60
    totalTime = settings.shortBreakTime * 60
  } else {
    timeLeft = settings.longBreakTime * 60
    totalTime = settings.longBreakTime * 60
  }
  
  updateSessionLabel() // Update label based on new session
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
  
  const todos = getTodosForCurrentDate()
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
        <div class="stat-label">Tasks Completed (${currentCalendarDate.toLocaleDateString('en-US', {month: 'short', day:'numeric'})})</div>
      </div>
      <div class="stat-card">
        <i data-lucide="list-todo" style="margin: 0 auto 0.5rem; display: block; width: 20px; height: 20px;"></i>
        <div class="stat-number">${totalTodos}</div>
        <div class="stat-label">Total Tasks (${currentCalendarDate.toLocaleDateString('en-US', {month: 'short', day:'numeric'})})</div>
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
  if (e.code === "Space" && !e.target.matches("input, textarea, .subtask-input")) {
    e.preventDefault()
    toggleTimer()
  } else if (e.code === "KeyR" && !e.target.matches("input, textarea, .subtask-input")) {
    e.preventDefault()
    resetTimer()
  } else if (e.code === "Escape") {
    hideModal()
    hideThemeSelector()
    cancelEdit()
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
  
  const todos = getTodosForCurrentDate()
  const todo = todos.find((t) => t.id === id)
  if (todo) {
    todo.text = newText
    saveTodos()
    if (currentTaskId === id) {
        updateSessionLabel() // Update timer label if edited task is selected
    }
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
  draggedElement = event.target.closest('.todo-item-wrapper')
  event.target.classList.add("dragging")
  event.dataTransfer.effectAllowed = "move"
  event.dataTransfer.setData("text/html", event.target.outerHTML)
}

function handleDragOver(event) {
  event.preventDefault()
  event.dataTransfer.dropEffect = "move"
  
  const container = event.target.closest('.todo-list')
  const afterElement = getDragAfterElement(container, event.clientY)
  const dragging = document.querySelector(".dragging")

  if (afterElement == null) {
    container.appendChild(dragging)
  } else {
    container.insertBefore(dragging, afterElement)
  }
}

function handleDrop(event) {
  event.preventDefault()

  const draggedId = Number.parseInt(draggedElement.dataset.id)
  const targetElement = event.target.closest(".todo-item-wrapper")
  if (!targetElement) return; // Dropped outside a valid target
  
  const targetId = Number.parseInt(targetElement.dataset.id)

  if (draggedId !== targetId) {
    reorderTodos(draggedId, targetId)
  }
}

function handleDragEnd(event) {
  if (draggedElement) {
    draggedElement.classList.remove("dragging")
  }
  draggedElement = null
  renderTodos() // Re-render to clean up styles
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".todo-item-wrapper:not(.dragging)")]

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
  const todos = getTodosForCurrentDate()
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
  
  // Check if we are deselecting the active noise
  if (whiteNoiseEnabled && selectedBtn.classList.contains("active")) {
      whiteNoiseEnabled = false
      updateWhiteNoiseButton()
      return
  }
  
  // This logic was slightly flawed. If nothing is active, it should just activate.
  // If something else is active, it should stop it and start the new one.
  // The logic above (if(currentNoise)) already handles stopping.
  
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
  noiseGainNode.connect(audioL... truncated ...
