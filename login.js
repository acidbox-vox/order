const modeSelect  = document.getElementById("modeSelect");
const codeSection = document.getElementById("codeSection");
const guestBtn    = document.getElementById("guestBtn");
const codeBtn     = document.getElementById("codeBtn");
const backBtn     = document.getElementById("backBtn");
const codeInput   = document.getElementById("codeInput");
const loginBtn    = document.getElementById("loginBtn");
const errorMsg    = document.getElementById("errorMsg");

// --- สลับ UI ---
codeBtn.addEventListener("click", () => {
  modeSelect.classList.add("hidden");
  codeSection.classList.remove("hidden");
  codeInput.focus();
  errorMsg.textContent = "";
});

backBtn.addEventListener("click", () => {
  codeSection.classList.add("hidden");
  modeSelect.classList.remove("hidden");
  errorMsg.textContent = "";
});

// --- เข้าแบบเกส ---
guestBtn.addEventListener("click", async () => {
  guestBtn.disabled = true;
  guestBtn.querySelector(".mode-label").textContent = "กำลังเข้าสู่ระบบ...";
  errorMsg.textContent = "";

  try {
    const res  = await fetch(`${API_URL}?action=getGuestAccess`);
    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem("userCode",       "GUEST");
      sessionStorage.setItem("userName",       "เกส");
      sessionStorage.setItem("userCategories", JSON.stringify(data.categories));
      sessionStorage.setItem("userRole",       "guest");
      window.location.href = "files.html";
    } else {
      errorMsg.textContent = data.message || "ยังไม่เปิดให้เกสเข้าใช้งาน";
    }
  } catch (err) {
    errorMsg.textContent = "เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง";
  } finally {
    guestBtn.disabled = false;
    guestBtn.querySelector(".mode-label").textContent = "เข้าใช้งานแบบเกส";
  }
});

// --- เข้าด้วยรหัส ---
async function doLogin() {
  const code = codeInput.value.trim();
  errorMsg.textContent = "";

  if (!code) {
    errorMsg.textContent = "กรุณากรอกรหัส";
    return;
  }

  loginBtn.disabled  = true;
  loginBtn.textContent = "กำลังตรวจสอบ...";

  try {
    const res  = await fetch(`${API_URL}?action=checkLogin&code=${encodeURIComponent(code)}`);
    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem("userCode",       code);
      sessionStorage.setItem("userName",       data.name);
      sessionStorage.setItem("userCategories", JSON.stringify(data.categories));
      sessionStorage.setItem("userRole",       data.role || "user");
      window.location.href = "files.html";
    } else {
      errorMsg.textContent = data.message || "เข้าสู่ระบบไม่สำเร็จ";
    }
  } catch (err) {
    errorMsg.textContent = "เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง";
  } finally {
    loginBtn.disabled    = false;
    loginBtn.textContent = "เข้าสู่ระบบ";
  }
}

loginBtn.addEventListener("click", doLogin);
codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
