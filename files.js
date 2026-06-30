const userName = sessionStorage.getItem("userName");
const userCategories = JSON.parse(sessionStorage.getItem("userCategories") || "[]");

// ถ้ายังไม่ได้ล็อกอิน ให้เด้งกลับไปหน้า login
if (!userName) {
  window.location.href = "index.html";
}

document.getElementById("welcomeMsg").textContent = `ยินดีต้อนรับ ${userName}`;

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "index.html";
});

const categoryListEl = document.getElementById("categoryList");
const fileAreaEl = document.getElementById("fileArea");

function hasAccess(category) {
  return userCategories.includes("all") || userCategories.includes(category);
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_URL}?action=getCategories`);
    const data = await res.json();

    if (!data.success) {
      categoryListEl.innerHTML = `<p class="error-msg">${data.message}</p>`;
      return;
    }

    const visibleCategories = data.categories.filter(hasAccess);

    if (visibleCategories.length === 0) {
      categoryListEl.innerHTML = `<p class="hint">ไม่มีหมวดหมู่ที่เข้าถึงได้</p>`;
      return;
    }

    categoryListEl.innerHTML = "";
    visibleCategories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "category-btn";
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        loadFiles(cat);
      });
      categoryListEl.appendChild(btn);
    });
  } catch (err) {
    categoryListEl.innerHTML = `<p class="error-msg">โหลดหมวดหมู่ไม่สำเร็จ</p>`;
  }
}

async function loadFiles(category) {
  fileAreaEl.innerHTML = `<p class="loading">กำลังโหลดไฟล์...</p>`;

  try {
    const res = await fetch(`${API_URL}?action=getFiles&category=${encodeURIComponent(category)}`);
    const data = await res.json();

    if (!data.success) {
      fileAreaEl.innerHTML = `<p class="error-msg">${data.message}</p>`;
      return;
    }

    if (data.files.length === 0) {
      fileAreaEl.innerHTML = `<p class="hint">ไม่มีไฟล์ในหมวดนี้</p>`;
      return;
    }

    fileAreaEl.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "file-grid";

    data.files.forEach((file) => {
      const card = document.createElement("a");
      card.className = "file-card";
      card.href = file.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.innerHTML = `
        <div class="file-name">${file.name}</div>
        <div class="file-size">${formatSize(file.size)}</div>
      `;
      grid.appendChild(card);
    });

    fileAreaEl.appendChild(grid);
  } catch (err) {
    fileAreaEl.innerHTML = `<p class="error-msg">โหลดไฟล์ไม่สำเร็จ</p>`;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

loadCategories();
