const userName = sessionStorage.getItem("userName");
const userRole = sessionStorage.getItem("userRole");
const userCategories = JSON.parse(sessionStorage.getItem("userCategories") || "[]");

if (!userName) {
  window.location.href = "index.html";
}

document.getElementById("welcomeMsg").textContent = `ยินดีต้อนรับ ${userName}`;

// admin จะเห็นปุ่ม "จัดการผู้ใช้" เพิ่มขึ้นมาในหน้านี้
if (userRole === "admin") {
  const adminLink = document.getElementById("adminLink");
  adminLink.classList.remove("hidden");
  adminLink.addEventListener("click", () => {
    window.location.href = "admin.html";
  });
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "index.html";
});

const categoryListEl = document.getElementById("categoryList");
const fileAreaEl = document.getElementById("fileArea");

// เก็บลำดับการคลิกไล่ลึกลงไป เช่น [{id,name}, {id,name}, ...] ใช้ทำ breadcrumb
let pathStack = [];

function hasAccess(categoryName) {
  return userCategories.includes("all") || userCategories.includes(categoryName);
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_URL}?action=getCategories`);
    const data = await res.json();

    if (!data.success) {
      categoryListEl.innerHTML = `<p class="error-msg">${data.message}</p>`;
      return;
    }

    const visibleCategories = data.categories.filter(c => hasAccess(c.name));

    if (visibleCategories.length === 0) {
      categoryListEl.innerHTML = `<p class="hint">ไม่มีหมวดหมู่ที่เข้าถึงได้</p>`;
      return;
    }

    categoryListEl.innerHTML = "";
    visibleCategories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "category-btn";
      btn.textContent = cat.name;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        pathStack = [{ id: cat.id, name: cat.name }];
        openFolder(cat.id);
      });
      categoryListEl.appendChild(btn);
    });
  } catch (err) {
    categoryListEl.innerHTML = `<p class="error-msg">โหลดหมวดหมู่ไม่สำเร็จ</p>`;
  }
}

function renderBreadcrumb() {
  const crumb = document.createElement("div");
  crumb.className = "breadcrumb";

  pathStack.forEach((item, idx) => {
    const span = document.createElement("span");
    span.textContent = item.name;
    span.className = "crumb-item";
    if (idx < pathStack.length - 1) {
      span.addEventListener("click", () => {
        pathStack = pathStack.slice(0, idx + 1);
        openFolder(item.id);
      });
    } else {
      span.classList.add("crumb-current");
    }
    crumb.appendChild(span);

    if (idx < pathStack.length - 1) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "/";
      crumb.appendChild(sep);
    }
  });

  return crumb;
}

async function openFolder(folderId) {
  fileAreaEl.innerHTML = `<p class="loading">กำลังโหลด...</p>`;

  try {
    const res = await fetch(`${API_URL}?action=getFolderContents&folderId=${encodeURIComponent(folderId)}`);
    const data = await res.json();

    if (!data.success) {
      fileAreaEl.innerHTML = `<p class="error-msg">${data.message}</p>`;
      return;
    }

    fileAreaEl.innerHTML = "";
    fileAreaEl.appendChild(renderBreadcrumb());

    if (data.subfolders.length === 0 && data.files.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "โฟลเดอร์นี้ว่างเปล่า";
      fileAreaEl.appendChild(empty);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "file-grid";

    // โฟลเดอร์ย่อยแสดงก่อน คลิกแล้วไล่ลึกลงไปอีกชั้น
    data.subfolders.forEach((sub) => {
      const card = document.createElement("div");
      card.className = "file-card folder-card";
      card.innerHTML = `
        <div class="file-name"><i class="folder-icon">📁</i> ${sub.name}</div>
        <div class="file-size">โฟลเดอร์ย่อย</div>
      `;
      card.addEventListener("click", () => {
        pathStack.push({ id: sub.id, name: sub.name });
        openFolder(sub.id);
      });
      grid.appendChild(card);
    });

    // ไฟล์ในชั้นนี้
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
    fileAreaEl.innerHTML = `<p class="error-msg">โหลดข้อมูลไม่สำเร็จ</p>`;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

loadCategories();
