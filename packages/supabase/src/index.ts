export { createSigapClient } from './client';
export type { Database } from './database.types';
export {
  createComplaint,
  uploadComplaintPhoto,
  uploadProgressPhoto,
  upvoteComplaint,
  listFeedComplaints,
  getComplaint,
  listComplaintTimeline,
  listMyUpvotedComplaintIds,
  isDuplicateUpvoteError,
  listComplaintsForVerifier,
  listComplaintsForDinas,
  listActiveComplaintsAllDinas,
  isValidClassificationTransition,
  updateComplaintClassification,
  updateComplaintStatus,
  getMyComplaintSummary,
} from './queries/complaints';
export type {
  ComplaintAuthorProfile,
  FeedComplaint,
  ComplaintDetail,
  TimelineEntry,
  VerifierComplaint,
  DinasComplaint,
  UpdateComplaintClassificationInput,
  UpdateComplaintStatusInput,
  ComplaintSummary,
} from './queries/complaints';
export {
  getActiveVotingPeriod,
  listVotingPeriods,
  createVotingPeriod,
  setVotingPeriodActive,
  listAspirations,
  listAspirationsByKecamatan,
  createAspiration,
  voteAspiration,
  unvoteAspiration,
  isVoteDeniedError,
  isDuplicateVoteError,
  listMyVotedAspirationIds,
  getAspirationDetail,
  listBudgetItemsForLinking,
  listAspirationsForReview,
  updateAspirationStatus,
} from './queries/aspirations';
export type {
  VotingPeriod,
  AspirationSummary,
  AspirationAuthorProfile,
  BudgetItemInfo,
  AspirationDetail,
  BudgetItemOption,
  UpdateAspirationStatusInput,
} from './queries/aspirations';
export {
  listBudgetSummaryByDinas,
  listBudgetSummaryBySector,
  listBudgetItemsByDinas,
  getBudgetItemDetail,
  getAspirationBudgetSummary,
  listBudgetIndexStatus,
  budgetItemEmbeddingText,
  askBudget,
  embedBudgetItemText,
  importBudgetItems,
} from './queries/budget';
export type {
  BudgetSummaryByDinas,
  BudgetSectorSummary,
  AspirationBudgetSummary,
  BudgetItemListEntry,
  BudgetItemDetail,
  BudgetIndexStatus,
  AskBudgetCitedItem,
  AskBudgetResponse,
  EmbedBudgetItemResponse,
  BudgetItemImportRow,
} from './queries/budget';
export {
  uploadServiceDocument,
  getServiceRequestSignedUrl,
  createServiceRequest,
  listMyServiceRequests,
  getServiceRequest,
  runOcr,
  generateServicePdf,
  listServiceRequestsForReview,
  updateServiceRequestStatus,
  verifyServiceDocument,
} from './queries/services';
export type {
  ServiceRequestSummary,
  OcrField,
  OcrResponse,
  GenerateServicePdfResponse,
  UpdateServiceRequestStatusInput,
  VerifyServiceDocumentResult,
} from './queries/services';
export {
  uploadEmergencyAudio,
  getEmergencyAlertSignedAudioUrl,
  createEmergencyAlert,
  getMyActiveEmergencyAlert,
  getEmergencyAlert,
  listActiveEmergencyAlerts,
  respondToEmergencyAlert,
  resolveEmergencyAlert,
  markFalseAlarm,
  cancelEmergencyAlert,
  attachEmergencyAudio,
  updateOwnEmergencyLocation,
  findActiveOperatorContact,
} from './queries/emergency';
export type { EmergencyAlertSummary } from './queries/emergency';
export {
  listAnnouncements,
  getAnnouncement,
  markAnnouncementAsRead,
  markAllAnnouncementsAsRead,
  listAnnouncementsForAdmin,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  listLeaderboard,
  refreshLeaderboard,
  listCitizenLeaderboard,
  getMyPointLedger,
  getUserTotalPoints,
  getProfileStats,
} from './queries/community';
export type {
  Announcement,
  AnnouncementCategoryId,
  KelurahanLeaderboardEntry,
  CitizenLeaderboardEntry,
  LeaderboardTimeFilter,
  PointLedgerEntry,
  ProfileStats,
} from './queries/community';

export { listStaffUsers, setUserDisabled, updateUserRole } from './queries/admin';
export type { StaffUser } from './queries/admin';

export {
  getRingkasanStats,
  getSlaComplianceDaily,
  getPendingDecisions,
  getComplaintCategoryBreakdown,
  listComplaintsForRingkasan,
} from './queries/dashboard';
export type {
  RingkasanScope,
  RingkasanStats,
  SlaComplianceDay,
  PendingDecision,
  ComplaintCategoryBreakdown,
  RingkasanComplaintRow,
} from './queries/dashboard';