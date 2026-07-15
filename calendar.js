/* calendar.js */

class CalendarView {
    constructor(db, onTaskClick, onDayClick) {
        this.db = db;
        this.onTaskClick = onTaskClick;
        this.onDayClick = onDayClick;
        
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();

        this.monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        this.initDOM();
    }

    initDOM() {
        this.monthYearTitle = document.getElementById('currentMonthYear');
        this.prevBtn = document.getElementById('prevMonthBtn');
        this.nextBtn = document.getElementById('nextMonthBtn');
        this.daysGrid = document.getElementById('calendarGridDays');

        this.prevBtn.addEventListener('click', () => this.navigateMonth(-1));
        this.nextBtn.addEventListener('click', () => this.navigateMonth(1));
    }

    navigateMonth(offset) {
        this.currentMonth += offset;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.render();
    }

    render() {
        // Set month header text
        this.monthYearTitle.textContent = `${this.monthNames[this.currentMonth]} ${this.currentYear}`;
        this.daysGrid.innerHTML = '';

        // Calculate days metrics
        const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const prevLastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
        const totalGridCells = 42; // 6 rows * 7 days

        // Get all unarchived tasks for date mapping
        const tasks = this.db.getTasks(false);

        // 1. Previous Month's Ending Days
        for (let i = firstDayIndex; i > 0; i--) {
            const dayNum = prevLastDay - i + 1;
            const cellDate = new Date(this.currentYear, this.currentMonth - 1, dayNum);
            this.createDayCell(dayNum, cellDate, true, tasks);
        }

        // 2. Current Month's Days
        for (let i = 1; i <= lastDay; i++) {
            const cellDate = new Date(this.currentYear, this.currentMonth, i);
            this.createDayCell(i, cellDate, false, tasks);
        }

        // 3. Next Month's Starting Days to fill out the grid
        const remainingCells = totalGridCells - (firstDayIndex + lastDay);
        for (let i = 1; i <= remainingCells; i++) {
            const cellDate = new Date(this.currentYear, this.currentMonth + 1, i);
            this.createDayCell(i, cellDate, true, tasks);
        }
    }

    createDayCell(dayNum, dateObj, isOtherMonth, tasks) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        if (isOtherMonth) {
            cell.classList.add('other-month');
        }

        // Check if date is Today
        const today = new Date();
        if (dateObj.toDateString() === today.toDateString()) {
            cell.classList.add('today');
        }

        // Set day number label
        const numberLabel = document.createElement('span');
        numberLabel.className = 'calendar-day-number';
        numberLabel.textContent = dayNum;
        cell.appendChild(numberLabel);

        // Format date string for task matching (YYYY-MM-DD)
        const dateStr = dateObj.toISOString().split('T')[0];

        // Find and render tasks matching this date
        const dayTasks = tasks.filter(t => t.dueDate === dateStr);
        dayTasks.forEach(task => {
            const badge = document.createElement('div');
            badge.className = `calendar-task-badge ${task.priority}`;
            badge.textContent = `${task.pinned ? '📌 ' : ''}${task.title}`;
            badge.title = task.title;
            badge.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent opening day click quick-add
                this.onTaskClick(task.id);
            });
            cell.appendChild(badge);
        });

        // Click handler to add task on this date
        cell.addEventListener('click', () => {
            this.onDayClick(dateStr);
        });

        this.daysGrid.appendChild(cell);
    }
}

window.CalendarView = CalendarView;

