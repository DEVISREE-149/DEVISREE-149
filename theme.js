/* theme.js */

class ThemeManager {
    constructor(db) {
        this.db = db;
        this.applyStoredTheme();
    }

    // Read stored settings and apply the selected theme
    applyStoredTheme() {
        const settings = this.db.getThemeSettings();
        this.setTheme(settings.theme, settings.customTheme);
    }

    // Set theme (preset name, or custom color details)
    setTheme(themeName, customColors = null) {
        // Reset classes
        document.body.classList.remove('theme-dark', 'theme-light', 'theme-highcontrast');
        
        // Clear custom inline styles
        document.body.removeAttribute('style');

        if (themeName === 'custom' && customColors) {
            document.body.classList.add('theme-dark'); // Use dark theme skeleton as fallback

            // Compute custom theme variants
            const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            };

            const rgb = hexToRgb(customColors.primary);
            const primaryGlow = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)` : 'rgba(99, 102, 241, 0.35)';

            // Set custom variables
            document.body.style.setProperty('--bg-app', customColors.bg);
            document.body.style.setProperty('--bg-card', customColors.cardBg);
            document.body.style.setProperty('--bg-card-hover', this.lightenDarkenColor(customColors.cardBg, 10));
            document.body.style.setProperty('--bg-card-border', 'rgba(255,255,255,0.06)');
            document.body.style.setProperty('--bg-input', this.lightenDarkenColor(customColors.cardBg, -10));
            document.body.style.setProperty('--bg-sidebar', this.lightenDarkenColor(customColors.bg, -5));
            document.body.style.setProperty('--primary-color', customColors.primary);
            document.body.style.setProperty('--primary-glow', primaryGlow);
            document.body.style.setProperty('--text-primary', customColors.text);
            document.body.style.setProperty('--text-secondary', this.opacityColor(customColors.text, 0.7));
            document.body.style.setProperty('--text-muted', this.opacityColor(customColors.text, 0.45));
            document.body.style.setProperty('--bg-modal', this.lightenDarkenColor(customColors.cardBg, 5));
        } else {
            document.body.classList.add(`theme-${themeName}`);
        }

        // Save theme in DB settings
        this.db.saveThemeSettings({
            theme: themeName,
            customTheme: customColors || this.db.getThemeSettings().customTheme
        });

        // Highlight selected theme preset card if modal is open
        this.updatePresetCardsActive(themeName);
    }

    // Help function to adjust color brightness
    lightenDarkenColor(col, amt) {
        let usePound = false;
        if (col[0] === "#") {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255;
        else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255;
        else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255;
        else if (g < 0) g = 0;
        return (usePound ? "#" : "") + ((g | (b << 8) | (r << 16)).toString(16)).padStart(6, '0');
    }

    // Help function to add opacity to Hex
    opacityColor(hex, opacity) {
        if (hex[0] === '#') {
            hex = hex.slice(1);
        }
        const r = parseInt(hex.substring(0,2), 16);
        const g = parseInt(hex.substring(2,4), 16);
        const b = parseInt(hex.substring(4,6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // UI state indicator sync for active theme cards
    updatePresetCardsActive(themeName) {
        document.querySelectorAll('.theme-preset-card').forEach(card => {
            if (card.dataset.theme === themeName) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }
}

window.ThemeManager = ThemeManager;

