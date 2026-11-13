# FinanceApp - Offline-First Personal Finance App (Google Sheets Sync)

Ứng dụng quản lý tài chính cá nhân dành cho Android xây dựng trên **React Native + Expo SDK 58 (TypeScript)** với kiến trúc **Offline-First**, lưu trữ cục bộ tốc độ cao và đồng bộ tự động lên **Google Sheets** thông qua **Google Apps Script Web App**.

---

## 🚀 Tính năng nổi bật

1. **Offline-First & Siêu tốc:**
   - Dữ liệu thu/chi luôn được lưu trực tiếp vào thiết bị (`@react-native-async-storage/async-storage`).
   - Mở app ghi chép ngay lập tức không phụ thuộc kết nối internet.
2. **Numpad ảo tối ưu thao tác 1 tay trên Android:**
   - Bàn phím số to bản, phản hồi xúc giác nhẹ (Haptic vibration), phím tắt `000` nhập nhanh hàng trăm nghìn / triệu đồng.
3. **Đồng bộ tự động & thủ công với Google Sheets:**
   - Tự động sync ngầm mỗi khi ghi giao dịch mới (nếu có mạng).
   - Nút "Đồng bộ ngay" (Sync Now) và kéo để làm mới (Pull-to-refresh) ở tab Lịch sử.
   - Trạng thái Sync trực quan: Xanh (Đã đồng bộ), Vàng (Còn X khoản chờ sync), Xám (Chưa cấu hình URL).
4. **Giao diện Modern Dark Mode:**
   - Gam màu chuẩn UI hiện đại: Nền `#0F172A` (Slate 900), thẻ `#1E293B`, điểm nhấn Emerald (`#10B981`) cho Thu nhập và Rose (`#F43F5E`) cho Chi tiêu.

---

## 📁 Cấu trúc thư mục

```
app/
├── App.tsx                      # Component chính & Bottom Navigation Bar
├── app.json                     # Cấu hình Expo, Android package, dark mode
├── src/
│   ├── types/
│   │   └── index.ts             # Định nghĩa Type: Transaction, AppSettings, v.v.
│   ├── services/
│   │   ├── storage.ts           # Service quản lý AsyncStorage (CRUD, markAsSynced)
│   │   └── sync.ts              # Service kết nối HTTP POST tới Google Apps Script
│   ├── components/
│   │   ├── CategoryIcon.tsx     # Icon danh mục theo chủ đề màu
│   │   └── Numpad.tsx           # Bàn phím ảo thao tác 1 tay
│   ├── screens/
│   │   ├── QuickEntryScreen.tsx # Tab 1: Nhập nhanh giao dịch & Header thống kê
│   │   ├── HistoryScreen.tsx    # Tab 2: Lịch sử giao dịch & Nút Sync Now
│   │   └── SettingsScreen.tsx   # Tab 3: Cài đặt Web App URL & Hướng dẫn
│   └── utils/
│       └── format.ts            # Hàm định dạng tiền tệ VND & Ngày giờ
```

---

## 🛠️ Hướng dẫn cài đặt Google Apps Script cho Google Sheets

Để đồng bộ giao dịch từ ứng dụng lên bảng tính của bạn:

1. Truy cập [Google Sheets](https://sheets.google.com) và tạo một trang tính mới.
2. Vào **Tiện ích mở rộng (Extensions)** → **Apps Script**.
3. Xóa code mặc định và dán đoạn mã sau vào file `Code.gs`:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Tự động tạo hàng tiêu đề nếu sheet còn trống
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "Thời gian", "Loại", "Danh mục", "Số tiền (VND)", "Ví", "Ghi chú", "Ngày tạo"]);
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#E2E8F0");
    }
    
    // Xử lý lệnh test kết nối
    if (data.action === "test") {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Kết nối Google Apps Script thành công!" 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Xử lý đồng bộ sổ nợ & cho vay
    if (data.action === "sync_debts") {
      var debtSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sổ nợ");
      if (!debtSheet) {
        debtSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Sổ nợ");
      }
      if (debtSheet.getLastRow() === 0) {
        debtSheet.appendRow(["ID", "Loại", "Người liên quan", "Tổng tiền (VND)", "Đã trả (VND)", "Còn lại (VND)", "Trạng thái", "Ngày tạo", "Hạn trả", "Ghi chú"]);
        debtSheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#E2E8F0");
      }
      var debts = data.debts || [];
      for (var j = 0; j < debts.length; j++) {
        var d = debts[j];
        var remain = Math.max(d.totalAmount - (d.paidAmount || 0), 0);
        debtSheet.appendRow([
          d.id,
          d.type === "LEND" ? "Cho vay" : "Đi vay",
          d.personName,
          d.totalAmount,
          d.paidAmount || 0,
          remain,
          d.status === "SETTLED" ? "Đã tất toán" : "Đang nợ",
          d.createdDate,
          d.dueDate || "",
          d.note || ""
        ]);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        count: debts.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Ghi các giao dịch đồng bộ
    var items = data.transactions || [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      sheet.appendRow([
        item.id,
        item.date,
        item.type === "EXPENSE" ? "Chi tiêu" : item.type === "INCOME" ? "Thu nhập" : "Chuyển khoản",
        item.category,
        item.amount,
        item.toWallet ? (item.wallet + " -> " + item.toWallet) : item.wallet,
        item.note || "",
        new Date(item.createdAt).toLocaleString("vi-VN")
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      count: items.length 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Nhấn **Triển khai (Deploy)** → **Triển khai mới (New deployment)**:
   - Loại triển khai: **Ứng dụng web (Web app)**
   - Thực thi dưới dạng (Execute as): **Tôi (Me)**
   - Ai có quyền truy cập (Who has access): **Bất kỳ ai (Anyone)**
5. Nhấn **Triển khai**, cấp quyền và sao chép **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`).
6. Mở app, chuyển sang tab **Cài đặt**, dán URL vào và bấm **Kiểm tra kết nối** → **Lưu cài đặt**.

---

## 🏃 Chạy ứng dụng

```bash
# Khởi động dev server Expo
npx expo start

# Hoặc khởi động trực tiếp cho Android
npx expo start --android
```
