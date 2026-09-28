// Display labels shared by server and client components.

export const LEAD_STAGES = [
  "NEW_LEAD", "CONTACT_ATTEMPTED", "CONTACTED", "REQUIREMENT_DISCUSSED",
  "SITE_VISIT_SCHEDULED", "SITE_VISIT_COMPLETED", "PROPOSAL_DESIGN",
  "QUOTATION_SENT", "NEGOTIATION", "CONVERTED", "LOST",
] as const;

export const LEAD_STAGE_LABEL: Record<string, string> = {
  NEW_LEAD: "New Lead", CONTACT_ATTEMPTED: "Contact Attempted", CONTACTED: "Contacted",
  REQUIREMENT_DISCUSSED: "Requirement Discussed", SITE_VISIT_SCHEDULED: "Site Visit Scheduled",
  SITE_VISIT_COMPLETED: "Site Visit Completed", PROPOSAL_DESIGN: "Proposal / Design",
  QUOTATION_SENT: "Quotation Sent", NEGOTIATION: "Negotiation", CONVERTED: "Converted", LOST: "Lost",
};

export const LEAD_SOURCES = ["INSTAGRAM", "FACEBOOK_ADS", "GOOGLE", "WEBSITE", "WHATSAPP", "REFERRAL", "WALK_IN", "EXISTING_CLIENT", "JUSTDIAL", "OTHER"] as const;
export const FOLLOWUP_TYPES = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "SITE_VISIT", "VIDEO_CALL"] as const;
export const PROPERTY_TYPES = ["1 BHK Apartment", "2 BHK Apartment", "3 BHK Apartment", "4 BHK Apartment", "Villa", "Independent House", "Office", "Retail / Showroom", "Other"];

export const PROJECT_STAGES = ["PLANNING", "DESIGN", "APPROVAL", "PRODUCTION", "PROCUREMENT", "EXECUTION", "INSTALLATION", "HANDOVER", "COMPLETED"] as const;
export const INVOICE_TYPES = ["ADVANCE", "STAGE_WISE", "FINAL", "CUSTOM"] as const;
export const PAYMENT_METHODS = ["UPI", "BANK_TRANSFER", "CASH", "CHEQUE", "CARD", "OTHER"] as const;

/** "BANK_TRANSFER" → "Bank transfer" */
export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");

/** Value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
