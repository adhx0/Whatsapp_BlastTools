# 📱 Panduan Penggunaan WhatsApp Blast

Selamat datang di panduan penggunaan skrip otomatisasi **WhatsApp Blast**.  
Dokumen ini akan membantu Anda menggunakan alat ini untuk mengirim pesan massal dan gambar dengan mudah.

---

## 📂 Persiapan

Sebelum menjalankan skrip, pastikan Anda telah menyiapkan dua file penting di dalam folder ini:

1. **`nomor_customer.xlsx`**  
   File Excel yang berisi daftar nomor telepon.  
   - Masukkan semua nomor telepon di **kolom A (kolom pertama)** pada `Sheet1`.  
   - Mendukung berbagai format nomor:  
     ```
     081..., 628..., +628..., 8....
     ```

2. **`pesan.txt`**  
   File teks yang berisi pesan yang ingin Anda kirim.  
   - Cukup ketik atau salin-tempel pesan Anda ke dalam file ini.  
   - Script akan membaca **seluruh isi file**, termasuk baris baru.

---

## ▶️ Cara Menggunakan

1. **Jalankan Skrip**  
   - Temukan file **`run.bat`** di dalam folder ini.  
   - Klik dua kali pada file tersebut.  

2. **Ikuti Instruksi**  
   - Sebuah jendela hitam (*Command Prompt*) akan muncul dan secara otomatis menginstal semua kebutuhan.  
   - Setelah persiapan selesai, program akan meminta Anda memasukkan **jalur file gambar**.  
   - Jika ingin mengirim gambar: tarik file gambar ke jendela Command Prompt, lalu tekan **Enter**.  
     Contoh output:
     ```
     C:\Users\NamaAnda\Pictures\foto.jpg
     ```
   - Jika tidak ingin menambahkan gambar: cukup tekan **Enter** untuk melewati langkah ini.  

3. **Hubungkan WhatsApp**  
   - Sebuah **QR code** akan muncul di Command Prompt.  
   - Buka WhatsApp di HP Anda → **Pengaturan > Perangkat Tertaut**, lalu pindai QR code tersebut.  

4. **Pengiriman Otomatis**  
   - Skrip akan mulai mengirim **pesan dan gambar** secara otomatis ke semua nomor di daftar Excel.  
   - Mohon bersabar, karena terdapat **jeda acak antar pengiriman** untuk alasan keamanan.  

---

## ⚠️ Catatan Penting

- **Hanya klik `run.bat`**  
  Jangan jalankan file `main.js` secara langsung. File `.bat` akan mengurus semua kebutuhan.  
- **Risiko Pemblokiran Akun**  
  Penggunaan skrip otomatisasi dapat melanggar **Ketentuan Layanan WhatsApp** dan berpotensi menyebabkan akun Anda diblokir.  
  Gunakan dengan bijak dan bertanggung jawab.  

---
