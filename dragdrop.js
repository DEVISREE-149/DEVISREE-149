/* dragdrop.js */

class DragDropHandler {
    constructor(db, onDropUpdate) {
        this.db = db;
        this.onDropUpdate = onDropUpdate;
    }

    // Attach listeners to all draggable cards and drop zones
    init() {
        const cards = document.querySelectorAll('.task-card');
        const zones = document.querySelectorAll('.task-list-drop-zone');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => this.handleDragStart(e, card));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e, card));
        });

        zones.forEach(zone => {
            zone.addEventListener('dragover', (e) => this.handleDragOver(e, zone));
            zone.addEventListener('dragleave', (e) => this.handleDragLeave(e, zone));
            zone.addEventListener('drop', (e) => this.handleDrop(e, zone));
        });
    }

    handleDragStart(e, card) {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e, card) {
        card.classList.remove('dragging');
        document.querySelectorAll('.task-list-drop-zone').forEach(z => z.classList.remove('dragover'));
    }

    handleDragOver(e, zone) {
        e.preventDefault();
        zone.classList.add('dragover');
        
        const draggingCard = document.querySelector('.dragging');
        if (!draggingCard) return;

        const afterElement = this.getDragAfterElement(zone, e.clientY);
        if (afterElement == null) {
            zone.appendChild(draggingCard);
        } else {
            zone.insertBefore(draggingCard, afterElement);
        }
    }

    handleDragLeave(e, zone) {
        zone.classList.remove('dragover');
    }

    handleDrop(e, zone) {
        e.preventDefault();
        zone.classList.remove('dragover');
        
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId) return;

        // Retrieve section and subsection IDs from HTML data attributes
        const subsectionId = zone.dataset.subsectionId;
        const sectionId = zone.dataset.sectionId;

        // Fetch task from DB
        const tasks = this.db.getTasks(false);
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            // Update the task position in state
            task.sectionId = sectionId;
            task.subsectionId = subsectionId;

            // Reorder task items array based on DOM positions
            const cardsInDom = [...zone.querySelectorAll('.task-card')];
            const reorderedIds = cardsInDom.map(c => c.dataset.id);

            // Re-sort the database task array for this subsection
            const otherTasks = this.db.state.tasks.filter(t => t.subsectionId !== subsectionId || t.archived);
            const subTasksOrdered = [];
            
            reorderedIds.forEach(id => {
                const found = this.db.state.tasks.find(t => t.id === id);
                if (found) subTasksOrdered.push(found);
            });

            // Insert subtasks in ordered slots
            this.db.state.tasks = [...otherTasks, ...subTasksOrdered];
            this.db.saveTask(task); // Triggers local storage commit

            // Notify main controller
            this.onDropUpdate();
        }
    }

    // Identify which card position to insert a dragged card relative to y coordinates
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

window.DragDropHandler = DragDropHandler;

