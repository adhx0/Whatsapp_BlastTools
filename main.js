const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const readline = require('readline-sync');
const XLSX = require('xlsx');

// Path custom untuk auth
const SESSION_DIR = path.join(__dirname, '.session_data');

// Fungsi untuk membaca nomor dari file Excel
const bacaNomorDariExcel = (filePath, sheetName = 'Sheet1') => {
  try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.error(`❌ Error: Lembar kerja '${sheetName}' tidak ditemukan di file Excel.`);
      return [];
    }
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const nomorTelepon = [];
    for (let row of data) {
      const line = String(row[0]).trim();
      if (line) {
        let nomor = line.replace(/[^\d+]/g, '');
        if (nomor.startsWith('08')) {
          nomor = '62' + nomor.substring(1);
        } else if (nomor.startsWith('+62')) {
          nomor = nomor.substring(1);
        } else if (nomor.startsWith('8')) {
          nomor = '62' + nomor;
        } else if (!nomor.startsWith('62')) {
          continue;
        }
        if (nomor.length > 10 && nomor.startsWith('62')) {
          nomorTelepon.push(`${nomor}@c.us`);
        } else {
          console.warn(`Peringatan: Nomor tidak valid dan dilewati -> ${line}`);
        }
      }
    }
    return nomorTelepon;
  } catch (e) {
    console.error(`❌ Error membaca file Excel: ${e}`);
    return [];
  }
};

// Fungsi untuk reset session (rename dulu biar tidak kena EBUSY)
const resetSession = async () => {
  console.warn('\n⚠️ Reset session sedang berjalan...');
  try {
    await client.destroy();
    console.log('✅ Client destroyed, siap reset sesi.');
  } catch (e) {
    console.warn('⚠️ Client sudah tidak aktif.');
  }

  if (fs.existsSync(SESSION_DIR)) {
    const backupDir = SESSION_DIR + '_old_' + Date.now();
    try {
      fs.renameSync(SESSION_DIR, backupDir);
      console.log(`✅ Session lama dipindahkan ke: ${backupDir}`);
    } catch (e) {
      console.error(`❌ Gagal memindahkan session: ${e.message}`);
    }
  }

  console.log('🔄 Inisialisasi ulang untuk QR Code baru...');
  client.initialize();
};

// Buat client
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: SESSION_DIR
  }),
  puppeteer: {
    args: ['--disable-logging', '--disable-dev-shm-usage']
  }
});

// Event QR → tampilkan dan hapus backup lama
client.on('qr', (qr) => {
  console.log('📲 Silakan scan QR Code ini dengan WhatsApp Anda:');
  qrcode.generate(qr, { small: true });

  // Hapus folder backup lama
  const baseDir = path.dirname(SESSION_DIR);
  fs.readdirSync(baseDir).forEach((file) => {
    if (file.startsWith('.session_data_old_')) {
      const oldPath = path.join(baseDir, file);
      try {
        fs.rmSync(oldPath, { recursive: true, force: true });
        console.log(`🗑️ Folder backup lama dihapus: ${file}`);
      } catch (e) {
        console.error(`❌ Gagal hapus folder backup: ${file} -> ${e.message}`);
      }
    }
  });
});

client.on('ready', async () => {
  console.log('✅ Berhasil terhubung ke WhatsApp!');

  const nomorCustomerPath = path.join(__dirname, 'nomor_customer.xlsx');
  const nomorTelepon = bacaNomorDariExcel(nomorCustomerPath);

  if (nomorTelepon.length === 0) {
    console.log("Tidak ada nomor yang ditemukan di file Excel.");
    return;
  }
  console.log(`Ditemukan ${nomorTelepon.length} nomor. Memulai pengiriman...`);

  let pesan = '';
  const pesanFilePath = path.join(__dirname, 'pesan.txt');
  try {
    pesan = fs.readFileSync(pesanFilePath, 'utf-8');
    console.log("✅ Pesan berhasil dimuat dari 'pesan.txt'.");
  } catch (e) {
    console.error(`❌ Gagal membaca file pesan: ${e}`);
    client.destroy();
    return;
  }

  const gambarPathInput = readline.question("Masukkan jalur file gambar (opsional, tekan Enter untuk lewati): \n");
  let media;
  if (gambarPathInput) {
    try {
      const gambarPath = path.join(...gambarPathInput.split(path.sep));
      if (fs.existsSync(gambarPath)) {
        media = MessageMedia.fromFilePath(gambarPath);
        console.log("✅ Gambar berhasil dimuat.");
      } else {
        console.warn("⚠️ Jalur file gambar tidak valid.");
      }
    } catch (e) {
      console.error(`❌ Gagal memuat gambar: ${e.message}`);
    }
  }

  for (const nomor of nomorTelepon) {
    try {
      const isRegistered = await client.isRegisteredUser(nomor);
      if (isRegistered) {
        if (media) {
          await client.sendMessage(nomor, media, { caption: pesan });
        } else {
          await client.sendMessage(nomor, pesan);
        }
        console.log(`✅ Pesan berhasil dikirim ke ${nomor}`);
      } else {
        console.log(`❌ Nomor ${nomor} tidak terdaftar di WhatsApp.`);
      }
    } catch (e) {
      console.error(`❌ Gagal mengirim pesan ke ${nomor}: ${e}`);
    }

    const jeda = Math.random() * (50000 - 30000) + 30000;
    console.log(`⏳ Menunggu ${Math.floor(jeda / 1000)} detik...`);
    await new Promise(resolve => setTimeout(resolve, jeda));
  }

  console.log("\n🎉 Selesai! Semua pesan telah diproses.");
  client.destroy();
});

// Event auth gagal → reset session
client.on('auth_failure', (msg) => {
  console.error(`\n❌ AUTH FAILURE: ${msg}`);
  resetSession();
});

// Event koneksi terputus → reset session
client.on('disconnected', (reason) => {
  console.warn(`\n⚠️ KONEKSI TERPUTUS! Alasan: ${reason}`);
  resetSession();
});

client.initialize();
