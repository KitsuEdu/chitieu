/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: HỆ THỐNG ĐỒNG BỘ 2 CHIỀU (OFFLINE-FIRST TWO-WAY SYNC)
 * Dành cho Ứng dụng Quản lý Tài chính Cá nhân React Native
 * ============================================================================
 * 
 * HƯỚNG DẪN TRIỂN KHAI NHANH:
 * 1. Mở Google Sheets (Bảng tính mới hoặc hiện tại).
 * 2. Chọn Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa toàn bộ nội dung cũ trong file Code.gs và dán toàn bộ mã nguồn này vào.
 * 4. Nhấn biểu tượng "Lưu dự án" (Ctrl + S hoặc Command + S).
 * 5. Nhấn nút "Triển khai" (Deploy) ở góc trên bên phải -> "Triển khai mới" (New deployment).
 *    - Chọn loại: "Ứng dụng web" (Web app).
 *    - Mô tả: "Finance App Sync Service".
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me - địa chỉ email Google của bạn).
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone).
 * 6. Nhấn "Triển khai" -> Cấp quyền cho Script nếu có thông báo bảo mật.
 * 7. Sao chép "URL ứng dụng web" (Web app URL - kết thúc bằng /exec) và dán vào
 *    mục Cài đặt Đồng bộ trong ứng dụng di động.
 * ============================================================================
 */

// Định nghĩa cấu trúc cột cho từng Sheet chuẩn
var SCHEMAS = {
  Wallets: [
    'id',
    'name',
    'type',
    'icon',
    'logoId',
    'colorGradient',
    'balance',
    'creditLimit',
    'currentBalance',
    'statementDate',
    'dueDate',
    'feeWarningNote',
    'createdAt',
    'updatedAt',
    'isDeleted'
  ],
  Transactions: [
    'id',
    'date',
    'amount',
    'type',
    'category',
    'wallet',
    'toWallet',
    'note',
    'synced',
    'createdAt',
    'updatedAt',
    'isDeleted'
  ],
  Debts: [
    'id',
    'type',
    'personName',
    'totalAmount',
    'paidAmount',
    'walletId',
    'syncWithWallet',
    'createdDate',
    'dueDate',
    'note',
    'status',
    'payments',
    'createdAt',
    'updatedAt',
    'isDeleted'
  ]
};

/**
 * Xử lý yêu cầu GET (Kiểm tra nhanh qua trình duyệt)
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return createJsonResponse({
    status: 'success',
    message: 'Google Apps Script Web App đang hoạt động bình thường.',
    sheetName: ss ? ss.getName() : 'Unknown Spreadsheet',
    serverTime: new Date().toISOString()
  });
}

/**
 * Xử lý yêu cầu POST chính từ Ứng dụng di động
 */
function doPost(e) {
  // Sử dụng LockService để chống xung đột ghi đồng thời (Concurrency Control)
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    // Chờ tối đa 30 giây để lấy lock
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      return createJsonResponse({
        status: 'error',
        message: 'Hệ thống đang bận xử lý yêu cầu khác, vui lòng thử lại sau.'
      });
    }

    // Parse payload dữ liệu gửi lên
    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (err) {
        return createJsonResponse({
          status: 'error',
          message: 'Dữ liệu JSON gửi lên không hợp lệ: ' + err.toString()
        });
      }
    }

    var action = (requestData.action || '').toUpperCase();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Tự động kiểm tra và khởi tạo 3 Sheet chuẩn
    ensureAllSheetsExist(ss);

    // Xử lý theo từng Action
    switch (action) {
      case 'PING':
        return handlePing(ss);

      case 'SYNC':
        return handleSync(ss, requestData);

      case 'RESTORE':
        return handleRestore(ss);

      default:
        return createJsonResponse({
          status: 'error',
          message: 'Hành động không xác định (Hỗ trợ PING, SYNC, RESTORE): ' + action
        });
    }
  } catch (globalError) {
    return createJsonResponse({
      status: 'error',
      message: 'Lỗi máy chủ Google Apps Script: ' + globalError.toString()
    });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Action: PING - Kiểm tra kết nối hợp lệ
 */
function handlePing(ss) {
  return createJsonResponse({
    status: 'success',
    sheetName: ss.getName(),
    serverTime: new Date().toISOString()
  });
}

/**
 * Action: SYNC - Đồng bộ 2 chiều (Merge theo id và updatedAt)
 */
function handleSync(ss, data) {
  var clientWallets = data.wallets || [];
  var clientTransactions = data.transactions || [];
  var clientDebts = data.debts || [];

  // 1. Đồng bộ Wallets
  var mergedWallets = syncSheetEntity(ss, 'Wallets', SCHEMAS.Wallets, clientWallets);

  // 2. Đồng bộ Transactions
  var mergedTransactions = syncSheetEntity(ss, 'Transactions', SCHEMAS.Transactions, clientTransactions);

  // 3. Đồng bộ Debts
  var mergedDebts = syncSheetEntity(ss, 'Debts', SCHEMAS.Debts, clientDebts);

  return createJsonResponse({
    status: 'success',
    wallets: mergedWallets,
    transactions: mergedTransactions,
    debts: mergedDebts,
    serverTime: new Date().toISOString()
  });
}

/**
 * Action: RESTORE - Đọc toàn bộ dữ liệu từ 3 Sheet về App
 */
function handleRestore(ss) {
  var wallets = readAllFromSheet(ss, 'Wallets', SCHEMAS.Wallets);
  var transactions = readAllFromSheet(ss, 'Transactions', SCHEMAS.Transactions);
  var debts = readAllFromSheet(ss, 'Debts', SCHEMAS.Debts);

  return createJsonResponse({
    status: 'success',
    wallets: wallets,
    transactions: transactions,
    debts: debts,
    serverTime: new Date().toISOString()
  });
}

/**
 * Thuật toán Merge và Ghi lại vào Sheet cho một Entity
 */
function syncSheetEntity(ss, sheetName, headers, clientItems) {
  var sheet = ss.getSheetByName(sheetName);
  var existingItems = readAllFromSheet(ss, sheetName, headers);

  // Tạo Map các item đang có trên Sheet theo ID
  var itemMap = {};
  for (var i = 0; i < existingItems.length; i++) {
    var item = existingItems[i];
    if (item.id) {
      itemMap[item.id] = item;
    }
  }

  // Hợp nhất dữ liệu Client gửi lên dựa trên updatedAt
  for (var j = 0; j < clientItems.length; j++) {
    var cItem = clientItems[j];
    if (!cItem || !cItem.id) continue;

    var sItem = itemMap[cItem.id];
    if (!sItem) {
      // Bản ghi mới hoàn toàn từ Client -> thêm vào
      itemMap[cItem.id] = cItem;
    } else {
      // Đã tồn tại cả 2 bên -> So sánh updatedAt
      var clientTime = parseTimestamp(cItem.updatedAt || cItem.createdAt);
      var sheetTime = parseTimestamp(sItem.updatedAt || sItem.createdAt);

      if (clientTime >= sheetTime) {
        // Client mới hơn hoặc bằng -> Ưu tiên giữ Client
        itemMap[cItem.id] = cItem;
      } else {
        // Sheet mới hơn -> Giữ nguyên Sheet
        itemMap[cItem.id] = sItem;
      }
    }
  }

  // Chuyển Map thành danh sách phẳng
  var mergedList = [];
  for (var key in itemMap) {
    if (itemMap.hasOwnProperty(key)) {
      mergedList.push(itemMap[key]);
    }
  }

  // Ghi lại toàn bộ dữ liệu hợp nhất vào Sheet
  writeAllToSheet(sheet, headers, mergedList);

  return mergedList;
}

/**
 * Đọc toàn bộ danh sách item từ Sheet và parse các trường dữ liệu
 */
function readAllFromSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) {
    return []; // Sheet chỉ có header hoặc trống
  }

  var rangeValues = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var result = [];

  for (var i = 0; i < rangeValues.length; i++) {
    var row = rangeValues[i];
    var obj = {};
    var hasId = false;

    for (var h = 0; h < headers.length; h++) {
      var field = headers[h];
      var rawVal = row[h];

      if (field === 'id' && rawVal) {
        hasId = true;
      }

      // Xử lý deserialize các kiểu dữ liệu đặc biệt
      if (field === 'colorGradient' || field === 'payments') {
        obj[field] = parseJsonField(rawVal, field === 'colorGradient' ? ['#8B5CF6', '#6366F1'] : []);
      } else if (field === 'isDeleted' || field === 'synced' || field === 'syncWithWallet') {
        obj[field] = parseBooleanField(rawVal);
      } else if (
        field === 'amount' ||
        field === 'balance' ||
        field === 'creditLimit' ||
        field === 'currentBalance' ||
        field === 'statementDate' ||
        field === 'dueDate' ||
        field === 'totalAmount' ||
        field === 'paidAmount' ||
        field === 'createdAt'
      ) {
        obj[field] = parseNumberField(rawVal);
      } else {
        obj[field] = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
      }
    }

    if (hasId) {
      result.push(obj);
    }
  }

  return result;
}

/**
 * Ghi đè toàn bộ danh sách item vào Sheet (Giữ nguyên dòng Header)
 */
function writeAllToSheet(sheet, headers, items) {
  var lastRow = sheet.getLastRow();
  var lastCol = headers.length;

  // Xóa nội dung dữ liệu cũ phía dưới header nếu có
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  if (!items || items.length === 0) {
    return;
  }

  // Chuẩn bị ma trận 2D để ghi hàng loạt (setValues)
  var rows = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var row = [];

    for (var h = 0; h < headers.length; h++) {
      var field = headers[h];
      var val = item[field];

      if (field === 'colorGradient' || field === 'payments') {
        row.push(val ? JSON.stringify(val) : '');
      } else if (field === 'isDeleted' || field === 'synced' || field === 'syncWithWallet') {
        row.push(Boolean(val));
      } else if (
        field === 'amount' ||
        field === 'balance' ||
        field === 'creditLimit' ||
        field === 'currentBalance' ||
        field === 'statementDate' ||
        field === 'dueDate' ||
        field === 'totalAmount' ||
        field === 'paidAmount' ||
        field === 'createdAt'
      ) {
        row.push(typeof val === 'number' ? val : (val ? Number(val) : 0));
      } else {
        row.push(val !== undefined && val !== null ? val : '');
      }
    }
    rows.push(row);
  }

  // Ghi 1 lần duy nhất để tối ưu hiệu năng
  sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);
}

/**
 * Tự động tạo 3 Sheet và dòng Header nếu chưa có
 */
function ensureAllSheetsExist(ss) {
  var sheetNames = ['Wallets', 'Transactions', 'Debts'];

  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var sheet = ss.getSheetByName(name);
    var headers = SCHEMAS[name];

    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    // Nếu sheet còn trống hoàn toàn, ghi Header
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#E2E8F0');
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
  }
}

/**
 * Chuyển timestamp ISO hoặc số sang Epoch Milliseconds
 */
function parseTimestamp(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  var d = new Date(val);
  var time = d.getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Parse an toàn trường JSON
 */
function parseJsonField(val, defaultVal) {
  if (!val) return defaultVal;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return defaultVal;
  }
}

/**
 * Parse an toàn kiểu Boolean
 */
function parseBooleanField(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    var lower = val.trim().toLowerCase();
    return lower === 'true' || lower === '1';
  }
  return Boolean(val);
}

/**
 * Parse an toàn kiểu Số
 */
function parseNumberField(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  var parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Trả về kết quả JSON với header Content-Type chuẩn
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
