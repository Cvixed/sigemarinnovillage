import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from 'nodemailer';
import axios from 'axios';

// Load variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG ---
const MONGO_URI = process.env.MONGO_URI;
const GEN_AI_KEY = process.env.GEN_AI_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// 1. STRATEGI KONEKSI DB (ANTI-CRASH VERCEL)
// ==========================================
let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;
    try {
        if (!MONGO_URI) throw new Error("MONGO_URI tidak ditemukan di Environment Variables!");
        await mongoose.connect(MONGO_URI, {
            bufferCommands: false, // Penting buat Serverless agar tidak buffering request
        });
        isConnected = true;
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Error:", err.message);
    }
};

// Middleware: Pastikan DB Konek sebelum memproses request apapun
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// ==========================================
// 2. SCHEMA DEFINITION (DENGAN PENGECEKAN MODEL)
// ==========================================
// PENTING: Pakai 'mongoose.models.Nama || ...' agar tidak error saat Vercel restart

const userSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'ortu' },
    displayName: String,
    nik: String,
    fullName: String,
    email: String,
    phone: String,
    dob: String,
    bio: String,
    avatar: String,
    otp: String,
    otpExpires: Date
});

const iotDataSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() },
    idRegistrasi: String,
    statusAyah: String, namaAyah: String, nikAyah: String, hpAyah: String,
    statusIbu: String, namaIbu: String, nikIbu: String, hpIbu: String,
    nama: String, nikAnak: String, gender: String, 
    tempatLahir: String, tglLahir: String, umur: Number,
    namaPanggilan: String, golDarah: String, agama: String,
    alamat: String, rt: String, rw: String,
    provinsi: String, kota: String, kecamatan: String, kelurahan: String, dusun: String,
    kodePos: String, email: String, pendapatan: String, sumberInfo: String, catatan: String,
    berat: Number, tinggi: Number, lk: Number,
    waktuSubmit: String, jam: String,
    statusRegistrasi: { type: String, default: 'Baru' },
    medisNotes: Object,
    status: String,
    analysis: Object,
    latitude: Number, longitude: Number
}, { timestamps: true });

const articleSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() },
    title: String,
    content: String,
    image: String,
    date: String
});

// Fix: Cek dulu apakah model sudah ada
const User = mongoose.models.User || mongoose.model('User', userSchema);
const IoTData = mongoose.models.IoTData || mongoose.model('IoTData', iotDataSchema);
const Article = mongoose.models.Article || mongoose.model('Article', articleSchema);

// ==========================================
// 3. LOGIC & AI SETUP
// ==========================================

// AI Setup (Safe Init)
let model, modelText;
try {
    if(GEN_AI_KEY) {
        const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" }});
        modelText = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    }
} catch (e) { console.log("AI Config Error:", e); }

// Email Transporter
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

// --- LOGIC PERHITUNGAN GIZI (DIKEMBALIKAN UTUH) ---
const getStdWHO = (umur, type) => {
    const u = parseInt(umur) || 0;
    if (type === 'berat') return 3.2 + (u * 0.5);
    if (type === 'tinggi') return u <= 12 ? 50 + (u * 2.0) : 74 + ((u - 12) * 1.0);
    if (type === 'lk') return u <= 6 ? 34 + (u * 1.5) : 43 + ((u - 6) * 0.5);
    return 0;
};

const analyzeMetric = (val, umur, type) => {
    if (val === null || val === undefined || val === '' || val == 0) {
        return { value: null, label: 'BELUM ADA DATA', rangeMin: 0, rangeMax: 0 };
    }
    const value = parseFloat(val);
    const std = getStdWHO(umur, type);
    let minPct = 0.85, maxPct = 1.15;
    if (type === 'tinggi') minPct = 0.90; 
    if (type === 'berat') { minPct = 0.80; maxPct = 1.20; }
    if (type === 'lk') { minPct = 0.90; maxPct = 1.10; }

    const min = parseFloat((std * minPct).toFixed(1));
    const max = parseFloat((std * maxPct).toFixed(1));

    let label = 'NORMAL';
    if (value < min) {
        if (type === 'tinggi') label = 'PENDEK';
        if (type === 'berat') label = 'KURANG';
        if (type === 'lk') label = 'KECIL';
    } else if (value > max) {
        if (type === 'tinggi') label = 'TINGGI';
        if (type === 'berat') label = 'LEBIH';
        if (type === 'lk') label = 'BESAR';
    }
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
    const isStunting = dBerat.label === 'KURANG' || dTinggi.label === 'PENDEK' || dLk.label === 'KECIL';

    if (isStunting) {
        mainStatus = "Stunting";
        if (dBerat.label === 'KURANG') sideStatuses.push("Gizi Kurang");
        if (dTinggi.label === 'PENDEK') sideStatuses.push("Pendek");
        if (dLk.label === 'KECIL') sideStatuses.push("Microcephaly");
    } else if (dBerat.label === 'LEBIH') {
        mainStatus = "Overweight";
    }
    if (dLk.label === 'BESAR') sideStatuses.push("Macrocephaly");
    if (dTinggi.label === 'TINGGI') sideStatuses.push("Tinggi Lebih");

    let finalStatusString = "";
    if (mainStatus === "Normal" && sideStatuses.length > 0) {
        finalStatusString = sideStatuses.join(" & ");
    } else if (sideStatuses.length > 0) {
        finalStatusString = `${mainStatus} & ${sideStatuses.join(' & ')}`;
    } else {
        finalStatusString = mainStatus;
    }
    if (!berat && !tinggi) finalStatusString = "Menunggu Data";

    return {
        ...body,
        berat, tinggi, lk,
        status: finalStatusString,
        analysis: {
            berat: { ...dBerat, status: dBerat.label },
            tinggi: { ...dTinggi, status: dTinggi.label },
            lk: { ...dLk, status: dLk.label }
        }
    };
};

// ==========================================
// 4. API ROUTES
// ==========================================

// Check Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', db: isConnected ? 'Connected' : 'Connecting...' });
});

// --- AUTH ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || user.password !== password) return res.status(401).json({ message: "Login Gagal" });
        res.json({ message: "Login Sukses", user: { username: user.username, role: user.role, nik: user.nik, fullName: user.fullName }});
    } catch (err) { res.status(500).json({ message: "Error Server" }); }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, email } = req.body;
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(400).json({ message: "Username/Email sudah dipakai" });
        
        const newUser = new User(req.body);
        await newUser.save();
        res.json({ message: "Registrasi Berhasil" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const { email, name, picture } = googleResponse.data;
        const user = await User.findOne({ email });

        if (user) {
            res.json({ status: 'success', message: "Login Berhasil", user });
        } else {
            res.json({ 
                status: 'register_needed', 
                message: "Silakan lengkapi NIK",
                googleData: { email, fullName: name, username: email.split('@')[0], avatar: picture }
            });
        }
    } catch (error) { res.status(401).json({ message: "Token Google Invalid" }); }
});

// --- FORGOT PASSWORD ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Email tidak terdaftar" });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otpCode; 
        user.otpExpires = Date.now() + 300000; 
        await user.save();

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

// --- IOT DATA ---
app.get('/api/iot-data', async (req, res) => {
    try { const data = await IoTData.find().sort({ createdAt: -1 }); res.json(data); } 
    catch (err) { res.json([]); }
});

app.post('/api/iot-data', async (req, res) => {
    try {
        // PENTING: Logic perhitungan WHO dipanggil di sini!
        const processedData = processFullDiagnosis(req.body);
        const newData = new IoTData({
            ...processedData,
            idRegistrasi: `REG-${Date.now()}`, 
            waktuSubmit: new Date().toLocaleString('id-ID'), 
            jam: new Date().toLocaleTimeString('id-ID'), 
        });
        await newData.save();
        res.status(201).json({ message: "Data Tersimpan", data: newData });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/iot-data/:id', async (req, res) => {
    try {
        const oldData = await IoTData.findOne({ id: req.params.id });
        if (!oldData) return res.status(404).json({ message: "Data tak ditemukan" });

        const mergedBody = { ...oldData.toObject(), ...req.body };
        // PENTING: Logic perhitungan WHO dipanggil lagi saat update!
        const processedData = processFullDiagnosis(mergedBody);
        
        await IoTData.findOneAndUpdate({ id: req.params.id }, processedData);
        res.json({ message: "Data Berhasil Diupdate" });
    } catch (err) { res.status(500).json({ message: "Gagal Update" }); }
});

app.delete('/api/iot-data/:id', async (req, res) => {
    try { await IoTData.findOneAndDelete({ id: req.params.id }); res.json({ message: "Hapus Sukses" }); } 
    catch (err) { res.status(500).json({ message: "Gagal Hapus" }); }
});

// --- ARTICLES ---
app.get('/api/articles', async (req, res) => {
    const articles = await Article.find().sort({ id: -1 });
    res.json(articles);
});

app.post('/api/articles', async (req, res) => {
    try {
        const newArticle = new Article({ ...req.body, date: new Date().toISOString().split('T')[0] });
        await newArticle.save();
        res.json({ message: "Artikel Diposting", data: newArticle });
    } catch (err) { res.status(500).json({ message: "Gagal Posting" }); }
});

app.delete('/api/articles/:id', async (req, res) => {
    await Article.findOneAndDelete({ id: req.params.id });
    res.json({ message: "Artikel Dihapus" });
});

app.put('/api/profile', async (req, res) => {
    try {
        const { username, ...updateData } = req.body;
        const updatedUser = await User.findOneAndUpdate({ username }, { $set: updateData }, { new: true });
        if (!updatedUser) return res.status(404).json({ message: "User not found" });
        res.json({ message: "Profil Diupdate", user: updatedUser });
    } catch (err) { res.status(500).json({ message: "Gagal Update Profile" }); }
});

// --- AI FEATURES (LOGIC DIKEMBALIKAN UTUH) ---
app.post('/api/consult-ai', async (req, res) => {
    const { childData, nakesNotes } = req.body;
    try {
        // Hitung ulang status untuk prompt
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
        
        // Mapping Gambar Icon
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
// 6. EXPORT UNTUK VERCEL (PENTING!)
// ==========================================

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Server running locally on port ${PORT}`));
}

export default app;