/**
 * tasks.js - Todo task manager with subtasks, drag reorder, calendar filtering, and timer selection
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
}

export function getCurrentTaskId() {
  return currentTaskId;
}

export function setCurrentTaskId(id) {
  currentTaskId = id;
}

export function getSelectedTaskText() {
  if (!currentTaskId) return null;
  const todos = getTodosForCurrentDate();
  const task = todos.find((t) => t.id === currentTaskId);
  return task ? task.text : null;
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
  if (!input) return;

  const text = input.value.trim();
  if (text === "") return;
  const priority = prioritySelect ? prioritySelect.value : "medium";

  const newTodo = {
    id: Date.now(),
    text,
    priority,
    completed: false,
    createdAt: new Date().toISOString(),
    subtasks: [],
    est: 0,
    done: 0,
    tag: null,
  };

  const todos = getTodosForCurrentDate();
  todos.unshift(newTodo);
  input.value = "";

  saveTodos(storage, allTodos);
  renderTodoList(storage);
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

export function saveEdit(id, newText, storage) {
  const trimmed = (newText || "").trim();
  if (trimmed !== "") {
    const todos = getTodosForCurrentDate();
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.text = trimmed;
      saveTodos(storage, allTodos);
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
      ? "No tasks for this day yet.<br>Add your first task to get started!"
      : "No active tasks.<br>Great job staying on top of things!";

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
          <div class="todo-checkbox ${todo.completed ? "checked" : ""}" data-action="toggle-todo" data-id="${todo.id}">
            ${todo.completed ? '<i data-lucide="check"></i>' : ""}
          </div>
          ${
            editingTodoId === todo.id
              ? `
            <textarea class="todo-edit-input" 
                   id="editInput${todo.id}" maxlength="100"
                   data-action="edit-input" data-id="${todo.id}">${escapeHtml(todo.text)}</textarea>
          `
              : `
            <div class="todo-text" data-action="select-task" data-id="${todo.id}">${escapeHtml(todo.text)}</div>
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
                    <button class="subtask-delete-btn" data-action="delete-subtask" data-parent-id="${todo.id}" data-id="${st.id}">
                        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                </div>
            `,
              )
              .join("")}
        </div>
        
        <div class="subtask-input-container">
            <input type="text" class="subtask-input" id="subtaskInput${todo.id}" placeholder="Add subtask..." data-parent-id="${todo.id}">
            <button class="add-subtask-btn" data-action="add-subtask" data-parent-id="${todo.id}">
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
  updateTodoProgress();
}

/**
 * Event delegation for task list to remove all inline onclick handlers
 */
function setupTaskEventListeners(storage) {
  const todoList = document.getElementById("todoList");
  if (!todoList) return;

  // Single delegated click listener
  todoList.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id ? Number(target.dataset.id) : null;
    const parentId = target.dataset.parentId ? Number(target.dataset.parentId) : null;

    if (action === "toggle-todo" && id) {
      e.stopPropagation();
      toggleTodo(id, storage);
    } else if (action === "select-task" && id) {
      selectTask(id);
    } else if (action === "start-edit" && id) {
      e.stopPropagation();
      startEdit(id);
    } else if (action === "save-edit" && id) {
      e.stopPropagation();
      const input = document.getElementById(`editInput${id}`);
      saveEdit(id, input ? input.value : "", storage);
    } else if (action === "cancel-edit") {
      e.stopPropagation();
      cancelEdit();
    } else if (action === "delete-todo" && id) {
      e.stopPropagation();
      deleteTodo(id, storage);
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

  // Enter key support for subtasks & edit inputs
  todoList.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
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
          saveEdit(id, e.target.value, storage);
        }
      }
    } else if (e.key === "Escape" && e.target.classList.contains("todo-edit-input")) {
      cancelEdit();
    }
  });

  // Drag and drop delegation
  todoList.addEventListener("dragstart", (e) => {
    draggedElement = e.target.closest(".todo-item-wrapper");
    if (!draggedElement) return;
    draggedElement.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedElement.dataset.id);
  });

  todoList.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const container = e.target.closest("#todoList");
    if (!container) return;

    const afterElement = getDragAfterElement(container, e.clientY);
    const dragging = document.querySelector(".dragging");
    if (!dragging) return;

    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  });

  todoList.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    const targetWrapper = e.target.closest(".todo-item-wrapper");
    if (!targetWrapper) return;
    const targetId = Number(targetWrapper.dataset.id);

    if (draggedId && targetId && draggedId !== targetId) {
      const todos = getTodosForCurrentDate();
      const draggedIndex = todos.findIndex((t) => t.id === draggedId);
      const targetIndex = todos.findIndex((t) => t.id === targetId);

      if (draggedIndex > -1 && targetIndex > -1) {
        const [draggedTodo] = todos.splice(draggedIndex, 1);
        todos.splice(targetIndex, 0, draggedTodo);
        saveTodos(storage, allTodos);
        renderTodoList(storage);
      }
    }
  });

  todoList.addEventListener("dragend", () => {
    if (draggedElement) {
      draggedElement.classList.remove("dragging");
    }
    draggedElement = null;
    renderTodoList(storage);
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".todo-item-wrapper:not(.dragging)")];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}
