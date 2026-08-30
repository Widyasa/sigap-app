import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.3';
import { verifyAccessToken } from '../_shared/jwt.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  generateVerificationCode,
  buildVerificationUrl,
  formatLetterFields,
  SERVICE_TITLES,
  type ServiceType,
} from '../_shared/servicePdf.ts';

function corsHeaders(origin = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

const SERVICE_DOCS_BUCKET = 'service-docs';
const STAFF_ROLES = ['verifier', 'dinas_staff', 'dinas_head', 'admin'];

interface ServiceRequestRow {
  id: string;
  user_id: string;
  service_type: ServiceType;
  form_data: Record<string, unknown>;
  status: string;
  verification_code: string | null;
}

/** Merakit byte PDF surat: judul, field-field form, dan QR verifikasi. */
async function buildPdfBytes(
  request: ServiceRequestRow,
  verificationUrl: string,
): Promise<Uint8Array> {
  const qrDataUrl: string = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 240 });
  const qrPngBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), (c) => c.charCodeAt(0));

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 60;
  let y = 780;

  page.drawText('PEMERINTAH KOTA BANDUNG', {
    x: marginX, y, size: 12, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= 16;
  page.drawText('SISTEM INFORMASI GEBRAKAN APLIKASI PUBLIK (SIGAP)', {
    x: marginX, y, size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2),
  });
  y -= 8;
  page.drawLine({
    start: { x: marginX, y }, end: { x: 595 - marginX, y },
    thickness: 1.5, color: rgb(0, 0, 0),
  });
  y -= 30;

  const title = SERVICE_TITLES[request.service_type];
  const titleWidth = fontBold.widthOfTextAtSize(title, 14);
  page.drawText(title, {
    x: (595 - titleWidth) / 2, y, size: 14, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= 18;
  const codeLine = `Nomor: ${request.verification_code}`;
  const codeWidth = fontRegular.widthOfTextAtSize(codeLine, 10);
  page.drawText(codeLine, {
    x: (595 - codeWidth) / 2, y, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3),
  });
  y -= 36;

  page.drawText('Yang bertanda tangan di bawah ini menerangkan bahwa data berikut adalah benar:', {
    x: marginX, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
  });
  y -= 24;

  for (const field of formatLetterFields(request.service_type, request.form_data)) {
    page.drawText(field.label, { x: marginX, y, size: 11, font: fontRegular });
    page.drawText(':', { x: marginX + 160, y, size: 11, font: fontRegular });
    page.drawText(field.value, { x: marginX + 175, y, size: 11, font: fontBold });
    y -= 20;
  }

  y -= 20;
  page.drawText('Surat ini diterbitkan secara elektronik dan sah tanpa tanda tangan basah.', {
    x: marginX, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4),
  });
  page.drawText('Keasliannya dapat diverifikasi lewat kode QR di bawah ini.', {
    x: marginX, y: y - 12, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4),
  });

  const qrImage = await pdfDoc.embedPng(qrPngBytes);
  const qrSize = 120;
  page.drawImage(qrImage, { x: marginX, y: y - 12 - qrSize - 10, width: qrSize, height: qrSize });

  return pdfDoc.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  let body: { serviceRequestId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_body' }, 400);
  }

  const serviceRequestId = body.serviceRequestId;
  if (!serviceRequestId || typeof serviceRequestId !== 'string') {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let callerId: string;
  try {
    const payload = await verifyAccessToken(token);
    callerId = payload.sub;
  } catch {
    return jsonResponse({ ok: false, reason: 'session_expired' }, 401);
  }

  const supabase = getServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single();

  if (profileError || !profile) {
    return jsonResponse({ ok: false, reason: 'session_expired' }, 401);
  }
  const callerRole = profile.role;

  const { data: request, error: fetchError } = await supabase
    .from('service_requests')
    .select('id, user_id, service_type, form_data, status, verification_code')
    .eq('id', serviceRequestId)
    .single();

  if (fetchError || !request) {
    return jsonResponse({ ok: false, reason: 'not_found' }, 404);
  }

  const isOwner = request.user_id === callerId;
  const isStaff = STAFF_ROLES.includes(callerRole);
  if (!isOwner && !isStaff) {
    return jsonResponse({ ok: false, reason: 'forbidden' }, 403);
  }

  // Alur status: staff menyetujui (verifying -> signing lewat service_staff_update),
  // fungsi ini dipanggil pada status 'signing' untuk menerbitkan dokumen ->
  // 'ready'. Idempoten pada baris yang sudah 'ready' dengan output_pdf_url
  // supaya tombol "Terbitkan ulang" tidak menerbitkan kode ganda.
  if (request.status !== 'signing' && request.status !== 'ready') {
    return jsonResponse({ ok: false, reason: 'invalid_status' }, 200);
  }

  const webBaseUrl = Deno.env.get('SIGAP_WEB_BASE_URL') ?? 'http://127.0.0.1:3000';

  try {
    const verificationCode = request.verification_code ?? generateVerificationCode();
    const verificationUrl = buildVerificationUrl(webBaseUrl, verificationCode);
    const pdfBytes = await buildPdfBytes(
      { ...request, verification_code: verificationCode },
      verificationUrl,
    );

    const pdfPath = `${request.user_id}/surat-${request.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(SERVICE_DOCS_BUCKET)
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('service_requests')
      .update({
        status: 'ready',
        verification_code: verificationCode,
        output_pdf_url: pdfPath,
        completed_at: new Date().toISOString(),
      })
      .eq('id', request.id);
    if (updateError) throw updateError;

    return jsonResponse({ ok: true, verificationCode, pdfPath });
  } catch (e) {
    console.error('generate-service-pdf error', e);
    return jsonResponse({ ok: false, reason: 'generation_failed' }, 200);
  }
});
