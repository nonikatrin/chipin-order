export const translations = {
  id: {
    title: "Atur Menu & Harga",
    hint: "Tentukan Harga Beli (modal ke supplier) dan Harga Jual (ke warga) tiap menu. Untung bersih kas RT dihitung otomatis.",
    noMenu: "Belum ada menu",
    noMenuSub: "Tekan tombol hijau di bawah untuk menambah menu kuliner satu per satu.",
    textOption: "─── Punya daftar teks? ───",
    startHere: "✨ Atau mulai di sini (Salin Teks)",
    addMenu: "➕ Tambah Menu Baru",
    revenue: "Revenue Komoditas",
    netProfit: "Untung Bersih Kas RT",
    owedToCook: "Wajib Bayar Supplier",
    successImport: "✓ Berhasil membuat menu!",
    errorImport: "❌ Tidak ada ragam item atau pasangan harga yang cocok."
  },
  en: {
    title: "Setup Menu & Pricing",
    hint: "Set the Buy Price (cost to supplier) and Sell Price (to citizens) for each menu. Net profit for Kas RT is calculated automatically.",
    noMenu: "No menus added yet",
    noMenuSub: "Tap the green button below to add your culinary items one by one.",
    textOption: "─── Have a text list? ───",
    startHere: "✨ Or start here (Paste Text)",
    addMenu: "➕ Add New Menu",
    revenue: "Commodity Revenue",
    netProfit: "Kas RT Net Profit",
    owedToCook: "Owed to Supplier",
    successImport: "✓ Successfully created menus!",
    errorImport: "❌ No valid items or pricing sets found."
  }
}

export type Language = 'id' | 'en';
