const themeKey = "gallerymage-theme";
const themeSelect = document.querySelector("#theme-select");
const themeToggle = document.querySelector("#auth-theme-toggle");
const validThemes = new Set(["light", "dark", "system"]);
let currentTheme = localStorage.getItem(themeKey) || "system";

if (!validThemes.has(currentTheme)) {
    currentTheme = "system";
}

export function initializeTheme() {
    applyTheme(currentTheme);
    if (themeSelect) {
        themeSelect.value = currentTheme;
        themeSelect.addEventListener("change", () => setTheme(themeSelect.value));
    }
    themeToggle?.addEventListener("click", () => {
        const themes = ["light", "dark", "system"];
        const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
        setTheme(next);
    });
}

function setTheme(theme) {
    if (!validThemes.has(theme)) return;
    currentTheme = theme;
    localStorage.setItem(themeKey, theme);
    applyTheme(theme);
    if (themeSelect) themeSelect.value = theme;
    if (themeToggle) {
        themeToggle.textContent = `Apariencia: ${themeLabel(theme)} · Cambiar`;
    }
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
        theme === "system" ? "light dark" : theme;
}

function themeLabel(theme) {
    return {
        light: "clara",
        dark: "oscura",
        system: "del sistema",
    }[theme];
}
