const userName = sessionStorage.getItem("userName");
const userRole = sessionStorage.getItem("userRole");
const userCode = sessionStorage.getItem("userCode");
const userCategories = JSON.parse(sessionStorage.getItem("userCategories") || "[]");

if (!userName) {
  window.location.href = "index.html";
}

document.getElementById("welcomeMsg").textContent = `ยินดีต้อนรับ ${userName}`;

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
const contentBodyEl = document.getElementById("contentBody");
const searchInput = document.getElementById("searchInput");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const uploadModal = document.getElementById("uploadModal");
const uploadTargetHint = document.getElementById("uploadTargetHint");
const uploadNameInput = document.getElementById("uploadNameInput");
const uploadConfirmBtn = document.getElementById("uploadConfirmBtn");
const uploadCancelBtn = document.getElementById("uploadCancelBtn");
const uploadError = document.getElementById("uploadError");

let pathStack = [];     // breadcrumb เวลาไล่ดูโฟลเดอร์ปกติ
let searchTimer = null; // ใช้หน่วงเวลาตอนพิมพ์ค้นหา (debounce)
let pendingFile = null; // ไฟล์ที่เลือกไว้รออัปโหลด

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
        searchInput.value = "";
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
  contentBodyEl.innerHTML = `<p class="loading">กำลังโหลด...</p>`;
  if (userRole === "admin") uploadBtn.classList.remove("hidden");
  else uploadBtn.classList.add("hidden");

  try {
    const res = await fetch(`${API_URL}?action=getFolderContents&folderId=${encodeURIComponent(folderId)}`);
    const data = await res.json();

    if (!data.success) {
      contentBodyEl.innerHTML = `<p class="error-msg">${data.message}</p>`;
      return;
    }

    contentBodyEl.innerHTML = "";
    contentBodyEl.appendChild(renderBreadcrumb());

    if (data.subfolders.length === 0 && data.files.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "โฟลเดอร์นี้ว่างเปล่า";
      contentBodyEl.appendChild(empty);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "file-grid";

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

    data.files.forEach((file) => {
      grid.appendChild(buildFileCard(file));
    });

    contentBodyEl.appendChild(grid);
  } catch (err) {
    contentBodyEl.innerHTML = `<p class="error-msg">โหลดข้อมูลไม่สำเร็จ</p>`;
  }
}

function getFileIcon(mimeType) {
  if (!mimeType) return { icon: "📄", color: "#6b7280" };
  if (mimeType.includes("pdf"))                        return { icon: "📕", color: "#ef4444" };
  if (mimeType.includes("word") || mimeType.includes("document"))
                                                       return { icon: "📘", color: "#2563eb" };
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
                                                       return { icon: "📗", color: "#10b981" };
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
                                                       return { icon: "📙", color: "#f59e0b" };
  if (mimeType.startsWith("image/"))                   return { icon: "🖼️", color: "#8b5cf6" };
  if (mimeType.startsWith("video/"))                   return { icon: "🎬", color: "#ec4899" };
  if (mimeType.startsWith("audio/"))                   return { icon: "🎵", color: "#06b6d4" };
  if (mimeType.includes("zip") || mimeType.includes("compressed"))
                                                       return { icon: "🗜️", color: "#78716c" };
  return { icon: "📄", color: "#6b7280" };
}

function buildFileCard(file, showPath = false) {
  const card = document.createElement("a");
  card.className = "file-card file-card-preview";
  card.href = file.url;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  const { icon, color } = getFileIcon(file.mimeType);

  // ส่วนพรีวิวด้านบน
  const preview = document.createElement("div");
  preview.className = "card-preview";
  preview.style.setProperty("--file-color", color);

  if (file.thumbnailUrl) {
    const img = document.createElement("img");
    img.src = file.thumbnailUrl;
    img.alt = file.name;
    img.className = "card-thumb";
    img.onerror = () => {
      // โหลดรูปไม่ได้ → แสดงไอคอนแทน
      img.remove();
      preview.classList.add("card-preview-icon");
      preview.textContent = icon;
    };
    preview.appendChild(img);
  } else {
    preview.classList.add("card-preview-icon");
    preview.textContent = icon;
  }

  // ส่วนชื่อและขนาดด้านล่าง
  const info = document.createElement("div");
  info.className = "card-info";
  info.innerHTML = `
    <div class="file-name">${file.name}</div>
    <div class="file-size">${showPath ? file.path + " · " : ""}${formatSize(file.size)}</div>
  `;

  card.appendChild(preview);
  card.appendChild(info);
  return card;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ---------- ค้นหาไฟล์แบบ realtime ----------
async function runSearch(query) {
  contentBodyEl.innerHTML = `<p class="loading">กำลังค้นหา...</p>`;

  try {
    const categoriesParam = encodeURIComponent(userCategories.join(","));
    const res = await fetch(`${API_URL}?action=search&query=${encodeURIComponent(query)}&categories=${categoriesParam}`);
    const data = await res.json();

    if (!data.success) {
      contentBodyEl.innerHTML = `<p class="error-msg">${data.message}</p>`;
      return;
    }

    contentBodyEl.innerHTML = "";

    const heading = document.createElement("p");
    heading.className = "hint";
    heading.textContent = `ผลการค้นหา "${query}" — พบ ${data.results.length} ไฟล์`;
    contentBodyEl.appendChild(heading);

    if (data.results.length === 0) return;

    const grid = document.createElement("div");
    grid.className = "file-grid";
    data.results.forEach((file) => grid.appendChild(buildFileCard(file, true)));
    contentBodyEl.appendChild(grid);
  } catch (err) {
    contentBodyEl.innerHTML = `<p class="error-msg">ค้นหาไม่สำเร็จ</p>`;
  }
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  clearTimeout(searchTimer);
  uploadBtn.classList.add("hidden"); // ตอนค้นหา ไม่รู้ว่าจะอัปโหลดเข้าโฟลเดอร์ไหน เลยซ่อนไว้ก่อน

  if (!query) {
    // เคลียร์ช่องค้นหา กลับไปแสดงข้อความเริ่มต้น
    document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
    contentBodyEl.innerHTML = `<p class="hint">เลือกหมวดหมู่ทางซ้ายเพื่อดูไฟล์ หรือพิมพ์ค้นหาด้านบน</p>`;
    return;
  }

  // หน่วงเวลา 350ms หลังหยุดพิมพ์ ค่อยยิงค้นหาจริง กันยิง API รัวเกินไป
  searchTimer = setTimeout(() => runSearch(query), 350);
});

// ---------- อัปโหลดไฟล์ (เฉพาะ admin) ----------
uploadBtn.addEventListener("click", () => {
  fileInput.value = "";
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  pendingFile = file;
  const currentFolder = pathStack[pathStack.length - 1];
  uploadTargetHint.textContent = `จะบันทึกเข้าโฟลเดอร์: ${pathStack.map(p => p.name).join(" / ")}`;

  // ตั้งชื่อเริ่มต้นให้ตรงกับไฟล์ที่เลือก (ตัดนามสกุลออก ผู้ใช้แก้ไขได้)
  const dotIndex = file.name.lastIndexOf(".");
  const baseName = dotIndex > 0 ? file.name.substring(0, dotIndex) : file.name;
  uploadNameInput.value = baseName;
  uploadError.textContent = "";

  uploadModal.classList.remove("hidden");
});

uploadCancelBtn.addEventListener("click", () => {
  uploadModal.classList.add("hidden");
  pendingFile = null;
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // ตัด prefix "data:...;base64," ออก เหลือแต่เนื้อ base64 จริงๆ
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

uploadConfirmBtn.addEventListener("click", async () => {
  if (!pendingFile) return;

  const currentFolder = pathStack[pathStack.length - 1];
  let newName = uploadNameInput.value.trim();

  if (!newName) {
    uploadError.textContent = "กรุณาตั้งชื่อไฟล์";
    return;
  }

  // ถ้าผู้ใช้ไม่ได้พิมพ์นามสกุลไว้ ให้เติมนามสกุลเดิมของไฟล์ที่เลือกให้อัตโนมัติ
  const originalDot = pendingFile.name.lastIndexOf(".");
  const originalExt = originalDot > 0 ? pendingFile.name.substring(originalDot) : "";
  if (originalExt && !newName.toLowerCase().endsWith(originalExt.toLowerCase())) {
    newName += originalExt;
  }

  uploadConfirmBtn.disabled = true;
  uploadConfirmBtn.textContent = "กำลังอัปโหลด...";
  uploadError.textContent = "";

  try {
    const base64Data = await fileToBase64(pendingFile);
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "uploadFile",
        adminCode: userCode,
        folderId: currentFolder.id,
        fileName: newName,
        mimeType: pendingFile.type || "application/octet-stream",
        base64Data: base64Data
      })
    });
    const data = await res.json();

    if (data.success) {
      uploadModal.classList.add("hidden");
      pendingFile = null;
      openFolder(currentFolder.id); // โหลดรายการไฟล์ใหม่ ให้เห็นไฟล์ที่เพิ่งอัปโหลดทันที
    } else {
      uploadError.textContent = data.message || "อัปโหลดไม่สำเร็จ";
    }
  } catch (err) {
    uploadError.textContent = "เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง";
  } finally {
    uploadConfirmBtn.disabled = false;
    uploadConfirmBtn.textContent = "อัปโหลด";
  }
});

loadCategories();
