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
        analysis: { berat: dBerat, tinggi: dTinggi, lk: dLk }
    };
};

// ==========================================
// 3. API ROUTES (SQL VERSION)
// ==========================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', db: 'Vercel Postgres (Ready)' });
});

// AUTH LOGIN
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

// AUTH REGISTER
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

// GOOGLE AUTH
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

// IOT DATA (GET)
app.get('/api/iot-data', async (req, res) => {
    try {
        // Ambil JSONB dan kembalikan sebagai object biasa
        const { rows } = await sql`SELECT data_full FROM iot_data ORDER BY created_at DESC`;
        // Map rows agar formatnya kembali seperti array of objects
        const data = rows.map(row => row.data_full);
        res.json(data);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// IOT DATA (POST)
app.post('/api/iot-data', async (req, res) => {
    try {
        const processed = processFullDiagnosis(req.body);
        const finalData = { 
            ...processed, 
            id: Date.now(), // Generate ID manual untuk FE
            idRegistrasi: `REG-${Date.now()}`,
            waktuSubmit: new Date().toLocaleString('id-ID')
        };
        
        // Simpan sebagai JSONB
        await sql`
            INSERT INTO iot_data (id_registrasi, nama_anak, data_full)
            VALUES (${finalData.idRegistrasi}, ${finalData.nama}, ${finalData})
        `;
        
        res.status(201).json({ message: "Data Tersimpan", data: finalData });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE
app.delete('/api/iot-data/:id', async (req, res) => {
    try {
        const idToDelete = parseInt(req.params.id);
        await sql`DELETE FROM iot_data WHERE (data_full->>'id')::numeric = ${idToDelete}`;
        res.json({ message: "Hapus Sukses" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ARTICLES (GET)
app.get('/api/articles', async (req, res) => {
    try {
        const { rows } = await sql`SELECT * FROM articles ORDER BY id DESC`;
        res.json(rows);
    } catch (err) { res.json([]); } 
});

// ==========================================
// 4. EXPORT UNTUK VERCEL (PENTING!)
// ==========================================
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Server running locally on port ${PORT}`));
}

export default app;