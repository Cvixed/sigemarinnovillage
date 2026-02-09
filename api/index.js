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

    let mainStatus = "Normal";
    let sideStatuses = [];
    if (dBerat.label === 'KURANG' || dTinggi.label === 'PENDEK' || dLk.label === 'KECIL') mainStatus = "Stunting";
    else if (dBerat.label === 'LEBIH') mainStatus = "Overweight";
    
    if (dLk.label === 'BESAR') sideStatuses.push("Macrocephaly");

    let finalStatus = sideStatuses.length > 0 ? `${mainStatus} & ${sideStatuses.join(' & ')}` : mainStatus;
    if (!berat && !tinggi) finalStatus = "Menunggu Data";

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

// --- AUTH LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Query SQL
        const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
        
        if (rows.length === 0 || rows[0].password !== password) {
            return res.status(401).json({ message: "Login Gagal" });
        }
        const user = rows[0];
        res.json({ 
            message: "Login Sukses", 
            user: { username: user.username, role: user.role, fullName: user.full_name, nik: user.nik } 
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- AUTH REGISTER ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email, fullName, nik, phone, role } = req.body;
        // Insert SQL
        await sql`
            INSERT INTO users (username, password, email, full_name, nik, phone, role)
            VALUES (${username}, ${password}, ${email}, ${fullName}, ${nik}, ${phone}, ${role || 'ortu'})
        `;
        res.json({ message: "Registrasi Berhasil" });
    } catch (err) { 
        // Handle Duplicate
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

app.post('/api/consult-ai', async (req, res) => {
    const { childData, nakesNotes } = req.body;
    try {
        const dBerat = analyzeMetric(childData.berat, childData.umur, 'berat');
        const dTinggi = analyzeMetric(childData.tinggi, childData.umur, 'tinggi');
        
        const promptText = `
           Bertindaklah sebagai Dokter Spesialis Anak.
           PROFIL: ${childData.nama} (${childData.umur} bln). Keluhan: "${nakesNotes}"
           ANALISIS: BB=${childData.berat}kg (${dBerat.label}), TB=${childData.tinggi}cm (${dTinggi.label}).
           
           OUTPUT JSON ONLY:
           {
               "analisis": "Narasi medis...",
               "faktor_risiko": ["Risiko 1", "Risiko 2"],
               "preventif": [ {"teks": "...", "kategori": "nutrisi"} ],
               "represif": [ {"teks": "...", "kategori": "dokter"} ],
               "roadmap": [ { "fase": "...", "target": "...", "kegiatan": { "nutrisi": [], "stimulasi": [], "medis": "" } } ]
           }`;

        const result = await model.generateContent(promptText);
        let text = result.response.text().replace(/```json|```/g, '').trim();
        const jsonResult = JSON.parse(text);
        
        const mapImg = (arr) => arr ? arr.map(item => ({ ...item, image: IMAGE_MAP[item.kategori] || IMAGE_MAP['default'] })) : [];
        if (jsonResult.preventif) jsonResult.preventif = mapImg(jsonResult.preventif);
        if (jsonResult.represif) jsonResult.represif = mapImg(jsonResult.represif);

        res.json({ reply: JSON.stringify(jsonResult) });
    } catch (error) {
        res.status(500).json({ reply: JSON.stringify({ analisis: "Gagal analisis AI.", preventif: [], represif: [] }) });
    }
});

app.post('/api/chat-bot', async (req, res) => {
    const { childData, question } = req.body;
    try {
        const prompt = `
        Bertindaklah sebagai 'SiGemar Bot', asisten kesehatan anak posyandu yang ramah.
        DATA ANAK: ${childData.nama}, Umur ${childData.umur} bln, Status ${childData.status}.
        PERTANYAAN: "${question}"
        Jawab singkat, padat, ramah.
        `;
        const result = await modelText.generateContent(prompt);
        res.json({ reply: result.response.text() });
    } catch (e) { res.status(500).json({ reply: "Maaf error." }); }
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

export default app;