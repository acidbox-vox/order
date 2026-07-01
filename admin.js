const userRole = sessionStorage.getItem("userRole");
const userCode = sessionStorage.getItem("userCode");
const userName = sessionStorage.getItem("userName");

// ถ้าไม่ได้ล็อกอิน หรือไม่ใช่ admin ห้ามเข้าหน้านี้
if (!userCode || userRole !== "admin") {
  window.location.href = "index.html";
}

document.getElementById("welcomeMsg").textContent = `แอดมิน: ${userName}`;
document.getElementById("backToFilesBtn").addEventListener("click", () => {
  window.location.href = "files.html";
});
document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "index.html";
});

const userTableBody = document.getElementById("userTableBody");
const addUserBtn = document.getElementById("addUserBtn");

const modal = document.getElementById("userModal");
const modalTitle = document.getElementById("modalTitle");
const modalCode = document.getElementById("modalCode");
const modalName = document.getElementById("modalName");
const modalCategories = document.getElementById("modalCategories");
const modalSaveBtn = document.getElementById("modalSaveBtn");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalError = document.getElementById("modalError");

let allCategories = [];   // รายชื่อหมวดหมู่ทั้งหมดจาก Drive
let allUsers = [];        // รายชื่อ user ทั้งหมดจาก Sheet
let editingCode = null;   // ถ้าไม่ใช่ null = กำลังแก้ไข user คนนี้อยู่ (ห้ามแก้ code)

async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, adminCode: userCode, ...payload })
  });
  return res.json();
}

async function loadCategories() {
  const res = await fetch(`${API_URL}?action=getCategories`);
  const data = await res.json();
  allCategories = data.success ? data.categories : [];
}

async function loadUsers() {
  userTableBody.innerHTML = `<tr><td colspan="5" class="hint">กำลังโหลด...</td></tr>`;
  const data = await apiPost("getUsers");

  if (!data.success) {
    userTableBody.innerHTML = `<tr><td colspan="5" class="error-msg">${data.message}</td></tr>`;
    return;
  }

  allUsers = data.users;
  renderUserTable();
}

function renderUserTable() {
  if (allUsers.length === 0) {
    userTableBody.innerHTML = `<tr><td colspan="5" class="hint">ยังไม่มีผู้ใช้</td></tr>`;
    return;
  }

  userTableBody.innerHTML = "";
  allUsers.forEach((u) => {
    const tr = document.createElement("tr");
    const categoryText = u.categories.includes("all") ? "ทั้งหมด" : u.categories.join(", ") || "-";

    tr.innerHTML = `
      <td>${u.code}${u.code === "GUEST" ? ' <span class="guest-badge">เกส</span>' : ""}</td>
      <td>${u.name}</td>
      <td>${categoryText}</td>
      <td>${u.status}</td>
      <td class="row-actions"></td>
    `;

    const editBtn = document.createElement("button");
    editBtn.className = "link-btn";
    editBtn.textContent = "แก้ไข";
    editBtn.addEventListener("click", () => openModal(u));

    tr.querySelector(".row-actions").appendChild(editBtn);

    // ปุ่มลบ: ถ้าเป็น GUEST ห้ามลบ
    if (u.code !== "GUEST") {
      const delBtn = document.createElement("button");
      delBtn.className = "link-btn danger";
      delBtn.textContent = "ลบ";
      delBtn.addEventListener("click", () => removeUser(u.code));
      tr.querySelector(".row-actions").appendChild(delBtn);
    }
    userTableBody.appendChild(tr);
  });
}

function renderCategoryCheckboxes(selected = []) {
  const isAll = selected.includes("all");
  modalCategories.innerHTML = "";

  const allLabel = document.createElement("label");
  allLabel.className = "checkbox-item";
  allLabel.innerHTML = `<input type="checkbox" id="catAll"> <strong>ทั้งหมด (all)</strong>`;
  modalCategories.appendChild(allLabel);
  const allCheckbox = allLabel.querySelector("input");
  allCheckbox.checked = isAll;

  const singleBoxes = [];
  allCategories.forEach((cat) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    label.innerHTML = `<input type="checkbox" value="${cat.name}"> ${cat.name}`;
    const checkbox = label.querySelector("input");
    checkbox.checked = isAll || selected.includes(cat.name);
    checkbox.disabled = isAll;
    modalCategories.appendChild(label);
    singleBoxes.push(checkbox);
  });

  // ติ๊ก "ทั้งหมด" แล้วให้ checkbox ย่อยถูกล็อกและติ๊กตามไปด้วย
  allCheckbox.addEventListener("change", () => {
    singleBoxes.forEach((cb) => {
      cb.disabled = allCheckbox.checked;
      if (allCheckbox.checked) cb.checked = true;
    });
  });
}

function getSelectedCategories() {
  const allChecked = document.getElementById("catAll").checked;
  if (allChecked) return ["all"];

  return Array.from(modalCategories.querySelectorAll('input[type="checkbox"]:not(#catAll)'))
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
}

function openModal(user = null) {
  editingCode = user ? user.code : null;
  modalTitle.textContent = user ? `แก้ไขสิทธิ์: ${user.name}` : "เพิ่มผู้ใช้ใหม่";
  modalCode.value = user ? user.code : "";
  modalCode.disabled = !!user; // แก้ไข user เดิม ห้ามเปลี่ยนรหัส
  modalName.value = user ? user.name : "";
  modalError.textContent = "";

  renderCategoryCheckboxes(user ? user.categories : []);
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

modalCancelBtn.addEventListener("click", closeModal);
addUserBtn.addEventListener("click", () => openModal(null));

modalSaveBtn.addEventListener("click", async () => {
  const code = modalCode.value.trim();
  const name = modalName.value.trim();
  const categories = getSelectedCategories();

  if (!code || !name) {
    modalError.textContent = "กรุณากรอกรหัสและชื่อให้ครบ";
    return;
  }

  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = "กำลังบันทึก...";

  try {
    let data;
    if (editingCode) {
      data = await apiPost("updateUserCategories", { code: editingCode, categories });
    } else {
      data = await apiPost("addUser", { code, name, categories });
    }

    if (data.success) {
      closeModal();
      loadUsers();
    } else {
      modalError.textContent = data.message || "บันทึกไม่สำเร็จ";
    }
  } catch (err) {
    modalError.textContent = "เชื่อมต่อระบบไม่ได้";
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = "บันทึก";
  }
});

async function removeUser(code) {
  if (!confirm(`ต้องการลบผู้ใช้รหัส ${code} ใช่หรือไม่`)) return;

  const data = await apiPost("deleteUser", { code });
  if (data.success) {
    loadUsers();
  } else {
    alert(data.message || "ลบไม่สำเร็จ");
  }
}

async function init() {
  await loadCategories();
  await loadUsers();
}

init();
