/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // --- TAMBAHKAN BAGIAN INI ---
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' }, // Keadaan normal
          '50%': { transform: 'scale(1.05)', opacity: '1' },    // Sedikit membesar & lebih terang
        }
      },
      animation: {
        // Nama class: keyframe durasi fungsi-waktu pengulangan
        breathe: 'breathe 4s ease-in-out infinite', 
        // 'breathe-slow': 'breathe 6s ease-in-out infinite', // Opsi jika ingin lebih lambat
      }
      // ---------------------------
    },
  },
  plugins: [],
}