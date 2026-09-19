"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// career-desk/src/lib/career.ts
var career_exports = {};
__export(career_exports, {
  defaultAutomation: () => defaultAutomation,
  draftLetter: () => draftLetter,
  evidence: () => evidence,
  initialProfile: () => initialProfile,
  matchJob: () => matchJob,
  safeUrl: () => safeUrl
});
module.exports = __toCommonJS(career_exports);
var defaultAutomation = { enabled: false, autoApply: false, profileConfirmed: false, telegramEnabled: false, intervalHours: 6, dailyLimit: 15, roles: "accountant,accounting,finance,payroll,bookkeeper", locations: "*", lastRun: null, lastError: "", attempts: [] };
var initialProfile = { name: "Clinton Ouma Ooremo", email: "clintoniremo@gmail.com", phone: "+254 745 313 247", location: "Nairobi, Kenya", targets: "Accountant, Finance Officer, Finance and Administration Manager, Payroll Accountant, ERP Finance", geography: "Kenya; remote roles open to Kenya", cpa: "unconfirmed", summary: "I am a finance and administration professional with a Bachelor of Business Administration (Accounting) from the University of Eastern Africa, Baraton. My experience covers financial reporting, budgeting, cash-flow management, accounts payable and receivable, payroll, statutory compliance, NGO reporting and accounting systems." };
var evidence = [
  { skill: "Financial reporting", pattern: "financial report|financial statement|month.end|general ledger", claim: "I have prepared management reporting packs, financial statements and cash-flow reports, with variance analysis to support management decisions." },
  { skill: "Budgeting & forecasting", pattern: "budget|forecast|financial model", claim: "My finance responsibilities include annual budgeting, cash-flow forecasting, cost analysis and financial modelling." },
  { skill: "Payroll", pattern: "payroll|salary processing", claim: "At Nasio Trust Kenya and in my subsequent finance roles, I have processed payroll and prepared statutory deductions and submissions." },
  { skill: "Tax & statutory compliance", pattern: "tax|compliance|vat|paye|statutory", claim: "I have handled Kenyan statutory returns and submissions, including VAT, PAYE and withholding tax, alongside tax and customs work at the Kenya Revenue Authority." },
  { skill: "Accounts payable & receivable", pattern: "payable|receivable|reconcil|debtor|collections", claim: "My work includes invoicing, supplier reconciliations, debtor follow-up, aging reports and cash-flow management." },
  { skill: "QuickBooks", pattern: "quickbooks", claim: "I have used QuickBooks for transaction posting, inventory accounting and financial reporting." },
  { skill: "Zoho Books", pattern: "zoho", claim: "I have used Zoho Books to maintain accounting records and support daily finance operations." },
  { skill: "Excel", pattern: "excel|spreadsheet", claim: "My accounting work is supported by advanced Microsoft Excel skills and formal training in accounting packages." },
  { skill: "NGO & donor reporting", pattern: "ngo|donor|grant|non.profit", claim: "At Nasio Trust Kenya, I prepared donor project reports, fund reports and hospital financial statements, including presentations to donors." },
  { skill: "ERP & systems", pattern: "erp|systems|software|technology", claim: "Alongside my finance work, I contributed to the Zuriel Solutions platform, translating accounting and operational workflows into requirements for rental, fleet and bookkeeping modules." }
];
function matchJob(job) {
  const text = job.title + " " + job.description;
  return evidence.filter((e) => new RegExp(e.pattern, "i").test(text));
}
function draftLetter(job, profile) {
  const selected = matchJob(job).slice(0, 4);
  const degree = /bachelor/i.test(profile.summary) ? "" : "I hold a Bachelor of Business Administration in Accounting from the University of Eastern Africa, Baraton.";
  const cpa = profile.cpa === "completed" ? " I have completed the CPA qualification." : profile.cpa === "in-progress" ? " I am pursuing the CPA qualification." : "";
  return `Dear Hiring Team,

I am applying for the ${job.title} position at ${job.company}. ${profile.summary}

${selected.length ? selected.map((s) => s.claim).join(" ") : "My background includes managing finance operations, maintaining accounting records and supporting financial reporting across technology, NGO and government settings."}

${degree}${cpa}

I would welcome the opportunity to discuss how my finance and systems experience could contribute to your team. Thank you for considering my application.

Kind regards,
${profile.name}
${profile.email}
${profile.phone}`;
}
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  defaultAutomation,
  draftLetter,
  evidence,
  initialProfile,
  matchJob,
  safeUrl
});
