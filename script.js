class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.editingTaskId = null;
        // Fixed: Use the ASP.NET Core backend URL instead of frontend origin
        this.baseUrl = 'http://localhost:5004';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTasks();
    }

    bindEvents() {
        // Add task event
        document.getElementById('addTaskBtn').addEventListener('click', () => this.addTask());
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Filter events
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
        });

        // Search event
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });

        // Task list events (using event delegation)
        document.getElementById('tasksList').addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = parseInt(taskItem.dataset.id);
            
            if (e.target.classList.contains('task-checkbox')) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleTask(taskId);
            } else if (e.target.classList.contains('btn-edit') || e.target.closest('.btn-edit')) {
                e.preventDefault();
                e.stopPropagation();
                this.startEdit(taskId);
            } else if (e.target.classList.contains('btn-save') || e.target.closest('.btn-save')) {
                e.preventDefault();
                e.stopPropagation();
                this.saveEdit(taskId);
            } else if (e.target.classList.contains('btn-cancel') || e.target.closest('.btn-cancel')) {
                e.preventDefault();
                e.stopPropagation();
                this.cancelEdit();
            } else if (e.target.classList.contains('btn-delete') || e.target.closest('.btn-delete')) {
                e.preventDefault();
                e.stopPropagation();
                this.deleteTask(taskId);
            }
        });

        // Handle Enter and Escape keys for edit mode
        document.getElementById('tasksList').addEventListener('keydown', (e) => {
            if (this.editingTaskId && e.target.classList.contains('task-edit-input')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveEdit(this.editingTaskId);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEdit();
                }
            }
        });
    }

    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showNotification('Connection error. Please try again.', 'error');
            throw error;
        }
    }

    async addTask() {
        const input = document.getElementById('taskInput');
        const text = input.value.trim();
        
        if (!text) {
            this.showNotification('Please enter a task!', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const result = await this.apiCall('/api/tasks', {
                method: 'POST',
                body: JSON.stringify({ text })
            });

            if (result.success) {
                input.value = '';
                await this.loadTasks(); // Refresh the task list
                this.showNotification(result.message || 'Task added successfully!', 'success');
            }
        } catch (error) {
            // Error already handled in apiCall
        } finally {
            this.showLoading(false);
        }
    }

    async toggleTask(id) {
        if (this.editingTaskId === id) {
            return; // Don't toggle if currently editing
        }

        this.showLoading(true);

        try {
            const task = this.tasks.find(t => t.id === id);
            if (!task) return;

            const result = await this.apiCall(`/api/tasks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ completed: !task.completed })
            });

            if (result.success) {
                await this.loadTasks(); // Refresh the task list
                this.showNotification(result.message || 'Task updated!', 'success');
            }
        } catch (error) {
            // Error already handled in apiCall
        } finally {
            this.showLoading(false);
        }
    }

    startEdit(id) {
        if (this.editingTaskId) {
            this.cancelEdit(); // Cancel any existing edit
        }
        
        this.editingTaskId = id;
        this.render();
        
        // Focus on the edit input after render
        setTimeout(() => {
            const editInput = document.querySelector('.task-edit-input');
            if (editInput) {
                editInput.focus();
                editInput.select();
            }
        }, 50);
    }

    async saveEdit(id) {
        const editInput = document.querySelector('.task-edit-input');
        if (!editInput) return;

        const newText = editInput.value.trim();
        if (!newText) {
            this.showNotification('Task text cannot be empty!', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const result = await this.apiCall(`/api/tasks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ text: newText })
            });

            if (result.success) {
                this.editingTaskId = null;
                await this.loadTasks(); // Refresh the task list
                this.showNotification('Task updated successfully!', 'success');
            }
        } catch (error) {
            // Error already handled in apiCall
        } finally {
            this.showLoading(false);
        }
    }

    cancelEdit() {
        this.editingTaskId = null;
        this.render();
    }

    async deleteTask(id) {
        // Prevent multiple simultaneous delete operations
        if (this.deleteInProgress) {
            return;
        }

        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        // Show custom confirmation modal
        const confirmed = await this.showDeleteConfirmation(task.text);
        if (!confirmed) return;

        this.deleteInProgress = true;
        this.showLoading(true);

        try {
            const result = await this.apiCall(`/api/tasks/${id}`, {
                method: 'DELETE'
            });

            if (result.success) {
                await this.loadTasks(); // Refresh the task list
                this.showNotification(result.message || 'Task deleted!', 'success');
            }
        } catch (error) {
            // Error already handled in apiCall
        } finally {
            this.deleteInProgress = false;
            this.showLoading(false);
        }
    }

    showDeleteConfirmation(taskText) {
        return new Promise((resolve) => {
            // Create modal
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';
            modalOverlay.style.display = 'flex';

            modalOverlay.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Delete Task</h3>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to delete this task?</p>
                        <div class="modal-task-preview">${this.escapeHtml(taskText)}</div>
                        <p><small>This action cannot be undone.</small></p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-modal btn-modal-cancel">Cancel</button>
                        <button class="btn-modal btn-modal-confirm">Delete</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);

            // Add event listeners
            const confirmBtn = modalOverlay.querySelector('.btn-modal-confirm');
            const cancelBtn = modalOverlay.querySelector('.btn-modal-cancel');

            const cleanup = () => {
                document.body.removeChild(modalOverlay);
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            // Close on overlay click
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    cleanup();
                    resolve(false);
                }
            });

            // Close on Escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escapeHandler);
                    cleanup();
                    resolve(false);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        });
    }

    setFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.render();
    }

    getFilteredTasks() {
        let filtered = [...this.tasks];

        // Apply status filter
        if (this.currentFilter === 'completed') {
            filtered = filtered.filter(task => task.completed);
        } else if (this.currentFilter === 'pending') {
            filtered = filtered.filter(task => !task.completed);
        }

        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(task =>
                task.text.toLowerCase().includes(this.searchQuery)
            );
        }

        return filtered;
    }

    render() {
        this.updateStats();
        this.renderTasks();
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        
        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        const emptyState = document.getElementById('emptyState');
        const filteredTasks = this.getFilteredTasks();

        if (filteredTasks.length === 0) {
            tasksList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        tasksList.style.display = 'flex';
        emptyState.style.display = 'none';

        tasksList.innerHTML = filteredTasks.map(task => {
            const isEditing = this.editingTaskId === task.id;
            const taskClasses = `task-item ${task.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}`;

            if (isEditing) {
                return `
                    <div class="${taskClasses}" data-id="${task.id}">
                        <div class="task-checkbox ${task.completed ? 'checked' : ''}"></div>
                        <input type="text" class="task-edit-input" value="${this.escapeHtml(task.text)}" maxlength="100">
                        <div class="task-actions">
                            <button class="btn-save" title="Save changes">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-cancel" title="Cancel editing">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="${taskClasses}" data-id="${task.id}">
                        <div class="task-checkbox ${task.completed ? 'checked' : ''}"></div>
                        <div class="task-content ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</div>
                        <div class="task-actions">
                            <button class="btn-edit" title="Edit task">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" title="Delete task">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            border-radius: 8px;
            font-weight: 500;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        // Add CSS animations if not already added
        if (!document.getElementById('notificationStyles')) {
            const styles = document.createElement('style');
            styles.id = 'notificationStyles';
            styles.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styles);
        }
    }

    async loadTasks() {
        this.showLoading(true);

        try {
            const result = await this.apiCall('/api/tasks');
            
            if (result.success) {
                this.tasks = result.data;
                this.render();
            }
        } catch (error) {
            // Fallback to empty state if API fails
            this.tasks = [];
            this.render();
        } finally {
            this.showLoading(false);
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TaskManager();
});

// Updated API utility functions for external use
window.TaskFlowAPI = {
    async fetchTasks() {
        try {
            const response = await fetch('http://localhost:5004/api/tasks');
            return await response.json();
        } catch (error) {
            console.error('Error fetching tasks:', error);
            throw error;
        }
    },
    
    async createTask(taskData) {
        try {
            const response = await fetch('http://localhost:5004/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            return await response.json();
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    },
    
    async updateTask(id, updates) {
        try {
            const response = await fetch(`http://localhost:5004/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            return await response.json();
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    },
    
    async deleteTask(id) {
        try {
            const response = await fetch(`http://localhost:5004/api/tasks/${id}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    },

    async getStats() {
        try {
            const response = await fetch('http://localhost:5004/api/tasks/stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error;
        }
    }
};