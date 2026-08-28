import coreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * Next.js 16 menghapus perintah `next lint`, dan ESLint 9 tidak lagi membaca
 * `.eslintrc.json` secara default — konfigurasi lama repo ini gagal total
 * ("Converting circular structure to JSON") sehingga lint praktis tidak
 * pernah berjalan. Berkas ini adalah flat config penggantinya; skrip
 * `npm run lint -w web` sekarang memanggil `eslint` langsung.
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...coreWebVitals,
  {
    rules: {
      // Aturan React Compiler ini menandai pola "fetch di useEffect lalu
      // setState" yang dipakai hampir semua halaman dashboard. Itu memang
      // pantas ditinjau, tapi bukan galat yang boleh menghentikan CI —
      // diturunkan ke peringatan sampai halaman-halaman itu dipindahkan ke
      // pola pengambilan data yang lain.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];

export default config;
