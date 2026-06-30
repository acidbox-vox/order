const codeInput = document.getElementById("codeInput");
const loginBtn = document.getElementById("loginBtn");
const errorMsg = document.getElementById("errorMsg");

async function doLogin() {
  const code = codeInput.value.trim();
  errorMsg.textContent = "";

  if (!code) {
    errorMsg.textContent = "กรุณากรอกรหัส";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "กำลังตรวจสอบ...";

  try {
    const res = await fetch(`${API_URL}?action=checkLogin&code=${encodeURIComponent(code)}`);
    const data = await res.json();

    if (data.success) {
      // เก็บข้อมูล session ไว้ใช้ในหน้าแสดงไฟล์ / หน้าแอดมิน
      sessionStorage.setItem("userCode", code);
      sessionStorage.setItem("userName", data.name);
      sessionStorage.setItem("userCategories", JSON.stringify(data.categories));
      sessionStorage.setItem("userRole", data.role || "user");

      // ทุกคนเข้าหน้าแสดงไฟล์เหมือนกัน ถ้าเป็น admin จะมีเมนูจัดการผู้ใช้เพิ่มให้ในหน้านั้น
      window.location.href = "files.html";
    } else {
      errorMsg.textContent = data.message || "เข้าสู่ระบบไม่สำเร็จ";
    }
  } catch (err) {
    errorMsg.textContent = "เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "เข้าสู่ระบบ";
  }
}

loginBtn.addEventListener("click", doLogin);
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});
