import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose'; // <--- PENGGANTI FS
import dotenv from 'dotenv';
// [SDK LATEST] Menggunakan library resmi Google Generative AI
import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

// Load variabel dari file .env (untuk keamanan)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. KONFIGURASI DAN KONEKSI DATABASE
// ==========================================

// Ambil dari Environment Variables (Biar aman pas deploy)
// Jika di local tidak ada .env, dia pakai nilai default (String sebelah kanan || )
const MONGO_URI = process.env.MONGO_URI || "MASUKKAN_CONNECTION_STRING_MONGODB_ANDA_DISINI";
const GEN_AI_KEY = process.env.GEN_AI_KEY || "AIzaSyD9C9tLiHo5ItMwvZtibTXowSgLT3DODMs"; 
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "CLIENT_ID_GOOGLE_ANDA";
const EMAIL_USER = process.env.EMAIL_USER || "sigemar.official@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS || "APP_PASSWORD_EMAIL_ANDA";

// KONEKSI KE MONGODB ATLAS
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Berhasil Konek ke MongoDB Atlas"))
  .catch(err => console.error("❌ Gagal Konek MongoDB:", err));

// ==========================================
// 2. MEMBUAT SKEMA DATA (PENGGANTI DATABASE.JSON)
// ==========================================

// Schema User (Sesuai database.json Anda)
const userSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() }, // Pakai angka biar Frontend React tidak error
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

// Schema Data Pasien / IoT (Sesuai database.json Anda)
const iotDataSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() },
    idRegistrasi: String,
    // Data Orang Tua
    statusAyah: String, namaAyah: String, nikAyah: String,
    statusIbu: String, namaIbu: String, nikIbu: String,
    // Data Anak
    nama: String, nik: String, tglLahir: String, jk: String,
    alamat: String, posyandu: String,
    // Data Medis
    berat: Number, tinggi: Number, lk: Number, umur: Number,
    waktuSubmit: String, jam: String,
    statusRegistrasi: { type: String, default: 'Baru' },
    medisNotes: String,
    status: String, // Normal, Stunting, dll
    analysis: Object // Menyimpan hasil { berat: {}, tinggi: {} }
}, { timestamps: true }); // Otomatis catat created_at

// Schema Artikel
const articleSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() },
    title: String,
    content: String,
    image: String,
    date: String
});

// Membuat Model (Tabel)
const User = mongoose.model('User', userSchema);
const IoTData = mongoose.model('IoTData', iotDataSchema);
const Article = mongoose.model('Article', articleSchema);

// ==========================================
// 3. INISIALISASI AI & EMAIL
// ==========================================

const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

// Model AI
const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json" }
});
const modelText = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Email Transporter
const mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Database Gambar Statis (Tetap di kode karena kecil)
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

// ==========================================
// 4. LOGIC PERHITUNGAN GIZI (CORE SYSTEM)
// ==========================================
// (Bagian ini TIDAK BERUBAH dari kode asli Anda)

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
// 5. API ROUTES (SUDAH DIUBAH KE MONGODB)
// ==========================================

// --- AUTH: LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Mongoose: Cari satu user
        const user = await User.findOne({ username });
        
        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Login Gagal" });
        }
        res.json({ message: "Login Sukses", user: { 
            username: user.username, role: user.role, nik: user.nik, fullName: user.fullName 
        }});
    } catch (err) { res.status(500).json({ message: "Error Server" }); }
});

// --- AUTH: REGISTER ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role, nik, fullName, email, phone, dob } = req.body;
        
        // Cek duplikat
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(400).json({ message: "Username atau Email sudah dipakai" });

        // Simpan User Baru
        const newUser = new User({ username, password, role, nik, fullName, email, phone, dob });
        await newUser.save();
        
        res.json({ message: "Registrasi Berhasil" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- AUTH: GOOGLE ---
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const { email, name, picture } = googleResponse.data;

        // Cek User di DB
        const user = await User.findOne({ email });

        if (user) {
            res.json({ status: 'success', message: "Login Berhasil", user });
        } else {
            res.json({ 
                status: 'register_needed', 
                message: "Silakan lengkapi NIK",
                googleData: { 
                    email, fullName: name, username: email.split('@')[0], avatar: picture 
                }
            });
        }
    } catch (error) { res.status(401).json({ message: "Token Google Invalid" }); }
});

// --- AUTH: FORGOT PASSWORD (OTP) ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Email tidak terdaftar" });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otpCode; 
        user.otpExpires = Date.now() + 300000; // 5 Menit
        await user.save();

        const mailOptions = {
            from: `"SiGemar Admin" <${EMAIL_USER}>`,
            to: email,
            subject: 'KODE OTP RESET PASSWORD',
            html: `<h3>Kode OTP Anda: ${otpCode}</h3><p>Jangan berikan ke siapa-siapa.</p>`
        };
        await mailTransporter.sendMail(mailOptions);
        res.json({ message: "OTP Terkirim ke Email" });
    } catch (err) { res.status(500).json({ message: "Gagal kirim email" }); }
});

// --- IOT DATA: GET ALL ---
app.get('/api/iot-data', async (req, res) => {
    try {
        // Ambil semua data, urutkan dari yang terbaru (descending)
        const data = await IoTData.find().sort({ createdAt: -1 });
        res.json(data);
    } catch (err) { res.json([]); }
});

// --- IOT DATA: ADD NEW ---
app.post('/api/iot-data', async (req, res) => {
    try {
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

// --- IOT DATA: UPDATE ---
app.put('/api/iot-data/:id', async (req, res) => {
    try {
        // Cari data lama dulu untuk merge logic
        const oldData = await IoTData.findOne({ id: req.params.id });
        if (!oldData) return res.status(404).json({ message: "Data tak ditemukan" });

        const mergedBody = { ...oldData.toObject(), ...req.body };
        const processedData = processFullDiagnosis(mergedBody);
        
        // Update berdasarkan custom 'id' (bukan _id mongo)
        await IoTData.findOneAndUpdate({ id: req.params.id }, processedData);
        res.json({ message: "Data Berhasil Diupdate" });
    } catch (err) { res.status(500).json({ message: "Gagal Update" }); }
});

// --- IOT DATA: DELETE ---
app.delete('/api/iot-data/:id', async (req, res) => {
    try {
        await IoTData.findOneAndDelete({ id: req.params.id });
        res.json({ message: "Data Berhasil Dihapus" });
    } catch (err) { res.status(500).json({ message: "Gagal Hapus" }); }
});

// --- ARTIKEL: GET & POST & DELETE ---
app.get('/api/articles', async (req, res) => {
    const articles = await Article.find().sort({ id: -1 });
    res.json(articles);
});

app.post('/api/articles', async (req, res) => {
    try {
        const { title, content, image } = req.body;
        const newArticle = new Article({
            title, content,
            image: image || 'https://via.placeholder.com/400x200',
            date: new Date().toISOString().split('T')[0]
        });
        await newArticle.save();
        res.json({ message: "Artikel Diposting", data: newArticle });
    } catch (err) { res.status(500).json({ message: "Gagal Posting" }); }
});

app.delete('/api/articles/:id', async (req, res) => {
    await Article.findOneAndDelete({ id: req.params.id });
    res.json({ message: "Artikel Dihapus" });
});

// --- USER PROFILE UPDATE ---
app.put('/api/profile', async (req, res) => {
    try {
        const { username, ...updateData } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { username }, 
            { $set: updateData }, 
            { new: true } // Return data baru setelah update
        );
        if (!updatedUser) return res.status(404).json({ message: "User not found" });
        res.json({ message: "Profil Diupdate", user: updatedUser });
    } catch (err) { res.status(500).json({ message: "Gagal Update Profile" }); }
});

// --- FITUR AI: ANALISIS MEDIS (TETAP SAMA) ---
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

// --- FITUR AI: CHATBOT ORANG TUA ---
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

// --- FITUR AI: GENERATE ARTICLE ---
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

// Jika dijalankan di laptop (node server.js), dia listen PORT 3000
// Jika di Vercel, dia export 'app' biar Vercel yang urus
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`🚀 Server running locally on port ${PORT}`));
}

export default app;