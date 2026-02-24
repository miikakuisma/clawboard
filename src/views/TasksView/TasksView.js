import { store } from '@/Store.js'
import { api } from '@/services/api.js'
import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import { relativeTime, timeUntil } from '@/utils/formatters.js'
import './TasksView.css'

const REPETITION_OPTIONS = [
  { value: '', label: 'One-off task' },
  { value: 'every-hour', label: 'Every hour' },
  { value: 'few-times-daily', label: 'Few times a day' },
  { value: 'twice-daily', label: 'Twice a day' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const REPETITION_LABELS = Object.fromEntries(
  REPETITION_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])
)

/**
 * Main tasks view displaying recurring, current, pending, and completed task lists.
 * Supports creating tasks, toggling status (pending -> in_progress -> completed),
 * expanding details, and deleting tasks. Uses optimistic UI updates with server fallback.
 * @extends HTMLElement
 */
export class TasksView extends HTMLElement {
  /** @override */
  connectedCallback() {
    this._lastDataJSON = null
    this._expandedTasks = new Set()
    this._editingTaskId = null
    this._showNewTaskForm = false
    this._mutating = false
    this.render()
    this._loadData()

    this.addEventListener('click', this._handleClick.bind(this))
    this.addEventListener('submit', this._handleSubmit.bind(this))

    this._unsubscribe = store.subscribe(() => {
      if (this._mutating) return // Skip poll overwrites during active mutation
      const { tasks } = store.getState()
      const json = JSON.stringify(tasks.items)
      if (json === this._lastDataJSON) return
      this._lastDataJSON = json
      this._renderTasks(tasks.items)
    })
  }

  /** @override */
  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe()
  }

  /** Called by ViewManager when this view becomes visible. Refreshes task data. */
  onActivate() {
    this._loadData()
  }

  /**
   * Fetches tasks from the API and updates the store and DOM.
   * @private
   */
  async _loadData() {
    store.setSectionData('tasks', { loading: true })
    const items = await api.getTasks()
    store.setSectionData('tasks', { items, loading: false })
    this._renderTasks(items)
  }

  /**
   * Dispatches click actions: toggle-task, delete-task, toggle-details, show/cancel new task.
   * @param {MouseEvent} e
   * @private
   */
  _handleClick(e) {
    const target = e.target.closest('[data-action]')
    if (!target) return

    const action = target.getAttribute('data-action')

    if (action === 'toggle-task') {
      const taskId = target.getAttribute('data-task-id')
      const { tasks } = store.getState()
      const task = tasks.items.find(t => t.id === taskId)
      if (!task) return

      // 3-state cycle: pending → in_progress → completed → pending
      let newStatus
      if (task.status === 'pending') newStatus = 'in_progress'
      else if (task.status === 'in_progress') newStatus = 'completed'
      else newStatus = 'pending'

      // Optimistic update
      const prevStatus = task.status
      const prevCompletedAt = task.completedAt
      const prevStartedAt = task.startedAt
      task.status = newStatus
      if (newStatus === 'in_progress' && !task.startedAt) task.startedAt = new Date()
      if (newStatus === 'completed') task.completedAt = new Date()
      if (newStatus === 'pending') { task.completedAt = null; task.startedAt = null }
      this._renderTasks(tasks.items)

      // Persist via status endpoint
      this._mutating = true
      api.updateTaskStatus(taskId, newStatus).then(result => {
        if (result.error) throw new Error(result.error)
      }).catch((err) => {
        console.error('Update task status failed:', err)
        task.status = prevStatus
        task.completedAt = prevCompletedAt
        task.startedAt = prevStartedAt
        this._renderTasks(tasks.items)
      }).finally(() => {
        this._mutating = false
        this._loadData()
      })
    } else if (action === 'delete-task') {
      const taskId = target.getAttribute('data-task-id')
      if (confirm('Delete this task?')) {
        this._mutating = true
        api.deleteTask(taskId).then(() => this._loadData()).finally(() => {
          this._mutating = false
        })
      }
    } else if (action === 'toggle-details') {
      const taskId = target.getAttribute('data-task-id')
      if (this._expandedTasks.has(taskId)) {
        this._expandedTasks.delete(taskId)
      } else {
        this._expandedTasks.add(taskId)
      }
      const { tasks } = store.getState()
      this._renderTasks(tasks.items || [])
    } else if (action === 'edit-task') {
      const taskId = target.getAttribute('data-task-id')
      this._editingTaskId = taskId
      const { tasks } = store.getState()
      this._renderTasks(tasks.items || [])
      const textarea = this.querySelector('.task-edit-form textarea')
      if (textarea) textarea.focus()
    } else if (action === 'cancel-edit-task') {
      this._editingTaskId = null
      const { tasks } = store.getState()
      this._renderTasks(tasks.items || [])
    } else if (action === 'show-new-task') {
      this._showNewTaskForm = true
      this._renderNewTaskForm()
      const textarea = this.querySelector('#new-task-description')
      if (textarea) textarea.focus()
    } else if (action === 'cancel-new-task') {
      this._showNewTaskForm = false
      this._renderNewTaskForm()
    }
  }

  /**
   * Handles new-task form submission. Creates the task via API and refreshes the list.
   * @param {SubmitEvent} e
   * @private
   */
  async _handleSubmit(e) {
    e.preventDefault()
    if (e.target.classList.contains('task-edit-form')) {
      const taskId = e.target.getAttribute('data-task-id')
      const textarea = e.target.querySelector('textarea')
      const select = e.target.querySelector('select')
      const description = textarea.value.trim()

      if (!description) {
        alert('Please enter a task description')
        return
      }

      const submitBtn = e.target.querySelector('.submit-task-btn')
      submitBtn.disabled = true
      submitBtn.textContent = 'Saving...'

      try {
        await api.updateTask(taskId, {
          description,
          repetition: select.value || null,
        })
        this._editingTaskId = null
        await this._loadData()
      } catch (error) {
        console.error('Failed to update task:', error)
        alert('Failed to update task. Please try again.')
        submitBtn.disabled = false
        submitBtn.textContent = 'Save'
      }
    } else if (e.target.classList.contains('new-task-form')) {
      const textarea = this.querySelector('#new-task-description')
      const description = textarea.value.trim()

      if (!description) {
        alert('Please enter a task description')
        return
      }

      const submitBtn = this.querySelector('.submit-task-btn')
      const originalText = submitBtn.textContent
      submitBtn.disabled = true
      submitBtn.textContent = 'Creating Task...'

      try {
        const repetitionSelect = this.querySelector('#new-task-repetition')
        const repetition = repetitionSelect?.value || null
        await api.createTask({ description, repetition: repetition || null })
        this._showNewTaskForm = false
        this._renderNewTaskForm()
        await this._loadData()
      } catch (error) {
        console.error('Failed to create task:', error)
        alert('Failed to create task. Please try again.')
      } finally {
        submitBtn.disabled = false
        submitBtn.textContent = originalText
      }
    }
  }

  /**
   * Sorts tasks into sections (recurring, current, pending, completed) and renders each list.
   * @param {Array<Object>} items - Task objects from the store.
   * @private
   */
  _renderTasks(items) {
    // Separate recurring from one-off tasks
    const recurringTasks = items.filter(t => t.repetition)
    const oneOffTasks = items.filter(t => !t.repetition)

    const currentTasks = oneOffTasks.filter(t => t.status === 'in_progress')
    const completedTasks = oneOffTasks.filter(t => t.status === 'completed')
    const pendingTasks = oneOffTasks.filter(t => t.status === 'pending')

    const recurringList = this.querySelector('.tasks-recurring')
    const recurringSection = this.querySelector('.recurring-section')
    const currentList = this.querySelector('.tasks-current')
    const completedList = this.querySelector('.tasks-completed')
    const pendingList = this.querySelector('.tasks-pending')

    if (!currentList || !completedList || !pendingList) return

    // Render recurring tasks section
    if (recurringSection) {
      recurringSection.style.display = recurringTasks.length > 0 ? '' : 'none'
    }
    if (recurringList) {
      recurringList.innerHTML = recurringTasks.map(task => this._renderRecurringTaskItem(task)).join('')
    }

    // Render current tasks
    currentList.innerHTML = currentTasks.length === 0 ? html`
      <div class="empty-state">
        <span class="empty-icon">${icons.checkCircle}</span>
        <p>No current tasks</p>
      </div>
    ` : currentTasks.map(task => this._renderTaskItem(task, 'current')).join('')

    // Render pending tasks
    pendingList.innerHTML = pendingTasks.length === 0 ? html`
      <div class="empty-state">
        <span class="empty-icon">${icons.clock}</span>
        <p>No pending tasks</p>
      </div>
    ` : pendingTasks.map(task => this._renderTaskItem(task, 'pending')).join('')

    // Render completed tasks
    completedList.innerHTML = completedTasks.length === 0 ? html`
      <div class="empty-state">
        <span class="empty-icon">${icons.checkCircle}</span>
        <p>No completed tasks yet</p>
      </div>
    ` : completedTasks.slice(0, 20).map(task => this._renderTaskItem(task, 'completed')).join('') // Show last 20 completed
  }

  /**
   * Renders a single one-off task row with status icon, metadata, and expandable details.
   * @param {Object} task
   * @param {'current'|'pending'|'completed'} type
   * @returns {string} HTML string
   * @private
   */
  _renderTaskItem(task, type) {
    const isExpanded = this._expandedTasks.has(task.id)
    const isEditing = this._editingTaskId === task.id
    const statusIcon = type === 'completed' ? icons.checkCircle :
                      type === 'current' ? icons.spinner :
                      icons.circle

    if (isEditing) return this._renderEditForm(task)

    return html`
      <div class="task-item ${type}" data-task-id="${task.id}">
        <div class="task-header">
          <div class="task-main">
            <span class="task-status-icon ${type}" data-action="toggle-task" data-task-id="${task.id}">${statusIcon}</span>
            <div class="task-content">
              <span class="task-title">${task.title || task.description}</span>
              <span class="task-meta">
                ${type === 'completed' && task.completedAt ? html`Completed ${relativeTime(task.completedAt)}` : ''}
                ${type === 'current' && task.startedAt ? html`Started ${relativeTime(task.startedAt)}` : ''}
                ${type === 'pending' && task.createdAt ? html`Created ${relativeTime(task.createdAt)}` : ''}
              </span>
            </div>
          </div>
          <div class="task-actions">
            <button class="task-edit-btn" data-action="edit-task" data-task-id="${task.id}" title="Edit task">
              ${icons.editSquare}
            </button>
            <button class="task-delete-btn" data-action="delete-task" data-task-id="${task.id}" title="Delete task">
              ${icons.delete}
            </button>
            <button class="task-expand-btn" data-action="toggle-details" data-task-id="${task.id}">
              ${isExpanded ? icons.chevronDown : icons.chevronRight}
            </button>
          </div>
        </div>

        ${isExpanded ? html`
          <div class="task-details">
            <div class="task-description">
              <strong>Description:</strong>
              <p>${task.description}</p>
            </div>

            ${task.links && task.links.length > 0 ? html`
              <div class="task-links">
                <strong>Related Links:</strong>
                <ul>
                  ${task.links.map(link => html`
                    <li><a href="${link.url}" target="_blank" rel="noopener">${link.title}</a></li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            ${task.notes ? html`
              <div class="task-notes">
                <strong>Notes:</strong>
                <p>${task.notes}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * Returns cooldown info for a recurring task, or null if not applicable.
   * @param {Object} task
   * @returns {{ onCooldown: boolean, nextRunAfter: Date }|null}
   * @private
   */
  _getCooldownInfo(task) {
    if (!task.nextRunAfter || !task.repetition) return null
    const nextRun = task.nextRunAfter instanceof Date ? task.nextRunAfter : new Date(task.nextRunAfter)
    return { onCooldown: Date.now() < nextRun.getTime(), nextRunAfter: nextRun }
  }

  /**
   * Renders a single recurring task row with repetition badge and status.
   * @param {Object} task
   * @returns {string} HTML string
   * @private
   */
  _renderRecurringTaskItem(task) {
    const isExpanded = this._expandedTasks.has(task.id)
    const isEditing = this._editingTaskId === task.id
    const cooldown = this._getCooldownInfo(task)
    const statusLabel = task.status === 'completed' ? 'Completed' :
                        task.status === 'in_progress' ? 'In Progress' : 'Pending'
    const statusClass = task.status === 'completed' ? 'completed' :
                        task.status === 'in_progress' ? 'current' : 'pending'
    const statusIcon = task.status === 'completed' ? icons.checkCircle :
                       task.status === 'in_progress' ? icons.spinner :
                       icons.circle

    if (isEditing) return this._renderEditForm(task)

    // Cooldown badge: show when task is pending/in_progress and cooldown hasn't expired
    let cooldownHtml = ''
    if (cooldown && cooldown.onCooldown && task.status === 'pending') {
      cooldownHtml = html`<span class="task-cooldown-badge on-cooldown">${icons.clock} Next run ${timeUntil(cooldown.nextRunAfter)}</span>`
    } else if (cooldown && cooldown.onCooldown && task.status === 'in_progress') {
      cooldownHtml = html`<span class="task-cooldown-warning">${icons.warning} Early run (cooldown ends ${timeUntil(cooldown.nextRunAfter)})</span>`
    }

    return html`
      <div class="task-item recurring ${statusClass}" data-task-id="${task.id}">
        <div class="task-header">
          <div class="task-main">
            <span class="task-status-icon ${statusClass}" data-action="toggle-task" data-task-id="${task.id}">${statusIcon}</span>
            <div class="task-content">
              <span class="task-title">${task.title || task.description}</span>
              <span class="task-meta">
                <span class="task-recurring-badge">${icons.restore} ${REPETITION_LABELS[task.repetition] || task.repetition}</span>
                <span class="task-recurring-status ${statusClass}">${statusLabel}</span>
                ${task.completedAt ? html`<span>Last completed ${relativeTime(task.completedAt)}</span>` : ''}
                ${cooldownHtml}
              </span>
            </div>
          </div>
          <div class="task-actions">
            <button class="task-edit-btn" data-action="edit-task" data-task-id="${task.id}" title="Edit task">
              ${icons.editSquare}
            </button>
            <button class="task-delete-btn" data-action="delete-task" data-task-id="${task.id}" title="Delete task">
              ${icons.delete}
            </button>
            <button class="task-expand-btn" data-action="toggle-details" data-task-id="${task.id}">
              ${isExpanded ? icons.chevronDown : icons.chevronRight}
            </button>
          </div>
        </div>

        ${isExpanded ? html`
          <div class="task-details">
            <div class="task-description">
              <strong>Description:</strong>
              <p>${task.description}</p>
            </div>

            ${task.links && task.links.length > 0 ? html`
              <div class="task-links">
                <strong>Related Links:</strong>
                <ul>
                  ${task.links.map(link => html`
                    <li><a href="${link.url}" target="_blank" rel="noopener">${link.title}</a></li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            ${task.notes ? html`
              <div class="task-notes">
                <strong>Notes:</strong>
                <p>${task.notes}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `
  }

  /**
   * Renders an inline edit form for a task, replacing its normal display.
   * @param {Object} task
   * @returns {string} HTML string
   * @private
   */
  _renderEditForm(task) {
    return html`
      <div class="task-item editing" data-task-id="${task.id}">
        <form class="task-edit-form" data-task-id="${task.id}">
          <div class="task-input-group">
            <label>Description:</label>
            <textarea rows="3" required>${task.description}</textarea>
          </div>

          <div class="task-input-group">
            <label>Repetition:</label>
            <select>
              ${REPETITION_OPTIONS.map(opt => html`
                <option value="${opt.value}" ${(task.repetition || '') === opt.value ? 'selected' : ''}>${opt.label}</option>
              `).join('')}
            </select>
          </div>

          <div class="task-form-actions">
            <button type="button" class="cancel-task-btn" data-action="cancel-edit-task">Cancel</button>
            <button type="submit" class="submit-task-btn primary">Save</button>
          </div>
        </form>
      </div>
    `
  }

  /**
   * Toggles the new-task form between an "Add" button and the creation form.
   * @private
   */
  _renderNewTaskForm() {
    const newTaskSection = this.querySelector('.new-task-section')
    if (!newTaskSection) return

    if (!this._showNewTaskForm) {
      newTaskSection.innerHTML = html`
        <button class="new-task-btn" data-action="show-new-task">
          ${icons.plus} Add New Task
        </button>
      `
    } else {
      const { assistant } = store.getState()

      newTaskSection.innerHTML = html`
        <div class="new-task-form-container">
          <div class="new-task-header">
            <h3>Create New Task</h3>
            <p>Describe what you'd like ${assistant.name} to work on</p>
          </div>

          <form class="new-task-form">
            <div class="task-input-group">
              <label for="new-task-description">Task Description:</label>
              <textarea
                id="new-task-description"
                placeholder="E.g., 'Update the dashboard to include a timeline view' or 'Research and implement a new feature'"
                rows="4"
                required
              ></textarea>
            </div>

            <div class="task-input-group">
              <label for="new-task-repetition">Repetition:</label>
              <select id="new-task-repetition">
                ${REPETITION_OPTIONS.map(opt => html`
                  <option value="${opt.value}">${opt.label}</option>
                `).join('')}
              </select>
            </div>

            <div class="task-form-actions">
              <button type="button" class="cancel-task-btn" data-action="cancel-new-task">Cancel</button>
              <button type="submit" class="submit-task-btn primary">Create Task</button>
            </div>
          </form>
        </div>
      `
    }
  }

  /** Renders the full page layout with section containers for each task category. */
  render() {
    const { assistant } = store.getState()

    this.innerHTML = html`
      <div class="page-header">
        <span class="page-header-icon">${icons.tasks}</span>
        <div class="page-header-text">
          <h1>Tasks</h1>
          <p>Track ${assistant.name}'s work - past, present, and future</p>
        </div>
      </div>

      <div class="new-task-section"></div>

      <div class="recurring-section" style="display:none">
        <div class="section-title">RECURRING TASKS</div>
        <div class="tasks-recurring"></div>
      </div>

      <div class="section-title">CURRENT WORK</div>
      <div class="tasks-current"></div>

      <div class="section-title">PENDING</div>
      <div class="tasks-pending"></div>

      <div class="section-title">COMPLETED</div>
      <div class="tasks-completed"></div>
    `

    // Initialize the new task form
    this._renderNewTaskForm()
  }
}
