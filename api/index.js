import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { sql } from '@vercel/postgres'; 
import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from 'nodemailer';
import axios from 'axios';

dotenv.config();
const app = express();

// --- [FIX] DEFINISI PORT WAJIB ADA ---
const PORT = process.env.PORT || 3000;
// ------------------------------------

// --- CONFIG ---
const GEN_AI_KEY = process.env.GEN_AI_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// 1. SETUP DATABASE (TABLE CREATION)
// ==========================================
// Akses link ini SEKALI saja setelah deploy: https://web-anda.vercel.app/api/setup-db
app.get('/api/setup-db', async (req, res) => {
    try {
        // Tabel Users
        await sql`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255),
            role VARCHAR(50) DEFAULT 'ortu',
            status VARCHAR(20) DEFAULT 'pending',
            full_name VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(50),
            nik VARCHAR(50),
            otp VARCHAR(10),
            otp_expires BIGINT,
            dob VARCHAR(50),
            bio TEXT,
            avatar TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`;

        // Tabel IoT Data (Simpan data kompleks sebagai JSONB biar fleksibel)
        await sql`CREATE TABLE IF NOT EXISTS iot_data (
            id SERIAL PRIMARY KEY,
            id_registrasi VARCHAR(100),
            nama_anak VARCHAR(255),
            data_full JSONB, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`;

        // Tabel Articles
        await sql`CREATE TABLE IF NOT EXISTS articles (
            id SERIAL PRIMARY KEY,
            title TEXT,
            content TEXT,
            image TEXT,
            date VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`;

        return res.json({ message: "Database Tables Created Successfully! 🚀" });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 2. LOGIC AI & HELPERS
// ==========================================

// AI Setup (Safe Init)
let model, modelText;
try {
    if(GEN_AI_KEY) {
        const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" }});
        modelText = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    }
} catch (e) { console.log("AI Config Error:", e.message); }

const mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

const IMAGE_MAP = {
    'rokok': 'https://cdn-icons-png.flaticon.com/512/6122/6122662.png',
    'nutrisi': 'https://cdn-icons-png.flaticon.com/512/706/706195.png',
    'susu': 'https://cdn-icons-png.flaticon.com/512/9708/9708399.png',
    'dokter': 'https://cdn-icons-png.flaticon.com/512/3063/3063176.png',
    'sanitasi': 'https://cdn-icons-png.flaticon.com/512/2954/2954888.png',
    'tidur': 'https://cdn-icons-png.flaticon.com/512/3094/3094833.png',
    'stimulasi': 'https://cdn-icons-png.flaticon.com/512/3082/3082342.png',
    'default': 'https://cdn-icons-png.flaticon.com/512/10338/10338575.png'
};

// WHO Logic
const getStdWHO = (umur, type) => {
    const u = parseInt(umur) || 0;
    if (type === 'berat') return 3.2 + (u * 0.5);
    if (type === 'tinggi') return u <= 12 ? 50 + (u * 2.0) : 74 + ((u - 12) * 1.0);
    if (type === 'lk') return u <= 6 ? 34 + (u * 1.5) : 43 + ((u - 6) * 0.5);
    return 0;
};

const analyzeMetric = (val, umur, type) => {
    if (!val) return { value: null, label: 'BELUM ADA DATA' };
    const value = parseFloat(val);
    const std = getStdWHO(umur, type);
    let minPct = type === 'berat' ? 0.8 : 0.85;
    let maxPct = type === 'berat' ? 1.2 : 1.15;
    if (type === 'tinggi') minPct = 0.9;

    const min = parseFloat((std * minPct).toFixed(1));
    const max = parseFloat((std * maxPct).toFixed(1));

    let label = 'NORMAL';
    if (value < min) label = type === 'berat' ? 'KURANG' : (type === 'tinggi' ? 'PENDEK' : 'KECIL');
    else if (value > max) label = type === 'berat' ? 'LEBIH' : (type === 'tinggi' ? 'TINGGI' : 'BESAR');
    
    return { value, label, rangeMin: min, rangeMax: max };
};

const processFullDiagnosis = (body) => {
    const umur = parseInt(body.umur);
    const berat = body.berat ? parseFloat(body.berat) : 0;
    const tinggi = body.tinggi ? parseFloat(body.tinggi) : 0;
    const lk = body.lk ? parseFloat(body.lk) : 0;

    const dBerat = analyzeMetric(berat, umur, 'berat');
    const dTinggi = analyzeMetric(tinggi, umur, 'tinggi');
    const dLk = analyzeMetric(lk, umur, 'lk');

    // 1. Tentukan Main Status
    let mainStatus = "Normal";
    let sideStatuses = [];

    // Cek Kondisi Risiko Stunting (Prioritas 1)
    const isBelowStd = (dBerat.label === 'KURANG' || dTinggi.label === 'PENDEK' || dLk.label === 'KECIL');
    if (isBelowStd) {
        mainStatus = "Risiko Stunting";
        if (dTinggi.label === 'PENDEK') sideStatuses.push("Tinggi Kurang");
        if (dBerat.label === 'KURANG') sideStatuses.push("Kurang Gizi");
        if (dLk.label === 'KECIL') sideStatuses.push("Microcephaly");
    } 
    // Cek Kondisi Overweight (Prioritas 2)
    else if (dBerat.label === 'LEBIH') {
        mainStatus = "Overweight";
    }

    // 2. Tentukan Side Status Abnormal (Tinggi Lebih / Macrocephaly)
    if (dTinggi.label === 'TINGGI') {
        sideStatuses.push("Tinggi Lebih");
    }
    if (dLk.label === 'BESAR') {
        sideStatuses.push("Macrocephaly");
    }

    // 3. KONSTRUKSI FINAL STATUS (LOGIKA BARU)
    let finalStatus = "";

    if (sideStatuses.length > 0) {
        // Jika ada masalah (side status), cek apakah main statusnya Normal?
        if (mainStatus === "Normal") {
            // JIKA ADA SIDE STATUS TAPI TIDAK STUNTING/OVERWEIGHT -> BUANG KATA "NORMAL"
            finalStatus = sideStatuses.join(" & ");
        } else {
            // Jika Stunting/Overweight, tetap taruh di depan
            finalStatus = `${mainStatus} & ${sideStatuses.join(" & ")}`;
        }
    } else {
        // Jika benar-benar bersih tidak ada side status sama sekali
        finalStatus = mainStatus;
    }

    // Proteksi data kosong
    if (!berat && !tinggi && !lk) {
        finalStatus = "Menunggu Data";
    }

    return {
        ...body,
        berat, tinggi, lk,
        status: finalStatus,
        analysis: {
            berat: { ...dBerat, status: dBerat.label },
            tinggi: { ...dTinggi, status: dTinggi.label },
            lk: { ...dLk, status: dLk.label }
        }
    };
};

// ==========================================
// 3. API ROUTES (POSTGRES + LOGIKA LENGKAP)
// ==========================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', db: 'Vercel Postgres (Ready)' });
});

// Di dalam /api/setup-db, update create table users:
// status VARCHAR(20) DEFAULT 'pending'

// --- UPDATE DI api/index.js ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Ambil user dari DB
        const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
        const user = rows[0];

        // 1. Validasi Keberadaan User & Password
        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Username atau Password salah!" });
        }

        // 2. LOGIKA PENYARINGAN STATUS (Gembok Utama)
        // Kita paksa ubah ke lowercase agar tidak ada masalah huruf besar/kecil
        const currentStatus = (user.status || 'pending').toLowerCase();

        if (currentStatus !== 'active') {
            // Jika status bukan 'active', kita berikan status 403 (Forbidden)
            // Dan kita PAKSA return agar kode di bawahnya tidak jalan
            console.log(`Blokir login: User ${username} statusnya masih ${currentStatus}`);
            return res.status(403).json({ 
                message: `Akun Anda (${username}) berstatus ${currentStatus.toUpperCase()}. Mohon hubungi Super Admin untuk aktivasi.` 
            });
        }

        // 3. Hanya jika statusnya 'active' barulah kode ini bisa diakses
        res.json({ 
            message: "Login Berhasil", 
            user: { 
                username: user.username, 
                role: user.role, 
                fullName: user.full_name,
                nik: user.nik 
            } 
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Server error saat login." });
    }
});

// --- 2. TAMBAH ROUTE APPROVAL (api/index.js) ---
// Ambil daftar user yang pending
app.get('/api/users/pending', async (req, res) => {
    try {
        const { rows } = await sql`SELECT id, username, email, role, full_name, nik FROM users WHERE status = 'pending' ORDER BY created_at DESC`;
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Setujui User
app.put('/api/users/approve/:id', async (req, res) => {
    try {
        await sql`UPDATE users SET status = 'active' WHERE id = ${req.params.id}`;
        res.json({ message: "User disetujui!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Tolak/Hapus User
app.delete('/api/users/reject/:id', async (req, res) => {
    try {
        await sql`DELETE FROM users WHERE id = ${req.params.id}`;
        res.json({ message: "User ditolak dan dihapus." });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- [REVISI] AUTH REGISTER (api/index.js) ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email, fullName, nik, phone, role } = req.body;
        
        // --- LOGIKA OTOMATIS AKTIF UNTUK ORTU ---
        // Jika role adalah 'ortu', status langsung 'active'. Selain itu 'pending'.
        const initialStatus = (role === 'ortu') ? 'active' : 'pending';

        await sql`
            INSERT INTO users (username, password, email, full_name, nik, phone, role, status)
            VALUES (${username}, ${password}, ${email}, ${fullName}, ${nik}, ${phone}, ${role || 'ortu'}, ${initialStatus})
        `;

        // Berikan respon yang berbeda agar user tidak bingung
        if (initialStatus === 'active') {
            res.json({ message: "Registrasi Berhasil! Silakan masuk." });
        } else {
            res.json({ message: "Registrasi Berhasil! Mohon tunggu persetujuan Admin untuk akses ini." });
        }

    } catch (err) { 
        if(err.code === '23505') return res.status(400).json({ message: "Username/Email sudah dipakai" });
        res.status(500).json({ message: err.message }); 
    }
});

// --- GOOGLE AUTH ---
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
        const { email, name, picture } = googleRes.data;

        const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
        
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ status: 'success', message: "Login Berhasil", user: { username: user.username, role: user.role, fullName: user.full_name } });
        } else {
            res.json({ status: 'register_needed', message: "Silakan lengkapi NIK", googleData: { email, fullName: name, username: email.split('@')[0], avatar: picture } });
        }
    } catch (error) { res.status(401).json({ message: "Token Google Invalid" }); }
});

// --- FORGOT PASSWORD ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
        
        if (rows.length === 0) return res.status(404).json({ message: "Email tidak terdaftar" });
        const user = rows[0];

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 300000; 

        await sql`UPDATE users SET otp = ${otpCode}, otp_expires = ${otpExpires} WHERE id = ${user.id}`;

        const mailOptions = {
            from: `"SiGemar Admin" <${EMAIL_USER}>`,
            to: email,
            subject: 'KODE OTP RESET PASSWORD',
            html: `<h3>Kode OTP Anda: ${otpCode}</h3>`
        };
        await mailTransporter.sendMail(mailOptions);
        res.json({ message: "OTP Terkirim ke Email" });
    } catch (err) { res.status(500).json({ message: "Gagal kirim email" }); }
});

// --- IOT DATA (GET) ---
app.get('/api/iot-data', async (req, res) => {
    try {
        // Ambil JSONB dan kembalikan sebagai object biasa
        const { rows } = await sql`SELECT data_full FROM iot_data ORDER BY created_at DESC`;
        // Map rows agar formatnya kembali seperti array of objects
        const data = rows.map(row => row.data_full);
        res.json(data);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- IOT DATA (POST) ---
app.post('/api/iot-data', async (req, res) => {
    try {
        const processed = processFullDiagnosis(req.body);
        const finalData = { 
            ...processed, 
            id: Date.now(), // Generate ID manual untuk FE
            idRegistrasi: `REG-${Date.now()}`,
            waktuSubmit: new Date().toLocaleString('id-ID'),
            jam: new Date().toLocaleTimeString('id-ID')
        };
        
        // Simpan sebagai JSONB
        await sql`
            INSERT INTO iot_data (id_registrasi, nama_anak, data_full)
            VALUES (${finalData.idRegistrasi}, ${finalData.nama}, ${finalData})
        `;
        
        res.status(201).json({ message: "Data Tersimpan", data: finalData });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- IOT DATA (UPDATE) ---
app.put('/api/iot-data/:id', async (req, res) => {
    try {
        const idToUpdate = parseInt(req.params.id);
        
        // Cari data lama dulu (karena ini JSONB, kita ambil isi datanya)
        const { rows } = await sql`SELECT data_full FROM iot_data WHERE (data_full->>'id')::numeric = ${idToUpdate}`;
        if (rows.length === 0) return res.status(404).json({ message: "Data tak ditemukan" });
        
        const oldData = rows[0].data_full;
        const mergedBody = { ...oldData, ...req.body };
        
        // Proses ulang diagnosa
        const processedData = processFullDiagnosis(mergedBody);

        // Update ke database
        await sql`UPDATE iot_data SET data_full = ${processedData} WHERE (data_full->>'id')::numeric = ${idToUpdate}`;
        
        res.json({ message: "Data Berhasil Diupdate" });
    } catch (err) { res.status(500).json({ message: "Gagal Update" }); }
});

// --- IOT DATA (DELETE) ---
app.delete('/api/iot-data/:id', async (req, res) => {
    try {
        const idToDelete = parseInt(req.params.id);
        await sql`DELETE FROM iot_data WHERE (data_full->>'id')::numeric = ${idToDelete}`;
        res.json({ message: "Hapus Sukses" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- ARTICLES (GET) ---
app.get('/api/articles', async (req, res) => {
    try {
        const { rows } = await sql`SELECT * FROM articles ORDER BY id DESC`;
        res.json(rows);
    } catch (err) { res.json([]); } 
});

// --- ARTICLES (POST) ---
app.post('/api/articles', async (req, res) => {
    try {
        const { title, content, image } = req.body;
        const date = new Date().toISOString().split('T')[0];
        await sql`INSERT INTO articles (title, content, image, date) VALUES (${title}, ${content}, ${image}, ${date})`;
        res.json({ message: "Artikel Diposting" });
    } catch (err) { res.status(500).json({ message: "Gagal Posting" }); }
});

// --- ARTICLES (DELETE) ---
app.delete('/api/articles/:id', async (req, res) => {
    try {
        const idToDelete = parseInt(req.params.id);
        await sql`DELETE FROM articles WHERE id = ${idToDelete}`;
        res.json({ message: "Artikel Dihapus" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- PROFILE UPDATE ---
app.put('/api/profile', async (req, res) => {
    try {
        const { username, ...updateData } = req.body;
        
        // Kita build query update dinamis
        // (Sederhananya untuk SQL statis, kita update field umum saja)
        await sql`
            UPDATE users SET 
            full_name = ${updateData.fullName}, 
            email = ${updateData.email},
            phone = ${updateData.phone},
            nik = ${updateData.nik},
            bio = ${updateData.bio},
            dob = ${updateData.dob},
            avatar = ${updateData.avatar}
            WHERE username = ${username}
        `;

        // Ambil data terbaru untuk dikembalikan ke FE
        const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
        const updatedUser = rows[0];

        res.json({ message: "Profil Diupdate", user: { username: updatedUser.username, role: updatedUser.role, fullName: updatedUser.full_name, nik: updatedUser.nik } });
    } catch (err) { res.status(500).json({ message: "Gagal Update Profile" }); }
});

// ==========================================
// 4. AI FEATURES (UTUH KEMBALI)
// ==========================================

// --- AI FEATURES (UPDATED: 12 BULAN ROADMAP & DETAIL) ---
app.post('/api/consult-ai', async (req, res) => {
    const { childData, nakesNotes } = req.body;
    try {
        const dBerat = analyzeMetric(childData.berat, childData.umur, 'berat');
        const dTinggi = analyzeMetric(childData.tinggi, childData.umur, 'tinggi');
        
        // Prompt yang sudah diperkuat
        const promptText = `
           Bertindaklah sebagai Dokter Spesialis Anak Konsultan Tumbuh Kembang dan Ahli Gizi.
           
           DATA PASIEN:
           - Nama: ${childData.nama}
           - Umur: ${childData.umur} bulan
           - Status Gizi Saat Ini: ${childData.status}
           - Berat: ${childData.berat}kg (${dBerat.label})
           - Tinggi: ${childData.tinggi}cm (${dTinggi.label})
           - Catatan Nakes/Gejala: "${nakesNotes}"

           TUGAS:
           Berikan analisis medis mendalam dan roadmap penanganan jangka panjang.

           ATURAN WAJIB (STRICT RULES):
           1. Gunakan BAHASA INDONESIA yang baku, empatik, dan mudah dipahami orang tua. Jangan gunakan bahasa Inggris.
           2. Roadmap HARUS mencakup rentang waktu 12 BULAN KE DEPAN (JANGAN hanya beberapa minggu).
           3. Pada bagian 'roadmap', setiap poin 'kegiatan' (nutrisi & stimulasi) HARUS memiliki MINIMAL 3-4 butir saran yang spesifik dan detail.
           4. Jangan memberikan saran umum, berikan saran spesifik sesuai umur dan kondisi anak.

           FORMAT OUTPUT WAJIB JSON (Tanpa markdown lain):
           {
               "analisis": "Narasi medis maksimal 1 paragraf tentang kondisi anak, penyebab kemungkinan, dan urgensi penanganan...",
               "faktor_risiko": ["Sebutkan risiko 1", "Sebutkan risiko 2", "Sebutkan risiko 3 (min 3)"],
               "preventif": [ 
                    {"teks": "Saran pencegahan detail 1...", "kategori": "nutrisi"},
                    {"teks": "Saran pencegahan detail 2...", "kategori": "stimulasi"}
               ],
               "represif": [ 
                    {"teks": "Tindakan pengobatan/koreksi 1...", "kategori": "dokter"},
                    {"teks": "Tindakan pengobatan/koreksi 2...", "kategori": "nutrisi"}
               ],
               "roadmap": [ 
                    { 
                        "fase": "Bulan 1 (Stabilisasi & Inisiasi)", 
                        "target": "Target kenaikan BB spesifik atau perbaikan gejala...", 
                        "kegiatan": { 
                            "nutrisi": ["Menu detail pagi..", "Menu detail siang..", "Aturan jam makan..", "Suplementasi jika perlu.."], 
                            "stimulasi": ["Aktivitas fisik spesifik 1..", "Aktivitas fisik spesifik 2..", "Mainan yang disarankan.."], 
                            "medis": "Jadwal kontrol dokter atau cek lab spesifik..." 
                        } 
                    },
                    { 
                        "fase": "Bulan 2-3 (Kejar Tumbuh)", 
                        "target": "Target catch-up growth...", 
                        "kegiatan": { 
                            "nutrisi": ["Peningkatan kalori..", "Variasi protein hewani..", "Saran cemilan padat gizi.."], 
                            "stimulasi": ["Stimulasi motorik kasar..", "Stimulasi motorik halus..", "Interaksi sosial.."], 
                            "medis": "Evaluasi kenaikan BB dan TB..." 
                        } 
                    },
                    { 
                        "fase": "Bulan 4-6 (Pemantauan Ketat)", 
                        "target": "Mempertahankan grafik pertumbuhan...", 
                        "kegiatan": { 
                            "nutrisi": ["Poin detail 1...", "Poin detail 2...", "Poin detail 3..."], 
                            "stimulasi": ["Poin detail 1...", "Poin detail 2...", "Poin detail 3..."], 
                            "medis": "Skrining perkembangan..." 
                        } 
                    },
                    { 
                        "fase": "Bulan 7-12 (Normalisasi & Maintenance)", 
                        "target": "Tumbuh kembang sesuai kurva WHO...", 
                        "kegiatan": { 
                            "nutrisi": ["Poin detail 1...", "Poin detail 2...", "Poin detail 3..."], 
                            "stimulasi": ["Poin detail 1...", "Poin detail 2...", "Poin detail 3..."], 
                            "medis": "Vaksinasi dan cek rutin..." 
                        } 
                    }
               ]
           }`;

        const result = await model.generateContent(promptText);
        let text = result.response.text().replace(/```json|```/g, '').trim();
        const jsonResult = JSON.parse(text);
        
        // Mapping Gambar Icon (Code lama tetap dipertahankan)
        const mapImg = (arr) => arr ? arr.map(item => ({ ...item, image: IMAGE_MAP[item.kategori] || IMAGE_MAP['default'] })) : [];
        if (jsonResult.preventif) jsonResult.preventif = mapImg(jsonResult.preventif);
        if (jsonResult.represif) jsonResult.represif = mapImg(jsonResult.represif);

        res.json({ reply: JSON.stringify(jsonResult) });
    } catch (error) {
        console.error("AI Error:", error);
        // Error handling yang lebih robust
        res.status(500).json({ 
            reply: JSON.stringify({ 
                analisis: "Maaf, AI sedang sibuk. Silakan coba sesaat lagi.", 
                preventif: [], 
                represif: [],
                roadmap: []
            }) 
        });
    }
});

// --- Update di api/index.js ---
app.post('/api/chat-bot', async (req, res) => {
    const { childData, question } = req.body;
    try {
        const prompt = `
        Bertindaklah sebagai 'SiGemar Bot', asisten kesehatan anak yang cerdas dan adaptif untuk wilayah Temanggung, Jawa Tengah.
        DATA ANAK: ${childData.nama}, Umur ${childData.umur} bln, Status ${childData.status}.
        PERTANYAAN USER: "${question}"
        
        ATURAN RESPONS (WAJIB DIPATUHI):
        1. DETEKSI BAHASA: Gunakan bahasa yang SAMA dengan bahasa yang digunakan oleh Bunda/Ayah saat bertanya.
        2. JIKA USER BERTANYA DALAM BAHASA INDONESIA: Jawablah dengan Bahasa Indonesia yang baik, ramah, dan solutif.
        3. JIKA USER BERTANYA DALAM BAHASA JAWA (Ngoko/Kromo): Jawablah dengan Bahasa Jawa yang santun (Kromo Madya atau Kromo Alus) agar terasa dekat dan menghormati.
        4. SAPAAN: Selalu gunakan sebutan 'Bunda/Ayah' di setiap awal atau akhir kalimat.
        5. TANPA BINTANG: JANGAN gunakan format markdown bold (**) atau simbol bintang sama sekali. Berikan teks polos yang bersih.
        6. EMPATI: Berikan jawaban yang menenangkan dan praktis berdasarkan data pertumbuhan anak tersebut.
        `;

        const result = await modelText.generateContent(prompt);
        let replyText = result.response.text();

        // --- FILTER KEAMANAN AKHIR ---
        // Menghapus paksa simbol bintang jika AI masih memberikan markdown
        replyText = replyText.replace(/\*\*/g, '').replace(/\*/g, '');

        res.json({ reply: replyText });
    } catch (e) { 
        // Pesan error juga dibuat netral
        res.status(500).json({ reply: "Mohon maaf Bunda/Ayah, sistem sedang mengalami gangguan teknis sebentar. Silakan coba lagi nggih." }); 
    }
});

app.post('/api/generate-article', async (req, res) => {
     const { topic } = req.body;
     try {
         const prompt = `Buat artikel JSON tentang ${topic}. Format: { "title": "Judul...", "content": "Isi..." }`;
         const result = await modelText.generateContent(prompt);
         const text = result.response.text().replace(/```json|```/g, '').trim();
         res.json(JSON.parse(text));
     } catch (e) { res.status(500).json({ message: "Error" }); }
});

// ==========================================
// 5. EXPORT UNTUK VERCEL (PENTING!)
// ==========================================
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Server running locally on port ${PORT}`));
}

// --- USER MANAGEMENT ROUTES ---
app.get('/api/users/pending', async (req, res) => {
    try {
        const { rows } = await sql`SELECT id, username, email, role, full_name, nik FROM users WHERE status = 'pending' ORDER BY created_at DESC`;
        res.json(rows);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/users/approve/:id', async (req, res) => {
    try {
        await sql`UPDATE users SET status = 'active' WHERE id = ${req.params.id}`;
        res.json({ message: "User disetujui!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/users/reject/:id', async (req, res) => {
    try {
        await sql`DELETE FROM users WHERE id = ${req.params.id}`;
        res.json({ message: "User ditolak dan dihapus." });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

export default app;