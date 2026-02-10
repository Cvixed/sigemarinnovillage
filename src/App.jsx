import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import {
  Activity, Users, AlertTriangle, Scale, ArrowLeft, Save, RefreshCw, Plus, X, User,
  Download, LogOut, ChevronRight, Eye, EyeOff, Search, ChevronLeft, CheckCircle, XCircle, Info, Edit, Baby, Stethoscope, FileText, Trash, Sparkles, Send, MessageSquare, Clock, Shield, ShieldAlert, Heart, ArrowRight, ChevronDown, MapPin, FilePlus, Menu, Home, Newspaper, Filter, Cake, Utensils, ShieldCheck, Calendar, Mail, Lock, Phone
} from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';

// Jika Development (Local), tembak ke port 3000. Jika Production (Vercel), pakai '/api' relative.
const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

// --- GOOGLE CLIENT ID (DARI .ENV) ---
// Mengambil nilai dari file .env
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// --- KONFIGURASI ICON MARKER ---
const iconStunting = new L.DivIcon({
    className: 'bg-transparent border-none',
    html: `<div class="relative flex items-center justify-center w-10 h-10"><span class="absolute w-full h-full bg-red-500 rounded-full opacity-30 animate-ping"></span><span class="relative w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-lg"></span></div>`,
    iconSize: [40, 40], iconAnchor: [20, 35], popupAnchor: [0, -35]
});
const iconNormal = new L.DivIcon({
    className: 'bg-transparent border-none',
    html: `<div class="relative flex items-center justify-center w-8 h-8"><span class="absolute w-full h-full bg-blue-400 rounded-full opacity-20 animate-pulse"></span><span class="relative w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md"></span></div>`,
    iconSize: [32, 32], iconAnchor: [16, 28], popupAnchor: [0, -28]
});

// --- HELPER UI ---
const hitungUmurDetail = (tanggalLahir) => {
    if (!tanggalLahir) return { tahun: 0, bulan: 0, hari: 0, bulanTotal: 0, text: "0 tahun 0 bulan 0 hari" };
    const lahir = new Date(tanggalLahir);
    const sekarang = new Date();
    
    let tahun = sekarang.getFullYear() - lahir.getFullYear();
    let bulan = sekarang.getMonth() - lahir.getMonth();
    let hari = sekarang.getDate() - lahir.getDate();

    if (hari < 0) {
        bulan--;
        const bulanLalu = new Date(sekarang.getFullYear(), sekarang.getMonth(), 0).getDate();
        hari += bulanLalu;
    }
    if (bulan < 0) {
        tahun--;
        bulan += 12;
    }

    const bulanTotal = (tahun * 12) + bulan;
    return { tahun, bulan, hari, bulanTotal, text: `${tahun} tahun ${bulan} bulan ${hari} hari` };
};

const getRoleColor = (role) => {
    switch(role) { case 'superadmin': return 'text-orange-600 bg-orange-100'; case 'kades': return 'text-blue-900 bg-blue-100'; case 'nakes': return 'text-emerald-600 bg-emerald-100'; case 'ortu': return 'text-blue-600 bg-blue-50'; default: return 'text-gray-600 bg-gray-100'; }
};
const getRoleLabel = (role) => { switch(role) { case 'superadmin': return 'Super Admin'; case 'kades': return 'Kepala Desa'; case 'nakes': return 'Tenaga Medis'; case 'ortu': return 'Orang Tua'; default: return 'User'; } };

const downloadExcel = (data) => {
  if (!data || data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, "Data_SiGemar.xlsx");
};

// --- FUNGSI MAPPING VISUAL FRONTEND (LOGIC DI BACKEND, STYLE DI SINI) ---
const getMetricUI = (analysisData) => {
    if (!analysisData || analysisData.label === 'BELUM ADA DATA' || analysisData.value === null) {
        return { label: 'Menunggu', color: 'bg-gray-100 text-gray-400 border-gray-200', icon: '-', rangeText: '-' };
    }

    const { status, rangeMin, rangeMax } = analysisData; // status dari backend (label)
    const rangeText = `${rangeMin} - ${rangeMax}`;

    switch (status) {
        // KASUS KURANG (MERAH)
        case 'PENDEK': return { label: 'STUNTING', color: 'bg-red-50 text-red-700 border-red-200 font-bold', icon: '↓', rangeText };
        case 'KURANG': return { label: 'GIZI KURANG', color: 'bg-red-50 text-red-700 border-red-200 font-bold', icon: '↓', rangeText };
        case 'KECIL': return { label: 'MICROCEPHALY', color: 'bg-red-50 text-red-700 border-red-200 font-bold', icon: '↓', rangeText };
        
        // KASUS LEBIH (ORANGE/BIRU)
        case 'LEBIH': return { label: 'OVERWEIGHT', color: 'bg-orange-50 text-orange-700 border-orange-200 font-bold', icon: '↑', rangeText };
        case 'BESAR': return { label: 'MACROCEPHALY', color: 'bg-pink-50 text-pink-700 border-pink-200 font-bold', icon: '↑', rangeText };
        case 'TINGGI': return { label: 'TINGGI LEBIH', color: 'bg-blue-50 text-blue-700 border-blue-200 font-bold', icon: '↑', rangeText };
            
        case 'NORMAL':
        default: return { label: 'NORMAL', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold', icon: '✓', rangeText };
    }
};

// --- UI COMPONENTS ---
const InputField = ({ label, name, value, onChange, type="text", placeholder, className, disabled, ...props }) => (
    <div className="flex flex-col gap-2 mb-4 w-full relative">
        {label && <label className="text-xs text-blue-900 font-bold uppercase tracking-wider ml-1">{label}</label>}
        <input className={`w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : ''} ${className}`} name={name} value={value || ''} onChange={onChange} type={type} placeholder={placeholder} disabled={disabled} {...props} />
    </div>
);
const SelectField = ({ label, name, value, onChange, children, disabled }) => (
    <div className="flex flex-col gap-2 mb-4 w-full">
        {label && <label className="text-xs text-blue-900 font-bold uppercase tracking-wider ml-1">{label}</label>}
        <select className={`w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : ''}`} name={name} value={value || ''} onChange={onChange} disabled={disabled}>{children}</select>
    </div>
);
const TextAreaField = ({ label, name, value, onChange, placeholder }) => (
    <div className="flex flex-col gap-2 mb-4 w-full">
        {label && <label className="text-xs text-blue-900 font-bold uppercase tracking-wider ml-1">{label}</label>}
        <textarea className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all min-h-[120px] shadow-sm" name={name} value={value || ''} onChange={onChange} placeholder={placeholder} />
    </div>
);

const SearchableSelect = ({ label, name, value, onChange, options, disabled }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (value && options) {
            const selected = options.find(opt => String(opt.id) === String(value));
            if (selected) setSearchTerm(selected.name);
        } else if (!value) {
            setSearchTerm('');
        }
    }, [value, options]);

    const filteredOptions = options ? options.filter(opt => 
        opt?.name && opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const handleSelect = (opt) => {
        onChange({ target: { name, value: opt.id } });
        setSearchTerm(opt.name);
        setIsOpen(false);
    };

    return (
        <div className="flex flex-col gap-2 mb-4 w-full relative" ref={wrapperRef}>
            {label && <label className="text-xs text-blue-900 font-bold uppercase tracking-wider ml-1">{label}</label>}
            <div className="relative">
                <input className={`w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : ''}`} placeholder={disabled ? "Pilih..." : `Cari ${label}...`} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }} onFocus={() => !disabled && setIsOpen(true)} disabled={disabled} />
                {isOpen && !disabled && filteredOptions.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredOptions.map(opt => (
                            <div key={opt.id} onClick={() => handleSelect(opt)} className="px-4 py-3 hover:bg-orange-50 cursor-pointer text-sm text-gray-700 border-b border-gray-50 last:border-none">{opt.name}</div>
                        ))}
                    </div>
                )}
                {isOpen && !disabled && filteredOptions.length === 0 && (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-xl p-4 text-center text-gray-500 text-sm">Tidak ditemukan</div>
                )}
            </div>
        </div>
    );
};

// ... (SearchableSelect, Toast, StatusBadge Components tetap sama, tidak berubah visualnya) ...
// SAYA PERSINGKAT UNTUK MEMFOKUSKAN KE PERUBAHAN LOGIKA

const Toast = ({ show, message, type, onClose }) => {
  if (!show) return null;
  const bgColor = type === 'success' ? 'bg-emerald-500' : (type === 'error' ? 'bg-red-500' : 'bg-blue-500');
  return <div className={`fixed top-5 right-5 z-[10000] ${bgColor} text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium`}>{message} <button onClick={onClose}><X size={16}/></button></div>;
};

// --- KAMUS DEFINISI MEDIS (Pastikan ini ada sebelum StatusBadge) ---
const STATUS_DEFINITIONS = {
    'Normal': 'Pertumbuhan anak optimal sesuai standar WHO. Pertahankan pola makan bergizi seimbang.',
    'Stunting': 'Tinggi badan lebih pendek dari standar usianya (TB/U). Menandakan kekurangan gizi kronis jangka panjang.',
    'Gizi Buruk': 'Berat badan sangat rendah dibandingkan tinggi badan. Kondisi kritis yang butuh penanganan medis.',
    'Gizi Kurang': 'Berat badan kurang proporsional dengan tinggi badan (BB/TB). Anak tampak kurus, rentan penyakit.',
    'Overweight': 'Berat badan berlebih dibandingkan tinggi badan. Berisiko obesitas dan gangguan metabolisme.',
    'Microcephaly': 'Lingkar kepala lebih kecil dari standar. Mengindikasikan potensi gangguan perkembangan otak.',
    'Macrocephaly': 'Lingkar kepala lebih besar dari standar. Memerlukan pemeriksaan lanjut (cairan otak, dll).',
    'Tinggi Lebih': 'Tinggi badan anak berada di atas rata-rata standar usianya (Jangkung).',
    'Menunggu Data': 'Data pengukuran belum lengkap.'
};

// --- STATUS BADGE INTERAKTIF (FIXED) ---
const StatusBadge = ({ status }) => {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const wrapperRef = useRef(null);

  // 1. Handle Click Outside (Untuk menutup tooltip saat klik di luar)
  useEffect(() => {
      function handleClickOutside(event) {
          if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
              setActiveTooltip(null);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!status) return <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200">N/A</span>;

  // Split status jika ada kombinasi (Misal: "Normal & Macrocephaly")
  const conditions = status.split(' & ');

  // 2. Helper Style Warna (Sama seperti sebelumnya)
  // Cari fungsi getBadgeStyle di dalam komponen StatusBadge dan ganti dengan ini:

const getBadgeStyle = (cond) => {
    const c = cond.toUpperCase();
    if (c === 'NORMAL') return 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200';
    if (c.includes('STUNTING') || c.includes('PENDEK')) return 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200';
    if (c.includes('KURANG') || c.includes('BURUK')) return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200';
    
    // PINDAHKAN PENGECEKAN TINGGI KE SINI (Sebelum pengecekan "LEBIH")
    if (c.includes('TINGGI')) return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200';
    
    // Baru kemudian cek Overweight/Lebih
    if (c.includes('OVERWEIGHT') || c.includes('LEBIH')) return 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200';
    
    if (c.includes('MICRO') || c.includes('MIKRO') || c.includes('MACRO') || c.includes('MAKRO')) return 'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200';
    
    return 'bg-gray-100 text-gray-600 border-gray-200';
};

  // 3. Helper Penjelasan (Mapping status backend ke kamus definisi)
  const getDescription = (cond) => {
      const c = cond.toUpperCase();
      if (c.includes('STUNTING')) return STATUS_DEFINITIONS['Stunting'];
      if (c.includes('GIZI KURANG') || c.includes('KURANG')) return STATUS_DEFINITIONS['Gizi Kurang'];
      if (c.includes('OVERWEIGHT') || c.includes('LEBIH')) return STATUS_DEFINITIONS['Overweight'];
      if (c.includes('MICRO') || c.includes('MIKRO')) return STATUS_DEFINITIONS['Microcephaly'];
      if (c.includes('MACRO') || c.includes('MAKRO')) return STATUS_DEFINITIONS['Macrocephaly'];
      if (c.includes('TINGGI')) return STATUS_DEFINITIONS['Tinggi Lebih'];
      if (c === 'NORMAL') return STATUS_DEFINITIONS['Normal'];
      return 'Status kesehatan perlu pemantauan berkala.';
  };

  return (
    <div className="flex flex-wrap gap-1.5 justify-center" ref={wrapperRef}>
      {conditions.map((cond, index) => (
        <div key={index} className="relative">
            <button 
                onClick={(e) => {
                    e.stopPropagation(); // Mencegah klik tembus ke baris tabel
                    setActiveTooltip(activeTooltip === index ? null : index);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border shadow-sm whitespace-nowrap cursor-help transition-transform active:scale-95 flex items-center gap-1 ${getBadgeStyle(cond)}`}
            >
              {cond}
              {/* Icon Info Kecil */}
              <Info size={10} className="opacity-60"/>
            </button>

            {/* --- TOOLTIP CARD --- */}
            {activeTooltip === index && (
                <div className="absolute z-50 bottom-full mb-2 -right-4 w-64 p-4 bg-slate-800 text-white text-xs rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-700">
                    <div className="flex justify-between items-start mb-2 border-b border-slate-600 pb-2">
                        <span className="font-bold text-orange-400 uppercase tracking-wider text-[10px]">{cond}</span>
                        <button onClick={(e) => { e.stopPropagation(); setActiveTooltip(null); }} className="hover:bg-slate-700 rounded p-0.5"><X size={12} className="text-gray-400 hover:text-white"/></button>
                    </div>
                    <p className="leading-relaxed font-medium text-slate-300 text-left">
                        {getDescription(cond)}
                    </p>
                    {/* Segitiga Panah Bawah */}
                    <div className="absolute top-full right-8 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </div>
      ))}
    </div>
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-blue-900/20 flex items-center justify-center z-[10000] backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl animate-in zoom-in">
        <h3 className="text-lg font-bold text-blue-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-blue-900 text-sm font-bold bg-gray-100 hover:bg-gray-200 rounded-lg transition">Batal</button>
          <button onClick={onConfirm} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md transition">Ya, Lanjutkan</button>
        </div>
      </div>
    </div>
  );
};

    // --- SIDEBAR (FIXED: MOBILE DRAWER & DESKTOP COLLAPSE) ---
const Sidebar = ({ userRole, activePage, setActivePage, onLogout, setRegisterMode, currentUser, isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen }) => {
    const menuGroups = [
        { title: "Menu Utama", items: [ { id: 'dashboard', label: 'Dashboard Utama', icon: <Home size={20}/>, roles: ['superadmin', 'nakes', 'kades'] } ] },
        { title: "Menu Orang Tua", items: [
            { id: 'ortu-info', label: 'Info Anak', icon: <Baby size={20}/>, roles: ['ortu'] },
            { id: 'ortu-medis', label: 'Rekam Medis', icon: <FileText size={20}/>, roles: ['ortu'] },
            { id: 'ortu-chat', label: 'AI Asisten', icon: <Sparkles size={20}/>, roles: ['ortu'] }
        ] },
        { title: "Data Pasien", items: [ 
            { id: 'view-all', label: 'Semua Data Pasien', icon: <Users size={20}/>, roles: ['superadmin', 'nakes', 'kades'] }, 
            { id: 'view-normal', label: 'Pasien Normal', icon: <CheckCircle size={20}/>, roles: ['superadmin', 'nakes', 'kades'] }, 
            { id: 'view-overweight', label: 'Pasien Overweight', icon: <Activity size={20}/>, roles: ['superadmin', 'nakes', 'kades'] }, 
            { id: 'view-stunting', label: 'Pasien Stunting', icon: <AlertTriangle size={20}/>, roles: ['superadmin', 'nakes', 'kades'] },
            { id: 'view-abnormal', label: 'Pasien Abnormal', icon: <ShieldAlert size={20}/>, roles: ['superadmin', 'nakes', 'kades'] } 
        ] },
        // Di dalam komponen Sidebar, menuGroups:
{ 
    title: "Operasional", 
    items: [ 
        { id: 'user-approval', label: 'Persetujuan User', icon: <ShieldCheck size={20}/>, roles: ['superadmin'] }, // TAMBAHKAN INI
        { id: 'articles', label: 'Manajemen Berita', icon: <Newspaper size={20}/>, roles: ['superadmin'] },
        { id: 'register-new', label: 'Registrasi User', icon: <Plus size={20}/>, roles: ['superadmin'], action: true } 
    ] 
}
    ];

    const handleMenuClick = (item) => { 
        if (item.action) { setRegisterMode(true); setActivePage('registration'); } 
        else { setRegisterMode(false); setActivePage(item.id); } 
        
        // PENTING: Tutup sidebar otomatis saat menu diklik di tampilan Mobile
        if (setIsMobileOpen) setIsMobileOpen(false);
    };

    return (
        <>
            {/* OVERLAY HITAM (Hanya muncul di Mobile saat Sidebar terbuka) */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            <aside 
                onMouseEnter={() => setIsExpanded(true)} 
                onMouseLeave={() => setIsExpanded(false)} 
                className={`
                    bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-[70] shadow-2xl 
                    transition-all duration-300 ease-in-out border-r border-slate-800
                    /* LOGIKA POSISI: */
                    ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'} /* Mobile: Slide In/Out */
                    md:translate-x-0 ${isExpanded ? 'md:w-72' : 'md:w-20'} /* Desktop: Selalu tampil, lebar berubah */
                `}
            >
                {/* Header Sidebar */}
                <div className={`h-20 flex items-center px-6 border-b border-slate-800 shrink-0 transition-all duration-300 ${isExpanded || isMobileOpen ? 'justify-between' : 'justify-center'}`}>
                    <div className="flex items-center gap-3">
                        <img src="SiGemar.png" className="h-24 w-auto object-contain" alt="Logo" />
                        <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isExpanded || isMobileOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                            <h1 className="font-black text-xl tracking-tight leading-none">
                                <span className="text-orange-500">User</span> Panel
                            </h1>
                            </div>
                        </div>

                    {/* TOMBOL SILANG (X) - Hanya Muncul di Mobile */}
                    <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1">
                        <X size={24} />
                    </button>
                </div>

                {/* Navigasi Menu */}
                <nav className="flex-1 py-6 px-3 overflow-y-auto custom-scrollbar overflow-x-hidden">
                    {menuGroups.map((group, groupIndex) => { 
                        const visibleItems = group.items.filter(item => item.roles.includes(userRole)); 
                        if (visibleItems.length === 0) return null; 
                        return ( 
                            <div key={groupIndex} className="mb-6">
                                {/* Judul Group */}
                                <div className={`transition-all duration-300 overflow-hidden ${isExpanded || isMobileOpen ? 'h-auto opacity-100 mb-2' : 'h-0 opacity-0'}`}>
                                    <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{group.title}</p>
                                </div>
                                
                                {/* Divider Putih saat collapsed (Desktop Only) */}
                                {!isExpanded && !isMobileOpen && groupIndex > 0 && (
                                    <div className="flex justify-center mb-4 mt-2"><div className="h-1 w-8 bg-white rounded-full opacity-20"></div></div>
                                )}

                                <div className="space-y-1">
                                    {visibleItems.map((item) => ( 
                                        <button key={item.id} onClick={() => handleMenuClick(item)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative ${activePage === item.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-300 hover:bg-slate-800 hover:text-white'} ${isExpanded || isMobileOpen ? '' : 'justify-center'}`}>
                                            <div className="shrink-0">{item.icon}</div>
                                            <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isExpanded || isMobileOpen ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>{item.label}</span>
                                        </button> 
                                    ))}
                                </div>
                            </div> 
                        ); 
                    })}
                </nav>
                
                {/* Footer Profile */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 mt-auto shrink-0 space-y-3">
                    <div onClick={() => setActivePage('profile')} className={`flex items-center gap-3 px-2 cursor-pointer hover:bg-slate-800 p-2 rounded-xl transition group ${isExpanded || isMobileOpen ? '' : 'justify-center'}`}>
                         <div className="w-10 h-10 rounded-full bg-blue-600 shrink-0 flex items-center justify-center font-bold text-sm text-white overflow-hidden border-2 border-transparent group-hover:border-orange-500 transition">
                            {currentUser?.avatar ? <img src={currentUser.avatar} alt="Av" className="w-full h-full object-cover"/> : currentUser?.username?.substring(0,2).toUpperCase() || 'U'}
                         </div>
                         <div className={`overflow-hidden transition-all duration-300 ${isExpanded || isMobileOpen ? 'w-auto opacity-100 ml-2' : 'w-0 opacity-0'}`}>
                            <p className="text-sm font-bold text-white truncate capitalize group-hover:text-orange-400 transition">{currentUser?.displayName || currentUser?.username || 'User'}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> {getRoleLabel(userRole)}</p>
                         </div>
                    </div>
                    <button onClick={onLogout} className={`w-full bg-red-500/10 hover:bg-red-600 hover:text-white text-red-500 border border-red-500/20 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${isExpanded || isMobileOpen ? 'justify-start px-4' : 'justify-center px-0'}`}>
                        <LogOut size={20}/> <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isExpanded || isMobileOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>Keluar</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

// --- ARTICLE DETAIL MODAL (NEW) ---
const ArticleDetailModal = ({ article, onClose }) => {
    if (!article) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                
                {/* Header: Gambar Cover */}
                <div className="relative h-64 bg-gray-100 shrink-0">
                    {article.image ? (
                        <img src={article.image} className="w-full h-full object-cover" alt="Cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Newspaper size={48} />
                        </div>
                    )}
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content: Scrollable */}
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
                        {article.date || 'Berita Terkini'}
                    </span>
                    
                    <h2 className="text-3xl font-black text-blue-900 mb-6 leading-tight">
                        {article.title}
                    </h2>

                    {/* Render Text dengan whitespace-pre-line agar paragraf terbaca */}
                    <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed whitespace-pre-line">
                        {article.content}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-blue-900 text-white font-bold rounded-xl hover:bg-blue-800 transition">
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- ARTICLE MANAGER (STABLE: TEXTAREA + AI + AUTO COMPRESS) ---
const ArticleManager = ({ onBack, notify }) => {
    const [articles, setArticles] = useState([]);
    const [newArticle, setNewArticle] = useState({ title: '', content: '', image: '' });
    const [isGenerating, setIsGenerating] = useState(false);
    const [viewArticle, setViewArticle] = useState(null);
    const fileInputRef = useRef(null);

    const fetchArticles = async () => { try { const res = await fetch(`${API_URL}/articles`); if(res.ok) setArticles(await res.json()); } catch {} };
    useEffect(() => { fetchArticles(); }, []);

    // --- AI GENERATOR ---
    const handleGenerateAI = async () => {
        if (!newArticle.title || newArticle.title.length < 3) return notify("Isi topik dulu!", "error");
        setIsGenerating(true);
        try {
            const res = await fetch(`${API_URL}/generate-article`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ topic: newArticle.title })
            });
            const data = await res.json();
            if (res.ok) {
                setNewArticle(prev => ({ ...prev, title: data.title, content: data.content }));
                notify("Artikel berhasil dibuat!", "success");
            }
        } catch (e) { notify("Gagal koneksi AI", "error"); } 
        finally { setIsGenerating(false); }
    };

    // --- AUTO IMAGE COMPRESSOR (Logic Baru) ---
    const compressImage = (file, callback) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Resize lebar maks 800px
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Kompres kualitas jadi 70% JPEG
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                // Cek ukuran (Base64 length kira-kira 1.37x ukuran file asli)
                // Jika masih > 100KB, turunkan kualitas lagi
                if (dataUrl.length > 137000) { 
                     // Rekompresi ekstrim jika masih besar
                     const extremeUrl = canvas.toDataURL('image/jpeg', 0.5);
                     callback(extremeUrl);
                } else {
                     callback(dataUrl);
                }
            };
        };
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            notify("Mengompres gambar...", "info");
            compressImage(file, (compressedResult) => {
                setNewArticle(prev => ({ ...prev, image: compressedResult }));
                notify("Gambar berhasil dikompres!", "success");
            });
        }
    };

    const handlePost = async () => {
        if(!newArticle.title || !newArticle.content) return notify("Lengkapi data!", "error");
        try {
            const res = await fetch(`${API_URL}/articles`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(newArticle) });
            if(res.ok) { notify("Terbit!", "success"); setNewArticle({title:'', content:'', image:''}); fetchArticles(); }
        } catch { notify("Gagal", "error"); }
    };

    const handleDelete = async (id) => {
        if(!window.confirm("Hapus?")) return;
        try { await fetch(`${API_URL}/articles/${id}`, { method: 'DELETE' }); fetchArticles(); } catch {}
    };

    return (
        <div className="w-full h-full flex flex-col animate-in fade-in">
            <ArticleDetailModal article={viewArticle} onClose={() => setViewArticle(null)} />
            
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black text-blue-900 flex items-center gap-3"><Newspaper className="text-orange-500"/> Editor Berita</h2>
                <button onClick={onBack} className="bg-white border px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50">Kembali</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div>
                        <label className="text-xs font-bold text-blue-900 uppercase ml-1">Topik / Judul</label>
                        <div className="flex gap-2 mt-1">
                            <input className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none" value={newArticle.title} onChange={e=>setNewArticle({...newArticle, title:e.target.value})} placeholder="Topik..." />
                            <button onClick={handleGenerateAI} disabled={isGenerating} className="bg-purple-100 text-purple-700 px-4 rounded-xl font-bold flex items-center hover:bg-purple-200 disabled:opacity-50">
                                {isGenerating ? <RefreshCw className="animate-spin"/> : <Sparkles/>}
                            </button>
                        </div>
                    </div>

                    <div onClick={() => fileInputRef.current.click()} className="border-2 border-dashed rounded-xl h-32 flex items-center justify-center cursor-pointer hover:border-orange-400 relative overflow-hidden">
                        {newArticle.image ? <img src={newArticle.image} className="w-full h-full object-cover"/> : <span className="text-xs text-gray-400 flex flex-col items-center"><FilePlus size={20} className="mb-1"/> Upload Cover (Max 100KB Auto-Compress)</span>}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                    <div>
                        <label className="text-xs font-bold text-blue-900 uppercase ml-1">Isi Artikel</label>
                        <textarea 
                            className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none h-64 leading-relaxed" 
                            value={newArticle.content} 
                            onChange={e=>setNewArticle({...newArticle, content:e.target.value})} 
                            placeholder="Isi artikel..."
                        />
                    </div>

                    <button onClick={handlePost} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition flex justify-center gap-2"><Send size={18}/> Terbitkan</button>
                </div>

                <div className="lg:col-span-2 space-y-4 h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {articles.map(art => (
                        <div key={art.id} onClick={() => setViewArticle(art)} className="bg-white p-4 rounded-xl border flex gap-4 hover:shadow-md transition relative group cursor-pointer">
                            <div className="w-32 h-24 bg-gray-100 rounded-lg shrink-0 overflow-hidden">
                                {art.image && <img src={art.image} className="w-full h-full object-cover"/>}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-blue-900 text-lg line-clamp-1 group-hover:text-orange-500 transition">{art.title}</h4>
                                <p className="text-xs text-gray-400 mb-2">{art.date}</p>
                                <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-line leading-relaxed">{art.content}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(art.id); }} className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-2 hover:bg-red-50 rounded-lg" title="Hapus Artikel"><Trash size={18}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- LANDING PAGE ---
const LandingPage = ({ onNavigateToLogin }) => {
    const [articles, setArticles] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/articles`).then(r=>r.json()).then(setArticles).catch(()=>{});

        const handleScroll = () => {
            if (window.scrollY > 50) setIsScrolled(true);
            else setIsScrolled(false);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans relative overflow-x-hidden flex flex-col">

            <ArticleDetailModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />

<nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out px-8 py-4 w-full ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-md py-3' : 'bg-transparent py-5'}`}>
    
    <div className="w-full flex justify-between items-center relative">
        
        {/* KIRI: Logo Aplikasi (SiGemar) */}
        <div className="flex items-center gap-3 z-20 relative shrink-0">
            <img src="/SiGemar.png" className="h-12 w-auto object-contain" alt="Logo"/>
            <span className={`text-2xl font-black tracking-tight ${isScrolled ? 'text-blue-900' : 'text-blue-900'} transition-colors`}>
                <span className="text-orange-500">Si</span>Gemar
            </span>
        </div>

        {/* TENGAH: Menu Link (Posisi Absolut di Tengah Layar) */}
        <div className={`hidden md:flex gap-8 text-sm font-bold transition-colors absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 ${isScrolled ? 'text-gray-600' : 'text-gray-700'}`}>
            <button onClick={() => scrollToSection('beranda')} className="hover:text-orange-500 transition">Beranda</button>
            <button onClick={() => scrollToSection('tentang')} className="hover:text-orange-500 transition">Tentang Kami</button>
            <button onClick={() => scrollToSection('berita')} className="hover:text-orange-500 transition">Berita & Artikel</button>
        </div>

        {/* KANAN: Hanya Tombol Login (Logo dihapus) */}
        <div className="flex items-center gap-4 z-20 relative shrink-0">
            <button onClick={onNavigateToLogin} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 hover:scale-105 active:scale-95">
                Masuk Dashboard <ArrowRight size={16}/>
            </button>
        </div>

    </div>
</nav>

            <section id="beranda" className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 scroll-mt-20">
                <div className="absolute inset-0 z-0"><img src="https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?q=80&w=2525&auto=format&fit=crop" alt="Bg" className="w-full h-full object-cover"/><div className="absolute inset-0 bg-gradient-to-b from-orange-50/90 via-white/80 to-gray-50"></div></div>
                <div className="relative z-10 max-w-5xl mx-auto mt-10">
                    <span className="text-emerald-600 font-bold tracking-wider text-sm mb-6 uppercase border border-emerald-200 bg-emerald-50 px-4 py-1.5 rounded-full shadow-sm inline-block">Sistem Informasi Gizi & Kesehatan</span>
                    <h1 className="text-5xl md:text-7xl font-black leading-tight mb-8 text-blue-900 drop-shadow-sm">Menjaga <span className="text-orange-500">Generasi Emas</span>,<br/> Mencegah Stunting.</h1>
                    <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">SiGemar adalah solusi terpadu berbasis AI untuk memantau tumbuh kembang anak secara real-time.</p>
                    <div className="flex flex-col md:flex-row gap-5 justify-center">
                        <button onClick={onNavigateToLogin} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-10 py-4 rounded-full text-lg font-bold shadow-xl shadow-orange-500/30 transition-all transform hover:scale-105 flex items-center justify-center gap-2"><Activity size={20}/> Cek Status Gizi</button>
                    </div>
                </div>
                <div onClick={() => scrollToSection('tentang')} className="absolute bottom-10 left-0 right-0 text-center animate-bounce text-orange-300 z-10 cursor-pointer"><ChevronDown size={32} className="mx-auto"/></div>
            </section>

            <section id="tentang" className="py-24 bg-white relative scroll-mt-10">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="relative">
                        <div className="absolute -top-4 -left-4 w-24 h-24 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
                        <img src="fotobalita.jpg" className="rounded-3xl shadow-2xl relative z-10 w-full h-[400px] object-cover" alt="Tentang"/>
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-blue-900 mb-6">Kenapa Harus <span className="text-orange-500">SiGemar?</span></h2>
                        <p className="text-gray-600 text-lg leading-relaxed mb-6">Kami percaya bahwa setiap anak berhak mendapatkan masa depan yang cerah. SiGemar hadir untuk membantu orang tua dan tenaga medis dalam memantau gizi anak secara akurat, cepat, dan mudah.</p>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><Shield className="text-emerald-500 mb-2" size={32}/><h4 className="font-bold text-blue-900">Data Aman</h4><p className="text-sm text-gray-500">Enkripsi data tingkat tinggi.</p></div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><Sparkles className="text-orange-500 mb-2" size={32}/><h4 className="font-bold text-blue-900">Analisis AI</h4><p className="text-sm text-gray-500">Rekomendasi medis otomatis.</p></div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="berita" className="py-24 bg-gray-50 scroll-mt-10">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-blue-900 mb-4">Berita & <span className="text-emerald-500">Artikel Terkini</span></h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">Informasi terbaru seputar kesehatan anak, tips parenting, dan kegiatan posyandu.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {articles.length === 0 ? (
                            <p className="col-span-3 text-center text-gray-400">Belum ada berita yang diposting.</p>
                        ) : (
                            articles.map((art) => (
                                <div 
                                    key={art.id} 
                                    onClick={() => setSelectedArticle(art)} 
                                    className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer border border-gray-100 relative"
                                >
                                    <div className="h-48 overflow-hidden">
                                        <img src={art.image} alt={art.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                                    </div>
                                    <div className="p-6">
                                        <p className="text-xs font-bold text-orange-500 mb-2 uppercase tracking-wide">{art.date}</p>
                                        <h3 className="text-xl font-bold text-blue-900 mb-3 group-hover:text-orange-500 transition line-clamp-2">{art.title}</h3>
                                        <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed mb-4">{art.content}</p>
                                        <span className="text-emerald-600 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                                            Baca Selengkapnya <ArrowRight size={14}/>
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <section className="py-10 bg-white-900">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <p className="text-xs font-bold text-navy-200 uppercase tracking-[0.2em] mb-8 opacity-80">
                        Supported By :
                    </p>
                    
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
                        {/* 1. Innovillage */}
                        <img 
                            src="/innologo.png" 
                            alt="Innovillage" 
                            className="h-8 md:h-8 w-auto object-contain hover:scale-110 transition-transform duration-300 drop-shadow-md brightness-110 contrast-125"
                        />

                        {/* 2. Danantara */}
                        <img 
                            src="/danantara.png" 
                            alt="Danantara" 
                            className="h-16 md:h-16 w-auto object-contain hover:scale-110 transition-transform duration-300" 
                        />

                        {/* 3. Telkom Indonesia */}
                        <img 
                            src="/telkom.png" 
                            alt="Telkom Indonesia" 
                            className="h-12 md:h-12 w-auto object-contain hover:scale-110 transition-transform duration-300 drop-shadow-md rounded px-2"
                        />

                        {/* 4. Telkom University */}
                        <img 
                            src="/telu.png" 
                            alt="Telkom University" 
                            className="h-14 md:h-14 w-auto object-contain hover:scale-110 transition-transform duration-300 drop-shadow-md rounded px-2 py-1"
                        />

                        {/* 5. Temanggung */}
                        <img 
                            src="/temanggung.png" 
                            alt="Kabupaten Temanggung" 
                            className="h-12 md:h-14 w-auto object-contain hover:scale-110 transition-transform duration-300 drop-shadow-md"
                        />
                    </div>
                </div>
            </section>

            {/* --- ORIGINAL FOOTER (TETAP ADA DI PALING BAWAH) --- */}
            <footer className="bg-slate-900 text-white py-12 text-center border-t border-slate-800">
                <div className="max-w-4xl mx-auto px-6">
                    <h2 className="text-3xl font-black mb-4"><span className="text-orange-500">Si</span>Gemar</h2>
                    <p className="text-slate-300 mb-8 font-medium">Bersama membangun generasi Indonesia yang sehat, cerdas, dan bebas stunting.</p>
                    <p className="text-xs text-slate-500">&copy; 2026 SiGemar System. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

// --- DATA OBSERVASI KLINIS (WAJIB ADA UNTUK FITUR AI) ---
const SYMPTOM_CATS = {
    "Masalah Makan & Gizi": [
        "Tidak nafsu makan (GTM)", "Melepeh makanan", "Hanya mau minum susu", 
        "Berat badan sulit naik", "Sering muntah saat makan", "Alergi susu/makanan",
        "Terlalu banyak jajan manis", "Kesulitan mengunyah"
    ],
    "Kondisi Fisik": [
        "Badan tampak kurus kering", "Wajah pucat & lesu", "Rambut jagung/rontok", 
        "Perut buncit (cacingan)", "Sering diare/mencret", "Batuk pilek berulang", 
        "Demam naik turun", "Gigi berlubang/rusak", "Kaki bengkak", "Mata cekung"
    ],
    "Tumbuh Kembang": [
        "Belum bisa jalan", "Terlambat bicara", "Anak diam/kurang respon", 
        "Terlalu aktif/tidak fokus", "Lingkar kepala tidak nambah", "Ubun-ubun belum menutup",
        "Gangguan pendengaran/penglihatan"
    ],
    "Lingkungan & Pengasuhan": [
        "Sanitasi rumah buruk", "Ada perokok di rumah", "Air bersih sulit", 
        "Diasuh orang lain (bukan ortu)", "Ekonomi kurang mampu", "Kurang paham gizi",
        "Ibu bekerja/jarang di rumah"
    ]
};

// --- KOMPONEN METRIK PASIEN (LOGIC UPDATED: READ ONLY FROM BACKEND) ---
const PatientMetrics = ({ data }) => {
    if (!data) return null;
    
    // Ambil object 'analysis' dari backend, kalau belum ada pakai default kosong
    const analysis = data.analysis || { berat: null, tinggi: null, lk: null };

    const MetricItem = ({ label, analysisItem, unit }) => {
        // Panggil helper UI untuk dapatkan warna & label tampilan
        const ui = getMetricUI(analysisItem);
        const val = analysisItem?.value ?? '-';

        return (
            <div className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 shadow-sm text-center ${ui.color.replace('text-','border-').replace('font-bold', '')} bg-opacity-10 bg-white`}>
                <span className="text-[10px] uppercase font-extrabold tracking-widest opacity-60 mb-2">{label}</span>
                <div className="flex items-baseline gap-1 mb-2">
                    <span className={`text-4xl font-black tracking-tighter`}>{val}</span>
                    <span className="text-sm font-bold opacity-60">{unit}</span>
                </div>
                <div className="w-full border-t border-black/5 pt-2 mt-1">
                    <div className={`text-sm font-bold flex items-center justify-center gap-1 ${ui.color}`}>
                        {ui.label} {ui.icon}
                    </div>
                    <span className="text-[9px] font-semibold opacity-60 bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">
                        Normal: {ui.rangeText}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-row gap-4 w-full mt-2 mb-2">
            <MetricItem label="Berat Badan" analysisItem={analysis.berat} unit="kg" />
            <MetricItem label="Tinggi Badan" analysisItem={analysis.tinggi} unit="cm" />
            <MetricItem label="Lingkar Kepala" analysisItem={analysis.lk} unit="cm" />
        </div>
    );
};

const AIStuntingCompanion = ({ childData, notify, onRefresh }) => {
    const [searchQuery, setSearchTerm] = useState('');
    const [selectedObservations, setSelectedObservations] = useState([]);
    const [aiResult, setAiResult] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setAiResult(null);
        setSelectedObservations([]);
        setSearchTerm('');
    }, [childData]);

    const handleSelectObservation = (category, label) => {
        if (!selectedObservations.find(i => i.label === label)) {
            setSelectedObservations([...selectedObservations, { id: Date.now() + Math.random(), category, label }]);
        }
        setSearchTerm('');
    };

    const handleRemoveObservation = (id) => {
        setSelectedObservations(selectedObservations.filter(i => i.id !== id));
    };

    // --- HELPER ICON ---
    const getCategoryIcon = (category) => {
        const cat = (category || '').toLowerCase();
        if (cat.includes('nutrisi') || cat.includes('makan') || cat.includes('gizi')) return <Utensils size={20} className="text-emerald-500"/>;
        if (cat.includes('stimulasi') || cat.includes('main') || cat.includes('asah')) return <Baby size={20} className="text-blue-500"/>;
        if (cat.includes('medis') || cat.includes('dokter') || cat.includes('obat')) return <Stethoscope size={20} className="text-red-500"/>;
        if (cat.includes('tidur') || cat.includes('istirahat')) return <Clock size={20} className="text-purple-500"/>;
        if (cat.includes('sanitasi') || cat.includes('bersih')) return <ShieldCheck size={20} className="text-cyan-500"/>;
        return <Sparkles size={20} className="text-orange-500"/>; // Default
    };

    // --- 1. PROMPT ENGINEERING ---
    const generatePrompt = (child, symptoms) => {
        return `
        Bertindaklah sebagai Dokter Spesialis Anak Konsultan Tumbuh Kembang.
        Profil Pasien: ${child.nama}, Umur ${child.umur} bulan, Status Gizi: ${child.status}.
        Gejala Klinis: ${symptoms.map(s => s.label).join(', ')}.
        
        Berikan analisis mendalam dan rencana intervensi dalam format JSON:
        {
            "analisis": "Penjelasan medis komprehensif tentang kondisi anak...",
            "faktor_risiko": ["Risiko 1", "Risiko 2", "Risiko 3"],
            "roadmap": [
                { "fase": "Bulan 1-3", "target": "...", "kegiatan": { "nutrisi": [], "stimulasi": [], "medis": "..." } },
                { "fase": "Bulan 4-6", ... },
                { "fase": "Bulan 7-12", ... }
            ]
        }
        `;
    };

    // --- 2. REAL API CALL (DENGAN AUTO-MAPPING & NORMALIZATION) ---
    const fetchAIAnalysis = async (prompt) => {
        try {
            // Mengirim request dengan data lengkap
            
            const response = await fetch(`${API_URL}/consult-ai`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    childData: childData,
                    nakesNotes: selectedObservations.map(s => s.label).join(', '),
                    mode: 'analysis' 
                }),
            });

            if (!response.ok) throw new Error("Gagal respon AI");

            const rawData = await response.json();
            let aiData = rawData.result || rawData.reply || rawData; 

            // 1. Parsing JSON String jika perlu
            if (typeof aiData === 'string') {
                const cleanJson = aiData.replace(/```json|```/g, '').trim();
                aiData = JSON.parse(cleanJson);
            }

            // 2. NORMALISASI DATA (Agar tidak pernah kosong)
            const finalData = {
                // Mapping Analisis (Indo/Inggris)
                analisis: aiData.analisis || aiData.analysis || aiData.pain_points || "Tidak ada analisis.",
                
                // Mapping Faktor Risiko (Array)
                faktor_risiko: aiData.faktor_risiko || aiData.risk_factors || aiData.riskFactors || [],
                
                // Mapping Preventif & Represif
                preventif: aiData.preventif || aiData.preventive || [],
                represif: aiData.represif || aiData.repressive || aiData.curative || [],
                
                // Mapping Roadmap (Timeline -> Roadmap)
                roadmap: (aiData.roadmap || aiData.timeline || []).map(item => ({
                    fase: item.fase || item.phase || "Fase",
                    target: item.target || "Target",
                    // Pastikan struktur kegiatan lengkap agar tidak crash
                    kegiatan: {
                        nutrisi: item.kegiatan?.nutrisi || item.activities?.nutrition || [],
                        stimulasi: item.kegiatan?.stimulasi || item.activities?.stimulation || [],
                        medis: item.kegiatan?.medis || item.activities?.medical || "-"
                    }
                }))
            };
            
            return finalData; 

        } catch (error) {
            console.error("AI Error:", error);
            throw error; 
        }
    };

    const handleConsultation = async () => {
        if (selectedObservations.length === 0 || !childData) return notify("Pilih minimal satu observasi klinis.", "error");
        setLoading(true); 
        setAiResult(null);
        
        try {
            // 1. Generate Prompt
            const prompt = generatePrompt(childData, selectedObservations);
            
            // 2. Call AI (Simulated)
            const result = await fetchAIAnalysis(prompt);
            
            // 3. Set Result
            setAiResult(result);
        } catch (err) { 
            notify("Gagal melakukan analisis AI.", "error"); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleSaveToRecord = async () => {
        if(!aiResult) return;
        try {
            const res = await fetch(`${API_URL}/iot-data/${childData.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medisNotes: aiResult }) });
            if (res.ok) { notify("Tersimpan ke Rekam Medis Anak", "success"); onRefresh(); }
        } catch(e) { notify("Gagal menyimpan.", "error"); }
    };

    const getStatusColor = (s) => {
        const str = String(s || '');
        if(str.includes('Stunting')) return 'bg-rose-500';
        if(str === 'Normal') return 'bg-emerald-500';
        return 'bg-orange-500';
    };

    if (!childData) return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 min-h-[500px]">
            <div className="bg-white p-4 rounded-full shadow-sm mb-4"><Sparkles size={32} className="text-emerald-400"/></div>
            <p className="text-center font-bold text-blue-900 text-lg">AI Medical Assistant</p>
            <p className="text-center text-sm">Pilih pasien di tabel samping untuk memulai analisis.</p>
        </div>
    );

    return (
        <div className="flex flex-col h-[850px] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg transition-all">
            {/* Header */}
            <div className={`p-4 flex justify-between items-center text-white shrink-0 ${getStatusColor(childData.status)}`}>
                <div>
                    <h2 className="font-bold flex items-center gap-2 text-lg"><Sparkles className="text-yellow-300" size={20}/> MedGemma Expert</h2>
                    <div className="flex gap-2 text-xs font-medium mt-1 opacity-90"><span>{childData.nama}</span><span>•</span><span>{childData.umur} Bln</span></div>
                </div>
                <div className="text-right"><span className="text-xs bg-white/20 px-2 py-1 rounded font-bold">{childData.status}</span></div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                <div className="p-5">
                    
                    {/* 1. METRIK PASIEN (Selalu muncul di atas) */}
                    <div className="mb-6">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">Data Pengukuran Terakhir</p>
                        <PatientMetrics data={childData} />
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* 2. AREA DINAMIS: INPUT GEJALA ATAU HASIL AI */}
                    {aiResult ? (
                        <div className="animate-in fade-in space-y-6">
                            
                            {/* A. PAIN POINTS */}
                            <div className="bg-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="text-yellow-300" size={20}/>
                                    <h3 className="font-bold text-lg">Analisis Dokter AI</h3>
                                </div>
                                <p className="text-sm leading-relaxed font-medium opacity-95">
                                    {aiResult.analisis}
                                </p>
                            </div>

                            {/* B. ACTION PLAN (Preventif & Represif) - NEW SECTION */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Preventif (Hijau) */}
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                    <h4 className="font-bold text-emerald-800 text-sm uppercase mb-3 flex items-center gap-2">
                                        <Shield size={16}/> Tindakan Preventif/pencegahan
                                    </h4>
                                    <ul className="space-y-2">
                                        {aiResult.preventif && aiResult.preventif.map((item, i) => (
                                            <li key={i} className="flex gap-3 text-xs text-gray-700 bg-white p-3 rounded-lg border border-emerald-100 shadow-sm items-start">
                                                <div className="shrink-0 mt-0.5 bg-gray-50 p-1.5 rounded-full">
                                                    {/* GANTI IMG DENGAN ICON HELPER */}
                                                    {getCategoryIcon(item.kategori)}
                                                </div>
                                                <span className="leading-relaxed font-medium">{item.teks}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Represif (Oranye) */}
                                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                                    <h4 className="font-bold text-orange-800 text-sm uppercase mb-3 flex items-center gap-2">
                                        <ShieldAlert size={16}/> Tindakan Kuratif/perbaikan
                                    </h4>
                                    <ul className="space-y-2">
                                        {aiResult.represif && aiResult.represif.map((item, i) => (
                                            <li key={i} className="flex gap-3 text-xs text-gray-700 bg-white p-3 rounded-lg border border-orange-100 shadow-sm items-start">
                                                <div className="shrink-0 mt-0.5 bg-gray-50 p-1.5 rounded-full">
                                                    {getCategoryIcon(item.kategori)}
                                                </div>
                                                <span className="leading-relaxed font-medium">{item.teks}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* B. FAKTOR RISIKO (NEW SECTION) */}
                            <div className="bg-orange-50 border border-orange-100 rounded-xl p-5">
                                <h4 className="font-bold text-orange-800 text-sm uppercase mb-3 flex items-center gap-2">
                                    <ShieldAlert size={16}/> Faktor Risiko Utama
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {aiResult.faktor_risiko && aiResult.faktor_risiko.map((item, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></div>
                                            <p className="text-xs text-gray-700 font-medium leading-snug">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* C. TIMELINE 12 BULAN (NEW FEATURE) */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <h4 className="font-black text-blue-900 text-sm uppercase mb-6 flex items-center gap-2">
                                    <Clock size={18} className="text-purple-500"/> Roadmap 12 Bulan ke Depan
                                </h4>
                                
                                <div className="relative border-l-2 border-purple-100 ml-3 space-y-8 pb-2">
                                    {aiResult.roadmap && aiResult.roadmap.map((item, idx) => (
                                        <div key={idx} className="relative pl-8">
                                            {/* Dot Indikator */}
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white bg-purple-500 shadow-md"></div>
                                            
                                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                                <div className="mb-4">
                                                    <h5 className="font-bold text-blue-900 text-sm mb-2">{item.fase}</h5>
                                                    <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                                        <Activity size={14}/> Target: {item.target}
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-4">
                                                    <div>
                                                        <h6 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Utensils size={12}/> Nutrisi</h6>
                                                        <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                                                            {item.kegiatan.nutrisi.map((n, i) => <li key={i}>{n}</li>)}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <h6 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Baby size={12}/> Stimulasi</h6>
                                                        <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                                                            {item.kegiatan.stimulasi.map((s, i) => <li key={i}>{s}</li>)}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <h6 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Stethoscope size={12}/> Medis</h6>
                                                        <p className="text-xs text-gray-600">{item.kegiatan.medis}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* D. ACTION BUTTONS */}
                            <div className="flex gap-2 pt-4 border-t border-gray-100">
                                <button onClick={()=>setAiResult(null)} className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition">Analisis Ulang</button>
                                <button onClick={handleSaveToRecord} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition shadow-lg shadow-emerald-200 flex justify-center items-center gap-2"><Save size={18}/> Simpan Rekam Medis</button>
                            </div>
                        </div>
                    ) : (
                        // TAMPILAN AWAL (INPUT GEJALA)
                        <div className="animate-in fade-in">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Observasi Klinis</p>
                            
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                <input className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" placeholder="Cari gejala (cth: demam, makan, diare)..." value={searchQuery} onChange={(e)=>setSearchTerm(e.target.value)}/>
                            </div>

                            <div className="h-64 overflow-y-auto custom-scrollbar border border-gray-100 rounded-xl mb-4 p-4 bg-white">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><RefreshCw className="animate-spin text-emerald-500" size={24}/><span className="text-xs font-medium">Sedang Menganalisis...</span></div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(SYMPTOM_CATS).map(([category, items]) => {
                                            const filteredItems = items.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()));
                                            if (filteredItems.length === 0) return null;

                                            return (
                                                <div key={category}>
                                                    <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider mb-3 border-b border-gray-100 pb-1">{category}</h4>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {filteredItems.map((item, idx) => {
                                                            const isSelected = selectedObservations.find(i => i.label === item);
                                                            return (
                                                                <button 
                                                                    key={idx} 
                                                                    onClick={() => handleSelectObservation(category, item)}
                                                                    disabled={isSelected}
                                                                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex justify-between items-center group border ${isSelected ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-orange-300 hover:bg-white'}`}
                                                                >
                                                                    <span className="line-clamp-2">{item}</span>
                                                                    {isSelected ? <CheckCircle size={12} className="shrink-0 ml-1"/> : <Plus size={12} className="shrink-0 ml-1 text-gray-300 group-hover:text-orange-500"/>}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">OBSERVASI TERPILIH ({selectedObservations.length})</p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {selectedObservations.length === 0 && <span className="text-xs text-gray-400 italic">Belum ada observasi dipilih.</span>}
                                    {selectedObservations.map((item) => (<span key={item.id} className="bg-white border border-emerald-200 text-emerald-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">{item.label}<button onClick={() => handleRemoveObservation(item.id)} className="hover:text-red-500 ml-1"><X size={12}/></button></span>))}
                                </div>
                                <button onClick={handleConsultation} disabled={selectedObservations.length === 0 || loading} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Stethoscope size={18}/> Analisis Kondisi Anak</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- PARENT DASHBOARD (FULL SCREEN, DETAIL INFO, DISCLAIMER, SIDEBAR NAV) ---
const ParentDashboard = ({ logs, currentUser, activePage }) => {
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);

    const myChild = useMemo(() => {
        // Cari anak berdasarkan NIK user yang login (cocokkan dengan nikAyah atau nikIbu)
        return logs.find(l => l.nikAyah === currentUser.nik || l.nikIbu === currentUser.nik);
    }, [logs, currentUser]);

    // --- LOGIC CHATBOT (TETAP SAMA) ---
    const handleChat = async () => {
        if(!chatInput.trim() || !myChild) return;
        const userMsg = { sender: 'user', text: chatInput };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput(''); setChatLoading(true);
        try {
            const res = await fetch(`${API_URL}/chat-bot`, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ childData: myChild, question: userMsg.text }) 
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
        } catch(e) { setChatHistory(prev => [...prev, { sender: 'ai', text: "Maaf Bunda, koneksi sedang gangguan." }]); }
        finally { setChatLoading(false); }
    };

    // --- HELPER RENDER LIST (TETAP SAMA - ANTI WHITE SCREEN) ---
    const renderMedicalList = (items, colorClass) => {
        if (!items) return <li className="text-gray-400 italic">Tidak ada data</li>;
        if (typeof items === 'string') return <li>{items}</li>;
        if (Array.isArray(items)) {
            return items.map((item, i) => {
                const isObj = typeof item === 'object' && item !== null;
                const text = isObj ? item.teks : item;
                const img = isObj ? item.image : null; 
                return (
                    <li key={i} className="leading-snug flex gap-3 items-start p-2 rounded-lg bg-white/50 border border-transparent hover:border-gray-200 transition">
                        {img && <img src={img} alt="icon" className="w-6 h-6 object-contain opacity-80"/>}
                        <span className={colorClass}>{text}</span>
                    </li>
                );
            });
        }
        return null;
    };

    if (!myChild) return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-2xl border border-gray-200 max-w-md shadow-xl">
                <Baby size={64} className="mx-auto text-orange-300 mb-4"/>
                <h3 className="text-xl font-bold text-blue-900 mb-2">Data Anak Tidak Ditemukan</h3>
                <p className="text-gray-600 text-sm">Tidak ada data anak yang terhubung dengan NIK Anda: <b className="text-orange-500">{currentUser.nik}</b>.</p>
                <p className="text-xs text-gray-500 mt-4 border-t border-gray-200 pt-4">Mohon hubungi Nakes/Admin Desa untuk verifikasi NIK.</p>
            </div>
        </div>
    );

    // --- TAMPILAN 1: INFO LENGKAP ANAK & ORTU (DETAIL VIEW) ---
    if (activePage === 'ortu-info' || activePage === 'dashboard') { // Default view
        return (
            <div className="w-full h-full p-2 space-y-6 animate-in fade-in">
                {/* Header Banner */}
                <div className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl shadow-lg p-6 md:p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mt-10 -mr-10"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black mb-2">{myChild.nama || myChild.namaAnak}</h1>
                            <div className="flex flex-wrap gap-3 text-sm font-medium text-blue-50">
                                <span className="bg-white/20 px-3 py-1 rounded-full">{myChild.umur} Bulan</span>
                                <span className="bg-white/20 px-3 py-1 rounded-full">{myChild.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                                <span className="bg-white/20 px-3 py-1 rounded-full flex items-center gap-1"><MapPin size={14}/> {myChild.dusun || myChild.kelurahan}</span>
                            </div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl">
                            <StatusBadge status={myChild.status} />
                        </div>
                    </div>
                </div>

                {/* Grid Statistik Utama */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Scale size={24}/></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">Berat Badan</p><p className="text-2xl font-black text-blue-900">{myChild.berat || '-'} <span className="text-sm font-bold text-gray-400">kg</span></p></div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><ArrowRight size={24} className="-rotate-90"/></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">Tinggi Badan</p><p className="text-2xl font-black text-blue-900">{myChild.tinggi || '-'} <span className="text-sm font-bold text-gray-400">cm</span></p></div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-full"><User size={24}/></div>
                        <div><p className="text-xs text-gray-500 font-bold uppercase">Lingkar Kepala</p><p className="text-2xl font-black text-blue-900">{myChild.lk || '-'} <span className="text-sm font-bold text-gray-400">cm</span></p></div>
                    </div>
                </div>

                {/* Detail Data (Grid Layout) */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Kolom Kiri: Identitas Anak & Alamat */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-blue-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2"><Baby size={18} className="text-orange-500"/> Identitas Lengkap Anak</h3>
                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-3"><span className="text-gray-500">NIK Anak</span><span className="col-span-2 font-medium">{myChild.nikAnak || '-'}</span></div>
                                <div className="grid grid-cols-3"><span className="text-gray-500">TTL</span><span className="col-span-2 font-medium">{myChild.tempatLahir}, {myChild.tglLahir}</span></div>
                                <div className="grid grid-cols-3"><span className="text-gray-500">Gol. Darah</span><span className="col-span-2 font-medium">{myChild.golDarah || '-'}</span></div>
                                <div className="grid grid-cols-3"><span className="text-gray-500">Agama</span><span className="col-span-2 font-medium">{myChild.agama || '-'}</span></div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-blue-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2"><MapPin size={18} className="text-emerald-500"/> Alamat Domisili</h3>
                            <p className="text-gray-700 font-medium mb-2">{myChild.alamat}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                <div><span className="block text-xs text-gray-500">RT / RW</span><span className="font-bold">{myChild.rt} / {myChild.rw}</span></div>
                                <div><span className="block text-xs text-gray-500">Dusun</span><span className="font-bold">{myChild.dusun || '-'}</span></div>
                                <div><span className="block text-xs text-gray-500">Kelurahan</span><span className="font-bold">{myChild.kelurahan}</span></div>
                                <div><span className="block text-xs text-gray-500">Kecamatan</span><span className="font-bold">{myChild.kecamatan}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Kolom Kanan: Data Orang Tua */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
                        <h3 className="font-bold text-blue-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2"><Users size={18} className="text-purple-500"/> Data Orang Tua / Wali</h3>
                        
                        {/* Data Ayah */}
                        <div className="bg-blue-50/50 p-4 rounded-xl mb-4 border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-800 uppercase mb-3 flex items-center gap-2">Data Ayah ({myChild.statusAyah})</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Nama</span><span className="font-bold text-gray-800">{myChild.namaAyah}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">NIK</span><span className="font-mono text-gray-700">{myChild.nikAyah}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">No. HP</span><span className="font-mono text-gray-700">{myChild.hpAyah}</span></div>
                            </div>
                        </div>

                        {/* Data Ibu */}
                        <div className="bg-pink-50/50 p-4 rounded-xl mb-4 border border-pink-100">
                            <h4 className="text-xs font-bold text-pink-800 uppercase mb-3 flex items-center gap-2">Data Ibu ({myChild.statusIbu})</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Nama</span><span className="font-bold text-gray-800">{myChild.namaIbu}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">NIK</span><span className="font-mono text-gray-700">{myChild.nikIbu}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">No. HP</span><span className="font-mono text-gray-700">{myChild.hpIbu}</span></div>
                            </div>
                        </div>

                        {/* Info Tambahan */}
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="p-3 border rounded-xl"><p className="text-xs text-gray-400">Pendapatan</p><p className="font-bold text-sm text-gray-700">{myChild.pendapatan}</p></div>
                            <div className="p-3 border rounded-xl"><p className="text-xs text-gray-400">Email</p><p className="font-bold text-sm text-gray-700 truncate">{myChild.email || '-'}</p></div>
                        </div>
                    </div>
                </div>

                {/* DISCLAIMER */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl flex items-start gap-3 mt-8">
                    <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={20}/>
                    <div>
                        <h4 className="font-bold text-yellow-800 text-sm">Informasi Penting</h4>
                        <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                            Data di atas adalah data yang tercatat saat registrasi awal atau pembaruan terakhir. 
                            <strong> Jika terdapat kesalahan penulisan nama, tanggal lahir, atau data lainnya, 
                            mohon segera hubungi Kader Posyandu atau Admin Desa setempat untuk perbaikan data </strong> 
                            agar tidak mempengaruhi hasil analisis kesehatan anak Anda.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // --- TAMPILAN 2: REKAM MEDIS (FULL WIDTH) ---
    if (activePage === 'ortu-medis') {
        return (
            <div className="w-full h-full p-2 animate-in slide-in-from-right">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h2 className="text-2xl font-black text-blue-900 mb-6 flex items-center gap-3">
                        <FileText className="text-emerald-500"/> Rekam Medis & Analisis
                    </h2>
                    
                    {myChild.medisNotes ? (
                        <div className="space-y-6">
                            {/* Analisis */}
                            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                                <h3 className="font-bold text-blue-900 text-lg mb-2">Diagnosis & Analisis Dokter</h3>
                                <p className="text-gray-700 leading-relaxed">{myChild.medisNotes.analisis}</p>
                            </div>

                            {/* Tindakan Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="border border-emerald-100 bg-emerald-50/50 p-6 rounded-2xl">
                                    <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Shield/> Saran Pencegahan (Preventif)</h3>
                                    <ul className="space-y-3">{renderMedicalList(myChild.medisNotes.preventif, "text-gray-800 font-medium")}</ul>
                                </div>
                                <div className="border border-orange-100 bg-orange-50/50 p-6 rounded-2xl">
                                    <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><ShieldAlert/> Saran Pengobatan (Kuratif)</h3>
                                    <ul className="space-y-3">{renderMedicalList(myChild.medisNotes.represif, "text-gray-800 font-medium")}</ul>
                                </div>
                            </div>

                            {/* Roadmap */}
                            <div className="border border-indigo-100 bg-indigo-50/50 p-6 rounded-2xl">
                                <h3 className="font-bold text-indigo-900 mb-6 flex items-center gap-2"><Clock/> Roadmap Pemulihan</h3>
                                {Array.isArray(myChild.medisNotes.roadmap) ? (
                                    <div className="space-y-8 border-l-2 border-indigo-300 ml-3 pl-6">
                                        {myChild.medisNotes.roadmap.map((phase, idx) => (
                                            <div key={idx} className="relative">
                                                <div className="absolute -left-[31px] top-1 w-4 h-4 bg-indigo-600 rounded-full border-4 border-indigo-100"></div>
                                                <h4 className="font-bold text-indigo-900 text-base">{phase.fase}</h4>
                                                <p className="text-sm text-indigo-700 font-medium mb-2 italic">Target: {phase.target}</p>
                                                <div className="bg-white p-4 rounded-xl border border-indigo-100 text-sm space-y-2 shadow-sm">
                                                    {phase.kegiatan?.nutrisi?.map((k, kx) => <div key={`n-${kx}`} className="flex gap-2"><Utensils size={14} className="text-orange-500 mt-0.5 shrink-0"/> <span>{k}</span></div>)}
                                                    {phase.kegiatan?.stimulasi?.map((k, kx) => <div key={`s-${kx}`} className="flex gap-2"><Baby size={14} className="text-blue-500 mt-0.5 shrink-0"/> <span>{k}</span></div>)}
                                                    {phase.kegiatan?.medis && <div className="flex gap-2 text-red-600 font-medium"><Stethoscope size={14} className="mt-0.5 shrink-0"/> <span>{phase.kegiatan.medis}</span></div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-600">{myChild.medisNotes.timeline || "Belum ada roadmap."}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <FileText size={48} className="mx-auto mb-4 text-gray-300"/>
                            <p className="text-gray-500 font-medium">Belum ada rekam medis yang diterbitkan oleh Nakes.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- TAMPILAN 3: CHATBOT (FULL SCREEN) ---
    if (activePage === 'ortu-chat') {
        return (
            <div className="w-full h-[85vh] flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in zoom-in-95">
                <div className="p-4 bg-blue-600 text-white flex items-center gap-4 shrink-0">
                    <div className="bg-white/20 p-3 rounded-full"><MessageSquare size={24}/></div>
                    <div><h2 className="text-xl font-bold">Asisten SiGemar</h2><p className="text-blue-100 text-sm">Tanyakan apa saja seputar kesehatan anak</p></div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 custom-scrollbar">
                    {chatHistory.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="bg-white p-6 rounded-full shadow-sm mb-4"><Heart size={48} className="text-pink-400"/></div>
                            <p className="text-lg font-medium text-gray-600">Halo Bunda/Ayah!</p>
                            <p className="text-sm">Saya siap membantu memantau tumbuh kembang {myChild.nama}.</p>
                        </div>
                    )}
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.sender==='user'?'justify-end':'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender==='user'?'bg-orange-500 text-white rounded-tr-none':'bg-white text-gray-800 rounded-tl-none border border-gray-200'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {chatLoading && <div className="flex justify-start"><div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm flex items-center gap-2 text-gray-500 text-sm"><RefreshCw className="animate-spin text-orange-500" size={16}/> Sedang mengetik...</div></div>}
                </div>

                <div className="p-4 bg-white border-t border-gray-200 flex gap-3">
                    <input className="flex-1 bg-gray-100 border border-gray-300 text-gray-800 rounded-full px-6 py-4 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Ketik pertanyaan..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleChat()}/>
                    <button onClick={handleChat} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition transform active:scale-95"><Send size={20}/></button>
                </div>
            </div>
        );
    }

    return null;
};

// --- REGISTRASI SUPER ADMIN (REVISI: FIX CRASH GEDONGSARI) ---
const SuperAdminRegistration = ({ onBack, notify, onRefresh }) => {
    const [step, setStep] = useState(1); 
    const [displayUmur, setDisplayUmur] = useState("0 tahun 0 bulan 0 hari");
    
    // State untuk data wilayah API
    const [wilayah, setWilayah] = useState({
        provinsi: [], kota: [], kecamatan: [], kelurahan: []
    });

    const [form, setForm] = useState({ 
        // Data Ayah
        statusAyah: 'Ayah Kandung', namaAyah: '', nikAyah: '', hpAyah: '', 
        // Data Ibu
        statusIbu: 'Ibu Kandung', namaIbu: '', nikIbu: '', hpIbu: '', 
        // Data Anak
        nama: '', nikAnak: '', gender: 'L', tempatLahir: '', tglLahir: '', umur: 0, 
        namaPanggilan: '', golDarah: 'Tidak diketahui', agama: 'Islam',
        // Wilayah & Kontak
        alamat: '', rt: '', rw: '', 
        provinsi: '', kota: '', kecamatan: '', kelurahan: '', 
        dusun: '', // Khusus Gedongsari
        kodePos: '', email: '', pendapatan: '< 1 Juta', sumberInfo: 'Undangan dari Puskesmas', catatan: '', 
        // Medis Awal
        berat: '', tinggi: '', lk: '' 
    });

    // Load Provinsi saat komponen mount
    useEffect(() => {
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json`)
            .then(response => response.json())
            .then(data => setWilayah(prev => ({ ...prev, provinsi: data })))
            .catch(() => notify("Gagal memuat data provinsi", "error"));
    }, []);

    const LIST_DUSUN_GEDONGSARI = [
        "Dusun Balekerso", "Dusun Pistan", "Dusun Janggar", "Dusun Gedongan",
        "Dusun Spatran", "Dusun Pringkudo", "Dusun Gandok" 
    ].map(d => ({ id: d, name: d }));

    // Handler Wilayah Bertingkat
    const handleRegionChange = (e) => {
        const { name, value } = e.target;
        let updatedForm = { ...form, [name]: value };

        if (name === 'provinsi') {
            updatedForm.kota = ''; updatedForm.kecamatan = ''; updatedForm.kelurahan = ''; updatedForm.dusun = '';
            setWilayah(prev => ({ ...prev, kota: [], kecamatan: [], kelurahan: [] }));
            fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${value}.json`)
                .then(res => res.json()).then(data => setWilayah(prev => ({ ...prev, kota: data })));
        } else if (name === 'kota') {
            updatedForm.kecamatan = ''; updatedForm.kelurahan = ''; updatedForm.dusun = '';
            setWilayah(prev => ({ ...prev, kecamatan: [], kelurahan: [] }));
            fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${value}.json`)
                .then(res => res.json()).then(data => setWilayah(prev => ({ ...prev, kecamatan: data })));
        } else if (name === 'kecamatan') {
            updatedForm.kelurahan = ''; updatedForm.dusun = '';
            setWilayah(prev => ({ ...prev, kelurahan: [] }));
            fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${value}.json`)
                .then(res => res.json()).then(data => setWilayah(prev => ({ ...prev, kelurahan: data })));
        }
        
        // Reset dusun jika kelurahan berubah (akan divalidasi ulang di render)
        if (name === 'kelurahan') {
            updatedForm.dusun = '';
        }
        
        setForm(updatedForm);
    };

    const handleChange = (e) => { 
        const { name, value } = e.target; 
        let updatedForm = { ...form, [name]: value }; 
        
        // Reset field ortu jika status None
        if (name === 'statusAyah' && value === 'None') {
            updatedForm.namaAyah = ''; updatedForm.nikAyah = ''; updatedForm.hpAyah = '';
        }
        if (name === 'statusIbu' && value === 'None') {
            updatedForm.namaIbu = ''; updatedForm.nikIbu = ''; updatedForm.hpIbu = '';
        }
        // Hitung umur otomatis
        if (name === 'tglLahir') { 
            const hasil = hitungUmurDetail(value); 
            updatedForm.umur = hasil.bulanTotal; 
            setDisplayUmur(hasil.text); 
        } 
        setForm(updatedForm); 
    };

    const handleRegister = async (e) => {
    e.preventDefault(); // Mencegah reload halaman

    // --- LOGIKA TRAFFIC CONTROLLER ---
    // Jika belum sampai langkah terakhir (Langkah 4), 
    // tekan Enter atau klik tombol hanya akan memindahkan ke langkah berikutnya.
    if (step < 4) {
        setStep(step + 1);
        return; // Berhenti di sini, JANGAN lanjut ke API
    }

    // --- LOGIKA PENDAFTARAN (Hanya jalan jika step === 4) ---
    // Validasi dasar sebelum menembak API
    if (!form.nama || form.nama.trim() === "") return notify("Nama Anak wajib diisi!", "error");
    if (!form.nikAnak || form.nikAnak.trim() === "") return notify("NIK Anak wajib diisi!", "error");
    if (!form.tglLahir) return notify("Tanggal Lahir Anak wajib diisi!", "error");

    const getRegionName = (list, id) => {
        const item = list.find(x => x.id === id);
        return item ? item.name : '';
    };

    // ... (Logika koordinat dusun Anda tetap sama) ...
    const DUSUN_COORDINATES = {
        "Dusun Balekerso":  { lat: -7.2335, lng: 110.1180 },
        "Dusun Pistan":     { lat: -7.2350, lng: 110.1225 },
        "Dusun Janggar":    { lat: -7.2365, lng: 110.1190 },
        "Dusun Gedongan":   { lat: -7.2340, lng: 110.1205 },
        "Dusun Spatran":    { lat: -7.2325, lng: 110.1215 },
        "Dusun Pringkudo":  { lat: -7.2355, lng: 110.1175 },
        "Dusun Gandok":     { lat: -7.2370, lng: 110.1210 }
    };
    const DEFAULT_COORD = { lat: -7.2347, lng: 110.1200 };
    let finalLat = DEFAULT_COORD.lat;
    let finalLng = DEFAULT_COORD.lng;
    if (form.dusun && DUSUN_COORDINATES[form.dusun]) {
        finalLat = DUSUN_COORDINATES[form.dusun].lat;
        finalLng = DUSUN_COORDINATES[form.dusun].lng;
    }

    const jitter = () => (Math.random() - 0.5) * 0.0005; 
    
    const finalPayload = {
        ...form,
        provinsi: getRegionName(wilayah.provinsi, form.provinsi),
        kota: getRegionName(wilayah.kota, form.kota),
        kecamatan: getRegionName(wilayah.kecamatan, form.kecamatan),
        kelurahan: getRegionName(wilayah.kelurahan, form.kelurahan),
        latitude: finalLat + jitter(),
        longitude: finalLng + jitter(),
        berat: form.berat ? parseFloat(form.berat) : 0,
        tinggi: form.tinggi ? parseFloat(form.tinggi) : 0,
        lk: form.lk ? parseFloat(form.lk) : 0
    };

    try { 
        const res = await fetch(`${API_URL}/iot-data`, { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify(finalPayload) 
        }); 
        const data = await res.json(); 
        
        if(res.ok) { 
            notify("Registrasi Sukses!", "success"); 
            onRefresh(); 
            onBack(); 
        } else { 
            notify(data.message || "Gagal menyimpan data", "error"); 
        } 
    } catch { 
        notify("Server Error", "error"); 
    } 
};

    const getStepTitle = () => {
        switch(step) {
            case 1: return "A. DATA ORANG TUA / WALI";
            case 2: return "B. DATA IDENTITAS ANAK";
            case 3: return "C. ALAMAT DOMISILI";
            case 4: return "D. KONTAK & DATA AWAL";
            default: return "";
        }
    };

    const isAyahActive = form.statusAyah !== 'None';
    const isIbuActive = form.statusIbu !== 'None';

    // --- FIX CRASH: LOGIKA AMAN UNTUK CEK GEDONGSARI ---
    const checkIsGedongsari = () => {
        if (!form.kelurahan || wilayah.kelurahan.length === 0) return false;
        const selectedKel = wilayah.kelurahan.find(k => k.id === form.kelurahan);
        // Pastikan selectedKel ada DAN memiliki properti name sebelum di-uppercase
        return selectedKel && selectedKel.name && selectedKel.name.toUpperCase().includes('GEDONGSARI');
    };

    return (
        <div className="w-full h-full flex flex-col animate-in fade-in">
            <div className="flex justify-between items-end mb-6 px-1">
                <div>
                    <h2 className="text-3xl font-black text-blue-900 flex items-center gap-2">
                        <FilePlus className="text-orange-500" size={32}/> Registrasi Lengkap
                    </h2>
                    <p className="text-gray-500 mt-2 font-medium">Formulir pendaftaran peserta baru Posyandu.</p>
                </div>
                <div className="flex gap-3">
                    {[1,2,3,4].map(s => (
                        <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2 
                            ${step === s ? 'bg-orange-500 text-white border-orange-500 scale-110' : 
                             (step > s ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-300 border-gray-200')}`}>
                            {step > s ? <CheckCircle size={18}/> : s}
                        </div>
                    ))}
                </div>
            </div>
            
            <form onSubmit={handleRegister} className="flex-1 bg-white border border-gray-200 rounded-2xl p-8 flex flex-col relative overflow-hidden shadow-sm">
                <div className="bg-blue-50/60 border-l-4 border-blue-600 py-4 px-6 mb-8 rounded-r-lg">
                    <h3 className="text-lg font-bold text-blue-900 uppercase tracking-wide">{getStepTitle()}</h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-4">
                    {/* STEP 1: ORTU */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SelectField label="Status Ayah *" name="statusAyah" value={form.statusAyah} onChange={handleChange}><option value="Ayah Kandung">Ayah Kandung</option><option value="Ayah Wali">Ayah Wali</option><option value="None">None (Tidak Ada)</option></SelectField>
                                <SelectField label="Status Ibu *" name="statusIbu" value={form.statusIbu} onChange={handleChange}><option value="Ibu Kandung">Ibu Kandung</option><option value="Ibu Wali">Ibu Wali</option><option value="None">None (Tidak Ada)</option></SelectField>
                            </div>
                            <div className={`p-4 rounded-xl border ${isAyahActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                <h4 className="text-sm font-bold uppercase mb-4 text-blue-900">Data Ayah</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InputField label="Nama Ayah" name="namaAyah" value={form.namaAyah} onChange={handleChange} disabled={!isAyahActive}/>
                                    <InputField label="NIK Ayah" name="nikAyah" value={form.nikAyah} onChange={handleChange} disabled={!isAyahActive}/>
                                    <InputField label="No. HP" name="hpAyah" value={form.hpAyah} onChange={handleChange} disabled={!isAyahActive}/>
                                </div>
                            </div>
                            <div className={`p-4 rounded-xl border ${isIbuActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                <h4 className="text-sm font-bold uppercase mb-4 text-pink-900">Data Ibu</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InputField label="Nama Ibu" name="namaIbu" value={form.namaIbu} onChange={handleChange} disabled={!isIbuActive}/>
                                    <InputField label="NIK Ibu" name="nikIbu" value={form.nikIbu} onChange={handleChange} disabled={!isIbuActive}/>
                                    <InputField label="No. HP" name="hpIbu" value={form.hpIbu} onChange={handleChange} disabled={!isIbuActive}/>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: ANAK */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right">
                            <InputField label="Nama Lengkap Anak *" name="nama" value={form.nama} onChange={handleChange}/>
                            <InputField label="NIK Anak *" name="nikAnak" value={form.nikAnak} onChange={handleChange}/>
                            <SelectField label="Jenis Kelamin *" name="gender" value={form.gender} onChange={handleChange}><option value="L">Laki-laki</option><option value="P">Perempuan</option></SelectField>
                            <InputField label="Tempat Lahir *" name="tempatLahir" value={form.tempatLahir} onChange={handleChange}/>
                            <div>
                                <InputField label="Tanggal Lahir *" name="tglLahir" type="date" value={form.tglLahir} onChange={handleChange}/>
                                {form.tglLahir && <div className="text-xs font-bold text-emerald-600 mt-1">Usia: {displayUmur}</div>}
                            </div>
                            <InputField label="Nama Panggilan" name="namaPanggilan" value={form.namaPanggilan} onChange={handleChange}/>
                            <SelectField label="Golongan Darah" name="golDarah" value={form.golDarah} onChange={handleChange}><option>Tidak diketahui</option><option>A</option><option>B</option><option>AB</option><option>O</option></SelectField>
                            
                            <SelectField label="Agama" name="agama" value={form.agama} onChange={handleChange}>
                                <option value="Islam">Islam</option>
                                <option value="Kristen">Kristen</option>
                                <option value="Buddha">Buddha</option>
                                <option value="Hindu">Hindu</option>
                                <option value="Konghucu">Konghucu</option>
                                <option value="None">None</option>
                            </SelectField>
                        </div>
                    )}

                    {/* STEP 3: WILAYAH */}
                    {step === 3 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right">
                             <div className="md:col-span-2 bg-orange-50 p-4 rounded-xl border border-orange-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SearchableSelect label="Provinsi" name="provinsi" value={form.provinsi} onChange={handleRegionChange} options={wilayah.provinsi} />
                                    <SearchableSelect label="Kota/Kab" name="kota" value={form.kota} onChange={handleRegionChange} options={wilayah.kota} disabled={!form.provinsi} />
                                    <SearchableSelect label="Kecamatan" name="kecamatan" value={form.kecamatan} onChange={handleRegionChange} options={wilayah.kecamatan} disabled={!form.kota} />
                                    <SearchableSelect label="Kelurahan" name="kelurahan" value={form.kelurahan} onChange={handleRegionChange} options={wilayah.kelurahan} disabled={!form.kecamatan} />
                                    
                                    {/* FIX CRASH GEDONGSARI */}
                                    {checkIsGedongsari() && (
                                        <div className="mt-0">
                                            <SearchableSelect label="Pilih Dusun *" name="dusun" value={form.dusun} onChange={handleChange} options={LIST_DUSUN_GEDONGSARI} />
                                        </div>
                                    )}
                                </div>
                             </div>
                             <div className="md:col-span-2"><TextAreaField label="Alamat Lengkap" name="alamat" value={form.alamat} onChange={handleChange}/></div>
                             <div className="grid grid-cols-2 gap-6"><InputField label="RT" name="rt" value={form.rt} onChange={handleChange}/><InputField label="RW" name="rw" value={form.rw} onChange={handleChange}/></div>
                             <InputField label="Kode Pos" name="kodePos" value={form.kodePos} onChange={handleChange} />
                        </div>
                    )}

                    {/* STEP 4: MEDIS & KONTAK */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Email Ortu" name="email" value={form.email} onChange={handleChange}/>
                                <SelectField label="Pendapatan" name="pendapatan" value={form.pendapatan} onChange={handleChange}><option value="< 1 Juta">Kurang dari Rp 1.000.000</option><option value="1 - 2.5 Juta">Rp 1.000.000 - Rp 2.500.000</option><option value="2.5 - 5 Juta">Rp 2.500.000 - Rp 5.000.000</option><option value="> 5 Juta">Di atas Rp 5.000.000</option><option value="Tidak Tetap">Tidak Tetap</option></SelectField>
                                <SelectField label="Sumber Info" name="sumberInfo" value={form.sumberInfo} onChange={handleChange}><option>Undangan dari Puskesmas</option><option>Teman/Kerabat</option><option>Media Sosial</option><option>Lainnya</option></SelectField>
                                <TextAreaField label="Catatan Medis" name="catatan" value={form.catatan} onChange={handleChange}/>
                            </div>
                            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                                <h4 className="font-bold text-emerald-900 mb-4">Pengukuran Awal (Opsional)</h4>
                                <div className="grid grid-cols-3 gap-6">
                                    <InputField label="Berat (kg)" name="berat" type="number" step="0.01" value={form.berat} onChange={handleChange}/>
                                    <InputField label="Tinggi (cm)" name="tinggi" type="number" step="0.1" value={form.tinggi} onChange={handleChange}/>
                                    <InputField label="LK (cm)" name="lk" type="number" step="0.1" value={form.lk} onChange={handleChange}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center pt-6 border-t border-gray-100 mt-auto">
    {step > 1 ? (
        // Tombol Kembali HARUS type="button" agar tidak memicu handleRegister
        <button type="button" onClick={() => setStep(s => s - 1)} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-600 transition">
            Kembali
        </button>
    ) : (
        <button type="button" onClick={onBack} className="px-6 py-3 text-red-500 hover:bg-red-50 rounded-xl font-bold transition">
            Batal
        </button>
    )}
    
    {step < 4 ? (
        // Tombol Selanjutnya menggunakan type="submit" agar konsisten dengan tombol Enter
        <button type="submit" className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-md transition">
            Selanjutnya
        </button>
    ) : (
        // Tombol Final
        <button type="submit" className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-md transition">
            Simpan Data Lengkap
        </button>
    )}
</div>
            </form>
        </div>
    );
};

// --- KOMPONEN GEOSPASIAL MAP (UPDATED: REAL COORDINATES) ---
const StuntingMap = ({ data }) => {
    // Pusat Peta: Kantor Kelurahan Gedongsari (Estimasi)
    const centerPosition = [-7.2347, 110.1200]; 

    return (
        <MapContainer center={centerPosition} zoom={15} style={{ height: "450px", width: "100%", borderRadius: "16px", zIndex: 0 }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {data.map((pasien) => {
                // 1. Tentukan Icon berdasarkan status
                const isRisk = pasien.status && (pasien.status.includes('Stunting') || pasien.status.includes('Gizi Kurang') || pasien.status.includes('Microcephaly'));
                const theIcon = isRisk ? iconStunting : iconNormal;
                
                // 2. LOGIKA UTAMA: Gunakan koordinat dari database jika ada
                // Jika tidak ada (data lama), fallback ke posisi tengah
                const hasCoord = pasien.latitude && pasien.longitude;
                const pos = hasCoord ? [pasien.latitude, pasien.longitude] : centerPosition;

                if (!hasCoord) return null; // Opsional: Jangan tampilkan jika tidak ada koordinat

                return (
                    <Marker key={pasien.id} position={pos} icon={theIcon}>
                        <Popup>
                            <div className="text-center min-w-[150px]">
                                <h3 className="font-bold text-blue-900 text-sm mb-1">{pasien.nama || pasien.namaAnak}</h3>
                                <p className="text-xs text-gray-500 mb-2">{pasien.umur} Bulan</p>
                                
                                {/* Tampilkan Nama Dusun */}
                                <div className="bg-gray-100 rounded px-2 py-1 mb-2 text-[10px] font-bold text-gray-600 flex items-center justify-center gap-1">
                                    <MapPin size={10}/> {pasien.dusun || pasien.kelurahan}
                                </div>

                                <span className={`px-2 py-1 rounded-full text-[10px] text-white font-bold ${isRisk ? 'bg-red-500' : 'bg-blue-500'}`}>
                                    {pasien.status}
                                </span>
                                <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-left grid grid-cols-2 gap-1 font-medium text-gray-700">
                                    <span>Berat Badan: {pasien.berat}kg</span>
                                    <span>Tinggi Badan: {pasien.tinggi}cm</span>
                                </div>
                            </div>
                        </Popup>
                        <LeafletTooltip direction="top" offset={[0, -20]} opacity={1}>
                            {pasien.nama || pasien.namaAnak}
                        </LeafletTooltip>
                    </Marker>
                );
            })}
        </MapContainer>
    );
};

// --- SHARED DASHBOARD (UPDATED: STUNTING PER DUSUN) ---
const DashboardHome = ({ onNavigate, logs, refreshLogs, notify, userRole, setRegisterMode }) => {
  const safeLogs = Array.isArray(logs) ? logs : [];
  
  const [viewMode, setViewMode] = useState('chart'); 
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  
  // --- FILTER BARU UNTUK GRAFIK ---
  const [timeFilter, setTimeFilter] = useState('all'); // 'week', 'month', 'all'
  const [genderFilter, setGenderFilter] = useState('all'); // Tambahan: Filter Gender
  // Di dalam DashboardHome
const [chartMetric, setChartMetric] = useState('stunting'); // Default: stunting

  // LIST DUSUN TARGET (Sesuai request)
  const TARGET_DUSUNS = [
    "Dusun Balekerso", "Dusun Pistan", "Dusun Janggar", "Dusun Gedongan",
    "Dusun Spatran", "Dusun Pringkudo", "Dusun Gandok"
  ];

 // LOGIKA AGREGASI DATA GRAFIK (UPDATED)
  const chartData = useMemo(() => {
      const now = new Date();
      
      const filteredBase = safeLogs.filter(log => {
          // Filter Waktu
          if (timeFilter !== 'all') {
              const dateStr = log.waktuSubmit ? log.waktuSubmit.split(',')[0].split('/').reverse().join('-') : null;
              const logDate = dateStr ? new Date(dateStr) : new Date(); 
              if (timeFilter === 'week') {
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(now.getDate() - 7);
                  if (logDate < oneWeekAgo) return false;
              }
              if (timeFilter === 'month') {
                  const oneMonthAgo = new Date();
                  oneMonthAgo.setMonth(now.getMonth() - 1);
                  if (logDate < oneMonthAgo) return false;
              }
          }
          // Filter Gender
          if (genderFilter !== 'all' && log.gender !== genderFilter) return false;
          return true;
      });

      return TARGET_DUSUNS.map(dusunName => {
          const dusunLogs = filteredBase.filter(log => log.dusun === dusunName);
          let count = 0;

          // LOGIKA FILTER KATEGORI (STRICT)
          if (chartMetric === 'stunting') {
              count = dusunLogs.filter(log => log.status?.includes('Stunting') || log.status?.includes('Risiko')).length;
          } else if (chartMetric === 'normal') {
              count = dusunLogs.filter(log => log.status === 'Normal').length;
          } else if (chartMetric === 'overweight') {
              count = dusunLogs.filter(log => log.status?.includes('Overweight')).length;
          } else if (chartMetric === 'abnormal') {
              count = dusunLogs.filter(log => {
                  const s = log.status || '';
                  const isNormal = s === 'Normal';
                  const isStunting = s.includes('Stunting') || s.includes('Risiko');
                  const isOverweight = s.includes('Overweight');
                  const isWaiting = s === 'Menunggu Data' || s === '' || s === '-';
                  return !isNormal && !isStunting && !isOverweight && !isWaiting;
              }).length;
          }

          return {
              name: dusunName.replace('Dusun ', ''), 
              kasus: count,
              fullDusun: dusunName 
          };
      });
  }, [safeLogs, timeFilter, genderFilter, chartMetric]);

  // Statistik Kartu Atas (Tetap menggunakan seluruh data logs yang ada)
  const filteredLogs = safeLogs; 
  const countNormal = safeLogs.filter(item => item.status === 'Normal').length;
  const countOverweight = safeLogs.filter(item => item.status?.includes('Overweight')).length;
  const countStunting = safeLogs.filter(item => item.status?.includes('Stunting') || item.status?.includes('Risiko')).length;
  const countAbnormal = safeLogs.filter(item => {
    const s = item.status || '';
    const isNormal = s === 'Normal';
    const isStunting = s.includes('Stunting') || s.includes('Risiko');
    const isOverweight = s.includes('Overweight');
    const isWaiting = s === 'Menunggu Data' || s === '' || s === '-';
    return !isNormal && !isStunting && !isOverweight && !isWaiting;
  }).length;

  const [selectedChildForAI, setSelectedChildForAI] = useState(null);

  const handleToggleView = (mode) => {
      setViewMode(mode);
      if(mode === 'chart') setAiSearchQuery('');
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
            <h2 className="text-3xl font-black text-blue-900">Dashboard <span className="text-orange-500">{getRoleLabel(userRole)}</span></h2>
            <p className="text-gray-600 font-medium mt-1">Monitoring Stunting</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
           {/* TOMBOL TOGGLE (Grafik / Peta / AI) */}
           <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
               <button onClick={() => handleToggleView('chart')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'chart' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}><Activity size={16}/> Grafik</button>
               <button onClick={() => handleToggleView('map')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'map' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}><MapPin size={16}/> Peta</button>
               {userRole === 'nakes' && <button onClick={() => handleToggleView('ai')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'ai' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}><Sparkles size={16}/> AI</button>}
           </div>

           <button onClick={()=>downloadExcel(filteredLogs)} className="flex-1 md:flex-none bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-md font-bold flex items-center gap-2"><Download size={18}/> Export</button>
           {userRole === 'superadmin' && <button onClick={()=>setRegisterMode(true)} className="flex-1 md:flex-none bg-orange-500 text-white px-6 py-3 rounded-xl shadow-md font-bold flex items-center gap-2"><Plus size={18}/> Registrasi</button>}
        </div>
      </div>
      
      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
        {/* Kartu 1: Total Data */}
        <div onClick={() => onNavigate('view-all')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition group">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600"><Users size={24}/></div>
            <div><p className="text-gray-500 text-sm font-bold mb-1">Total Data</p><h3 className="text-3xl font-black text-blue-900">{filteredLogs.length}</h3></div>
        </div>

        {/* Kartu 2: Normal */}
        <div onClick={() => onNavigate('view-normal')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-emerald-300 transition group">
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle size={24}/></div>
            <div><p className="text-gray-500 text-sm font-bold mb-1">Normal</p><h3 className="text-3xl font-black text-emerald-600">{countNormal}</h3></div>
        </div>

        {/* Kartu 3: Overweight */}
        <div onClick={() => onNavigate('view-overweight')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-purple-300 transition group">
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600"><Scale size={24}/></div>
            <div><p className="text-gray-500 text-sm font-bold mb-1">Overweight</p><h3 className="text-3xl font-black text-purple-600">{countOverweight}</h3></div>
        </div>

        {/* Kartu 4: Stunting */}
        <div onClick={() => onNavigate('view-stunting')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-red-300 transition group">
            <div className="p-3 rounded-xl bg-red-100 text-red-600"><AlertTriangle size={24}/></div>
            <div><p className="text-gray-500 text-sm font-bold mb-1">Stunting</p><h3 className="text-3xl font-black text-red-600">{countStunting}</h3></div>
        </div>

        {/* [KARTU BARU] Kartu 5: Abnormal */}
        <div onClick={() => onNavigate('view-abnormal')} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-orange-300 transition group">
            <div className="p-3 rounded-xl bg-orange-100 text-orange-600"><ShieldAlert size={24}/></div>
            <div><p className="text-gray-500 text-sm font-bold mb-1">Abnormal</p><h3 className="text-3xl font-black text-orange-600">{countAbnormal}</h3></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- VIEW MODE: CHART & MAP --- */}
        {(viewMode === 'chart' || viewMode === 'map') && (
            <>
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit animate-in fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                            {viewMode === 'chart' ? <><Activity className="text-orange-500"/> Kondisi per Dusun</> : <><MapPin className="text-orange-500"/> Peta Sebaran</>}
                        </h2>
                        
                       {/* KANAN: Kontainer Semua Filter (Hanya muncul jika mode Chart) */}
    {viewMode === 'chart' && (
        <div className="flex flex-wrap items-center gap-2">
            {/* 1. Filter Kategori (Gizi/Abnormal/Stunting) */}
            <select 
                value={chartMetric} 
                onChange={(e) => setChartMetric(e.target.value)} 
                className="bg-white border border-gray-200 text-gray-700 text-xs rounded-lg px-3 py-2 outline-none font-bold cursor-pointer hover:border-orange-500 transition shadow-sm"
            >
                <option value="stunting">Kategori: Stunting</option>
                <option value="normal">Kategori: Normal</option>
                <option value="overweight">Kategori: Overweight</option>
                <option value="abnormal">Kategori: Abnormal</option>
            </select>

            {/* 2. Filter Waktu */}
            <select 
                value={timeFilter} 
                onChange={(e) => setTimeFilter(e.target.value)} 
                className="bg-white border border-gray-200 text-gray-700 text-xs rounded-lg px-3 py-2 outline-none font-bold cursor-pointer hover:border-orange-500 transition shadow-sm"
            >
                <option value="all">Semua Waktu</option>
                <option value="month">Bulan Ini</option>
                <option value="week">Minggu Ini</option>
            </select>

            {/* 3. Filter Gender */}
            <select 
                value={genderFilter} 
                onChange={(e) => setGenderFilter(e.target.value)} 
                className="bg-white border border-gray-200 text-gray-700 text-xs rounded-lg px-3 py-2 outline-none font-bold cursor-pointer hover:border-orange-500 transition shadow-sm"
            >
                <option value="all">Semua Gender</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
            </select>
        </div>
    )}
</div>
        
                    
                    <div className="h-80 w-full text-xs font-medium">
                        {viewMode === 'chart' ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                                    <XAxis 
                                        dataKey="name" 
                                        tick={{fill:'#64748b', fontWeight: 700}} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        dy={10}
                                    /> 
                                    <YAxis 
                                        allowDecimals={false}
                                        tick={{fill:'#64748b', fontWeight: 600}} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        dx={-10}
                                    />
                                    <Tooltip 
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{backgroundColor:'#ffffff', borderRadius:'12px', border:'1px solid #e2e8f0', color:'#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                                        itemStyle={{fontWeight: 600, color: '#ef4444'}} 
                                        labelStyle={{fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem'}}
                                        formatter={(value, name) => [value, "Jumlah Kasus"]}
                                    /> 
                                    <Legend wrapperStyle={{paddingTop: '20px'}}/>
                                    <Bar 
    dataKey="kasus" 
    name={`Jumlah ${chartMetric.charAt(0).toUpperCase() + chartMetric.slice(1)}`}
    radius={[6, 6, 0, 0]} 
    barSize={40}
>
    {/* --- STEP 4: LOGIKA WARNA DINAMIS --- */}
    {chartData.map((entry, index) => {
        let barColor = '#e2e8f0'; // Default warna abu jika 0 kasus
        if (entry.kasus > 0) {
            if (chartMetric === 'stunting') barColor = '#ef4444';   // Merah
            if (chartMetric === 'normal') barColor = '#10b981';     // Hijau
            if (chartMetric === 'overweight') barColor = '#8b5cf6'; // Ungu
            if (chartMetric === 'abnormal') barColor = '#f59e0b';   // Oranye (Tinggi Lebih/Macro)
        }
        return <Cell key={`cell-${index}`} fill={barColor} />;
    })}
</Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <StuntingMap data={filteredLogs} />
                        )}
                    </div>
                    {viewMode === 'chart' && (
                        <p className="text-center text-[10px] text-gray-400 mt-4 italic">
                            *Grafik menampilkan jumlah anak stunting di 7 Dusun Gedongsari.
                        </p>
                    )}
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[600px] overflow-hidden animate-in fade-in slide-in-from-right-4">
                    <h2 className="text-lg font-bold text-blue-900 mb-4 flex gap-2 items-center"><div className="bg-emerald-100 p-1.5 rounded-lg"><Users size={18} className="text-emerald-600"/></div> Daftar Pasien Terkini</h2>
                    <div className="space-y-3 flex-1 overflow-auto custom-scrollbar pr-2">
                        {filteredLogs.slice(0,10).map((log,i)=>(
                            <div key={i} onClick={() => { if(userRole==='nakes') { setSelectedChildForAI(log); setViewMode('ai'); } }} className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md group bg-white border-gray-100 hover:border-orange-300`}>
                                <div className="flex justify-between mb-3 items-start">
                                    <div>
                                        <span className="font-bold text-base block truncate max-w-[160px] text-blue-900 group-hover:text-orange-600 transition">{log.nama || log.namaAnak}</span>
                                        <span className="text-xs text-gray-500 block font-medium mt-0.5 flex items-center gap-1"><Baby size={12}/> {log.gender} • {log.umur} Bln</span>
                                        {/* Menampilkan Dusun jika ada (Prioritas) atau Kelurahan */}
                                        {log.dusun ? (
                                            <span className="text-[10px] text-orange-600 font-bold block mt-1"><MapPin size={10} className="inline mr-1"/>{log.dusun}</span>
                                        ) : (
                                            log.kelurahan && <span className="text-[10px] text-emerald-600 font-bold block mt-1"><MapPin size={10} className="inline mr-1"/>{log.kelurahan}</span>
                                        )}
                                    </div>
                                    <StatusBadge status={log.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}

        {/* --- VIEW MODE: AI ASSISTANT (FULL WIDTH) --- */}
        {viewMode === 'ai' && userRole === 'nakes' && (
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in zoom-in-95">
                {/* LIST PASIEN DI KIRI (UNTUK PILIH) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[600px] overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-blue-900">Pilih Pasien</h2>
                        <button onClick={()=>setViewMode('chart')} className="text-xs text-gray-500 hover:text-blue-600 underline">Kembali ke Grafik</button>
                    </div>

                    {/* --- SEARCH BAR AI LIST --- */}
                    <div className="mb-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                            value={aiSearchQuery}
                            onChange={(e) => setAiSearchQuery(e.target.value)}
                            placeholder="Cari nama pasien..."
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>

                    <div className="space-y-3 flex-1 overflow-auto custom-scrollbar pr-2">
                        {filteredLogs.filter(item => {
                            const nameToCheck = item.nama || item.namaAnak || '';
                            return nameToCheck.toLowerCase().includes(aiSearchQuery.toLowerCase());
                        }).map((log,i)=>(
                            <div 
                                key={i} 
                                onClick={() => setSelectedChildForAI(log)}
                                className={`p-3 border rounded-xl cursor-pointer transition-all ${selectedChildForAI?.id === log.id ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'bg-white border-gray-200 hover:border-purple-300'}`}
                            >
                                <div className="flex justify-between">
                                    <span className={`font-bold text-sm ${selectedChildForAI?.id === log.id ? 'text-purple-700' : 'text-gray-700'}`}>{log.nama || log.namaAnak}</span>
                                    <StatusBadge status={log.status} />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{log.gender} • {log.umur} Bln • {log.dusun || log.kelurahan}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI COMPONENT DI TENGAH & KANAN (LEBIH LEBAR) */}
                <div className="lg:col-span-2">
                    <AIStuntingCompanion childData={selectedChildForAI} notify={notify} onRefresh={refreshLogs} />
                </div>
            </div>
        )}

      </div>
    </>
  );
};

// --- EDIT MODAL (SUPER ADMIN: STEP-BY-STEP SEPERTI REGISTRASI) ---
const EditModal = ({ isOpen, onClose, data, onRefresh, notify, userRole }) => {
    const [form, setForm] = useState(data || {});
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const isSuperAdmin = userRole === 'superadmin';

    // Reset data dan step setiap kali modal dibuka
    useEffect(() => { 
        setForm(data || {});
        setStep(1);
    }, [data, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let updatedForm = { ...form, [name]: value };
        
        // Handle otomatis reset data ortu jika "None"
        if (name === 'statusAyah' && value === 'None') {
            updatedForm.namaAyah = ''; updatedForm.nikAyah = ''; updatedForm.hpAyah = '';
        }
        if (name === 'statusIbu' && value === 'None') {
            updatedForm.namaIbu = ''; updatedForm.nikIbu = ''; updatedForm.hpIbu = '';
        }
        // Update umur otomatis jika tanggal lahir diganti
        if (name === 'tglLahir') {
            const hasil = hitungUmurDetail(value);
            updatedForm.umur = hasil.bulanTotal;
        }
        
        setForm(updatedForm);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            // Frontend TIDAK MENGHITUNG STATUS. Kirim data mentah ke backend.
            // Payload dinamis (Superadmin kirim semua, Nakes cuma medis)
            // Tapi karena backend akan hitung ulang, kita kirim form apa adanya (atau filter field)
            // Untuk simplifikasi, kirim form yang sudah diupdate state-nya.
            // Backend akan ambil field yang relevan dan hitung status.
            
            // Pastikan angka dikirim sebagai angka
            const updatePayload = { ...form };
            if (updatePayload.berat) updatePayload.berat = parseFloat(updatePayload.berat);
            if (updatePayload.tinggi) updatePayload.tinggi = parseFloat(updatePayload.tinggi);
            if (updatePayload.lk) updatePayload.lk = parseFloat(updatePayload.lk);
            
            const res = await fetch(`${API_URL}/iot-data/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            if (res.ok) {
                notify("Data berhasil diperbarui!", "success");
                onRefresh();
                onClose();
            } else {
                notify("Gagal memperbarui data.", "error");
            }
        } catch (error) {
            notify("Terjadi kesalahan server.", "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !data) return null;

    const isAyahActive = form.statusAyah !== 'None';
    const isIbuActive = form.statusIbu !== 'None';

    const getStepTitle = () => {
        switch(step) {
            case 1: return "A. EDIT DATA ORANG TUA / WALI";
            case 2: return "B. EDIT IDENTITAS ANAK";
            case 3: return "C. EDIT ALAMAT DOMISILI";
            case 4: return "D. EDIT MEDIS & DATA AWAL";
            default: return "";
        }
    };

    // --- TAMPILAN KHUSUS NAKES (HANYA PENGUKURAN) ---
    if (!isSuperAdmin) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] animate-in fade-in p-4">
                <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                        <h3 className="text-xl font-black text-blue-900 flex items-center gap-2"><Edit size={24} className="text-orange-500"/> Update Pengukuran</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition"><X size={24}/></button>
                    </div>
                    <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h4 className="font-bold text-blue-900 text-lg">{form.nama || form.namaAnak}</h4>
                        <p className="text-sm text-gray-600">{form.umur} Bulan • {form.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                    </div>
                    <div className="space-y-4">
                        <InputField label="Berat Badan (kg)" name="berat" type="number" step="0.01" value={form.berat} onChange={handleChange} className="font-bold text-lg"/>
                        <InputField label="Tinggi Badan (cm)" name="tinggi" type="number" step="0.1" value={form.tinggi} onChange={handleChange} className="font-bold text-lg"/>
                        <InputField label="Lingkar Kepala (cm)" name="lk" type="number" step="0.1" value={form.lk} onChange={handleChange} className="font-bold text-lg"/>
                    </div>
                    <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition">Batal</button>
                        <button onClick={handleSave} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition flex justify-center gap-2">Simpan Data</button>
                    </div>
                </div>
            </div>
        );
    }

    // --- TAMPILAN SUPER ADMIN (STEP-BY-STEP) ---
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2000] animate-in fade-in p-4 lg:p-10">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl animate-in zoom-in overflow-hidden">
                
                {/* HEADER MODAL */}
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-blue-900 flex items-center gap-2">
                            <Edit className="text-orange-500" size={28}/> Edit Data Pasien
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 font-medium">ID: {form.idRegistrasi} • {form.nama || form.namaAnak}</p>
                    </div>
                    
                    {/* INDIKATOR STEP */}
                    <div className="hidden sm:flex gap-2">
                        {[1,2,3,4].map(s => (
                            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 
                                ${step === s ? 'bg-orange-500 text-white border-orange-500 scale-110' : 
                                 (step > s ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-300 border-gray-200')}`}>
                                {step > s ? <CheckCircle size={14}/> : s}
                            </div>
                        ))}
                    </div>
                    <button onClick={onClose} className="sm:hidden text-gray-400 hover:text-red-500 p-2"><X size={24}/></button>
                </div>

                {/* BODY (SCROLLABLE FORM) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 bg-white">
                    <div className="bg-blue-50/60 border-l-4 border-blue-600 py-3 px-5 mb-6 rounded-r-lg">
                        <h3 className="text-md font-bold text-blue-900 uppercase tracking-wide">{getStepTitle()}</h3>
                    </div>

                    {/* STEP 1: ORTU */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <SelectField label="Status Ayah *" name="statusAyah" value={form.statusAyah} onChange={handleChange}><option value="Ayah Kandung">Ayah Kandung</option><option value="Ayah Wali">Ayah Wali</option><option value="None">None (Tidak Ada)</option></SelectField>
                                <SelectField label="Status Ibu *" name="statusIbu" value={form.statusIbu} onChange={handleChange}><option value="Ibu Kandung">Ibu Kandung</option><option value="Ibu Wali">Ibu Wali</option><option value="None">None (Tidak Ada)</option></SelectField>
                            </div>
                            <div className={`p-4 rounded-xl border ${isAyahActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                <h4 className="text-sm font-bold uppercase mb-4 text-blue-900">Data Ayah</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InputField label="Nama Ayah" name="namaAyah" value={form.namaAyah} onChange={handleChange} disabled={!isAyahActive}/>
                                    <InputField label="NIK Ayah" name="nikAyah" value={form.nikAyah} onChange={handleChange} disabled={!isAyahActive}/>
                                    <InputField label="No. HP" name="hpAyah" value={form.hpAyah} onChange={handleChange} disabled={!isAyahActive}/>
                                </div>
                            </div>
                            <div className={`p-4 rounded-xl border ${isIbuActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                <h4 className="text-sm font-bold uppercase mb-4 text-pink-900">Data Ibu</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InputField label="Nama Ibu" name="namaIbu" value={form.namaIbu} onChange={handleChange} disabled={!isIbuActive}/>
                                    <InputField label="NIK Ibu" name="nikIbu" value={form.nikIbu} onChange={handleChange} disabled={!isIbuActive}/>
                                    <InputField label="No. HP" name="hpIbu" value={form.hpIbu} onChange={handleChange} disabled={!isIbuActive}/>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: ANAK */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right">
                            <InputField label="Nama Lengkap Anak *" name="nama" value={form.nama || form.namaAnak} onChange={handleChange}/>
                            <InputField label="NIK Anak *" name="nikAnak" value={form.nikAnak} onChange={handleChange}/>
                            <SelectField label="Jenis Kelamin *" name="gender" value={form.gender} onChange={handleChange}><option value="L">Laki-laki</option><option value="P">Perempuan</option></SelectField>
                            <InputField label="Tempat Lahir *" name="tempatLahir" value={form.tempatLahir} onChange={handleChange}/>
                            <div>
                                <InputField label="Tanggal Lahir *" name="tglLahir" type="date" value={form.tglLahir} onChange={handleChange}/>
                                {form.tglLahir && <div className="text-xs font-bold text-emerald-600 mt-1">Usia Terkini: {form.umur} Bulan</div>}
                            </div>
                            <InputField label="Nama Panggilan" name="namaPanggilan" value={form.namaPanggilan} onChange={handleChange}/>
                            <SelectField label="Golongan Darah" name="golDarah" value={form.golDarah} onChange={handleChange}><option>Tidak diketahui</option><option>A</option><option>B</option><option>AB</option><option>O</option></SelectField>
                            <InputField label="Agama" name="agama" value={form.agama} onChange={handleChange}/>
                        </div>
                    )}

                    {/* STEP 3: WILAYAH (Menggunakan Input Teks agar mudah diedit langsung) */}
                    {step === 3 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right">
                            <div className="md:col-span-2 bg-orange-50 p-4 rounded-xl border border-orange-100">
                                <h4 className="font-bold text-orange-800 text-sm mb-4 flex items-center gap-2"><MapPin size={16}/> Wilayah Administratif</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputField label="Provinsi" name="provinsi" value={form.provinsi} onChange={handleChange} />
                                    <InputField label="Kota/Kab" name="kota" value={form.kota} onChange={handleChange} />
                                    <InputField label="Kecamatan" name="kecamatan" value={form.kecamatan} onChange={handleChange} />
                                    <InputField label="Kelurahan" name="kelurahan" value={form.kelurahan} onChange={handleChange} />
                                    <InputField label="Dusun" name="dusun" value={form.dusun} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="md:col-span-2"><TextAreaField label="Alamat Lengkap" name="alamat" value={form.alamat} onChange={handleChange}/></div>
                            <div className="grid grid-cols-2 gap-6"><InputField label="RT" name="rt" value={form.rt} onChange={handleChange}/><InputField label="RW" name="rw" value={form.rw} onChange={handleChange}/></div>
                            <InputField label="Kode Pos" name="kodePos" value={form.kodePos} onChange={handleChange} />
                        </div>
                    )}

                    {/* STEP 4: EKONOMI & PENGUKURAN */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InputField label="Email Ortu" name="email" value={form.email} onChange={handleChange}/>
                                <SelectField label="Pendapatan Keluarga" name="pendapatan" value={form.pendapatan} onChange={handleChange}><option value="< 1 Juta">Kurang dari Rp 1.000.000</option><option value="1 - 2.5 Juta">Rp 1.000.000 - Rp 2.500.000</option><option value="2.5 - 5 Juta">Rp 2.500.000 - Rp 5.000.000</option><option value="> 5 Juta">Di atas Rp 5.000.000</option><option value="Tidak Tetap">Tidak Tetap</option></SelectField>
                                <SelectField label="Sumber Info" name="sumberInfo" value={form.sumberInfo} onChange={handleChange}><option>Undangan dari Puskesmas</option><option>Teman/Kerabat</option><option>Media Sosial</option><option>Lainnya</option></SelectField>
                                <TextAreaField label="Catatan Medis" name="catatan" value={form.catatan} onChange={handleChange}/>
                            </div>
                            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                                <h4 className="font-bold text-emerald-900 mb-4 flex items-center gap-2"><Activity size={18}/> Update Pengukuran Terakhir</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <InputField label="Berat (kg)" name="berat" type="number" step="0.01" value={form.berat} onChange={handleChange} className="text-center font-bold text-xl text-blue-900"/>
                                    <InputField label="Tinggi (cm)" name="tinggi" type="number" step="0.1" value={form.tinggi} onChange={handleChange} className="text-center font-bold text-xl text-blue-900"/>
                                    <InputField label="LK (cm)" name="lk" type="number" step="0.1" value={form.lk} onChange={handleChange} className="text-center font-bold text-xl text-blue-900"/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                    <div className="flex gap-2">
                        {step > 1 ? (
                            <button type="button" onClick={()=>setStep(s=>s-1)} className="px-5 py-2.5 text-gray-600 hover:text-blue-900 font-bold bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition flex items-center gap-2 shadow-sm"><ChevronLeft size={18}/> Sebelumnya</button>
                        ) : (
                            <button type="button" onClick={onClose} className="px-5 py-2.5 text-red-500 hover:text-red-700 font-bold transition hover:bg-red-50 rounded-xl">Batal</button>
                        )}
                    </div>
                    
                    <div>
                        {step < 4 ? (
                            <button type="button" onClick={()=>setStep(s=>s+1)} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition flex items-center gap-2">Selanjutnya <ChevronRight size={18}/></button>
                        ) : (
                            <button type="button" onClick={handleSave} disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition flex items-center gap-2">
                                {loading ? <RefreshCw className="animate-spin" size={18}/> : <><Save size={18}/> Simpan Perubahan</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- UNIFIED TABLE VIEW (FIXED FILTERING & LOGIC) ---
const UnifiedTableView = ({ onBack, data, title, category, notify, userRole, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState(''); 
    const [editingData, setEditingData] = useState(null); 
    const [deleteId, setDeleteId] = useState(null);
    
    // Default filter 'all'
    const [filterCondition, setFilterCondition] = useState('all');

    // FIX 1: Reset Filter otomatis saat pindah halaman/kategori
    useEffect(() => {
        setFilterCondition('all');
        setSearchTerm('');
    }, [category]);
    
    const safeData = Array.isArray(data) ? data : []; 
    
    const filteredData = safeData.filter(item => { 
        const s = (item.status || '');
        
        // 1. Filter Kategori Halaman (Sidebar Logic)
        let matchesCategory = true;

        if (category === 'normal') matchesCategory = s === 'Normal';
        if (category === 'stunting') matchesCategory = s.includes('Stunting');
        if (category === 'overweight') matchesCategory = s.includes('Overweight');
        
        if (category === 'abnormal') {
            // FIX 2: Logika Pasien Abnormal yang Benar
            // Definisi: Ada masalah, TAPI bukan kategori utama Stunting/Overweight.
            const isNormal = s === 'Normal';
            const isStunting = s.includes('Stunting');
            const isOverweight = s.includes('Overweight');
            const isWaiting = s === 'Menunggu Data' || s === 'Belum Ada Data' || s === '-';

            // Masuk abnormal jika BUKAN normal, BUKAN stunting, BUKAN overweight, dan ADA datanya
            matchesCategory = !isNormal && !isStunting && !isOverweight && !isWaiting;
        }
        // Jika category === 'all', matchesCategory tetap true (tampilkan semua)

        // 2. Filter Dropdown (Kondisi Spesifik)
        let matchesCondition = true;
        if (filterCondition !== 'all') {
             // Cek apakah string status mengandung kata kunci filter
             matchesCondition = s.includes(filterCondition); 
        }

        // 3. Search Bar
        const lowerSearch = searchTerm.toLowerCase();
        const nameMatch = (item.nama && item.nama.toLowerCase().includes(lowerSearch)) || 
                          (item.dusun && item.dusun.toLowerCase().includes(lowerSearch)) ||
                          (item.kelurahan && item.kelurahan.toLowerCase().includes(lowerSearch));
        
        return matchesCategory && matchesCondition && nameMatch; 
    });

    const handleDelete = async () => { if (!deleteId) return; try { const res = await fetch(`${API_URL}/iot-data/${deleteId}`, { method: 'DELETE' }); if (res.ok) { notify("Data Berhasil Dihapus", "success"); onRefresh(); setDeleteId(null); } else { notify("Gagal menghapus", "error"); } } catch { notify("Server Error", "error"); } };

    const renderMetricCell = (analysisItem) => {
        const ui = getMetricUI(analysisItem);
        const val = analysisItem?.value ?? '-';
        return (
            <td className="p-3 text-center">
                <div className={`flex flex-col items-center justify-center p-2 rounded-lg border ${ui.color.replace('text-','border-').replace('font-bold', '')} bg-opacity-50`}>
                    <span className="font-black text-sm">{val}</span>
                    {val !== '-' && (
                        <>
                            <span className={`text-[9px] font-bold uppercase mt-1 flex items-center gap-1 ${ui.color}`}>
                                {ui.label} {ui.icon}
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Normal: {ui.rangeText}</span>
                        </>
                    )}
                </div>
            </td>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 animate-in fade-in flex flex-col h-[85vh] shadow-lg overflow-hidden my-6">
            {(userRole === 'superadmin' || userRole === 'nakes') && (<EditModal isOpen={!!editingData} onClose={()=>setEditingData(null)} data={editingData} onRefresh={onRefresh} notify={notify} userRole={userRole}/>)}
            <ConfirmModal isOpen={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} title="Hapus Data" message="Hapus permanen?"/>
            
            <div className="p-5 border-b border-gray-200 flex justify-between bg-gray-50 items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-blue-900">{title}</h2>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">{filteredData.length} Pasien</span>
                </div>
                
                <div className="flex gap-3">
                    {/* --- FIX 3: FILTER DROPDOWN --- */}
                    {/* Tampilkan di Semua Data & Kategori khusus, KECUALI halaman Normal murni */}
                    {category !== 'normal' && (
                        <select 
                            value={filterCondition} 
                            onChange={(e) => setFilterCondition(e.target.value)} 
                            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-full px-4 py-2 outline-none focus:border-orange-500 transition font-medium shadow-sm cursor-pointer"
                        >
                            <option value="all">Semua Kondisi</option>
                            <option value="Stunting">Stunting</option>
                            <option value="Overweight">Overweight</option>
                            <option value="Gizi Kurang">Gizi Kurang (Wasting)</option>
                            <option value="Microcephaly">Microcephaly (Kepala Kecil)</option>
                            <option value="Macrocephaly">Macrocephaly (Kepala Besar)</option>
                            <option value="Tinggi Lebih">Tinggi Lebih (Jangkung)</option>
                        </select>
                    )}
                    {/* ----------------------------------- */}

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                        <input placeholder="Cari nama, dusun..." className="bg-white border border-gray-300 text-blue-900 rounded-full pl-10 pr-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition w-64 font-medium shadow-sm" onChange={e=>setSearchTerm(e.target.value)} value={searchTerm}/>
                    </div>
                    <button onClick={()=>downloadExcel(filteredData)} className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 rounded-full shadow-md transition hover:scale-105 active:scale-95 flex items-center gap-2 font-bold px-4"><Download size={18}/> Export Excel</button>
                </div>
            </div>
            
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-sm text-gray-700">
                    <thead className="bg-gray-50 text-blue-900 font-extrabold uppercase text-[10px] tracking-wider border-b border-gray-200">
                        <tr>
                            <th className="p-4">ID Reg</th><th className="p-4">Pasien</th><th className="p-4">Umur</th><th className="p-4 text-center">Berat (kg)</th><th className="p-4 text-center">Tinggi (cm)</th><th className="p-4 text-center">Kepala (cm)</th><th className="p-4 text-center">Status Gizi</th><th className="p-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.map((row, i) => (
                        <tr key={i} className="hover:bg-orange-50/50 transition-colors font-medium">
                            <td className="p-4 font-mono text-xs text-orange-600 font-bold">{row.idRegistrasi}</td>
                            <td className="p-4 font-bold text-blue-900 text-base">{row.nama || row.namaAnak}<br/><span className="text-xs text-gray-400 font-normal">{row.dusun}</span></td>
                            <td className="p-4"><span className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-xs font-bold">{row.umur} Bln</span></td>
                            {renderMetricCell(row.analysis?.berat)}
                            {renderMetricCell(row.analysis?.tinggi)}
                            {renderMetricCell(row.analysis?.lk)}
                            <td className="p-4 text-center"><StatusBadge status={row.status} /></td>
                            {(userRole === 'superadmin' || userRole === 'nakes') && (
                            <td className="p-4 text-right flex justify-end gap-2">
                                <button onClick={()=>setEditingData(row)} className="text-blue-600 hover:text-white hover:bg-blue-600 p-2 rounded-lg border border-blue-200 transition shadow-sm bg-white"><Edit size={16}/></button>
                                {userRole === 'superadmin' && <button onClick={()=>setDeleteId(row.id)} className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg border border-red-200 transition shadow-sm bg-white"><Trash size={16}/></button>}
                            </td>
                            )}
                        </tr>))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- CUSTOM INPUT STYLE (ORANGE THEME) ---
const OrangeInput = ({ label, name, type="text", value, onChange, placeholder, isPass }) => {
    const [showPassword, setShowPassword] = useState(false);
    return (
        <div className="mb-5"> {/* UBAH DARI mb-4 JADI mb-5 */}
            <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-2 ml-1">
                {label}
            </label>
            <div className="relative">
                <input 
                    type={isPass ? (showPassword ? "text" : "password") : type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder-gray-400 shadow-sm"
                    required
                    autoComplete="off"
                />
                {isPass && (
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition"
                    >
                        {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                )}
            </div>
        </div>
    );
};

// --- AUTH PAGE (FIXED OTP FLOW) ---
const AuthPage = ({ onLoginSuccess, notify, onBackToHome }) => {
    const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
    const [forgotStep, setForgotStep] = useState(1); // 1: Input Email, 2: Input OTP & Pass Baru
    const [loading, setLoading] = useState(false);
    
    // Form States (Ditambahkan otp dan newPassword)
    const [form, setForm] = useState({
        username: '', email: '', password: '', role: 'ortu', nik: '',
        otp: '', newPassword: '' // Field tambahan untuk reset
    });

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    // --- UPDATE DI App.jsx (Komponen AuthPage) ---
const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/${mode === 'login' ? 'login' : 'register'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });

        const data = await res.json();

        // VALIDASI KRUSIAL
        if (res.ok) { 
            // Hanya jalankan ini jika server kirim status 200 OK
            if (mode === 'login') {
                notify("Selamat Datang!", "success");
                onLoginSuccess(data.user);
            } else {
                notify(data.message, "success");
                setMode('login');
            }
        } else {
            // JIKA res.status adalah 403, 401, atau 500
            // Tampilkan pesan error dan JANGAN login-kan user
            notify(data.message || "Gagal masuk ke sistem", "error");
        }
    } catch (err) {
        notify("Masalah koneksi ke server", "error");
    }
};

    // --- HANDLER: STEP 1 - KIRIM OTP ---
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email })
            });
            const data = await res.json();

            if (res.ok) {
                notify("Kode OTP terkirim ke email!", "success");
                // PINDAH KE STEP 2, JANGAN BALIK KE LOGIN
                setForgotStep(2); 
            } else {
                notify(data.message || "Email tidak ditemukan", "error");
            }
        } catch (err) {
            notify("Terjadi kesalahan server", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        // Pastikan API_URL sudah benar dan endpoint-nya /reset-password
        const res = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: form.email, 
                otp: form.otp, 
                newPassword: form.newPassword 
            })
        });
        
        const data = await res.json();
        if (res.ok) {
            notify("Password Berhasil Diganti!", "success");
            setMode('login'); // Kembali ke menu login
        } else {
            notify(data.message, "error");
        }
    } catch (err) {
        notify("Gagal mereset password", "error");
    } finally {
        setLoading(false);
    }
};

    // ... (Fungsi loginToGoogle tetap sama seperti kode Anda) ...

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative font-sans">
            {/* Background & Tombol Kembali tetap sama */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-200/40 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none"></div>

            <button onClick={onBackToHome} className="absolute top-6 left-6 text-gray-500 hover:text-orange-500 flex items-center gap-2 text-sm font-bold transition bg-white px-4 py-2 rounded-full shadow-sm z-20 border border-gray-100">
                <ArrowLeft size={18}/> Kembali
            </button>

            <div className="w-full max-w-md bg-white border border-gray-100 p-8 rounded-3xl shadow-2xl relative z-10 animate-in zoom-in duration-300">
                
                {/* Logo Section */}
                <div className="text-center mb-8">
                    <img src="/SiGemar.png" className="h-32 mx-auto mb-0 object-contain drop-shadow-sm" alt="Logo"/>
                    <h2 className="text-3xl font-black text-blue-900 mb-1">
                        {mode === 'login' && 'Selamat Datang'}
                        {mode === 'register' && 'Buat Akun Baru'}
                        {mode === 'forgot' && 'Reset Password'}
                    </h2>
                </div>

                {/* --- RENDER FORM BERDASARKAN MODE --- */}
                {mode === 'login' && (
                    <form onSubmit={handleSubmit}>
                        <OrangeInput label="Username" name="username" placeholder="Contoh: budi123" value={form.username} onChange={handleChange} />
                        <OrangeInput label="Password" name="password" placeholder="••••••••" value={form.password} onChange={handleChange} isPass />
                        
                        <div className="flex justify-end -mt-2 mb-6">
                            <button type="button" onClick={() => { setMode('forgot'); setForgotStep(1); }} className="text-xs font-bold text-orange-500 hover:text-orange-600 transition">Lupa Password?</button>
                        </div>

                        <button disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 transition active:scale-95 mb-4 flex justify-center items-center gap-2">
                            {loading ? <RefreshCw className="animate-spin" size={20}/> : <>Masuk Dashboard <ArrowRight size={20}/></>}
                        </button>

                        {/* Google Login Section tetap sama */}
                        <div className="relative flex py-2 items-center mb-4">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-gray-400 uppercase">Atau masuk dengan</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <button type="button" onClick={() => loginToGoogle()} className="w-full bg-white border border-gray-200 text-gray-600 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition active:scale-95 flex items-center justify-center gap-2 mb-6">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G"/>
                            Masuk dengan Google
                        </button>

                        <div className="text-center pt-2 border-t border-gray-100">
                            <p className="text-sm text-gray-500">
                                Belum punya akun? <button type="button" onClick={() => setMode('register')} className="font-bold text-orange-500 hover:text-orange-600 transition">Daftar Sekarang!</button>
                            </p>
                        </div>
                    </form>
                )}

                {/* --- REGISTER FORM (Sama seperti kode Anda) --- */}
                {mode === 'register' && (
                    <form onSubmit={handleSubmit} className="mt-6 space-y-2">
                         {/* ... Isi form register Anda ... */}
                    </form>
                )}

                {/* --- FORGOT PASSWORD FORM (REVISED) --- */}
                {mode === 'forgot' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4">
                        {forgotStep === 1 ? (
                            <form onSubmit={handleForgotPassword}>
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        Masukkan alamat email yang terdaftar. Kami akan mengirimkan kode OTP untuk verifikasi.
                                    </p>
                                </div>
                                <OrangeInput label="Email Terdaftar" name="email" type="email" placeholder="email@contoh.com" value={form.email} onChange={handleChange} />
                                <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition active:scale-95 mb-6 flex justify-center items-center gap-2">
                                    {loading ? <RefreshCw className="animate-spin" size={20}/> : 'Kirim Kode OTP'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPassword}>
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                                    <p className="text-xs text-emerald-800 leading-relaxed">
                                        Kode OTP telah dikirim! Silakan periksa email Bunda/Ayah dan masukkan password baru.
                                    </p>
                                </div>
                                <OrangeInput label="Kode OTP" name="otp" type="text" placeholder="6 Digit OTP" value={form.otp} onChange={handleChange} />
                                <OrangeInput label="Password Baru" name="newPassword" placeholder="Min. 6 karakter" value={form.newPassword} onChange={handleChange} isPass />
                                <button disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition active:scale-95 mb-6 flex justify-center items-center gap-2">
                                    {loading ? <RefreshCw className="animate-spin" size={20}/> : 'Perbarui Password'}
                                </button>
                            </form>
                        )}
                        
                        <div className="text-center">
                            <button type="button" onClick={() => { setMode('login'); setForgotStep(1); }} className="text-sm font-bold text-gray-400 hover:text-orange-500 transition">
                                Batal, kembali ke Login
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN APP (FINAL: PERSIST LOGIN & RESPONSIVE) ---
const MainApp = () => {
  // 1. MODIFIKASI STATE: Cek LocalStorage saat inisialisasi awal
  const [currentUser, setCurrentUser] = useState(() => {
      try {
          const savedUser = localStorage.getItem('siGemarSession');
          return savedUser ? JSON.parse(savedUser) : null;
      } catch (e) {
          return null;
      }
  });

  const [activePage, setActivePage] = useState('dashboard');
  const [registerMode, setRegisterMode] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // STATE UI
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const notify = (m, t) => { setToast({ show: true, message: m, type: t }); setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000); };
  
  const fetchLogs = async () => { try { const res = await fetch(`${API_URL}/iot-data`); if(res.ok) setLogs(await res.json()); } catch {} };

  useEffect(() => { if (currentUser) { fetchLogs(); const i = setInterval(fetchLogs, 5000); return () => clearInterval(i); } }, [currentUser]);

  // 2. FUNGSI WRAPPER: LOGIN (Simpan ke Storage)
  const handleLogin = (user) => {
      localStorage.setItem('siGemarSession', JSON.stringify(user));
      setCurrentUser(user);
  };

  // 3. FUNGSI WRAPPER: LOGOUT (Hapus dari Storage)
  const handleLogout = () => {
      localStorage.removeItem('siGemarSession');
      setCurrentUser(null);
      setShowLogoutConfirm(false);
      setActivePage('dashboard'); // Reset page
  };

  // 4. FUNGSI WRAPPER: UPDATE PROFILE (Update Storage)
  const handleUpdateUser = (updatedUser) => {
      localStorage.setItem('siGemarSession', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
  };

  if (!currentUser) {
      if (showLanding) return <LandingPage onNavigateToLogin={() => setShowLanding(false)} />;
      return (
        <>
            <Toast show={toast.show} message={toast.message} type={toast.type} onClose={()=>setToast({...toast, show:false})}/>
            {/* Gunakan handleLogin disini */}
            <AuthPage onLoginSuccess={handleLogin} notify={notify} onBackToHome={() => setShowLanding(true)} />
        </>
      );
  }

  const renderContent = () => {
      // Gunakan handleUpdateUser disini
      if (activePage === 'profile') return <UserProfile user={currentUser} onUpdateUser={handleUpdateUser} notify={notify} />;
      
      if (currentUser.role === 'ortu') return <ParentDashboard logs={logs} currentUser={currentUser} activePage={activePage} />;

      if (activePage === 'user-approval') return <UserApproval notify={notify} />;
      
      if (['nakes', 'superadmin', 'kades'].includes(currentUser.role)) {
          if (currentUser.role === 'superadmin') {
              if (registerMode || activePage === 'registration') return <SuperAdminRegistration onBack={()=>{ setRegisterMode(false); setActivePage('dashboard'); }} notify={notify} onRefresh={fetchLogs}/>;
              if (activePage === 'articles') return <ArticleManager onBack={()=>setActivePage('dashboard')} notify={notify} />;
          }
          if (activePage === 'dashboard') return <DashboardHome onNavigate={setActivePage} logs={logs} refreshLogs={fetchLogs} notify={notify} userRole={currentUser.role} setRegisterMode={setRegisterMode} />;
          if (activePage.startsWith('view-')) {
             const category = activePage.replace('view-', '');
             let title = category === 'all' ? "Semua Data Pasien" : `Data Pasien ${category.charAt(0).toUpperCase() + category.slice(1)}`;
             if(category === 'abnormal') title = "Pasien Abnormal (Lainnya)";
             return <UnifiedTableView title={title} data={logs} category={category} notify={notify} userRole={currentUser.role} onRefresh={fetchLogs} />;
          }
      }
      return <DashboardHome onNavigate={setActivePage} logs={logs} refreshLogs={fetchLogs} notify={notify} userRole={currentUser.role} setRegisterMode={setRegisterMode} />;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-orange-200 selection:text-orange-900 transition-colors duration-300">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={()=>setToast({...toast, show:false})}/>
      
      {/* Gunakan handleLogout disini */}
      <ConfirmModal isOpen={showLogoutConfirm} onClose={()=>setShowLogoutConfirm(false)} onConfirm={handleLogout} title="Keluar Aplikasi" message="Apakah Anda yakin ingin keluar dari sesi ini?"/>

      <Sidebar 
        userRole={currentUser.role} 
        currentUser={currentUser}
        activePage={activePage} 
        setActivePage={setActivePage} 
        onLogout={() => setShowLogoutConfirm(true)}
        setRegisterMode={setRegisterMode}
        isExpanded={isSidebarExpanded}
        setIsExpanded={setIsSidebarExpanded}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />
      
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'md:ml-72' : 'md:ml-20'}`}>
          
          <header className="h-20 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-8 border-b border-gray-200 flex justify-between items-center shadow-sm shrink-0">
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsMobileMenuOpen(true)} 
                    className="md:hidden p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-orange-500 transition active:scale-95"
                >
                    <Menu size={24}/>
                </button>

                <div>
                    <h2 className="text-xl md:text-2xl font-black text-blue-900 capitalize truncate max-w-[200px] md:max-w-none">
                        {activePage === 'dashboard' ? 'Dashboard Utama' : (activePage === 'registration' ? 'Registrasi Baru' : activePage.replace(/-/g, ' '))}
                    </h2>
                    <p className="text-xs md:text-sm text-gray-500 font-medium mt-0.5 hidden md:block">
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            </div>

            <div className="md:hidden" onClick={() => setActivePage('profile')}>
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
                     {currentUser?.username?.substring(0,2).toUpperCase()}
                </div>
            </div>

          </header>

          <main className="p-4 md:p-8 flex-1 overflow-x-hidden">
              {renderContent()}
          </main>

          <footer className="px-8 py-4 text-center text-xs text-gray-400 border-t border-gray-200 bg-white">
              &copy; 2026 SiGemar System. All rights reserved.
          </footer>
      </div>        
    </div>
  );
};

// --- USER PROFILE COMPONENT (NEW) ---
const UserProfile = ({ user, onUpdateUser, notify }) => {
    const [formData, setFormData] = useState({
        displayName: user.displayName || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        avatar: user.avatar || ''
    });
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Handle Upload Gambar (Convert to Base64)
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500000) { // Limit 500KB agar database json tidak berat
                notify("Ukuran gambar terlalu besar (Maks 500KB)", "error");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, avatar: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username, ...formData })
            });
            const data = await res.json();
            
            if (res.ok) {
                notify("Profil berhasil diperbarui!", "success");
                onUpdateUser(data.user); // Update state global currentUser
            } else {
                notify("Gagal update profil", "error");
            }
        } catch (e) {
            notify("Terjadi kesalahan server", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Banner Dekoratif */}
                <div className="h-32 bg-gradient-to-r from-blue-600 to-cyan-500 relative"></div>
                
                <div className="px-8 pb-8">
                    {/* Header Profil (Avatar & Nama) */}
                    <div className="relative flex flex-col md:flex-row items-center md:items-end -mt-12 mb-8 gap-6">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-md">
                                {formData.avatar ? (
                                    <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover"/>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-500 font-bold text-4xl">
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {/* Tombol Kamera Overlay */}
                            <button 
                                onClick={() => fileInputRef.current.click()}
                                className="absolute bottom-2 right-2 bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-full shadow-lg transition transform hover:scale-110"
                                title="Ganti Foto"
                            >
                                <Edit size={16}/>
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleImageUpload}
                            />
                        </div>
                        
                        <div className="text-center md:text-left flex-1">
                            <h2 className="text-3xl font-black text-blue-900">{formData.displayName || user.username}</h2>
                            <p className="text-gray-500 font-medium">@{user.username} • {getRoleLabel(user.role)}</p>
                        </div>

                        <button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-md transition flex items-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20}/> : <><Save size={20}/> Simpan Perubahan</>}
                        </button>
                    </div>

                    {/* Form Edit */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2 flex items-center gap-2"><User size={20} className="text-orange-500"/> Informasi Dasar</h3>
                            <InputField 
                                label="Nama Tampilan (Display Name)" 
                                value={formData.displayName} 
                                onChange={e => setFormData({...formData, displayName: e.target.value})}
                                placeholder="Nama Lengkap Anda"
                            />
                            <TextAreaField 
                                label="Bio Singkat" 
                                value={formData.bio} 
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                placeholder="Tulis sedikit tentang diri Anda..."
                            />
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2 flex items-center gap-2"><Info size={20} className="text-blue-500"/> Kontak & Akun</h3>
                            <InputField 
                                label="Email" 
                                type="email"
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                placeholder="contoh@email.com"
                            />
                            <InputField 
                                label="Nomor Handphone" 
                                type="tel"
                                value={formData.phone} 
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                placeholder="08..."
                            />
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Username (Tidak dapat diubah)</p>
                                <p className="font-mono text-gray-700 font-bold">{user.username}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Role Akses</p>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRoleColor(user.role)}`}>
                                    {getRoleLabel(user.role)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Tambahkan UserCheck, UserX ke dalam list import Lucide di paling atas file jika belum ada
const UserApproval = ({ notify }) => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const fetchPending = async () => {
        try {
            const res = await fetch(`${API_URL}/users/pending`);
            if (res.ok) setPendingUsers(await res.json());
        } catch (e) { notify("Gagal memuat antrean", "error"); }
    };
    useEffect(() => { fetchPending(); }, []);

    const handleAction = async (id, action) => {
        const endpoint = action === 'approve' ? `/users/approve/${id}` : `/users/reject/${id}`;
        try {
            const res = await fetch(`${API_URL}${endpoint}`, { method: action === 'approve' ? 'PUT' : 'DELETE' });
            if (res.ok) {
                notify(action === 'approve' ? "Akun Berhasil Aktif!" : "Akun Berhasil Dihapus", "success");
                fetchPending();
            }
        } catch (e) { notify("Gagal memproses", "error"); }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xl font-black text-blue-900 flex items-center gap-2"><ShieldCheck className="text-orange-500" /> Persetujuan Akun Baru</h2>
                <p className="text-sm text-gray-500 mt-1">Verifikasi akun perangkat desa atau nakes sebelum mereka bisa masuk ke sistem.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-gray-50">
                        {pendingUsers.length === 0 ? (
                            <tr><td className="p-10 text-center text-gray-400 font-medium">Tidak ada antrean persetujuan.</td></tr>
                        ) : (
                            pendingUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4">
                                        <div className="font-bold text-blue-900">{u.full_name || u.username}</div>
                                        <div className="text-[10px] text-gray-400">{u.email}</div>
                                    </td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getRoleColor(u.role)}`}>{getRoleLabel(u.role)}</span></td>
                                    <td className="p-4 font-mono text-xs">{u.nik || '-'}</td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handleAction(u.id, 'reject')} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Tolak"><Trash size={18}/></button>
                                        <button onClick={() => handleAction(u.id, 'approve')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs transition shadow-sm">Setujui</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const App = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MainApp />
    </GoogleOAuthProvider>
  );
};

export default App;