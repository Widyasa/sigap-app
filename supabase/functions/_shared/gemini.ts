/**
 * Klien tipis untuk Gemini `generateContent` API. Tidak ada logika bisnis di
 * sini — hanya pembungkus jaringan (lihat classification.ts untuk logika
 * murni yang diuji unit).
 */

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Meminta Gemini menjawab satu prompt sebagai objek JSON, mengembalikan teks mentahnya. */
export async function callGeminiJson(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== 'string' || !content) {
    throw new Error('Gemini API mengembalikan respons kosong');
  }
  return content;
}
