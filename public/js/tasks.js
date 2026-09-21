/**
 * tasks.js - Todo task manager with estimates, tags, subtasks, drag reorder,
 * carry over unfinished tasks, and timer selection.
 */
import { loadTodos, saveTodos } from "./storage.js";

let allTodos = {};
let currentCalendarDate = new Date();
let currentTaskId = null;
let editingTodoId = null;
let showCompleted = true;
let onTaskSelectedCallback = null;
let draggedElement = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

export function initTasks(storage, onTaskSelected) {
  allTodos = loadTodos(storage) || {};
  onTaskSelectedCallback = onTaskSelected;
  setupTaskEventListeners(storage);
  renderTodoList(storage);
  updateTagDatalist();
}

export function getCurrentTaskId() {
  return currentTaskId;
}

export function setCurrentTaskId(id) {
  currentTaskId = id;
}

export function getAllTodos() {
  return allTodos;
}

export function getSelectedTask() {
  if (!currentTaskId) return null;
  const todos = getTodosForCurrentDate();
  return todos.find((t) => t.id === currentTaskId) || null;
}

export function getSelectedTaskText() {
  const task = getSelectedTask();
  return task ? task.text : null;
}

export function getSelectedTaskTag() {
  const task = getSelectedTask();
  return task ? task.tag || "" : "";
}

export function getCurrentCalendarDate() {
  return currentCalendarDate;
}

export function setCalendarDate(date, storage) {
  currentCalendarDate = new Date(date);
  renderTodoList(storage);
  updateTodoTitle();
}

export function getTodosForCurrentDate() {
  const dateKey = currentCalendarDate.toDateString();
  if (!allTodos[dateKey]) {
    allTodos[dateKey] = [];
  }
  return allTodos[dateKey];
}

export function getCompletedTodosCount() {
  const todos = getTodosForCurrentDate();
  return todos.filter((t) => t.completed).length;
}

export function getTotalTodosCount() {
  return getTodosForCurrentDate().length;
}

export function getAllTags() {
  const tags = new Set();
  for (const dateKey of Object.keys(allTodos)) {
    const list = allTodos[dateKey];
    if (Array.isArray(list)) {
      for (const t of list) {
        if (t && t.tag && t.tag.trim()) {
          tags.add(t.tag.trim());
        }
      }
    }
  }
  return Array.from(tags).sort();
}

export function updateTagDatalist() {
  const datalist = document.getElementById("tagDatalist");
  if (!datalist) return;
  datalist.innerHTML = "";
  for (const tag of getAllTags()) {
    const opt = document.createElement("option");
    opt.value = tag;
    datalist.appendChild(opt);
  }
}

export function updateTodoTitle() {
  const todoTitle = document.getElementById("todoTitle");
  if (!todoTitle) return;
  const todayStr = new Date().toDateString();
  if (currentCalendarDate.toDateString() === todayStr) {
    todoTitle.innerHTML = `<i data-lucide="check-square"></i> Today's Focus`;
  } else {
    todoTitle.innerHTML = `<i data-lucide="check-square"></i> Focus for ${currentCalendarDate.toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" },
    )}`;
  }
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

export function updateTodoProgress() {
  const progressEl = document.getElementById("todoProgress");
  if (!progressEl) return;
  const todos = getTodosForCurrentDate();
  const completed = todos.filter((t) => t.completed).length;
  const total = todos.length;
  progressEl.textContent = `${completed}/${total} completed`;

  const clearBtn = document.getElementById("clearCompletedBtn");
  if (clearBtn) {
    clearBtn.style.opacity = completed > 0 ? "1" : "0.5";
  }
}

export function addTodo(storage) {
  const input = document.getElementById("todoInput");
  const prioritySelect = document.getElementById("todoPriority");
  const estimateInput = document.getElementById("todoEstimate");
  const tagInput = document.getElementById("todoTag");
  if (!input) return;

  const text = input.value.trim();
  if (text === "") return;
  const priority = prioritySelect ? prioritySelect.value : "medium";
  const estimate = estimateInput ? Math.max(0, Math.min(12, parseInt(estimateInput.value, 10) || 0)) : 0;
  const tag = tagInput ? tagInput.value.trim() : "";

  const newTodo = {
    id: Date.now(),
    text,
    priority,
    completed: false,
    createdAt: new Date().toISOString(),
    subtasks: [],
    estimate,
    done: 0,
    tag,
  };

  const todos = getTodosForCurrentDate();
  todos.unshift(newTodo);
  input.value = "";
  if (estimateInput) estimateInput.value = "";
  if (tagInput) tagInput.value = "";

  saveTodos(storage, allTodos);
  renderTodoList(storage);
  updateTagDatalist();
}

export function toggleTodo(id, storage) {
  const todos = getTodosForCurrentDate();
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos(storage, allTodos);
    renderTodoList(storage);
  }
}

export function deleteTodo(id, storage) {
  const dateKey = currentCalendarDate.toDateString();
  allTodos[dateKey] = (allTodos[dateKey] || []).filter((t) => t.id !== id);

  if (currentTaskId === id) {
    currentTaskId = null;
    if (onTaskSelectedCallback) onTaskSelectedCallback(null);
  }

  saveTodos(storage, allTodos);
  renderTodoList(storage);
  updateTagDatalist();
}

export function clearCompleted(storage) {
  const dateKey = currentCalendarDate.toDateString();
  allTodos[dateKey] = (allTodos[dateKey] || []).filter((t) => !t.completed);

  if (currentTaskId && !allTodos[dateKey].some((t) => t.id === currentTaskId)) {
    currentTaskId = null;
    if (onTaskSelectedCallback) onTaskSelectedCallback(null);
  }

  saveTodos(storage, allTodos);
  renderTodoList(storage);
}

export function addSubtask(parentId, text, storage) {
  if (!text || text.trim() === "") return;
  const todos = getTodosForCurrentDate();
  const parent = todos.find((t) => t.id === parentId);
  if (parent) {
    if (!parent.subtasks) parent.subtasks = [];
    parent.subtasks.push({
      id: Date.now(),
      text: text.trim(),
      completed: false,
    });
    saveTodos(storage, allTodos);
    renderTodoList(storage);
  }
}

export function toggleSubtask(parentId, subtaskId, storage) {
  const todos = getTodosForCurrentDate();
  const parent = todos.find((t) => t.id === parentId);
  if (parent && parent.subtasks) {
    const st = parent.subtasks.find((s) => s.id === subtaskId);
    if (st) {
      st.completed = !st.completed;
      saveTodos(storage, allTodos);
      renderTodoList(storage);
    }
  }
}

export function deleteSubtask(parentId, subtaskId, storage) {
  const todos = getTodosForCurrentDate();
  const parent = todos.find((t) => t.id === parentId);
  if (parent && parent.subtasks) {
    parent.subtasks = parent.subtasks.filter((s) => s.id !== subtaskId);
    saveTodos(storage, allTodos);
    renderTodoList(storage);
  }
}

/**
 * Increments the pomodoro count for a task on session completion
 */
export function incrementTaskPomodoro(taskId, storage) {
  if (!taskId) return null;
  for (const dateKey of Object.keys(allTodos)) {
    const list = allTodos[dateKey];
    if (Array.isArray(list)) {
      const todo = list.find((t) => t.id === taskId);
      if (todo) {
        todo.done = (todo.done || 0) + 1;
        saveTodos(storage, allTodos);
        renderTodoList(storage);
        return {
          taskId: todo.id,
          taskName: todo.text,
          tag: todo.tag || "",
          done: todo.done,
          estimate: todo.estimate || 0,
        };
      }
    }
  }
  return null;
}

/**
 * Brings over unfinished tasks from previous days into current day
 */
export function bringOverUnfinishedTasks(storage) {
  const curDate = new Date(currentCalendarDate);
  curDate.setHours(0, 0, 0, 0);

  let foundPreviousTodos = null;

  // Search backward up to 30 days for unfinished tasks
  for (let i = 1; i <= 30; i++) {
    const prevDate = new Date(curDate);
    prevDate.setDate(prevDate.getDate() - i);
    const prevKey = prevDate.toDateString();
    const list = allTodos[prevKey];
    if (Array.isArray(list)) {
      const uncompleted = list.filter((t) => !t.completed);
      if (uncompleted.length > 0) {
        foundPreviousTodos = uncompleted;
        break;
      }
    }
  }

  if (!foundPreviousTodos || foundPreviousTodos.length === 0) {
    return { count: 0, message: "No unfinished tasks found from previous days." };
  }

  const currentTodos = getTodosForCurrentDate();
  const existingTexts = new Set(currentTodos.map((t) => t.text.toLowerCase().trim()));
  let copiedCount = 0;

  for (const t of foundPreviousTodos) {
    if (!existingTexts.has(t.text.toLowerCase().trim())) {
      currentTodos.push({
        id: Date.now() + Math.random(),
        text: t.text,
        priority: t.priority || "medium",
        completed: false,
        createdAt: new Date().toISOString(),
        subtasks: (t.subtasks || []).map((st) => ({
          id: Date.now() + Math.random(),
          text: st.text,
          completed: false,
        })),
        estimate: t.estimate || 0,
        done: 0,
        tag: t.tag || "",
      });
      existingTexts.add(t.text.toLowerCase().trim());
      copiedCount++;
    }
  }

  if (copiedCount > 0) {
    saveTodos(storage, allTodos);
    renderTodoList(storage);
    updateTagDatalist();
  }

  return {
    count: copiedCount,
    message:
      copiedCount > 0
        ? `Brought over ${copiedCount} unfinished task${copiedCount === 1 ? "" : "s"}.`
        : "All unfinished tasks from previous days are already in today's list.",
  };
}

export function selectTask(id) {
  currentTaskId = currentTaskId === id ? null : id;
  const taskText = getSelectedTaskText();
  if (onTaskSelectedCallback) onTaskSelectedCallback(taskText, currentTaskId);
  renderTodoList();
}

export function startEdit(id) {
  editingTodoId = id;
  renderTodoList();
  setTimeout(() => {
    const input = document.getElementById(`editInput${id}`);
    if (input) {
      input.focus();
      input.select();
    }
  }, 0);
}

export function saveEdit(id, newText, newEstimate, newTag, storage) {
  const trimmed = (newText || "").trim();
  if (trimmed !== "") {
    const todos = getTodosForCurrentDate();
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.text = trimmed;
      if (newEstimate !== undefined) {
        todo.estimate = Math.max(0, Math.min(12, parseInt(newEstimate, 10) || 0));
      }
      if (newTag !== undefined) {
        todo.tag = (newTag || "").trim();
      }
      saveTodos(storage, allTodos);
      updateTagDatalist();
    }
  }
  editingTodoId = null;
  renderTodoList(storage);
}

export function cancelEdit() {
  editingTodoId = null;
  renderTodoList();
}

export function toggleCompletedVisibility(storage) {
  showCompleted = !showCompleted;
  renderTodoList(storage);
}

export function renderTodoList(storage) {
  const todoList = document.getElementById("todoList");
  if (!todoList) return;

  const todos = getTodosForCurrentDate();
  const filteredTodos = showCompleted ? todos : todos.filter((t) => !t.completed);

  if (filteredTodos.length === 0) {
    const emptyMessage = showCompleted
      ? "No tasks for this day yet.<br>Add your first task above!"
      : "No active tasks.<br>Great job staying focused!";

    todoList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle"></i>
        <p>${emptyMessage}</p>
      </div>
    `;
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
    updateTodoProgress();
    return;
  }

  todoList.innerHTML = `
    <div class="completed-toggle" data-action="toggle-completed-visibility">
      <input type="checkbox" ${showCompleted ? "checked" : ""} readonly>
      <label>Show completed tasks</label>
    </div>
    ${filteredTodos
      .map(
        (todo, index) => `
      <div class="todo-item-wrapper ${currentTaskId === todo.id ? "selected" : ""}" 
           draggable="true" 
           data-id="${todo.id}"
           data-index="${index}">
           
        <div class="todo-item ${todo.completed ? "completed" : ""}">
          <div class="todo-priority-indicator ${todo.priority || "medium"}"></div>
          <div class="todo-checkbox ${todo.completed ? "checked" : ""}" data-action="toggle-todo" data-id="${todo.id}" title="Toggle task completed">
            ${todo.completed ? '<i data-lucide="check"></i>' : ""}
          </div>
          ${
            editingTodoId === todo.id
              ? `
            <div class="todo-edit-container">
              <textarea class="todo-edit-input" id="editInput${todo.id}" maxlength="100" data-action="edit-input" data-id="${todo.id}">${escapeHtml(todo.text)}</textarea>
              <div class="todo-edit-meta-row">
                <input type="number" class="estimate-input" id="editEstimate${todo.id}" min="0" max="12" value="${todo.estimate || 0}" placeholder="Est" title="Estimated pomodoros">
                <input type="text" class="tag-input" id="editTag${todo.id}" list="tagDatalist" maxlength="20" value="${escapeHtml(todo.tag || "")}" placeholder="Tag" title="Tag">
              </div>
            </div>
          `
              : `
            <div class="todo-text-wrap" data-action="select-task" data-id="${todo.id}">
              <span class="todo-text">${escapeHtml(todo.text)}</span>
              <span class="task-meta-badges">
                ${
                  todo.estimate > 0
                    ? `<span class="task-pomo-badge" title="${todo.done || 0} of ${todo.estimate} completed"><i data-lucide="timer"></i> ${todo.done || 0}/${todo.estimate}</span>`
                    : todo.done > 0
                      ? `<span class="task-pomo-badge" title="${todo.done} completed"><i data-lucide="timer"></i> ${todo.done}</span>`
                      : ""
                }
                ${
                  todo.tag
                    ? `<span class="task-tag-badge">${escapeHtml(todo.tag)}</span>`
                    : ""
                }
              </span>
            </div>
          `
          }
          <div class="todo-actions">
            ${
              editingTodoId === todo.id
                ? `
              <button class="todo-action-btn save" data-action="save-edit" data-id="${todo.id}" title="Save">
                <i data-lucide="check"></i>
              </button>
              <button class="todo-action-btn cancel" data-action="cancel-edit" title="Cancel">
                <i data-lucide="x"></i>
              </button>
            `
                : `
              <button class="todo-action-btn" data-action="start-edit" data-id="${todo.id}" title="Edit task">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="todo-action-btn" data-action="delete-todo" data-id="${todo.id}" title="Delete task">
                <i data-lucide="trash-2"></i>
              </button>
            `
            }
          </div>
        </div>
        
        <div class="subtask-list">
            ${(todo.subtasks || [])
              .map(
                (st) => `
                <div class="subtask-item ${st.completed ? "completed" : ""}">
                    <div class="subtask-checkbox ${st.completed ? "checked" : ""}" data-action="toggle-subtask" data-parent-id="${todo.id}" data-id="${st.id}">
                        ${st.completed ? '<i data-lucide="check" style="width: 12px; height: 12px;"></i>' : ""}
                    </div>
                    <span class="subtask-text">${escapeHtml(st.text)}</span>
                    <button class="subtask-delete-btn" data-action="delete-subtask" data-parent-id="${todo.id}" data-id="${st.id}" title="Delete subtask">
                        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                </div>
            `,
              )
              .join("")}
        </div>
        
        <div class="subtask-input-container">
            <input type="text" class="subtask-input" id="subtaskInput${todo.id}" placeholder="Add subtask..." data-parent-id="${todo.id}">
            <button class="add-subtask-btn" data-action="add-subtask" data-parent-id="${todo.id}" title="Add subtask">
                <i data-lucide="plus" style="width: 16px; height: 16px;"></i>
            </button>
        </div>
      </div>
    `,
      )
      .join("")}
  `;

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  updateTodoTitle();
  updateTodoProgress();
}

/**
 * Event Listeners delegated for tasks
 */
function setupTaskEventListeners(storage) {
  const todoList = document.getElementById("todoList");
  if (!todoList) return;

  todoList.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id ? Number(actionEl.dataset.id) : null;
    const parentId = actionEl.dataset.parentId ? Number(actionEl.dataset.parentId) : null;

    if (action === "toggle-todo" && id) {
      e.stopPropagation();
      toggleTodo(id, storage);
    } else if (action === "delete-todo" && id) {
      e.stopPropagation();
      deleteTodo(id, storage);
    } else if (action === "select-task" && id) {
      selectTask(id);
    } else if (action === "start-edit" && id) {
      e.stopPropagation();
      startEdit(id);
    } else if (action === "cancel-edit") {
      e.stopPropagation();
      cancelEdit();
    } else if (action === "save-edit" && id) {
      e.stopPropagation();
      const input = document.getElementById(`editInput${id}`);
      const estInput = document.getElementById(`editEstimate${id}`);
      const tagInput = document.getElementById(`editTag${id}`);
      saveEdit(
        id,
        input?.value,
        estInput?.value,
        tagInput?.value,
        storage,
      );
    } else if (action === "toggle-subtask" && parentId && id) {
      e.stopPropagation();
      toggleSubtask(parentId, id, storage);
    } else if (action === "delete-subtask" && parentId && id) {
      e.stopPropagation();
      deleteSubtask(parentId, id, storage);
    } else if (action === "add-subtask" && parentId) {
      e.stopPropagation();
      const input = document.getElementById(`subtaskInput${parentId}`);
      if (input) {
        addSubtask(parentId, input.value, storage);
        input.value = "";
      }
    } else if (action === "toggle-completed-visibility") {
      toggleCompletedVisibility(storage);
    }
  });

  // Enter keys on subtask & edit inputs
  todoList.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.target.classList.contains("subtask-input")) {
        e.preventDefault();
        const parentId = Number(e.target.dataset.parentId);
        if (parentId) {
          addSubtask(parentId, e.target.value, storage);
          e.target.value = "";
        }
      } else if (e.target.classList.contains("todo-edit-input")) {
        e.preventDefault();
        const id = Number(e.target.dataset.id);
        if (id) {
          const estInput = document.getElementById(`editEstimate${id}`);
          const tagInput = document.getElementById(`editTag${id}`);
          saveEdit(id, e.target.value, estInput?.value, tagInput?.value, storage);
        }
      }
    } else if (e.key === "Escape" && e.target.classList.contains("todo-edit-input")) {
      e.preventDefault();
      cancelEdit();
    }
  });

  // HTML5 Drag and Drop reordering
  todoList.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".todo-item-wrapper");
    if (!item) return;
    draggedElement = item;
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.id);
  });

  todoList.addEventListener("dragover", (e) => {
    e.preventDefault();
    const item = e.target.closest(".todo-item-wrapper");
    if (!item || item === draggedElement) return;

    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      item.parentNode.insertBefore(draggedElement, item);
    } else {
      item.parentNode.insertBefore(draggedElement, item.nextSibling);
    }
  });

  todoList.addEventListener("dragend", () => {
    if (draggedElement) {
      draggedElement.classList.remove("dragging");
      draggedElement = null;

      // Re-read DOM order and persist
      const wrappers = todoList.querySelectorAll(".todo-item-wrapper");
      const newOrderIds = Array.from(wrappers).map((w) => Number(w.dataset.id));
      const todos = getTodosForCurrentDate();

      const reordered = [];
      for (const id of newOrderIds) {
        const found = todos.find((t) => t.id === id);
        if (found) reordered.push(found);
      }

      // Add any filtered-out todos to the end
      for (const t of todos) {
        if (!reordered.includes(t)) {
          reordered.push(t);
        }
      }

      const dateKey = currentCalendarDate.toDateString();
      allTodos[dateKey] = reordered;
      saveTodos(storage, allTodos);
    }
  });
}
