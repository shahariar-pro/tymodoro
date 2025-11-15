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
      <input type: "checkbox" ${showCompleted ? "checked" : ""} readonly>
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
                <div class="subtask-item ${st.completed ? 'completed' : ''}">
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
    const breakTime = currentSession ===... truncated ...
