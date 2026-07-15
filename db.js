/* db.js */

// In-memory undo stack for deleted tasks
let lastDeletedTask = null;

// Initial Default State
const DEFAULT_STATE = {
    sections: [
        {
            id: "sec-personal",
            name: "Personal Life",
            emoji: "🏠",
            subsections: [
                { id: "sub-pers-todo", name: "To Do" },
                { id: "sub-pers-progress", name: "In Progress" },
                { id: "sub-pers-done", name: "Completed" }
            ]
        },
        {
            id: "sec-work",
            name: "Work Projects",
            emoji: "💼",
            subsections: [
                { id: "sub-work-backlog", name: "Backlog" },
                { id: "sub-work-active", name: "Active Development" },
                { id: "sub-work-review", name: "In Review" },
                { id: "sub-work-done", name: "Done" }
            ]
        }
    ],
    categories: [
        { name: "Work", emoji: "💼" },
        { name: "Personal", emoji: "🏠" },
        { name: "Study", emoji: "📚" },
        { name: "Shopping", emoji: "🛒" },
        { name: "Fitness", emoji: "🏋️" }
    ],
    tasks: [
        {
            id: "task-1",
            title: "Plan weekend getaway",
            description: "Research hotels, transport options and local attractions",
            notes: "Must check out the local hiking trails and vegetarian restaurants nearby.",
            priority: "medium",
            status: "inprogress",
            category: "Personal",
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
            dueTime: "14:00",
            recurrence: "none",
            tags: "travel, leisure",
            pinned: true,
            attachments: [],
            sectionId: "sec-personal",
            subsectionId: "sub-pers-progress",
            subtasks: [
                { id: "subt-1", title: "Find hotels", completed: true },
                { id: "subt-2", title: "Check train schedules", completed: false },
                { id: "subt-3", title: "Pack bags", completed: false }
            ],
            createdAt: new Date().toISOString(),
            archived: false
        },
        {
            id: "task-2",
            title: "Draft project proposal",
            description: "Prepare the executive summary and timelines for project Venus",
            notes: "Make sure to coordinate with Sarah on developer allocations.",
            priority: "high",
            status: "todo",
            category: "Work",
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
            dueTime: "10:00",
            recurrence: "none",
            tags: "project, planning",
            pinned: false,
            attachments: [],
            sectionId: "sec-work",
            subsectionId: "sub-work-backlog",
            subtasks: [],
            createdAt: new Date().toISOString(),
            archived: false
        }
    ]
};

// Database utility class
class TodoDB {
    constructor() {
        this.activeProfile = localStorage.getItem("zenith_active_profile") || "Default Profile";
        this.profiles = JSON.parse(localStorage.getItem("zenith_profiles")) || ["Default Profile", "Work Space", "Home Space"];
        this.themeSettings = JSON.parse(localStorage.getItem("zenith_theme_settings")) || {
            theme: "dark",
            customTheme: {
                bg: "#0f172a",
                cardBg: "#1e293b",
                primary: "#6366f1",
                text: "#f8fafc"
            }
        };
        this.loadProfileData();
    }

    // Save profile metadata
    saveProfileMeta() {
        localStorage.setItem("zenith_active_profile", this.activeProfile);
        localStorage.setItem("zenith_profiles", JSON.stringify(this.profiles));
        localStorage.setItem("zenith_theme_settings", JSON.stringify(this.themeSettings));
    }

    // Load active workspace profile data
    loadProfileData() {
        const key = `zenith_data_${this.activeProfile.replace(/\s+/g, '_')}`;
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                this.state = JSON.parse(raw);
            } catch (e) {
                console.error("Error parsing localStorage data", e);
                this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            }
        } else {
            this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            this.saveProfileData();
        }
        this.saveProfileMeta();
    }

    // Save active workspace profile data to localStorage
    saveProfileData() {
        const key = `zenith_data_${this.activeProfile.replace(/\s+/g, '_')}`;
        localStorage.setItem(key, JSON.stringify(this.state));
    }

    // Get tasks (filtered by archived status)
    getTasks(includeArchived = false) {
        return this.state.tasks.filter(t => t.archived === includeArchived);
    }

    // Save / update a task
    saveTask(task) {
        const idx = this.state.tasks.findIndex(t => t.id === task.id);
        
        // Auto update progress percentage
        let progress = 0;
        if (task.subtasks && task.subtasks.length > 0) {
            const completedCount = task.subtasks.filter(st => st.completed).length;
            progress = Math.round((completedCount / task.subtasks.length) * 100);
        } else {
            progress = task.status === 'completed' ? 100 : 0;
        }
        task.progress = progress;

        // Auto update status if progress is changed
        if (task.subtasks && task.subtasks.length > 0) {
            if (progress === 100) {
                task.status = 'completed';
            } else if (progress > 0) {
                task.status = 'inprogress';
            } else {
                task.status = 'todo';
            }
        }

        if (idx !== -1) {
            this.state.tasks[idx] = { ...this.state.tasks[idx], ...task };
        } else {
            task.id = task.id || 'task-' + Date.now();
            task.createdAt = task.createdAt || new Date().toISOString();
            task.archived = false;
            this.state.tasks.push(task);
        }
        this.saveProfileData();
        return task;
    }

    // Delete a task (with undo backup)
    deleteTask(taskId) {
        const idx = this.state.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            lastDeletedTask = this.state.tasks[idx];
            this.state.tasks.splice(idx, 1);
            this.saveProfileData();
            return true;
        }
        return false;
    }

    // Undo delete operation
    undoDelete() {
        if (lastDeletedTask) {
            this.state.tasks.push(lastDeletedTask);
            const restored = lastDeletedTask;
            lastDeletedTask = null;
            this.saveProfileData();
            return restored;
        }
        return null;
    }

    // Archive / Unarchive task
    archiveTask(taskId, archiveState = true) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (task) {
            task.archived = archiveState;
            this.saveProfileData();
            return true;
        }
        return false;
    }

    // Empty archived tasks permanently
    emptyArchive() {
        this.state.tasks = this.state.tasks.filter(t => !t.archived);
        this.saveProfileData();
    }

    // Get Sections
    getSections() {
        return this.state.sections || [];
    }

    // Add a Section
    addSection(name, emoji) {
        const id = 'sec-' + Date.now();
        const newSec = {
            id,
            name,
            emoji: emoji || "📁",
            subsections: [
                { id: `sub-${id}-todo`, name: "To Do" },
                { id: `sub-${id}-inprogress`, name: "In Progress" },
                { id: `sub-${id}-completed`, name: "Completed" }
            ]
        };
        this.state.sections.push(newSec);
        this.saveProfileData();
        return newSec;
    }

    // Add a Subsection inside a Section
    addSubsection(sectionId, name) {
        const section = this.state.sections.find(s => s.id === sectionId);
        if (section) {
            const subId = `sub-${Date.now()}`;
            const newSub = { id: subId, name };
            section.subsections.push(newSub);
            this.saveProfileData();
            return newSub;
        }
        return null;
    }

    // Get Categories
    getCategories() {
        return this.state.categories || [];
    }

    // Add a Category
    addCategory(name, emoji) {
        const exists = this.state.categories.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) return null;
        
        const newCat = { name, emoji: emoji || "🏷️" };
        this.state.categories.push(newCat);
        this.saveProfileData();
        return newCat;
    }

    // Get settings
    getThemeSettings() {
        return this.themeSettings;
    }

    // Save Theme Settings
    saveThemeSettings(settings) {
        this.themeSettings = { ...this.themeSettings, ...settings };
        this.saveProfileMeta();
    }

    // Create a new Profile
    createProfile(name) {
        const formattedName = name.trim();
        if (formattedName && !this.profiles.includes(formattedName)) {
            this.profiles.push(formattedName);
            this.activeProfile = formattedName;
            this.loadProfileData(); // Instantiates blank default template
            return true;
        }
        return false;
    }

    // Switch active Profile
    switchProfile(name) {
        if (this.profiles.includes(name)) {
            this.activeProfile = name;
            this.loadProfileData();
            return true;
        }
        return false;
    }

    // Delete a profile and all its data
    deleteProfile(name) {
        if (this.profiles.length > 1 && this.profiles.includes(name)) {
            this.profiles = this.profiles.filter(p => p !== name);
            const key = `zenith_data_${name.replace(/\s+/g, '_')}`;
            localStorage.removeItem(key);
            
            if (this.activeProfile === name) {
                this.activeProfile = this.profiles[0];
            }
            this.loadProfileData();
            return true;
        }
        return false;
    }

    // Export entire Profile Data as JSON string
    exportData() {
        return JSON.stringify({
            profile: this.activeProfile,
            data: this.state
        }, null, 2);
    }

    // Import Profile Data from JSON string
    importData(jsonData) {
        try {
            const parsed = JSON.parse(jsonData);
            if (parsed && parsed.data && Array.isArray(parsed.data.tasks) && Array.isArray(parsed.data.sections)) {
                this.state = parsed.data;
                this.saveProfileData();
                return true;
            }
        } catch (e) {
            console.error("Invalid JSON data schema provided for import", e);
        }
    }
}

window.TodoDB = TodoDB;
