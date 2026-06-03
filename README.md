<p align="center">
  <img src="public/SiGemar.png" alt="SiGemar Logo" width="160"/>
</p>

<h1 align="center">SiGemar — Sistem Informasi Gizi Generasi Emas</h1>

<p align="center">
  <strong>Platform Monitoring Stunting & Gizi Anak Berbasis AI untuk Desa Gedongsari, Kecamatan Temanggung</strong>
</p>

<p align="center">
  <a href="https://www.sigemar.id">🌐 Live Demo</a> •
  <a href="#fitur-utama">✨ Fitur</a> •
  <a href="#teknologi">🛠 Teknologi</a> •
  <a href="#instalasi--setup">🚀 Instalasi</a> •
  <a href="#dokumentasi-api">📡 API</a> •
  <a href="#peran-pengguna">👥 Peran</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/Neon_Postgres-Vercel-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="Neon"/>
  <img src="https://img.shields.io/badge/Gemini_AI-Google-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini"/>
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS"/>
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel"/>
</p>

---

## 📋 Daftar Isi

- [Tentang Proyek](#tentang-proyek)
- [Latar Belakang](#latar-belakang)
- [Fitur Utama](#fitur-utama)
- [Demo & Screenshot](#demo--screenshot)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Teknologi](#teknologi)
- [Struktur Folder](#struktur-folder)
- [Skema Database](#skema-database)
- [Peran Pengguna](#peran-pengguna)
- [Instalasi & Setup](#instalasi--setup)
- [Environment Variables](#environment-variables)
- [Deployment ke Vercel](#deployment-ke-vercel)
- [Dokumentasi API](#dokumentasi-api)
- [Algoritma Diagnosis WHO](#algoritma-diagnosis-who)
- [Fitur AI (Google Gemini)](#fitur-ai-google-gemini)
- [Peta Geospasial](#peta-geospasial)
- [Kontributor](#kontributor)
- [Lisensi](#lisensi)

---

## Tentang Proyek

**SiGemar (Sistem Informasi Gizi Generasi Emas)** adalah platform web full-stack yang dibangun untuk memantau tumbuh kembang anak usia 0–60 bulan secara real-time. Platform ini secara otomatis mendiagnosis status gizi anak berdasarkan standar **WHO (World Health Organization)** dan memberikan rekomendasi medis berbasis AI menggunakan **Google Gemini**.

SiGemar dikembangkan sebagai solusi digital untuk mendukung **percepatan penurunan angka stunting** di Indonesia, khususnya di wilayah Kelurahan Gedongsari, Kabupaten Temanggung, Jawa Tengah.

> 🏆 Proyek ini merupakan bagian dari **Program Innovillage** — kompetisi inovasi desa digital oleh Telkom Indonesia & Kementerian Desa.

### 🌐 Website: [https://www.sigemar.id](https://www.sigemar.id)

---

## Latar Belakang

Stunting merupakan kondisi gagal tumbuh pada anak akibat kekurangan gizi kronis. Berdasarkan data SSGI, prevalensi stunting di Indonesia masih menjadi perhatian serius. Permasalahan utama di tingkat desa meliputi:

1. **Pencatatan manual** data posyandu yang rawan hilang dan tidak terstruktur
2. **Keterlambatan deteksi** — orang tua baru menyadari setelah anak mengalami stunting parah
3. **Minimnya akses konsultasi medis** di daerah pedesaan
4. **Tidak adanya sistem monitoring real-time** untuk tenaga kesehatan dan kepala desa

SiGemar hadir untuk menjawab tantangan-tantangan tersebut dengan pendekatan teknologi digital.

---

## Fitur Utama

### 🏠 Landing Page Publik
- Halaman informasi interaktif dengan navigasi smooth-scroll
- Menampilkan berita & artikel terkini seputar kesehatan anak
- Responsif untuk semua ukuran perangkat (desktop, tablet, mobile)

### 🔐 Sistem Autentikasi Multi-Layer
- **Login/Register** dengan username & password
- **Login dengan Google OAuth 2.0** (auto-fill data jika akun Google belum terdaftar)
- **Sistem persetujuan akun (Approval)** — role selain Orang Tua memerlukan aktivasi Super Admin
- **Lupa Password** dengan OTP via Email (Nodemailer + Gmail SMTP)
- **Persistent Login** menggunakan `localStorage`

### 📊 Dashboard Interaktif (Multi-Role)
- **Kartu Statistik** — Total Data, Normal, Overweight, Stunting, Abnormal
- **Grafik Bar Chart** — Distribusi kasus per dusun (7 dusun Gedongsari) dengan filter:
  - Kategori: Stunting / Normal / Overweight / Abnormal
  - Waktu: Semua Waktu / Bulan Ini / Minggu Ini
  - Gender: Semua / Laki-laki / Perempuan
- **Peta Geospasial (Leaflet.js)** — Sebaran anak berdasarkan koordinat GPS per dusun
- **Daftar Pasien Terkini** — 10 data terbaru dengan status badge interaktif

### 🤖 AI Medical Assistant (Gemini AI)
- **Konsultasi AI (MedGemma Expert)** — Analisis kondisi anak dengan prompt engineering mendalam
- **Chatbot AI (SiGemar Bot)** — Asisten tanya jawab untuk orang tua (mendukung Bahasa Indonesia & Bahasa Jawa)
- **AI Article Generator** — Pembuatan artikel kesehatan otomatis dari topik
- **Roadmap Penanganan 12 Bulan** — Rencana nutrisi, stimulasi, dan medis bertahap
- Tindakan **Preventif** dan **Kuratif** dengan ikon kategori otomatis
- **Faktor Risiko** teridentifikasi secara otomatis

### 📋 Registrasi Pasien Lengkap (4 Tahap)
1. **Data Orang Tua/Wali** — Nama, NIK, No. HP (Ayah & Ibu, mendukung status "None")
2. **Identitas Anak** — Nama, NIK, TTL, Gender, Golongan Darah, Agama
3. **Alamat Domisili** — Provinsi → Kota → Kecamatan → Kelurahan → Dusun (API Wilayah Indonesia cascading)
4. **Kontak & Pengukuran Awal** — Email, Pendapatan, Berat/Tinggi/Lingkar Kepala

### 📝 Manajemen Data Pasien
- **Tabel Data Universal** — Filter berdasarkan kategori (Normal, Stunting, Overweight, Abnormal)
- **Pencarian** berdasarkan nama dan lokasi dusun
- **Filter Dropdown** untuk sub-kondisi (Gizi Kurang, Microcephaly, Macrocephaly, Tinggi Lebih)
- **Export ke Excel (.xlsx)** menggunakan library SheetJS
- **Edit Data Step-by-Step** (Super Admin: semua field | Nakes: hanya pengukuran)
- **Hapus Data** dengan modal konfirmasi

### 📰 Manajemen Berita & Artikel
- Editor artikel dengan upload gambar (auto-compress ke JPEG ≤100KB)
- AI-powered article generator dari topik
- Tampilan daftar artikel dengan preview
- Modal detail artikel full-screen

### 👤 Profil Pengguna
- Upload avatar (base64, max 500KB)
- Edit informasi profil (nama, email, telepon, bio)
- Tampilan peran dan username (read-only)

### 🩺 Dashboard Khusus Orang Tua
- **Info Anak** — Data lengkap anak yang terhubung via NIK orang tua
- **Rekam Medis** — Hasil analisis AI (Preventif, Kuratif, Roadmap)
- **AI Asisten (Chatbot)** — Tanya jawab kesehatan anak berbasis data

### 🛡️ Panel Persetujuan Akun (Super Admin)
- Daftar antrean user pending
- Aksi setujui (aktifkan) atau tolak (hapus) akun
- Notifikasi status akun saat login

### 📱 Responsif & Mobile-Friendly
- **Sidebar navigasi** — Collapsible (hover expand di desktop, drawer di mobile)
- **Hamburger menu** untuk tampilan mobile
- **Layout adaptif** untuk semua ukuran layar

---

## Demo & Screenshot

### 🌐 Website Langsung
Kunjungi: **[https://www.sigemar.id](https://www.sigemar.id)**

---

## Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────────┐
│                        KLIEN (BROWSER)                       │
│                                                              │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  Landing Page  │  │  Auth Page   │  │   Dashboard App    │ │
│  │  (Publik)      │  │  (Login/     │  │   (Multi-Role)     │ │
│  │               │  │   Register)  │  │                    │ │
│  └───────┬───────┘  └──────┬───────┘  └─────────┬──────────┘ │
│          │                 │                    │            │
│          └─────────────────┴────────────────────┘            │
│                            │                                 │
│               React 18 + Vite 6 + TailwindCSS 3              │
│         Recharts • Leaflet.js • Lucide Icons • XLSX           │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP REST API
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                   SERVER (VERCEL SERVERLESS)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Express.js API (api/index.js)          │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│  │  │   Auth   │  │ IoT Data │  │ Articles │  │   AI   │ │  │
│  │  │  Routes  │  │  Routes  │  │  Routes  │  │ Routes │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │  │
│  │       │              │             │             │      │  │
│  │       └──────────────┴─────────────┘             │      │  │
│  │                      │                           │      │  │
│  └──────────────────────┼───────────────────────────┼──────┘  │
│                         │                           │         │
│              ┌──────────▼──────────┐    ┌───────────▼───────┐ │
│              │  Neon PostgreSQL    │    │  Google Gemini AI  │ │
│              │  (Vercel Postgres)  │    │  (gemini-flash)    │ │
│              │                    │    │                    │ │
│              │  • users           │    │  • Konsultasi      │ │
│              │  • iot_data (JSONB) │    │  • Chatbot         │ │
│              │  • articles        │    │  • Article Gen     │ │
│              └────────────────────┘    └────────────────────┘ │
│                                                              │
│         Nodemailer (Gmail SMTP) • Google OAuth 2.0            │
└──────────────────────────────────────────────────────────────┘
```

---

## Teknologi

### Frontend
| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| **React** | 18.3 | Library UI berbasis komponen |
| **Vite** | 6.0 | Build tool & dev server |
| **TailwindCSS** | 3.4 | Utility-first CSS framework |
| **Recharts** | 2.15 | Grafik bar chart interaktif |
| **Leaflet.js** | 1.9 | Peta geospasial (OpenStreetMap) |
| **React-Leaflet** | 4.2 | Integrasi Leaflet dengan React |
| **Lucide React** | 0.469 | Ikon SVG modern |
| **SheetJS (xlsx)** | 0.18 | Export data ke Excel |
| **React Google OAuth** | 0.12 | Login dengan akun Google |

### Backend
| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| **Express.js** | 4.21 | Framework REST API |
| **@vercel/postgres** | 0.7 | SDK koneksi Neon PostgreSQL |
| **Google Generative AI** | 0.21 | Gemini AI SDK (analisis & chatbot) |
| **Nodemailer** | 6.9 | Kirim email OTP via Gmail SMTP |
| **Axios** | 1.7 | HTTP client untuk Google Auth |
| **CORS** | 2.8 | Cross-Origin Resource Sharing |
| **body-parser** | 1.20 | Parsing request body (JSON, 50MB limit) |
| **dotenv** | 16.4 | Manajemen environment variables |

### Infrastruktur
| Layanan | Kegunaan |
|---------|----------|
| **Vercel** | Hosting (Frontend + Serverless Functions) |
| **Neon PostgreSQL** | Database cloud (bawaan Vercel) |
| **Google Cloud** | OAuth 2.0 + Gemini AI API |
| **Gmail SMTP** | Pengiriman email OTP |

---

## Struktur Folder

```
sigemar-dashboard/
│
├── api/
│   └── index.js              # Backend Express.js (Serverless Function)
│                              # → Auth, CRUD, AI, Email routes
│
├── public/
│   ├── SiGemar.png            # Logo utama aplikasi (favicon & navbar)
│   ├── blueicon.png           # Ikon status normal
│   ├── redicon.png            # Ikon status risiko
│   ├── fotobalita.jpg         # Gambar hero section
│   ├── danantara.png          # Logo mitra Danantara
│   ├── innologo.png           # Logo Innovillage
│   ├── telkom.png             # Logo Telkom Indonesia
│   ├── telu.png               # Logo Telkom University
│   ├── temanggung.png         # Logo Kabupaten Temanggung
│   └── vite.svg               # Default Vite icon
│
├── src/
│   ├── App.jsx                # Komponen utama (3280 baris)
│   │                          # → Landing, Auth, Dashboard, AI, Table, dll.
│   ├── App.css                # Style dasar (override root)
│   ├── index.css              # Entry point Tailwind CSS
│   ├── main.jsx               # Entry point React (StrictMode)
│   └── assets/                # Asset statis tambahan (kosong)
│
├── .env                       # Environment variables (RAHASIA - tidak di-push)
├── .gitignore                 # Daftar file yang tidak di-push ke Git
├── eslint.config.js           # Konfigurasi ESLint
├── index.html                 # HTML template utama
├── package.json               # Dependensi & scripts
├── postcss.config.js          # PostCSS + TailwindCSS plugin
├── tailwind.config.js         # Konfigurasi Tailwind (custom animation: breathe)
├── vercel.json                # Konfigurasi rewrites Vercel
├── vite.config.js             # Konfigurasi Vite + React plugin
└── README.md                  # Dokumentasi proyek (file ini)
```

---

## Skema Database

SiGemar menggunakan **Neon PostgreSQL** (bawaan Vercel) dengan 3 tabel utama:

### 1. Tabel `users`
```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(255) UNIQUE NOT NULL,
    password        VARCHAR(255),
    role            VARCHAR(50)   DEFAULT 'ortu',      -- superadmin | kades | nakes | ortu
    status          VARCHAR(20)   DEFAULT 'pending',   -- pending | active
    full_name       VARCHAR(255),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    nik             VARCHAR(50),
    otp             VARCHAR(10),                        -- Kode OTP untuk reset password
    otp_expires     BIGINT,                             -- Timestamp kadaluarsa OTP
    dob             VARCHAR(50),                        -- Tanggal lahir
    bio             TEXT,
    avatar          TEXT,                                -- Base64 encoded image
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Tabel `iot_data`
```sql
CREATE TABLE iot_data (
    id              SERIAL PRIMARY KEY,
    id_registrasi   VARCHAR(100),                       -- Format: REG-{timestamp}
    nama_anak       VARCHAR(255),
    data_full       JSONB,                              -- Seluruh data dalam format JSONB
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> **Catatan:** Tabel `iot_data` menggunakan kolom `JSONB` untuk menyimpan seluruh data pasien dalam format fleksibel. Ini mencakup data identitas anak, orang tua, alamat, pengukuran (berat/tinggi/LK), status gizi, analisis AI, koordinat GPS, dan catatan medis.

### 3. Tabel `articles`
```sql
CREATE TABLE articles (
    id              SERIAL PRIMARY KEY,
    title           TEXT,
    content         TEXT,
    image           TEXT,                               -- Base64 encoded (auto-compressed)
    date            VARCHAR(50),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Inisialisasi Database

Setelah deploy pertama kali, akses endpoint berikut **SATU KALI** untuk membuat tabel:

```
GET https://www.sigemar.id/api/setup-db
```

Response sukses:
```json
{ "message": "Database Tables Created Successfully! 🚀" }
```

---

## Peran Pengguna

SiGemar menerapkan **Role-Based Access Control (RBAC)** dengan 4 peran:

| Peran | Kode | Akses | Status Registrasi |
|-------|------|-------|-------------------|
| **Super Admin** | `superadmin` | Full access (Dashboard, CRUD, Registrasi, Artikel, Approval) | Butuh persetujuan |
| **Kepala Desa** | `kades` | Dashboard, Lihat semua data pasien (read-only) | Butuh persetujuan |
| **Tenaga Medis** | `nakes` | Dashboard, Edit pengukuran, AI Medical Assistant | Butuh persetujuan |
| **Orang Tua** | `ortu` | Info anak sendiri, Rekam medis, Chatbot AI | **Langsung aktif** |

### Alur Registrasi
```
Orang Tua mendaftar → Status langsung "ACTIVE" → Bisa login
Nakes/Kades/Admin mendaftar → Status "PENDING" → Menunggu approval Super Admin → ACTIVE
```

### Menu per Peran

| Menu | Super Admin | Kades | Nakes | Orang Tua |
|------|:-----------:|:-----:|:-----:|:---------:|
| Dashboard Utama | ✅ | ✅ | ✅ | ❌ |
| Info Anak | ❌ | ❌ | ❌ | ✅ |
| Rekam Medis | ❌ | ❌ | ❌ | ✅ |
| AI Asisten (Chatbot) | ❌ | ❌ | ❌ | ✅ |
| Semua Data Pasien | ✅ | ✅ | ✅ | ❌ |
| Pasien Normal | ✅ | ✅ | ✅ | ❌ |
| Pasien Overweight | ✅ | ✅ | ✅ | ❌ |
| Pasien Stunting | ✅ | ✅ | ✅ | ❌ |
| Pasien Abnormal | ✅ | ✅ | ✅ | ❌ |
| Persetujuan User | ✅ | ❌ | ❌ | ❌ |
| Manajemen Berita | ✅ | ❌ | ❌ | ❌ |
| Registrasi User | ✅ | ❌ | ❌ | ❌ |
| AI Medical (MedGemma) | ❌ | ❌ | ✅ | ❌ |
| Profil Pengguna | ✅ | ✅ | ✅ | ✅ |

---

## Instalasi & Setup

### Prasyarat
- **Node.js** versi 24.x (atau terbaru)
- **npm** (termasuk dalam Node.js)
- Akun **Vercel** (gratis)
- Akun **Google Cloud Console** (untuk OAuth & Gemini API)

### Langkah Instalasi

```bash
# 1. Clone repositori
git clone https://github.com/Cvixed/sigemarinnovillage.git
cd sigemarinnovillage

# 2. Install dependensi
npm install

# 3. Buat file .env di root folder (lihat bagian Environment Variables)
cp .env.example .env

# 4. Jalankan development server (Frontend + Backend)
#    Terminal 1: Frontend
npm run dev

#    Terminal 2: Backend (Opsional, jika ingin jalankan lokal)
npm run start

# 5. Buka browser ke http://localhost:5173
```

### Menjalankan Lokal (Full Stack)
```bash
# Frontend berjalan di port 5173 (Vite)
# Backend berjalan di port 3000 (Express)
# Frontend otomatis proxy ke backend di DEV mode via konfigurasi API_URL
```

---

## Environment Variables

Buat file `.env` di root folder dengan variabel berikut:

```env
# === DATABASE (Neon PostgreSQL via Vercel) ===
POSTGRES_URL="postgresql://user:pass@host/db?sslmode=require"
POSTGRES_PRISMA_URL="postgresql://user:pass@host/db?sslmode=require"
POSTGRES_URL_NO_SSL="postgresql://user:pass@host/db"
POSTGRES_URL_NON_POOLING="postgresql://user:pass@host/db?sslmode=require"
POSTGRES_USER="your_db_user"
POSTGRES_HOST="your_db_host"
POSTGRES_PASSWORD="your_db_password"
POSTGRES_DATABASE="your_db_name"

# === GOOGLE GEMINI AI ===
GEN_AI_KEY="your_google_gemini_api_key"

# === EMAIL (Gmail SMTP untuk OTP) ===
EMAIL_USER="your_gmail@gmail.com"
EMAIL_PASS="your_gmail_app_password"

# === GOOGLE OAUTH 2.0 (Frontend) ===
VITE_GOOGLE_CLIENT_ID="your_google_oauth_client_id.apps.googleusercontent.com"
```

> ⚠️ **PENTING:** File `.env` berisi rahasia dan **TIDAK BOLEH** di-push ke GitHub. Pastikan sudah terdaftar di `.gitignore`.

### Cara Mendapatkan Credentials

| Variable | Sumber |
|----------|--------|
| `POSTGRES_*` | Otomatis dari Vercel saat menghubungkan Neon Postgres |
| `GEN_AI_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail → App Passwords (perlu 2FA aktif) |
| `VITE_GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com) → Credentials → OAuth 2.0 |

---

## Deployment ke Vercel

### 1. Persiapan
```bash
# Pastikan sudah login Vercel CLI (opsional)
npm i -g vercel
vercel login
```

### 2. Deploy via GitHub
1. Push kode ke GitHub repository
2. Buka [vercel.com/new](https://vercel.com/new) dan import repository
3. Vercel akan otomatis mendeteksi framework Vite
4. Tambahkan **semua environment variables** di Settings → Environment Variables
5. Deploy!

### 3. Setup Database
Setelah deploy pertama:
1. Buka tab **Storage** di dashboard Vercel
2. Buat database **Neon PostgreSQL** baru
3. Environment variables database akan otomatis ter-inject
4. Akses `https://your-domain.vercel.app/api/setup-db` untuk membuat tabel

### 4. Konfigurasi Vercel (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Dokumentasi API

Base URL: `https://www.sigemar.id/api` (Production) atau `http://localhost:3000/api` (Development)

### Health Check
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/health` | Cek status server & database |

### Autentikasi
| Method | Endpoint | Deskripsi | Body |
|--------|----------|-----------|------|
| `POST` | `/login` | Login user | `{ username, password }` |
| `POST` | `/register` | Registrasi user baru | `{ username, password, email, fullName, nik, phone, role }` |
| `POST` | `/auth/google` | Login/Register via Google | `{ token }` (Google Access Token) |
| `POST` | `/forgot-password` | Kirim OTP ke email | `{ email }` |

### Manajemen User (Super Admin)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/users/pending` | Daftar user menunggu persetujuan |
| `PUT` | `/users/approve/:id` | Setujui (aktifkan) user |
| `DELETE` | `/users/reject/:id` | Tolak & hapus user |

### Data Pasien (IoT Data)
| Method | Endpoint | Deskripsi | Body |
|--------|----------|-----------|------|
| `GET` | `/iot-data` | Ambil semua data pasien | — |
| `POST` | `/iot-data` | Tambah data pasien baru | JSON data pasien lengkap |
| `PUT` | `/iot-data/:id` | Update data pasien | JSON field yang diupdate |
| `DELETE` | `/iot-data/:id` | Hapus data pasien | — |

### Artikel
| Method | Endpoint | Deskripsi | Body |
|--------|----------|-----------|------|
| `GET` | `/articles` | Ambil semua artikel | — |
| `POST` | `/articles` | Posting artikel baru | `{ title, content, image }` |
| `DELETE` | `/articles/:id` | Hapus artikel | — |

### Profil
| Method | Endpoint | Deskripsi | Body |
|--------|----------|-----------|------|
| `PUT` | `/profile` | Update profil user | `{ username, fullName, email, phone, nik, bio, dob, avatar }` |

### AI Features
| Method | Endpoint | Deskripsi | Body |
|--------|----------|-----------|------|
| `POST` | `/consult-ai` | Konsultasi AI (Analisis Medis Mendalam) | `{ childData, nakesNotes }` |
| `POST` | `/chat-bot` | Chatbot AI (Tanya Jawab Orang Tua) | `{ childData, question }` |
| `POST` | `/generate-article` | Generate artikel dari topik | `{ topic }` |

### Setup
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/setup-db` | Buat tabel database (jalankan sekali) |

---

## Algoritma Diagnosis WHO

SiGemar mengimplementasikan algoritma diagnosis otomatis berdasarkan standar antropometri WHO:

### Perhitungan Standar WHO
```
Berat Badan Standar = 3.2 + (umur_bulan × 0.5) kg
Tinggi Badan Standar = 50 + (umur_bulan × 2.0) cm   (≤12 bulan)
                     = 74 + ((umur - 12) × 1.0) cm   (>12 bulan)
Lingkar Kepala Standar = 34 + (umur_bulan × 1.5) cm  (≤6 bulan)
                       = 43 + ((umur - 6) × 0.5) cm  (>6 bulan)
```

### Rentang Normal
| Metrik | Batas Bawah | Batas Atas |
|--------|-------------|------------|
| Berat Badan | 80% standar | 120% standar |
| Tinggi Badan | 90% standar | 115% standar |
| Lingkar Kepala | 85% standar | 115% standar |

### Klasifikasi Status Gizi
```
Berat < Batas Bawah → KURANG (Gizi Kurang)
Berat > Batas Atas  → LEBIH (Overweight)

Tinggi < Batas Bawah → PENDEK (Stunting)
Tinggi > Batas Atas  → TINGGI (Tinggi Lebih)

LK < Batas Bawah → KECIL (Microcephaly)
LK > Batas Atas  → BESAR (Macrocephaly)
```

### Logika Penentuan Status Final
```
Prioritas 1: Jika ada metrik KURANG/PENDEK/KECIL → "Risiko Stunting"
Prioritas 2: Jika Berat LEBIH → "Overweight"
Default: "Normal"

Status bisa dikombinasikan, contoh:
"Risiko Stunting & Gizi Kurang & Microcephaly"
"Tinggi Lebih & Macrocephaly"
```

---

## Fitur AI (Google Gemini)

### 1. MedGemma Expert (Konsultasi Mendalam)
- Model: `gemini-flash-latest` (JSON mode)
- Input: Data pasien + gejala klinis terpilih dari **31+ opsi gejala** dalam 4 kategori
- Output JSON:
  - `analisis` — Narasi medis 2+ paragraf
  - `faktor_risiko` — Array risiko teridentifikasi
  - `preventif` — Tindakan pencegahan dengan kategori & ikon
  - `represif` — Tindakan kuratif dengan kategori & ikon
  - `roadmap` — Rencana 12 bulan (4 fase: Bulan 1 → 2-3 → 4-6 → 7-12) dengan detail nutrisi, stimulasi, dan medis

### 2. SiGemar Bot (Chatbot Orang Tua)
- Model: `gemini-flash-latest` (text mode)
- Fitur unik:
  - **Deteksi bahasa otomatis** — mendukung Bahasa Indonesia & Bahasa Jawa (Kromo)
  - Sapaan "Bunda/Ayah"
  - Tanpa format markdown (teks bersih)
  - Kontekstual terhadap data pertumbuhan anak

### 3. Article Generator
- Input: Topik artikel
- Output: JSON `{ title, content }` siap posting

### Kategori Gejala Klinis (Observasi)
| Kategori | Jumlah Opsi | Contoh |
|----------|-------------|--------|
| Pola Makan & Nutrisi | 10 | Nafsu makan turun, ASI tidak eksklusif |
| Kondisi Fisik | 10 | Badan kurus, rambut rontok, perut buncit |
| Tumbuh Kembang | 7 | Belum bisa jalan, terlambat bicara |
| Lingkungan & Pengasuhan | 7 | Sanitasi buruk, perokok di rumah |

---

## Peta Geospasial

SiGemar menggunakan **Leaflet.js** dengan layer **OpenStreetMap** untuk menampilkan sebaran anak berdasarkan lokasi:

### Koordinat Dusun (Preset)
| Dusun | Latitude | Longitude |
|-------|----------|-----------|
| Balekerso | -7.2335 | 110.1180 |
| Pistan | -7.2350 | 110.1225 |
| Janggar | -7.2365 | 110.1190 |
| Gedongan | -7.2340 | 110.1205 |
| Spatran | -7.2325 | 110.1215 |
| Pringkudo | -7.2355 | 110.1175 |
| Gandok | -7.2370 | 110.1210 |

### Marker Interaktif
- 🔴 **Marker Merah (Animasi Ping)** — Anak dengan status risiko (Stunting, Gizi Kurang, Microcephaly)
- 🔵 **Marker Biru (Animasi Pulse)** — Anak dengan status normal
- **Popup** menampilkan: Nama, Umur, Dusun, Status, Berat/Tinggi
- **Tooltip** menampilkan nama saat hover

---

## Scripts

```bash
npm run dev       # Jalankan Vite development server (Frontend)
npm run build     # Build production (output ke /dist)
npm run preview   # Preview build production
npm run start     # Jalankan Express server (Backend, lokal)
npm run lint      # Jalankan ESLint
```

---

## Kontributor

<table>
  <tr>
    <td align="center">
      <strong>Tim SiGemar — Telkom University</strong><br/>
      <em>Program Innovillage 2025</em>
    </td>
  </tr>
</table>

### Mitra & Pendukung
- 🏛️ **Pemerintah Kelurahan Gedongsari** — Kabupaten Temanggung, Jawa Tengah
- 🏫 **Telkom University**
- 📡 **Telkom Indonesia**
- 🏢 **Danantara**

---

## Lisensi

Proyek ini dikembangkan untuk keperluan **Program Innovillage 2025** oleh Telkom Indonesia. Seluruh hak cipta dilindungi.

---

<p align="center">
  <strong>© 2026 SiGemar System — Menjaga Generasi Emas, Mencegah Stunting.</strong>
</p>

<p align="center">
  Dibuat dengan ❤️ di Temanggung, Jawa Tengah
</p>
