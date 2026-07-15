/* dashboard.js */

class DashboardView {
    constructor(db, onTaskClick) {
        this.db = db;
        this.onTaskClick = onTaskClick;
    }

    render() {
        const allTasks = this.db.getTasks(false); // active tasks only
        const total = allTasks.length;
        const completed = allTasks.filter(t => t.status === 'completed').length;
        const pending = total - completed;

        // Calculate Overdue
        const todayStr = new Date().toISOString().split('T')[0];
        const overdueTasks = allTasks.filter(t => {
            if (t.status === 'completed' || !t.dueDate) return false;
            return t.dueDate < todayStr;
        });
        const overdue = overdueTasks.length;

        // 1. Render Metrics Card values
        document.getElementById('statTotalTasks').textContent = total;
        document.getElementById('statCompletedTasks').textContent = completed;
        document.getElementById('statPendingTasks').textContent = pending;
        document.getElementById('statOverdueTasks').textContent = overdue;

        // 2. Circular Progress SVG
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        document.getElementById('dashboardProgressPercent').textContent = `${progressPercent}%`;

        const circle = document.getElementById('dashboardProgressCircle');
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        
        // Calculate offset (draw backwards)
        const offset = circumference - (progressPercent / 100) * circumference;
        circle.style.strokeDashoffset = offset;

        // 3. Priority Bar Charts
        const highCount = allTasks.filter(t => t.priority === 'high').length;
        const medCount = allTasks.filter(t => t.priority === 'medium').length;
        const lowCount = allTasks.filter(t => t.priority === 'low').length;

        const maxPriority = Math.max(highCount, medCount, lowCount, 1);
        
        document.getElementById('barHigh').style.width = `${(highCount / maxPriority) * 100}%`;
        document.getElementById('valHigh').textContent = highCount;

        document.getElementById('barMedium').style.width = `${(medCount / maxPriority) * 100}%`;
        document.getElementById('valMedium').textContent = medCount;

        document.getElementById('barLow').style.width = `${(lowCount / maxPriority) * 100}%`;
        document.getElementById('valLow').textContent = lowCount;

        // 4. Category breakdown bars
        this.renderCategoryBreakdown(allTasks);

        // 5. Critical & Impending list
        this.renderCriticalTasks(allTasks, overdueTasks);
    }

    renderCategoryBreakdown(allTasks) {
        const categories = this.db.getCategories();
        const container = document.getElementById('categoryBreakdownList');
        container.innerHTML = '';

        if (categories.length === 0) {
            container.innerHTML = '<div class="empty-notifications">No categories found</div>';
            return;
        }

        // Count tasks per category
        const counts = {};
        categories.forEach(c => counts[c.name] = 0);
        
        allTasks.forEach(t => {
            if (counts[t.category] !== undefined) {
                counts[t.category]++;
            }
        });

        const maxCatCount = Math.max(...Object.values(counts), 1);

        categories.forEach(cat => {
            const count = counts[cat.name] || 0;
            const percentage = (count / maxCatCount) * 100;

            const row = document.createElement('div');
            row.className = 'category-breakdown-row';
            row.innerHTML = `
                <div class="cat-breakdown-left">
                    <span>${cat.emoji}</span>
                    <span>${cat.name}</span>
                </div>
                <div class="cat-breakdown-track">
                    <div class="cat-breakdown-fill" style="width: ${percentage}%;"></div>
                </div>
                <span class="cat-breakdown-count">${count}</span>
            `;
            container.appendChild(row);
        });
    }

    renderCriticalTasks(allTasks, overdueTasks) {
        const container = document.getElementById('criticalTasksList');
        container.innerHTML = '';

        // Prioritize overdue, then High Priority tasks due today/tomorrow
        let critical = [...overdueTasks];
        
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const impendingHigh = allTasks.filter(t => {
            if (t.status === 'completed' || t.priority !== 'high' || t.archived) return false;
            return t.dueDate === todayStr || t.dueDate === tomorrowStr;
        });

        // Combine lists and filter duplicates
        critical = [...new Set([...critical, ...impendingHigh])];

        // Sort by priority and date
        critical.sort((a,b) => {
            if (a.priority === b.priority) {
                return (a.dueDate || '') > (b.dueDate || '') ? 1 : -1;
            }
            return a.priority === 'high' ? -1 : 1;
        });

        // Limit to 4
        critical = critical.slice(0, 4);

        if (critical.length === 0) {
            container.innerHTML = '<div class="empty-notifications">No urgent or overdue tasks</div>';
            return;
        }

        critical.forEach(task => {
            const isOverdue = task.dueDate && task.dueDate < todayStr;
            const dateLabel = isOverdue ? 'Overdue!' : (task.dueDate === todayStr ? 'Today' : 'Tomorrow');

            const item = document.createElement('div');
            item.className = 'upcoming-item';
            
            // Priority dot class
            let dotColor = 'var(--priority-low)';
            if (task.priority === 'high') dotColor = 'var(--priority-high)';
            if (task.priority === 'medium') dotColor = 'var(--priority-medium)';

            item.innerHTML = `
                <div class="upcoming-left">
                    <span class="upcoming-priority-dot" style="background-color: ${dotColor};"></span>
                    <span class="upcoming-title">${task.title}</span>
                </div>
                <div class="upcoming-date ${isOverdue ? 'overdue' : ''}">
                    <i data-lucide="alert-circle" style="width: 14px; height:14px;"></i>
                    <span>${dateLabel} ${task.dueTime || ''}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                this.onTaskClick(task.id);
            });

            container.appendChild(item);
        });

        // Re-trigger lucide icons render for dynamically added icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}


window.DashboardView = DashboardView;

