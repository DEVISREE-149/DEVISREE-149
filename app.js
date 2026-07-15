/* app.js */


class ZenApp {
    constructor() {
        this.db = new TodoDB();
        this.theme = new ThemeManager(this.db);
        this.currentView = 'dashboard';
        
        // Active Filter States
        this.selectedSectionId = null; 
        this.selectedCategoryId = null; // matching Category name
        this.activeEditingTaskId = null;
        this.lastDeletedTaskId = null;
        this.toastTimeout = null;
        this.notifiedTaskIds = new Set(); // in-session notification tracker

        this.initViews();
        this.initDOM();
        this.bindEvents();
        this.initKeyboardShortcuts();
        
        // Initial render
        this.renderSidebar();
        this.switchView('dashboard');
        
        // Notification checker
        this.requestNotificationPermission();
        this.startReminderChecker();
    }

    initViews() {
        // Instantiate views
        this.dragDrop = new DragDropHandler(this.db, () => this.refreshCurrentView());
        this.calendar = new CalendarView(
            this.db, 
            (taskId) => this.openTaskDetail(taskId),
            (dateStr) => this.openQuickAddTask(dateStr)
        );
        this.dashboard = new DashboardView(this.db, (taskId) => this.openTaskDetail(taskId));
    }

    initDOM() {
        // Cache DOM elements
        this.sidebar = document.getElementById('appSidebar');
        this.sidebarSections = document.getElementById('sidebarSectionsList');
        this.sidebarCategories = document.getElementById('sidebarCategoriesList');
        this.viewPanels = document.querySelectorAll('.view-panel');
        
        // Search & Filters
        this.searchInput = document.getElementById('searchInput');
        this.clearSearchBtn = document.getElementById('clearSearchBtn');
        this.filterPriority = document.getElementById('filterPriority');
        this.filterStatus = document.getElementById('filterStatus');
        this.filterDueDate = document.getElementById('filterDueDate');
        this.filterSorting = document.getElementById('filterSorting');
        this.resetFiltersBtn = document.getElementById('resetFiltersBtn');
        
        // Modal components
        this.taskModal = document.getElementById('taskDetailModal');
        this.themeModal = document.getElementById('themeModal');
        this.accountModal = document.getElementById('accountModal');
        this.shortcutsModal = document.getElementById('shortcutsModal');
        this.sectionModal = document.getElementById('sectionModal');
        this.categoryModal = document.getElementById('categoryModal');

        // Toasts & notifications
        this.undoToast = document.getElementById('undoToast');
        this.notificationBtn = document.getElementById('notificationBtn');
        this.notificationDropdown = document.getElementById('notificationDropdown');
        this.notificationsList = document.getElementById('notificationsList');

        // Initialise Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    bindEvents() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedSectionId = null;
                this.selectedCategoryId = null;
                this.switchView(btn.dataset.view);
            });
        });

        // Search & Filter changes
        this.searchInput.addEventListener('input', () => {
            this.clearSearchBtn.style.display = this.searchInput.value ? 'block' : 'none';
            this.refreshCurrentView();
            this.checkFiltersResetState();
        });
        this.clearSearchBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.clearSearchBtn.style.display = 'none';
            this.refreshCurrentView();
            this.checkFiltersResetState();
        });

        [this.filterPriority, this.filterStatus, this.filterDueDate, this.filterSorting].forEach(select => {
            select.addEventListener('change', () => {
                this.refreshCurrentView();
                this.checkFiltersResetState();
            });
        });

        this.resetFiltersBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.clearSearchBtn.style.display = 'none';
            this.filterPriority.value = 'all';
            this.filterStatus.value = 'all';
            this.filterDueDate.value = 'all';
            this.filterSorting.value = 'date-asc';
            this.refreshCurrentView();
            this.checkFiltersResetState();
        });

        // Sidebar Add buttons
        document.getElementById('addSectionBtn').addEventListener('click', () => this.openModal(this.sectionModal));
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.openModal(this.categoryModal));
        document.getElementById('themeModalBtn').addEventListener('click', () => this.openModal(this.themeModal));
        document.getElementById('shortcutsBtn').addEventListener('click', () => this.openModal(this.shortcutsModal));
        document.getElementById('profileBtn').addEventListener('click', () => this.openModal(this.accountModal));

        // Header Add Task button
        document.getElementById('headerAddTaskBtn').addEventListener('click', () => this.openQuickAddTask());

        // Notifications Bell dropdown
        this.notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.notificationDropdown.classList.toggle('active');
        });
        document.addEventListener('click', () => {
            this.notificationDropdown.classList.remove('active');
        });
        this.notificationDropdown.addEventListener('click', (e) => e.stopPropagation());
        document.getElementById('clearNotificationsBtn').addEventListener('click', () => {
            this.notificationsList.innerHTML = '<div class="empty-notifications">No upcoming deadlines</div>';
            this.notificationBtn.setAttribute('badge', '0');
        });

        // Mobile Responsive sidebar controls
        document.getElementById('mobileMenuToggle').addEventListener('click', () => {
            this.sidebar.classList.add('active');
        });
        document.getElementById('mobileCloseBtn').addEventListener('click', () => {
            this.sidebar.classList.remove('active');
        });

        // Generic Modal Closes
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeAllModals();
            });
        });

        // Add Section Form
        document.getElementById('saveSectionBtn').addEventListener('click', () => {
            const name = document.getElementById('sectionNameInput').value.trim();
            const emoji = document.getElementById('sectionEmojiInput').value.trim();
            if (name) {
                this.db.addSection(name, emoji);
                this.renderSidebar();
                this.closeAllModals();
                document.getElementById('sectionNameInput').value = '';
            }
        });

        // Add Category Form
        document.getElementById('saveCategoryBtn').addEventListener('click', () => {
            const name = document.getElementById('categoryNameInput').value.trim();
            const emoji = document.getElementById('categoryEmojiInput').value.trim();
            if (name) {
                this.db.addCategory(name, emoji);
                this.renderSidebar();
                this.closeAllModals();
                document.getElementById('categoryNameInput').value = '';
            }
        });

        // Themes preset selector card clicks
        document.querySelectorAll('.theme-preset-card').forEach(card => {
            card.addEventListener('click', () => {
                const themeName = card.dataset.theme;
                if (themeName !== 'custom') {
                    this.theme.setTheme(themeName);
                    this.updateThemeSettingsUI();
                }
            });
        });

        // Custom Theme pickers live updates
        const pickers = ['pickerBg', 'pickerCardBg', 'pickerPrimary', 'pickerText'];
        pickers.forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.previewCustomTheme());
        });

        document.getElementById('saveCustomThemeBtn').addEventListener('click', () => {
            const colors = {
                bg: document.getElementById('pickerBg').value,
                cardBg: document.getElementById('pickerCardBg').value,
                primary: document.getElementById('pickerPrimary').value,
                text: document.getElementById('pickerText').value
            };
            this.theme.setTheme('custom', colors);
            this.updateThemeSettingsUI();
            this.closeAllModals();
        });

        // Profile switcher / Account logic
        document.getElementById('createProfileBtn').addEventListener('click', () => {
            const nameInput = document.getElementById('newProfileNameInput');
            const name = nameInput.value.trim();
            if (name) {
                if (this.db.createProfile(name)) {
                    nameInput.value = '';
                    this.renderSidebar();
                    this.refreshCurrentView();
                    this.renderProfileSwitchList();
                    this.closeAllModals();
                    this.showToast(`Switched to workspace: ${name}`);
                } else {
                    alert("Profile name already exists or is invalid.");
                }
            }
        });

        document.getElementById('triggerSyncBtn').addEventListener('click', () => {
            const syncBtn = document.getElementById('triggerSyncBtn');
            const syncStatusText = document.getElementById('syncModalText');
            const syncDot = document.querySelector('.sync-dot');
            const syncHeader = document.getElementById('syncText');
            
            syncBtn.disabled = true;
            syncStatusText.textContent = "Syncing with cloud cluster...";
            syncDot.classList.add('syncing');
            syncHeader.textContent = "Syncing...";

            setTimeout(() => {
                syncBtn.disabled = false;
                syncStatusText.textContent = "Status: Synchronized! Last sync: Just now";
                syncDot.classList.remove('syncing');
                syncHeader.textContent = "Cloud Active";
                this.showToast("Cloud workspace sync complete!");
            }, 1800);
        });

        // Export/Import JSON data
        document.getElementById('exportDataBtn').addEventListener('click', () => {
            const dataStr = this.db.exportData();
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ZenithTask_${this.db.activeProfile.replace(/\s+/g, '_')}_backup.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById('importDataFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imported = this.db.importData(event.target.result);
                    if (imported) {
                        this.db.loadProfileData();
                        this.renderSidebar();
                        this.refreshCurrentView();
                        this.closeAllModals();
                        this.showToast("Workspace configuration imported successfully!");
                    } else {
                        alert("Invalid backup configuration file formatting.");
                    }
                };
                reader.readAsText(file);
            }
        });

        // Task modal action buttons
        document.getElementById('modalSaveBtn').addEventListener('click', () => this.saveTaskFromModal());
        document.getElementById('modalDeleteBtn').addEventListener('click', () => this.deleteActiveTask());
        document.getElementById('modalArchiveBtn').addEventListener('click', () => this.archiveActiveTask());
        document.getElementById('modalPinBtn').addEventListener('click', () => {
            const btn = document.getElementById('modalPinBtn');
            const isPinned = btn.classList.toggle('active');
            btn.innerHTML = isPinned ? `<i data-lucide="pin" class="text-primary"></i>` : `<i data-lucide="pin"></i>`;
            if (window.lucide) window.lucide.createIcons();
        });

        // Task Checklist Subtask logic
        document.getElementById('addSubtaskBtn').addEventListener('click', () => this.addNewSubtaskFromModal());
        document.getElementById('newSubtaskInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addNewSubtaskFromModal();
        });

        // Task Attachments logic
        document.getElementById('attachmentFileInput').addEventListener('change', (e) => this.handleAttachmentUpload(e));
        document.getElementById('addUrlAttachmentBtn').addEventListener('click', () => this.handleLinkAttachment());

        // Undo toast action
        document.getElementById('undoDeleteBtn').addEventListener('click', () => {
            const restored = this.db.undoDelete();
            if (restored) {
                this.refreshCurrentView();
                this.undoToast.classList.remove('active');
                this.showToast(`Restored task: "${restored.title}"`);
            }
        });

        // Empty archive
        document.getElementById('emptyArchiveBtn').addEventListener('click', () => {
            if (confirm("Are you sure you want to permanently clear all archived tasks? This action is irreversible.")) {
                this.db.emptyArchive();
                this.refreshCurrentView();
            }
        });
    }

    initKeyboardShortcuts() {
        this.shortcuts = new KeyboardShortcuts({
            onViewChange: (view) => {
                document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
                    if (btn.dataset.view === view) {
                        btn.click();
                    }
                });
            },
            onOpenNewTask: () => this.openQuickAddTask(),
            onFocusSearch: () => this.searchInput.focus(),
            onOpenModal: (type) => {
                if (type === 'account') this.openModal(this.accountModal);
                if (type === 'theme') this.openModal(this.themeModal);
                if (type === 'shortcuts') this.openModal(this.shortcutsModal);
            },
            onEscape: () => {
                this.closeAllModals();
                this.searchInput.value = '';
                this.clearSearchBtn.style.display = 'none';
                this.refreshCurrentView();
            }
        });
    }

    // Switch active panel layout
    switchView(viewName) {
        this.currentView = viewName;
        this.viewPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `${viewName}View`) {
                panel.classList.add('active');
            }
        });

        this.refreshCurrentView();
    }

    refreshCurrentView() {
        if (this.currentView === 'dashboard') {
            this.dashboard.render();
        } else if (this.currentView === 'tasks') {
            this.renderTasksWorkspace();
        } else if (this.currentView === 'calendar') {
            this.calendar.render();
        } else if (this.currentView === 'archive') {
            this.renderArchiveWorkspace();
        }

        // Update profile text in sidebar
        document.getElementById('profileName').textContent = this.db.activeProfile;

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // Modal display controllers
    openModal(modalElement) {
        modalElement.classList.add('active');
        if (modalElement === this.themeModal) {
            this.updateThemeSettingsUI();
        }
        if (modalElement === this.accountModal) {
            this.renderProfileSwitchList();
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        this.activeEditingTaskId = null;
    }

    // Render left navigations
    renderSidebar() {
        // 1. Render Sections
        const sections = this.db.getSections();
        this.sidebarSections.innerHTML = '';
        
        const tasks = this.db.getTasks(false);

        sections.forEach(sec => {
            const count = tasks.filter(t => t.sectionId === sec.id).length;
            const div = document.createElement('div');
            div.className = `section-item ${this.selectedSectionId === sec.id ? 'active' : ''}`;
            div.innerHTML = `
                <div class="section-item-left">
                    <span>${sec.emoji}</span>
                    <span>${sec.name}</span>
                </div>
                <span class="section-badge-count">${count}</span>
            `;
            div.addEventListener('click', () => {
                this.selectedSectionId = sec.id;
                this.selectedCategoryId = null;
                
                // Set main task button to active
                document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
                document.querySelector('.sidebar-nav .nav-item[data-view="tasks"]').classList.add('active');
                
                // Highlight sidebar section card
                document.querySelectorAll('.section-item').forEach(si => si.classList.remove('active'));
                div.classList.add('active');

                document.querySelectorAll('.category-item').forEach(ci => ci.classList.remove('active'));

                this.switchView('tasks');
            });
            this.sidebarSections.appendChild(div);
        });

        // 2. Render Categories
        const categories = this.db.getCategories();
        this.sidebarCategories.innerHTML = '';

        categories.forEach(cat => {
            const count = tasks.filter(t => t.category === cat.name).length;
            const div = document.createElement('div');
            div.className = `category-item ${this.selectedCategoryId === cat.name ? 'active' : ''}`;
            div.innerHTML = `
                <div class="category-item-left">
                    <span>${cat.emoji}</span>
                    <span>${cat.name}</span>
                </div>
                <span class="category-badge-count">${count}</span>
            `;
            div.addEventListener('click', () => {
                this.selectedCategoryId = cat.name;
                this.selectedSectionId = null;

                // Highlight active nav item
                document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
                document.querySelector('.sidebar-nav .nav-item[data-view="tasks"]').classList.add('active');

                document.querySelectorAll('.category-item').forEach(ci => ci.classList.remove('active'));
                div.classList.add('active');

                document.querySelectorAll('.section-item').forEach(si => si.classList.remove('active'));

                this.switchView('tasks');
            });
            this.sidebarCategories.appendChild(div);
        });
    }

    // Render task listings (Boards/Kanban list grids)
    renderTasksWorkspace() {
        const workspace = document.getElementById('tasksWorkspace');
        workspace.innerHTML = '';

        const sections = this.db.getSections();
        const tasks = this.db.getTasks(false);

        // Filter sections if one is clicked in sidebar
        const activeSections = this.selectedSectionId 
            ? sections.filter(s => s.id === this.selectedSectionId)
            : sections;

        if (activeSections.length === 0) {
            workspace.innerHTML = `
                <div class="empty-notifications" style="padding: 100px 0;">
                    <i data-lucide="folder" style="width: 48px; height: 48px; margin-bottom: 12px; color: var(--text-muted);"></i>
                    <h3>Create a Project Section in the sidebar to get started!</h3>
                </div>
            `;
            return;
        }

        activeSections.forEach(section => {
            const secWrapper = document.createElement('div');
            secWrapper.className = 'section-wrapper';

            // Section Header
            const headerRow = document.createElement('div');
            headerRow.className = 'section-header-row';
            headerRow.innerHTML = `
                <div class="section-title-left">
                    <span>${section.emoji}</span>
                    <span>${section.name}</span>
                </div>
                <div class="section-actions">
                    <button class="section-action-btn add-sub-btn" title="Add Subsection"><i data-lucide="plus-square"></i></button>
                </div>
            `;

            headerRow.querySelector('.add-sub-btn').addEventListener('click', () => {
                const subName = prompt("Enter Subsection Name (e.g. Backlog, Testing):");
                if (subName) {
                    this.db.addSubsection(section.id, subName);
                    this.refreshCurrentView();
                }
            });

            secWrapper.appendChild(headerRow);

            // Subsection Cards Lists
            const subGrid = document.createElement('div');
            subGrid.className = 'subsections-container';

            section.subsections.forEach(sub => {
                const subCard = document.createElement('div');
                subCard.className = 'subsection-card';
                subCard.innerHTML = `
                    <div class="subsection-header">
                        <span class="subsection-title">${sub.name}</span>
                        <button class="subsection-action-btn add-task-quick-btn" title="Add task to this list"><i data-lucide="plus"></i></button>
                    </div>
                `;

                // Fetch and filter tasks belonging to this subsection
                let filteredTasks = tasks.filter(t => t.sectionId === section.id && t.subsectionId === sub.id);

                // Apply search/filters
                filteredTasks = this.applyFiltersOnTaskList(filteredTasks);
                
                // Apply sorting
                filteredTasks = this.applySortingOnTaskList(filteredTasks);

                // Drop zone container
                const dropZone = document.createElement('div');
                dropZone.className = 'task-list-drop-zone';
                dropZone.dataset.sectionId = section.id;
                dropZone.dataset.subsectionId = sub.id;

                filteredTasks.forEach(task => {
                    const taskCard = this.createTaskCardElement(task);
                    dropZone.appendChild(taskCard);
                });

                subCard.appendChild(dropZone);

                // Quick add task input bar inside subsection
                const quickBar = document.createElement('div');
                quickBar.className = 'quick-add-task-bar';
                quickBar.innerHTML = `
                    <input type="text" placeholder="Add task details...">
                    <button class="quick-add-btn"><i data-lucide="check"></i></button>
                `;

                const handleQuickSubmit = () => {
                    const input = quickBar.querySelector('input');
                    const text = input.value.trim();
                    if (text) {
                        const newTask = {
                            title: text,
                            description: "",
                            notes: "",
                            priority: "low",
                            status: sub.name.toLowerCase().includes('done') || sub.name.toLowerCase().includes('completed') ? 'completed' : 'todo',
                            category: this.db.getCategories()[0]?.name || "Personal",
                            dueDate: "",
                            dueTime: "",
                            recurrence: "none",
                            tags: "",
                            pinned: false,
                            attachments: [],
                            sectionId: section.id,
                            subsectionId: sub.id,
                            subtasks: []
                        };
                        this.db.saveTask(newTask);
                        input.value = '';
                        this.refreshCurrentView();
                        this.renderSidebar();
                    }
                };

                quickBar.querySelector('.quick-add-btn').addEventListener('click', handleQuickSubmit);
                quickBar.querySelector('input').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') handleQuickSubmit();
                });
                subCard.appendChild(quickBar);

                subCard.querySelector('.add-task-quick-btn').addEventListener('click', () => {
                    quickBar.querySelector('input').focus();
                });

                subGrid.appendChild(subCard);
            });

            secWrapper.appendChild(subGrid);
            workspace.appendChild(secWrapper);
        });

        // Initialize drag-and-drop actions
        this.dragDrop.init();
    }

    createTaskCardElement(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority} ${task.pinned ? 'pinned' : ''} ${task.status === 'completed' ? 'completed' : ''}`;
        card.draggable = true;
        card.dataset.id = task.id;

        // Progress bar percentage
        let progressPercent = task.progress || 0;

        // Format dates indicator
        let dateBadge = '';
        if (task.dueDate) {
            const todayStr = new Date().toISOString().split('T')[0];
            const isOverdue = task.dueDate < todayStr && task.status !== 'completed';
            
            // Nice date text
            let dateLabel = task.dueDate;
            if (task.dueDate === todayStr) dateLabel = 'Today';
            else if (task.dueDate === new Date(Date.now() + 86400000).toISOString().split('T')[0]) dateLabel = 'Tomorrow';

            dateBadge = `
                <span class="task-badge task-badge-date ${isOverdue ? 'overdue' : ''}">
                    <i data-lucide="calendar" style="width: 11px; height: 11px;"></i>
                    ${dateLabel}
                </span>
            `;
        }

        const attachmentsBadge = task.attachments && task.attachments.length > 0
            ? `<span class="task-badge task-attachments-indicator"><i data-lucide="paperclip" style="width: 11px; height:11px;"></i> ${task.attachments.length}</span>`
            : '';

        const tagsList = task.tags
            ? task.tags.split(',').map(tag => `<span class="task-badge">#${tag.trim()}</span>`).join('')
            : '';

        let statusClass = 'status-todo';
        let statusText = 'To Do';
        if (task.status === 'inprogress') {
            statusClass = 'status-inprogress';
            statusText = 'In Progress';
        } else if (task.status === 'completed') {
            statusClass = 'status-completed';
            statusText = 'Completed';
        }

        card.innerHTML = `
            <div class="task-card-header">
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" class="task-checkbox-input" ${task.status === 'completed' ? 'checked' : ''}>
                    <span class="task-checkbox-custom"></span>
                </div>
                <span class="task-card-title-text">${task.title}</span>
                ${task.pinned ? `<i data-lucide="pin" class="task-pin-indicator"></i>` : ''}
            </div>
            
            <div class="task-card-body">
                ${task.description ? `<p class="task-card-desc">${task.description}</p>` : ''}
                ${task.subtasks && task.subtasks.length > 0 ? `
                    <div class="task-card-progress-bar">
                        <div class="task-card-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                ` : ''}
                
                <div class="task-card-footer">
                    <div class="task-badge-container">
                        ${dateBadge}
                        ${attachmentsBadge}
                        ${tagsList}
                        <span class="task-card-status-pill ${statusClass}">${statusText}</span>
                    </div>
                </div>
            </div>
        `;

        // Checkbox Click event
        card.querySelector('.task-checkbox-input').addEventListener('click', (e) => {
            e.stopPropagation(); // prevent opening detailed modal
            task.status = e.target.checked ? 'completed' : 'todo';
            
            // Mark all subtasks as checked if completed
            if (task.status === 'completed' && task.subtasks) {
                task.subtasks.forEach(s => s.completed = true);
            } else if (task.status === 'todo' && task.subtasks) {
                task.subtasks.forEach(s => s.completed = false);
            }

            // If task completes and has recurrence, generate the next instance
            if (task.status === 'completed' && task.recurrence !== 'none') {
                this.handleRecurrentTaskCompletion(task);
            }

            this.db.saveTask(task);
            this.refreshCurrentView();
            this.renderSidebar();
        });

        // Task Card Open Details Modal Click
        card.addEventListener('click', () => {
            this.openTaskDetail(task.id);
        });

        return card;
    }

    // Filter rules
    applyFiltersOnTaskList(list) {
        // Real-time title/notes search filter
        const query = this.searchInput.value.toLowerCase().trim();
        if (query) {
            list = list.filter(t => 
                t.title.toLowerCase().includes(query) || 
                (t.description && t.description.toLowerCase().includes(query)) ||
                (t.notes && t.notes.toLowerCase().includes(query)) ||
                (t.tags && t.tags.toLowerCase().includes(query))
            );
        }

        // Priority filter
        const priority = this.filterPriority.value;
        if (priority !== 'all') {
            list = list.filter(t => t.priority === priority);
        }

        // Status filter
        const status = this.filterStatus.value;
        if (status !== 'all') {
            list = list.filter(t => t.status === status);
        }

        // Due date filter
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const dateFilter = this.filterDueDate.value;
        if (dateFilter !== 'all') {
            if (dateFilter === 'overdue') {
                list = list.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'completed');
            } else if (dateFilter === 'today') {
                list = list.filter(t => t.dueDate === todayStr);
            } else if (dateFilter === 'tomorrow') {
                list = list.filter(t => t.dueDate === tomorrowStr);
            } else if (dateFilter === 'thisweek') {
                // simple week range check
                const endOfWeek = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
                list = list.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= endOfWeek);
            }
        }

        // Category filter (if clicked in sidebar)
        if (this.selectedCategoryId) {
            list = list.filter(t => t.category === this.selectedCategoryId);
        }

        return list;
    }

    // Sorting algorithm
    applySortingOnTaskList(list) {
        const sortMode = this.filterSorting.value;
        const priorityOrder = { high: 3, medium: 2, low: 1 };

        // Pin tasks always stay on top
        list.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            if (sortMode === 'date-asc') {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate > b.dueDate ? 1 : -1;
            } else if (sortMode === 'date-desc') {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate < b.dueDate ? 1 : -1;
            } else if (sortMode === 'priority-desc') {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            } else if (sortMode === 'priority-asc') {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            } else if (sortMode === 'alpha-asc') {
                return a.title.localeCompare(b.title);
            } else if (sortMode === 'alpha-desc') {
                return b.title.localeCompare(a.title);
            }
            return 0;
        });

        return list;
    }

    checkFiltersResetState() {
        const hasFilters = 
            this.searchInput.value !== '' || 
            this.filterPriority.value !== 'all' || 
            this.filterStatus.value !== 'all' || 
            this.filterDueDate.value !== 'all' || 
            this.filterSorting.value !== 'date-asc';
        
        this.resetFiltersBtn.style.display = hasFilters ? 'block' : 'none';
    }

    // Modal controller: Task details loading
    openTaskDetail(taskId) {
        const task = this.db.getTasks(true).find(t => t.id === taskId) || this.db.getTasks(false).find(t => t.id === taskId);
        if (!task) return;

        this.activeEditingTaskId = task.id;

        // Bind attributes to Modal inputs
        document.getElementById('modalTaskTitle').value = task.title;
        document.getElementById('modalTaskDescription').value = task.description || '';
        document.getElementById('modalTaskNotes').value = task.notes || '';
        document.getElementById('modalTaskPriority').value = task.priority;
        document.getElementById('modalTaskStatus').value = task.status;
        document.getElementById('modalTaskDueDate').value = task.dueDate || '';
        document.getElementById('modalTaskDueTime').value = task.dueTime || '';
        document.getElementById('modalTaskRecurrence').value = task.recurrence || 'none';
        document.getElementById('modalTaskTags').value = task.tags || '';
        
        // Pin state
        const pinBtn = document.getElementById('modalPinBtn');
        if (task.pinned) {
            pinBtn.classList.add('active');
            pinBtn.innerHTML = `<i data-lucide="pin" class="text-primary"></i>`;
        } else {
            pinBtn.classList.remove('active');
            pinBtn.innerHTML = `<i data-lucide="pin"></i>`;
        }

        // Render category options dropdown list in modal
        const catSelect = document.getElementById('modalTaskCategory');
        catSelect.innerHTML = '';
        this.db.getCategories().forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = `${cat.emoji} ${cat.name}`;
            if (task.category === cat.name) opt.selected = true;
            catSelect.appendChild(opt);
        });

        // Set Date meta information
        document.getElementById('modalCreatedDate').textContent = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '-';
        const completedRow = document.getElementById('modalCompletedDateRow');
        if (task.status === 'completed' && task.completedAt) {
            completedRow.style.display = 'block';
            document.getElementById('modalCompletedDate').textContent = new Date(task.completedAt).toLocaleDateString();
        } else {
            completedRow.style.display = 'none';
        }

        // Checklist rendering
        this.renderModalChecklist(task);

        // Attachments rendering
        this.renderModalAttachments(task);

        // Emoji indicator
        document.getElementById('taskEmojiPickerBtn').textContent = task.emoji || '📝';

        if (window.lucide) window.lucide.createIcons();
        this.openModal(this.taskModal);
    }

    openQuickAddTask(dateStr = '') {
        const sections = this.db.getSections();
        if (sections.length === 0) {
            alert("Create a section in the sidebar first!");
            return;
        }

        // Create initial placeholder task
        const newTask = {
            id: 'task-' + Date.now(),
            title: "New Task Title",
            description: "",
            notes: "",
            priority: "low",
            status: "todo",
            category: this.db.getCategories()[0]?.name || "Personal",
            dueDate: dateStr || new Date().toISOString().split('T')[0],
            dueTime: "",
            recurrence: "none",
            tags: "",
            pinned: false,
            attachments: [],
            sectionId: sections[0].id,
            subsectionId: sections[0].subsections[0]?.id || "",
            subtasks: [],
            createdAt: new Date().toISOString(),
            archived: false
        };

        this.db.saveTask(newTask);
        this.openTaskDetail(newTask.id);
    }

    saveTaskFromModal() {
        if (!this.activeEditingTaskId) return;

        const tasks = this.db.getTasks(false).concat(this.db.getTasks(true));
        const task = tasks.find(t => t.id === this.activeEditingTaskId);

        if (task) {
            task.title = document.getElementById('modalTaskTitle').value.trim() || "Untitled Task";
            task.description = document.getElementById('modalTaskDescription').value.trim();
            task.notes = document.getElementById('modalTaskNotes').value.trim();
            task.priority = document.getElementById('modalTaskPriority').value;
            
            // Check status transition
            const oldStatus = task.status;
            task.status = document.getElementById('modalTaskStatus').value;
            if (task.status === 'completed' && oldStatus !== 'completed') {
                task.completedAt = new Date().toISOString();
                if (task.recurrence !== 'none') {
                    this.handleRecurrentTaskCompletion(task);
                }
            } else if (task.status !== 'completed') {
                task.completedAt = null;
            }

            task.category = document.getElementById('modalTaskCategory').value;
            task.dueDate = document.getElementById('modalTaskDueDate').value;
            task.dueTime = document.getElementById('modalTaskDueTime').value;
            task.recurrence = document.getElementById('modalTaskRecurrence').value;
            task.tags = document.getElementById('modalTaskTags').value;
            task.pinned = document.getElementById('modalPinBtn').classList.contains('active');
            task.emoji = document.getElementById('taskEmojiPickerBtn').textContent;

            this.db.saveTask(task);
            this.closeAllModals();
            this.refreshCurrentView();
            this.renderSidebar();
            this.showToast(`Task details updated: "${task.title}"`);
        }
    }

    deleteActiveTask() {
        if (!this.activeEditingTaskId) return;
        
        const taskId = this.activeEditingTaskId;
        const task = this.db.getTasks(false).concat(this.db.getTasks(true)).find(t => t.id === taskId);
        
        if (task && this.db.deleteTask(taskId)) {
            this.closeAllModals();
            this.refreshCurrentView();
            this.renderSidebar();
            this.triggerUndoToast(task.title);
        }
    }

    archiveActiveTask() {
        if (!this.activeEditingTaskId) return;

        const taskId = this.activeEditingTaskId;
        const task = this.db.getTasks(false).find(t => t.id === taskId);

        if (task && this.db.archiveTask(taskId, true)) {
            this.closeAllModals();
            this.refreshCurrentView();
            this.renderSidebar();
            this.showToast(`Archived task: "${task.title}"`);
        }
    }

    // Recurring tasks logic generator
    handleRecurrentTaskCompletion(task) {
        if (!task.dueDate) return;

        const currentDate = new Date(task.dueDate);
        let nextDate = new Date(currentDate);

        if (task.recurrence === 'daily') {
            nextDate.setDate(currentDate.getDate() + 1);
        } else if (task.recurrence === 'weekly') {
            nextDate.setDate(currentDate.getDate() + 7);
        } else if (task.recurrence === 'monthly') {
            nextDate.setMonth(currentDate.getMonth() + 1);
        }

        // Create duplicates clone as next recurrence instance
        const nextTask = {
            ...task,
            id: 'task-' + Date.now() + '-next',
            status: 'todo',
            dueDate: nextDate.toISOString().split('T')[0],
            completedAt: null,
            subtasks: task.subtasks ? task.subtasks.map(st => ({ ...st, id: 'subt-' + Math.random(), completed: false })) : [],
            createdAt: new Date().toISOString()
        };

        this.db.saveTask(nextTask);
        this.showToast(`Recurrence task generated for: ${nextTask.dueDate}`);
    }

    // Modal Checklist Checklist Render
    renderModalChecklist(task) {
        const list = document.getElementById('modalSubtaskList');
        list.innerHTML = '';

        if (!task.subtasks) task.subtasks = [];

        task.subtasks.forEach(st => {
            const item = document.createElement('div');
            item.className = `subtask-item ${st.completed ? 'completed' : ''}`;
            item.innerHTML = `
                <div class="subtask-item-left">
                    <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''}>
                    <span class="subtask-title">${st.title}</span>
                </div>
                <button class="subtask-delete-btn"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
            `;

            // Checklist complete event toggle
            item.querySelector('.subtask-checkbox').addEventListener('click', (e) => {
                st.completed = e.target.checked;
                item.classList.toggle('completed', st.completed);
                this.updateModalChecklistProgress(task);
            });

            // Delete checklist item
            item.querySelector('.subtask-delete-btn').addEventListener('click', () => {
                task.subtasks = task.subtasks.filter(sub => sub.id !== st.id);
                this.renderModalChecklist(task);
                this.updateModalChecklistProgress(task);
            });

            list.appendChild(item);
        });

        this.updateModalChecklistProgress(task);
    }

    addNewSubtaskFromModal() {
        const input = document.getElementById('newSubtaskInput');
        const title = input.value.trim();
        if (!title || !this.activeEditingTaskId) return;

        const task = this.db.getTasks(false).concat(this.db.getTasks(true)).find(t => t.id === this.activeEditingTaskId);
        if (task) {
            const newSub = {
                id: 'subt-' + Date.now(),
                title,
                completed: false
            };
            if (!task.subtasks) task.subtasks = [];
            task.subtasks.push(newSub);
            
            input.value = '';
            this.renderModalChecklist(task);
        }
    }

    updateModalChecklistProgress(task) {
        const progressPercentText = document.getElementById('modalChecklistProgress');
        const progressBarFill = document.getElementById('modalChecklistProgressBar');

        if (!task.subtasks || task.subtasks.length === 0) {
            progressPercentText.textContent = "0%";
            progressBarFill.style.width = "0%";
            return;
        }

        const completedCount = task.subtasks.filter(st => st.completed).length;
        const percent = Math.round((completedCount / task.subtasks.length) * 100);

        progressPercentText.textContent = `${percent}%`;
        progressBarFill.style.width = `${percent}%`;
    }

    // Modal Attachments renderer
    renderModalAttachments(task) {
        const list = document.getElementById('modalAttachmentsList');
        list.innerHTML = '';

        if (!task.attachments) task.attachments = [];

        if (task.attachments.length === 0) {
            list.innerHTML = '<span class="description-text">No attachments linked.</span>';
            return;
        }

        task.attachments.forEach((att, idx) => {
            const chip = document.createElement('div');
            chip.className = 'attachment-chip';
            
            // Icon identifier
            let icon = 'file';
            if (att.type.startsWith('image/')) icon = 'image';
            else if (att.type === 'link') icon = 'link';

            chip.innerHTML = `
                <i data-lucide="${icon}" style="width: 14px; height: 14px;"></i>
                <a href="${att.data}" target="_blank" download="${att.name}">${att.name}</a>
                <i data-lucide="x" class="attachment-remove" title="Remove attachment"></i>
            `;

            chip.querySelector('.attachment-remove').addEventListener('click', () => {
                task.attachments.splice(idx, 1);
                this.renderModalAttachments(task);
            });

            list.appendChild(chip);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    // Upload attachment base64 processing
    handleAttachmentUpload(e) {
        const file = e.target.files[0];
        if (!file || !this.activeEditingTaskId) return;

        // Check file size (localStorage safety limit, e.g. 500KB)
        if (file.size > 512000) {
            alert("File is too large. Maximum attachment size is 500KB in Offline Sync mode.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            const task = this.db.getTasks(false).concat(this.db.getTasks(true)).find(t => t.id === this.activeEditingTaskId);
            
            if (task) {
                if (!task.attachments) task.attachments = [];
                task.attachments.push({
                    name: file.name,
                    type: file.type,
                    data: base64
                });
                this.renderModalAttachments(task);
            }
        };
        reader.readAsDataURL(file);
    }

    handleLinkAttachment() {
        const urlInput = document.getElementById('attachmentUrlInput');
        const url = urlInput.value.trim();
        if (!url || !this.activeEditingTaskId) return;

        const task = this.db.getTasks(false).concat(this.db.getTasks(true)).find(t => t.id === this.activeEditingTaskId);
        if (task) {
            if (!task.attachments) task.attachments = [];
            
            // Format link display
            let friendlyName = url.replace(/(^\w+:|^)\/\//, '').split('/')[0];
            if (friendlyName.length > 25) friendlyName = friendlyName.substring(0, 22) + '...';

            task.attachments.push({
                name: friendlyName,
                type: 'link',
                data: url.startsWith('http') ? url : 'https://' + url
            });

            urlInput.value = '';
            this.renderModalAttachments(task);
        }
    }

    // Archive Workspace panel listing
    renderArchiveWorkspace() {
        const container = document.getElementById('archiveTaskList');
        container.innerHTML = '';

        const archived = this.db.getTasks(true);

        if (archived.length === 0) {
            container.innerHTML = '<div class="empty-notifications">Archive is empty. Completed tasks can be archived here.</div>';
            return;
        }

        archived.forEach(task => {
            const item = document.createElement('div');
            item.className = 'archive-item-card';
            item.innerHTML = `
                <div class="archive-item-left">
                    <span class="archive-item-title">${task.title}</span>
                    <span class="archive-item-meta">Category: ${task.category} | Created: ${new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="archive-item-right">
                    <button class="btn btn-secondary btn-sm restore-btn"><i data-lucide="rotate-ccw"></i> Restore</button>
                    <button class="btn btn-secondary btn-sm delete-perm-btn text-danger"><i data-lucide="trash-2"></i> Delete</button>
                </div>
            `;

            item.querySelector('.restore-btn').addEventListener('click', () => {
                this.db.archiveTask(task.id, false);
                this.refreshCurrentView();
                this.renderSidebar();
                this.showToast(`Restored task to board: "${task.title}"`);
            });

            item.querySelector('.delete-perm-btn').addEventListener('click', () => {
                if (confirm(`Permanently delete "${task.title}"? This cannot be undone.`)) {
                    this.db.deleteTask(task.id);
                    this.refreshCurrentView();
                }
            });

            container.appendChild(item);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    // Custom Theme dynamic color previewing
    previewCustomTheme() {
        const bg = document.getElementById('pickerBg').value;
        const cardBg = document.getElementById('pickerCardBg').value;
        const primary = document.getElementById('pickerPrimary').value;
        const text = document.getElementById('pickerText').value;

        // Instantly preview theme
        this.theme.setTheme('custom', { bg, cardBg, primary, text });
    }

    updateThemeSettingsUI() {
        const settings = this.db.getThemeSettings();
        
        // Highlight active preset cards
        this.theme.updatePresetCardsActive(settings.theme);

        // Prepopulate custom picker inputs
        if (settings.customTheme) {
            document.getElementById('pickerBg').value = settings.customTheme.bg;
            document.getElementById('pickerCardBg').value = settings.customTheme.cardBg;
            document.getElementById('pickerPrimary').value = settings.customTheme.primary;
            document.getElementById('pickerText').value = settings.customTheme.text;
        }
    }

    // Profile workspace listing generator
    renderProfileSwitchList() {
        const container = document.getElementById('profilesListPicker');
        container.innerHTML = '';

        this.db.profiles.forEach(prof => {
            const item = document.createElement('div');
            item.className = `profile-picker-item ${this.db.activeProfile === prof ? 'active' : ''}`;
            
            const isDeletable = this.db.profiles.length > 1;

            item.innerHTML = `
                <span>👤 ${prof}</span>
                ${isDeletable ? `<button class="profile-delete-btn" title="Delete Profile Data"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>` : ''}
            `;

            item.addEventListener('click', () => {
                if (this.db.activeProfile !== prof) {
                    this.db.switchProfile(prof);
                    this.renderSidebar();
                    this.refreshCurrentView();
                    this.renderProfileSwitchList();
                    this.showToast(`Switched workspace to: ${prof}`);
                }
            });

            if (isDeletable) {
                item.querySelector('.profile-delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent switching on click
                    if (confirm(`Permanently delete the entire workspace "${prof}" and all its task lists? This cannot be undone.`)) {
                        this.db.deleteProfile(prof);
                        this.renderSidebar();
                        this.refreshCurrentView();
                        this.renderProfileSwitchList();
                        this.showToast(`Deleted workspace profile: ${prof}`);
                    }
                });
            }

            container.appendChild(item);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    // In-app Toasts
    showToast(message) {
        // Create dynamic small alert element
        const toast = document.createElement('div');
        toast.className = 'undo-toast active';
        toast.style.bottom = '100px'; // stack spacing
        toast.innerHTML = `
            <div class="toast-content">
                <i data-lucide="info" class="text-primary" style="width:16px; height:16px;"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(toast);

        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
            toast.style.transform = 'translateY(150px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    triggerUndoToast(taskTitle) {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        
        document.getElementById('undoToastText').textContent = `Deleted "${taskTitle}"`;
        this.undoToast.classList.add('active');

        this.toastTimeout = setTimeout(() => {
            this.undoToast.classList.remove('active');
        }, 5000);
    }

    // Reminders & Web Notification system
    requestNotificationPermission() {
        if ("Notification" in window) {
            if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                Notification.requestPermission();
            }
        }
    }

    startReminderChecker() {
        // Run check every 30 seconds
        setInterval(() => this.checkUpcomingTaskDeadlines(), 30000);
        // Initial run
        setTimeout(() => this.checkUpcomingTaskDeadlines(), 2000);
    }

    checkUpcomingTaskDeadlines() {
        const tasks = this.db.getTasks(false); // active only
        const now = new Date();
        const notificationDropdownList = document.getElementById('notificationsList');
        const notificationCountBadge = document.getElementById('notificationBtn');

        let notifications = [];

        tasks.forEach(task => {
            if (task.status === 'completed' || !task.dueDate || !task.dueTime) return;

            const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
            const timeDiffMs = dueDateTime - now;
            const fifteenMinutesMs = 15 * 60 * 1000;

            // Trigger system alert if task is due in under 15 minutes, and hasn't notified yet
            if (timeDiffMs > 0 && timeDiffMs <= fifteenMinutesMs) {
                if (!this.notifiedTaskIds.has(task.id)) {
                    this.notifiedTaskIds.add(task.id);
                    this.fireWebNotification(task);
                }
            }

            // Populate upcoming deadlines bell list (due within next 24 hours)
            const oneDayMs = 24 * 60 * 60 * 1000;
            if (timeDiffMs > 0 && timeDiffMs <= oneDayMs) {
                notifications.push(task);
            }
        });

        // Update badge counts
        notificationCountBadge.setAttribute('badge', notifications.length);

        if (notifications.length === 0) {
            notificationDropdownList.innerHTML = '<div class="empty-notifications">No upcoming deadlines</div>';
            return;
        }

        // Render notifications drop-down lists
        notificationDropdownList.innerHTML = '';
        notifications.forEach(t => {
            const div = document.createElement('div');
            div.className = 'notification-item';
            div.innerHTML = `
                <div class="notification-item-title">${t.title}</div>
                <div class="notification-item-time">Due at: ${t.dueDate} ${t.dueTime}</div>
            `;
            div.addEventListener('click', () => {
                this.notificationDropdown.classList.remove('active');
                this.openTaskDetail(t.id);
            });
            notificationDropdownList.appendChild(div);
        });
    }

    fireWebNotification(task) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("🚨 ZenithTask Deadline Reminder", {
                body: `"${task.title}" is due soon! (Due at: ${task.dueTime})`,
                icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V10a6 6 0 0 0-6-6 6 6 0 0 0-6 6v6l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E"
            });
        } else {
            // Fallback to custom in-app Toast
            this.showToast(`🚨 URGENT: "${task.title}" is due at ${task.dueTime}!`);
        }
    }
}

// Start application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ZenApp();
});
