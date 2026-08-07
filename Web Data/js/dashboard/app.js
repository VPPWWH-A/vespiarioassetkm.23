function onSearchInput(input) {
  const clearBtn = document.getElementById("clear-search-btn");
  if (input.value) {
    clearBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.add("hidden");
  }
  filterTable();
}

function clearSearch() {
  const searchInput = document.getElementById("search-input");
  searchInput.value = "";
  document.getElementById("clear-search-btn").classList.add("hidden");
  filterTable();
  searchInput.focus();
}

// โหลดข้อมูลอัตโนมัติเมื่อเปิดหน้าเว็บ
updateAuthUi();
loadDashboard();

setInterval(() => {
  const refreshBtn = document.getElementById("refresh-btn");
  if (!refreshBtn || refreshBtn.disabled) return;
  loadDashboard();
}, 120000);

// บล็อกการคลิกขวา (Context Menu)
document.addEventListener('contextmenu', event => event.preventDefault());

// บล็อกปุ่มลัดสำหรับเข้าหน้าผู้พัฒนา (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
document.addEventListener('keydown', event => {
  if (
    event.key === 'F12' ||
    (event.ctrlKey && event.shiftKey && (event.key.toUpperCase() === 'I' || event.key.toUpperCase() === 'J')) ||
    (event.ctrlKey && event.key.toLowerCase() === 'u')
  ) {
    event.preventDefault();
    showToast("⚠️ ระบบความปลอดภัย: ไม่อนุญาตให้ใช้เครื่องมือผู้พัฒนาบนหน้านี้", "error");
  }
});
