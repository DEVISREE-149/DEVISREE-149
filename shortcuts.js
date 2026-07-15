/* shortcuts.js */

class KeyboardShortcuts {
    constructor(callbacks) {
        this.callbacks = callbacks; // Object containing callback functions mapped to views/modals
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(e) {
        // Do not trigger shortcuts when user is typing in inputs or textareas
        const activeTag = document.activeElement.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement.isContentEditable) {
            // Allow escape key to blur / close inputs or modals anyway
            if (e.key === 'Escape') {
                document.activeElement.blur();
                if (this.callbacks.onEscape) {
                    this.callbacks.onEscape();
                }
            }
            return;
        }

        const key = e.key.toLowerCase();

        switch (key) {
            case '1':
                e.preventDefault();
                this.callbacks.onViewChange('dashboard');
                break;
            case '2':
                e.preventDefault();
                this.callbacks.onViewChange('tasks');
                break;
            case '3':
                e.preventDefault();
                this.callbacks.onViewChange('calendar');
                break;
            case '4':
                e.preventDefault();
                this.callbacks.onViewChange('archive');
                break;
            case 'n':
                e.preventDefault();
                this.callbacks.onOpenNewTask();
                break;
            case '/':
                e.preventDefault();
                this.callbacks.onFocusSearch();
                break;
            case 'p':
                e.preventDefault();
                this.callbacks.onOpenModal('account');
                break;
            case 't':
                e.preventDefault();
                this.callbacks.onOpenModal('theme');
                break;
            case '?':
                e.preventDefault();
                this.callbacks.onOpenModal('shortcuts');
                break;
            case 'escape':
                e.preventDefault();
                if (this.callbacks.onEscape) {
                    this.callbacks.onEscape();
                }
                break;
        }
    }
}

window.KeyboardShortcuts = KeyboardShortcuts;

