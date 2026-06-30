/**
 * ========== ตั้งค่าก่อนใช้งาน ==========
 * 1. SHEET_ID  : เปิด Google Sheet "Users_DB" แล้ว copy ID จาก URL
 *    เช่น https://docs.google.com/spreadsheets/d/XXXXXXXXXX/edit
 *                                                   ^^^^^^^^^^ อันนี้
 * 2. ROOT_FOLDER_ID : เปิดโฟลเดอร์ "Files_Root" ใน Drive แล้ว copy ID จาก URL
 *    เช่น https://drive.google.com/drive/folders/YYYYYYYYYY
 *                                                  ^^^^^^^^^^ อันนี้
 */
const SHEET_ID = "ใส่ SHEET_ID ตรงนี้";
const SHEET_NAME = "Users"; // ชื่อแท็บในชีต
const ROOT_FOLDER_ID = "ใส่ ROOT_FOLDER_ID ตรงนี้";

/**
 * ทางเข้า Web App ทั้งหมด — frontend จะยิง GET มาที่ URL เดียวนี้
 * พร้อม query string ?action=checkLogin&code=1234
 * หรือ ?action=getFiles&category=เอกสาร
 */
function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    if (action === "checkLogin") {
      result = checkLogin(e.parameter.code);
    } else if (action === "getCategories") {
      result = getCategories();
    } else if (action === "getFolderContents") {
      result = getFolderContents(e.parameter.folderId);
    } else if (action === "search") {
      result = searchFiles(e.parameter.query, e.parameter.categories);
    } else {
      result = { success: false, message: "ไม่รู้จัก action นี้" };
    }
  } catch (err) {
    result = { success: false, message: "เกิดข้อผิดพลาด: " + err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ทางเข้าสำหรับ action ที่เป็นการเขียน/แก้ไขข้อมูล (เฉพาะ admin)
 * frontend ส่งมาเป็น POST, body เป็น JSON เช่น
 * { action: "updateUserCategories", adminCode: "1234", code: "2222", categories: ["1-คำสั่งสนาม"] }
 */
function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    // ทุก action ที่เขียนข้อมูล ต้องยืนยันก่อนว่าเป็น admin จริง
    // (เช็คซ้ำฝั่ง server ไม่เชื่อแค่ฝั่งหน้าเว็บ)
    if (!isAdmin(body.adminCode)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: "ไม่มีสิทธิ์ดำเนินการนี้" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getUsers") {
      result = getUsers();
    } else if (action === "updateUserCategories") {
      result = updateUserCategories(body.code, body.categories);
    } else if (action === "addUser") {
      result = addUser(body.code, body.name, body.categories);
    } else if (action === "deleteUser") {
      result = deleteUser(body.code);
    } else {
      result = { success: false, message: "ไม่รู้จัก action นี้" };
    }
  } catch (err) {
    result = { success: false, message: "เกิดข้อผิดพลาด: " + err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * เช็คว่ารหัสที่ส่งมาเป็นของ admin จริง (เช็คซ้ำฝั่ง server)
 */
function isAdmin(code) {
  if (!code) return false;
  const result = checkLogin(code);
  return result.success && result.role === "admin";
}

/**
 * ตรวจสอบรหัสที่กรอกเข้ามา เทียบกับ Google Sheet
 * คืนค่า: { success, name, categories, message }
 */
function checkLogin(code) {
  if (!code) {
    return { success: false, message: "กรุณากรอกรหัส" };
  }

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues(); // แถวแรกเป็น header
  const header = data[0];

  const colCode = header.indexOf("code");
  const colName = header.indexOf("name");
  const colCategories = header.indexOf("categories");
  const colStatus = header.indexOf("status");
  const colRole = header.indexOf("role");

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[colCode]).trim() === String(code).trim()) {
      if (String(row[colStatus]).toLowerCase() !== "active") {
        return { success: false, message: "บัญชีนี้ถูกระงับการใช้งาน" };
      }
      return {
        success: true,
        name: row[colName],
        categories: String(row[colCategories]).split(",").map(c => c.trim()),
        role: colRole >= 0 ? String(row[colRole]).trim().toLowerCase() : "user"
      };
    }
  }

  return { success: false, message: "รหัสไม่ถูกต้อง" };
}

/**
 * ดึงรายชื่อหมวดหมู่ทั้งหมด = ชื่อโฟลเดอร์ย่อยใน Files_Root
 * เพิ่ม/ลบ/เปลี่ยนชื่อโฟลเดอร์ใน Drive ได้เลย ไม่ต้องแก้โค้ด
 */
function getCategories() {
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const subFolders = rootFolder.getFolders();
  const categories = [];

  while (subFolders.hasNext()) {
    const folder = subFolders.next();
    categories.push({ id: folder.getId(), name: folder.getName() });
  }

  return { success: true, categories: categories };
}

/**
 * ดึงเนื้อหาของโฟลเดอร์ใดๆ ก็ได้ (ทั้งไฟล์และโฟลเดอร์ย่อย)
 * frontend ส่ง folderId มา (เริ่มจาก id ของหมวดหมู่ที่ได้จาก getCategories)
 * แล้วใช้ id ของโฟลเดอร์ย่อยที่คืนกลับมาเรียกซ้ำ เพื่อไล่ลึกลงไปได้เรื่อยๆ
 * คืนค่า: { success, folderName, folderId, subfolders: [{id,name}], files: [...] }
 */
function getFolderContents(folderId) {
  if (!folderId) {
    return { success: false, message: "กรุณาระบุโฟลเดอร์" };
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (err) {
    return { success: false, message: "ไม่พบโฟลเดอร์นี้" };
  }

  // โฟลเดอร์ย่อย
  const subFolderIter = folder.getFolders();
  const subfolders = [];
  while (subFolderIter.hasNext()) {
    const sub = subFolderIter.next();
    subfolders.push({ id: sub.getId(), name: sub.getName() });
  }

  // ไฟล์ในชั้นนี้
  const fileIter = folder.getFiles();
  const fileList = [];
  while (fileIter.hasNext()) {
    const file = fileIter.next();
    fileList.push({
      name: file.getName(),
      url: file.getUrl(),
      downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId(),
      size: file.getSize(),
      updated: file.getLastUpdated()
    });
  }

  return {
    success: true,
    folderName: folder.getName(),
    folderId: folder.getId(),
    subfolders: subfolders,
    files: fileList
  };
}

/**
 * ค้นหาไฟล์จากชื่อ ไล่ทุกชั้นย่อยใน Files_Root
 * query           : คำค้นหา (ค้นแบบ "มีคำนี้อยู่ในชื่อ" ไม่สนตัวพิมพ์เล็ก/ใหญ่)
 * allowedCategoriesCsv : รายชื่อหมวดที่ผู้ใช้คนนี้มีสิทธิ์เห็น คั่นด้วย comma เช่น "1-คำสั่งสนาม,4-ระเบียบ"
 *                        หรือ "all" ถ้าเห็นได้ทุกหมวด — ป้องกันไม่ให้ค้นหาเจอไฟล์นอกสิทธิ์
 * คืนค่า: { success, results: [{ name, url, size, updated, category, path }] }
 */
function searchFiles(query, allowedCategoriesCsv) {
  if (!query || query.trim().length < 1) {
    return { success: true, results: [] };
  }

  const q = query.trim().toLowerCase();
  const allowAll = String(allowedCategoriesCsv || "").split(",").map(c => c.trim()).includes("all");
  const allowedSet = String(allowedCategoriesCsv || "").split(",").map(c => c.trim()).filter(c => c);

  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const topFolders = rootFolder.getFolders();
  const results = [];
  const MAX_RESULTS = 50; // กันค้นหาแล้วช้าเกินไปถ้าไฟล์เยอะมาก

  while (topFolders.hasNext()) {
    const topFolder = topFolders.next();
    const categoryName = topFolder.getName();

    if (!allowAll && allowedSet.indexOf(categoryName) === -1) continue; // ไม่มีสิทธิ์ ข้ามหมวดนี้ไปเลย

    searchInFolder(topFolder, q, categoryName, categoryName, results, MAX_RESULTS);
    if (results.length >= MAX_RESULTS) break;
  }

  return { success: true, results: results };
}

/**
 * ฟังก์ชันช่วยของ searchFiles ไล่ค้นหาแบบ recursive ทีละโฟลเดอร์
 */
function searchInFolder(folder, query, categoryName, pathLabel, results, maxResults) {
  if (results.length >= maxResults) return;

  const fileIter = folder.getFiles();
  while (fileIter.hasNext()) {
    if (results.length >= maxResults) return;
    const file = fileIter.next();
    if (file.getName().toLowerCase().indexOf(query) !== -1) {
      results.push({
        name: file.getName(),
        url: file.getUrl(),
        downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId(),
        size: file.getSize(),
        updated: file.getLastUpdated(),
        category: categoryName,
        path: pathLabel
      });
    }
  }

  const subFolderIter = folder.getFolders();
  while (subFolderIter.hasNext()) {
    if (results.length >= maxResults) return;
    const sub = subFolderIter.next();
    searchInFolder(sub, query, categoryName, pathLabel + " / " + sub.getName(), results, maxResults);
  }
}

/**
 * ดึงรายชื่อ user ทั้งหมดใน Users_DB (เฉพาะ admin เรียกได้ ผ่าน isAdmin ใน doPost แล้ว)
 */
function getUsers() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const header = data[0];

  const colCode = header.indexOf("code");
  const colName = header.indexOf("name");
  const colCategories = header.indexOf("categories");
  const colStatus = header.indexOf("status");
  const colRole = header.indexOf("role");

  const users = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[colCode]) continue; // ข้ามแถวว่าง
    users.push({
      code: String(row[colCode]).trim(),
      name: row[colName],
      categories: String(row[colCategories] || "").split(",").map(c => c.trim()).filter(c => c),
      status: row[colStatus],
      role: colRole >= 0 ? row[colRole] : "user"
    });
  }

  return { success: true, users: users };
}

/**
 * แก้ไขหมวดหมู่ (categories) ของ user ตาม code ที่ระบุ
 * categories ที่ส่งมาเป็น array เช่น ["1-คำสั่งสนาม", "4-ระเบียบ"]
 */
function updateUserCategories(code, categories) {
  if (!code) return { success: false, message: "ไม่พบรหัสผู้ใช้" };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const header = data[0];

  const colCode = header.indexOf("code");
  const colCategories = header.indexOf("categories");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colCode]).trim() === String(code).trim()) {
      const value = Array.isArray(categories) ? categories.join(",") : String(categories);
      sheet.getRange(i + 1, colCategories + 1).setValue(value);
      return { success: true, message: "บันทึกสำเร็จ" };
    }
  }

  return { success: false, message: "ไม่พบผู้ใช้นี้ในระบบ" };
}

/**
 * เพิ่ม user ใหม่ลงในชีต
 */
function addUser(code, name, categories) {
  if (!code || !name) {
    return { success: false, message: "กรุณากรอกรหัสและชื่อให้ครบ" };
  }

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const header = data[0];

  const colCode = header.indexOf("code");

  // เช็คว่ารหัสซ้ำหรือไม่
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colCode]).trim() === String(code).trim()) {
      return { success: false, message: "รหัสนี้มีผู้ใช้อยู่แล้ว" };
    }
  }

  const value = Array.isArray(categories) ? categories.join(",") : String(categories || "");
  // ลำดับคอลัมน์ต้องตรงกับหัวตาราง: code, name, categories, status, role
  sheet.appendRow([code, name, value, "active", "user"]);

  return { success: true, message: "เพิ่มผู้ใช้สำเร็จ" };
}

/**
 * ลบ user ออกจากชีต ตาม code
 */
function deleteUser(code) {
  if (!code) return { success: false, message: "ไม่พบรหัสผู้ใช้" };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const colCode = header.indexOf("code");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colCode]).trim() === String(code).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "ลบผู้ใช้สำเร็จ" };
    }
  }

  return { success: false, message: "ไม่พบผู้ใช้นี้ในระบบ" };
}
