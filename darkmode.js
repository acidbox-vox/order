(function () {
  var html = document.documentElement;

  function applyTheme(dark) {
    if (dark) html.classList.add("dark");
    else html.classList.remove("dark");
    var btn = document.getElementById("dm-btn");
    if (btn) btn.textContent = dark ? "☀️" : "🌙";
  }

  var saved = localStorage.getItem("theme");
  applyTheme(saved === "dark");

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("dm-btn");
    if (!btn) return;
    btn.textContent = html.classList.contains("dark") ? "☀️" : "🌙";
    btn.addEventListener("click", function () {
      var isDark = html.classList.contains("dark");
      localStorage.setItem("theme", isDark ? "light" : "dark");
      applyTheme(!isDark);
    });
  });
})();
