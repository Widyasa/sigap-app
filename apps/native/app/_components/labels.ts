// Label tampilan kini tinggal di `@repo/shared/labels` supaya aplikasi warga
// dan dashboard petugas memakai kata yang sama persis (dulu `in_progress`
// tertulis "Sedang Diproses" di sini tapi "Ditindaklanjuti" di web).
// Berkas ini hanya meneruskannya agar impor yang sudah ada tetap jalan.
export {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ASPIRATION_STATUS_LABELS,
  CATEGORY_LABELS,
  EMERGENCY_STATUS_LABELS,
  EMERGENCY_TYPE_LABELS,
  POINT_REASON_LABELS,
  SERVICE_STATUS_LABELS,
  TIMELINE_EVENT_LABELS,
  URGENCY_LABELS,
  categoryLabel,
  dinasName,
  COMPLAINT_STATUS_LABELS as STATUS_LABELS,
} from '@repo/shared';
