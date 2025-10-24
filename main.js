const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const readline = require('readline-sync');
const XLSX = require('xlsx');

// ---------- CONFIG ----------
const SESSION_DIR = path.join(__dirname, '.session_data');
const OUTPUT_CSV = path.join(__dirname, 'hasil_nomor.csv');
const MIN_PHONE_LENGTH = 9;
const EXCEL_DEFAULT_FOLDER = __dirname;
// -----------------------------

// ---------- HELPER FUNCTIONS ----------
const formatTimestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const colIndexToLetter = (index) => {
  let s = "";
  while (index >= 0) {
    s = String.fromCharCode((index % 26) + 65) + s;
    index = Math.floor(index / 26) - 1;
  }
  return s;
};

const getExcelFilesInFolder = (dir = EXCEL_DEFAULT_FOLDER) => {
  try {
    const files = fs.readdirSync(dir);
    return files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ext === '.xlsx' || ext === '.xls';
    }).map(f => path.join(dir, f));
  } catch (e) {
    console.error(`❌ Gagal membaca folder ${dir}: ${e.message}`);
    return [];
  }
};

const getCellValue = (worksheet, colIndex, rowIndex) => {
  const colLetter = colIndexToLetter(colIndex);
  const addr = `${colLetter}${rowIndex}`;
  const cell = worksheet[addr];
  if (cell && typeof cell.v !== 'undefined' && cell.v !== null) return cell.v;

  const merges = worksheet['!merges'] || [];
  for (const m of merges) {
    if (rowIndex - 1 >= m.s.r && rowIndex - 1 <= m.e.r &&
      colIndex >= m.s.c && colIndex <= m.e.c) {
      const masterAddr = `${colIndexToLetter(m.s.c)}${m.s.r + 1}`;
      const masterCell = worksheet[masterAddr];
      if (masterCell && typeof masterCell.v !== 'undefined' && masterCell.v !== null) return masterCell.v;
    }
  }
  return null;
};

const isLikelyPhone = (raw) => {
  if (raw === null || typeof raw === 'undefined') return false;
  const s = String(raw).trim();
  if (s === '') return false;
  let cleaned = s.replace(/[^\d+]/g, '');
  const onlyDigits = cleaned.replace(/\D/g, '');
  if (onlyDigits.length <= 1) return false;

  if (cleaned.startsWith('+')) return /^\+628\d{6,}$/.test(cleaned);
  if (/^08\d{6,}$/.test(cleaned)) return true;
  if (/^8\d{6,}$/.test(cleaned)) return true;

  return false;
};

// --- baca semua kolom ---
const bacaSemuaKolomFiltered = (filePath, startRow = 1) => {
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.warn(`⚠️ Sheet pertama tidak ditemukan di ${path.basename(filePath)}.`);
      return { worksheet: null, entries: [] };
    }
    const ref = worksheet['!ref'];
    if (!ref) return { worksheet, entries: [] };
    const range = XLSX.utils.decode_range(ref);

    const results = [];
    for (let r = Math.max(startRow, range.s.r + 1); r <= range.e.r + 1; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const rawVal = getCellValue(worksheet, c, r);
        if (rawVal === null || typeof rawVal === 'undefined') continue;
        let cellStr = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal).trim();
        if (cellStr === '') continue;

        if (!isLikelyPhone(cellStr)) continue;

        const cleaned = cellStr.replace(/[^\d+]/g, '');
        results.push({ row: r, col: colIndexToLetter(c), raw: cellStr, cleaned });
      }
    }
    return { worksheet, entries: results };
  } catch (e) {
    console.error(`❌ Error membaca ${path.basename(filePath)}: ${e.message}`);
    return { worksheet: null, entries: [] };
  }
};

const normalizeCleanedToWhatsappId = (cleaned) => {
  if (!cleaned) return null;
  let s = String(cleaned);
  if (s.startsWith('+62')) s = s.substring(1);
  else if (s.startsWith('0')) s = '62' + s.substring(1);
  else if (s.startsWith('8')) s = '62' + s;
  else if (!s.startsWith('62')) {
    const digitsOnly = s.replace(/\D/g, '');
    if (digitsOnly.length < MIN_PHONE_LENGTH) return null;
    s = digitsOnly;
  }
  const digitsOnly = s.replace(/\D/g, '');
  return `${digitsOnly}@c.us`;
};

const appendCsvHeaderIfNeeded = (outPath) => {
  if (!fs.existsSync(outPath)) {
    fs.writeFileSync(outPath, 'tanggal_waktu,file,row,col,nomor,status,message\n', 'utf-8');
  }
};
const appendCsvRow = (outPath, row) => {
  const ts = formatTimestamp();
  const line = [
    `"${ts}"`,
    `"${row.file.replace(/"/g, '""')}"`,
    row.row,
    `"${row.col}"`,
    `"${row.number || ''}"`,
    row.status,
    `"${(row.message || '').replace(/"/g, '""')}"`
  ].join(',') + '\n';
  fs.appendFileSync(outPath, line, 'utf-8');
};

const parseCommaFiles = (inputStr) => {
  if (!inputStr || !inputStr.trim()) return [];
  const parts = inputStr.split(',').map(s => s.trim()).filter(Boolean);
  const resolved = [];
  for (const p of parts) {
    const candidate = path.isAbsolute(p) ? p : path.join(__dirname, p);
    if (!fs.existsSync(candidate)) {
      console.warn(`⚠️ File tidak ditemukan: ${candidate} (dilewati)`);
      continue;
    }
    const ext = path.extname(candidate).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      console.warn(`⚠️ Bukan file Excel (.xls/.xlsx): ${candidate} (dilewati)`);
      continue;
    }
    resolved.push(candidate);
  }
  return resolved;
};

// ---------- WHATSAPP CLIENT ----------
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', (qr) => {
  console.log('📲 Scan QR Code ini dengan WhatsApp Anda:');
  qrcode.generate(qr, { small: true });
});

client.on('auth_failure', (msg) => {
  console.error('❌ AUTH FAILURE:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️ Koneksi terputus:', reason);
  client.initialize();
});

client.on('ready', async () => {
  console.log('✅ WhatsApp client ready.');

  // langsung pakai opsi input manual
  const inputFilesStr = readline.question('\nMasukkan daftar file Excel (pisahkan koma, contoh: a.xlsx, b.xls):\nFiles: ');
  const files = parseCommaFiles(inputFilesStr);
  if (!files || files.length === 0) {
    console.log('❌ Tidak ada file Excel valid yang dipilih. Keluar.');
    client.destroy();
    return;
  }

  const startRow = 1;
  console.log(`➡️ Script akan mulai membaca dari baris ${startRow} (semua kolom).`);

  const pesanFile = path.join(__dirname, 'pesan.txt');
  let pesan = '';
  try {
    pesan = fs.readFileSync(pesanFile, 'utf-8');
    console.log(`✅ Pesan dimuat dari ${path.basename(pesanFile)}.`);
  } catch (e) {
    console.error(`❌ Gagal membaca pesan: ${e.message}`);
    client.destroy();
    return;
  }

  const gambarPathInput = readline.question("Masukkan jalur file gambar (opsional, tekan Enter untuk lewati): \n");
  let media = null;
  if (gambarPathInput) {
    const gambarPath = path.isAbsolute(gambarPathInput) ? gambarPathInput : path.join(__dirname, gambarPathInput);
    if (fs.existsSync(gambarPath)) {
      try { media = MessageMedia.fromFilePath(gambarPath); console.log('✅ Gambar dimuat.'); }
      catch (e) { console.warn('⚠️ Gagal muat gambar:', e.message); }
    } else console.warn('⚠️ File gambar tidak ditemukan, melewati.');
  }

  appendCsvHeaderIfNeeded(OUTPUT_CSV);
  const globalNumbersSet = new Set();

  for (const f of files) {
    console.log(`\n📄 Memproses file: ${path.basename(f)} (semua kolom, mulai baris ${startRow})`);
    const { worksheet, entries } = bacaSemuaKolomFiltered(f, startRow);
    console.log(`   -> Ditemukan ${entries.length} sel berisi nomor valid.`);

    if (!worksheet) {
      console.warn(`⚠️ Melewati file ${path.basename(f)} karena worksheet tidak tersedia.`);
      continue;
    }

    for (const e of entries) {
      const rowNum = e.row;
      const col = e.col;
      const raw = e.raw;
      const cleaned = e.cleaned;
      const normalized = normalizeCleanedToWhatsappId(cleaned);

      if (!normalized) {
        console.log(`⚠️ Baris ${rowNum}, Kolom ${col}: gagal normalisasi -> "${raw}" (dilewati)`);
        continue;
      }

      if (globalNumbersSet.has(normalized)) {
        appendCsvRow(OUTPUT_CSV, { file: path.basename(f), row: rowNum, col, number: normalized, status: 'skipped-duplicate', message: 'Nomor sudah dikirim sebelumnya' });
        console.log(`↩️ Skip duplicate ${normalized} (baris ${rowNum}, kolom ${col})`);
        continue;
      }

      try {
        const isRegistered = await client.isRegisteredUser(normalized);
        if (!isRegistered) {
          appendCsvRow(OUTPUT_CSV, { file: path.basename(f), row: rowNum, col, number: normalized, status: 'not-registered', message: 'Nomor tidak terdaftar WA' });
          console.log(`❌ ${normalized} tidak terdaftar (baris ${rowNum}, kolom ${col})`);
          continue;
        }

        if (media) await client.sendMessage(normalized, media, { caption: pesan });
        else await client.sendMessage(normalized, pesan);

        appendCsvRow(OUTPUT_CSV, { file: path.basename(f), row: rowNum, col, number: normalized, status: 'sent', message: '' });
        console.log(`✅ Dikirim ke ${normalized} (baris ${rowNum}, kolom ${col})`);
        globalNumbersSet.add(normalized);
      } catch (err) {
        console.error(`❌ Gagal kirim ke ${normalized} (baris ${rowNum}, kolom ${col}):`, err.message || err);
        appendCsvRow(OUTPUT_CSV, { file: path.basename(f), row: rowNum, col, number: normalized, status: 'error', message: String(err.message || err) });
      }

      const delay = Math.floor(Math.random() * (50000 - 30000) + 30000);
      console.log(`⏳ Menunggu ${Math.floor(delay / 1000)} detik...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  console.log('\n🎉 Selesai! Laporan disimpan di', OUTPUT_CSV);
  client.destroy();
});

client.initialize();
