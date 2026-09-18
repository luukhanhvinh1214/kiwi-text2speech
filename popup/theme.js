// Phải chạy đồng bộ ở <head>: áp nền sau lần vẽ đầu thì popup chớp sáng rồi mới tối.
const THEME_KEY = "kiwi-theme";

function savedTheme() {
  return localStorage.getItem(THEME_KEY) || "";
}

function currentTheme() {
  return savedTheme() || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

window.ktTheme = {
  current: currentTheme,
  toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    return next;
  }
};

applyTheme(savedTheme());
