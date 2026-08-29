# AI Contracts & Prompts

Package untuk kontrak prompt, respons AI, dan kegagalan AI yang dipakai Edge Function klasifikasi, RAG anggaran, OCR dokumen, dan draf jawaban dinas.

## Language

**Klasifikasi AI**: Proses menentukan dinas, kategori, urgensi, judul, dan ringkasan aduan dari deskripsi warga.
_Avoid_: triase (hanya istilah internal).

**Embedding**: Representasi vektor 384 dimensi dari teks untuk deteksi duplikat dan pencarian anggaran.
_Avoid_: vektor (terlalu umum).

**RAG**: Retrieval Augmented Generation — menjawab pertanyaan anggaran berdasarkan data yang diambil dari database, bukan ingatan model.
_Avoid_: AI chat.

**OCR**: Pembacaan teks dokumen identitas KTP/KK oleh model vision.
_Avoid_: pemindaian.

**Jalur Kegagalan**: Jalur aplikasi saat AI tidak tersedia yang tetap menyimpan data pengguna dan menampilkan pesan tenang.
_Avoid_: fallback (terlalu teknis).

**Confidence**: Tingkat kepercayaan model terhadap klasifikasi yang dihasilkannya, dari 0 sampai 1.
_Avoid_: skor kepercayaan.
