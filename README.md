# Geraikita AI Chat — GitHub Pages

Frontend chat sederhana yang langsung memakai API OpenAI-compatible Geraikita AI.

## Fitur
- Chat responsive desktop/mobile
- Pilihan beberapa model
- Riwayat chat lokal
- Markdown sederhana dan code block
- System prompt
- API key disimpan di `localStorage`, bukan di source code
- Tanpa build step / dependency

## Cara pakai
1. Upload seluruh isi folder ini ke repository GitHub.
2. Buka **Settings → Pages**.
3. Pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Buka URL GitHub Pages Anda.
5. Klik **Pengaturan** dan masukkan API key Geraikita (`gk-...`).

API yang digunakan:
`https://ai.geraikita.com/v1/chat/completions`

Dokumentasi resmi:
https://ai.geraikita.com/docs

## Catatan keamanan
Versi ini adalah frontend-only. API key dimasukkan oleh pengguna dan disimpan lokal di browser. **Jangan hardcode API key ke `app.js` atau repository publik.**

Untuk aplikasi publik yang memakai satu API key milik pemilik situs, gunakan backend/proxy (misalnya Cloudflare Worker) agar key tidak terekspos.

## Lisensi
Bebas dimodifikasi untuk kebutuhan Anda.
