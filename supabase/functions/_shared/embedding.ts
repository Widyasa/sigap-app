/**
 * Embedding lokal 384 dimensi via model bawaan Supabase Edge Runtime
 * (`gte-small`). Tidak ada API key pihak ketiga dan tidak ada panggilan
 * jaringan keluar — berjalan di dalam runtime edge itu sendiri.
 */

// `Supabase` adalah global yang disuntikkan oleh Supabase Edge Runtime saat
// deploy; tidak tersedia untuk `deno check`/`deno test` lokal, jadi
// dideklarasikan di sini agar berkas ini tetap type-check.
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(
        input: string,
        options: { mean_pool: boolean; normalize: boolean },
      ): Promise<number[]>;
    };
  };
};

let session: InstanceType<typeof Supabase.ai.Session> | null = null;

function getSession() {
  if (!session) session = new Supabase.ai.Session('gte-small');
  return session;
}

/** Menghitung embedding 384 dimensi dari teks bebas (deskripsi aduan, dll). */
export async function computeEmbedding(text: string): Promise<number[]> {
  const embedding = await getSession().run(text, { mean_pool: true, normalize: true });
  if (!Array.isArray(embedding) || embedding.length !== 384) {
    throw new Error(`Embedding tidak valid: dimensi ${embedding?.length ?? 'unknown'}, bukan 384`);
  }
  return embedding;
}
