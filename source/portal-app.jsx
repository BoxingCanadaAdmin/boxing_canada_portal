
const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } = React;

/* =========================================================
   Dates & helpers (reference date fixed for the demo)
   ========================================================= */
const REF_DATE = (typeof window !== 'undefined' && window.BCP_WP && window.BCP_WP.refDate) || '2026-10-24';
const REF_NOW = (typeof window !== 'undefined' && window.BCP_WP && window.BCP_WP.liveClock) ? Date.now() : Date.parse(REF_DATE + 'T12:00:00');
const DAY = 86400000;
const toUTC = d => Date.parse(d + 'T00:00:00Z');
const addDays = (d, n) => new Date(toUTC(d) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);
let UI_LANG = 'en';
const uiLocale = () => UI_LANG === 'fr' ? 'fr-CA' : 'en-CA';
const fmtDate = d => d ? new Date(toUTC(d.slice(0, 10))).toLocaleDateString(uiLocale(), { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtTime = t => t ? t.slice(0, 5) : '—';
const fmtDT = dt => { if (!dt) return '—'; const [d, t] = dt.split('T'); return fmtDate(d) + ', ' + fmtTime(t); };
const fmtMs = ms => new Date(ms).toLocaleString(uiLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtStamp = iso => iso ? new Date(iso).toLocaleString(uiLocale(), { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const ageOn = (dob, date) => { const a = new Date(toUTC(dob)), b = new Date(toUTC(date)); let y = b.getUTCFullYear() - a.getUTCFullYear(); const m = b.getUTCMonth() - a.getUTCMonth(); if (m < 0 || (m === 0 && b.getUTCDate() < a.getUTCDate())) y--; return y; };
const uid = p => p + '-' + Math.random().toString(36).slice(2, 8);
const fullName = u => u ? u.firstName + ' ' + u.lastName : '—';
const cx = (...a) => a.filter(Boolean).join(' ');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nowIso = () => new Date().toISOString();

/* =========================================================
   Roles, tabs & RBAC
   ========================================================= */
const ROLES = {
  boxer:      { emoji: '🥊', label: 'Boxer', title: 'Boxer: Personal Record Book & Readiness Portal', tabs: ['DASHBOARD', 'EVENTS', 'TRAVEL', 'DOCS'], defaultTab: 'DASHBOARD' },
  coach:      { emoji: '📋', label: 'Coach', title: 'Coach: Manage Boxers, Competition Forms, and Sanction Requests', tabs: ['DASHBOARD', 'EVENTS', 'SANCTIONS', 'TRAVEL', 'DOCS'], defaultTab: 'DASHBOARD' },
  official:   { emoji: '⚖️', label: 'Official', title: 'Official: Technical Official & Supervisor Portal', tabs: ['EVENTS', 'SANCTIONS', 'TRAVEL', 'DOCS'], defaultTab: 'EVENTS' },
  medical:    { emoji: '🩺', label: 'Medical Official', title: 'Medical Official: Ringside Physician & Medical Clearance Console', tabs: ['EVENTS', 'DASHBOARD', 'DOCS'], defaultTab: 'EVENTS' },
  ptso:       { emoji: '🏛️', label: 'PTSO Administrator', title: 'PTSO Administrator: Provincial Administration & Sanction Approval Portal', tabs: ['SANCTIONS', 'TRAVEL', 'EVENTS', 'DASHBOARD', 'USERS', 'DOCS'], defaultTab: 'SANCTIONS' },
  nsoadmin: { emoji: '🍁', label: 'NSO Administrator', title: 'NSO Administrator: Boxing Canada National Console', tabs: ['DASHBOARD', 'EVENTS', 'SANCTIONS', 'TRAVEL', 'USERS', 'DOCS'], defaultTab: 'DASHBOARD' }
};
const TAB_LABELS = {
  boxer:      { DASHBOARD: 'My Record Book', EVENTS: 'My Events' },
  coach:      { DASHBOARD: 'Coach Dashboard', EVENTS: 'Competition Events', SANCTIONS: 'Event Sanction Requests' },
  official:   { EVENTS: 'Assigned Events & Bouts', SANCTIONS: 'Event Sanction Requests' },
  medical:    { EVENTS: 'Competition Events', DASHBOARD: 'Athlete Record Books' },
  ptso:       { SANCTIONS: 'PTSO Sanction Approvals', EVENTS: 'Competition Events', DASHBOARD: 'Athlete Record Books', MEDICALS: 'Pre-bout and Post-bout Medical Checks', USERS: 'Members & Approvals' },
  nsoadmin: { DASHBOARD: 'National Overview', EVENTS: 'Competition Events', SANCTIONS: 'Sanction Approvals', MEDICALS: 'Pre-bout and Post-bout Medical Checks', USERS: 'Members & Approvals' }
};
Object.values(TAB_LABELS).forEach(t => { t.TRAVEL = 'International Travel Passes'; t.DOCS = 'Documents'; });
TAB_LABELS.ptso.DOCS = TAB_LABELS.nsoadmin.DOCS = 'Document Library';
Object.values(ROLES).forEach(r => { r.tabs.splice(r.tabs.indexOf('DOCS'), 0, 'CALENDAR'); r.tabs.push('ORGS'); });
Object.values(TAB_LABELS).forEach(t => { t.ORGS = 'Boxing Canada & PTSOs'; });
ROLES.boxer.tabs.splice(ROLES.boxer.tabs.indexOf('EVENTS') + 1, 0, 'COACHES');
ROLES.coach.tabs.splice(ROLES.coach.tabs.indexOf('DASHBOARD') + 1, 0, 'BOXERS');
TAB_LABELS.coach.BOXERS = 'My Boxers';
TAB_LABELS.coach.CLUB = TAB_LABELS.official.CLUB = 'Club Manager';
Object.keys(ROLES).forEach(k => { const t = ROLES[k].tabs; if (!t.includes('SAFESPORT')) t.splice(t.indexOf('DOCS'), 0, 'SAFESPORT'); TAB_LABELS[k].SAFESPORT = 'Safe Sport'; });
TAB_LABELS.boxer.COACHES = 'My Coaches';
['coach', 'official'].forEach(k => { const t = ROLES[k].tabs; t.splice(t.indexOf('CALENDAR'), 0, 'EVALS'); });
['nsoadmin', 'ptso'].forEach(k => { const t = ROLES[k].tabs; t.splice(t.indexOf('CALENDAR'), 0, 'COACHPROG', 'OFFPROG'); });
TAB_LABELS.coach.EVALS = TAB_LABELS.official.EVALS = 'Certification & Evaluations';
TAB_LABELS.nsoadmin.COACHPROG = TAB_LABELS.ptso.COACHPROG = 'Coach Programs';
TAB_LABELS.nsoadmin.OFFPROG = TAB_LABELS.ptso.OFFPROG = 'Officials Programs';
TAB_LABELS.coach.EVALUATOR = TAB_LABELS.official.EVALUATOR = TAB_LABELS.nsoadmin.EVALUATOR = TAB_LABELS.ptso.EVALUATOR = 'Evaluation Assignments';
Object.values(TAB_LABELS).forEach(t => { t.CALENDAR = 'Calendar'; });
const isAdmin = u => u && (u.role === 'ptso' || u.role === 'nsoadmin');
// Medical practitioner examinations: recorded and signed by Medical Officials (and PTSO Administrators). NSO Administrators can view but not change them.
const canClinical = u => u && (u.role === 'medical' || u.role === 'ptso');
const ID_PREFIX = { boxer: 'BC-2026-', coach: 'BC-COA-', official: 'BC-OFF-', medical: 'BC-MED-', ptso: 'BC-PTSO-', nsoadmin: 'BC-NSO-' };

/* =========================================================
   Provinces & territories (PROVINCE_INFO)
   Organisation names, agencies and contacts are demo placeholders —
   confirm against each PTSO before production use.
   ========================================================= */
const PROVINCE_INFO = {
  AB: { name: 'Alberta', ptso: 'Boxing Alberta', email: 'sanctions@boxingalberta.example', college: 'College of Physicians & Surgeons of Alberta (CPSA)', liquor: 'Alberta Gaming, Liquor and Cannabis (AGLC)', gaming: 'Alberta Gaming, Liquor and Cannabis (AGLC)', combative: 'municipal combative sports commissions and bylaws in force in Alberta', clubs: [['North', 'Capital City Boxing Club'], ['North', 'Northern Lights Boxing'], ['Central', 'Red Deer Boxing Academy'], ['South', 'Bow Valley Boxing Club'], ['South', 'Prairie Fist Athletics']] },
  BC: { name: 'British Columbia', ptso: 'Boxing BC', email: 'sanctions@boxingbc.example', college: 'College of Physicians and Surgeons of British Columbia (CPSBC)', liquor: 'Liquor and Cannabis Regulation Branch (LCRB)', gaming: 'Gaming Policy and Enforcement Branch (GPEB)', combative: 'municipal athletic commissions and bylaws in force in British Columbia', clubs: [['Lower Mainland', 'Pacific Gate Boxing Club'], ['Lower Mainland', 'Fraser Valley Boxing'], ['Vancouver Island', 'Island Tide Boxing Club'], ['Interior', 'Okanagan Ring Club']] },
  MB: { name: 'Manitoba', ptso: 'Boxing Manitoba', email: 'sanctions@boxingmanitoba.example', college: 'College of Physicians & Surgeons of Manitoba (CPSM)', liquor: 'Liquor, Gaming and Cannabis Authority of Manitoba (LGCA)', gaming: 'Liquor, Gaming and Cannabis Authority of Manitoba (LGCA)', combative: 'the Manitoba Combative Sports Commission rules and municipal bylaws', clubs: [['Winnipeg', 'Red River Boxing Club'], ['Winnipeg', 'Forks Boxing Academy'], ['Westman', 'Brandon Boxing Club']] },
  NB: { name: 'New Brunswick', ptso: 'Boxing New Brunswick', email: 'sanctions@boxingnb.example', college: 'College of Physicians and Surgeons of New Brunswick (CPSNB)', liquor: 'Financial and Consumer Services Commission / Alcool NB Liquor', gaming: 'New Brunswick Gaming Control Branch', combative: 'municipal combative sport bylaws in force in New Brunswick', clubs: [['South', 'Saint John Harbour Boxing'], ['East', 'Moncton Tidal Boxing Club'], ['North', 'Bathurst Boxing Club']] },
  NL: { name: 'Newfoundland and Labrador', ptso: 'Boxing Newfoundland and Labrador', email: 'sanctions@boxingnl.example', college: 'College of Physicians and Surgeons of Newfoundland and Labrador (CPSNL)', liquor: 'Newfoundland and Labrador Liquor Corporation', gaming: 'Digital Government and Service NL (Lotteries Licensing)', combative: 'municipal combative sport bylaws in force in Newfoundland and Labrador', clubs: [['Avalon', 'St. John’s Boxing Club'], ['Western', 'Corner Brook Boxing'], ['Labrador', 'Big Land Boxing Club']] },
  NS: { name: 'Nova Scotia', ptso: 'Boxing Nova Scotia', email: 'sanctions@boxingns.example', college: 'College of Physicians and Surgeons of Nova Scotia (CPSNS)', liquor: 'Alcohol, Gaming, Fuel and Tobacco Division', gaming: 'Alcohol, Gaming, Fuel and Tobacco Division', combative: 'the Nova Scotia Combat Sport Authority rules', clubs: [['Halifax', 'Harbour City Boxing Club'], ['Cape Breton', 'Cape Breton Boxing Academy'], ['Valley', 'Annapolis Valley Boxing']] },
  NT: { name: 'Northwest Territories', ptso: 'Boxing NWT', email: 'sanctions@boxingnwt.example', college: 'NWT Health Professions Licensing', liquor: 'NWT Liquor Licensing Board', gaming: 'NWT Municipal and Community Affairs (Lottery Licensing)', combative: 'municipal combative sport bylaws in force in the Northwest Territories', clubs: [['North Slave', 'Yellowknife Boxing Club'], ['South Slave', 'Hay River Boxing']] },
  NU: { name: 'Nunavut', ptso: 'Boxing Nunavut', email: 'sanctions@boxingnunavut.example', college: 'Nunavut Health Professions Licensing', liquor: 'Nunavut Liquor and Cannabis Board', gaming: 'Nunavut Community and Government Services (Lotteries)', combative: 'territorial and municipal rules in force in Nunavut', clubs: [['Qikiqtaaluk', 'Iqaluit Boxing Club'], ['Kivalliq', 'Rankin Inlet Boxing']] },
  ON: { name: 'Ontario', ptso: 'Boxing Ontario', email: 'sanctions@boxingontario.example', college: 'College of Physicians and Surgeons of Ontario (CPSO)', liquor: 'Alcohol and Gaming Commission of Ontario (AGCO)', gaming: 'Alcohol and Gaming Commission of Ontario (AGCO)', combative: 'the Ontario Athletics Commissioner requirements under Ontario combative sport legislation', clubs: [['Eastern', 'Bytown Boxing Club'], ['Eastern', 'Kanata Boxing Academy'], ['Central', 'Queen City Boxing Club'], ['Central', 'Lakeshore Boxing'], ['Northern', 'Sudbury Nickel Boxing'], ['Western', 'Forest City Boxing Club']] },
  PE: { name: 'Prince Edward Island', ptso: 'Boxing PEI', email: 'sanctions@boxingpei.example', college: 'College of Physicians and Surgeons of PEI (CPSPEI)', liquor: 'PEI Liquor Control Commission', gaming: 'PEI Lotteries Commission', combative: 'municipal combative sport bylaws in force in Prince Edward Island', clubs: [['Queens', 'Charlottetown Boxing Club'], ['Prince', 'Summerside Boxing']] },
  QC: { name: 'Québec', ptso: 'FQBO / Boxing Québec', email: 'sanctions@boxingquebec.example', college: 'Collège des médecins du Québec (CMQ)', liquor: 'Régie des alcools, des courses et des jeux (RACJ)', gaming: 'Régie des alcools, des courses et des jeux (RACJ)', combative: 'the RACJ combative sport rules in force in Québec', clubs: [['Montréal', 'Club de boxe Mont-Royal'], ['Montréal', 'Boxe Laval Élite'], ['Capitale-Nationale', 'Club de boxe de Québec'], ['Outaouais', 'Gatineau Boxe']] },
  SK: { name: 'Saskatchewan', ptso: 'Boxing Saskatchewan', email: 'sanctions@boxingsask.example', college: 'College of Physicians and Surgeons of Saskatchewan (CPSS)', liquor: 'Saskatchewan Liquor and Gaming Authority (SLGA)', gaming: 'Saskatchewan Liquor and Gaming Authority (SLGA)', combative: 'municipal combative sport bylaws in force in Saskatchewan', clubs: [['South', 'Queen City Regina Boxing'], ['North', 'Saskatoon Bridge City Boxing']] },
  YT: { name: 'Yukon', ptso: 'Boxing Yukon', email: 'sanctions@boxingyukon.example', college: 'Yukon Medical Council', liquor: 'Cannabis and Liquor Licensing (Yukon)', gaming: 'Yukon Lotteries Licensing', combative: 'territorial and municipal rules in force in Yukon', clubs: [['Whitehorse', 'Klondike Boxing Club'], ['Rural', 'Dawson Boxing']] }
};
const PROVINCE_CODES = Object.keys(PROVINCE_INFO);
const regionsOf = p => [...new Set(PROVINCE_INFO[p].clubs.map(c => c[0]))];

function getSanctionTargetMeta(type, prov) {
  const P = PROVINCE_INFO[prov] || PROVINCE_INFO.ON;
  const nso = type === 'NSO';
  return {
    type, prov, provName: P.name,
    org: nso ? 'Boxing Canada' : P.ptso,
    orgLong: nso ? 'Boxing Canada (National Sport Organization)' : P.ptso + ' (Provincial/Territorial Sport Organization)',
    email: nso ? 'sanctions@boxingcanada.example' : P.email,
    college: P.college, liquor: P.liquor, gaming: P.gaming, combative: P.combative,
    regions: regionsOf(prov), clubs: P.clubs, ptso: P.ptso
  };
}

/* =========================================================
   Weight categories (verify against current Boxing Canada rules)
   ========================================================= */
const MEN = ['50', '55', '60', '65', '70', '75', '80', '85', '90', '90+'];
const WOMEN = ['48', '51', '54', '57', '60', '65', '70', '75', '80', '80+'];
const CATEGORIES = [
  { name: 'Elite Men', weights: MEN }, { name: 'Elite Women', weights: WOMEN },
  { name: 'Youth Men', weights: MEN }, { name: 'Youth Women', weights: WOMEN },
  { name: 'Junior Boys', weights: ['46', '48', '50', '52', '54', '57', '60', '63', '66', '70', '75', '80', '80+'] },
  { name: 'Junior Girls', weights: ['46', '48', '50', '52', '54', '57', '60', '63', '66', '70', '70+'] },
  { name: 'Masters Men', weights: MEN }, { name: 'Masters Women', weights: WOMEN }
];
const wcLabel = (cat, w) => `${cat} ${w} kg`;

/* =========================================================
   Clinical question sets
   ========================================================= */
const ANNUAL_HISTORY_Q = [
  'Have you ever been diagnosed with a concussion or other head injury?',
  'Have you ever lost consciousness or had memory loss after a blow to the head?',
  'Do you have frequent or severe headaches?',
  'Have you ever had a seizure or been diagnosed with epilepsy?',
  'Have you ever fainted or felt dizzy during or after exercise?',
  'Have you had chest pain, palpitations or unusual shortness of breath with exercise?',
  'Has a doctor ever told you that you have high blood pressure or a heart condition?',
  'Has a family member died suddenly of a heart problem before age 50?',
  'Do you have asthma or any other breathing condition?',
  'Have you had an eye injury, eye surgery or a detached retina?',
  'Do you have hearing loss or a chronic ear condition?',
  'Have you had a fracture, dislocation or surgery in the past 12 months?',
  'Do you have diabetes, a bleeding disorder or a blood-borne infection?',
  'Are you currently taking prescription medication or supplements?',
  'Have you ever been suspended from competition for medical reasons?'
];
const ANNUAL_FEMALE_Q = [
  'Are your menstrual periods regular?',
  'Have you been pregnant in the past 12 months?',
  'Have you had gynaecological surgery or a breast injury?'
];
const EXAM_SYSTEMS = ['Concussion Follow-Up', 'General Appearance', 'Mental Status', 'Neurological', 'Cranial Nerves / Eyes', 'Mouth / Teeth / Throat', 'Ears', 'TMJ', 'Neck', 'Chest', 'Cardiovascular', 'Musculoskeletal', 'Abdomen'];

const PRE_BOXER_Q = [
  { q: 'Have you felt unwell, feverish or had an infection in the past 24 hours?', expect: 'no' },
  { q: 'Have you had a headache, dizziness or a blow to the head since your last bout or sparring session?', expect: 'no' },
  { q: 'Have you taken any medication or other substance in the past 24 hours?', expect: 'no' },
  { q: 'Have you slept and eaten adequately in the past 24 hours?', expect: 'yes' },
  { q: 'Do you feel physically and mentally ready to box today?', expect: 'yes' }
];
const PRE_BOXER_FEMALE_Q = { q: 'Are you experiencing unusual menstrual or pelvic pain?', expect: 'no' };
const PRE_COACH_Q = [
  { q: 'The boxer has trained adequately and is prepared for this level of competition.', expect: 'yes' },
  { q: 'The boxer made weight without dehydration or extreme weight-cutting methods.', expect: 'yes' },
  { q: 'The boxer has not had a knockout or head injury in sparring in the past 30 days.', expect: 'yes' },
  { q: 'The boxer’s Record Book, mouthguard and approved equipment are ready.', expect: 'yes' }
];
const PRE_FLAGS = ['Elevated blood pressure or heart rate', 'Signs of illness or fever', 'Recent head injury reported', 'Visual disturbance', 'Skin infection or open wound', 'Weight outside category limit', 'Record Book or Annual Medical invalid'];
const POST_FLAGS = ['Loss of consciousness', 'Concussion symptoms', 'Laceration requiring closure', 'Suspected fracture', 'Nasal injury or epistaxis', 'Eye injury', 'Abnormal neurological findings'];
const REST_OPTIONS = [0, 14, 30, 60, 90];
const LOGO_SLOTS = [
  { key: 'ptso_white_red', label: 'PTSO logo, white background with red' },
  { key: 'ptso_black_red', label: 'PTSO logo, black background with red' },
  { key: 'ptso_black', label: 'PTSO logo, black and white' },
  { key: 'prov_white', label: 'Provincial wordmark, white background' },
  { key: 'prov_black', label: 'Provincial wordmark, black background' }
];

/* =========================================================
   Seed data
   ========================================================= */
const allNo = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ['q' + (i + 1), 'no']));
const allNormal = () => Object.fromEntries(EXAM_SYSTEMS.map(s => [s, 'normal']));
function seedMedical(o) {
  const hist = allNo(o.female ? 18 : 15);
  if (o.female) hist.q16 = 'yes';
  if (o.histOverrides) Object.assign(hist, o.histOverrides);
  return {
    id: o.id, boxerId: o.boxerId, examDate: o.examDate,
    physicianName: o.physicianName || 'Dr. Amira Haddad', license: o.license || 'CPSO #98213',
    clinicAddress: o.clinicAddress || 'Glebe Sports Medicine, 780 Bank St, Ottawa ON K1S 3V6',
    bp: o.bp || '118/76', hr: o.hr || '58', visualAcuity: o.va || '20/20 OU',
    fitToBox: 'yes', history: hist, exam: allNormal(),
    tues: o.tues || 'None declared', highMyopia: 'no', deafness: 'no',
    notes: o.notes || 'Athlete in good general health. No contraindication to competitive Olympic-style boxing identified.',
    backupScan: { pages: 3, fileName: 'annual-medical-' + o.examDate + '.pdf', simulated: true },
    createdAt: o.examDate + 'T10:00:00'
  };
}
function blankSanction(user, prov) {
  return {
    id: uid('s'), type: 'PTSO', province: prov || user?.province || 'ON', status: 'draft',
    requestedByUserId: user?.id, createdAt: nowIso(), submittedAt: null, decidedAt: null, decidedBy: null, denialReason: '', eventId: null,
    part1: { first: user?.firstName || '', last: user?.lastName || '', agreed: false },
    part2: { first: user?.firstName || '', last: user?.lastName || '', agreed: false },
    promoAck: false,
    info: {
      region: '', club: '', eventName: '', posterName: '', posterData: '', date: '', firstBoutTime: '13:00',
      venueName: '', venueAddress: '', hostName: user ? fullName(user) : '', hostPhone: '', hostEmail: user?.email || '',
      hospital: '', hospitalKm: '', livestreamUrl: '', scatRequired: false, scatWithinDays: 30, anticipated: '8', overExplanation: '', international: false, ringSupplier: '', gloveRental: false,
      physician: { name: '', license: '', phone: '', email: '' }, weightClasses: []
    },
    office: { resultsName: '', injuries: '', injuryReportName: '', additional: '' }
  };
}
function seedSanction(base, o) {
  const s = blankSanction(base.user, o.province);
  s.id = o.id; s.type = o.type; s.status = o.status; s.createdAt = o.createdAt; s.submittedAt = o.createdAt;
  s.part1.agreed = s.part2.agreed = s.promoAck = true;
  Object.assign(s.info, o.info);
  s.info.physician = o.physician;
  if (o.eventId) { s.eventId = o.eventId; s.decidedAt = o.decidedAt; s.decidedBy = o.decidedBy; }
  return s;
}
function makeSeed() {
  const users = [
    { id: 'u-b1', firstName: 'Liam', lastName: 'Tremblay', role: 'boxer', gender: 'M', dob: '2001-03-14', province: 'ON', email: 'liam.tremblay@example.ca', membershipId: 'BC-2025-8821', password: 'Password123!', status: 'approved', selectedCoachIds: ['u-c1'], club: 'Bytown Boxing Club' },
    { id: 'u-b2', firstName: 'Maya', lastName: 'Kowalski', role: 'boxer', gender: 'F', dob: '2008-12-02', province: 'ON', email: 'maya.kowalski@example.ca', membershipId: 'BC-2025-7734', password: 'Password123!', status: 'approved', selectedCoachIds: ['u-c1'], club: 'Bytown Boxing Club' },
    { id: 'u-b3', firstName: 'Ethan', lastName: 'Nguyen', role: 'boxer', gender: 'M', dob: '2003-07-22', province: 'ON', email: 'ethan.nguyen@example.ca', membershipId: 'BC-2025-6610', password: 'Password123!', status: 'approved', selectedCoachIds: ['u-c1'], club: 'Bytown Boxing Club' },
    { id: 'u-b4', firstName: 'Sofia', lastName: 'Martins', role: 'boxer', gender: 'F', dob: '1999-05-09', province: 'QC', email: 'sofia.martins@example.ca', membershipId: 'BC-2025-5502', password: 'Password123!', status: 'approved', selectedCoachIds: ['u-c2'], club: 'Club de boxe Mont-Royal' },
    { id: 'u-b5', firstName: 'Noah', lastName: 'O’Connor', role: 'boxer', gender: 'M', dob: '2006-01-30', province: 'NS', email: 'noah.oconnor@example.ca', membershipId: 'BC-2026-0147', password: 'Password123!', status: 'pending', selectedCoachIds: [], club: 'Harbour City Boxing Club' },
    { id: 'u-b6', firstName: 'Owen', lastName: 'Clarke', role: 'boxer', gender: 'M', dob: '2011-04-12', province: 'ON', email: 'owen.clarke@example.ca', membershipId: 'BC-2026-0388', password: 'Password123!', status: 'approved', selectedCoachIds: ['u-c1'], club: 'Bytown Boxing Club' },
    { id: 'u-o2', firstName: 'Grace', lastName: 'Okafor', role: 'official', gender: 'F', dob: '1979-08-21', province: 'ON', email: 'grace.okafor@example.ca', membershipId: 'BC-OFF-2231', password: 'Password123!', status: 'approved' },
    { id: 'u-c1', firstName: 'Marc', lastName: 'Bélanger', role: 'coach', gender: 'M', dob: '1980-09-11', province: 'ON', email: 'marc.belanger@example.ca', membershipId: 'BC-COA-1102', password: 'Password123!', status: 'approved', club: 'Bytown Boxing Club' },
    { id: 'u-c2', firstName: 'Sarah', lastName: 'Lin', role: 'coach', gender: 'F', dob: '1986-04-03', province: 'QC', email: 'sarah.lin@example.ca', membershipId: 'BC-COA-1145', password: 'Password123!', status: 'approved', club: 'Club de boxe Mont-Royal' },
    { id: 'u-o1', firstName: 'Jean-Luc', lastName: 'Picard', role: 'official', gender: 'M', dob: '1972-07-13', province: 'QC', email: 'jeanluc.picard@example.ca', membershipId: 'BC-OFF-2207', password: 'Password123!', status: 'approved' },
    { id: 'u-m1', firstName: 'Elena', lastName: 'Rostova', role: 'medical', gender: 'F', dob: '1978-02-18', province: 'ON', email: 'elena.rostova@example.ca', membershipId: 'BC-MED-3310', password: 'Password123!', status: 'approved', license: 'CPSO #84412', honorific: 'Dr.' },
    { id: 'u-p1', firstName: 'Claire', lastName: 'Vance', role: 'ptso', gender: 'F', dob: '1983-10-05', province: 'ON', email: 'claire.vance@example.ca', membershipId: 'BC-PTSO-4405', password: 'Password123!', status: 'approved' },
    { id: 'u-s1', firstName: 'Philippe', lastName: 'St-Laurent', role: 'nsoadmin', gender: 'M', dob: '1975-06-24', province: 'ON', email: 'philippe.stlaurent@example.ca', membershipId: 'BC-NSO-0001', password: 'Password123!', status: 'approved' }
  ];
  const annualMedicals = [
    seedMedical({ id: 'am-1', boxerId: 'u-b1', examDate: '2026-01-15' }),
    seedMedical({ id: 'am-2', boxerId: 'u-b1', examDate: '2025-01-10', bp: '120/78', hr: '61', notes: 'Cleared. Previous rest period (2024) fully resolved.', histOverrides: { q1: 'yes' } }),
    seedMedical({ id: 'am-3', boxerId: 'u-b2', examDate: '2026-06-01', female: true, bp: '110/70', hr: '62' }),
    seedMedical({ id: 'am-4', boxerId: 'u-b3', examDate: '2025-11-20', bp: '124/80', hr: '64', va: '20/25 OU' }),
    seedMedical({ id: 'am-6', boxerId: 'u-b6', examDate: '2026-05-10', bp: '108/68', hr: '66' }),
    seedMedical({ id: 'am-5', boxerId: 'u-b4', examDate: '2026-03-03', female: true, physicianName: 'Dre Isabelle Côté', license: 'CMQ #1-08877', clinicAddress: 'Clinique de médecine du sport, 4200 rue Saint-Denis, Montréal QC', bp: '112/72', hr: '55' })
  ];
  const events = [
    { id: 'e-1', name: 'Ottawa Golden Gloves 2026', province: 'ON', date: '2026-11-07', firstPreBoutCheckDateTime: '2026-11-07T10:00', firstBoutTime: '13:00', location: 'Bytown Community Arena, 100 Riverside Dr, Ottawa ON', weightClasses: ['Elite Men 75 kg', 'Elite Men 80 kg', 'Youth Women 60 kg', 'Elite Women 60 kg'], registeredBoxerIds: ['u-b1', 'u-b2', 'u-b3', 'u-b6'], officials: [{ userId: 'u-o1', checkedIn: false, roles: ['Referee', 'Judge'] }, { userId: 'u-o2', checkedIn: false, roles: ['TD/Supervisor'] }], physicianIds: ['u-m1'], medicalRoles: { 'u-m1': { checkedIn: false, roles: ['Ringside Practitioner', 'Pre Bout Checks', 'Post Bout Checks'] } }, bouts: [{ id: 'bt-1', redId: 'u-b1', blueName: 'Kevin Osei (ON)', weightClass: 'Elite Men 75 kg', winner: '', method: '', round: '' }, { id: 'bt-2', redId: 'u-b2', blueName: 'Ava Chen (QC)', weightClass: 'Youth Women 60 kg', winner: '', method: '', round: '' }], sanctionId: 's-2', classRequests: [{ id: 'cr-1', weightClass: 'Junior Boys 54 kg', boxerIds: ['u-b6'], reason: 'Owen Clarke (15) is entered but the approved sanction lists no Junior categories. Kanata Boxing Academy has a Junior Boys 54 kg opponent available for this card.', requestedBy: 'u-o2', requestedAt: '2026-10-22T16:30:00', status: 'pending' }] },
    { id: 'e-3', name: 'Championnat de Montréal 2026', province: 'QC', date: '2026-10-25', firstPreBoutCheckDateTime: '2026-10-25T09:00', firstBoutTime: '12:00', location: 'Centre sportif Mont-Royal, 1500 av. du Parc, Montréal QC', weightClasses: ['Elite Men 75 kg', 'Elite Women 60 kg'], registeredBoxerIds: ['u-b4', 'u-b1'], officials: [{ userId: 'u-o1', checkedIn: true, roles: ['TD/Supervisor'] }], physicianIds: ['u-m1'], medicalRoles: { 'u-m1': { checkedIn: true, roles: ['Ringside Practitioner', 'Pre Bout Checks'] } }, bouts: [{ id: 'bt-3', redId: 'u-b1', blueName: 'Olivier Gagnon (QC)', weightClass: 'Elite Men 75 kg', winner: '', method: '', round: '' }, { id: 'bt-4', redId: 'u-b4', blueName: 'Léa Fortin (QC)', weightClass: 'Elite Women 60 kg', winner: '', method: '', round: '' }], sanctionId: null },
    { id: 'e-2', name: 'Toronto Fall Classic', province: 'ON', date: '2026-09-19', firstPreBoutCheckDateTime: '2026-09-19T09:00', firstBoutTime: '12:00', location: 'Lakeshore Athletic Centre, Toronto ON', weightClasses: ['Elite Men 75 kg'], registeredBoxerIds: ['u-b1', 'u-b3'], officials: [{ userId: 'u-o1', checkedIn: true, roles: ['Referee'] }], physicianIds: ['u-m1'], medicalRoles: { 'u-m1': { checkedIn: true, roles: ['Ringside Practitioner', 'Pre Bout Checks', 'Post Bout Checks'] } }, bouts: [{ id: 'bt-5', redId: 'u-b1', blueName: 'Daniel Ruiz (ON)', weightClass: 'Elite Men 75 kg', winner: 'red', method: 'Unanimous decision', round: '3' }, { id: 'bt-6', redId: 'u-b3', blueName: 'Marcus Hill (ON)', weightClass: 'Elite Men 75 kg', winner: 'blue', method: 'RSC (referee stops contest)', round: '2' }], sanctionId: null },
    { id: 'e-4', name: 'Ontario Provincial Championships 2025', province: 'ON', date: '2025-03-15', firstPreBoutCheckDateTime: '2025-03-15T09:00', firstBoutTime: '12:00', location: 'Queen City Sports Hall, Toronto ON', weightClasses: ['Elite Men 75 kg'], registeredBoxerIds: ['u-b1'], officials: [], physicianIds: ['u-m1'], bouts: [{ id: 'bt-7', redId: 'u-b1', blueName: 'Tyler Brooks (ON)', weightClass: 'Elite Men 75 kg', winner: 'red', method: 'Split decision', round: '3' }], sanctionId: null }
  ];
  const ringsideExams = [
    { id: 'rx-1', eventId: 'e-2', boxerId: 'u-b1', type: 'pre', date: '2026-09-19', bp: '122/78', hr: '64', weight: '74.6', flags: [], outcome: 'cleared', notes: '', physicianId: 'u-m1', restDays: 0 },
    { id: 'rx-2', eventId: 'e-2', boxerId: 'u-b3', type: 'pre', date: '2026-09-19', bp: '126/80', hr: '70', weight: '74.9', flags: [], outcome: 'cleared', notes: '', physicianId: 'u-m1', restDays: 0 },
    { id: 'rx-3', eventId: 'e-2', boxerId: 'u-b1', type: 'post', date: '2026-09-19', bp: '128/80', hr: '88', weight: '', flags: [], outcome: 'no-injury', notes: 'Minor swelling left cheek. No concern.', physicianId: 'u-m1', restDays: 0 },
    { id: 'rx-4', eventId: 'e-2', boxerId: 'u-b3', type: 'post', date: '2026-09-19', bp: '134/84', hr: '96', weight: '', flags: ['Concussion symptoms'], outcome: 'injury', notes: 'RSC round 2 after two standing counts. Mild headache post-bout, GCS 15. Mandatory rest ordered.', physicianId: 'u-m1', restDays: 30 },
    { id: 'rx-5', eventId: 'e-4', boxerId: 'u-b1', type: 'post', date: '2025-03-15', bp: '126/82', hr: '90', weight: '', flags: ['Nasal injury or epistaxis'], outcome: 'injury', notes: 'Epistaxis controlled. Precautionary rest.', physicianId: 'u-m1', restDays: 14 }
  ];
  const restPeriodExams = [
    { id: 'rp-1', boxerId: 'u-b1', sourceExamId: 'rx-5', eventId: 'e-4', startDate: '2025-03-15', days: 14, dueDate: '2025-03-29', completed: true, isFitToBox: 'yes', examDate: '2025-04-02', physicianId: 'u-m1', physicianSignature: 'Dr. Elena Rostova', checks: { symptomFree: 'yes', neuro: 'normal', balance: 'normal' }, notes: 'Nasal injury resolved. Cleared.' },
    { id: 'rp-2', boxerId: 'u-b3', sourceExamId: 'rx-4', eventId: 'e-2', startDate: '2026-09-19', days: 30, dueDate: '2026-10-19', completed: false, isFitToBox: '', examDate: '', physicianId: '', physicianSignature: '', checks: {}, notes: '' }
  ];
  const preBoutQuestionnaires = [
    { id: 'q-1', eventId: 'e-3', boxerId: 'u-b1', boxer: { answers: { q1: 'no', q2: 'no', q3: 'no', q4: 'yes', q5: 'yes' }, signature: 'Liam Tremblay', savedAt: '2026-10-24T09:12:00' }, coach: null, nonPregnancy: null },
    { id: 'q-2', eventId: 'e-3', boxerId: 'u-b4', boxer: { answers: { q1: 'no', q2: 'no', q3: 'no', q4: 'yes', q5: 'yes', q6: 'no' }, signature: 'Sofia Martins', savedAt: '2026-10-24T08:40:00' }, coach: { answers: { q1: 'yes', q2: 'yes', q3: 'yes', q4: 'yes' }, notes: 'On weight Friday morning.', signature: 'Sarah Lin', savedAt: '2026-10-24T09:05:00' }, nonPregnancy: { variant: 'adult', acks: { risks: true, notPregnant: true, notify: true }, signature: 'Sofia Martins', savedAt: '2026-10-24T08:42:00' } }
  ];
  const b = { user: users.find(u => u.id === 'u-c1') };
  const sanctions = [
    seedSanction(b, { id: 's-2', type: 'PTSO', province: 'ON', status: 'approved', createdAt: '2026-08-30T15:00:00', eventId: 'e-1', decidedAt: '2026-09-04T10:00:00', decidedBy: 'u-p1', info: { region: 'Eastern', club: 'Bytown Boxing Club', eventName: 'Ottawa Golden Gloves 2026', date: '2026-11-07', firstBoutTime: '13:00', venueName: 'Bytown Community Arena', venueAddress: '100 Riverside Dr, Ottawa ON', hostPhone: '613-555-0142', hospital: 'Ottawa General Hospital (Emergency)', hospitalKm: '4.2', anticipated: '10', ringSupplier: 'Bytown Boxing Club (owned ring)', weightClasses: ['Elite Men 75 kg', 'Elite Men 80 kg', 'Youth Women 60 kg', 'Elite Women 60 kg'] }, physician: { name: 'Dr. Elena Rostova', license: 'CPSO #84412', phone: '613-555-0199', email: 'elena.rostova@example.ca' } }),
    seedSanction(b, { id: 's-1', type: 'PTSO', province: 'ON', status: 'submitted', createdAt: '2026-10-18T11:30:00', info: { region: 'Eastern', club: 'Kanata Boxing Academy', eventName: 'Kanata Fight Night', date: '2026-12-05', firstBoutTime: '18:00', venueName: 'Kanata Recreation Complex', venueAddress: '100 Walter Baker Pl, Kanata ON', hostPhone: '613-555-0177', hospital: 'Queensway Carleton Hospital (Emergency)', hospitalKm: '11.5', anticipated: '12', ringSupplier: 'Ringside Rentals Ottawa', gloveRental: true, weightClasses: ['Elite Men 70 kg', 'Elite Men 75 kg', 'Elite Women 57 kg', 'Youth Men 65 kg'] }, physician: { name: 'Dr. Amira Haddad', license: 'CPSO #98213', phone: '613-555-0110', email: 'a.haddad@example.ca' } })
  ];
  const off = { user: users.find(u => u.id === 'u-o1') };
  sanctions.push(seedSanction(off, { id: 's-3', type: 'NSO', province: 'NB', status: 'submitted', createdAt: '2026-10-10T09:00:00', info: { region: 'East', club: 'Moncton Tidal Boxing Club', eventName: 'Canadian Junior Championships 2027', date: '2027-02-20', firstBoutTime: '11:00', venueName: 'Avenir Arena Annex', venueAddress: 'Moncton NB', hostPhone: '506-555-0123', hospital: 'Moncton Hospital (Emergency)', hospitalKm: '3.0', anticipated: 'over12', overExplanation: 'National championship over three days, up to 40 bouts per day across two rings.', international: false, ringSupplier: 'Boxing Canada national ring', weightClasses: ['Junior Boys 54 kg', 'Junior Boys 57 kg', 'Junior Girls 52 kg', 'Junior Girls 57 kg'] }, physician: { name: 'Dr. Paul LeBlanc', license: 'CPSNB #12044', phone: '506-555-0188', email: 'p.leblanc@example.ca' } }));
  const sl = { user: users.find(u => u.id === 'u-c2') };
  sanctions.push(seedSanction(sl, { id: 's-4', type: 'PTSO', province: 'QC', status: 'submitted', createdAt: '2026-10-20T14:00:00', info: { region: 'Montréal', club: 'Boxe Laval Élite', eventName: 'Gala de boxe de Laval', date: '2026-11-28', firstBoutTime: '19:00', venueName: 'Aréna de Laval', venueAddress: 'Laval QC', hostPhone: '450-555-0133', hospital: 'Hôpital de la Cité-de-la-Santé', hospitalKm: '5.6', anticipated: '9', ringSupplier: 'Boxe Laval Élite', weightClasses: ['Elite Men 65 kg', 'Elite Women 60 kg'] }, physician: { name: 'Dre Isabelle Côté', license: 'CMQ #1-08877', phone: '514-555-0166', email: 'i.cote@example.ca' } }));
  const seed = { version: 7, users, annualMedicals, events, ringsideExams, restPeriodExams, preBoutQuestionnaires, sanctions, itps: makeItps(), docs: makeDocs(), calendar: makeCalendar(), logos: {} };
  return upgradeTo25(upgradeTo24(upgradeTo23(upgradeTo22(upgradeTo21(upgradeTo20(upgradeTo19(upgradeTo18(upgradeTo17(upgradeTo16(upgradeTo15(upgradeTo14(upgradeTo13(upgradeTo12(upgradeTo11(upgradeTo10(upgradeTo9(upgradeTo8(seed))))))))))))))))));
}

/* =========================================================
   Selectors
   ========================================================= */
const getUser = (d, id) => d.users.find(u => u.id === id);
const nameOf = (d, id) => { const u = getUser(d, id); if (!u) return '—'; return (u.honorific ? u.honorific + ' ' : '') + fullName(u); };
const boxersOf = (d, coachId) => d.users.filter(u => u.role === 'boxer' && u.status === 'approved' && (u.selectedCoachIds || []).includes(coachId));
const allBoxers = d => d.users.filter(u => u.role === 'boxer' && u.status === 'approved');
const medicalsOf = (d, bid) => d.annualMedicals.filter(m => m.boxerId === bid).sort((a, b) => b.examDate.localeCompare(a.examDate));
const latestMedical = (d, bid) => medicalsOf(d, bid)[0];
const medExpiry = m => addDays(m.examDate, 365);
const medState = m => { if (!m) return { tone: 'warn', label: 'None on file' }; const left = daysBetween(REF_DATE, medExpiry(m)); if (left < 0) return { tone: 'bad', label: 'Expired', left }; if (left <= 90) return { tone: 'warn', label: `Expires in ${left} days`, left }; return { tone: 'ok', label: 'Valid', left }; };
const restOf = (d, bid) => d.restPeriodExams.filter(r => r.boxerId === bid).sort((a, b) => b.startDate.localeCompare(a.startDate));
const restOpen = r => !r.completed || r.isFitToBox !== 'yes';
function getRestExamStatusForCoachAndAdmin(r) {
  if (r.completed && r.isFitToBox === 'yes') return { tone: 'ok', label: 'Cleared, fit to box' };
  if (r.completed && r.isFitToBox !== 'yes') return { tone: 'bad', label: 'Not cleared, re-examination required' };
  if (daysBetween(REF_DATE, r.dueDate) > 0) return { tone: 'warn', label: `Rest in progress, exam due ${fmtDate(r.dueDate)}` };
  return { tone: 'bad', label: 'Recovery exam overdue' };
}
function eligibility(d, b) {
  if (restOf(d, b.id).some(restOpen)) return { tone: 'bad', label: 'Medical Suspension / Rest Active' };
  const m = latestMedical(d, b.id);
  if (!m) return { tone: 'warn', label: 'No Annual Medical on file' };
  if (daysBetween(REF_DATE, medExpiry(m)) < 0) return { tone: 'bad', label: 'Annual Medical Expired' };
  return { tone: 'ok', label: 'Eligible to Compete' };
}
const getQ = (d, eid, bid) => d.preBoutQuestionnaires.find(q => q.eventId === eid && q.boxerId === bid);
function qStatus(d, ev, b) {
  const q = getQ(d, ev.id, b.id);
  const boxer = !!(q && q.boxer && q.boxer.savedAt), coach = !!(q && q.coach && q.coach.savedAt);
  const np = b.gender === 'F' ? !!(q && q.nonPregnancy && q.nonPregnancy.savedAt) : null;
  return { boxer, coach, np, complete: boxer && coach && np !== false };
}
function windowStatus(ev) {
  const check = Date.parse(ev.firstPreBoutCheckDateTime), open = check - DAY;
  if (REF_NOW < open) return { tone: 'neutral', label: 'Opens ' + fmtMs(open), state: 'upcoming' };
  if (REF_NOW <= check) return { tone: 'info', label: 'Open until ' + fmtMs(check), state: 'open' };
  return { tone: 'neutral', label: 'Closed', state: 'closed' };
}
function formAvailability(ev) {
  const check = Date.parse(ev.firstPreBoutCheckDateTime), opens = check - DAY;
  if (REF_NOW < opens) { const ms = opens - REF_NOW; const h = Math.max(1, Math.ceil(ms / 3600000)), dd = Math.ceil(ms / DAY); return { state: 'upcoming', opens, label: ms < DAY ? `Available in ${h} hour${h === 1 ? '' : 's'}` : `Available in ${dd} day${dd === 1 ? '' : 's'}` }; }
  if (REF_NOW <= check) return { state: 'open', closes: check };
  return { state: 'closed' };
}
function FormButton({ ev, s, onOpen, openLabel }) {
  const a = formAvailability(ev);
  const any = !!(s && (s.boxer || s.coach || s.np));
  if (a.state === 'upcoming') return <Btn size="sm" disabled title={`The 24-hour forms open ${fmtMs(a.opens)}, 24 hours before the first pre-bout check.`}>🔒 {a.label}</Btn>;
  if (a.state === 'closed') return any ? <Btn size="sm" onClick={onOpen}>View Forms</Btn> : <Btn size="sm" disabled title="The 24-hour window for this event has passed.">Window closed</Btn>;
  return <Btn size="sm" variant={s && s.complete ? 'secondary' : 'primary'} onClick={onOpen}>{s && s.complete ? 'View Forms' : (openLabel || 'Complete 24h Forms')}</Btn>;
}
const isUpcoming = ev => ev.date >= REF_DATE;
const boxerEvents = (d, bid) => d.events.filter(e => e.registeredBoxerIds.includes(bid)).sort((a, b) => a.date.localeCompare(b.date));
function boutsOf(d, bid) {
  const out = [];
  d.events.forEach(ev => ev.bouts.forEach(bt => {
    if (bt.redId === bid || bt.blueId === bid) {
      const corner = bt.redId === bid ? 'red' : 'blue';
      const opp = corner === 'red' ? (bt.blueId ? nameOf(d, bt.blueId) : bt.blueName) : (bt.redId ? nameOf(d, bt.redId) : bt.redName);
      const result = !bt.winner ? 'Scheduled' : bt.winner === corner ? 'Win' : 'Loss';
      out.push({ ev, bt, corner, opp, result });
    }
  }));
  return out.sort((a, b) => b.ev.date.localeCompare(a.ev.date));
}
const cornerName = (d, bt, side) => side === 'red' ? (bt.redId ? nameOf(d, bt.redId) : bt.redName) : (bt.blueId ? nameOf(d, bt.blueId) : bt.blueName);
function coachDueItems(d, coachId) {
  const items = [];
  boxersOf(d, coachId).forEach(b => {
    d.events.filter(ev => isUpcoming(ev) && ev.registeredBoxerIds.includes(b.id)).forEach(ev => {
      const s = qStatus(d, ev, b);
      if (!s.complete) {
        const missing = [!s.boxer && 'boxer readiness', !s.coach && 'coach co-sign', s.np === false && 'non-pregnancy'].filter(Boolean).join(', ');
        items.push({ kind: 'pre', date: ev.firstPreBoutCheckDateTime.slice(0, 10), b, ev, detail: `${ev.name}: still to complete: ${missing}` });
      }
    });
    restOf(d, b.id).filter(restOpen).forEach(r => items.push({ kind: 'rest', date: r.dueDate, b, r, detail: `${r.days}-day rest from ${fmtDate(r.startDate)}` }));
    const m = latestMedical(d, b.id);
    if (m) { const left = daysBetween(REF_DATE, medExpiry(m)); if (left >= 0 && left <= 90) items.push({ kind: 'annual', date: medExpiry(m), b, m, detail: `Exam ${fmtDate(m.examDate)}, ${left} days left` }); }
  });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/* =========================================================
   Logo artwork & file saving
   ========================================================= */
function logoSvg(prov, slot) {
  const P = PROVINCE_INFO[prov];
  const white = slot === 'ptso_white_red' || slot === 'prov_white';
  const bg = white ? '#FFFFFF' : '#111111', fg = white ? '#111111' : '#FFFFFF';
  const red = slot === 'ptso_white_red' || slot === 'ptso_black_red';
  const isPtso = slot.startsWith('ptso');
  const title = isPtso ? P.ptso : P.name;
  const sub = isPtso ? 'Member of Boxing Canada' : (prov === 'NT' || prov === 'NU' || prov === 'YT' ? 'Territory of ' : 'Province of ') + P.name;
  const accent = red ? '#C8102E' : fg;
  const size = title.length > 22 ? 26 : 34;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160" width="480" height="160"><rect width="480" height="160" fill="${bg}"/><rect width="14" height="160" fill="${accent}"/><rect x="34" y="40" width="44" height="44" fill="none" stroke="${accent}" stroke-width="4"/><text x="56" y="72" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="${accent}">${prov}</text><text x="96" y="76" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" fill="${red ? accent : fg}">${esc(title)}</text><text x="96" y="110" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="${fg}">${esc(sub)}</text><text x="96" y="136" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="${fg}" opacity="0.6">Placeholder artwork. Replace with the official file.</text></svg>`;
}
const svgDataUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
function dataUrlToBlob(url) {
  const [head, body] = url.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = head.includes('base64') ? atob(body) : decodeURIComponent(body);
  const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
let downloadsNs;
async function saveFile(filename, data) {
  try {
    if (downloadsNs === undefined && window.claude && window.claude.use) downloadsNs = await window.claude.use('downloads');
  } catch (e) { downloadsNs = null; }
  if (downloadsNs) {
    try { await downloadsNs.save({ filename, data }); return { ok: true, msg: `Saved ${filename}.` }; }
    catch (e) { return { ok: false, msg: e && e.code === 'declined' ? 'Download cancelled.' : 'This view can’t save files right now.' }; }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return { ok: true, msg: `Downloaded ${filename}.` };
  } catch (e) { return { ok: false, msg: 'Download isn’t available in this browser.' }; }
}
function readFileAsDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }

/* =========================================================
   Contexts
   ========================================================= */
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);
/* Official Boxing Canada logo (BoxCanLogo.jpg), embedded so it shows without any file selection */
const DEFAULT_LOGO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0QGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCAFeAUADASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAgJBgcBBAUDAv/EAF0QAAEDAwIDAwYHCgkICAQHAAECAwQABQYHEQgSIRMxQQkiUWFxgRQVMkJSgpEWFyM4YnKSlKHSGBl1g6Kxs8HTJDM0VldzdrI1N0NTk6O0wyUnlcI2REVHVWPR/8QAHAEBAAIDAQEBAAAAAAAAAAAAAAUHAwQGAggB/8QANxEBAAECAwQHBQgDAQEAAAAAAAECAwQFERIhMVEGE0FhcYGRBxShsdEWIjJCU5LB4RVSYiMz/9oADAMBAAIRAxEAPwCf1KUoFKUoFKUoFKUoFKUoFKUoFKUoFKUoFKUoFKUoFKUoFKUoFKUoFKUoFKVxzDmCdxueoFBzSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlRv194oY2CXpvTPTGAnK9S7gsRo8Bgdo3BWr5Je271+Ib3Gw6qKR3hszUrVi3YNKt+N2qCvIc1vJLdoxyI4EuvnxddV1DLCdiVOq6AA7AkbV7GFYxdbRFdu+WXVF3yecAZstpJQwyB1EeMg/IZRudt/OUd1KJJ6YFoLonK08hTMxzu6qyPUi/AOXi8vq5y2OhEZk/NaT07gASB0ACQN00ClKUClKUClKUClKUClKUClKUClKUClKUClKUClKUClKUClKUClKUClKHuO1ApUAMs41Mo0t40s1sV2ZN+wdm4Jh/AE7JfhFtpDa1sL8d1pUShXQnfYp33qamn2pGGao4azk+EXyPdIDmwXyHZxhe25bdQeqFj0H2jcdaDK6UpQKUpQK4UpKEFa1BKQNySdgK6N6vVpxzH5d8vtxjW62w2i9IlyXA220gd5Uo91VncTnGRedU35GA6Yrl23E1qLL8pAKJN23O22w6oaPgj5Svnd/LQbY4lONCR8auaXaDPruF3kOCG/f4Se1IcUeXsYYG/O4Sdu0HQfN3PnDYfDNw72nQnC5epepUiO5mcthcidMkr502tpQ5ltpWd93D89fifNG43KvB4P+FJrTW1x9TdRIKDl0hrnhQngNrS0od6ge59QPU/MB5e8qro62apy9XNRIGl+FySbIuc3FU80ek54rCef1tI6kekjm8BWG/ei1Tr29iYyXKLmZ39iJ0op31Vco+vL6JVYDk7+Z4WzlCohiw57i3YLSxs58GCuVtS/QpQTz7eAUB4ViGs3EPptobbmF5jcXnblJQVxbTAQHZLyR05uUkBCNxtzKIB67b7VsWHFt2N4sxDbUiNb7dFS2FKOwbabRtufYE1SZrHqFO1S1vyPN5r7jiJ8xZioWT+CjJPKy2B4AICffufGstOsRvRl+qiq5VNuNKdd0d3YnAfKUYl8N5E6YXox9/8AOG4NBe35vLt/SrcmmHGTolqdPYtTF7fx27PEJbg31CY/aKPgh0KLaj6BzAn0VUDSv1iX/Uqu3gq4qLsxk0DR3US6OTIEwiPY7lKXzOR3fmxlqPVSFdyCeqVbJ7iOWxKgUpSgUpSgUpSgUpSgUpSgUpSgUpSgUpSgUpSgUpSgUpSgVwpQSgqUQAOpJ8BXNYfqvfk4voXmORKXyGBZZchB/KSyrlH27UFKee3w5NqpkuRlZWbldJUzmPj2jylf316GmuqecaS5k3kuD3t23yhsl5r5TMpAO/ZutnotPt6jvBB61hx6mt75Zwp6i2LQfHNWbNHVfbJc7Y1cJjMVo/CLcFp5t1o6lbfKQedPd13AA3IT84euLnB9a4zNjuRZx3MQkBVrfc/ByyB1VGWfl+nkPnD8oDepFVQKy89FktyI7q2nm1BaHG1FKkqB3BBHUEHxFTn4c+O+bajEw3Wx96bB3DUfJkpK3mR3ASUjq4n/APsHnDxCu8BYnWJ6iakYdpXg0nK81u7VvgMjZIPnOyF7dG2kd61n0D2nYAmsF1f4mdM9JdOI2TPXiLfJNxZ7S0262yEOLnAjosKG4Q16Vnp4AE9Kqo1d1kzfWrPHMlzC4FYTuiHAZJTHhNk/IbT4eG6j5ytup7qDNeIfiezHXi/KhqU5Z8Sju80OytubhRHc6+R8tz+inuHiTJ/gw4TzYmoOr+pdt2uiwH7JaZKOsRJ6pkupP/aHvQk/JHnHziOXGeDDhOF1XB1g1Mtu8BJD9jtElH+kEdUyXUn5g70JPyj5x6bc0neIXWtvT3HjjeOyUnJ57e6VJ6/AWj07U/lnryj39w6+LlyLdM1VNzL8Bex9+nD2I1qn4d890MI4mdbzHTJ00xKZs6odnd5jSvkA98dJHifnnwHm95O2B8J2J/Hms7uQPtc0axxS6kkdO2c3Qge5PaH3CtELW466px1anHFqKlLWdyok7kknvJPjU6+FbExj+hbV4ea5ZV8fVNJPf2Q8xofYkq+tUVZqqxF/aq4QtPOcPZyDJKsPY/FX93XtmZ4z6RMRy3Orxjagfe/4Scicjv8AZT7ylNlibK2O724cI9jSXT7dqp8PfU2fKM6gfGmqOO6cxHt2LNEM+WlPd27/AESD60toB/nKhNUwqApSlBsbRvSXUbVbPWIWnlrecfhOtPP3Eq7NmB526XFuHuO6SQBuo8p2B2q7VlLiWEJdWFuBIClAbcx8Tt4VCTybd2s7mleZWJtTYu7N2blvDfzlMLZCGz6wFNuD1b+upvE7Deg8bKcsxvCcWk5Hll6h2i1Rhu7KluciE79wHiVHuCRuSe4V4eC6uab6lYzKv+F5db7nAiEiUsKLSo+w33cQ4EqQNtyCQAdjsarX45dWLvm/EbPwxEtxNgxdYiMRUq2QuTygvPKHirclAPgE9NtzvGJD7zaVpbdWkLHKoJURzD0H0igt3Z41uHl7O3MZOZra5XC0Lo5EcEJagduju3dv88gJ8d9utb9iS4s+CzNgyWZMZ9AcafZWFocSRuFJUOhBHcRVA9TV4D+IG4WDPGNG8mnresd3Ur4oU8rf4HK6nskk9yHOo28F7bfKNBZTSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSvNyC/2jFsVuOR36a3CtlujrlSpDnc22gbqPpPQdw6k9BXZt1wh3azxLrbpCJEOWyiQw8jqlxtaQpKh6iCDQdmtA8aV++IuC3LuRWz08R4DfXv7R9HMP0Aut/VDLyjt+VD0FxnHkLCVXG99uoeKkMsr3/pOp/ZQVpNNrfkJabSVLWrlSkeJPQVfDiVmTj2n9jx9KQlNut8eGAPANtJR/dVKejNhOT8Q2EWHl5kTL5DbcBG/mdskr/og1c/qHfXMZ0nyO/sult6Hbn3mljbcOBB5O/wDKIr8mdI1lktWqrtdNunjMxHqjDxF8DuPZ78Ky7StETH8lVzOv23YNwp6u87AdGXD6R5pPeBuVVW5k2LZFhmUSscymzy7TdYiuR6LKRyLSfA+sHvChuCOoJq1fRrict+RCNjWoTrFuvB2bauXREeWru2X4NrP6J8Nu6thay6D6fa4Yt8W5bbQmcygphXeKAmVEJ+irbzk796FbpPqOxrxau03I2qZbmZZZiMuvTZxNOk9nKe+J7VKG5Ow6nwFTG4O+E9zUK4RdTtRLeU4nHc57fb3k7fGriT8pQ/7hJH1yNu4HfJdN/J9X+Fr263qLOhzsItxS+0/Ec5V3bcnlaKN+ZoDbz9/YknfmE6MuyrGdLtOXLvPS1Dt0BpLEaJHSEc5A2bZaSOm/TYAdABv3CvczERrLTtWq7tcW7ca1TuiHhavap2jSfA/hfI09dJCSzbbfvsHFgfKUB3Np6E+4DqRVe16vNzyHIJd7vMxyXPmOl599zvUo/wBQHQADoAAK9jPc5veomcSslvrv4V3zGY6SS3GaB81tHqHifEkk99YzUFisRN6rdwheXRno/RlNjWvfdq/FP8R3R8Z8noWGzSsjym24/BBMm4SW4re3gVqCd/duT7qs9gxLdjWKR4TSkR7fboqWkqUdghptG259gTvUKuE/E/jzWly/vtc0axxS8CRuO2c3Qj3hPaH3Ct2cYuoH3v8AhJyN2O/2U+8pTZYmytju/uHCPY0HT9lb2X29KJr5uJ9oGP63FUYWmd1Eaz4z/Wnqqv1czh7UnXHKM3eUopulwceZCu9DIPK0n3NpQPdWF0PfSpBX5X6QhTjiW0JKlKOwSkbkn0V+a3BnmjeRaJ4XgGc3q9QU3e/gXOJaEsqU5FbRyOJU6VebvutAKdu/ceBoLH+GLh3xXR7A7ZkabTNjZjdLQw3d3JUpTnZrUEuONJQNkpAWB4E+b39++/iRynY+FVV3rj/1zu2DfEkUWG03BStl3iDEIfKNu4JWpSEn0qA9m1Y3p7xna5YVlrNxuuVy8qtqlj4VbLwsOJdTv15HNuZtXfsQdt+8EdKDF+KOI1C4xNQmWnUupVeHHSpJ32KwlZHtBUR7q1FUp9bNGMFyDR+fxLaWZTcpliuMpszLJLZVIkW+U6v8Ml58r3CQpXzgokqTsSFA1FigV6WPXWXYsttl7gOFuXBltSmVjvStCwpJ+0CvpjuL5Hl19asuL2O4Xi4OnzIsFhTzh9eyQdh6z0qZuhfAJlsnI7Zk2rz8W0W2O6iQbEw4H5MnlIUEOqT5jaT032KlbbjzT1oLFo7ofiNPhJSHEBex8NxvX1oBsNqUClKUClKUClKUClKUClKUClKUClK13rfqtatGtFbvnFy5HHmEdjBiqO3wqUvcNt+zfdSvQlKj4UEQvKCa57rj6I47M6J5Jt+W2rx6KZjH9jih/u/XWyuAbVr7s9C3sBukrnu2KqDTPOfOchLJLR9fIrmR6gEemqysgvt1yfKbjkV8mOTLlcJC5UmQ4erji1FSj9p7vCtlcNWqy9HuIqx5Q+8pFpeX8AuqQehiukBSj6eQ8rg9aKC6Kq4/KTX3t9SsIxoObiHbH5xQD3F50IH7GDVjLbjbrKXW1pWhQCkqSdwoHuIPoqpfjrvwvPGbe4qF86LVDiQAfQeyDqh+k6aDpcEdhF740sXcWnmatzcqesfmMLSk/prTVinFBdfivhuurAOyp78eEPYXAo/0UGoc+TesSZWtmWZEpvmECzJipV9FTzyT/UyqpHcZd1LWG4xZEr/0mc7KUnfwbb5R+12sGJq2bVUpzo1Y6/NLFH/UT6b/AOEPT133G+9b20h4k77gbTVhylEi+WBOyWiFbyYg9CCo+ej8knp4HwrRNKgrd2q3O1TK88fl2Hx9qbOJp2o+XfE9iecnip0iZtBmM3S4yXuXcQ24DgdJ9G6gEj2821RO1b1aveq2VInTGzCtcXdMG3JXzBoHvWo/OWem58B0Hr17Sst7F3LsbM8ETlPRbA5Zd66zEzV2TVOunhuj6lKV6Fis0rIsot1gggmTcJLcVvbwK1BO/u3391a8RrOkOhrriimaqp0iE3OFXE/iDQ1u8vNcsq+SFTCT39kPMaH2JKvrVE3yjOoHxnqhjunMR/dizRDPlpHd27/RAPrS2gEf7yrEoEO3Y1icaA0pEe326KloKUdghptG259gTvVJGrucvak645Rm7qlFN0uDjzAV3oZB5Wk+5tKB7q6S1RsURTyfOeZYycbirmJq/NMz5dkeUMKpSle2i9GwNw3cqtrVw5REVLaS9zd3IVjm/ZvU4vKSWCYi5YDkbLe9t+Dybfuj5LawpDiR7077fmGoGVs/U7X3UbVnF8exzK7qlVrscZplmMwkpS+6hHJ8Id6nndI6b9w3OwG53DWFKUoN38NOsEbTjUJ/HMsbTPwHKUfFl/t73Vvs1+YH9vAo5jvt1KSrx223Zjvk+8jncQl3tl7uaoensJ8Oxbo2tKpNwZV5yW20/NUAeVa1DYEbpCt6hZAhS7ldI9ugR3JEqS6lhllsbqcWohKUgeJJIFXxY1BlWzDbTbprnaSo0Nlh5e+/MtLaUqO/tBoPKwTTnCdNMYasGEY7Bs8JtIChHb890j5ziz5zivWok1lNKUClKUClKUClKUClKUHWkXG3xJsaHKnRmJEolMdlx1KVvEDchCSd1bAjfauzvVf3lKLw41cNObYw4ULbTOl8yDspJ3YSkgju7j9lR2074vNddOQzHh5g7e7c3sBAvwMxvYeAWSHEj1JWBQXFUqE+nnlF8Iuoah6kYrPx6Qeip1uPwyNv6Sjo4keoBdSqwnVHTzUaB8LwjMLRe0bbqbiyAXWx+W0dlo94FBl1KUoB6CqnuNbXL76etKsYscztMYxpa4rBbVuiVJ32ee9YBHIk+hJI+VUz+MzXIaSaIuWayTOyynI0rhwihXnxmdtnpHqIBCUn6SgR8k1Up1UqgyvT7TfLdTsil2TELcqbKiQH7i8OoCWmkFR6+lR5UJHipSRWKdxq2rgy0N+9Noe3eb1D7LKMkSiZMC0+fGZ23ZY9RAUVKH0lkH5IqA3FppX96ribvVvhxuxs11PxtbdhslLTqiVNj8xwLTt6An00E9+CXVr75PDdFstyk9re8XKbXJ5jupxjb/J3D7UAo38S2fTVbWvV/wDum4nM8vQVzIfvkpLZ33/BocKEf0UCsr4WNaU6K65IvFxkLRYbjFchXFISVADYqac5R3lLgT9VSvTWl5cl2dcHpb6ip19xTi1HxUo7n9poLG/JtWMx9J8zyQtbfDbs1DCyO8Ms839b9ffjCuolauWa0oXumFa+0UPQp1xR/qQmtjcDViVZeC+wSVo5HLpJlz1D07vKbSf0Wk1oDiJuwu/EnkriTuiM41CT6uzaSCP0iqtHH1aWtObtegVjrMymv/WmZ9dI/lq+lKVCrnKUpQK3vwoYn8e61rvz7XNGscZT4JG47ZzdCB7QO0PuFaI8anXwqYmLBoci9PNcsq+SFTCT39knzGx9gUr61bWDt7d2O7e5fphj/dMsriJ31/djz4/DV8OMXUD73/CTkbsd/sp95SLLE2Vsd39w4R7Gg6fbtVPZ76m35RnUD4z1Ox3TmI9uxZ4hny0pPTt3+iAfWltAP85UJKnlFlKUoPYxfFchzXLIWM4taZN0us1zs2IsdO6lHxPoAA6lR2AAJJAr39UtJ820ezdWLZvbBFllsPMvNK7RiS2fntr2HMN9wfEEEECpr8K4tPDtklvxjUiw2aK7m8dmXY85hPdvGlhaEkwVvHzUEKPTbYKJ67+aaklxIYNpdm+htxb1SmsWqBCSXot5I3egvHoktDvWVHZPZDfn6DbfYgKX6k/oZwTZ9q9jLeVXq5t4hYX9lRHZUZT0iWn6aGt07IPgpShv3gEda3RwwcEbEeczqBq/CL7SV9ra8ektcnMnfdD0tB7iRsQye75/0anqhCW2whCQlKRsABsAKCOWiXBlppo7kbOUuyZmT5DH3MebcEJQ1FV3c7TKdwFflKKiPDapH0pQKUpQKUpQKUpQKUpQKUpQVl+UduYf4g8atSVb/BbAl0p9BckO/wByBUV8LwTLNRMlOP4XZX7vcww5J+CsFIWUIG6iOYjcjfu7z4Vvnj1uJm8ZVzjFW/wG2wo3s3b7Tb/zKyPydVs+F8Td5uCgCmHjz22/gpb7KR+zegipfccyDF7u5askslwtE5s7KjT462HB9VQBrqwp862XBqdbpkiHKaVzNvx3C24g+kKBBBq9rJsPxTM7Qq15bjtsvcNQP4G4RkPJHrHMDsfWNjUYdQ/J9aS5N2svCrhcsOmq3KW21fDIm/8Au3Dzj3LA9VBEfTvjc10wTsYs6+s5XbkbD4NfUF1zb1PpIc3/ADioeqpZafeUK0qyJtEbObVdMRmEDme5TNik7eC0ALHvRt66ipqHwN654QXZNqtEbLrejqH7I5zugethey9/UkK9tR2uNsuVnuTlvu1vlQJjR2cjymlNOIPoKVAEUGwNedW7lrTrdds0mdo3CUr4PbYiz/o0VBPZo9p3KlflKVWz+CvQ776utqMivcPtcYxpSJckOJ3RJkb7ssesbjnUPop2PyhUdLJZrnkWSQLDZobky4z5CIsaO2N1OOLUEpSPaSKul0N0ptWimh1qw2IplUhlsyLlMHQSJSgC44T9EbBKd+5KU0GaXXJLJY7larfdJ7UeTdZJiQm197znIV7D3JPX0kDxFRm49dKxmvD2jNLdG57rijhlKKRupcReyXh9UhDnqCFemtTa0arzc21pF8ssxbcCyuhu0LSdhuhYUXvataQfzQkVNvFL5aNT9H4V1djtvwbzBLcqKrqnzklDrRHqPOmtaziIu11Ux2Ojzfo9dy3C2MRc418Y5TxiPT4xKi7xrkd/Ss51j07maU635FgssLKbdKUmM6sdXo6vPZX70KTv69x4VjGO2ly/ZfarG1uXJ8xmIkDv3cWED+utlzi6nQywjF+GfBLKocq49jidqO7ZamkrX/SUqq/Muuqr5qDfbypXMZtwkSAfUpxRH7Nqsgy+axi+kl7nM/gm7da3lNgdNuRohIH2CqxU7hCQrv2G9ReZVfhpWd7OrH/3vT/zHzmf4c0pSotZxSlKDv2Ozy8hya3WGCkmTcJLcVrb6S1BO/u3391We2+FbsZxKNb2lIYgW2KlpKldAhttG259w3qFPCjifx7rYq+vtc0axxlPgkbjtnN0Nj2gdofdW7+MTUD733CVkb0d/sp94SLLE2Ox5n9w4R7Gg6fsqYy+3pRNfNUftAx/WYqjC0zuojWfGf609VWGr2cvak65ZRm7qlFFzuDjrAV3oYB5Wk+5tKB7qwmh76VIK/KUr3sMw3ItQM5t2I4pbXLhdbg6GmWUdB6SpR7kpSNyVHoACaCRvCdk1x1CXI4cMwxyXlWEXZC5COzI7WwOJ3PwppZ+QjmPUfSV0B5lJVOPTLQe82GTbJ+qmcyc+l48pTOOoltcjEBoEhDykH/OyuUgdqrcpAAT4qPocPOgWOaDabItEHspt9mBLt2u3LsqQ4B0SnfqGk7kJT7SepNbgoFKUoFKUoFKUoFKUoFKUoFKUoFcH5JrmuD3UFNnFxcfjTjRz6QFcwbnojD1dky23t9qTUgfJq27tMyz+7FP+YhQ4wV+e44oj/yxUT9a7mbzxIZ7cyrmD+QTlJPpT26wP2AVN/ya9vLenWdXXl6P3KNH32/7tpSv/dFBm/FRnWU4nqdjSMYyCfanEW9x5YjOlKV8zoA5k/JV8g94NY3iPF9l9s5I+X2WFfGR0MiMfgr/ALSOqFfYmvK4t5vwnX1mNvv8FtLCPZzLcV/fWh6hL9+ui9VsyurJciwWLymxTibUTOmuvCd8zPGN6wfEeIvSzLi2wL8LPMXsBFuyfg539AXuUH9Ksry3T3T7Umzpj5fi9myCKpP4NyUwlxSQfFDg85PtSRVZveNj1HorJcW1CzbCngvF8muFuQDuWEOczKva2rdJ+ys1vMZ/PCIx/s9t1a1YO7p3Vb49Y3/CUvdP+EHSHTTWhrUbFolybkMMONxbfKkdvHiuL6F1sqHPzBJUkbqO3MT37VxxR6mfcnp8nELVI5LvfEKQsoOymIvctXqKvkD63orT8Xi+1IZtHwWRZ8ekygnYS1NOIO/pKAvYn2bCtKZLk18zDJ5OQZFcHJtwkkFbqgAAB3JSkdEpA6ADur1iMdTNGlHGWtkPQnEWcXTexumxTviInXWezy7d/ho8n2VKvg+zrkfu2ns17ore4wAo+PRLyB/QVt+dUVK97C8pmYVqBacpg8xct8hLqkA7do33LR9ZJUPfWhh7vV3Iqd3nuWxmOBuYftmNY8Y4fTwbQ8otpX8LsVi1dtkbd2GRabopA/7JRKmHD6gsrRv+WkVEzhfsQyLjA0/tym+0Si7NzFJ26bMAvn+zq3PMMcsOrmidzx2Q4l605DbSlt4DflDiQpt0etKuVQ9aarv4IcCuto46Lpa71ELM7FoM5MlJHyHgtMcj39oog+iuifPcxNM6TxTm4lLqLXw138c3K5MDMNP846nf+iFVX2e+pm8Y92MfTOwWVKtjMuReI9KWm1f3rTUMqhcfVrd05Ln6B2Oryzb/ANqpn5R/BSlK0XaFPGld+yWiXkGS2+xQElUmfJbitAfSWoJ392+/ur9iNdzzVVFFM1VTpEJt8KeJ/EOhyb281yyb5IVL38eyT5jY+wKV9aox+UNv1/yTULGsCstquUuFaYqp8lUeM4tCn3jypBIBBKW0b/zhqwKzWqJYscgWWCgIiwo7cZobbbJQkJH9VdzdP0v210dqjYoink+c8zxk43FXMTP5pmfLs9IUO/cfln+rN5/UXf3a5+4/LP8AVm8/qLv7tXw7p+l+2m6fpftrI0VFNt07zu73eNbLbh19ky5TiWWWkQXd1qJ2A6p2HtPSrTuFXh0sGiWIPSZ78K5ZzMbSm6yWVpc+BpPURm/EJBHnHpzkb9wSBIc8vKdjufbUXuGe42+48VHES/AlsyG1X2KEraUFBXL26TsR37KBHuoJSUpSgUpSgUpSgUpSgUpSgUpSgUpSgV833Esx1vLOyUJKj7B1r6VjeodwNo0jym6hXKYlolyN/RyMrV/dQUaXucbnktwuRPMZMl18n08yyr++rOPJ4W0Q+Fe4zuXZUzIJDm/pCWmUf3GquT37VbnwPW0wOCfF3FJ5VTHpkk+veS4kH7Eig0LxLyxL4mb+EndLCIzA9WzKSf2qNalrPNapfw3iGzF7ffa5uNfoAI/+2sDrnL063Kp730Xk9vq8BYo5UU/KClKViSJSlKBSlKCbPCZnIvmmMjD5j3NMsbmzIUeqozhJR+irmT7OWs8sGkttx7iUyrVWCWULyG2RYj7KRsoPNKVzuejZSAx70E+NQp0Zz4ac6v22/SXFptrm8S4BIJ3YXturYd/KoJV9U1YexfLPJsCb2xdYTltU32omJeT2XLtvzc++21TmCvbdvSeMKT6Z5TVhMfN2in7lzfHj2x67/NEXjIupf1Exyyhe6YtvckKT6FOubf1NVGutj67Znb861xu16tD3bW1tLcOM74OJbTsVj1FRUR6tq1xUTia9u7VMLT6PYWrC5bZtVRpMRrMd875+ZSlKwpkrenClifx9rcb4+1zRbHGVI3I3HbObttj2gFavq1oup08KWJ/EOiAvjzfLJvslUrc9/Yp8xsfsUr61bWDt7d2O7e5fphj/AHTLLmk76/ux58fhq+/FfqpO0j4ZrvfrJN+B3yY43bba8ACUOuHdSwCCN0tpcUOneBVaH8KniFHdqvkHvcR+7W+vKM6gfGepuOacxH92LRENwlpT3du/0QD60toB/nKhJU8otuL+FVxDf7V7/wDpo/dp/Cq4hv8Aavf/ANNH7tadpQbZn8Tmvtztj9vmaq5GqO+gtuJbkBslJ6EcyQCPca9Hhe1mkaNcQNtvMuStNhuSkwLw2T5vYLUNndvS2rZe/fsFD51aVoOhoL/ELQ42lxtSVJUNwpJ3BHpFfqo/8G2pitSOFey/DZHbXWxE2aYVHdSuyA7JZ8erRR18SFVICgUpSgUpSgUpSgUpSgUpSgUrXeouuelWlUdSs2zO3QJQTzJgIX20pfsZRuv3kAeuoeameUblu9tb9J8PTHT1Sm634869vSmOg7D1FSz6xQWATJsO3QHZ0+WxFjMp53H33A2hA9KlHoB7aiNxK8XmkLGkOVYHil/OSXy625+3JXa088ZgupKCtT52SdgSdkc252HTvqvjUDWDUvVGeZOdZjc7unm5kRnHOSO2fyGU7IT7hWEhKlEAAknoB6aAPlCroeF63fFfB5p5F2257O1I2/3pLv8A99Vk6b8J+t+pnYybXh79qtjvUXO97w2dvpJChzrH5qTVtmJWVOCaQ2THnn23RY7QxEW8kcqV9iyElQB7geUmj9iNZ0hXJm0w3DUzI5xO/b3SU5v6d3lV4VfR94yJTshR3Lq1OE+nmJP99fOuYqnWdX0vZo6u3TRyiIKUpX4yFKUoFKUoFfrtHOwLHaL7Inct8x5SfZ3V+aUNClKUClKUHestpl3/ACS32KAkqlT5DcVoD6S1BIPu3391We2yBbsYxCJbWVIYgW2IllKleaENto23PuG9Qn4U8T+PtcPjt9rmjWOMqTuRuO2Xu22PbsVq+rW8+MLUD733CVkj8d/sp94QLLE2VseZ/cLI9YaDp9wqXy+3pRNfNUntAx/WYq3haZ3URrPjP9aeqrDWDOXtStdMpzdxSii53Bx1gK70sA8jSfc2lA91YRQ9TSpFXxSlKBSlKCTvA7q6vTviIYxm4y+zsWVclveC1bJbk7n4O57eYlv2OeqrYR1FUCsPvRpTciO6tp1tQWhxB2UlQO4IPgQauq4etUWdX+HuwZiXUKuCmfgtyQn5ktvZLnTw5uiwPQsUG0KUpQKUpQKUpQKUpQK4ICkkHuNc0oKgeLnRCXo7rnJehofcxq/KXOtkhxRWUEndxhSj1KkKUNiSSUqQe/eo/wBXX6+6PWvW3RS5YhM7Jm4AfCbXMWP9GlJB5FfmncoV+So+IFUwXyyXTG8ln2C9wnYVxgPrjSY7o2U04hRSpJ9hFBMnRXgFXm+KWnMszz+I3Z7jHRLYi4+O3ccbUNwFPLAShXgQEq2O47xU0NOOHLRzSsNPYphUEXBA/wCk5w+FSifSHF78nsQEj1VEHgC16+LLwvRPJpm0SatcmxOuq6NvHznI+/gF9VpH0god6xUwNfrFl950glyMLvdygz4O8lyPBdLZmMgee3uOu4HnAA9SNvGvNdWzTMxGrZwdinEX6LNVUUxVOms8IZRlepOCYQ0VZNk1vgOAdI6nOd5XsbTuo/ZUZ9X+KNjJcYmYtgcKXHjzEFiTc5YDa1NnopLSASRzDoVK67E7DxEZVLU66p5a1LWvqpajupXrJPU1xUNdx1dcaRuhb+V9B8Fg66bt6ZuVRv37o18PrMlKUrSdoUpSgUpSgUpSgUpSgUpSgUpXds1pl37IoFjgJKpU+Q3FaA+ktQSD7t9/dSI13PNVUUxNVXCE2uFHE/iLRL49eb5ZN8kqlbnv7FH4NsfsUr61RV8o1qB8ZalY3pxEe3ZtEVVxlpT3du/0QD60to3/AJyrDbXAt2L4fEtjKkMQLbESyFKPKENto23PuG9UmawZ09qVrplGbuqUUXO4OOsBXelgHkaT7m0oHurpLVGxRFPJ855njZxuLuYmfzTM+XZ6QwilKVkaJSlKBSlKBUx/J96tfcvq/N0zuknltuSp7SIFnzW5raSQB6OdsKT6yhAqHFd+yXi44/kkC+2iSqNPgSG5UZ9He24hQUlQ9hAoL76Vhmk2oNv1T0Zx/O7byJRc4iXHWknfsXh5rrf1VpUPcKzOgUpSgUpSgUpSgUpSgVAbj+0E7ZhGt+MQvPbCI1/aaT3p6Jak+7o2o+jkPgTU+a6d2tVuvtimWa7w2pkCayuPIjOjdDra0lKkkeggkUFC1vnzbVdo1zt0l2LMiupfYfaVyracSQpKknwIIBHsq5Ths1rha46IQsgWtpu+w9od4io6dnIA+WB4IcHnp9pT801V1xEaM3HRDW24Ys6HXbS9/ldpmLH+fjKJ5QT9NB3Qr1p37iK9Hhi1vlaH63RLzIddVjtx5Yd5jp3O7JPR0DxW2TzDxI5k/OoJRcSOln3Bahm+WmNyWG8rU60EDZMd/vca9QPyk+okfNrSlWX5tili1T0rk2Z59p6HcGEvw5rRCwhe3M08g+I6g9O8EjxquG/2K54zk87H7zHLE+C8ph5vw3HiPSkjYg+IIqExtjq6tqOErr6HZ5/kML1F2f8A0t7vGOyf4n17XnUpStJ2JSlKBSlKBSlKBSlKBSlKBW8uFXE/j/XEXp9rmi2OMqVuRuO2Xu22Pb1Wr6taNqc3ChifxHoob8+3yyb5JVJ3Pf2KPwbY/YtX1q2sHb27sd29zHS/H+6ZZc0nfX92PPj8NXHGHqB977hKyN+O/wBlPvCBZYmytjzP7hwj1hoOn27VT0epqwnyksXLXrRhMlmG4rFo7kjt5DY3SmWvlCA56PMSrlPj54qvap5RRSlKDkAqUABuT6KkdrPwxT9JuF/A8+mNyPjm4vLRfWVHdMVTyQ5GbA+aUpQtKj9I7eivO4OtMGtTeKOzs3GN21osiTeJqVJ3SsNKHZoPgQp1SNx4gKqz7XDTpnVXQDJsHUlBkzYilQ1q+ZJR+EZVv4DnSkH1E0FIdK+smO/EmOxZTK2X2lltxtY2UhQOxBHgQQRXyoFK52Nfppl199LLLanHFnZKEDmKj6ABQT18nNqgpudkOklykeY6n44tgUe5Q2Q+ge0dmsD8lZqwaqw+DTQnVqFxCY1qTcMZmWLHYKni5KugMVUkLYcbCGm1eevcqHXbl2B61Z54UClKUClKUClKUClKUClKUGjOKjQxjW7RKRBgMN/dPaeaZZ3j0KnNvPYJ+i4AB6AoIPhVPMiO/DmOxZTLjD7Ky2404kpUhQOxSQe4gjYir+arY499BPuZzBOsWMwuW03l0N3dppPSPMPc7sO5LoHU/TB8Vig2LwC69fHmOL0WyabvcLa2p+yOuq6vRh1Wxue8t78yR9AkdyK2VxW6WfG1hTqPZY2823thu5IQOrscdznrKCev5J/JqrHFcnvWGZpbMqx6YqHdLbIRJjPJ+atJ36jxSeoI7iCR41dFo/qbYNbtErdl9vbaLc1ox58BXn/B3wNnWVA9469N+9KknxrHdtRcpmmUjlWZXMuxVGJt9nGOcdsK5aVsjW3TJ7THU1+3MNrNmmbyba6ev4Mnq2T9JBO3s5T41reudromiqaZfQeExVvF2ab9qdaao1gpSleWwUpSgUpSgUpSgUpSg7totUu+5DBskBJVKnSG4rQH0lqCR/Xv7qs8tNvt+K4dDtjKkMQbZEQylStkhLbaNtz7huahNwrYn90GuSLw+0FxbHHVKJI6dsvzGx7eq1fVre3GDqB977hKyR+O/wBlPu6BZYmx2PM/uFkesNB0+4VL5db0pmvmqT2gY/rMTbwlM7qI1nxn+vmiXlXHCjK9arxaMnxqPe9H5yFW1yyLaHbrZCukxKzsQ9v5wTuABsBsoc9at1Z4cHrNjf3z9H7mc301lAutz4g55Nu9LcpsDdJTvsVbDb5wT4x/PU1nml+sWoGj2Sm8YPfHInabCTCdHaRZafoutHor29FDfoRUir5gfdSpuYTguj3GYbq5ZsQn6aZ1BjiTOmWhoP2iQVKKQVNkjlWo7nlHKdgo7q2NYVkXAFrzaL2mNZo9iv8AEW4EpmRZ6WQhJ+ctDvKobeITze+gkb5O/Ts2HRS76gzGOWTkUzsYylDr8GjkpBH5zinP0BUyqxzAcRg4DphYMMtoT8GtEFqGlQG3OUJAUs+tSt1H1msjoIAa7cDGa5txIXPJsAlWKFYL24JshU19TZiSFf54ciUEqClbrG3iog7bb1m+nXk8dNbB2MzUC+3HK5SdiqKzvCib+ghJLiv0x7KmRSgr/wCIrVXGOG7VeJgGBaH6auxfipmb8Kn2oOO8y1uJ25gQT0QOpJPU1px/jm1ab3Ngx3A8eXtsl222UBafYVrUP2VlvlG7I9E4hcdvvIewn2JLKVeBW0+5zD3BxH21Degltwx6xZ9qTx24XL1Fy+43o7TUx2pDgSwytUR7YoaSAhJ8NwN6tIHdVJ/DpdzY+K/T24BXKPj6Kyo+hLjgbV+xZq7Ad21ApSlApSlApSlApSlApSlArw8xxOyZ1gl1xDI4glWu5x1RpDR7+U9yknwUDsoHwIB8K9ylBR1q/phe9INX7vg18BWuI5zRpPLsmVHV1bdT6lDvHgQoeFba4N9ejpBrGmy36Z2eJZCtEaaVq8yI9vs1I9QBPKr8lW/zRUz+NDQUas6QHJsfhdplmOtrfjpbT58uN8p1j1npzoH0gQPlmqnuoNBdzrLptF1Q0wkWlAbTdGP8ptshXzHgPkk/RWPNPtB8BVdUqLJhTnoUxhxiQw4pp1lwbKbWk7KSR6QQRUpuBzXv74+l33vcjm9pk2NspQ0t1W65kIbJQv1qR0Qr1ch7ya6XFdpX8X3RGpdljbRpSks3VCB0Q73Ie9iuiT6wk+JqOx9jajrKeMLD6DZ51F3/AB96fu1fh7p5efz8UYaUpUQtkpSlApSlApSlApSu5abXLvd/g2WAkqlTpDcVkD6S1BI/rpEavyqqKYmqrhCbHCdifxHoqu/vN8sm+SVSAT39ijdtsfsWr61RZ8o1qB8ZakY3pxEf3ZtMVVxlpSenbveagH1pbRv/ADlWF2i22/FcMhWplSGYNsiIZC1eaEobRsVH3Ak1SdrFnTupWu2U5u4tSm7lPccjhXelhJ5GU+5tKBXSWqNiiKeT5zzTGzjcXcxM/mmZ8uz0hg9ZDhGE5LqJnVvxDErY7cLrPc7NplHQAd5Wo9yUJG5Kj0AFeTarXcb3e4lntMN6ZPmPJjx4zKeZbrijslKR4kkgVbtwu8OVr0K08D9xaYlZlc20quk5Oyg0O8Rmj9BJ7z85Q37gkDI0GUcP+iNk0K0kj4vb1ol3N9Qk3S4hOxlPkbHbxCEjzUjwHXvJratKUClKUClKUEbeNTRt/VTh9cudmjl6/wCMqXcYraRup9nl/DtD1lKQoDxLYHjVSZ6Gr/SN0kbb1S1xL4PE084qcyxi3MBiCib8KitAbJQ0+hLyUj1J7TlHsoMQ00dLGtOIvpOxbvUJYPskIq9Qd3vNUU6cILmsOKNjvVeIaR/46KvWT3e80HNKUoFKUoFKUoFKUoFKUoFKUoB6iqq+NzQT72Oq33cY7C7PFskeU5yNp2RDmfKca9SVdVp+uB0TVqlYdqnpzYtV9KLvguQt/wCS3BrlbfCQVxnR1bdR+UlWx9Y3HcTQUv6Z6hX7SzVOz5zjjvLNtzwWWiohD7Z6LaX+SpJKT7d+8CrnMZyHENa9Eot6ghM6wX+EQtle3MnmHKttXoWhQKT6CnceFUjX61LsWU3KyOyY8lcGU7FU/GXztOFCykqQrxSdtwfQamH5PjVq9WjVSRpHIbfl2a9NuzY+25EKQ03zKX6kLQnlP5QR6TSY1eqappmKqZ0mHw1IwS46c6jT8XuHM4lpXaRZBGwkMK+Qv27dD6FAisTqaPGDj1vlaXWvJlNpTPgz0RkObdVNOhXMg+nqlKh7D6ahdXPYm11VyaY4L96OZpOZYGi/X+LhPjHb58SlKVgTpSlKBSlKBW7+FjE/uh10bu77QVFscdUwkjp2qvwbY9vVavq1pCpx8JuJ/EmjDuQvt8si+SlPgn/uW90N/tC1fWrawdvbux3b3M9Lsf7nllzSd9f3Y8+Pw1fbi/z1en/CPk0uK6W511QmzRVA7EKf3Ssg+kNB0+0Cqd+89Ksl4wdU8Fu2qNv0BzlYiWCXCRMkX1lJU7Zp6lH4O8U7+e2EcwcR3lDu4II6xzwbg6yjIdWLTZnswwW5WV2UlcmRacgZkOOxUq3WpppJ5ySgHbp03G+1TyiW8+Ajh9RCtg1uyuCDKkBTVgYdT1ab6pXK2PirqhH5PMfnA1PGutbrfCtNpi2u2xWosOK0lhhhpPKhptICUpSPAAACuzQKUpQKUpQKUpQKq78ohYDbeJ223pCfwd1sbK1K273GnHGz/RCKtEqBXlKrCldmwDJkJ2LT0yA4r08yW3ED+gughHpZt9/XC+bu+PoO/wCsIq9Ad3vqjjR61XO86+4bBtEF+ZKN5iuBplBUrlQ8lalH0JSlJUSegAJNXjIUFICkkEHqCDvuKD9UpSgUpSgUpSgUpSgUpSgUpSgVFnjY19+9bpV9xmOTezyvI2lNoW2rZcKJ8lx71KV1Qg+nmI+TUg88zaxadac3fNMlk/B7bbI6n3SPlLPclCR4qUohIHiSKpW1T1HvurGrF3znIXP8pnvbtsBW6IzQ6Nso/JSnYes7k9SaDDu81ahwR6BDTLS37vMkhdnlORspWEOJ2XChnzkNepS+i1fUB6pNRL4LtBPvs6ujJ8ghdpieOuIfkJcT5kyT8ppj1jpzrHoAB+XVieueprWmWmD0uK4j46nbxbc2euzhHnOkehAO/t5R415rriimap4NjCYW5i71Ni1GtVU6QjzxWamN5Fl7OB2l4LgWZwuTHEncOSiNuX2ISSPzlH0VHWv06648+t55xbjq1Fa1rO6lKJ3JJ8ST1r81zt25NyuapfQmV5dby7C0Ya3wp7ec9s+clKUrGkClKUClKUHbtdtl3m+QrPAQVypr6IzKR4rWoJH7TVntltlvxTCYNoYUhmDbIiGAtXmgIbRsVH3Ak1CPhaxP7otd2Lo+1zRbGwqaokdO1V5jY9u5Ur6tb94vs/8AvfcJWSyo7/ZT7s2LNE2Ox5n90rI9YaDp9wqXy63pTNfNUvtBx/WYm3hKZ3URrPjP9R8VV+sedO6l675Tm7i1KbuVwccjhXelhJ5GU+5tKBW5+AZUEcYkP4Y62h02qYIoVsCtzlTuB6+TtD7Aai+epr1MbyK84lltuybHpzsG6W59MmNIb70LSdwfWPAg9CCQehqRV6vqpUVdFuOTTDO7HFgZ9cI+HZIEhDyZZKYT6ugK23u5APfyr227t1d9SjhzIlwgNTYEpmVGeSFtPsLC0OJPcUqHQj1ig+9KUoFKUoFKUoFRN46s+wjGtOscxbNsLGURrzLdeQ21PMKRD7FCR2zTgQvZW7vLsUkEEg1LKq0fKQXNb2vOK2jmJai2Htwn0KdkOA/saTQaSm6s4hiunlyxfRvF7tYZF8bLF4v14nty5zkY98RlTbaEtNK+eQOZfQHoNqm1wMcQKc70+TpdlE4KyOwsAQnHV+dNhJ2Ce/vW10SfSnkPXZRqsKvSx/IL3iuTQsixy5ybZdIToejS4y+Vbah4g/aCD0IJB3BoL7KVX9pb5Rjs40e2auYo464kBCrzZNt1flLjqIG/iShXsTUwNPNb9K9U46VYPmltuUgp5lQSvsZSPayvZfv229dBsGlKUClKUClKUClKUClKUEeuJ7QjPderdacesubW2w49DUZMiK9HccXKkdQlSikgcqUk7D0qJPhtGkeTYy/mH/zNse2/U/AHu79KrBcmyjH8NxaXkmU3eLarVDRzvy5S+VCB3D2knoANySQACah1nHlHcKtc52JgWEXLIEoPKJk98QWl+tKeVayPzgk+qglJpLphYNINJrXguPArYho5npS0hK5T6urjy/Wo+G52ASO4CtW6tcP2ZapahO36RmduiwmkBiDDVFcV2DY6nchWxUpW5J9g8K0VYPKVhVwCMn0rLcUnq9bbnzuJHqQ42Ar9IVLjSXXLTnWqxO3DBr3270cAyrfJR2UqLv3c7Z8D4KSSk+msdy1TcjZq4N/Lsyv5fd67DzEVaaa6RPzaB/gZ5H/rxa/1Nz96n8DPI/8AXi1/qbn71TEpWD3KzyTn21zf9WP20/RDv+Bnkf8Arxa/1Nz96n8DPI/9eLX+pufvV7Wf8eWmGAan3rC5WN5Ncn7RJVDelQkMdkp1HRYTzOA7BW6dyO8Guxppxz6aamaq2fBYGN5JbZV1dLDEmcljsg5ylSUq5XCfO22HTvIp7lZ5H21zf9WP20/Rjv8AAzyPwzi1fqbn71P4GeSf68Wr9Tc/eqYg6jeh6DenuVnkfbXN/wBSP20/RDo8GeS+Gb2r9Tc/erj+Bpk3hm9p/U3f3q97UXjr08031RveDXXEcolTLTJMZ1+KGOzWoAHdPM4Dt18RWR6J8YGnmt+oTmG2Wz3y03IRVymfjJDQQ+EEcyUlC1ecAebYjuB9FPcbPI+2ub/qR+2n6My0Q0fGkuNXCNJubVyuNwfS69IaaLaUoSNkIAJJ6bqO/pVX1110Ux/XbS1eIXyW/AdafTLgz2EhSoz6QUhRSSAtJSpQKSRuD0IIBrZxO1RBu3lDdKbPkE60SMPzJb0OQ5GWptqNylSFFJI3e323FbNFEUUxTTwc7jMXdxl6q/fnWqrjLUSvJr5eFqCdTrIU79CYDwJHs5q4/i2Mw/2m2P8AUHv3qnvp/mlv1E0xsmb2mNKjQrvFTKZZlBIcQlW/RXKSN+ngTWS16ayuT+LYzAf/ALm2P9Qe/eqYvDvpFO0S0RjYNcMgTen25T0ovttqbbb7Qg8iEqJISNt/ao01218xPQPE7desmg3G4KuMkxo0S3pQXFcqeZSzzqACQNvXuoVoc+Uh0q26YPmW/rTG/wAWgmdSsX05zyzanaXWXO8fS+i33Vjtm25AAcbIUUqQrYkcyVJUDsT3VlFApWu9Z9Y8c0P06azLKIF0mwnJrcENW1CFuc60rUDstaRtsg+PoqPTnlH9IUn8HhubK9rMUf8AvUEyaVDdnyj2kK1gPYdmrY9IZjK/96tl6d8ZGheo18YssLIZNluUhQQxGvjHwbtVHuSlwFTe5PQAqBPhQb9qJ/E3whXjXjVO35jaczhWjsLai3uRpcRbm/I4tYUlST49ptsR4evpLClBXH/FsZh/tNsf6g9+9T+LYzD/AGm2P9Qe/eqb+sOrOO6LaWyc4yWPMkxWnm47caGEl15xw7BKeYgdwUo7nuSajb/GRaVbf/gfMd/zY3+LQay/i2Mw/wBptj/UHv3q71m8nRmtryKBcm9VLVHVGkIdD0aG8l1HKoHdB5hsrp061MzRnV/HtbdMG82xuJNhxjJdiORpoQHWnEEbhXKSOoUlQ69xFbCoOEjZIG+/rNc0pQKUpQKUpQKUpQKUrg921BWb5QjVO43vWWHpfDlrRaLAw3JksJV0dlup5uZXp5G1IA9BWv01rDhc4cHeIHNLm3cbrItOPWdpC5smMgKecW4SG2m+bzQSEqUVEHYJ7utYtxJ3c3zi21CnqWV7XuRHSfyWldkn9iBU5vJzWluLw43+7cg7WZf3EFe3UpbYaAHuK1faaDRPE7wX2/R3TT74GE5Dcbna4rzbNwiXJKC6ylxQSh1K0BIKeYpSQRuOYHfvrQmg2o9w0r4gcby2HJW1Halojz0BWyXorigl1Ch4+aeYb9ykpPhVuuuOBz9TuHzKcEtTsVqddInZR1ylFLSXErStJUQCQN0juBqv7+Ls1uCuZN/wsEdR/lr/APg0FoIO4rycqv8AExXB7xk09QEW1wnpzpJ281tBWf8AlruWtmRGskOPLUlUhthCHFJO4KgkA7H0b71HrjkzP7k+EG8Qmng3Kv0hm0tbHqUqV2jnu7NtY+tQVUuqu+a56paUGVd71PJCQerr7znd71Lr7Y/dbngmpdtvTaFs3Gx3JuSEb7FLjLoVt9qSK2bwlYucs4x8HiKbCmYc740dJ7kiOhTwJ+shA99eVxLYt9xvFnndlS2UNfGrkxpJ7g2/s+kD1bObe6guctNziXqwQrxAc7SLNYbksr+khaQpJ+wiu2fkn2VoXg1zL7suDvFluulcq0IXZ39zvsWFbNj/AMItVvo/JPsoKY+Kn8cjUL+Vl/8AImsT0izyRplrhjOcx1K5bZOQ6+lPetg+a6j3tqWPfWWcVP45GoX8rL/5E1ry64ndLRhdgymQlJt97EgRnB9NhzkcQfWN0H2LFBezFlR51uYmxHkPR30JdadQdwtCgCkg+ggg1RTnP/WnkX8qyv7ZdWqcFmov3fcJ1ljSpHa3HHlmyyd1bqKW9iyfZ2SkDf0pNVV5z/1p5F/Ksr+2XQXA8L34nunn8jNf1mtuVqPhe/E908/kZr+s1ts/JO/dQVk+UUzL4418smHMulTNhtYccTv8l+QrnPT/AHaGftqJMux3SDj9vvcqIpuDcVOpivHudLRCV7ewqFZjrlmX3wOI3MctS52jE26O/B1b7/gEHs2v6CE1v7XHS1Vg8m7oxfhFKZMR1x2SSPOAuCTIBPs7NsfZQb58nZmQvPD/AHnD3nQp+w3QrbRv8liQnnT/AOYl77amLVWnk+sz+IOJ2RjDzoTHyK2OsJSTsC+z+GQfbypdHvq0ugid5Q38UuH/AMQxf7J+q08DxpOZ6pY5iK5hhpvFzjW8yQjtCyHXUo5+Xcc23NvtuN9u+rLPKG/ilw/+IYv9k/VeGhv4zmnf/Etu/wDUooJWXvya+RsRXXMe1Rtk10AltqdbnI4UfQVpWvb7DUL8sxW+4Pm9zxLJYSoV1tr6o8lhRB5VDxBHQpI2II6EEEVfJVWXlCcfZtPFXGuzKAn43skeS6R85xCnGd/0W0fZQSs4GdXblqVoC9Y8gmOTLxjD6YKpDquZb0ZSeZhSye9QCVo38QgE9TUoarV8m9e1RtbMtx8ubInWVMrl9KmX0gfseVVlR7qCA3lJcy5YGFafsOH8It68SUb+CR2LJ2+s99lQLFjuhxU5J8EX8WCWIRkbjl7YoK+T28oJrd3GfmX3Y8YmTdk5zxbOW7Mx1327FP4Qf+Kp2thRtLivyQcnKPgxMo5H90CSR5xaSv4F9mxUqgzzybWZ7O5rp8+73hm8Rkb+j8C8f2s1YDVO/B5mf3FcYWJvuuhuLdHV2eRudgQ+nlRv/OdmfdVxA7qBSlKBSlKBSlKBSlKBXB7q5rg91BRnq2pSuIDOVL+Uchnk+34S5Vknk/EJRwiBQ713uYo+3Zsf3VXjr/bDaOKbUKCQRy5BNWPYt5Sx+xQqwDyd9wblcK9xhpVuuJkEhCh6ApplQ/rNBLelYTrBmEvT/QbLszt/Y/DbXa35Mbtk8yC8E/g+YbjccxTuN6ri/jBdfNyOzxP/AOmq/wASgtTqujykWafCs5w/AWHfMgw3bpIQD3reV2be/rCWln69T8w+4zrvp3YbrdA2J0u3R5Ejs08qe0W0lSth4DcnpVPnFJmf3dcWmaXht7tIrE426MR3dnHAZBHqJQpX1qDe/k4MV+HawZZmDjRUi12tEJtRHQOSHN+nr5WVfbXl+UUxb4q4iLLk7Sdmr1Z0pWdvlOsLUhX9BTVaf0b4ltQtDLDcrThUSwrauMhMiQ5cIinnCUp5UgELT5oG/TbvJr4azcRme66wrRGzeJYkfFS3VxnLfFUysdoEhQJK1bjzEn3UEoPJtZns/munz7nyks3iMjf0fgXjt72asBPyT7Kp34PczGF8YWJSHXQ3FubyrQ/udgQ+nkRv/OdmfdVxB+QfZQUx8VP45GoX8rL/AORNbji6djNPJJMX+Kxz3HGL3LubZA84sFwNvp9nKQs/7utOcVP45GoX8rL/AORNTz4IbVBvvAsiyXNkPQp0u4xZDR7ltrVyqHvBNBGzye2ov3Oa93DApsjkh5LE3ZSpXT4UxutH2tl0eshNRfzj/rSyL+VZX9susgms37QniWcaQVC6YlfApBPQO9i7uk/mrSB7QqsSyG5tXrMrpeGGVMtTJr0lDajuUBbhUAfZvtQXHcL34nunn8jNf1mvV19zP7gOGnM8qQ6G34tsdbjK322fdHZNf01pryuF78T3Tz+Rmv6zWjfKMZmLVohj2FMOhL17uRkOpB6lmOncgj0do42fq0FcWP2eTkWX2uwRNzIuMtqG1sN91OLCB+1VW6cUOCRrtwPZVjkCOSm0WxuVFSB1QIhSvp9RtQ99VK4Zlc/BtQLPmFqjw5E60ykTI7cxsraLiDukqSCCQDse8d1SJunH3rZebFNtE+14a5EmMORnkfF7vnIWkpUP896CaDRGlmXrwHWvFsxbWUptdzYkubfOaCx2ifegqHvq8xl1t5hDzK0rbWkKSpJ3BB6gj3VQLv161dDwxZn93nCfhV8cd7SS3b0wJJPf2scllRPrPIFfWoNVeUN/FLh/8Qxf7J+q8NDfxnNO/wDiW3f+pRVh/lDfxS4f/EMX+yfqvDQ38ZzTv/iW3f8AqUUF4FVreUjQBrViDvzlWRaT7BIX/wD7VlNVieUYuzUviRsVraO6oVgbLnqU4+6rb7APtoPJ8nuVji3fCd9jYJYV7O0Z/v2qzvKL9ExbCbxk08gRbXCenPEnbzG0FZ/5arj8nFZlStfsmvhQS3CsRY5vAKdfb2H2NK+ypR8ceZjEuEC8w2ng3Kv0hm0NdevKpXaOdPR2bax9agqfvF0mX3JJ96nL7SXOkuSnlfSccUVqP2k1cRA0uR/ASa0rUx+GXiXwFSSP/wAwqPzFXt7U71ThBlqg3SPOSy08ph1LobeG6F8qgdlDxB22NSq/jDddt/8Ao3DNvR8Xvf41BFm3zplmvsW5Q1qZlw30PtL7ihxCgoH3ECr1sMySLmGndjyuEUmPdoDE5vY77BxsL292+3uqii5z3LpfJlzcZZZXKfW+pphPKhBUoqKUgk7Ab7Ab91WtcCWZ/dTwjW62PPBcrH5j9rXuevJv2rfu5XQkfm0EmaUpQKUpQKUpQKUpQKHqNqUoKnuO/BJeK8V87IDHUm35LGanx3dvNLiEJadTv6QpAUfU4PTWS8C2vuJ6X3u/4bnd1atNqvCm5USe/uGWZCAUqS4R8kLSU7KPQFGx76nvrPoviGt+nbmLZUy42ttXbQbhHA7aE9ttzo36EEdFJPRQ9YBFeWacAOt+P3J0Yum05XBBPZuxpSYrpT+U26QAfUFK9tBvfjK4l9Nbpw9z9P8ABstgZBdb44028q2Ods3HjocS4sqcHm7qKEpCQSepPTaoAaf4fcdQNUbDhlqaW5Ku01uKnlG/IlSvPWfUlPMonwANbmsvA9xG3eYliTh0W0Nk7F+4XJgIT69m1LUfcDU4uGjhKsOhSnMkvNwav2YPtFkzENlLEJs/KQwD1JPcVnYkdAEgncNwahZJE020MyDJUbNs2O0uvMJPiptshtPvVyD31Ru+87JlOPvuKcdcUVrWo9VKPUk++rmeJrT3NtU+HyfgmCyLaxMuMlgSXLg+plHYIX2igClKiSVIQNtu7eoSWfyeGsf3RwPjm74gm3fCG/hSmpry1hrmHPyp7EbnbfYbj20G3tPvJ/aW3vSjG71k15y1m8zrbHlTGosplDbbrjYWpKQpkkAc23Unurpar8BGmeK6JZTk+J3jLJF4tdtenRmZcplxtwtJ51JKUtJJ3SlQ6EddqnQ002wwhlpAQhCQlKR3ADoBXynwo9ytcm3y2w5HktKZdQfnJUkpI+wmgoUts+Vab1EukFwtSYjyJDKx3pWhQUk/aBV62G5JFzHTmx5XCKTHu1vZnNhJ32DjYXt7t9vdVbUnyd2taZzwiXvD1MBxQaU5NeCinfzSR2PQ7bVO/h3wfMdN+HiyYNm8m3Sblau1YQ9AdU42pkuKU2N1JSdwFcu23gKCrXip/HI1C/lZf/ImrAOAn8Te3fynN/tBWlda+CDVnUXX/Ks2sl4xVm33WcqSw3KlPJdSkpSPOAaIB6eBNSj4YtKsi0b0AiYTlEm3yLgzMkSFOQHFLaKXF7p2KkpO/p6UEMPKIadfEWtVo1ChscsXIYnYSVJHT4THATufzmi3t+Yahqn5Y9tXM8Tei7+uWhEnFbY9DjXqPJanW1+ZuG0up3SpKlJBICkKWOgPXb0VBn+Lw11Cx/8AFMLI3/8A5B7/AAaCd3C9+J5p5/IzX9ZqA3H7mf3R8VJx5l7mj47bmYZSD07Zz8M4fbstsH82rGdF8Ou2n+gGKYXfFxV3G1W9EWQqKsrbKhvvykgEjr6BUHNROBnXbPNWckzORe8OSq73J+alC5r26ErWSlP+Z8E8o91BrvhB4bsc17uWUScvnXeHa7Q2who21xDanHnSs9VLQrolLZ6bfOHWpTjydOiQVuchzYj0fDY/+BWwOE3Qu9aE6R3KxZNIt0m83C5rmOuwHFLbDYbQhtO6kpPTlUe751b8oKVOIjSyJo3xC3vBrZJlSbZHDL8J+WQXFtONpWOYpABIJUncAb8tTI8m/mfwzTzLsDfe3XbprdyjoUevZvJ5FgeoKaB+vXvcWvCdmet2qVoy7CZ1iiqatogzE3J9xoqKHFKQpPKhW/RZB7u4V5vCxwr6vaG64qye/XXGn7LLt70GW1BlurcO5StBCVNJB2WhPj3E0GTeUN/FLh/8Qxf7J+q4NK73bMa1zw3Ir1IMe2229w5kp4IKy202+ha1cqQSdgCdh1q17iu0hynWvQpjD8RftrNwburE0quLqmm+RCHEkbpSo77rHh6ahKfJ467j/wDU8L/+ovf4NBLe7cd3Drb7U9JhZNc7q+hJKIkS1PpW4fQC6lKR7zVaWsmpty1g1pvee3GOIpnupDEQK5hHZQkIbb38SEgbnxJJ8a30z5O/XNxwB28YW2nxV8PeVt9jNbc0u8nTbbVfY911Uy1q8ssrCzaLS2tpl4jwceVsop9ISlJPpoMq8nrp1MxnQy7ZvcoymXsmlpMYLTsVRWApKV+xS1u7ekAHxrVflIs0+FZvh+Ax3gUwYjt0kIT9N1XZt7+sJaWfr1YdChRLbbI9vt8ZmLEjtpZYYZQEIaQkbJSlI6AAAAAVA/iC4PNatYOIXIM6g3fFGrdKW21CZkzHkuNsNtpQkKAaIBOxUQCeqjQRt4U9D7TrtrRKxzIpVxi2eDbXJ0h2AtKHCoLQhCQpSVAble/d3JNTP/i6dEf9YM3/AF2P/gV7HB/w15PoMMqnZlLtEq43X4OzHVbXluJbab51K3KkJ2JUsfo1KOgp74sNC7NoRq9b7FjUu5S7NcLaiYy7cFpW4HAtaHEcyUpBA5Unu+dW5PJwZn8B1MyzBJD2zdzgN3BhKu7tGF8qgPWUO7/UqQnGBw4ZJrzZ8Zk4dMtMa7Wd19CxcXFtIdZdCCdlJSrqFNg7EfOPWtMaCcHWuOknELjedzLjijkCE+pExqNPdUtbDiFNuBILIBOytwCR1AoLA6UHd1pQKUpQKUpQKUpQKUpQKUpQNhSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKBSlKD//2Q==';
const LogoCtx = createContext({ logo: null, setLogo: () => {} });
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* =========================================================
   UI primitives
   ========================================================= */
function Badge({ tone = 'neutral', children, className }) {
  const t = { neutral: 'bg-sunk text-muted border-line', ok: 'bg-oksoft text-ok border-transparent', warn: 'bg-warnsoft text-warn border-transparent', bad: 'bg-maplesoft text-maple border-transparent', info: 'bg-ropesoft text-rope border-transparent' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap', t, className)}>{children}</span>;
}
function Btn({ variant = 'secondary', size = 'md', className, ...p }) {
  const v = { primary: 'bg-maple text-white border-maple hover:brightness-110', secondary: 'bg-surface text-ink border-line hover:bg-sunk', ghost: 'bg-transparent text-ink border-transparent hover:bg-sunk', rope: 'bg-rope text-white border-rope hover:brightness-110', ok: 'bg-ok text-white border-ok hover:brightness-110', danger: 'bg-surface text-maple border-maple hover:bg-maplesoft' }[variant];
  const s = { xs: 'px-2 py-0.5 text-xs', sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm' }[size];
  return <button type="button" {...p} className={cx('inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rope', v, s, className)} />;
}
function Banner({ tone = 'ok', children, onClose, action, className }) {
  const t = { ok: 'bg-oksoft text-ok border-ok', bad: 'bg-maplesoft text-maple border-maple', warn: 'bg-warnsoft text-warn border-warn', info: 'bg-ropesoft text-rope border-rope' }[tone];
  return <div role="status" className={cx('fade-in flex flex-wrap items-center gap-3 rounded-md border-l-4 px-3 py-2.5 text-sm font-medium', t, className)}>
    <div className="min-w-0 flex-1">{children}</div>
    {action}
    {onClose && <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded px-1.5 font-bold opacity-70 hover:opacity-100">✕</button>}
  </div>;
}
const Td = ({ children, className, ...p }) => <td {...p} className={cx('px-3 py-2 align-top', className)}>{children}</td>;
function Table({ head, children, empty, isEmpty }) {
  return <div className="overflow-x-auto rounded-md border border-line bg-surface">
    <table className="w-full text-sm">
      <thead className="bg-sunk text-left text-muted"><tr>{head.map((h, i) => <th key={i} className="px-3 py-2 text-xs font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{children}</tbody>
    </table>
    {isEmpty && <div className="px-3 py-4 text-sm text-muted">{empty}</div>}
  </div>;
}
function Field({ label, children, hint, className, required }) {
  return <label className={cx('block', className)}>
    <span className="mb-1 block text-xs font-semibold text-muted">{label}{required && <span className="text-maple"> *</span>}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </label>;
}
function Section({ title, children, actions, logo, sub, className }) {
  return <section className={cx('rounded-lg border border-line bg-surface', className)}>
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
      {logo && <BoxingCanadaLogo size="sm" />}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {actions}
    </div>
    <div className="p-4">{children}</div>
  </section>;
}
function YesNo({ value, onChange, disabled, expect }) {
  const flagged = value && expect && value !== expect;
  return <div className="flex items-center gap-1.5">
    {['yes', 'no'].map(v => <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)} aria-pressed={value === v}
      className={cx('min-w-[48px] rounded-md border px-2.5 py-1 text-xs font-bold capitalize transition disabled:cursor-not-allowed',
        value === v ? (flagged ? 'border-warn bg-warnsoft text-warn' : 'border-rope bg-rope text-white') : 'border-line bg-surface text-muted hover:bg-sunk')}>{v}</button>)}
    {flagged && <span className="text-xs font-semibold text-warn">Review</span>}
  </div>;
}
function NormalAbnormal({ value, onChange, disabled }) {
  return <div className="flex gap-1.5">{['normal', 'abnormal'].map(v => <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)} aria-pressed={value === v}
    className={cx('rounded-md border px-2.5 py-1 text-xs font-bold capitalize disabled:cursor-not-allowed', value === v ? (v === 'normal' ? 'border-ok bg-ok text-white' : 'border-maple bg-maple text-white') : 'border-line bg-surface text-muted hover:bg-sunk')}>{v}</button>)}</div>;
}
const RoleChip = ({ role }) => <Badge tone="neutral"><span aria-hidden="true">{ROLES[role].emoji}</span>{ROLES[role].label}</Badge>;
const Check = ({ ok, labelYes = 'Done', labelNo = 'Pending' }) => ok ? <Badge tone="ok">✓ {labelYes}</Badge> : <Badge tone="warn">{labelNo}</Badge>;

/* ---------- Logo ---------- */
const LOGO_SIZES = { xl: 'w-24 h-28', lg: 'w-14 h-16', md: 'w-11 h-12', sm: 'w-9 h-10', xs: 'w-7 h-8' };
const LOGO_FALLBACK = { xl: ['text-3xl', 'text-[11px]'], lg: ['text-lg', 'text-[8px]'], md: ['text-base', 'text-[7px]'], sm: ['text-sm', ''], xs: ['text-xs', ''] };
function BoxingCanadaLogo({ size = 'md' }) {
  const { logo, setLogo } = useContext(LogoCtx);
  const ref = useRef(null);
  const [fe, fl] = LOGO_FALLBACK[size];
  const onFile = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; const url = await readFileAsDataUrl(f); setLogo(url); e.target.value = ''; };
  return <>
    <button type="button" onClick={() => ref.current && ref.current.click()} title={logo ? 'Boxing Canada logo. Select to replace BoxCanLogo.jpg' : 'Select BoxCanLogo.jpg from your computer'}
      className={cx(LOGO_SIZES[size], 'shrink-0 overflow-hidden rounded-md border border-black/10 bg-white p-0.5 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-rope flex items-center justify-center')}>
      {logo ? <img src={logo} alt="Boxing Canada" className="h-full w-full object-contain" />
        : <span className="flex flex-col items-center justify-center leading-none text-[#C8102E]"><span className={fe} aria-hidden="true">{size === 'xs' || size === 'sm' ? '🍁' : '🍁🥊'}</span>{fl && <span className={cx(fl, 'mt-0.5 font-display font-bold tracking-wide')}>CANADA</span>}</span>}
    </button>
    <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
  </>;
}

/* ---------- Modal ---------- */
const modalStack = [];
function Modal({ title, subtitle, onClose, children, footer, size = 'lg' }) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const boxRef = useRef(null);
  useEffect(() => {
    const id = Symbol('m'); modalStack.push(id);
    const h = e => { if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) closeRef.current(); };
    window.addEventListener('keydown', h);
    if (boxRef.current) boxRef.current.focus();
    return () => { window.removeEventListener('keydown', h); const i = modalStack.indexOf(id); if (i >= 0) modalStack.splice(i, 1); };
  }, []);
  const w = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-6xl' }[size];
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-2 pb-6 sm:px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
    onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cx('fade-in w-full rounded-lg border border-line bg-surface shadow-2xl outline-none', w)}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <BoxingCanadaLogo size="xs" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <Btn variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Btn>
      </div>
      <div className="px-4 py-4">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
    </div>
  </div>;
}

/* =========================================================
   Document preview (Uploaded Original)
   ========================================================= */
function ScanPage({ med, boxer, page }) {
  const female = boxer.gender === 'F';
  const qs = female ? [...ANNUAL_HISTORY_Q, ...ANNUAL_FEMALE_Q] : ANNUAL_HISTORY_Q;
  return <div className="paper h-full w-full p-8 text-[11px] leading-relaxed" style={{ transform: 'rotate(-0.3deg)' }}>
    <div className="flex items-center justify-between border-b-2 border-black pb-2"><div className="font-bold">BOXING CANADA, ANNUAL MEDICAL EXAMINATION</div><div>Page {page} of 3</div></div>
    {page === 1 && <div className="mt-4 space-y-2">
      <div>Athlete: <b>{fullName(boxer)}</b> &nbsp; Membership ID: <b>{boxer.membershipId}</b></div>
      <div>Date of birth: {boxer.dob} &nbsp; Gender: {boxer.gender === 'F' ? 'Female' : 'Male'} &nbsp; Province: {boxer.province}</div>
      <div className="mt-4 border border-black p-2">Exam date: {med.examDate}<br />Blood pressure: {med.bp} &nbsp; Resting HR: {med.hr} bpm<br />Visual acuity: {med.visualAcuity}</div>
      <div className="mt-4">Physician: {med.physicianName}, {med.license}<br />{med.clinicAddress}</div>
      <div className="mt-10 italic opacity-60">[scanned paper copy, handwriting partially legible]</div>
    </div>}
    {page === 2 && <div className="mt-3 space-y-1">{qs.map((q, i) => <div key={i} className="flex justify-between gap-2 border-b border-dotted border-black/40"><span>{i + 1}. {q}</span><span className="font-bold uppercase">{(med.history || {})['q' + (i + 1)] || '—'}</span></div>)}</div>}
    {page === 3 && <div className="mt-3 space-y-1">{EXAM_SYSTEMS.map(s => <div key={s} className="flex justify-between border-b border-dotted border-black/40"><span>{s}</span><span className="font-bold uppercase">{(med.exam || {})[s]}</span></div>)}
      <div className="mt-3">TUEs: {med.tues} &nbsp; High myopia: {med.highMyopia} &nbsp; Deafness: {med.deafness}</div>
      <div className="mt-2">Notes: {med.notes}</div>
      <div className="mt-8">Fit to box: <b>{med.fitToBox === 'yes' ? 'YES' : 'NO'}</b></div>
      <div className="mt-6 w-56 border-t border-black pt-1">Signature, {med.physicianName}</div>
    </div>}
  </div>;
}
function DocumentPreviewModal({ med, boxer, onClose }) {
  const [mode, setMode] = useState('page');
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const scan = med.backupScan || {};
  const isImage = scan.dataUrl && scan.dataUrl.startsWith('data:image');
  const isPdf = scan.dataUrl && scan.dataUrl.startsWith('data:application/pdf');
  const pages = isImage ? 1 : 3;
  const W = 560, H = 725, z = zoom / 100;
  const sheet = p => <div key={p} className="mx-auto" style={{ width: W * z, height: H * z }}>
    <div style={{ width: W, height: H, transform: `scale(${z})`, transformOrigin: 'top left' }}>
      {isImage ? <img src={scan.dataUrl} alt="Uploaded Original" className="h-full w-full bg-white object-contain" /> : <ScanPage med={med} boxer={boxer} page={p} />}
    </div>
  </div>;
  return <Modal size="xl" title="Uploaded Original" subtitle={`${fullName(boxer)}, Annual Medical of ${fmtDate(med.examDate)}. Uploaded original of the paper form; the structured clinical record is the primary record.`} onClose={onClose}>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-line p-0.5">
        {[['page', 'Page Turn'], ['scroll', 'Multi-Page Scroll']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={cx('rounded px-3 py-1 text-xs font-semibold', mode === k ? 'bg-rope text-white' : 'text-muted hover:bg-sunk')}>{l}</button>)}
      </div>
      <div className="flex items-center gap-1">
        <Btn size="sm" onClick={() => setZoom(z => Math.max(50, z - 25))} disabled={zoom <= 50} aria-label="Zoom out">−</Btn>
        <span className="w-14 text-center text-sm font-semibold tabular-nums">{zoom}%</span>
        <Btn size="sm" onClick={() => setZoom(z => Math.min(250, z + 25))} disabled={zoom >= 250} aria-label="Zoom in">+</Btn>
        <Btn size="sm" variant="ghost" onClick={() => setZoom(100)}>Reset</Btn>
      </div>
      {mode === 'page' && !isPdf && <div className="ml-auto flex items-center gap-2">
        <Btn size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous page</Btn>
        <span className="text-sm tabular-nums">{page} / {pages}</span>
        <Btn size="sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>Next page</Btn>
      </div>}
    </div>
    <p className="mb-2 text-xs text-muted">{scan.fileName || 'uploaded-original'}{scan.simulated ? ' (sample scan rendered for this demo)' : ''}</p>
    <div className="max-h-[70vh] overflow-auto rounded-md bg-[#5b6270] p-4">
      {isPdf ? <object data={scan.dataUrl} type="application/pdf" className="h-[65vh] w-full bg-white"><p className="p-4 text-white">This browser can’t display the PDF inline.</p></object>
        : mode === 'page' ? sheet(page) : <div className="space-y-4">{Array.from({ length: pages }, (_, i) => sheet(i + 1))}</div>}
    </div>
  </Modal>;
}

/* =========================================================
   Annual Medicals
   ========================================================= */
function AnnualMedicalDetail({ med, boxer, onScan }) {
  const female = boxer.gender === 'F';
  const st = medState(med);
  return <div className="space-y-4">
    <div className="rounded-md border border-line bg-sunk p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {med.fitToBox === 'yes' ? <Badge tone="ok">✓ Fit to Box, Cleared</Badge> : <Badge tone="bad">Not fit to box</Badge>}
        <Badge tone={st.tone}>{st.label}</Badge>
        <div className="ml-auto"><Btn size="sm" onClick={onScan}>View Uploaded Original</Btn></div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {[['Exam date', fmtDate(med.examDate)], ['Valid until', fmtDate(medExpiry(med))], ['Attending physician', med.physicianName], ['License #', med.license], ['Blood pressure', med.bp + ' mmHg'], ['Resting heart rate', med.hr + ' bpm'], ['Visual acuity', med.visualAcuity], ['Clinic address', med.clinicAddress]].map(([k, v]) =>
          <div key={k} className={k === 'Clinic address' ? 'col-span-2 sm:col-span-1' : ''}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
      </dl>
    </div>
    <div>
      <h4 className="mb-2 font-display text-base font-bold">Section A: Athlete Medical History Questionnaire</h4>
      <Table head={['#', 'Question', 'Answer']}>
        {ANNUAL_HISTORY_Q.map((q, i) => <tr key={i}><Td className="text-muted">{i + 1}</Td><Td>{q}</Td><Td><Badge tone={med.history['q' + (i + 1)] === 'yes' ? 'warn' : 'neutral'}>{(med.history['q' + (i + 1)] || '—').toUpperCase()}</Badge></Td></tr>)}
        {female && ANNUAL_FEMALE_Q.map((q, j) => { const i = 15 + j; return <tr key={i} className="bg-sunk"><Td className="text-muted">{i + 1}</Td><Td>{q} <span className="text-xs text-muted">(female athletes)</span></Td><Td><Badge>{(med.history['q' + (i + 1)] || '—').toUpperCase()}</Badge></Td></tr>; })}
      </Table>
    </div>
    <div>
      <h4 className="mb-2 font-display text-base font-bold">Section B: Physician Physical, Neurological & Systemic Examination</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {EXAM_SYSTEMS.map(s => <div key={s} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm"><span>{s}</span><Badge tone={med.exam[s] === 'normal' ? 'ok' : 'bad'}>{med.exam[s] === 'normal' ? 'Normal' : 'Abnormal'}</Badge></div>)}
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-muted">TUEs</dt><dd className="font-semibold">{med.tues}</dd></div>
        <div><dt className="text-xs text-muted">High myopia</dt><dd className="font-semibold capitalize">{med.highMyopia}</dd></div>
        <div><dt className="text-xs text-muted">Deafness</dt><dd className="font-semibold capitalize">{med.deafness}</dd></div>
      </dl>
      <div className="mt-3 rounded-md border border-line p-3 text-sm"><div className="text-xs text-muted">Physician clinical summary notes</div><p className="mt-1 max-w-prose">{med.notes}</p></div>
    </div>
  </div>;
}
function AnnualMedicalForm({ boxer, onSave, onCancel }) {
  const { viewer } = useApp();
  const female = boxer.gender === 'F';
  const n = female ? 18 : 15;
  const [f, setF] = useState(() => ({
    examDate: REF_DATE, physicianName: viewer.role === 'medical' ? nameOf({ users: [viewer] }, viewer.id) : '', license: viewer.license || '', clinicAddress: '',
    bp: '', hr: '', visualAcuity: '', fitToBox: 'yes', history: {}, exam: allNormal(), tues: 'None declared', highMyopia: 'no', deafness: 'no', notes: '', scan: null
  }));
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const onScan = async e => { const file = e.target.files[0]; if (!file) return; const dataUrl = await readFileAsDataUrl(file); set('scan', { fileName: file.name, dataUrl: file.size < 2500000 ? dataUrl : '', pages: 1 }); };
  const save = () => {
    const missing = [];
    if (!f.examDate) missing.push('exam date'); if (!f.physicianName.trim()) missing.push('physician'); if (!f.license.trim()) missing.push('license #');
    if (!f.bp.trim() || !f.hr.trim()) missing.push('vitals');
    const unanswered = Array.from({ length: n }, (_, i) => 'q' + (i + 1)).filter(k => !f.history[k]);
    if (unanswered.length) missing.push(`${unanswered.length} history question${unanswered.length > 1 ? 's' : ''}`);
    if (missing.length) { setErr('Complete the following before saving: ' + missing.join(', ') + '.'); return; }
    onSave({ id: uid('am'), boxerId: boxer.id, examDate: f.examDate, physicianName: f.physicianName, license: f.license, clinicAddress: f.clinicAddress || '—', bp: f.bp, hr: f.hr, visualAcuity: f.visualAcuity || '—', fitToBox: f.fitToBox, history: f.history, exam: f.exam, tues: f.tues, highMyopia: f.highMyopia, deafness: f.deafness, notes: f.notes || '—', backupScan: f.scan || { pages: 3, fileName: 'no-scan-uploaded', simulated: true }, createdAt: nowIso() });
  };
  const qs = female ? [...ANNUAL_HISTORY_Q, ...ANNUAL_FEMALE_Q] : ANNUAL_HISTORY_Q;
  return <div className="space-y-4">
    {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Exam date" required><input type="date" className="field" value={f.examDate} onChange={e => set('examDate', e.target.value)} /></Field>
      <Field label="Attending physician" required><input className="field" value={f.physicianName} onChange={e => set('physicianName', e.target.value)} /></Field>
      <Field label="License #" required><input className="field" value={f.license} onChange={e => set('license', e.target.value)} /></Field>
      <Field label="Clinic address" className="sm:col-span-3"><input className="field" value={f.clinicAddress} onChange={e => set('clinicAddress', e.target.value)} /></Field>
      <Field label="Blood pressure (mmHg)" required><input className="field" placeholder="120/80" value={f.bp} onChange={e => set('bp', e.target.value)} /></Field>
      <Field label="Resting heart rate (bpm)" required><input className="field" inputMode="numeric" value={f.hr} onChange={e => set('hr', e.target.value)} /></Field>
      <Field label="Visual acuity"><input className="field" placeholder="20/20 OU" value={f.visualAcuity} onChange={e => set('visualAcuity', e.target.value)} /></Field>
    </div>
    <div>
      <h4 className="mb-2 font-display text-base font-bold">Section A: Athlete Medical History Questionnaire</h4>
      <div className="divide-y divide-line rounded-md border border-line">
        {qs.map((q, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><span className="min-w-0 flex-1"><span className="text-muted">{i + 1}.</span> {q}</span><YesNo value={f.history['q' + (i + 1)]} onChange={v => set('history', { ...f.history, ['q' + (i + 1)]: v })} /></div>)}
      </div>
    </div>
    <div>
      <h4 className="mb-2 font-display text-base font-bold">Section B: Physician Physical, Neurological & Systemic Examination</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {EXAM_SYSTEMS.map(s => <div key={s} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm"><span>{s}</span><NormalAbnormal value={f.exam[s]} onChange={v => set('exam', { ...f.exam, [s]: v })} /></div>)}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="TUEs"><input className="field" value={f.tues} onChange={e => set('tues', e.target.value)} /></Field>
        <Field label="High myopia"><YesNo value={f.highMyopia} onChange={v => set('highMyopia', v)} /></Field>
        <Field label="Deafness"><YesNo value={f.deafness} onChange={v => set('deafness', v)} /></Field>
      </div>
      <Field label="Physician clinical summary notes" className="mt-3"><textarea rows={3} className="field" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <Field label="Fit to box"><YesNo value={f.fitToBox} onChange={v => set('fitToBox', v)} expect="yes" /></Field>
        <Field label="Uploaded Original (optional PDF or image of the paper form)"><input type="file" accept="image/*,application/pdf" onChange={onScan} className="text-sm" /></Field>
      </div>
    </div>
    <div className="flex justify-end gap-2"><Btn onClick={onCancel}>Cancel</Btn><Btn variant="primary" onClick={save}>Save Annual Medical</Btn></div>
  </div>;
}
function BoxerAnnualMedicalsModal({ boxerId, initialId, onClose }) {
  const { data, update, viewer } = useApp();
  const boxer = getUser(data, boxerId);
  const meds = medicalsOf(data, boxerId);
  const [view, setView] = useState(initialId ? { detail: initialId } : 'list');
  const [scanMed, setScanMed] = useState(null);
  const [saved, setSaved] = useState('');
  const canCreate = viewer.id === boxerId || canClinical(viewer);
  const current = view && view.detail ? meds.find(m => m.id === view.detail) : null;
  return <Modal size="xl" title={view === 'create' ? 'New Annual Medical Examination' : current ? 'Annual Medical Examination' : 'All Annual Medical Examinations'}
    subtitle={`${fullName(boxer)}, ${boxer.membershipId}`} onClose={onClose}>
    {saved && <Banner tone="ok" className="mb-3" onClose={() => setSaved('')}>{saved}</Banner>}
    {view === 'list' && <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">{meds.length} examination{meds.length === 1 ? '' : 's'} on file, newest first.</p>{canCreate && <Btn variant="primary" size="sm" onClick={() => setView('create')}>New Annual Medical</Btn>}</div>
      <Table head={['Exam date', 'Valid until', 'Physician', 'Status', '']} isEmpty={!meds.length} empty="No Annual Medical on file yet.">
        {meds.map(m => { const st = medState(m); return <tr key={m.id}><Td className="font-semibold">{fmtDate(m.examDate)}</Td><Td>{fmtDate(medExpiry(m))}</Td><Td>{m.physicianName}<div className="text-xs text-muted">{m.license}</div></Td><Td><Badge tone={st.tone}>{st.label}</Badge></Td>
          <Td><div className="flex justify-end gap-1.5"><Btn size="sm" variant="rope" onClick={() => setView({ detail: m.id })}>Open</Btn><Btn size="sm" onClick={() => setScanMed(m)}>Uploaded Original</Btn></div></Td></tr>; })}
      </Table>
    </div>}
    {current && <div className="space-y-3"><Btn size="sm" variant="ghost" onClick={() => setView('list')}>‹ All Annual Medicals ({meds.length})</Btn><AnnualMedicalDetail med={current} boxer={boxer} onScan={() => setScanMed(current)} /></div>}
    {view === 'create' && <AnnualMedicalForm boxer={boxer} onCancel={() => setView('list')} onSave={rec => { update(d => { d.annualMedicals.push(rec); }); setSaved(`Annual Medical of ${fmtDate(rec.examDate)} saved to ${fullName(boxer)}’s Record Book.`); setView({ detail: rec.id }); }} />}
    {scanMed && <DocumentPreviewModal med={scanMed} boxer={boxer} onClose={() => setScanMed(null)} />}
  </Modal>;
}

/* =========================================================
   24-Hour Pre-Bout Declarations
   ========================================================= */
function PreBoutQuestionnaireModal({ eventId, boxerId, onClose }) {
  const { data, update, viewer } = useApp();
  const ev = data.events.find(e => e.id === eventId);
  const b = getUser(data, boxerId);
  const female = b.gender === 'F';
  const q = getQ(data, eventId, boxerId) || {};
  const age = ageOn(b.dob, ev.date);
  const variant = age >= 18 ? 'adult' : 'minor';
  const coachUser = viewer.role === 'coach' ? viewer : getUser(data, (b.selectedCoachIds || [])[0]);
  const avail = formAvailability(ev);
  const inWindow = avail.state === 'open' || isAdmin(viewer);
  const canBoxer = (viewer.id === b.id || isAdmin(viewer)) && inWindow;
  const canCoach = ((viewer.role === 'coach' && (b.selectedCoachIds || []).includes(viewer.id)) || isAdmin(viewer)) && inWindow;
  const boxerQs = female ? [...PRE_BOXER_Q, PRE_BOXER_FEMALE_Q] : PRE_BOXER_Q;
  const [tab, setTab] = useState('ready');
  // Questions appear in a fresh random order each time the form opens, so boxers and coaches read them rather than clicking by habit. Answers are stored against the original question, so the order never affects the record.
  const shuffled = n => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const [bxOrder] = useState(() => shuffled(boxerQs.length));
  const [coOrder] = useState(() => shuffled(PRE_COACH_Q.length));
  const [bx, setBx] = useState(() => q.boxer ? { ...q.boxer, answers: { ...q.boxer.answers } } : { answers: {}, signature: fullName(b) });
  const [co, setCo] = useState(() => q.coach ? { ...q.coach, answers: { ...q.coach.answers } } : { answers: {}, notes: '', signature: coachUser ? fullName(coachUser) : '' });
  const [np, setNp] = useState(() => q.nonPregnancy ? { ...q.nonPregnancy, acks: { ...q.nonPregnancy.acks } } : { variant, acks: {}, signature: fullName(b), guardianName: '', guardianSignature: '' });
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const ws = windowStatus(ev);
  if (avail.state === 'upcoming' && !isAdmin(viewer)) return <Modal size="md" title="24-Hour Pre-Bout Declarations" subtitle={`${fullName(b)}, ${ev.name}, ${fmtDate(ev.date)}`} onClose={onClose} footer={<Btn onClick={onClose}>OK</Btn>}>
    <div className="space-y-3 text-center"><div className="text-4xl" aria-hidden="true">🔒</div><p className="font-display text-2xl font-bold">{avail.label}</p><p className="text-sm">These forms can only be completed in the 24 hours before the first pre-bout check, so the answers reflect how the boxer is on competition day.</p><p className="text-sm text-muted">Opens {fmtMs(avail.opens)}. First pre-bout check {fmtDT(ev.firstPreBoutCheckDateTime)}.</p></div>
  </Modal>;

  const write = (part, value) => update(d => {
    let rec = d.preBoutQuestionnaires.find(x => x.eventId === eventId && x.boxerId === boxerId);
    if (!rec) { rec = { id: uid('q'), eventId, boxerId, boxer: null, coach: null, nonPregnancy: null }; d.preBoutQuestionnaires.push(rec); }
    rec[part] = { ...value, savedAt: nowIso(), savedBy: viewer.id };
  });
  const saveBoxer = () => {
    const missing = boxerQs.filter((_, i) => !bx.answers['q' + (i + 1)]).length;
    if (missing || !bx.signature.trim()) { setErr(missing ? `Answer all ${boxerQs.length} questions in Part A.` : 'Add the boxer’s digital signature.'); return; }
    write('boxer', bx); setErr(''); setSaved('Boxer Readiness Declaration saved.');
  };
  const saveCoach = () => {
    const missing = PRE_COACH_Q.filter((_, i) => !co.answers['q' + (i + 1)]).length;
    if (missing || !co.signature.trim()) { setErr(missing ? 'Answer all 4 questions in Part B.' : 'Add the coach’s digital signature.'); return; }
    write('coach', co); setErr(''); setSaved('Coach Readiness Co-Sign saved.');
  };
  const npAcks = variant === 'adult' ? ['risks', 'notPregnant', 'notify'] : ['risks', 'notPregnant', 'notify', 'guardian'];
  const saveNp = () => {
    if (npAcks.some(k => !np.acks[k]) || !np.signature.trim() || (variant === 'minor' && (!np.guardianName.trim() || !np.guardianSignature.trim()))) { setErr('Tick every declaration and complete all signatures.'); return; }
    write('nonPregnancy', { ...np, variant }); setErr(''); setSaved('Declaration of Non-Pregnancy saved.');
  };
  const SavedStamp = ({ rec }) => rec && rec.savedAt ? <Badge tone="ok">✓ Saved {fmtStamp(rec.savedAt)}</Badge> : <Badge tone="warn">Not yet completed</Badge>;
  const npText = {
    risks: 'I understand that boxing involves a risk of injury and that competing while pregnant may cause serious harm to me and to a fetus.',
    notPregnant: variant === 'adult' ? 'I declare that, to the best of my knowledge, I am not pregnant.' : 'I, the athlete, declare that to the best of my knowledge I am not pregnant.',
    notify: 'I will tell the ringside physician immediately if my pregnancy status changes or is in doubt.',
    guardian: 'As parent or legal guardian, I have discussed this declaration with the athlete and consent to her participation.'
  };

  return <Modal size="lg" title="Mandatory 24-Hour Pre-Bout Declarations" subtitle={`${fullName(b)}, ${ev.name}, ${fmtDate(ev.date)}`} onClose={onClose}>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <Badge tone={ws.tone}>24h window: {ws.label}</Badge>
      <span className="text-muted">1st pre-bout check {fmtDT(ev.firstPreBoutCheckDateTime)}</span>
    </div>
    <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
      <button role="tab" aria-selected={tab === 'ready'} type="button" onClick={() => { setTab('ready'); setErr(''); }} className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-semibold', tab === 'ready' ? 'border-maple text-ink' : 'border-transparent text-muted hover:text-ink')}>Readiness to Box ({female ? 'Women' : 'Men'})</button>
      {female && <button role="tab" aria-selected={tab === 'np'} type="button" onClick={() => { setTab('np'); setErr(''); }} className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-semibold', tab === 'np' ? 'border-maple text-ink' : 'border-transparent text-muted hover:text-ink')}>Declaration of Non-Pregnancy</button>}
    </div>
    {saved && <Banner tone="ok" className="mb-3" action={<Btn variant="ok" size="sm" onClick={onClose}>Done & Close</Btn>} onClose={() => setSaved('')}>✓ {saved} Record Book, event sheet and Coach Dashboard are updated.</Banner>}
    {err && <Banner tone="bad" className="mb-3" onClose={() => setErr('')}>{err}</Banner>}

    {tab === 'ready' && <div className="space-y-5">
      <div className="rounded-md border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunk px-3 py-2"><h4 className="font-display text-base font-bold">Part A: Boxer Declaration</h4><SavedStamp rec={q.boxer} /></div>
        <div className="divide-y divide-line">
          {bxOrder.map((i, pos) => { const x = boxerQs[i]; return <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><span className="min-w-0 flex-1"><span className="text-muted">{pos + 1}.</span> {x.q}</span><YesNo disabled={!canBoxer} expect={x.expect} value={bx.answers['q' + (i + 1)]} onChange={v => setBx(p => ({ ...p, answers: { ...p.answers, ['q' + (i + 1)]: v } }))} /></div>; })}
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-line px-3 py-3">
          <Field label="Boxer digital signature" className="min-w-[220px] flex-1"><input className="field font-semibold italic" readOnly={!canBoxer} value={bx.signature} onChange={e => setBx(p => ({ ...p, signature: e.target.value }))} /></Field>
          {canBoxer ? <Btn variant="primary" onClick={saveBoxer}>Save Boxer Readiness Declaration</Btn> : <span className="text-xs text-muted">{inWindow ? 'Only the boxer can complete Part A.' : 'The 24-hour window has closed. This form is view only.'}</span>}
        </div>
      </div>
      <div className="rounded-md border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunk px-3 py-2"><h4 className="font-display text-base font-bold">Part B: Coach Co-Signature</h4><SavedStamp rec={q.coach} /></div>
        <div className="divide-y divide-line">
          {coOrder.map((i, pos) => { const x = PRE_COACH_Q[i]; return <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><span className="min-w-0 flex-1"><span className="text-muted">{pos + 1}.</span> {x.q}</span><YesNo disabled={!canCoach} expect={x.expect} value={co.answers['q' + (i + 1)]} onChange={v => setCo(p => ({ ...p, answers: { ...p.answers, ['q' + (i + 1)]: v } }))} /></div>; })}
        </div>
        <div className="space-y-3 border-t border-line px-3 py-3">
          <Field label="Coach notes (optional)"><textarea rows={2} className="field" readOnly={!canCoach} value={co.notes} onChange={e => setCo(p => ({ ...p, notes: e.target.value }))} /></Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Coach digital signature" className="min-w-[220px] flex-1"><input className="field font-semibold italic" readOnly={!canCoach} value={co.signature} onChange={e => setCo(p => ({ ...p, signature: e.target.value }))} /></Field>
            {canCoach ? <Btn variant="primary" onClick={saveCoach}>Save Coach Readiness Co-Sign</Btn> : <span className="text-xs text-muted">{inWindow ? 'Only an assigned coach can co-sign Part B.' : 'The 24-hour window has closed. This form is view only.'}</span>}
          </div>
        </div>
      </div>
    </div>}

    {tab === 'np' && female && <div className="rounded-md border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunk px-3 py-2">
        <h4 className="font-display text-base font-bold">{variant === 'adult' ? 'Adult athlete (18+)' : 'Athlete under 18, parent or guardian signature required'}</h4>
        <div className="flex gap-2"><Badge tone="info">Age on event date: {age}</Badge><SavedStamp rec={q.nonPregnancy} /></div>
      </div>
      <div className="space-y-2 px-3 py-3">
        {npAcks.map(k => <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#C8102E]" disabled={!canBoxer} checked={!!np.acks[k]} onChange={e => setNp(p => ({ ...p, acks: { ...p.acks, [k]: e.target.checked } }))} /><span>{npText[k]}</span></label>)}
      </div>
      <div className="grid gap-3 border-t border-line px-3 py-3 sm:grid-cols-2">
        <Field label="Athlete digital signature" required><input className="field font-semibold italic" readOnly={!canBoxer} value={np.signature} onChange={e => setNp(p => ({ ...p, signature: e.target.value }))} /></Field>
        {variant === 'minor' && <>
          <Field label="Parent or guardian full name" required><input className="field" readOnly={!canBoxer} value={np.guardianName} onChange={e => setNp(p => ({ ...p, guardianName: e.target.value }))} /></Field>
          <Field label="Parent or guardian digital signature" required><input className="field font-semibold italic" readOnly={!canBoxer} value={np.guardianSignature} onChange={e => setNp(p => ({ ...p, guardianSignature: e.target.value }))} /></Field>
        </>}
        <div className="flex items-end sm:col-span-2 sm:justify-end">{canBoxer ? <Btn variant="primary" onClick={saveNp}>Save Declaration of Non-Pregnancy</Btn> : <span className="text-xs text-muted">{inWindow ? 'Only the athlete (and guardian) can complete this declaration.' : 'The 24-hour window has closed. This declaration is view only.'}</span>}</div>
      </div>
    </div>}
  </Modal>;
}

/* =========================================================
   Rest record & post-rest recovery clearance
   ========================================================= */
function RestClearanceModal({ restId, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const r = data.restPeriodExams.find(x => x.id === restId);
  const b = getUser(data, r.boxerId);
  const ev = data.events.find(e => e.id === r.eventId);
  const src = data.ringsideExams.find(x => x.id === r.sourceExamId);
  const canSign = canClinical(viewer) && !r.completed;
  const st = getRestExamStatusForCoachAndAdmin(r);
  const [f, setF] = useState({ examDate: r.examDate || REF_DATE, checks: { symptomFree: '', neuro: '', balance: '', ...r.checks }, isFitToBox: r.isFitToBox || '', notes: r.notes || '', physicianSignature: r.physicianSignature || (viewer.role === 'medical' ? nameOf(data, viewer.id) : ''), license: r.license || viewer.license || '' });
  const [err, setErr] = useState('');
  const save = () => {
    if (!f.checks.symptomFree || !f.checks.neuro || !f.checks.balance || !f.isFitToBox || !f.physicianSignature.trim()) { setErr('Complete every finding, the fit-to-box decision and the physician signature.'); return; }
    update(d => { const x = d.restPeriodExams.find(y => y.id === restId); Object.assign(x, { completed: true, examDate: f.examDate, checks: f.checks, isFitToBox: f.isFitToBox, notes: f.notes, physicianSignature: f.physicianSignature, license: f.license, physicianId: viewer.id }); });
    notify(f.isFitToBox === 'yes' ? `Post-Rest Recovery Clearance signed. ${fullName(b)} is cleared to box.` : `Recovery exam recorded. ${fullName(b)} is not cleared and needs re-examination.`, f.isFitToBox === 'yes' ? 'ok' : 'warn');
    onClose();
  };
  return <Modal size="lg" title="Rest Period & Post-Rest Recovery Clearance" subtitle={`${fullName(b)}, ${b.membershipId}`} onClose={onClose}
    footer={canSign ? <><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>Sign Recovery Clearance</Btn></> : <Btn onClick={onClose}>Close</Btn>}>
    <div className="space-y-4">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className="flex flex-wrap gap-2"><Badge tone={st.tone}>{st.label}</Badge></div>
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-line bg-sunk p-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted">Source event</dt><dd className="font-semibold">{ev ? ev.name : '—'}</dd></div>
        <div><dt className="text-xs text-muted">Rest ordered</dt><dd className="font-semibold">{r.days} days from {fmtDate(r.startDate)}</dd></div>
        <div><dt className="text-xs text-muted">Recovery exam due</dt><dd className="font-semibold">{fmtDate(r.dueDate)}</dd></div>
        <div><dt className="text-xs text-muted">Ordering physician</dt><dd className="font-semibold">{src ? nameOf(data, src.physicianId) : '—'}</dd></div>
        {src && <div className="col-span-2 sm:col-span-4"><dt className="text-xs text-muted">Post-bout findings</dt><dd>{src.flags.length ? src.flags.join(', ') + '. ' : ''}{src.notes}</dd></div>}
      </dl>
      {!canSign && !r.completed && <Banner tone="info">A Medical Official completes and signs the Post-Rest Recovery Clearance. The boxer stays ineligible until it is signed and fit to box is “Yes”.</Banner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Recovery exam date"><input type="date" className="field" disabled={!canSign} value={f.examDate} onChange={e => setF(p => ({ ...p, examDate: e.target.value }))} /></Field>
        <div />
        <Field label="Symptom-free at rest and on exertion"><YesNo disabled={!canSign} expect="yes" value={f.checks.symptomFree} onChange={v => setF(p => ({ ...p, checks: { ...p.checks, symptomFree: v } }))} /></Field>
        <Field label="Neurological exam"><NormalAbnormal disabled={!canSign} value={f.checks.neuro} onChange={v => setF(p => ({ ...p, checks: { ...p.checks, neuro: v } }))} /></Field>
        <Field label="Balance and coordination"><NormalAbnormal disabled={!canSign} value={f.checks.balance} onChange={v => setF(p => ({ ...p, checks: { ...p.checks, balance: v } }))} /></Field>
        <Field label="Fit to box"><YesNo disabled={!canSign} expect="yes" value={f.isFitToBox} onChange={v => setF(p => ({ ...p, isFitToBox: v }))} /></Field>
        <Field label="Clinical notes" className="sm:col-span-2"><textarea rows={3} className="field" readOnly={!canSign} value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} /></Field>
        <Field label="Physician digital signature"><input className="field font-semibold italic" readOnly={!canSign} value={f.physicianSignature} onChange={e => setF(p => ({ ...p, physicianSignature: e.target.value }))} /></Field>
        <Field label="License #"><input className="field" readOnly={!canSign} value={f.license} onChange={e => setF(p => ({ ...p, license: e.target.value }))} /></Field>
      </div>
    </div>
  </Modal>;
}

/* =========================================================
   Ringside pre/post-bout exam
   ========================================================= */
function RingsideExamModal({ eventId, boxerId, type, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const ev = data.events.find(e => e.id === eventId);
  const b = getUser(data, boxerId);
  const flagsList = type === 'pre' ? PRE_FLAGS : POST_FLAGS;
  const [f, setF] = useState({ bp: '', hr: '', weight: '', flags: [], outcome: type === 'pre' ? 'cleared' : 'no-injury', restDays: 0, notes: '', signature: nameOf(data, viewer.id) });
  const [err, setErr] = useState('');
  const toggle = fl => setF(p => ({ ...p, flags: p.flags.includes(fl) ? p.flags.filter(x => x !== fl) : [...p.flags, fl] }));
  const save = () => {
    if (!f.bp.trim() || (type === 'pre' && !f.weight.trim())) { setErr(type === 'pre' ? 'Record blood pressure and weight.' : 'Record blood pressure.'); return; }
    const rx = { id: uid('rx'), eventId, boxerId, type, date: ev.date, bp: f.bp, hr: f.hr, weight: f.weight, flags: f.flags, outcome: f.outcome, notes: f.notes, physicianId: viewer.id, restDays: type === 'post' ? Number(f.restDays) : 0, signature: f.signature, savedAt: nowIso() };
    update(d => {
      d.ringsideExams.push(rx);
      if (rx.restDays > 0) d.restPeriodExams.push({ id: uid('rp'), boxerId, sourceExamId: rx.id, eventId, startDate: ev.date, days: rx.restDays, dueDate: addDays(ev.date, rx.restDays), completed: false, isFitToBox: '', examDate: '', physicianId: '', physicianSignature: '', checks: {}, notes: '' });
    });
    notify(rx.restDays > 0 ? `Post-bout check saved. ${rx.restDays}-day mandatory rest ordered for ${fullName(b)}; recovery exam due ${fmtDate(addDays(ev.date, rx.restDays))}.` : `${type === 'pre' ? 'Pre-bout' : 'Post-bout'} check saved for ${fullName(b)}.`, rx.restDays > 0 ? 'warn' : 'ok');
    onClose();
  };
  return <Modal size="lg" title={type === 'pre' ? 'Pre-Bout Ringside Medical Examination' : 'Post-Bout Ringside Medical Examination'} subtitle={`${fullName(b)}, ${ev.name}`} onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>Save {type === 'pre' ? 'pre-bout' : 'post-bout'} check</Btn></>}>
    <div className="space-y-4">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Blood pressure (mmHg)" required><input className="field" placeholder="120/80" value={f.bp} onChange={e => setF(p => ({ ...p, bp: e.target.value }))} /></Field>
        <Field label="Heart rate (bpm)"><input className="field" inputMode="numeric" value={f.hr} onChange={e => setF(p => ({ ...p, hr: e.target.value }))} /></Field>
        <Field label="Weight (kg)" required={type === 'pre'}><input className="field" inputMode="decimal" value={f.weight} onChange={e => setF(p => ({ ...p, weight: e.target.value }))} /></Field>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-muted">Clinical flags</div>
        <div className="grid gap-1.5 sm:grid-cols-2">{flagsList.map(fl => <label key={fl} className={cx('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', f.flags.includes(fl) ? 'border-warn bg-warnsoft' : 'border-line')}><input type="checkbox" className="h-4 w-4 accent-[#C8102E]" checked={f.flags.includes(fl)} onChange={() => toggle(fl)} />{fl}</label>)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Outcome">
          <select className="field" value={f.outcome} onChange={e => setF(p => ({ ...p, outcome: e.target.value }))}>
            {type === 'pre' ? <><option value="cleared">Cleared to box</option><option value="not-cleared">Not cleared to box</option></> : <><option value="no-injury">No injury</option><option value="injury">Injury recorded</option><option value="hospital">Transferred to hospital</option></>}
          </select>
        </Field>
        {type === 'post' && <Field label="Mandatory rest period" hint="A rest period creates a recovery exam record that must be signed before the boxer competes again.">
          <select className="field" value={f.restDays} onChange={e => setF(p => ({ ...p, restDays: e.target.value }))}>{REST_OPTIONS.map(n => <option key={n} value={n}>{n ? `${n} days` : 'No rest required'}</option>)}</select>
        </Field>}
        <Field label="Clinical notes" className="sm:col-span-2"><textarea rows={3} className="field" value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} /></Field>
        <Field label="Ringside physician signature"><input className="field font-semibold italic" value={f.signature} onChange={e => setF(p => ({ ...p, signature: e.target.value }))} /></Field>
      </div>
    </div>
  </Modal>;
}

/* =========================================================
   Digital Competitor Record Book
   ========================================================= */
function RecordBook({ boxerId, onBack, backLabel }) {
  const { data, viewer, update, notify, go } = useApp();
  const b = getUser(data, boxerId);
  const [modal, setModal] = useState(null);
  if (!b) return <Banner tone="bad">This Record Book could not be found.</Banner>;
  const meds = medicalsOf(data, b.id), latest = meds[0], mst = medState(latest);
  const elig = eligibility(data, b);
  const rests = restOf(data, b.id);
  const evs = boxerEvents(data, b.id);
  const ringside = data.ringsideExams.filter(x => x.boxerId === b.id).sort((a, c) => c.date.localeCompare(a.date));
  const bouts = boutsOf(data, b.id);
  const fought = bouts.filter(x => x.result !== 'Scheduled');
  const recentBouts = fought.slice(0, 10);
  const wins = bouts.filter(x => x.result === 'Win').length, losses = bouts.filter(x => x.result === 'Loss').length;
  const coaches = (b.selectedCoachIds || []).map(id => nameOf(data, id)).join(', ') || 'None assigned';
  const openRest = rests.filter(restOpen);
  return <div className="space-y-5">
    {onBack && <Btn size="sm" variant="ghost" onClick={onBack}>‹ {backLabel || 'Back'}</Btn>}
    <header className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="rope-rule" />
      <div className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">Digital Competitor Record Book</p>
          <h2 className="font-display text-3xl font-extrabold leading-none sm:text-4xl">{fullName(b)}</h2>
          <p className="mt-1 font-semibold text-rope">{b.membershipId}</p>
          {(b.nationalTeam || viewer.role === 'nsoadmin') && <div className="mt-2 flex flex-wrap items-center gap-2"><NationalTeamBadge user={b} large />{viewer.role === 'nsoadmin' && <NtLevelSelect user={b} compact />}</div>}
          {(() => { const pend = (data.openRequests || []).find(r => r.boxerId === b.id && r.status === 'pending'); const bouts = completedBouts(data, b.id); return <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Classification:</span><ClassBadge u={b} large /><span className="text-xs text-muted">{bouts} completed bout{bouts === 1 ? '' : 's'}</span>
            {classOf(b) === 'novice' && (pend ? <Badge tone="warn">Open request pending since {fmtDate(pend.at.slice(0, 10))}</Badge> : canRequestOpen(viewer, b) ? <Btn size="xs" variant="rope" onClick={() => setModal({ kind: 'open' })}>Request move to Open</Btn> : viewer.id === b.id ? <span className="text-xs text-muted">Your coach can request a move to Open{ageOn(b.dob, REF_DATE) < 18 ? ' (boxers under 18 can’t request it themselves)' : ''}.</span> : null)}
            {canDecideOpen(viewer, b) && <select className="field w-auto py-1 text-xs" value={classOf(b)} aria-label="Set classification" onChange={e => { const v = e.target.value; update(d => setClassification(d, b.id, v, viewer.id, 'Set directly by administrator')); notify(`${fullName(b)} is now ${v === 'open' ? 'Open' : 'Novice'}.`); }}><option value="novice">Set Novice</option><option value="open">Set Open</option></select>}
          </div>; })()}
          {scatOpen(data, b.id) && canSeeScat(viewer, b) && <div className="mt-2"><ScatBadge u={b} withDate /></div>}
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {[['Gender', b.gender === 'F' ? 'Female' : 'Male'], ['Date of birth', fmtDate(b.dob)], ['Age', ageOn(b.dob, REF_DATE)], ['Province', PROVINCE_INFO[b.province].name], ['Club', b.club || '—'], ['Assigned coaches', viewer.id === b.id ? <>{coaches} <button type="button" className="ml-1 text-xs font-semibold text-rope underline" onClick={() => go('COACHES')}>Manage</button></> : isAdmin(viewer) ? <>{coaches} <button type="button" className="ml-1 text-xs font-semibold text-rope underline" onClick={() => setModal({ kind: 'coaches' })}>Change</button></> : coaches]].map(([k, v]) =>
              <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
          </dl>
        </div>
        <div className={cx('rounded-md px-4 py-3 text-center', elig.tone === 'ok' ? 'bg-oksoft text-ok' : elig.tone === 'warn' ? 'bg-warnsoft text-warn' : 'bg-maplesoft text-maple')}>
          <div className="text-xs font-semibold">Overall eligibility</div>
          <div className="font-display text-xl font-bold leading-tight">{elig.label}</div>
        </div>
      </div>
    </header>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2"><h3 className="font-display text-lg font-bold">Annual Medical Status</h3><Badge tone={mst.tone}>{mst.label}</Badge></div>
        {latest ? <p className="mt-1 text-sm">Examined {fmtDate(latest.examDate)}, valid until <b>{fmtDate(medExpiry(latest))}</b></p> : <p className="mt-1 text-sm text-muted">No Annual Medical on file.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {latest && <Btn size="sm" variant="rope" onClick={() => setModal({ kind: 'medicals', id: latest.id })}>View Latest Annual Medical</Btn>}
          <Btn size="sm" onClick={() => setModal({ kind: 'medicals' })}>See All Annual Medicals ({meds.length})</Btn>
        </div>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2"><h3 className="font-display text-lg font-bold">Rest Periods</h3><Badge tone={openRest.length ? 'bad' : 'ok'}>{openRest.length ? `${openRest.length} active` : 'None active'}</Badge></div>
        <p className="mt-1 text-sm">{openRest.length ? `Recovery clearance required. Exam due ${fmtDate(openRest[0].dueDate)}.` : 'No mandatory rest in effect.'}</p>
        {openRest[0] && <div className="mt-3"><Btn size="sm" onClick={() => setModal({ kind: 'rest', id: openRest[0].id })}>View Rest Record</Btn></div>}
      </div>
      <div className="rounded-lg border border-line bg-surface p-4">
        <h3 className="font-display text-lg font-bold">Competition Record</h3>
        <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{wins}<span className="text-muted">–</span>{losses}</p>
        <p className="text-sm text-muted">{bouts.length} bout{bouts.length === 1 ? '' : 's'} recorded, including scheduled</p>
      </div>
    </div>

    <Section title="Bout History" sub={fought.length > 10 ? `Showing the 10 most recent of ${fought.length} bouts.` : 'Most recent bouts first, up to 10.'}>
      <Table head={['Date', 'Event', 'Weight class', 'Corner', 'Opponent', 'Result', 'Method']} isEmpty={!recentBouts.length} empty="No bouts on record.">
        {recentBouts.map(({ ev, bt, corner, opp, result }) => <tr key={bt.id}>
          <Td className="whitespace-nowrap">{fmtDate(ev.date)}</Td><Td>{ev.name}</Td><Td>{bt.weightClass}</Td>
          <Td><span className={cx('inline-block h-2.5 w-2.5 rounded-full align-middle', corner === 'red' ? 'bg-[#C8102E]' : 'bg-[#1D4E89]')} /> <span className="capitalize">{corner}</span></Td>
          <Td>{opp}</Td><Td><Badge tone={result === 'Win' ? 'ok' : result === 'Loss' ? 'bad' : 'neutral'}>{result}</Badge></Td>
          <Td>{bt.method ? `${bt.method}${bt.round ? ', R' + bt.round : ''}` : '—'}</Td></tr>)}
      </Table>
    </Section>

    <Section title="Pre-Bout Questionnaires" sub="Required for every event the boxer is entered in. The window opens 24 hours before the first pre-bout check.">
      <Table head={['Event', 'Date', 'Boxer readiness', 'Coach co-sign', ...(b.gender === 'F' ? ['Non-pregnancy'] : []), ...(evs.some(e => e.scatRequired) ? ['SCAT6'] : []), '']} isEmpty={!evs.length} empty="Not entered in any events.">
        {evs.map(ev => { const s = qStatus(data, ev, b), ws = windowStatus(ev); return <tr key={ev.id}>
          <Td className="font-semibold">{ev.name}<div className="text-xs font-normal text-muted">{ev.province}</div></Td><Td className="whitespace-nowrap">{fmtDate(ev.date)}</Td>
          <Td><Check ok={s.boxer} /></Td><Td><Check ok={s.coach} /></Td>{b.gender === 'F' && <Td><Check ok={s.np} /></Td>}{evs.some(e => e.scatRequired) && <Td><ScatEventCell ev={ev} b={b} onRun={() => setModal({ kind: 'scat', eventName: ev.name })} /></Td>}
          <Td className="text-right"><FormButton ev={ev} s={s} onOpen={() => setModal({ kind: 'pre', eventId: ev.id })} /></Td>
        </tr>; })}
      </Table>
    </Section>

    <Section title="Pre-Bout & Post-Bout Medicals">
      <Table head={['Date', 'Event', 'Check', 'BP', 'HR', 'Weight', 'Flags', 'Outcome', 'Physician']} isEmpty={!ringside.length} empty="No ringside checks recorded.">
        {ringside.map(x => { const ev = data.events.find(e => e.id === x.eventId); return <tr key={x.id}>
          <Td className="whitespace-nowrap">{fmtDate(x.date)}</Td><Td>{ev ? ev.name : '—'}</Td><Td><Badge tone="info">{x.type === 'pre' ? 'Pre-bout' : 'Post-bout'}</Badge></Td>
          <Td>{x.bp}</Td><Td>{x.hr || '—'}</Td><Td>{x.weight ? x.weight + ' kg' : '—'}</Td>
          <Td className="max-w-[220px]">{x.flags.length ? x.flags.join(', ') : <span className="text-muted">None</span>}</Td>
          <Td><Badge tone={x.outcome === 'cleared' || x.outcome === 'no-injury' ? 'ok' : 'warn'}>{({ cleared: 'Cleared', 'not-cleared': 'Not cleared', 'no-injury': 'No injury', injury: 'Injury', hospital: 'Hospital transfer' })[x.outcome]}</Badge>{x.restDays > 0 && <div className="mt-1 text-xs text-maple">{x.restDays}-day rest ordered</div>}</Td>
          <Td>{nameOf(data, x.physicianId)}</Td></tr>; })}
      </Table>
    </Section>

    <CoachHistorySection b={b} />

    <ScatSection b={b} onRun={() => setModal({ kind: 'scat' })} onFollowUp={sc => setModal({ kind: 'scatfu', screen: sc })} />

    <Section title="Mandatory Rest Periods & Post-Rest Recovery Clearances">
      <Table head={['Rest start', 'Length', 'Exam due', 'Status', 'Clearance exam', '']} isEmpty={!rests.length} empty="No rest periods on record.">
        {rests.map(r => { const st = getRestExamStatusForCoachAndAdmin(r); return <tr key={r.id}>
          <Td className="whitespace-nowrap">{fmtDate(r.startDate)}</Td><Td>{r.days} days</Td><Td className="whitespace-nowrap">{fmtDate(r.dueDate)}</Td><Td><Badge tone={st.tone}>{st.label}</Badge></Td>
          <Td>{r.completed ? <>{fmtDate(r.examDate)}<div className="text-xs text-muted">{r.physicianSignature}</div></> : <span className="text-muted">Not yet signed</span>}</Td>
          <Td className="text-right"><Btn size="sm" variant={canClinical(viewer) && !r.completed ? 'primary' : 'secondary'} onClick={() => setModal({ kind: 'rest', id: r.id })}>{canClinical(viewer) && !r.completed ? 'Complete Clearance' : 'View Rest Record'}</Btn></Td></tr>; })}
      </Table>
    </Section>

    {modal && modal.kind === 'medicals' && <BoxerAnnualMedicalsModal boxerId={b.id} initialId={modal.id} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'pre' && <PreBoutQuestionnaireModal eventId={modal.eventId} boxerId={b.id} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'open' && <OpenRequestModal boxerId={b.id} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'coaches' && <CoachPickerModal boxerId={b.id} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'scat' && <ScatToolModal boxerId={b.id} contextDefault={modal.eventName ? `Competition requirement: ${modal.eventName}` : ''} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'scatfu' && <ScatFollowUpModal screen={modal.screen} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'rest' && <RestClearanceModal restId={modal.id} onClose={() => setModal(null)} />}
  </div>;
}

/* =========================================================
   Coach Portal 3-widget dashboard
   ========================================================= */
function CoachDashboard() {
  const { data, viewer, go } = useApp();
  const [drill, setDrill] = useState('BOXERS_LIST');
  const [recordId, setRecordId] = useState(null);
  const [modal, setModal] = useState(null);
  const boxers = boxersOf(data, viewer.id);
  const due = coachDueItems(data, viewer.id);
  const nPre = due.filter(x => x.kind === 'pre').length, nAnnual = due.filter(x => x.kind === 'annual').length, nRest = due.filter(x => x.kind === 'rest').length;
  const mySanctions = data.sanctions.filter(s => s.requestedByUserId === viewer.id);
  const pending = mySanctions.filter(s => s.status === 'submitted').length;
  const sanctionedEvents = data.events.slice();
  if (recordId) return <RecordBook boxerId={recordId} onBack={() => setRecordId(null)} backLabel="Back to Coach Dashboard" />;
  const Widget = ({ id, title, children }) => <button type="button" onClick={() => setDrill(id)} aria-pressed={drill === id}
    className={cx('group relative flex flex-col rounded-lg border-2 bg-surface p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rope', drill === id ? 'border-maple' : 'border-line hover:border-muted')}>
    <span className="font-display text-lg font-bold leading-tight">{title}</span>
    <div className="mt-2 flex-1">{children}</div>
    <span className={cx('mt-3 text-xs font-semibold', drill === id ? 'text-maple' : 'text-muted')}>{drill === id ? 'Showing details below' : 'Show details'}</span>
  </button>;
  const Count = ({ n, label, tone }) => <div className="flex items-baseline gap-2"><span className={cx('font-display text-3xl font-extrabold tabular-nums', tone === 'bad' && n ? 'text-maple' : tone === 'warn' && n ? 'text-warn' : '')}>{n}</span><span className="text-sm leading-tight text-muted">{label}</span></div>;
  const combined = [
    ...sanctionedEvents.map(ev => ({ key: 'e' + ev.id, date: ev.date, kind: 'event', ev })),
    ...mySanctions.map(s => ({ key: 's' + s.id, date: s.info.date || s.createdAt.slice(0, 10), kind: 'sanction', s }))
  ].sort((a, b) => a.date.localeCompare(b.date));
  return <div className="space-y-5">
    {(() => { const n = (data.coachRequests || []).filter(r => r.coachId === viewer.id && r.status === 'pending_coach').length; return n > 0 && <Banner tone="info" action={<Btn size="sm" variant="primary" onClick={() => go('BOXERS')}>Open My Boxers</Btn>}>{n} boxer request{n === 1 ? '' : 's'} waiting for your answer.</Banner>; })()}
    <div className="grid gap-3 md:grid-cols-3">
      <Widget id="BOXERS_LIST" title="Assigned Boxers"><Count n={boxers.length} label={'boxers assigned to you'} /></Widget>
      <Widget id="MEDICAL_CHECKS_LIST" title="Due Pre-Bout Checks, Expiring Annual Medicals & Rest Checks">
        <div className="space-y-1"><Count n={nPre} label="pre-bout checks due" tone="warn" /><Count n={nAnnual} label="annual medicals expiring in 90 days" tone="warn" /><Count n={nRest} label="post-rest medical checks outstanding" tone="bad" /></div>
      </Widget>
      <Widget id="SANCTIONS_LIST" title="Sanctioned Events & Pending Sanctions">
        <div className="space-y-1"><Count n={sanctionedEvents.length} label="sanctioned events" /><Count n={pending} label="pending sanctions you submitted" tone="warn" /></div>
      </Widget>
    </div>

    {drill === 'BOXERS_LIST' && <Section title="Assigned Boxers" sub="Boxers who list you as their coach.">
      <Table head={['Boxer', 'Membership ID', 'Date of birth', 'Latest Annual Medical', 'Rest status', 'Bouts', '']} isEmpty={!boxers.length} empty="No boxers are assigned to you yet.">
        {boxers.map(b => { const m = latestMedical(data, b.id), st = medState(m), open = restOf(data, b.id).filter(restOpen); return <tr key={b.id}>
          <Td className="font-semibold"><span aria-hidden="true">🥊</span> {fullName(b)} <ClassBadge u={b} /> <NationalTeamBadge user={b} /> <ScatBadge u={b} /><div className="text-xs font-normal text-muted">{b.gender === 'F' ? 'Female' : 'Male'}, {b.club}</div></Td>
          <Td>{b.membershipId}</Td><Td className="whitespace-nowrap">{fmtDate(b.dob)}</Td>
          <Td className="whitespace-nowrap">{m ? <>{fmtDate(m.examDate)}<div className="text-xs text-muted">Expires {fmtDate(medExpiry(m))}</div></> : '—'}<div className="mt-1"><Badge tone={st.tone}>{st.label}</Badge></div></Td>
          <Td>{open.length ? <Badge tone="bad">Rest active until clearance</Badge> : <Badge tone="ok">No active rest</Badge>}</Td>
          <Td className="tabular-nums">{boutsOf(data, b.id).filter(x => x.result !== 'Scheduled').length}</Td>
          <Td><div className="flex justify-end gap-1.5"><Btn size="sm" onClick={() => setModal({ kind: 'medicals', boxerId: b.id })}>Medical History</Btn><Btn size="sm" variant="rope" onClick={() => setRecordId(b.id)}>Open Record Book</Btn></div><div className="mt-1.5 flex justify-end"><CoachEndButton b={b} /></div></Td>
        </tr>; })}
      </Table>
    </Section>}

    {drill === 'MEDICAL_CHECKS_LIST' && <Section title="Medical Checks to Action" sub="Pre-bout questionnaires, post-rest checks and expiring Annual Medicals for your boxers, earliest first.">
      <Table head={['Target date', 'Check', 'Boxer', 'Detail', '']} isEmpty={!due.length} empty="Nothing outstanding. Every assigned boxer is up to date.">
        {due.map((x, i) => <tr key={i}>
          <Td className="whitespace-nowrap font-semibold">{fmtDate(x.date)}</Td>
          <Td>{x.kind === 'pre' ? <Badge tone="info">24h Pre-Bout Questionnaire</Badge> : x.kind === 'rest' ? <Badge tone="bad">Post-Rest Medical Check</Badge> : <Badge tone="warn">Annual Medical expiring</Badge>}</Td>
          <Td>{fullName(x.b)}</Td><Td>{x.detail}{x.kind === 'rest' && <div className="text-xs text-muted">{getRestExamStatusForCoachAndAdmin(x.r).label}</div>}</Td>
          <Td className="text-right">{x.kind === 'pre' ? <FormButton ev={x.ev} s={qStatus(data, x.ev, x.b)} openLabel="Complete / Co-Sign 24h Form" onOpen={() => setModal({ kind: 'pre', eventId: x.ev.id, boxerId: x.b.id })} />
            : x.kind === 'rest' ? <Btn size="sm" onClick={() => setModal({ kind: 'rest', id: x.r.id })}>View Rest Record</Btn>
            : <Btn size="sm" onClick={() => setModal({ kind: 'medicals', boxerId: x.b.id, id: x.m.id })}>View Annual Medical</Btn>}</Td>
        </tr>)}
      </Table>
    </Section>}

    {drill === 'SANCTIONS_LIST' && <Section title="Sanctioned Events & Your Sanction Requests" actions={<Btn size="sm" variant="primary" onClick={() => go('SANCTIONS', { newSanction: true })}>New Sanction Request</Btn>}>
      <Table head={['Date', 'Type', 'Name', 'Province', 'Status', '']} isEmpty={!combined.length} empty="No events or sanction requests yet.">
        {combined.map(x => x.kind === 'event' ? <tr key={x.key}>
          <Td className="whitespace-nowrap">{fmtDate(x.date)}</Td><Td><Badge tone="ok">Sanctioned event</Badge></Td><Td className="font-semibold">{x.ev.name}</Td><Td>{x.ev.province}</Td>
          <Td><Badge tone={isUpcoming(x.ev) ? 'info' : 'neutral'}>{isUpcoming(x.ev) ? 'Upcoming' : 'Completed'}</Badge></Td>
          <Td className="text-right"><Btn size="sm" variant="rope" onClick={() => go('EVENTS', { focusEventId: x.ev.id })}>Open Event</Btn></Td></tr>
          : <tr key={x.key}>
          <Td className="whitespace-nowrap">{fmtDate(x.date)}</Td><Td><Badge tone="neutral">{x.s.type} sanction request</Badge></Td><Td className="font-semibold">{x.s.info.eventName || 'Untitled request'}</Td><Td>{x.s.province}</Td>
          <Td><SanctionStatus s={x.s} /></Td>
          <Td className="text-right"><Btn size="sm" onClick={() => go('SANCTIONS', { openSanctionId: x.s.id })}>Inspect Request</Btn></Td></tr>)}
      </Table>
    </Section>}

    {modal && modal.kind === 'medicals' && <BoxerAnnualMedicalsModal boxerId={modal.boxerId} initialId={modal.id} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'pre' && <PreBoutQuestionnaireModal eventId={modal.eventId} boxerId={modal.boxerId} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'rest' && <RestClearanceModal restId={modal.id} onClose={() => setModal(null)} />}
  </div>;
}
const SanctionStatus = ({ s }) => ({ draft: <Badge>Draft</Badge>, submitted: <Badge tone="warn">Pending approval</Badge>, approved: <Badge tone="ok">Approved</Badge>, denied: <Badge tone="bad">Denied</Badge> })[s.status];

/* =========================================================
   Athlete Record Book directory (Medical / PTSO / NSO)
   ========================================================= */
function AthleteDirectory({ onOpen, title = 'Athlete Record Books' }) {
  const { data } = useApp();
  const [q, setQ] = useState(''); const [prov, setProv] = useState('');
  const list = allBoxers(data).filter(b => (!prov || b.province === prov) && (fullName(b) + b.membershipId).toLowerCase().includes(q.toLowerCase()));
  return <Section title={title} sub="Open any athlete’s Digital Competitor Record Book.">
    <div className="mb-3 flex flex-wrap gap-2">
      <input className="field max-w-xs" placeholder="Search name or membership ID" value={q} onChange={e => setQ(e.target.value)} aria-label="Search athletes" />
      <select className="field max-w-[200px]" value={prov} onChange={e => setProv(e.target.value)} aria-label="Province"><option value="">All provinces</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select>
    </div>
    <Table head={['Boxer', 'Membership ID', 'Province', 'Annual Medical', 'Eligibility', '']} isEmpty={!list.length} empty="No athletes match these filters.">
      {list.map(b => { const m = latestMedical(data, b.id), st = medState(m), el = eligibility(data, b); return <tr key={b.id}>
        <Td className="font-semibold"><span aria-hidden="true">🥊</span> {fullName(b)} <NationalTeamBadge user={b} /> <ScatBadge u={b} /></Td><Td>{b.membershipId}</Td><Td>{b.province}</Td>
        <Td>{m ? `Valid until ${fmtDate(medExpiry(m))}` : '—'} <Badge tone={st.tone} className="ml-1">{st.label}</Badge></Td>
        <Td><Badge tone={el.tone}>{el.label}</Badge></Td>
        <Td className="text-right"><Btn size="sm" variant="rope" onClick={() => onOpen(b.id)}>Open Record Book</Btn></Td></tr>; })}
    </Table>
  </Section>;
}
/* ---------- Membership by type, nationally and by province ---------- */
const MEMBERSHIP_TYPE_ORDER = ['Senior', 'Youth', 'Junior B', 'Junior C', 'Masters', 'Non-Competitive Sparring', 'Recreational', 'Coach', 'Official', 'Lifetime'];
const MEMBERSHIP_COLORS = ['#C8102E', '#1D4E89', '#2E86AB', '#5FA8D3', '#7C3AED', '#B7791F', '#64748B', '#1C7548', '#0E7490', '#8A6D1F', '#9D174D', '#475569'];
const ROLE_TYPE_FALLBACK = { boxer: 'Athlete (type not recorded)', coach: 'Coach', official: 'Official', medical: 'Medical Official', ptso: 'PTSO Administrator', nsoadmin: 'NSO Administrator' };
const membershipTypeOf = u => trackieOf(u)['MEMBERSHIP TYPE'] || ROLE_TYPE_FALLBACK[u.role] || 'Other';
function MembershipBreakdown() {
  const { data } = useApp();
  const [includeInvited, setIncludeInvited] = useState(true);
  const [staffToo, setStaffToo] = useState(false);
  const members = data.users.filter(u => (u.status === 'approved' || (includeInvited && u.status === 'invited')) && (staffToo || !['ptso', 'nsoadmin'].includes(u.role)));
  const typeSet = new Set(members.map(membershipTypeOf));
  const types = [...MEMBERSHIP_TYPE_ORDER.filter(t => typeSet.has(t)), ...[...typeSet].filter(t => !MEMBERSHIP_TYPE_ORDER.includes(t)).sort()];
  const color = t => MEMBERSHIP_COLORS[types.indexOf(t) % MEMBERSHIP_COLORS.length];
  const count = (list, t) => list.filter(u => membershipTypeOf(u) === t).length;
  const national = types.map(t => [t, count(members, t)]);
  const natMax = Math.max(1, ...national.map(x => x[1]));
  const byProv = PROVINCE_CODES.map(c => { const list = members.filter(u => u.province === c); return { c, list, rows: types.map(t => [t, count(list, t)]).filter(r => r[1] > 0) }; }).sort((a, b) => b.list.length - a.list.length);
  const Bars = ({ rows, max, total }) => <ul className="space-y-1">{rows.map(([t, n]) => <li key={t} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-2 text-sm">
    <span className="truncate" title={t}>{t}</span>
    <span className="block h-3.5 overflow-hidden rounded-sm bg-sunk"><span className="block h-full rounded-sm" style={{ width: `${n / max * 100}%`, background: color(t) }} /></span>
    <span className="text-right tabular-nums"><b>{n}</b>{total ? <span className="text-xs text-muted"> {Math.round(n / total * 100)}%</span> : null}</span>
  </li>)}</ul>;
  return <Section logo title="Membership by Type" sub="Counted from each member’s Trackie membership type. Members without a Trackie record are counted by their portal role." actions={<div className="flex flex-wrap gap-3 text-xs font-semibold"><label className="flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4" checked={includeInvited} onChange={e => setIncludeInvited(e.target.checked)} />Include members who haven’t activated their portal account</label><label className="flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4" checked={staffToo} onChange={e => setStaffToo(e.target.checked)} />Include administrators</label></div>}>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div>
        <div className="mb-2 flex items-baseline justify-between"><h4 className="font-display text-lg font-bold">Canada</h4><span className="font-display text-3xl font-extrabold tabular-nums">{members.length}<span className="ml-1 text-sm font-semibold text-muted">members</span></span></div>
        <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-sunk" role="img" aria-label="Share of members by type">{national.filter(r => r[1]).map(([t, n]) => <span key={t} title={`${t}: ${n}`} style={{ width: `${n / Math.max(1, members.length) * 100}%`, background: color(t) }} />)}</div>
        <Bars rows={national} max={natMax} total={members.length} />
      </div>
      <div>
        <h4 className="mb-2 font-display text-lg font-bold">By province and territory</h4>
        <div className="grid gap-3 sm:grid-cols-2">{byProv.map(({ c, list, rows }) => <div key={c} className="rounded-md border border-line p-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-2"><span className="font-semibold">{PROVINCE_INFO[c].name}</span><span className="tabular-nums"><b>{list.length}</b> <span className="text-xs text-muted">members</span></span></div>
          {list.length ? <><div className="mb-2 flex h-2 overflow-hidden rounded-full bg-sunk" aria-hidden="true">{rows.map(([t, n]) => <span key={t} style={{ width: `${n / list.length * 100}%`, background: color(t) }} />)}</div><Bars rows={rows} max={Math.max(...rows.map(r => r[1]))} /></> : <p className="text-sm text-muted">No members recorded.</p>}
        </div>)}</div>
      </div>
    </div>
  </Section>;
}

function NationalOverview({ onOpen }) {
  const { data, go } = useApp();
  const pending = data.users.filter(u => u.status === 'pending').length;
  const sub = data.sanctions.filter(s => s.status === 'submitted');
  const upcoming = data.events.filter(isUpcoming).length;
  const rest = data.restPeriodExams.filter(restOpen).length;
  const stats = [
    ['Approved members', data.users.filter(u => u.status === 'approved').length, null],
    ['Pending registrations', pending, () => go('USERS')],
    ['NSO sanctions awaiting you', sub.filter(s => s.type === 'NSO').length, () => go('SANCTIONS')],
    ['PTSO sanctions in review', sub.filter(s => s.type === 'PTSO').length, () => go('SANCTIONS')],
    ['Upcoming events', upcoming, () => go('EVENTS')],
    ['Athletes on mandatory rest', rest, null]
  ];
  const rm = nccpReminder(data);
  return <div className="space-y-5">
    {rm.overdue && <Banner tone="warn" action={<Btn size="sm" variant="primary" onClick={() => go('COACHPROG')}>Upload Locker reports</Btn>}>⏰ {NCCP_REMINDER_TEXT} {rm.lastMulti && rm.lastEvents ? `Last upload ${fmtDate(((rm.lastMulti < rm.lastEvents) ? rm.lastMulti : rm.lastEvents).slice(0, 10))}.` : `Never imported: ${rm.missing.join(' and ')}.`}</Banner>}
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {stats.map(([l, n, fn]) => <button key={l} type="button" disabled={!fn} onClick={fn || undefined} className="bg-surface p-4 text-left enabled:hover:bg-sunk disabled:cursor-default">
        <div className="font-display text-3xl font-extrabold tabular-nums">{n}</div><div className="text-sm leading-tight text-muted">{l}</div></button>)}
    </div>
    <MembershipBreakdown />
  </div>;
}

/* =========================================================
   Competition events
   ========================================================= */
function WeightPicker({ value, onChange, disabled }) {
  const [cat, setCat] = useState(CATEGORIES[0].name);
  const c = CATEGORIES.find(x => x.name === cat);
  const toggle = l => onChange(value.includes(l) ? value.filter(x => x !== l) : [...value, l]);
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-1">{CATEGORIES.map(x => { const n = value.filter(v => v.startsWith(x.name + ' ')).length; return <button key={x.name} type="button" onClick={() => setCat(x.name)} className={cx('rounded-md border px-2.5 py-1 text-xs font-semibold', cat === x.name ? 'border-rope bg-ropesoft text-rope' : 'border-line text-muted hover:bg-sunk')}>{x.name}{n ? ` (${n})` : ''}</button>; })}</div>
    <div className="flex flex-wrap gap-1.5">{c.weights.map(w => { const l = wcLabel(cat, w), on = value.includes(l); return <button key={w} type="button" disabled={disabled} onClick={() => toggle(l)} aria-pressed={on} className={cx('min-w-[52px] rounded-md border px-2 py-1 text-sm font-semibold tabular-nums disabled:cursor-not-allowed', on ? 'border-maple bg-maple text-white' : 'border-line bg-surface hover:bg-sunk')}>{w}</button>; })}</div>
    <div className="flex flex-wrap gap-1">{value.length ? value.map(v => <Badge key={v} tone="info">{v}{!disabled && <button type="button" aria-label={'Remove ' + v} onClick={() => toggle(v)} className="ml-0.5 font-bold">×</button>}</Badge>) : <span className="text-xs text-muted">No weight classes selected.</span>}</div>
  </div>;
}
function CreateEventModal({ onClose, initial }) {
  const { update, viewer, notify } = useApp();
  const [f, setF] = useState(() => initial ? { name: initial.name, province: initial.province, date: initial.date, preTime: (initial.firstPreBoutCheckDateTime || '').slice(11, 16) || '10:00', firstBoutTime: initial.firstBoutTime || '13:00', location: initial.location, weightClasses: initial.weightClasses.slice(), livestreamUrl: initial.livestreamUrl || '', sanctionLevel: initial.sanctionLevel || 'PTSO', scatRequired: !!initial.scatRequired, scatWithinDays: initial.scatWithinDays || 30 } : { name: '', province: viewer.province || 'ON', date: '', preTime: '10:00', firstBoutTime: '13:00', location: '', weightClasses: [], livestreamUrl: '', sanctionLevel: viewer.role === 'nsoadmin' ? 'NSO' : 'PTSO', scatRequired: false, scatWithinDays: 30 });
  const [err, setErr] = useState('');
  const save = () => {
    if (!f.name.trim() || !f.date || !f.location.trim()) { setErr('Add the event name, date and location.'); return; }
    if (initial) { update(d => { const x = d.events.find(e => e.id === initial.id); Object.assign(x, { name: f.name.trim(), province: f.province, date: f.date, firstPreBoutCheckDateTime: f.date + 'T' + f.preTime, firstBoutTime: f.firstBoutTime, location: f.location.trim(), weightClasses: f.weightClasses, livestreamUrl: f.livestreamUrl.trim() ? normUrl(f.livestreamUrl.trim()) : '', scatRequired: !!f.scatRequired, scatWithinDays: Number(f.scatWithinDays) || 30, ...(viewer.role === 'nsoadmin' && !x.sanctionId ? { sanctionLevel: f.sanctionLevel } : {}) }); }); notify(`“${f.name.trim()}” updated.`); onClose(); return; }
    update(d => { d.events.push({ id: uid('e'), name: f.name.trim(), province: f.province, date: f.date, firstPreBoutCheckDateTime: f.date + 'T' + f.preTime, firstBoutTime: f.firstBoutTime, location: f.location.trim(), weightClasses: f.weightClasses, livestreamUrl: f.livestreamUrl.trim() ? normUrl(f.livestreamUrl.trim()) : '', sanctionLevel: viewer.role === 'nsoadmin' ? f.sanctionLevel : 'PTSO', scatRequired: !!f.scatRequired, scatWithinDays: Number(f.scatWithinDays) || 30, registeredBoxerIds: [], officials: [], physicianIds: [], bouts: [], sanctionId: null }); });
    notify(`Event “${f.name.trim()}” created.`); onClose();
  };
  return <Modal title={initial ? 'Edit Event Details' : 'Create New Event'} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{initial ? 'Save changes' : 'Create Event'}</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event name" required className="sm:col-span-2"><input className="field" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} /></Field>
        <Field label="Province or territory"><select className="field" value={f.province} disabled={viewer.role === 'ptso' && !initial} onChange={e => setF(p => ({ ...p, province: e.target.value }))}>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></Field>
        {viewer.role === 'nsoadmin' && !(initial && initial.sanctionId) && <Field label="Sanctioned by" hint="National events show in the public livestream list 30 days ahead, provincial events 7 days ahead."><select className="field" value={f.sanctionLevel} onChange={e => setF(p => ({ ...p, sanctionLevel: e.target.value }))}><option value="NSO">Boxing Canada (national)</option><option value="PTSO">PTSO (provincial)</option></select></Field>}
        <Field label="Event date" required><input type="date" className="field" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} /></Field>
        <Field label="1st pre-bout check time"><input type="time" className="field" value={f.preTime} onChange={e => setF(p => ({ ...p, preTime: e.target.value }))} /></Field>
        <Field label="Time of first bout"><input type="time" className="field" value={f.firstBoutTime} onChange={e => setF(p => ({ ...p, firstBoutTime: e.target.value }))} /></Field>
        <Field label="Venue and address" required className="sm:col-span-2"><input className="field" value={f.location} onChange={e => setF(p => ({ ...p, location: e.target.value }))} /></Field>
        <Field label="Livestream link (optional)" className="sm:col-span-2"><input type="url" className="field" placeholder="https://" value={f.livestreamUrl} onChange={e => setF(p => ({ ...p, livestreamUrl: e.target.value }))} /></Field>
        <Field label="Require a recent SCAT6 screening?" className="sm:col-span-2"><div className="flex flex-wrap items-center gap-3"><YesNo value={f.scatRequired ? 'yes' : 'no'} onChange={v => setF(p => ({ ...p, scatRequired: v === 'yes' }))} />{f.scatRequired && <label className="flex items-center gap-2 text-sm">within<select className="field w-auto py-1" value={f.scatWithinDays} onChange={e => setF(p => ({ ...p, scatWithinDays: Number(e.target.value) }))}>{SCAT_WINDOW_CHOICES.map(n => <option key={n} value={n}>{n} days</option>)}</select>before the event</label>}</div></Field>
      </div>
      <Field label="Contested weight categories"><WeightPicker value={f.weightClasses} onChange={v => setF(p => ({ ...p, weightClasses: v }))} /></Field>
    </div>
  </Modal>;
}
const OFFICIAL_ROLES = ['Referee', 'Judge', 'TD/Supervisor'];
const MEDICAL_ROLES = ['Ringside Practitioner', 'Pre Bout Checks', 'Post Bout Checks'];
const medEntries = ev => ev.physicianIds.map(id => { const m = (ev.medicalRoles || {})[id] || {}; return { userId: id, checkedIn: !!m.checkedIn, roles: m.roles || [] }; });
const offEntries = ev => ev.officials.map(o => ({ userId: o.userId, checkedIn: !!o.checkedIn, roles: o.roles || [] }));
const inCount = list => list.filter(x => x.checkedIn).length;
function StaffList({ entries, emoji, roleOptions, canEditRoles, canToggle, onRole, onCheckIn, empty }) {
  const { data, viewer } = useApp();
  return <ul className="divide-y divide-line rounded-md border border-line">
    {entries.length ? entries.map(o => { const tog = canToggle(o.userId); return <li key={o.userId} className="px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold"><span aria-hidden="true">{emoji}</span> {nameOf(data, o.userId)}{o.userId === viewer.id && <span className="font-normal text-muted"> (you)</span>}</span>
        <label className={cx('flex items-center gap-2 text-xs font-semibold', tog ? 'cursor-pointer' : 'opacity-70', o.checkedIn ? 'text-ok' : 'text-muted')}><input type="checkbox" className="h-4 w-4 accent-[#1C7548]" disabled={!tog} checked={o.checkedIn} onChange={e => onCheckIn(o.userId, e.target.checked)} />{o.checkedIn ? 'Checked in' : 'Not checked in'}</label>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {roleOptions.some(r => canEditRoles(o.userId, r)) ? roleOptions.map(r => { const ed = canEditRoles(o.userId, r); return <label key={r} title={ed ? undefined : 'Set by the TD/Supervisor or an administrator'} className={cx('flex items-center gap-1.5 text-xs', ed ? 'cursor-pointer' : 'cursor-not-allowed opacity-60')}><input type="checkbox" className="h-3.5 w-3.5 accent-[#1D4E89]" disabled={!ed} checked={o.roles.includes(r)} onChange={e => onRole(o.userId, r, e.target.checked)} />{r}</label>; })
          : o.roles.length ? roleOptions.filter(r => o.roles.includes(r)).map(r => <Badge key={r} tone="info">{r}</Badge>) : <span className="text-xs text-muted">No role assigned yet</span>}
      </div>
    </li>; }) : <li className="px-3 py-2 text-sm text-muted">{empty}</li>}
  </ul>;
}
function EventCard({ ev, expanded, onToggle, highlight, setModal, onRingside, onRoster, onClasses }) {
  const { data, update, viewer, notify } = useApp();
  const admin = isAdmin(viewer);
  const upcoming = isUpcoming(ev);
  const [addBoxer, setAddBoxer] = useState(''); const [addOff, setAddOff] = useState(''); const [addMed, setAddMed] = useState('');
  const [bout, setBout] = useState({ redId: '', blueId: '', blueName: '', weightClass: '' });
  const [editEv, setEditEv] = useState(false);
  const [lsEdit, setLsEdit] = useState(null);
  const [resFor, setResFor] = useState(null); const [res, setRes] = useState({ winner: 'red', method: 'Unanimous decision', round: '3' });
  let rows = ev.registeredBoxerIds.map(id => getUser(data, id)).filter(Boolean);
  if (viewer.role === 'boxer') rows = rows.filter(b => b.id === viewer.id);
  if (viewer.role === 'coach') rows = rows.filter(b => (b.selectedCoachIds || []).includes(viewer.id));
  const hidden = ev.registeredBoxerIds.length - rows.length;
  const canOpenForm = b => viewer.id === b.id || isAdmin(viewer) || viewer.role === 'medical' || (viewer.role === 'coach' && (b.selectedCoachIds || []).includes(viewer.id));
  const enterable = (admin ? allBoxers(data) : []).filter(b => !ev.registeredBoxerIds.includes(b.id));
  const canResult = admin || (viewer.role === 'official' && ev.officials.some(o => o.userId === viewer.id));
  const ws = windowStatus(ev);
  const isCoach = viewer.role === 'coach';
  const mineId = id => { if (!isCoach || !id) return false; const u = getUser(data, id); return !!u && (u.selectedCoachIds || []).includes(viewer.id); };
  const isOfficial = viewer.role === 'official';
  const showSummary = isOfficial || viewer.role === 'medical';
  const isTD = isOfficial && ev.officials.some(o => o.userId === viewer.id && (o.roles || []).includes('TD/Supervisor'));
  const canCheckIn = id => id === viewer.id || isTD || viewer.role === 'nsoadmin';
  const wcSummary = () => {
    const groups = {};
    const blank = () => ({ total: 0, eligible: 0, boxer: 0, coach: 0, female: 0, np: 0 });
    ev.weightClasses.forEach(w => { groups[w] = blank(); });
    ev.registeredBoxerIds.map(id => getUser(data, id)).filter(Boolean).forEach(b => {
      const wc = entryClass(ev, b.id) || 'Not yet assigned to a weight class';
      const g = groups[wc] || (groups[wc] = blank());
      const s = qStatus(data, ev, b);
      g.total++; if (eligibility(data, b).tone === 'ok') g.eligible++; if (s.boxer) g.boxer++; if (s.coach) g.coach++;
      if (b.gender === 'F') { g.female++; if (s.np) g.np++; }
    });
    return Object.keys(groups).map(w => [w, groups[w]]);
  };
  const Ratio = ({ n, of, na }) => !of ? <span className="text-xs text-muted">{na || '—'}</span> : <Badge tone={n === of ? 'ok' : 'warn'}>{n} / {of}</Badge>;
  const cornerCls = (bt, side) => mineId(side === 'red' ? bt.redId : bt.blueId) ? 'font-bold text-ink' : (!isCoach && bt.winner === side ? 'font-bold' : '');
  const mut = fn => update(d => fn(d.events.find(e => e.id === ev.id)));
  return <article id={'event-' + ev.id} className={cx('overflow-hidden rounded-lg border bg-surface transition', highlight ? 'border-maple ring-2 ring-maple' : 'border-line')}>
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full flex-wrap items-start gap-3 px-4 py-3 text-left hover:bg-sunk">
      <div className="w-16 shrink-0 rounded-md border border-line bg-sunk py-1 text-center">
        <div className="text-xs font-semibold uppercase text-maple">{new Date(toUTC(ev.date)).toLocaleDateString(uiLocale(), { timeZone: 'UTC', month: 'short' })}</div>
        <div className="font-display text-2xl font-extrabold leading-none">{ev.date.slice(8, 10)}</div>
        <div className="text-[10px] text-muted">{ev.date.slice(0, 4)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold leading-tight">{ev.name}</h3><Badge tone="neutral">{ev.province}</Badge><Badge tone={upcoming ? 'info' : 'neutral'}>{upcoming ? 'Upcoming' : 'Completed'}</Badge>{ev.scatRequired && <Badge tone="warn">SCAT6 within {ev.scatWithinDays || 30} days required</Badge>}</div>
        <p className="mt-0.5 text-sm text-muted">{ev.location}</p>
        {ev.endDate && ev.endDate !== ev.date && <p className="text-sm font-semibold">{fmtDate(ev.date)} to {fmtDate(ev.endDate)}</p>}<p className="text-sm">1st pre-bout check <b>{fmtDT(ev.firstPreBoutCheckDateTime)}</b>{ev.firstBoutTime && <> · first bout {ev.firstBoutTime}</>}</p>
        {viewer.role !== 'coach' && viewer.role !== 'boxer' && (() => { const off = offEntries(ev), med = medEntries(ev), oi = inCount(off), mi = inCount(med); return <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone={!off.length ? 'neutral' : oi === off.length ? 'ok' : 'warn'}>⚖️ Officials checked in {oi} / {off.length}</Badge>
          <Badge tone={!med.length ? 'neutral' : mi === med.length ? 'ok' : 'warn'}>🩺 Medical practitioners checked in {mi} / {med.length}</Badge>
        </div>; })()}
      </div>
      <span className="text-sm font-semibold text-muted">{expanded ? 'Hide' : 'Details'}</span>
    </button>
    {expanded && <div className="space-y-4 border-t border-line px-4 py-4">
      {(() => { const alerts = ev.registeredBoxerIds.map(id => getUser(data, id)).filter(b => b && scatOpen(data, b.id) && canSeeScat(viewer, b)); return alerts.length > 0 && <Banner tone="bad"><b>SCAT6 alert:</b> {alerts.map(b => { const sc = latestScat(data, b.id); return `${fullName(b)} (${sc.emergency ? 'emergency, ' : ''}practitioner SCAT6 required, screened ${fmtDate(sc.at.slice(0, 10))})`; }).join('; ')}. A medical practitioner should complete a full SCAT6 before this boxer competes.</Banner>; })()}
      {(isTD || admin) && onRoster && upcoming && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rope bg-ropesoft px-3 py-2.5"><span className="text-sm font-semibold text-rope">⚖️ {isTD ? 'As TD/Supervisor you can put boxers into this competition.' : 'Put boxers into this competition.'} {ev.registeredBoxerIds.length} entered so far.</span><div className="flex flex-wrap gap-2"><Btn variant="rope" size="sm" onClick={() => onRoster(ev.id)}>Register Competitors</Btn>{onClasses && <Btn size="sm" onClick={() => onClasses(ev.id)}>Manage Competitors{(ev.classRequests || []).some(r => r.status === 'pending') ? ' • request pending' : ''}</Btn>}</div></div>}
      {viewer.role === 'medical' && onRingside && (() => { const dayStart = Date.parse(ev.date + 'T00:00:00'), opens = dayStart - DAY, closes = dayStart + DAY; const medOpen = REF_NOW >= opens && REF_NOW < closes; const note = medOpen ? 'Available now: within 24 hours of the competition day, or on the day.' : REF_NOW < opens ? `Available from ${fmtMs(opens)}, 24 hours before the competition day.` : 'Closed. The competition day has passed. Use Athlete Record Books for recovery clearances.'; return <div className={cx('flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5', medOpen ? 'border-rope bg-ropesoft' : 'border-line bg-sunk')}><span className={cx('text-sm', medOpen ? 'font-semibold text-rope' : 'text-muted')}>🩺 {note}</span><Btn variant="rope" size="sm" disabled={!medOpen} title={medOpen ? undefined : note} onClick={() => medOpen && onRingside(ev.id)}>Execute Pre-bout and Post-bout Medical Checks</Btn></div>; })()}
      {isAdmin(viewer) && onRingside && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-sunk px-3 py-2.5"><span className="text-sm">🩺 Pre-bout and post-bout medical checks, mandatory rest periods and recovery clearances for this event.{viewer.role === 'nsoadmin' ? ' View only: medical examinations are recorded by medical practitioners.' : ''}</span><Btn variant="rope" size="sm" onClick={() => onRingside(ev.id)}>Open event medical checks</Btn></div>}
      {admin && <div className="flex justify-end"><Btn size="sm" onClick={() => setEditEv(true)}>Edit event details</Btn></div>}
      {(() => { const canLs = admin || isTD; const saveLs = () => { const v = (lsEdit || '').trim(); mut(x => { x.livestreamUrl = v ? normUrl(v) : ''; }); notify(v ? 'Livestream link saved. It shows on the event and the calendar.' : 'Livestream link removed.', v ? 'ok' : 'info'); setLsEdit(null); }; return lsEdit !== null ? <div className="flex flex-wrap items-center gap-2 rounded-md border border-rope bg-ropesoft px-3 py-2 text-sm"><span aria-hidden="true">📺</span><input type="url" autoFocus className="field min-w-[220px] flex-1 py-1.5" placeholder="https://" value={lsEdit} onChange={e => setLsEdit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveLs(); }} aria-label="Livestream link" /><Btn size="sm" variant="primary" onClick={saveLs}>Save</Btn><Btn size="sm" onClick={() => setLsEdit(null)}>Cancel</Btn></div>
        : ev.livestreamUrl ? <div className="flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"><span aria-hidden="true">📺</span><span className="font-semibold">Livestream</span><a href={normUrl(ev.livestreamUrl)} target="_blank" rel="noopener noreferrer" className="break-all text-rope hover:underline">{ev.livestreamUrl.replace(/^https?:\/\//, '')} ↗</a>{canLs && <Btn size="xs" variant="ghost" className="ml-auto" onClick={() => setLsEdit(ev.livestreamUrl)}>Change link</Btn>}</div>
        : canLs ? <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted"><span aria-hidden="true">📺</span>No livestream link yet.<Btn size="xs" variant="rope" className="ml-auto" onClick={() => setLsEdit('')}>Add livestream link</Btn></div> : null; })()}
      <div><div className="mb-1 text-xs font-semibold text-muted">Contested weight categories</div><div className="flex flex-wrap gap-1">{ev.weightClasses.length ? ev.weightClasses.map(w => <Badge key={w} tone="info">{w}</Badge>) : <span className="text-sm text-muted">None listed.</span>}</div></div>

      {showSummary && (() => { const sum = wcSummary(); const tot = sum.reduce((a, [, g]) => { Object.keys(g).forEach(k => { a[k] = (a[k] || 0) + g[k]; }); return a; }, {}); return <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-base font-bold">Competitor readiness by weight class</h4><Badge tone={ws.tone}>24h window: {ws.label}</Badge></div>
        <Table head={['Weight class', 'Boxers', 'Eligible', 'Boxer readiness', 'Coach co-sign', 'Non-pregnancy (female boxers)']} isEmpty={!sum.length} empty="No competitors registered.">
          {sum.map(([w, g]) => <tr key={w}>
            <Td className="font-semibold">{w}</Td><Td className="tabular-nums">{g.total}</Td>
            <Td><Ratio n={g.eligible} of={g.total} /></Td><Td><Ratio n={g.boxer} of={g.total} /></Td><Td><Ratio n={g.coach} of={g.total} /></Td><Td><Ratio n={g.np} of={g.female} na={g.total ? 'Not applicable' : '—'} /></Td></tr>)}
          {sum.length > 1 && <tr className="bg-sunk font-semibold"><Td>All weight classes</Td><Td className="tabular-nums">{tot.total || 0}</Td><Td><Ratio n={tot.eligible || 0} of={tot.total || 0} /></Td><Td><Ratio n={tot.boxer || 0} of={tot.total || 0} /></Td><Td><Ratio n={tot.coach || 0} of={tot.total || 0} /></Td><Td><Ratio n={tot.np || 0} of={tot.female || 0} na="Not applicable" /></Td></tr>}
        </Table>
      </div>; })()}

      {viewer.role === 'boxer' && (() => { const me = rows[0]; if (!me) return null; const s = qStatus(data, ev, me), el = eligibility(data, me); const sc = ev.scatRequired ? scatForEvent(data, ev, me.id) : null; const items = [['Boxer readiness declaration', s.boxer], ['Coach co-signature', s.coach], ...(s.np !== null ? [['Declaration of non-pregnancy', s.np]] : [])]; const needs = items.filter(x => !x[1]).length + (sc && sc.state !== 'ok' ? 1 : 0); return <div className="rounded-md border border-line p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2"><h4 className="font-display text-base font-bold">Your readiness for this event</h4><Badge tone={el.tone}>{el.label}</Badge><ScatBadge u={me} /></div>
        <ul className="divide-y divide-line text-sm">
          {items.map(([label, done]) => <li key={label} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{label}</span><Check ok={done} /></li>)}
          {sc && <li className="flex flex-wrap items-center justify-between gap-2 py-2"><span>SCAT6 screening (within {ev.scatWithinDays || 30} days)</span><ScatEventCell ev={ev} b={me} onRun={() => setModal({ kind: 'scat', boxerId: me.id, eventName: ev.name })} /></li>}
        </ul>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2"><span className={cx('text-sm font-semibold', needs ? 'text-warn' : 'text-ok')}>{needs ? `${needs} item${needs === 1 ? '' : 's'} still to complete` : '✓ Everything is complete'}</span><FormButton ev={ev} s={s} onOpen={() => setModal({ kind: 'pre', eventId: ev.id, boxerId: me.id })} /></div>
      </div>; })()}
      {!showSummary && viewer.role !== 'boxer' && <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-base font-bold">Registered competitors & 24h Pre-Bout Questionnaires</h4><Badge tone={ws.tone}>24h window: {ws.label}</Badge></div>
        <Table head={['Boxer', 'Eligibility', ...(ev.scatRequired ? ['SCAT6'] : []), 'Boxer readiness', 'Coach co-sign', 'Non-pregnancy', '']} isEmpty={!rows.length} empty={viewer.role === 'coach' ? 'None of your boxers are entered.' : 'No competitors registered.'}>
          {rows.map(b => { const s = qStatus(data, ev, b), el = eligibility(data, b); return <tr key={b.id}>
            <Td className="font-semibold">{fullName(b)}<div className="text-xs font-normal text-muted">{b.membershipId}</div></Td>
            <Td><Badge tone={el.tone}>{el.label}</Badge><div className="mt-1"><ScatBadge u={b} /></div></Td>{ev.scatRequired && <Td><ScatEventCell ev={ev} b={b} onRun={() => setModal({ kind: 'scat', boxerId: b.id, eventName: ev.name })} /></Td>}<Td><Check ok={s.boxer} /></Td><Td><Check ok={s.coach} /></Td><Td>{s.np === null ? <span className="text-xs text-muted">Not applicable</span> : <Check ok={s.np} />}</Td>
            <Td className="text-right">{canOpenForm(b) && <FormButton ev={ev} s={s} onOpen={() => setModal({ kind: 'pre', eventId: ev.id, boxerId: b.id })} />}</Td></tr>; })}
        </Table>
        {hidden > 0 && viewer.role !== 'boxer' && <p className="mt-1 text-xs text-muted">{hidden} other competitor{hidden > 1 ? 's' : ''} from other clubs not shown.</p>}
        {upcoming && enterable.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="field max-w-xs" value={addBoxer} onChange={e => setAddBoxer(e.target.value)} aria-label="Boxer to enter"><option value="">Enter a boxer…</option>{enterable.map(b => <option key={b.id} value={b.id}>{fullName(b)} ({b.membershipId})</option>)}</select>
          <Btn size="sm" disabled={!addBoxer} onClick={() => { mut(e => e.registeredBoxerIds.push(addBoxer)); notify(`${nameOf(data, addBoxer)} entered in ${ev.name}.`); setAddBoxer(''); }}>Enter boxer</Btn>
        </div>}
      </div>}

      {!isCoach && viewer.role !== 'boxer' && <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-base font-bold">Officials</h4><span className="text-xs font-semibold text-muted">{inCount(offEntries(ev))} / {ev.officials.length} checked in</span></div>
          <StaffList entries={offEntries(ev)} emoji="⚖️" roleOptions={OFFICIAL_ROLES} canEditRoles={(id, r) => admin || isTD || (id === viewer.id && r !== 'TD/Supervisor')} empty="No officials assigned."
            canToggle={canCheckIn}
            onCheckIn={(id, v) => mut(x => { x.officials.find(y => y.userId === id).checkedIn = v; })}
            onRole={(id, r, on) => mut(x => { const o = x.officials.find(y => y.userId === id); const cur = o.roles || []; o.roles = on ? [...cur.filter(z => z !== r), r] : cur.filter(z => z !== r); })} />
          {(admin || isTD) && <div className="mt-2 flex gap-2"><select className="field" value={addOff} onChange={e => setAddOff(e.target.value)} aria-label="Official to assign"><option value="">Assign an official…</option>{data.users.filter(u => u.role === 'official' && u.status === 'approved' && !ev.officials.some(o => o.userId === u.id)).map(u => <option key={u.id} value={u.id}>{fullName(u)}</option>)}</select><Btn size="sm" disabled={!addOff} onClick={() => { mut(x => x.officials.push({ userId: addOff, checkedIn: false, roles: [] })); setAddOff(''); }}>Assign</Btn></div>}
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-base font-bold">Event Medical Practitioners</h4><span className="text-xs font-semibold text-muted">{inCount(medEntries(ev))} / {ev.physicianIds.length} checked in</span></div>
          <StaffList entries={medEntries(ev)} emoji="🩺" roleOptions={MEDICAL_ROLES} canEditRoles={id => admin || isTD || id === viewer.id} empty="No event medical practitioner assigned."
            canToggle={canCheckIn}
            onCheckIn={(id, v) => mut(x => { x.medicalRoles = x.medicalRoles || {}; const m = x.medicalRoles[id] = x.medicalRoles[id] || { checkedIn: false, roles: [] }; m.checkedIn = v; })}
            onRole={(id, r, on) => mut(x => { x.medicalRoles = x.medicalRoles || {}; const m = x.medicalRoles[id] = x.medicalRoles[id] || { checkedIn: false, roles: [] }; const cur = m.roles || []; m.roles = on ? [...cur.filter(z => z !== r), r] : cur.filter(z => z !== r); })} />
          {(admin || isTD) && <div className="mt-2 flex gap-2"><select className="field" value={addMed} onChange={e => setAddMed(e.target.value)} aria-label="Medical practitioner to assign"><option value="">Assign a medical practitioner…</option>{data.users.filter(u => u.role === 'medical' && u.status === 'approved' && !ev.physicianIds.includes(u.id)).map(u => <option key={u.id} value={u.id}>{nameOf(data, u.id)}</option>)}</select><Btn size="sm" disabled={!addMed} onClick={() => { mut(x => x.physicianIds.push(addMed)); setAddMed(''); }}>Assign</Btn></div>}
        </div>
      </div>}

      <div>
        <h4 className="mb-2 font-display text-base font-bold">Bout sheet</h4>
        {isCoach && <p className="mb-2 text-xs text-muted">Your boxers are shown in bold.</p>}
        <Table head={['#', 'Red corner', 'Blue corner', 'Weight class', 'Result', '']} isEmpty={!ev.bouts.length} empty="No bouts scheduled yet.">
          {ev.bouts.map((bt, i) => <tr key={bt.id}>
            <Td className="tabular-nums text-muted">{i + 1}</Td>
            <Td className={cornerCls(bt, 'red')}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#C8102E]" />{cornerName(data, bt, 'red')}</Td>
            <Td className={cornerCls(bt, 'blue')}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#1D4E89]" />{cornerName(data, bt, 'blue')}</Td>
            <Td>{bt.weightClass}</Td>
            <Td>{bt.winner ? <>{cornerName(data, bt, bt.winner)} wins<div className="text-xs text-muted">{bt.method}{bt.round ? ', R' + bt.round : ''}</div></> : <Badge>Scheduled</Badge>}</Td>
            <Td className="text-right">{canResult && !bt.winner && (resFor === bt.id
              ? <div className="flex flex-wrap justify-end gap-1"><select className="field w-auto py-1 text-xs" value={res.winner} onChange={e => setRes(p => ({ ...p, winner: e.target.value }))}><option value="red">Red wins</option><option value="blue">Blue wins</option></select><select className="field w-auto py-1 text-xs" value={res.method} onChange={e => setRes(p => ({ ...p, method: e.target.value }))}>{['Unanimous decision', 'Split decision', 'RSC (referee stops contest)', 'KO', 'Walkover', 'Disqualification'].map(m => <option key={m}>{m}</option>)}</select><select className="field w-auto py-1 text-xs" value={res.round} onChange={e => setRes(p => ({ ...p, round: e.target.value }))}>{['1', '2', '3'].map(r => <option key={r} value={r}>Round {r}</option>)}</select><Btn size="xs" variant="primary" onClick={() => { mut(x => Object.assign(x.bouts.find(y => y.id === bt.id), res)); setResFor(null); notify('Bout result recorded.'); }}>Save</Btn><Btn size="xs" onClick={() => setResFor(null)}>Cancel</Btn></div>
              : <Btn size="sm" onClick={() => setResFor(bt.id)}>Record result</Btn>)}{viewer.role === 'nsoadmin' && bt.winner && <Btn size="xs" variant="ghost" onClick={() => { mut(x => Object.assign(x.bouts.find(y => y.id === bt.id), { winner: '', method: '', round: '' })); notify('Bout result cleared.', 'info'); }}>Clear result</Btn>}{admin && <Btn size="xs" variant="ghost" onClick={() => { mut(x => { x.bouts = x.bouts.filter(y => y.id !== bt.id); }); notify('Bout removed from the bout sheet.', 'warn'); }}>Remove</Btn>}</Td>
          </tr>)}
        </Table>
        {admin && upcoming && <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="field max-w-[190px]" value={bout.redId} onChange={e => setBout(p => ({ ...p, redId: e.target.value }))} aria-label="Red corner"><option value="">Red corner…</option>{ev.registeredBoxerIds.map(id => <option key={id} value={id}>{nameOf(data, id)}</option>)}</select>
          <input className="field max-w-[190px]" placeholder="Blue corner name" value={bout.blueName} onChange={e => setBout(p => ({ ...p, blueName: e.target.value }))} aria-label="Blue corner" />
          <select className="field max-w-[190px]" value={bout.weightClass} onChange={e => setBout(p => ({ ...p, weightClass: e.target.value }))} aria-label="Weight class"><option value="">Weight class…</option>{ev.weightClasses.map(w => <option key={w}>{w}</option>)}</select>
          <Btn size="sm" disabled={!bout.redId || !bout.blueName.trim() || !bout.weightClass} onClick={() => { mut(x => x.bouts.push({ id: uid('bt'), redId: bout.redId, blueName: bout.blueName.trim(), weightClass: bout.weightClass, winner: '', method: '', round: '' })); setBout({ redId: '', blueId: '', blueName: '', weightClass: '' }); }}>Add bout</Btn>
        </div>}
      </div>
    </div>}
    {editEv && <CreateEventModal initial={ev} onClose={() => setEditEv(false)} />}
  </article>;
}
/* =========================================================
   Age groups, weight-class assignment & class requests
   Age groups follow the competition-year rule (event year minus birth year).
   Verify the ranges against current Boxing Canada rules.
   ========================================================= */
const AGE_GROUPS = [
  { key: 'Junior', min: 15, max: 16, M: 'Junior Boys', F: 'Junior Girls' },
  { key: 'Youth', min: 17, max: 18, M: 'Youth Men', F: 'Youth Women' },
  { key: 'Elite', min: 19, max: 40, M: 'Elite Men', F: 'Elite Women' },
  { key: 'Masters', min: 41, max: 99, M: 'Masters Men', F: 'Masters Women' }
];
const compAge = (b, ev) => Number(ev.date.slice(0, 4)) - Number(b.dob.slice(0, 4));
const ageCategory = (b, ev) => { const a = compAge(b, ev); const g = AGE_GROUPS.find(x => a >= x.min && a <= x.max); return g ? g[b.gender] : null; };
const catOf = wc => (CATEGORIES.find(c => wc.startsWith(c.name + ' ')) || {}).name;
const eventClassesFor = (ev, b) => { const c = ageCategory(b, ev); return c ? ev.weightClasses.filter(w => catOf(w) === c) : []; };
function entryClass(ev, bid) {
  const e = (ev.entries || {})[bid];
  if (e) return e.weightClass || '';
  const bt = ev.bouts.find(x => x.redId === bid || x.blueId === bid);
  return bt ? bt.weightClass : '';
}
const canDecideClass = (viewer, ev) => viewer.role === 'nsoadmin' || (viewer.role === 'ptso' && viewer.province === ev.province);
const lastWeight = (d, bid) => { const x = d.ringsideExams.filter(r => r.boxerId === bid && r.weight).sort((a, b) => b.date.localeCompare(a.date))[0]; return x ? x.weight : ''; };

function ClassRequestModal({ ev, category, boxerIds, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const [cat, setCat] = useState(category || CATEGORIES[0].name);
  const [w, setW] = useState('');
  const [ids, setIds] = useState(boxerIds || []);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const c = CATEGORIES.find(x => x.name === cat);
  const label = w ? wcLabel(cat, w) : '';
  const candidates = ev.registeredBoxerIds.map(id => getUser(data, id)).filter(b => b && ageCategory(b, ev) === cat);
  const submit = () => {
    if (!w) { setErr('Choose a weight class.'); return; }
    if (ev.weightClasses.includes(label)) { setErr(`${label} is already approved for this event.`); return; }
    if ((ev.classRequests || []).some(r => r.status === 'pending' && r.weightClass === label)) { setErr(`A request for ${label} is already waiting for approval.`); return; }
    if (!reason.trim()) { setErr('Explain why the class is needed so the administrator can decide.'); return; }
    update(d => { const x = d.events.find(e => e.id === ev.id); x.classRequests = x.classRequests || []; x.classRequests.push({ id: uid('cr'), weightClass: label, boxerIds: ids, reason: reason.trim(), requestedBy: viewer.id, requestedAt: nowIso(), status: 'pending' }); });
    notify(`Request to add ${label} sent to ${PROVINCE_INFO[ev.province].ptso} and Boxing Canada administrators.`);
    onClose();
  };
  return <Modal size="md" title="Request a New Age Group or Weight Class" subtitle={`${ev.name}. Approved by a PTSO or NSO Administrator.`} onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit}>Send request</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Age group and category" required><select className="field" value={cat} onChange={e => { setCat(e.target.value); setW(''); setIds([]); }}>{CATEGORIES.map(x => <option key={x.name}>{x.name}</option>)}</select></Field>
        <Field label="Weight class" required><select className="field" value={w} onChange={e => setW(e.target.value)}><option value="">Choose…</option>{c.weights.map(x => <option key={x} value={x} disabled={ev.weightClasses.includes(wcLabel(cat, x))}>{x} kg{ev.weightClasses.includes(wcLabel(cat, x)) ? ' (already approved)' : ''}</option>)}</select></Field>
      </div>
      <Field label="Competitors this would cover">
        <div className="divide-y divide-line rounded-md border border-line">{candidates.length ? candidates.map(b => <label key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={ids.includes(b.id)} onChange={e => setIds(s => e.target.checked ? [...s, b.id] : s.filter(x => x !== b.id))} />{fullName(b)} <span className="text-xs text-muted">age {compAge(b, ev)}{lastWeight(data, b.id) ? `, last weigh-in ${lastWeight(data, b.id)} kg` : ''}</span></label>) : <p className="px-3 py-2 text-sm text-muted">No entered competitors fall in {cat}.</p>}</div>
      </Field>
      <Field label="Reason" required><textarea rows={3} className="field" value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: two Junior Boys at 54 kg are entered and matched." /></Field>
      <p className="text-xs text-muted">Once approved, {label || 'the class'} is added to the event’s weight classes and the competitors ticked above are placed in it.</p>
    </div>
  </Modal>;
}
function ClassDenyModal({ ev, req, onClose }) {
  const { update, viewer, notify } = useApp();
  const [reason, setReason] = useState(''); const [err, setErr] = useState('');
  const deny = () => {
    if (!reason.trim()) { setErr('Give a reason so the TD/Supervisor knows what to do next.'); return; }
    update(d => { const r = d.events.find(e => e.id === ev.id).classRequests.find(y => y.id === req.id); Object.assign(r, { status: 'denied', decidedBy: viewer.id, decidedAt: nowIso(), denialReason: reason.trim() }); });
    notify(`Request for ${req.weightClass} denied.`, 'warn'); onClose();
  };
  return <Modal size="md" title="Deny Weight Class Request" subtitle={`${req.weightClass}, ${ev.name}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="danger" onClick={deny}>Deny request</Btn></>}>
    {err && <Banner tone="bad" className="mb-3">{err}</Banner>}
    <Field label="Reason shared with the TD/Supervisor" required><textarea rows={4} className="field" value={reason} onChange={e => setReason(e.target.value)} /></Field>
  </Modal>;
}
function approveClassRequest(update, viewer, notify, evId, req) {
  update(d => {
    const x = d.events.find(e => e.id === evId); const r = x.classRequests.find(y => y.id === req.id);
    Object.assign(r, { status: 'approved', decidedBy: viewer.id, decidedAt: nowIso() });
    if (!x.weightClasses.includes(r.weightClass)) x.weightClasses.push(r.weightClass);
    x.entries = x.entries || {};
    r.boxerIds.forEach(id => { if (x.registeredBoxerIds.includes(id) && !(x.entries[id] && x.entries[id].weightClass)) x.entries[id] = { weightClass: r.weightClass }; });
  });
  notify(`${req.weightClass} approved and added to the event.`);
}
function ClassRequestsTable({ items, showEvent }) {
  const { data, update, viewer, notify } = useApp();
  const [deny, setDeny] = useState(null);
  const tone = { pending: 'warn', approved: 'ok', denied: 'bad' };
  return <>
    <Table head={[...(showEvent ? ['Event'] : []), 'Requested class', 'Competitors', 'Reason', 'Requested by', 'Status', '']} isEmpty={!items.length} empty="No age group or weight class requests.">
      {items.map(({ ev, r }) => <tr key={r.id}>
        {showEvent && <Td className="font-semibold">{ev.name}<div className="text-xs font-normal text-muted">{ev.province}, {fmtDate(ev.date)}</div></Td>}
        <Td className="font-semibold whitespace-nowrap">{r.weightClass}</Td>
        <Td>{r.boxerIds.length ? r.boxerIds.map(id => nameOf(data, id)).join(', ') : <span className="text-muted">None named</span>}</Td>
        <Td className="max-w-xs">{r.reason}{r.status === 'denied' && r.denialReason && <div className="mt-1 text-xs text-maple">Denied: {r.denialReason}</div>}</Td>
        <Td>{nameOf(data, r.requestedBy)}<div className="text-xs text-muted">{fmtStamp(r.requestedAt)}</div></Td>
        <Td><Badge tone={tone[r.status]}>{r.status === 'pending' ? 'Pending approval' : r.status === 'approved' ? 'Approved' : 'Denied'}</Badge>{r.decidedBy && <div className="mt-1 text-xs text-muted">{nameOf(data, r.decidedBy)}</div>}</Td>
        <Td className="text-right">{r.status === 'pending' && canDecideClass(viewer, ev) ? <div className="flex justify-end gap-1.5"><Btn size="sm" variant="ok" onClick={() => approveClassRequest(update, viewer, notify, ev.id, r)}>Approve</Btn><Btn size="sm" variant="danger" onClick={() => setDeny({ ev, r })}>Deny</Btn></div> : r.status === 'pending' ? <span className="text-xs text-muted">Awaiting {PROVINCE_INFO[ev.province].ptso} or Boxing Canada</span> : null}</Td>
      </tr>)}
    </Table>
    {deny && <ClassDenyModal ev={deny.ev} req={deny.r} onClose={() => setDeny(null)} />}
  </>;
}
function ClassRequestsSection() {
  const { data } = useApp();
  const items = [];
  data.events.forEach(ev => (ev.classRequests || []).forEach(r => items.push({ ev, r })));
  items.sort((a, b) => ((a.r.status === 'pending' ? 0 : 1) - (b.r.status === 'pending' ? 0 : 1)) || b.r.requestedAt.localeCompare(a.r.requestedAt));
  const pending = items.filter(x => x.r.status === 'pending').length;
  return <Section title="Age Group & Weight Class Requests" sub="Requests from TD/Supervisors to add a category or weight class to an approved event." actions={<Badge tone={pending ? 'warn' : 'ok'}>{pending} pending</Badge>}>
    <ClassRequestsTable items={items} showEvent />
  </Section>;
}

function ClassManagerView({ eventId, onBack }) {
  const { data, update, viewer } = useApp();
  const ev = data.events.find(e => e.id === eventId);
  const [req, setReq] = useState(null);
  const [msg, setMsg] = useState(null);
  if (!ev) return <Banner tone="bad">This event could not be found.</Banner>;
  const comps = ev.registeredBoxerIds.map(id => getUser(data, id)).filter(Boolean).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const reqs = ev.classRequests || [];
  const setClass = (b, wc) => { update(d => { const x = d.events.find(e => e.id === eventId); x.entries = x.entries || {}; x.entries[b.id] = { weightClass: wc }; }); setMsg({ tone: 'ok', text: wc ? `${fullName(b)} placed in ${wc}.` : `${fullName(b)} is no longer assigned to a weight class.` }); };
  const rows = comps.map(b => { const cat = ageCategory(b, ev), opts = eventClassesFor(ev, b), cur = entryClass(ev, b.id); return { b, cat, opts, cur, curOk: !cur || opts.includes(cur), pend: reqs.find(r => r.status === 'pending' && r.boxerIds.includes(b.id)), eligible: opts.length > 0 }; });
  const nIneligible = rows.filter(r => !r.eligible).length, nUnassigned = rows.filter(r => r.eligible && !r.cur).length;
  const byCat = {};
  ev.weightClasses.forEach(w => { const c = catOf(w) || 'Other'; (byCat[c] = byCat[c] || []).push(w); });
  const countIn = w => rows.filter(r => r.cur === w).length;
  return <div className="space-y-4">
    <Btn size="sm" variant="ghost" onClick={onBack}>‹ Back to Competition Events</Btn>
    <header className="overflow-hidden rounded-lg border border-line bg-surface"><div className="rope-rule" /><div className="flex flex-wrap items-end gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-muted">Manage Competitors</p><h2 className="font-display text-2xl font-extrabold leading-tight">{ev.name}</h2><p className="text-sm text-muted">Place each competitor in an age group and weight class approved for this event.</p></div>
      <div className="flex flex-wrap gap-1.5"><Badge tone="info">{comps.length} competitors</Badge><Badge tone={nUnassigned ? 'warn' : 'ok'}>{nUnassigned} unassigned</Badge><Badge tone={nIneligible ? 'bad' : 'ok'}>{nIneligible} ineligible for approved classes</Badge></div></div></header>
    {msg && <Banner tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Banner>}

    <Section title="Approved age groups & weight classes" sub="From the approved sanction application, plus any approved requests." actions={<Btn size="sm" onClick={() => setReq({})}>Request new age group</Btn>}>
      {Object.keys(byCat).length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(byCat).map(([c, ws]) => <div key={c} className="rounded-md border border-line p-3"><div className="mb-2 font-display text-base font-bold">{c}</div><div className="flex flex-wrap gap-1.5">{ws.map(w => <Badge key={w} tone={countIn(w) ? 'info' : 'neutral'}>{w.slice(c.length + 1)} <span className="font-normal">· {countIn(w)}</span></Badge>)}</div></div>)}</div> : <p className="text-sm text-muted">No weight classes approved yet.</p>}
    </Section>

    <Section title="Competitors" sub="Age group uses the competition-year rule: event year minus year of birth.">
      <Table head={['Competitor', 'Age', 'Age group', 'Last weigh-in', 'Weight class', 'Status', '']} isEmpty={!rows.length} empty="No competitors registered yet. Use Register Competitors first.">
        {rows.map(({ b, cat, opts, cur, curOk, pend, eligible }) => <tr key={b.id} className={!eligible ? 'bg-maplesoft' : ''}>
          <Td className="font-semibold">{fullName(b)} <ClassBadge u={b} /><div className="text-xs font-normal text-muted">{b.membershipId}, {b.gender === 'F' ? 'Female' : 'Male'}, {b.club || '—'}</div></Td>
          <Td className="tabular-nums">{compAge(b, ev)}</Td>
          <Td>{cat || <span className="text-maple">Outside all age groups</span>}</Td>
          <Td className="tabular-nums">{lastWeight(data, b.id) ? lastWeight(data, b.id) + ' kg' : '—'}</Td>
          <Td><select className="field min-w-[170px] py-1.5" aria-label={'Weight class for ' + fullName(b)} value={cur} disabled={!eligible && !cur} onChange={e => setClass(b, e.target.value)}>
            <option value="">{eligible ? 'Choose a weight class…' : 'No approved class'}</option>
            {opts.map(w => <option key={w} value={w}>{w}</option>)}
            {cur && !opts.includes(cur) && <option value={cur}>{cur} (doesn’t match age group)</option>}
          </select></Td>
          <Td>{!eligible ? <Badge tone="bad">Ineligible for approved classes</Badge> : !curOk ? <Badge tone="warn">Class doesn’t match age group</Badge> : cur ? <Badge tone="ok">✓ Placed</Badge> : <Badge tone="warn">Not yet placed</Badge>}{pend && <div className="mt-1"><Badge tone="warn">Request pending: {pend.weightClass}</Badge></div>}</Td>
          <Td className="text-right">{!eligible && cat && !pend && <Btn size="sm" variant="primary" onClick={() => setReq({ category: cat, boxerIds: [b.id] })}>Request {cat}</Btn>}</Td>
        </tr>)}
      </Table>
    </Section>

    <Section title="Age group & weight class requests" sub={canDecideClass(viewer, ev) ? 'You can approve or deny these requests.' : `Approved by a ${PROVINCE_INFO[ev.province].ptso} PTSO Administrator or a Boxing Canada NSO Administrator.`}>
      <ClassRequestsTable items={reqs.slice().reverse().map(r => ({ ev, r }))} />
    </Section>
    {req && <ClassRequestModal ev={ev} category={req.category} boxerIds={req.boxerIds} onClose={() => setReq(null)} />}
  </div>;
}

function CompetitorManagerView({ eventId, onBack }) {
  const { data, update } = useApp();
  const ev = data.events.find(e => e.id === eventId);
  const [f, setF] = useState({ first: '', last: '', province: '', yob: '', club: '' });
  const [sort, setSort] = useState({ key: 'last', dir: 1 });
  const [selL, setSelL] = useState([]);
  const [selR, setSelR] = useState([]);
  const [over, setOver] = useState(null);
  const [msg, setMsg] = useState(null);
  if (!ev) return <Banner tone="bad">This event could not be found.</Banner>;
  const boxers = allBoxers(data);
  const inComp = new Set(ev.registeredBoxerIds);
  const val = (b, k) => k === 'first' ? b.firstName : k === 'last' ? b.lastName : k === 'province' ? b.province : k === 'yob' ? b.dob.slice(0, 4) : (b.club || '');
  const match = b => ['first', 'last', 'club'].every(k => val(b, k).toLowerCase().includes(f[k].trim().toLowerCase())) && (!f.province || b.province === f.province) && (!f.yob || val(b, 'yob') === f.yob);
  const sortFn = (a, b) => (val(a, sort.key).localeCompare(val(b, sort.key), 'en', { sensitivity: 'base' }) * sort.dir) || a.lastName.localeCompare(b.lastName);
  const pool = boxers.filter(b => !inComp.has(b.id));
  const left = pool.filter(match).sort(sortFn);
  const right = ev.registeredBoxerIds.map(id => getUser(data, id)).filter(Boolean).sort(sortFn);
  const years = [...new Set(boxers.map(b => b.dob.slice(0, 4)))].sort().reverse();
  const inBout = id => ev.bouts.some(bt => bt.redId === id || bt.blueId === id);
  const filtersOn = Object.values(f).some(Boolean);
  const add = ids => {
    const list = ids.filter(id => !inComp.has(id)); if (!list.length) return;
    update(d => { const x = d.events.find(e => e.id === eventId); list.forEach(id => { if (!x.registeredBoxerIds.includes(id)) x.registeredBoxerIds.push(id); }); });
    setSelL(s => s.filter(id => !list.includes(id)));
    setMsg({ tone: 'ok', text: list.length === 1 ? `${nameOf(data, list[0])} added to the competition.` : `${list.length} boxers added to the competition.` });
  };
  const remove = ids => {
    const blocked = ids.filter(inBout), ok = ids.filter(id => inComp.has(id) && !inBout(id));
    if (ok.length) update(d => { const x = d.events.find(e => e.id === eventId); x.registeredBoxerIds = x.registeredBoxerIds.filter(id => !ok.includes(id)); });
    setSelR(s => s.filter(id => !ok.includes(id)));
    const parts = [];
    if (ok.length) parts.push(ok.length === 1 ? `${nameOf(data, ok[0])} removed from the competition.` : `${ok.length} boxers removed from the competition.`);
    if (blocked.length) parts.push(`${blocked.map(id => nameOf(data, id)).join(', ')} ${blocked.length === 1 ? 'is' : 'are'} on the bout sheet, so ${blocked.length === 1 ? 'stays' : 'stay'} in the competition. Remove the bout first.`);
    setMsg({ tone: blocked.length ? 'warn' : 'ok', text: parts.join(' ') });
  };
  const toggle = (setSel, id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const onDragStart = (e, id, from) => {
    const sel = from === 'pool' ? selL : selR;
    const ids = sel.includes(id) ? sel : [id];
    e.dataTransfer.setData('text/plain', JSON.stringify({ ids, from }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const dropProps = target => ({
    onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== target) setOver(target); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); },
    onDrop: e => { e.preventDefault(); setOver(null); let p; try { p = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; } if (!p || p.from === target) return; target === 'comp' ? add(p.ids) : remove(p.ids); }
  });
  const SortHead = ({ k, label }) => <th className="px-2 py-2 text-xs font-semibold whitespace-nowrap"><button type="button" onClick={() => setSort(s => ({ key: k, dir: s.key === k ? -s.dir : 1 }))} className={cx('inline-flex items-center gap-1 hover:text-ink', sort.key === k ? 'text-ink' : '')}>{label}<span aria-hidden="true" className="text-[10px]">{sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span></button></th>;
  const List = ({ rows, side, sel, setSel }) => {
    const allOn = rows.length > 0 && rows.every(b => sel.includes(b.id));
    return <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="bg-sunk text-left text-muted"><tr>
        <th className="w-8 px-2 py-2"><input type="checkbox" className="h-4 w-4" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? [] : rows.map(b => b.id))} /></th>
        <SortHead k="first" label="First name" /><SortHead k="last" label="Last name" /><SortHead k="province" label="Prov." /><SortHead k="yob" label="Born" /><SortHead k="club" label="Club" />
        <th className="px-2 py-2 text-xs font-semibold">Eligibility</th><th className="w-10" />
      </tr></thead>
      <tbody className="divide-y divide-line">
        {rows.map(b => { const el = eligibility(data, b), on = sel.includes(b.id), locked = side === 'comp' && inBout(b.id); return <tr key={b.id} draggable onDragStart={e => onDragStart(e, b.id, side)} className={cx('cursor-grab active:cursor-grabbing', on ? 'bg-ropesoft' : 'hover:bg-sunk')}>
          <td className="px-2 py-1.5"><input type="checkbox" className="h-4 w-4" aria-label={'Select ' + fullName(b)} checked={on} onChange={() => toggle(setSel, b.id)} /></td>
          <td className="px-2 py-1.5 font-semibold">{b.firstName}</td><td className="px-2 py-1.5 font-semibold">{b.lastName}</td>
          <td className="px-2 py-1.5">{b.province}</td><td className="px-2 py-1.5 tabular-nums">{b.dob.slice(0, 4)}</td><td className="px-2 py-1.5">{b.club || '—'}</td>
          <td className="px-2 py-1.5"><Badge tone={el.tone}>{el.tone === 'ok' ? 'Eligible' : el.label}</Badge>{locked && <div className="mt-0.5 text-[11px] text-muted">On bout sheet</div>}</td>
          <td className="px-2 py-1.5 text-right">{side === 'pool'
            ? <Btn size="xs" variant="rope" aria-label={'Add ' + fullName(b) + ' to the competition'} title="Add to competition" onClick={() => add([b.id])}>→</Btn>
            : <Btn size="xs" aria-label={'Remove ' + fullName(b) + ' from the competition'} title={locked ? 'On the bout sheet' : 'Remove from competition'} disabled={locked} onClick={() => remove([b.id])}>←</Btn>}</td>
        </tr>; })}
      </tbody>
    </table></div>;
  };
  return <div className="space-y-4">
    <Btn size="sm" variant="ghost" onClick={onBack}>‹ Back to Competition Events</Btn>
    <header className="overflow-hidden rounded-lg border border-line bg-surface"><div className="rope-rule" /><div className="px-4 py-3"><p className="text-sm font-semibold text-muted">Register Competitors</p><h2 className="font-display text-2xl font-extrabold leading-tight">{ev.name}</h2><p className="text-sm text-muted">{fmtDate(ev.date)}, {ev.location}. Drag boxers between the lists, or select them and use the arrows.</p></div></header>
    {msg && <Banner tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Banner>}
    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <section {...dropProps('pool')} className={cx('rounded-lg border-2 bg-surface transition', over === 'pool' ? 'border-rope' : 'border-line')}>
        <div className="border-b border-line px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-lg font-bold">All Boxers</h3><span className="text-xs text-muted">{left.length} shown of {pool.length} not entered</span></div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input className="field py-1.5" placeholder="First name" aria-label="Filter by first name" value={f.first} onChange={e => setF(p => ({ ...p, first: e.target.value }))} />
            <input className="field py-1.5" placeholder="Last name" aria-label="Filter by last name" value={f.last} onChange={e => setF(p => ({ ...p, last: e.target.value }))} />
            <select className="field py-1.5" aria-label="Filter by province" value={f.province} onChange={e => setF(p => ({ ...p, province: e.target.value }))}><option value="">All provinces</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select className="field py-1.5" aria-label="Filter by year of birth" value={f.yob} onChange={e => setF(p => ({ ...p, yob: e.target.value }))}><option value="">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select>
            <input className="field col-span-2 py-1.5 sm:col-span-1" placeholder="Club" aria-label="Filter by club" value={f.club} onChange={e => setF(p => ({ ...p, club: e.target.value }))} />
          </div>
          {filtersOn && <button type="button" className="mt-1.5 text-xs font-semibold text-rope" onClick={() => setF({ first: '', last: '', province: '', yob: '', club: '' })}>Clear filters</button>}
        </div>
        {left.length ? <List rows={left} side="pool" sel={selL} setSel={setSelL} /> : <p className="px-3 py-6 text-center text-sm text-muted">{pool.length ? 'No boxers match these filters.' : 'Every boxer is already in this competition.'}</p>}
      </section>
      <div className="flex justify-center gap-2 xl:flex-col xl:pt-24">
        <Btn variant="rope" disabled={!selL.length} onClick={() => add(selL)} title="Add selected boxers">Add {selL.length || ''} →</Btn>
        <Btn disabled={!selR.length} onClick={() => remove(selR)} title="Remove selected competitors">← Remove {selR.length || ''}</Btn>
      </div>
      <section {...dropProps('comp')} className={cx('rounded-lg border-2 bg-surface transition', over === 'comp' ? 'border-maple' : 'border-line')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-3 py-2.5"><h3 className="font-display text-lg font-bold">Competitors</h3><span className="text-xs text-muted">{right.length} entered, {right.filter(b => eligibility(data, b).tone === 'ok').length} eligible</span></div>
        {right.length ? <List rows={right} side="comp" sel={selR} setSel={setSelR} /> : <p className="px-3 py-10 text-center text-sm text-muted">No competitors yet. Drag boxers here, or select them and press Add.</p>}
      </section>
    </div>
  </div>;
}
function EventsView() {
  const { data, viewer, nav, clearNav } = useApp();
  const [modal, setModal] = useState(null);
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState(() => new Set());
  const [openYears, setOpenYears] = useState(() => new Set());
  const [showRecent, setShowRecent] = useState(true);
  const [hl, setHl] = useState(null);
  const cutoff = (() => { const d = new Date(toUTC(REF_DATE)); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 10); })();
  useEffect(() => {
    if (nav.focusEventId) {
      const id = nav.focusEventId; const ev = data.events.find(e => e.id === id);
      setOpen(s => new Set([...s, id])); setHl(id); clearNav();
      if (ev && ev.date < cutoff) setOpenYears(s => new Set([...s, ev.date.slice(0, 4)]));
      if (ev && ev.date < REF_DATE && ev.date >= cutoff) setShowRecent(true);
      setTimeout(() => { const el = document.getElementById('event-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
      setTimeout(() => setHl(null), 2600);
    }
  }, [nav.focusEventId]);
  const [ringsideFor, setRingsideFor] = useState(null);
  const [rosterFor, setRosterFor] = useState(null);
  const [classesFor, setClassesFor] = useState(null);
  if (classesFor) return <ClassManagerView eventId={classesFor} onBack={() => { setClassesFor(null); window.scrollTo({ top: 0 }); }} />;
  if (rosterFor) return <CompetitorManagerView eventId={rosterFor} onBack={() => { setRosterFor(null); window.scrollTo({ top: 0 }); }} />;
  if (ringsideFor) return <MedicalConsoleView fixedEventId={ringsideFor} onBack={() => { setRingsideFor(null); window.scrollTo({ top: 0 }); }} />;
  let evs = data.events.slice();
  if (viewer.role === 'boxer') evs = evs.filter(e => e.registeredBoxerIds.includes(viewer.id));
  if (viewer.role === 'official' && mine) evs = evs.filter(e => e.officials.some(o => o.userId === viewer.id));
  const current = evs.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date));
  const recent = evs.filter(e => e.date < REF_DATE && e.date >= cutoff).sort((a, b) => b.date.localeCompare(a.date));
  const archived = evs.filter(e => e.date < cutoff).sort((a, b) => b.date.localeCompare(a.date));
  const years = [...new Set(archived.map(e => e.date.slice(0, 4)))].sort().reverse();
  const toggle = id => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setMany = (list, on) => setOpen(s => { const n = new Set(s); list.forEach(e => on ? n.add(e.id) : n.delete(e.id)); return n; });
  const card = ev => <EventCard key={ev.id} onClasses={id => { setClassesFor(id); window.scrollTo({ top: 0 }); }} onRoster={id => { setRosterFor(id); window.scrollTo({ top: 0 }); }} onRingside={id => { setRingsideFor(id); window.scrollTo({ top: 0 }); }} ev={ev} expanded={open.has(ev.id)} onToggle={() => toggle(ev.id)} highlight={hl === ev.id} setModal={setModal} />;
  const GroupHead = ({ title, sub, list, extra }) => <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-display text-xl font-bold">{title} <span className="text-base font-semibold text-muted">({list.length})</span></h3>{sub && <p className="text-xs text-muted">{sub}</p>}</div><div className="flex flex-wrap gap-1">{extra}{list.length > 0 && (list.some(e => open.has(e.id)) ? <Btn size="xs" variant="ghost" onClick={() => setMany(list, false)}>Collapse all</Btn> : <Btn size="xs" variant="ghost" onClick={() => setMany(list, true)}>Expand all</Btn>)}</div></div>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3">
      <p className="flex-1 text-sm text-muted">{viewer.role === 'boxer' ? 'Events you are entered in. Complete your 24-hour forms before each first pre-bout check.' : 'Sanctioned competition events, bout sheets and pre-bout readiness. Select an event to see its details.'}</p>
      {viewer.role === 'official' && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={mine} onChange={e => setMine(e.target.checked)} />Only events I’m assigned to</label>}
      {isAdmin(viewer) && <Btn variant="primary" onClick={() => setModal({ kind: 'create' })}>Create New Event</Btn>}
    </div>
    <section className="space-y-3">
      <GroupHead title={viewer.role === 'boxer' ? 'My Current and Upcoming Events' : 'Current and Upcoming Events'} sub={viewer.role === 'boxer' ? 'Only events you’re registered in, today and later, soonest first. To find other events, see the Calendar.' : 'Today and later, soonest first.'} list={current} />
      {current.length ? current.map(card) : <p className="text-sm text-muted">No current or upcoming events.</p>}
    </section>
    <section className="space-y-3">
      <GroupHead title={viewer.role === 'boxer' ? 'My Recently Completed Events' : 'Recently Completed Events'} sub={`${viewer.role === 'boxer' ? 'Events you were registered in, completed' : 'Completed'} in the last 3 months (since ${fmtDate(cutoff)}), most recent first.`} list={recent} extra={<Btn size="xs" variant="ghost" onClick={() => setShowRecent(v => !v)}>{showRecent ? 'Hide list' : 'Show list'}</Btn>} />
      {showRecent && (recent.length ? recent.map(card) : <p className="text-sm text-muted">No events completed in the last 3 months.</p>)}
    </section>
    <section className="space-y-3">
      <div><h3 className="font-display text-xl font-bold">Archive <span className="text-base font-semibold text-muted">({archived.length})</span></h3><p className="text-xs text-muted">{viewer.role === 'boxer' ? 'Your events' : 'Events'} completed more than 3 months ago move here automatically, grouped by year.</p></div>
      {years.length ? <div className="space-y-2">{years.map(y => { const list = archived.filter(e => e.date.startsWith(y)); const isOpen = openYears.has(y); return <div key={y} className="rounded-lg border border-line bg-surface">
        <button type="button" aria-expanded={isOpen} onClick={() => setOpenYears(s => { const n = new Set(s); n.has(y) ? n.delete(y) : n.add(y); return n; })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunk">
          <span className="font-display text-lg font-bold">{y} events</span><Badge>{list.length} event{list.length === 1 ? '' : 's'}</Badge>
          <span className="hidden text-xs text-muted sm:inline">{[...new Set(list.map(e => e.province))].sort().join(', ')}</span>
          <span className="ml-auto text-sm font-semibold text-muted">{isOpen ? 'Hide' : 'Show'}</span>
        </button>
        {isOpen && <div className="space-y-3 border-t border-line p-3">{list.map(card)}</div>}
      </div>; })}</div> : <p className="text-sm text-muted">Nothing archived yet.</p>}
    </section>
    {modal && modal.kind === 'create' && <CreateEventModal onClose={() => setModal(null)} />}
    {modal && modal.kind === 'pre' && <PreBoutQuestionnaireModal eventId={modal.eventId} boxerId={modal.boxerId} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'scat' && <ScatToolModal boxerId={modal.boxerId} contextDefault={modal.eventName ? `Competition requirement: ${modal.eventName}` : ''} onClose={() => setModal(null)} />}
  </div>;
}

/* =========================================================
   Ringside Medical Console
   ========================================================= */
function MedicalConsoleView({ fixedEventId, onBack }) {
  const { data, viewer } = useApp();
  const sorted = data.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  const defaultEv = sorted.find(isUpcoming) || sorted[sorted.length - 1];
  const [evId, setEvId] = useState(fixedEventId || (defaultEv ? defaultEv.id : ''));
  const [modal, setModal] = useState(null);
  const [recordId, setRecordId] = useState(null);
  if (recordId) return <RecordBook boxerId={recordId} onBack={() => setRecordId(null)} backLabel={fixedEventId ? 'Back to Pre-bout and Post-bout Medical Checks' : 'Back to Pre-bout and Post-bout Medical Checks'} />;
  const ev = data.events.find(e => e.id === evId);
  const rests = data.restPeriodExams.filter(r => !fixedEventId || !ev || ev.registeredBoxerIds.includes(r.boxerId) || r.eventId === ev.id).sort((a, b) => (restOpen(b) - restOpen(a)) || a.dueDate.localeCompare(b.dueDate));
  const examFor = (bid, type) => data.ringsideExams.filter(x => x.eventId === evId && x.boxerId === bid && x.type === type).pop();
  return <div className="space-y-5">
    {onBack && <Btn size="sm" variant="ghost" onClick={onBack}>‹ Back to Competition Events</Btn>}
    {fixedEventId && ev && <header className="overflow-hidden rounded-lg border border-line bg-surface"><div className="rope-rule" /><div className="px-4 py-3"><p className="text-sm font-semibold text-muted">Pre-bout and Post-bout Medical Checks</p><h2 className="font-display text-2xl font-extrabold leading-tight">{ev.name}</h2><p className="text-sm text-muted">{fmtDate(ev.date)}, {ev.location}. 1st pre-bout check {fmtDT(ev.firstPreBoutCheckDateTime)}</p></div></header>}
    <Section title="Ringside Pre-Bout & Post-Bout Examinations" actions={fixedEventId ? null : <select className="field w-auto max-w-full" value={evId} onChange={e => setEvId(e.target.value)} aria-label="Event">{sorted.map(e => <option key={e.id} value={e.id}>{fmtDate(e.date)}, {e.name}</option>)}</select>}>
      {ev ? <Table head={['Boxer', 'Eligibility', '24h forms', 'Pre-bout', 'Post-bout', '']} isEmpty={!ev.registeredBoxerIds.length} empty="No competitors registered for this event.">
        {ev.registeredBoxerIds.map(id => getUser(data, id)).filter(Boolean).map(b => { const pre = examFor(b.id, 'pre'), post = examFor(b.id, 'post'), s = qStatus(data, ev, b), el = eligibility(data, b); return <tr key={b.id}>
          <Td className="font-semibold">{fullName(b)}<div className="text-xs font-normal text-muted">{b.membershipId}</div></Td>
          <Td><Badge tone={el.tone}>{el.label}</Badge><div className="mt-1"><ScatBadge u={b} withDate /></div></Td><Td><Check ok={s.complete} labelYes="Complete" labelNo="Incomplete" /></Td>
          <Td>{pre ? <Badge tone={pre.outcome === 'cleared' ? 'ok' : 'bad'}>{pre.outcome === 'cleared' ? '✓ Cleared' : 'Not cleared'} · {pre.bp}</Badge> : canClinical(viewer) ? <Btn size="sm" variant="primary" onClick={() => setModal({ kind: 'exam', type: 'pre', boxerId: b.id })}>Record Pre-Bout</Btn> : <Badge>Pending</Badge>}</Td>
          <Td>{post ? <Badge tone={post.restDays ? 'warn' : 'ok'}>{post.restDays ? `${post.restDays}-day rest` : '✓ No rest'}</Badge> : canClinical(viewer) ? <Btn size="sm" onClick={() => setModal({ kind: 'exam', type: 'post', boxerId: b.id })}>Record Post-Bout</Btn> : <Badge>Pending</Badge>}</Td>
          <Td className="text-right"><Btn size="sm" variant="ghost" onClick={() => setRecordId(b.id)}>Record Book</Btn></Td></tr>; })}
      </Table> : <p className="text-sm text-muted">No events yet.</p>}
    </Section>
    <Section title="Mandatory Rest Periods & Post-Rest Recovery Clearances" sub="Rest periods created from post-bout examinations. Sign the recovery clearance to restore eligibility.">
      <Table head={['Boxer', 'Source event', 'Rest', 'Exam due', 'Status', '']} isEmpty={!rests.length} empty="No rest periods on record.">
        {rests.map(r => { const st = getRestExamStatusForCoachAndAdmin(r), ev2 = data.events.find(e => e.id === r.eventId); return <tr key={r.id}>
          <Td className="font-semibold">{nameOf(data, r.boxerId)}</Td><Td>{ev2 ? ev2.name : '—'}</Td><Td>{r.days} days from {fmtDate(r.startDate)}</Td><Td className="whitespace-nowrap">{fmtDate(r.dueDate)}</Td>
          <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
          <Td className="text-right"><Btn size="sm" variant={!r.completed && canClinical(viewer) ? 'primary' : 'secondary'} onClick={() => setModal({ kind: 'rest', id: r.id })}>{!r.completed && canClinical(viewer) ? 'Complete Clearance' : 'View'}</Btn></Td></tr>; })}
      </Table>
    </Section>
    {modal && modal.kind === 'exam' && <RingsideExamModal eventId={evId} boxerId={modal.boxerId} type={modal.type} onClose={() => setModal(null)} />}
    {modal && modal.kind === 'rest' && <RestClearanceModal restId={modal.id} onClose={() => setModal(null)} />}
  </div>;
}

/* =========================================================
   PTSO logo manager
   ========================================================= */
function logoFor(data, prov, slot) { const up = data.logos[prov] && data.logos[prov][slot]; return up ? { url: up.dataUrl, name: up.fileName, uploaded: true } : { url: svgDataUrl(logoSvg(prov, slot)), name: `${prov.toLowerCase()}-${slot}.svg`, uploaded: false }; }
async function downloadLogo(data, prov, slot, notify) {
  const up = data.logos[prov] && data.logos[prov][slot];
  const r = up ? await saveFile(up.fileName, dataUrlToBlob(up.dataUrl)) : await saveFile(`${prov.toLowerCase()}-${slot}.svg`, logoSvg(prov, slot));
  notify(r.msg, r.ok ? 'ok' : 'warn');
}
function LogoSlotCard({ prov, slot, manage }) {
  const { data, update, notify } = useApp();
  const ref = useRef(null);
  const l = logoFor(data, prov, slot.key);
  const onFile = async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 1500000) { notify('Logo files must be under 1.5 MB.', 'bad'); return; } const url = await readFileAsDataUrl(f); update(d => { d.logos[prov] = d.logos[prov] || {}; d.logos[prov][slot.key] = { dataUrl: url, fileName: f.name, uploadedAt: nowIso() }; }); notify(`${f.name} uploaded for ${PROVINCE_INFO[prov].name}.`); e.target.value = ''; };
  const simulate = () => { update(d => { d.logos[prov] = d.logos[prov] || {}; d.logos[prov][slot.key] = { dataUrl: svgDataUrl(logoSvg(prov, slot.key)), fileName: `${prov.toLowerCase()}-${slot.key}-official.svg`, uploadedAt: nowIso(), simulated: true }; }); notify('Simulated upload saved.'); };
  return <div className="rounded-md border border-line p-2">
    <div className="flex h-20 items-center justify-center rounded border border-dashed border-line bg-[repeating-conic-gradient(#e5e7eb_0_25%,#f8fafc_0_50%)] bg-[length:14px_14px]"><img src={l.url} alt={slot.label} className="max-h-full max-w-full object-contain" /></div>
    <div className="mt-2 text-xs font-semibold">{slot.label}</div>
    <div className="mt-1"><Badge tone={l.uploaded ? 'ok' : 'neutral'}>{l.uploaded ? 'Official file on file' : 'Placeholder'}</Badge></div>
    <div className="mt-2 flex flex-wrap gap-1">
      <Btn size="xs" onClick={() => downloadLogo(data, prov, slot.key, notify)}>Download</Btn>
      {manage && <><Btn size="xs" onClick={() => ref.current.click()}>Upload</Btn><Btn size="xs" variant="ghost" onClick={simulate}>Simulate upload</Btn>
        {l.uploaded && <Btn size="xs" variant="ghost" onClick={() => update(d => { delete d.logos[prov][slot.key]; })}>Remove</Btn>}
        <input ref={ref} type="file" accept="image/*,.svg" className="hidden" onChange={onFile} /></>}
    </div>
  </div>;
}
function PtsoLogoManagerModal({ onClose }) {
  const { viewer } = useApp();
  const [prov, setProv] = useState(viewer.province || 'ON');
  return <Modal size="xl" title="PTSO & Provincial Logo Manager" subtitle="Five official logo slots per province or territory, used in sanction promotion materials." onClose={onClose}>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <select className="field max-w-xs" value={prov} disabled={viewer.role === 'ptso'} onChange={e => setProv(e.target.value)} aria-label="Province">{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}, {PROVINCE_INFO[c].ptso}</option>)}</select>
      {viewer.role === 'ptso' && <span className="text-xs text-muted">PTSO Administrators manage their own province’s logos.</span>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{LOGO_SLOTS.map(sl => <LogoSlotCard key={sl.key} prov={prov} slot={sl} manage />)}</div>
  </Modal>;
}

/* =========================================================
   Sanction wizard
   ========================================================= */
function SignatureRow({ value, onChange, disabled, label }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <Field label={`${label} first name`} required><input className="field" readOnly={disabled} value={value.first} onChange={e => onChange({ ...value, first: e.target.value })} /></Field>
    <Field label={`${label} last name`} required><input className="field" readOnly={disabled} value={value.last} onChange={e => onChange({ ...value, last: e.target.value })} /></Field>
    <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#C8102E]" disabled={disabled} checked={value.agreed} onChange={e => onChange({ ...value, agreed: e.target.checked })} /><span>I have read and agree to the terms above, and my typed name is my digital signature.</span></label>
  </div>;
}
const STEPS = ['Member Club Responsibilities', 'Agreement & Statutory Compliance', 'Event Promotion & Logos', 'Club, Venue, Physician & Categories'];
function SanctionWizardModal({ initial, onClose, startStep = 1 }) {
  const { data, update, viewer, notify } = useApp();
  const [s, setS] = useState(() => structuredClone(initial));
  const [step, setStep] = useState(startStep);
  const [err, setErr] = useState([]);
  const [msg, setMsg] = useState('');
  const mineOrAdmin = s.requestedByUserId === viewer.id || isAdmin(viewer);
  const editable = (s.status === 'draft' && mineOrAdmin) || viewer.role === 'nsoadmin';
  const officeEditable = isAdmin(viewer);
  const meta = getSanctionTargetMeta(s.type, s.province);
  const setI = (k, v) => setS(p => ({ ...p, info: { ...p.info, [k]: v } }));
  const setPhys = (k, v) => setS(p => ({ ...p, info: { ...p.info, physician: { ...p.info.physician, [k]: v } } }));
  const setO = (k, v) => setS(p => ({ ...p, office: { ...p.office, [k]: v } }));
  const persist = (rec) => update(d => { const i = d.sanctions.findIndex(x => x.id === rec.id); if (i >= 0) d.sanctions[i] = rec; else d.sanctions.push(rec); });
  const validate = () => {
    const e = []; const I = s.info;
    if (!s.part1.first.trim() || !s.part1.last.trim() || !s.part1.agreed) e.push([1, 'Part 1 signature and agreement']);
    if (!s.part2.first.trim() || !s.part2.last.trim() || !s.part2.agreed) e.push([2, 'Part 2 signature and agreement']);
    if (!s.promoAck) e.push([3, 'Promotion acknowledgment']);
    [['region', 'Region'], ['club', 'Member club'], ['eventName', 'Event name'], ['date', 'Proposed date'], ['firstBoutTime', 'Time of first bout'], ['venueName', 'Venue name'], ['venueAddress', 'Venue address'], ['hostName', 'Host contact'], ['hospital', 'Closest 24hr emergency hospital'], ['hospitalKm', 'Hospital distance']].forEach(([k, l]) => { if (!String(I[k] || '').trim()) e.push([4, l]); });
    if (I.anticipated === 'over12' && !I.overExplanation.trim()) e.push([4, 'Explanation for more than 12 bouts']);
    if (!I.physician.name.trim() || !I.physician.license.trim()) e.push([4, 'Club show physician name and license #']);
    if (!I.weightClasses.length) e.push([4, 'At least one contested weight class']);
    return e;
  };
  const saveDraft = () => { persist(s); setErr([]); setMsg(s.status === 'draft' ? 'Draft saved. You can come back to it from Event Sanction Requests.' : 'Changes saved. The request keeps its current status.'); };
  const submit = () => {
    const e = validate(); if (e.length) { setErr(e); setStep(e[0][0]); return; }
    const rec = { ...s, status: 'submitted', submittedAt: nowIso() }; persist(rec);
    notify(`Sanction request “${s.info.eventName}” submitted to ${meta.org}.`); onClose();
  };
  const saveOffice = () => { update(d => { const x = d.sanctions.find(y => y.id === s.id); if (x) x.office = s.office; }); setMsg('Office use section saved.'); };
  const onPoster = async e => { const f = e.target.files[0]; if (!f) return; const url = f.size < 900000 && f.type.startsWith('image') ? await readFileAsDataUrl(f) : ''; setS(p => ({ ...p, info: { ...p.info, posterName: f.name, posterData: url } })); };
  const changeTarget = (type, prov) => setS(p => { const keep = PROVINCE_INFO[prov].clubs.some(c => c[1] === p.info.club); return { ...p, type, province: prov, info: { ...p.info, region: keep ? p.info.region : '', club: keep ? p.info.club : '' } }; });
  const ro = !editable;
  const part1 = [
    `The member club is in good standing with ${meta.ptso} and Boxing Canada for the current season, and all club personnel working the event hold current memberships.`,
    'Every participating boxer will present a valid Digital Competitor Record Book and a current Annual Medical Examination at weigh-in. Boxers without both will not compete.',
    'The club will provide a regulation ring, ring-side tables, approved gloves and headguards, and a private, heated medical examination area.',
    'A licensed club show physician will be present from the first pre-bout check until the final post-bout examination is signed.',
    'The club will arrange ambulance access and confirm the route to the closest 24-hour emergency hospital before the first bout.',
    `Officials are assigned by ${meta.org}. The club pays all sanction, officiating and insurance fees before the event.`,
    'The club will submit bout results and any injury reports within 72 hours of the event.',
    'All participants and volunteers will follow the Universal Code of Conduct to Prevent and Address Maltreatment in Sport, anti-doping rules and Boxing Canada competition rules.'
  ];
  const part2 = [
    `Insurance: the event is covered by the ${meta.org} member insurance program only while this sanction is valid and all participants are registered members.`,
    'Eligibility: only registered members whose Digital Competitor Record Books show them eligible to compete may box. Boxers on mandatory rest may not compete until a Post-Rest Recovery Clearance is signed.',
    `Liquor: if alcohol is served or sold, the club will obtain the required permit from the ${meta.liquor} and display it at the venue.`,
    `Gaming and raffles: any raffle, 50/50 draw or gaming activity requires a licence from the ${meta.gaming}.`,
    `Combative sport legislation: the club will comply with ${meta.combative}, and with all municipal bylaws.`,
    `Medical: the club show physician is licensed to practise by the ${meta.college}.`,
    `${meta.org} may withdraw this sanction at any time if these terms are not met, and the club indemnifies ${meta.org} and Boxing Canada against claims arising from its breach.`
  ];
  const clubsInRegion = meta.clubs.filter(c => !s.info.region || c[0] === s.info.region);
  const Clauses = ({ items }) => <ol className="max-w-prose list-decimal space-y-2 pl-5 text-sm leading-relaxed">{items.map((c, i) => <li key={i}>{c}</li>)}</ol>;
  return <Modal size="xl" title={s.status === 'draft' ? 'Sanction Application' : 'Sanction Request'} subtitle={`${meta.orgLong}, ${meta.provName}. Contact ${meta.email}`} onClose={onClose}
    footer={<>
      <span className="mr-auto"><SanctionStatus s={s} /></span>
      {step > 1 && <Btn onClick={() => setStep(step - 1)}>Back</Btn>}
      {step < 4 && <Btn variant="rope" onClick={() => setStep(step + 1)}>Next step</Btn>}
      {editable && <Btn onClick={saveDraft}>{s.status === 'draft' ? 'Save draft' : 'Save changes'}</Btn>}
      {editable && s.status === 'draft' && step === 4 && <Btn variant="primary" onClick={submit}>Submit for approval</Btn>}
    </>}>
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sanction type"><div className="inline-flex rounded-md border border-line p-0.5">{[['PTSO', 'PTSO (Provincial)'], ['NSO', 'NSO (Boxing Canada)']].map(([k, l]) => <button key={k} type="button" disabled={ro} onClick={() => changeTarget(k, s.province)} className={cx('rounded px-3 py-1 text-sm font-semibold disabled:cursor-not-allowed', s.type === k ? 'bg-maple text-white' : 'text-muted hover:bg-sunk')}>{l}</button>)}</div></Field>
        <Field label="Host province or territory"><select className="field" disabled={ro} value={s.province} onChange={e => changeTarget(s.type, e.target.value)}>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></Field>
      </div>
      <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4">{STEPS.map((l, i) => <li key={l}><button type="button" onClick={() => setStep(i + 1)} aria-current={step === i + 1 ? 'step' : undefined} className={cx('w-full rounded-md border px-2 py-1.5 text-left text-xs font-semibold leading-tight', step === i + 1 ? 'border-maple bg-maplesoft text-maple' : 'border-line text-muted hover:bg-sunk')}>Step {i + 1}<span className="block font-normal">{l}</span></button></li>)}</ol>
      {msg && <Banner tone="ok" onClose={() => setMsg('')}>{msg}</Banner>}
      {err.length > 0 && <Banner tone="bad" onClose={() => setErr([])}>Complete these before submitting: {err.map(x => `${x[1]} (step ${x[0]})`).join('; ')}.</Banner>}
      {s.status === 'denied' && s.denialReason && <Banner tone="bad">Denied: {s.denialReason}</Banner>}
      {s.status === 'approved' && <Banner tone="ok">Approved {fmtStamp(s.decidedAt)} by {nameOf(data, s.decidedBy)}. A Competition Event was created automatically.</Banner>}

      {step === 1 && <div className="space-y-4"><h4 className="font-display text-lg font-bold">Part 1: Member Club Responsibilities</h4><Clauses items={part1} /><SignatureRow label="Club President or Coach" disabled={ro} value={s.part1} onChange={v => setS(p => ({ ...p, part1: v }))} /></div>}
      {step === 2 && <div className="space-y-4"><h4 className="font-display text-lg font-bold">Part 2: Agreement with {meta.org} & Statutory Compliance</h4><Clauses items={part2} /><SignatureRow label="Club President or Coach" disabled={ro} value={s.part2} onChange={v => setS(p => ({ ...p, part2: v }))} /></div>}
      {step === 3 && <div className="space-y-4">
        <h4 className="font-display text-lg font-bold">Event Promotion & Official Logos</h4>
        <p className="max-w-prose text-sm">Every poster, program, web page and social post for this event must carry both statements below, along with the official logos.</p>
        <div className="space-y-2">
          <blockquote className="rounded-md border-l-4 border-maple bg-sunk px-3 py-2 text-sm font-semibold">This event is sanctioned by {meta.org}{s.type === 'PTSO' ? ', a member of Boxing Canada' : ''}.</blockquote>
          <blockquote className="rounded-md border-l-4 border-rope bg-sunk px-3 py-2 text-sm font-semibold">{s.type === 'NSO' ? 'Boxing Canada acknowledges the support of the Government of Canada.' : `${meta.org} acknowledges the support of the Government of ${meta.provName} and the Government of Canada.`}</blockquote>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{LOGO_SLOTS.map(sl => <LogoSlotCard key={sl.key} prov={s.province} slot={sl} manage={false} />)}</div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#C8102E]" disabled={ro} checked={s.promoAck} onChange={e => setS(p => ({ ...p, promoAck: e.target.checked }))} /><span>I will use the statements and official logos above on all promotional material for this event.</span></label>
      </div>}
      {step === 4 && <div className="space-y-5">
        <div><h4 className="mb-2 font-display text-lg font-bold">Club information</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Region" required><select className="field" disabled={ro} value={s.info.region} onChange={e => setS(p => ({ ...p, info: { ...p.info, region: e.target.value, club: '' } }))}><option value="">Select a region…</option>{meta.regions.map(r => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Member club" required><select className="field" disabled={ro} value={s.info.club} onChange={e => setI('club', e.target.value)}><option value="">Select a club…</option>{clubsInRegion.map(c => <option key={c[1]}>{c[1]}</option>)}</select></Field>
            <Field label="Event name" required><input className="field" readOnly={ro} value={s.info.eventName} onChange={e => setI('eventName', e.target.value)} /></Field>
            <Field label="Event poster"><div className="flex items-center gap-2">{!ro && <input type="file" accept="image/*,application/pdf" onChange={onPoster} className="text-sm" />}{s.info.posterName && <Badge tone="info">{s.info.posterName}</Badge>}</div></Field>
            {s.info.posterData && <img src={s.info.posterData} alt="Event poster" className="max-h-40 rounded border border-line sm:col-span-2" />}
          </div></div>
        <div><h4 className="mb-2 font-display text-lg font-bold">Sanction venue</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Proposed date" required><input type="date" className="field" readOnly={ro} value={s.info.date} onChange={e => setI('date', e.target.value)} /></Field>
            <Field label="Time of first bout" required><input type="time" className="field" readOnly={ro} value={s.info.firstBoutTime} onChange={e => setI('firstBoutTime', e.target.value)} /></Field>
            <Field label="Venue name" required><input className="field" readOnly={ro} value={s.info.venueName} onChange={e => setI('venueName', e.target.value)} /></Field>
            <Field label="Venue address" required className="sm:col-span-3"><input className="field" readOnly={ro} value={s.info.venueAddress} onChange={e => setI('venueAddress', e.target.value)} /></Field>
            <Field label="Livestream link (optional)" className="sm:col-span-3" hint="Where people can watch the event online, for example a YouTube, Facebook or Twitch page. You can add or change it later."><input type="url" className="field" readOnly={ro} placeholder="https://" value={s.info.livestreamUrl || ''} onChange={e => setI('livestreamUrl', e.target.value)} /></Field>
            <Field label="Host contact name" required><input className="field" readOnly={ro} value={s.info.hostName} onChange={e => setI('hostName', e.target.value)} /></Field>
            <Field label="Host phone"><input className="field" readOnly={ro} value={s.info.hostPhone} onChange={e => setI('hostPhone', e.target.value)} /></Field>
            <Field label="Host email"><input type="email" className="field" readOnly={ro} value={s.info.hostEmail} onChange={e => setI('hostEmail', e.target.value)} /></Field>
            <Field label="Closest 24hr emergency hospital" required className="sm:col-span-2"><input className="field" readOnly={ro} value={s.info.hospital} onChange={e => setI('hospital', e.target.value)} /></Field>
            <Field label="Distance (km)" required><input className="field" inputMode="decimal" readOnly={ro} value={s.info.hospitalKm} onChange={e => setI('hospitalKm', e.target.value)} /></Field>
            <Field label="Anticipated bouts"><select className="field" disabled={ro} value={s.info.anticipated} onChange={e => setI('anticipated', e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}<option value="over12">Over 12</option></select></Field>
            {s.info.anticipated === 'over12' && <Field label="Explain why more than 12 bouts" required className="sm:col-span-2"><textarea rows={2} className="field" readOnly={ro} value={s.info.overExplanation} onChange={e => setI('overExplanation', e.target.value)} /></Field>}
            <Field label="Ring supplier"><input className="field" readOnly={ro} value={s.info.ringSupplier} onChange={e => setI('ringSupplier', e.target.value)} /></Field>
            <Field label="International boxers competing"><YesNo disabled={ro} value={s.info.international ? 'yes' : 'no'} onChange={v => setI('international', v === 'yes')} /></Field>
            <Field label="Glove rental required"><YesNo disabled={ro} value={s.info.gloveRental ? 'yes' : 'no'} onChange={v => setI('gloveRental', v === 'yes')} /></Field>
            <Field label="Require a recent SCAT6 concussion screening to compete?" className="sm:col-span-2" hint="Optional. Boxers entered in the event will be asked to complete the Boxing Canada SCAT6 Online screening within the chosen number of days before the event."><div className="flex flex-wrap items-center gap-3"><YesNo disabled={ro} value={s.info.scatRequired ? 'yes' : 'no'} onChange={v => setI('scatRequired', v === 'yes')} />{s.info.scatRequired && <label className="flex items-center gap-2 text-sm">within<select className="field w-auto py-1" disabled={ro} value={s.info.scatWithinDays || 30} onChange={e => setI('scatWithinDays', Number(e.target.value))}>{SCAT_WINDOW_CHOICES.map(n => <option key={n} value={n}>{n} days</option>)}</select>before the event</label>}</div></Field>
          </div></div>
        <div><h4 className="mb-2 font-display text-lg font-bold">Club show physician</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Physician name" required><input className="field" readOnly={ro} value={s.info.physician.name} onChange={e => setPhys('name', e.target.value)} /></Field>
            <Field label="License #" required hint={`Licensed by the ${meta.college}`}><input className="field" readOnly={ro} value={s.info.physician.license} onChange={e => setPhys('license', e.target.value)} /></Field>
            <Field label="Phone"><input className="field" readOnly={ro} value={s.info.physician.phone} onChange={e => setPhys('phone', e.target.value)} /></Field>
            <Field label="Email"><input type="email" className="field" readOnly={ro} value={s.info.physician.email} onChange={e => setPhys('email', e.target.value)} /></Field>
          </div></div>
        <div><h4 className="mb-2 font-display text-lg font-bold">Contested categories & weights</h4><WeightPicker disabled={ro} value={s.info.weightClasses} onChange={v => setI('weightClasses', v)} /></div>
        <div className="rounded-md border-2 border-dashed border-line p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-lg font-bold">Office use only</h4>{officeEditable ? <Btn size="sm" variant="rope" onClick={saveOffice}>Save office use section</Btn> : <Badge>Completed by PTSO or Boxing Canada administrators</Badge>}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Results upload"><div className="flex items-center gap-2">{officeEditable && <input type="file" className="text-sm" onChange={e => e.target.files[0] && setO('resultsName', e.target.files[0].name)} />}{s.office.resultsName && <Badge tone="info">{s.office.resultsName}</Badge>}</div></Field>
            <Field label="Injuries reported"><YesNo disabled={!officeEditable} value={s.office.injuries} onChange={v => setO('injuries', v)} expect="no" /></Field>
            <Field label="Injury report upload"><div className="flex items-center gap-2">{officeEditable && <input type="file" className="text-sm" onChange={e => e.target.files[0] && setO('injuryReportName', e.target.files[0].name)} />}{s.office.injuryReportName && <Badge tone="info">{s.office.injuryReportName}</Badge>}</div></Field>
            <Field label="Additional information"><textarea rows={2} className="field" readOnly={!officeEditable} value={s.office.additional} onChange={e => setO('additional', e.target.value)} /></Field>
          </div>
        </div>
      </div>}
    </div>
  </Modal>;
}
function DenyModal({ s, onClose }) {
  const { update, viewer, notify } = useApp();
  const [reason, setReason] = useState(''); const [err, setErr] = useState('');
  return <Modal size="md" title="Deny Sanction Request" subtitle={s.info.eventName} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="danger" onClick={() => { if (!reason.trim()) { setErr('Give the club a reason so they can fix and resubmit.'); return; } update(d => { const x = d.sanctions.find(y => y.id === s.id); Object.assign(x, { status: 'denied', denialReason: reason.trim(), decidedAt: nowIso(), decidedBy: viewer.id }); }); notify(`Sanction request “${s.info.eventName}” denied.`, 'warn'); onClose(); }}>Deny request</Btn></>}>
    {err && <Banner tone="bad" className="mb-3">{err}</Banner>}
    <Field label="Reason shared with the requester" required><textarea rows={4} className="field" value={reason} onChange={e => setReason(e.target.value)} /></Field>
  </Modal>;
}
function SanctionSystemView() {
  const { data, update, viewer, notify, nav, clearNav, go } = useApp();
  const [wizard, setWizard] = useState(null);
  const [deny, setDeny] = useState(null);
  const [logos, setLogos] = useState(false);
  const [filter, setFilter] = useState('all');
  const admin = isAdmin(viewer);
  useEffect(() => {
    if (nav.openSanctionId) { const s = data.sanctions.find(x => x.id === nav.openSanctionId); if (s) setWizard(s); clearNav(); }
    else if (nav.newSanction) { setWizard(blankSanction(viewer)); clearNav(); }
  }, [nav.openSanctionId, nav.newSanction]);
  const visible = data.sanctions.filter(s => admin ? s.status !== 'draft' || s.requestedByUserId === viewer.id : s.requestedByUserId === viewer.id);
  const list = visible.filter(s => filter === 'all' || s.status === filter).sort((a, b) => (b.submittedAt || b.createdAt).localeCompare(a.submittedAt || a.createdAt));
  const canApprove = s => s.status === 'submitted' && (s.type === 'PTSO' ? ((viewer.role === 'ptso' && viewer.province === s.province) || viewer.role === 'nsoadmin') : viewer.role === 'nsoadmin');
  const approve = s => {
    const evId = uid('e');
    const [h, m] = (s.info.firstBoutTime || '13:00').split(':').map(Number);
    const pre = String(Math.max(0, h - 3)).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0');
    update(d => {
      const x = d.sanctions.find(y => y.id === s.id);
      Object.assign(x, { status: 'approved', decidedAt: nowIso(), decidedBy: viewer.id, eventId: evId });
      const phys = d.users.find(u => u.role === 'medical' && x.info.physician.name.includes(u.lastName));
      d.events.push({ id: evId, name: x.info.eventName, province: x.province, date: x.info.date, firstPreBoutCheckDateTime: x.info.date + 'T' + pre, firstBoutTime: x.info.firstBoutTime, location: `${x.info.venueName}, ${x.info.venueAddress}`, livestreamUrl: x.info.livestreamUrl ? normUrl(x.info.livestreamUrl.trim()) : '', scatRequired: !!x.info.scatRequired, scatWithinDays: Number(x.info.scatWithinDays) || 30, weightClasses: x.info.weightClasses.slice(), registeredBoxerIds: [], officials: [], physicianIds: phys ? [phys.id] : [], bouts: [], sanctionId: x.id });
    });
    notify(`Sanction approved. “${s.info.eventName}” is now a Competition Event.`, 'ok', { label: 'Open event', fn: () => go('EVENTS', { focusEventId: evId }) });
  };
  const counts = { all: visible.length, submitted: visible.filter(s => s.status === 'submitted').length, approved: visible.filter(s => s.status === 'approved').length, denied: visible.filter(s => s.status === 'denied').length, draft: visible.filter(s => s.status === 'draft').length };
  return <div className="space-y-4">
    <Section logo title={admin ? (viewer.role === 'ptso' ? `${PROVINCE_INFO[viewer.province].ptso} Sanction Approvals` : 'National Sanction Approvals') : 'Your Event Sanction Requests'}
      sub={admin ? (viewer.role === 'ptso' ? 'You approve PTSO requests for your province. NSO requests go to Boxing Canada.' : 'You approve NSO (Boxing Canada) requests and oversee all PTSO requests.') : 'Only requests you submitted are shown here.'}
      actions={<div className="flex flex-wrap gap-2">{admin && <Btn onClick={() => setLogos(true)}>Logo manager</Btn>}<Btn variant="primary" onClick={() => setWizard(blankSanction(viewer))}>New Sanction Request</Btn></div>}>
      <div className="mb-3 flex flex-wrap gap-1">{[['all', 'All'], ['submitted', 'Pending'], ['approved', 'Approved'], ['denied', 'Denied'], ['draft', 'Drafts']].map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={cx('rounded-md border px-3 py-1 text-xs font-semibold', filter === k ? 'border-rope bg-ropesoft text-rope' : 'border-line text-muted hover:bg-sunk')}>{l} ({counts[k]})</button>)}</div>
      <Table head={['Event', 'Type', 'Host', 'Proposed date', 'Requested by', 'Status', '']} isEmpty={!list.length} empty="No sanction requests here. Start one with New Sanction Request.">
        {list.map(s => { const u = getUser(data, s.requestedByUserId); return <tr key={s.id}>
          <Td className="font-semibold">{s.info.eventName || 'Untitled request'}<div className="text-xs font-normal text-muted">{s.info.club || '—'}</div></Td>
          <Td><Badge tone={s.type === 'NSO' ? 'bad' : 'info'}>{s.type === 'NSO' ? '🍁 NSO' : 'PTSO'}</Badge></Td><Td>{s.province}</Td><Td className="whitespace-nowrap">{fmtDate(s.info.date)}</Td>
          <Td>{u ? <><span aria-hidden="true">{ROLES[u.role].emoji}</span> {fullName(u)}</> : '—'}</Td>
          <Td><SanctionStatus s={s} />{s.status === 'submitted' && s.type === 'NSO' && viewer.role === 'ptso' && <div className="mt-1 text-xs text-muted">Awaiting Boxing Canada</div>}</Td>
          <Td><div className="flex flex-wrap justify-end gap-1.5">
            <Btn size="sm" onClick={() => setWizard(s)}>{s.status === 'draft' && s.requestedByUserId === viewer.id ? 'Continue' : 'Inspect'}</Btn>
            {canApprove(s) && <><Btn size="sm" variant="ok" onClick={() => approve(s)}>Approve & Create Event</Btn><Btn size="sm" variant="danger" onClick={() => setDeny(s)}>Deny</Btn></>}
            {s.status === 'approved' && s.eventId && <Btn size="sm" variant="rope" onClick={() => go('EVENTS', { focusEventId: s.eventId })}>Open Event</Btn>}
          </div></Td></tr>; })}
      </Table>
    </Section>
    {admin && <ClassRequestsSection />}
    {wizard && <SanctionWizardModal key={wizard.id} initial={wizard} onClose={() => setWizard(null)} />}
    {deny && <DenyModal s={deny} onClose={() => setDeny(null)} />}
    {logos && <PtsoLogoManagerModal onClose={() => setLogos(false)} />}
  </div>;
}

/* =========================================================
   National Member Directory & approvals
   ========================================================= */
function UsersView() {
  const { data, update, notify, viewer } = useApp();
  const [role, setRole] = useState(''); const [prov, setProv] = useState(''); const [q, setQ] = useState(''); const [stat, setStat] = useState('');
  const [limit, setLimit] = useState(50);
  const [recordId, setRecordId] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [editUser, setEditUser] = useState(null);
  if (recordId) return <RecordBook boxerId={recordId} onBack={() => setRecordId(null)} backLabel="Back to Members & Approvals" />;
  const pending = data.users.filter(u => u.status === 'pending');
  const scopeProv = viewer.role === 'ptso' ? viewer.province : '';
  const scoped = data.users.filter(u => u.status !== 'pending' && (!scopeProv || u.province === scopeProv));
  const term = q.trim().toLowerCase();
  const searching = term.length >= 2 || role || prov || stat;
  const list = !searching ? [] : scoped.filter(u => (!role || u.role === role) && (!prov || u.province === prov) && (!stat || u.status === stat) && (!term || (fullName(u) + ' ' + u.membershipId + ' ' + u.email + ' ' + (u.club || '') + ' ' + (trackieOf(u)['MEMBER #'] || '') + ' ' + nccpOf(u)).toLowerCase().includes(term))).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const roleCounts = Object.keys(ROLES).map(k => [k, scoped.filter(u => u.role === k && u.status === 'approved').length]).filter(x => x[1]);
  const setStatus = (u, status) => { update(d => { d.users.find(x => x.id === u.id).status = status; }); notify(status === 'approved' ? `${fullName(u)} approved. They can now sign in.` : `${fullName(u)}’s registration declined.`, status === 'approved' ? 'ok' : 'warn'); };
  return <div className="space-y-5">
    {viewer.role === 'nsoadmin' && <NationalTeamSection onOpen={setRecordId} />}
    <PublicAccessAdmin />
    <AdminCoachRequestsSection />
    <AdminClubManagersSection />
    <OpenRequestsSection />
    <Section title="Pending registrations" sub="New accounts can’t sign in until approved.">
      <Table head={['Member', 'Role', 'Province', 'Date of birth', 'Email', '']} isEmpty={!pending.length} empty="No registrations waiting for approval.">
        {pending.map(u => <tr key={u.id}><Td className="font-semibold">{fullName(u)}<div className="text-xs font-normal text-muted">{u.membershipId}</div></Td><Td><RoleChip role={u.role} /></Td><Td>{u.province}</Td><Td>{fmtDate(u.dob)}</Td><Td>{u.email}</Td>
          <Td><div className="flex justify-end gap-1.5"><Btn size="sm" variant="ok" onClick={() => setStatus(u, 'approved')}>Approve</Btn><Btn size="sm" variant="danger" onClick={() => setStatus(u, 'declined')}>Decline</Btn></div></Td></tr>)}
      </Table>
    </Section>
    <Section title={scopeProv ? `${PROVINCE_INFO[scopeProv].name} Member Directory` : 'National Member Directory'} sub="Find a member by searching or filtering. Membership details come from the Trackie membership database." actions={<Btn variant="primary" onClick={() => setImporting(true)}>Import from Trackie</Btn>}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><span><b className="tabular-nums">{scoped.filter(u => u.status === 'approved').length}</b> <span className="text-muted">active members</span></span>{roleCounts.map(([k, n]) => <button key={k} type="button" onClick={() => { setRole(k); setLimit(50); }} className="text-muted hover:text-ink"><span aria-hidden="true">{ROLES[k].emoji}</span> <b className="tabular-nums text-ink">{n}</b> {ROLES[k].label}{n === 1 ? '' : 's'}</button>)}{scoped.some(u => u.status === 'invited') && <button type="button" onClick={() => { setStat('invited'); setLimit(50); }} className="text-muted hover:text-ink"><b className="tabular-nums text-ink">{scoped.filter(u => u.status === 'invited').length}</b> awaiting activation</button>}</div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="Search name, ID, email, club or NCCP #" value={q} onChange={e => { setQ(e.target.value); setLimit(50); }} aria-label="Search members" />
        <select className="field max-w-[220px]" value={role} onChange={e => { setRole(e.target.value); setLimit(50); }} aria-label="Role"><option value="">All roles</option>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.emoji} {r.label}</option>)}</select>
        {!scopeProv && <select className="field max-w-[200px]" value={prov} onChange={e => { setProv(e.target.value); setLimit(50); }} aria-label="Province"><option value="">All provinces</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select>}
        <select className="field max-w-[200px]" value={stat} onChange={e => { setStat(e.target.value); setLimit(50); }} aria-label="Account status"><option value="">Any status</option><option value="approved">Approved</option><option value="invited">Awaiting activation</option><option value="lapsed">Invitation lapsed</option><option value="declined">Declined</option></select>
        {searching && <Btn variant="ghost" onClick={() => { setQ(''); setRole(''); setProv(''); setStat(''); setLimit(50); }}>Clear</Btn>}
      </div>
      {!searching ? <p className="rounded-md border border-dashed border-line px-3 py-5 text-center text-sm text-muted">Search for a member, or choose a role, province or status, to see matching members.</p> : <>
      <p className="mb-2 text-xs text-muted">{list.length} member{list.length === 1 ? '' : 's'} found{list.length > limit ? `, showing the first ${limit}` : ''}.</p>
      <Table head={['Member', 'Membership ID', 'Role', 'Province', 'Status', '']} isEmpty={!list.length} empty="No members match.">
        {list.slice(0, limit).map(u => <tr key={u.id}>
          <Td className="font-semibold"><span aria-hidden="true">{ROLES[u.role].emoji}</span> {nameOf(data, u.id)} <NationalTeamBadge user={u} /><div className="text-xs font-normal text-muted">{u.email}</div></Td>
          <Td>{u.membershipId}</Td><Td><RoleChip role={u.role} /></Td><Td>{u.province}</Td>
          <Td><Badge tone={u.status === 'approved' ? 'ok' : u.status === 'invited' ? 'info' : u.status === 'lapsed' ? 'neutral' : 'bad'}>{u.status === 'approved' ? 'Approved' : u.status === 'invited' ? 'Invited, not yet activated' : u.status === 'lapsed' ? 'Invitation lapsed' : 'Declined'}</Badge></Td>
          <Td className="text-right">{viewer.role === 'nsoadmin' && <Btn size="sm" variant="ghost" onClick={() => setEditUser(u.id)}>Edit account</Btn>}<Btn size="sm" variant="ghost" onClick={() => setProfileId(u.id)}>Membership record</Btn>{u.role === 'boxer' && u.status === 'approved' ? <Btn size="sm" variant="rope" onClick={() => setRecordId(u.id)}>Open Record Book</Btn> : u.status === 'declined' ? <Btn size="sm" onClick={() => setStatus(u, 'approved')}>Approve</Btn> : null}</Td></tr>)}
      </Table>
      {list.length > limit && <div className="mt-2 text-center"><Btn size="sm" onClick={() => setLimit(l => l + 100)}>Show more ({list.length - limit} more)</Btn></div>}
      </>}
    </Section>
    {profileId && <MembershipProfileModal userId={profileId} onClose={() => setProfileId(null)} />}
    {importing && <TrackieImportModal onClose={() => setImporting(false)} />}
    {editUser && <EditUserModal userId={editUser} onClose={() => setEditUser(null)} />}
  </div>;
}

/* =========================================================
   Login & registration (AuthPortalView)
   ========================================================= */
const DEMO_CARDS = [
  { id: 'u-b1', label: 'Male Boxer', scope: 'Own Digital Record Book, Annual Medicals, bouts and 24h forms only.' },
  { id: 'u-b2', label: 'Female Boxer', scope: 'Own Record Book, including the under-18 Declaration of Non-Pregnancy.' },
  { id: 'u-c1', label: 'Coach', scope: 'Assigned boxers, due medical checks and their own sanction requests.' },
  { id: 'u-c2', label: 'Coach Evaluator', scope: 'Evaluation assignments: readiness checks against The Locker, task reviews and outcomes.' },
  { id: 'u-c5', label: 'Coach being evaluated', scope: 'An Instruction Beginner evaluation in progress: tasks, uploads and feedback.' },
  { id: 'u-o1', label: 'Official', scope: 'Assigned bout sheets, check-ins and their own sanction requests.' },
  { id: 'u-m1', label: 'Medical Official', scope: 'Ringside exams, mandatory rest and recovery clearances.' },
  { id: 'u-p1', label: 'PTSO Admin', scope: 'Ontario PTSO sanction approvals, events, logos and member approvals.' },
  { id: 'u-s1', label: 'NSO Admin', scope: 'National oversight, NSO sanction approvals and all members.' }
];
function AuthPortalView({ users, onSignIn, onRegister, nav, children }) {
  const [tab, setTab] = useState('signin');
  const [ident, setIdent] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const [r, setR] = useState({ firstName: '', lastName: '', role: 'boxer', province: 'ON', dob: '', gender: 'M', email: '', password: '', coachId: '' });
  const coaches = (WP ? (WP.coaches || []) : users).filter(u => u.role === 'coach' && u.status === 'approved');
  const [busy, setBusy] = useState(false);
  const signIn = (identifier, password) => {
    if (WP) {
      if (!identifier.trim() || !password) { setErr('Enter your email or membership ID and your password.'); return; }
      setBusy(true); setErr(''); setInfo('');
      wpLogin(identifier.trim(), password).then(() => { try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {} window.location.reload(); }).catch(e => { setBusy(false); setErr(e.message); });
      return;
    }
    const id = identifier.trim().toLowerCase();
    const u = users.find(x => x.email.toLowerCase() === id || x.membershipId.toLowerCase() === id);
    if (!u || u.password !== password) { setErr('Email, membership ID or password is incorrect.'); return; }
    if (u.status !== 'approved') { setErr(u.status === 'invited' || u.status === 'lapsed' ? 'This membership hasn’t been activated yet. Use the code in your welcome email under “Activate My Account”.' : u.status === 'pending' ? `${fullName(u)}’s account is waiting for approval by a PTSO or Boxing Canada administrator.` : 'This account was declined. Contact your PTSO.'); return; }
    setErr(''); onSignIn(u.id);
  };
  const register = () => {
    const miss = ['firstName', 'lastName', 'dob', 'email', 'password'].filter(k => !r[k].trim());
    if (miss.length) { setErr('Fill in every field to create the account.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(r.email)) { setErr('Enter a valid email address.'); return; }
    if (r.password.length < 8) { setErr('Use a password of at least 8 characters.'); return; }
    if (WP) { setBusy(true); setErr(''); wpApi('register', { ...r, email: r.email.trim() }).then(res => { setBusy(false); setTab('signin'); setInfo(res.message); setR(p => ({ ...p, password: '' })); }).catch(e => { setBusy(false); setErr(e.message); }); return; }
    if (users.some(u => u.email.toLowerCase() === r.email.trim().toLowerCase())) { setErr('An account already uses this email. Sign in instead.'); return; }
    setErr(''); onRegister(r);
  };
  const fill = u => { setTab('signin'); setIdent(u.membershipId); setPw(u.password); setErr(''); setInfo(`Form filled for ${fullName(u)}. Select Sign in to continue.`); };
  const setRF = (k, v) => setR(p => ({ ...p, [k]: v }));
  return <div className="min-h-screen">
    <div className="rope-rule" />
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-4 py-6">
        <BoxingCanadaLogo size="xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">BOXING CANADA</h1><Badge tone="bad" className="text-sm">National Portal</Badge></div>
          <p className="mt-2 max-w-2xl text-base text-muted">Our goal is to promote, organize, and coordinate Olympic-Style Boxing for the advancement of the sport and its members of all levels and ages.</p>
        </div>
        <div className="ml-auto self-start"><LangToggle /></div>
      </div>
    </header>
    {nav}
    {children ? children : <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
      <div className="rounded-lg border border-line bg-surface lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3"><BoxingCanadaLogo size="sm" /><h2 className="font-display text-xl font-bold">Member access</h2></div>
        <div role="tablist" className="flex border-b border-line">
          {[['signin', 'Member Sign In'], ['create', 'Create Account']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => { setTab(k); setErr(''); setInfo(''); }} className={cx('-mb-px flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold', tab === k ? 'border-maple text-ink' : 'border-transparent text-muted hover:text-ink')}>{l}</button>)}
        </div>
        <div className="space-y-3 p-4">
          {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
          {info && !err && <Banner tone="info" onClose={() => setInfo('')}>{info}</Banner>}
          {tab === 'signin' ? <>
            <Field label="Email address or Boxing Canada Membership ID"><input className="field" autoComplete="username" placeholder="BC-2025-8821" value={ident} onChange={e => setIdent(e.target.value)} onKeyDown={e => e.key === 'Enter' && signIn(ident, pw)} /></Field>
            <Field label="Password"><input type="password" className="field" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && signIn(ident, pw)} /></Field>
            <Btn variant="primary" className="w-full" onClick={() => signIn(ident, pw)}>Sign in</Btn>
            {WP ? <p className="flex flex-wrap justify-between gap-2 text-xs text-muted">{WP.testMode ? <span>Demo password for every account: Password123!</span> : <span />}<a className="font-semibold text-rope underline" href={WP.lostPassword}>Forgot your password?</a></p> : <p className="text-xs text-muted">Demo password for every account: Password123!</p>}
          </> : <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><input className="field" value={r.firstName} onChange={e => setRF('firstName', e.target.value)} /></Field>
              <Field label="Last name"><input className="field" value={r.lastName} onChange={e => setRF('lastName', e.target.value)} /></Field>
              <Field label="Role" className="col-span-2"><select className="field" value={r.role} onChange={e => setRF('role', e.target.value)}>{['boxer', 'coach', 'official', 'medical', 'ptso'].map(k => <option key={k} value={k}>{ROLES[k].emoji} {ROLES[k].label}</option>)}</select></Field>
              <Field label="Province"><select className="field" value={r.province} onChange={e => setRF('province', e.target.value)}>{PROVINCE_CODES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
              <Field label="Gender"><select className="field" value={r.gender} onChange={e => setRF('gender', e.target.value)}><option value="M">Male</option><option value="F">Female</option></select></Field>
              <Field label="Date of birth" className="col-span-2"><input type="date" className="field" value={r.dob} onChange={e => setRF('dob', e.target.value)} /></Field>
              {r.role === 'boxer' && <Field label="Coach (optional)" className="col-span-2"><select className="field" value={r.coachId} onChange={e => setRF('coachId', e.target.value)}><option value="">No coach yet</option>{coaches.map(c => <option key={c.id} value={c.id}>{fullName(c)}, {c.club}</option>)}</select></Field>}
              <Field label="Email" className="col-span-2"><input type="email" className="field" autoComplete="email" value={r.email} onChange={e => setRF('email', e.target.value)} /></Field>
              <Field label="Password" className="col-span-2"><input type="password" className="field" autoComplete="new-password" value={r.password} onChange={e => setRF('password', e.target.value)} /></Field>
            </div>
            <Btn variant="primary" className="w-full" disabled={busy} onClick={register}>{WP ? 'Request an account' : 'Create account & sign in'}</Btn>{WP && <p className="text-xs text-muted">Your PTSO approves new accounts before you can sign in.</p>}
          </>}
        </div>
      </div>
      {(!WP || (WP.demoUsers || []).length > 0) && <section>
        <h2 className="font-display text-2xl font-bold">Try each role</h2>
        <p className="mb-3 text-sm text-muted">Each demo account sees only what its role allows.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_CARDS.map(c => { const u = (WP ? (WP.demoUsers || []) : users).find(x => x.id === c.id); if (!u) return null; return <div key={c.id} className="flex flex-col rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-sunk text-2xl" aria-hidden="true">{ROLES[u.role].emoji}</span>
              <div className="min-w-0"><div className="text-xs font-semibold text-maple">{c.label}</div><div className="font-display text-lg font-bold leading-tight">{(u.honorific ? u.honorific + ' ' : '') + fullName(u)}</div><div className="text-xs font-semibold text-rope">{u.membershipId}</div></div>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">{c.scope}</p>
            <div className="mt-3 flex gap-2"><Btn size="sm" variant="primary" className="flex-1" onClick={() => WP ? signIn(u.membershipId, u.password) : onSignIn(u.id)}>Sign In as {u.firstName}</Btn><Btn size="sm" onClick={() => fill(u)}>Fill Form</Btn></div>
          </div>; })}
        </div>
      </section>}
    </main>}
  </div>;
}

/* =========================================================
   App shell
   ========================================================= */
/* =========================================================
   International Travel Passes (ITP)
   Submitted by a coach, athlete or official, approved by the
   PTSO Administrator, then co-signed by the NSO Administrator.
   ========================================================= */
const ITP_ROLES = ['Athlete', 'Coach', 'Manager', 'Official', 'Other'];
const ITP_STATUS = {
  draft: { tone: 'neutral', label: 'Draft' },
  submitted: { tone: 'warn', label: 'Awaiting PTSO approval' },
  ptso_approved: { tone: 'info', label: 'Awaiting NSO co-signature' },
  approved: { tone: 'ok', label: 'Approved, pass issued' },
  returned: { tone: 'bad', label: 'Returned for changes' }
};
const SAFE_SPORT_LEVELS = ['NCCP Making Ethical Decisions', 'NCCP Respect in Sport', 'NCCP Safe Sport Training', 'Not verified'];
const ITP_PTSO_CHECKS = [
  ['declarations', 'I confirm, on behalf of the PTSO, that every traveller holds a current-year membership with no outstanding fees owed to the PTSO, and I agree to the declarations above.']
];
const ITP_NSO_CHECKS = [
  ['confirm', 'I confirm, on behalf of Boxing Canada, that every traveller holds a current-year Boxing Canada membership with no outstanding fees owed to Boxing Canada, that no traveller is under an open Safe Sport investigation or current Safe Sport sanction, and that I have checked the Safe Sport education above for every coach, official and team staff member.']
];
const ITP_DECLARATIONS = [
  'Confirms that all individuals included in the application are members in good standing.',
  'Agrees to indemnify and hold Boxing Canada harmless from all liabilities associated with this international event, and confirms that issuing this pass does not breach any regulation or guideline of the province or territory making the request.',
  'Confirms that it has verified that no individual travelling under this pass is under Safe Sport investigation or sanction.',
  'Confirms that the information in this pass is accurate.'
];
const ITP_NOTICES = [
  'Boxing Canada members have no insurance coverage abroad. All travellers are strongly encouraged to buy private medical insurance.',
  'Members travelling under this pass do not represent Canada and are not a national team. They must not wear national team uniforms, and results must not identify them as national team members.',
  'Coaches, officials and other team staff must be ready to prove their Safe Sport education through thelocker.ca: the NCCP Making Ethical Decisions, Respect in Sport, or Safe Sport Training assessment.',
  'After the event, the Team Leader sends a complete copy of the competition results to the PTSO and to Boxing Canada.'
];
const roleToItp = r => ({ boxer: 'Athlete', coach: 'Coach', official: 'Official' })[r] || 'Other';
function memberFromUser(u) {
  return { id: uid('m'), userId: u.id, role: roleToItp(u.role), name: fullName(u), province: u.province, email: u.email, phone: u.phone || '', registration: u.membershipId, dob: u.dob, nccp: u.nccp || '', vaccinated: '', club: u.club || '', emergencyName: '', emergencyCell: '', safeSport: '' };
}
function blankItp(user) {
  return { id: uid('itp'), status: 'draft', submittedBy: user.id, createdAt: nowIso(), submittedAt: null, province: user.province || 'ON', teamLeaderName: fullName(user), teamLeaderEmail: user.email, departureDate: '', returnDate: '', contactAbroad: '', competitionName: '', city: '', state: '', country: '', firstCompetitionDate: '', members: isAdmin(user) ? [] : [memberFromUser(user)], ptso: null, nso: null, returnNote: null, results: null, history: [] };
}
function makeItps() {
  const M = o => ({ id: uid('m'), safeSport: '', vaccinated: '', nccp: '', ...o });
  return [
    { id: 'itp-1', status: 'submitted', submittedBy: 'u-c1', createdAt: '2026-10-15T10:00:00', submittedAt: '2026-10-16T09:30:00', province: 'ON', teamLeaderName: 'Marc Bélanger', teamLeaderEmail: 'marc.belanger@example.ca', departureDate: '2026-12-03', returnDate: '2026-12-07', contactAbroad: 'Dana Walsh, tournament director, +1 716 555 0148', competitionName: 'Great Lakes International Open', city: 'Buffalo', state: 'New York', country: 'United States', firstCompetitionDate: '2026-12-04',
      members: [
        M({ userId: 'u-c1', role: 'Coach', name: 'Marc Bélanger', province: 'ON', email: 'marc.belanger@example.ca', phone: '613-555-0101', registration: 'BC-COA-1102', dob: '1980-09-11', nccp: '5512093', club: 'Bytown Boxing Club', emergencyName: 'Julie Bélanger', emergencyCell: '613-555-0177' }),
        M({ userId: 'u-b1', role: 'Athlete', name: 'Liam Tremblay', province: 'ON', email: 'liam.tremblay@example.ca', phone: '613-555-0123', registration: 'BC-2025-8821', dob: '2001-03-14', club: 'Bytown Boxing Club', emergencyName: 'Sophie Tremblay', emergencyCell: '613-555-0144' }),
        M({ userId: 'u-b2', role: 'Athlete', name: 'Maya Kowalski', province: 'ON', email: 'maya.kowalski@example.ca', phone: '613-555-0131', registration: 'BC-2025-7734', dob: '2008-12-02', club: 'Bytown Boxing Club', emergencyName: 'Anna Kowalski', emergencyCell: '613-555-0166' })
      ], ptso: null, nso: null, returnNote: null, results: null,
      history: [{ at: '2026-10-16T09:30:00', by: 'u-c1', text: 'Submitted to Boxing Ontario' }] },
    { id: 'itp-2', status: 'ptso_approved', submittedBy: 'u-c2', createdAt: '2026-10-12T10:00:00', submittedAt: '2026-10-13T11:00:00', province: 'QC', teamLeaderName: 'Sarah Lin', teamLeaderEmail: 'sarah.lin@example.ca', departureDate: '2027-01-18', returnDate: '2027-01-25', contactAbroad: 'Ramón Peralta, organizing committee, +1 809 555 0110', competitionName: 'Torneo Internacional del Caribe', city: 'Santo Domingo', state: 'Distrito Nacional', country: 'Dominican Republic', firstCompetitionDate: '2027-01-19',
      members: [
        M({ userId: 'u-c2', role: 'Coach', name: 'Sarah Lin', province: 'QC', email: 'sarah.lin@example.ca', phone: '514-555-0102', registration: 'BC-COA-1145', dob: '1986-04-03', nccp: '4471820', club: 'Club de boxe Mont-Royal', emergencyName: 'David Lin', emergencyCell: '514-555-0190' }),
        M({ userId: 'u-b4', role: 'Athlete', name: 'Sofia Martins', province: 'QC', email: 'sofia.martins@example.ca', phone: '514-555-0155', registration: 'BC-2025-5502', dob: '1999-05-09', club: 'Club de boxe Mont-Royal', emergencyName: 'Rita Martins', emergencyCell: '514-555-0181' })
      ],
      ptso: { checks: { membership: true, fees: true, safesport: true, declarations: true }, byUserId: null, byName: 'Nathalie Gagné', at: '2026-10-20T14:00:00', signature: 'Nathalie Gagné', notes: '' },
      nso: null, returnNote: null, results: null,
      history: [{ at: '2026-10-13T11:00:00', by: 'u-c2', text: 'Submitted to FQBO / Boxing Québec' }, { at: '2026-10-20T14:00:00', byName: 'Nathalie Gagné', text: 'Approved and signed for FQBO / Boxing Québec' }] },
    { id: 'itp-3', status: 'approved', submittedBy: 'u-o1', createdAt: '2026-06-30T10:00:00', submittedAt: '2026-06-30T10:30:00', province: 'QC', teamLeaderName: 'Jean-Luc Picard', teamLeaderEmail: 'jeanluc.picard@example.ca', departureDate: '2026-08-12', returnDate: '2026-08-16', contactAbroad: 'Ellen Shaw, chief official, +1 207 555 0133', competitionName: 'Atlantic Seaboard Open', city: 'Portland', state: 'Maine', country: 'United States', firstCompetitionDate: '2026-08-13',
      members: [M({ userId: 'u-o1', role: 'Official', name: 'Jean-Luc Picard', province: 'QC', email: 'jeanluc.picard@example.ca', phone: '514-555-0177', registration: 'BC-OFF-2207', dob: '1972-07-13', nccp: '3390112', club: 'Club de boxe Mont-Royal', emergencyName: 'Marie Picard', emergencyCell: '514-555-0108', safeSport: 'NCCP Respect in Sport' })],
      ptso: { checks: { membership: true, fees: true, safesport: true, declarations: true }, byUserId: null, byName: 'Nathalie Gagné', at: '2026-07-08T09:00:00', signature: 'Nathalie Gagné', notes: '' },
      nso: { checks: { membership: true, fees: true, safesport: true, locker: true }, byUserId: 'u-s1', byName: 'Philippe St-Laurent', at: '2026-07-10T11:00:00', signature: 'Philippe St-Laurent', notes: '' },
      returnNote: null, results: { fileName: 'atlantic-seaboard-open-results.pdf', at: '2026-08-20T10:00:00', by: 'u-o1' },
      history: [{ at: '2026-06-30T10:30:00', by: 'u-o1', text: 'Submitted to FQBO / Boxing Québec' }, { at: '2026-07-08T09:00:00', byName: 'Nathalie Gagné', text: 'Approved and signed for FQBO / Boxing Québec' }, { at: '2026-07-10T11:00:00', by: 'u-s1', text: 'Co-signed for Boxing Canada. Travel pass issued.' }, { at: '2026-08-20T10:00:00', by: 'u-o1', text: 'Competition results uploaded' }] }
  ];
}
const itpLate = x => x.departureDate && daysBetween((x.submittedAt || REF_DATE + 'T').slice(0, 10), x.departureDate) < 28;
function itpMemberFlags(d, m, x) {
  const out = [];
  if (!m.userId) { out.push({ tone: 'warn', text: 'Not linked to a member record' }); return out; }
  const u = getUser(d, m.userId);
  if (!u) return out;
  if (u.status !== 'approved') out.push({ tone: 'bad', text: 'Membership not approved' });
  if (u.role === 'boxer') {
    const el = eligibility(d, u);
    if (el.tone !== 'ok') out.push({ tone: el.tone, text: el.label });
    const med = latestMedical(d, u.id);
    if (med && x.returnDate && medExpiry(med) < x.returnDate && el.tone === 'ok') out.push({ tone: 'warn', text: `Annual Medical expires ${fmtDate(medExpiry(med))}, before return` });
  }
  return out;
}
const itpTravellerOk = (d, m, x) => !itpMemberFlags(d, m, x).some(f => f.tone === 'bad');
const itpCanEdit = (x, v) => v.role === 'nsoadmin' || ((x.status === 'draft' || x.status === 'returned') && (x.submittedBy === v.id || isAdmin(v)));
const itpCanPtso = (x, v) => x.status === 'submitted' && ((v.role === 'ptso' && v.province === x.province) || v.role === 'nsoadmin');
const itpCanNso = (x, v) => x.status === 'ptso_approved' && v.role === 'nsoadmin';
const histName = (d, h) => h.byName || nameOf(d, h.by);

function itpDocHtml(x, d) {
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v || '—')}</td></tr>`;
  const people = (list, ss = true) => list.length ? `<table class="grid"><thead><tr><th>Role</th><th>Name</th><th>Date of birth</th><th>Club</th><th>Registration #</th><th>Province</th><th>Phone</th><th>Email</th><th>Emergency contact</th>${ss ? '<th>Safe Sport (The Locker)</th>' : ''}</tr></thead><tbody>${list.map(m => `<tr><td>${esc(m.role)}</td><td>${esc(m.name)}</td><td>${esc(m.dob)}</td><td>${esc(m.club)}</td><td>${esc(m.registration)}</td><td>${esc(m.province)}</td><td>${esc(m.phone)}</td><td>${esc(m.email)}</td><td>${esc(m.emergencyName)} ${esc(m.emergencyCell)}</td>${ss ? `<td>${esc(m.safeSport || '—')}</td>` : ''}</tr>`).join('')}</tbody></table>` : '<p class="muted">None.</p>';
  const sign = (title, s) => `<div class="sig"><div class="muted">${esc(title)}</div>${s ? `<div class="script">${esc(s.signature)}</div><div>${esc(s.byName)}</div><div class="muted">${esc(fmtStamp(s.at))}</div>` : '<div class="muted">Not yet signed</div>'}</div>`;
  const valid = x.status === 'approved';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>International Travel Pass, ${esc(x.competitionName)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:12px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:22px 0 6px;border-bottom:2px solid #C8102E;padding-bottom:3px}
.head{display:flex;gap:16px;align-items:center;border-bottom:4px solid #C8102E;padding-bottom:12px}.head img{width:72px}.muted{color:#666}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 6px;vertical-align:top}
table.kv th{width:240px;color:#444;font-weight:600}.grid th{background:#f2f2f2;border:1px solid #ccc;font-size:11px}.grid td{border:1px solid #ccc}.sigs{display:flex;gap:24px;margin-top:8px}.sig{flex:1;border:1px solid #ccc;padding:10px;min-height:80px}
.script{font-family:'Brush Script MT',cursive;font-size:22px}.stamp{display:inline-block;padding:4px 10px;border:2px solid ${valid ? '#1C7548' : '#C8102E'};color:${valid ? '#1C7548' : '#C8102E'};font-weight:700;margin-top:6px}li{margin-bottom:4px}@media print{body{margin:12mm}}
</style></head><body>
<div class="head"><img src="${DEFAULT_LOGO}" alt="Boxing Canada"><div><h1>BOXING CANADA / BOXE CANADA</h1><div style="font-size:15px;font-weight:700">International Travel Pass / Formulaire d’avis de voyage</div><div class="stamp">${valid ? 'APPROVED: VALID FOR TRAVEL' : 'NOT VALID: ' + esc(ITP_STATUS[x.status].label.toUpperCase())}</div></div></div>
<h2>Tour or competition</h2><table class="kv">${row('Name of competition', x.competitionName)}${row('Location', [x.city, x.state, x.country].filter(Boolean).join(', '))}${row('First day of competition', x.firstCompetitionDate)}${row('Departure and return', `${x.departureDate} to ${x.returnDate}`)}${row('Team Leader', `${x.teamLeaderName} (${x.teamLeaderEmail})`)}${row('Main contact abroad', x.contactAbroad)}${row('Approving provincial/territorial association', PROVINCE_INFO[x.province].ptso)}${row('Pass reference', x.id.toUpperCase())}</table>
<h2>Athletes</h2>${people(x.members.filter(m => m.role === 'Athlete'), false)}
<h2>Coaches, managers, officials and other members</h2>${people(x.members.filter(m => m.role !== 'Athlete'))}
<h2>By approving this pass the PTSO</h2><ul>${ITP_DECLARATIONS.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
<div class="sigs">${sign('Approved on behalf of the PTSO by', x.ptso)}${sign('Approved on behalf of the NSO (Boxing Canada) by', x.nso)}</div>
<h2>Additional information</h2><ol>${ITP_NOTICES.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
</body></html>`;
}

function ItpEditorModal({ initial, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const [x, setX] = useState(() => structuredClone(initial));
  const [err, setErr] = useState([]);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const set = (k, v) => setX(p => ({ ...p, [k]: v }));
  const setM = (id, k, v) => setX(p => ({ ...p, members: p.members.map(m => m.id === id ? { ...m, [k]: v } : m) }));
  const persist = rec => update(d => { d.itps = d.itps || []; const i = d.itps.findIndex(y => y.id === rec.id); if (i >= 0) d.itps[i] = rec; else d.itps.push(rec); });
  const term = q.trim().toLowerCase();
  const found = term.length >= 2 ? data.users.filter(u => u.status === 'approved' && ['boxer', 'coach', 'official', 'medical'].includes(u.role) && !x.members.some(m => m.userId === u.id) && (fullName(u) + ' ' + u.membershipId + ' ' + (u.club || '')).toLowerCase().includes(term)).slice(0, 6) : [];
  const addUser = u => { setX(p => ({ ...p, members: [...p.members, memberFromUser(u)] })); setQ(''); };
  const addManual = () => setX(p => ({ ...p, members: [...p.members, { id: uid('m'), userId: null, role: 'Other', name: '', province: p.province, email: '', phone: '', registration: '', dob: '', nccp: '', vaccinated: '', club: '', emergencyName: '', emergencyCell: '', safeSport: '' }] }));
  const daysToGo = x.departureDate ? daysBetween(REF_DATE, x.departureDate) : null;
  const validate = () => {
    const e = [];
    [['teamLeaderName', 'Team Leader name'], ['teamLeaderEmail', 'Team Leader email'], ['departureDate', 'Departure date'], ['returnDate', 'Return date'], ['contactAbroad', 'Main contact abroad'], ['competitionName', 'Competition name'], ['city', 'Competition city'], ['country', 'Competition country'], ['firstCompetitionDate', 'First day of competition']].forEach(([k, l]) => { if (!String(x[k] || '').trim()) e.push(l); });
    if (x.departureDate && x.returnDate && x.returnDate < x.departureDate) e.push('Return date must be on or after the departure date');
    if (x.firstCompetitionDate && x.departureDate && x.returnDate && (x.firstCompetitionDate < x.departureDate || x.firstCompetitionDate > x.returnDate)) e.push('First day of competition must fall between departure and return');
    if (!x.members.length) e.push('At least one traveller');
    x.members.forEach((m, i) => {
      const miss = [['name', 'name'], ['email', 'email'], ['phone', 'phone'], ['registration', 'registration #'], ['dob', 'date of birth'], ['club', 'club'], ['emergencyName', 'emergency contact'], ['emergencyCell', 'emergency cell']].filter(([k]) => !String(m[k] || '').trim()).map(([, l]) => l);
      if (miss.length) e.push(`Traveller ${i + 1}${m.name ? ' (' + m.name + ')' : ''}: ${miss.join(', ')}`);
    });
    return e;
  };
  const saveDraft = () => { persist(x); setErr([]); setMsg('Draft saved. Find it under International Travel Passes.'); };
  const liveEdit = viewer.role === 'nsoadmin' && !['draft', 'returned'].includes(x.status);
  const saveLive = () => { persist({ ...x, history: [...(x.history || []), { at: nowIso(), by: viewer.id, text: 'Edited by Boxing Canada' }] }); notify('Travel pass updated. Its approval status is unchanged.'); onClose(); };
  const submit = () => {
    const e = validate(); if (e.length) { setErr(e); setMsg(''); return; }
    const rec = { ...x, status: 'submitted', submittedAt: nowIso(), ptso: null, nso: null, returnNote: null, history: [...(x.history || []), { at: nowIso(), by: viewer.id, text: `${x.status === 'returned' ? 'Resubmitted' : 'Submitted'} to ${PROVINCE_INFO[x.province].ptso}` }] };
    persist(rec); notify(`Travel pass for ${x.competitionName} submitted to ${PROVINCE_INFO[x.province].ptso}.`); onClose();
  };
  const inp = (m, k, props = {}) => <input className="field py-1.5" value={m[k] || ''} onChange={e => setM(m.id, k, e.target.value)} {...props} />;
  return <Modal size="full" title={x.status === 'returned' ? 'Revise International Travel Pass' : 'International Travel Pass Application'} subtitle="Complete at least 4 weeks before departure. Approved by your PTSO, then co-signed by Boxing Canada." onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn>{liveEdit ? <Btn variant="primary" onClick={saveLive}>Save changes</Btn> : <><Btn onClick={saveDraft}>Save draft</Btn><Btn variant="primary" onClick={submit}>Submit to {PROVINCE_INFO[x.province].ptso}</Btn></>}</>}>
    <div className="space-y-5">
      {x.returnNote && <Banner tone="bad">Returned by {x.returnNote.byName} on {fmtStamp(x.returnNote.at)}: {x.returnNote.text}</Banner>}
      {msg && <Banner tone="ok" onClose={() => setMsg('')}>{msg}</Banner>}
      {err.length > 0 && <Banner tone="bad" onClose={() => setErr([])}><div className="font-semibold">Complete these before submitting:</div><ul className="mt-1 list-disc pl-5">{err.map((t, i) => <li key={i}>{t}</li>)}</ul></Banner>}
      {daysToGo !== null && daysToGo < 28 && <Banner tone="warn">Departure is {daysToGo < 0 ? 'in the past' : `${daysToGo} days away`}. Passes should be submitted at least 4 weeks (28 days) before departure, so approval may not arrive in time.</Banner>}

      <section>
        <h4 className="mb-2 font-display text-lg font-bold">Tour or competition</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Team Leader name" required><input className="field" value={x.teamLeaderName} onChange={e => set('teamLeaderName', e.target.value)} /></Field>
          <Field label="Team Leader email" required><input type="email" className="field" value={x.teamLeaderEmail} onChange={e => set('teamLeaderEmail', e.target.value)} /></Field>
          <Field label="Approving provincial/territorial association" required><select className="field" value={x.province} onChange={e => set('province', e.target.value)}>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].ptso} ({c})</option>)}</select></Field>
          <Field label="Name of competition" required><input className="field" value={x.competitionName} onChange={e => set('competitionName', e.target.value)} /></Field>
          <Field label="Competition city" required><input className="field" value={x.city} onChange={e => set('city', e.target.value)} /></Field>
          <Field label="Competition state or region"><input className="field" value={x.state} onChange={e => set('state', e.target.value)} /></Field>
          <Field label="Competition country" required><input className="field" value={x.country} onChange={e => set('country', e.target.value)} /></Field>
          <Field label="Departure date" required><input type="date" className="field" value={x.departureDate} onChange={e => set('departureDate', e.target.value)} /></Field>
          <Field label="Return date" required><input type="date" className="field" value={x.returnDate} onChange={e => set('returnDate', e.target.value)} /></Field>
          <Field label="First day of competition" required><input type="date" className="field" value={x.firstCompetitionDate} onChange={e => set('firstCompetitionDate', e.target.value)} /></Field>
          <Field label="Main contact abroad (name and phone)" required className="sm:col-span-2"><input className="field" value={x.contactAbroad} onChange={e => set('contactAbroad', e.target.value)} /></Field>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><h4 className="font-display text-lg font-bold">Travellers ({x.members.length})</h4><Btn size="sm" variant="ghost" onClick={addManual}>Add someone manually</Btn></div>
        <div className="relative mb-3">
          <input className="field" placeholder="Add a Boxing Canada member: type a name, membership ID or club" value={q} onChange={e => setQ(e.target.value)} aria-label="Search members to add" />
          {found.length > 0 && <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-lg">{found.map(u => <li key={u.id}><button type="button" onClick={() => addUser(u)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sunk"><span aria-hidden="true">{ROLES[u.role].emoji}</span><span className="font-semibold">{fullName(u)}</span><span className="text-xs text-muted">{u.membershipId}, {u.province}, {u.club || ROLES[u.role].label}</span></button></li>)}</ul>}
          {term.length >= 2 && !found.length && <p className="mt-1 text-xs text-muted">No matching members who aren’t already listed.</p>}
        </div>
        <div className="space-y-3">
          {x.members.map((m, i) => { const flags = itpMemberFlags(data, m, x); return <div key={m.id} className="rounded-md border border-line p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-bold">{i + 1}.</span>
              <select className="field w-auto py-1.5" value={m.role} onChange={e => setM(m.id, 'role', e.target.value)} aria-label="Role">{ITP_ROLES.map(r => <option key={r}>{r}</option>)}</select>
              <input className="field max-w-xs flex-1 py-1.5 font-semibold" placeholder="Full name" value={m.name} readOnly={!!m.userId} onChange={e => setM(m.id, 'name', e.target.value)} aria-label="Name" />
              <Badge tone={m.userId ? 'info' : 'neutral'}>{m.userId ? 'Linked to member record' : 'Entered manually'}</Badge>
              {flags.map((f, j) => <Badge key={j} tone={f.tone}>{f.text}</Badge>)}
              <Btn size="xs" variant="ghost" className="ml-auto" onClick={() => setX(p => ({ ...p, members: p.members.filter(y => y.id !== m.id) }))}>Remove</Btn>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Province"><select className="field py-1.5" value={m.province} onChange={e => setM(m.id, 'province', e.target.value)}>{PROVINCE_CODES.map(c => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Registration #">{inp(m, 'registration', { readOnly: !!m.userId })}</Field>
              <Field label="Date of birth">{inp(m, 'dob', { type: 'date', readOnly: !!m.userId })}</Field>
              <Field label="Club">{inp(m, 'club')}</Field>
              <Field label="NCCP #">{inp(m, 'nccp')}</Field>
              <Field label="Email">{inp(m, 'email', { type: 'email' })}</Field>
              <Field label="Phone">{inp(m, 'phone', { type: 'tel' })}</Field>
              <Field label="Emergency contact name">{inp(m, 'emergencyName')}</Field>
              <Field label="Emergency contact cell">{inp(m, 'emergencyCell', { type: 'tel' })}</Field>
              <Field label="Vaccinated against COVID-19?"><select className="field py-1.5" value={m.vaccinated} onChange={e => setM(m.id, 'vaccinated', e.target.value)}><option value="">Not stated</option><option>Yes</option><option>No</option></select></Field>
            </div>
          </div>; })}
          {!x.members.length && <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-muted">No travellers yet. Search for members above.</p>}
        </div>
      </section>

      <section className="rounded-md bg-sunk p-3 text-sm"><h4 className="mb-1 font-display text-base font-bold">Before you travel</h4><ol className="list-decimal space-y-1 pl-5">{ITP_NOTICES.map((t, i) => <li key={i}>{t}</li>)}</ol></section>
    </div>
  </Modal>;
}

function ItpSignPanel({ x, stage }) {
  const { data, update, viewer, notify } = useApp();
  const checksDef = stage === 'ptso' ? ITP_PTSO_CHECKS : ITP_NSO_CHECKS;
  const signed = x[stage];
  const can = stage === 'ptso' ? itpCanPtso(x, viewer) : itpCanNso(x, viewer);
  const [checks, setChecks] = useState({});
  const [sig, setSig] = useState(fullName(viewer));
  const lockerFor = m => { const u = m.userId ? getUser(data, m.userId) : null; return lockerSafeSport(data, (u && nccpOf(u)) || m.nccp); };
  const ssNeeded = m => m.role !== 'Athlete';
  const ssResult = m => { const l = lockerFor(m); return l ? `${l.level} (${fmtDate(l.date)})` : 'No Safe Sport training found in The Locker'; };
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('sign');
  const [err, setErr] = useState('');
  const org = stage === 'ptso' ? PROVINCE_INFO[x.province].ptso : 'Boxing Canada';
  const title = stage === 'ptso' ? `PTSO approval: ${org}` : 'NSO co-signature: Boxing Canada';
  const sign = () => {
    if (checksDef.some(([k]) => !checks[k])) { setErr('Confirm every check before signing.'); return; }
    if (!sig.trim()) { setErr('Type your name as your digital signature.'); return; }
    update(d => {
      const y = d.itps.find(z => z.id === x.id);
      y[stage] = { checks, byUserId: viewer.id, byName: fullName(viewer), at: nowIso(), signature: sig.trim(), notes: '' };
      if (stage === 'nso') y.members.forEach(m => { m.safeSport = ssNeeded(m) ? ssResult(m) : 'Not required (athlete)'; });
      y.status = stage === 'ptso' ? 'ptso_approved' : 'approved';
      y.history = [...(y.history || []), { at: nowIso(), by: viewer.id, text: stage === 'ptso' ? `Approved and signed for ${org}` : 'Co-signed for Boxing Canada. Travel pass issued.' }];
    });
    notify(stage === 'ptso' ? `Travel pass approved for ${org} and sent to Boxing Canada for co-signature.` : `Travel pass co-signed. ${x.teamLeaderName} can now download it.`);
  };
  const giveBack = () => {
    if (!note.trim()) { setErr('Explain what needs to change.'); return; }
    update(d => {
      const y = d.itps.find(z => z.id === x.id);
      y.status = 'returned'; y.returnNote = { by: viewer.id, byName: fullName(viewer), at: nowIso(), text: note.trim(), stage };
      y.history = [...(y.history || []), { at: nowIso(), by: viewer.id, text: `Returned for changes: ${note.trim()}` }];
    });
    notify('Travel pass returned to the submitter for changes.', 'warn');
  };
  if (signed) return <div className="rounded-md border border-ok bg-oksoft p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-base font-bold text-ok">✓ {title}</h4><span className="text-xs text-muted">{fmtStamp(signed.at)}</span></div>
    <ul className="mt-1 space-y-0.5 text-sm">{checksDef.map(([k, l]) => <li key={k}>✓ {l}</li>)}</ul>
    <div className="mt-2 text-sm">Signed <span className="font-semibold italic">{signed.signature}</span> ({signed.byName})</div>
  </div>;
  if (!can) {
    const waiting = stage === 'ptso' ? (x.status === 'submitted') : (x.status === 'ptso_approved');
    return <div className="rounded-md border border-line bg-sunk p-3"><h4 className="font-display text-base font-bold">{title}</h4><p className="text-sm text-muted">{waiting ? (stage === 'ptso' ? `Waiting for a ${org} PTSO Administrator.` : 'Waiting for a Boxing Canada NSO Administrator.') : stage === 'nso' ? 'Follows PTSO approval.' : 'Not yet submitted.'}</p></div>;
  }
  return <div className="rounded-md border-2 border-rope p-3">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-base font-bold">{title}</h4>
      <div className="inline-flex rounded-md border border-line p-0.5">{[['sign', stage === 'ptso' ? 'Approve & sign' : 'Co-sign'], ['return', 'Return for changes']].map(([k, l]) => <button key={k} type="button" onClick={() => { setMode(k); setErr(''); }} className={cx('rounded px-3 py-1 text-xs font-semibold', mode === k ? 'bg-rope text-white' : 'text-muted hover:bg-sunk')}>{l}</button>)}</div></div>
    {err && <Banner tone="bad" className="mb-2" onClose={() => setErr('')}>{err}</Banner>}
    {mode === 'sign' ? <div className="space-y-3">
      {stage === 'ptso' && <div><div className="mb-1 text-xs font-semibold text-muted">By approving this pass, the PTSO:</div><ul className="list-disc space-y-1 rounded-md bg-sunk py-2 pl-8 pr-3 text-xs">{ITP_DECLARATIONS.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
      {stage === 'nso' && (() => { const staff = x.members.filter(ssNeeded); const athletes = x.members.length - staff.length; return <div><div className="mb-1 text-xs font-semibold text-muted">Safe Sport education in The Locker (coaches, officials and team staff)</div>
        {staff.length ? <ul className="divide-y divide-line rounded-md border border-line text-sm">{staff.map(m => { const l = lockerFor(m); return <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5"><span className="font-semibold">{m.name}</span><span className="text-xs text-muted">{m.role}</span><span className={cx('ml-auto text-xs font-semibold', l ? 'text-ok' : 'text-warn')}>{l ? `✓ ${l.level.replace('NCCP ', '')}, ${fmtDate(l.date)}` : 'No Safe Sport training found'}</span></li>; })}</ul> : <p className="text-sm text-muted">No coaches, officials or team staff on this pass.</p>}
        {athletes > 0 && <p className="mt-1 text-xs text-muted">{athletes} athlete{athletes === 1 ? '' : 's'} on this pass: Safe Sport credentials aren’t required for athletes.</p>}
      </div>; })()}
      <div className="space-y-1.5">{checksDef.map(([k, l]) => <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1C7548]" checked={!!checks[k]} onChange={e => setChecks(c => ({ ...c, [k]: e.target.checked }))} /><span>{l}</span></label>)}</div>
      <div className="flex flex-wrap items-end gap-3"><Field label="Digital signature" className="min-w-[220px] flex-1"><input className="field font-semibold italic" value={sig} onChange={e => setSig(e.target.value)} /></Field><Btn variant="ok" onClick={sign}>{stage === 'ptso' ? 'Approve & sign' : 'Co-sign & issue pass'}</Btn></div>
    </div> : <div className="space-y-2"><Field label="What needs to change" required><textarea rows={3} className="field" value={note} onChange={e => setNote(e.target.value)} /></Field><div className="flex justify-end"><Btn variant="danger" onClick={giveBack}>Return to submitter</Btn></div></div>}
  </div>;
}

function ItpDetailModal({ itpId, onClose, onEdit }) {
  const { data, update, viewer, notify } = useApp();
  const x = (data.itps || []).find(y => y.id === itpId);
  const ref = useRef(null);
  if (!x) return null;
  const st = ITP_STATUS[x.status];
  const canResults = x.status === 'approved' && (x.submittedBy === viewer.id || x.members.some(m => m.userId === viewer.id && m.email === x.teamLeaderEmail) || isAdmin(viewer));
  const download = async () => { const r = await saveFile(`ITP-${x.competitionName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${x.departureDate}.html`, itpDocHtml(x, data)); notify(r.msg, r.ok ? 'ok' : 'warn'); };
  const onResults = e => { const f = e.target.files[0]; if (!f) return; update(d => { const y = d.itps.find(z => z.id === x.id); y.results = { fileName: f.name, at: nowIso(), by: viewer.id }; y.history = [...(y.history || []), { at: nowIso(), by: viewer.id, text: 'Competition results uploaded' }]; }); notify('Competition results recorded and shared with the PTSO and Boxing Canada.'); e.target.value = ''; };
  return <Modal size="full" title={x.competitionName || 'Untitled travel pass'} subtitle={`International Travel Pass ${x.id.toUpperCase()}. ${[x.city, x.state, x.country].filter(Boolean).join(', ')}`} onClose={onClose}
    footer={<>
      {itpCanEdit(x, viewer) && <Btn onClick={() => onEdit(x)}>{x.status === 'returned' ? 'Revise & resubmit' : x.status === 'draft' ? 'Edit draft' : 'Edit pass'}</Btn>}
      <Btn variant={x.status === 'approved' ? 'primary' : 'secondary'} onClick={download}>{x.status === 'approved' ? 'Download travel pass' : 'Download preview (not valid)'}</Btn>
      <Btn onClick={onClose}>Close</Btn>
    </>}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={st.tone}>{st.label}</Badge>{itpLate(x) && <Badge tone="warn">Submitted less than 4 weeks before departure</Badge>}{x.results && <Badge tone="ok">Results received</Badge>}{x.status === 'approved' && !x.results && x.returnDate < REF_DATE && <Badge tone="warn">Results due from Team Leader</Badge>}</div>
      {x.returnNote && x.status === 'returned' && <Banner tone="bad">Returned by {x.returnNote.byName} on {fmtStamp(x.returnNote.at)}: {x.returnNote.text}</Banner>}
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-line bg-sunk p-3 text-sm lg:grid-cols-4">
        {[['Team Leader', `${x.teamLeaderName}`], ['Team Leader email', x.teamLeaderEmail], ['Approving PTSO', PROVINCE_INFO[x.province].ptso], ['Main contact abroad', x.contactAbroad], ['Departure', fmtDate(x.departureDate)], ['Return', fmtDate(x.returnDate)], ['First day of competition', fmtDate(x.firstCompetitionDate)], ['Submitted', x.submittedAt ? `${fmtStamp(x.submittedAt)} by ${nameOf(data, x.submittedBy)}` : 'Not yet submitted']].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v || '—'}</dd></div>)}
      </dl>
      <div>
        <h4 className="mb-2 font-display text-lg font-bold">Travellers ({x.members.length})</h4>
        <Table head={['Role', 'Name', 'Registration #', 'Born', 'Province', 'Club', 'Contact', 'Emergency contact', 'Readiness', 'Safe Sport']} isEmpty={!x.members.length} empty="No travellers listed.">
          {x.members.slice().sort((a, b) => ITP_ROLES.indexOf(a.role) - ITP_ROLES.indexOf(b.role)).map(m => { const flags = itpMemberFlags(data, m, x); return <tr key={m.id}>
            <Td><Badge tone={m.role === 'Athlete' ? 'bad' : 'neutral'}>{m.role}</Badge></Td><Td className="font-semibold">{m.name}{m.nccp && <div className="text-xs font-normal text-muted">NCCP {m.nccp}</div>}</Td>
            <Td>{m.registration}</Td><Td className="whitespace-nowrap">{fmtDate(m.dob)}</Td><Td>{m.province}</Td><Td>{m.club}</Td>
            <Td className="text-xs">{m.email}<div>{m.phone}</div></Td><Td className="text-xs">{m.emergencyName}<div>{m.emergencyCell}</div></Td>
            <Td>{flags.length ? flags.map((f, j) => <div key={j} className="mb-0.5"><Badge tone={f.tone}>{f.text}</Badge></div>) : <Badge tone="ok">✓ No concerns</Badge>}</Td>
            <Td className="text-xs">{m.role === 'Athlete' ? <span className="text-muted">Not required</span> : m.safeSport || <span className="text-muted">Checked by NSO</span>}</Td></tr>; })}
        </Table>
        {x.members.some(m => !itpTravellerOk(data, m, x)) && <p className="mt-1 text-xs text-maple">At least one traveller has a membership or medical issue that approvers should resolve before signing.</p>}
      </div>
      <div className="grid gap-3 lg:grid-cols-2"><ItpSignPanel key={'p' + x.status} x={x} stage="ptso" /><ItpSignPanel key={'n' + x.status} x={x} stage="nso" /></div>
      {x.status === 'approved' && <div className="rounded-md border border-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-display text-base font-bold">Competition results</h4><p className="text-sm text-muted">{x.results ? `${x.results.fileName}, uploaded ${fmtStamp(x.results.at)} by ${nameOf(data, x.results.by)}` : 'After the event, the Team Leader uploads the complete results for the PTSO and Boxing Canada.'}</p></div>{canResults && <><Btn size="sm" onClick={() => ref.current.click()}>{x.results ? 'Replace results' : 'Upload results'}</Btn><input ref={ref} type="file" className="hidden" onChange={onResults} /></>}</div></div>}
      <div><h4 className="mb-1 font-display text-base font-bold">History</h4><ol className="space-y-1 border-l-2 border-line pl-3 text-sm">{(x.history || []).map((h, i) => <li key={i}><span className="text-muted">{fmtStamp(h.at)}</span> · {h.text} <span className="text-muted">({histName(data, h)})</span></li>)}{!(x.history || []).length && <li className="text-muted">Created {fmtStamp(x.createdAt)}. Not yet submitted.</li>}</ol></div>
    </div>
  </Modal>;
}

function TravelPassView() {
  const { data, viewer } = useApp();
  const [openId, setOpenId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openYears, setOpenYears] = useState(() => new Set());
  const itps = data.itps || [];
  const mine = x => x.submittedBy === viewer.id || x.members.some(m => m.userId === viewer.id);
  const visible = viewer.role === 'nsoadmin' ? itps.filter(x => x.status !== 'draft' || x.submittedBy === viewer.id)
    : viewer.role === 'ptso' ? itps.filter(x => (x.province === viewer.province && x.status !== 'draft') || x.submittedBy === viewer.id)
    : itps.filter(mine);
  const needsMe = x => itpCanPtso(x, viewer) || itpCanNso(x, viewer) || (itpCanEdit(x, viewer) && x.submittedBy === viewer.id && x.status !== 'approved') || (x.status === 'approved' && !x.results && x.returnDate < REF_DATE && x.submittedBy === viewer.id);
  // Active = anything not yet approved, plus approved passes whose trip hasn't ended or that were approved in the last 90 days, plus any still owing results to the viewer.
  const recentCut = addDays(REF_DATE, -90);
  const approvedAt = x => (x.nso && x.nso.at ? x.nso.at.slice(0, 10) : x.submittedAt ? x.submittedAt.slice(0, 10) : '');
  const isActive = x => x.status !== 'approved' || (x.returnDate || '') >= REF_DATE || approvedAt(x) >= recentCut || needsMe(x);
  const passYear = x => (x.departureDate || x.createdAt || '').slice(0, 4) || 'Undated';
  const active = visible.filter(isActive), archived = visible.filter(x => !isActive(x));
  const filters = [['all', 'All active'], ['action', 'Needs my action'], ['draft', 'Drafts'], ['submitted', 'Awaiting PTSO'], ['ptso_approved', 'Awaiting NSO'], ['returned', 'Returned'], ['approved', 'Recently approved']];
  const match = (x, k) => k === 'all' || (k === 'action' ? needsMe(x) : x.status === k);
  const count = k => active.filter(x => match(x, k)).length;
  const sortActive = (a, b) => (needsMe(b) - needsMe(a)) || (a.departureDate || '9999').localeCompare(b.departureDate || '9999');
  const list = active.filter(x => match(x, filter)).sort(sortActive);
  const term = q.trim().toLowerCase();
  const found = term.length >= 2 ? visible.filter(x => [x.competitionName, x.city, x.country, x.teamLeaderName, x.id, ...x.members.map(m => m.name)].join(' ').toLowerCase().includes(term)).sort((a, b) => (b.departureDate || '').localeCompare(a.departureDate || '')) : null;
  const years = [...new Set(archived.map(passYear))].sort().reverse();
  const sub = viewer.role === 'nsoadmin' ? 'Co-sign passes once the PTSO has approved them.' : viewer.role === 'ptso' ? `Approve passes for ${PROVINCE_INFO[viewer.province].ptso} members. Boxing Canada co-signs after you.` : 'Passes you submitted or are travelling on. Submit at least 4 weeks before departure.';
  const PassTable = ({ rows, empty }) => <Table head={['Competition', 'Travel dates', 'PTSO', 'Travellers', 'Submitted by', 'Status', '']} isEmpty={!rows.length} empty={empty}>
    {rows.map(x => { const st = ITP_STATUS[x.status]; return <tr key={x.id} className={needsMe(x) ? 'bg-warnsoft' : ''}>
      <Td className="font-semibold">{x.competitionName || 'Untitled'}<div className="text-xs font-normal text-muted">{[x.city, x.country].filter(Boolean).join(', ') || '—'}</div></Td>
      <Td className="whitespace-nowrap">{x.departureDate ? `${fmtDate(x.departureDate)} to ${fmtDate(x.returnDate)}` : '—'}</Td>
      <Td>{x.province}</Td>
      <Td>{x.members.filter(m => m.role === 'Athlete').length} athletes, {x.members.filter(m => m.role !== 'Athlete').length} others</Td>
      <Td>{nameOf(data, x.submittedBy)}</Td>
      <Td><Badge tone={st.tone}>{st.label}</Badge>{itpLate(x) && x.status !== 'approved' && <div className="mt-1"><Badge tone="warn">Under 4 weeks</Badge></div>}{x.status === 'approved' && <div className="mt-1">{x.results ? <Badge tone="ok">Results received</Badge> : x.returnDate < REF_DATE ? <Badge tone="warn">Results due</Badge> : null}</div>}</Td>
      <Td className="text-right"><Btn size="sm" variant={needsMe(x) ? 'primary' : 'secondary'} onClick={() => itpCanEdit(x, viewer) && x.status === 'draft' ? setEdit(x) : setOpenId(x.id)}>{itpCanPtso(x, viewer) ? 'Review & approve' : itpCanNso(x, viewer) ? 'Review & co-sign' : itpCanEdit(x, viewer) && x.status === 'draft' ? 'Continue' : 'Open'}</Btn></Td>
    </tr>; })}
  </Table>;
  return <div className="space-y-4">
    <Section logo title="International Travel Passes" sub={sub} actions={<Btn variant="primary" onClick={() => setEdit(blankItp(viewer))}>New Travel Pass</Btn>}>
      <p className="mb-3 max-w-prose text-sm">An International Travel Pass confirms that each traveller is a Boxing Canada member in good standing and can compete safely abroad. It is approved by the PTSO and co-signed by Boxing Canada.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="field max-w-sm" placeholder="Search all passes: competition, country, traveller…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search all travel passes" />
        {found && <Btn size="sm" variant="ghost" onClick={() => setQ('')}>Clear search</Btn>}
      </div>
      {found ? <><p className="mb-2 text-sm text-muted">{found.length} pass{found.length === 1 ? '' : 'es'} found across all years.</p><PassTable rows={found} empty="No passes match." /></> : <>
        <h3 className="mb-1 font-display text-lg font-bold">Pending & recent</h3>
        <p className="mb-2 text-xs text-muted">Passes still in progress, and approved passes for trips that haven’t ended or were approved in the last 90 days.</p>
        <div className="mb-3 flex flex-wrap gap-1">{filters.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={cx('rounded-md border px-3 py-1 text-xs font-semibold', filter === k ? 'border-rope bg-ropesoft text-rope' : 'border-line text-muted hover:bg-sunk')}>{l} ({count(k)})</button>)}</div>
        <PassTable rows={list} empty={filter === 'all' ? 'Nothing pending or recent. Start one with New Travel Pass.' : 'Nothing in this view.'} />
      </>}
    </Section>
    {!found && <Section title="Past travel passes" sub="Completed trips, grouped by year of departure.">
      {years.length ? <div className="space-y-2">{years.map(y => { const rows = archived.filter(x => passYear(x) === y).sort((a, b) => (b.departureDate || '').localeCompare(a.departureDate || '')); const isOpen = openYears.has(y); return <div key={y} className="rounded-lg border border-line">
        <button type="button" aria-expanded={isOpen} onClick={() => setOpenYears(s => { const n = new Set(s); n.has(y) ? n.delete(y) : n.add(y); return n; })} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-sunk">
          <span className="font-display text-lg font-bold">{y} travel passes</span><Badge>{rows.length} pass{rows.length === 1 ? '' : 'es'}</Badge>
          <span className="hidden text-xs text-muted sm:inline">{rows.reduce((a, x) => a + x.members.length, 0)} travellers · {[...new Set(rows.map(x => x.country).filter(Boolean))].sort().join(', ')}</span>
          <span className="ml-auto text-sm font-semibold text-muted">{isOpen ? 'Hide' : 'Show'}</span>
        </button>
        {isOpen && <div className="border-t border-line p-3"><PassTable rows={rows} empty="None." /></div>}
      </div>; })}</div> : <p className="text-sm text-muted">No past passes yet.</p>}
    </Section>}
    {openId && <ItpDetailModal itpId={openId} onClose={() => setOpenId(null)} onEdit={x => { setOpenId(null); setEdit(x); }} />}
    {edit && <ItpEditorModal key={edit.id} initial={edit} onClose={() => setEdit(null)} />}
  </div>;
}

/* =========================================================
   Document Library
   NSO Administrators publish documents nationally (or to one
   province) for chosen user groups. PTSO Administrators publish
   to their own province's members, subject to NSO approval.
   ========================================================= */
const DOC_AUDIENCES = ['boxer', 'coach', 'official', 'medical', 'ptso'];
const DOC_AUDIENCE_LABEL = { public: 'Public (no sign-in)', nationalteam: 'National Team athletes', boxer: 'Athletes', coach: 'Coaches', official: 'Officials', medical: 'Medical Officials', ptso: 'PTSO Administrators' };
const DOC_CATEGORIES = ['About Boxing Canada', 'Membership', 'Nationals', 'Athletes', 'Coaches', 'Officials', 'Para', 'Hosting Events', 'Policies and Governance'];
// Moves documents from the earlier category list onto the current one.
const OLD_DOC_CATEGORY = { 'Rules & Regulations': 'Policies and Governance', 'Medical & Safety': 'Athletes', 'Safe Sport': 'Policies and Governance', 'Forms & Templates': 'Membership', 'Coaching Resources': 'Coaches', 'Officiating': 'Officials', 'Policies & Governance': 'Policies and Governance', 'Announcements': 'About Boxing Canada', 'Other': 'About Boxing Canada' };
const DOC_CATEGORY_BY_ID = { 'doc-2': 'Hosting Events', 'doc-4': 'Hosting Events', 'doc-6': 'Hosting Events', 'doc-9': 'Hosting Events', 'doc-pub-1': 'Membership', 'doc-nt-1': 'Athletes', 'doc-nt-2': 'Athletes' };
function upgradeTo14(d) { (d.docs || []).forEach(x => { if (!DOC_CATEGORIES.includes(x.category)) x.category = DOC_CATEGORY_BY_ID[x.id] || OLD_DOC_CATEGORY[x.category] || 'About Boxing Canada'; }); d.version = 14; return d; }
const DOC_STATUS = { published: { tone: 'ok', label: 'Published' }, pending: { tone: 'warn', label: 'Awaiting NSO approval' }, rejected: { tone: 'bad', label: 'Not approved' }, unpublished: { tone: 'neutral', label: 'Unpublished' } };
const DOC_MAX_BYTES = 1500000;
function makeDocs() {
  const D = o => ({ description: '', sample: true, fileName: o.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pdf', size: 240000, decidedBy: null, decidedAt: null, rejectionReason: '', ...o });
  return [
    D({ id: 'doc-1', title: 'Boxing Canada Competition Rules 2026', description: 'Rules for sanctioned Olympic-style boxing competition in Canada, including scoring, equipment and age categories.', category: 'Rules & Regulations', audience: ['boxer', 'coach', 'official', 'medical'], scope: 'national', uploadedBy: 'u-s1', uploadedAt: '2026-01-12T10:00:00', status: 'published', size: 1180000 }),
    D({ id: 'doc-2', title: 'Ringside Concussion Assessment Protocol', description: 'Step-by-step assessment, mandatory rest periods and return-to-box clearance for ringside medical practitioners.', category: 'Medical & Safety', audience: ['medical'], scope: 'national', uploadedBy: 'u-s1', uploadedAt: '2026-02-03T10:00:00', status: 'published' }),
    D({ id: 'doc-3', title: 'Officials’ Scoring and Judging Guide', description: '10-point must system, common scoring errors and referee signals.', category: 'Officiating', audience: ['official'], scope: 'national', uploadedBy: 'u-s1', uploadedAt: '2026-02-20T10:00:00', status: 'published' }),
    D({ id: 'doc-4', title: 'PTSO Sanctioning Procedures Manual', description: 'How PTSOs review sanction applications, approve travel passes and report results to Boxing Canada.', category: 'Policies & Governance', audience: ['ptso'], scope: 'national', uploadedBy: 'u-s1', uploadedAt: '2026-03-01T10:00:00', status: 'published' }),
    D({ id: 'doc-5', title: 'Safe Sport: Code of Conduct Summary', description: 'What the Universal Code of Conduct to Prevent and Address Maltreatment in Sport means for every member, and how to report a concern.', category: 'Safe Sport', audience: ['boxer', 'coach', 'official', 'medical', 'ptso'], scope: 'national', uploadedBy: 'u-s1', uploadedAt: '2026-04-15T10:00:00', status: 'published' }),
    D({ id: 'doc-6', title: 'Boxing Ontario Club Show Calendar, Fall 2026', description: 'Sanctioned Ontario club shows from September to December 2026.', category: 'Announcements', audience: ['boxer', 'coach'], scope: 'ON', uploadedBy: 'u-p1', uploadedAt: '2026-09-02T10:00:00', status: 'published', decidedBy: 'u-s1', decidedAt: '2026-09-03T09:00:00', size: 96000 }),
    D({ id: 'doc-7', title: 'Ontario Officials Clinic, November 2026', description: 'Registration details and agenda for the provincial officials clinic in Toronto.', category: 'Officiating', audience: ['official'], scope: 'ON', uploadedBy: 'u-p1', uploadedAt: '2026-10-21T15:00:00', status: 'pending', size: 54000 }),
    D({ id: 'doc-8', title: 'Weight Management Tips for Club Shows', description: 'Advice for athletes making weight before Ontario club shows.', category: 'Medical & Safety', audience: ['boxer'], scope: 'ON', uploadedBy: 'u-p1', uploadedAt: '2026-10-01T12:00:00', status: 'rejected', decidedBy: 'u-s1', decidedAt: '2026-10-03T10:00:00', rejectionReason: 'Needs review by a Boxing Canada medical official before it goes to athletes. Please resubmit once reviewed.' }),
    D({ id: 'doc-9', title: 'Guide des compétitions provinciales 2026-2027', description: 'Calendrier et règlements des compétitions provinciales au Québec.', category: 'Rules & Regulations', audience: ['boxer', 'coach'], scope: 'QC', uploadedBy: null, uploadedByName: 'Nathalie Gagné (FQBO / Boxing Québec)', uploadedAt: '2026-10-19T09:00:00', status: 'pending', size: 410000 })
  ];
}
const docSource = d => d.scope === 'national' ? 'Boxing Canada' : (PROVINCE_INFO[d.scope] || {}).ptso || d.scope;
const docUploader = (data, d) => d.uploadedByName || nameOf(data, d.uploadedBy);
const fmtSize = n => !n ? '' : n >= 1000000 ? (n / 1000000).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1000)) + ' KB';
const docVisibleToMember = (d, v) => d.status === 'published' && (d.scope === 'national' || d.scope === v.province) && (d.audience.includes(v.role) || (d.audience.includes('nationalteam') && v.role === 'boxer' && !!v.nationalTeam && (!(d.ntLevels || []).length || d.ntLevels.includes(v.nationalTeam.level))));
async function downloadDoc(d, notify) {
  let r;
  if (d.dataUrl) r = await saveFile(d.fileName, dataUrlToBlob(d.dataUrl));
  else if (d.sample) r = await saveFile(d.fileName.replace(/\.[a-z0-9]+$/i, '') + '-sample.txt', `${d.title}\n${docSource(d)}\n\n${d.description}\n\nThis is a sample placeholder for the demo. The original file is not stored in this demo.`);
  else { notify('This file was too large to keep in the demo, so only its details were saved.', 'warn'); return; }
  notify(r.msg, r.ok ? 'ok' : 'warn');
}
const AudienceBadges = ({ list }) => <div className="flex flex-wrap gap-1">{[...DOC_AUDIENCES, 'nationalteam', 'public'].filter(a => list.includes(a)).map(a => <Badge key={a} tone="neutral"><span aria-hidden="true">{audEmoji(a)}</span>{DOC_AUDIENCE_LABEL[a]}</Badge>)}</div>;

function DocUploadModal({ onClose, initial }) {
  const { update, viewer, notify } = useApp();
  const nso = viewer.role === 'nsoadmin';
  const options = nso ? [...DOC_AUDIENCES, 'nationalteam', 'public'] : [...DOC_AUDIENCES.filter(a => a !== 'ptso'), 'public'];
  const [f, setF] = useState(() => initial ? { title: initial.title, description: initial.description || '', category: initial.category, audience: initial.audience.slice(), ntLevels: (initial.ntLevels || []).slice(), scope: initial.scope, file: null } : { title: '', description: '', category: DOC_CATEGORIES[0], audience: [], ntLevels: [], scope: nso ? 'national' : viewer.province, file: null });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggle = a => set('audience', f.audience.includes(a) ? f.audience.filter(x => x !== a) : [...f.audience, a]);
  const save = async () => {
    if (!f.title.trim()) { setErr('Give the document a title.'); return; }
    if (!f.audience.length) { setErr('Choose at least one user group.'); return; }
    if (!f.file && !initial) { setErr('Choose a file to upload.'); return; }
    setBusy(true);
    let dataUrl = '';
    if (f.file && f.file.size <= DOC_MAX_BYTES) { try { dataUrl = await readFileAsDataUrl(f.file); } catch (e) { dataUrl = ''; } }
    const doc = { id: uid('doc'), ntLevels: f.audience.includes('nationalteam') ? f.ntLevels : [], title: f.title.trim(), description: f.description.trim(), category: f.category, audience: f.audience, scope: f.scope, fileName: f.file ? f.file.name : '', size: f.file ? f.file.size : 0, mime: f.file ? f.file.type : '', dataUrl, sample: false, uploadedBy: viewer.id, uploadedAt: nowIso(), status: nso ? 'published' : 'pending', decidedBy: nso ? viewer.id : null, decidedAt: nso ? nowIso() : null, rejectionReason: '' };
    if (initial) {
      const merged = { ...initial, ...doc, id: initial.id, uploadedBy: initial.uploadedBy, uploadedByName: initial.uploadedByName, uploadedAt: initial.uploadedAt, status: nso ? initial.status : 'pending', decidedBy: nso ? initial.decidedBy : null, decidedAt: nso ? initial.decidedAt : null, rejectionReason: nso ? initial.rejectionReason : '', ...(f.file ? {} : { fileName: initial.fileName, size: initial.size, mime: initial.mime, dataUrl: initial.dataUrl, sample: initial.sample }), editedBy: viewer.id, editedAt: nowIso() };
      update(d => { const i = d.docs.findIndex(x => x.id === initial.id); if (i >= 0) d.docs[i] = merged; });
      notify(nso ? `“${merged.title}” updated.` : `“${merged.title}” updated and sent back to Boxing Canada for approval.`); onClose(); return;
    }
    update(d => { d.docs = d.docs || []; d.docs.unshift(doc); });
    notify(nso ? `“${doc.title}” published to ${f.audience.map(a => DOC_AUDIENCE_LABEL[a]).join(', ')}.` : `“${doc.title}” sent to Boxing Canada for approval.`);
    onClose();
  };
  return <Modal size="lg" title={initial ? 'Edit Document' : 'Upload a Document'} subtitle={nso ? 'Published immediately to the groups you choose.' : `For ${PROVINCE_INFO[viewer.province].ptso} members. Published once a Boxing Canada NSO Administrator approves it.`} onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={busy} onClick={save}>{initial ? (nso ? 'Save changes' : 'Save & resubmit') : nso ? 'Publish document' : 'Submit for approval'}</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <Field label="Title" required><input className="field" value={f.title} onChange={e => set('title', e.target.value)} /></Field>
      <Field label="Short description"><textarea rows={2} className="field" value={f.description} onChange={e => set('description', e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category"><select className="field" value={f.category} onChange={e => set('category', e.target.value)}>{DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Where it applies">{nso ? <select className="field" value={f.scope} onChange={e => set('scope', e.target.value)}><option value="national">All of Canada (Boxing Canada)</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name} members only</option>)}</select> : <input className="field" readOnly value={`${PROVINCE_INFO[viewer.province].name} members only`} />}</Field>
      </div>
      <Field label="Who can see it" required hint={f.audience.length > 1 ? 'Shared with several groups.' : f.audience.length === 1 ? `Exclusive to ${DOC_AUDIENCE_LABEL[f.audience[0]]}.` : 'Choose one group for an exclusive document, or several to share it.'}>
        <div className="flex flex-wrap gap-2">{options.map(a => <label key={a} className={cx('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold', f.audience.includes(a) ? 'border-rope bg-ropesoft text-rope' : 'border-line')}><input type="checkbox" className="h-4 w-4" checked={f.audience.includes(a)} onChange={() => toggle(a)} /><span aria-hidden="true">{audEmoji(a)}</span>{DOC_AUDIENCE_LABEL[a]}</label>)}
          <button type="button" className="text-xs font-semibold text-rope" onClick={() => set('audience', f.audience.length === options.length ? [] : options.slice())}>{f.audience.length === options.length ? 'Clear all' : 'Select all'}</button></div>
      </Field>
      {f.audience.includes('nationalteam') && <Field label="National Team Program levels" hint={f.ntLevels.length ? `Only ${f.ntLevels.map(ntLabel).join(', ')} athletes can see it.` : 'All National Team Program athletes can see it. Tick levels to narrow it.'}><div className="flex flex-wrap gap-2">{NT_LEVELS.map(l => <label key={l.key} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.ntLevels.includes(l.key)} onChange={() => set('ntLevels', f.ntLevels.includes(l.key) ? f.ntLevels.filter(x => x !== l.key) : [...f.ntLevels, l.key])} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} aria-hidden="true" />{l.label}</label>)}</div>{f.audience.includes('boxer') && <p className="mt-1 text-xs text-warn">“Athletes” is also ticked, so every athlete will see this. Untick it to keep the document National Team only.</p>}</Field>}
      <Field label="File" required hint={f.file && f.file.size > DOC_MAX_BYTES ? 'Over 1.5 MB: this demo keeps the file’s details but not the file itself. A production server would store it.' : 'PDF, Word, Excel, image or any other file.'}>
        <input type="file" className="text-sm" onChange={e => set('file', e.target.files[0] || null)} />
      </Field>
    </div>
  </Modal>;
}
function DocRejectModal({ doc, onClose }) {
  const { update, viewer, notify } = useApp();
  const [reason, setReason] = useState(''); const [err, setErr] = useState('');
  return <Modal size="md" title="Don’t Approve Document" subtitle={doc.title} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="danger" onClick={() => { if (!reason.trim()) { setErr('Tell the PTSO what to change.'); return; } update(d => { Object.assign(d.docs.find(x => x.id === doc.id), { status: 'rejected', decidedBy: viewer.id, decidedAt: nowIso(), rejectionReason: reason.trim() }); }); notify(`“${doc.title}” was not approved. ${docSource(doc)} can see your reason.`, 'warn'); onClose(); }}>Don’t approve</Btn></>}>
    {err && <Banner tone="bad" className="mb-3">{err}</Banner>}
    <Field label="Reason shared with the PTSO" required><textarea rows={4} className="field" value={reason} onChange={e => setReason(e.target.value)} /></Field>
  </Modal>;
}
function DocCards({ docs }) {
  const { notify } = useApp();
  const [q, setQ] = useState(''); const [cat, setCat] = useState('');
  const list = docs.filter(d => (!cat || d.category === cat) && (d.title + ' ' + d.description).toLowerCase().includes(q.trim().toLowerCase()));
  const cats = DOC_CATEGORIES.filter(c => list.some(d => d.category === c));
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><input className="field max-w-xs" placeholder="Search documents" value={q} onChange={e => setQ(e.target.value)} aria-label="Search documents" /><select className="field max-w-[230px]" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
    {!list.length && <p className="py-4 text-sm text-muted">{docs.length ? 'No documents match.' : 'No documents have been shared with you yet.'}</p>}
    {cats.map(c => <div key={c}><h4 className="mb-2 font-display text-base font-bold">{c}</h4><div className="grid gap-2 md:grid-cols-2">{list.filter(d => d.category === c).map(d => <div key={d.id} className="flex flex-col rounded-md border border-line p-3">
      <div className="flex items-start gap-2"><span className="mt-0.5 text-xl" aria-hidden="true">📄</span><div className="min-w-0 flex-1"><div className="font-semibold leading-tight">{d.title}</div><div className="text-xs text-muted">{docSource(d)} · {fmtDate(d.uploadedAt.slice(0, 10))}{d.size ? ' · ' + fmtSize(d.size) : ''}</div></div></div>
      {d.description && <p className="mt-1.5 flex-1 text-sm text-muted">{d.description}</p>}
      <div className="mt-2 flex items-center justify-between gap-2"><span className="flex flex-wrap gap-1">{d.audience.includes('nationalteam') && <Badge tone="warn">National Team Program{(d.ntLevels || []).length ? ': ' + d.ntLevels.map(ntLabel).join(', ') : ''}</Badge>}<Badge tone={d.scope === 'national' ? 'bad' : 'info'}>{d.scope === 'national' ? '🍁 National' : d.scope}</Badge></span><Btn size="sm" variant="rope" onClick={() => downloadDoc(d, notify)}>Download</Btn></div>
    </div>)}</div></div>)}
  </div>;
}
function DocAdminTable({ docs, mode }) {
  const { data, update, viewer, notify } = useApp();
  const [reject, setReject] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const nso = viewer.role === 'nsoadmin';
  const approve = d => { update(x => { Object.assign(x.docs.find(y => y.id === d.id), { status: 'published', decidedBy: viewer.id, decidedAt: nowIso(), rejectionReason: '' }); }); notify(`“${d.title}” approved and published to ${docSource(d)} members.`); };
  const setStatus = (d, status, text) => { update(x => { x.docs.find(y => y.id === d.id).status = status; }); notify(text); };
  const remove = d => { update(x => { x.docs = x.docs.filter(y => y.id !== d.id); }); notify(`“${d.title}” deleted.`, 'warn'); };
  const canManage = d => nso || d.uploadedBy === viewer.id;
  return <>
    <Table head={['Document', 'Source', 'User groups', 'Uploaded', 'Status', '']} isEmpty={!docs.length} empty={mode === 'pending' ? 'Nothing waiting for approval.' : 'No documents here.'}>
      {docs.map(d => <tr key={d.id} className={d.status === 'pending' && nso ? 'bg-warnsoft' : ''}>
        <Td className="font-semibold">{d.title}<div className="text-xs font-normal text-muted">{d.category} · {d.fileName}{d.size ? ', ' + fmtSize(d.size) : ''}</div>{d.description && <div className="mt-0.5 max-w-sm text-xs font-normal text-muted">{d.description}</div>}</Td>
        <Td>{d.scope === 'national' ? <Badge tone="bad">🍁 Boxing Canada</Badge> : <Badge tone="info">{docSource(d)}</Badge>}</Td>
        <Td><AudienceBadges list={d.audience} /></Td>
        <Td className="text-xs">{docUploader(data, d)}<div className="text-muted">{fmtStamp(d.uploadedAt)}</div></Td>
        <Td><Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>{d.decidedBy && d.scope !== 'national' && d.status !== 'pending' && <div className="mt-1 text-xs text-muted">{d.status === 'rejected' ? 'Reviewed' : 'Approved'} by {nameOf(data, d.decidedBy)}</div>}{d.status === 'rejected' && d.rejectionReason && <div className="mt-1 max-w-xs text-xs text-maple">{d.rejectionReason}</div>}</Td>
        <Td><div className="flex flex-wrap justify-end gap-1.5">
          <Btn size="sm" onClick={() => downloadDoc(d, notify)}>Download</Btn>
          {nso && d.status === 'pending' && <><Btn size="sm" variant="ok" onClick={() => approve(d)}>Approve & publish</Btn><Btn size="sm" variant="danger" onClick={() => setReject(d)}>Don’t approve</Btn></>}
          {nso && d.status === 'published' && <Btn size="sm" variant="ghost" onClick={() => setStatus(d, 'unpublished', `“${d.title}” unpublished.`)}>Unpublish</Btn>}
          {nso && d.status === 'unpublished' && <Btn size="sm" variant="ghost" onClick={() => setStatus(d, 'published', `“${d.title}” published again.`)}>Republish</Btn>}
          {!nso && d.status === 'rejected' && d.uploadedBy === viewer.id && <Btn size="sm" variant="ghost" onClick={() => { update(x => { Object.assign(x.docs.find(y => y.id === d.id), { status: 'pending', uploadedAt: nowIso() }); }); notify(`“${d.title}” resubmitted for approval.`); }}>Resubmit</Btn>}
          {canManage(d) && <Btn size="sm" variant="ghost" onClick={() => setEditDoc(d)}>Edit</Btn>}
          {canManage(d) && <Btn size="sm" variant="ghost" onClick={() => remove(d)}>Delete</Btn>}
        </div></Td>
      </tr>)}
    </Table>
    {reject && <DocRejectModal doc={reject} onClose={() => setReject(null)} />}
    {editDoc && <DocUploadModal initial={editDoc} onClose={() => setEditDoc(null)} />}
  </>;
}
function DocumentLibraryView() {
  const { data, viewer } = useApp();
  const [upload, setUpload] = useState(false);
  const [src, setSrc] = useState(''); const [aud, setAud] = useState(''); const [stat, setStat] = useState('');
  const docs = data.docs || [];
  const nso = viewer.role === 'nsoadmin', ptso = viewer.role === 'ptso';
  const forMe = docs.filter(d => docVisibleToMember(d, viewer));
  if (!nso && !ptso) return <Section logo title="Documents" sub={`Shared with ${DOC_AUDIENCE_LABEL[viewer.role]} by Boxing Canada and ${PROVINCE_INFO[viewer.province].ptso}.`}><DocCards docs={forMe} /></Section>;
  if (ptso) {
    const own = docs.filter(d => d.scope === viewer.province);
    return <div className="space-y-4">
      <Section logo title={`${PROVINCE_INFO[viewer.province].ptso} Documents`} sub="Documents for your province’s athletes, coaches, officials and medical officials. Boxing Canada approves each one before it is published." actions={<Btn variant="primary" onClick={() => setUpload(true)}>Upload a Document</Btn>}>
        <DocAdminTable docs={own} />
      </Section>
      <Section title="Documents for PTSO Administrators" sub="Shared with you by Boxing Canada."><DocCards docs={forMe} /></Section>
      {upload && <DocUploadModal onClose={() => setUpload(false)} />}
    </div>;
  }
  const pending = docs.filter(d => d.status === 'pending');
  const all = docs.filter(d => (!src || (src === 'national' ? d.scope === 'national' : d.scope === src)) && (!aud || d.audience.includes(aud)) && (!stat || d.status === stat));
  const provs = [...new Set(docs.filter(d => d.scope !== 'national').map(d => d.scope))].sort();
  return <div className="space-y-4">
    <Section logo title="PTSO Documents Awaiting Approval" sub="PTSO uploads are published to their members only after you approve them." actions={<Badge tone={pending.length ? 'warn' : 'ok'}>{pending.length} waiting</Badge>}>
      <DocAdminTable docs={pending} mode="pending" />
    </Section>
    <Section title="All Documents" sub="Every document in the system, from Boxing Canada and every PTSO." actions={<Btn variant="primary" onClick={() => setUpload(true)}>Upload a Document</Btn>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="field max-w-[240px]" value={src} onChange={e => setSrc(e.target.value)} aria-label="Source"><option value="">All sources</option><option value="national">Boxing Canada</option>{provs.map(p => <option key={p} value={p}>{PROVINCE_INFO[p].ptso}</option>)}</select>
        <select className="field max-w-[220px]" value={aud} onChange={e => setAud(e.target.value)} aria-label="User group"><option value="">All user groups</option>{[...DOC_AUDIENCES, 'nationalteam', 'public'].map(a => <option key={a} value={a}>{DOC_AUDIENCE_LABEL[a]}</option>)}</select>
        <select className="field max-w-[220px]" value={stat} onChange={e => setStat(e.target.value)} aria-label="Status"><option value="">All statuses</option>{Object.entries(DOC_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select>
      </div>
      <DocAdminTable docs={all} />
    </Section>
    {upload && <DocUploadModal onClose={() => setUpload(false)} />}
  </div>;
}

/* =========================================================
   National Calendar
   Created by coaches, officials, medical officials and
   administrators. Provincial events need PTSO and NSO
   approval; national events need NSO approval. Sanctioned
   competitions appear automatically.
   ========================================================= */
const CAL_TYPES = { 'Sanctioned Competition': '#C8102E', 'PTSO Meeting': '#64748B', 'Coaching Course': '#1D4E89', 'Officiating Course': '#7C3AED', 'Medical Course': '#0E7490', 'Training Camp': '#1C7548', 'Open Sparring': '#B7791F', 'Other': '#475569' };
const CAL_CREATE_TYPES = Object.keys(CAL_TYPES).filter(t => t !== 'Sanctioned Competition');
const CAL_CREATORS = ['coach', 'official', 'medical', 'ptso', 'nsoadmin'];
function makeCalendar() {
  const C = o => ({ description: '', endDate: o.startDate, startTime: '', endTime: '', hostClub: '', contactName: '', contactEmail: '', link: '', ptsoApproval: null, nsoApproval: null, rejection: null, createdAt: '2026-10-10T10:00:00', ...o });
  return [
    C({ id: 'cal-1', title: 'Boxing Ontario Board Meeting', type: 'PTSO Meeting', province: 'ON', location: 'Boxing Ontario office and online', startDate: '2026-11-12', startTime: '19:00', endTime: '21:00', description: 'Quarterly board meeting. Members may observe the open session online.', contactName: 'Claire Vance', contactEmail: 'claire.vance@example.ca', createdBy: 'u-p1', ptsoApproval: { by: 'u-p1', at: '2026-10-05T10:00:00' }, nsoApproval: { by: 'u-s1', at: '2026-10-06T10:00:00' } }),
    C({ id: 'cal-2', title: 'NCCP Competition Coach: Introduction', type: 'Coaching Course', province: 'ON', location: 'Bytown Boxing Club, Ottawa', hostClub: 'Bytown Boxing Club', startDate: '2026-11-21', endDate: '2026-11-22', startTime: '09:00', endTime: '17:00', description: 'Two-day NCCP course for new competition coaches. Lunch included.', contactName: 'Marc Bélanger', contactEmail: 'marc.belanger@example.ca', createdBy: 'u-c1', ptsoApproval: { by: 'u-p1', at: '2026-10-18T10:00:00' } }),
    C({ id: 'cal-3', title: 'Level 1 Officials Course', type: 'Officiating Course', province: 'QC', location: 'Centre sportif Mont-Royal, Montréal', hostClub: 'Club de boxe Mont-Royal', startDate: '2026-11-14', endDate: '2026-11-15', startTime: '09:00', endTime: '16:00', description: 'Theory and practical judging for new officials. Bilingual delivery.', contactName: 'Jean-Luc Picard', contactEmail: 'jeanluc.picard@example.ca', createdBy: 'u-o1', ptsoApproval: { byName: 'Nathalie Gagné', at: '2026-10-08T10:00:00' }, nsoApproval: { by: 'u-s1', at: '2026-10-09T10:00:00' } }),
    C({ id: 'cal-4', title: 'Open Sparring Night', type: 'Open Sparring', province: 'ON', location: 'Bytown Boxing Club, Ottawa', hostClub: 'Bytown Boxing Club', startDate: '2026-10-29', startTime: '18:30', endTime: '20:30', description: 'Supervised sparring for registered members. Bring your Record Book, headguard and mouthguard.', contactName: 'Marc Bélanger', contactEmail: 'marc.belanger@example.ca', createdBy: 'u-c1', createdAt: '2026-10-22T10:00:00' }),
    C({ id: 'cal-5', title: 'Eastern Canada Training Camp', type: 'Training Camp', province: 'ON', location: 'Carleton Athletics Centre, Ottawa', startDate: '2026-12-12', endDate: '2026-12-14', description: 'Invitational camp for Youth and Elite athletes from Ontario, Québec and the Atlantic provinces.', contactName: 'Philippe St-Laurent', contactEmail: 'philippe.stlaurent@example.ca', createdBy: 'u-s1', nsoApproval: { by: 'u-s1', at: '2026-10-20T10:00:00' } }),
    C({ id: 'cal-6', title: 'Ringside Physician Workshop', type: 'Medical Course', province: 'national', location: 'Online', startDate: '2026-11-05', startTime: '18:00', endTime: '20:00', description: 'Concussion assessment and post-bout rest decisions for event medical practitioners.', contactName: 'Dr. Elena Rostova', contactEmail: 'elena.rostova@example.ca', createdBy: 'u-m1', createdAt: '2026-10-21T10:00:00' }),
    C({ id: 'cal-7', title: 'Boxing Canada Annual General Meeting', type: 'Other', province: 'national', location: 'Online', startDate: '2026-11-28', startTime: '13:00', endTime: '16:00', description: 'Annual general meeting of members.', contactName: 'Philippe St-Laurent', contactEmail: 'philippe.stlaurent@example.ca', createdBy: 'u-s1', nsoApproval: { by: 'u-s1', at: '2026-09-15T10:00:00' } })
  ];
}
const calNeedsPtso = e => e.province !== 'national';
function calStatus(e) {
  if (e.derived) return { key: 'published', tone: 'ok', label: 'Published' };
  if (e.rejection) return { key: 'rejected', tone: 'bad', label: 'Not approved' };
  const p = !calNeedsPtso(e) || !!e.ptsoApproval, n = !!e.nsoApproval;
  if (p && n) return { key: 'published', tone: 'ok', label: 'Published' };
  return { key: 'pending', tone: 'warn', label: !p && !n ? 'Awaiting PTSO and NSO approval' : !p ? 'Awaiting PTSO approval' : 'Awaiting NSO approval' };
}
const calCanPtso = (e, v) => !e.derived && !e.rejection && calNeedsPtso(e) && !e.ptsoApproval && v.role === 'ptso' && v.province === e.province;
const calCanNso = (e, v) => !e.derived && !e.rejection && !e.nsoApproval && v.role === 'nsoadmin';
const calWhere = e => e.province === 'national' ? 'National' : PROVINCE_INFO[e.province].name;
function calAllEvents(data) {
  const comps = data.events.map(ev => ({ id: 'comp-' + ev.id, derived: true, eventId: ev.id, title: ev.name, type: 'Sanctioned Competition', province: ev.province, location: ev.location, startDate: ev.date, endDate: ev.endDate || ev.date, startTime: ev.firstBoutTime || '', endTime: '', isPublic: ev.isPublic !== false, link: ev.livestreamUrl || '', description: `Sanctioned competition. 1st pre-bout check ${fmtDT(ev.firstPreBoutCheckDateTime)}. ${ev.weightClasses.length} weight classes.`, hostClub: '', contactName: '', contactEmail: '' }));
  return [...comps, ...(data.calendar || [])];
}
function calVisible(data, v) {
  return calAllEvents(data).filter(e => {
    if (v.role === 'public') return calStatus(e).key === 'published' && calIsPublic(e);
    if (calStatus(e).key === 'published') return true;
    if (e.createdBy === v.id) return true;
    if (v.role === 'nsoadmin') return true;
    if (v.role === 'ptso' && e.province === v.province) return true;
    return false;
  });
}
const calPendingFor = (data, v) => (data.calendar || []).filter(e => calCanPtso(e, v) || calCanNso(e, v));
const calTime = e => e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : 'All day';
const calDates = e => e.endDate && e.endDate !== e.startDate ? `${fmtDate(e.startDate)} to ${fmtDate(e.endDate)}` : fmtDate(e.startDate);
/* ---------- Calendar exports: iCalendar (.ics) and CSV ---------- */
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); }
const icsDate = d => d.replace(/-/g, '');
const icsDT = (d, t) => icsDate(d) + 'T' + t.replace(':', '') + '00';
function plusMinutes(t, n) { const [h, m] = t.split(':').map(Number); const tot = Math.min(h * 60 + m + n, 23 * 60 + 59); return String(Math.floor(tot / 60)).padStart(2, '0') + ':' + String(tot % 60).padStart(2, '0'); }
const calOrganizer = e => e.type === 'Sanctioned Competition' ? (e.province && PROVINCE_INFO[e.province] ? PROVINCE_INFO[e.province].ptso : 'Boxing Canada') : e.province === 'national' ? 'Boxing Canada' : (e.hostClub || PROVINCE_INFO[e.province].ptso);
function toIcs(events, calName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Boxing Canada//National Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (calName) L.push('X-WR-CALNAME:' + icsEsc(calName));
  events.forEach(e => {
    const end = e.endDate || e.startDate;
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '@boxingcanada.example', 'DTSTAMP:' + stamp);
    if (e.startTime) { const days = daysBetween(e.startDate, end) + 1; L.push('DTSTART:' + icsDT(e.startDate, e.startTime)); L.push('DTEND:' + icsDT(e.startDate, e.endTime && e.endTime > e.startTime ? e.endTime : plusMinutes(e.startTime, 120))); if (days > 1) L.push('RRULE:FREQ=DAILY;COUNT=' + days); }
    else { L.push('DTSTART;VALUE=DATE:' + icsDate(e.startDate)); L.push('DTEND;VALUE=DATE:' + icsDate(addDays(end, 1))); }
    L.push('SUMMARY:' + icsEsc(e.title), 'LOCATION:' + icsEsc(e.location), 'CATEGORIES:' + icsEsc(e.type));
    const desc = [e.description, `Type: ${e.type}`, `Where: ${calWhere(e)}`, `Organizer: ${calOrganizer(e)}`, e.contactName || e.contactEmail ? `Contact: ${[e.contactName, e.contactEmail].filter(Boolean).join(', ')}` : '', e.link ? `More information: ${e.link}` : ''].filter(Boolean).join('\n');
    L.push('DESCRIPTION:' + icsEsc(desc));
    if (/^https?:\/\//i.test(e.link || '')) L.push('URL:' + e.link);
    if (e.contactEmail) L.push('ORGANIZER;CN="' + String(e.contactName || calOrganizer(e)).replace(/"/g, '') + '":mailto:' + e.contactEmail);
    L.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
const CAL_CSV_COLUMNS = [
  ['Event ID', e => e.id], ['Title', e => e.title], ['Type', e => e.type], ['Province/Territory Code', e => e.province === 'national' ? '' : e.province], ['Province/Territory', e => calWhere(e)],
  ['Start Date', e => e.startDate], ['End Date', e => e.endDate || e.startDate], ['Start Time', e => e.startTime || ''], ['End Time', e => e.endTime || ''], ['All Day', e => e.startTime ? 'No' : 'Yes'],
  ['Location', e => e.location], ['Host Club', e => e.hostClub || ''], ['Organizer', e => calOrganizer(e)], ['Contact Name', e => e.contactName || ''], ['Contact Email', e => e.contactEmail || ''],
  ['Registration or Info Link', e => e.link || ''], ['Description', e => e.description || ''], ['Status', e => calStatus(e).label], ['Source', e => e.derived ? 'Sanctioned competition' : 'Calendar submission'],
  ['PTSO Approval', (e, d) => e.derived ? 'Approved sanction' : !calNeedsPtso(e) ? 'Not required' : e.ptsoApproval ? `${e.ptsoApproval.byName || nameOf(d, e.ptsoApproval.by)} ${e.ptsoApproval.at.slice(0, 10)}` : 'Pending'],
  ['NSO Approval', (e, d) => e.derived ? 'Approved sanction' : e.nsoApproval ? `${e.nsoApproval.byName || nameOf(d, e.nsoApproval.by)} ${e.nsoApproval.at.slice(0, 10)}` : 'Pending'],
  ['Added By', (e, d) => e.derived ? 'Sanction system' : nameOf(d, e.createdBy)]
];
function calCsv(events, d) {
  const q = v => { const s = String(v == null ? '' : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '\uFEFF' + [CAL_CSV_COLUMNS.map(c => q(c[0])).join(','), ...events.map(e => CAL_CSV_COLUMNS.map(c => q(c[1](e, d))).join(','))].join('\r\n') + '\r\n';
}
const calSlug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
function CalExportModal({ initialProv, initialTypes, month, onClose }) {
  const { data, viewer, notify } = useApp();
  const [prov, setProv] = useState(initialProv);
  const [types, setTypes] = useState(initialTypes);
  const [range, setRange] = useState('upcoming');
  const monthEnd = addDays(month + '-01', 40).slice(0, 7) + '-01';
  const list = calAllEvents(data).filter(e => calStatus(e).key === 'published' && (viewer.role !== 'public' || calIsPublic(e)))
    .filter(e => prov === 'all' || (prov === 'mine' ? (e.province === 'national' || e.province === viewer.province) : e.province === prov))
    .filter(e => !types.length || types.includes(e.type))
    .filter(e => range === 'all' || (range === 'upcoming' ? (e.endDate || e.startDate) >= REF_DATE : ((e.endDate || e.startDate) >= month + '-01' && e.startDate < monthEnd)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || ''));
  const scope = prov === 'all' ? 'canada' : prov === 'mine' ? (viewer.province + '-and-national') : prov;
  const base = `boxing-canada-calendar-${scope.toLowerCase()}-${range === 'month' ? month : range}`;
  const dl = async kind => {
    if (!list.length) { notify('No published events match these choices.', 'warn'); return; }
    const r = kind === 'csv' ? await saveFile(base + '.csv', calCsv(list, data)) : await saveFile(base + '.ics', toIcs(list, 'Boxing Canada events'));
    notify(r.ok ? `${r.msg} ${list.length} event${list.length === 1 ? '' : 's'} included.` : r.msg, r.ok ? 'ok' : 'warn');
  };
  return <Modal size="lg" title="Export Calendar Events" subtitle="Published events only. Use the CSV for provincial or club websites, or the .ics file to subscribe in Outlook, Apple Calendar or Google Calendar." onClose={onClose}
    footer={<><Btn onClick={onClose}>Close</Btn><Btn onClick={() => dl('ics')}>Download .ics ({list.length})</Btn><Btn variant="primary" onClick={() => dl('csv')}>Download CSV ({list.length})</Btn></>}>
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Province or territory"><select className="field" value={prov} onChange={e => setProv(e.target.value)}>{viewer.role !== 'nsoadmin' && viewer.province && <option value="mine">{PROVINCE_INFO[viewer.province].name} and national</option>}<option value="all">All of Canada</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name} only</option>)}</select></Field>
        <Field label="Dates"><select className="field" value={range} onChange={e => setRange(e.target.value)}><option value="upcoming">Upcoming (from {fmtDate(REF_DATE)})</option><option value="month">{new Date(toUTC(month + '-01')).toLocaleDateString(uiLocale(), { timeZone: 'UTC', month: 'long', year: 'numeric' })} only</option><option value="all">All dates, past and future</option></select></Field>
      </div>
      <Field label="Event types" hint={types.length ? '' : 'All types included.'}><div className="flex flex-wrap gap-1.5">{Object.keys(CAL_TYPES).map(t => { const on = types.includes(t); return <button key={t} type="button" aria-pressed={on} onClick={() => setTypes(s => on ? s.filter(x => x !== t) : [...s, t])} className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', on ? 'border-ink bg-sunk text-ink' : types.length ? 'border-line text-muted opacity-60' : 'border-line text-ink')}><TypeDot type={t} />{t}</button>; })}</div></Field>
      <div className="rounded-md border border-line">
        <div className="border-b border-line bg-sunk px-3 py-2 text-sm font-semibold">{list.length} event{list.length === 1 ? '' : 's'} will be exported</div>
        <ul className="max-h-56 divide-y divide-line overflow-y-auto text-sm">{list.map(e => <li key={e.id} className="flex items-center gap-2 px-3 py-1.5"><TypeDot type={e.type} /><span className="min-w-0 flex-1 truncate">{e.title}</span><span className="whitespace-nowrap text-xs text-muted">{calDates(e)}</span><Badge tone={e.province === 'national' ? 'bad' : 'info'}>{e.province === 'national' ? 'National' : e.province}</Badge></li>)}{!list.length && <li className="px-3 py-4 text-center text-muted">No published events match.</li>}</ul>
      </div>
      <p className="text-xs text-muted">The CSV has one row per event and {CAL_CSV_COLUMNS.length} columns: {CAL_CSV_COLUMNS.map(c => c[0]).join(', ')}. It opens directly in Excel with accents intact.</p>
    </div>
  </Modal>;
}
const TypeDot = ({ type }) => <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAL_TYPES[type] || '#475569' }} aria-hidden="true" />;

function CalEditModal({ initial, onClose }) {
  const { update, viewer, notify } = useApp();
  const editing = !!initial;
  const [f, setF] = useState(() => initial ? { ...initial } : { title: '', type: CAL_CREATE_TYPES[0], province: viewer.role === 'nsoadmin' ? 'national' : viewer.province, location: '', hostClub: viewer.club || '', startDate: '', endDate: '', startTime: '', endTime: '', description: '', contactName: fullName(viewer), contactEmail: viewer.email, link: '', isPublic: false });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.title.trim() || !f.startDate || !f.location.trim()) { setErr('Add a title, start date and location.'); return; }
    if (f.endDate && f.endDate < f.startDate) { setErr('The end date can’t be before the start date.'); return; }
    if (f.startTime && f.endTime && (!f.endDate || f.endDate === f.startDate) && f.endTime <= f.startTime) { setErr('The end time must be after the start time.'); return; }
    const autoPtso = f.province !== 'national' && viewer.role === 'ptso' && viewer.province === f.province ? { by: viewer.id, at: nowIso() } : null;
    const autoNso = viewer.role === 'nsoadmin' ? { by: viewer.id, at: nowIso() } : null;
    const rec = { ...f, id: f.id || uid('cal'), title: f.title.trim(), endDate: f.endDate || f.startDate, createdBy: f.createdBy || viewer.id, createdAt: f.createdAt || nowIso(), ptsoApproval: autoPtso || (initial && viewer.role === 'nsoadmin' ? initial.ptsoApproval || null : null), nsoApproval: autoNso, rejection: null };
    update(d => { d.calendar = d.calendar || []; const i = d.calendar.findIndex(x => x.id === rec.id); if (i >= 0) d.calendar[i] = rec; else d.calendar.push(rec); });
    const st = calStatus(rec);
    notify(st.key === 'published' ? `“${rec.title}” is on the calendar.` : `“${rec.title}” submitted. ${st.label}.`);
    onClose();
  };
  const needs = f.province === 'national' ? 'Needs approval from a Boxing Canada NSO Administrator.' : `Needs approval from ${PROVINCE_INFO[f.province].ptso} and from Boxing Canada.`;
  return <Modal size="lg" title={editing ? 'Edit & Resubmit Calendar Event' : 'Add a Calendar Event'} subtitle={needs} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? 'Resubmit' : 'Submit event'}</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" required className="sm:col-span-2"><input className="field" value={f.title} onChange={e => set('title', e.target.value)} /></Field>
        <Field label="Type of event"><select className="field" value={f.type} onChange={e => set('type', e.target.value)}>{CAL_CREATE_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Province or territory"><select className="field" value={f.province} onChange={e => set('province', e.target.value)}><option value="national">National or online (no province)</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></Field>
        <Field label="Start date" required><input type="date" className="field" value={f.startDate} onChange={e => set('startDate', e.target.value)} /></Field>
        <Field label="End date (if more than one day)"><input type="date" className="field" value={f.endDate} onChange={e => set('endDate', e.target.value)} /></Field>
        <Field label="Start time"><input type="time" className="field" value={f.startTime} onChange={e => set('startTime', e.target.value)} /></Field>
        <Field label="End time"><input type="time" className="field" value={f.endTime} onChange={e => set('endTime', e.target.value)} /></Field>
        <Field label="Location" required className="sm:col-span-2"><input className="field" placeholder="Venue and city, or Online" value={f.location} onChange={e => set('location', e.target.value)} /></Field>
        <Field label="Host club (if any)"><input className="field" value={f.hostClub} onChange={e => set('hostClub', e.target.value)} /></Field>
        <Field label="Registration or info link"><input className="field" placeholder="https://" value={f.link} onChange={e => set('link', e.target.value)} /></Field>
        <Field label="Contact name"><input className="field" value={f.contactName} onChange={e => set('contactName', e.target.value)} /></Field>
        <Field label="Contact email"><input type="email" className="field" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></Field>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!f.isPublic} onChange={e => set('isPublic', e.target.checked)} /><span><b>Show on the public calendar.</b> Anyone can see it without signing in, once it is approved.</span></label>
        <Field label="Description" className="sm:col-span-2"><textarea rows={3} className="field" value={f.description} onChange={e => set('description', e.target.value)} /></Field>
      </div>
    </div>
  </Modal>;
}

function CalEventModal({ ev, onClose, onEdit }) {
  const { data, update, viewer, notify, go } = useApp();
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const e = ev.derived ? ev : ((data.calendar || []).find(x => x.id === ev.id) || ev);
  const st = calStatus(e);
  const approve = stage => { update(d => { const x = d.calendar.find(y => y.id === e.id); x[stage === 'ptso' ? 'ptsoApproval' : 'nsoApproval'] = { by: viewer.id, at: nowIso() }; }); const after = calStatus({ ...e, [stage === 'ptso' ? 'ptsoApproval' : 'nsoApproval']: { by: viewer.id } }); notify(after.key === 'published' ? `“${e.title}” approved and published to the calendar.` : `“${e.title}” approved. ${after.label}.`); };
  const reject = () => { if (!reason.trim()) { setErr('Give the organizer a reason.'); return; } update(d => { const x = d.calendar.find(y => y.id === e.id); x.rejection = { by: viewer.id, at: nowIso(), reason: reason.trim(), stage: viewer.role === 'ptso' ? 'PTSO' : 'NSO' }; }); notify(`“${e.title}” was not approved.`, 'warn'); onClose(); };
  const del = () => { update(d => { d.calendar = d.calendar.filter(y => y.id !== e.id); }); notify(`“${e.title}” removed from the calendar.`, 'warn'); onClose(); };
  const canDelete = !e.derived && (e.createdBy === viewer.id || viewer.role === 'nsoadmin' || (viewer.role === 'ptso' && e.province === viewer.province));
  const canEdit = !e.derived && (e.createdBy === viewer.id || viewer.role === 'nsoadmin');
  const appr = a => a ? `${a.byName || nameOf(data, a.by)}, ${fmtStamp(a.at)}` : null;
  const roleTabs = ROLES[viewer.role] ? ROLES[viewer.role].tabs : [];
  const canPublic = viewer.role === 'nsoadmin' || (viewer.role === 'ptso' && e.province === viewer.province) || (!e.derived && e.createdBy === viewer.id);
  const setPublic = v => { update(d => { if (e.derived) { const x = d.events.find(y => y.id === e.eventId); if (x) x.isPublic = v; } else { const x = d.calendar.find(y => y.id === e.id); if (x) x.isPublic = v; } }); notify(v ? `“${e.title}” will show on the public calendar once published.` : `“${e.title}” is now members only.`); };
  const downloadIcs = async () => { const r = await saveFile(`${calSlug(e.title)}-${e.startDate}.ics`, toIcs([e])); notify(r.ok ? `${r.msg} Open it to add the event to Outlook, Apple Calendar or Google Calendar.` : r.msg, r.ok ? 'ok' : 'warn'); };
  return <Modal size="lg" title={e.title} subtitle={`${e.type} · ${calWhere(e)}`} onClose={onClose}
    footer={<>
      <Btn variant="primary" onClick={downloadIcs}>📅 Add to my calendar (.ics)</Btn>
      {e.derived && roleTabs.includes('EVENTS') && <Btn variant="rope" onClick={() => { onClose(); go('EVENTS', { focusEventId: e.eventId }); }}>Open in Competition Events</Btn>}
      {canEdit && <Btn onClick={() => onEdit(e)}>{e.rejection ? 'Edit & resubmit' : 'Edit'}</Btn>}
      {canDelete && <Btn variant="danger" onClick={del}>Remove</Btn>}
      <Btn onClick={onClose}>Close</Btn>
    </>}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-semibold"><TypeDot type={e.type} />{e.type}</span><Badge tone={st.tone}>{st.label}</Badge>{e.province !== 'national' ? <Badge tone="info">{e.province}</Badge> : <Badge tone="bad">🍁 National</Badge>}</div>
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-line bg-sunk p-3 text-sm sm:grid-cols-3">
        {[['Dates', calDates(e)], ['Time', calTime(e)], ['Location', e.location], ['Host club', e.hostClub], ['Contact', [e.contactName, e.contactEmail].filter(Boolean).join(', ')], ['Added by', e.derived ? 'Created from the approved sanction' : nameOf(data, e.createdBy)]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v || '—'}</dd></div>)}
      </dl>
      {e.description && <p className="max-w-prose text-sm">{e.description}</p>}
      {e.link && <p className="text-sm">More information: <span className="font-semibold text-rope break-all">{e.link}</span></p>}
      {viewer.role !== 'public' && <div className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2 text-sm"><span>{calIsPublic(e) ? '🌐 Shown on the public calendar (no sign-in needed)' : '🔒 Members only'}</span>{canPublic && <label className="ml-auto flex items-center gap-2 font-semibold"><input type="checkbox" className="h-4 w-4" checked={calIsPublic(e)} onChange={x => setPublic(x.target.checked)} />Public</label>}</div>}
      {!e.derived && viewer.role !== 'public' && <div className="rounded-md border border-line p-3">
        <h4 className="mb-2 font-display text-base font-bold">Approvals</h4>
        <ul className="space-y-1.5 text-sm">
          {calNeedsPtso(e) && <li className="flex flex-wrap items-center gap-2">{e.ptsoApproval ? <Badge tone="ok">✓ PTSO</Badge> : <Badge tone="warn">PTSO pending</Badge>}<span>{PROVINCE_INFO[e.province].ptso}{e.ptsoApproval ? `: ${appr(e.ptsoApproval)}` : ''}</span></li>}
          <li className="flex flex-wrap items-center gap-2">{e.nsoApproval ? <Badge tone="ok">✓ NSO</Badge> : <Badge tone="warn">NSO pending</Badge>}<span>Boxing Canada{e.nsoApproval ? `: ${appr(e.nsoApproval)}` : ''}</span></li>
        </ul>
        {e.rejection && <Banner tone="bad" className="mt-2">Not approved by the {e.rejection.stage} ({nameOf(data, e.rejection.by)}, {fmtStamp(e.rejection.at)}): {e.rejection.reason}</Banner>}
        {(calCanPtso(e, viewer) || calCanNso(e, viewer)) && <div className="mt-3 space-y-2 border-t border-line pt-3">
          {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
          {mode === 'reject' ? <><Field label="Reason shared with the organizer" required><textarea rows={3} className="field" value={reason} onChange={x => setReason(x.target.value)} /></Field><div className="flex justify-end gap-2"><Btn onClick={() => setMode(null)}>Back</Btn><Btn variant="danger" onClick={reject}>Don’t approve</Btn></div></>
            : <div className="flex flex-wrap justify-end gap-2"><Btn variant="danger" onClick={() => setMode('reject')}>Don’t approve</Btn><Btn variant="ok" onClick={() => approve(calCanPtso(e, viewer) ? 'ptso' : 'nso')}>Approve for {calCanPtso(e, viewer) ? PROVINCE_INFO[e.province].ptso : 'Boxing Canada'}</Btn></div>}
        </div>}
      </div>}
    </div>
  </Modal>;
}

function CalendarView() {
  const { data, viewer } = useApp();
  const [month, setMonth] = useState(REF_DATE.slice(0, 7));
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640) ? 'list' : 'month');
  const [prov, setProv] = useState(viewer.role === 'nsoadmin' || viewer.role === 'public' ? 'all' : 'mine');
  const [types, setTypes] = useState([]);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [day, setDay] = useState(null);
  const [exporting, setExporting] = useState(false);
  const canCreate = CAL_CREATORS.includes(viewer.role);
  const all = calVisible(data, viewer);
  const shown = all.filter(e => (prov === 'all' || (prov === 'mine' ? (e.province === 'national' || e.province === viewer.province) : e.province === prov)) && (!types.length || types.includes(e.type)) && calStatus(e).key !== 'rejected');
  const on = d => shown.filter(e => e.startDate <= d && (e.endDate || e.startDate) >= d).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const pending = calPendingFor(data, viewer);
  const mine = (data.calendar || []).filter(e => e.createdBy === viewer.id && calStatus(e).key !== 'published');
  const [y, m] = month.split('-').map(Number);
  const first = month + '-01';
  const start = addDays(first, -new Date(toUTC(first)).getUTCDay());
  let cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  if (cells[35].slice(0, 7) !== month) cells = cells.slice(0, 35);
  const shift = n => { const dt = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(dt.toISOString().slice(0, 7)); };
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(uiLocale(), { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const listItems = shown.filter(e => (e.endDate || e.startDate) >= first && e.startDate <= addDays(cells[cells.length - 1], 0)).sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || ''));
  const Chip = ({ e }) => { const pend = calStatus(e).key === 'pending'; return <button type="button" onClick={() => setOpen(e)} title={`${e.title} (${e.type}${pend ? ', awaiting approval' : ''})`} style={{ borderLeftColor: CAL_TYPES[e.type] }} className={cx('block w-full truncate rounded-sm border-l-[3px] px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-ropesoft', pend ? 'border-dashed bg-warnsoft italic' : 'bg-sunk')}>{e.startTime && e.startDate === e.startDate ? <span className="tabular-nums text-muted">{e.startTime} </span> : null}{e.title}</button>; };
  return <div className="space-y-4">
    {pending.length > 0 && <Section title="Events awaiting your approval" sub={viewer.role === 'ptso' ? `Events in ${PROVINCE_INFO[viewer.province].name} need your approval and Boxing Canada’s.` : 'Every calendar event needs Boxing Canada approval. Provincial events also need their PTSO.'} actions={<Badge tone="warn">{pending.length} waiting</Badge>}>
      <Table head={['Event', 'Type', 'Where', 'Dates', 'Submitted by', 'Status', '']}>
        {pending.map(e => { const st = calStatus(e); return <tr key={e.id} className="bg-warnsoft"><Td className="font-semibold">{e.title}</Td><Td><span className="inline-flex items-center gap-1.5"><TypeDot type={e.type} />{e.type}</span></Td><Td>{calWhere(e)}</Td><Td className="whitespace-nowrap">{calDates(e)}</Td><Td>{nameOf(data, e.createdBy)}</Td><Td><Badge tone={st.tone}>{st.label}</Badge></Td><Td className="text-right"><Btn size="sm" variant="primary" onClick={() => setOpen(e)}>Review</Btn></Td></tr>; })}
      </Table>
    </Section>}
    <Section logo title="National Calendar" sub="Competitions, meetings, courses, camps and open sparring across Canada." actions={<div className="flex flex-wrap gap-2"><Btn onClick={() => setExporting(true)}>Export CSV / .ics</Btn>{canCreate && <Btn variant="primary" onClick={() => setEdit('new')}>Add Event</Btn>}</div>}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1"><Btn size="sm" onClick={() => shift(-1)} aria-label="Previous month">‹</Btn><h3 className="min-w-[150px] text-center font-display text-xl font-bold">{monthName}</h3><Btn size="sm" onClick={() => shift(1)} aria-label="Next month">›</Btn><Btn size="sm" variant="ghost" onClick={() => setMonth(REF_DATE.slice(0, 7))}>Today</Btn></div>
        <div className="inline-flex rounded-md border border-line p-0.5">{[['month', 'Month'], ['list', 'List']].map(([k, l]) => <button key={k} type="button" onClick={() => setView(k)} className={cx('rounded px-3 py-1 text-xs font-semibold', view === k ? 'bg-rope text-white' : 'text-muted hover:bg-sunk')}>{l}</button>)}</div>
        <select className="field ml-auto w-auto" value={prov} onChange={e => setProv(e.target.value)} aria-label="Province">{viewer.role !== 'nsoadmin' && viewer.province && <option value="mine">{PROVINCE_INFO[viewer.province].name} and national</option>}<option value="all">All of Canada</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name} only</option>)}</select>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">{Object.keys(CAL_TYPES).map(t => { const onT = types.includes(t); return <button key={t} type="button" aria-pressed={onT} onClick={() => setTypes(s => onT ? s.filter(x => x !== t) : [...s, t])} className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', onT ? 'border-ink bg-sunk text-ink' : types.length ? 'border-line text-muted opacity-60' : 'border-line text-ink')}><TypeDot type={t} />{t}</button>; })}{types.length > 0 && <button type="button" className="text-xs font-semibold text-rope" onClick={() => setTypes([])}>Show all types</button>}</div>
      {view === 'month' ? <div className="overflow-x-auto"><div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-line text-center text-xs font-semibold text-muted">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1.5">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-px bg-line">{cells.map(d => { const list = on(d), inMonth = d.slice(0, 7) === month, today = d === REF_DATE; return <div key={d} className={cx('min-h-[96px] p-1', inMonth ? 'bg-surface' : 'bg-sunk')}>
          <div className={cx('mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums', today ? 'bg-maple text-white' : inMonth ? 'text-ink' : 'text-muted')}>{Number(d.slice(8))}</div>
          <div className="space-y-0.5">{list.slice(0, 3).map(e => <Chip key={e.id} e={e} />)}{list.length > 3 && <button type="button" className="text-[11px] font-semibold text-rope" onClick={() => setDay(d)}>+{list.length - 3} more</button>}</div>
        </div>; })}</div>
      </div></div>
        : <div className="divide-y divide-line rounded-md border border-line">{listItems.length ? listItems.map(e => { const st = calStatus(e); return <button key={e.id} type="button" onClick={() => setOpen(e)} className="flex w-full flex-wrap items-start gap-3 px-3 py-2.5 text-left hover:bg-sunk">
          <div className="w-14 shrink-0 text-center"><div className="text-xs font-semibold uppercase text-maple">{new Date(toUTC(e.startDate)).toLocaleDateString(uiLocale(), { timeZone: 'UTC', month: 'short' })}</div><div className="font-display text-2xl font-extrabold leading-none">{Number(e.startDate.slice(8))}</div></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><TypeDot type={e.type} /><span className="font-semibold">{e.title}</span>{st.key !== 'published' && <Badge tone={st.tone}>{st.label}</Badge>}</div><div className="text-sm text-muted">{e.type} · {calDates(e)} · {calTime(e)} · {e.location}</div></div>
          <Badge tone={e.province === 'national' ? 'bad' : 'info'}>{e.province === 'national' ? '🍁 National' : e.province}</Badge>
        </button>; }) : <p className="px-3 py-6 text-center text-sm text-muted">No events in {monthName} with these filters.</p>}</div>}
      <p className="mt-2 text-xs text-muted">Dashed italic entries are still awaiting approval and are only visible to their organizer and approvers.</p>
    </Section>
    {mine.length > 0 && <Section title="Your submissions" sub="Events you added that aren’t published yet.">
      <Table head={['Event', 'Dates', 'Where', 'Status', '']}>{mine.map(e => { const st = calStatus(e); return <tr key={e.id}><Td className="font-semibold">{e.title}<div className="text-xs font-normal text-muted">{e.type}</div></Td><Td className="whitespace-nowrap">{calDates(e)}</Td><Td>{calWhere(e)}</Td><Td><Badge tone={st.tone}>{st.label}</Badge>{e.rejection && <div className="mt-1 max-w-xs text-xs text-maple">{e.rejection.reason}</div>}</Td><Td className="text-right"><Btn size="sm" onClick={() => setOpen(e)}>Open</Btn></Td></tr>; })}</Table>
    </Section>}
    {day && <Modal size="md" title={fmtDate(day)} onClose={() => setDay(null)}><div className="space-y-1.5">{on(day).map(e => <button key={e.id} type="button" onClick={() => { setDay(null); setOpen(e); }} className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-sunk"><TypeDot type={e.type} /><span className="font-semibold">{e.title}</span><span className="ml-auto text-xs text-muted">{calTime(e)}</span></button>)}</div></Modal>}
    {open && <CalEventModal ev={open} onClose={() => setOpen(null)} onEdit={e => { setOpen(null); setEdit(e); }} />}
    {edit && <CalEditModal initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    {exporting && <CalExportModal initialProv={prov} initialTypes={types} month={month} onClose={() => setExporting(false)} />}
  </div>;
}

/* =========================================================
   Trackie membership data
   Every user carries a `trackie` record keyed by the exact
   column headers of the Trackie member export, so a Trackie
   CSV can be imported (and re-imported) without remapping.
   ========================================================= */
const TRACKIE_GROUPS = [
  { key: 'registration', label: 'Registration & membership', fields: ['MEMBER #', 'REGISTRATION DATE', 'NEW APPLICANT OR RENEWAL', 'MEMBERSHIP TYPE', 'CATEGORY', 'SEASON YEAR', 'NSO JOIN DATE', 'NSO EXPIRY', 'NSO DAYS TO EXPIRY', 'PTSO', 'CLUB NAME', 'CLUB EXPIRY DATE', 'CLUB DAYS TO EXPIRY', 'DIVISION #', 'REMOVED', 'REMOVED DATE', 'PROOF OF AGE DOCUMENT (ACCEPTED DOCUMENTS INCLUDE: BIRTH CERTIFICATE  PASSPORT OR HEALTH CARD)', 'ADDITIONAL DOCUMENTS TO UPLOAD'] },
  { key: 'personal', label: 'Personal', fields: ['FIRST NAME', 'LAST NAME', 'FULL NAME', 'GENDER', 'WHAT IS YOUR GENDER IDENTITY', 'DATE OF BIRTH', 'AGE (AS OF JAN. 1)', 'AGE (AS OF DEC. 31)', 'AGE (AS OF TODAY)', 'CITIZENSHIP', 'LANGUAGES SPOKEN (MULTIPLE ANSWERS POSSIBLE)', 'T-SHIRT SIZE'] },
  { key: 'contact', label: 'Contact', fields: ['INDIVIDUAL EMAIL', 'EMAIL OPT IN', 'PHONE NUMBER', 'PHONE NUMBER 2', 'ADDRESS', 'ADDRESS 2', 'CITY', 'PROVINCE/TERRITORY/STATE', 'COUNTRY', 'POSTAL CODE'] },
  { key: 'emergency', label: 'Emergency contact & parent/guardian', fields: ['EMERGENCY CONTACT NAME', 'EMERGENCY CONTACT RELATIONSHIP', 'EMERGENCY CONTACT PHONE', 'PARENT/GUARDIAN NAME', 'PARENT/GUARDIAN RELATIONSHIP', 'PARENT/GUARDIAN PHONE', 'PARENT/GUARDIAN EMAIL'] },
  { key: 'coaching', label: 'Coaching & officiating', fields: ['NCCP #', 'COACH LEVEL', 'OFFICIAL LEVEL', 'REFEREE/JUDGE', 'DATE OF CRIMINAL RECORD CHECK', "DO YOU HAVE A VALID DRIVER'S LICENSE?", 'DO YOU HAVE A VALID FIRST AID CERTIFICATION (CPR/AED)?', 'WILLINGNESS TO TRAVEL (SELECT ALL THAT APPLY)', 'YOUR EXPERTISE OR SPECIALTY IN SPORTS EVENT MANAGEMENT (MULTIPLE ANSWERS POSSIBLE)', 'PLEASE UPLOAD A CRIMINAL REFERENCE CHECK AND VULNERABLE SECTOR CHECK COMPLETED IN THE LAST 3 YEARS', 'IF YES  UPLOAD FIRST AID CERTIFICATION'] },
  { key: 'medical', label: 'Medical', fields: ['ANNUAL MEDICAL DATE', 'MEDICAL FORM', 'MEDICAL LICENSE NUMBER – UPLOAD LICENSE', 'YEARS OF EXPERIENCE IN SPORTS MEDICINE', 'HOLDS MALPRACTICE/PROFESSIONAL LIABILITY INSURANCE', 'NEED BOXING BOOK'] },
  { key: 'competition', label: 'Competition history', fields: ['WEIGHT (KG)', 'WEIGHT (MUST BE IN KG!)', 'TOTAL NUMBER OF OLYMPIC-STYLE OR AMATEUR BOXING BOUTS', 'NUMBER OF OLYMPIC-STYLE OR AMATEUR BOXING BOUTS WON', 'NUMBER OF OLYMPIC-STYLE OR AMATEUR BOXING BOUTS LOST', 'HOW MANY BOUTS IN MMA  KICKBOXING  MUAY THAI  OR OTHER COMBAT SPORTS', 'HAVE YOU HAD ANY PROFESSIONAL COMBAT SPORTS OR PRIZEFIGHTING EXPERIENCE', 'NUMBER OF BOUTS', 'NUMBER OF EXHIBITIONS', 'NUMBER OF WINS', '# RSCH', '# WINS', '# KO', 'AMATEUR BOUTS', 'WINS', 'PREVIOUS OR CURRENT INVOLVEMENT IN AMATEUR BOXING  KICKBOXING   JUDO OR ANY COMBAT SPORT IN OR OUT THE COUNTRY?', 'IF YES  # BOUTS', 'IF YES  PLEASE EXPLAIN (*NOTE  IT IS IMPORTANT TO LIST PREVIOUS OR CURRENT EXPERIENCE TO CREATE FAIR MATCHES)'] },
  { key: 'waivers', label: 'Waivers & consents', fields: ['BOXING CANADA WAIVER AND RELEASE OF LIABILITY', 'BOXING CANADA CODE OF CONDUCT & ETHICS', 'CONSENT FOR USE OF PERSONAL INFORMATION  COMMERCIAL MESSAGES AND PHOTO RELEASE', 'CONCUSSION CODE OF CONDUCT', 'ASSUMPTION OF RISK AGREEMENT', 'WAIVER OF LIABILITY FOR ALL CLAIMS AND RELEASE OF LIABILITY', 'I UNDERSTAND I MUST COMPLETE SAFE SPORT TRAINING  RESPECT IN SPORT & MAKING HEAD WAY BEFORE MY MEMBERSHIP CAN BE PROCESSED', 'BOXING BC WAIVER AND RELEASE OF LIABILITY', 'BOXING SASKATCHEWAN WAIVER AND RELEASE OF LIABILITY', 'BOXING MANIOBA WAIVER AND RELEASE OF LIABILITY', 'RENONCIATION ET DÉCHARGE DE RESPONSABILITÉ DE BOXE QUÉBEC', 'BOXING ALBERTA CONCUSSION AWARENESS & RISK', 'BOXING ALBERTA GENERAL LIABILITY WAIVER & RELEASE OF CLAIMS'] },
  { key: 'equity', label: 'Equity, diversity & inclusion', sensitive: true, fields: ['INDIGENOUS', 'INDIGENOUS HERITAGE', 'DO YOU SELF-IDENTIFY AS A PERSON WITH A DISABILITY?', 'IF YES  PLEASE INDICATE THE TYPE(S) OF DISABILITY YOU HAVE', 'MILITARY', 'LAW ENFORCEMENT', 'DO YOU HAVE ANY MOBILITY OR ENVIRONMENTAL SENSITIVITIES OR LIMITATIONS?', 'IF YES  PLEASE DESCRIBE HOW WE COULD FACILITATE YOUR VOLUNTEER TASKS.'] },
  { key: 'payment', label: 'Payment', sensitive: true, fields: ['TRANSACTION #', 'PAYMENT TYPE', 'PAYMENT STATUS', 'AMOUNT', 'BILLING NAME', 'BILLING EMAIL', 'BILLING PHONE', 'BILLING ADDRESS', 'BILLING CITY', 'BILLING PROVINCE/STATE', 'BILLING POSTAL CODE', 'BILLING COUNTRY', 'BILLING EMAIL OPT IN', 'PAYMENT ADMIN NOTES', 'PAYMENT WITHDRAW DATE', 'PAYMENT WITHDRAW ID'] },
  { key: 'admin', label: 'Administration', adminOnly: true, fields: ['NOTES', 'SUSPENDED MEMBER (ADD NOTES)', 'EDITED DATE', 'IP ADDRESS'] }
];
const TRACKIE_GROUPED = new Set(TRACKIE_GROUPS.flatMap(g => g.fields));
const PROV_CITY = { AB: ['Edmonton', 'T5J'], BC: ['Vancouver', 'V6B'], MB: ['Winnipeg', 'R3C'], NB: ['Moncton', 'E1C'], NL: ['St. John’s', 'A1C'], NS: ['Halifax', 'B3J'], NT: ['Yellowknife', 'X1A'], NU: ['Iqaluit', 'X0A'], ON: ['Ottawa', 'K1P'], PE: ['Charlottetown', 'C1A'], QC: ['Montréal', 'H2X'], SK: ['Regina', 'S4P'], YT: ['Whitehorse', 'Y1A'] };
const hashNum = (s, mod) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003; return h % mod; };
const ageCat = dob => { const a = 2026 - Number(dob.slice(0, 4)); return a < 13 ? 'U13' : a < 15 ? 'U15' : a < 17 ? 'U17' : a < 19 ? 'U19' : 'Senior'; };
function trackieFromUser(u) {
  const [city, fsa] = PROV_CITY[u.province] || ['Ottawa', 'K1P'];
  const n = hashNum(u.id, 9000) + 1000;
  const type = { boxer: ageCat(u.dob) === 'Senior' ? 'Senior' : ageCat(u.dob) === 'U19' ? 'Youth' : 'Junior B', coach: 'Coach', official: 'Official', medical: 'Recreational', ptso: 'Recreational', nsoadmin: 'Recreational' }[u.role];
  const t = {
    'REGISTRATION DATE': '2026-01-' + String(5 + hashNum(u.id, 20)).padStart(2, '0') + ' 10:15:00', 'NEW APPLICANT OR RENEWAL': 'Renewal',
    'FULL NAME': fullName(u), 'LAST NAME, FIRST NAME': `${u.lastName}, ${u.firstName}`, 'FIRST NAME': u.firstName, 'LAST NAME': u.lastName, 'GENDER': u.gender,
    'DATE OF BIRTH': u.dob, 'YEAR OF BIRTH': u.dob.slice(0, 4), 'MONTH OF BIRTH': String(Number(u.dob.slice(5, 7))), 'DAY OF BIRTH': String(Number(u.dob.slice(8, 10))),
    'AGE (AS OF JAN. 1)': String(2026 - Number(u.dob.slice(0, 4)) - 1), 'AGE (AS OF DEC. 31)': String(2026 - Number(u.dob.slice(0, 4))), 'AGE (AS OF TODAY)': String(ageOn(u.dob, REF_DATE)),
    'MEMBER #': `${u.province}-2026-${u.role === 'coach' ? 'CO' : u.role === 'official' ? 'OF' : 'CH'}-${u.gender}-${n}-${String(100000 + hashNum(u.id + 'x', 899999))}`,
    'MEMBERSHIP TYPE': type, 'CATEGORY': u.role === 'boxer' ? ageCat(u.dob) : 'Senior', 'NSO JOIN DATE': (u.role === 'boxer' ? '2019' : '2012') + '-0' + (1 + hashNum(u.id, 8)) + '-15', 'NSO EXPIRY': '2026-12-31', 'NSO DAYS TO EXPIRY': String(daysBetween(REF_DATE, '2026-12-31')),
    'PTSO': u.province, 'CLUB NAME': u.club || '', 'INDIVIDUAL EMAIL': u.email, 'EMAIL OPT IN': 'Yes',
    'ADDRESS': `${100 + hashNum(u.id, 899)} ${['Maple', 'Elgin', 'King', 'Laurier', 'Bank', 'Water'][hashNum(u.id, 6)]} St`, 'CITY': city, 'PROVINCE/TERRITORY/STATE': PROVINCE_INFO[u.province].name, 'COUNTRY': 'Canada', 'POSTAL CODE': `${fsa} ${hashNum(u.id, 9)}A${hashNum(u.id + 'p', 9)}`,
    'PHONE NUMBER': u.phone || `${({ QC: '514', NS: '902', NB: '506', MB: '204', AB: '780', BC: '604', SK: '306' })[u.province] || '613'}-555-${String(100 + hashNum(u.id, 899)).padStart(4, '0')}`,
    'CITIZENSHIP': 'Canadian', 'BOXING CANADA WAIVER AND RELEASE OF LIABILITY': 'Agreed', 'BOXING CANADA CODE OF CONDUCT & ETHICS': 'Agreed',
    'TRANSACTION #': String(4000000 + hashNum(u.id, 999999)), 'PAYMENT TYPE': 'Online', 'PAYMENT STATUS': 'Paid', 'AMOUNT': u.role === 'boxer' ? '85.00' : '60.00', 'SEASON YEAR': '2026'
  };
  if (u.role === 'boxer') Object.assign(t, { 'EMERGENCY CONTACT NAME': `${['Sophie', 'Anna', 'Linh', 'Rita', 'Dana'][hashNum(u.id, 5)]} ${u.lastName}`, 'EMERGENCY CONTACT RELATIONSHIP': 'Parent', 'EMERGENCY CONTACT PHONE': '613-555-0' + String(100 + hashNum(u.id, 899)), 'ANNUAL MEDICAL DATE': '', 'NEED BOXING BOOK': 'No' });
  if (u.role === 'boxer' && ageOn(u.dob, REF_DATE) < 18) Object.assign(t, { 'PARENT/GUARDIAN NAME': t['EMERGENCY CONTACT NAME'], 'PARENT/GUARDIAN RELATIONSHIP': 'Parent', 'PARENT/GUARDIAN PHONE': t['EMERGENCY CONTACT PHONE'], 'PARENT/GUARDIAN EMAIL': `family.${u.lastName.toLowerCase().replace(/[^a-z]/g, '')}@example.ca` });
  if (u.role === 'coach') Object.assign(t, { 'NCCP #': u.nccp || '', 'COACH LEVEL': u.trackieCoachLevel || 'Competition Introduction - Trained', 'DATE OF CRIMINAL RECORD CHECK': '2025-03-10' });
  if (u.role === 'official') Object.assign(t, { 'OFFICIAL LEVEL': u.trackieOfficialLevel || 'Level 2', 'REFEREE/JUDGE': 'Referee & Judge', 'DATE OF CRIMINAL RECORD CHECK': '2024-11-02' });
  if (u.role === 'medical') Object.assign(t, { 'MEDICAL LICENSE NUMBER – UPLOAD LICENSE': u.license || '', 'YEARS OF EXPERIENCE IN SPORTS MEDICINE': '14', 'HOLDS MALPRACTICE/PROFESSIONAL LIABILITY INSURANCE': 'Yes' });
  return t;
}
const trackieOf = u => u.trackie || {};
const nccpOf = u => trackieOf(u)['NCCP #'] || u.nccp || '';
const phoneOf = u => trackieOf(u)['PHONE NUMBER'] || u.phone || '';
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
const PROV_NAME_TO_CODE = Object.fromEntries(Object.entries(PROVINCE_INFO).map(([k, v]) => [v.name.toLowerCase(), k]).concat([['quebec', 'QC'], ['newfoundland', 'NL']]));

function TrackieImportModal({ onClose }) {
  const { data, update, viewer, notify } = useApp();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [createNew, setCreateNew] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [err, setErr] = useState('');
  const onFile = async e => {
    const f = e.target.files[0]; if (!f) return;
    setFileName(f.name); setErr('');
    const text = (await f.text()).replace(/^\uFEFF/, '');
    const all = parseCsv(text);
    if (all.length < 2 || !all[0].includes('MEMBER #')) { setRows(null); setErr('This doesn’t look like a Trackie member export: the MEMBER # column is missing.'); return; }
    const head = all[0].map(h => h.trim());
    setRows(all.slice(1).map(r => { const o = {}; head.forEach((h, i) => { const v = (r[i] || '').trim(); if (v !== '') o[h] = v; }); return o; }));
  };
  const provOf = r => { const p = (r['PTSO'] || '').toUpperCase(); if (PROVINCE_INFO[p]) return p; return PROV_NAME_TO_CODE[(r['PROVINCE/TERRITORY/STATE'] || '').toLowerCase()] || ''; };
  const scoped = rows ? rows.filter(r => viewer.role === 'nsoadmin' || provOf(r) === viewer.province) : [];
  const skipped = rows ? rows.length - scoped.length : 0;
  const findUser = r => data.users.find(u => (r['MEMBER #'] && trackieOf(u)['MEMBER #'] === r['MEMBER #']) || (r['INDIVIDUAL EMAIL'] && u.email.toLowerCase() === r['INDIVIDUAL EMAIL'].toLowerCase()));
  const matched = scoped.filter(findUser), fresh = scoped.filter(r => !findUser(r));
  const roleFrom = t => /coach/i.test(t || '') ? 'coach' : /official/i.test(t || '') ? 'official' : 'boxer';
  const run = () => {
    let created = 0;
    update(d => {
      scoped.forEach(r => {
        const u = d.users.find(x => (r['MEMBER #'] && trackieOf(x)['MEMBER #'] === r['MEMBER #']) || (r['INDIVIDUAL EMAIL'] && x.email.toLowerCase() === r['INDIVIDUAL EMAIL'].toLowerCase()));
        if (u) { u.trackie = { ...(u.trackie || {}), ...r }; u.trackieSyncedAt = nowIso(); if (r['NCCP #']) u.nccp = r['NCCP #']; return; }
        if (!createNew) return;
        const role = roleFrom(r['MEMBERSHIP TYPE']);
        const prov = provOf(r) || viewer.province || 'ON';
        d.users.push({ id: uid('u'), firstName: r['FIRST NAME'] || (r['FULL NAME'] || '').split(' ')[0] || 'Member', lastName: r['LAST NAME'] || '', role, gender: r['GENDER'] === 'F' ? 'F' : 'M', dob: (r['DATE OF BIRTH'] || '2000-01-01').slice(0, 10), province: prov, email: r['INDIVIDUAL EMAIL'] || '', membershipId: ID_PREFIX[role] + String(1000 + Math.floor(Math.random() * 9000)), password: testMode ? 'Password123!' : '', status: testMode ? 'approved' : 'invited', selectedCoachIds: [], club: r['CLUB NAME'] || '', nccp: r['NCCP #'] || '', trackie: r, trackieSyncedAt: nowIso(), certs: {}, evaluatorPrograms: [] });
        const nu = d.users[d.users.length - 1]; if (nu.email && !testMode) queueActivation(d, nu); markInterestJoined(d, nu.email);
        created++;
      });
    });
    notify(`Trackie import: ${matched.length} member${matched.length === 1 ? '' : 's'} updated${createNew ? `, ${fresh.length} added` : ''}.`);
    onClose();
  };
  return <Modal size="lg" title="Import Members from Trackie" subtitle={viewer.role === 'nsoadmin' ? 'Upload a Trackie member export (CSV). Every column is stored on the member’s record.' : `Upload a Trackie member export. Only ${PROVINCE_INFO[viewer.province].name} members are imported.`} onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={!scoped.length} onClick={run}>Import {scoped.length ? (createNew ? scoped.length : matched.length) : ''} member{scoped.length === 1 ? '' : 's'}</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad">{err}</Banner>}
      <Field label="Trackie export file (.csv)"><input type="file" accept=".csv,text/csv" className="text-sm" onChange={onFile} /></Field>
      {rows && <>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-center">
          {[['Rows in file', rows.length], ['Match existing members', matched.length], ['New to the portal', fresh.length]].map(([l, n]) => <div key={l} className="bg-surface p-3"><div className="font-display text-2xl font-extrabold tabular-nums">{n}</div><div className="text-xs text-muted">{l}</div></div>)}
        </div>
        {skipped > 0 && <Banner tone="info">{skipped} row{skipped === 1 ? '' : 's'} from other provinces will be skipped.</Banner>}
        <p className="text-sm text-muted">Members are matched by Trackie MEMBER #, then by email. Matched members get their Trackie record refreshed; nothing else on their portal account changes.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={createNew} onChange={e => setCreateNew(e.target.checked)} /><span>Create portal accounts for the {fresh.length} new member{fresh.length === 1 ? '' : 's'}. Role comes from MEMBERSHIP TYPE (Coach, Official, otherwise Athlete). Each new member is emailed an activation code to set their own password.</span></label>
        {createNew && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={testMode} onChange={e => setTestMode(e.target.checked)} /><span><b>Testing only:</b> activate new accounts immediately with the demo password Password123!, without activation emails. Use this for fictional test data, never for real members.</span></label>}
        <Banner tone="warn">This file contains personal information. In this demo it is stored only in your browser. Production imports would run on the secure server.</Banner>
      </>}
      {!rows && !err && <p className="text-sm text-muted">{fileName ? 'Reading…' : 'In Trackie, export your member list as CSV, then choose the file here.'}</p>}
    </div>
  </Modal>;
}

function MembershipProfileModal({ userId, onClose }) {
  const { data, viewer, update, notify } = useApp();
  const u = getUser(data, userId);
  const [showEmpty, setShowEmpty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const canEditT = viewer.role === 'nsoadmin';
  const saveT = () => { update(d => { const x = d.users.find(y => y.id === userId); x.trackie = { ...(x.trackie || {}), ...draft }; Object.keys(x.trackie).forEach(k => { if (x.trackie[k] === '') delete x.trackie[k]; }); if (draft['NCCP #'] !== undefined) x.nccp = draft['NCCP #']; x.trackieEditedBy = viewer.id; x.trackieEditedAt = nowIso(); }); setEditing(false); setDraft({}); notify('Membership record updated. The next Trackie import will overwrite fields that differ in Trackie.', 'info'); };
  if (!u) return null;
  const t = trackieOf(u);
  const self = viewer.id === u.id;
  const adminHere = viewer.role === 'nsoadmin' || (viewer.role === 'ptso' && viewer.province === u.province);
  const groups = TRACKIE_GROUPS.filter(g => g.adminOnly ? adminHere : g.sensitive ? (adminHere || self) : true);
  const extra = Object.keys(t).filter(k => !TRACKIE_GROUPED.has(k) && !['LAST NAME, FIRST NAME', 'YEAR OF BIRTH', 'MONTH OF BIRTH', 'DAY OF BIRTH', 'MEMBER QR CODE', 'PROFILE PHOTO', 'QR CODE IMAGE URL', 'QR CODE DESTINATION URL'].includes(k));
  const prog = (data.programs || []).find(p => p.kind === (u.role === 'official' ? 'official' : 'coach'));
  const lvl = prog && (u.certs || {})[prog.id] ? prog.levels.find(l => l.id === u.certs[prog.id]) : null;
  const show = v => /^https?:\/\//.test(v) ? <span className="break-all text-rope">File on Trackie</span> : v;
  return <Modal size="xl" title={self ? 'My Membership Profile' : 'Membership Record'} subtitle={`${fullName(u)}, ${u.membershipId}. Source: Trackie membership database${u.trackieSyncedAt ? `, last imported ${fmtStamp(u.trackieSyncedAt)}` : ''}.`} onClose={onClose}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><RoleChip role={u.role} /><Badge tone="info">Trackie {t['MEMBER #'] || 'not linked'}</Badge>{t['NSO EXPIRY'] && <Badge tone={t['NSO EXPIRY'] >= REF_DATE ? 'ok' : 'bad'}>Membership {t['NSO EXPIRY'] >= REF_DATE ? 'valid until' : 'expired'} {fmtDate(t['NSO EXPIRY'])}</Badge>}{lvl && <Badge tone="ok">{prog.name}: {lvName(lvl)}</Badge>}{(u.evaluatorPrograms || []).length > 0 && <Badge tone="info">Evaluator</Badge>}
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted"><input type="checkbox" checked={showEmpty || editing} disabled={editing} onChange={e => setShowEmpty(e.target.checked)} />Show empty fields</label>{canEditT && (editing ? <><Btn size="sm" onClick={() => { setEditing(false); setDraft({}); }}>Cancel</Btn><Btn size="sm" variant="primary" onClick={saveT}>Save record</Btn></> : <Btn size="sm" onClick={() => setEditing(true)}>Edit record</Btn>)}</div>
      {nccpOf(u) && (self || adminHere || (viewer.evaluatorPrograms || []).length > 0) && <div className="rounded-md border border-line p-3"><h4 className="mb-2 font-display text-base font-bold">NCCP transcript (The Locker)</h4><NccpSummaryBlock no={nccpOf(u)} /></div>}
      {!Object.keys(t).length && <Banner tone="warn">No Trackie record is linked to this member yet. Import a Trackie export from Members & Approvals.</Banner>}
      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map(g => { const fs = g.fields.filter(f => showEmpty || editing || (t[f] !== undefined && t[f] !== '')); if (!fs.length) return null; return <div key={g.key} className="rounded-md border border-line">
          <div className="flex items-center justify-between border-b border-line bg-sunk px-3 py-1.5"><h4 className="font-display text-base font-bold">{g.label}</h4>{(g.sensitive || g.adminOnly) && <Badge tone="warn">{g.adminOnly ? 'Administrators only' : 'Private'}</Badge>}</div>
          <dl className="divide-y divide-line text-sm">{fs.map(f => <div key={f} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-3 py-1.5"><dt className="text-xs uppercase text-muted">{f.replace(/\s{2,}/g, ', ').toLowerCase().replace(/^./, c => c.toUpperCase())}</dt><dd className="font-semibold break-words">{editing ? <input className="field py-1 text-sm font-normal" value={draft[f] !== undefined ? draft[f] : (t[f] || '')} onChange={e => { const v = e.target.value; setDraft(p => ({ ...p, [f]: v })); }} aria-label={f} /> : t[f] ? show(t[f]) : <span className="font-normal text-muted">—</span>}</dd></div>)}</dl>
        </div>; })}
        {extra.length > 0 && adminHere && <div className="rounded-md border border-line"><div className="border-b border-line bg-sunk px-3 py-1.5"><h4 className="font-display text-base font-bold">Other Trackie fields</h4></div><dl className="divide-y divide-line text-sm">{extra.map(f => <div key={f} className="grid grid-cols-2 gap-2 px-3 py-1.5"><dt className="text-xs uppercase text-muted">{f.toLowerCase()}</dt><dd className="font-semibold break-words">{show(t[f])}</dd></div>)}</dl></div>}
      </div>
    </div>
  </Modal>;
}

/* =========================================================
   Certification programs & coach evaluations
   The coaching pathway (levels, names, scheduled renames,
   readiness requirements and evaluation tasks) comes from
   coach-pathway.json and is edited by NSO Administrators.

   An evaluation starts as a Square order: the order email
   becomes a request on the server. Boxing Canada assigns an
   evaluator, who checks the coach's NCCP record (The Locker)
   and membership (Trackie) against the level's requirements,
   then emails the coach that they're ready, or what is still
   outstanding. Once ready, coach and evaluator share one
   screen of evaluation tasks: the coach submits videos,
   files and online answers; the evaluator gives feedback,
   marks tasks complete and records the outcome. Tasks are
   copied into each evaluation when it starts, so later
   pathway changes don't alter evaluations under way.
   ========================================================= */
const COACH_PATHWAY = /*@COACH_PATHWAY@*/null;
const isFr = lang => (lang || UI_LANG) === 'fr';
const tr = (o, k, lang) => o ? ((isFr(lang) && o[k + 'Fr']) || o[k] || '') : '';
function lvRename(l, on) { const day = on || REF_DATE; let best = null; ((l && l.renames) || []).forEach(r => { if (r.from && r.from <= day && (!best || r.from >= best.from)) best = r; }); return best; }
function lvName(l, lang, on) { if (!l) return 'Unknown level'; const r = lvRename(l, on); return r ? ((isFr(lang) && r.nameFr) || r.name) : ((isFr(lang) && l.nameFr) || l.name); }
const lvCode = l => { const r = l && lvRename(l); return (r && r.code) || (l && l.code) || ''; };
const lvFormer = l => { const r = l && lvRename(l); return r ? l.name : ''; };
const lvUpcoming = l => ((l && l.renames) || []).filter(r => r.from && r.from > REF_DATE).sort((a, b) => a.from.localeCompare(b.from))[0] || null;
const lvOffered = l => !l.offeredFrom || l.offeredFrom <= REF_DATE;
const CE_STAGES = [
  { key: 'start', heading: (l, lang) => `${lvName(l, lang)} ${isFr(lang) ? '« en formation »' : '“In Training”'}` },
  { key: 'training', heading: (l, lang) => `${lvName(l, lang)} ${isFr(lang) ? '« formé »' : '“Trained”'}` },
  { key: 'evaluation', heading: (l, lang) => isFr(lang) ? 'Évaluation' : 'Evaluation' }
];

function coachProgramDefault() {
  const p = structuredClone(COACH_PATHWAY || { program: { id: 'prog-coach', kind: 'coach', name: 'NCCP Coaching Pathway', evaluationsEnabled: true }, levels: [], emailTemplates: {}, schema: 2 });
  return { ...p.program, levels: p.levels, emailTemplates: p.emailTemplates, schema: p.schema };
}
function makePrograms() {
  const L = (id, name, fee, description) => ({ id, name, fee, description });
  return [
    coachProgramDefault(),
    { id: 'prog-official', kind: 'official', name: 'Officials Certification Pathway', evaluationsEnabled: false, levels: [
      L('lv-l1j', 'Level 1 Judge', 50, ''), L('lv-l2r', 'Level 2 Referee', 75, ''), L('lv-l2j', 'Level 2 Judge', 75, ''),
      L('lv-l3r', 'Level 3 Referee', 100, ''), L('lv-l3j', 'Level 3 Judge', 100, ''), L('lv-l4r', 'Level 4 Referee', 125, ''), L('lv-l4j', 'Level 4 Judge', 125, ''),
      L('lv-io', 'International Official', 150, ''), L('lv-td', 'Technical Delegate / Supervisor', 150, '')
    ] }
  ];
}
/* Copy a level's tasks into an evaluation (later pathway edits don't change it). */
function startTasks(level, assignments) {
  return (level.tasks || []).map(t => ({ ...structuredClone(t), assignment: (assignments || {})[t.id] || '', submissions: [], answer: null, submittedAt: '', review: { status: 'pending' }, comments: [] }));
}
function makeEvalRequests() {
  const sq = (amt, at, n) => ({ provider: 'Square', transactionId: n, amount: amt, currency: 'CAD', status: 'Paid', paidAt: at });
  const H = (at, by, text) => ({ id: uid('h'), at, by, text });
  const ib = (COACH_PATHWAY ? COACH_PATHWAY.levels : []).find(l => l.id === 'lv-cc') || { tasks: [] };
  const done = startTasks(ib).map(t => ({ ...t, submissions: [{ id: uid('s'), kind: 'link', url: 'https://youtu.be/demo-' + t.step, label: 'Video', by: 'u-c1', at: '2025-04-20T19:00:00' }], submittedAt: '2025-04-20T19:00:00', review: { status: 'complete', feedback: 'Clear, safe and well organized.', by: 'u-c3', at: '2025-05-10T15:00:00' } }));
  const t4 = startTasks(ib, { 'ib-9a': '1, 7, 16', 'ib-9c': 'Jab to the body', 'ib-9d': 'Slip outside a jab' });
  if (t4.length >= 4) {
    t4[0] = { ...t4[0], answer: { entries: [{ fields: { video: '1', skill: 'Boxing stance' }, rows: [{ detect: 'Legs locked straight, weight on the heels.', correct: 'Bend the knees and shift weight to the balls of the feet. Mirror drills holding stance for 3 x 30 s, then add movement.' }] }, { fields: { video: '7', skill: 'Jab' }, rows: [{ detect: 'Rear hand drops when jabbing.', correct: 'Keep the rear glove at the cheek. Partner taps the open side whenever it drops.' }] }, { fields: { video: '16', skill: 'Right hook' }, rows: [{ detect: 'Pivot comes from the arm, not the hips and lead foot.', correct: 'Slow-motion shadow boxing focusing on the lead-foot pivot, then on the heavy bag.' }] }] }, submittedAt: '2026-11-19T20:10:00' };
    t4[1] = { ...t4[1], submissions: [{ id: uid('s'), kind: 'link', url: 'https://youtu.be/demo-warmup', label: 'Warm-up video (8 min)', by: 'u-c5', at: '2026-11-19T20:20:00' }], answer: { entries: [{ fields: {}, rows: [{ activity: 'Skipping', duration: '5 min', goal: 'Whole-body warm-up' }, { activity: 'Dynamic stretching', duration: '4 min', goal: 'Mobility for shoulders and hips' }, { activity: 'Shadow boxing with footwork', duration: '3 min', goal: 'Rehearse stance and movement' }] }] }, submittedAt: '2026-11-19T20:20:00', review: { status: 'complete', feedback: 'Logical and progressive. Clear instructions and good use of the board.', by: 'u-c2', at: '2026-11-21T09:30:00' } };
    t4[2] = { ...t4[2], submissions: [{ id: uid('s'), kind: 'link', url: 'https://youtu.be/demo-jab-body', label: 'Teaching the jab to the body', by: 'u-c5', at: '2026-11-19T20:30:00' }], submittedAt: '2026-11-19T20:30:00', review: { status: 'needs_work', feedback: 'The demonstration is strong, but I didn’t see you check for understanding or give the athlete feedback after their attempts. Please re-record following the steps in Appendix E.', by: 'u-c2', at: '2026-11-21T09:40:00' }, comments: [{ id: uid('c'), by: 'u-c5', at: '2026-11-21T18:00:00', text: 'Thanks Sarah. Can I use the same athlete?' }, { id: uid('c'), by: 'u-c2', at: '2026-11-21T18:30:00', text: 'Yes, same athlete is fine.' }] };
  }
  return [
    { id: 'er-1', programId: 'prog-coach', levelId: 'lv-cc', requesterId: 'u-c1', source: 'square', track: 'regular', nccp: '5512093', notes: '', availability: '', status: 'completed', createdAt: '2025-04-02T10:00:00', payment: sq(180, '2025-04-02T10:05:00', '9KD2M7X1'), assignedEvaluatorId: 'u-c3', assignedBy: 'u-s1', assignedAt: '2025-04-04T10:00:00', evaluatorContact: { name: 'Kevin MacDonald', email: 'kevin.macdonald@example.ca' }, readiness: { decision: 'ready', at: '2025-04-04T15:00:00', by: 'u-c3', track: 'regular', overrides: {} }, tasks: done, outcome: { result: 'certified', date: '2025-05-10', notes: 'Well-organized sessions, safe partner drills, clear corner work.', by: 'u-c3', at: '2025-05-10T16:00:00' }, lockerEntry: { by: 'u-s1', at: '2025-05-12T10:00:00' }, messages: [], history: [H('2025-04-02T10:05:00', 'square', 'Paid in the Square store (order 9KD2M7X1).'), H('2025-05-10T16:00:00', 'u-c3', 'Certified at Instruction Beginner')] },
    { id: 'er-2', programId: 'prog-coach', levelId: 'lv-pc', requesterId: 'u-c1', source: 'square', track: 'regular', nccp: '5512093', intakeId: 'in-2', notes: '', availability: '', status: 'paid', createdAt: '2026-10-23T19:12:00', payment: sq(180, '2026-10-23T19:12:00', '7HQ2K9P4XW'), tasks: [], messages: [], history: [H('2026-10-23T19:12:00', 'square', 'Paid in the Square store (order 7HQ2K9P4XW). Request created from the order email.')] },
    { id: 'er-3', programId: 'prog-coach', levelId: 'lv-cc', requesterId: 'u-c4', source: 'square', track: 'regular', nccp: '6630481', notes: '', availability: '', status: 'assigned', createdAt: '2026-10-21T09:00:00', payment: sq(180, '2026-10-21T09:03:00', '3MW8T2QZ'), assignedEvaluatorId: 'u-c2', assignedBy: 'u-s1', assignedAt: '2026-10-22T11:00:00', evaluatorContact: { name: 'Sarah Lin', email: 'sarah.lin@example.ca' }, tasks: [], messages: [], history: [H('2026-10-21T09:03:00', 'square', 'Paid in the Square store (order 3MW8T2QZ).'), H('2026-10-22T11:00:00', 'u-s1', 'Assigned to Sarah Lin')] },
    { id: 'er-4', programId: 'prog-coach', levelId: 'lv-cc', requesterId: 'u-c5', source: 'square', track: 'regular', nccp: '6702215', notes: '', availability: '', status: 'in_progress', createdAt: '2026-11-10T14:00:00', payment: sq(180, '2026-11-10T14:02:00', '5RX4N8VB'), assignedEvaluatorId: 'u-c2', assignedBy: 'u-s1', assignedAt: '2026-11-11T09:00:00', evaluatorContact: { name: 'Sarah Lin', email: 'sarah.lin@example.ca' }, readiness: { decision: 'ready', at: '2026-11-11T15:00:00', by: 'u-c2', track: 'regular', overrides: {} }, startedAt: '2026-11-11T15:00:00', tasks: t4, emails: [{ id: 'em-1', kind: 'eval_ready', subject: 'Boxing Canada Instruction Beginner Coach Evaluation: Tyler', at: '2026-11-11T15:00:00', by: 'u-c2' }], messages: [{ id: uid('m'), by: 'u-c5', at: '2026-11-19T20:35:00', text: 'All four tasks are up except 9d, coming this weekend.' }], history: [H('2026-11-10T14:02:00', 'square', 'Paid in the Square store (order 5RX4N8VB).'), H('2026-11-11T09:00:00', 'u-s1', 'Assigned to Sarah Lin'), H('2026-11-11T15:00:00', 'u-c2', 'Readiness confirmed: ready email sent and tasks opened')] }
  ];
}
function makeEvalIntake() {
  return [
    { id: 'in-1', at: '2026-10-23T21:40:00', source: 'postmark', subject: 'You have a new order: #ZZ99AA11', from: 'Square (noreply@messaging.squareup.com)', status: 'unmatched', parsed: { firstName: 'Jordan', lastName: 'Nouveau', fullName: 'Jordan Nouveau', nccp: '9999999', email: 'jordan.n@example.ca', phone: '', province: 'NB', levelText: 'Competition Introduction', levelId: 'lv-pc', track: 'regular', orderNo: 'ZZ99AA11', amount: 180 }, suggest: [], notes: ['Needs review: no member has NCCP # 9999999 or email jordan.n@example.ca.'], raw: 'New order from Boxing Canada Online Store\nOrder\n#ZZ99AA11\nItem\nCoach Evaluation Request / Demande d’évaluation de l’entraîneur\nOption\nRegular Evaluation\nLevel / Niveau\nCompetition Introduction\nCoach Name / Nom de l’entraîneur\nJordan Nouveau\nNCCP # / No PNCE\n9999999\nEmail\njordan.n@example.ca\nProvince\nNB\nTotal\n$180.00' },
    { id: 'in-2', at: '2026-10-23T19:12:00', source: 'postmark', subject: 'You have a new order: #7HQ2K9P4XW', from: 'Square (noreply@messaging.squareup.com)', status: 'matched', matchedBy: 'nccp', userId: 'u-c1', requestId: 'er-2', parsed: { firstName: 'Marc', lastName: 'Bélanger', fullName: 'Marc Bélanger', nccp: '5512093', email: 'marc.belanger@example.ca', levelText: 'Competition Introduction', levelId: 'lv-pc', track: 'regular', orderNo: '7HQ2K9P4XW', amount: 180 }, notes: [], raw: '' }
  ];
}
const EVAL_STATUS = {
  awaiting_payment: { tone: 'neutral', label: 'Awaiting payment' },
  paid: { tone: 'warn', label: 'Paid, waiting for an evaluator' },
  assigned: { tone: 'info', label: 'Evaluator checking readiness' },
  not_ready: { tone: 'warn', label: 'Waiting for outstanding courses' },
  in_progress: { tone: 'info', label: 'Evaluation in progress' },
  completed: { tone: 'ok', label: 'Completed' },
  declined: { tone: 'bad', label: 'Declined, refunded' },
  cancelled: { tone: 'neutral', label: 'Cancelled' }
};
const EVAL_OPEN = ['paid', 'assigned', 'not_ready', 'in_progress'];
const TASK_STATUS = { pending: { tone: 'neutral', label: 'Not submitted' }, submitted: { tone: 'warn', label: 'Submitted for review' }, needs_work: { tone: 'bad', label: 'Needs more work' }, complete: { tone: 'ok', label: '✓ Complete' } };
const taskState = t => (t.review && t.review.status === 'complete') ? 'complete' : (t.review && t.review.status === 'needs_work' && !(t.submittedAt && t.review.at && t.submittedAt > t.review.at)) ? 'needs_work' : t.submittedAt ? 'submitted' : 'pending';
const progFor = (d, u) => (d.programs || []).find(p => p.kind === (u.role === 'official' ? 'official' : 'coach'));
const levelOf = (d, pid, lid) => { const p = (d.programs || []).find(x => x.id === pid); return p ? p.levels.find(x => x.id === lid) : null; };
const levelName = (d, pid, lid) => lvName(levelOf(d, pid, lid));
const money = n => '$' + Number(n || 0).toFixed(2);
const notifyUsers = (d, to, text, tab, nav) => { d.notifications = d.notifications || []; d.notifications.unshift({ id: uid('nt'), to, text, tab, nav: nav || null, at: nowIso(), readBy: [] }); };
const reqNccp = (d, r) => (r && r.nccp) || nccpOf(getUser(d, r.requesterId) || {});
const evalPortalUrl = () => (WP && WP.portalUrl) || (typeof location !== 'undefined' ? location.href.split('#')[0] : '');
const langOf = u => { if (!u) return 'en'; const t = trackieOf(u); const l = String(u.lang || t['LANGUAGE'] || t['PREFERRED LANGUAGE'] || '').toLowerCase(); return l ? (l.startsWith('fr') ? 'fr' : 'en') : u.province === 'QC' ? 'fr' : 'en'; };

function upgradeTo8(d) {
  const add = u => { if (!d.users.some(x => x.id === u.id)) d.users.push(u); };
  add({ id: 'u-c3', firstName: 'Kevin', lastName: 'MacDonald', role: 'coach', gender: 'M', dob: '1971-02-14', province: 'NS', email: 'kevin.macdonald@example.ca', membershipId: 'BC-COA-1003', password: 'Password123!', status: 'approved', club: 'Harbour City Boxing Club' });
  add({ id: 'u-c4', firstName: 'Priya', lastName: 'Shah', role: 'coach', gender: 'F', dob: '1993-09-30', province: 'ON', email: 'priya.shah@example.ca', membershipId: 'BC-COA-1188', password: 'Password123!', status: 'approved', club: 'Lakeshore Boxing' });
  const meta = {
    'u-c1': { nccp: '5512093', certs: { 'prog-coach': 'lv-cc' }, trackieCoachLevel: 'Competition Development - Trained', phone: '613-555-0101' },
    'u-c2': { nccp: '4471820', certs: { 'prog-coach': 'lv-ntc' }, trackieCoachLevel: 'Competition Development - Certified', evaluatorPrograms: ['prog-coach'], phone: '514-555-0102' },
    'u-c3': { nccp: '2201457', certs: { 'prog-coach': 'lv-ntc' }, trackieCoachLevel: 'Competition High Performance - Certified', evaluatorPrograms: ['prog-coach'], phone: '902-555-0119' },
    'u-c4': { nccp: '6630481', certs: {}, trackieCoachLevel: 'Instruction Beginner - In Training', phone: '416-555-0188' },
    'u-o1': { certs: { 'prog-official': 'lv-l4r' }, trackieOfficialLevel: 'Level 4 Referee', phone: '514-555-0177' },
    'u-o2': { certs: { 'prog-official': 'lv-td' }, trackieOfficialLevel: 'Technical Delegate', phone: '613-555-0122' }
  };
  d.users.forEach(u => {
    const m = meta[u.id] || {};
    if (u.certs === undefined) u.certs = m.certs || {};
    if (u.evaluatorPrograms === undefined) u.evaluatorPrograms = m.evaluatorPrograms || [];
    if (!u.nccp && m.nccp) u.nccp = m.nccp;
    if (!u.phone && m.phone) u.phone = m.phone;
    if (m.trackieCoachLevel) u.trackieCoachLevel = m.trackieCoachLevel;
    if (m.trackieOfficialLevel) u.trackieOfficialLevel = m.trackieOfficialLevel;
    if (!u.trackie) { u.trackie = trackieFromUser(u); u.trackieSyncedAt = '2026-11-02T07:30:33'; }
  });
  if (!d.programs) d.programs = makePrograms();
  if (!d.evalRequests) d.evalRequests = makeEvalRequests();
  if (!d.notifications) d.notifications = [{ id: 'nt-1', to: 'role:nsoadmin', text: 'New Competition Introduction evaluation request from Square: Marc Bélanger (ON). Assign an evaluator.', tab: 'COACHPROG', at: '2026-10-23T19:12:00', readBy: [] }];
  d.version = 8;
  return d;
}
/* v25: coaching pathway with real NCCP levels, 2027 renames, readiness requirements and evaluation tasks; Square intake. */
function upgradeTo25(d) {
  const def = coachProgramDefault();
  const i = (d.programs || []).findIndex(p => p.id === 'prog-coach');
  const old = i >= 0 ? d.programs[i] : null;
  if (!old || !(old.schema >= def.schema)) {
    const prev = Object.fromEntries(((old && old.levels) || []).map(l => [l.id, l]));
    const levels = def.levels.map(l => { const o = prev[l.id]; if (!o) return l; delete prev[l.id]; return { ...l, fee: o.fee != null ? o.fee : l.fee, legacyReqs: o.reqs || [], legacyName: o.name || '' }; });
    const next = { ...def, evaluationsEnabled: old ? old.evaluationsEnabled !== false : true, levels: [...levels, ...Object.values(prev)] };
    if (i >= 0) d.programs[i] = next; else d.programs = [next, ...(d.programs || [])];
  }
  if (!d.evalIntake) d.evalIntake = [];
  // Demo data: a coach part-way through an Instruction Beginner evaluation.
  const demo = d.users.some(u => u.id === 'u-c2') && d.users.some(u => u.id === 'u-s1');
  if (demo && !d.users.some(u => u.id === 'u-c5')) {
    const u = { id: 'u-c5', firstName: 'Tyler', lastName: 'Okafor', role: 'coach', gender: 'M', dob: '1990-06-02', province: 'AB', email: 'tyler.okafor@example.ca', membershipId: 'BC-COA-1231', password: 'Password123!', status: 'approved', club: 'Capital City Boxing Club', selectedCoachIds: [], certs: {}, evaluatorPrograms: [], nccp: '6702215', phone: '780-555-0144', trackieCoachLevel: 'Instruction Beginner - Trained' };
    u.trackie = trackieFromUser(u); u.trackieSyncedAt = '2026-11-02T07:30:33';
    d.users.push(u);
    d.nccp = d.nccp || { records: {}, imports: [] };
    const M = (moduleId, module, date) => ({ moduleId, module, context: 'General', date });
    d.nccp.records['6702215'] = { no: '6702215', firstName: 'Tyler', lastName: 'Okafor', region: 'AB', modules: [M('211', 'NCCP Make Ethical Decisions', '2026-08-02'), M('212', 'Make Ethical Decisions Online Evaluation', '2026-08-09'), M('410', 'Planning a Practice', '2026-08-15'), M('520', 'NCCP Nutrition', '2026-08-22'), M('702', 'NCCP Emergency Action Plan eLearning', '2026-08-23'), M('905', 'Safe Sport Training', '2026-07-30')], events: [{ eventId: 'd-501', event: 'Boxing Instruction - Beginners Module', context: 'Inst-Beg', date: '2026-07-12', region: 'AB' }] };
    const c4 = d.users.find(x => x.id === 'u-c4'); if (c4 && c4.certs && c4.certs['prog-coach'] === 'lv-ci') { c4.certs = {}; c4.trackieCoachLevel = 'Instruction Beginner - In Training'; c4.trackie = { ...(c4.trackie || {}), 'COACH LEVEL': 'Instruction Beginner - In Training' }; }
    const c3 = d.users.find(x => x.id === 'u-c3'); if (c3 && c3.certs && c3.certs['prog-coach'] === 'lv-ic') c3.certs = { 'prog-coach': 'lv-ntc' };
    const fresh = makeEvalRequests();
    d.evalRequests = [...fresh, ...(d.evalRequests || []).filter(r => !fresh.some(f => f.id === r.id))];
    d.evalIntake = makeEvalIntake();
    notifyUsers(d, 'u-c2', 'Tyler Okafor submitted Instruction Beginner task 9a for review.', 'EVALUATOR', { evalId: 'er-4' });
    notifyUsers(d, 'role:nsoadmin', 'A Square evaluation order needs review: Jordan Nouveau, NCCP 9999999. Match it to a member in Coach Programs.', 'COACHPROG');
  }
  d.version = 25;
  return d;
}

/* ---------- Readiness: requirements against The Locker, Trackie and the portal ---------- */
function reqHit(rec, r) {
  if (!rec) return null;
  const alts = String(r.match || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (r.kind === 'module') return alts.length ? rec.modules.map(m => ({ name: m.module, date: m.date })).filter(p => alts.some(a => p.name.toLowerCase().includes(a))).sort((a, b) => b.date.localeCompare(a.date))[0] || null : null;
  const pool = rec.events.filter(e => !r.noEval || !isEvalEvent(e.event));
  return pool.filter(e => (r.anyInContext && r.context && e.context === r.context) || alts.some(a => e.event.toLowerCase().includes(a))).map(e => ({ name: e.event, date: e.date })).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}
/* One requirement for one coach: met (true/false), pending (an evaluator must confirm), when and where from. */
function reqStatus(d, user, r, request, prog) {
  const ov = request && request.readiness && request.readiness.overrides && request.readiness.overrides[r.id];
  if (ov && ov.met) return { met: true, date: (ov.at || '').slice(0, 10), detail: ov.note || 'Confirmed by the evaluator', source: 'evaluator' };
  const no = request ? reqNccp(d, request) : nccpOf(user);
  const t = trackieOf(user);
  if (r.kind === 'membership') { const exp = t['NSO EXPIRY']; if (exp) return exp >= REF_DATE ? { met: true, detail: `Valid until ${fmtDate(exp)}`, source: 'trackie' } : { met: false, detail: `Expired ${fmtDate(exp)}`, source: 'trackie' }; return user.status === 'approved' ? { met: true, detail: 'Portal member (no Trackie record linked)', source: 'portal' } : { met: false, detail: 'No membership on record', source: 'trackie' }; }
  if (r.kind === 'nccp') return no ? { met: true, detail: `NCCP # ${no}`, source: 'locker' } : { met: false, detail: 'No NCCP # on file', source: 'trackie' };
  if (r.kind === 'trackie') { const v = t[r.field]; return v ? { met: true, date: /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '', detail: /^\d{4}-/.test(v) ? '' : v, source: 'trackie' } : { met: false, source: 'trackie' }; }
  if (r.kind === 'event' || r.kind === 'module') { const rec = nccpRecord(d, no); const hit = reqHit(rec, r); return hit ? { met: true, date: hit.date, detail: hit.name, source: 'locker' } : { met: false, source: 'locker', detail: rec ? '' : no ? 'No Locker record for this NCCP #' : 'No NCCP #' }; }
  if (r.kind === 'cert') {
    const p = prog || (d.programs || []).find(x => x.levels.some(l => l.id === r.levelId));
    const cur = p && (user.certs || {})[p.id]; const rank = id => p ? p.levels.findIndex(l => l.id === id) : -1;
    if (cur && rank(cur) >= rank(r.levelId)) return { met: true, detail: `Certified ${levelName(d, p.id, cur)} in the portal`, source: 'portal' };
    const lv = p && p.levels.find(l => l.id === r.levelId); const rec = nccpRecord(d, no);
    const ev = rec && lv && lv.lockerContext && rec.events.filter(e => e.context === lv.lockerContext && isEvalEvent(e.event)).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (ev) return { met: true, date: ev.date, detail: ev.event, source: 'locker' };
    return { met: false, pending: !!r.allowManual, source: 'portal', detail: r.allowManual ? 'Evaluator to confirm' : '' };
  }
  return { met: false, pending: true, source: 'evaluator', detail: 'Evaluator to confirm' };
}
function levelProgress(d, user, level, request) {
  const prog = (d.programs || []).find(p => p.levels.some(l => l.id === level.id));
  const items = (level.reqs || []).map(r => ({ ...r, st: reqStatus(d, user, r, request, prog) }));
  items.forEach(i => { i.hit = i.st.met ? { date: i.st.date, name: i.st.detail } : null; });
  const req = items.filter(i => !i.optional);
  const unmet = req.filter(i => !i.st.met);
  const course = req.filter(i => i.stage === 'start' && (i.kind === 'event' || i.kind === 'module'));
  const inTraining = course.length ? course.every(i => i.st.met) : req.filter(i => i.stage === 'start').every(i => i.st.met);
  const trained = inTraining && req.filter(i => i.stage === 'training').every(i => i.st.met);
  return {
    items, met: req.length - unmet.length, total: req.length, complete: req.length > 0 && !unmet.length, linked: !!nccpRecord(d, request ? reqNccp(d, request) : nccpOf(user)),
    blocking: unmet.filter(i => i.onMissing !== 'challenge'), challenge: unmet.filter(i => i.onMissing === 'challenge'), inTraining, trained
  };
}
function readyLevel(d, user, prog) { let best = null; prog.levels.forEach(l => { if (levelProgress(d, user, l).complete) best = l; }); return best; }

/* The pathway chart from the evaluation emails, with the coach's status filled in. */
function EvalChart({ user, level, request, tasks, onOverride, compact, lang }) {
  const { data } = useApp();
  const pr = levelProgress(data, user, level, request);
  const [noteFor, setNoteFor] = useState(null); const [note, setNote] = useState('');
  const row = i => { const st = i.st; const tone = st.met ? 'ok' : i.optional ? 'neutral' : st.pending ? 'info' : 'warn';
    return <tr key={i.id} className={st.met ? '' : i.optional ? '' : 'bg-warnsoft'}>
      <td className="w-7 px-2 py-1.5 text-center align-top" aria-hidden="true"><span className={cx('font-bold', tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'info' ? 'text-rope' : 'text-muted')}>{st.met ? '✓' : i.optional ? '–' : st.pending ? '?' : '✗'}</span></td>
      <td className="px-2 py-1.5 align-top"><span className={cx('font-semibold', !st.met && !i.optional && 'text-ink')}>{tr(i, 'label', lang)}</span>{i.onMissing === 'challenge' && !st.met && <Badge tone="info" className="ml-1">Challenge evaluation if missing</Badge>}
        {!compact && tr(i, 'link', lang) && !st.met && <a className="ml-1 text-xs font-semibold text-rope underline" href={tr(i, 'link', lang)} target="_blank" rel="noopener noreferrer">How</a>}</td>
      <td className="px-2 py-1.5 align-top text-xs text-muted">{st.met ? <>{st.date ? fmtDate(st.date) : ''}{st.date && st.detail ? ', ' : ''}{st.detail}{st.source === 'evaluator' && <Badge tone="info" className="ml-1">Evaluator confirmed</Badge>}</> : (st.detail || (i.optional ? 'Not on record (not required for the evaluation)' : 'Not on record'))}</td>
      {onOverride && <td className="whitespace-nowrap px-2 py-1.5 text-right align-top">{st.source === 'evaluator' && st.met ? <Btn size="xs" variant="ghost" onClick={() => onOverride(i.id, null)}>Undo</Btn> : !st.met && !i.optional ? (noteFor === i.id ? <span className="inline-flex flex-wrap items-center justify-end gap-1"><input className="field w-48 py-0.5 text-xs" autoFocus placeholder="How you confirmed it" value={note} onChange={e => setNote(e.target.value)} /><Btn size="xs" variant="ok" onClick={() => { onOverride(i.id, { met: true, note: note.trim() || 'Confirmed by the evaluator' }); setNoteFor(null); setNote(''); }}>Confirm</Btn><Btn size="xs" variant="ghost" onClick={() => setNoteFor(null)}>Cancel</Btn></span> : <Btn size="xs" onClick={() => { setNoteFor(i.id); setNote(''); }}>Mark as met</Btn>) : null}</td>}
    </tr>; };
  const cols = onOverride ? 4 : 3;
  const head = text => <tr key={'h' + text}><td colSpan={cols} className="bg-sunk px-2 py-1 text-xs font-bold italic text-muted">{text}</td></tr>;
  const ts = tasks || [];
  return <div className="overflow-x-auto rounded-md border border-line"><table className="w-full text-sm"><tbody className="divide-y divide-line">
    {CE_STAGES.map(s => { const rows = pr.items.filter(i => (i.stage || 'start') === s.key); return [rows.map(row), s.key !== 'evaluation' ? head(s.heading(level, lang)) : null]; })}
    {ts.length > 0 && ts.map(t => { const st = taskState(t); return <tr key={t.id}><td className="w-7 px-2 py-1.5 text-center align-top"><span className={cx('font-bold', st === 'complete' ? 'text-ok' : 'text-muted')}>{st === 'complete' ? '✓' : '○'}</span></td><td className="px-2 py-1.5 align-top"><span className="mr-1 text-xs font-bold text-muted">{t.step}</span><span className="font-semibold">{tr(t, 'title', lang)}</span></td><td className="px-2 py-1.5 align-top text-xs text-muted" colSpan={onOverride ? 2 : 1}>{TASK_STATUS[st].label}</td></tr>; })}
    {!ts.length && (level.tasks || []).length > 0 && <tr><td /><td className="px-2 py-1.5 text-xs text-muted" colSpan={cols - 1}>{(isFr(lang) ? 'Tâches d’évaluation : ' : 'Evaluation tasks: ') + level.tasks.map(t => t.step).join(', ')}</td></tr>}
    {head(`${lvName(level, lang)} ${isFr(lang) ? '« certifié »' : '“Certified”'}`)}
  </tbody></table></div>;
}
/* Compact checklist used in profiles, pathway cards and the assignment review. */
function LevelChecklist({ user, level, title, request }) {
  const { data } = useApp();
  if (!level) return null;
  const p = levelProgress(data, user, level, request);
  if (!p.total) return <p className="text-xs text-muted">No NCCP requirements are set for {lvName(level)} yet.</p>;
  return <div>
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-muted">{title || `Requirements for ${lvName(level)}`}</span><Badge tone={p.complete ? 'ok' : p.blocking.length ? 'warn' : 'info'}>{p.met} of {p.total} met{!p.complete && !p.blocking.length ? ', Challenge evaluation possible' : ''}</Badge></div>
    <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-ok" style={{ width: `${p.total ? Math.round(p.met / p.total * 100) : 0}%` }} /></div>
    <ul className="space-y-0.5 text-sm">{p.items.filter(i => !i.optional).map(i => <li key={i.id} className="flex items-start gap-2"><span className={i.st.met ? 'text-ok' : i.st.pending ? 'text-rope' : 'text-muted'} aria-hidden="true">{i.st.met ? '✓' : i.st.pending ? '?' : '○'}</span><span className={i.st.met ? '' : 'text-muted'}>{tr(i, 'label')}{i.st.met && i.st.date && <span className="text-xs text-muted"> ({fmtDate(i.st.date)})</span>}{i.st.pending && <span className="text-xs text-rope"> (evaluator to confirm)</span>}</span></li>)}</ul>
    {!p.linked && <p className="mt-1 text-xs text-muted">No Locker transcript linked{nccpOf(user) ? '' : ': NCCP # missing'}.</p>}
  </div>;
}

/* ---------- Email text ---------- */
const fillTpl = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => vars[k] !== undefined ? String(vars[k]) : m);
function chartText(d, user, level, req, lang) {
  const pr = levelProgress(d, user, level, req);
  const out = [];
  CE_STAGES.forEach(s => {
    pr.items.filter(i => (i.stage || 'start') === s.key && (!i.optional || i.st.met)).forEach(i => { const link = tr(i, 'link', lang); out.push(`${i.st.met ? '✓' : '✗'} ${tr(i, 'label', lang)}${i.st.met ? (i.st.date ? ` (${i.st.date})` : '') : link ? ` → ${link}` : ''}`); });
    if (s.key !== 'evaluation') out.push(`   —— ${s.heading(level, lang)} ——`);
  });
  (level.tasks || []).forEach(t => out.push(`   ${t.step} ${tr(t, 'title', lang)}`));
  out.push(`   —— ${lvName(level, lang)} ${isFr(lang) ? '« certifié »' : '“Certified”'} ——`);
  return out.join('\n');
}
const tasksText = (tasks, lang) => tasks.map(t => `${t.step}. ${tr(t, 'title', lang)}\n   ${tr(t, 'what', lang)}${t.assignment ? `\n   ${isFr(lang) ? 'Assigné' : 'Assigned'}: ${t.assignment}` : ''}`).join('\n\n');
function evalVars(d, req, lang) {
  const coach = getUser(d, req.requesterId) || {}; const ev = getUser(d, req.assignedEvaluatorId) || {};
  const level = levelOf(d, req.programId, req.levelId) || { name: '' };
  return { coachFirst: coach.firstName || '', coachName: fullName(coach), levelName: lvName(level, lang), evaluatorName: fullName(ev), evaluatorEmail: ev.email || (req.evaluatorContact || {}).email || '', portalUrl: evalPortalUrl(), pathwayUrl: level.pathwayUrl || ((d.programs || []).find(p => p.id === req.programId) || {}).coachingPage || 'https://boxingcanada.org/coaching/', nccp: reqNccp(d, req), province: coach.province || '', orderNo: (req.payment || {}).transactionId || '', trackNote: req.track === 'challenge' ? (isFr(lang) ? ' sous forme d’évaluation de type défi' : ' as a Challenge evaluation') : '' };
}
function queueEvalMail(d, req, kind, subject, body, by) {
  const coach = getUser(d, req.requesterId);
  const m = { id: uid('mail'), kind, requestId: req.id, to: coach ? coach.email : '', userId: req.requesterId, subject, body, at: nowIso() };
  d.outbox = d.outbox || []; d.outbox.unshift(m);
  req.emails = [...(req.emails || []), { id: uid('em'), kind, subject, at: m.at, by }];
}

/* ---------- Files and links ---------- */
async function uploadEvalFile(file, requestId) {
  if (WP) {
    if (WP.maxUpload && file.size > WP.maxUpload) throw new Error(`Files can be up to ${Math.round(WP.maxUpload / 1048576)} MB. Share videos as a YouTube or Google Drive link instead.`);
    const fd = new FormData(); fd.append('requestId', requestId); fd.append('file', file);
    const r = await fetch(WP.rest + 'files', { method: 'POST', credentials: 'same-origin', headers: { 'X-WP-Nonce': WP.nonce }, body: fd });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || !j.ok) throw new Error((j && j.message) || 'The upload didn’t finish. Try again.');
    return j.file;
  }
  if (file.size > 1.5 * 1048576) throw new Error('In this test version, files can be up to 1.5 MB. Share videos as a link.');
  return { fileId: uid('f'), name: file.name, mime: file.type, size: file.size, dataUrl: await readFileAsDataUrl(file) };
}
const fileHref = s => s.dataUrl || (WP ? `${WP.rest}files/${s.fileId}?_wpnonce=${WP.nonce}` : '#');
const isUrl = s => /^https?:\/\/\S+\.\S+/i.test(String(s || '').trim());
const linkLabel = u => { const s = String(u); return /youtu\.?be/i.test(s) ? 'YouTube' : /drive\.google|docs\.google/i.test(s) ? 'Google Drive' : /vimeo/i.test(s) ? 'Vimeo' : /dropbox/i.test(s) ? 'Dropbox' : /onedrive|sharepoint/i.test(s) ? 'OneDrive' : 'Link'; };

function Thread({ items, onAdd, placeholder, emptyText }) {
  const { data, viewer } = useApp();
  const [txt, setTxt] = useState('');
  return <div className="space-y-2">
    {(items || []).length ? <ul className="space-y-1.5">{items.map(c => <li key={c.id} className={cx('max-w-prose rounded-md border px-3 py-1.5 text-sm', c.by === viewer.id ? 'ml-auto border-rope bg-ropesoft' : 'border-line bg-sunk')}><div className="text-xs text-muted"><b className="text-ink">{c.by === 'square' ? 'Square store' : nameOf(data, c.by)}</b> · {fmtStamp(c.at)}</div><p className="whitespace-pre-wrap">{c.text}</p></li>)}</ul> : emptyText ? <p className="text-xs text-muted">{emptyText}</p> : null}
    {onAdd && <div className="flex gap-2"><textarea rows={1} className="field min-h-[38px] flex-1" placeholder={placeholder || 'Write a comment'} value={txt} onChange={e => setTxt(e.target.value)} /><Btn size="sm" disabled={!txt.trim()} onClick={() => { onAdd(txt.trim()); setTxt(''); }}>Send</Btn></div>}
  </div>;
}

/* An online version of a paper template: repeated entries, each with fields and rows. */
function TableForm({ form, value, onChange, readOnly }) {
  const entries = (value && value.entries) || [];
  const n = Math.max(form.repeat || 1, entries.length);
  const get = i => entries[i] || { fields: {}, rows: [] };
  const set = (i, e) => { const next = Array.from({ length: n }, (_, k) => k === i ? e : get(k)); onChange({ entries: next }); };
  return <div className="space-y-3">{Array.from({ length: n }, (_, i) => { const e = get(i); const rows = e.rows.length ? e.rows : Array.from({ length: form.minRows || 1 }, () => ({}));
    return <fieldset key={i} className="rounded-md border border-line p-2.5">
      <legend className="px-1 text-xs font-bold text-muted">{tr(form, 'repeatLabel')}{n > 1 ? ` ${i + 1}` : ''}</legend>
      {(form.fields || []).length > 0 && <div className="mb-2 grid gap-2 sm:grid-cols-3">{form.fields.map(f => <Field key={f.key} label={tr(f, 'label')}>{readOnly ? <div className="text-sm font-semibold">{e.fields[f.key] || '—'}</div> : <input className="field py-1" value={e.fields[f.key] || ''} onChange={ev => set(i, { ...e, fields: { ...e.fields, [f.key]: ev.target.value } })} />}</Field>)}</div>}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{form.columns.map(c => <th key={c.key} className="px-1 pb-1 font-semibold">{tr(c, 'label')}</th>)}{!readOnly && <th />}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri} className="align-top">{form.columns.map(c => <td key={c.key} className="p-1">{readOnly ? <div className="whitespace-pre-wrap rounded bg-sunk px-2 py-1">{r[c.key] || '—'}</div> : <textarea rows={2} className="field py-1 text-sm" value={r[c.key] || ''} onChange={ev => { const rs = rows.map((x, k) => k === ri ? { ...x, [c.key]: ev.target.value } : x); set(i, { ...e, rows: rs }); }} />}</td>)}
          {!readOnly && <td className="p-1"><Btn size="xs" variant="ghost" disabled={rows.length <= 1} onClick={() => set(i, { ...e, rows: rows.filter((_, k) => k !== ri) })} aria-label="Remove row">✕</Btn></td>}</tr>)}</tbody></table></div>
      {!readOnly && <Btn size="xs" className="mt-1" onClick={() => set(i, { ...e, rows: [...rows, {}] })}>Add a row</Btn>}
    </fieldset>; })}</div>;
}
const formFilled = (form, v) => !!(v && (v.entries || []).some(e => (e.rows || []).some(r => form.columns.some(c => String(r[c.key] || '').trim()))));

/* ---------- One evaluation task: instructions, the coach's work, the evaluator's review ---------- */
function TaskCard({ req, task, canCoach, canEval }) {
  const { data, update, viewer, notify } = useApp();
  const st = taskState(task);
  const done = st === 'complete';
  const editable = canCoach && !done && req.status === 'in_progress';
  const [open, setOpen] = useState(!done);
  const [link, setLink] = useState(''); const [linkName, setLinkName] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [answer, setAnswer] = useState(task.answer); const [dirty, setDirty] = useState(false);
  const [text, setText] = useState('');
  const [fb, setFb] = useState((task.review && task.review.feedback) || '');
  const [asg, setAsg] = useState(task.assignment || ''); const [asgEdit, setAsgEdit] = useState(false);
  const [emailCoach, setEmailCoach] = useState(true);
  useEffect(() => { if (!dirty) setAnswer(task.answer); }, [task.answer]);
  const coach = getUser(data, req.requesterId); const lvl = levelName(data, req.programId, req.levelId);
  const mutTask = (fn, after) => update(d => { const x = d.evalRequests.find(y => y.id === req.id); const t = x.tasks.find(y => y.id === task.id); fn(t, x, d); if (after) after(x, d); });
  const addSub = s => mutTask(t => { t.submissions = [...(t.submissions || []), { id: uid('s'), by: viewer.id, at: nowIso(), ...s }]; });
  const removeSub = s => { mutTask(t => { t.submissions = (t.submissions || []).filter(x => x.id !== s.id); }); if (WP && s.fileId && !s.dataUrl) wpApi('files/' + s.fileId, null, 'DELETE').catch(() => {}); };
  const onFile = async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; setBusy(true); setErr(''); try { const up = await uploadEvalFile(f, req.id); addSub({ kind: 'file', ...up }); notify(`${f.name} uploaded.`); } catch (x) { setErr(x.message); } setBusy(false); };
  const hasVideo = (task.submissions || []).some(s => s.kind === 'link' || (s.kind === 'file' && /^video\//.test(s.mime || '')));
  const submit = () => {
    const work = (task.submissions || []).length || (task.form && formFilled(task.form, answer)) || (answer && answer.text);
    if (!work) { setErr('Add your work first: a video link, a file, the online form or a written answer.'); return; }
    if (task.requireVideo && !hasVideo) { setErr('This task needs a video. Add a YouTube, Google Drive or other video link (or upload a short video file).'); return; }
    setErr('');
    mutTask(t => { t.answer = answer || t.answer; t.submittedAt = nowIso(); }, (x, d) => { notifyUsers(d, x.assignedEvaluatorId, `${fullName(coach)} submitted ${lvl} task ${task.step} for review.`, 'EVALUATOR', { evalId: x.id }); });
    setDirty(false); notify(`Task ${task.step} sent to your evaluator.`);
  };
  const saveDraft = () => { mutTask(t => { t.answer = answer; t.draftAt = nowIso(); }); setDirty(false); notify('Draft saved. Submit the task when it’s ready.', 'info'); };
  const review = status => {
    if (status === 'needs_work' && !fb.trim()) { setErr('Tell the coach what to improve.'); return; }
    setErr('');
    mutTask(t => { const prev = t.review && t.review.status !== 'pending' ? [...((t.review && t.review.history) || []), { status: t.review.status, feedback: t.review.feedback, at: t.review.at, by: t.review.by }] : (t.review && t.review.history) || []; t.review = { status, feedback: fb.trim(), by: viewer.id, at: nowIso(), history: prev }; },
      (x, d) => { notifyUsers(d, x.requesterId, status === 'complete' ? `Task ${task.step} of your ${lvl} evaluation is complete.` : `Your evaluator asked for more work on task ${task.step}.`, 'EVALS', { evalId: x.id });
        if (status === 'needs_work' && emailCoach) { const lang = langOf(coach); queueEvalMail(d, x, 'eval_feedback', `${lvName(levelOf(d, x.programId, x.levelId), lang)}: ${isFr(lang) ? 'commentaires sur la tâche' : 'feedback on task'} ${task.step}`, `${coach.firstName},\n\n${isFr(lang) ? 'Commentaires sur la tâche' : 'Feedback on task'} ${task.step} (${tr(task, 'title', lang)}):\n\n${fb.trim()}\n\n${isFr(lang) ? 'Ajoutez votre travail révisé dans le portail' : 'Add your revised work in the portal'}: ${evalPortalUrl()}\n\n${fullName(viewer)}`, viewer.id); } });
    notify(status === 'complete' ? `Task ${task.step} marked complete.` : `Feedback sent to ${coach.firstName}.`);
  };
  const saveAsg = () => { mutTask(t => { t.assignment = asg.trim(); }, (x, d) => notifyUsers(d, x.requesterId, `Your evaluator updated the assignment for task ${task.step}: ${asg.trim()}.`, 'EVALS', { evalId: x.id })); setAsgEdit(false); };
  const addComment = txt => mutTask(t => { t.comments = [...(t.comments || []), { id: uid('c'), by: viewer.id, at: nowIso(), text: txt }]; }, (x, d) => notifyUsers(d, viewer.id === x.requesterId ? x.assignedEvaluatorId : x.requesterId, `${fullName(viewer)} commented on task ${task.step}: “${txt.slice(0, 80)}”`, viewer.id === x.requesterId ? 'EVALUATOR' : 'EVALS', { evalId: x.id }));
  const subs = task.submissions || [];
  const submits = task.submit || ['link', 'file', 'text'];
  return <article className={cx('rounded-lg border-2 bg-surface', done ? 'border-ok' : st === 'needs_work' ? 'border-maple' : st === 'submitted' ? 'border-warn' : 'border-line')}>
    <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left">
      <span className="rounded bg-rope px-2 py-0.5 font-display text-sm font-bold text-white">{task.step}</span>
      <span className="min-w-0 flex-1 font-display text-lg font-bold leading-tight">{tr(task, 'title')}</span>
      {task.inPerson && <Badge tone="neutral">In person</Badge>}
      <Badge tone={TASK_STATUS[st].tone}>{TASK_STATUS[st].label}</Badge>
      <span className="text-xs text-muted" aria-hidden="true">{open ? '▲' : '▼'}</span>
    </button>
    {open && <div className="space-y-3 border-t border-line px-4 pb-4 pt-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className="grid gap-3 md:grid-cols-2">
        <div><div className="text-xs font-semibold text-muted">What to do</div><p className="text-sm">{tr(task, 'what')}</p></div>
        <div><div className="text-xs font-semibold text-muted">How it’s evaluated</div><p className="text-sm">{tr(task, 'how')}</p>
          {(task.resources || []).length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{task.resources.map(r => <a key={r.url + r.label} href={r.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-rope px-2 py-0.5 text-xs font-semibold text-rope hover:bg-ropesoft">↗ {tr(r, 'label')}</a>)}</div>}</div>
      </div>
      {(task.assignable || task.assignment) && <div className="rounded-md border border-rope bg-ropesoft px-3 py-2 text-sm">
        <span className="text-xs font-semibold text-muted">Assigned by your evaluator: </span>
        {asgEdit ? <span className="inline-flex flex-wrap items-center gap-1"><input className="field w-64 py-0.5 text-sm" value={asg} placeholder={task.assignHint || ''} onChange={e => setAsg(e.target.value)} /><Btn size="xs" variant="primary" onClick={saveAsg}>Save</Btn><Btn size="xs" variant="ghost" onClick={() => { setAsg(task.assignment || ''); setAsgEdit(false); }}>Cancel</Btn></span>
          : <><b>{task.assignment || (canEval ? <span className="font-normal text-warn">Not set yet</span> : 'Your evaluator will set this')}</b>{canEval && !done && <Btn size="xs" variant="ghost" className="ml-1" onClick={() => setAsgEdit(true)}>Change</Btn>}</>}
        {canEval && task.assignHint && !task.assignment && <span className="block text-xs text-muted">{task.assignHint}</span>}
      </div>}

      <div className="rounded-md border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunk px-3 py-1.5"><h5 className="font-display text-base font-bold">{canCoach ? 'Your work' : `${coach ? coach.firstName : 'Coach'}’s work`}</h5>{task.submittedAt && <span className="text-xs text-muted">Submitted {fmtStamp(task.submittedAt)}</span>}</div>
        <div className="space-y-3 p-3">
          {subs.length ? <ul className="space-y-1">{subs.map(s => <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="info">{s.kind === 'file' ? (/^video\//.test(s.mime || '') ? 'Video file' : /^image\//.test(s.mime || '') ? 'Photo' : 'File') : linkLabel(s.url)}</Badge>
            {s.kind === 'file' ? <a className="font-semibold text-rope underline" href={fileHref(s)} target="_blank" rel="noopener noreferrer" download={s.dataUrl ? s.name : undefined}>{s.name}</a> : <a className="break-all font-semibold text-rope underline" href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.label || s.url}</a>}
            {s.size ? <span className="text-xs text-muted">{fmtSize(s.size)}</span> : null}<span className="text-xs text-muted">{fmtStamp(s.at)}</span>
            {editable && s.by === viewer.id && <Btn size="xs" variant="ghost" onClick={() => removeSub(s)}>Remove</Btn>}
          </li>)}</ul> : !editable && !(task.form && formFilled(task.form, task.answer)) && !(task.answer && task.answer.text) ? <p className="text-sm text-muted">Nothing submitted yet.</p> : null}
          {task.form && (editable || formFilled(task.form, task.answer)) && <div><div className="mb-1 text-xs font-semibold text-muted">Online form{task.form && task.form.optional ? ' (optional)' : ''}</div><TableForm form={task.form} value={editable ? answer : task.answer} readOnly={!editable} onChange={v => { setAnswer({ ...(answer || {}), ...v }); setDirty(true); }} /></div>}
          {(editable && submits.includes('text')) || (task.answer && task.answer.text) ? <Field label="Written answer or notes for your evaluator">{editable ? <textarea rows={3} className="field" value={(answer && answer.text) || ''} onChange={e => { setAnswer({ ...(answer || {}), text: e.target.value }); setDirty(true); }} /> : <p className="whitespace-pre-wrap rounded bg-sunk px-3 py-2 text-sm">{task.answer.text}</p>}</Field> : null}
          {editable && <div className="space-y-2 rounded-md bg-sunk p-2.5">
            {submits.includes('link') && <div className="flex flex-wrap items-end gap-2"><Field className="min-w-[220px] flex-1" label="Video link (YouTube unlisted, Google Drive, Vimeo…)"><input className="field" inputMode="url" placeholder="https://" value={link} onChange={e => setLink(e.target.value)} /></Field><Field className="w-48" label="Description (optional)"><input className="field" value={linkName} onChange={e => setLinkName(e.target.value)} /></Field><Btn variant="rope" disabled={!isUrl(link)} onClick={() => { addSub({ kind: 'link', url: link.trim(), label: linkName.trim() }); setLink(''); setLinkName(''); }}>Add link</Btn></div>}
            {submits.includes('file') && <label className={cx('inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-ropesoft', busy && 'opacity-50')}>{busy ? 'Uploading…' : '📎 Upload a photo or PDF of your template'}<input type="file" className="hidden" disabled={busy} accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,video/*" onChange={onFile} /></label>}
            {submits.includes('file') && <p className="text-xs text-muted">Files up to {WP && WP.maxUpload ? Math.round(WP.maxUpload / 1048576) : 1.5} MB. Share videos as a link: set YouTube videos to “Unlisted”, or Google Drive files to “Anyone with the link”.</p>}
          </div>}
          {editable && <div className="flex flex-wrap justify-end gap-2">{dirty && <Btn onClick={saveDraft}>Save draft</Btn>}<Btn variant="primary" onClick={submit}>{st === 'needs_work' || st === 'submitted' ? 'Resubmit for review' : 'Submit for review'}</Btn></div>}
        </div>
      </div>

      {(task.review && (task.review.feedback || (task.review.history || []).length)) || canEval ? <div className={cx('rounded-md border p-3', done ? 'border-ok bg-oksoft' : st === 'needs_work' ? 'border-maple bg-maplesoft' : 'border-line')}>
        <h5 className="mb-1 font-display text-base font-bold">Evaluator feedback</h5>
        {(task.review && task.review.history || []).map((h, k) => <p key={k} className="mb-1 text-xs text-muted"><b>{TASK_STATUS[h.status] ? TASK_STATUS[h.status].label : h.status}</b>, {fmtStamp(h.at)}: {h.feedback}</p>)}
        {canEval && !done && req.status === 'in_progress' ? <div className="space-y-2">
          <textarea rows={3} className="field" placeholder="What went well, and what to improve" value={fb} onChange={e => setFb(e.target.value)} />
          <div className="flex flex-wrap items-center justify-end gap-2"><label className="mr-auto flex items-center gap-2 text-xs font-semibold text-muted"><input type="checkbox" checked={emailCoach} onChange={e => setEmailCoach(e.target.checked)} />Email the coach when asking for more work</label><Btn variant="danger" onClick={() => review('needs_work')}>Needs more work</Btn><Btn variant="ok" onClick={() => review('complete')}>✓ Mark complete</Btn></div>
        </div> : task.review && task.review.feedback ? <p className="whitespace-pre-wrap text-sm">{task.review.feedback}<span className="block text-xs text-muted">{nameOf(data, task.review.by)}, {fmtStamp(task.review.at)}</span></p> : <p className="text-sm text-muted">No feedback yet.</p>}
        {canEval && done && req.status === 'in_progress' && <div className="mt-2 text-right"><Btn size="xs" variant="ghost" onClick={() => mutTask(t => { t.review = { ...t.review, status: 'needs_work' }; })}>Reopen this task</Btn></div>}
      </div> : null}
      <div><div className="mb-1 text-xs font-semibold text-muted">Questions and comments on this task</div><Thread items={task.comments} onAdd={(canCoach || canEval) && req.status !== 'completed' ? addComment : null} emptyText="No comments yet." /></div>
    </div>}
  </article>;
}

/* ---------- Emails from the evaluator: ready, outstanding items, outcome ---------- */
function EvalMailModal({ req, kind, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const coach = getUser(data, req.requesterId);
  const prog = (data.programs || []).find(p => p.id === req.programId);
  const level = levelOf(data, req.programId, req.levelId);
  const [lang, setLang] = useState(langOf(coach));
  const [track, setTrack] = useState(req.track || (levelProgress(data, coach, level, req).challenge.length ? 'challenge' : 'regular'));
  const [asg, setAsg] = useState(() => Object.fromEntries((level.tasks || []).map(t => [t.id, ''])));
  const [result, setResult] = useState('certified');
  const [feedback, setFeedback] = useState('');
  const pr = levelProgress(data, coach, level, req);
  const nextLevel = prog.levels[prog.levels.findIndex(l => l.id === level.id) + 1];
  const [nsEdited, setNsEdited] = useState(false);
  const nextSteps0 = (lg, res) => { const nx = nextLevel ? levelProgress(data, coach, nextLevel).items.filter(i => i.stage === 'training' && !i.optional && !i.st.met) : []; return (res || result) === 'certified'
    ? (isFr(lg) ? `J’inscrirai votre évaluation dans le Casier du PNCE. Elle peut prendre quelques jours à apparaître, car l’ACE l’approuve manuellement.` : `I’ll enter your evaluation in the NCCP Locker. It usually takes a few days to show up, as the CAC approves it manually.`) + (nx.length ? (isFr(lg) ? `\n\nPour vos prochains cours, priorisez : ` : `\n\nIf you’re looking at your next coaching courses, prioritize: `) + nx.map(i => `${tr(i, 'label', lg)}${tr(i, 'link', lg) ? ' ' + tr(i, 'link', lg) : ''}`).join('; ') + '.' : '')
    : (isFr(lg) ? `Ajoutez votre travail révisé dans le portail et je l’examinerai : ${evalPortalUrl()}` : `Add your revised work in the portal and I’ll review it: ${evalPortalUrl()}`); };
  const [nextSteps, setNextSteps] = useState(() => nextSteps0(langOf(coach)));
  const build = (lg, opts) => {
    const tpl = ((prog.emailTemplates || {})[kind] || {})[lg] || ((prog.emailTemplates || {})[kind] || {}).en || { subject: '', body: '' };
    const v = { ...evalVars(data, { ...req, track: opts.track }, lg) };
    if (kind === 'ready') { v.chart = chartText(data, coach, level, req, lg); v.tasks = tasksText(startTasks(level, opts.asg), lg); }
    if (kind === 'outstanding') { v.chart = chartText(data, coach, level, req, lg); v.outstanding = pr.blocking.concat(opts.track === 'challenge' ? [] : pr.challenge).map(i => `• ${tr(i, 'label', lg)}${tr(i, 'link', lg) ? ` → ${tr(i, 'link', lg)}` : ''}`).join('\n') || '•'; }
    if (kind === 'outcome') { const ok = opts.result === 'certified'; v.result = ok ? (isFr(lg) ? `RÉUSSITE pour toutes les tâches! Vous êtes maintenant entraîneur ${v.levelName} certifié.` : `PASS for all tasks! You are now a Certified ${v.levelName} coach.`) : (isFr(lg) ? `Vous n’avez pas encore satisfait à toutes les exigences de ${v.levelName}. Voyez les commentaires ci-dessous.` : `You haven’t yet met all the requirements for ${v.levelName}. See the feedback below for what to work on.`); v.resultShort = ok ? (isFr(lg) ? 'certifié!' : 'Certified!') : (isFr(lg) ? 'commentaires' : 'feedback'); v.taskResults = (req.tasks || []).map(t => `${t.step} ${tr(t, 'title', lg)}: ${taskState(t) === 'complete' ? (isFr(lg) ? 'RÉUSSI' : 'PASS') : (isFr(lg) ? 'À REFAIRE' : 'NOT YET')}`).join('\n'); v.feedback = opts.feedback || '—'; v.nextSteps = opts.nextSteps || '—'; }
    return { subject: fillTpl(tpl.subject, v), body: fillTpl(tpl.body, v) };
  };
  const [mail, setMail] = useState(() => build(langOf(coach), { track, asg, result, feedback, nextSteps }));
  const [edited, setEdited] = useState(false);
  const [send, setSend] = useState(true);
  const [err, setErr] = useState('');
  const regen = (o = {}) => { if (!edited) setMail(build(o.lang || lang, { track, asg, result, feedback, nextSteps, ...o })); };
  const allDone = (req.tasks || []).length > 0 && req.tasks.every(t => taskState(t) === 'complete');
  const title = { ready: 'Coach is ready: send the evaluation tasks', outstanding: 'Send outstanding items', outcome: 'Record the outcome' }[kind];
  const go = () => {
    if (kind === 'outcome' && !feedback.trim()) { setErr('Add your overall feedback for the coach.'); return; }
    if (kind === 'outcome' && result === 'certified' && !allDone) { setErr('Mark every task complete before certifying the coach.'); return; }
    if (send && (!mail.subject.trim() || !mail.body.trim())) { setErr('The email needs a subject and a message.'); return; }
    const lname = lvName(level);
    update(d => {
      const x = d.evalRequests.find(y => y.id === req.id);
      const at = nowIso();
      x.history = [...(x.history || [])];
      if (kind === 'ready') {
        x.track = track; x.status = 'in_progress'; x.startedAt = at;
        x.readiness = { ...(x.readiness || {}), decision: 'ready', at, by: viewer.id, track, items: pr.items.map(i => ({ id: i.id, met: i.st.met })) };
        if (!(x.tasks || []).length) x.tasks = startTasks(level, asg);
        x.history.push({ id: uid('h'), at, by: viewer.id, text: `Readiness confirmed${track === 'challenge' ? ' (Challenge evaluation)' : ''}: tasks opened${send ? ' and email sent' : ''}` });
        notifyUsers(d, x.requesterId, `You’re ready for your ${lname} evaluation. Your tasks are open.`, 'EVALS', { evalId: x.id });
      } else if (kind === 'outstanding') {
        x.track = track; x.status = 'not_ready';
        x.readiness = { ...(x.readiness || {}), decision: 'outstanding', at, by: viewer.id, track, items: pr.items.map(i => ({ id: i.id, met: i.st.met })) };
        x.history.push({ id: uid('h'), at, by: viewer.id, text: `Outstanding items sent: ${pr.blocking.map(i => i.label).join(', ') || '—'}` });
        notifyUsers(d, x.requesterId, `Your evaluator listed what to complete before your ${lname} evaluation.`, 'EVALS', { evalId: x.id });
      } else {
        x.outcome = { result, date: REF_DATE, notes: feedback.trim(), nextSteps: nextSteps.trim(), by: viewer.id, at };
        x.finalFeedback = feedback.trim();
        if (result === 'certified') { x.status = 'completed'; if (!WP || viewer.role === 'nsoadmin') { const u = d.users.find(y => y.id === x.requesterId); const rk = id => prog.levels.findIndex(l => l.id === id); if (rk(x.levelId) > rk((u.certs || {})[x.programId])) { u.certs = { ...(u.certs || {}), [x.programId]: x.levelId }; u.certHistory = [...(u.certHistory || []), { programId: x.programId, levelId: x.levelId, at, by: viewer.id, note: 'Certified by evaluation ' + x.id, requestId: x.id }]; } } }
        x.history.push({ id: uid('h'), at, by: viewer.id, text: result === 'certified' ? `Certified at ${lname}` : `Feedback sent: not yet certified at ${lname}` });
        notifyUsers(d, x.requesterId, result === 'certified' ? `Congratulations: you’re certified as ${lname}.` : `Your evaluator sent feedback on your ${lname} evaluation.`, 'EVALS', { evalId: x.id });
        if (result === 'certified') notifyUsers(d, 'role:nsoadmin', `${fullName(coach)} is certified at ${lname} (evaluated by ${fullName(viewer)}). Enter it in The Locker if the evaluator hasn’t.`, 'COACHPROG', { evalId: x.id });
      }
      if (send) queueEvalMail(d, x, 'eval_' + kind, mail.subject.trim(), mail.body.trim(), viewer.id);
    });
    notify(kind === 'outcome' ? (result === 'certified' ? `${coach.firstName} is certified. Boxing Canada has been notified.` : `Feedback sent to ${coach.firstName}.`) : kind === 'ready' ? `Tasks opened for ${coach.firstName}${send ? ' and the email sent' : ''}.` : `Outstanding items sent to ${coach.firstName}.`);
    onClose(true);
  };
  return <Modal size="xl" title={title} subtitle={`${fullName(coach)}, ${lvName(level)}`} onClose={() => onClose(false)}
    footer={<><label className="mr-auto flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={send} onChange={e => setSend(e.target.checked)} />Email {coach.firstName} ({coach.email || 'no email on file'})</label><Btn onClick={() => onClose(false)}>Cancel</Btn><Btn variant={kind === 'outstanding' ? 'primary' : 'ok'} onClick={go}>{kind === 'ready' ? 'Open the tasks' : kind === 'outstanding' ? 'Send' : result === 'certified' ? 'Certify and send' : 'Send feedback'}</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      {kind !== 'outcome' && <Field label="Evaluation type"><div className="flex flex-wrap gap-2">{[['regular', 'Regular evaluation'], ['challenge', 'Challenge evaluation (boxing course not taken)']].map(([k, l]) => <label key={k} className={cx('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold', track === k ? 'border-rope bg-ropesoft' : 'border-line')}><input type="radio" checked={track === k} onChange={() => { setTrack(k); regen({ track: k }); }} />{l}</label>)}</div></Field>}
      {kind === 'ready' && pr.blocking.length > 0 && <Banner tone="warn">{pr.blocking.length} required item{pr.blocking.length === 1 ? ' isn’t' : 's aren’t'} met yet: {pr.blocking.map(i => tr(i, 'label')).join(', ')}. Mark them as met in the readiness check if you’ve confirmed them another way.</Banner>}
      {kind === 'ready' && (level.tasks || []).some(t => t.assignable) && <div className="grid gap-2 sm:grid-cols-3">{level.tasks.filter(t => t.assignable).map(t => <Field key={t.id} label={`${t.step}: ${tr(t, 'title')}`} hint={t.assignHint}><input className="field" value={asg[t.id] || ''} onChange={e => { const a = { ...asg, [t.id]: e.target.value }; setAsg(a); regen({ asg: a }); }} /></Field>)}</div>}
      {kind === 'outcome' && <>
        {!allDone && <Banner tone="warn">Not every task is marked complete. You can still send “not yet” feedback.</Banner>}
        <Field label="Result" required><div className="flex flex-wrap gap-2">{[['certified', '✓ Certified at ' + lvName(level)], ['not_yet', 'Not yet']].map(([k, l]) => <label key={k} className={cx('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold', result === k ? (k === 'certified' ? 'border-ok bg-oksoft text-ok' : 'border-warn bg-warnsoft text-warn') : 'border-line')}><input type="radio" checked={result === k} onChange={() => { setResult(k); const ns = nsEdited ? nextSteps : nextSteps0(lang, k); setNextSteps(ns); regen({ result: k, nextSteps: ns }); }} />{l}</label>)}</div></Field>
        <Field label="Overall feedback for the coach" required hint="What went well and what to consider improving. Included in the email."><textarea rows={5} className="field" value={feedback} onChange={e => { setFeedback(e.target.value); regen({ feedback: e.target.value }); }} /></Field>
        <Field label="What happens next"><textarea rows={3} className="field" value={nextSteps} onChange={e => { setNextSteps(e.target.value); setNsEdited(true); regen({ nextSteps: e.target.value }); }} /></Field>
      </>}
      <div className="rounded-md border border-line">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-sunk px-3 py-1.5"><span className="text-xs font-semibold text-muted">Email to {fullName(coach)}</span><div className="ml-auto inline-flex rounded-md border border-line p-0.5" data-i18n-skip="">{[['en', 'English'], ['fr', 'Français']].map(([k, l]) => <button key={k} type="button" onClick={() => { const ns = nsEdited || kind !== 'outcome' ? nextSteps : nextSteps0(k); setNextSteps(ns); setLang(k); setEdited(false); setMail(build(k, { track, asg, result, feedback, nextSteps: ns })); }} className={cx('rounded px-2 py-0.5 text-xs font-semibold', lang === k ? 'bg-rope text-white' : 'text-muted')}>{l}</button>)}</div>{edited && <Btn size="xs" variant="ghost" onClick={() => { setEdited(false); setMail(build(lang, { track, asg, result, feedback, nextSteps })); }}>Reset to template</Btn>}</div>
        <div className="space-y-2 p-3" data-i18n-skip="">
          <input className="field font-semibold" value={mail.subject} onChange={e => { setMail({ ...mail, subject: e.target.value }); setEdited(true); }} aria-label="Subject" />
          <textarea rows={16} className="field font-mono text-xs leading-relaxed" value={mail.body} onChange={e => { setMail({ ...mail, body: e.target.value }); setEdited(true); }} aria-label="Message" />
          <p className="text-xs text-muted">Sent from the portal with replies to you{WP ? '' : ' (test version: emails are kept in the outbox, not sent)'}. Boxing Canada gets a copy.</p>
        </div>
      </div>
    </div>
  </Modal>;
}

/* ---------- The shared evaluation screen ---------- */
function EvaluationWorkspace({ reqId, onBack }) {
  const { data, update, viewer, notify } = useApp();
  const req = (data.evalRequests || []).find(r => r.id === reqId);
  const [mail, setMail] = useState(null);
  const [showHist, setShowHist] = useState(false);
  const [assign, setAssign] = useState(false);
  if (!req) return <div className="space-y-3"><Btn onClick={onBack}>← Back</Btn><Banner tone="warn">This evaluation isn’t available.</Banner></div>;
  const coach = getUser(data, req.requesterId) || { firstName: 'Coach', lastName: '', certs: {} };
  const level = levelOf(data, req.programId, req.levelId) || { id: req.levelId, name: 'Unknown level', reqs: [], tasks: [] };
  const isCoach = req.requesterId === viewer.id;
  const isEval = req.assignedEvaluatorId === viewer.id;
  const isNso = viewer.role === 'nsoadmin';
  const canEval = isEval || (isNso && !isCoach);
  const canCoach = isCoach;
  const tasks = req.tasks || [];
  const doneN = tasks.filter(t => taskState(t) === 'complete').length;
  const st = EVAL_STATUS[req.status] || EVAL_STATUS.paid;
  const pr = levelProgress(data, coach, level, req);
  const ev = getUser(data, req.assignedEvaluatorId);
  const evContact = req.evaluatorContact || (ev ? { name: fullName(ev), email: ev.email } : null);
  const t = trackieOf(coach);
  const setOverride = (id, val) => update(d => { const x = d.evalRequests.find(y => y.id === req.id); const ov = { ...((x.readiness || {}).overrides || {}) }; if (val) ov[id] = { ...val, by: viewer.id, at: nowIso() }; else delete ov[id]; x.readiness = { ...(x.readiness || {}), overrides: ov }; });
  const addMsg = txt => update(d => { const x = d.evalRequests.find(y => y.id === req.id); x.messages = [...(x.messages || []), { id: uid('m'), by: viewer.id, at: nowIso(), text: txt }]; const to = isCoach ? x.assignedEvaluatorId || 'role:nsoadmin' : x.requesterId; notifyUsers(d, to, `${fullName(viewer)}: “${txt.slice(0, 90)}”`, isCoach ? 'EVALUATOR' : 'EVALS', { evalId: x.id }); });
  const lockerDone = () => { update(d => { const x = d.evalRequests.find(y => y.id === req.id); x.lockerEntry = { by: viewer.id, at: nowIso() }; x.history = [...(x.history || []), { id: uid('h'), at: nowIso(), by: viewer.id, text: 'Evaluation entered in The Locker' }]; }); notify('Marked as entered in The Locker.'); };
  const allDone = tasks.length > 0 && doneN === tasks.length;
  const readinessOpen = canEval && ['assigned', 'not_ready'].includes(req.status);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Btn onClick={onBack}>← {isCoach ? 'My evaluations' : 'All evaluations'}</Btn>{!isCoach && <span className="text-xs text-muted">Opened as {isEval ? 'the evaluator' : isNso ? 'Boxing Canada' : 'view only'}</span>}</div>
    <section className="rounded-lg border-2 border-rope bg-surface p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{lvCode(level) && <span className="mr-1 rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{lvCode(level)}</span>}Coach evaluation{req.track === 'challenge' ? ' · Challenge evaluation' : ''}</p>
          <h2 className="font-display text-2xl font-extrabold leading-tight">{lvName(level)}{lvFormer(level) && <span className="ml-2 text-sm font-semibold text-muted">(formerly {lvFormer(level)})</span>}</h2>
          <p className="text-sm">{isCoach ? <>Evaluator: <b>{evContact ? evContact.name : 'being assigned by Boxing Canada'}</b>{evContact && evContact.email && <> · <a className="text-rope underline" href={`mailto:${evContact.email}`}>{evContact.email}</a></>}</> : <><b>{fullName(coach)}</b> · NCCP {reqNccp(data, req) || '—'} · {coach.province}{coach.club ? `, ${coach.club}` : ''}{coach.email && <> · <a className="text-rope underline" href={`mailto:${coach.email}`}>{coach.email}</a></>}{phoneOf(coach) && ` · ${phoneOf(coach)}`}</>}</p>
        </div>
        <div className="flex flex-col items-end gap-1"><Badge tone={st.tone}>{st.label}</Badge>{req.outcome && <Badge tone={req.outcome.result === 'certified' ? 'ok' : 'warn'}>{req.outcome.result === 'certified' ? '✓ Certified' : 'Not yet certified'}</Badge>}<span className="text-xs text-muted">Requested {fmtDate(req.createdAt.slice(0, 10))}{req.payment && req.payment.transactionId ? ` · Square ${req.payment.transactionId}` : ''}</span></div>
      </div>
      {tasks.length > 0 && <div className="mt-3"><div className="mb-1 flex justify-between text-xs font-semibold text-muted"><span>Evaluation tasks</span><span>{doneN} of {tasks.length} complete</span></div><div className="h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-ok" style={{ width: `${Math.round(doneN / tasks.length * 100)}%` }} /></div></div>}
      {!isCoach && !isEval && isNso && <div className="mt-3 flex flex-wrap gap-2">{['paid', 'assigned', 'not_ready'].includes(req.status) && <Btn size="sm" variant="primary" onClick={() => setAssign(true)}>{req.assignedEvaluatorId ? 'Change evaluator' : 'Assign an evaluator'}</Btn>}</div>}
    </section>

    {isCoach && req.status === 'paid' && <Banner tone="info">Boxing Canada received your request and is assigning an evaluator (usually within 1 business day).</Banner>}
    {isCoach && req.status === 'assigned' && <Banner tone="info">{evContact ? evContact.name : 'Your evaluator'} is checking your NCCP record and membership. You’ll get an email with your evaluation tasks, or with anything still to complete.</Banner>}
    {isCoach && req.status === 'not_ready' && <Section title="Before your evaluation" sub="Complete these, then let your evaluator know. The Locker can take a few days to show new courses.">
      <ul className="mb-3 space-y-1 text-sm">{pr.blocking.concat(req.track === 'challenge' ? [] : pr.challenge).map(i => <li key={i.id} className="flex flex-wrap gap-2"><span className="text-warn">✗</span><b>{tr(i, 'label')}</b>{tr(i, 'link') && <a className="text-rope underline" href={tr(i, 'link')} target="_blank" rel="noopener noreferrer">How</a>}</li>)}{!pr.blocking.length && <li className="text-ok">Everything listed is now on record. Tell your evaluator below.</li>}</ul>
      <Btn variant="primary" onClick={() => addMsg('I’ve completed the outstanding items. Please check my record again.')}>Tell my evaluator I’m done</Btn>
    </Section>}
    {isCoach && req.status === 'in_progress' && <Banner tone="info">Complete each task below. Add video links, upload photos of your templates or fill in the online forms, then submit each task for review. You’ll see your evaluator’s feedback here.</Banner>}
    {req.status === 'completed' && req.outcome && <Section title={req.outcome.result === 'certified' ? `✓ Certified: ${lvName(level)}` : 'Evaluation feedback'} sub={`${fmtDate(req.outcome.date)} · ${nameOf(data, req.outcome.by)}`}>
      <p className="whitespace-pre-wrap text-sm">{req.outcome.notes}</p>{req.outcome.nextSteps && <><div className="mt-2 text-xs font-semibold text-muted">What happens next</div><p className="whitespace-pre-wrap text-sm">{req.outcome.nextSteps}</p></>}
      {req.outcome.result === 'certified' && !isCoach && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-sunk p-2 text-sm">{req.lockerEntry ? <Badge tone="ok">✓ Entered in The Locker {fmtDate(req.lockerEntry.at.slice(0, 10))} by {nameOf(data, req.lockerEntry.by)}</Badge> : <><span>Enter the evaluation in The Locker (create an event for it), then confirm here.</span><Btn size="sm" variant="primary" onClick={lockerDone}>Entered in The Locker</Btn></>}</div>}
    </Section>}

    {(readinessOpen || (!isCoach && req.readiness) || (isCoach && ['not_ready', 'in_progress', 'completed'].includes(req.status))) && <Section title="Pathway and readiness" sub={readinessOpen ? 'From The Locker and Trackie. Mark an item as met if you’ve confirmed it another way (for example a course not yet in The Locker).' : req.readiness ? `Checked by ${nameOf(data, req.readiness.by)} on ${fmtDate((req.readiness.at || '').slice(0, 10))}.` : ''}
      actions={readinessOpen && <div className="flex flex-wrap gap-2"><Btn variant="primary" onClick={() => setMail('outstanding')}>Send outstanding items</Btn><Btn variant="ok" onClick={() => setMail('ready')}>Coach is ready</Btn></div>}>
      {readinessOpen && <div className="mb-3 flex flex-wrap gap-2 text-sm">{pr.blocking.length ? <Badge tone="warn">{pr.blocking.length} required item{pr.blocking.length === 1 ? '' : 's'} outstanding</Badge> : <Badge tone="ok">✓ All required items met</Badge>}{pr.challenge.length > 0 && <Badge tone="info">Boxing course not on record: Challenge evaluation</Badge>}{!pr.linked && <Badge tone="warn">No Locker record for NCCP {reqNccp(data, req) || '—'}</Badge>}{t['COACH LEVEL'] && <Badge tone="neutral">Trackie: {t['COACH LEVEL']}</Badge>}</div>}
      <EvalChart user={coach} level={level} request={req} tasks={tasks} onOverride={readinessOpen ? setOverride : null} />
      {!isCoach && reqNccp(data, req) && <div className="mt-3"><NccpSummaryBlock no={reqNccp(data, req)} /></div>}
    </Section>}

    {tasks.length > 0 && <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-xl font-bold">Evaluation tasks</h3>{canEval && req.status === 'in_progress' && <Btn variant={allDone ? 'ok' : 'secondary'} onClick={() => setMail('outcome')}>{allDone ? '✓ Record outcome & send feedback' : 'Send overall feedback'}</Btn>}</div>
      {tasks.map(tk => <TaskCard key={tk.id} req={req} task={tk} canCoach={canCoach} canEval={canEval} />)}
    </div>}

    {(isCoach || canEval || req.messages && req.messages.length) && req.status !== 'paid' ? <Section title="Messages" sub={isCoach ? 'Questions for your evaluator.' : 'Messages with the coach.'}><Thread items={req.messages} onAdd={(isCoach || canEval) && req.status !== 'completed' ? addMsg : null} placeholder={isCoach ? 'Ask your evaluator a question' : `Write to ${coach.firstName}`} emptyText="No messages yet." /></Section> : null}

    {!isCoach && <div className="rounded-lg border border-line bg-surface"><button type="button" className="w-full px-4 py-2 text-left text-sm font-semibold" onClick={() => setShowHist(s => !s)} aria-expanded={showHist}>{showHist ? '▲' : '▼'} History and emails ({(req.history || []).length + (req.emails || []).length})</button>
      {showHist && <div className="grid gap-3 border-t border-line p-4 md:grid-cols-2"><ul className="space-y-1 text-sm">{(req.history || []).map(h => <li key={h.id || h.at}><span className="text-xs text-muted">{fmtStamp(h.at)} · {h.by === 'square' ? 'Square store' : nameOf(data, h.by)}</span><br />{h.text}</li>)}</ul><ul className="space-y-1 text-sm">{(req.emails || []).map(m => <li key={m.id}><span className="text-xs text-muted">{fmtStamp(m.at)} · {nameOf(data, m.by)}</span><br />✉️ {m.subject}</li>)}{!(req.emails || []).length && <li className="text-muted">No emails sent from the portal yet.</li>}</ul></div>}
    </div>}
    {mail && <EvalMailModal req={req} kind={mail} onClose={() => setMail(null)} />}
    {assign && <AssignModal req={req} onClose={() => setAssign(false)} />}
  </div>;
}

/* A one-line summary of an evaluation, for lists. */
function EvalRow({ r, onOpen, who }) {
  const { data } = useApp();
  const c = getUser(data, r.requesterId) || {}; const lv = levelOf(data, r.programId, r.levelId); const st = EVAL_STATUS[r.status] || EVAL_STATUS.paid;
  const tasks = r.tasks || []; const toReview = tasks.filter(t => taskState(t) === 'submitted').length;
  return <tr className="cursor-pointer hover:bg-sunk" onClick={() => onOpen(r.id)}>
    <Td className="font-semibold">{who === 'evaluator' ? fullName(c) : who === 'coach' ? lvName(lv) : fullName(c)}<div className="text-xs font-normal text-muted">{who === 'coach' ? (r.evaluatorContact ? `Evaluator: ${r.evaluatorContact.name}` : 'Evaluator to be assigned') : `${c.province || ''} · NCCP ${reqNccp(data, r) || '—'}`}</div></Td>
    {who !== 'coach' && <Td>{lvCode(lv) && <span className="mr-1 text-xs font-bold text-muted">{lvCode(lv)}</span>}{lvName(lv)}{r.track === 'challenge' && <Badge tone="info" className="ml-1">Challenge</Badge>}</Td>}
    <Td><Badge tone={st.tone}>{st.label}</Badge>{toReview > 0 && who !== 'coach' && <Badge tone="warn" className="ml-1">{toReview} to review</Badge>}</Td>
    <Td className="tabular-nums text-xs">{tasks.length ? `${tasks.filter(t => taskState(t) === 'complete').length} / ${tasks.length}` : '—'}</Td>
    {who === 'admin' && <Td>{r.assignedEvaluatorId ? nameOf(data, r.assignedEvaluatorId) : '—'}</Td>}
    <Td className="whitespace-nowrap text-xs">{fmtDate(r.createdAt.slice(0, 10))}</Td>
    <Td className="text-right"><Btn size="xs" variant={who === 'coach' && r.status === 'in_progress' ? 'primary' : 'secondary'}>Open</Btn></Td>
  </tr>;
}

function MyEvaluationsView() {
  const { data, viewer, nav } = useApp();
  const prog = progFor(data, viewer);
  const [openId, setOpenId] = useState((nav && nav.evalId) || null);
  if (openId) return <EvaluationWorkspace reqId={openId} onBack={() => setOpenId(null)} />;
  if (!prog) return <Banner tone="warn">No certification program is set up yet.</Banner>;
  const current = (viewer.certs || {})[prog.id];
  const curIdx = prog.levels.findIndex(l => l.id === current);
  const mine = (data.evalRequests || []).filter(r => r.requesterId === viewer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = mine.filter(r => EVAL_OPEN.includes(r.status));
  const next = prog.levels.slice(curIdx + 1).find(l => lvOffered(l) && l.evaluated !== false);
  const t = trackieOf(viewer);
  return <div className="space-y-4">
    {active.map(r => { const lv = levelOf(data, r.programId, r.levelId); const st = EVAL_STATUS[r.status]; const n = (r.tasks || []).length, dn = (r.tasks || []).filter(x => taskState(x) === 'complete').length, nw = (r.tasks || []).filter(x => taskState(x) === 'needs_work').length; return <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className="block w-full rounded-lg border-2 border-maple bg-surface p-4 text-left hover:bg-maplesoft">
      <div className="flex flex-wrap items-center gap-2"><span className="font-display text-xl font-extrabold">{lvName(lv)} evaluation</span><Badge tone={st.tone}>{st.label}</Badge>{nw > 0 && <Badge tone="bad">{nw} task{nw === 1 ? '' : 's'} need more work</Badge>}<span className="ml-auto text-sm font-semibold text-maple">Open ›</span></div>
      {n > 0 && <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-ok" style={{ width: `${Math.round(dn / n * 100)}%` }} /></div>}
      <p className="mt-1 text-xs text-muted">{n ? `${dn} of ${n} tasks complete` : r.status === 'not_ready' ? 'A few steps to complete before your evaluation' : 'Waiting for your evaluator'}{r.evaluatorContact ? ` · Evaluator: ${r.evaluatorContact.name}` : ''}</p>
    </button>; })}
    <Section logo title={prog.name} sub={viewer.role === 'coach' ? 'Your NCCP coaching pathway. Request an evaluation in the Boxing Canada store when you’re ready.' : 'Your officiating pathway.'}>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div><span className="text-muted">Current level: </span><b>{curIdx >= 0 ? lvName(prog.levels[curIdx]) : 'Not yet certified'}</b></div>
        {viewer.role === 'coach' && <div><span className="text-muted">NCCP #: </span><b>{nccpOf(viewer) || 'Not on file'}</b></div>}
        {(t['COACH LEVEL'] || t['OFFICIAL LEVEL']) && <div><span className="text-muted">Trackie record: </span><b>{t['COACH LEVEL'] || t['OFFICIAL LEVEL']}</b></div>}
      </div>
      <Pathway prog={prog} current={current} user={viewer} />
      {prog.kind === 'coach' && next && <div className="mt-3 max-w-2xl"><h4 className="mb-1 font-display text-base font-bold">Your progress toward {lvName(next)}</h4><EvalChart user={viewer} level={next} /></div>}
    </Section>
    {viewer.role === 'coach' && <Section title="My NCCP transcript" sub="From The Locker, the Coaching Association of Canada’s database."><NccpSummaryBlock no={nccpOf(viewer)} full /></Section>}
    {prog.evaluationsEnabled && prog.requestUrl ? <Section title="Request an evaluation" sub="Evaluations are requested and paid in the Boxing Canada store.">
      <div className="flex flex-wrap items-center gap-3"><a href={prog.requestUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md border border-maple bg-maple px-3.5 py-2 text-sm font-semibold text-white hover:brightness-110">Open the Boxing Canada store ↗</a>
        <p className="max-w-prose text-sm text-muted">Choose <b>Regular Evaluation</b> if you’ve completed the boxing course and all NCCP Multi-Sport modules, enter your NCCP # ({nccpOf(viewer) || 'find it in The Locker'}) and the level. Your request appears here within minutes, and an evaluator will email you.</p></div>
    </Section> : !prog.evaluationsEnabled && <Section title="Evaluations" sub="Coming soon."><Banner tone="info">Evaluations for this pathway aren’t open yet.</Banner></Section>}
    <Section title="My evaluations">
      <Table head={['Level', 'Status', 'Tasks', 'Requested', '']} isEmpty={!mine.length} empty="No evaluation requests yet.">{mine.map(r => <EvalRow key={r.id} r={r} onOpen={setOpenId} who="coach" />)}</Table>
    </Section>
  </div>;
}

function Pathway({ prog, current, user }) {
  const { data } = useApp();
  const idx = prog.levels.findIndex(l => l.id === current);
  return <ol className="flex flex-wrap items-stretch gap-1.5">{prog.levels.map((l, i) => { const off = !lvOffered(l); const up = lvUpcoming(l); return <li key={l.id} className={cx('flex min-w-[130px] flex-1 flex-col rounded-md border px-2.5 py-2 text-sm', i === idx ? 'border-maple bg-maplesoft' : i < idx && !off ? 'border-ok bg-oksoft' : off ? 'border-dashed border-line opacity-70' : 'border-line')}>
    <span className="text-[11px] font-semibold text-muted">{lvCode(l) || `Level ${i + 1}`}</span><span className="font-semibold leading-tight">{lvName(l)}</span>
    {lvFormer(l) && <span className="text-[11px] text-muted">formerly {lvFormer(l)}</span>}{up && <span className="text-[11px] text-rope">“{isFr() && up.nameFr ? up.nameFr : up.name}” from {fmtDate(up.from)}</span>}
    <span className={cx('mt-auto pt-1 text-[11px] font-semibold', i === idx ? 'text-maple' : i < idx && !off ? 'text-ok' : 'text-muted')}>{i === idx ? 'Current level' : i < idx && !off ? '✓ Achieved' : off ? `New from ${fmtDate(l.offeredFrom)}` : l.evaluated === false ? 'Online test in The Locker' : 'Evaluation'}</span>
    {user && i > idx && !off && (l.reqs || []).length > 0 && (() => { const pr = levelProgress(data, user, l); return <span className="mt-1"><span className="block h-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full bg-ok" style={{ width: `${Math.round(pr.met / Math.max(1, pr.total) * 100)}%` }} /></span><span className="text-[11px] text-muted">{pr.met}/{pr.total} requirements{pr.complete ? ', ready' : ''}</span></span>; })()}
  </li>; })}</ol>;
}

function EvaluatorView() {
  const { data, viewer, nav } = useApp();
  const [openId, setOpenId] = useState((nav && nav.evalId) || null);
  if (openId) return <EvaluationWorkspace reqId={openId} onBack={() => setOpenId(null)} />;
  const mine = (data.evalRequests || []).filter(r => r.assignedEvaluatorId === viewer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const check = mine.filter(r => r.status === 'assigned');
  const review = mine.filter(r => r.status === 'in_progress' && (r.tasks || []).some(t => taskState(t) === 'submitted'));
  const progress = mine.filter(r => r.status === 'in_progress' && !review.includes(r));
  const waiting = mine.filter(r => r.status === 'not_ready');
  const done = mine.filter(r => ['completed', 'declined', 'cancelled'].includes(r.status));
  const Card = ({ r, cta }) => { const c = getUser(data, r.requesterId) || {}; const lv = levelOf(data, r.programId, r.levelId); const pr = levelProgress(data, c, lv, r); const n = (r.tasks || []).length, dn = (r.tasks || []).filter(t => taskState(t) === 'complete').length, sub = (r.tasks || []).filter(t => taskState(t) === 'submitted');
    return <button type="button" onClick={() => setOpenId(r.id)} className="flex flex-col rounded-lg border-2 border-rope bg-surface p-4 text-left hover:bg-ropesoft">
      <div className="flex flex-wrap items-start justify-between gap-2"><span className="text-xs font-semibold text-muted">{lvCode(lv)} · {lvName(lv)}{r.track === 'challenge' ? ' · Challenge' : ''}</span><Badge tone={EVAL_STATUS[r.status].tone}>{EVAL_STATUS[r.status].label}</Badge></div>
      <span className="mt-1 font-display text-xl font-extrabold leading-tight">{fullName(c)}</span>
      <span className="text-xs text-muted">{c.province} · NCCP {reqNccp(data, r) || '—'} · assigned {r.assignedAt ? fmtDate(r.assignedAt.slice(0, 10)) : '—'}</span>
      {r.status === 'assigned' && <span className="mt-2 text-sm">{pr.blocking.length ? <span className="text-warn">{pr.blocking.length} required item{pr.blocking.length === 1 ? '' : 's'} not on record</span> : <span className="text-ok">✓ All requirements on record</span>}{pr.challenge.length ? ' · boxing course missing' : ''}</span>}
      {n > 0 && <span className="mt-2 block"><span className="block h-1.5 overflow-hidden rounded-full bg-sunk"><span className="block h-full bg-ok" style={{ width: `${Math.round(dn / n * 100)}%` }} /></span><span className="text-xs text-muted">{dn} of {n} complete{sub.length ? ` · to review: ${sub.map(t => t.step).join(', ')}` : ''}</span></span>}
      <span className="mt-3 text-sm font-semibold text-rope">{cta} ›</span>
    </button>; };
  const Group = ({ title, list, cta, empty }) => <Section title={title} actions={<Badge tone={list.length ? 'warn' : 'ok'}>{list.length}</Badge>}>{list.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map(r => <Card key={r.id} r={r} cta={cta} />)}</div> : <p className="text-sm text-muted">{empty}</p>}</Section>;
  return <div className="space-y-4">
    <Banner tone="info">Requests are assigned by Boxing Canada. Check each coach’s NCCP record within 1 business day, then send the “ready” or “outstanding items” email from the evaluation.</Banner>
    <Group title="Check readiness" list={check} cta="Check NCCP record" empty="No new assignments." />
    <Group title="Work to review" list={review} cta="Review submissions" empty="Nothing waiting for your review." />
    <Group title="In progress" list={progress} cta="Open" empty="No evaluations in progress." />
    {waiting.length > 0 && <Group title="Waiting for the coach to finish courses" list={waiting} cta="Check again" empty="" />}
    <Section title="Completed evaluations"><Table head={['Coach', 'Level', 'Status', 'Tasks', 'Requested', '']} isEmpty={!done.length} empty="None yet.">{done.map(r => <EvalRow key={r.id} r={r} onOpen={setOpenId} who="evaluator" />)}</Table></Section>
  </div>;
}

function AssignModal({ req, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const prog = data.programs.find(p => p.id === req.programId);
  const evaluators = data.users.filter(u => u.status === 'approved' && (u.evaluatorPrograms || []).includes(req.programId) && u.id !== req.requesterId);
  const [ev, setEv] = useState(req.assignedEvaluatorId || '');
  const [mode, setMode] = useState('assign');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const coach = getUser(data, req.requesterId);
  const level = levelOf(data, req.programId, req.levelId);
  const lvl = lvName(level);
  const rank = id => prog.levels.findIndex(l => l.id === id);
  const assign = () => {
    if (!ev) { setErr('Choose an evaluator.'); return; }
    const e = getUser(data, ev);
    update(d => {
      const x = d.evalRequests.find(y => y.id === req.id);
      const was = x.assignedEvaluatorId;
      Object.assign(x, { status: x.status === 'paid' ? 'assigned' : x.status, assignedEvaluatorId: ev, assignedBy: viewer.id, assignedAt: nowIso(), evaluatorContact: { name: fullName(e), email: e.email } });
      x.history = [...(x.history || []), { id: uid('h'), at: nowIso(), by: viewer.id, text: was && was !== ev ? `Evaluator changed from ${nameOf(d, was)} to ${fullName(e)}` : `Assigned to ${fullName(e)}` }];
      notifyUsers(d, ev, `New evaluation assignment: ${fullName(coach)}, ${lvl}. Check their NCCP record and send the readiness email.`, 'EVALUATOR', { evalId: x.id });
      notifyUsers(d, req.requesterId, `Your ${lvl} evaluator is ${fullName(e)}.`, 'EVALS', { evalId: x.id });
    });
    notify(`${fullName(e)} has been assigned${WP ? ' and emailed' : ''}.`); onClose();
  };
  const decline = () => {
    if (!reason.trim()) { setErr('Give the coach a reason.'); return; }
    update(d => {
      const x = d.evalRequests.find(y => y.id === req.id);
      x.status = 'declined'; x.declineReason = reason.trim(); if (x.payment) x.payment = { ...x.payment, status: 'Refund due', refundedAt: nowIso() };
      x.history = [...(x.history || []), { id: uid('h'), at: nowIso(), by: viewer.id, text: `Declined, refund due in Square: ${reason.trim()}` }];
      notifyUsers(d, req.requesterId, `Your ${lvl} evaluation request was declined: ${reason.trim()}`, 'EVALS', { evalId: x.id });
    });
    notify('Request declined. Refund the order in Square.', 'warn'); onClose();
  };
  return <Modal size="lg" title={req.assignedEvaluatorId ? 'Change the Evaluator' : 'Assign an Evaluator'} subtitle={`${fullName(coach)}, ${lvl}${req.track === 'challenge' ? ' (Challenge evaluation)' : ''}`} onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn>{mode === 'assign' ? <Btn variant="ok" onClick={assign}>Assign & notify</Btn> : <Btn variant="danger" onClick={decline}>Decline</Btn>}</>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <dl className="grid grid-cols-2 gap-3 rounded-md border border-line bg-sunk p-3 text-sm sm:grid-cols-3">
        {[['Current level', (coach.certs || {})[req.programId] ? levelName(data, req.programId, coach.certs[req.programId]) : 'Not yet certified'], ['NCCP #', reqNccp(data, req) || '—'], ['Trackie coach level', trackieOf(coach)['COACH LEVEL'] || '—'], ['Club', coach.club || '—'], ['Province', coach.province], ['Square order', req.payment ? `${money(req.payment.amount)}, ${req.payment.transactionId}` : '—']].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
      </dl>
      <div className="rounded-md border border-line p-3"><LevelChecklist user={coach} level={level} request={req} title="Readiness preview (the evaluator confirms it)" /></div>
      <div className="inline-flex rounded-md border border-line p-0.5">{[['assign', 'Assign'], ['decline', 'Decline']].map(([k, l]) => <button key={k} type="button" onClick={() => { setMode(k); setErr(''); }} className={cx('rounded px-3 py-1 text-xs font-semibold', mode === k ? 'bg-rope text-white' : 'text-muted hover:bg-sunk')}>{l}</button>)}</div>
      {mode === 'assign' ? <Field label="Evaluator" required hint="In general a coach shouldn’t be evaluated by the person who was their Learning Facilitator.">{evaluators.length ? <div className="space-y-1.5">{evaluators.map(u => { const lv = (u.certs || {})[req.programId]; const load = (data.evalRequests || []).filter(x => x.assignedEvaluatorId === u.id && ['assigned', 'not_ready', 'in_progress'].includes(x.status)).length; const under = lv && rank(lv) < rank(req.levelId); return <label key={u.id} className={cx('flex cursor-pointer flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm', ev === u.id ? 'border-rope bg-ropesoft' : 'border-line')}><input type="radio" name="ev" checked={ev === u.id} onChange={() => setEv(u.id)} /><span className="font-semibold">{fullName(u)}</span><span className="text-xs text-muted">{u.province}, {lv ? levelName(data, req.programId, lv) : u.role === 'nsoadmin' ? 'Boxing Canada staff' : 'level not recorded'}{langOf(u) === 'fr' ? ', French' : ''}</span><Badge tone={load ? 'warn' : 'ok'} className="ml-auto">{load} open</Badge>{under && <Badge tone="bad">Below requested level</Badge>}{u.province === coach.province && <Badge tone="info">Same province</Badge>}{langOf(u) === langOf(coach) && langOf(u) === 'fr' && <Badge tone="info">Same language</Badge>}</label>; })}</div> : <p className="text-sm text-muted">No evaluators are set up for this program. Add some under Evaluators below.</p>}</Field>
        : <Field label="Reason shared with the coach" required hint="Refund the order in Square: the portal doesn’t process refunds."><textarea rows={3} className="field" value={reason} onChange={e => setReason(e.target.value)} /></Field>}
    </div>
  </Modal>;
}

/* ---------- Square orders that need a person ---------- */
function IntakeMatchModal({ item, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const prog = (data.programs || []).find(p => p.id === 'prog-coach');
  const p = item.parsed || {};
  const [q, setQ] = useState(p.lastName || p.nccp || '');
  const [uid2, setUid2] = useState((item.suggest || [])[0] || item.userId || '');
  const [lv, setLv] = useState(p.levelId || '');
  const [track, setTrack] = useState(p.track || 'regular');
  const [nccp, setNccp] = useState(p.nccp || '');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const term = q.trim().toLowerCase();
  const pool = data.users.filter(u => ['approved', 'invited', 'lapsed', 'pending'].includes(u.status) && (!term || (fullName(u) + ' ' + u.email + ' ' + nccpOf(u) + ' ' + u.membershipId).toLowerCase().includes(term))).sort((a, b) => ((item.suggest || []).includes(b.id) - (item.suggest || []).includes(a.id)) || (b.role === 'coach') - (a.role === 'coach')).slice(0, 30);
  const create = async () => {
    if (!uid2 || !lv) { setErr('Choose the member and the level.'); return; }
    setBusy(true); setErr('');
    if (WP) { try { await wpApi('intake/resolve', { intakeId: item.id, userId: uid2, levelId: lv, track, nccp }); if (WP_LISTENERS.resync) WP_LISTENERS.resync(); notify('Evaluation request created. Assign an evaluator next.'); onClose(); } catch (e) { setErr(e.message); } setBusy(false); return; }
    update(d => { const u = d.users.find(x => x.id === uid2); const id = uid('er'); const at = nowIso(); d.evalRequests.push({ id, programId: 'prog-coach', levelId: lv, requesterId: uid2, status: 'paid', track, source: 'square', intakeId: item.id, nccp: nccp || nccpOf(u), notes: '', availability: '', createdAt: at, payment: { provider: 'Square', transactionId: p.orderNo || 'Square order', amount: p.amount || 0, currency: 'CAD', status: 'Paid', paidAt: at }, tasks: [], messages: [], history: [{ id: uid('h'), at, by: viewer.id, text: `Created from Square order ${p.orderNo || ''} and matched to the member by ${fullName(viewer)}` }] }); const x = d.evalIntake.find(y => y.id === item.id); Object.assign(x, { status: 'matched', requestId: id, userId: uid2, matchedBy: 'administrator', resolvedBy: viewer.id, resolvedAt: at }); notifyUsers(d, uid2, `Boxing Canada received your ${levelName(d, 'prog-coach', lv)} evaluation request.`, 'EVALS', { evalId: id }); });
    notify('Evaluation request created. Assign an evaluator next.'); setBusy(false); onClose();
  };
  return <Modal size="xl" title="Match a Square Order" subtitle={`${p.fullName || 'Unknown coach'} · received ${fmtStamp(item.at)}`} onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create evaluation request'}</Btn></>}>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
        {(item.notes || []).map((n, i) => <Banner key={i} tone="warn">{n}</Banner>)}
        <dl className="grid grid-cols-2 gap-2 rounded-md border border-line bg-sunk p-3 text-sm">{[['Name', p.fullName], ['NCCP #', p.nccp], ['Email', p.email], ['Province', p.province], ['Level read', p.levelText], ['Option', p.track === 'challenge' ? 'Challenge' : 'Regular'], ['Order', p.orderNo], ['Total', p.amount ? money(p.amount) : '']].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold break-words">{v || '—'}</dd></div>)}</dl>
        {item.raw && <details className="rounded-md border border-line"><summary className="cursor-pointer px-3 py-1.5 text-xs font-semibold">Original email</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs">{item.raw}</pre></details>}
      </div>
      <div className="space-y-3">
        <Field label="Member" required hint="Search by name, email, NCCP # or membership ID. If the coach has no membership, contact them and dismiss this order once it’s refunded or they’ve registered."><input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Search members" /></Field>
        <div className="max-h-56 overflow-y-auto rounded-md border border-line">{pool.length ? pool.map(u => <label key={u.id} className={cx('flex cursor-pointer items-center gap-2 border-b border-line px-3 py-1.5 text-sm last:border-0', uid2 === u.id && 'bg-ropesoft')}><input type="radio" checked={uid2 === u.id} onChange={() => { setUid2(u.id); if (!nccp && nccpOf(u)) setNccp(nccpOf(u)); }} /><span className="min-w-0 flex-1"><b>{fullName(u)}</b><span className="block text-xs text-muted">{ROLES[u.role].label} · {u.province} · {u.email} · NCCP {nccpOf(u) || '—'}{u.status !== 'approved' ? ` · ${u.status}` : ''}</span></span>{(item.suggest || []).includes(u.id) && <Badge tone="info">Same name</Badge>}</label>) : <p className="px-3 py-3 text-sm text-muted">No members match.</p>}</div>
        <div className="grid gap-2 sm:grid-cols-3"><Field label="Level" required><select className="field" value={lv} onChange={e => setLv(e.target.value)}><option value="">Choose</option>{prog.levels.filter(l => l.evaluated !== false).map(l => <option key={l.id} value={l.id}>{lvName(l)}</option>)}</select></Field><Field label="Evaluation"><select className="field" value={track} onChange={e => setTrack(e.target.value)}><option value="regular">Regular</option><option value="challenge">Challenge</option></select></Field><Field label="NCCP # to use"><input className="field" value={nccp} onChange={e => setNccp(e.target.value.replace(/\D/g, ''))} /></Field></div>
      </div>
    </div>
  </Modal>;
}
function PasteOrderModal({ onClose }) {
  const { data, notify } = useApp();
  const [text, setText] = useState(''); const [subject, setSubject] = useState('');
  const [prev, setPrev] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const call = async preview => { setBusy(true); setErr(''); try { const r = await wpApi('intake/paste', { text, subject, preview }); if (preview) setPrev(r); else { if (WP_LISTENERS.resync) WP_LISTENERS.resync(); notify(r.requestId ? 'Order added and matched: the request is waiting for an evaluator.' : 'Order added. It needs review below.', r.requestId ? 'ok' : 'warn'); onClose(); } } catch (e) { setErr(e.message); } setBusy(false); };
  return <Modal size="lg" title="Add a Square Order Email" subtitle="Paste the order email from coach@boxingcanada.org if it didn’t arrive automatically." onClose={onClose}
    footer={<><Btn onClick={onClose}>Cancel</Btn><Btn disabled={!WP || busy || !text.trim()} onClick={() => call(true)}>Check how it reads</Btn><Btn variant="primary" disabled={!WP || busy || !text.trim()} onClick={() => call(false)}>Add order</Btn></>}>
    <div className="space-y-3">
      {!WP && <Banner tone="info">Reading order emails happens on the WordPress server. In this test version, use “Match to member” on the demo order below.</Banner>}
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <Field label="Subject (optional)"><input className="field" value={subject} onChange={e => setSubject(e.target.value)} /></Field>
      <Field label="Email text" required><textarea rows={12} className="field font-mono text-xs" value={text} onChange={e => { setText(e.target.value); setPrev(null); }} placeholder="Select all in the email, copy, and paste here" /></Field>
      {prev && <div className="rounded-md border border-line bg-sunk p-3 text-sm"><div className="mb-1 text-xs font-semibold text-muted">The portal reads:</div><dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Name', prev.parsed.fullName], ['NCCP #', prev.parsed.nccp], ['Email', prev.parsed.email], ['Level', prev.parsed.levelId ? levelName(data, 'prog-coach', prev.parsed.levelId) : ''], ['Option', prev.parsed.track], ['Order', prev.parsed.orderNo], ['Total', prev.parsed.amount ? money(prev.parsed.amount) : ''], ['Member', prev.member ? `${nameOf(data, prev.member)} (by ${prev.matchedBy})` : 'No match']].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v || '—'}</dd></div>)}</dl></div>}
    </div>
  </Modal>;
}
function IntakeSection() {
  const { data, update, viewer, notify } = useApp();
  const [match, setMatch] = useState(null); const [paste, setPaste] = useState(false); const [showAll, setShowAll] = useState(false);
  const items = (data.evalIntake || []).slice().sort((a, b) => b.at.localeCompare(a.at));
  const open = items.filter(i => ['unmatched', 'review'].includes(i.status));
  const list = showAll ? items : open;
  const dismiss = i => { update(d => { const x = d.evalIntake.find(y => y.id === i.id); x.status = 'dismissed'; x.notes = [...(x.notes || []), `Dismissed by ${fullName(viewer)} on ${fmtDate(REF_DATE)}.`]; }); notify('Order dismissed. Refund it in Square if needed.', 'info'); };
  const SL = { unmatched: ['warn', 'Needs a member'], review: ['warn', 'Check: possible duplicate'], matched: ['ok', 'Request created'], duplicate: ['neutral', 'Duplicate email'], ignored: ['neutral', 'Not from Square'], dismissed: ['neutral', 'Dismissed'] };
  return <Section logo title="Square evaluation orders" sub="Order emails from the Boxing Canada store. Orders matched to a member by NCCP # or email become requests automatically; the rest wait here." actions={<div className="flex flex-wrap items-center gap-2"><Badge tone={open.length ? 'warn' : 'ok'}>{open.length} to review</Badge><Btn size="sm" onClick={() => setShowAll(s => !s)}>{showAll ? 'Show only orders to review' : `Show all ${items.length}`}</Btn><Btn size="sm" variant="primary" onClick={() => setPaste(true)}>Add an order email</Btn></div>}>
    <Table head={['Received', 'Coach (from the email)', 'Level', 'Order', 'Status', '']} isEmpty={!list.length} empty={showAll ? 'No orders received yet.' : 'Nothing to review. New orders that can’t be matched appear here.'}>
      {list.map(i => { const p = i.parsed || {}; const [tone, label] = SL[i.status] || ['neutral', i.status]; return <tr key={i.id} className={['unmatched', 'review'].includes(i.status) ? 'bg-warnsoft' : ''}>
        <Td className="whitespace-nowrap text-xs">{fmtStamp(i.at)}<div className="text-muted">{i.source === 'paste' ? 'Pasted' : 'Email'}</div></Td>
        <Td className="font-semibold">{p.fullName || '—'}<div className="text-xs font-normal text-muted">NCCP {p.nccp || '—'}{p.email ? ` · ${p.email}` : ''}</div></Td>
        <Td>{p.levelId ? levelName(data, 'prog-coach', p.levelId) : <span className="text-warn">Not read</span>}{p.track === 'challenge' && <Badge tone="info" className="ml-1">Challenge</Badge>}</Td>
        <Td className="text-xs">{p.orderNo || '—'}{p.amount ? <div className="text-muted">{money(p.amount)}</div> : null}</Td>
        <Td><Badge tone={tone}>{label}</Badge>{(i.notes || []).slice(-1).map((n, k) => <div key={k} className="mt-1 max-w-xs text-xs text-muted">{n}</div>)}</Td>
        <Td className="text-right"><div className="flex flex-wrap justify-end gap-1">{['unmatched', 'review', 'ignored'].includes(i.status) && <><Btn size="xs" variant="primary" onClick={() => setMatch(i)}>Match to member</Btn><Btn size="xs" variant="ghost" onClick={() => dismiss(i)}>Dismiss</Btn></>}{i.status === 'matched' && i.requestId && <span className="text-xs text-muted">{nameOf(data, i.userId)}</span>}</div></Td>
      </tr>; })}
    </Table>
    {match && <IntakeMatchModal item={match} onClose={() => setMatch(null)} />}
    {paste && <PasteOrderModal onClose={() => setPaste(false)} />}
  </Section>;
}

/* ---------- Pathway editor (NSO Administrators) ---------- */
const REQ_KINDS = [['membership', 'Current membership (Trackie)'], ['nccp', 'Has an NCCP #'], ['event', 'Boxing workshop or evaluation (Locker Events)'], ['module', 'Multi-sport module (Locker Multi-Sport)'], ['cert', 'Certified at a level (portal or Locker)'], ['trackie', 'Trackie field has a value'], ['manual', 'Evaluator confirms']];
const SUBMIT_KINDS = [['link', 'Video link'], ['file', 'File upload'], ['form', 'Online form'], ['text', 'Written answer']];
const FORM_PRESETS = {
  analysis3: { kind: 'table', repeat: 3, repeatLabel: 'Performance analysis', repeatLabelFr: 'Analyse de la performance', fields: [{ key: 'video', label: 'Video #', labelFr: 'Vidéo no' }, { key: 'skill', label: 'Name of skill', labelFr: 'Nom de la compétence' }], columns: [{ key: 'detect', label: 'Detection: aspects of the performance that need improvement', labelFr: 'Détection : aspects de la performance à améliorer' }, { key: 'correct', label: 'Corrective measures: what should the participant do, and how?', labelFr: 'Mesures correctives : que doit faire le participant, et comment?' }], minRows: 1 },
  analysis2: { kind: 'table', repeat: 2, repeatLabel: 'Skill', repeatLabelFr: 'Technique', fields: [{ key: 'skill', label: 'Skill or tactic', labelFr: 'Technique ou tactique' }], columns: [{ key: 'detect', label: 'Detection: aspects that need improvement', labelFr: 'Détection : aspects à améliorer' }, { key: 'correct', label: 'Corrective measures', labelFr: 'Mesures correctives' }], minRows: 1 },
  plan: { kind: 'table', repeat: 1, repeatLabel: 'Plan', repeatLabelFr: 'Plan', optional: true, fields: [], columns: [{ key: 'activity', label: 'Activity', labelFr: 'Activité' }, { key: 'duration', label: 'Duration', labelFr: 'Durée' }, { key: 'goal', label: 'Goal / why?', labelFr: 'But / pourquoi?' }], minRows: 3 }
};
function TextIn({ v, on, ph, cls }) { return <input className={cx('field py-1 text-sm', cls)} value={v == null ? '' : v} placeholder={ph} aria-label={ph} onChange={e => on(e.target.value)} />; }
function LevelEditorModal({ prog, levelId, onClose }) {
  const { data, update } = useApp();
  const [tab, setTab] = useState('names');
  const li = prog.levels.findIndex(l => l.id === levelId); const l = prog.levels[li];
  if (!l) return null;
  const mut = fn => update(d => { const p = d.programs.find(x => x.id === prog.id); fn(p.levels[li], p); });
  const isCoach = prog.kind === 'coach';
  const inUse = (data.evalRequests || []).filter(r => r.levelId === l.id && EVAL_OPEN.includes(r.status)).length;
  return <Modal size="full" title={`Edit level: ${lvName(l)}`} subtitle={`${prog.name}. Changes save as you type and apply to new evaluations; ${inUse} evaluation${inUse === 1 ? '' : 's'} under way keep the tasks they started with.`} onClose={onClose} footer={<Btn variant="primary" onClick={onClose}>Done</Btn>}>
    <div className="mb-3 inline-flex flex-wrap rounded-md border border-line p-0.5">{[['names', 'Names & dates'], ['reqs', `Readiness requirements (${(l.reqs || []).length})`], ...(isCoach ? [['tasks', `Evaluation tasks (${(l.tasks || []).length})`]] : [])].map(([k, lab]) => <button key={k} type="button" onClick={() => setTab(k)} className={cx('rounded px-3 py-1 text-sm font-semibold', tab === k ? 'bg-rope text-white' : 'text-muted hover:bg-sunk')}>{lab}</button>)}</div>
    {tab === 'names' && <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4"><Field label="Code"><TextIn v={l.code} on={v => mut(x => { x.code = v; })} ph="IB" /></Field><Field label="Name (English)"><TextIn v={l.name} on={v => mut(x => { x.name = v; })} /></Field><Field label="Name (French)"><TextIn v={l.nameFr} on={v => mut(x => { x.nameFr = v; })} /></Field><Field label="Evaluation fee (CAD, shown to coaches)"><TextIn v={l.fee} on={v => mut(x => { x.fee = Number(String(v).replace(/[^0-9.]/g, '')) || 0; })} /></Field></div>
      <div className="grid gap-3 md:grid-cols-4"><Field label="Offered from" hint="Leave empty if offered now. Shown as “New from …” until then."><input type="date" className="field py-1" value={l.offeredFrom || ''} onChange={e => mut(x => { x.offeredFrom = e.target.value; })} /></Field><Field label="Certification"><select className="field py-1" value={l.evaluated === false ? 'test' : 'eval'} onChange={e => mut(x => { x.evaluated = e.target.value !== 'test'; })}><option value="eval">Evaluated by a Boxing Canada evaluator</option><option value="test">Online test in The Locker (no evaluator)</option></select></Field><Field label="Locker context" hint="For example Inst-Beg, Comp-Int, Comp-Dev."><TextIn v={l.lockerContext} on={v => mut(x => { x.lockerContext = v; })} /></Field><Field label="Pathway page"><TextIn v={l.pathwayUrl} on={v => mut(x => { x.pathwayUrl = v; })} ph="https://boxingcanada.org/coaching/#intro" /></Field></div>
      <div className="grid gap-3 md:grid-cols-2"><Field label="Description (English)"><textarea rows={2} className="field" value={l.description || ''} onChange={e => mut(x => { x.description = e.target.value; })} /></Field><Field label="Description (French)"><textarea rows={2} className="field" value={l.descriptionFr || ''} onChange={e => mut(x => { x.descriptionFr = e.target.value; })} /></Field></div>
      <div className="rounded-md border border-rope bg-ropesoft p-3">
        <h5 className="font-display text-base font-bold">Scheduled name changes</h5>
        <p className="mb-2 text-xs text-muted">From the date, the portal shows the new name and code everywhere, with “formerly …” beside it. Requests, certifications and Square orders under either name stay linked to this level.</p>
        <div className="space-y-1.5">{(l.renames || []).map((r, ri) => <div key={ri} className="flex flex-wrap items-center gap-1.5"><input type="date" className="field w-40 py-1" value={r.from || ''} onChange={e => mut(x => { x.renames[ri].from = e.target.value; })} aria-label="From" /><TextIn cls="w-20" v={r.code} on={v => mut(x => { x.renames[ri].code = v; })} ph="Code" /><TextIn cls="min-w-[180px] flex-1" v={r.name} on={v => mut(x => { x.renames[ri].name = v; })} ph="New name (English)" /><TextIn cls="min-w-[180px] flex-1" v={r.nameFr} on={v => mut(x => { x.renames[ri].nameFr = v; })} ph="Nouveau nom (français)" /><Btn size="xs" variant="ghost" onClick={() => mut(x => { x.renames.splice(ri, 1); })}>Remove</Btn></div>)}</div>
        <Btn size="sm" className="mt-2" onClick={() => mut(x => { x.renames = [...(x.renames || []), { from: '2027-01-01', code: '', name: '', nameFr: '' }]; })}>Add a name change</Btn>
      </div>
      <Field label="Other names in Square orders and The Locker (one per line)" hint="Used to read the level from Square order emails. Old and new names both work."><textarea rows={4} className="field font-mono text-xs" value={(l.aliases || []).join('\n')} onChange={e => mut(x => { x.aliases = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); })} /></Field>
    </div>}
    {tab === 'reqs' && <div className="space-y-2">
      <p className="text-xs text-muted">Grouped as in the pathway chart: before “In Training”, before “Trained”, and before the evaluation. A requirement from The Locker is met when any record contains one of its match phrases (separate alternatives with |). Optional items show in the chart without blocking.</p>
      {(l.reqs || []).map((r, ri) => { const set = (k, v) => mut(x => { x.reqs[ri][k] = v; }); return <div key={r.id} className="rounded-md border border-line p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <select className="field w-auto py-1 text-xs" value={r.stage || 'start'} onChange={e => set('stage', e.target.value)} aria-label="Stage"><option value="start">Before “In Training”</option><option value="training">Before “Trained”</option><option value="evaluation">Before the evaluation</option></select>
          <select className="field w-auto py-1 text-xs" value={r.kind} onChange={e => set('kind', e.target.value)} aria-label="Source">{REQ_KINDS.map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}</select>
          <TextIn cls="min-w-[180px] flex-1" v={r.label} on={v => set('label', v)} ph="Label (English)" /><TextIn cls="min-w-[180px] flex-1" v={r.labelFr} on={v => set('labelFr', v)} ph="Libellé (français)" />
          <Btn size="xs" variant="ghost" disabled={ri === 0} onClick={() => mut(x => { const t = x.reqs[ri]; x.reqs[ri] = x.reqs[ri - 1]; x.reqs[ri - 1] = t; })} aria-label="Move up">↑</Btn><Btn size="xs" variant="ghost" onClick={() => mut(x => { x.reqs.splice(ri, 1); })}>Remove</Btn>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {(r.kind === 'event' || r.kind === 'module') && <TextIn cls="min-w-[260px] flex-[2] font-mono text-xs" v={r.match} on={v => set('match', v)} ph="Match phrase|Alternative" />}
          {r.kind === 'event' && <><TextIn cls="w-28" v={r.context} on={v => set('context', v)} ph="Context" /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!r.anyInContext} onChange={e => set('anyInContext', e.target.checked)} />Any workshop in this context</label><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!r.noEval} onChange={e => set('noEval', e.target.checked)} />Ignore evaluations</label></>}
          {r.kind === 'trackie' && <TextIn cls="w-72" v={r.field} on={v => set('field', v)} ph="Trackie column, for example DATE OF CRIMINAL RECORD CHECK" />}
          {r.kind === 'cert' && <><select className="field w-auto py-1 text-xs" value={r.levelId || ''} onChange={e => set('levelId', e.target.value)}>{prog.levels.map(x => <option key={x.id} value={x.id}>{lvName(x)}</option>)}</select><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!r.allowManual} onChange={e => set('allowManual', e.target.checked)} />Or the evaluator confirms (for example 2 years’ experience)</label></>}
          <TextIn cls="min-w-[200px] flex-1" v={r.link} on={v => set('link', v)} ph="Link for coaches (English)" /><TextIn cls="min-w-[200px] flex-1" v={r.linkFr} on={v => set('linkFr', v)} ph="Lien (français)" />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!r.optional} onChange={e => set('optional', e.target.checked)} />Optional</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.onMissing === 'challenge'} onChange={e => set('onMissing', e.target.checked ? 'challenge' : '')} />If missing: Challenge evaluation</label>
          {(r.kind === 'event' || r.kind === 'module') && <span className="text-xs text-muted">{Object.values((data.nccp || {}).records || {}).filter(rec => reqHit(rec, r)).length} coaches match</span>}
        </div>
      </div>; })}
      {!(l.reqs || []).length && <p className="text-sm text-muted">No requirements yet.</p>}
      <Btn size="sm" onClick={() => mut(x => { x.reqs = [...(x.reqs || []), { id: uid('rq'), stage: 'training', kind: 'module', label: 'New requirement', labelFr: '', match: '' }]; })}>Add a requirement</Btn>
      {(l.legacyReqs || []).length > 0 && <details className="mt-2 text-xs text-muted"><summary>Requirements before the 2026 pathway update ({l.legacyReqs.length}), kept for reference</summary><ul className="list-disc pl-5">{l.legacyReqs.map(r => <li key={r.id}>{r.label}: {r.match}</li>)}</ul></details>}
    </div>}
    {tab === 'tasks' && <div className="space-y-3">
      <p className="text-xs text-muted">The tasks coaches complete, in order. Each evaluation copies them when it starts.</p>
      {(l.tasks || []).map((t, ti) => { const set = (k, v) => mut(x => { x.tasks[ti][k] = v; }); return <div key={t.id} className="rounded-md border border-line p-3">
        <div className="flex flex-wrap items-center gap-1.5"><TextIn cls="w-16 font-bold" v={t.step} on={v => set('step', v)} ph="9a" /><TextIn cls="min-w-[220px] flex-1" v={t.title} on={v => set('title', v)} ph="Title (English)" /><TextIn cls="min-w-[220px] flex-1" v={t.titleFr} on={v => set('titleFr', v)} ph="Titre (français)" /><Btn size="xs" variant="ghost" disabled={ti === 0} onClick={() => mut(x => { const tt = x.tasks[ti]; x.tasks[ti] = x.tasks[ti - 1]; x.tasks[ti - 1] = tt; })}>↑</Btn><Btn size="xs" variant="ghost" onClick={() => mut(x => { x.tasks.splice(ti, 1); })}>Remove</Btn></div>
        <div className="mt-2 grid gap-2 md:grid-cols-2"><Field label="What to do (English)"><textarea rows={2} className="field text-sm" value={t.what || ''} onChange={e => set('what', e.target.value)} /></Field><Field label="Que faire (français)"><textarea rows={2} className="field text-sm" value={t.whatFr || ''} onChange={e => set('whatFr', e.target.value)} /></Field><Field label="How it’s evaluated (English)"><textarea rows={2} className="field text-sm" value={t.how || ''} onChange={e => set('how', e.target.value)} /></Field><Field label="Évaluation (français)"><textarea rows={2} className="field text-sm" value={t.howFr || ''} onChange={e => set('howFr', e.target.value)} /></Field></div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs"><span className="font-semibold text-muted">Coaches can submit:</span>{SUBMIT_KINDS.map(([k, lab]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={(t.submit || []).includes(k)} onChange={e => set('submit', e.target.checked ? [...new Set([...(t.submit || []), k])] : (t.submit || []).filter(s => s !== k))} />{lab}</label>)}<label className="flex items-center gap-1"><input type="checkbox" checked={!!t.requireVideo} onChange={e => set('requireVideo', e.target.checked)} />Video required</label><label className="flex items-center gap-1"><input type="checkbox" checked={!!t.inPerson} onChange={e => set('inPerson', e.target.checked)} />In person</label><label className="flex items-center gap-1"><input type="checkbox" checked={!!t.assignable} onChange={e => set('assignable', e.target.checked)} />Evaluator assigns something</label>{t.assignable && <TextIn cls="w-72" v={t.assignHint} on={v => set('assignHint', v)} ph="For example: video numbers (1-22)" />}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-muted">Online form:</span><select className="field w-auto py-1 text-xs" value={!t.form ? '' : JSON.stringify(t.form) === JSON.stringify(FORM_PRESETS.analysis3) ? 'analysis3' : JSON.stringify(t.form) === JSON.stringify(FORM_PRESETS.analysis2) ? 'analysis2' : JSON.stringify(t.form) === JSON.stringify(FORM_PRESETS.plan) ? 'plan' : 'custom'} onChange={e => set('form', e.target.value && FORM_PRESETS[e.target.value] ? structuredClone(FORM_PRESETS[e.target.value]) : e.target.value === 'custom' ? t.form : null)}><option value="">None</option><option value="analysis3">Performance analysis × 3 (Appendix G)</option><option value="analysis2">Skill analysis × 2</option><option value="plan">Plan: activity, duration, goal</option>{t.form && <option value="custom">Custom (as set in the pathway file)</option>}</select>{t.form && <span className="text-muted">{t.form.repeat} × {tr(t.form, 'repeatLabel')}: {t.form.columns.map(c => c.label.split(':')[0]).join(', ')}</span>}</div>
        <Field className="mt-2" label="Resources (one per line: Label | URL)"><textarea rows={2} className="field font-mono text-xs" value={(t.resources || []).map(r => `${r.label} | ${r.url}`).join('\n')} onChange={e => set('resources', e.target.value.split('\n').map(s => { const [a, ...b] = s.split('|'); return { label: a.trim(), url: b.join('|').trim() }; }).filter(r => r.label && isUrl(r.url)))} /></Field>
      </div>; })}
      <Btn size="sm" onClick={() => mut(x => { x.tasks = [...(x.tasks || []), { id: uid('tk'), step: '', title: 'New task', titleFr: '', what: '', whatFr: '', how: '', howFr: '', submit: ['link', 'file', 'text'], resources: [] }]; })}>Add a task</Btn>
    </div>}
  </Modal>;
}
function EmailTemplatesModal({ prog, onClose }) {
  const { update } = useApp();
  const [k, setK] = useState('ready');
  const T = { ready: 'Ready for evaluation', outstanding: 'Outstanding items', outcome: 'Outcome and feedback', assigned: 'Assignment (to the evaluator)' };
  const mut = fn => update(d => { const p = d.programs.find(x => x.id === prog.id); p.emailTemplates = p.emailTemplates || {}; fn(p.emailTemplates); });
  const cur = (prog.emailTemplates || {})[k] || {};
  return <Modal size="xl" title="Evaluation Email Templates" subtitle="Evaluators can edit each email before sending." onClose={onClose} footer={<Btn variant="primary" onClick={onClose}>Done</Btn>}>
    <div className="mb-3 inline-flex flex-wrap rounded-md border border-line p-0.5">{Object.entries(T).map(([key, lab]) => <button key={key} type="button" onClick={() => setK(key)} className={cx('rounded px-3 py-1 text-sm font-semibold', k === key ? 'bg-rope text-white' : 'text-muted hover:bg-sunk')}>{lab}</button>)}</div>
    <p className="mb-2 text-xs text-muted">Fill-ins: {'{coachFirst} {coachName} {levelName} {evaluatorName} {evaluatorEmail} {portalUrl} {pathwayUrl} {trackNote}'}{k === 'ready' ? ' {chart} {tasks}' : k === 'outstanding' ? ' {chart} {outstanding}' : k === 'outcome' ? ' {result} {resultShort} {taskResults} {feedback} {nextSteps}' : ' {nccp} {province} {orderNo}'}</p>
    <div className="grid gap-3 lg:grid-cols-2" data-i18n-skip="">{['en', 'fr'].map(lg => <div key={lg} className="space-y-2"><div className="text-xs font-bold text-muted">{lg === 'en' ? 'English' : 'Français'}</div><input className="field font-semibold" value={(cur[lg] || {}).subject || ''} onChange={e => mut(t => { t[k] = t[k] || {}; t[k][lg] = { ...(t[k][lg] || {}), subject: e.target.value }; })} /><textarea rows={18} className="field font-mono text-xs" value={(cur[lg] || {}).body || ''} onChange={e => mut(t => { t[k] = t[k] || {}; t[k][lg] = { ...(t[k][lg] || {}), body: e.target.value }; })} /></div>)}</div>
  </Modal>;
}
function ProgramEditor({ prog }) {
  const { data, update, notify } = useApp();
  const [edit, setEdit] = useState(null); const [tpl, setTpl] = useState(false);
  const used = id => (data.evalRequests || []).some(r => r.levelId === id) || data.users.some(u => Object.values(u.certs || {}).includes(id));
  const mut = fn => update(d => fn(d.programs.find(p => p.id === prog.id)));
  const move = (i, dir) => mut(p => { const j = i + dir; if (j < 0 || j >= p.levels.length) return; const t = p.levels[i]; p.levels[i] = p.levels[j]; p.levels[j] = t; });
  return <div className="rounded-lg border border-line">
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2">
      <input className="field max-w-sm flex-1 py-1.5 font-semibold" value={prog.name} onChange={e => mut(p => { p.name = e.target.value; })} aria-label="Program name" />
      <Badge>{prog.kind === 'coach' ? '📋 Coaches' : '⚖️ Officials'}</Badge>
      {prog.kind === 'coach' && <><Field className="min-w-[260px] flex-1" label="Square store page for evaluation requests"><input className="field py-1 text-xs" value={prog.requestUrl || ''} onChange={e => mut(p => { p.requestUrl = e.target.value; })} /></Field><Btn size="sm" onClick={() => setTpl(true)}>Email templates</Btn></>}
      <label className="ml-auto flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={prog.evaluationsEnabled} onChange={e => { mut(p => { p.evaluationsEnabled = e.target.checked; }); notify(e.target.checked ? `Evaluation requests are now open for ${prog.name}.` : `Evaluation requests closed for ${prog.name}.`); }} />Evaluation requests open</label>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-sunk text-left text-xs text-muted"><tr><th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Level</th><th className="px-2 py-1.5">Fee</th><th className="px-2 py-1.5">Requirements & tasks</th><th /></tr></thead>
      <tbody className="divide-y divide-line">{prog.levels.map((l, i) => { const up = lvUpcoming(l); return <tr key={l.id}>
        <td className="px-2 py-1.5 tabular-nums text-muted">{i + 1}</td>
        <td className="px-2 py-1.5"><div className="font-semibold">{lvCode(l) && <span className="mr-1 text-xs font-bold text-muted">{lvCode(l)}</span>}{lvName(l)}{lvFormer(l) && <span className="ml-1 text-xs font-normal text-muted">(formerly {lvFormer(l)})</span>}</div><div className="text-xs text-muted">{l.nameFr && `${isFr() ? l.name : l.nameFr} · `}{up ? `Becomes “${up.name}” on ${fmtDate(up.from)}` : ''}{!lvOffered(l) ? ` New from ${fmtDate(l.offeredFrom)}` : ''}{l.evaluated === false ? ' · Online test' : ''}</div></td>
        <td className="px-2 py-1.5 tabular-nums">{money(l.fee)}</td>
        <td className="px-2 py-1.5 text-xs">{(l.reqs || []).length} requirement{(l.reqs || []).length === 1 ? '' : 's'}{prog.kind === 'coach' ? `, ${(l.tasks || []).length} task${(l.tasks || []).length === 1 ? '' : 's'}` : ''}</td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right"><Btn size="xs" variant="rope" onClick={() => setEdit(l.id)}>Edit</Btn><Btn size="xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</Btn><Btn size="xs" variant="ghost" disabled={i === prog.levels.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</Btn><Btn size="xs" variant="ghost" disabled={used(l.id)} title={used(l.id) ? 'In use by members or requests' : 'Remove level'} onClick={() => mut(p => { p.levels = p.levels.filter(x => x.id !== l.id); })}>Remove</Btn></td>
      </tr>; })}</tbody></table></div>
    <div className="px-3 py-2"><Btn size="sm" onClick={() => { const id = uid('lv'); mut(p => { p.levels.push({ id, code: '', name: 'New level', nameFr: '', fee: 0, description: '', renames: [], aliases: [], reqs: [], tasks: [], evaluated: true, offeredFrom: '' }); }); setEdit(id); }}>Add a level (new course)</Btn></div>
    {edit && <LevelEditorModal prog={(data.programs || []).find(p => p.id === prog.id)} levelId={edit} onClose={() => setEdit(null)} />}
    {tpl && <EmailTemplatesModal prog={(data.programs || []).find(p => p.id === prog.id)} onClose={() => setTpl(false)} />}
  </div>;
}

function AddEvaluatorModal({ prog, onAdd, onClose }) {
  const { data } = useApp();
  const [q, setQ] = useState(''); const [prov, setProv] = useState('');
  const term = q.trim().toLowerCase();
  const pool = data.users.filter(u => u.status === 'approved' && (u.role === prog.kind || u.role === 'nsoadmin') && !(u.evaluatorPrograms || []).includes(prog.id) && (!prov || u.province === prov) && (!term || (fullName(u) + ' ' + (u.club || '') + ' ' + nccpOf(u)).toLowerCase().includes(term)));
  const rank = u => { const lv = (u.certs || {})[prog.id]; return lv ? prog.levels.findIndex(l => l.id === lv) : -1; };
  const list = pool.sort((a, b) => rank(b) - rank(a) || a.lastName.localeCompare(b.lastName));
  return <Modal size="lg" title="Add an Evaluator" subtitle={`${prog.name}: choose a ${prog.kind === 'coach' ? 'coach' : 'official'} or a Boxing Canada administrator. Highest certified levels are listed first.`} onClose={onClose}>
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2"><input className="field max-w-xs" autoFocus placeholder={`Search name, club${prog.kind === 'coach' ? ' or NCCP #' : ''}`} value={q} onChange={e => setQ(e.target.value)} aria-label="Search" /><select className="field w-auto" value={prov} onChange={e => setProv(e.target.value)} aria-label="Province"><option value="">All provinces</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></div>
      <div className="max-h-[55vh] overflow-y-auto rounded-md border border-line">
        {list.length ? <ul className="divide-y divide-line">{list.slice(0, 100).map(u => { const lv = (u.certs || {})[prog.id]; return <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1"><span className="font-semibold">{fullName(u)}</span><span className="block text-xs text-muted">{u.role === 'nsoadmin' ? 'NSO Administrator · ' : ''}{u.province}{u.club ? `, ${u.club}` : ''}{prog.kind === 'coach' ? `, NCCP ${nccpOf(u) || '—'}` : ''}</span></span>
          <Badge tone={lv ? 'ok' : 'neutral'}>{lv ? levelName(data, prog.id, lv) : 'Level not recorded'}</Badge>
          <Btn size="sm" variant="primary" onClick={() => { onAdd(u); onClose(); }}>Add</Btn>
        </li>; })}</ul> : <p className="px-3 py-6 text-center text-sm text-muted">No members match{term || prov ? ' these filters' : ''}.</p>}
        {list.length > 100 && <p className="px-3 py-2 text-xs text-muted">Showing the first 100 of {list.length}. Narrow the search to find others.</p>}
      </div>
    </div>
  </Modal>;
}
function ProgramReadOnly({ prog }) {
  return <div className="rounded-lg border border-line">
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2"><span className="font-semibold">{prog.name}</span><Badge tone={prog.evaluationsEnabled ? 'ok' : 'neutral'} className="ml-auto">{prog.evaluationsEnabled ? 'Evaluation requests open' : 'Evaluation requests not open yet'}</Badge></div>
    <Table head={['#', 'Level', 'Evaluation fee', 'Requirements', 'Evaluation tasks']}>{prog.levels.map((l, i) => <tr key={l.id}><Td className="tabular-nums text-muted">{lvCode(l) || i + 1}</Td><Td className="font-semibold">{lvName(l)}{lvFormer(l) && <div className="text-xs font-normal text-muted">formerly {lvFormer(l)}</div>}{lvUpcoming(l) && <div className="text-xs font-normal text-rope">“{lvUpcoming(l).name}” from {fmtDate(lvUpcoming(l).from)}</div>}{tr(l, 'description') && <div className="max-w-xs text-xs font-normal text-muted">{tr(l, 'description')}</div>}</Td><Td className="tabular-nums">{money(l.fee)}</Td><Td className="text-xs">{(l.reqs || []).filter(r => !r.optional).length ? <ul className="list-disc pl-4">{l.reqs.filter(r => !r.optional).map(r => <li key={r.id}>{tr(r, 'label')}</li>)}</ul> : <span className="text-muted">None set</span>}</Td><Td className="text-xs">{(l.tasks || []).length ? <ul className="list-disc pl-4">{l.tasks.map(t => <li key={t.id}>{t.step} {tr(t, 'title')}</li>)}</ul> : <span className="text-muted">{l.evaluated === false ? 'Online test' : '—'}</span>}</Td></tr>)}</Table>
  </div>;
}
function EvalStats({ reqs }) {
  const yearAgo = new Date(REF_NOW - 365 * DAY).toISOString();
  const done = reqs.filter(r => r.status === 'completed' && r.outcome && r.outcome.at && r.createdAt >= yearAgo);
  const days = done.map(r => Math.max(0, Math.round((Date.parse(r.outcome.at) - Date.parse(r.createdAt)) / DAY))).sort((a, b) => a - b);
  const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
  const med = days.length ? days[Math.floor(days.length / 2)] : null;
  const T = ({ v, l, s, tone }) => <div className="rounded-md border border-line bg-surface p-3"><div className={cx('font-display text-2xl font-extrabold tabular-nums', tone === 'warn' && 'text-warn')}>{v}</div><div className="text-sm font-semibold leading-tight">{l}</div>{s && <div className="text-xs text-muted">{s}</div>}</div>;
  const n = s => reqs.filter(r => r.status === s).length;
  return <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
    <T v={n('paid')} l="Waiting for an evaluator" tone={n('paid') ? 'warn' : ''} /><T v={n('assigned')} l="Readiness check" /><T v={n('not_ready')} l="Waiting for courses" /><T v={n('in_progress')} l="In progress" />
    <T v={done.filter(r => r.outcome.result === 'certified').length} l="Certified (12 months)" /><T v={avg === null ? '—' : `${avg} d`} l="Request to outcome" s={med === null ? 'No completed evaluations' : `Median ${med} days · goal 14`} tone={avg !== null && avg > 14 ? 'warn' : ''} />
  </div>;
}
function EvalAdminView({ kind = 'coach' }) {
  const { data, update, notify, viewer, nav } = useApp();
  const [review, setReview] = useState(null);
  const [stat, setStat] = useState('');
  const [lvf, setLvf] = useState('');
  const [profile, setProfile] = useState(null);
  const [addFor, setAddFor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [openId, setOpenId] = useState((nav && nav.evalId) || null);
  const progs = (data.programs || []).filter(p => p.kind === kind);
  const who = kind === 'coach' ? 'coach' : 'official';
  const ro = viewer.role !== 'nsoadmin';
  const prov = ro ? viewer.province : null;
  const ptsoName = prov ? PROVINCE_INFO[prov].ptso : '';
  const toggleEval = (u, pid, on) => { update(d => { const x = d.users.find(y => y.id === u.id); x.evaluatorPrograms = on ? [...new Set([...(x.evaluatorPrograms || []), pid])] : (x.evaluatorPrograms || []).filter(p => p !== pid); if (on) notifyUsers(d, u.id, 'You can now evaluate coaches. See the Evaluation Assignments tab.', 'EVALUATOR'); }); notify(on ? `${fullName(u)} is now an evaluator.` : `${fullName(u)} is no longer an evaluator.`); };
  if (openId) return <EvaluationWorkspace reqId={openId} onBack={() => setOpenId(null)} />;
  const reqs = (data.evalRequests || []).filter(r => progs.some(p => p.id === r.programId) && (!prov || (getUser(data, r.requesterId) || {}).province === prov)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const waiting = reqs.filter(r => r.status === 'paid');
  const list = reqs.filter(r => (!stat || r.status === stat) && (!lvf || r.levelId === lvf));
  const locker = reqs.filter(r => r.status === 'completed' && r.outcome && r.outcome.result === 'certified' && !r.lockerEntry);
  return <div className="space-y-4">
    {kind === 'coach' && <EvalStats reqs={reqs} />}
    {kind === 'coach' && !ro && <IntakeSection />}
    <Section logo={ro || kind !== 'coach'} title={ro ? `${ptsoName} ${kind === 'coach' ? 'coach' : 'official'} evaluation requests` : `${kind === 'coach' ? 'Coach' : 'Official'} evaluation requests waiting for an evaluator`} sub={ro ? `Requests from ${PROVINCE_INFO[prov].name} members. Boxing Canada assigns evaluators. View only.` : progs.some(p => p.evaluationsEnabled) ? 'Paid in the Square store. Assign an evaluator within 1 business day: they check the coach’s NCCP record and email the coach.' : `Evaluation requests for ${who}s aren’t open yet. Turn them on under the program below when ready.`} actions={<Badge tone={waiting.length ? 'warn' : 'ok'}>{waiting.length} waiting</Badge>}>
      <Table head={['Member', 'Level', 'Square order', 'Requested', '']} isEmpty={!waiting.length} empty="Nothing waiting. New paid requests appear here.">
        {waiting.map(r => { const c = getUser(data, r.requesterId); return <tr key={r.id} className="bg-warnsoft"><Td className="font-semibold">{fullName(c)}<div className="text-xs font-normal text-muted">NCCP {reqNccp(data, r) || '—'}, {c.province}</div></Td><Td>{levelName(data, r.programId, r.levelId)}{r.track === 'challenge' && <Badge tone="info" className="ml-1">Challenge</Badge>}</Td><Td className="text-xs">{r.payment ? money(r.payment.amount) : '—'}<div className="text-muted">{r.payment && r.payment.transactionId}</div></Td><Td className="whitespace-nowrap">{fmtStamp(r.createdAt)}</Td><Td className="text-right">{ro ? <Badge tone="warn">Awaiting Boxing Canada</Badge> : <Btn size="sm" variant="primary" onClick={() => setReview(r)}>Assign evaluator</Btn>}</Td></tr>; })}
      </Table>
    </Section>
    {!ro && locker.length > 0 && <Section title="Certified: enter in The Locker" sub="Evaluations certified in the portal that aren’t marked as entered in The Locker yet. Create the evaluation event in The Locker, then mark it here." actions={<Badge tone="warn">{locker.length}</Badge>}>
      <Table head={['Coach', 'NCCP #', 'Level', 'Certified', 'Evaluator', '']}>{locker.map(r => { const c = getUser(data, r.requesterId); return <tr key={r.id}><Td className="font-semibold">{fullName(c)}</Td><Td>{reqNccp(data, r)}</Td><Td>{levelName(data, r.programId, r.levelId)}</Td><Td>{fmtDate(r.outcome.date)}</Td><Td>{nameOf(data, r.outcome.by)}</Td><Td className="text-right"><Btn size="xs" variant="primary" onClick={() => { update(d => { const x = d.evalRequests.find(y => y.id === r.id); x.lockerEntry = { by: viewer.id, at: nowIso() }; x.history = [...(x.history || []), { id: uid('h'), at: nowIso(), by: viewer.id, text: 'Evaluation entered in The Locker' }]; }); notify(`${fullName(c)}: marked as entered in The Locker.`); }}>Entered in The Locker</Btn></Td></tr>; })}</Table>
    </Section>}
    <Section title={`All ${who} evaluations`} actions={<div className="flex flex-wrap gap-2">{kind === 'coach' && <select className="field w-auto" value={lvf} onChange={e => setLvf(e.target.value)} aria-label="Level"><option value="">All levels</option>{(progs[0] || { levels: [] }).levels.map(l => <option key={l.id} value={l.id}>{lvName(l)}</option>)}</select>}<select className="field w-auto" value={stat} onChange={e => setStat(e.target.value)} aria-label="Status"><option value="">All statuses</option>{Object.entries(EVAL_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></div>}>
      <Table head={['Member', 'Level', 'Status', 'Tasks', 'Evaluator', 'Requested', '']} isEmpty={!list.length} empty="No requests.">{list.map(r => <EvalRow key={r.id} r={r} onOpen={setOpenId} who="admin" />)}</Table>
    </Section>
    <Section title="Evaluators" sub={ro ? 'Evaluators are appointed and assigned by Boxing Canada. Those from your province are listed first.' : 'Members who can be assigned evaluations. Evaluators get an Evaluation Assignments tab. Boxing Canada staff can be evaluators too.'}>
      <div className="grid gap-4">{progs.map(p => { const evals = data.users.filter(u => (u.evaluatorPrograms || []).includes(p.id)).sort((a, b) => (prov ? (b.province === prov) - (a.province === prov) : 0) || a.lastName.localeCompare(b.lastName)); return <div key={p.id}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-muted">{evals.length} evaluator{evals.length === 1 ? '' : 's'}</span>{!ro && <Btn size="sm" variant="primary" onClick={() => setAddFor(p)}>Add evaluator</Btn>}</div>
        <Table head={['Evaluator', 'Level', 'Open', 'Completed', 'Avg. days to complete', '']} isEmpty={!evals.length} empty={`No evaluators yet.${p.evaluationsEnabled ? '' : ' Evaluations for this pathway aren’t open yet.'}`}>{evals.map(u => { const lv = (u.certs || {})[p.id]; const mineR = (data.evalRequests || []).filter(r => r.assignedEvaluatorId === u.id && r.programId === p.id); const open = mineR.filter(r => ['assigned', 'not_ready', 'in_progress'].includes(r.status)).length; const doneR = mineR.filter(r => r.status === 'completed' && r.assignedAt && r.outcome && (r.outcome.at || r.outcome.date)); const avgDays = doneR.length ? Math.max(0, Math.round(doneR.reduce((a, r) => a + (Date.parse(r.outcome.at || r.outcome.date) - Date.parse(r.assignedAt)) / DAY, 0) / doneR.length)) : null; return <tr key={u.id}>
          <Td className="font-semibold">{fullName(u)}<div className="text-xs font-normal text-muted">{u.role === 'nsoadmin' ? 'Boxing Canada · ' : ''}{u.province}{p.kind === 'coach' ? `, NCCP ${nccpOf(u) || '—'}` : ''}</div></Td>
          <Td>{lv ? levelName(data, p.id, lv) : <span className="text-muted">Not recorded</span>}</Td>
          <Td className="tabular-nums">{open}</Td><Td className="tabular-nums">{mineR.filter(r => r.status === 'completed').length}</Td>
          <Td className="tabular-nums">{avgDays === null ? <span className="text-muted">No completed evaluations</span> : <><b>{avgDays}</b> day{avgDays === 1 ? '' : 's'}<div className="text-xs text-muted">from assignment to outcome, {doneR.length} evaluation{doneR.length === 1 ? '' : 's'}</div></>}</Td>
          <Td className="text-right"><div className="flex flex-wrap justify-end gap-1"><Btn size="xs" variant="ghost" onClick={() => setProfile(u.id)}>Profile</Btn>{ro ? null : removing === u.id + p.id ? <><Btn size="xs" variant="danger" onClick={() => { toggleEval(u, p.id, false); setRemoving(null); }}>Confirm remove</Btn><Btn size="xs" onClick={() => setRemoving(null)}>Cancel</Btn></> : <Btn size="xs" variant="ghost" onClick={() => setRemoving(u.id + p.id)} title={open ? `${open} open assignment${open === 1 ? '' : 's'} stay with them` : undefined}>Remove</Btn>}</div>{removing === u.id + p.id && open > 0 && <div className="mt-1 text-right text-xs text-warn">{open} open assignment{open === 1 ? '' : 's'} will stay with them.</div>}</Td>
        </tr>; })}</Table>
      </div>; })}</div>
      {!ro && <p className="mt-2 text-xs text-muted">To change someone’s certified level, use Edit account in Members & Approvals.</p>}
    </Section>
    {kind === 'coach' && <NccpAdminSection province={prov} />}
    <Section title={kind === 'coach' ? 'Coaching pathway' : 'Officials pathway'} sub={ro ? 'Levels, names, requirements and evaluation tasks set by Boxing Canada.' : 'Levels, names and scheduled renames (for example the 2027 names), readiness requirements and evaluation tasks. Add a level for a new course.'}>
      <div className="space-y-4">{progs.map(p => ro ? <ProgramReadOnly key={p.id} prog={p} /> : <ProgramEditor key={p.id} prog={p} />)}</div>
    </Section>
    {review && <AssignModal req={review} onClose={() => setReview(null)} />}
    {profile && <MembershipProfileModal userId={profile} onClose={() => setProfile(null)} />}
    {addFor && <AddEvaluatorModal prog={addFor} onAdd={u => toggleEval(u, addFor.id, true)} onClose={() => setAddFor(null)} />}
  </div>;
}

function NotificationBell() {
  const { data, update, viewer, go } = useApp();
  const [open, setOpen] = useState(false);
  const due = viewer.role === 'nsoadmin' && nccpReminder(data).overdue ? [{ id: 'nccp-weekly', to: 'role:nsoadmin', text: NCCP_REMINDER_TEXT, tab: 'COACHPROG', at: nowIso(), readBy: [], sticky: true }] : [];
  const mine = [...due, ...(data.notifications || []).filter(n => n.to === viewer.id || n.to === 'role:' + viewer.role)];
  const unread = mine.filter(n => !(n.readBy || []).includes(viewer.id));
  const mark = ids => update(d => { (d.notifications || []).forEach(n => { if (ids.includes(n.id) && !(n.readBy || []).includes(viewer.id)) n.readBy = [...(n.readBy || []), viewer.id]; }); });
  return <div className="relative">
    <Btn size="sm" variant="ghost" onClick={() => setOpen(o => !o)} aria-label={`Notifications, ${unread.length} unread`}>🔔{unread.length > 0 && <span className="rounded-full bg-maple px-1.5 text-[10px] font-bold text-white">{unread.length}</span>}</Btn>
    {open && <div className="absolute right-0 z-40 mt-1 w-80 max-w-[90vw] overflow-hidden rounded-md border border-line bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="font-display text-base font-bold">Notifications</span>{unread.length > 0 && <button type="button" className="text-xs font-semibold text-rope" onClick={() => mark(unread.map(n => n.id))}>Mark all read</button>}</div>
      <ul className="max-h-80 divide-y divide-line overflow-y-auto">{mine.length ? mine.slice(0, 20).map(n => { const isNew = !(n.readBy || []).includes(viewer.id); return <li key={n.id}><button type="button" onClick={() => { mark([n.id]); setOpen(false); { const tg = n.tab === 'EVALS' && viewer.role === 'nsoadmin' ? 'COACHPROG' : n.tab; if (tg && tabsFor(viewer).includes(tg)) go(tg, n.nav || {}); }; }} className={cx('block w-full px-3 py-2 text-left text-sm hover:bg-sunk', isNew && 'bg-ropesoft')}><span className={isNew ? 'font-semibold' : ''}>{n.text}</span><span className="block text-xs text-muted">{fmtStamp(n.at)}</span></button></li>; }) : <li className="px-3 py-4 text-center text-sm text-muted">No notifications.</li>}</ul>
    </div>}
  </div>;
}
const tabsFor = v => { const base = ROLES[v.role].tabs.slice(); if (isClubManager(v) && !base.includes('CLUB')) base.splice(1, 0, 'CLUB'); if ((v.evaluatorPrograms || []).length && !base.includes('EVALUATOR')) { const at = base.includes('EVALS') ? base.indexOf('EVALS') + 1 : base.includes('COACHPROG') ? base.indexOf('COACHPROG') + 1 : base.length; base.splice(at, 0, 'EVALUATOR'); } return base; };

/* =========================================================
   NCCP transcripts from The Locker (Coaching Association of
   Canada). Two Locker reports are imported: "Multi-Sport -
   Detail" (modules) and "Events - Detail" (boxing NCCP
   workshops and evaluations). Records are keyed by NCCP #.
   Only what the portal needs is kept: NCCP #, name, region,
   and the training itself (no postal codes, ages or gender).
   ========================================================= */
const NCCP_CTX = [['Inst-Beg', 'Instruction – Beginners'], ['Comp-Int', 'Competition – Introduction'], ['Comp-Dev', 'Competition – Development']];
const isEvalEvent = s => /evaluat|évaluat/i.test(s || '');
const nccpRecord = (d, no) => no && d.nccp && d.nccp.records ? d.nccp.records[String(no).trim()] : null;
function lockerSafeSport(d, no) {
  const r = nccpRecord(d, no); if (!r) return null;
  const find = re => r.modules.filter(m => re.test(m.module)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const sst = find(/safe sport training/i); if (sst) return { level: 'NCCP Safe Sport Training', date: sst.date };
  const med = find(/ethical decisions/i); if (med) return { level: 'NCCP Making Ethical Decisions', date: med.date };
  const ris = find(/respect in sport/i); if (ris) return { level: 'NCCP Respect in Sport', date: ris.date };
  return null;
}
function nccpContexts(r) {
  return NCCP_CTX.map(([key, label]) => {
    const evs = r ? r.events.filter(e => e.context === key) : [];
    const evals = evs.filter(e => isEvalEvent(e.event));
    const last = evs.map(e => e.date).sort().pop() || '';
    return { key, label, count: evs.length, evaluated: evals.length > 0, last, status: evals.length ? 'Evaluation attended' : evs.length ? 'In training' : 'Not started', tone: evals.length ? 'ok' : evs.length ? 'info' : 'neutral' };
  });
}
function makeNccpDemo() {
  const M = (moduleId, module, date) => ({ moduleId, module, context: 'General', date });
  const E = (eventId, event, context, date, region) => ({ eventId, event, context, date, region });
  const recs = [
    { no: '5512093', firstName: 'Marc', lastName: 'Bélanger', region: 'ON', modules: [M('211', 'NCCP Make Ethical Decisions', '2026-01-20'), M('905', 'Safe Sport Training', '2026-02-03'), M('612', 'Making Head Way in Sport', '2025-12-10'), M('702', 'NCCP Emergency Action Plan eLearning', '2025-11-18'), M('410', 'Planning a Practice', '2025-11-25')],
      events: [E('d-101', 'Boxing Instruction - Beginners Module', 'Inst-Beg', '2025-11-22', 'ON'), E('d-102', 'Boxing Instruction - Beginners Evaluation', 'Inst-Beg', '2026-01-14', 'ON'), E('d-103', 'Boxing Introduction to Competition Module', 'Comp-Int', '2026-03-07', 'ON'), E('d-104', 'Boxing Introduction to Competition Evaluation Module', 'Comp-Int', '2026-05-12', 'ON'), E('d-105', 'Series 1 - 1 Basic and Advanced Boxing Techniques', 'Comp-Dev', '2026-09-19', 'ON'), E('d-106', 'Series 1 - 2 Mental Abilities', 'Comp-Dev', '2026-10-03', 'ON')] },
    { no: '4471820', firstName: 'Sarah', lastName: 'Lin', region: 'QC', modules: [M('211', 'NCCP Make Ethical Decisions', '2025-12-02'), M('905', 'Safe Sport Training', '2026-01-09'), M('612', 'Making Head Way in Sport', '2026-01-10'), M('820', 'Anti-racism in Coaching', '2026-04-14')],
      events: [E('d-201', 'Series 2 - 1 Système de pointage et critères des juges', 'Comp-Dev', '2025-11-30', 'QC'), E('d-202', 'Series 2 - 2 Profil médaillé(e) d’or', 'Comp-Dev', '2025-12-14', 'QC'), E('d-203', 'Series 3 - 2 Analyse de la performance', 'Comp-Dev', '2026-02-21', 'QC'), E('d-204', 'Performance Analysis Evaluation', 'Comp-Dev', '2026-04-18', 'QC')] },
    { no: '2201457', firstName: 'Kevin', lastName: 'MacDonald', region: 'NS', modules: [M('211', 'Make Ethical Decisions Online Evaluation', '2026-03-03'), M('612', 'Making Head Way in Sport', '2026-03-05'), M('730', 'Mental Health in Sport', '2026-06-11')],
      events: [E('d-301', 'Annual Program Components', 'Comp-Dev', '2026-02-07', 'NS'), E('d-302', 'Performance Analysis Evaluation', 'Comp-Dev', '2026-05-23', 'NS')] },
    { no: '6630481', firstName: 'Priya', lastName: 'Shah', region: 'ON', modules: [M('905', 'Safe Sport Training', '2026-02-27'), M('702', 'NCCP Emergency Action Plan eLearning', '2026-03-01')],
      events: [E('d-401', 'Boxing Instruction - Beginners Module', 'Inst-Beg', '2026-03-14', 'ON')] },
    { no: '3390112', firstName: 'Jean-Luc', lastName: 'Picard', region: 'QC', modules: [M('211', 'NCCP Make Ethical Decisions', '2025-12-01')], events: [] }
  ];
  return { records: Object.fromEntries(recs.map(r => [r.no, r])), imports: [{ fileName: 'Demo Locker data', kind: 'demo', rows: 0, people: recs.length, at: '2026-11-02T07:30:00', by: 'u-s1' }] };
}
function upgradeTo9(d) { if (!d.nccp) d.nccp = makeNccpDemo(); d.version = 9; return d; }
function mergeNccp(store, rows, kind) {
  const people = new Set(); let added = 0;
  rows.forEach(r => {
    const no = String(r['Nccp#'] || '').trim(); if (!no) return;
    people.add(no);
    const rec = store.records[no] = store.records[no] || { no, firstName: '', lastName: '', region: '', modules: [], events: [] };
    rec.firstName = String(r['First Name'] || rec.firstName).trim(); rec.lastName = String(r['Last Name'] || rec.lastName).trim(); rec.region = String(r['Region'] || rec.region).trim();
    if (kind === 'multi') {
      const item = { moduleId: String(r['Moduleid'] || '').trim(), module: String(r['Module'] || '').trim(), context: String(r['Context'] || 'General').trim(), date: String(r['Last Achieved'] || '').trim() };
      const ex = rec.modules.find(m => m.moduleId === item.moduleId);
      if (ex) { if (item.date > ex.date) Object.assign(ex, item); } else { rec.modules.push(item); added++; }
    } else {
      const item = { eventId: String(r['Eventid'] || '').trim(), event: String(r['Event'] || '').trim(), context: String(r['Context'] || '').trim(), date: String(r['Event Date'] || '').trim(), region: String(r['Event Region'] || '').trim() };
      if (!rec.events.some(e => e.eventId === item.eventId)) { rec.events.push(item); added++; }
    }
  });
  return { people: people.size, added };
}

function NccpTranscriptModal({ no, onClose }) {
  const { data } = useApp();
  return <Modal size="xl" title="NCCP Transcript" subtitle={`NCCP # ${no}. Source: The Locker (Coaching Association of Canada).`} onClose={onClose}><NccpSummaryBlock no={no} full /></Modal>;
}
function NccpSummaryBlock({ no, full }) {
  const { data } = useApp();
  const [open, setOpen] = useState(false);
  if (!no) return <p className="text-sm text-muted">No NCCP number on file, so there’s no Locker transcript to show.</p>;
  const r = nccpRecord(data, no);
  if (!r) return <p className="text-sm text-muted">NCCP # {no} has no training in the latest import from The Locker.</p>;
  const ctx = nccpContexts(r), ss = lockerSafeSport(data, no);
  const events = r.events.slice().sort((a, b) => b.date.localeCompare(a.date)), modules = r.modules.slice().sort((a, b) => b.date.localeCompare(a.date));
  const has = re => modules.find(m => re.test(m.module));
  return <div className="space-y-2">
    <div className="grid gap-1.5 sm:grid-cols-3">{ctx.map(c => <div key={c.key} className={cx('rounded-md border px-2.5 py-1.5', c.tone === 'ok' ? 'border-ok bg-oksoft' : c.tone === 'info' ? 'border-rope bg-ropesoft' : 'border-line')}>
      <div className="text-[11px] font-semibold text-muted">{c.label}</div><div className="text-sm font-semibold">{c.status}</div>{c.count > 0 && <div className="text-[11px] text-muted">{c.count} workshop{c.count === 1 ? '' : 's'}, last {fmtDate(c.last)}</div>}
    </div>)}</div>
    <div className="flex flex-wrap gap-1.5">
      {ss ? <Badge tone="ok">✓ {ss.level.replace('NCCP ', '')} ({fmtDate(ss.date)})</Badge> : <Badge tone="warn">No Safe Sport module recorded</Badge>}
      {has(/making head way/i) && <Badge tone="ok">✓ Making Head Way (concussion)</Badge>}
      {has(/emergency action plan/i) && <Badge tone="ok">✓ Emergency Action Plan</Badge>}
      <Badge tone="neutral">{modules.length} multi-sport module{modules.length === 1 ? '' : 's'}</Badge>
    </div>
    {!full && <button type="button" className="text-xs font-semibold text-rope" onClick={() => setOpen(true)}>View full NCCP transcript</button>}
    {full && <div className="grid gap-3 pt-1 lg:grid-cols-2">
      <div><h4 className="mb-1 font-display text-base font-bold">Boxing NCCP workshops & evaluations</h4><Table head={['Date', 'Workshop', 'Context']} isEmpty={!events.length} empty="None recorded.">{events.map(e => <tr key={e.eventId}><Td className="whitespace-nowrap">{fmtDate(e.date)}</Td><Td>{e.event}{isEvalEvent(e.event) && <Badge tone="ok" className="ml-1">Evaluation</Badge>}</Td><Td className="text-xs">{(NCCP_CTX.find(c => c[0] === e.context) || [0, e.context])[1]}</Td></tr>)}</Table></div>
      <div><h4 className="mb-1 font-display text-base font-bold">Multi-sport modules</h4><Table head={['Last achieved', 'Module']} isEmpty={!modules.length} empty="None recorded.">{modules.map(m => <tr key={m.moduleId + m.module}><Td className="whitespace-nowrap">{fmtDate(m.date)}</Td><Td>{m.module}</Td></tr>)}</Table></div>
    </div>}
    {full && <p className="text-xs text-muted">Covers the period of the imported Locker reports. “Evaluation attended” means an NCCP evaluation event is on record; certification decisions are confirmed in The Locker.</p>}
    {open && <NccpTranscriptModal no={no} onClose={() => setOpen(false)} />}
  </div>;
}

function NccpAdminSection({ province }) {
  const { data, update, viewer, notify } = useApp();
  const [drill, setDrill] = useState(null);
  const [tx, setTx] = useState(null);
  const [prof, setProf] = useState(null);
  const store = data.nccp || { records: {}, imports: [] };
  const recs = Object.values(store.records).filter(r => !province || r.region === province);
  const prog = (data.programs || []).find(p => p.kind === 'coach');
  const isCurrent = u => (u.status === 'approved' || u.status === 'invited') && (!province || u.province === province) && (!trackieOf(u)['NSO EXPIRY'] || trackieOf(u)['NSO EXPIRY'] >= REF_DATE);
  const current = data.users.filter(isCurrent);
  const byNccp = new Map(data.users.filter(u => (u.status === 'approved' || u.status === 'invited') && (!trackieOf(u)['NSO EXPIRY'] || trackieOf(u)['NSO EXPIRY'] >= REF_DATE) && nccpOf(u)).map(u => [String(nccpOf(u)).trim(), u]));
  const lockerMembers = recs.filter(r => byNccp.has(r.no)), lockerOnly = recs.filter(r => !byNccp.has(r.no));
  const isCoachMember = u => u.role === 'coach' || /coach/i.test(trackieOf(u)['MEMBERSHIP TYPE'] || '');
  const coaches = current.filter(isCoachMember);
  const noNumber = coaches.filter(u => !nccpOf(u));
  const noSafeSport = coaches.filter(u => nccpOf(u) && !lockerSafeSport(data, nccpOf(u)));
  const pct = (n, d) => d ? Math.round(n / d * 100) + '%' : '—';
  const levelIdx = (u) => { const lv = (u.certs || {})[prog.id]; return lv ? prog.levels.findIndex(l => l.id === lv) : -1; };
  const matrix = prog ? prog.levels.map((l, i) => ({ l, i })).filter(x => lvOffered(x.l)).map(({ l, i }) => {
    const certified = coaches.filter(u => levelIdx(u) >= i);
    const rest = coaches.filter(u => levelIdx(u) < i);
    const prog2 = rest.map(u => ({ u, p: levelProgress(data, u, l) }));
    return { l, certified, trained: prog2.filter(x => x.p.trained).map(x => x.u), training: prog2.filter(x => x.p.inTraining && !x.p.trained).map(x => x.u) };
  }) : [];
  const onFiles = async e => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    for (const f of files) {
      const all = parseCsv((await f.text()).replace(/^\uFEFF/, ''));
      if (all.length < 2) { notify(`${f.name} is empty.`, 'bad'); continue; }
      const head = all[0].map(h => h.trim());
      const kind = head.includes('Moduleid') ? 'multi' : head.includes('Eventid') ? 'events' : null;
      if (!kind || !head.includes('Nccp#')) { notify(`${f.name} isn’t a Locker “Multi-Sport - Detail” or “Events - Detail” report.`, 'bad'); continue; }
      const rows = all.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] || ''])));
      update(d => { d.nccp = d.nccp || { records: {}, imports: [] }; const res = mergeNccp(d.nccp, rows, kind); d.nccp.imports.unshift({ fileName: f.name, kind, rows: rows.length, people: res.people, added: res.added, at: nowIso(), by: viewer.id }); });
      notify(`${f.name}: ${rows.length} rows for ${new Set(rows.map(r => r['Nccp#'])).size} coaches imported from The Locker.`);
    }
  };
  const open = (title, sub, people) => setDrill({ title, sub, people });
  const Tile = ({ label, value, sub, onClick, tone }) => <button type="button" onClick={onClick} className="rounded-md border border-line bg-surface p-3 text-left hover:border-rope hover:bg-ropesoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-rope">
    <div className={cx('font-display text-2xl font-extrabold tabular-nums', tone === 'warn' && 'text-warn')}>{value}</div><div className="text-sm font-semibold leading-tight">{label}</div>{sub && <div className="text-xs text-muted">{sub}</div>}<div className="mt-1 text-[11px] font-semibold text-rope">View coaches ›</div>
  </button>;
  const Cell = ({ list, title }) => <button type="button" disabled={!list.length} onClick={() => open(title, `${list.length} of ${coaches.length} current coach members`, list.map(u => ({ u })))} className="w-full rounded px-2 py-1 text-right tabular-nums enabled:hover:bg-ropesoft disabled:text-muted"><b>{list.length}</b> <span className="text-xs text-muted">{pct(list.length, coaches.length)}</span></button>;
  return <Section title={province ? `NCCP coaching summary: ${PROVINCE_INFO[province].name}` : 'NCCP coaching summary (The Locker)'} sub={province ? 'From The Locker reports imported by Boxing Canada, for your province’s coaches. Click any figure to see the coaches behind it.' : 'Locker reports are matched to members by NCCP #. Click any figure to see the coaches behind it.'} actions={!province && <label className="inline-flex cursor-pointer items-center rounded-md border border-maple bg-maple px-3.5 py-2 text-sm font-semibold text-white hover:brightness-110">Import Locker reports<input type="file" accept=".csv,text/csv" multiple className="hidden" onChange={onFiles} /></label>}>
    {!province && <NccpUploadStatus />}
    {province && (store.imports || []).length > 0 && <p className="mb-3 text-xs text-muted">Locker data last imported by Boxing Canada on {fmtStamp(store.imports[0].at)}.</p>}
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="NCCP # holders who are current members" value={`${lockerMembers.length} of ${recs.length}`} sub={`${pct(lockerMembers.length, recs.length)} of coaches in the Locker data`} onClick={() => open('NCCP # holders who are current members', `${lockerMembers.length} of ${recs.length} coaches in the Locker data`, lockerMembers.map(r => ({ u: byNccp.get(r.no), r })))} />
      <Tile label="NCCP # holders who aren’t current members" value={lockerOnly.length} sub={`${pct(lockerOnly.length, recs.length)} of coaches in the Locker data`} onClick={() => open('NCCP # holders who aren’t current members', 'In The Locker, but no current Boxing Canada membership with that NCCP #', lockerOnly.map(r => ({ r })))} />
      <Tile tone={noNumber.length ? 'warn' : ''} label="Current coach members without an NCCP #" value={`${noNumber.length} of ${coaches.length}`} sub={`${pct(noNumber.length, coaches.length)} of current coach members`} onClick={() => open('Current coach members without an NCCP #', `${noNumber.length} of ${coaches.length} current coach members`, noNumber.map(u => ({ u })))} />
      <Tile tone={noSafeSport.length ? 'warn' : ''} label="Current coaches with no Safe Sport module on record" value={noSafeSport.length} sub={`Of ${coaches.length - noNumber.length} with an NCCP #; ${noSafeSport.filter(u => !nccpRecord(data, nccpOf(u))).length} have no Locker record at all`} onClick={() => open('Current coaches with no Safe Sport module in The Locker', 'Have an NCCP #, but no Safe Sport Training, Make Ethical Decisions or Respect in Sport module on record', noSafeSport.map(u => ({ u })))} />
    </div>
    {prog && <>
      <h4 className="mb-1 font-display text-base font-bold">Coach progress by level <span className="text-sm font-normal text-muted">({coaches.length} current coach members)</span></h4>
      <div className="overflow-x-auto rounded-md border border-line"><table className="w-full text-sm">
        <thead className="bg-sunk text-xs text-muted"><tr><th className="px-3 py-2 text-left">Level</th><th className="px-3 py-2 text-right">In training</th><th className="px-3 py-2 text-right">Trained</th><th className="px-3 py-2 text-right">Certified</th></tr></thead>
        <tbody className="divide-y divide-line">{matrix.map(m => <tr key={m.l.id}><Td className="font-semibold">{lvName(m.l)}</Td>
          <Td className="p-1"><Cell list={m.training} title={`In training for ${lvName(m.l)}`} /></Td>
          <Td className="p-1"><Cell list={m.trained} title={`Trained for ${lvName(m.l)} (course and Multi-Sport modules done, not yet certified)`} /></Td>
          <Td className="p-1"><Cell list={m.certified} title={`Certified at ${lvName(m.l)} or higher`} /></Td></tr>)}</tbody>
      </table></div>
      <p className="mt-1 text-xs text-muted">In training: the level’s boxing course is in The Locker. Trained: the course and every required NCCP Multi-Sport module, not yet certified. Certified: the coach holds this level or higher in the portal, from an evaluation. Requirements are set under Coaching pathway below.</p>
    </>}
    {(store.imports || []).length > 0 && <p className="mt-2 text-xs text-muted">{recs.length} coaches in the Locker data. Last import: {store.imports[0].fileName}, {fmtStamp(store.imports[0].at)}.</p>}
    {drill && <Modal size="xl" title={drill.title} subtitle={drill.sub} onClose={() => setDrill(null)} footer={<><Btn onClick={async () => { const head = ['Name', 'NCCP #', 'Province', 'Club', 'Email', 'Membership type', 'Portal level']; const rows = drill.people.map(({ u, r }) => [u ? fullName(u) : `${r.firstName} ${r.lastName}`, u ? nccpOf(u) : r.no, u ? u.province : r.region, u ? (u.club || '') : '', u ? u.email : '', u ? (trackieOf(u)['MEMBERSHIP TYPE'] || '') : '', u && (u.certs || {})[prog.id] ? levelName(data, prog.id, u.certs[prog.id]) : '']); const q = v => { const s2 = String(v == null ? '' : v); return /[",\r\n]/.test(s2) ? '"' + s2.replace(/"/g, '""') + '"' : s2; }; const r2 = await saveFile(drill.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '.csv', '\uFEFF' + [head, ...rows].map(x => x.map(q).join(',')).join('\r\n')); notify(r2.msg, r2.ok ? 'ok' : 'warn'); }}>Download list (CSV)</Btn><Btn onClick={() => setDrill(null)}>Close</Btn></>}>
      <Table head={['Coach', 'NCCP #', 'Province & club', 'Level & Locker status', '']} isEmpty={!drill.people.length} empty="No coaches.">
        {drill.people.slice(0, 300).map(({ u, r }, i) => { const no = u ? nccpOf(u) : r.no; const rec = r || nccpRecord(data, no); const ss = no ? lockerSafeSport(data, no) : null; const lv = u && prog ? (u.certs || {})[prog.id] : null; return <tr key={(u ? u.id : '') + (rec ? rec.no : '') + i}>
          <Td className="font-semibold">{u ? fullName(u) : `${r.firstName} ${r.lastName}`}<div className="text-xs font-normal text-muted">{u ? u.email : 'Not a current member'}</div></Td>
          <Td>{no || <Badge tone="warn">Missing</Badge>}</Td>
          <Td>{u ? u.province : rec.region}<div className="text-xs text-muted">{u ? (u.club || '—') : ''}</div></Td>
          <Td className="text-xs">{u && <div>{lv ? levelName(data, prog.id, lv) : 'Not certified'}</div>}{rec ? <div className="text-muted">{rec.events.length} boxing workshops, {rec.modules.length} modules{ss ? `, ${ss.level.replace('NCCP ', '')}` : ', no Safe Sport module'}</div> : no ? <div className="text-muted">No Locker record</div> : null}</Td>
          <Td className="text-right"><div className="flex justify-end gap-1">{rec && <Btn size="xs" onClick={() => setTx(rec.no)}>Transcript</Btn>}{u && <Btn size="xs" variant="ghost" onClick={() => setProf(u.id)}>Profile</Btn>}</div></Td>
        </tr>; })}
      </Table>
      {drill.people.length > 300 && <p className="mt-2 text-xs text-muted">Showing the first 300 of {drill.people.length}. Download the list for all of them.</p>}
    </Modal>}
    {tx && <NccpTranscriptModal no={tx} onClose={() => setTx(null)} />}
    {prof && <MembershipProfileModal userId={prof} onClose={() => setProf(null)} />}
  </Section>;
}

/* =========================================================
   NCCP pathway requirements & weekly Locker upload reminder
   Each program level lists the Locker events and multi-sport
   modules that count toward it. The defaults below are
   starting points for Boxing Canada to confirm against its
   NCCP model; NSO Administrators can edit them.
   ========================================================= */
const REQ = (kind, label, match) => ({ id: uid('rq'), kind, label, match });
function defaultCoachReqs() {
  return {
    'lv-ci': [REQ('event', 'Instruction – Beginners workshop', 'Instruction - Beginners Module|Instruction - Débutants'), REQ('module', 'Safe Sport Training or Make Ethical Decisions', 'Safe Sport Training|Ethical Decisions'), REQ('module', 'Making Head Way in Sport (concussion)', 'Making Head Way'), REQ('module', 'Emergency Action Plan', 'Emergency Action Plan')],
    'lv-cc': [REQ('event', 'Instruction – Beginners evaluation', 'Beginners Evaluation|Beginner Evaluation'), REQ('module', 'Planning a Practice', 'Planning a Practice'), REQ('module', 'Make Ethical Decisions', 'Ethical Decisions')],
    'lv-pc': [REQ('event', 'Introduction to Competition workshop', 'Introduction to Competition Module'), REQ('event', 'Introduction to Competition evaluation', 'Introduction to Competition Evaluation'), REQ('module', 'Make Ethical Decisions evaluation', 'Make Ethical Decisions Online Evaluation|NCCP Make Ethical Decisions')],
    'lv-ntc': [REQ('event', 'Competition – Development, Series 1', 'Series 1 -'), REQ('event', 'Competition – Development, Series 2', 'Series 2 -'), REQ('event', 'Competition – Development, Series 3', 'Series 3 -'), REQ('event', 'Performance analysis evaluation', "Performance Analysis Evaluation|Atelier d'analyse de la performance")],
    'lv-ic': [REQ('event', 'Annual Program Components', 'Annual Program Components'), REQ('event', 'Competition – Development evaluation', 'Performance Analysis Evaluation')]
  };
}
function upgradeTo10(d) {
  const defs = defaultCoachReqs();
  (d.programs || []).forEach(p => p.levels.forEach(l => { if (!l.reqs) l.reqs = p.kind === 'coach' ? (defs[l.id] || []) : []; }));
  d.nccp = d.nccp || { records: {}, imports: [] };
  if (!d.nccp.reminder) d.nccp.reminder = { enabled: true };
  if ((d.nccp.imports || []).every(i => i.kind === 'demo')) d.nccp.imports = [{ fileName: 'Multi-Sport - Detail (demo)', kind: 'multi', rows: 14, people: 5, added: 14, at: '2026-10-26T09:00:00', by: 'u-s1' }, { fileName: 'Events - Detail (demo)', kind: 'events', rows: 13, people: 4, added: 13, at: '2026-10-26T09:02:00', by: 'u-s1' }];
  d.version = 10;
  return d;
}
function nccpReminder(d) {
  const imps = (d.nccp && d.nccp.imports) || [];
  const last = k => imps.filter(i => i.kind === k).map(i => i.at).sort().pop() || null;
  const lm = last('multi'), le = last('events');
  const oldest = lm && le ? (lm < le ? lm : le) : null;
  const dueAt = oldest ? Date.parse(oldest) + 7 * DAY : null;
  const enabled = !(d.nccp && d.nccp.reminder && d.nccp.reminder.enabled === false);
  const isOver = !dueAt || Date.now() >= dueAt;
  return { lastMulti: lm, lastEvents: le, dueAt, enabled, overdue: enabled && isOver, isOver, missing: [!lm && 'Multi-Sport – Detail', !le && 'Events – Detail'].filter(Boolean) };
}
const NCCP_REMINDER_TEXT = 'Weekly NCCP upload due: import this week’s Locker reports (Multi-Sport – Detail and Events – Detail).';
function NccpUploadStatus() {
  const { data, update, notify } = useApp();
  const rm = nccpReminder(data);
  const ago = iso => { const days = Math.floor((Date.now() - Date.parse(iso)) / DAY); return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`; };
  return <div className={cx('mb-3 rounded-md border p-3', rm.isOver ? 'border-warn bg-warnsoft' : 'border-ok bg-oksoft')}>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
      <span className={cx('font-semibold', rm.isOver ? 'text-warn' : 'text-ok')}>{rm.isOver ? '⏰ Weekly upload due now' : `✓ Next weekly upload due ${new Date(rm.dueAt).toLocaleDateString(uiLocale(), { weekday: 'long', month: 'short', day: 'numeric' })}`}</span>
      <span><span className="text-muted">Multi-Sport – Detail: </span>{rm.lastMulti ? `${fmtStamp(rm.lastMulti)} (${ago(rm.lastMulti)})` : 'never imported'}</span>
      <span><span className="text-muted">Events – Detail: </span>{rm.lastEvents ? `${fmtStamp(rm.lastEvents)} (${ago(rm.lastEvents)})` : 'never imported'}</span>
      <label className="ml-auto flex items-center gap-2 text-xs font-semibold"><input type="checkbox" className="h-4 w-4" checked={rm.enabled} onChange={e => { update(d => { d.nccp = d.nccp || { records: {}, imports: [] }; d.nccp.reminder = { ...(d.nccp.reminder || {}), enabled: e.target.checked }; }); notify(e.target.checked ? 'Weekly upload reminders turned on.' : 'Weekly upload reminders turned off.', 'info'); }} />Weekly reminders for NSO Administrators</label>
    </div>
    <p className="mt-1 text-xs text-muted">Export both reports from The Locker for the last 12 months each week and import them here. Re-importing overlapping dates never creates duplicates. Reminders appear in the 🔔 bell, on the National Overview and on this tab once a report is more than 7 days old.</p>
  </div>;
}

/* =========================================================
   National Team Program
   NSO Administrators identify boxers as part of the program
   at one of four levels. Status can change at any time; every
   change is kept in the athlete's history. National-team-only
   documents are restricted to identified athletes.
   ========================================================= */
const NT_LEVELS = [
  { key: 'world_class', label: 'World Class', color: '#8A6D1F' },
  { key: 'podium_potential', label: 'Podium Potential', color: '#C8102E' },
  { key: 'emerging', label: 'Emerging', color: '#1D4E89' },
  { key: 'national_squad', label: 'National Squad', color: '#1C7548' }
];
const ntInfo = k => NT_LEVELS.find(l => l.key === k);
const ntLabel = k => (ntInfo(k) || {}).label || k;
const audEmoji = a => a === 'nationalteam' ? '🍁' : a === 'public' ? '🌐' : ROLES[a].emoji;
function NationalTeamBadge({ user, large }) {
  if (!user || user.role !== 'boxer' || !user.nationalTeam) return null;
  const l = ntInfo(user.nationalTeam.level); if (!l) return null;
  return <span title={`Boxing Canada National Team Program: ${l.label}`} className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold text-white shadow-sm', large ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]')} style={{ background: l.color }}>
    <span aria-hidden="true">🍁</span>{large ? 'National Team Program · ' : 'NT · '}{l.label}
  </span>;
}
function setNationalTeam(d, boxerId, level, by, note) {
  const u = d.users.find(x => x.id === boxerId); if (!u) return;
  const prev = u.nationalTeam;
  u.nationalTeam = level ? { level, since: prev ? prev.since : nowIso(), updatedAt: nowIso(), updatedBy: by } : null;
  u.ntHistory = [...(u.ntHistory || []), { level: level || null, from: prev ? prev.level : null, at: nowIso(), by, note: note || '' }];
  notifyUsers(d, boxerId, level ? (prev ? `Your National Team Program level changed to ${ntLabel(level)}.` : `You’ve been identified for the Boxing Canada National Team Program: ${ntLabel(level)}.`) : 'You are no longer identified as part of the National Team Program.', 'DASHBOARD');
}
function upgradeTo11(d) {
  const seed = { 'u-b1': ['world_class', '2025-09-01T10:00:00'], 'u-b4': ['podium_potential', '2026-01-15T10:00:00'], 'u-b2': ['emerging', '2026-06-20T10:00:00'] };
  d.users.forEach(u => {
    if (u.role !== 'boxer' || u.nationalTeam !== undefined) return;
    const s = seed[u.id];
    u.nationalTeam = s ? { level: s[0], since: s[1], updatedAt: s[1], updatedBy: 'u-s1' } : null;
    u.ntHistory = s ? [{ level: s[0], from: null, at: s[1], by: 'u-s1', note: 'Identified at the national team selection review.' }] : [];
  });
  d.docs = d.docs || [];
  const D = o => ({ description: '', sample: true, fileName: o.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pdf', size: 320000, decidedBy: 'u-s1', decidedAt: o.uploadedAt, rejectionReason: '', scope: 'national', uploadedBy: 'u-s1', status: 'published', ...o });
  if (!d.docs.some(x => x.id === 'doc-nt-1')) d.docs.unshift(D({ id: 'doc-nt-1', title: 'National Team Training Camp Plan, Winter 2027', description: 'Camp dates, travel, training blocks and testing for all National Team Program athletes.', category: 'Announcements', audience: ['nationalteam'], ntLevels: [], uploadedAt: '2026-10-15T10:00:00' }));
  if (!d.docs.some(x => x.id === 'doc-nt-2')) d.docs.unshift(D({ id: 'doc-nt-2', title: 'High Performance Athlete Agreement 2026–27', description: 'Agreement, funding criteria and obligations for World Class and Podium Potential athletes.', category: 'Policies & Governance', audience: ['nationalteam'], ntLevels: ['world_class', 'podium_potential'], uploadedAt: '2026-10-01T10:00:00' }));
  d.version = 11;
  return d;
}
function NtLevelSelect({ user, compact }) {
  const { update, viewer, notify } = useApp();
  return <select className={cx('field w-auto', compact ? 'py-1 text-xs' : 'py-1.5')} aria-label={`National Team Program level for ${fullName(user)}`} value={user.nationalTeam ? user.nationalTeam.level : ''}
    onChange={e => { const v = e.target.value; update(d => setNationalTeam(d, user.id, v || null, viewer.id)); notify(v ? `${fullName(user)}: National Team Program, ${ntLabel(v)}.` : `${fullName(user)} removed from the National Team Program.`, v ? 'ok' : 'warn'); }}>
    <option value="">Not in the program</option>{NT_LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
  </select>;
}
function NtHistoryModal({ user, onClose }) {
  const { data } = useApp();
  const h = (user.ntHistory || []).slice().reverse();
  return <Modal size="md" title="National Team Program History" subtitle={`${fullName(user)}, ${user.membershipId}`} onClose={onClose}>
    <ol className="space-y-2 border-l-2 border-line pl-3 text-sm">{h.length ? h.map((e, i) => <li key={i}><div className="font-semibold">{e.level ? (e.from ? `${ntLabel(e.from)} → ${ntLabel(e.level)}` : `Identified: ${ntLabel(e.level)}`) : `Removed from the program${e.from ? ` (was ${ntLabel(e.from)})` : ''}`}</div><div className="text-xs text-muted">{fmtStamp(e.at)} by {nameOf(data, e.by)}</div>{e.note && <div className="text-xs">{e.note}</div>}</li>) : <li className="text-muted">No changes recorded.</li>}</ol>
  </Modal>;
}
function NationalTeamSection({ onOpen }) {
  const { data, update, viewer, notify } = useApp();
  const [q, setQ] = useState(''); const [addLevel, setAddLevel] = useState('national_squad');
  const [hist, setHist] = useState(null); const [filter, setFilter] = useState('');
  const [show, setShow] = useState(false);
  const roster = allBoxers(data).filter(b => b.nationalTeam).sort((a, b) => NT_LEVELS.findIndex(l => l.key === a.nationalTeam.level) - NT_LEVELS.findIndex(l => l.key === b.nationalTeam.level) || a.lastName.localeCompare(b.lastName));
  const shown = roster.filter(b => !filter || b.nationalTeam.level === filter);
  const term = q.trim().toLowerCase();
  const found = term.length >= 2 ? allBoxers(data).filter(b => !b.nationalTeam && (fullName(b) + ' ' + b.membershipId + ' ' + (b.club || '')).toLowerCase().includes(term)).slice(0, 6) : [];
  const add = b => { update(d => setNationalTeam(d, b.id, addLevel, viewer.id)); notify(`${fullName(b)} added to the National Team Program as ${ntLabel(addLevel)}.`); setQ(''); };
  return <Section logo title="National Team Program" sub="Identify athletes at one of four levels. Changes take effect immediately, including access to National Team documents." actions={<div className="flex items-center gap-2"><Badge tone="info">{roster.length} athletes</Badge><Btn size="sm" onClick={() => setShow(v => !v)} aria-expanded={show}>{show ? 'Hide' : 'Show'}</Btn></div>}>
    {!show ? <div className="flex flex-wrap items-center gap-1.5">{NT_LEVELS.map(l => <span key={l.key} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} aria-hidden="true" />{l.label}: {roster.filter(b => b.nationalTeam.level === l.key).length}</span>)}<span className="text-xs text-muted">Select Show to manage the roster.</span></div> : <>
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{NT_LEVELS.map(l => { const n = roster.filter(b => b.nationalTeam.level === l.key).length, on = filter === l.key; return <button key={l.key} type="button" aria-pressed={on} onClick={() => setFilter(on ? '' : l.key)} className={cx('rounded-md border-2 bg-surface p-3 text-left', on ? '' : 'border-line hover:bg-sunk')} style={on ? { borderColor: l.color } : undefined}>
      <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: l.color }} aria-hidden="true" /><span className="text-sm font-semibold">{l.label}</span></div><div className="font-display text-3xl font-extrabold tabular-nums">{n}</div></button>; })}</div>
    <div className="relative mb-3 flex flex-wrap items-center gap-2">
      <input className="field max-w-sm flex-1" placeholder="Add an athlete: search name, membership ID or club" value={q} onChange={e => setQ(e.target.value)} aria-label="Search boxers to add" />
      <select className="field w-auto" value={addLevel} onChange={e => setAddLevel(e.target.value)} aria-label="Level for new athlete">{NT_LEVELS.map(l => <option key={l.key} value={l.key}>Add as {l.label}</option>)}</select>
      {found.length > 0 && <ul className="absolute left-0 top-full z-10 mt-1 w-full max-w-sm overflow-hidden rounded-md border border-line bg-surface shadow-lg">{found.map(b => <li key={b.id}><button type="button" onClick={() => add(b)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sunk"><span className="font-semibold">{fullName(b)}</span><span className="text-xs text-muted">{b.membershipId}, {b.province}, age {ageOn(b.dob, REF_DATE)}</span><span className="ml-auto text-xs font-semibold text-rope">Add</span></button></li>)}</ul>}
      {term.length >= 2 && !found.length && <span className="text-xs text-muted">No matching athletes outside the program.</span>}
    </div>
    <Table head={['Athlete', 'Province & club', 'Age', 'Eligibility', 'Level', 'In program since', '']} isEmpty={!shown.length} empty={filter ? 'No athletes at this level.' : 'No athletes identified yet.'}>
      {shown.map(b => { const el = eligibility(data, b); return <tr key={b.id}>
        <Td className="font-semibold">{fullName(b)}<div className="mt-0.5"><NationalTeamBadge user={b} /></div></Td>
        <Td>{b.province}<div className="text-xs text-muted">{b.club || '—'}</div></Td><Td className="tabular-nums">{ageOn(b.dob, REF_DATE)}</Td>
        <Td><Badge tone={el.tone}>{el.label}</Badge></Td>
        <Td><NtLevelSelect user={b} compact /></Td>
        <Td className="whitespace-nowrap text-xs">{fmtDate(b.nationalTeam.since.slice(0, 10))}<div className="text-muted">Updated {fmtDate(b.nationalTeam.updatedAt.slice(0, 10))}</div></Td>
        <Td className="text-right"><div className="flex justify-end gap-1"><Btn size="xs" variant="ghost" onClick={() => setHist(b)}>History</Btn>{onOpen && <Btn size="xs" variant="rope" onClick={() => onOpen(b.id)}>Record Book</Btn>}</div></Td>
      </tr>; })}
    </Table>
    </>}
    {hist && <NtHistoryModal user={getUser(data, hist.id)} onClose={() => setHist(null)} />}
  </Section>;
}

/* =========================================================
   Public access (not signed in)
   Public documents, the public calendar, "become a member"
   with Trackie links set by NSO and PTSO administrators, and
   account activation for new members imported from Trackie.
   ========================================================= */
const PUBLIC_VIEWER = { id: 'public', role: 'public', province: '', firstName: 'Public', lastName: 'visitor', email: '' };
const calIsPublic = e => e.derived ? e.isPublic !== false : !!e.isPublic;
const INTEREST_AREAS = ['Boxing as an athlete', 'Recreational boxing or fitness', 'Coaching', 'Officiating', 'Ringside medical', 'Volunteering', 'Parent of a young boxer'];
const INTEREST_STATUS = { new: { tone: 'warn', label: 'New' }, contacted: { tone: 'info', label: 'Contacted' }, joined: { tone: 'ok', label: 'Joined' }, closed: { tone: 'neutral', label: 'Not proceeding' } };
const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const activationLink = code => { let base = ''; try { base = window.location.origin + window.location.pathname; } catch (e) { base = ''; } return base + '#activate-' + code; };
function queueActivation(d, u) {
  const code = genCode();
  u.activation = { code, createdAt: nowIso(), expiresAt: new Date(Date.now() + 14 * DAY).toISOString() };
  d.outbox = d.outbox || [];
  d.outbox.unshift({ id: uid('mail'), kind: 'activation', to: u.email, userId: u.id, code, at: nowIso(), subject: 'Welcome to Boxing Canada: activate your portal account',
    body: `Hi ${u.firstName},\n\nYour Boxing Canada membership is confirmed. Activate your portal account to see your Record Book, events and documents.\n\nActivation link: ${activationLink(code)}\nOr go to the portal, choose “Activate my account” and enter this code: ${code}\n\nThe code expires in 14 days.\n\nBoxing Canada` });
  return code;
}
const markInterestJoined = (d, email) => (d.interests || []).forEach(i => { if (email && i.email.toLowerCase() === String(email).toLowerCase()) i.status = 'joined'; });
const isExpiredInvite = u => !!(u.activation && Date.parse(u.activation.expiresAt) < Date.now());
const lapseInvite = (u, by) => { if (!u) return; u.status = 'lapsed'; u.activation = { ...(u.activation || {}), lapsedAt: nowIso(), lapsedBy: by }; };
const findInvite = (d, code) => d.users.find(u => u.status === 'invited' && u.activation && u.activation.code === String(code || '').trim().toUpperCase());
const maskEmail = e => { const [a, b] = String(e).split('@'); return a ? a[0] + '•••' + (a.length > 1 ? a[a.length - 1] : '') + '@' + (b || '') : ''; };
const joinLinkFor = (d, prov) => { const ml = d.membershipLinks || {}; const p = prov && ml.provinces && ml.provinces[prov]; return p && p.url ? { ...p, source: PROVINCE_INFO[prov].ptso } : ml.national && ml.national.url ? { ...ml.national, source: 'Boxing Canada' } : null; };

function upgradeTo12(d) {
  const addAud = (id, a) => { const x = (d.docs || []).find(y => y.id === id); if (x && !x.audience.includes(a)) x.audience.push(a); };
  ['doc-1', 'doc-5', 'doc-6'].forEach(id => addAud(id, 'public'));
  if (!(d.docs || []).some(x => x.id === 'doc-pub-1')) d.docs.unshift({ id: 'doc-pub-1', title: 'How to Join Boxing Canada', description: 'Membership types, what each includes, and how to register through Trackie with your local club.', category: 'Announcements', audience: ['public', 'boxer', 'coach', 'official', 'medical'], ntLevels: [], scope: 'national', uploadedBy: 'u-s1', uploadedAt: '2026-10-28T10:00:00', status: 'published', decidedBy: 'u-s1', decidedAt: '2026-10-28T10:00:00', rejectionReason: '', sample: true, fileName: 'how-to-join-boxing-canada.pdf', size: 180000 });
  (d.calendar || []).forEach(e => { if (e.isPublic === undefined) e.isPublic = ['cal-2', 'cal-3', 'cal-7'].includes(e.id); });
  if (!d.membershipLinks) d.membershipLinks = { national: { url: 'https://www.trackie.com', label: 'Join Boxing Canada on Trackie', note: 'Choose your province and club during registration. Your club can help you pick the right membership type.' }, provinces: { ON: { url: 'https://www.trackie.com', label: 'Join Boxing Ontario on Trackie', note: 'Ontario members register with their club through Boxing Ontario’s Trackie page.' } } };
  if (!d.interests) d.interests = [
    { id: 'int-1', name: 'Jordan Ellis', email: 'jordan.ellis@example.ca', phone: '', province: 'ON', areas: ['Boxing as an athlete'], message: 'Looking for a club in Ottawa for my first competition.', at: '2026-10-29T18:20:00', status: 'new' },
    { id: 'int-2', name: 'Camille Roy', email: 'camille.roy@example.ca', phone: '', province: 'QC', areas: ['Coaching', 'Officiating'], message: '', at: '2026-10-27T12:05:00', status: 'contacted' }
  ];
  if (!d.users.some(u => u.id === 'u-b7')) {
    const u = { id: 'u-b7', firstName: 'Amara', lastName: 'Diallo', role: 'boxer', gender: 'F', dob: '2004-08-19', province: 'QC', email: 'amara.diallo@example.ca', membershipId: 'BC-2026-0412', password: '', status: 'invited', selectedCoachIds: ['u-c2'], club: 'Club de boxe Mont-Royal', certs: {}, evaluatorPrograms: [], nationalTeam: null, ntHistory: [] };
    u.trackie = trackieFromUser(u); u.trackieSyncedAt = '2026-10-30T09:00:00';
    u.activation = { code: 'BXC7K2QM', createdAt: '2026-10-30T09:00:00', expiresAt: '2026-12-31T23:59:00' };
    d.users.push(u);
    d.outbox = d.outbox || [];
    d.outbox.unshift({ id: 'mail-1', kind: 'activation', to: u.email, userId: u.id, code: 'BXC7K2QM', at: '2026-10-30T09:00:00', subject: 'Welcome to Boxing Canada: activate your portal account', body: `Hi Amara,\n\nYour Boxing Canada membership is confirmed. Activate your portal account to see your Record Book, events and documents.\n\nActivation link: ${activationLink('BXC7K2QM')}\nOr go to the portal, choose “Activate my account” and enter this code: BXC7K2QM\n\nThe code expires in 14 days.\n\nBoxing Canada` });
  }
  d.outbox = d.outbox || [];
  d.version = 12;
  return d;
}

function PublicDocsView() {
  const { data } = useApp();
  const [prov, setProv] = useState('');
  const docs = (data.docs || []).filter(d => d.status === 'published' && d.audience.includes('public') && (!prov || d.scope === 'national' || d.scope === prov));
  return <Section logo title="Public Documents" sub="Rules, guides and notices from Boxing Canada and the provincial and territorial associations. No membership needed." actions={<select className="field w-auto" value={prov} onChange={e => setProv(e.target.value)} aria-label="Province"><option value="">All of Canada</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select>}>
    <DocCards docs={docs} />
  </Section>;
}

function PublicJoinView({ onActivate }) {
  const { data, update, notify } = useApp();
  const [prov, setProv] = useState('');
  const [step, setStep] = useState('start');
  const [f, setF] = useState({ name: '', email: '', phone: '', areas: [], message: '', consent: false });
  const [err, setErr] = useState('');
  const link = joinLinkFor(data, prov);
  const submit = () => {
    if (!prov) { setErr('Choose your province or territory.'); return; }
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { setErr('Add your name and a valid email address.'); return; }
    if (!f.consent) { setErr('Tick the box so we can contact you.'); return; }
    update(d => { d.interests = d.interests || []; d.interests.unshift({ id: uid('int'), name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), province: prov, areas: f.areas, message: f.message.trim(), at: nowIso(), status: 'new' }); });
    setErr(''); setStep('done');
  };
  return <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
    <Section logo title="Become a Member" sub="Boxing Canada membership is run through Trackie with your provincial or territorial association and your club.">
      <ol className="mb-4 grid gap-2 sm:grid-cols-3">{[['1', 'Register on Trackie', 'Choose your province, club and membership type, and pay your fee.'], ['2', 'Watch for our email', 'Once your membership is confirmed, you’ll get an activation code by email.'], ['3', 'Activate your account', 'Use the code to set your password and sign in to this portal.']].map(([n, t, s]) => <li key={n} className="rounded-md border border-line p-3"><div className="font-display text-2xl font-extrabold text-maple">{n}</div><div className="font-semibold">{t}</div><p className="text-sm text-muted">{s}</p></li>)}</ol>
      <Field label="Your province or territory"><select className="field max-w-sm" value={prov} onChange={e => { setProv(e.target.value); setErr(''); }}><option value="">Choose…</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></Field>
      {prov && <div className="mt-3 rounded-md border-2 border-maple p-4">
        {link ? <>
          <div className="text-xs font-semibold text-muted">Registration with {link.source}</div>
          {link.note && <p className="mt-1 max-w-prose text-sm">{link.note}</p>}
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-md border border-maple bg-maple px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">{link.label || 'Register on Trackie'} ↗</a>
          <p className="mt-2 text-xs text-muted">Opens Trackie, Boxing Canada’s membership system, in a new window.</p>
        </> : <p className="text-sm">Online registration for {PROVINCE_INFO[prov].name} isn’t set up here yet. Tell us you’re interested and {PROVINCE_INFO[prov].ptso} will contact you.</p>}
      </div>}
      <p className="mt-4 text-sm">Already registered on Trackie? <button type="button" className="font-semibold text-rope underline" onClick={onActivate}>Activate your portal account</button> with the code from your welcome email.</p>
    </Section>
    <Section title="Interested but not ready?" sub="Tell us about yourself and your association will get in touch.">
      {step === 'done' ? <div className="space-y-3"><Banner tone="ok">Thanks, {f.name.split(' ')[0]}. {prov ? PROVINCE_INFO[prov].ptso : 'Boxing Canada'} will be in touch.</Banner>{link && <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-maple bg-maple px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Continue to Trackie registration ↗</a>}</div>
        : <div className="space-y-3">
          {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
          <Field label="Full name" required><input className="field" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} autoComplete="name" /></Field>
          <Field label="Email" required><input type="email" className="field" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} autoComplete="email" /></Field>
          <Field label="Phone (optional)"><input type="tel" className="field" value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} autoComplete="tel" /></Field>
          {!prov && <p className="text-xs text-warn">Choose your province on the left first.</p>}
          <Field label="I’m interested in"><div className="space-y-1">{INTEREST_AREAS.map(a => <label key={a} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.areas.includes(a)} onChange={() => setF(p => ({ ...p, areas: p.areas.includes(a) ? p.areas.filter(x => x !== a) : [...p.areas, a] }))} />{a}</label>)}</div></Field>
          <Field label="Anything else? (optional)"><textarea rows={2} className="field" value={f.message} onChange={e => setF(p => ({ ...p, message: e.target.value }))} /></Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.consent} onChange={e => setF(p => ({ ...p, consent: e.target.checked }))} /><span>Boxing Canada and my provincial association may contact me about membership.</span></label>
          <Btn variant="primary" className="w-full" onClick={submit}>I’m interested in becoming a member</Btn>
        </div>}
    </Section>
  </div>;
}

function ActivateAccountView({ initialCode, onActivated }) {
  const { data, update } = useApp();
  const [code, setCode] = useState(initialCode || '');
  const [found, setFound] = useState(() => !WP && initialCode ? findInvite(data, initialCode) || null : null);
  const wpCheck = c => wpApi('activate/check', { code: c }).then(res => { setErr(''); setFound(res.member); }).catch(e => { setFound(null); setErr(e.message); });
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [agree, setAgree] = useState(false);
  const [err, setErr] = useState(''); const [lost, setLost] = useState(false); const [lostEmail, setLostEmail] = useState(''); const [lostMsg, setLostMsg] = useState('');
  useEffect(() => { if (WP) { if (initialCode) { setCode(initialCode); wpCheck(initialCode); } return; } if (initialCode) { setCode(initialCode); setFound(findInvite(data, initialCode) || null); if (!findInvite(data, initialCode)) setErr('That activation code isn’t valid or has already been used.'); } }, [initialCode]);
  const check = () => { if (WP) { wpCheck(code.trim()); return; } const u = findInvite(data, code); if (!u) { setFound(null); setErr('That activation code isn’t valid or has already been used.'); return; } if (Date.parse(u.activation.expiresAt) < Date.now()) { setFound(null); setErr('That code has expired. Request a new one below.'); return; } setErr(''); setFound(u); };
  const activate = () => {
    if (pw.length < 8) { setErr('Use a password of at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords don’t match.'); return; }
    if (!agree) { setErr('Accept the Boxing Canada Code of Conduct to continue.'); return; }
    const id = found.id;
    if (WP) { wpApi('activate', { code: code.trim(), password: pw }).then(() => { try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {} window.location.reload(); }).catch(e => setErr(e.message)); return; }
    update(d => { const u = d.users.find(x => x.id === id); u.status = 'approved'; u.password = pw; u.activatedAt = nowIso(); u.activation = { ...u.activation, usedAt: nowIso() }; markInterestJoined(d, u.email); notifyUsers(d, 'role:nsoadmin', `${fullName(u)} activated their portal account.`, 'USERS'); });
    try { if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
    onActivated(id);
  };
  const resend = () => {
    const email = lostEmail.trim().toLowerCase(); if (!email) return;
    if (WP) { wpApi('activate/resend', { email }).then(r => setLostMsg(r.message)).catch(e => setErr(e.message)); return; }
    update(d => { const u = d.users.find(x => (x.status === 'invited' || x.status === 'lapsed') && x.email.toLowerCase() === email); if (u) { u.status = 'invited'; queueActivation(d, u); } });
    setLostMsg('If that email belongs to a new member, a fresh activation code is on its way. Check your inbox and spam folder.');
  };
  return <div className="mx-auto max-w-lg">
    <Section logo title="Activate My Account" sub="For new Boxing Canada members. Use the code from your welcome email.">
      {err && <Banner tone="bad" className="mb-3" onClose={() => setErr('')}>{err}</Banner>}
      {!found ? <div className="space-y-3">
        <Field label="Activation code"><input className="field font-mono text-lg uppercase tracking-widest" value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && check()} placeholder="XXXXXXXX" autoComplete="one-time-code" /></Field>
        <Btn variant="primary" className="w-full" onClick={check}>Continue</Btn>
        <button type="button" className="text-sm font-semibold text-rope" onClick={() => setLost(l => !l)}>Lost your code?</button>
        {lost && <div className="space-y-2 rounded-md border border-line p-3">{lostMsg ? <Banner tone="info">{lostMsg}</Banner> : <><Field label="The email you registered with on Trackie"><input type="email" className="field" value={lostEmail} onChange={e => setLostEmail(e.target.value)} /></Field><Btn size="sm" onClick={resend}>Send a new code</Btn></>}</div>}
      </div> : <div className="space-y-3">
        <Banner tone="ok">Welcome, {found.firstName}! Membership {found.membershipId} ({ROLES[found.role].label}, {PROVINCE_INFO[found.province].name}) is ready to activate for {maskEmail(found.email)}.</Banner>
        <Field label="Create a password" required><input type="password" className="field" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <Field label="Confirm password" required><input type="password" className="field" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>I agree to the Boxing Canada Code of Conduct & Ethics and to use this portal for my own membership only.</span></label>
        <Btn variant="primary" className="w-full" onClick={activate}>Activate & sign in</Btn>
        <button type="button" className="text-xs font-semibold text-muted" onClick={() => { setFound(null); setPw(''); setPw2(''); }}>Use a different code</button>
      </div>}
    </Section>
  </div>;
}

function PublicPortal({ data, onSignIn, onRegister, tab, setTab, activationCode, guardianCode }) {
  const liveToday = publicLivestreams(data).some(x => x.days === 0);
  const tabs = [['signin', 'Member Sign In'], ['live', liveToday ? '🔴 Livestreams' : 'Livestreams'], ['docs', 'Public Documents'], ['calendar', 'Events Calendar'], ['orgs', 'Boxing Canada & PTSOs'], ['join', 'Become a Member'], ['activate', 'Activate My Account'], ['guardian', 'Parents & Guardians'], ['safesport', 'Safe Sport']];
  const nav = <nav className="border-b border-line bg-surface" aria-label="Public sections"><div className="pt-2 md:pt-0"><MobileSectionMenu items={tabs.map(([k, l]) => ({ key: k, label: l }))} current={tab} onPick={setTab} /></div><div className="mx-auto hidden max-w-6xl flex-wrap gap-x-1 px-4 md:flex">{tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} className={cx('-mb-px whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm font-semibold', tab === k ? 'border-maple text-ink' : 'border-transparent text-muted hover:text-ink')}>{l}</button>)}</div></nav>;
  const body = tab === 'safesport' ? <SafeSportView /> : tab === 'guardian' ? <GuardianView initialCode={guardianCode} /> : tab === 'live' ? <PublicLivestreamsView /> : tab === 'orgs' ? <OrgDirectoryView /> : tab === 'docs' ? <PublicDocsView /> : tab === 'calendar' ? <CalendarView /> : tab === 'join' ? <PublicJoinView onActivate={() => setTab('activate')} /> : tab === 'activate' ? <ActivateAccountView initialCode={activationCode} onActivated={onSignIn} /> : null;
  const strip = tab === 'signin' && publicLivestreams(data).length > 0 ? <section className="border-b border-line bg-sunk" aria-label="Upcoming livestreams"><div className="mx-auto max-w-6xl px-4 py-4"><div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-bold">📺 Upcoming livestreams</h2><button type="button" className="text-sm font-semibold text-rope" onClick={() => setTab('live')}>See all livestreams ›</button></div><LivestreamCards compact /></div></section> : null;
  return <AuthPortalView users={data.users} onSignIn={onSignIn} onRegister={onRegister} nav={<>{nav}{strip}</>}>{body && <main className="mx-auto max-w-6xl px-4 py-6">{body}</main>}</AuthPortalView>;
}

function PublicAccessAdmin() {
  const { data, update, viewer, notify, openActivation, openGuardian } = useApp();
  const nso = viewer.role === 'nsoadmin';
  const [tab, setTab] = useState('links');
  const ml = data.membershipLinks || { national: {}, provinces: {} };
  const provs = nso ? PROVINCE_CODES : [viewer.province];
  const setLink = (scope, k, v) => update(d => { d.membershipLinks = d.membershipLinks || { national: {}, provinces: {} }; if (scope === 'national') d.membershipLinks.national = { ...(d.membershipLinks.national || {}), [k]: v }; else { d.membershipLinks.provinces = d.membershipLinks.provinces || {}; d.membershipLinks.provinces[scope] = { ...(d.membershipLinks.provinces[scope] || {}), [k]: v }; } });
  const interests = (data.interests || []).filter(i => nso || i.province === viewer.province);
  const outbox = (data.outbox || []).filter(m => { const u = getUser(data, m.userId); return nso || (u && u.province === viewer.province); });
  const invited = data.users.filter(u => u.status === 'invited' && (nso || u.province === viewer.province)).sort((a, b) => ((a.activation || {}).createdAt || '').localeCompare((b.activation || {}).createdAt || ''));
  const lapsed = data.users.filter(u => u.status === 'lapsed' && (nso || u.province === viewer.province));
  const expired = invited.filter(isExpiredInvite);
  const [aq, setAq] = useState(''); const [af, setAf] = useState('all'); const [limit, setLimit] = useState(25);
  const [confirmDel, setConfirmDel] = useState(null); const [bulkLapse, setBulkLapse] = useState(false);
  const aterm = aq.trim().toLowerCase();
  const waitShown = invited.filter(u => (af === 'all' || (af === 'expired' ? isExpiredInvite(u) : !isExpiredInvite(u))) && (!aterm || (fullName(u) + ' ' + u.email + ' ' + u.membershipId).toLowerCase().includes(aterm)));
  const newCount = interests.filter(i => i.status === 'new').length;
  const LinkRow = ({ scope, label, val }) => <tr><Td className="font-semibold whitespace-nowrap">{label}</Td>
    <Td><input className="field min-w-[220px] py-1.5" placeholder="https://… (Trackie registration page)" defaultValue={val.url || ''} onBlur={e => e.target.value !== (val.url || '') && setLink(scope, 'url', e.target.value.trim())} aria-label={`${label} link`} /></Td>
    <Td><input className="field min-w-[180px] py-1.5" placeholder="Button text" defaultValue={val.label || ''} onBlur={e => e.target.value !== (val.label || '') && setLink(scope, 'label', e.target.value)} aria-label={`${label} button text`} /></Td>
    <Td><input className="field min-w-[220px] py-1.5" placeholder="Short note shown to the public" defaultValue={val.note || ''} onBlur={e => e.target.value !== (val.note || '') && setLink(scope, 'note', e.target.value)} aria-label={`${label} note`} /></Td>
    <Td>{val.url ? <a href={val.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-rope">Test ↗</a> : <span className="text-xs text-muted">{scope === 'national' ? 'Not set' : 'Uses national link'}</span>}</Td></tr>;
  return <Section logo title="Membership Set-up" sub="What non-members see, who has asked to join, and activation of new members' portal accounts.">
    <div className="mb-3 flex flex-wrap gap-1">{[['links', 'Trackie sign-up links'], ['interest', `Membership interest (${newCount} new)`], ['activation', `Account activation (${invited.length} waiting)`]].map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={cx('rounded-md border px-3 py-1 text-xs font-semibold', tab === k ? 'border-rope bg-ropesoft text-rope' : 'border-line text-muted hover:bg-sunk')}>{l}</button>)}</div>
    {tab === 'links' && <>
      <p className="mb-2 max-w-prose text-sm text-muted">The public “Become a Member” page sends visitors to their province’s Trackie registration page, or to the national one if their province has none. Changes save when you leave a field.</p>
      <Table head={['Applies to', 'Trackie link', 'Button text', 'Note for the public', '']}>
        {nso ? <LinkRow scope="national" label="Boxing Canada (national)" val={ml.national || {}} /> : <tr><Td className="font-semibold">Boxing Canada (national)</Td><Td colSpan={4} className="text-sm text-muted">{(ml.national || {}).url || 'Not set'} (set by Boxing Canada)</Td></tr>}
        {provs.map(c => <LinkRow key={c} scope={c} label={PROVINCE_INFO[c].ptso} val={(ml.provinces || {})[c] || {}} />)}
      </Table>
    </>}
    {tab === 'interest' && <Table head={['Received', 'Name', 'Contact', 'Province', 'Interested in', 'Status']} isEmpty={!interests.length} empty="No one has asked about membership yet.">
      {interests.map(i => <tr key={i.id} className={i.status === 'new' ? 'bg-warnsoft' : ''}>
        <Td className="whitespace-nowrap text-xs">{fmtStamp(i.at)}</Td><Td className="font-semibold">{i.name}{i.message && <div className="max-w-xs text-xs font-normal text-muted">{i.message}</div>}</Td>
        <Td className="text-xs">{i.email}{i.phone && <div>{i.phone}</div>}</Td><Td>{i.province}</Td><Td className="text-xs">{i.areas.join(', ') || '—'}</Td>
        <Td><select className="field w-auto py-1 text-xs" value={i.status} onChange={e => update(d => { d.interests.find(x => x.id === i.id).status = e.target.value; })} aria-label="Status">{Object.entries(INTEREST_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></Td>
      </tr>)}
    </Table>}
    {tab === 'activation' && <div className="space-y-3">
      <p className="max-w-prose text-sm text-muted">New members found in a Trackie import get a portal account in “invited” state and an activation email with a one-time code (valid 14 days). The member opens the link or enters the code, sets a password, and is signed in. Emails below are shown as they would be sent; in production the server sends them automatically.</p>
      <p className="max-w-prose text-sm text-muted">To keep this list short, move people who haven’t responded to <b>lapsed</b>: they leave the waiting list and stop getting emails, but they stay members. If they come back later, “Lost your code?” on the public Activate page sends them a fresh code, or you can re-invite them below. Deleting removes the portal account entirely; it’s recreated as a new invitation if they appear in a later Trackie import.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="field max-w-xs" placeholder="Search name or email" value={aq} onChange={e => { setAq(e.target.value); setLimit(25); }} aria-label="Search waiting activations" />
        <select className="field w-auto" value={af} onChange={e => { setAf(e.target.value); setLimit(25); }} aria-label="Filter"><option value="all">All waiting ({invited.length})</option><option value="expired">Code expired ({expired.length})</option><option value="live">Code still valid ({invited.length - expired.length})</option></select>
        {expired.length > 0 && <><Btn size="sm" onClick={() => { update(d => expired.forEach(u => queueActivation(d, d.users.find(x => x.id === u.id)))); notify(`New activation emails queued for ${expired.length} member${expired.length === 1 ? '' : 's'}.`); }}>Resend to all expired ({expired.length})</Btn>
          {bulkLapse ? <span className="inline-flex items-center gap-1 rounded-md border border-warn bg-warnsoft px-2 py-1 text-xs font-semibold text-warn">Move {expired.length} to lapsed?<Btn size="xs" variant="danger" onClick={() => { update(d => expired.forEach(u => lapseInvite(d.users.find(x => x.id === u.id), viewer.id))); notify(`${expired.length} expired invitation${expired.length === 1 ? '' : 's'} moved to lapsed.`, 'info'); setBulkLapse(false); }}>Yes</Btn><Btn size="xs" onClick={() => setBulkLapse(false)}>No</Btn></span>
            : <Btn size="sm" variant="ghost" onClick={() => setBulkLapse(true)}>Move all expired to lapsed</Btn>}</>}
      </div>
      <Table head={['Member', 'Email', 'Invited', 'Code', '']} isEmpty={!waitShown.length} empty={invited.length ? 'No one matches.' : 'Everyone imported from Trackie has activated their account.'}>
        {waitShown.slice(0, limit).map(u => { const ex = isExpiredInvite(u); return <tr key={u.id}>
          <Td className="font-semibold">{fullName(u)}<div className="text-xs font-normal text-muted">{u.membershipId}, {u.province}</div></Td><Td className="text-xs">{u.email}</Td>
          <Td className="whitespace-nowrap text-xs">{u.activation ? fmtDate(u.activation.createdAt.slice(0, 10)) : '—'}</Td>
          <Td>{u.activation ? <Badge tone={ex ? 'warn' : 'info'}>{ex ? 'Expired ' : 'Valid until '}{fmtDate(u.activation.expiresAt.slice(0, 10))}</Badge> : '—'}</Td>
          <Td className="text-right"><div className="flex flex-wrap justify-end gap-1">
            <Btn size="xs" onClick={() => { update(d => queueActivation(d, d.users.find(x => x.id === u.id))); notify(`New activation email queued for ${fullName(u)}.`); }}>Resend</Btn>
            <Btn size="xs" variant="ghost" onClick={() => { update(d => lapseInvite(d.users.find(x => x.id === u.id), viewer.id)); notify(`${fullName(u)} moved to lapsed.`, 'info'); }}>Move to lapsed</Btn>
            {confirmDel === u.id ? <><Btn size="xs" variant="danger" onClick={() => { update(d => { d.users = d.users.filter(x => x.id !== u.id); d.outbox = (d.outbox || []).filter(m => m.userId !== u.id); }); notify(`${fullName(u)}’s portal account deleted.`, 'warn'); setConfirmDel(null); }}>Confirm delete</Btn><Btn size="xs" onClick={() => setConfirmDel(null)}>Cancel</Btn></> : <Btn size="xs" variant="ghost" onClick={() => setConfirmDel(u.id)}>Delete</Btn>}
          </div></Td></tr>; })}
      </Table>
      {waitShown.length > limit && <div className="text-center"><Btn size="sm" onClick={() => setLimit(l => l + 50)}>Show more ({waitShown.length - limit} more)</Btn></div>}
      {lapsed.length > 0 && <details className="rounded-md border border-line">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Lapsed invitations ({lapsed.length})</summary>
        <div className="border-t border-line p-2"><Table head={['Member', 'Email', 'Lapsed', '']}>{lapsed.slice(0, 100).map(u => <tr key={u.id}><Td className="font-semibold">{fullName(u)}<div className="text-xs font-normal text-muted">{u.membershipId}, {u.province}</div></Td><Td className="text-xs">{u.email}</Td><Td className="text-xs">{u.activation && u.activation.lapsedAt ? fmtDate(u.activation.lapsedAt.slice(0, 10)) : '—'}</Td><Td className="text-right"><Btn size="xs" onClick={() => { update(d => { const x = d.users.find(y => y.id === u.id); x.status = 'invited'; queueActivation(d, x); }); notify(`${fullName(u)} re-invited. A new activation email is queued.`); }}>Re-invite</Btn></Td></tr>)}</Table>{lapsed.length > 100 && <p className="px-1 pt-1 text-xs text-muted">Showing the first 100. Search the member directory for others.</p>}</div>
      </details>}
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-base font-bold">Email outbox</h4>{outbox.length > 0 && <Btn size="xs" variant="ghost" onClick={() => { const before = (data.outbox || []).length; update(d => { d.outbox = (d.outbox || []).filter(m => { const u = d.users.find(x => x.id === m.userId); return u && u.status === 'invited' && u.activation && u.activation.code === m.code; }); }); notify('Old and superseded emails cleared from the outbox.', 'info'); }}>Clear emails that are no longer active</Btn>}</div>
      <div className="space-y-2">{outbox.slice(0, 8).map(m => { const u = getUser(data, m.userId); const isG = m.kind === 'guardian'; const live = isG ? (data.guardianCodes || []).some(g => g.code === m.code && Date.parse(g.expiresAt) > Date.now()) : u && u.status === 'invited' && u.activation && u.activation.code === m.code; return <details key={m.id} className="rounded-md border border-line">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm"><span className="font-semibold">{m.subject}</span><span className="text-xs text-muted">to {m.to}, {fmtStamp(m.at)}</span><Badge tone={live ? 'info' : 'neutral'} className="ml-auto">{live ? 'Code active' : u && u.status === 'approved' ? 'Activated' : 'Superseded'}</Badge></summary>
        <pre className="whitespace-pre-wrap border-t border-line bg-sunk px-3 py-2 font-sans text-xs">{m.body}</pre>
        {live && <div className="flex justify-end gap-2 border-t border-line px-3 py-2">{isG ? <Btn size="sm" variant="rope" onClick={() => openGuardian(m.code)}>Open parent/guardian link (signs you out)</Btn> : <Btn size="sm" variant="rope" onClick={() => openActivation(m.code)}>Open activation link (signs you out)</Btn>}</div>}
      </details>; })}{!outbox.length && <p className="text-sm text-muted">No emails yet.</p>}{outbox.length > 8 && <p className="text-xs text-muted">Showing the 8 most recent of {outbox.length} emails.</p>}</div>
    </div>}
  </Section>;
}

/* =========================================================
   Organization information pages (NSO and each PTSO)
   Visible to every signed-in user and to the public.
   Edited by the NSO Administrator (Boxing Canada page) and
   each PTSO Administrator (their own association's page).
   Each person's email and phone can be hidden from the public.
   ========================================================= */
const ORG_SECTION_TYPES = { board: 'Board', committee: 'Committee', staff: 'Staff', other: 'Other' };
const normUrl = u => !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/+/, '');
const orgName = code => code === 'NSO' ? 'Boxing Canada' : PROVINCE_INFO[code].ptso;
const isPresident = p => /president|présidente?/i.test(p.title || '') && !/vice/i.test(p.title || '');
const P = (name, title, email, phone, publicContact, note) => ({ id: uid('pp'), name, title, email: email || '', phone: phone || '', publicContact: publicContact !== false, note: note || '' });
const S = (type, title, people) => ({ id: uid('os'), type, title, people });
function blankOrg(code) { return { name: orgName(code), about: '', website: '', email: '', phone: '', address: '', links: [], sections: [S('board', 'Board of Directors', [P('', 'President')]), S('staff', 'Staff', [])] }; }
function makeOrgProfiles() {
  return {
    NSO: { name: 'Boxing Canada', about: 'Boxing Canada is the national sport organization for Olympic-style boxing in Canada. It sanctions national competitions, selects and supports the national team, certifies coaches and officials with the provincial and territorial associations, and sets safety and Safe Sport standards for the sport.', website: 'https://www.boxingcanada.example', email: 'info@boxingcanada.example', phone: '613-555-0100', address: 'Ottawa, Ontario', links: [{ label: 'Safe Sport reporting', url: 'https://www.boxingcanada.example/safe-sport' }, { label: 'Become a member on Trackie', url: 'https://www.trackie.com' }],
      sections: [
        S('board', 'Board of Directors', [P('Danielle Moreau', 'President', 'president@boxingcanada.example', '', true), P('Andrew Kim', 'Vice-President', 'board@boxingcanada.example'), P('Ruth Okonkwo', 'Treasurer', 'board@boxingcanada.example'), P('Luc Gagnon', 'Secretary', 'board@boxingcanada.example'), P('Tasha Whitehorse', 'Athlete Representative', 'athletes@boxingcanada.example')]),
        S('committee', 'High Performance Committee', [P('Andrew Kim', 'Chair', 'hp@boxingcanada.example'), P('Sarah Lin', 'Coach representative', '', '', false)]),
        S('committee', 'Medical Committee', [P('Dr. Elena Rostova', 'Chair', 'medical@boxingcanada.example')]),
        S('committee', 'Officials Committee', [P('Jean-Luc Picard', 'Chair', 'officials@boxingcanada.example')]),
        S('staff', 'Staff', [P('Philippe St-Laurent', 'Executive Director', 'philippe.stlaurent@example.ca', '613-555-0101'), P('Hannah Becker', 'National Coaching Manager', 'coaching@boxingcanada.example', '613-555-0102'), P('Omar Haddad', 'Membership & Events Coordinator', 'membership@boxingcanada.example', '613-555-0103')])
      ], updatedAt: '2026-10-20T10:00:00', updatedBy: 'u-s1' },
    ON: { name: 'Boxing Ontario', about: 'Boxing Ontario is the provincial sport organization for Olympic-style boxing in Ontario, sanctioning club shows and provincial championships and supporting clubs, coaches and officials across the province.', website: 'https://www.boxingontario.example', email: 'info@boxingontario.example', phone: '416-555-0140', address: 'Toronto, Ontario', links: [{ label: 'Ontario club finder', url: 'https://www.boxingontario.example/clubs' }],
      sections: [
        S('board', 'Board of Directors', [P('Michael Grant', 'President', 'president@boxingontario.example'), P('Anita Persaud', 'Vice-President'), P('Kwame Mensah', 'Treasurer'), P('Lisa Tremblay', 'Director, Eastern Region')]),
        S('committee', 'Officials Committee', [P('Grace Okafor', 'Chair', 'officials@boxingontario.example')]),
        S('committee', 'Competition Committee', [P('Marc Bélanger', 'Member', '', '', false), P('Priya Shah', 'Member', '', '', false)]),
        S('staff', 'Staff', [P('Claire Vance', 'Executive Director', 'claire.vance@example.ca', '416-555-0141'), P('Daniel Wu', 'Sanctions & Events Coordinator', 'sanctions@boxingontario.example', '416-555-0142')])
      ], updatedAt: '2026-10-18T10:00:00', updatedBy: 'u-p1' },
    QC: { name: 'FQBO / Boxing Québec', about: 'Fédération québécoise de boxe olympique : la fédération provinciale de la boxe olympique au Québec.', website: 'https://www.boxingquebec.example', email: 'info@boxingquebec.example', phone: '514-555-0160', address: 'Montréal, Québec', links: [],
      sections: [S('board', 'Conseil d’administration', [P('Isabelle Fortin', 'Présidente', 'presidence@boxingquebec.example')]), S('staff', 'Personnel', [P('Nathalie Gagné', 'Directrice générale', 'direction@boxingquebec.example', '514-555-0161')])], updatedAt: '2026-10-10T10:00:00', updatedBy: null }
  };
}
function upgradeTo13(d) { if (!d.orgProfiles) d.orgProfiles = makeOrgProfiles(); d.version = 13; return d; }

function OrgPersonCard({ p, showContact, featured }) {
  return <div className={cx('rounded-md border p-3', featured ? 'border-maple bg-maplesoft' : 'border-line bg-surface')}>
    <div className="font-semibold leading-tight">{p.name || <span className="text-muted">Vacant</span>}</div>
    {p.title && <div className={cx('text-sm', featured ? 'font-semibold text-maple' : 'text-muted')}>{p.title}</div>}
    {p.note && <p className="mt-1 text-xs text-muted">{p.note}</p>}
    {showContact ? <div className="mt-1.5 space-y-0.5 text-sm">{p.email && <a className="block break-all text-rope hover:underline" href={'mailto:' + p.email}>{p.email}</a>}{p.phone && <a className="block text-rope hover:underline" href={'tel:' + p.phone.replace(/[^\d+]/g, '')}>{p.phone}</a>}</div>
      : (p.email || p.phone) ? <div className="mt-1.5 text-xs text-muted">Contact through the office.</div> : null}
  </div>;
}
function OrgProfileView({ code, onEdit, canEdit }) {
  const { data, viewer } = useApp();
  const prof = (data.orgProfiles || {})[code];
  const pub = viewer.role === 'public';
  const showC = p => !pub || p.publicContact;
  const logoUrl = code === 'NSO' ? null : logoFor(data, code, 'ptso_white_red').url;
  if (!prof) return <Section title={orgName(code)} actions={canEdit && <Btn variant="primary" onClick={onEdit}>Add information</Btn>}><p className="text-sm text-muted">{orgName(code)} hasn’t published its information here yet.{!pub && code !== 'NSO' ? ` Contact: ${PROVINCE_INFO[code].email}` : ''}</p></Section>;
  const president = prof.sections.filter(s => s.type === 'board').flatMap(s => s.people).find(isPresident);
  const groups = ['board', 'committee', 'staff', 'other'];
  return <div className="space-y-4">
    <header className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="rope-rule" />
      <div className="flex flex-wrap items-start gap-4 p-4">
        {code === 'NSO' ? <BoxingCanadaLogo size="lg" /> : <img src={logoUrl} alt={`${prof.name} logo`} className="h-14 w-36 shrink-0 rounded border border-line bg-white object-contain" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">{code === 'NSO' ? 'National Sport Organization' : `Provincial/Territorial Sport Organization · ${PROVINCE_INFO[code].name}`}</p>
          <h2 className="font-display text-3xl font-extrabold leading-tight">{prof.name}</h2>
          {prof.about && <p className="mt-1 max-w-prose text-sm">{prof.about}</p>}
        </div>
        {canEdit && <Btn variant="primary" onClick={onEdit}>Edit this page</Btn>}
      </div>
      <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {[['Website', prof.website && <a href={normUrl(prof.website)} target="_blank" rel="noopener noreferrer" className="break-all text-rope hover:underline">{prof.website.replace(/^https?:\/\//, '')} ↗</a>], ['Email', prof.email && <a href={'mailto:' + prof.email} className="break-all text-rope hover:underline">{prof.email}</a>], ['Phone', prof.phone && <a href={'tel:' + prof.phone.replace(/[^\d+]/g, '')} className="text-rope hover:underline">{prof.phone}</a>], ['Office', prof.address]].map(([k, v]) => <div key={k} className="bg-surface px-4 py-2.5"><div className="text-xs text-muted">{k}</div><div className="text-sm font-semibold">{v || '—'}</div></div>)}
      </div>
      {(prof.links || []).length > 0 && <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2.5">{prof.links.filter(l => l.url).map((l, i) => <a key={i} href={normUrl(l.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-rope hover:bg-sunk">{l.label || l.url} ↗</a>)}</div>}
    </header>
    {president && president.name && <div className="max-w-sm"><OrgPersonCard p={president} showContact={showC(president)} featured /></div>}
    {groups.map(g => { const secs = prof.sections.filter(s => s.type === g && s.people.length); if (!secs.length) return null; return <Section key={g} title={g === 'board' ? 'Board' : g === 'committee' ? 'Committees' : g === 'staff' ? 'Staff' : 'More'}>
      <div className="space-y-4">{secs.map(s => <div key={s.id}>{(secs.length > 1 || g === 'committee') && <h4 className="mb-2 font-display text-base font-bold">{s.title}</h4>}<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{s.people.map(p => <OrgPersonCard key={p.id} p={p} showContact={showC(p)} />)}</div></div>)}</div>
    </Section>; })}
    <p className="text-xs text-muted">Last updated {fmtStamp(prof.updatedAt)}{prof.updatedBy && !pub ? ` by ${nameOf(data, prof.updatedBy)}` : ''}.</p>
  </div>;
}
function OrgEditorModal({ code, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const [o, setO] = useState(() => structuredClone((data.orgProfiles || {})[code] || blankOrg(code)));
  const set = (k, v) => setO(p => ({ ...p, [k]: v }));
  const setSec = (si, fn) => setO(p => { const n = structuredClone(p); fn(n.sections[si], n); return n; });
  const moveSec = (si, dir) => setO(p => { const n = structuredClone(p); const j = si + dir; if (j < 0 || j >= n.sections.length) return p; [n.sections[si], n.sections[j]] = [n.sections[j], n.sections[si]]; return n; });
  const save = () => {
    const clean = { ...o, website: o.website ? normUrl(o.website.trim()) : '', links: (o.links || []).filter(l => l.url.trim()).map(l => ({ label: l.label.trim(), url: normUrl(l.url.trim()) })), sections: o.sections.map(s => ({ ...s, people: s.people.filter(p => p.name.trim() || p.title.trim()) })), updatedAt: nowIso(), updatedBy: viewer.id };
    update(d => { d.orgProfiles = d.orgProfiles || {}; d.orgProfiles[code] = clean; });
    notify(`${o.name} page updated. It’s visible to members and the public.`); onClose();
  };
  return <Modal size="full" title={`Edit ${orgName(code)} Page`} subtitle="Shown to every member and on the public site. Untick “Public contact” to hide a person’s email and phone from non-members." onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>Save & publish</Btn></>}>
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Organization name" className="sm:col-span-2"><input className="field" value={o.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="About" className="sm:col-span-2"><textarea rows={3} className="field" value={o.about} onChange={e => set('about', e.target.value)} /></Field>
        <Field label="Website"><input className="field" placeholder="https://" value={o.website} onChange={e => set('website', e.target.value)} /></Field>
        <Field label="General email"><input type="email" className="field" value={o.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="General phone"><input type="tel" className="field" value={o.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Office location or mailing address"><input className="field" value={o.address} onChange={e => set('address', e.target.value)} /></Field>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between"><h4 className="font-display text-lg font-bold">External links</h4><Btn size="sm" onClick={() => set('links', [...(o.links || []), { label: '', url: '' }])}>Add link</Btn></div>
        <div className="space-y-1.5">{(o.links || []).map((l, i) => <div key={i} className="flex flex-wrap gap-2"><input className="field max-w-xs py-1.5" placeholder="Label, e.g. Facebook" value={l.label} onChange={e => set('links', o.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /><input className="field min-w-[220px] flex-1 py-1.5" placeholder="https://" value={l.url} onChange={e => set('links', o.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} /><Btn size="sm" variant="ghost" onClick={() => set('links', o.links.filter((_, j) => j !== i))}>Remove</Btn></div>)}{!(o.links || []).length && <p className="text-sm text-muted">Social media, registration pages, rulebooks…</p>}</div>
      </section>
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-display text-lg font-bold">People</h4><div className="flex flex-wrap gap-1.5">{Object.entries(ORG_SECTION_TYPES).map(([k, l]) => <Btn key={k} size="sm" onClick={() => set('sections', [...o.sections, S(k, k === 'board' ? 'Board of Directors' : k === 'committee' ? 'New committee' : k === 'staff' ? 'Staff' : 'New group', [])])}>Add {l.toLowerCase()} group</Btn>)}</div></div>
        <p className="mb-2 text-xs text-muted">Give the president the title “President” in a board group and they’ll be featured at the top of the page.</p>
        <div className="space-y-3">{o.sections.map((s, si) => <div key={s.id} className="rounded-md border border-line">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-sunk px-3 py-2">
            <select className="field w-auto py-1 text-xs" value={s.type} onChange={e => setSec(si, x => { x.type = e.target.value; })} aria-label="Group type">{Object.entries(ORG_SECTION_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input className="field max-w-sm flex-1 py-1 font-semibold" value={s.title} onChange={e => setSec(si, x => { x.title = e.target.value; })} aria-label="Group title" />
            <span className="ml-auto flex gap-1"><Btn size="xs" variant="ghost" disabled={si === 0} onClick={() => moveSec(si, -1)} aria-label="Move group up">↑</Btn><Btn size="xs" variant="ghost" disabled={si === o.sections.length - 1} onClick={() => moveSec(si, 1)} aria-label="Move group down">↓</Btn><Btn size="xs" variant="ghost" onClick={() => setO(p => ({ ...p, sections: p.sections.filter((_, j) => j !== si) }))}>Remove group</Btn></span>
          </div>
          <div className="divide-y divide-line">{s.people.map((p, pi) => { const sp = (k, v) => setSec(si, x => { x.people[pi][k] = v; }); return <div key={p.id} className="grid gap-2 px-3 py-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1.3fr_1fr_auto]">
            <input className="field py-1.5" placeholder="Name" value={p.name} onChange={e => sp('name', e.target.value)} aria-label="Name" />
            <input className="field py-1.5" placeholder="Title or role" value={p.title} onChange={e => sp('title', e.target.value)} aria-label="Title" />
            <input type="email" className="field py-1.5" placeholder="Email" value={p.email} onChange={e => sp('email', e.target.value)} aria-label="Email" />
            <input type="tel" className="field py-1.5" placeholder="Phone" value={p.phone} onChange={e => sp('phone', e.target.value)} aria-label="Phone" />
            <div className="flex items-center gap-1"><label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold"><input type="checkbox" className="h-4 w-4" checked={p.publicContact} onChange={e => sp('publicContact', e.target.checked)} />Public contact</label>
              <Btn size="xs" variant="ghost" disabled={pi === 0} onClick={() => setSec(si, x => { [x.people[pi - 1], x.people[pi]] = [x.people[pi], x.people[pi - 1]]; })} aria-label="Move up">↑</Btn><Btn size="xs" variant="ghost" onClick={() => setSec(si, x => { x.people.splice(pi, 1); })} aria-label={`Remove ${p.name || 'person'}`}>✕</Btn></div>
          </div>; })}</div>
          <div className="px-3 py-2"><Btn size="sm" variant="ghost" onClick={() => setSec(si, x => { x.people.push(P('', '')); })}>Add person</Btn></div>
        </div>)}</div>
      </section>
    </div>
  </Modal>;
}
function OrgDirectoryView() {
  const { data, viewer } = useApp();
  const [sel, setSel] = useState(viewer.role === 'nsoadmin' || viewer.role === 'public' || !viewer.province ? 'NSO' : viewer.province);
  const [edit, setEdit] = useState(false);
  const canEdit = code => viewer.role === 'nsoadmin' || (viewer.role === 'ptso' && viewer.province === code);
  const has = code => !!(data.orgProfiles || {})[code];
  const codes = ['NSO', ...PROVINCE_CODES];
  return <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
    <nav aria-label="Organizations" className="lg:sticky lg:top-28">
      <select className="field lg:hidden" value={sel} onChange={e => setSel(e.target.value)} aria-label="Organization">{codes.map(c => <option key={c} value={c}>{orgName(c)}</option>)}</select>
      <ul className="hidden overflow-hidden rounded-lg border border-line bg-surface lg:block">{codes.map(c => <li key={c}><button type="button" onClick={() => setSel(c)} aria-current={sel === c ? 'page' : undefined} className={cx('flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left text-sm', sel === c ? 'border-maple bg-maplesoft font-semibold' : 'border-transparent hover:bg-sunk', c === 'NSO' && 'border-b border-b-line')}>
        <span className="w-8 shrink-0 text-xs font-bold text-muted">{c === 'NSO' ? '🍁' : c}</span><span className="min-w-0 flex-1 truncate">{orgName(c)}</span>{!has(c) && <span className="text-[10px] text-muted">empty</span>}{canEdit(c) && <Badge tone="info">yours</Badge>}</button></li>)}</ul>
    </nav>
    <div className="min-w-0"><OrgProfileView key={sel} code={sel} canEdit={canEdit(sel)} onEdit={() => setEdit(true)} /></div>
    {edit && <OrgEditorModal code={sel} onClose={() => setEdit(false)} />}
  </div>;
}

/* ---------- NSO: edit any member's portal account ---------- */
function EditUserModal({ userId, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const orig = getUser(data, userId);
  const [f, setF] = useState(() => ({ ...orig, selectedCoachIds: (orig.selectedCoachIds || []).slice(), newPassword: '' }));
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const self = orig.id === viewer.id;
  const coaches = data.users.filter(u => u.role === 'coach' && u.status === 'approved');
  const save = () => {
    if (!f.firstName.trim() || !f.lastName.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { setErr('Name and a valid email are required.'); return; }
    if (data.users.some(u => u.id !== orig.id && u.email.toLowerCase() === f.email.trim().toLowerCase())) { setErr('Another member already uses that email.'); return; }
    if (data.users.some(u => u.id !== orig.id && u.membershipId === f.membershipId.trim())) { setErr('Another member already has that membership ID.'); return; }
    if (self && (f.role !== 'nsoadmin' || f.status !== 'approved')) { setErr('You can’t remove your own NSO Administrator access. Ask another NSO Administrator.'); return; }
    if (f.newPassword && f.newPassword.length < 8) { setErr('New passwords need at least 8 characters.'); return; }
    update(d => {
      const u = d.users.find(x => x.id === orig.id);
      ['firstName', 'lastName', 'email', 'membershipId', 'role', 'province', 'club', 'dob', 'gender', 'status', 'nccp', 'license', 'phone'].forEach(k => { u[k] = typeof f[k] === 'string' ? f[k].trim() : f[k]; });
      if (f.role === 'boxer') { const before = u.selectedCoachIds || [], after = f.selectedCoachIds || []; after.filter(id => !before.includes(id)).forEach(id => logCoach(d, u.id, id, 'added', 'Administrator change (Edit account)', viewer.id, fullName(viewer))); before.filter(id => !after.includes(id)).forEach(id => logCoach(d, u.id, id, 'removed', 'Administrator change (Edit account)', viewer.id, fullName(viewer))); }
      u.selectedCoachIds = f.role === 'boxer' ? f.selectedCoachIds : (u.selectedCoachIds || []);
      const newCerts = Object.fromEntries(Object.entries(f.certs || {}).filter(([, v]) => v));
      Object.keys({ ...(u.certs || {}), ...newCerts }).forEach(pid => { if ((u.certs || {})[pid] !== newCerts[pid]) u.certHistory = [...(u.certHistory || []), { programId: pid, levelId: newCerts[pid] || null, at: nowIso(), by: viewer.id, note: 'Set by NSO Administrator' }]; });
      u.certs = newCerts;
      if (f.newPassword && !WP) u.password = f.newPassword;
      if (u.role === 'medical' && !u.honorific) u.honorific = 'Dr.';
      if (u.status === 'invited' && !u.activation) queueActivation(d, u);
      u.editedBy = viewer.id; u.editedAt = nowIso();
    });
    notify(`${f.firstName} ${f.lastName}’s account updated.`); onClose();
  };
  return <Modal size="lg" title="Edit Member Account" subtitle={`${fullName(orig)}, ${orig.membershipId}. Portal account details; Trackie fields are edited on the membership record.`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>Save changes</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name"><input className="field" value={f.firstName} onChange={e => set('firstName', e.target.value)} /></Field>
        <Field label="Last name"><input className="field" value={f.lastName} onChange={e => set('lastName', e.target.value)} /></Field>
        <Field label="Email"><input type="email" className="field" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Phone"><input type="tel" className="field" value={f.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Boxing Canada membership ID"><input className="field" value={f.membershipId} onChange={e => set('membershipId', e.target.value)} /></Field>
        <Field label="Role"><select className="field" value={f.role} onChange={e => set('role', e.target.value)}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.emoji} {r.label}</option>)}</select></Field>
        <Field label="Province or territory"><select className="field" value={f.province} onChange={e => set('province', e.target.value)}>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></Field>
        <Field label="Account status"><select className="field" value={f.status} onChange={e => set('status', e.target.value)}><option value="approved">Approved (can sign in)</option><option value="invited">Invited (must activate)</option><option value="lapsed">Invitation lapsed</option><option value="pending">Pending approval</option><option value="declined">Declined</option></select></Field>
        <Field label="Date of birth"><input type="date" className="field" value={f.dob} onChange={e => set('dob', e.target.value)} /></Field>
        <Field label="Gender"><select className="field" value={f.gender} onChange={e => set('gender', e.target.value)}><option value="M">Male</option><option value="F">Female</option></select></Field>
        <Field label="Club"><input className="field" value={f.club || ''} onChange={e => set('club', e.target.value)} /></Field>
        {(f.role === 'coach' || f.nccp) && <Field label="NCCP #"><input className="field" value={f.nccp || ''} onChange={e => set('nccp', e.target.value)} /></Field>}
        {f.role === 'medical' && <Field label="Medical license #"><input className="field" value={f.license || ''} onChange={e => set('license', e.target.value)} /></Field>}
        <Field label="Set a new password (optional)" hint="Leave blank to keep the current password."><input type="password" className="field" autoComplete="new-password" value={f.newPassword} onChange={e => set('newPassword', e.target.value)} /></Field>
      </div>
      {(data.programs || []).filter(p => p.kind === f.role).map(p => <Field key={p.id} label={`${p.name}: certified level`} hint="Normally set by an evaluation outcome. Changes are logged."><select className="field max-w-sm" value={(f.certs || {})[p.id] || ''} onChange={e => set('certs', { ...(f.certs || {}), [p.id]: e.target.value })}><option value="">Not certified</option>{p.levels.map(l => <option key={l.id} value={l.id}>{lvName(l)}</option>)}</select></Field>)}
      {f.role === 'boxer' && <Field label="Assigned coaches"><div className="flex flex-wrap gap-2">{coaches.map(c => <label key={c.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.selectedCoachIds.includes(c.id)} onChange={() => set('selectedCoachIds', f.selectedCoachIds.includes(c.id) ? f.selectedCoachIds.filter(x => x !== c.id) : [...f.selectedCoachIds, c.id])} />{fullName(c)} <span className="text-xs text-muted">{c.province}</span></label>)}</div></Field>}
    </div>
  </Modal>;
}

/* =========================================================
   Browser storage meter and full-data backup / restore
   The demo keeps all data in this browser's localStorage
   (about 5 MB). The meter warns before it fills; NSO
   Administrators can export everything to a JSON file and
   restore it in any browser.
   ========================================================= */
const STORAGE_BUDGET = 5000000; // characters; browsers allow roughly 5 MB per site
const BACKUP_APP = 'boxing-canada-portal';
const fmtMB = chars => (chars / 1000000).toFixed(chars < 100000 ? 2 : 1) + ' MB';
function StorageMeter({ store, onOpen }) {
  const pct = Math.min(100, Math.round(store.chars / STORAGE_BUDGET * 100));
  const tone = store.failed || pct >= 90 ? 'bg-maple' : pct >= 75 ? 'bg-warn' : 'bg-ok';
  return <span className="ml-auto flex items-center gap-2" title="Demo data is stored in this browser only">
    <span className="whitespace-nowrap">Browser storage {fmtMB(store.chars)} of about 5 MB</span>
    <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-sunk" aria-hidden="true"><span className={cx('block h-full', tone)} style={{ width: pct + '%' }} /></span>
    {onOpen && <Btn size="xs" variant="ghost" onClick={onOpen}>Data & backup</Btn>}
  </span>;
}
function DataBackupModal({ store, onClose, onReset }) {
  const { data, viewer, notify, restoreData } = useApp();
  const [pending, setPending] = useState(null);
  const [err, setErr] = useState('');
  const parts = [['Members & Trackie records', ['users']], ['Documents (including uploaded files)', ['docs']], ['NCCP transcripts (The Locker)', ['nccp']], ['Events, results & medical records', ['events', 'annualMedicals', 'ringsideExams', 'restPeriodExams', 'preBoutQuestionnaires']], ['Sanctions & travel passes', ['sanctions', 'itps']], ['Calendar, evaluations & everything else', null]];
  const sized = Object.fromEntries(Object.keys(data).map(k => [k, JSON.stringify(data[k] === undefined ? null : data[k]).length]));
  const named = new Set(parts.flatMap(p => p[1] || []));
  const rows = parts.map(([label, keys]) => [label, (keys || Object.keys(sized).filter(k => !named.has(k))).reduce((a, k) => a + (sized[k] || 0), 0)]);
  const exportAll = async () => {
    const payload = JSON.stringify({ app: BACKUP_APP, exportedAt: nowIso(), exportedBy: fullName(viewer), version: data.version, data });
    const r = await saveFile(`boxing-canada-portal-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
    notify(r.ok ? `${r.msg} Keep it somewhere safe: it contains every member’s data.` : r.msg, r.ok ? 'ok' : 'warn');
  };
  const onFile = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; setErr('');
    try {
      const obj = JSON.parse(await f.text());
      if (!obj || obj.app !== BACKUP_APP || !obj.data || !Array.isArray(obj.data.users)) { setErr('That file isn’t a Boxing Canada portal backup.'); return; }
      setPending({ obj, name: f.name, size: f.size });
    } catch (x) { setErr('That file couldn’t be read as a backup.'); }
  };
  const doRestore = () => {
    const ok = restoreData(pending.obj.data);
    if (!ok) { setErr('This browser doesn’t have room for that backup. Free up space or use another browser.'); setPending(null); return; }
    notify(`Restored the backup from ${fmtStamp(pending.obj.exportedAt)}.`); onClose();
  };
  const pct = Math.round(store.chars / STORAGE_BUDGET * 100);
  return <Modal size="lg" title="Data & Backup" subtitle="Everything in this demo is stored in this browser only." onClose={onClose}>
    <div className="space-y-4">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      {store.failed && <Banner tone="bad">The last change couldn’t be saved because browser storage is full. Export a backup now, then remove large uploaded files.</Banner>}
      <section>
        <div className="mb-1 flex items-baseline justify-between"><h4 className="font-display text-lg font-bold">Storage used</h4><span className="text-sm font-semibold tabular-nums">{fmtMB(store.chars)} of about 5 MB ({pct}%)</span></div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-sunk"><div className={cx('h-full', pct >= 90 ? 'bg-maple' : pct >= 75 ? 'bg-warn' : 'bg-ok')} style={{ width: Math.min(100, pct) + '%' }} /></div>
        <Table head={['Data', 'Size']}>{rows.map(([l, n]) => <tr key={l}><Td>{l}</Td><Td className="tabular-nums">{fmtMB(n)}</Td></tr>)}</Table>
        <p className="mt-1 text-xs text-muted">Uploaded document files and Backup Scans take the most room. A production server has no such limit.</p>
      </section>
      <section className="rounded-md border border-line p-3">
        <h4 className="font-display text-lg font-bold">Export a backup</h4>
        <p className="mb-2 max-w-prose text-sm text-muted">Downloads one file with all portal data: members, Trackie and Locker records, events, medical records, documents and settings. Treat it as confidential.</p>
        <Btn variant="primary" onClick={exportAll}>Download backup (.json)</Btn>
      </section>
      <section className="rounded-md border border-line p-3">
        <h4 className="font-display text-lg font-bold">Restore from a backup</h4>
        <p className="mb-2 max-w-prose text-sm text-muted">Replaces everything in this browser with the backup. Older backups are upgraded to the current version automatically.</p>
        {pending ? <Banner tone="warn" action={<><Btn size="sm" onClick={() => setPending(null)}>Cancel</Btn><Btn size="sm" variant="danger" onClick={doRestore}>Replace all data</Btn></>}>Restore “{pending.name}”, exported {fmtStamp(pending.obj.exportedAt)}{pending.obj.exportedBy ? ` by ${pending.obj.exportedBy}` : ''} ({pending.obj.data.users.length} members)? Everything currently in this browser will be replaced.</Banner>
          : <label className="inline-flex cursor-pointer items-center rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-semibold hover:bg-sunk">Choose backup file…<input type="file" accept=".json,application/json" className="hidden" onChange={onFile} /></label>}
      </section>
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3"><div><h4 className="font-display text-base font-bold">Start over</h4><p className="text-sm text-muted">Replace everything with the original demo data.</p></div><Btn variant="danger" onClick={() => { onReset(); onClose(); }}>Reset demo data</Btn></section>
    </div>
  </Modal>;
}

/* =========================================================
   Novice → Open classification
   Boxers start as Novice. A boxer aged 18+ or their coach can
   request Open. With 10 or more bouts in the Record Book the
   move is automatic; with fewer it needs approval from the
   boxer's PTSO Administrator or an NSO Administrator.
   ========================================================= */
const OPEN_BOUTS = 10;
const classOf = u => u.classification || 'novice';
const completedBouts = (d, bid) => boutsOf(d, bid).filter(x => x.result !== 'Scheduled').length;
const declaredBouts = u => { const v = parseInt(trackieOf(u)['TOTAL NUMBER OF OLYMPIC-STYLE OR AMATEUR BOXING BOUTS'], 10); return isNaN(v) ? null : v; };
const canRequestOpen = (v, b) => (v.id === b.id && ageOn(b.dob, REF_DATE) >= 18) || (v.role === 'coach' && (b.selectedCoachIds || []).includes(v.id)) || isAdmin(v);
const canDecideOpen = (v, b) => v.role === 'nsoadmin' || (v.role === 'ptso' && v.province === b.province);
const ClassBadge = ({ u, large }) => classOf(u) === 'open' ? <Badge tone="info" className={large ? 'text-sm' : ''}>Open</Badge> : <Badge tone="neutral" className={large ? 'text-sm' : ''}>Novice</Badge>;
function setClassification(d, boxerId, cls, by, note) {
  const u = d.users.find(x => x.id === boxerId); if (!u) return;
  const from = classOf(u); u.classification = cls;
  u.classHistory = [...(u.classHistory || []), { from, to: cls, at: nowIso(), by, note: note || '' }];
}
function upgradeTo15(d) {
  d.users.forEach(u => { if (u.role === 'boxer' && !u.classification) u.classification = ['u-b1', 'u-b4'].includes(u.id) ? 'open' : 'novice'; });
  if (!d.openRequests) d.openRequests = [{ id: 'or-1', boxerId: 'u-b3', requestedBy: 'u-c1', boutCount: 1, declared: null, reason: 'Ethan has 25 amateur kickboxing bouts and has sparred with Open boxers at our club for two years. Novice opponents at 75 kg are rarely available in Eastern Ontario, so he has had one bout in twelve months. Moving to Open would let him compete regularly and safely against boxers of similar ability.', at: '2026-10-21T19:40:00', status: 'pending' }];
  d.version = 15; return d;
}
function OpenRequestModal({ boxerId, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const b = getUser(data, boxerId);
  const bouts = completedBouts(data, b.id), declared = declaredBouts(b);
  const auto = bouts >= OPEN_BOUTS;
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const submit = () => {
    if (!auto && reason.trim().length < 20) { setErr('Explain why moving to Open is necessary (at least a couple of sentences).'); return; }
    const req = { id: uid('or'), boxerId: b.id, requestedBy: viewer.id, boutCount: bouts, declared, reason: reason.trim(), at: nowIso(), status: auto ? 'auto_approved' : 'pending' };
    update(d => {
      d.openRequests = d.openRequests || []; d.openRequests.unshift(req);
      if (auto) { setClassification(d, b.id, 'open', viewer.id, `Automatic: ${bouts} bouts in the Record Book`); notifyUsers(d, b.id, `You’re now classified as an Open boxer (${bouts} bouts).`, 'DASHBOARD'); }
      else { d.users.filter(u => u.role === 'ptso' && u.province === b.province && u.status === 'approved').forEach(p => notifyUsers(d, p.id, `Novice to Open request: ${fullName(b)} (${bouts} bout${bouts === 1 ? '' : 's'}). Needs your approval.`, 'USERS')); notifyUsers(d, 'role:nsoadmin', `Novice to Open request: ${fullName(b)}, ${b.province} (${bouts} bout${bouts === 1 ? '' : 's'}).`, 'USERS'); }
    });
    notify(auto ? `${fullName(b)} is now Open. ${bouts} bouts meets the ${OPEN_BOUTS}-bout guideline.` : `Request sent to ${PROVINCE_INFO[b.province].ptso} and Boxing Canada for approval.`);
    onClose();
  };
  return <Modal size="md" title="Request Move to Open" subtitle={`${fullName(b)}, ${b.membershipId}, age ${ageOn(b.dob, REF_DATE)}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit}>{auto ? 'Move to Open' : 'Send for approval'}</Btn></>}>
    <div className="space-y-3">
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <div className={cx('rounded-md border-2 p-3 text-center', auto ? 'border-ok bg-oksoft' : 'border-warn bg-warnsoft')}>
        <div className="font-display text-5xl font-extrabold tabular-nums">{bouts}</div>
        <div className="text-sm font-semibold">completed bout{bouts === 1 ? '' : 's'} in the Digital Record Book</div>
        {declared !== null && <div className="text-xs text-muted">{declared} bouts declared on the Trackie registration</div>}
      </div>
      {auto ? <Banner tone="ok">This meets the {OPEN_BOUTS}-bout guideline, so the move to Open is approved automatically. {PROVINCE_INFO[b.province].ptso} is kept informed.</Banner>
        : <Banner tone="warn">Fewer than {OPEN_BOUTS} bouts. The request needs approval from {PROVINCE_INFO[b.province].ptso} or Boxing Canada. Until then {b.firstName} stays Novice.</Banner>}
      <Field label={auto ? 'Notes (optional)' : 'Why is moving to Open necessary?'} required={!auto} hint="Include relevant experience such as other combat sports, sparring, or international bouts not in the Record Book."><textarea rows={5} className="field" value={reason} onChange={e => setReason(e.target.value)} /></Field>
    </div>
  </Modal>;
}
function OpenRequestsSection() {
  const { data, update, viewer, notify } = useApp();
  const [decide, setDecide] = useState(null);
  const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const [recordId, setRecordId] = useState(null);
  const inScope = r => { const b = getUser(data, r.boxerId); return b && (viewer.role === 'nsoadmin' || b.province === viewer.province); };
  const all = (data.openRequests || []).filter(inScope);
  const pending = all.filter(r => r.status === 'pending');
  const recent = all.filter(r => r.status !== 'pending').slice(0, 15);
  const finish = approve => {
    if (!approve && !note.trim()) { setErr('Give a reason so the boxer and coach understand the decision.'); return; }
    const r = decide.r, b = getUser(data, r.boxerId);
    update(d => {
      const x = d.openRequests.find(y => y.id === r.id); Object.assign(x, { status: approve ? 'approved' : 'denied', decidedBy: viewer.id, decidedAt: nowIso(), decisionNote: note.trim() });
      if (approve) setClassification(d, b.id, 'open', viewer.id, `Approved with ${r.boutCount} bouts${note.trim() ? ': ' + note.trim() : ''}`);
      const msg = approve ? `${fullName(b)}’s move to Open was approved.` : `${fullName(b)}’s request to move to Open was not approved${note.trim() ? ': ' + note.trim() : '.'}`;
      [b.id, r.requestedBy].filter((v, i, a) => a.indexOf(v) === i).forEach(id => notifyUsers(d, id, msg, 'DASHBOARD'));
    });
    notify(approve ? `${fullName(b)} is now Open.` : `Request declined. ${b.firstName} stays Novice.`, approve ? 'ok' : 'warn');
    setDecide(null); setNote(''); setErr('');
  };
  if (recordId) return <Section title="Novice to Open requests"><RecordBook boxerId={recordId} onBack={() => setRecordId(null)} backLabel="Back to Members & Approvals" /></Section>;
  return <Section title="Novice to Open requests" sub={`Requests with fewer than ${OPEN_BOUTS} bouts need approval. ${viewer.role === 'ptso' ? `Shows ${PROVINCE_INFO[viewer.province].name} boxers.` : 'Either the boxer’s PTSO or Boxing Canada can decide.'}`} actions={<Badge tone={pending.length ? 'warn' : 'ok'}>{pending.length} waiting</Badge>}>
    {pending.length ? <div className="space-y-3">{pending.map(r => { const b = getUser(data, r.boxerId), now = completedBouts(data, b.id); return <article key={r.id} className="grid gap-3 rounded-md border-2 border-warn p-3 md:grid-cols-[110px_minmax(0,1fr)]">
      <div className="rounded-md bg-warnsoft p-2 text-center"><div className="font-display text-4xl font-extrabold tabular-nums text-warn">{now}</div><div className="text-xs font-semibold">bout{now === 1 ? '' : 's'} in Record Book</div>{r.declared !== null && r.declared !== undefined && <div className="mt-1 text-[11px] text-muted">{r.declared} declared on Trackie</div>}<div className="mt-1 text-[11px] text-muted">Guideline: {OPEN_BOUTS}</div></div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h4 className="font-display text-xl font-bold">{fullName(b)}</h4><ClassBadge u={b} /><Badge>{b.province}</Badge><span className="text-sm text-muted">age {ageOn(b.dob, REF_DATE)}, {b.club || '—'}</span></div>
        <p className="text-xs text-muted">Requested {fmtStamp(r.at)} by {nameOf(data, r.requestedBy)} ({r.requestedBy === b.id ? 'the boxer' : ROLES[(getUser(data, r.requestedBy) || {}).role || 'coach'].label.toLowerCase()})</p>
        <blockquote className="mt-2 rounded-md border-l-4 border-rope bg-sunk px-3 py-2 text-sm">{r.reason || <span className="text-muted">No description given.</span>}</blockquote>
        {decide && decide.r.id === r.id ? <div className="mt-2 space-y-2">{err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}<Field label={decide.approve ? 'Note (optional)' : 'Reason shared with the boxer and coach'} required={!decide.approve}><textarea rows={2} className="field" value={note} onChange={e => setNote(e.target.value)} /></Field><div className="flex justify-end gap-2"><Btn onClick={() => { setDecide(null); setNote(''); setErr(''); }}>Cancel</Btn>{decide.approve ? <Btn variant="ok" onClick={() => finish(true)}>Approve move to Open</Btn> : <Btn variant="danger" onClick={() => finish(false)}>Decline request</Btn>}</div></div>
          : <div className="mt-2 flex flex-wrap justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => setRecordId(b.id)}>Open Record Book</Btn>{canDecideOpen(viewer, b) ? <><Btn size="sm" variant="danger" onClick={() => setDecide({ r, approve: false })}>Decline</Btn><Btn size="sm" variant="ok" onClick={() => setDecide({ r, approve: true })}>Approve</Btn></> : <Badge tone="warn">Awaiting {PROVINCE_INFO[b.province].ptso}</Badge>}</div>}
      </div>
    </article>; })}</div> : <p className="text-sm text-muted">No requests waiting.</p>}
    {recent.length > 0 && <details className="mt-3 rounded-md border border-line"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Recent decisions ({recent.length})</summary><div className="border-t border-line p-2"><Table head={['Boxer', 'Bouts', 'Outcome', 'Decided']}>{recent.map(r => <tr key={r.id}><Td className="font-semibold">{nameOf(data, r.boxerId)}</Td><Td className="tabular-nums">{r.boutCount}</Td><Td><Badge tone={r.status === 'denied' ? 'bad' : 'ok'}>{r.status === 'auto_approved' ? `Automatic (${OPEN_BOUTS}+ bouts)` : r.status === 'approved' ? 'Approved' : 'Declined'}</Badge>{r.decisionNote && <div className="mt-1 max-w-xs text-xs text-muted">{r.decisionNote}</div>}</Td><Td className="text-xs">{r.decidedBy ? `${nameOf(data, r.decidedBy)}, ${fmtStamp(r.decidedAt)}` : fmtStamp(r.at)}</Td></tr>)}</Table></div></details>}
  </Section>;
}

/* SCAT6 tool source (Boxing Canada SCAT6 Online, portal edition). */
const SCAT6_TOOL_HTML = "<div id=\"bc-scat\">\n  <header class=\"bc-head bc-keep\">\n    <h2 class=\"bc-title\" data-i18n=\"title\"><\/h2>\n    <div class=\"bc-lang\" role=\"group\" aria-label=\"Language / Langue\">\n      <button type=\"button\" data-lang=\"en\" lang=\"en\">English<\/button>\n      <button type=\"button\" data-lang=\"fr\" lang=\"fr\">Français<\/button>\n    <\/div>\n  <\/header>\n  <p class=\"bc-intro\" data-i18n=\"intro\"><\/p>\n  <div class=\"bc-alert bc-alert-warn\" role=\"note\" data-i18n-html=\"disclaimer\"><\/div>\n  <section class=\"bc-sec bc-sec-red\" aria-labelledby=\"bc-h1\">\n    <h3 class=\"bc-h\" id=\"bc-h1\"><span class=\"bc-num\" aria-hidden=\"true\">1<\/span><span data-i18n=\"s1\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s1Help\"><\/p>\n    <div class=\"bc-checks\" id=\"bc-redflags\"><\/div>\n    <div class=\"bc-alert bc-alert-danger\" id=\"bc-emergency\" role=\"alert\" hidden data-i18n-html=\"emergencyNow\"><\/div>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h2\">\n    <h3 class=\"bc-h\" id=\"bc-h2\"><span class=\"bc-num\" aria-hidden=\"true\">2<\/span><span data-i18n=\"s2\"><\/span><\/h3>\n    <div class=\"bc-grid\">\n      <div class=\"bc-field\"><label for=\"bc-name\" data-i18n=\"name\"><\/label><input class=\"bc-input\" id=\"bc-name\" type=\"text\" autocomplete=\"off\"><\/div>\n      <div class=\"bc-field\"><label for=\"bc-dob\" data-i18n=\"dob\"><\/label><input class=\"bc-input\" id=\"bc-dob\" type=\"date\"><\/div>\n      <div class=\"bc-field\"><label for=\"bc-sport\" data-i18n=\"sport\"><\/label><select class=\"bc-input\" id=\"bc-sport\"><\/select><\/div>\n      <div class=\"bc-field\"><span class=\"bc-label\" id=\"bc-level-lbl\" data-i18n=\"level\"><\/span><div class=\"bc-inline\" role=\"radiogroup\" aria-labelledby=\"bc-level-lbl\"><label><input type=\"radio\" name=\"bc-level\" value=\"Novice\"><span data-i18n=\"novice\"><\/span><\/label><label><input type=\"radio\" name=\"bc-level\" value=\"Open\"><span data-i18n=\"open\"><\/span><\/label><\/div><\/div>\n    <\/div>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h3\">\n    <h3 class=\"bc-h\" id=\"bc-h3\"><span class=\"bc-num\" aria-hidden=\"true\">3<\/span><span data-i18n=\"s3\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s3Help\"><\/p>\n    <div class=\"bc-checks\" id=\"bc-signs\"><\/div>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h4\">\n    <h3 class=\"bc-h\" id=\"bc-h4\"><span class=\"bc-num\" aria-hidden=\"true\">4<\/span><span data-i18n=\"s4\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s4Help\"><\/p>\n    <div class=\"bc-syms\" id=\"bc-symptoms\"><\/div>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h5\">\n    <h3 class=\"bc-h\" id=\"bc-h5\"><span class=\"bc-num\" aria-hidden=\"true\">5<\/span><span data-i18n=\"s5\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s5Help\"><\/p>\n    <div class=\"bc-grid bc-grid-3\">\n      <div class=\"bc-field\"><label for=\"bc-year\" data-i18n=\"qYear\"><\/label><select class=\"bc-input\" id=\"bc-year\"><\/select><\/div>\n      <div class=\"bc-field\"><label for=\"bc-month\" data-i18n=\"qMonth\"><\/label><select class=\"bc-input\" id=\"bc-month\"><\/select><\/div>\n      <div class=\"bc-field\"><label for=\"bc-day\" data-i18n=\"qDay\"><\/label><select class=\"bc-input\" id=\"bc-day\"><\/select><\/div>\n    <\/div>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h6\">\n    <h3 class=\"bc-h\" id=\"bc-h6\"><span class=\"bc-num\" aria-hidden=\"true\">6<\/span><span data-i18n=\"s6\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s6Help\"><\/p>\n    <button type=\"button\" class=\"bc-btn bc-btn-dark\" id=\"bc-imm-btn\" data-i18n=\"showWords\"><\/button>\n    <div class=\"bc-display\" id=\"bc-imm-words\" hidden><\/div>\n    <p class=\"bc-count\" id=\"bc-imm-count\" hidden><\/p>\n    <div id=\"bc-imm-entry\" hidden>\n      <p class=\"bc-label bc-label-gap\" id=\"bc-grid-lbl\" data-i18n=\"gridPrompt\"><\/p>\n      <div class=\"bc-grid5\" id=\"bc-imm-grid\" role=\"group\" aria-labelledby=\"bc-grid-lbl\"><\/div>\n      <p class=\"bc-count bc-grid-count\" id=\"bc-grid-count\" aria-live=\"polite\"><\/p>\n    <\/div>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h7\">\n    <h3 class=\"bc-h\" id=\"bc-h7\"><span class=\"bc-num\" aria-hidden=\"true\">7<\/span><span data-i18n=\"s7\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s7Help\"><\/p>\n    <button type=\"button\" class=\"bc-btn bc-btn-dark\" id=\"bc-dig-btn\"><\/button>\n    <div class=\"bc-display bc-display-digits\" id=\"bc-dig-display\" hidden><\/div>\n    <div id=\"bc-dig-entry\" hidden>\n      <p class=\"bc-label bc-label-gap\" id=\"bc-dig-lbl\" data-i18n=\"pickReverse\"><\/p>\n      <div class=\"bc-choices\" id=\"bc-dig-choices\" role=\"group\" aria-labelledby=\"bc-dig-lbl\"><\/div>\n    <\/div>\n    <p class=\"bc-msg\" id=\"bc-dig-msg\" aria-live=\"polite\" hidden><\/p>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h8\">\n    <h3 class=\"bc-h\" id=\"bc-h8\"><span class=\"bc-num\" aria-hidden=\"true\">8<\/span><span data-i18n=\"s8\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s8Help\"><\/p>\n    <div class=\"bc-sort\">\n      <div class=\"bc-sort-col\"><p class=\"bc-label\" id=\"bc-ml-lbl\" data-i18n=\"monthsLeft\"><\/p><ul class=\"bc-mlist\" id=\"bc-mleft\" aria-labelledby=\"bc-ml-lbl\"><\/ul><\/div>\n      <div class=\"bc-sort-col\"><p class=\"bc-label\" id=\"bc-mr-lbl\" data-i18n=\"monthsRight\"><\/p><ul class=\"bc-mlist bc-mlist-target\" id=\"bc-mright\" aria-labelledby=\"bc-mr-lbl\"><\/ul><\/div>\n    <\/div>\n  <\/section>\n  <section class=\"bc-sec\" aria-labelledby=\"bc-h9\">\n    <h3 class=\"bc-h\" id=\"bc-h9\"><span class=\"bc-num\" aria-hidden=\"true\">9<\/span><span data-i18n=\"s9\"><\/span><\/h3>\n    <p class=\"bc-help\" data-i18n=\"s9Help\"><\/p>\n    <p class=\"bc-locked\" id=\"bc-del-locked\" data-i18n=\"s9Locked\"><\/p>\n    <div id=\"bc-del-area\" hidden>\n      <p class=\"bc-timer\" id=\"bc-del-timer\"><\/p>\n      <button type=\"button\" class=\"bc-btn bc-btn-dark\" id=\"bc-del-btn\" data-i18n=\"startDelayed\"><\/button>\n      <div id=\"bc-del-entry\" hidden>\n        <p class=\"bc-label bc-label-gap\" id=\"bc-del-lbl\" data-i18n=\"delPrompt\"><\/p>\n        <div class=\"bc-grid5\" id=\"bc-del-grid\" role=\"group\" aria-labelledby=\"bc-del-lbl\"><\/div>\n        <p class=\"bc-count bc-grid-count\" id=\"bc-del-count\" aria-live=\"polite\"><\/p>\n      <\/div>\n    <\/div>\n  <\/section>\n  <section class=\"bc-sec bc-sec-submit\" aria-label=\"Submit\">\n    <label class=\"bc-consent\"><input type=\"checkbox\" id=\"bc-consent\"><span data-i18n=\"consent\"><\/span><\/label>\n    <button type=\"button\" class=\"bc-btn bc-btn-wide\" id=\"bc-submit\" data-i18n=\"submit\"><\/button>\n    <div class=\"bc-missing\" id=\"bc-missing\" tabindex=\"-1\" role=\"alert\" hidden><\/div>\n    <div class=\"bc-results\" id=\"bc-results\" tabindex=\"-1\" hidden><\/div>\n    <div class=\"bc-after bc-keep\" id=\"bc-after\" hidden>\n      <div class=\"bc-qr\" id=\"bc-qr\" role=\"img\" data-i18n-label=\"qrLabel\"><\/div>\n      <div class=\"bc-after-actions\">\n        <p class=\"bc-sync\" id=\"bc-sync\" aria-live=\"polite\"><\/p>\n        <button type=\"button\" class=\"bc-btn\" id=\"bc-pdf\" data-i18n=\"pdf\"><\/button>\n        <button type=\"button\" class=\"bc-btn bc-btn-ghost\" id=\"bc-new\" data-i18n=\"newTest\"><\/button>\n      <\/div>\n    <\/div>\n  <\/section>\n<\/div>\n<style>\n#bc-scat{--bc-red:#c8102e;--bc-red-dark:#9b0c23;--bc-ink:#1c1c1e;--bc-muted:#56565e;--bc-line:#dcdce2;--bc-soft:#f5f5f7;--bc-ok:#1e6f30;--bc-ok-bg:#e8f5eb;--bc-warn-ink:#5a3300;--bc-warn-edge:#d98200;--bc-warn-bg:#fff4e0;--bc-danger:#a30d1f;--bc-danger-bg:#fdecee;max-width:760px;margin:0 auto;color:var(--bc-ink);font-size:16px;line-height:1.5;text-align:left}\n#bc-scat *,#bc-scat *::before,#bc-scat *::after{box-sizing:border-box}\n#bc-scat [hidden]{display:none!important}\n#bc-scat p{margin:0}\n#bc-scat .bc-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;padding:0 0 14px;margin:0 0 18px;border-bottom:4px solid var(--bc-red)}\n#bc-scat .bc-title{margin:0;padding:0;font-size:1.75rem;line-height:1.2;color:var(--bc-ink)}\n#bc-scat .bc-lang{display:inline-flex;border:1px solid var(--bc-line);border-radius:999px;padding:3px;background:var(--bc-soft)}\n#bc-scat .bc-lang button{appearance:none;border:0;background:transparent;color:var(--bc-ink);font:inherit;font-size:.92rem;font-weight:600;padding:6px 14px;margin:0;border-radius:999px;cursor:pointer;min-height:36px;box-shadow:none;text-transform:none;letter-spacing:normal;width:auto}\n#bc-scat .bc-lang button[aria-pressed=\"true\"]{background:var(--bc-ink);color:#fff}\n#bc-scat .bc-intro{margin:0 0 14px;font-size:1.05rem;line-height:1.55;color:var(--bc-ink)}\n#bc-scat .bc-alert{padding:14px 16px;border-radius:8px;margin:0 0 18px;font-size:.95rem;border-left:5px solid}\n#bc-scat .bc-alert-warn{background:var(--bc-warn-bg);border-color:var(--bc-warn-edge);color:var(--bc-warn-ink)}\n#bc-scat .bc-alert-danger{background:var(--bc-danger);border-color:#5e0010;color:#fff;font-size:1.05rem;margin:14px 0 0}\n#bc-scat .bc-sec{background:#fff;border:1px solid var(--bc-line);border-radius:10px;padding:20px;margin:0 0 16px}\n#bc-scat .bc-sec-red{border:2px solid var(--bc-red)}\n#bc-scat .bc-sec-submit{background:var(--bc-soft)}\n#bc-scat .bc-h{display:flex;align-items:center;gap:10px;margin:0 0 6px;padding:0;font-size:1.2rem;line-height:1.3;color:var(--bc-ink)}\n#bc-scat .bc-num{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--bc-ink);color:#fff;font-size:.85rem;font-weight:700}\n#bc-scat .bc-sec-red .bc-num{background:var(--bc-red)}\n#bc-scat .bc-help{margin:0 0 14px;color:var(--bc-muted);font-size:.95rem}\n#bc-scat .bc-grid5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}\n#bc-scat .bc-tile{appearance:none;display:flex;align-items:center;justify-content:center;min-height:52px;width:auto;padding:6px 4px;margin:0;font:inherit;font-size:.92rem;font-weight:600;line-height:1.2;text-align:center;color:var(--bc-ink);background:#fff;border:1px solid #b5b5bf;border-radius:6px;cursor:pointer;overflow-wrap:anywhere;hyphens:auto;text-transform:none;letter-spacing:normal;box-shadow:none}\n#bc-scat .bc-tile:hover{background:var(--bc-soft)}\n#bc-scat .bc-tile[aria-pressed=\"true\"]{background:var(--bc-ink);color:#fff;border-color:var(--bc-ink)}\n#bc-scat .bc-tile:disabled{opacity:.45;cursor:not-allowed}\n#bc-scat .bc-tile[aria-pressed=\"true\"]:disabled{opacity:1}\n@media (max-width:420px){#bc-scat .bc-tile{font-size:.78rem;min-height:48px}}\n#bc-scat .bc-grid-count{margin-top:10px}\n#bc-scat .bc-grid{display:grid;grid-template-columns:1fr;gap:14px}\n@media (min-width:560px){#bc-scat .bc-grid{grid-template-columns:1fr 1fr}#bc-scat .bc-grid-3{grid-template-columns:1fr 1fr 1fr}}\n#bc-scat .bc-field{display:flex;flex-direction:column;gap:6px;min-width:0}\n#bc-scat .bc-field>label,#bc-scat .bc-label{display:block;margin:0;font-weight:600;font-size:.95rem;color:var(--bc-ink)}\n#bc-scat .bc-label-gap{margin:14px 0 8px}\n#bc-scat .bc-input{display:block;width:100%;min-height:44px;padding:10px 12px;margin:0;font:inherit;font-size:1rem;color:var(--bc-ink);background:#fff;border:1px solid #b5b5bf;border-radius:6px;box-shadow:none}\n#bc-scat .bc-input:disabled,#bc-scat .bc-input[readonly]{background:var(--bc-soft);color:var(--bc-muted)}\n#bc-scat :focus-visible{outline:3px solid #1a5fd0;outline-offset:2px}\n#bc-scat .bc-inline{display:flex;flex-wrap:wrap;align-items:center;gap:22px;min-height:44px}\n#bc-scat .bc-inline label{display:inline-flex;align-items:center;gap:8px;margin:0;font-weight:400;cursor:pointer}\n#bc-scat input[type=radio],#bc-scat input[type=checkbox]{width:20px;height:20px;margin:0;flex:none;accent-color:var(--bc-red);cursor:pointer}\n#bc-scat .bc-checks{display:grid;grid-template-columns:1fr;gap:8px}\n@media (min-width:560px){#bc-scat .bc-checks{grid-template-columns:1fr 1fr}}\n#bc-scat .bc-check{display:flex;align-items:flex-start;gap:10px;margin:0;padding:10px 12px;border:1px solid var(--bc-line);border-radius:6px;background:#fff;font-weight:400;cursor:pointer}\n#bc-scat .bc-check input{margin-top:2px}\n#bc-scat .bc-check:has(input:checked){border-color:var(--bc-red);background:var(--bc-danger-bg)}\n#bc-scat .bc-syms{display:grid;grid-template-columns:1fr;column-gap:28px}\n@media (min-width:560px){#bc-scat .bc-syms{grid-template-columns:1fr 1fr}}\n#bc-scat .bc-sym{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--bc-line)}\n#bc-scat .bc-sym label{margin:0;font-weight:400}\n#bc-scat .bc-sym .bc-input{width:76px;flex:none;min-height:40px;padding:6px 8px}\n#bc-scat .bc-sym .bc-pos{border:2px solid var(--bc-red);font-weight:700}\n#bc-scat .bc-sort{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n#bc-scat .bc-sort-col{display:flex;flex-direction:column;gap:6px;min-width:0}\n#bc-scat .bc-mlist{flex:1;display:flex;flex-direction:column;gap:5px;list-style:none;margin:0;padding:6px;background:var(--bc-soft);border:2px dashed transparent;border-radius:8px}\n#bc-scat .bc-mlist-target{background:#fff;border-color:#c4c4cc}\n#bc-scat .bc-mlist.bc-over{border-color:var(--bc-red)}\n#bc-scat .bc-mlist.bc-end::after{content:\"\";display:block;height:3px;background:var(--bc-red);border-radius:2px}\n#bc-scat .bc-mi{display:flex;align-items:center;gap:8px;min-height:40px;margin:0;padding:8px 10px;background:#fff;border:1px solid #b5b5bf;border-radius:6px;font-weight:600;line-height:1.2;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;overflow-wrap:anywhere}\n#bc-scat .bc-mi-n{flex:none;min-width:1.5em;font-size:.85rem;color:var(--bc-muted);font-variant-numeric:tabular-nums}\n#bc-scat .bc-mi.bc-dragging{opacity:.35}\n#bc-scat .bc-mi.bc-before{box-shadow:0 -4px 0 var(--bc-red)}\n#bc-scat .bc-mi[aria-disabled=\"true\"]{cursor:default}\n#bc-scat .bc-ghost{position:fixed;z-index:99999;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:grabbing}\n#bc-scat .bc-mempty{margin:auto 0;padding:14px 8px;text-align:center;font-size:.9rem;color:var(--bc-muted)}\n#bc-scat .bc-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:46px;width:auto;padding:10px 20px;margin:0;font:inherit;font-size:1rem;font-weight:700;line-height:1.2;color:#fff;background:var(--bc-red);border:0;border-radius:6px;cursor:pointer;text-transform:none;letter-spacing:normal;box-shadow:none;text-decoration:none}\n#bc-scat .bc-btn:hover{background:var(--bc-red-dark)}\n#bc-scat .bc-btn-dark{background:var(--bc-ink)}\n#bc-scat .bc-btn-dark:hover{background:#000}\n#bc-scat .bc-btn-ghost{background:#fff;color:var(--bc-ink);border:1px solid #b5b5bf}\n#bc-scat .bc-btn-ghost:hover{background:var(--bc-soft)}\n#bc-scat .bc-btn:disabled{background:#cfcfd5;color:#55555c;cursor:not-allowed}\n#bc-scat .bc-btn-wide{display:flex;width:100%}\n#bc-scat .bc-display{margin:4px 0;padding:24px 12px;text-align:center;font-size:clamp(1.4rem,4.5vw,2rem);font-weight:700;letter-spacing:.02em;word-spacing:.4em;background:var(--bc-soft);border:2px dashed #c4c4cc;border-radius:8px;color:var(--bc-ink)}\n#bc-scat .bc-display-digits{font-variant-numeric:tabular-nums;word-spacing:.6em}\n#bc-scat .bc-count{text-align:center;font-size:.9rem;color:var(--bc-muted)}\n#bc-scat .bc-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}\n#bc-scat .bc-choice{appearance:none;min-height:60px;width:auto;padding:10px 6px;margin:0;font:inherit;font-size:clamp(1.05rem,3.6vw,1.4rem);font-weight:700;letter-spacing:.04em;font-variant-numeric:tabular-nums;color:var(--bc-ink);background:#fff;border:2px solid #b5b5bf;border-radius:8px;cursor:pointer;text-transform:none;box-shadow:none}\n#bc-scat .bc-choice:hover{border-color:var(--bc-ink);background:var(--bc-soft)}\n#bc-scat .bc-msg{margin:12px 0 0;font-weight:600}\n#bc-scat .bc-msg-ok{color:var(--bc-ok)}\n#bc-scat .bc-msg-warn{color:var(--bc-warn-ink)}\n#bc-scat .bc-locked{padding:12px 14px;background:var(--bc-soft);border-radius:6px;color:var(--bc-muted)}\n#bc-scat .bc-timer{margin:0 0 12px;font-weight:600;font-variant-numeric:tabular-nums}\n#bc-scat .bc-timer-ready{color:var(--bc-ok)}\n#bc-scat .bc-consent{display:flex;align-items:flex-start;gap:10px;margin:0 0 16px;font-weight:400;cursor:pointer}\n#bc-scat .bc-consent input{margin-top:2px}\n#bc-scat .bc-missing{margin:12px 0 0;padding:12px 14px;background:var(--bc-danger-bg);border-radius:6px;color:var(--bc-danger)}\n#bc-scat .bc-missing ul,#bc-scat .bc-list{margin:6px 0 0;padding-left:1.3em}\n#bc-scat .bc-list{margin:0 0 14px}\n#bc-scat .bc-list li,#bc-scat .bc-missing li{margin:3px 0}\n#bc-scat .bc-results{margin-top:20px;outline:none}\n#bc-scat .bc-status{padding:18px 20px;border-radius:8px;color:#fff;margin:0 0 16px}\n#bc-scat .bc-status-emergency{background:#8e0015}\n#bc-scat .bc-status-suspected{background:#b93a0a}\n#bc-scat .bc-status-clear{background:var(--bc-ok)}\n#bc-scat .bc-status-label{font-size:.9rem;font-weight:600;opacity:.92}\n#bc-scat .bc-status-text{margin-top:2px;font-size:1.35rem;font-weight:700;line-height:1.3}\n#bc-scat .bc-sub{margin:16px 0 6px;padding:0;font-size:1rem;font-weight:700;color:var(--bc-ink)}\n#bc-scat .bc-scores{display:grid;grid-template-columns:1fr auto;margin:0 0 16px;border:1px solid var(--bc-line);border-radius:8px;background:#fff;overflow:hidden}\n#bc-scat .bc-scores dt,#bc-scat .bc-scores dd{margin:0;padding:8px 12px;border-bottom:1px solid var(--bc-line)}\n#bc-scat .bc-scores dd{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}\n#bc-scat .bc-scores dt:nth-last-of-type(1),#bc-scat .bc-scores dd:nth-last-of-type(1){border-bottom:0}\n#bc-scat .bc-medbox{padding:14px 16px;margin:0 0 16px;background:var(--bc-warn-bg);border-left:5px solid var(--bc-warn-edge);border-radius:8px;color:var(--bc-warn-ink)}\n#bc-scat .bc-medbox a{display:inline-block;margin-top:6px;color:var(--bc-red-dark);font-weight:700;text-decoration:underline}\n#bc-scat .bc-after{display:flex;flex-wrap:wrap;align-items:center;gap:16px}\n#bc-scat .bc-qr{padding:8px;background:#fff;border:1px solid var(--bc-line);border-radius:8px;line-height:0}\n#bc-scat .bc-qr img,#bc-scat .bc-qr canvas{display:block;max-width:100%}\n#bc-scat .bc-after-actions{display:flex;flex-direction:column;gap:10px;flex:1;min-width:220px}\n#bc-scat .bc-sync{font-size:.92rem;color:var(--bc-muted)}\n#bc-scat .bc-sync-ok{color:var(--bc-ok);font-weight:600}\n#bc-scat .bc-sync-fail{color:var(--bc-danger);font-weight:600}\n#bc-scat .bc-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}\n<\/style>\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js\"><\/script>\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js\"><\/script>\n<script>\n(function () {\n  \"use strict\";\n  var root = document.getElementById(\"bc-scat\");\n  if (!root || root.getAttribute(\"data-ready\") === \"1\") return;\n  root.setAttribute(\"data-ready\", \"1\");\n  /* ================= SETTINGS (safe to edit) =================\n     Portal version: results are saved to the athlete's Record Book in the\n     Boxing Canada portal (sent to the parent page) instead of a Google Sheet. */\n  const CONFIG = {\n    scat6Url: \"https://bjsm.bmj.com/content/bjsports/57/11/622.full.pdf\",\n    wordDisplaySeconds: 10,        /* how long the 5 memory words stay on screen */\n    recommendedDelayMinutes: 5,    /* suggested wait before delayed recall (shown, not enforced) */\n    digitStart: 3,                 /* first length in \"numbers in reverse\" */\n    digitMax: 6,                   /* last length */\n    digitShowMsPerDigit: 1000,     /* display time per digit (plus 1 s) */\n    thresholds: {                  /* \"concussion suspected\" if any of these is crossed */\n      symptomCount: 0,             /* more than this many symptoms rated above 0 */\n      symptomSeverity: 0,          /* total severity above this */\n      orientationMin: 3,           /* fewer than this many of 3 correct */\n      immediateMin: 3,             /* fewer than this many of 5 words */\n      delayedMin: 3,               /* fewer than this many of 5 words */\n      digitsMin: 4,                /* longest reversed sequence shorter than this (0 = ignore) */\n      monthsMustPass: true\n    }\n  };\n  const STATUS_SHEET = { emergency: \"EMERGENCY - CALL 911\", suspected: \"MEDICAL EVALUATION ADVISED\", clear: \"NO INDICATORS DETECTED\" };\n  const STATUS_KEYS = { emergency: \"statusEmergency\", suspected: \"statusSuspected\", clear: \"statusClear\" };\n  const ACTION_KEYS = { emergency: \"actionsEmergency\", suspected: \"actionsSuspected\", clear: \"actionsClear\" };\n  const PDF_COLORS = { emergency: [142, 0, 21], suspected: [185, 58, 10], clear: [30, 111, 48] };\n  const SPORTS = [\"Boxing\", \"Judo\", \"Wrestling\", \"Karate\", \"Taekwondo\"];\n  const WORDS = {\n    en: [[\"jacket\", \"river\", \"lemon\", \"candle\", \"garden\"], [\"window\", \"bottle\", \"tiger\", \"pencil\", \"cloud\"], [\"hammer\", \"orange\", \"mirror\", \"forest\", \"blanket\"]],\n    fr: [[\"veste\", \"rivière\", \"citron\", \"bougie\", \"jardin\"], [\"fenêtre\", \"bouteille\", \"tigre\", \"crayon\", \"nuage\"], [\"marteau\", \"orange\", \"miroir\", \"forêt\", \"couverture\"]]\n  };\n  const DISTRACTORS = {\n    en: [\"button\", \"carpet\", \"pillow\", \"coffee\", \"market\", \"school\", \"ladder\", \"basket\", \"rocket\", \"saddle\", \"kettle\", \"wallet\", \"bridge\", \"feather\", \"marble\", \"violin\", \"anchor\", \"bucket\", \"cookie\", \"helmet\", \"ticket\", \"tunnel\", \"rabbit\", \"spoon\", \"paper\", \"shovel\", \"engine\", \"towel\"],\n    fr: [\"bouton\", \"tapis\", \"oreiller\", \"café\", \"marché\", \"école\", \"échelle\", \"panier\", \"fusée\", \"selle\", \"bouilloire\", \"portefeuille\", \"pont\", \"plume\", \"bille\", \"violon\", \"ancre\", \"seau\", \"biscuit\", \"casque\", \"billet\", \"tunnel\", \"lapin\", \"cuillère\", \"papier\", \"pelle\", \"moteur\", \"serviette\"]\n  };\n  const I18N = {\n    en: {\n      title: \"Boxing Canada SCAT6 Online\",\n      intro: \"This online tool is meant to be used by any assessor to help an athlete screen for possible head injury or concussion.\",\n      disclaimer: \"<strong>Clinical disclaimer:<\/strong> This is a screening aid, not a medical diagnosis. If a concussion is suspected, remove the athlete from sparring and competition immediately and seek medical attention.\",\n      s1: \"Red flags: check first\",\n      s1Help: \"Check any that apply. If even one is present, call 911.\",\n      redFlags: [\"Neck pain or tenderness\", \"Seizure or convulsion\", \"Loss of consciousness\", \"Increasing confusion or drowsiness\", \"Repeated vomiting\", \"Severe or worsening headache\", \"Double vision\", \"Weakness, tingling or burning in arms or legs\", \"Increasingly restless, agitated or combative\"],\n      emergencyNow: \"<strong>Emergency: call 911 now.<\/strong> Stay with the athlete. Do not move them unless you are trained to do so, and do not let them return to activity.\",\n      s2: \"Athlete information\",\n      name: \"Full name\", dob: \"Date of birth\", sport: \"Sport\", sportPick: \"Select a sport…\",\n      sports: [\"Boxing\", \"Judo\", \"Wrestling\", \"Karate\", \"Taekwondo\"],\n      level: \"Level\", novice: \"Novice\", open: \"Open\",\n      s3: \"Observable signs\",\n      s3Help: \"Check any you saw, or that were reported to you, after the incident.\",\n      signs: [\"Lying motionless on the ring or mat\", \"Slow to get up after a blow to the head\", \"Confused or disoriented; unable to answer questions properly\", \"Blank or vacant look\", \"Balance or walking problems, stumbling, slow or laboured movement\", \"Facial injury after a blow to the head\"],\n      s4: \"Symptoms\",\n      s4Help: \"Ask the athlete to rate how they feel right now, from 0 (none) to 6 (severe).\",\n      symptoms: [\"Headache\", \"Pressure in head\", \"Neck pain\", \"Nausea\", \"Dizziness\", \"Blurred vision\", \"Balance problems\", \"Sensitivity to light\", \"Sensitivity to noise\", \"Feeling slowed down\", \"Feeling “in a fog”\", \"Difficulty concentrating\", \"Difficulty remembering\"],\n      symTally: \"Symptoms reported: {count} of {max}. Severity: {total} of {maxTotal}.\",\n      s5: \"Orientation\",\n      s5Help: \"Ask the athlete these questions. They should not look at a phone, watch or calendar.\",\n      qYear: \"What year is it?\", qMonth: \"What month is it?\", qDay: \"What day of the week is it?\", choose: \"Choose…\",\n      months: [\"January\", \"February\", \"March\", \"April\", \"May\", \"June\", \"July\", \"August\", \"September\", \"October\", \"November\", \"December\"],\n      days: [\"Sunday\", \"Monday\", \"Tuesday\", \"Wednesday\", \"Thursday\", \"Friday\", \"Saturday\"],\n      s6: \"Immediate memory\",\n      s6Help: \"Press the button and have the athlete read the five words. The words disappear after {sec} seconds, and a grid of 25 words appears. The athlete taps the five words they saw.\",\n      showWords: \"Show the words\", hidesIn: \"Words disappear in {sec} s\", gridPrompt: \"Tap the five words you saw:\", gridCount: \"{n} of 5 selected\",\n      s7: \"Numbers in reverse\",\n      s7Help: \"The athlete reads the numbers, which then disappear. Three options appear, and the athlete picks the one with the numbers in reverse order (for example, 4 9 3 becomes 3 9 4). Two tries are allowed at each length.\",\n      startDigits: \"Show {n} numbers\", retryDigits: \"Try again with {n} numbers\", pickReverse: \"Which one shows the numbers in reverse order?\",\n      digCorrect: \"Correct. Next level is ready.\", digWrong: \"Not quite. One more try at {n} numbers.\",\n      digEnded: \"Test finished. Longest sequence reversed correctly: {n} numbers.\", digEndedNone: \"Test finished. No sequence was reversed correctly.\", digAll: \"Test finished. All levels completed ({n} numbers).\",\n      s8: \"Months in reverse\",\n      s8Help: \"Have the athlete put the months in reverse order, starting with December. They drag each month from the left list into the right list, and can drag within the right list to fix the order. Tapping a month also moves it across.\",\n      monthsLeft: \"Months\", monthsRight: \"Reverse order (December first)\", monthsDrop: \"Drag months here\",\n      s9: \"Delayed recall\",\n      s9Help: \"When ready, press the start button. The answers from section 6 are hidden and a grid of 10 words appears. The athlete taps the five words from the memory test, with no hints. Ideally, wait at least {min} minutes after the words were shown.\",\n      startDelayed: \"Start delayed recall\", delPrompt: \"Tap the five words from the earlier memory test:\",\n      s9Locked: \"Available after the immediate memory test in section 6.\",\n      elapsed: \"Time since the words were shown: {t}\", elapsedReady: \"Time since the words were shown: {t}. Recommended wait reached.\",\n      consent: \"The athlete (or a parent or guardian, if under 18) agrees that these results will be recorded by Boxing Canada.\",\n      submit: \"Submit results\",\n      missingIntro: \"Before submitting, complete:\",\n      missName: \"Athlete’s full name (section 2)\", missOrient: \"All three orientation questions (section 5)\", missImm: \"Immediate memory test (section 6)\", missDig: \"Numbers in reverse test (section 7)\", missMonths: \"Months in reverse (section 8)\", missDel: \"Delayed recall (section 9)\", missConsent: \"The consent checkbox\",\n      resultsTitle: \"Screening result\",\n      statusEmergency: \"Emergency: call 911\", statusSuspected: \"Concussion suspected: medical evaluation required\", statusClear: \"No concussion indicators found in this screen\",\n      actionsEmergency: [\"Call 911 immediately.\", \"Stay with the athlete. Do not move them if a neck injury is possible.\", \"Do not let them return to activity.\"],\n      actionsSuspected: [\"Remove the athlete from sparring and competition. No return to activity today.\", \"Do not leave the athlete alone for the first few hours, and they should not drive.\", \"Arrange an assessment by a medical doctor or nurse practitioner as soon as possible.\", \"Return to sport only after medical clearance and a graduated return-to-sport plan.\"],\n      actionsClear: [\"This screen does not rule out a concussion. Signs and symptoms can appear hours later.\", \"Watch the athlete closely over the next 24 to 48 hours.\", \"If any sign or symptom appears, remove them from activity and arrange a medical assessment.\"],\n      why: \"What led to this result\",\n      rRed: \"Red flags present: {n}\", rSigns: \"Observable signs: {n}\", rSym: \"Symptoms reported: {n}\", rOrient: \"Orientation: {n} of 3 correct\", rImm: \"Immediate memory: {n} of 5 words\", rDel: \"Delayed recall: {n} of 5 words\", rDig: \"Numbers in reverse: longest was {n}\", rMonths: \"Months in reverse not completed correctly\",\n      summary: \"Scores\",\n      lblRed: \"Red flags\", lblSigns: \"Observable signs\", lblSym: \"Symptoms (number / severity)\", lblOrient: \"Orientation\", lblImm: \"Immediate memory\", lblDel: \"Delayed recall\", lblDig: \"Numbers in reverse (longest)\", lblMonths: \"Months in reverse\", lblDelay: \"Time before delayed recall\",\n      pass: \"Pass\", fail: \"Fail\", none: \"None\",\n      medBox: \"Give the healthcare provider this report and the full SCAT6 clinical tool:\",\n      scatLink: \"Open the full SCAT6 clinical tool (PDF)\",\n      pdf: \"Download PDF report\", newTest: \"Start a new screening\",\n      qrLabel: \"QR code summarizing this result\",\n      sending: \"Saving the result to the athlete’s Record Book…\", sent: \"Result saved to the athlete’s Record Book.\", sendFail: \"The result couldn’t be saved. Download the PDF report and keep it.\",\n      pdfTitle: \"SCAT6 SCREENING REPORT\", pdfAthlete: \"Athlete\", pdfDob: \"Date of birth\", pdfAge: \"Age\", pdfSport: \"Sport\", pdfLevel: \"Level\", pdfDate: \"Completed\",\n      pdfTargets: \"Words shown\", pdfAnswers: \"Athlete’s answers\", pdfCorrect: \"correct answer\", pdfResponse: \"Response\",\n      pdfDisclaimer: \"This report comes from a screening aid and is not a medical diagnosis.\",\n      pdfLibMissing: \"The PDF tool did not load. Check your connection and reload the page.\",\n      blank: \"[blank]\"\n    },\n    fr: {\n      title: \"Boxe Canada – SCAT6 en ligne\",\n      intro: \"Cet outil en ligne peut être utilisé par tout évaluateur pour aider un athlète à dépister une possible blessure à la tête ou commotion cérébrale.\",\n      disclaimer: \"<strong>Avis clinique :<\/strong> Cet outil est une aide au dépistage et non un diagnostic médical. En cas de commotion soupçonnée, retirez immédiatement l’athlète du sparring et de la compétition et obtenez des soins médicaux.\",\n      s1: \"Signaux d’alarme : à vérifier en premier\",\n      s1Help: \"Cochez tout ce qui s’applique. Si un seul signal est présent, composez le 911.\",\n      redFlags: [\"Douleur ou sensibilité au cou\", \"Crise convulsive ou convulsions\", \"Perte de conscience\", \"Confusion ou somnolence qui s’aggrave\", \"Vomissements répétés\", \"Mal de tête grave ou qui s’aggrave\", \"Vision double\", \"Faiblesse, picotements ou sensation de brûlure dans les bras ou les jambes\", \"Agitation ou agressivité croissante\"],\n      emergencyNow: \"<strong>Urgence : composez le 911 maintenant.<\/strong> Restez auprès de l’athlète. Ne le déplacez pas à moins d’être formé pour le faire et ne le laissez pas reprendre l’activité.\",\n      s2: \"Renseignements sur l’athlète\",\n      name: \"Nom complet\", dob: \"Date de naissance\", sport: \"Sport\", sportPick: \"Choisir un sport…\",\n      sports: [\"Boxe\", \"Judo\", \"Lutte\", \"Karaté\", \"Taekwondo\"],\n      level: \"Niveau\", novice: \"Novice\", open: \"Open\",\n      s3: \"Signes observables\",\n      s3Help: \"Cochez ceux que vous avez vus, ou qu’on vous a signalés, après l’incident.\",\n      signs: [\"Immobile au sol (ring ou tapis)\", \"Lent à se relever après un coup à la tête\", \"Confus ou désorienté; incapable de répondre correctement aux questions\", \"Regard vide ou absent\", \"Troubles de l’équilibre ou de la marche, trébuchements, mouvements lents ou laborieux\", \"Blessure au visage après un coup à la tête\"],\n      s4: \"Symptômes\",\n      s4Help: \"Demandez à l’athlète d’évaluer comment il se sent en ce moment, de 0 (aucun) à 6 (grave).\",\n      symptoms: [\"Mal de tête\", \"Pression dans la tête\", \"Douleur au cou\", \"Nausée\", \"Étourdissements\", \"Vision brouillée\", \"Problèmes d’équilibre\", \"Sensibilité à la lumière\", \"Sensibilité au bruit\", \"Impression d’être ralenti\", \"Impression d’être « dans le brouillard »\", \"Difficulté à se concentrer\", \"Difficulté à se souvenir\"],\n      symTally: \"Symptômes signalés : {count} sur {max}. Gravité : {total} sur {maxTotal}.\",\n      s5: \"Orientation\",\n      s5Help: \"Posez ces questions à l’athlète. Il ne doit consulter ni téléphone, ni montre, ni calendrier.\",\n      qYear: \"En quelle année sommes-nous ?\", qMonth: \"En quel mois sommes-nous ?\", qDay: \"Quel jour de la semaine sommes-nous ?\", choose: \"Choisir…\",\n      months: [\"janvier\", \"février\", \"mars\", \"avril\", \"mai\", \"juin\", \"juillet\", \"août\", \"septembre\", \"octobre\", \"novembre\", \"décembre\"],\n      days: [\"dimanche\", \"lundi\", \"mardi\", \"mercredi\", \"jeudi\", \"vendredi\", \"samedi\"],\n      s6: \"Mémoire immédiate\",\n      s6Help: \"Appuyez sur le bouton et demandez à l’athlète de lire les cinq mots. Les mots disparaissent après {sec} secondes et une grille de 25 mots apparaît. L’athlète touche les cinq mots qu’il a vus.\",\n      showWords: \"Afficher les mots\", hidesIn: \"Les mots disparaissent dans {sec} s\", gridPrompt: \"Touchez les cinq mots que vous avez vus :\", gridCount: \"{n} sur 5 sélectionnés\",\n      s7: \"Chiffres à l’envers\",\n      s7Help: \"L’athlète lit les chiffres, qui disparaissent ensuite. Trois choix apparaissent et l’athlète choisit celui qui présente les chiffres dans l’ordre inverse (par exemple, 4 9 3 devient 3 9 4). Deux essais sont permis pour chaque longueur.\",\n      startDigits: \"Afficher {n} chiffres\", retryDigits: \"Nouvel essai avec {n} chiffres\", pickReverse: \"Lequel présente les chiffres dans l’ordre inverse ?\",\n      digCorrect: \"Bonne réponse. Le niveau suivant est prêt.\", digWrong: \"Pas tout à fait. Encore un essai à {n} chiffres.\",\n      digEnded: \"Test terminé. Plus longue séquence inversée correctement : {n} chiffres.\", digEndedNone: \"Test terminé. Aucune séquence n’a été inversée correctement.\", digAll: \"Test terminé. Tous les niveaux réussis ({n} chiffres).\",\n      s8: \"Mois à l’envers\",\n      s8Help: \"Demandez à l’athlète de placer les mois dans l’ordre inverse, en commençant par décembre. Il fait glisser chaque mois de la liste de gauche vers la liste de droite et peut les déplacer dans la liste de droite pour corriger l’ordre. Toucher un mois le fait aussi passer d’une liste à l’autre.\",\n      monthsLeft: \"Mois\", monthsRight: \"Ordre inverse (décembre en premier)\", monthsDrop: \"Faites glisser les mois ici\",\n      s9: \"Rappel différé\",\n      s9Help: \"Lorsque vous êtes prêt, appuyez sur le bouton de départ. Les réponses de la section 6 sont masquées et une grille de 10 mots apparaît. L’athlète touche les cinq mots du test de mémoire, sans indice. Idéalement, attendez au moins {min} minutes après l’affichage des mots.\",\n      startDelayed: \"Commencer le rappel différé\", delPrompt: \"Touchez les cinq mots du test de mémoire précédent :\",\n      s9Locked: \"Disponible après le test de mémoire immédiate de la section 6.\",\n      elapsed: \"Temps écoulé depuis l’affichage des mots : {t}\", elapsedReady: \"Temps écoulé depuis l’affichage des mots : {t}. Délai recommandé atteint.\",\n      consent: \"L’athlète (ou son parent ou tuteur, s’il a moins de 18 ans) accepte que ces résultats soient enregistrés par Boxe Canada.\",\n      submit: \"Soumettre les résultats\",\n      missingIntro: \"Avant de soumettre, remplissez :\",\n      missName: \"Nom complet de l’athlète (section 2)\", missOrient: \"Les trois questions d’orientation (section 5)\", missImm: \"Test de mémoire immédiate (section 6)\", missDig: \"Test des chiffres à l’envers (section 7)\", missMonths: \"Mois à l’envers (section 8)\", missDel: \"Rappel différé (section 9)\", missConsent: \"La case de consentement\",\n      resultsTitle: \"Résultat du dépistage\",\n      statusEmergency: \"Urgence : composez le 911\", statusSuspected: \"Commotion soupçonnée : évaluation médicale requise\", statusClear: \"Aucun indicateur de commotion relevé lors de ce dépistage\",\n      actionsEmergency: [\"Composez le 911 immédiatement.\", \"Restez auprès de l’athlète. Ne le déplacez pas en cas de blessure possible au cou.\", \"Ne le laissez pas reprendre l’activité.\"],\n      actionsSuspected: [\"Retirez l’athlète du sparring et de la compétition. Aucun retour à l’activité aujourd’hui.\", \"Ne laissez pas l’athlète seul pendant les premières heures; il ne doit pas conduire.\", \"Organisez dès que possible une évaluation par un médecin ou une infirmière praticienne ou un infirmier praticien.\", \"Retour au sport seulement après une autorisation médicale et un plan de retour progressif.\"],\n      actionsClear: [\"Ce dépistage n’exclut pas une commotion. Les signes et symptômes peuvent apparaître plusieurs heures plus tard.\", \"Surveillez attentivement l’athlète au cours des 24 à 48 prochaines heures.\", \"Si un signe ou un symptôme apparaît, retirez l’athlète de l’activité et organisez une évaluation médicale.\"],\n      why: \"Ce qui a mené à ce résultat\",\n      rRed: \"Signaux d’alarme présents : {n}\", rSigns: \"Signes observables : {n}\", rSym: \"Symptômes signalés : {n}\", rOrient: \"Orientation : {n} sur 3\", rImm: \"Mémoire immédiate : {n} mots sur 5\", rDel: \"Rappel différé : {n} mots sur 5\", rDig: \"Chiffres à l’envers : maximum de {n}\", rMonths: \"Mois à l’envers non réussis\",\n      summary: \"Résultats\",\n      lblRed: \"Signaux d’alarme\", lblSigns: \"Signes observables\", lblSym: \"Symptômes (nombre / gravité)\", lblOrient: \"Orientation\", lblImm: \"Mémoire immédiate\", lblDel: \"Rappel différé\", lblDig: \"Chiffres à l’envers (maximum)\", lblMonths: \"Mois à l’envers\", lblDelay: \"Délai avant le rappel différé\",\n      pass: \"Réussi\", fail: \"Échoué\", none: \"Aucun\",\n      medBox: \"Remettez au professionnel de la santé ce rapport et l’outil clinique SCAT6 complet :\",\n      scatLink: \"Ouvrir l’outil clinique SCAT6 complet (PDF, en anglais)\",\n      pdf: \"Télécharger le rapport PDF\", newTest: \"Commencer un nouveau dépistage\",\n      qrLabel: \"Code QR résumant ce résultat\",\n      sending: \"Enregistrement du résultat dans le carnet de l’athlète…\", sent: \"Résultat enregistré dans le carnet de l’athlète.\", sendFail: \"Le résultat n’a pas pu être enregistré. Téléchargez le rapport PDF et conservez-le.\",\n      pdfTitle: \"RAPPORT DE DÉPISTAGE SCAT6\", pdfAthlete: \"Athlète\", pdfDob: \"Date de naissance\", pdfAge: \"Âge\", pdfSport: \"Sport\", pdfLevel: \"Niveau\", pdfDate: \"Rempli le\",\n      pdfTargets: \"Mots affichés\", pdfAnswers: \"Réponses de l’athlète\", pdfCorrect: \"bonne réponse\", pdfResponse: \"Réponse\",\n      pdfDisclaimer: \"Ce rapport provient d’un outil d’aide au dépistage et ne constitue pas un diagnostic médical.\",\n      pdfLibMissing: \"L’outil PDF ne s’est pas chargé. Vérifiez votre connexion et rechargez la page.\",\n      blank: \"[vide]\"\n    }\n  };\n  /* ================= STATE & HELPERS ================= */\n  let lang = \"en\";\n  const state = { words: null, wordsLang: \"en\", shownAt: 0, immReady: false, grid: [], selected: [], delGrid: [], delSelected: [], delStartedAt: 0, mLeft: [], mRight: [], timer: null, missing: [], result: null, sync: \"\", digit: { len: CONFIG.digitStart, tries: 0, best: 0, phase: \"idle\", done: false, seq: [], msg: null, btnKey: \"startDigits\" } };\n  const $ = (id) => document.getElementById(id);\n  const lookup = (l, key) => key.split(\".\").reduce((o, k) => (o == null ? undefined : o[k]), I18N[l]);\n  function t(key, vars) {\n    let s = lookup(lang, key);\n    if (s === undefined) s = lookup(\"en\", key);\n    if (s === undefined) return key;\n    if (typeof s !== \"string\") return s;\n    const v = Object.assign({ sec: CONFIG.wordDisplaySeconds, min: CONFIG.recommendedDelayMinutes }, vars || {});\n    return s.replace(/\\{(\\w+)\\}/g, (m, k) => (k in v ? String(v[k]) : m));\n  }\n  const esc = (s) => String(s).replace(/[&<>\"']/g, (c) => ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#39;\" }[c]));\n  const stripMarks = (s) => String(s || \"\").normalize(\"NFD\").replace(/[\\u0300-\\u036f]/g, \"\");\n  const ascii = (s) => stripMarks(s).replace(/[^\\x20-\\x7E]/g, \"\");\n  const normWord = (s) => stripMarks(s).toLowerCase().replace(/[^a-z]/g, \"\");\n  const pad = (n) => String(n).padStart(2, \"0\");\n  const stamp = (d) => d.getFullYear() + \"-\" + pad(d.getMonth() + 1) + \"-\" + pad(d.getDate()) + \" \" + pad(d.getHours()) + \":\" + pad(d.getMinutes()) + \":\" + pad(d.getSeconds());\n  const fmtDur = (sec) => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + \":\" + pad(sec % 60); };\n  function pdfSafe(s) {\n    return String(s).replace(/[\\u2018\\u2019]/g, \"'\").replace(/[\\u201C\\u201D]/g, '\"').replace(/[\\u2013\\u2014]/g, \"-\").replace(/\\u2026/g, \"...\").replace(/[\\u00A0\\u202F]/g, \" \").replace(/\\u0153/g, \"oe\").replace(/\\u0152/g, \"OE\").replace(/[^\\x00-\\xFF]/g, \"\");\n  }\n  function calcAge(dob, now) {\n    if (!dob) return \"\";\n    const b = new Date(dob + \"T00:00:00\");\n    if (isNaN(b.getTime())) return \"\";\n    let a = now.getFullYear() - b.getFullYear();\n    const m = now.getMonth() - b.getMonth();\n    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;\n    return a >= 0 && a < 120 ? a : \"\";\n  }\n  const checkedIdx = (group) => Array.from(root.querySelectorAll('input[data-group=\"' + group + '\"]:checked')).map((el) => parseInt(el.value, 10));\n  const symValues = () => I18N.en.symptoms.map((_, i) => parseInt($(\"bc-sym-\" + i).value, 10) || 0);\n  const sportLabel = (v) => { const i = SPORTS.indexOf(v); return i > -1 ? t(\"sports.\" + i) : \"-\"; };\n  const levelLabel = (v) => (v === \"Novice\" ? t(\"novice\") : v === \"Open\" ? t(\"open\") : \"-\");\n  /* ================= BUILD UI ================= */\n  function checks(id, group, key, count) {\n    let h = \"\";\n    for (let i = 0; i < count; i++) h += '<label class=\"bc-check\"><input type=\"checkbox\" data-group=\"' + group + '\" value=\"' + i + '\"><span data-i18n=\"' + key + \".\" + i + '\"><\/span><\/label>';\n    $(id).innerHTML = h;\n  }\n  function buildUI() {\n    checks(\"bc-redflags\", \"rf\", \"redFlags\", I18N.en.redFlags.length);\n    checks(\"bc-signs\", \"sg\", \"signs\", I18N.en.signs.length);\n    let h = \"\";\n    I18N.en.symptoms.forEach((_, i) => {\n      let opts = \"\";\n      for (let v = 0; v <= 6; v++) opts += '<option value=\"' + v + '\">' + v + \"<\/option>\";\n      h += '<div class=\"bc-sym\"><label for=\"bc-sym-' + i + '\" data-i18n=\"symptoms.' + i + '\"><\/label><select class=\"bc-input\" id=\"bc-sym-' + i + '\" data-sym=\"1\">' + opts + \"<\/select><\/div>\";\n    });\n    $(\"bc-symptoms\").innerHTML = h;\n    $(\"bc-sport\").innerHTML = '<option value=\"\" data-i18n=\"sportPick\"><\/option>' + SPORTS.map((s, i) => '<option value=\"' + s + '\" data-i18n=\"sports.' + i + '\"><\/option>').join(\"\");\n    const y = new Date().getFullYear();\n    let yo = '<option value=\"\" data-i18n=\"choose\"><\/option>';\n    shuffle([y - 2, y - 1, y, y + 1, y + 2]).forEach((k) => { yo += '<option value=\"' + k + '\">' + k + \"<\/option>\"; });\n    $(\"bc-year\").innerHTML = yo;\n    $(\"bc-month\").innerHTML = '<option value=\"\" data-i18n=\"choose\"><\/option>' + shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).map((i) => '<option value=\"' + i + '\" data-i18n=\"months.' + i + '\"><\/option>').join(\"\");\n    $(\"bc-day\").innerHTML = '<option value=\"\" data-i18n=\"choose\"><\/option>' + shuffle([0, 1, 2, 3, 4, 5, 6]).map((i) => '<option value=\"' + i + '\" data-i18n=\"days.' + i + '\"><\/option>').join(\"\");\n    state.mLeft = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);\n  }\n  /* ================= LANGUAGE ================= */\n  function detectLang() {\n    try { const s = window.localStorage.getItem(\"bcScatLang\"); if (s === \"fr\" || s === \"en\") return s; } catch (e) {}\n    if ((document.documentElement.lang || \"\").toLowerCase().indexOf(\"fr\") === 0) return \"fr\";\n    return (navigator.language || \"\").toLowerCase().indexOf(\"fr\") === 0 ? \"fr\" : \"en\";\n  }\n  function setLang(l) {\n    lang = l === \"fr\" ? \"fr\" : \"en\";\n    try { window.localStorage.setItem(\"bcScatLang\", lang); } catch (e) {}\n    applyLang();\n  }\n  function applyLang() {\n    root.setAttribute(\"lang\", lang);\n    root.querySelectorAll(\"[data-i18n]\").forEach((el) => { const n = el.getAttribute(\"data-n\"); el.textContent = t(el.getAttribute(\"data-i18n\"), n ? { n: n } : null); });\n    root.querySelectorAll(\"[data-i18n-html]\").forEach((el) => { el.innerHTML = t(el.getAttribute(\"data-i18n-html\")); });\n    root.querySelectorAll(\"[data-i18n-ph]\").forEach((el) => { el.setAttribute(\"placeholder\", t(el.getAttribute(\"data-i18n-ph\"))); });\n    root.querySelectorAll(\"[data-i18n-label]\").forEach((el) => { el.setAttribute(\"aria-label\", t(el.getAttribute(\"data-i18n-label\"))); });\n    root.querySelectorAll(\"[data-lang]\").forEach((b) => b.setAttribute(\"aria-pressed\", String(b.getAttribute(\"data-lang\") === lang)));\n    renderMonths();\n    if (state.grid.length) renderGrid();\n    if (state.delGrid.length) renderDelGrid();\n    renderDigitUI();\n    updateElapsed();\n    renderMissing();\n    if (state.result) { renderResults(); renderSync(); }\n  }\n  /* ================= SYMPTOMS & RED FLAGS ================= */\n  root.addEventListener(\"change\", (e) => {\n    const el = e.target;\n    if (el.getAttribute(\"data-group\") === \"rf\") $(\"bc-emergency\").hidden = checkedIdx(\"rf\").length === 0;\n    if (el.getAttribute(\"data-sym\")) el.classList.toggle(\"bc-pos\", el.value !== \"0\");\n  });\n  /* ================= IMMEDIATE MEMORY ================= */\n  function startImmediate() {\n    if (state.words) return;\n    const sets = WORDS[lang];\n    state.words = sets[Math.floor(Math.random() * sets.length)].slice();\n    state.wordsLang = lang;\n    state.shownAt = Date.now();\n    $(\"bc-imm-btn\").hidden = true;\n    const box = $(\"bc-imm-words\"), count = $(\"bc-imm-count\");\n    box.textContent = state.words.join(\"   \");\n    box.hidden = false;\n    let left = CONFIG.wordDisplaySeconds;\n    count.textContent = t(\"hidesIn\", { sec: left });\n    count.hidden = false;\n    const iv = setInterval(() => {\n      left--;\n      if (left > 0) { count.textContent = t(\"hidesIn\", { sec: left }); return; }\n      clearInterval(iv);\n      box.textContent = \"\"; box.hidden = true; count.hidden = true;\n      buildGrid();\n      $(\"bc-imm-entry\").hidden = false;\n      const first = $(\"bc-imm-grid\").querySelector(\".bc-tile\");\n      if (first) first.focus();\n      state.immReady = true;\n      $(\"bc-del-locked\").hidden = true;\n      $(\"bc-del-area\").hidden = false;\n      updateElapsed();\n      state.timer = setInterval(updateElapsed, 1000);\n    }, 1000);\n  }\n  function shuffle(a) {\n    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }\n    return a;\n  }\n  const tilesHtml = (words) => words.map((w, i) => '<button type=\"button\" class=\"bc-tile\" aria-pressed=\"false\" data-w=\"' + i + '\">' + esc(w) + \"<\/button>\").join(\"\");\n  function paintTiles(gridId, countId, sel, locked) {\n    const full = sel.length >= 5;\n    $(gridId).querySelectorAll(\".bc-tile\").forEach((b) => {\n      const on = sel.indexOf(parseInt(b.getAttribute(\"data-w\"), 10)) > -1;\n      b.setAttribute(\"aria-pressed\", String(on));\n      b.disabled = locked || (full && !on);\n    });\n    $(countId).textContent = t(\"gridCount\", { n: sel.length });\n  }\n  function toggleTile(e, sel, repaint) {\n    const b = e.target.closest(\".bc-tile\");\n    if (!b || b.disabled || state.result) return;\n    const idx = parseInt(b.getAttribute(\"data-w\"), 10), pos = sel.indexOf(idx);\n    if (pos > -1) sel.splice(pos, 1);\n    else if (sel.length < 5) sel.push(idx);\n    repaint();\n  }\n  function buildGrid() {\n    const fillers = shuffle(DISTRACTORS[state.wordsLang].filter((w) => state.words.indexOf(w) === -1)).slice(0, 20);\n    state.grid = shuffle(state.words.concat(fillers));\n    state.selected = [];\n    $(\"bc-imm-grid\").innerHTML = tilesHtml(state.grid);\n    renderGrid();\n  }\n  const renderGrid = () => paintTiles(\"bc-imm-grid\", \"bc-grid-count\", state.selected, !!state.result || !!state.delStartedAt);\n  const renderDelGrid = () => paintTiles(\"bc-del-grid\", \"bc-del-count\", state.delSelected, !!state.result);\n  $(\"bc-imm-grid\").addEventListener(\"click\", (e) => toggleTile(e, state.selected, renderGrid));\n  $(\"bc-del-grid\").addEventListener(\"click\", (e) => toggleTile(e, state.delSelected, renderDelGrid));\n  function startDelayed() {\n    if (!state.immReady || state.delStartedAt || state.result) return;\n    state.delStartedAt = Date.now();\n    clearInterval(state.timer);\n    updateElapsed();\n    $(\"bc-imm-entry\").hidden = true;\n    $(\"bc-del-btn\").hidden = true;\n    const fillers = shuffle(DISTRACTORS[state.wordsLang].filter((w) => state.grid.indexOf(w) === -1)).slice(0, 5);\n    state.delGrid = shuffle(state.words.concat(fillers));\n    state.delSelected = [];\n    $(\"bc-del-grid\").innerHTML = tilesHtml(state.delGrid);\n    $(\"bc-del-entry\").hidden = false;\n    renderDelGrid();\n    $(\"bc-del-grid\").querySelector(\".bc-tile\").focus();\n  }\n  function updateElapsed() {\n    if (!state.shownAt) return;\n    const end = state.delStartedAt || Date.now();\n    const s = (end - state.shownAt) / 1000;\n    const ready = s >= CONFIG.recommendedDelayMinutes * 60;\n    const el = $(\"bc-del-timer\");\n    el.textContent = t(ready ? \"elapsedReady\" : \"elapsed\", { t: fmtDur(s) });\n    el.classList.toggle(\"bc-timer-ready\", ready);\n  }\n  /* ================= NUMBERS IN REVERSE ================= */\n  const makeSeq = (len) => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len);\n  function makeOptions(seq) {\n    const correct = seq.slice().reverse().join(\"\"), forward = seq.join(\"\");\n    let other = correct;\n    for (let k = 0; k < 50 && (other === correct || other === forward); k++) other = shuffle(seq.slice()).join(\"\");\n    return shuffle([correct, forward, other]);\n  }\n  function startDigits() {\n    const d = state.digit;\n    if (d.done || d.phase !== \"idle\") return;\n    d.seq = makeSeq(d.len);\n    d.phase = \"showing\";\n    d.msg = null;\n    renderDigitUI();\n    const disp = $(\"bc-dig-display\");\n    disp.textContent = d.seq.join(\" \");\n    disp.hidden = false;\n    setTimeout(() => {\n      disp.textContent = \"\"; disp.hidden = true;\n      d.phase = \"answering\";\n      $(\"bc-dig-choices\").innerHTML = makeOptions(d.seq).map((o) => '<button type=\"button\" class=\"bc-choice\" data-ans=\"' + o + '\">' + o.split(\"\").join(\" \") + \"<\/button>\").join(\"\");\n      $(\"bc-dig-entry\").hidden = false;\n      $(\"bc-dig-choices\").querySelector(\".bc-choice\").focus();\n    }, d.len * CONFIG.digitShowMsPerDigit + 1000);\n  }\n  function checkDigits(ans) {\n    const d = state.digit;\n    if (d.phase !== \"answering\" || !ans) return;\n    $(\"bc-dig-entry\").hidden = true;\n    $(\"bc-dig-choices\").innerHTML = \"\";\n    if (ans === d.seq.slice().reverse().join(\"\")) {\n      d.best = d.len;\n      if (d.len >= CONFIG.digitMax) { d.done = true; d.phase = \"done\"; d.msg = { key: \"digAll\", vars: { n: d.len }, tone: \"ok\" }; }\n      else { d.len++; d.tries = 0; d.phase = \"idle\"; d.btnKey = \"startDigits\"; d.msg = { key: \"digCorrect\", tone: \"ok\" }; }\n    } else {\n      d.tries++;\n      if (d.tries >= 2) { d.done = true; d.phase = \"done\"; d.msg = d.best ? { key: \"digEnded\", vars: { n: d.best }, tone: \"warn\" } : { key: \"digEndedNone\", tone: \"warn\" }; }\n      else { d.phase = \"idle\"; d.btnKey = \"retryDigits\"; d.msg = { key: \"digWrong\", vars: { n: d.len }, tone: \"warn\" }; }\n    }\n    renderDigitUI();\n    if (!d.done) $(\"bc-dig-btn\").focus();\n  }\n  function renderDigitUI() {\n    const d = state.digit, btn = $(\"bc-dig-btn\"), msg = $(\"bc-dig-msg\");\n    btn.textContent = t(d.btnKey, { n: d.len });\n    btn.hidden = d.phase !== \"idle\";\n    if (d.msg) { msg.hidden = false; msg.textContent = t(d.msg.key, d.msg.vars); msg.className = \"bc-msg bc-msg-\" + d.msg.tone; }\n    else { msg.hidden = true; msg.textContent = \"\"; }\n  }\n  /* ================= MONTHS IN REVERSE (drag to sort) ================= */\n  function monthItem(m, side, pos) {\n    const locked = state.result ? ' aria-disabled=\"true\"' : \"\";\n    return '<li class=\"bc-mi\" tabindex=\"0\" role=\"button\"' + locked + ' data-m=\"' + m + '\" data-side=\"' + side + '\">' + (side === \"r\" ? '<span class=\"bc-mi-n\" aria-hidden=\"true\">' + (pos + 1) + \"<\/span>\" : \"\") + \"<span>\" + esc(t(\"months.\" + m)) + \"<\/span><\/li>\";\n  }\n  function renderMonths(focusM) {\n    $(\"bc-mleft\").innerHTML = state.mLeft.map((m) => monthItem(m, \"l\")).join(\"\");\n    $(\"bc-mright\").innerHTML = state.mRight.length ? state.mRight.map((m, i) => monthItem(m, \"r\", i)).join(\"\") : '<li class=\"bc-mempty\">' + esc(t(\"monthsDrop\")) + \"<\/li>\";\n    if (focusM != null) { const el = root.querySelector('.bc-mi[data-m=\"' + focusM + '\"]'); if (el) el.focus(); }\n  }\n  function moveMonth(m, side, idx) {\n    state.mLeft = state.mLeft.filter((x) => x !== m);\n    state.mRight = state.mRight.filter((x) => x !== m);\n    const list = side === \"r\" ? state.mRight : state.mLeft;\n    list.splice(idx == null ? list.length : Math.max(0, Math.min(idx, list.length)), 0, m);\n  }\n  const toggleMonth = (m) => moveMonth(m, state.mRight.indexOf(m) > -1 ? \"l\" : \"r\");\n  let drag = null;\n  function clearDropMarks() {\n    root.querySelectorAll(\".bc-before\").forEach((el) => el.classList.remove(\"bc-before\"));\n    [\"bc-mleft\", \"bc-mright\"].forEach((id) => $(id).classList.remove(\"bc-over\", \"bc-end\"));\n  }\n  function dropTarget(e) {\n    const near = (r) => e.clientX >= r.left - 10 && e.clientX <= r.right + 10 && e.clientY >= r.top - 20 && e.clientY <= r.bottom + 30;\n    if (near($(\"bc-mright\").getBoundingClientRect())) {\n      const items = Array.from($(\"bc-mright\").querySelectorAll(\".bc-mi\")).filter((x) => parseInt(x.getAttribute(\"data-m\"), 10) !== drag.m);\n      let idx = items.length;\n      for (let i = 0; i < items.length; i++) { const b = items[i].getBoundingClientRect(); if (e.clientY < b.top + b.height / 2) { idx = i; break; } }\n      return { side: \"r\", idx: idx, items: items };\n    }\n    if (near($(\"bc-mleft\").getBoundingClientRect())) return { side: \"l\" };\n    return null;\n  }\n  root.addEventListener(\"pointerdown\", (e) => {\n    const it = e.target.closest(\".bc-mi\");\n    if (!it || state.result || (e.button != null && e.button > 0)) return;\n    drag = { m: parseInt(it.getAttribute(\"data-m\"), 10), el: it, x: e.clientX, y: e.clientY, started: false, ghost: null, dx: 0, dy: 0 };\n  });\n  document.addEventListener(\"pointermove\", (e) => {\n    if (!drag) return;\n    if (!drag.started) {\n      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;\n      const r = drag.el.getBoundingClientRect();\n      drag.started = true;\n      drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;\n      drag.ghost = drag.el.cloneNode(true);\n      drag.ghost.classList.add(\"bc-ghost\");\n      drag.ghost.style.width = r.width + \"px\";\n      root.appendChild(drag.ghost);\n      drag.el.classList.add(\"bc-dragging\");\n    }\n    e.preventDefault();\n    drag.ghost.style.left = e.clientX - drag.dx + \"px\";\n    drag.ghost.style.top = e.clientY - drag.dy + \"px\";\n    clearDropMarks();\n    const tgt = dropTarget(e);\n    if (tgt && tgt.side === \"r\") { if (tgt.idx < tgt.items.length) tgt.items[tgt.idx].classList.add(\"bc-before\"); else $(\"bc-mright\").classList.add(\"bc-end\"); }\n    else if (tgt) $(\"bc-mleft\").classList.add(\"bc-over\");\n  }, { passive: false });\n  function endDrag(e, cancelled) {\n    if (!drag) return;\n    const d = drag;\n    const tgt = d.started && !cancelled ? dropTarget(e) : null;\n    drag = null;\n    clearDropMarks();\n    if (d.ghost) d.ghost.remove();\n    d.el.classList.remove(\"bc-dragging\");\n    if (cancelled) return;\n    if (!d.started) toggleMonth(d.m);\n    else if (tgt) moveMonth(d.m, tgt.side, tgt.idx);\n    else return;\n    renderMonths();\n  }\n  document.addEventListener(\"pointerup\", (e) => endDrag(e, false));\n  document.addEventListener(\"pointercancel\", (e) => endDrag(e, true));\n  root.addEventListener(\"keydown\", (e) => {\n    const it = e.target.closest && e.target.closest(\".bc-mi\");\n    if (!it || state.result) return;\n    const m = parseInt(it.getAttribute(\"data-m\"), 10), pos = state.mRight.indexOf(m);\n    if (e.key === \"Enter\" || e.key === \" \") { e.preventDefault(); toggleMonth(m); renderMonths(m); }\n    else if (pos > -1 && (e.key === \"ArrowUp\" || e.key === \"ArrowDown\")) { e.preventDefault(); moveMonth(m, \"r\", pos + (e.key === \"ArrowUp\" ? -1 : 1)); renderMonths(m); }\n  });\n  /* ================= SCORING ================= */\n  function countRecall(responses, targets) {\n    const left = targets.map(normWord);\n    let n = 0;\n    responses.forEach((r) => { const w = normWord(r); const i = w ? left.indexOf(w) : -1; if (i > -1) { n++; left.splice(i, 1); } });\n    return n;\n  }\n  const monthsPass = (order) => order.length === 12 && order.every((m, i) => m === 11 - i);\n  function renderMissing() {\n    const el = $(\"bc-missing\");\n    if (!state.missing.length) { el.hidden = true; el.innerHTML = \"\"; return; }\n    el.hidden = false;\n    el.innerHTML = \"<strong>\" + esc(t(\"missingIntro\")) + \"<\/strong><ul>\" + state.missing.map((k) => \"<li>\" + esc(t(k)) + \"<\/li>\").join(\"\") + \"<\/ul>\";\n  }\n  function submit() {\n    if (state.result) return;\n    const missing = [];\n    if (!$(\"bc-name\").value.trim()) missing.push(\"missName\");\n    if (!$(\"bc-year\").value || !$(\"bc-month\").value || !$(\"bc-day\").value) missing.push(\"missOrient\");\n    if (!state.immReady) missing.push(\"missImm\");\n    if (!state.digit.done) missing.push(\"missDig\");\n    if (!state.mRight.length) missing.push(\"missMonths\");\n    if (!state.delStartedAt) missing.push(\"missDel\");\n    if (!$(\"bc-consent\").checked) missing.push(\"missConsent\");\n    state.missing = missing;\n    renderMissing();\n    if (missing.length) { $(\"bc-missing\").focus(); return; }\n    const now = new Date();\n    const sym = symValues();\n    const oy = parseInt($(\"bc-year\").value, 10), om = parseInt($(\"bc-month\").value, 10), od = parseInt($(\"bc-day\").value, 10);\n    const r = {\n      at: now, stamp: stamp(now),\n      name: $(\"bc-name\").value.trim(), dob: $(\"bc-dob\").value, age: calcAge($(\"bc-dob\").value, now),\n      sport: $(\"bc-sport\").value, level: (root.querySelector('input[name=\"bc-level\"]:checked') || {}).value || \"\",\n      redFlags: checkedIdx(\"rf\"), signs: checkedIdx(\"sg\"),\n      sym: sym, symCount: sym.filter((x) => x > 0).length, symTotal: sym.reduce((a, b) => a + b, 0),\n      orient: { year: oy, month: om, day: od, cYear: now.getFullYear(), cMonth: now.getMonth(), cDay: now.getDay() },\n      words: state.words, imm: state.selected.map((i) => state.grid[i]), del: state.delSelected.map((i) => state.delGrid[i]),\n      delaySec: Math.round((state.delStartedAt - state.shownAt) / 1000),\n      digitsBest: state.digit.best, monthsOrder: state.mRight.slice(), uiLang: lang\n    };\n    r.orient.score = (oy === r.orient.cYear ? 1 : 0) + (om === r.orient.cMonth ? 1 : 0) + (od === r.orient.cDay ? 1 : 0);\n    r.immScore = countRecall(r.imm, r.words);\n    r.delScore = countRecall(r.del, r.words);\n    r.monthsPass = monthsPass(r.monthsOrder);\n    const T = CONFIG.thresholds, reasons = [];\n    if (r.redFlags.length) reasons.push({ key: \"rRed\", vars: { n: r.redFlags.length } });\n    if (r.signs.length) reasons.push({ key: \"rSigns\", vars: { n: r.signs.length } });\n    if (r.symCount > T.symptomCount || r.symTotal > T.symptomSeverity) reasons.push({ key: \"rSym\", vars: { n: r.symCount } });\n    if (r.orient.score < T.orientationMin) reasons.push({ key: \"rOrient\", vars: { n: r.orient.score } });\n    if (r.immScore < T.immediateMin) reasons.push({ key: \"rImm\", vars: { n: r.immScore } });\n    if (r.delScore < T.delayedMin) reasons.push({ key: \"rDel\", vars: { n: r.delScore } });\n    if (T.digitsMin && r.digitsBest < T.digitsMin) reasons.push({ key: \"rDig\", vars: { n: r.digitsBest } });\n    if (T.monthsMustPass && !r.monthsPass) reasons.push({ key: \"rMonths\" });\n    r.reasons = reasons;\n    r.status = r.redFlags.length ? \"emergency\" : reasons.length ? \"suspected\" : \"clear\";\n    state.result = r;\n    clearInterval(state.timer);\n    updateElapsed();\n    root.querySelectorAll(\"input, select, textarea, button\").forEach((el) => { if (!el.closest(\".bc-keep\")) el.disabled = true; });\n    renderMonths();\n    makeQR(r);\n    renderResults();\n    $(\"bc-after\").hidden = false;\n    const res = $(\"bc-results\");\n    res.focus();\n    if (res.scrollIntoView) res.scrollIntoView({ behavior: \"smooth\", block: \"start\" });\n    saveToPortal(r);\n  }\n  function renderResults() {\n    const r = state.result;\n    if (!r) return;\n    const rows = [\n      [\"lblRed\", r.redFlags.length || t(\"none\")], [\"lblSigns\", r.signs.length || t(\"none\")], [\"lblSym\", r.symCount + \" / \" + r.symTotal],\n      [\"lblOrient\", r.orient.score + \" / 3\"], [\"lblImm\", r.immScore + \" / 5\"], [\"lblDel\", r.delScore + \" / 5\"],\n      [\"lblDig\", String(r.digitsBest)], [\"lblMonths\", t(r.monthsPass ? \"pass\" : \"fail\")], [\"lblDelay\", fmtDur(r.delaySec)]\n    ];\n    let h = '<div class=\"bc-status bc-status-' + r.status + '\" role=\"status\"><p class=\"bc-status-label\">' + esc(t(\"resultsTitle\")) + '<\/p><p class=\"bc-status-text\">' + esc(t(STATUS_KEYS[r.status])) + \"<\/p><\/div>\";\n    h += '<ul class=\"bc-list\">' + t(ACTION_KEYS[r.status]).map((a) => \"<li>\" + esc(a) + \"<\/li>\").join(\"\") + \"<\/ul>\";\n    if (r.reasons.length) h += '<h4 class=\"bc-sub\">' + esc(t(\"why\")) + '<\/h4><ul class=\"bc-list\">' + r.reasons.map((x) => \"<li>\" + esc(t(x.key, x.vars)) + \"<\/li>\").join(\"\") + \"<\/ul>\";\n    h += '<h4 class=\"bc-sub\">' + esc(t(\"summary\")) + '<\/h4><dl class=\"bc-scores\">' + rows.map((row) => \"<dt>\" + esc(t(row[0])) + \"<\/dt><dd>\" + esc(row[1]) + \"<\/dd>\").join(\"\") + \"<\/dl>\";\n    if (r.status !== \"clear\") h += '<div class=\"bc-medbox\"><p>' + esc(t(\"medBox\")) + '<\/p><a href=\"' + esc(CONFIG.scat6Url) + '\" target=\"_blank\" rel=\"noopener\">' + esc(t(\"scatLink\")) + \"<\/a><\/div>\";\n    const box = $(\"bc-results\");\n    box.innerHTML = h;\n    box.hidden = false;\n  }\n  /* ================= QR CODE ================= */\n  function makeQR(r) {\n    const el = $(\"bc-qr\");\n    el.innerHTML = \"\";\n    if (typeof window.QRCode !== \"function\") { el.hidden = true; return; }\n    try {\n      new window.QRCode(el, { text: ascii(\"SCAT6 | \" + r.name + \" | Age \" + (r.age === \"\" ? \"N/A\" : r.age) + \" | \" + r.stamp + \" | \" + STATUS_SHEET[r.status]), width: 128, height: 128, correctLevel: window.QRCode.CorrectLevel.M });\n    } catch (e) { el.hidden = true; }\n  }\n  function qrDataUrl() {\n    const c = $(\"bc-qr\").querySelector(\"canvas\");\n    try { return c ? c.toDataURL(\"image/png\") : null; } catch (e) { return null; }\n  }\n  /* ================= SAVE TO THE PORTAL ================= */\n  function renderSync() {\n    const el = $(\"bc-sync\");\n    el.className = \"bc-sync\" + (state.sync === \"sent\" ? \" bc-sync-ok\" : state.sync === \"fail\" ? \" bc-sync-fail\" : \"\");\n    el.textContent = state.sync ? t(state.sync === \"sending\" ? \"sending\" : state.sync === \"sent\" ? \"sent\" : \"sendFail\") : \"\";\n  }\n  function saveToPortal(r) {\n    state.sync = \"sending\";\n    renderSync();\n    try {\n      window.parent.postMessage({ type: \"bc-scat-result\", result: {\n        status: r.status, stamp: r.stamp, lang: r.uiLang,\n        reasons: r.reasons.map((x) => t(x.key, x.vars)),\n        scores: { redFlags: r.redFlags.length, signs: r.signs.length, symCount: r.symCount, symTotal: r.symTotal, orient: r.orient.score, imm: r.immScore, del: r.delScore, digits: r.digitsBest, months: r.monthsPass, delaySec: r.delaySec }\n      } }, \"*\");\n      state.sync = \"sent\";\n    } catch (e) { state.sync = \"fail\"; }\n    renderSync();\n  }\n  /* ================= PDF REPORT ================= */\n  function downloadPDF() {\n    const r = state.result;\n    if (!r) return;\n    const JsPDF = window.jspdf && window.jspdf.jsPDF;\n    if (!JsPDF) { const sy = $(\"bc-sync\"); sy.textContent = t(\"pdfLibMissing\"); sy.className = \"bc-sync bc-sync-fail\"; return; }\n    const doc = new JsPDF({ unit: \"mm\", format: \"a4\" });\n    const L = 18, R = 192, BOTTOM = 280, col = PDF_COLORS[r.status];\n    let y = 0;\n    const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = 18; } };\n    const write = (s, o) => {\n      o = o || {};\n      const size = o.size || 10, x = L + (o.indent || 0), width = (o.width || R - L) - (o.indent || 0), c = o.color || [28, 28, 30];\n      doc.setFont(\"helvetica\", o.bold ? \"bold\" : \"normal\");\n      doc.setFontSize(size);\n      doc.setTextColor(c[0], c[1], c[2]);\n      const lines = doc.splitTextToSize(pdfSafe(s), width), lh = size * 0.42;\n      ensure(lines.length * lh);\n      doc.text(lines, x, y + size * 0.35);\n      y += lines.length * lh + (o.after == null ? 1.6 : o.after);\n    };\n    const heading = (s) => { y += 3; ensure(16); doc.setDrawColor(215, 215, 220); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 4; write(s, { size: 12, bold: true, after: 2 }); };\n    const bullet = (s) => write(\"- \" + s, { indent: 3 });\n    const listOrNone = (arr, key) => { if (!arr.length) write(t(\"none\"), { indent: 3 }); else arr.forEach((i) => bullet(t(key + \".\" + i))); };\n    const orientLine = (q, ans, correct, label) => write(q + \" \" + label(ans) + (ans === correct ? \"  [OK]\" : \"  [\" + t(\"pdfCorrect\") + \": \" + label(correct) + \"]\"), { indent: 3 });\n    doc.setFillColor(col[0], col[1], col[2]);\n    doc.rect(0, 0, 210, 30, \"F\");\n    doc.setTextColor(255, 255, 255);\n    doc.setFont(\"helvetica\", \"bold\"); doc.setFontSize(18); doc.text(pdfSafe(t(\"pdfTitle\")), L, 14);\n    doc.setFont(\"helvetica\", \"normal\"); doc.setFontSize(11); doc.text(pdfSafe(t(STATUS_KEYS[r.status])), L, 23);\n    y = 38;\n    const qr = qrDataUrl();\n    if (qr) doc.addImage(qr, \"PNG\", R - 32, 36, 32, 32);\n    [[t(\"pdfAthlete\"), r.name], [t(\"pdfDob\"), r.dob || \"-\"], [t(\"pdfAge\"), r.age === \"\" ? \"-\" : r.age], [t(\"pdfSport\"), sportLabel(r.sport)], [t(\"pdfLevel\"), levelLabel(r.level)], [t(\"pdfDate\"), r.stamp]]\n      .forEach((kv) => write(kv[0] + \": \" + kv[1], { width: R - L - 38 }));\n    y = Math.max(y, 72);\n    heading(t(\"resultsTitle\"));\n    write(t(STATUS_KEYS[r.status]), { bold: true, size: 11, color: col });\n    t(ACTION_KEYS[r.status]).forEach(bullet);\n    if (r.reasons.length) { y += 1; write(t(\"why\"), { bold: true }); r.reasons.forEach((x) => bullet(t(x.key, x.vars))); }\n    heading(\"1. \" + t(\"s1\")); listOrNone(r.redFlags, \"redFlags\");\n    heading(\"3. \" + t(\"s3\")); listOrNone(r.signs, \"signs\");\n    heading(\"4. \" + t(\"s4\"));\n    doc.setFont(\"helvetica\", \"normal\"); doc.setFontSize(10); doc.setTextColor(28, 28, 30);\n    for (let i = 0; i < r.sym.length; i += 2) {\n      ensure(5);\n      doc.text(pdfSafe(t(\"symptoms.\" + i) + \": \" + r.sym[i]), L + 3, y + 3.5);\n      if (i + 1 < r.sym.length) doc.text(pdfSafe(t(\"symptoms.\" + (i + 1)) + \": \" + r.sym[i + 1]), 108, y + 3.5);\n      y += 5;\n    }\n    y += 1;\n    write(t(\"symTally\", { count: r.symCount, max: r.sym.length, total: r.symTotal, maxTotal: r.sym.length * 6 }), { bold: true });\n    heading(\"5. \" + t(\"s5\"));\n    orientLine(t(\"qYear\"), r.orient.year, r.orient.cYear, (v) => String(v));\n    orientLine(t(\"qMonth\"), r.orient.month, r.orient.cMonth, (v) => t(\"months.\" + v));\n    orientLine(t(\"qDay\"), r.orient.day, r.orient.cDay, (v) => t(\"days.\" + v));\n    write(t(\"lblOrient\") + \": \" + r.orient.score + \" / 3\", { bold: true });\n    heading(\"6. \" + t(\"s6\"));\n    write(t(\"pdfTargets\") + \": \" + r.words.join(\", \"), { indent: 3 });\n    write(t(\"pdfAnswers\") + \": \" + (r.imm.length ? r.imm.join(\", \") : t(\"blank\")), { indent: 3 });\n    write(t(\"lblImm\") + \": \" + r.immScore + \" / 5\", { bold: true });\n    heading(\"7. \" + t(\"s7\"));\n    write(t(\"lblDig\") + \": \" + r.digitsBest, { bold: true });\n    heading(\"8. \" + t(\"s8\"));\n    write(t(\"pdfResponse\") + \": \" + (r.monthsOrder.length ? r.monthsOrder.map((m) => t(\"months.\" + m)).join(\", \") : t(\"blank\")), { indent: 3 });\n    write(t(\"lblMonths\") + \": \" + t(r.monthsPass ? \"pass\" : \"fail\"), { bold: true });\n    heading(\"9. \" + t(\"s9\"));\n    write(t(\"lblDelay\") + \": \" + fmtDur(r.delaySec), { indent: 3 });\n    write(t(\"pdfAnswers\") + \": \" + (r.del.length ? r.del.join(\", \") : t(\"blank\")), { indent: 3 });\n    write(t(\"lblDel\") + \": \" + r.delScore + \" / 5\", { bold: true });\n    if (r.status !== \"clear\") {\n      y += 5;\n      ensure(26);\n      doc.setFillColor(255, 244, 224);\n      doc.rect(L, y, R - L, 22, \"F\");\n      y += 3;\n      write(t(\"medBox\"), { bold: true, indent: 4, color: [90, 51, 0] });\n      doc.setFont(\"helvetica\", \"normal\"); doc.setFontSize(9); doc.setTextColor(155, 12, 35);\n      doc.textWithLink(CONFIG.scat6Url, L + 4, y + 3, { url: CONFIG.scat6Url });\n      y += 10;\n    }\n    const pages = doc.getNumberOfPages();\n    for (let i = 1; i <= pages; i++) {\n      doc.setPage(i);\n      doc.setFont(\"helvetica\", \"normal\"); doc.setFontSize(8); doc.setTextColor(110, 110, 118);\n      doc.text(pdfSafe(t(\"pdfDisclaimer\")), L, 290);\n      doc.text(i + \" / \" + pages, R, 290, { align: \"right\" });\n    }\n    const safeName = ascii(r.name).replace(/[^A-Za-z0-9]+/g, \"_\").replace(/^_+|_+$/g, \"\") || \"athlete\";\n    window.parent.postMessage({ type: \"bc-scat-pdf\", name: \"SCAT6_\" + safeName + \"_\" + r.stamp.slice(0, 10) + \".pdf\", data: doc.output(\"datauristring\") }, \"*\");\n  }\n  /* ================= WIRING ================= */\n  buildUI();\n  root.querySelectorAll(\"[data-lang]\").forEach((b) => b.addEventListener(\"click\", () => setLang(b.getAttribute(\"data-lang\"))));\n  $(\"bc-imm-btn\").addEventListener(\"click\", startImmediate);\n  $(\"bc-dig-btn\").addEventListener(\"click\", startDigits);\n  $(\"bc-del-btn\").addEventListener(\"click\", startDelayed);\n  $(\"bc-dig-choices\").addEventListener(\"click\", (e) => { const b = e.target.closest(\".bc-choice\"); if (b) checkDigits(b.getAttribute(\"data-ans\")); });\n  $(\"bc-submit\").addEventListener(\"click\", submit);\n  $(\"bc-pdf\").addEventListener(\"click\", downloadPDF);\n  $(\"bc-new\").addEventListener(\"click\", () => { window.parent.postMessage({ type: \"bc-scat-new\" }, \"*\"); });\n  lang = detectLang();\n  applyLang();\n})();\n<\/script>\n";
/* =========================================================
   SCAT6 concussion screening (Boxing Canada SCAT6 Online)
   The bilingual screening tool runs unchanged inside a
   sandboxed frame. Its result is saved to the boxer's Record
   Book as "Practitioner SCAT6 required" or "No SCAT6 needed".
   Athletes (for themselves) and their coaches can run it;
   coaches, officials, medical officials and administrators
   see the result.
   ========================================================= */
const SCAT_CONTEXTS = ['Sparring', 'Competition bout', 'Training', 'Other incident'];
const SCAT_FOLLOWUPS = ['Full SCAT6 completed: no concussion, cleared to return per protocol', 'Full SCAT6 completed: concussion diagnosed, rest period ordered', 'Referred to a physician for assessment'];
const scatOf = (d, bid) => (d.scatScreens || []).filter(s => s.boxerId === bid).sort((a, b) => b.at.localeCompare(a.at));
const latestScat = (d, bid) => scatOf(d, bid)[0] || null;
const scatOpen = (d, bid) => { const s = latestScat(d, bid); return !!(s && s.required && !s.followUp); };
const canRunScat = (v, b) => (v.role === 'boxer' && v.id === b.id) || (v.role === 'coach' && (b.selectedCoachIds || []).includes(v.id));
const canSeeScat = (v, b) => v.id === b.id || (v.role === 'coach' && (b.selectedCoachIds || []).includes(v.id)) || ['official', 'medical', 'ptso', 'nsoadmin'].includes(v.role);
function ScatBadge({ u, showNone, withDate, all }) {
  const { data, viewer } = useApp();
  if (!u || !canSeeScat(viewer, u)) return null;
  const s = latestScat(data, u.id);
  if (!s) return showNone ? <Badge tone="neutral">No SCAT6 screening</Badge> : null;
  if (!all && !(s.required && !s.followUp)) return null;
  const when = withDate ? ` · ${fmtDate(s.at.slice(0, 10))}` : '';
  if (s.required && !s.followUp) return <Badge tone="bad" className={s.emergency ? 'ring-2 ring-maple' : ''}>{s.emergency ? '🚨 ' : ''}SCAT6 required{when}</Badge>;
  if (s.required) return <Badge tone="neutral">SCAT6 follow-up recorded{when}</Badge>;
  return <Badge tone="ok">No SCAT6 needed{when}</Badge>;
}
function upgradeTo16(d) {
  if (!d.scatScreens) d.scatScreens = [
    { id: 'sc-1', boxerId: 'u-b3', by: 'u-c1', at: '2026-10-22T19:05:00', context: 'Sparring', status: 'suspected', required: true, emergency: false, lang: 'en', reasons: ['Symptoms reported: 3', 'Delayed recall: 2 of 5 words'], scores: { redFlags: 0, signs: 1, symCount: 3, symTotal: 7, orient: 3, imm: 4, del: 2, digits: 4, months: true, delaySec: 342 }, followUp: null },
    { id: 'sc-2', boxerId: 'u-b1', by: 'u-c1', at: '2026-10-15T20:10:00', context: 'Sparring', status: 'clear', required: false, emergency: false, lang: 'en', reasons: [], scores: { redFlags: 0, signs: 0, symCount: 0, symTotal: 0, orient: 3, imm: 5, del: 5, digits: 5, months: true, delaySec: 318 }, followUp: null }
  ];
  d.version = 16; return d;
}
function buildScatSrcdoc(prefill) {
  const pre = JSON.stringify(prefill).replace(/</g, '\\u003c');
  const post = "(function(){var p=window.BC_PREFILL||{};var n=document.getElementById('bc-name');if(n&&p.name){n.value=p.name;n.readOnly=true;}var d=document.getElementById('bc-dob');if(d&&p.dob){d.value=p.dob;d.readOnly=true;}var s=document.getElementById('bc-sport');if(s){s.value='Boxing';}if(p.level){var r=document.querySelector('input[name=\"bc-level\"][value=\"'+p.level+'\"]');if(r)r.checked=true;}function h(){window.parent.postMessage({type:'bc-scat-height',h:document.documentElement.scrollHeight},'*');}if(window.ResizeObserver){new ResizeObserver(h).observe(document.body);}setInterval(h,1500);h();})();";
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:#fff;color-scheme:light}body{padding:14px;font-family:Barlow,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}</style></head><body><script>window.BC_PREFILL=' + pre + ';<\/script>' + SCAT6_TOOL_HTML + '<script>' + post + '<\/script></body></html>';
}
function ScatToolModal({ boxerId, onClose, contextDefault }) {
  const { data, update, viewer, notify } = useApp();
  const b = getUser(data, boxerId);
  const frame = useRef(null);
  const [h, setH] = useState(1400);
  const [run, setRun] = useState(1);
  const [context, setContext] = useState(contextDefault || '');
  const [saved, setSaved] = useState(null);
  const ctxRef = useRef(context); ctxRef.current = context;
  const srcdoc = useMemo(() => buildScatSrcdoc({ name: fullName(b), dob: b.dob, level: classOf(b) === 'open' ? 'Open' : 'Novice' }), [run]);
  useEffect(() => {
    const onMsg = e => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = e.data || {};
      if (m.type === 'bc-scat-height') setH(Math.max(500, Math.min(20000, (m.h | 0) + 10)));
      else if (m.type === 'bc-scat-new') { setSaved(null); setRun(x => x + 1); }
      else if (m.type === 'bc-scat-pdf' && typeof m.data === 'string') saveFile(String(m.name || 'SCAT6.pdf'), dataUrlToBlob(m.data)).then(r => notify(r.msg, r.ok ? 'ok' : 'warn'));
      else if (m.type === 'bc-scat-result' && m.result) {
        const r = m.result; const status = ['emergency', 'suspected', 'clear'].includes(r.status) ? r.status : 'suspected';
        const rec = { id: uid('sc'), boxerId: b.id, by: viewer.id, at: nowIso(), context: ctxRef.current || '', status, required: status !== 'clear', emergency: status === 'emergency', lang: r.lang === 'fr' ? 'fr' : 'en', reasons: Array.isArray(r.reasons) ? r.reasons.map(String).slice(0, 12) : [], scores: r.scores || {}, followUp: null };
        update(d => {
          d.scatScreens = d.scatScreens || []; d.scatScreens.push(rec);
          if (rec.required) {
            const msg = `${rec.emergency ? 'EMERGENCY. ' : ''}SCAT6 screening for ${fullName(b)}: a practitioner SCAT6 is required.`;
            const to = new Set([...(b.selectedCoachIds || []), ...d.users.filter(u => u.role === 'ptso' && u.province === b.province && u.status === 'approved').map(u => u.id), ...d.events.filter(ev => isUpcoming(ev) && ev.registeredBoxerIds.includes(b.id)).flatMap(ev => ev.physicianIds), b.id]);
            to.delete(viewer.id); to.forEach(id => notifyUsers(d, id, msg, 'DASHBOARD'));
          }
        });
        setSaved(rec);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return <Modal size="xl" title="SCAT6 Concussion Screening" subtitle={`${fullName(b)}, ${b.membershipId}. The result is saved to the Record Book.`} onClose={onClose}>
    <div className="space-y-3">
      {saved ? <Banner tone={saved.required ? 'bad' : 'ok'} action={<Btn size="sm" onClick={onClose}>Done & close</Btn>}>{saved.emergency ? '🚨 Emergency recorded. Call 911 if not already done. ' : ''}Saved to {b.firstName}’s Record Book: <b>{saved.required ? 'Practitioner SCAT6 required' : 'No SCAT6 needed'}</b>.{saved.required ? ' Coaches, officials, medical officials and administrators can now see this.' : ''}</Banner>
        : <div className="flex flex-wrap items-end gap-3"><Field label="What prompted this screening?"><select className="field w-auto" value={context} onChange={e => setContext(e.target.value)}><option value="">Not specified</option>{contextDefault && !SCAT_CONTEXTS.includes(contextDefault) && <option>{contextDefault}</option>}{SCAT_CONTEXTS.map(c => <option key={c}>{c}</option>)}</select></Field><p className="max-w-md pb-2 text-xs text-muted">Complete every section, then submit. The athlete’s name, date of birth and level are filled in from the portal.</p></div>}
      <iframe key={run} ref={frame} title="SCAT6 screening tool" srcDoc={srcdoc} className="w-full rounded-md border border-line bg-white" style={{ height: h }} />
    </div>
  </Modal>;
}
function ScatFollowUpModal({ screen, onClose }) {
  const { data, update, viewer, notify } = useApp();
  const b = getUser(data, screen.boxerId);
  const [outcome, setOutcome] = useState(SCAT_FOLLOWUPS[0]); const [date, setDate] = useState(REF_DATE); const [note, setNote] = useState('');
  const save = () => {
    update(d => { const s = d.scatScreens.find(x => x.id === screen.id); s.followUp = { outcome, date, note: note.trim(), by: viewer.id, at: nowIso() }; (b.selectedCoachIds || []).forEach(id => notifyUsers(d, id, `${fullName(b)}: practitioner SCAT6 follow-up recorded (${outcome.split(':')[0]}).`, 'DASHBOARD')); });
    notify('Practitioner follow-up recorded. The SCAT6 flag is resolved.'); onClose();
  };
  return <Modal size="md" title="Record Practitioner SCAT6 Follow-up" subtitle={`${fullName(b)}, screening of ${fmtStamp(screen.at)}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>Save follow-up</Btn></>}>
    <div className="space-y-3">
      <Field label="Outcome"><div className="space-y-1.5">{SCAT_FOLLOWUPS.map(o => <label key={o} className="flex items-start gap-2 text-sm"><input type="radio" name="fu" className="mt-1" checked={outcome === o} onChange={() => setOutcome(o)} />{o}</label>)}</div></Field>
      <Field label="Date of assessment"><input type="date" className="field max-w-[200px]" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Clinical note (optional)"><textarea rows={3} className="field" value={note} onChange={e => setNote(e.target.value)} /></Field>
      <p className="text-xs text-muted">If a concussion is diagnosed, also order a mandatory rest period from the event’s post-bout examination so eligibility updates.</p>
    </div>
  </Modal>;
}
function ScatSection({ b, onRun, onFollowUp }) {
  const { data, viewer } = useApp();
  const [open, setOpen] = useState(() => scatOpen(data, b.id));
  if (!canSeeScat(viewer, b)) return null;
  const list = scatOf(data, b.id);
  if (!open) return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm"><span className="font-semibold">Concussion screenings (SCAT6)</span><span className="text-muted">Optional. {list.length ? `${list.length} on record, latest ${fmtDate(list[0].at.slice(0, 10))}.` : 'None on record.'}</span><span className="ml-auto flex gap-2">{canRunScat(viewer, b) && <Btn size="xs" variant="ghost" onClick={onRun}>Run a screening</Btn>}<Btn size="xs" onClick={() => setOpen(true)}>Show</Btn></span></div>;
  return <Section title="Concussion Screenings (SCAT6)" sub="Optional screenings completed with the Boxing Canada SCAT6 Online tool. Some competitions require a recent screening. A screen is not a diagnosis." actions={<div className="flex gap-2">{canRunScat(viewer, b) && <Btn size="sm" variant="primary" onClick={onRun}>Run SCAT6 screening</Btn>}<Btn size="sm" variant="ghost" onClick={() => setOpen(false)}>Hide</Btn></div>}>
    <Table head={['Date', 'Completed by', 'Prompted by', 'Result', 'What led to it', 'Practitioner follow-up']} isEmpty={!list.length} empty="No SCAT6 screenings recorded.">
      {list.map(s => <tr key={s.id} className={s.required && !s.followUp ? 'bg-maplesoft' : ''}>
        <Td className="whitespace-nowrap">{fmtStamp(s.at)}</Td><Td>{nameOf(data, s.by)}</Td><Td>{s.context || '—'}</Td>
        <Td>{s.required ? <Badge tone="bad">{s.emergency ? '🚨 Emergency: ' : ''}Practitioner SCAT6 required</Badge> : <Badge tone="ok">No SCAT6 needed</Badge>}<div className="mt-1 text-[11px] text-muted">Memory {s.scores.imm}/5, delayed {s.scores.del}/5, symptoms {s.scores.symCount}</div></Td>
        <Td className="text-xs">{s.reasons.length ? <ul className="list-disc pl-4">{s.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : <span className="text-muted">No indicators</span>}</Td>
        <Td className="text-xs">{s.followUp ? <><b>{s.followUp.outcome}</b><div className="text-muted">{fmtDate(s.followUp.date)}, {nameOf(data, s.followUp.by)}</div>{s.followUp.note && <div>{s.followUp.note}</div>}</> : s.required ? (viewer.role === 'medical' ? <Btn size="xs" variant="primary" onClick={() => onFollowUp(s)}>Record follow-up</Btn> : <span className="font-semibold text-maple">Awaiting a practitioner</span>) : '—'}</Td>
      </tr>)}
    </Table>
  </Section>;
}
/* =========================================================
   Shared test mode (claude.ai shared database)
   When the portal is opened from its claude.ai link, every
   tester reads and writes one shared copy of the data. Each
   record is its own database document, so testers working on
   different records never overwrite each other. Opened
   anywhere else, the portal falls back to this browser only.
   ========================================================= */
function migrateData(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.version === 4) { d.itps = makeItps(); d.version = 5; }
  if (d.version === 5) { d.docs = makeDocs(); d.version = 6; }
  if (d.version === 6) { d.calendar = makeCalendar(); d.version = 7; }
  if (d.version === 7) upgradeTo8(d);
  if (d.version === 8) upgradeTo9(d);
  if (d.version === 9) upgradeTo10(d);
  if (d.version === 10) upgradeTo11(d);
  if (d.version === 11) upgradeTo12(d);
  if (d.version === 12) upgradeTo13(d);
  if (d.version === 13) upgradeTo14(d);
  if (d.version === 14) upgradeTo15(d);
  if (d.version === 15) upgradeTo16(d);
  if (d.version === 16) upgradeTo17(d);
  if (d.version === 17) upgradeTo18(d);
  if (d.version === 18) upgradeTo19(d);
  if (d.version === 19) upgradeTo20(d);
  if (d.version === 20) upgradeTo21(d);
  if (d.version === 21) upgradeTo22(d);
  if (d.version === 22) upgradeTo23(d);
  if (d.version === 23) upgradeTo24(d);
  if (d.version === 24) upgradeTo25(d);
  if (d.version !== 25) return null;
  (d.users || []).forEach(u => { if (u.role === 'super' + 'admin') u.role = 'nsoadmin'; });
  return d;
}
const SHARED_DOC_MAX = 240000;
const safeDocId = (id, i) => { const s = String(id == null ? 'i' + i : id).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 180); return s === '.' || s === '..' || !s ? 'i' + i : s; };
function shrinkForShare(obj, onWarn) {
  let json = JSON.stringify(obj);
  if (json.length <= SHARED_DOC_MAX) return obj;
  const copy = JSON.parse(json);
  const strip = o => { if (!o || typeof o !== 'object') return; Object.keys(o).forEach(k => { const v = o[k]; if (typeof v === 'string' && v.length > 20000) { o[k] = ''; o._fileOmitted = true; } else if (v && typeof v === 'object') strip(v); }); };
  strip(copy);
  if (onWarn) onWarn('A file was too large for the shared test version and was left out. Its details were kept.');
  return JSON.stringify(copy).length <= SHARED_DOC_MAX ? copy : { _tooLarge: true };
}
function createSharedSync(db, { arrayKeys, metaKeys, getLocal, onRemote, onStatus, onWarn, seed, noSeed }) {
  const cols = {};           // collection name -> Map(docId -> body)
  const loaded = new Set();
  const order = {};          // array key -> Map(docId -> _o)
  const queue = new Map();   // path -> body | null (delete)
  let running = 0, started = false, ready = false, pendingRemote = false, timer = null, warned = false;
  const unsubs = [];
  const colNames = [...arrayKeys.map(k => 's_' + k), 's_nccp', 's_logos', 'meta'];
  const warn = m => { if (!warned) { warned = true; onWarn(m); setTimeout(() => { warned = false; }, 10000); } };
  const assemble = () => {
    const meta = cols.meta || new Map();
    const d = {};
    metaKeys.forEach(k => { const m = meta.get(k); if (m && 'v' in m) d[k] = m.v; });
    arrayKeys.forEach(k => {
      const m = cols['s_' + k] || new Map(); const om = order[k] = new Map();
      const items = [];
      m.forEach((body, id) => { const { _o, ...rest } = body; om.set(id, typeof _o === 'number' ? _o : 0); items.push([typeof _o === 'number' ? _o : 0, id, rest]); });
      items.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
      d[k] = items.map(x => x[2]);
    });
    const nm = meta.get('nccp');
    d.nccp = { ...((nm && nm.v) || { imports: [] }), records: {} };
    (cols.s_nccp || new Map()).forEach((body, id) => { d.nccp.records[body.no || id] = body; });
    d.logos = {};
    (cols.s_logos || new Map()).forEach((body, id) => { d.logos[id] = body; });
    return d;
  };
  const pump = () => {
    while (running < 4 && queue.size) {
      const [path, body] = queue.entries().next().value; queue.delete(path);
      running++;
      const ref = db.doc(path);
      const op = body === null ? ref.delete() : ref.set(body);
      op.then(() => {}, e => {
        const code = e && e.code;
        if (code === 'resource_exhausted' || code === 'unavailable') { if (!queue.has(path)) queue.set(path, body); setTimeout(pump, 1500 + Math.random() * 1500); }
        else if (code === 'invalid_argument') onStatus({ readOnly: true });
        else if (code === 'quota_exceeded') warn('The shared test database is full. Delete some test records or reset the data.');
      }).finally(() => { running--; onStatus({ saving: queue.size + running }); if (!queue.size && !running && pendingRemote) applyRemote(); pump(); });
    }
    onStatus({ saving: queue.size + running });
  };
  const enqueue = (path, body) => { queue.set(path, body); };
  const push = (prev, next) => {
    if (!ready) return;
    prev = prev || {};
    arrayKeys.forEach(k => {
      const a = Array.isArray(prev[k]) ? prev[k] : [], b = Array.isArray(next[k]) ? next[k] : [];
      const om = order[k] = order[k] || new Map();
      const before = new Map(a.map((x, i) => [safeDocId(x && x.id, i), x]));
      const ids = b.map((x, i) => safeDocId(x && x.id, i));
      let lo = Math.min(0, ...om.values()), hi = Math.max(0, ...om.values());
      b.forEach((x, i) => {
        const id = ids[i]; const old = before.get(id);
        if (old !== undefined && JSON.stringify(old) === JSON.stringify(x)) return;
        let o = om.get(id);
        if (o === undefined) { o = (i === 0 && b.length > 1) ? --lo : ++hi; om.set(id, o); }
        enqueue('s_' + k + '/' + id, { ...shrinkForShare(x, warn), _o: o });
      });
      const keep = new Set(ids);
      before.forEach((_, id) => { if (!keep.has(id)) { enqueue('s_' + k + '/' + id, null); om.delete(id); } });
    });
    const pn = (prev.nccp && prev.nccp.records) || {}, nn = (next.nccp && next.nccp.records) || {};
    Object.keys(nn).forEach(no => { if (JSON.stringify(pn[no]) !== JSON.stringify(nn[no])) enqueue('s_nccp/' + safeDocId(no), shrinkForShare(nn[no], warn)); });
    Object.keys(pn).forEach(no => { if (!(no in nn)) enqueue('s_nccp/' + safeDocId(no), null); });
    const pl = prev.logos || {}, nl = next.logos || {};
    Object.keys(nl).forEach(p => { if (JSON.stringify(pl[p]) !== JSON.stringify(nl[p])) enqueue('s_logos/' + safeDocId(p), shrinkForShare(nl[p] || {}, warn)); });
    Object.keys(pl).forEach(p => { if (!(p in nl)) enqueue('s_logos/' + safeDocId(p), null); });
    metaKeys.forEach(k => {
      let pv = prev[k], nv = next[k];
      if (k === 'nccp') { pv = pv ? { ...pv, records: undefined } : pv; nv = nv ? { ...nv, records: undefined } : nv; }
      if (JSON.stringify(pv) !== JSON.stringify(nv) && nv !== undefined) enqueue('meta/' + k, shrinkForShare({ v: nv }, warn));
    });
    pump();
  };
  const applyRemote = () => {
    if (queue.size || running) { pendingRemote = true; return; }
    pendingRemote = false;
    const raw = assemble();
    if (!raw.version) return;
    const migrated = migrateData(structuredClone(raw));
    if (!migrated) return;
    if (JSON.stringify(migrated) !== JSON.stringify(raw)) push(raw, migrated);
    onRemote(migrated);
  };
  const scheduleRemote = () => { clearTimeout(timer); timer = setTimeout(applyRemote, 120); };
  const onLoaded = async () => {
    ready = true;
    const meta = cols.meta || new Map();
    if (!meta.get('version')) {
      if (noSeed) { onStatus({ phase: 'live' }); return; }
      onStatus({ phase: 'seeding' });
      let ok = false;
      try { ok = (await db.doc('meta/seedlock').acquire({ holder: 'seed-' + Math.random().toString(36).slice(2), ttlMs: 120000 })).acquired; } catch (e) { ok = false; }
      if (ok) { const s = seed(); onRemote(s); push({}, s); }
      onStatus({ phase: 'live' });
      return;
    }
    onStatus({ phase: 'live' });
    applyRemote();
  };
  return {
    start() {
      if (started) return () => {}; started = true;
      onStatus({ phase: 'connecting' });
      const fail = setTimeout(() => { if (!ready) onStatus({ phase: 'unreachable' }); }, 12000);
      colNames.forEach(name => {
        cols[name] = new Map();
        unsubs.push(db.collection(name).onSnapshot(snap => {
          const m = new Map(); snap.docs.forEach(doc => { if (doc.exists) m.set(doc.id, doc.data()); });
          cols[name] = m;
          if (!snap.metadata.fromCache) loaded.add(name);
          if (!ready) { if (loaded.size === colNames.length) { clearTimeout(fail); onLoaded(); } }
          else scheduleRemote();
        }, e => { if (e && e.code === 'revoked') onStatus({ phase: 'revoked' }); else if (!ready) { loaded.add(name); if (loaded.size === colNames.length) { clearTimeout(fail); onLoaded(); } } }));
      });
      return () => { clearTimeout(fail); clearTimeout(timer); unsubs.forEach(u => { try { u(); } catch (e) {} }); };
    },
    push,
    isReady: () => ready
  };
}
function SharedStatusBar({ shared, onRetryLocal }) {
  if (!shared || shared.phase === 'local') return null;
  if (WP) {
    if (shared.phase === 'live' && !shared.offline && !WP.testMode) return shared.saving > 0 ? <div className="fixed bottom-3 right-3 z-50 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow">Saving…</div> : null;
    return <div className={cx('border-b border-line text-xs', shared.offline ? 'bg-maplesoft text-maple' : 'bg-ropesoft text-rope')}><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
      <span className="font-semibold">{shared.offline ? 'Can’t reach the portal server. Check your connection; changes will be saved when it’s back.' : shared.phase === 'live' ? '🧪 Test site: fictional data only' : 'Connecting to the portal…'}</span>
      {shared.phase === 'live' && !shared.offline && (shared.saving > 0 ? <span>Saving {shared.saving} change{shared.saving === 1 ? '' : 's'}…</span> : <span>All changes saved</span>)}
    </div></div>;
  }
  const live = shared.phase === 'live';
  return <div className={cx('border-b border-line text-xs', live ? 'bg-ropesoft text-rope' : shared.phase === 'unreachable' || shared.phase === 'revoked' ? 'bg-maplesoft text-maple' : 'bg-warnsoft text-warn')}>
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
      <span className="font-semibold">{live ? '🔗 Shared test version: changes are visible to all testers' : shared.phase === 'seeding' ? 'Setting up the shared test data…' : shared.phase === 'unreachable' ? 'Can’t reach the shared test data. You’re seeing this browser’s copy; changes won’t be shared.' : shared.phase === 'revoked' ? 'Your access to the shared test data ended.' : 'Connecting to the shared test data…'}</span>
      {live && (shared.saving > 0 ? <span>Saving {shared.saving} change{shared.saving === 1 ? '' : 's'}…</span> : <span>All changes saved</span>)}
      {shared.readOnly && <span className="font-semibold text-maple">You have view-only access, so your changes aren’t saved. Ask the owner to make you a Contributor.</span>}
      <span className="ml-auto opacity-80">Fictional test data only</span>
    </div>
  </div>;
}

/* =========================================================
   Public livestreams
   Events with a livestream link appear on the public page:
   Boxing Canada (NSO) events from 30 days before, PTSO events
   from 7 days before. Events on today's date are "Live today".
   ========================================================= */
const LIVE_WINDOW = { NSO: 30, PTSO: 7 };
function eventLevel(d, ev) {
  if (ev.sanctionLevel === 'NSO' || ev.sanctionLevel === 'PTSO') return ev.sanctionLevel;
  const s = ev.sanctionId ? (d.sanctions || []).find(x => x.id === ev.sanctionId) : null;
  return s && s.type === 'NSO' ? 'NSO' : 'PTSO';
}
function publicLivestreams(d) {
  return (d.events || []).filter(ev => ev.livestreamUrl && ev.isPublic !== false && ev.date >= REF_DATE)
    .map(ev => { const level = eventLevel(d, ev); return { ev, level, days: daysBetween(REF_DATE, ev.date) }; })
    .filter(x => x.days <= LIVE_WINDOW[x.level])
    .sort((a, b) => a.ev.date.localeCompare(b.ev.date) || (a.ev.firstBoutTime || '').localeCompare(b.ev.firstBoutTime || ''));
}
function upgradeTo17(d) {
  const e3 = (d.events || []).find(e => e.id === 'e-3');
  if (e3 && e3.livestreamUrl === undefined) e3.livestreamUrl = 'https://live.boxingquebec.example/championnat-montreal-2026';
  if (!d.events.some(e => e.id === 'e-5')) d.events.push({ id: 'e-5', name: 'Canadian Elite Championships 2026', province: 'AB', date: '2026-11-15', firstPreBoutCheckDateTime: '2026-11-15T09:00', firstBoutTime: '12:00', location: 'Edmonton Expo Centre, Edmonton AB', weightClasses: ['Elite Men 75 kg', 'Elite Women 60 kg'], registeredBoxerIds: ['u-b1', 'u-b4'], officials: [], physicianIds: [], bouts: [], sanctionId: null, sanctionLevel: 'NSO', livestreamUrl: 'https://live.boxingcanada.example/elite-championships-2026' });
  if (!d.events.some(e => e.id === 'e-6')) d.events.push({ id: 'e-6', name: 'Atlantic Fall Classic', province: 'NS', date: '2026-10-24', firstPreBoutCheckDateTime: '2026-10-24T15:00', firstBoutTime: '18:00', location: 'Halifax Forum, Halifax NS', weightClasses: ['Elite Men 70 kg', 'Youth Men 65 kg'], registeredBoxerIds: [], officials: [], physicianIds: [], bouts: [], sanctionId: null, sanctionLevel: 'PTSO', livestreamUrl: 'https://live.boxingns.example/atlantic-fall-classic' });
  d.version = 17; return d;
}
function LivestreamCards({ compact }) {
  const { data } = useApp();
  const list = publicLivestreams(data);
  if (!list.length) return compact ? null : <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-muted">No livestreams are scheduled in the next few weeks. Check back soon.</p>;
  return <div className={cx('grid gap-3', compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2')}>{list.map(({ ev, level, days }) => { const today = days === 0; return <article key={ev.id} className={cx('flex flex-col rounded-lg border-2 bg-surface p-4', today ? 'border-maple shadow-md' : 'border-line')}>
    <div className="flex flex-wrap items-center gap-2">
      {today ? <span className="inline-flex items-center gap-1.5 rounded-full bg-maple px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white"><span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />Live today</span>
        : <Badge tone="info">{days === 1 ? 'Tomorrow' : `In ${days} days`}</Badge>}
      <Badge tone={level === 'NSO' ? 'bad' : 'neutral'}>{level === 'NSO' ? '🍁 Boxing Canada national event' : PROVINCE_INFO[ev.province] ? PROVINCE_INFO[ev.province].ptso : 'Provincial event'}</Badge>
    </div>
    <h4 className="mt-2 font-display text-xl font-bold leading-tight">{ev.name}</h4>
    <p className="text-sm text-muted">{fmtDate(ev.date)}{ev.firstBoutTime ? `, first bout ${ev.firstBoutTime}` : ''} · {ev.location}</p>
    {!compact && ev.weightClasses.length > 0 && <p className="mt-1 text-xs text-muted">{ev.weightClasses.length} weight class{ev.weightClasses.length === 1 ? '' : 'es'}: {ev.weightClasses.slice(0, 4).join(', ')}{ev.weightClasses.length > 4 ? '…' : ''}</p>}
    <div className="mt-auto pt-3"><a href={normUrl(ev.livestreamUrl)} target="_blank" rel="noopener noreferrer" className={cx('inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-semibold', today ? 'border-maple bg-maple text-white hover:brightness-110' : 'border-line bg-surface text-ink hover:bg-sunk')}>📺 {today ? 'Watch live' : 'Open livestream page'} ↗</a></div>
  </article>; })}</div>;
}
function PublicLivestreamsView() {
  return <Section logo title="Livestreams" sub={`Watch Olympic-style boxing online. Boxing Canada national events are listed ${LIVE_WINDOW.NSO} days ahead and provincial events ${LIVE_WINDOW.PTSO} days ahead.`}><LivestreamCards /></Section>;
}
/* ---------- Mobile section menu (replaces sideways-scrolling tabs on phones) ---------- */
function MobileSectionMenu({ items, current, onPick }) {
  const [open, setOpen] = useState(false);
  const cur = items.find(i => i.key === current) || items[0];
  const others = items.reduce((a, i) => a + (i.key !== current ? (i.count || 0) : 0), 0);
  useEffect(() => { if (!open) return; const h = e => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open]);
  return <div className="relative px-4 pb-2 pt-1 md:hidden">
    <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)} className="flex min-h-[44px] w-full items-center gap-2 rounded-md border border-line bg-sunk px-3 py-2 text-left text-sm font-semibold">
      <span aria-hidden="true" className="text-base">☰</span><span className="min-w-0 flex-1 truncate">{cur ? cur.label : 'Menu'}</span>
      {others > 0 && <span className="rounded-full bg-maple px-1.5 py-0.5 text-[10px] font-bold text-white" title="Items needing attention in other sections">{others}</span>}
      <span aria-hidden="true" className="text-muted">{open ? '▴' : '▾'}</span>
    </button>
    {open && <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} aria-hidden="true" />
      <ul role="menu" className="absolute left-4 right-4 z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-xl">
        {items.map(i => <li key={i.key}><button type="button" role="menuitem" onClick={() => { setOpen(false); onPick(i.key); }} className={cx('flex min-h-[48px] w-full items-center gap-2 px-4 py-2.5 text-left text-base', i.key === current ? 'bg-maplesoft font-semibold text-maple' : 'text-ink hover:bg-sunk')}>
          <span className="flex-1">{i.label}</span>
          {i.count > 0 && <span className="rounded-full bg-maple px-1.5 py-0.5 text-[10px] font-bold text-white">{i.count}</span>}
          {i.key === current && <span aria-hidden="true">✓</span>}
        </button></li>)}
      </ul>
    </>}
  </div>;
}
/* =========================================================
   English / French interface
   A translation layer swaps interface text for French when FR
   is chosen. Member-entered content (names, notes, documents)
   is never changed. Strings not yet in the dictionary stay in
   English; the dictionary grows with each review pass.
   ========================================================= */
const FR_DICT = {
"Boxer": "Boxeur",
"Coach": "Entraîneur",
"Official": "Officiel",
"Medical Official": "Officiel médical",
"PTSO Administrator": "Administrateur OPTS",
"NSO Administrator": "Administrateur ONS",
"Boxer: Personal Record Book & Readiness Portal": "Boxeur : carnet personnel et portail de préparation",
"Coach: Manage Boxers, Competition Forms, and Sanction Requests": "Entraîneur : boxeurs, formulaires de compétition et demandes de sanction",
"Official: Technical Official & Supervisor Portal": "Officiel : portail des officiels techniques et superviseurs",
"Medical Official: Ringside Physician & Medical Clearance Console": "Officiel médical : console du médecin de ring et des autorisations médicales",
"PTSO Administrator: Provincial Administration & Sanction Approval Portal": "Administrateur OPTS : administration provinciale et approbation des sanctions",
"NSO Administrator: Boxing Canada National Console": "Administrateur ONS : console nationale de Boxe Canada",
"My Record Book": "Mon carnet",
"My Events": "Mes événements",
"My Coaches": "Mes entraîneurs",
"My Boxers": "Mes boxeurs",
"Safe Sport": "Sport sécuritaire",
"Report a concern": "Signaler une préoccupation",
"Policies": "Politiques",
"In danger right now?": "En danger en ce moment?",
"Submit a report online": "Soumettre un signalement en ligne",
"Coach invitations": "Invitations d’entraîneurs",
"Request a boxer": "Inviter un boxeur",
"Current coaches": "Entraîneurs actuels",
"Add a coach": "Ajouter un entraîneur",
"No coach selected yet.": "Aucun entraîneur choisi pour l’instant.",
"Choose coaches": "Choisir mes entraîneurs",
"Coach Dashboard": "Tableau de bord",
"Competition Events": "Événements de compétition",
"Event Sanction Requests": "Demandes de sanction",
"Assigned Events & Bouts": "Événements et combats assignés",
"Athlete Record Books": "Carnets des athlètes",
"PTSO Sanction Approvals": "Approbations de sanctions OPTS",
"Members & Approvals": "Membres et approbations",
"National Overview": "Aperçu national",
"Sanction Approvals": "Approbations de sanctions",
"International Travel Passes": "Laissez-passer de voyage international",
"Calendar": "Calendrier",
"Documents": "Documents",
"Document Library": "Bibliothèque de documents",
"Boxing Canada & PTSOs": "Boxe Canada et OPTS",
"Certification & Evaluations": "Certification et évaluations",
"Evaluation Assignments": "Évaluations assignées",
"Coach Programs": "Programmes des entraîneurs",
"Officials Programs": "Programmes des officiels",
"Pre-bout and Post-bout Medical Checks": "Examens médicaux avant et après combat",
"BOXING CANADA": "BOXE CANADA",
"Boxing Canada": "Boxe Canada",
"National Portal": "Portail national",
"CANADA": "CANADA",
"Our goal is to promote, organize, and coordinate Olympic-Style Boxing for the advancement of the sport and its members of all levels and ages.": "Notre mission est de promouvoir, d’organiser et de coordonner la boxe olympique pour l’avancement du sport et de ses membres de tous les niveaux et de tous les âges.",
"My profile": "Mon profil",
"Sign Out": "Déconnexion",
"Notifications": "Notifications",
"Mark all read": "Tout marquer comme lu",
"No notifications.": "Aucune notification.",
"Quick role demo": "Démo rapide des rôles",
"Data & backup": "Données et sauvegarde",
"Demo data is stored in this browser only": "Les données de démonstration sont stockées dans ce navigateur seulement",
"Reset demo data": "Réinitialiser les données de démo",
"All changes saved": "Toutes les modifications sont enregistrées",
"Fictional test data only": "Données de test fictives seulement",
"🔗 Shared test version: changes are visible to all testers": "🔗 Version de test partagée : les modifications sont visibles par tous les testeurs",
"Connecting to the shared test data…": "Connexion aux données de test partagées…",
"Setting up the shared test data…": "Préparation des données de test partagées…",
"Member Sign In": "Connexion des membres",
"Livestreams": "Diffusions en direct",
"🔴 Livestreams": "🔴 Diffusions en direct",
"Public Documents": "Documents publics",
"Events Calendar": "Calendrier des événements",
"Become a Member": "Devenir membre",
"Activate My Account": "Activer mon compte",
"Member access": "Accès des membres",
"Create Account": "Créer un compte",
"Sign in": "Se connecter",
"Email address or Boxing Canada Membership ID": "Courriel ou numéro de membre de Boxe Canada",
"Password": "Mot de passe",
"Demo password for every account: Password123!": "Mot de passe de démo pour tous les comptes : Password123!",
"Try each role": "Essayez chaque rôle",
"Each demo account sees only what its role allows.": "Chaque compte de démo ne voit que ce que son rôle permet.",
"Fill Form": "Remplir",
"First name": "Prénom",
"Last name": "Nom",
"Role": "Rôle",
"Province": "Province",
"Gender": "Genre",
"Date of birth": "Date de naissance",
"Email": "Courriel",
"Male": "Homme",
"Female": "Femme",
"Coach (optional)": "Entraîneur (facultatif)",
"No coach yet": "Pas encore d’entraîneur",
"Create account & sign in": "Créer le compte et se connecter",
"📺 Upcoming livestreams": "📺 Diffusions à venir",
"See all livestreams ›": "Voir toutes les diffusions ›",
"Live today": "En direct aujourd’hui",
"Tomorrow": "Demain",
"Watch live": "Regarder en direct",
"Open livestream page": "Ouvrir la page de diffusion",
"🍁 Boxing Canada national event": "🍁 Événement national de Boxe Canada",
"No livestreams are scheduled in the next few weeks. Check back soon.": "Aucune diffusion n’est prévue dans les prochaines semaines. Revenez bientôt.",
"Your province or territory": "Votre province ou territoire",
"Choose…": "Choisir…",
"Interested but not ready?": "Intéressé, mais pas encore prêt?",
"Full name": "Nom complet",
"Phone (optional)": "Téléphone (facultatif)",
"I’m interested in": "Je m’intéresse à",
"Anything else? (optional)": "Autre chose? (facultatif)",
"I’m interested in becoming a member": "Je souhaite devenir membre",
"Already registered on Trackie?": "Déjà inscrit sur Trackie?",
"Activate your portal account": "Activez votre compte du portail",
"with the code from your welcome email.": "avec le code reçu dans votre courriel de bienvenue.",
"Continue to Trackie registration ↗": "Poursuivre l’inscription sur Trackie ↗",
"Choose your province on the left first.": "Choisissez d’abord votre province à gauche.",
"Boxing as an athlete": "La boxe comme athlète",
"Recreational boxing or fitness": "La boxe récréative ou de conditionnement",
"Coaching": "L’entraînement",
"Officiating": "L’arbitrage et le jugement",
"Ringside medical": "La médecine au bord du ring",
"Volunteering": "Le bénévolat",
"Parent of a young boxer": "Parent d’un jeune boxeur",
"Activation code": "Code d’activation",
"Continue": "Continuer",
"Lost your code?": "Code perdu?",
"Send a new code": "Envoyer un nouveau code",
"Create a password": "Créer un mot de passe",
"Confirm password": "Confirmer le mot de passe",
"Activate & sign in": "Activer et se connecter",
"Use a different code": "Utiliser un autre code",
"The email you registered with on Trackie": "Le courriel utilisé pour votre inscription sur Trackie",
"All of Canada": "Tout le Canada",
"Search documents": "Rechercher des documents",
"All categories": "Toutes les catégories",
"Download": "Télécharger",
"About Boxing Canada": "À propos de Boxe Canada",
"Membership": "Adhésion",
"Nationals": "Championnats nationaux",
"Athletes": "Athlètes",
"Coaches": "Entraîneurs",
"Officials": "Officiels",
"Para": "Para",
"Hosting Events": "Organisation d’événements",
"Policies and Governance": "Politiques et gouvernance",
"Website": "Site Web",
"Phone": "Téléphone",
"Office": "Bureau",
"Board": "Conseil d’administration",
"Committees": "Comités",
"Staff": "Personnel",
"Contact through the office.": "Communiquer par l’entremise du bureau.",
"Vacant": "Vacant",
"National Calendar": "Calendrier national",
"Add Event": "Ajouter un événement",
"Export CSV / .ics": "Exporter CSV / .ics",
"Today": "Aujourd’hui",
"Month": "Mois",
"List": "Liste",
"Show all types": "Afficher tous les types",
"Sanctioned Competition": "Compétition sanctionnée",
"PTSO Meeting": "Réunion de l’OPTS",
"Coaching Course": "Cours d’entraîneur",
"Officiating Course": "Cours d’officiel",
"Medical Course": "Cours médical",
"Training Camp": "Camp d’entraînement",
"Open Sparring": "Sparring libre",
"Other": "Autre",
"Sun": "dim.",
"Mon": "lun.",
"Tue": "mar.",
"Wed": "mer.",
"Thu": "jeu.",
"Fri": "ven.",
"Sat": "sam.",
"📅 Add to my calendar (.ics)": "📅 Ajouter à mon calendrier (.ics)",
"Close": "Fermer",
"Published": "Publié",
"Approvals": "Approbations",
"Save": "Enregistrer",
"Cancel": "Annuler",
"Edit": "Modifier",
"Delete": "Supprimer",
"Remove": "Retirer",
"Approve": "Approuver",
"Decline": "Refuser",
"Deny": "Refuser",
"Submit for approval": "Soumettre pour approbation",
"Save draft": "Enregistrer le brouillon",
"Save changes": "Enregistrer les modifications",
"Back": "Retour",
"Next step": "Étape suivante",
"Review": "Vérifier",
"Search": "Rechercher",
"Clear": "Effacer",
"Add": "Ajouter",
"Done & Close": "Terminé et fermer",
"Done & close": "Terminé et fermer",
"Dismiss": "Masquer",
"Profile": "Profil",
"Status": "Statut",
"Pending": "En attente",
"Approved": "Approuvé",
"Denied": "Refusé",
"Declined": "Refusé",
"Draft": "Brouillon",
"Done": "Terminé",
"Complete": "Complet",
"Incomplete": "Incomplet",
"Yes": "Oui",
"No": "Non",
"yes": "oui",
"no": "non",
"None": "Aucun",
"Not applicable": "Sans objet",
"Upcoming": "À venir",
"Completed": "Terminé",
"Scheduled": "Prévu",
"Expand all": "Tout ouvrir",
"Collapse all": "Tout fermer",
"Hide": "Masquer",
"Show": "Afficher",
"Hide list": "Masquer la liste",
"Show list": "Afficher la liste",
"Details": "Détails",
"Archive": "Archives",
"Win": "Victoire",
"Loss": "Défaite",
"Novice": "Novice",
"Valid": "Valide",
"Expired": "Expiré",
"None on file": "Aucun au dossier",
"Eligible to Compete": "Admissible à la compétition",
"Medical Suspension / Rest Active": "Suspension médicale / repos en cours",
"No Annual Medical on file": "Aucun examen médical annuel au dossier",
"Annual Medical Expired": "Examen médical annuel expiré",
"Eligible": "Admissible",
"Eligibility": "Admissibilité",
"Digital Competitor Record Book": "Carnet de compétition numérique",
"Age": "Âge",
"Club": "Club",
"Assigned coaches": "Entraîneurs assignés",
"Overall eligibility": "Admissibilité globale",
"Classification:": "Classement :",
"Concussion screen:": "Dépistage de commotion :",
"Request move to Open": "Demander le passage à Open",
"Run SCAT6 screening": "Faire le dépistage SCAT6",
"Annual Medical Status": "Statut de l’examen médical annuel",
"View Latest Annual Medical": "Voir le dernier examen médical annuel",
"Rest Periods": "Périodes de repos",
"None active": "Aucune en cours",
"No mandatory rest in effect.": "Aucun repos obligatoire en vigueur.",
"View Rest Record": "Voir le dossier de repos",
"Competition Record": "Fiche de compétition",
"Bout History": "Historique des combats",
"Most recent bouts first, up to 10.": "Combats les plus récents en premier, jusqu’à 10.",
"Date": "Date",
"Event": "Événement",
"Weight class": "Catégorie de poids",
"Corner": "Coin",
"Opponent": "Adversaire",
"Result": "Résultat",
"Method": "Méthode",
"red": "rouge",
"blue": "bleu",
"No bouts on record.": "Aucun combat au dossier.",
"Pre-Bout Questionnaires": "Questionnaires d’avant-combat",
"Required for every event the boxer is entered in. The window opens 24 hours before the first pre-bout check.": "Requis pour chaque événement auquel le boxeur est inscrit. La période s’ouvre 24 heures avant le premier examen d’avant-combat.",
"24h window": "Période de 24 h",
"Boxer readiness": "Préparation du boxeur",
"Coach co-sign": "Cosignature de l’entraîneur",
"Non-pregnancy": "Non-grossesse",
"Complete 24h Forms": "Remplir les formulaires 24 h",
"View 24h Forms": "Voir les formulaires 24 h",
"View Forms": "Voir les formulaires",
"Window closed": "Période terminée",
"Closed": "Fermé",
"Not entered in any events.": "Inscrit à aucun événement.",
"Pre-Bout & Post-Bout Medicals": "Examens médicaux avant et après combat",
"Check": "Examen",
"BP": "TA",
"HR": "FC",
"Weight": "Poids",
"Flags": "Signes",
"Outcome": "Résultat",
"Physician": "Médecin",
"Pre-bout": "Avant-combat",
"Post-bout": "Après-combat",
"Cleared": "Autorisé",
"Not cleared": "Non autorisé",
"No injury": "Aucune blessure",
"Injury": "Blessure",
"Hospital transfer": "Transfert à l’hôpital",
"No ringside checks recorded.": "Aucun examen au bord du ring enregistré.",
"SCAT6 Concussion Screenings": "Dépistages de commotion SCAT6",
"Completed by": "Rempli par",
"Prompted by": "Contexte",
"What led to it": "Ce qui a mené au résultat",
"Practitioner follow-up": "Suivi par un praticien",
"No SCAT6 screenings recorded.": "Aucun dépistage SCAT6 enregistré.",
"No SCAT6 needed": "Aucun SCAT6 requis",
"No SCAT6 screening": "Aucun dépistage SCAT6",
"Practitioner SCAT6 required": "SCAT6 par un praticien requis",
"SCAT6 required": "SCAT6 requis",
"Awaiting a practitioner": "En attente d’un praticien",
"No indicators": "Aucun indicateur",
"Mandatory Rest Periods & Post-Rest Recovery Clearances": "Périodes de repos obligatoires et autorisations de retour",
"Rest start": "Début du repos",
"Length": "Durée",
"Exam due": "Examen prévu",
"Clearance exam": "Examen d’autorisation",
"Not yet signed": "Pas encore signé",
"No rest periods on record.": "Aucune période de repos au dossier.",
"24-Hour Pre-Bout Declarations": "Déclarations d’avant-combat (24 heures)",
"Mandatory 24-Hour Pre-Bout Declarations": "Déclarations obligatoires d’avant-combat (24 heures)",
"Declaration of Non-Pregnancy": "Déclaration de non-grossesse",
"Part A: Boxer Declaration": "Partie A : déclaration du boxeur",
"Part B: Coach Co-Signature": "Partie B : cosignature de l’entraîneur",
"Boxer digital signature": "Signature numérique du boxeur",
"Coach digital signature": "Signature numérique de l’entraîneur",
"Coach notes (optional)": "Notes de l’entraîneur (facultatif)",
"Save Boxer Readiness Declaration": "Enregistrer la déclaration de préparation",
"Save Coach Readiness Co-Sign": "Enregistrer la cosignature",
"Save Declaration of Non-Pregnancy": "Enregistrer la déclaration de non-grossesse",
"Not yet completed": "Pas encore rempli",
"Have you felt unwell, feverish or had an infection in the past 24 hours?": "Vous êtes-vous senti malade, fiévreux ou avez-vous eu une infection au cours des 24 dernières heures?",
"Have you had a headache, dizziness or a blow to the head since your last bout or sparring session?": "Avez-vous eu un mal de tête, des étourdissements ou reçu un coup à la tête depuis votre dernier combat ou sparring?",
"Have you taken any medication or other substance in the past 24 hours?": "Avez-vous pris un médicament ou une autre substance au cours des 24 dernières heures?",
"Have you slept and eaten adequately in the past 24 hours?": "Avez-vous suffisamment dormi et mangé au cours des 24 dernières heures?",
"Do you feel physically and mentally ready to box today?": "Vous sentez-vous prêt physiquement et mentalement à boxer aujourd’hui?",
"Are you experiencing unusual menstrual or pelvic pain?": "Ressentez-vous des douleurs menstruelles ou pelviennes inhabituelles?",
"The boxer has trained adequately and is prepared for this level of competition.": "Le boxeur s’est entraîné adéquatement et est prêt pour ce niveau de compétition.",
"The boxer made weight without dehydration or extreme weight-cutting methods.": "Le boxeur a fait le poids sans déshydratation ni méthode extrême de perte de poids.",
"The boxer has not had a knockout or head injury in sparring in the past 30 days.": "Le boxeur n’a subi ni K.-O. ni blessure à la tête en sparring au cours des 30 derniers jours.",
"The boxer’s Record Book, mouthguard and approved equipment are ready.": "Le carnet, le protège-dents et l’équipement approuvé du boxeur sont prêts.",
"Adult athlete (18+)": "Athlète adulte (18 ans et plus)",
"Athlete under 18, parent or guardian signature required": "Athlète de moins de 18 ans : signature d’un parent ou tuteur requise",
"Athlete digital signature": "Signature numérique de l’athlète",
"Parent or guardian full name": "Nom complet du parent ou tuteur",
"Parent or guardian digital signature": "Signature numérique du parent ou tuteur",
"I understand that boxing involves a risk of injury and that competing while pregnant may cause serious harm to me and to a fetus.": "Je comprends que la boxe comporte un risque de blessure et que combattre enceinte peut causer un grave préjudice à moi-même et au fœtus.",
"I declare that, to the best of my knowledge, I am not pregnant.": "Je déclare qu’à ma connaissance, je ne suis pas enceinte.",
"I, the athlete, declare that to the best of my knowledge I am not pregnant.": "Moi, l’athlète, je déclare qu’à ma connaissance, je ne suis pas enceinte.",
"I will tell the ringside physician immediately if my pregnancy status changes or is in doubt.": "J’informerai immédiatement le médecin de ring si ma situation de grossesse change ou devient incertaine.",
"As parent or legal guardian, I have discussed this declaration with the athlete and consent to her participation.": "À titre de parent ou de tuteur légal, j’ai discuté de cette déclaration avec l’athlète et je consens à sa participation.",
"OK": "OK",
"These forms can only be completed in the 24 hours before the first pre-bout check, so the answers reflect how the boxer is on competition day.": "Ces formulaires ne peuvent être remplis que dans les 24 heures précédant le premier examen d’avant-combat, afin que les réponses reflètent l’état du boxeur le jour de la compétition.",
"Only the boxer can complete Part A.": "Seul le boxeur peut remplir la partie A.",
"Only an assigned coach can co-sign Part B.": "Seul un entraîneur assigné peut cosigner la partie B.",
"The 24-hour window has closed. This form is view only.": "La période de 24 heures est terminée. Ce formulaire est en lecture seule.",
"Sanctioned competition events, bout sheets and pre-bout readiness. Select an event to see its details.": "Événements de compétition sanctionnés, feuilles de combats et préparation avant combat. Sélectionnez un événement pour voir les détails.",
"Events you are entered in. Complete your 24-hour forms before each first pre-bout check.": "Événements auxquels vous êtes inscrit. Remplissez vos formulaires 24 h avant chaque premier examen d’avant-combat.",
"Current and Upcoming Events": "Événements en cours et à venir",
"My Current and Upcoming Events": "Mes événements en cours et à venir",
"Today and later, soonest first.": "Aujourd’hui et plus tard, les plus proches en premier.",
"Only events you’re registered in, today and later, soonest first. To find other events, see the Calendar.": "Seulement les événements auxquels vous êtes inscrit, aujourd’hui et plus tard. Pour trouver d’autres événements, consultez le calendrier.",
"Recently Completed Events": "Événements récemment terminés",
"My Recently Completed Events": "Mes événements récemment terminés",
"Nothing archived yet.": "Rien n’est archivé pour l’instant.",
"No current or upcoming events.": "Aucun événement en cours ou à venir.",
"Create New Event": "Créer un événement",
"Contested weight categories": "Catégories de poids disputées",
"Bout sheet": "Feuille des combats",
"Red corner": "Coin rouge",
"Blue corner": "Coin bleu",
"Record result": "Inscrire le résultat",
"Your boxers are shown in bold.": "Vos boxeurs sont indiqués en gras.",
"Event Medical Practitioners": "Praticiens médicaux de l’événement",
"Checked in": "Présent",
"Not checked in": "Absent",
"No role assigned yet": "Aucun rôle assigné",
"Livestream": "Diffusion en direct",
"Add livestream link": "Ajouter un lien de diffusion",
"No livestream link yet.": "Aucun lien de diffusion pour l’instant.",
"Change link": "Modifier le lien",
"Edit event details": "Modifier l’événement",
"Registered competitors & 24h Pre-Bout Questionnaires": "Boxeurs inscrits et questionnaires d’avant-combat",
"Competitor readiness by weight class": "Préparation des boxeurs par catégorie de poids",
"Boxers": "Boxeurs",
"Open event medical checks": "Ouvrir les examens médicaux de l’événement",
"Register Competitors": "Inscrire des boxeurs",
"Manage Competitors": "Gérer les boxeurs",
"Only events I’m assigned to": "Seulement mes événements assignés",
"Assigned Boxers": "Boxeurs assignés",
"Boxers who list you as their coach.": "Boxeurs qui vous désignent comme entraîneur.",
"boxers assigned to you": "boxeurs qui vous sont assignés",
"Due Pre-Bout Checks, Expiring Annual Medicals & Rest Checks": "Examens d’avant-combat dus, examens annuels qui expirent et examens après repos",
"pre-bout checks due": "examens d’avant-combat dus",
"annual medicals expiring in 90 days": "examens annuels expirant dans 90 jours",
"post-rest medical checks outstanding": "examens après repos en attente",
"Sanctioned Events & Pending Sanctions": "Événements sanctionnés et sanctions en attente",
"sanctioned events": "événements sanctionnés",
"pending sanctions you submitted": "sanctions soumises en attente",
"Show details": "Afficher les détails",
"Showing details below": "Détails affichés ci-dessous",
"Membership ID": "Numéro de membre",
"Latest Annual Medical": "Dernier examen médical annuel",
"Rest status": "Statut du repos",
"Bouts": "Combats",
"Medical History": "Antécédents médicaux",
"Open Record Book": "Ouvrir le carnet",
"No active rest": "Aucun repos en cours",
"Rest active until clearance": "Repos en cours jusqu’à l’autorisation",
"Medical Checks to Action": "Examens médicaux à traiter",
"Target date": "Date cible",
"Detail": "Détail",
"View Annual Medical": "Voir l’examen médical annuel",
"Post-Rest Medical Check": "Examen après repos",
"Annual Medical expiring": "Examen annuel qui expire",
"24h Pre-Bout Questionnaire": "Questionnaire d’avant-combat",
"Name": "Nom",
"Type": "Type",
"New Sanction Request": "Nouvelle demande de sanction",
"Open Event": "Ouvrir l’événement",
"Inspect Request": "Examiner la demande",
"Sanctioned event": "Événement sanctionné",
"Pending approval": "En attente d’approbation"
};
const FR_PATTERNS = [[new RegExp("^Available in (\\d+) days?$"), "Disponible dans {1} jour(s)"],[new RegExp("^🔒 Available in (\\d+) days?$"), "🔒 Disponible dans {1} jour(s)"],[new RegExp("^Available in (\\d+) hours?$"), "Disponible dans {1} heure(s)"],[new RegExp("^In (\\d+) days$"), "Dans {1} jours"],[new RegExp("^Expires in (\\d+) days$"), "Expire dans {1} jours"],[new RegExp("^Opens (.+)$"), "Ouverture : {1}"],[new RegExp("^Open until (.+)$"), "Ouvert jusqu’au {1}"],[new RegExp("^24h window: (.+)$"), "Période de 24 h : {1}"],[new RegExp("^(\\d+) completed bouts?$"), "{1} combat(s) terminé(s)"],[new RegExp("^(\\d+) waiting$"), "{1} en attente"]];
const LangCtx = createContext({ lang: 'en', setLang: () => {} });
function frText(t) {
  const k = String(t).trim(); if (!k || k.length > 400) return null;
  let v = FR_DICT[k];
  if (v === undefined) { for (const [re, tmpl] of FR_PATTERNS) { const m = k.match(re); if (m) { v = tmpl.replace(/\{(\d)\}/g, (_, i) => m[+i]); break; } } }
  return v === undefined ? null : String(t).replace(k, v);
}
function makeTranslator(root) {
  const recs = new Map(), attrRecs = new Map();
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  let lang = 'en', obs = null;
  const skipEl = el => !el || el.nodeName === 'SCRIPT' || el.nodeName === 'STYLE' || el.nodeName === 'TEXTAREA' || el.nodeName === 'IFRAME' || (el.hasAttribute && el.hasAttribute('data-i18n-skip'));
  const skipped = n => { let e = n.nodeType === 1 ? n : n.parentElement; while (e && e !== root) { if (skipEl(e)) return true; e = e.parentElement; } return false; };
  const doText = node => { const val = node.nodeValue; const r = recs.get(node); if (r && val === r.fr) return; const f = frText(val); if (f && f !== val) { recs.set(node, { en: val, fr: f }); node.nodeValue = f; } else recs.delete(node); };
  const doAttrs = el => { ATTRS.forEach(a => { if (!el.hasAttribute || !el.hasAttribute(a)) return; const val = el.getAttribute(a); const m = attrRecs.get(el) || {}; if (m[a] && m[a].fr === val) return; const f = frText(val); if (f && f !== val) { m[a] = { en: val, fr: f }; attrRecs.set(el, m); el.setAttribute(a, f); } }); };
  const walk = n => { if (n.nodeType === 3) return doText(n); if (n.nodeType !== 1 || skipEl(n)) return; doAttrs(n); n.childNodes.forEach(walk); };
  const onMut = muts => { muts.forEach(m => { if (m.type === 'characterData') { if (!skipped(m.target)) doText(m.target); } else if (m.type === 'attributes') { if (!skipped(m.target)) doAttrs(m.target); } else m.addedNodes.forEach(n => { if (!skipped(n)) walk(n); }); }); };
  return {
    set(l) {
      lang = l;
      if (lang === 'fr') { walk(root); if (!obs) { obs = new MutationObserver(onMut); obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); } }
      else {
        if (obs) { obs.disconnect(); obs = null; }
        recs.forEach((r, node) => { if (node.nodeValue === r.fr) node.nodeValue = r.en; }); recs.clear();
        attrRecs.forEach((m, el) => Object.keys(m).forEach(a => { if (el.getAttribute(a) === m[a].fr) el.setAttribute(a, m[a].en); })); attrRecs.clear();
      }
    }
  };
}
function LangToggle() {
  const { lang, setLang } = useContext(LangCtx);
  return <div className="inline-flex shrink-0 rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Language / Langue" data-i18n-skip="">
    {[['en', 'EN', 'English'], ['fr', 'FR', 'Français']].map(([k, l, full]) => <button key={k} type="button" lang={k} title={full} aria-pressed={lang === k} onClick={() => setLang(k)} className={cx('min-w-[34px] rounded px-2 py-1 text-xs font-bold', lang === k ? 'bg-rope text-white' : 'text-muted hover:bg-sunk')}>{l}</button>)}
  </div>;
}

/* ---------- SCAT6 as an optional competition requirement ---------- */
const SCAT_WINDOW_CHOICES = [7, 14, 30, 60, 90];
function scatForEvent(d, ev, bid) {
  if (!ev || !ev.scatRequired) return null;
  const n = Number(ev.scatWithinDays) || 30, from = addDays(ev.date, -n);
  const inWin = scatOf(d, bid).filter(s => s.at.slice(0, 10) >= from && s.at.slice(0, 10) <= ev.date);
  const ok = inWin.find(s => !s.required || (s.followUp && /no concussion/i.test(s.followUp.outcome)));
  if (ok) return { state: 'ok', screen: ok, label: `SCAT6 ${fmtDate(ok.at.slice(0, 10))}: meets requirement` };
  const flag = inWin.find(s => s.required && !s.followUp);
  if (flag) return { state: 'flag', screen: flag, label: 'SCAT6 flagged: practitioner needed' };
  if (REF_DATE < from) { const dd = daysBetween(REF_DATE, from); return { state: 'early', from, label: `Available in ${dd} day${dd === 1 ? '' : 's'}` }; }
  if (REF_DATE > ev.date) return { state: 'missed', label: 'Not completed' };
  return { state: 'due', from, label: 'SCAT6 needed' };
}
function ScatEventCell({ ev, b, onRun }) {
  const { data, viewer } = useApp();
  const st = scatForEvent(data, ev, b.id);
  if (!st) return <span className="text-xs text-muted">Not required</span>;
  if (st.state === 'ok') return <span className="inline-flex flex-col rounded-md bg-oksoft px-2 py-1 text-xs font-semibold leading-tight text-ok"><span className="whitespace-nowrap">✓ SCAT6 {fmtDate(st.screen.at.slice(0, 10))}</span><span className="whitespace-nowrap font-normal">Meets requirement</span></span>;
  if (st.state === 'flag') return <Badge tone="bad">{st.label}</Badge>;
  if (st.state === 'early') return <Btn size="xs" disabled title={`A screening counts for this event from ${fmtDate(st.from)}, ${ev.scatWithinDays || 30} days before the event.`}>🔒 {st.label}</Btn>;
  if (st.state === 'missed') return <Badge tone="warn">{st.label}</Badge>;
  return canRunScat(viewer, b) ? <Btn size="xs" variant="primary" onClick={onRun}>Complete SCAT6</Btn> : <Badge tone="warn">{st.label}</Badge>;
}
function upgradeTo18(d) {
  const e1 = (d.events || []).find(e => e.id === 'e-1');
  if (e1 && e1.scatRequired === undefined) { e1.scatRequired = true; e1.scatWithinDays = 30; }
  const s2 = (d.sanctions || []).find(x => x.id === 's-2');
  if (s2 && s2.info && s2.info.scatRequired === undefined) { s2.info.scatRequired = true; s2.info.scatWithinDays = 30; }
  d.version = 18; return d;
}

/* =========================================================
   Test data: 2026 Elite Nationals, Cape Breton (Nov 17 to 21)
   Entirely fictional people. Numbers mirror a real national
   championship registration: 135 Open boxers (86 men, 49
   women, 14 wildcards) across 19 weight classes from 8
   provinces, with 87 registered coaches.
   ========================================================= */
function makeNationals2026(d) {
  if (d.events.some(e => e.id === 'e-nat-2026')) return d;
  let seed = 20261117;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const FM = ['Liam', 'Noah', 'Ethan', 'Lucas', 'Olivier', 'William', 'Félix', 'Gabriel', 'Samuel', 'Jacob', 'Omar', 'Arjun', 'Rohan', 'Daniel', 'Tyler', 'Jordan', 'Malik', 'Andre', 'Kenji', 'Hassan', 'Mateo', 'Diego', 'Connor', 'Owen', 'Isaac', 'Nathan', 'Émile', 'Xavier', 'Kwame', 'Tariq', 'Sami', 'Hugo', 'Marcus', 'Dylan', 'Rafael', 'Dante', 'Yusuf', 'Jamal', 'Leo', 'Adrien'];
  const FF = ['Emma', 'Olivia', 'Charlotte', 'Léa', 'Chloé', 'Amira', 'Priya', 'Sofia', 'Ava', 'Zoé', 'Camille', 'Aaliyah', 'Mei', 'Hana', 'Nadia', 'Jasmine', 'Rosalie', 'Grace', 'Elena', 'Maëlle', 'Kiara', 'Tessa', 'Noor', 'Isabelle', 'Brooke'];
  const LN = ['Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Pelletier', 'Smith', 'Brown', 'Wilson', 'MacDonald', 'Campbell', 'Anderson', 'Taylor', 'Thompson', 'Martin', 'White', 'Singh', 'Patel', 'Sharma', 'Nguyen', 'Tran', 'Chen', 'Wang', 'Kim', 'Park', 'Ahmed', 'Ali', 'Mensah', 'Okafor', 'Diallo', 'Santos', 'Silva', 'Rodriguez', 'Novak', 'Rossi', 'Murphy', 'Kelly', 'Sullivan', 'Cardinal', 'Francis', 'Daigle', 'Leblanc', 'Cormier', 'Arsenault', 'Boudreau', 'MacNeil'];
  const PROVS = [['ON', 46], ['QC', 35], ['BC', 19], ['NS', 12], ['AB', 10], ['MB', 9], ['NB', 2], ['SK', 2]];
  const COACH_PROVS = [['ON', 32], ['QC', 21], ['NS', 14], ['BC', 10], ['AB', 4], ['MB', 3], ['SK', 2], ['NB', 1]];
  const MEN = [['50', 3], ['55', 8], ['60', 10], ['65', 12], ['70', 15], ['75', 7], ['80', 7], ['85', 9], ['90', 9], ['90+', 6]];
  const WOMEN = [['48', 3], ['51', 5], ['54', 6], ['57', 9], ['60', 5], ['65', 7], ['70', 11], ['75', 0], ['80', 1], ['80+', 2]];
  const COACH_LEVELS = [['Competition Development (Certified)', 17, 'lv-ntc'], ['Instruction-Beginner (Certified)', 13, 'lv-cc'], ['Competition-Introduction (Certified)', 12, 'lv-pc'], ['Competition Development (Trained)', 11, 'lv-pc'], ['Competition-Introduction (In Training)', 10, 'lv-cc'], ['Competition Development (In Training)', 8, 'lv-pc'], ['Competition-Introduction (Trained)', 8, 'lv-cc'], ['Instruction-Beginner (Trained)', 4, 'lv-ci'], ['Instruction-Beginner (In Training)', 4, 'lv-ci']];
  const expand = list => list.flatMap(([v, n, x]) => Array.from({ length: n }, () => x !== undefined ? [v, x] : v));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clubsFor = p => { const base = (PROVINCE_INFO[p].clubs || []).map(c => c[1]); const extra = ['Northside', 'Harbourfront', 'Iron Gate', 'Summit', 'Riverside', 'Southpaw', 'Lionheart', 'Eastside'].map(w => `${w} Boxing ${p === 'QC' ? 'Club' : 'Academy'}`); return [...base, ...extra]; };
  const used = new Set(d.users.map(u => u.email));
  const mkEmail = (f, l) => { let base = (f + '.' + l).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z.]/g, ''); let e = `${base}@example.ca`, n = 2; while (used.has(e)) e = `${base}${n++}@example.ca`; used.add(e); return e; };
  // coaches
  const coachProvs = shuffle(expand(COACH_PROVS)), coachLv = shuffle(expand(COACH_LEVELS));
  const coaches = coachProvs.map((p, i) => {
    const g = rnd() < 0.14 ? 'F' : 'M', first = pick(g === 'F' ? FF : FM), last = pick(LN);
    const [lvText, lvId] = coachLv[i];
    const u = { id: 'nat-c' + (i + 1), firstName: first, lastName: last, role: 'coach', gender: g, dob: `${1965 + Math.floor(rnd() * 30)}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`, province: p, email: mkEmail(first, last), membershipId: 'BC-COA-' + (3000 + i), password: 'Password123!', status: 'approved', club: pick(clubsFor(p)), nccp: String(9800000 + i * 113), certs: { 'prog-coach': lvId }, evaluatorPrograms: [], trackieCoachLevel: lvText, testData: 'nationals-2026' };
    u.trackie = trackieFromUser(u); u.trackieSyncedAt = '2026-11-03T07:08:19';
    return u;
  });
  // boxers
  const slots = shuffle([...expand(MEN).map(w => ['M', w]), ...expand(WOMEN).map(w => ['F', w])]);
  const provs = shuffle(expand(PROVS));
  const wild = new Set(shuffle(slots.map((_, i) => i)).filter(i => true).slice(0, 0));
  let wildM = 10, wildF = 4;
  const boxers = [], meds = [], scats = [], entries = {};
  slots.forEach(([g, w], i) => {
    const p = provs[i], first = pick(g === 'F' ? FF : FM), last = pick(LN);
    const age = Math.min(39, Math.max(18, Math.round(18 + Math.pow(rnd(), 1.7) * 21)));
    const dob = `${2025 - age}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
    const provCoaches = coaches.filter(c => c.province === p);
    const coach = provCoaches.length ? pick(provCoaches) : pick(coaches);
    const id = 'nat-b' + (i + 1);
    const u = { id, firstName: first, lastName: last, role: 'boxer', gender: g, dob, province: p, email: mkEmail(first, last), membershipId: 'BC-2026-' + (6000 + i), password: 'Password123!', status: 'approved', selectedCoachIds: [coach.id], club: coach.club, classification: 'open', certs: {}, evaluatorPrograms: [], nationalTeam: null, ntHistory: [], testData: 'nationals-2026' };
    u.trackie = trackieFromUser(u); u.trackie['TOTAL NUMBER OF OLYMPIC-STYLE OR AMATEUR BOXING BOUTS'] = String(10 + Math.floor(rnd() * 60)); u.trackieSyncedAt = '2026-11-03T07:07:54';
    boxers.push(u);
    const exam = addDays('2026-01-05', Math.floor(rnd() * 280));
    meds.push(seedMedical({ id: 'nat-am' + (i + 1), boxerId: id, examDate: exam, female: g === 'F', physicianName: 'Dr. ' + pick(FF.concat(FM)) + ' ' + pick(LN), license: `${PROVINCE_INFO[p].college.match(/\(([^)]+)\)/) ? PROVINCE_INFO[p].college.match(/\(([^)]+)\)/)[1] : 'Lic.'} #${10000 + Math.floor(rnd() * 89999)}`, clinicAddress: `Sport medicine clinic, ${(PROV_CITY[p] || ['Canada'])[0]} ${p}`, bp: `${110 + Math.floor(rnd() * 18)}/${68 + Math.floor(rnd() * 14)}`, hr: String(50 + Math.floor(rnd() * 20)) }));
    const cat = (g === 'F' ? 'Elite Women ' : 'Elite Men ') + w + ' kg';
    const isWild = (g === 'M' && wildM > 0 && rnd() < 0.12 && wildM--) || (g === 'F' && wildF > 0 && rnd() < 0.1 && wildF--);
    entries[id] = { weightClass: cat, wildcard: !!isWild };
    if (rnd() < 0.7) scats.push({ id: 'nat-sc' + (i + 1), boxerId: id, by: coach.id, at: `2026-10-${18 + Math.floor(rnd() * 7)}T${String(17 + Math.floor(rnd() * 4))}:${String(10 + Math.floor(rnd() * 49))}:00`, context: 'Competition requirement: 2026 Elite Nationals', status: 'clear', required: false, emergency: false, lang: p === 'QC' ? 'fr' : 'en', reasons: [], scores: { redFlags: 0, signs: 0, symCount: 0, symTotal: 0, orient: 3, imm: 5, del: 4 + Math.floor(rnd() * 2), digits: 4 + Math.floor(rnd() * 3), months: true, delaySec: 300 + Math.floor(rnd() * 200) }, followUp: null });
  });
  const classes = [...MEN.filter(x => x[1]).map(([w]) => `Elite Men ${w} kg`), ...WOMEN.filter(x => x[1]).map(([w]) => `Elite Women ${w} kg`)];
  d.users.push(...coaches, ...boxers);
  d.annualMedicals.push(...meds);
  d.scatScreens = [...(d.scatScreens || []), ...scats];
  d.events.push({ id: 'e-nat-2026', name: '2026 Elite Nationals', province: 'NS', date: '2026-11-17', endDate: '2026-11-21', firstPreBoutCheckDateTime: '2026-11-17T09:00', firstBoutTime: '12:00', location: 'Sydney, Cape Breton, Nova Scotia', weightClasses: classes, registeredBoxerIds: boxers.map(b => b.id), entries, officials: [{ userId: 'u-o1', checkedIn: false, roles: ['Referee', 'Judge'] }, { userId: 'u-o2', checkedIn: false, roles: ['TD/Supervisor'] }], physicianIds: ['u-m1'], medicalRoles: { 'u-m1': { checkedIn: false, roles: ['Ringside Practitioner', 'Pre Bout Checks', 'Post Bout Checks'] } }, bouts: [], sanctionId: null, sanctionLevel: 'NSO', scatRequired: true, scatWithinDays: 30, livestreamUrl: 'https://live.boxingcanada.example/elite-nationals-2026', isPublic: true, testData: 'nationals-2026' });
  return d;
}
function upgradeTo19(d) {
  // The earlier placeholder national event is replaced by the Nationals test event.
  d.events = d.events.filter(e => e.id !== 'e-5');
  makeNationals2026(d); d.version = 19; return d;
}

/* ---------- Boxers choose their own coaches ---------- */
function CoachPickerBody({ boxerId }) {
  const { data, update, viewer, notify } = useApp();
  const b = getUser(data, boxerId);
  const [q, setQ] = useState(''); const [prov, setProv] = useState(b.province);
  const mine = (b.selectedCoachIds || []).map(id => getUser(data, id)).filter(Boolean);
  const term = q.trim().toLowerCase();
  const pool = data.users.filter(u => u.role === 'coach' && u.status === 'approved' && !(b.selectedCoachIds || []).includes(u.id) && (!prov || u.province === prov) && (!term || (fullName(u) + ' ' + (u.club || '')).toLowerCase().includes(term))).sort((x, y) => x.lastName.localeCompare(y.lastName));
  const self = viewer.id === b.id;
  const add = c => { update(d => { const x = d.users.find(u => u.id === b.id); x.selectedCoachIds = [...new Set([...(x.selectedCoachIds || []), c.id])]; logCoach(d, b.id, c.id, 'added', 'Administrator change', viewer.id, fullName(viewer)); notifyUsers(d, c.id, `${fullName(b)} added you as their coach. You can now see their Record Book and co-sign their pre-bout forms.`, 'DASHBOARD'); }); notify(`${fullName(c)} is now ${self ? 'your' : `${b.firstName}’s`} coach.`); };
  const remove = c => { update(d => { const x = d.users.find(u => u.id === b.id); x.selectedCoachIds = (x.selectedCoachIds || []).filter(id => id !== c.id); logCoach(d, b.id, c.id, 'removed', 'Administrator change', viewer.id, fullName(viewer)); notifyUsers(d, c.id, `${fullName(b)} removed you as their coach.`, 'DASHBOARD'); }); notify(`${fullName(c)} removed.`, 'info'); };
  return <div className="space-y-4">
      <section>
        <h4 className="mb-2 font-display text-base font-bold">Current coaches</h4>
        {mine.length ? <ul className="divide-y divide-line rounded-md border border-line">{mine.map(c => <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"><span aria-hidden="true">📋</span><span className="font-semibold">{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><CoachLevelBadge u={c} /><ProvBadge prov={c.province} home={b.province} /><Btn size="xs" variant="danger" className="ml-auto" onClick={() => remove(c)}>Remove</Btn></li>)}</ul> : <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-muted">No coach selected yet.</p>}
      </section>
      <section>
        <h4 className="mb-2 font-display text-base font-bold">Add a coach</h4>
        <div className="mb-2 flex flex-wrap gap-2"><input className="field max-w-xs" placeholder="Search coach name or club" value={q} onChange={e => setQ(e.target.value)} aria-label="Search coaches" /><select className="field w-auto" value={prov} onChange={e => setProv(e.target.value)} aria-label="Province"><option value="">All provinces</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></div>
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line">{pool.slice(0, 60).map(c => <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"><span className="font-semibold">{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><CoachLevelBadge u={c} /><ProvBadge prov={c.province} home={b.province} /><Btn size="xs" variant="rope" className="ml-auto" onClick={() => add(c)}>Add</Btn></li>)}{!pool.length && <li className="px-3 py-4 text-center text-sm text-muted">No coaches match.</li>}</ul>
        {pool.length > 60 && <p className="mt-1 text-xs text-muted">Showing 60 of {pool.length}. Search to narrow the list.</p>}
      </section>
    </div>;
}
function CoachPickerModal({ boxerId, onClose }) {
  const { data, viewer } = useApp();
  const b = getUser(data, boxerId);
  return <Modal size="lg" title={viewer.id === b.id ? 'My Coaches' : `${b.firstName}’s Coaches`} subtitle="Coaches can see this Record Book, co-sign pre-bout forms, enter the boxer in events and request a move to Open." onClose={onClose} footer={<Btn onClick={onClose}>Done</Btn>}><CoachPickerBody boxerId={boxerId} /></Modal>;
}
function MyCoachesView() {
  const { viewer } = useApp();
  return <BoxerCoachesView boxerId={viewer.id} />;
  return <Section logo title="My Coaches" sub="Choose the coaches you train with. Your coaches can see your Record Book, co-sign your pre-bout forms, enter you in events and request your move to Open. You can add or remove a coach at any time."><CoachPickerBody boxerId={viewer.id} /></Section>;
}

/* =========================================================
   Boxer–coach relationships
   Boxers request a coach; the coach accepts or declines.
   Ending works the same way, or urgently through a PTSO/NSO
   Administrator. For boxers under 18, a parent or guardian
   approves every change by email link, and can end a coach
   relationship immediately from the Parents & Guardians page.
   ========================================================= */
const CR_STATUS = {
  awaiting_guardian: { tone: 'warn', label: 'Awaiting parent/guardian approval' },
  pending_coach: { tone: 'info', label: 'Awaiting the coach' },
  pending_boxer: { tone: 'info', label: 'Awaiting the boxer' },
  pending_both: { tone: 'info', label: 'Awaiting the boxer and coach' },
  pending_admin: { tone: 'warn', label: 'Awaiting a PTSO/NSO administrator' },
  accepted: { tone: 'ok', label: 'Accepted' },
  declined: { tone: 'bad', label: 'Declined' },
  cancelled: { tone: 'neutral', label: 'Cancelled' }
};
const CR_TYPE = { start: 'Start coaching', end: 'End coaching', 'end-urgent': 'Urgent removal' };
const isMinorBoxer = b => ageOn(b.dob, REF_DATE) < 18;
const guardianEmailOf = b => trackieOf(b)['PARENT/GUARDIAN EMAIL'] || '';
const crOpen = r => ['awaiting_guardian', 'pending_coach', 'pending_boxer', 'pending_both', 'pending_admin'].includes(r.status);
const crFromCoach = r => r.requestedBy && r.requestedBy === r.coachId;
function queueGuardianAccess(d, b, why) {
  const email = guardianEmailOf(b); if (!email) return null;
  const code = genCode();
  d.guardianCodes = (d.guardianCodes || []).filter(g => !(g.boxerId === b.id && g.usedUp));
  d.guardianCodes.push({ code, boxerId: b.id, email, createdAt: nowIso(), expiresAt: new Date(Date.now() + 7 * DAY).toISOString() });
  d.outbox = d.outbox || [];
  const link = (() => { let base = ''; try { base = window.location.origin + window.location.pathname; } catch (e) {} return base + '#guardian-' + code; })();
  d.outbox.unshift({ id: uid('mail'), kind: 'guardian', to: email, userId: b.id, code, at: nowIso(), subject: `Boxing Canada: ${b.firstName}’s coach relationships`,
    body: `Hello,\n\n${why}\n\nAs the parent or guardian of ${fullName(b)} (${b.membershipId}), you approve coach changes while they are under 18. You can also end any coach relationship immediately.\n\nOpen this link: ${link}\nOr go to the portal, choose “Parents & Guardians” and enter this code: ${code}\n\nThe link works for 7 days.\n\nBoxing Canada` });
  return code;
}
function crNotifyNext(d, r) {
  const b = d.users.find(u => u.id === r.boxerId), c = d.users.find(u => u.id === r.coachId);
  if (!b || !c) return;
  if (r.status === 'pending_both') { const what = r.type === 'start' ? `that ${fullName(c)} coach ${fullName(b)}` : `ending coaching between ${fullName(c)} and ${fullName(b)}`; if (!r.accepts.boxer) notifyUsers(d, b.id, `Club manager ${r.requestedByName} (${r.clubName}) proposed ${what}. Please respond on My Coaches.`, 'COACHES'); if (!r.accepts.coach) notifyUsers(d, c.id, `Club manager ${r.requestedByName} (${r.clubName}) proposed ${what}. Please respond on My Boxers.`, 'BOXERS'); }
  if (r.status === 'pending_boxer') notifyUsers(d, b.id, `${fullName(c)} invited you to add them as your coach. Accept or decline on My Coaches.`, 'COACHES');
  if (r.status === 'pending_coach') notifyUsers(d, c.id, r.type === 'start' ? `${fullName(b)} asked you to be their coach. Accept or decline on My Boxers.` : `${fullName(b)} asked to end your coaching relationship. Please confirm on My Boxers.`, 'BOXERS');
  if (r.status === 'pending_admin') { d.users.filter(u => u.role === 'ptso' && u.province === b.province && u.status === 'approved').forEach(p => notifyUsers(d, p.id, `Urgent coach removal requested: ${fullName(b)} and ${fullName(c)}.`, 'USERS')); notifyUsers(d, 'role:nsoadmin', `Urgent coach removal requested: ${fullName(b)} and ${fullName(c)} (${b.province}).`, 'USERS'); }
  if (r.status === 'awaiting_guardian') queueGuardianAccess(d, b, r.type === 'start' ? (crFromCoach(r) ? `Coach ${fullName(c)} invited ${b.firstName} to train with them.` : `${b.firstName} asked ${fullName(c)} to be their coach.`) : `${b.firstName} asked to end coaching with ${fullName(c)}.`);
}
function crCreate(d, { boxerId, coachId, type, by, note, viaClub, clubName }) {
  const b = d.users.find(u => u.id === boxerId);
  const fromCoach = by && by === coachId;
  const status = type === 'end-urgent' ? 'pending_admin' : (isMinorBoxer(b) && guardianEmailOf(b) ? 'awaiting_guardian' : viaClub ? 'pending_both' : fromCoach ? 'pending_boxer' : 'pending_coach');
  const r = { id: uid('rel'), boxerId, coachId, type, status, requestedBy: by, otherCoaches: (b.selectedCoachIds || []).filter(id => id !== coachId).map(id => coachSnap(d, id)), at: nowIso(), pendingCoachAt: status === 'pending_coach' ? nowIso() : null, note: note || '', history: [{ at: nowIso(), by, text: 'Requested' }] };
  d.coachRequests = d.coachRequests || []; d.coachRequests.unshift(r);
  if (viaClub) { r.viaClub = true; r.clubName = clubName; r.requestedByName = nameOf(d, by); r.accepts = { boxer: false, coach: by === coachId }; if (r.status === 'pending_coach' || r.status === 'pending_boxer') r.status = 'pending_both'; }
  crNotifyNext(d, r);
  return r;
}
function crFinish(d, r, accepted, by, reason, byName) {
  try { if (accepted || r.type === 'start') logCoach(d, r.boxerId, r.coachId, accepted ? (r.type === 'start' ? 'added' : 'removed') : 'declined', crVia(d, r, accepted, by), by, byName, r.type === 'end-urgent' ? '' : r.note); } catch (e) {}
  r.status = accepted ? 'accepted' : 'declined'; r.decidedBy = by; r.decidedByName = byName || ''; r.decidedAt = nowIso(); r.reason = reason || '';
  r.history.push({ at: nowIso(), by, byName, text: accepted ? 'Accepted' : `Declined${reason ? ': ' + reason : ''}` });
  const b = d.users.find(u => u.id === r.boxerId), c = d.users.find(u => u.id === r.coachId);
  if (accepted) {
    if (r.type === 'start') b.selectedCoachIds = [...new Set([...(b.selectedCoachIds || []), r.coachId])];
    else b.selectedCoachIds = (b.selectedCoachIds || []).filter(id => id !== r.coachId);
  }
  if (r.viaClub) { const msg = r.immediate ? `${fullName(c)} and ${fullName(b)} are no longer in a coaching relationship (ended by the club manager).` : `Club proposal (${CR_TYPE[r.type].toLowerCase()}) for ${fullName(b)} and ${fullName(c)} was ${accepted ? 'accepted by both' : 'declined'}.`; [b.id, c.id, r.requestedBy].filter((v, i, a) => v && a.indexOf(v) === i).forEach(id => notifyUsers(d, id, msg, id === b.id ? 'COACHES' : id === r.requestedBy ? 'CLUB' : 'BOXERS')); return; }
  if (r.type === 'start' && crFromCoach(r)) { notifyUsers(d, c.id, accepted ? `${fullName(b)} accepted. They’re now one of your boxers.` : `${fullName(b)}’s coaching request was declined${reason ? ': ' + reason : '.'}`, 'BOXERS'); if (accepted) notifyUsers(d, b.id, `${fullName(c)} is now your coach.`, 'COACHES'); return; }
  const what = r.type === 'start' ? `coaching relationship with ${fullName(c)}` : `request to end coaching with ${fullName(c)}`;
  notifyUsers(d, b.id, accepted ? (r.type === 'start' ? `${fullName(c)} is now your coach.` : `Your coaching relationship with ${fullName(c)} has ended.`) : `Your ${what} was declined${reason ? ': ' + reason : '.'}`, 'COACHES');
  if (r.type !== 'start' && accepted && by !== c.id) notifyUsers(d, c.id, `Your coaching relationship with ${fullName(b)} has ended.`, 'DASHBOARD');
}
function crGuardianDecision(d, r, approve, guardianName) {
  r.history.push({ at: nowIso(), byName: `Parent/guardian (${guardianName || 'by email link'})`, text: approve ? 'Approved by parent/guardian' : 'Declined by parent/guardian' });
  if (!approve) { crFinish(d, r, false, null, 'Not approved by parent or guardian', 'Parent/guardian'); return; }
  if (r.viaClub) r.status = 'pending_both'; else if (crFromCoach(r)) r.status = 'pending_boxer'; else { r.status = 'pending_coach'; r.pendingCoachAt = nowIso(); }
  crNotifyNext(d, r);
}
function upgradeTo20(d) {
  if (!d.coachRequests) {
    d.coachRequests = [];
    const at = '2026-10-22T18:30:00';
    d.coachRequests.push({ id: 'rel-1', boxerId: 'u-b1', coachId: 'u-c2', type: 'start', status: 'pending_coach', requestedBy: 'u-b1', at, note: 'I’m training in Montréal on weekends this winter and would like Sarah’s help preparing for Nationals.', history: [{ at, by: 'u-b1', text: 'Requested' }] });
    const at2 = '2026-10-23T16:00:00';
    d.coachRequests.push({ id: 'rel-2', boxerId: 'u-b2', coachId: 'u-c4', type: 'start', status: 'awaiting_guardian', requestedBy: 'u-b2', at: at2, note: 'Priya runs the youth group at Lakeshore, where I train on Tuesdays.', history: [{ at: at2, by: 'u-b2', text: 'Requested' }] });
    const maya = d.users.find(u => u.id === 'u-b2');
    if (maya && guardianEmailOf(maya)) {
      d.guardianCodes = d.guardianCodes || [];
      d.guardianCodes.push({ code: 'GRDMK7Q2', boxerId: 'u-b2', email: guardianEmailOf(maya), createdAt: at2, expiresAt: '2026-12-31T23:59:00Z' });
      d.outbox = d.outbox || [];
      d.outbox.unshift({ id: 'mail-g1', kind: 'guardian', to: guardianEmailOf(maya), userId: 'u-b2', code: 'GRDMK7Q2', at: at2, subject: 'Boxing Canada: Maya’s coach relationships', body: `Hello,\n\nMaya asked Priya Shah to be their coach.\n\nAs the parent or guardian of Maya Kowalski (BC-2025-7734), you approve coach changes while they are under 18. You can also end any coach relationship immediately.\n\nOpen this link: #guardian-GRDMK7Q2\nOr go to the portal, choose “Parents & Guardians” and enter this code: GRDMK7Q2\n\nThe link works for 7 days.\n\nBoxing Canada` });
    }
    const at3 = '2026-10-23T21:10:00';
    d.coachRequests.push({ id: 'rel-3', boxerId: 'u-b6', coachId: 'u-c1', type: 'end-urgent', status: 'pending_admin', requestedBy: 'u-b6', at: at3, note: 'My family has moved and I no longer train at this club. I’d like the coach removed from my Record Book now rather than waiting.', history: [{ at: at3, by: 'u-b6', text: 'Requested' }] });
  }
  d.guardianCodes = d.guardianCodes || [];
  d.version = 20; return d;
}

function BoxerCoachesView({ boxerId }) {
  const { data, update, viewer, notify } = useApp();
  const b = getUser(data, boxerId);
  const [q, setQ] = useState(''); const [prov, setProv] = useState(b.province);
  const [compose, setCompose] = useState(null); // { type, coach }
  const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const minor = isMinorBoxer(b), gEmail = guardianEmailOf(b);
  const reqs = (data.coachRequests || []).filter(r => r.boxerId === b.id);
  const open = reqs.filter(crOpen);
  const coaches = (b.selectedCoachIds || []).map(id => getUser(data, id)).filter(Boolean);
  const term = q.trim().toLowerCase();
  const pool = data.users.filter(u => u.role === 'coach' && u.status === 'approved' && !(b.selectedCoachIds || []).includes(u.id) && !open.some(r => r.coachId === u.id) && (!prov || u.province === prov) && (!term || (fullName(u) + ' ' + (u.club || '')).toLowerCase().includes(term))).sort((x, y) => x.lastName.localeCompare(y.lastName));
  const send = () => {
    if (compose.type === 'end-urgent' && note.trim().length < 10) { setErr('Briefly explain why the relationship needs to end right away.'); return; }
    update(d => crCreate(d, { boxerId: b.id, coachId: compose.coach.id, type: compose.type, by: viewer.id, note: note.trim() }));
    notify(compose.type === 'end-urgent' ? 'Urgent request sent to your PTSO and Boxing Canada administrators.' : minor && gEmail ? 'Request sent. Your parent or guardian has been emailed to approve it first.' : `Request sent to ${fullName(compose.coach)}.`);
    setCompose(null); setNote(''); setErr('');
  };
  const cancel = r => update(d => { const x = d.coachRequests.find(y => y.id === r.id); x.status = 'cancelled'; x.history.push({ at: nowIso(), by: viewer.id, text: 'Cancelled' }); });
  const askGuardian = () => { update(d => queueGuardianAccess(d, b, `${b.firstName} asked you to review their coach relationships.`)); notify(`An email with a secure link was sent to your parent or guardian (${maskEmail(gEmail)}).`); };
  const openFor = c => open.find(r => r.coachId === c.id);
  return <div className="space-y-4">
    {minor && <Banner tone="info">Because you’re under 18, your parent or guardian approves every coach change by email{gEmail ? ` (${maskEmail(gEmail)})` : ''}. They can also end a coach relationship immediately.{gEmail ? <> <button type="button" className="font-semibold underline" onClick={askGuardian}>Email them a link now</button>.</> : ' No parent or guardian email is on your membership record. Ask your PTSO to add one.'}</Banner>}
    <Section title="Current coaches" sub="Coaches can see your Record Book, co-sign your pre-bout forms, enter you in events and request your move to Open.">
      {coaches.length ? <ul className="divide-y divide-line rounded-md border border-line">{coaches.map(c => { const pr = openFor(c); return <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
        <span aria-hidden="true">📋</span><span className="font-semibold">{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><CoachLevelBadge u={c} /><ProvBadge prov={c.province} home={b.province} />
        <span className="ml-auto flex flex-wrap gap-1.5">{pr ? <Badge tone={CR_STATUS[pr.status].tone}>{CR_TYPE[pr.type]}: {CR_STATUS[pr.status].label}</Badge> : <><Btn size="xs" onClick={() => { setCompose({ type: 'end', coach: c }); setNote(''); setErr(''); }}>Request to end</Btn><Btn size="xs" variant="danger" onClick={() => { setCompose({ type: 'end-urgent', coach: c }); setNote(''); setErr(''); }}>Ask an administrator to remove now</Btn></>}</span>
      </li>; })}</ul> : <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-muted">You don’t have a coach yet. Request one below.</p>}
    </Section>
    {compose && <Section title={compose.type === 'start' ? `Ask ${fullName(compose.coach)} to be your coach` : compose.type === 'end' ? `Ask to end coaching with ${fullName(compose.coach)}` : `Urgent removal of ${fullName(compose.coach)}`} sub={compose.type === 'start' ? `${minor && gEmail ? 'Your parent or guardian approves first, then ' : ''}${compose.coach.firstName} accepts or declines.` : compose.type === 'end' ? `${minor && gEmail ? 'Your parent or guardian approves first, then ' : ''}${compose.coach.firstName} confirms. Until then they remain your coach.` : `Goes straight to a ${PROVINCE_INFO[b.province].ptso} or Boxing Canada administrator, who can end the relationship immediately without the coach’s agreement. Use this if you’re uncomfortable or unsafe, or the coach isn’t responding. For Safe Sport concerns, also call or text the Canadian Sport Helpline at 1-888-837-7678, or see the Safe Sport section to make a confidential report.`}>
      {err && <Banner tone="bad" className="mb-2" onClose={() => setErr('')}>{err}</Banner>}
      <Field label={compose.type === 'end-urgent' ? 'Why does it need to end now?' : 'Message (optional)'} required={compose.type === 'end-urgent'} hint={compose.type === 'end-urgent' ? 'Only administrators see this. The coach is told the relationship ended, not why.' : 'Shared with the coach.'}><textarea rows={3} className="field" value={note} onChange={e => setNote(e.target.value)} /></Field>
      <div className="mt-2 flex justify-end gap-2"><Btn onClick={() => setCompose(null)}>Cancel</Btn><Btn variant={compose.type === 'end-urgent' ? 'danger' : 'primary'} onClick={send}>{compose.type === 'start' ? 'Send request' : compose.type === 'end' ? 'Send request to end' : 'Send urgent request'}</Btn></div>
    </Section>}
    {(() => { const inv = open.filter(r => r.status === 'pending_boxer' || (r.status === 'pending_both' && !r.accepts.boxer)); return inv.length > 0 && <Section title="Coach invitations" sub="Coaches who asked to coach you." actions={<Badge tone="warn">{inv.length} waiting</Badge>}>
      <div className="space-y-2">{inv.map(r => { const c = getUser(data, r.coachId); return <div key={r.id} className="rounded-md border border-line p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><CoachLevelBadge u={c} /><ProvBadge prov={c.province} home={b.province} /></div>{r.note && <p className="mt-1 text-sm">“{r.note}”</p>}{r.history.some(h => /parent\/guardian/i.test(h.text)) && <p className="mt-1 text-xs text-ok">✓ Approved by your parent or guardian</p>}<div>{r.viaClub && <p className="mt-1 text-xs font-semibold">Proposed by club manager {r.requestedByName} ({r.clubName}): {r.type === 'start' ? 'start coaching' : 'end coaching'}. {r.accepts.coach ? 'The coach has accepted.' : 'The coach must also accept.'}</p>}<div className="mt-2 flex justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => { update(d => { const x = d.coachRequests.find(y => y.id === r.id); r.viaClub ? crAcceptParty(d, x, 'boxer', false, viewer.id, fullName(viewer)) : crFinish(d, x, false, viewer.id, '', fullName(viewer)); }); notify('Declined.', 'info'); }}>Decline</Btn><Btn size="sm" variant="ok" onClick={() => { update(d => { const x = d.coachRequests.find(y => y.id === r.id); r.viaClub ? crAcceptParty(d, x, 'boxer', true, viewer.id, fullName(viewer)) : crFinish(d, x, true, viewer.id, '', fullName(viewer)); }); notify(r.viaClub ? 'Accepted.' : `${fullName(c)} is now your coach.`); }}>Accept</Btn></div></div></div>; })}</div>
    </Section>; })()}
    {open.filter(r => !(r.status === 'pending_boxer' || (r.status === 'pending_both' && !r.accepts.boxer))).length > 0 && <Section title="Your requests in progress">
      <ul className="divide-y divide-line rounded-md border border-line">{open.filter(r => !(r.status === 'pending_boxer' || (r.status === 'pending_both' && !r.accepts.boxer))).map(r => { const c = getUser(data, r.coachId); return <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"><span className="font-semibold">{CR_TYPE[r.type]}: {fullName(c)}</span><Badge tone={CR_STATUS[r.status].tone}>{CR_STATUS[r.status].label}</Badge><span className="text-xs text-muted">since {fmtDate(r.at.slice(0, 10))}{r.type === 'end' && r.status === 'pending_coach' ? `; ends automatically on ${fmtDate(crAutoDate(r))} if the coach doesn’t respond` : ''}</span>{r.requestedBy === viewer.id && <Btn size="xs" variant="ghost" className="ml-auto" onClick={() => cancel(r)}>Cancel request</Btn>}</li>; })}</ul>
    </Section>}
    <Section title="Request a coach" sub="Search for the coach you train with and send them a request. Coaches from other provinces are fine, for example a provincial or national team coach on an international tour.">
      <div className="mb-2 flex flex-wrap gap-2"><input className="field max-w-xs" placeholder="Search coach name or club" value={q} onChange={e => setQ(e.target.value)} aria-label="Search coaches" /><select className="field w-auto" value={prov} onChange={e => setProv(e.target.value)} aria-label="Province"><option value="">All provinces</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line">{pool.slice(0, 60).map(c => <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"><span className="font-semibold">{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><CoachLevelBadge u={c} /><ProvBadge prov={c.province} home={b.province} /><Btn size="xs" variant="rope" className="ml-auto" onClick={() => { setCompose({ type: 'start', coach: c }); setNote(''); setErr(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Request</Btn></li>)}{!pool.length && <li className="px-3 py-4 text-center text-sm text-muted">No coaches match.</li>}</ul>
    </Section>
    {reqs.filter(r => !crOpen(r)).length > 0 && <details className="rounded-md border border-line bg-surface"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Past requests ({reqs.filter(r => !crOpen(r)).length})</summary><ul className="divide-y divide-line border-t border-line text-sm">{reqs.filter(r => !crOpen(r)).map(r => <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2"><span>{CR_TYPE[r.type]}: {nameOf(data, r.coachId)}</span><Badge tone={CR_STATUS[r.status].tone}>{CR_STATUS[r.status].label}</Badge>{r.reason && <span className="text-xs text-muted">{r.reason}</span>}<span className="ml-auto text-xs text-muted">{fmtDate((r.decidedAt || r.at).slice(0, 10))}</span></li>)}</ul></details>}
  </div>;
}

function CoachRequestsInbox() {
  const { data, update, viewer, notify } = useApp();
  const [declining, setDeclining] = useState(null); const [reason, setReason] = useState('');
  const mine = (data.coachRequests || []).filter(r => r.coachId === viewer.id && (r.status === 'pending_coach' || (r.status === 'pending_both' && !r.accepts.coach)));
  if (!mine.length) return null;
  const decide = (r, ok) => { update(d => { const x = d.coachRequests.find(y => y.id === r.id); if (x.status === 'pending_both') crAcceptParty(d, x, 'coach', ok, viewer.id, fullName(viewer), ok ? '' : reason.trim()); else crFinish(d, x, ok, viewer.id, ok ? '' : reason.trim(), fullName(viewer)); }); notify(ok ? (r.type === 'start' ? `${nameOf(data, r.boxerId)} is now one of your boxers.` : `Coaching relationship with ${nameOf(data, r.boxerId)} ended.`) : 'Request declined.', ok ? 'ok' : 'info'); setDeclining(null); setReason(''); };
  return <Section title="Boxer requests" sub="Boxers who asked you to start or end a coaching relationship." actions={<Badge tone="warn">{mine.length} waiting</Badge>}>
    <div className="space-y-2">{mine.map(r => { const b = getUser(data, r.boxerId); return <div key={r.id} className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={r.type === 'start' ? 'info' : 'warn'}>{r.viaClub ? (r.type === 'start' ? `Club proposal: coach this boxer` : 'Club proposal: end coaching') : r.type === 'start' ? 'Wants you as coach' : 'Wants to end coaching'}</Badge>{r.viaClub && <span className="text-xs text-muted">from {r.requestedByName}, {r.clubName}{r.accepts && r.accepts.boxer ? '; the boxer has accepted' : ''}</span>}<span className="font-semibold">{fullName(b)}</span><span className="text-xs text-muted">age {ageOn(b.dob, REF_DATE)}, {b.club || '—'}, {b.province}, {b.membershipId}</span><span className="ml-auto text-xs text-muted">{fmtStamp(r.at)}</span></div>
      {r.note && <p className="mt-1.5 max-w-prose text-sm">“{r.note}”</p>}
      {r.type === 'start' && <OtherCoachesNote r={r} b={b} />}
      {r.type === 'end' && <p className="mt-1 text-xs font-semibold text-warn">If you don’t respond, this ends automatically on {fmtDate(crAutoDate(r))}.</p>}
      {r.history.some(h => /parent\/guardian/i.test(h.text)) && <p className="mt-1 text-xs text-ok">✓ Approved by the boxer’s parent or guardian</p>}
      {declining === r.id ? <div className="mt-2 space-y-2"><Field label="Reason (optional, shared with the boxer)"><input className="field" value={reason} onChange={e => setReason(e.target.value)} /></Field><div className="flex justify-end gap-2"><Btn size="sm" onClick={() => setDeclining(null)}>Back</Btn><Btn size="sm" variant="danger" onClick={() => decide(r, false)}>Decline</Btn></div></div>
        : <div className="mt-2 flex justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => { setDeclining(r.id); setReason(''); }}>Decline</Btn><Btn size="sm" variant="ok" onClick={() => decide(r, true)}>{r.type === 'start' ? 'Accept' : 'Confirm end'}</Btn></div>}
    </div>; })}</div>
  </Section>;
}

function AdminCoachRequestsSection() {
  const { data, update, viewer, notify } = useApp();
  const [declining, setDeclining] = useState(null); const [reason, setReason] = useState('');
  const inScope = r => { const b = getUser(data, r.boxerId); return b && (viewer.role === 'nsoadmin' || b.province === viewer.province); };
  const urgent = (data.coachRequests || []).filter(r => r.status === 'pending_admin' && inScope(r));
  const waiting = (data.coachRequests || []).filter(r => (r.status === 'pending_coach' || r.status === 'awaiting_guardian') && inScope(r));
  if (!urgent.length && !waiting.length) return null;
  const decide = (r, ok) => { update(d => crFinish(d, d.coachRequests.find(y => y.id === r.id), ok, viewer.id, ok ? 'Ended by administrator' : reason.trim(), fullName(viewer))); notify(ok ? 'Coach relationship ended. The boxer and coach have been notified.' : 'Urgent request declined.', ok ? 'ok' : 'info'); setDeclining(null); setReason(''); };
  return <Section title="Coach relationship requests" sub="Urgent removals need you. Other requests are waiting on a coach or a parent, and are shown here so nothing stalls." actions={urgent.length > 0 && <Badge tone="bad">{urgent.length} urgent</Badge>}>
    {urgent.map(r => { const b = getUser(data, r.boxerId), c = getUser(data, r.coachId); return <div key={r.id} className="mb-2 rounded-md border-2 border-maple p-3">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="bad">Urgent removal</Badge><span className="font-semibold">{fullName(b)}</span><span className="text-xs text-muted">age {ageOn(b.dob, REF_DATE)}, {b.province}</span><span>and coach <b>{fullName(c)}</b></span><span className="ml-auto text-xs text-muted">{fmtStamp(r.at)}</span></div>
      <p className="mt-1.5 max-w-prose text-sm">“{r.note}”</p><p className="text-xs text-muted">Requested by {nameOf(data, r.requestedBy)}. The coach is not told the reason.</p>
      {declining === r.id ? <div className="mt-2 space-y-2"><Field label="Reason shared with the boxer" required><input className="field" value={reason} onChange={e => setReason(e.target.value)} /></Field><div className="flex justify-end gap-2"><Btn size="sm" onClick={() => setDeclining(null)}>Back</Btn><Btn size="sm" variant="danger" disabled={!reason.trim()} onClick={() => decide(r, false)}>Decline</Btn></div></div>
        : <div className="mt-2 flex justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => { setDeclining(r.id); setReason(''); }}>Decline</Btn><Btn size="sm" variant="danger" onClick={() => decide(r, true)}>End relationship now</Btn></div>}
    </div>; })}
    {waiting.length > 0 && <details className="rounded-md border border-line"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Waiting on coaches or parents ({waiting.length})</summary><ul className="divide-y divide-line border-t border-line text-sm">{waiting.map(r => <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2"><span>{CR_TYPE[r.type]}: <b>{nameOf(data, r.boxerId)}</b> and {nameOf(data, r.coachId)}</span><Badge tone={CR_STATUS[r.status].tone}>{CR_STATUS[r.status].label}</Badge><span className="text-xs text-muted">since {fmtDate(r.at.slice(0, 10))}</span>{viewer.role === 'nsoadmin' || viewer.role === 'ptso' ? <Btn size="xs" variant="ghost" className="ml-auto" onClick={() => { update(d => crFinish(d, d.coachRequests.find(y => y.id === r.id), true, viewer.id, 'Completed by administrator', fullName(viewer))); notify('Request completed by administrator.'); }}>Complete now</Btn> : null}</li>)}</ul></details>}
  </Section>;
}

function GuardianView({ initialCode }) {
  const { data, update, notify } = useApp();
  const [code, setCode] = useState(initialCode || '');
  const [active, setActive] = useState(initialCode || '');
  const [mid, setMid] = useState(''); const [email, setEmail] = useState(''); const [sent, setSent] = useState('');
  const [gName, setGName] = useState('');
  const [ending, setEnding] = useState(null); const [why, setWhy] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (initialCode) { setCode(initialCode); setActive(initialCode); } }, [initialCode]);
  useEffect(() => { if (WP) wpSetGuardian(String(active || '').trim().toUpperCase()); return () => { if (WP) wpSetGuardian(''); }; }, [active]);
  const g = (data.guardianCodes || []).find(x => x.code === String(active || '').trim().toUpperCase() && Date.parse(x.expiresAt) > Date.now());
  const b = g ? getUser(data, g.boxerId) : null;
  const requestLink = () => {
    const m = mid.trim().toUpperCase(), e = email.trim().toLowerCase();
    if (WP) { wpApi('guardian/request', { membershipId: m, email: e }).then(r => setSent(r.message)).catch(x => setSent(x.message)); return; }
    update(d => { const kid = d.users.find(u => u.role === 'boxer' && u.membershipId.toUpperCase() === m); if (kid && guardianEmailOf(kid).toLowerCase() === e && e) queueGuardianAccess(d, kid, 'You asked for access to your child’s coach relationships.'); });
    setSent('If that membership ID and email match our records, a secure link is on its way to that email.');
  };
  if (!b) return <div className="mx-auto max-w-lg space-y-4"><Section logo title="Parents & Guardians" sub="Approve coach changes for a boxer under 18, or end a coach relationship immediately.">
    {active && <Banner tone="bad" className="mb-3">That code isn’t valid or has expired. Request a new link below.</Banner>}
    <div className="space-y-3"><Field label="Code from your email"><input className="field font-mono uppercase tracking-widest" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" /></Field><Btn variant="primary" onClick={() => setActive(code)}>Continue</Btn></div>
    <div className="mt-5 border-t border-line pt-4"><h4 className="mb-2 font-display text-base font-bold">No code? Request a link</h4>{sent ? <Banner tone="info">{sent}</Banner> : <div className="space-y-2"><Field label="Your child’s Boxing Canada membership ID"><input className="field" value={mid} onChange={e => setMid(e.target.value)} placeholder="BC-2025-0000" /></Field><Field label="Your email (as registered on Trackie)"><input type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} /></Field><Btn size="sm" onClick={requestLink}>Send me a link</Btn></div>}</div>
  </Section></div>;
  const reqs = (data.coachRequests || []).filter(r => r.boxerId === b.id && r.status === 'awaiting_guardian');
  const coaches = (b.selectedCoachIds || []).map(id => getUser(data, id)).filter(Boolean);
  const decide = (r, ok) => { if (!gName.trim()) { setErr('Type your full name first; it’s recorded as your approval.'); return; } update(d => crGuardianDecision(d, d.coachRequests.find(y => y.id === r.id), ok, gName.trim())); notify(ok ? 'Approved. The coach will now be asked to confirm.' : 'Request declined.'); };
  const endNow = c => { if (!gName.trim()) { setErr('Type your full name first; it’s recorded with this decision.'); return; } update(d => { const r = crCreate(d, { boxerId: b.id, coachId: c.id, type: 'end', by: null, note: why.trim() }); r.history.push({ at: nowIso(), byName: `Parent/guardian (${gName.trim()})`, text: 'Ended immediately by parent/guardian' }); crFinish(d, r, true, null, 'Ended by parent or guardian', `Parent/guardian (${gName.trim()})`); d.users.filter(u => u.role === 'ptso' && u.province === b.province).forEach(p => notifyUsers(d, p.id, `A parent or guardian ended ${fullName(b)}’s coaching relationship with ${fullName(c)}.`, 'USERS')); }); notify(`${fullName(c)} is no longer ${b.firstName}’s coach.`); setEnding(null); setWhy(''); };
  return <div className="mx-auto max-w-2xl space-y-4">
    <Section logo title={`${b.firstName}’s coach relationships`} sub={`${fullName(b)}, ${b.membershipId}. Access for ${maskEmail(g.email)}, valid until ${fmtDate(g.expiresAt.slice(0, 10))}.`}>
      {err && <Banner tone="bad" className="mb-3" onClose={() => setErr('')}>{err}</Banner>}
      <Field label="Your full name (recorded with your decisions)"><input className="field max-w-sm" value={gName} onChange={e => setGName(e.target.value)} autoComplete="name" /></Field>
    </Section>
    <Section title="Waiting for your approval">
      {reqs.length ? <div className="space-y-2">{reqs.map(r => { const c = getUser(data, r.coachId); return <div key={r.id} className="rounded-md border border-line p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={r.type === 'start' ? 'info' : 'warn'}>{r.type === 'start' ? 'New coach' : 'End coaching'}</Badge><span className="font-semibold">{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><CoachLevelBadge u={c} /><ProvBadge prov={c.province} home={b.province} /></div>{r.note && <p className="mt-1 text-sm">{b.firstName} wrote: “{r.note}”</p>}<div className="mt-2 flex justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => decide(r, false)}>Decline</Btn><Btn size="sm" variant="ok" onClick={() => decide(r, true)}>Approve</Btn></div></div>; })}</div> : <p className="text-sm text-muted">Nothing is waiting for you.</p>}
    </Section>
    <Section title="Current coaches" sub="You can end a relationship immediately. The coach doesn’t need to agree, and isn’t told your reason.">
      {coaches.length ? <ul className="divide-y divide-line rounded-md border border-line">{coaches.map(c => <li key={c.id} className="px-3 py-2.5 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><CoachLevelBadge u={c} /><ProvBadge prov={c.province} home={b.province} />{ending !== c.id && <Btn size="xs" variant="danger" className="ml-auto" onClick={() => { setEnding(c.id); setWhy(''); }}>End relationship now</Btn>}</div>
        {ending === c.id && <div className="mt-2 space-y-2"><Field label="Reason (optional, seen only by administrators)"><input className="field" value={why} onChange={e => setWhy(e.target.value)} /></Field><div className="flex justify-end gap-2"><Btn size="sm" onClick={() => setEnding(null)}>Cancel</Btn><Btn size="sm" variant="danger" onClick={() => endNow(c)}>Confirm: end now</Btn></div></div>}</li>)}</ul> : <p className="text-sm text-muted">{b.firstName} has no coach right now.</p>}
      <p className="mt-2 text-xs text-muted">For Safe Sport concerns, also call or text the Canadian Sport Helpline at 1-888-837-7678, or see the Safe Sport section to make a confidential report.</p>
    </Section>
  </div>;
}

/* ---------- Coach NCCP level shown wherever boxers or parents pick a coach ---------- */
function coachNccpLevel(d, u) {
  const raw = String(trackieOf(u)['COACH LEVEL'] || u.trackieCoachLevel || '').trim();
  const statusOf = t => /in[\s-]*training/i.test(t) ? 'In training' : /certified/i.test(t) ? 'Certified' : /trained/i.test(t) ? 'Trained' : '';
  if (raw && !/^none$/i.test(raw)) {
    const status = statusOf(raw);
    const context = raw.replace(/[\s(\-–]*(in[\s-]*training|certified|trained)\)?\s*$/i, '').replace(/[()]/g, '').trim();
    return { context: context || raw, status };
  }
  const no = nccpOf(u);
  if (no) { const order = ['Comp-Dev', 'Comp-Int', 'Inst-Beg'], names = { 'Comp-Dev': 'Competition Development', 'Comp-Int': 'Competition-Introduction', 'Inst-Beg': 'Instruction-Beginner' };
    try { const cx2 = nccpContexts(nccpRecord(d, no)); for (const k of order) { const hit = cx2.find(x => x.key === k && x.count > 0); if (hit) return { context: names[k], status: hit.evaluated ? 'Trained' : 'In training' }; } } catch (e) {} }
  return null;
}
function CoachLevelBadge({ u }) {
  const { data } = useApp();
  const lv = coachNccpLevel(data, u);
  if (!lv) return <span className="text-xs text-muted">NCCP level not on file</span>;
  const tone = lv.status === 'Certified' ? 'ok' : lv.status === 'Trained' ? 'info' : lv.status === 'In training' ? 'warn' : 'neutral';
  return <span className="inline-flex flex-wrap items-center gap-1 text-xs"><span className="text-muted">NCCP:</span><span className="font-semibold">{lv.context}</span>{lv.status && <Badge tone={tone}>{lv.status}</Badge>}</span>;
}

/* ---------- Coach-side ending, and auto-completion of unanswered end requests ---------- */
const CR_AUTO_DAYS = 14;
const crAutoDate = r => addDays(String(r.pendingCoachAt || r.at).slice(0, 10), CR_AUTO_DAYS);
function crAutoDue(d) {
  const today = REF_DATE;
  return (d.coachRequests || []).filter(r => r.status === 'pending_coach' && r.type === 'end' && crAutoDate(r) <= today);
}
function coachEndsRelationship(d, coachId, boxerId, reason) {
  const b = d.users.find(u => u.id === boxerId), c = d.users.find(u => u.id === coachId);
  if (!b || !c) return;
  const r = { id: uid('rel'), boxerId, coachId, type: 'end', status: 'pending_coach', requestedBy: coachId, at: nowIso(), note: reason || '', history: [{ at: nowIso(), by: coachId, text: 'Ended by the coach' }] };
  d.coachRequests = d.coachRequests || []; d.coachRequests.unshift(r);
  r.status = 'accepted'; r.decidedBy = coachId; r.decidedAt = nowIso(); r.reason = 'Ended by the coach';
  b.selectedCoachIds = (b.selectedCoachIds || []).filter(id => id !== coachId);
  logCoach(d, boxerId, coachId, 'removed', 'Ended by the coach', coachId, fullName(c), reason || '');
  (d.coachRequests || []).forEach(x => { if (x !== r && x.boxerId === boxerId && x.coachId === coachId && crOpen(x)) { x.status = 'cancelled'; x.history.push({ at: nowIso(), by: coachId, text: 'Cancelled: the coach ended the relationship' }); } });
  notifyUsers(d, b.id, `${fullName(c)} ended your coaching relationship${reason ? `: ${reason}` : '.'} You can request a new coach on My Coaches.`, 'COACHES');
  if (isMinorBoxer(b)) queueGuardianAccess(d, b, `${fullName(c)} ended their coaching relationship with ${b.firstName}${reason ? ` (“${reason}”)` : ''}.`);
}
function CoachEndButton({ b }) {
  const { update, viewer, notify } = useApp();
  const [open, setOpen] = useState(false); const [why, setWhy] = useState('');
  if (!open) return <Btn size="sm" variant="ghost" onClick={() => { setOpen(true); setWhy(''); }}>End coaching</Btn>;
  return <div className="flex w-full flex-wrap items-center justify-end gap-1.5 rounded-md border border-maple bg-maplesoft p-2"><input className="field min-w-[180px] flex-1 py-1 text-sm" placeholder="Reason (optional, shared with the boxer)" value={why} onChange={e => setWhy(e.target.value)} aria-label="Reason" /><Btn size="sm" onClick={() => setOpen(false)}>Cancel</Btn><Btn size="sm" variant="danger" onClick={() => { update(d => coachEndsRelationship(d, viewer.id, b.id, why.trim())); notify(`You’re no longer ${b.firstName}’s coach. ${b.firstName} has been notified${isMinorBoxer(b) ? ', and so has their parent or guardian' : ''}.`, 'info'); setOpen(false); }}>Confirm end</Btn></div>;
}
function upgradeTo21(d) {
  (d.coachRequests || []).forEach(r => { if (r.status === 'pending_coach' && !r.pendingCoachAt) r.pendingCoachAt = r.at; });
  if (!(d.coachRequests || []).some(r => r.id === 'rel-4')) {
    const at = '2026-10-15T19:20:00';
    (d.coachRequests = d.coachRequests || []).unshift({ id: 'rel-4', boxerId: 'u-b4', coachId: 'u-c2', type: 'end', status: 'pending_coach', requestedBy: 'u-b4', at, pendingCoachAt: at, note: 'I’m moving to Toronto in December and will train with a club there. Thank you for everything!', history: [{ at, by: 'u-b4', text: 'Requested' }] });
  }
  d.version = 21; return d;
}

/* ---------- Coach: My Boxers (mirror of the boxer's My Coaches) ---------- */
function CoachBoxersView() {
  const { data, update, viewer, notify } = useApp();
  const [recordId, setRecordId] = useState(null);
  const [q, setQ] = useState(''); const [prov, setProv] = useState(viewer.province);
  const [compose, setCompose] = useState(null); const [note, setNote] = useState('');
  const mine = data.users.filter(u => u.role === 'boxer' && (u.selectedCoachIds || []).includes(viewer.id)).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const reqs = (data.coachRequests || []).filter(r => r.coachId === viewer.id);
  const sent = reqs.filter(r => crOpen(r) && r.requestedBy === viewer.id);
  const term = q.trim().toLowerCase();
  const pool = term.length < 2 && !prov ? [] : data.users.filter(u => u.role === 'boxer' && u.status === 'approved' && !(u.selectedCoachIds || []).includes(viewer.id) && !reqs.some(r => crOpen(r) && r.boxerId === u.id) && (!prov || u.province === prov) && (!term || (fullName(u) + ' ' + (u.club || '') + ' ' + u.membershipId).toLowerCase().includes(term))).sort((a, b) => a.lastName.localeCompare(b.lastName));
  if (recordId) return <RecordBook boxerId={recordId} onBack={() => setRecordId(null)} backLabel="Back to My Boxers" />;
  const send = () => { update(d => crCreate(d, { boxerId: compose.id, coachId: viewer.id, type: 'start', by: viewer.id, note: note.trim() })); notify(isMinorBoxer(compose) && guardianEmailOf(compose) ? `Request sent. ${compose.firstName}’s parent or guardian approves first, then ${compose.firstName} accepts.` : `Request sent to ${fullName(compose)}.`); setCompose(null); setNote(''); };
  const cancel = r => update(d => { const x = d.coachRequests.find(y => y.id === r.id); x.status = 'cancelled'; x.history.push({ at: nowIso(), by: viewer.id, text: 'Cancelled' }); });
  const past = reqs.filter(r => !crOpen(r));
  return <div className="space-y-4">
    <CoachRequestsInbox />
    <Section logo title="My Boxers" sub="Boxers you coach. You can see their Record Books, co-sign their pre-bout forms, enter them in events and request their move to Open." actions={<Badge tone="info">{mine.length} boxer{mine.length === 1 ? '' : 's'}</Badge>}>
      {mine.length ? <ul className="divide-y divide-line rounded-md border border-line">{mine.map(b => { const el = eligibility(data, b); return <li key={b.id} className="px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-2"><span aria-hidden="true">🥊</span><span className="font-semibold">{fullName(b)}</span><ClassBadge u={b} /><NationalTeamBadge user={b} /><span className="text-xs text-muted">age {ageOn(b.dob, REF_DATE)}, {b.club || '—'}, {b.province}</span><Badge tone={el.tone}>{el.label}</Badge><ScatBadge u={b} />
          <span className="ml-auto flex flex-wrap gap-1.5"><Btn size="xs" variant="rope" onClick={() => setRecordId(b.id)}>Open Record Book</Btn></span></div>
        <div className="mt-1 flex justify-end"><CoachEndButton b={b} /></div>
      </li>; })}</ul> : <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-muted">No boxers yet. Accept a boxer’s request or send one below.</p>}
    </Section>
    {compose && <Section title={`Ask ${fullName(compose)} to train with you`} sub={`${isMinorBoxer(compose) && guardianEmailOf(compose) ? `${compose.firstName} is under 18, so a parent or guardian approves first. Then ` : ''}${compose.firstName} accepts or declines on their My Coaches tab.`}>
      <Field label="Message (optional)" hint="Shared with the boxer and, for boxers under 18, their parent or guardian."><textarea rows={3} className="field" value={note} onChange={e => setNote(e.target.value)} /></Field>
      <div className="mt-2 flex justify-end gap-2"><Btn onClick={() => setCompose(null)}>Cancel</Btn><Btn variant="primary" onClick={send}>Send request</Btn></div>
    </Section>}
    {sent.length > 0 && <Section title="Your requests in progress">
      <ul className="divide-y divide-line rounded-md border border-line">{sent.map(r => <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"><span className="font-semibold">{CR_TYPE[r.type]}: {nameOf(data, r.boxerId)}</span><Badge tone={CR_STATUS[r.status].tone}>{CR_STATUS[r.status].label}</Badge><span className="text-xs text-muted">since {fmtDate(r.at.slice(0, 10))}</span><Btn size="xs" variant="ghost" className="ml-auto" onClick={() => cancel(r)}>Cancel request</Btn></li>)}</ul>
    </Section>}
    <Section title="Request a boxer" sub="Find a boxer who trains with you and invite them to add you as their coach.">
      <div className="mb-2 flex flex-wrap gap-2"><input className="field max-w-xs" placeholder="Search name, club or membership ID" value={q} onChange={e => setQ(e.target.value)} aria-label="Search boxers" /><select className="field w-auto" value={prov} onChange={e => setProv(e.target.value)} aria-label="Province"><option value="">All provinces</option>{PROVINCE_CODES.map(c => <option key={c} value={c}>{PROVINCE_INFO[c].name}</option>)}</select></div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line">{pool.slice(0, 60).map(b => <li key={b.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"><span className="font-semibold">{fullName(b)}</span><ClassBadge u={b} /><span className="text-xs text-muted">age {ageOn(b.dob, REF_DATE)}, {b.club || '—'}, {b.province}</span><Btn size="xs" variant="rope" className="ml-auto" onClick={() => { setCompose(b); setNote(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Request</Btn></li>)}{!pool.length && <li className="px-3 py-4 text-center text-sm text-muted">{term.length < 2 && !prov ? 'Type at least two letters to search.' : 'No boxers match.'}</li>}</ul>
      {pool.length > 60 && <p className="mt-1 text-xs text-muted">Showing 60 of {pool.length}. Search to narrow the list.</p>}
    </Section>
    {past.length > 0 && <details className="rounded-md border border-line bg-surface"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Past requests ({past.length})</summary><ul className="divide-y divide-line border-t border-line text-sm">{past.slice(0, 50).map(r => <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2"><span>{CR_TYPE[r.type]}: {nameOf(data, r.boxerId)}</span><Badge tone={CR_STATUS[r.status].tone}>{CR_STATUS[r.status].label}</Badge>{r.reason && <span className="text-xs text-muted">{r.reason}</span>}<span className="ml-auto text-xs text-muted">{fmtDate((r.decidedAt || r.at).slice(0, 10))}</span></li>)}</ul></details>}
  </div>;
}

/* ---------- Coach relationship history (kept on the boxer, visible to PTSO and NSO administrators) ---------- */
function coachSnap(d, id) { const c = d.users.find(u => u.id === id); return c ? { id, name: fullName(c), club: c.club || '', province: c.province || '' } : { id, name: 'Former member', club: '', province: '' }; }
function logCoach(d, boxerId, coachId, action, via, by, byName, note) {
  const b = d.users.find(u => u.id === boxerId); if (!b) return;
  const c = coachSnap(d, coachId);
  b.coachLog = [...(b.coachLog || []), { at: nowIso(), action, coachId, coachName: c.name, coachClub: c.club, coachProvince: c.province, via, by: by || null, byName: byName || (by ? nameOf(d, by) : ''), note: note || '' }];
}
function crVia(d, r, accepted, by) {
  const byU = by ? d.users.find(u => u.id === by) : null;
  if (r.immediate) return `Ended immediately by the club manager (${r.requestedByName}, ${r.clubName})`;
  if (r.viaClub) return `Club manager proposal (${r.requestedByName}, ${r.clubName}), ${accepted ? 'accepted by the boxer and coach' : 'declined'}`;
  if (r.type === 'end-urgent') return 'Urgent request, ended by an administrator';
  if (r.history.some(h => /ended immediately by parent\/guardian/i.test(h.text))) return 'Ended by parent or guardian';
  if (/^Ended automatically/.test(r.reason || '')) return 'Automatic: no response from the coach in 14 days';
  if (byU && isAdmin(byU)) return 'Completed by an administrator';
  if (!accepted && /parent or guardian/i.test(r.reason || '')) return 'Declined by parent or guardian';
  if (r.type === 'start') return crFromCoach(r) ? (accepted ? 'Coach invitation accepted by the boxer' : 'Coach invitation declined by the boxer') : (accepted ? 'Boxer request accepted by the coach' : 'Boxer request declined by the coach');
  return accepted ? 'Boxer request to end, confirmed by the coach' : 'Boxer request to end, declined by the coach';
}
function upgradeTo22(d) {
  d.users.forEach(u => {
    if (u.role === 'boxer' && !u.coachLog) u.coachLog = (u.selectedCoachIds || []).map(id => { const c = coachSnap(d, id); return { at: (u.createdAt || '2026-01-01T00:00:00'), action: 'on-record', coachId: id, coachName: c.name, coachClub: c.club, coachProvince: c.province, via: 'Relationship on record when history began', by: null, byName: '', note: '' }; });
  });
  (d.coachRequests || []).forEach(r => { if (!r.otherCoaches) { const b = d.users.find(u => u.id === r.boxerId); r.otherCoaches = ((b && b.selectedCoachIds) || []).filter(id => id !== r.coachId).map(id => coachSnap(d, id)); } });
  d.version = 22; return d;
}
function ProvBadge({ prov, home }) { return prov && home && prov !== home ? <Badge tone="info" title="Coach registered in a different province or territory than the boxer">{prov}: other province</Badge> : null; }
function OtherCoachesNote({ r, b }) {
  const list = r.otherCoaches || [];
  return <div className="mt-1.5 rounded-md bg-sunk px-2.5 py-1.5 text-xs"><span className="font-semibold">{b.firstName}’s other coaches when this was requested: </span>{list.length ? list.map((c, i) => <span key={c.id}>{i ? '; ' : ''}{c.name} ({c.club || 'no club'}, {c.province}) <ProvBadge prov={c.province} home={b.province} /></span>) : <span className="text-muted">none</span>}</div>;
}
function CoachHistorySection({ b }) {
  const { data, viewer } = useApp();
  const [open, setOpen] = useState(false);
  if (!isAdmin(viewer)) return null;
  const log = (b.coachLog || []).slice().reverse();
  const pending = (data.coachRequests || []).filter(r => r.boxerId === b.id && crOpen(r));
  const current = (b.selectedCoachIds || []).map(id => coachSnap(data, id));
  const ACT = { added: ['ok', 'Coach added'], removed: ['bad', 'Coach removed'], declined: ['neutral', 'Request declined'], 'on-record': ['neutral', 'On record'] };
  return <Section title="Coach Relationship History" sub="Every coach added or removed, how and by whom. Coaches from all provinces and territories are shown, including temporary out-of-province coaches such as on international tours. Visible to PTSO and NSO administrators only." actions={<Btn size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>{open ? 'Hide history' : `Show history (${log.length})`}</Btn>}>
    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">Current coaches:</span>{current.length ? current.map(c => <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">{c.name} <span className="text-xs text-muted">{c.club}, {c.province}</span><ProvBadge prov={c.province} home={b.province} /></span>) : <span className="text-muted">none</span>}</div>
    {pending.length > 0 && <p className="mt-1 text-xs text-muted">Open requests: {pending.map(r => `${CR_TYPE[r.type]} with ${nameOf(data, r.coachId)} (${CR_STATUS[r.status].label.toLowerCase()})`).join('; ')}.</p>}
    {open && <div className="mt-3"><Table head={['Date', 'Change', 'Coach', 'How', 'By']} isEmpty={!log.length} empty="No changes recorded yet.">
      {log.map((x, i) => <tr key={i}><Td className="whitespace-nowrap">{fmtStamp(x.at)}</Td><Td><Badge tone={(ACT[x.action] || ACT['on-record'])[0]}>{(ACT[x.action] || ACT['on-record'])[1]}</Badge></Td><Td className="font-semibold">{x.coachName}<div className="text-xs font-normal text-muted">{x.coachClub || '—'}, {x.coachProvince} <ProvBadge prov={x.coachProvince} home={b.province} /></div></Td><Td className="text-xs">{x.via}{x.note && <div className="text-muted">“{x.note}”</div>}</Td><Td className="text-xs">{x.byName || '—'}</Td></tr>)}
    </Table></div>}
  </Section>;
}

/* =========================================================
   Club Manager
   A coach or official can manage one club. Club managers see
   their club's athlete readiness, coach credentials, sanction
   requests, events and travel passes, and can propose or end
   boxer–coach relationships for the club.
   ========================================================= */
const isClubManager = u => !!(u && u.clubManagerOf && (u.role === 'coach' || u.role === 'official'));
function clubsInProvince(d, prov) {
  const set = new Set((PROVINCE_INFO[prov] && PROVINCE_INFO[prov].clubs || []).map(c => c[1]));
  d.users.forEach(u => { if (u.province === prov && u.club) set.add(u.club); });
  return [...set].sort((a, b) => a.localeCompare(b));
}
function crAcceptParty(d, r, party, accept, by, name, reason) {
  if (!accept) { crFinish(d, r, false, by, reason || `Declined by the ${party}`, name); return; }
  r.accepts = { ...(r.accepts || {}), [party]: true };
  r.history.push({ at: nowIso(), by, byName: name, text: `Accepted by the ${party}` });
  if (r.accepts.boxer && r.accepts.coach) crFinish(d, r, true, by, '', name);
}
function clubEndNow(d, manager, boxerId, coachId, reason) {
  const b = d.users.find(u => u.id === boxerId), c = d.users.find(u => u.id === coachId);
  const r = { id: uid('rel'), boxerId, coachId, type: 'end', status: 'pending_both', viaClub: true, immediate: true, clubName: manager.clubManagerOf, requestedBy: manager.id, requestedByName: fullName(manager), otherCoaches: [], at: nowIso(), note: reason, history: [{ at: nowIso(), by: manager.id, text: 'Ended immediately by the club manager' }] };
  d.coachRequests = d.coachRequests || []; d.coachRequests.unshift(r);
  crFinish(d, r, true, manager.id, reason, fullName(manager));
  (d.coachRequests || []).forEach(x => { if (x !== r && x.boxerId === boxerId && x.coachId === coachId && crOpen(x)) { x.status = 'cancelled'; x.history.push({ at: nowIso(), by: manager.id, text: 'Cancelled: the club manager ended the relationship' }); } });
  if (isMinorBoxer(b)) queueGuardianAccess(d, b, `The club manager at ${manager.clubManagerOf} ended ${b.firstName}’s coaching relationship with ${fullName(c)}.`);
  d.users.filter(u => u.role === 'ptso' && u.province === b.province && u.status === 'approved').forEach(p => notifyUsers(d, p.id, `Club manager ${fullName(manager)} (${manager.clubManagerOf}) ended ${fullName(b)}’s coaching relationship with ${fullName(c)}.`, 'USERS'));
}
function upgradeTo23(d) {
  const marc = d.users.find(u => u.id === 'u-c1');
  if (marc && marc.clubManagerOf === undefined) { marc.clubManagerOf = 'Bytown Boxing Club'; marc.clubManagerSince = '2026-09-01T09:00:00'; }
  d.version = 23; return d;
}

const SAN_ST = { draft: ['neutral', 'Draft'], submitted: ['info', 'Submitted'], ptso_approved: ['info', 'PTSO approved'], approved: ['ok', 'Approved'], denied: ['bad', 'Not approved'], returned: ['warn', 'Returned for changes'] };
const ITP_ST = { draft: ['neutral', 'Draft'], submitted: ['info', 'Submitted'], ptso_approved: ['info', 'PTSO approved'], approved: ['ok', 'Approved'], returned: ['warn', 'Returned'], denied: ['bad', 'Not approved'] };
function ClubManagerView() {
  const { data, update, viewer, notify, go } = useApp();
  const club = viewer.clubManagerOf;
  const [sub, setSub] = useState('athletes');
  const [recordId, setRecordId] = useState(null);
  const [propose, setPropose] = useState({ boxerId: '', coachId: '', note: '' });
  const [ending, setEnding] = useState(null); const [why, setWhy] = useState(''); const [err, setErr] = useState('');
  if (!club) return <Section title="Club Manager"><p className="text-sm text-muted">You aren’t a club manager.</p></Section>;
  if (recordId) return <RecordBook boxerId={recordId} onBack={() => setRecordId(null)} backLabel={`Back to ${club}`} />;
  const boxers = data.users.filter(u => u.role === 'boxer' && u.status === 'approved' && u.club === club).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const bIds = new Set(boxers.map(b => b.id));
  const memberIds = new Set(data.users.filter(u => u.club === club).map(u => u.id));
  const coachIds = new Set([...data.users.filter(u => u.role === 'coach' && u.club === club).map(u => u.id), ...boxers.flatMap(b => b.selectedCoachIds || [])]);
  const coaches = [...coachIds].map(id => getUser(data, id)).filter(Boolean).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const sanctions = (data.sanctions || []).filter(s => (s.info && s.info.club === club) || memberIds.has(s.requestedByUserId)).sort((a, b) => ((b.info && b.info.date) || '').localeCompare((a.info && a.info.date) || ''));
  const events = data.events.filter(ev => ev.registeredBoxerIds.some(id => bIds.has(id)) || (ev.sanctionId && sanctions.some(s => s.id === ev.sanctionId))).sort((a, b) => b.date.localeCompare(a.date));
  const itps = (data.itps || []).filter(p => (p.members || []).some(m => m.club === club || memberIds.has(m.userId)) || memberIds.has(p.submittedBy));
  const clubReqs = (data.coachRequests || []).filter(r => r.viaClub && r.clubName === club);
  const elig = boxers.filter(b => eligibility(data, b).tone === 'ok').length;
  const expiring = boxers.filter(b => { const m = latestMedical(data, b.id); return m && medState(m).tone === 'warn'; }).length;
  const noMed = boxers.filter(b => { const m = latestMedical(data, b.id); return !m || medState(m).tone === 'bad'; }).length;
  const resting = boxers.filter(b => restOf(data, b.id).filter(restOpen).length).length;
  const flagged = boxers.filter(b => scatOpen(data, b.id)).length;
  const tiles = [['Boxers', boxers.length, 'athletes'], ['Eligible to compete', `${elig} / ${boxers.length}`, 'athletes'], ['Annual Medicals expiring or missing', expiring + noMed, 'athletes'], ['On mandatory rest', resting, 'athletes'], ['Coaches', coaches.length, 'coaches'], ['Open sanction requests', sanctions.filter(s => ['submitted', 'ptso_approved', 'draft', 'returned'].includes(s.status)).length, 'sanctions'], ['Upcoming events', events.filter(isUpcoming).length, 'events'], ['Travel passes', itps.length, 'travel']];
  const SUBS = [['athletes', 'Athlete readiness'], ['coaches', 'Coach credentials'], ['relationships', 'Coach relationships'], ['sanctions', 'Sanction requests'], ['events', 'Events'], ['travel', 'Travel passes']];
  const sendProposal = type => {
    const b = getUser(data, propose.boxerId), c = getUser(data, propose.coachId);
    if (!b || !c) { setErr('Choose a boxer and a coach.'); return; }
    update(d => { const r = crCreate(d, { boxerId: b.id, coachId: c.id, type, by: viewer.id, note: propose.note.trim(), viaClub: true, clubName: club }); });
    notify(`Proposal sent. ${isMinorBoxer(b) && guardianEmailOf(b) ? `${b.firstName}’s parent or guardian approves first, then ` : ''}${b.firstName} and ${c.firstName} both need to accept.`);
    setPropose({ boxerId: '', coachId: '', note: '' }); setErr('');
  };
  const endNow = (b, c) => { if (why.trim().length < 5) { setErr('Enter a reason. It’s kept in the boxer’s coach relationship history.'); return; } update(d => clubEndNow(d, viewer, b.id, c.id, why.trim())); notify(`${fullName(c)} is no longer ${b.firstName}’s coach.`, 'info'); setEnding(null); setWhy(''); setErr(''); };
  const proposeEnd = (b, c) => { update(d => crCreate(d, { boxerId: b.id, coachId: c.id, type: 'end', by: viewer.id, note: '', viaClub: true, clubName: club })); notify(`Proposal to end sent. ${b.firstName} and ${c.firstName} both need to accept.`); };
  const coachPool = data.users.filter(u => u.role === 'coach' && u.status === 'approved').sort((a, b) => (b.club === club) - (a.club === club) || a.lastName.localeCompare(b.lastName));
  return <div className="space-y-4">
    <Section logo title={club} sub={`Club Manager view for ${PROVINCE_INFO[viewer.province] ? PROVINCE_INFO[viewer.province].name : viewer.province}. Shows boxers registered with the club and every coach linked to them.`}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([l, v, k]) => <button key={l} type="button" onClick={() => setSub(k)} className="rounded-md border border-line bg-surface p-3 text-left hover:border-rope hover:bg-ropesoft"><div className="font-display text-2xl font-extrabold tabular-nums">{v}</div><div className="text-sm font-semibold leading-tight">{l}</div></button>)}</div>
      {flagged > 0 && <Banner tone="bad" className="mt-3">{flagged} boxer{flagged === 1 ? ' has' : 's have'} an open SCAT6 flag needing a practitioner.</Banner>}
    </Section>
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">{SUBS.map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={sub === k} onClick={() => setSub(k)} className={cx('-mb-px border-b-[3px] px-3 py-2 text-sm font-semibold', sub === k ? 'border-maple text-ink' : 'border-transparent text-muted hover:text-ink')}>{l}{k === 'relationships' && clubReqs.filter(crOpen).length > 0 && <span className="ml-1.5 rounded-full bg-rope px-1.5 py-0.5 text-[10px] font-bold text-white">{clubReqs.filter(crOpen).length}</span>}</button>)}</div>

    {sub === 'athletes' && <Section title="Athlete health & readiness" sub="Readiness statuses for the club’s boxers. Medical details stay private: only a boxer’s own coaches, medical officials and administrators can open the full Record Book.">
      <Table head={['Boxer', 'Coaches', 'Eligibility', 'Annual Medical', 'Rest', 'Next event']} isEmpty={!boxers.length} empty="No boxers are registered with this club.">
        {boxers.map(b => { const el = eligibility(data, b), m = latestMedical(data, b.id), ms = m ? medState(m) : null, rest = restOf(data, b.id).filter(restOpen); const next = data.events.filter(ev => isUpcoming(ev) && ev.registeredBoxerIds.includes(b.id)).sort((x, y) => x.date.localeCompare(y.date))[0]; const qs = next ? qStatus(data, next, b) : null; return <tr key={b.id}>
          <Td className="font-semibold">{fullName(b)} <ClassBadge u={b} /> <NationalTeamBadge user={b} /><div className="text-xs font-normal text-muted">age {ageOn(b.dob, REF_DATE)}, {b.membershipId}</div></Td>
          <Td className="text-xs">{(b.selectedCoachIds || []).map(id => nameOf(data, id)).join(', ') || <span className="text-warn">No coach</span>}</Td>
          <Td><Badge tone={el.tone}>{el.label}</Badge><div className="mt-1"><ScatBadge u={b} /></div></Td>
          <Td className="whitespace-nowrap text-xs">{m ? <>{fmtDate(m.examDate)}<div className="mt-0.5"><Badge tone={ms.tone}>{ms.label}</Badge></div></> : <Badge tone="bad">None on file</Badge>}</Td>
          <Td>{rest.length ? <Badge tone="bad">Rest active</Badge> : <span className="text-xs text-muted">None</span>}</Td>
          <Td className="text-xs">{next ? <>{next.name}<div className="text-muted">{fmtDate(next.date)}</div><div className="mt-0.5">{qs.complete ? <Badge tone="ok">Forms done</Badge> : <Badge tone="warn">Forms pending</Badge>}</div></> : <span className="text-muted">None</span>}</Td>
        </tr>; })}
      </Table>
    </Section>}

    {sub === 'coaches' && <Section title="Coach credentials" sub="Coaches registered with the club, and coaches from elsewhere who coach the club’s boxers.">
      <Table head={['Coach', 'Link to the club', 'NCCP', 'Portal certification', 'Safe Sport (The Locker)', 'Membership']} isEmpty={!coaches.length} empty="No coaches linked to this club.">
        {coaches.map(c => { const no = nccpOf(c); const ss = no ? lockerSafeSport(data, no) : null; const lv = (c.certs || {})['prog-coach']; const exp = trackieOf(c)['NSO EXPIRY']; const nB = boxers.filter(b => (b.selectedCoachIds || []).includes(c.id)).length; return <tr key={c.id}>
          <Td className="font-semibold">{fullName(c)}<div className="text-xs font-normal text-muted">{c.club || '—'}, {c.province}</div></Td>
          <Td className="text-xs">{c.club === club ? <Badge tone="info">Club coach</Badge> : <Badge>Coaches club boxers</Badge>}<div className="mt-0.5 text-muted">{nB} club boxer{nB === 1 ? '' : 's'}</div></Td>
          <Td className="text-xs"><div>{no ? `#${no}` : <Badge tone="warn">No NCCP #</Badge>}</div><div className="mt-0.5"><CoachLevelBadge u={c} /></div></Td>
          <Td className="text-xs">{lv ? levelName(data, 'prog-coach', lv) : <span className="text-muted">Not certified</span>}{(c.evaluatorPrograms || []).length > 0 && <div className="mt-0.5"><Badge tone="ok">Evaluator</Badge></div>}</Td>
          <Td className="text-xs">{ss ? <>{ss.level}<div className="text-muted">{fmtDate(ss.date)}</div></> : <Badge tone="warn">None on record</Badge>}</Td>
          <Td className="whitespace-nowrap text-xs">{exp ? <><Badge tone={exp < REF_DATE ? 'bad' : daysBetween(REF_DATE, exp) <= 60 ? 'warn' : 'ok'}>{exp < REF_DATE ? 'Expired' : 'Current'}</Badge><div className="text-muted">to {fmtDate(exp)}</div></> : <span className="text-muted">—</span>}</Td>
        </tr>; })}
      </Table>
    </Section>}

    {sub === 'relationships' && <>
      {err && <Banner tone="bad" onClose={() => setErr('')}>{err}</Banner>}
      <Section title="Coach relationships" sub="Propose a coach for a boxer, or end a relationship. Proposals need both the boxer and the coach to accept (and a parent or guardian first for boxers under 18). Ending immediately needs a reason, which is kept in the boxer’s history.">
        <ul className="divide-y divide-line rounded-md border border-line">{boxers.map(b => <li key={b.id} className="px-3 py-2.5 text-sm">
          <div className="font-semibold">{fullName(b)} <span className="text-xs font-normal text-muted">age {ageOn(b.dob, REF_DATE)}</span></div>
          {(b.selectedCoachIds || []).length ? <ul className="mt-1 space-y-1">{(b.selectedCoachIds || []).map(id => { const c = getUser(data, id); if (!c) return null; const pend = clubReqs.find(r => crOpen(r) && r.boxerId === b.id && r.coachId === id); return <li key={id} className="flex flex-wrap items-center gap-2 pl-3"><span>{fullName(c)}</span><span className="text-xs text-muted">{c.club || '—'}, {c.province}</span><ProvBadge prov={c.province} home={b.province} />
            <span className="ml-auto flex flex-wrap gap-1.5">{pend ? <Badge tone={CR_STATUS[pend.status].tone}>{CR_TYPE[pend.type]}: {CR_STATUS[pend.status].label}</Badge> : ending && ending.b === b.id && ending.c === id ? null : <><Btn size="xs" onClick={() => proposeEnd(b, c)}>Propose ending</Btn><Btn size="xs" variant="danger" onClick={() => { setEnding({ b: b.id, c: id }); setWhy(''); }}>End now</Btn></>}</span>
            {ending && ending.b === b.id && ending.c === id && <div className="flex w-full flex-wrap items-center gap-1.5 rounded-md border border-maple bg-maplesoft p-2"><input className="field min-w-[200px] flex-1 py-1 text-sm" placeholder="Reason (required)" value={why} onChange={e => setWhy(e.target.value)} aria-label="Reason" /><Btn size="xs" onClick={() => setEnding(null)}>Cancel</Btn><Btn size="xs" variant="danger" onClick={() => endNow(b, c)}>Confirm end now</Btn></div>}
          </li>; })}</ul> : <p className="pl-3 text-xs text-warn">No coach</p>}
        </li>)}{!boxers.length && <li className="px-3 py-4 text-center text-sm text-muted">No boxers are registered with this club.</li>}</ul>
      </Section>
      <Section title="Propose a new coach for a boxer">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Boxer"><select className="field" value={propose.boxerId} onChange={e => setPropose(p => ({ ...p, boxerId: e.target.value }))}><option value="">Choose a boxer…</option>{boxers.map(b => <option key={b.id} value={b.id}>{fullName(b)}</option>)}</select></Field>
          <Field label="Coach" hint="Club coaches are listed first. Coaches from other clubs or provinces are allowed."><select className="field" value={propose.coachId} onChange={e => setPropose(p => ({ ...p, coachId: e.target.value }))}><option value="">Choose a coach…</option>{coachPool.filter(c => !propose.boxerId || !((getUser(data, propose.boxerId) || {}).selectedCoachIds || []).includes(c.id)).slice(0, 300).map(c => <option key={c.id} value={c.id}>{fullName(c)} ({c.club || 'no club'}, {c.province})</option>)}</select></Field>
          <Field label="Message (optional, shared with the boxer and coach)" className="sm:col-span-2"><input className="field" value={propose.note} onChange={e => setPropose(p => ({ ...p, note: e.target.value }))} /></Field>
        </div>
        <div className="mt-2 flex justify-end"><Btn variant="primary" onClick={() => sendProposal('start')}>Send proposal</Btn></div>
      </Section>
      {clubReqs.length > 0 && <Section title="Club proposals">
        <ul className="divide-y divide-line rounded-md border border-line text-sm">{clubReqs.slice(0, 40).map(r => <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2"><span>{r.immediate ? 'Ended immediately' : CR_TYPE[r.type]}: <b>{nameOf(data, r.boxerId)}</b> and {nameOf(data, r.coachId)}</span><Badge tone={CR_STATUS[r.status].tone}>{CR_STATUS[r.status].label}</Badge>{r.status === 'pending_both' && <span className="text-xs text-muted">Boxer {r.accepts && r.accepts.boxer ? '✓' : '…'} · Coach {r.accepts && r.accepts.coach ? '✓' : '…'}</span>}<span className="ml-auto text-xs text-muted">{fmtDate((r.decidedAt || r.at).slice(0, 10))}</span>{crOpen(r) && r.requestedBy === viewer.id && <Btn size="xs" variant="ghost" onClick={() => update(d => { const x = d.coachRequests.find(y => y.id === r.id); x.status = 'cancelled'; x.history.push({ at: nowIso(), by: viewer.id, text: 'Cancelled by the club manager' }); })}>Cancel</Btn>}</li>)}</ul>
      </Section>}
    </>}

    {sub === 'sanctions' && <Section title="Event sanction requests" sub="Requests for events hosted by the club or submitted by its members." actions={<Btn size="sm" variant="primary" onClick={() => go('SANCTIONS')}>New sanction request</Btn>}>
      <Table head={['Event', 'Date', 'Type', 'Status', 'Submitted by']} isEmpty={!sanctions.length} empty="No sanction requests for this club yet.">
        {sanctions.map(s => { const st = SAN_ST[s.status] || ['neutral', s.status]; return <tr key={s.id}><Td className="font-semibold">{(s.info && s.info.eventName) || 'Untitled event'}<div className="text-xs font-normal text-muted">{s.info && s.info.venueName}</div></Td><Td className="whitespace-nowrap">{s.info && s.info.date ? fmtDate(s.info.date) : '—'}</Td><Td>{s.type}</Td><Td><Badge tone={st[0]}>{st[1]}</Badge></Td><Td className="text-xs">{nameOf(data, s.requestedByUserId)}</Td></tr>; })}
      </Table>
    </Section>}

    {sub === 'events' && <Section title="Events associated with the club" sub="Events the club’s boxers are entered in, and events the club hosts." actions={<Btn size="sm" onClick={() => go('EVENTS')}>Open Competition Events</Btn>}>
      <Table head={['Event', 'Date', 'Club boxers', 'Pre-bout forms', 'SCAT6']} isEmpty={!events.length} empty="No events yet.">
        {events.map(ev => { const mine = ev.registeredBoxerIds.filter(id => bIds.has(id)).map(id => getUser(data, id)); const done = mine.filter(b => qStatus(data, ev, b).complete).length; const scatNeed = ev.scatRequired ? mine.filter(b => { const s2 = scatForEvent(data, ev, b.id); return s2 && s2.state !== 'ok'; }).length : 0; return <tr key={ev.id}><Td className="font-semibold">{ev.name}<div className="text-xs font-normal text-muted">{ev.location}</div></Td><Td className="whitespace-nowrap">{fmtDate(ev.date)}{isUpcoming(ev) ? <div><Badge tone="info">Upcoming</Badge></div> : null}</Td><Td className="text-xs">{mine.length ? mine.map(b => b.firstName + ' ' + b.lastName).join(', ') : <span className="text-muted">Host only</span>}</Td><Td>{mine.length ? <Badge tone={done === mine.length ? 'ok' : 'warn'}>{done} / {mine.length} complete</Badge> : '—'}</Td><Td>{ev.scatRequired ? (scatNeed ? <Badge tone="warn">{scatNeed} needed</Badge> : <Badge tone="ok">All set</Badge>) : <span className="text-xs text-muted">Not required</span>}</Td></tr>; })}
      </Table>
    </Section>}

    {sub === 'travel' && <Section title="International travel passes" sub="Passes that include the club’s members." actions={<Btn size="sm" onClick={() => go('TRAVEL')}>Open travel passes</Btn>}>
      <Table head={['Competition', 'Destination', 'Dates', 'Club travellers', 'Status']} isEmpty={!itps.length} empty="No travel passes include this club’s members.">
        {itps.map(p => { const st = ITP_ST[p.status] || ['neutral', p.status]; const mine = (p.members || []).filter(m => m.club === club || memberIds.has(m.userId)); return <tr key={p.id}><Td className="font-semibold">{p.competitionName || 'Untitled'}</Td><Td>{[p.city, p.country].filter(Boolean).join(', ')}</Td><Td className="whitespace-nowrap text-xs">{p.departureDate ? fmtDate(p.departureDate) : '—'} to {p.returnDate ? fmtDate(p.returnDate) : '—'}</Td><Td className="text-xs">{mine.map(m => `${m.name} (${m.role})`).join(', ')}</Td><Td><Badge tone={st[0]}>{st[1]}</Badge></Td></tr>; })}
      </Table>
    </Section>}
  </div>;
}

function AdminClubManagersSection() {
  const { data, update, viewer, notify } = useApp();
  const [q, setQ] = useState(''); const [pick, setPick] = useState(null); const [club, setClub] = useState(''); const [err, setErr] = useState('');
  const scope = u => viewer.role === 'nsoadmin' || u.province === viewer.province;
  const managers = data.users.filter(u => isClubManager(u) && scope(u)).sort((a, b) => a.clubManagerOf.localeCompare(b.clubManagerOf));
  const term = q.trim().toLowerCase();
  const pool = term.length < 2 ? [] : data.users.filter(u => (u.role === 'coach' || u.role === 'official') && u.status === 'approved' && scope(u) && (fullName(u) + ' ' + (u.club || '') + ' ' + u.membershipId).toLowerCase().includes(term)).slice(0, 20);
  const assign = () => {
    if (!pick || !club) { setErr('Choose a member and a club.'); return; }
    const cur = getUser(data, pick.id);
    if (cur.clubManagerOf && cur.clubManagerOf !== club) { setErr(`${fullName(cur)} already manages ${cur.clubManagerOf}. A member can manage only one club, so remove that first.`); return; }
    update(d => { const u = d.users.find(x => x.id === pick.id); u.clubManagerOf = club; u.clubManagerSince = nowIso(); notifyUsers(d, u.id, `You’re now the club manager for ${club}. Open the Club Manager tab.`, 'CLUB'); });
    notify(`${fullName(cur)} is now club manager for ${club}.`); setPick(null); setClub(''); setQ(''); setErr('');
  };
  return <Section title="Club managers" sub="Coaches or officials who manage a club. A member can manage only one club.">
    {err && <Banner tone="bad" className="mb-2" onClose={() => setErr('')}>{err}</Banner>}
    <Table head={['Club', 'Manager', 'Role', 'Since', '']} isEmpty={!managers.length} empty="No club managers yet.">
      {managers.map(u => <tr key={u.id}><Td className="font-semibold">{u.clubManagerOf}</Td><Td>{fullName(u)}<div className="text-xs text-muted">{u.province}, {u.membershipId}</div></Td><Td>{ROLES[u.role].label}</Td><Td className="text-xs">{u.clubManagerSince ? fmtDate(u.clubManagerSince.slice(0, 10)) : '—'}</Td><Td className="text-right"><Btn size="xs" variant="ghost" onClick={() => { update(d => { const x = d.users.find(y => y.id === u.id); notifyUsers(d, x.id, `You’re no longer club manager for ${x.clubManagerOf}.`, 'DASHBOARD'); x.clubManagerOf = null; }); notify('Club manager removed.', 'info'); }}>Remove</Btn></Td></tr>)}
    </Table>
    <div className="mt-3 rounded-md border border-line p-3">
      <h4 className="mb-2 font-display text-base font-bold">Assign a club manager</h4>
      {pick ? <div className="flex flex-wrap items-end gap-2"><div className="text-sm"><span className="font-semibold">{fullName(pick)}</span> <span className="text-xs text-muted">{ROLES[pick.role].label}, {pick.province}</span> <button type="button" className="text-xs text-rope underline" onClick={() => setPick(null)}>change</button></div>
        <Field label="Club"><select className="field w-auto" value={club} onChange={e => setClub(e.target.value)}><option value="">Choose a club…</option>{clubsInProvince(data, pick.province).map(c => <option key={c}>{c}</option>)}</select></Field>
        <Btn variant="primary" onClick={assign}>Assign</Btn></div>
        : <><input className="field max-w-sm" placeholder="Search coaches and officials by name, club or ID" value={q} onChange={e => setQ(e.target.value)} aria-label="Search members" />
          {pool.length > 0 && <ul className="mt-2 divide-y divide-line rounded-md border border-line text-sm">{pool.map(u => <li key={u.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5"><span className="font-semibold">{fullName(u)}</span><span className="text-xs text-muted">{ROLES[u.role].label}, {u.club || 'no club'}, {u.province}</span>{u.clubManagerOf && <Badge tone="info">Manages {u.clubManagerOf}</Badge>}<Btn size="xs" className="ml-auto" onClick={() => { setPick(u); setClub(u.club || ''); }}>Select</Btn></li>)}</ul>}</>}
    </div>
  </Section>;
}

/* =========================================================
   Safe Sport (every role, and the public site)
   Contacts and links are editable by NSO Administrators, since
   providers and policy versions change.
   ========================================================= */
const SAFE_SPORT_DEFAULTS = {
  itpName: 'ITP Sport & Recreation Inc.',
  itpReportUrl: 'https://app.integritycounts.ca/org/itpsport',
  itpNote: 'Boxing Canada’s Independent Third Party receives complaints confidentially and decides the right process to handle each one.',
  bcEmail: 'info@boxingcanada.org',
  bcPhone: '514-255-1000, ext. 208',
  helplinePhone: '1-888-837-7678 (1-888-83SPORT)',
  helplineEmail: 'info@abuse-free-sport.ca',
  helplineUrl: 'https://abuse-free-sport.ca',
  helplineHours: '8 a.m. to 8 p.m. Eastern, 7 days a week, by phone, text, chat or email, in English or French',
  policies: [
    ['Safe Sport Policy', 'https://boxingcanada.org/wp-content/uploads/2022/11/Safe-Sport-Policy-FINAL-EN-11-30-22.pdf'],
    ['Athlete Protection Policy', 'https://boxingcanada.org/wp-content/uploads/2022/01/Athlete-Protection-Policy-FINAL-EN.pdf'],
    ['Screening Policy', 'https://boxingcanada.org/wp-content/uploads/2022/02/Screening-Policy-FINAL-EN.pdf'],
    ['Code of Conduct and Ethics (March 2025)', 'https://boxingcanada.org/wp-content/uploads/2025/07/Code-of-Conduct-and-Ethics-Mar2025-EN.pdf'],
    ['Canadian Safe Sport Program (CCES)', 'https://cces.ca/canadian-safe-sport-program'],
    ['Boxing Canada Safe Sport page', 'https://boxingcanada.org/safe-sport/']
  ]
};
const safeCfg = d => ({ ...SAFE_SPORT_DEFAULTS, ...(d.safeSport || {}) });
function upgradeTo24(d) { if (!d.safeSport) d.safeSport = {}; d.version = 24; return d; }
function SafeSportView() {
  const { data, update, viewer, notify, go } = useApp();
  const cfg = safeCfg(data);
  const [edit, setEdit] = useState(null);
  const nso = viewer.role === 'nsoadmin';
  const no = viewer.role !== 'public' ? nccpOf(viewer) : '';
  const ss = no ? lockerSafeSport(data, no) : null;
  const cssp = viewer.role !== 'public' && ((viewer.role === 'boxer' && viewer.nationalTeam) || viewer.role === 'nsoadmin' || (viewer.role === 'coach' && /national|international/i.test(levelName(data, 'prog-coach', (viewer.certs || {})['prog-coach']) || '')));
  const ext = (href, label, cls) => <a href={href} target="_blank" rel="noopener noreferrer" className={cls || 'font-semibold text-rope underline'}>{label} ↗</a>;
  const save = () => { update(d => { d.safeSport = { ...(d.safeSport || {}), ...edit, policies: edit.policiesText.split('\n').map(l => l.split('|').map(x => x.trim())).filter(x => x[0] && x[1]) }; delete d.safeSport.policiesText; }); notify('Safe Sport information updated.'); setEdit(null); };
  return <div className="space-y-4">
    <Section logo title="Safe Sport" sub="Everyone in boxing, at every level, deserves to train, compete, coach, officiate and volunteer free from abuse, harassment, discrimination and fear." actions={nso && !edit && <Btn size="sm" onClick={() => setEdit({ ...cfg, policiesText: cfg.policies.map(p => p.join(' | ')).join('\n') })}>Edit contacts & links</Btn>}>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border-2 border-maple bg-maplesoft p-4 md:col-span-1">
          <h4 className="font-display text-lg font-bold text-maple">In danger right now?</h4>
          <p className="mt-1 text-sm">Call <a href="tel:911" className="font-bold underline">911</a>. If someone under 18 may be at risk, you also have a legal duty to tell child protection services or police.</p>
          <p className="mt-2 text-sm">Young people can reach <b>Kids Help Phone</b> any time at <a href="tel:18006686868" className="font-semibold underline">1-800-668-6868</a> or by texting 686868.</p>
        </div>
        <div className="rounded-lg border border-line p-4 md:col-span-2">
          <h4 className="font-display text-lg font-bold">Talk to someone: Canadian Sport Helpline</h4>
          <p className="mt-1 text-sm">Free, confidential listening and referral for anyone who has experienced or witnessed harassment, abuse or discrimination in sport. You don’t need to make a complaint to call.</p>
          <p className="mt-2 text-sm"><b>Call or text:</b> <a href={'tel:' + cfg.helplinePhone.replace(/[^0-9]/g, '').slice(0, 11)} className="font-semibold underline">{cfg.helplinePhone}</a> · <b>Email:</b> <a href={'mailto:' + cfg.helplineEmail} className="underline">{cfg.helplineEmail}</a> · {ext(cfg.helplineUrl, 'Website and live chat')}</p>
          <p className="mt-1 text-xs text-muted">{cfg.helplineHours}.</p>
        </div>
      </div>
    </Section>

    {edit && <Section title="Edit Safe Sport contacts & links" sub="Shown to every member and on the public site.">
      <div className="grid gap-3 sm:grid-cols-2">
        {[['itpName', 'Independent Third Party name'], ['itpReportUrl', 'Online reporting link'], ['bcEmail', 'Boxing Canada Safe Sport email'], ['bcPhone', 'Boxing Canada phone'], ['helplinePhone', 'Helpline phone'], ['helplineEmail', 'Helpline email'], ['helplineUrl', 'Helpline website'], ['helplineHours', 'Helpline hours']].map(([k, l]) => <Field key={k} label={l}><input className="field" value={edit[k]} onChange={e => setEdit(p => ({ ...p, [k]: e.target.value }))} /></Field>)}
        <Field label="Note about the Independent Third Party" className="sm:col-span-2"><textarea rows={2} className="field" value={edit.itpNote} onChange={e => setEdit(p => ({ ...p, itpNote: e.target.value }))} /></Field>
        <Field label="Policy links, one per line as: Title | https://link" className="sm:col-span-2"><textarea rows={6} className="field font-mono text-xs" value={edit.policiesText} onChange={e => setEdit(p => ({ ...p, policiesText: e.target.value }))} /></Field>
      </div>
      <div className="mt-2 flex justify-end gap-2"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn size="sm" variant="ghost" onClick={() => { update(d => { d.safeSport = {}; }); notify('Restored the default Safe Sport information.', 'info'); setEdit(null); }}>Restore defaults</Btn><Btn variant="primary" onClick={save}>Save</Btn></div>
    </Section>}

    <Section title="Report a concern" sub="Anyone involved in Canadian boxing can report misconduct or maltreatment: athletes, coaches, officials, volunteers and parents or guardians.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border-2 border-rope p-4">
          <Badge tone="info">Confidential and independent</Badge>
          <h4 className="mt-2 font-display text-lg font-bold">{cfg.itpName}</h4>
          <p className="text-sm">Boxing Canada’s Independent Third Party for complaints.</p>
          <p className="mt-1 text-sm text-muted">{cfg.itpNote}</p>
          <div className="mt-3">{ext(cfg.itpReportUrl, 'Submit a report online', 'inline-flex items-center gap-2 rounded-md border border-rope bg-rope px-3.5 py-2 text-sm font-semibold text-white hover:brightness-110')}</div>
        </div>
        <div className="rounded-lg border border-line p-4">
          <h4 className="font-display text-lg font-bold">Or report to Boxing Canada directly</h4>
          <p className="mt-1 text-sm"><b>Email:</b> <a href={'mailto:' + cfg.bcEmail} className="underline">{cfg.bcEmail}</a></p>
          <p className="text-sm"><b>Phone:</b> {cfg.bcPhone}</p>
          <h5 className="mt-3 text-sm font-semibold">Not sure if it’s a Safe Sport issue?</h5>
          <p className="text-sm">Answer a few questions in the {ext('https://flagtool.viasport.ca', 'Safe Sport flagging tool')} from viaSport, Sport’Aide and Sport Nova Scotia. Issues that aren’t about safety may belong in a provincial or national dispute process instead.</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Reporting in good faith is protected. Retaliating against anyone who reports or takes part in a process is itself a violation of the Code of Conduct.</p>
    </Section>

    <Section title="Policies" sub="The rules everyone in Boxing Canada agrees to follow.">
      <ul className="grid gap-2 sm:grid-cols-2">{cfg.policies.map(([t, u]) => <li key={t} className="rounded-md border border-line px-3 py-2 text-sm">📄 {ext(u, t)}</li>)}</ul>
      {viewer.role !== 'public' && <p className="mt-2 text-sm">More policies, including provincial ones, are in <button type="button" className="font-semibold text-rope underline" onClick={() => go('DOCS')}>Documents</button> under “Policies and Governance.”</p>}
    </Section>

    <Section title="Canadian Safe Sport Program" sub="As a federally funded national sport organization, Boxing Canada is adopting the Canadian Safe Sport Program rules.">
      <p className="text-sm">Some participants must complete the <b>Safe Sport 2025</b> e-learning course and sign a participant consent form. This includes athletes on the nationally identified athlete list; Boxing Canada employees, board and committee members; national-level coaches and athlete support personnel; and officials at level 4 and above. People who need to complete it are contacted directly.</p>
      <p className="mt-2 text-sm">{ext('https://cces.ca/safe-sport-education', 'Safe Sport education (CCES)')} · {ext('https://cces.ca/canadian-safe-sport-program', 'About the program')}</p>
      {viewer.role !== 'public' && <div className="mt-3 rounded-md bg-sunk px-3 py-2 text-sm">{cssp ? <><b>You may be in scope.</b> If you haven’t been contacted about Safe Sport 2025, ask Boxing Canada.</> : <>Based on your role, you probably aren’t required to take Safe Sport 2025, but anyone can take Safe Sport training.</>}{no && <div className="mt-1">Your latest Safe Sport module in The Locker: {ss ? <b>{ss.level}, {fmtDate(ss.date)}</b> : <span className="font-semibold text-warn">none on record</span>}.</div>}</div>}
    </Section>

    <Section title="Taking part without barriers or stress" sub="What you can expect, and what you can ask for, wherever you box.">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ['Know your rights', 'You have the right to a safe, respectful environment, to say no, to ask questions and to speak up without punishment. Coaches and officials are held to the Code of Conduct and the Universal Code of Conduct to Prevent and Address Maltreatment in Sport.'],
          ['Rule of Two and clear boundaries', 'Interactions between minors and adults in positions of trust should be in open, observable settings with another screened adult present. Messages to minors should include a parent or a second adult. Ask your club how it applies the Rule of Two.'],
          ['Weight, health and recovery', 'Making weight should never put you at risk. Severe dehydration and extreme weight cutting are unsafe. Speak to your coach or a medical official, and never return after a head injury until you’re cleared.'],
          ['Mental health matters', 'Pressure, setbacks and injuries affect everyone. Talking to someone early helps. The Canadian Sport Helpline can listen and refer you to support, and young people can contact Kids Help Phone at any hour.'],
          ['Inclusion and belonging', 'Boxing is for everyone, regardless of gender, gender identity, race, religion, disability, age, language or background. Discrimination and harassment are violations. Ask your PTSO about para and adaptive boxing and other options to take part.'],
          ['Parents and guardians', 'Stay involved: know your child’s coaches, use the Parents & Guardians page to approve coach changes for boxers under 18, and report anything that worries you. You don’t need proof to raise a concern.']
        ].map(([t, x]) => <div key={t} className="rounded-md border border-line p-3"><h4 className="font-display text-base font-bold">{t}</h4><p className="mt-1 text-sm">{x}</p></div>)}
      </div>
      <p className="mt-3 text-sm">{ext('https://boxingcanada.org/para-and-adaptive-boxing/', 'Para and adaptive boxing')} · {ext('https://boxingcanada.org/find-a-boxing-club/', 'Find a club')}</p>
    </Section>
  </div>;
}

/* =========================================================
   WordPress mode
   When the portal is served by the Boxing Canada Portal plugin,
   window.BCP_WP is set. Data then lives on the WordPress server:
   the server decides what each member may see and change, and
   sign-in uses WordPress accounts.
   ========================================================= */
const WP = (typeof window !== 'undefined' && window.BCP_WP) || null;
const WP_GUARDIAN = { code: '' };
function wpApi(path, body, method) {
  const headers = { 'Content-Type': 'application/json', 'X-WP-Nonce': WP.nonce };
  if (WP_GUARDIAN.code) headers['X-BCP-Guardian'] = WP_GUARDIAN.code;
  return fetch(WP.rest + path, { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
    .then(async r => { let j = null; try { j = await r.json(); } catch (e) {} if (!r.ok) { const err = new Error((j && j.message) || ('The portal server returned an error (' + r.status + ').')); err.code = (j && j.code) || r.status; err.status = r.status; throw err; } return j; });
}
const wpLogin = (login, password) => wpApi('login', { login, password });
const wpLogout = () => wpApi('logout', {}).catch(() => {}).then(() => { try { window.location.hash = ''; } catch (e) {} window.location.reload(); });
const WP_LISTENERS = { resync: null };
function wpSetGuardian(code) { if (WP_GUARDIAN.code === code) return; WP_GUARDIAN.code = code || ''; if (WP_LISTENERS.resync) WP_LISTENERS.resync(); }

/* Same interface as the claude.ai shared database, backed by the plugin's REST API. */
function makeWpDb({ onDenied, onOffline }) {
  const docs = {}, subs = {};
  let since = 0, scope = '', timer = null, stopped = false, inflight = null, queue = [], flushT = null, failures = 0;
  const snap = col => { const m = docs[col] || new Map(); const list = [...m.entries()].map(([id, d]) => ({ id, exists: true, data: () => d })); return { docs: list, size: list.length, empty: !list.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }; };
  const emit = col => (subs[col] || []).forEach(s => { try { s.next(snap(col)); } catch (e) { console.error(e); } });
  const apply = res => {
    const touched = new Set();
    if (res.full) Object.keys(docs).forEach(c => { docs[c] = new Map(); touched.add(c); });
    res.docs.forEach(x => { const m = docs[x.c] || (docs[x.c] = new Map()); if (x.d) m.set(x.id, x.data); else m.delete(x.id); touched.add(x.c); });
    since = res.rev; scope = res.scope;
    Object.keys(subs).forEach(c => { if (res.full || touched.has(c)) emit(c); });
  };
  const schedule = ms => { clearTimeout(timer); if (!stopped) timer = setTimeout(poll, ms != null ? ms : (document.hidden ? 30000 : 5000)); };
  const poll = (force) => {
    if (stopped) return Promise.resolve();
    if (inflight) return inflight;
    const s = force ? 0 : since;
    inflight = wpApi('sync?since=' + s + '&scope=' + encodeURIComponent(scope)).then(res => { failures = 0; apply(res); onOffline(false); })
      .catch(e => { failures++; if (failures >= 2) onOffline(true); })
      .finally(() => { inflight = null; schedule(failures ? Math.min(30000, 3000 * failures) : null); });
    return inflight;
  };
  WP_LISTENERS.resync = () => { since = 0; scope = ''; poll(true); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  const flush = () => {
    flushT = null;
    const batch = queue; queue = [];
    if (!batch.length) return;
    wpApi('write', { ops: batch.map(b => ({ c: b.c, id: b.id, data: b.data })) }).then(res => {
      let denied = null;
      res.results.forEach((r, i) => {
        const b = batch[i];
        if (r.status === 'ok') { const m = docs[b.c] || (docs[b.c] = new Map()); if (r.data) m.set(b.id, r.data); else m.delete(b.id); b.resolve(); }
        else if (r.status === 'skip') b.resolve();
        else { denied = r.message || 'You don’t have permission to make that change.'; const e = new Error(denied); e.code = 'permission_denied'; b.reject(e); }
      });
      if (denied) { onDenied(denied); poll(true); }
    }).catch(e => { const err = new Error(e.message); err.code = e.status === 403 ? 'permission_denied' : 'unavailable'; batch.forEach(b => b.reject(err)); if (err.code === 'permission_denied') { onDenied(e.message); poll(true); } });
  };
  const enqueue = (c, id, data) => new Promise((resolve, reject) => { queue.push({ c, id, data, resolve, reject }); if (!flushT) flushT = setTimeout(flush, 40); });
  return {
    collection: name => ({ onSnapshot: (next, err) => { const s = { next, err }; (subs[name] = subs[name] || []).push(s); if (since > 0) setTimeout(() => next(snap(name)), 0); else if (!inflight) poll(true); return () => { subs[name] = (subs[name] || []).filter(x => x !== s); }; } }),
    doc: path => { const [c, id] = path.split('/'); return { set: body => enqueue(c, id, body), delete: () => enqueue(c, id, null), acquire: () => Promise.resolve({ acquired: false }) }; },
    stop: () => { stopped = true; clearTimeout(timer); }
  };
}
/* An empty data set with the right shape, shown until the server's data arrives. */
function emptyPortalData() {
  const s = makeSeed(); const out = {};
  Object.keys(s).forEach(k => { out[k] = Array.isArray(s[k]) ? [] : s[k]; });
  out.nccp = { ...(s.nccp || {}), records: {} };
  return out;
}

/* =========================================================
   App shell data
   ========================================================= */
const DATA_KEY = 'bc-national-portal-v3';
function loadData() { try { const raw = LS.get(DATA_KEY); if (raw) { const d = migrateData(JSON.parse(raw)); if (d) return d; } } catch (e) {} return makeSeed(); }
const DEMO_BAR = ['u-b1', 'u-b2', 'u-c1', 'u-c2', 'u-c5', 'u-o1', 'u-m1', 'u-p1', 'u-s1'];

function DirectoryDashboard({ national }) {
  const [rid, setRid] = useState(null);
  if (rid) return <RecordBook boxerId={rid} onBack={() => setRid(null)} backLabel="Back to Athlete Record Books" />;
  return national ? <NationalOverview onOpen={setRid} /> : <AthleteDirectory onOpen={setRid} />;
}

function App() {
  const [data, setData] = useState(() => WP ? emptyPortalData() : loadData());
  const [logo, setLogoState] = useState(() => LS.get('bc-logo') || DEFAULT_LOGO);
  const [userId, setUserId] = useState(() => { if (WP) return WP.portalUserId || null; const id = LS.get('bc-session'); return id || null; });
  const [activeTab, setActiveTab] = useState(null);
  const [nav, setNav] = useState({});
  const [notes, setNotes] = useState([]);
  const [lang, setLangState] = useState(() => LS.get('bc-lang') === 'fr' ? 'fr' : 'en');
  UI_LANG = lang;
  const translatorRef = useRef(null);
  useEffect(() => {
    const root = document.getElementById('root');
    if (!translatorRef.current && root) translatorRef.current = makeTranslator(root);
    if (translatorRef.current) translatorRef.current.set(lang);
    document.documentElement.lang = lang; LS.set('bc-lang', lang); LS.set('bcScatLang', lang);
  }, [lang]);
  const langCtx = useMemo(() => ({ lang, setLang: setLangState }), [lang]);
  useEffect(() => {
    if (!crAutoDue(data).length) return;
    if (WP && (shared.phase !== 'live' || !(viewer && ['ptso', 'nsoadmin'].includes(viewer.role)))) return;
    update(d => crAutoDue(d).forEach(r => { crFinish(d, r, true, null, `Ended automatically: no response from the coach within ${CR_AUTO_DAYS} days`, 'Boxing Canada portal'); }));
  }, [data]);
  const [store, setStore] = useState({ chars: 0, failed: false });
  const [backupOpen, setBackupOpen] = useState(false);
  useEffect(() => { if (WP) return; const str = JSON.stringify(data); const ok = LS.set(DATA_KEY, str); setStore({ chars: str.length, failed: !ok }); }, [data]);
  const setLogo = useCallback(url => { setLogoState(url); if (!LS.set('bc-logo', url)) { /* too large for storage: keeps for this session */ } }, []);
  const dataRef = useRef(data); dataRef.current = data;
  const syncRef = useRef(null);
  const [shared, setShared] = useState({ phase: 'local', saving: 0, readOnly: false });
  const commit = useCallback(next => { const prev = dataRef.current; dataRef.current = next; setData(next); if (syncRef.current && syncRef.current.isReady()) syncRef.current.push(prev, next); }, []);
  const update = useCallback(fn => { const next = structuredClone(dataRef.current); fn(next); commit(next); }, [commit]);
  useEffect(() => {
    if (!WP) return;
    const seedKeys = makeSeed();
    const arrayKeys = Object.keys(seedKeys).filter(k => Array.isArray(seedKeys[k]));
    const metaKeys = Object.keys(seedKeys).filter(k => !Array.isArray(seedKeys[k]) && k !== 'logos');
    const db = makeWpDb({ onDenied: m => notify(m, 'bad'), onOffline: off => setShared(s => s.offline === off ? s : ({ ...s, offline: off })) });
    const sync = createSharedSync(db, {
      arrayKeys, metaKeys, seed: () => null, noSeed: true, getLocal: () => dataRef.current,
      onRemote: d => { dataRef.current = d; setData(d); },
      onStatus: st => setShared(s => ({ ...s, ...st })),
      onWarn: m => notify(m, 'warn')
    });
    syncRef.current = sync;
    setShared(s => ({ ...s, phase: 'connecting' }));
    const stop = sync.start();
    return () => { stop(); db.stop(); };
  }, []);
  useEffect(() => {
    let stop = null, cancelled = false;
    if (WP || !(window.claude && window.claude.use)) return;
    (async () => {
      let db = null;
      try { db = await window.claude.use('db'); } catch (e) { db = null; }
      if (cancelled || !db) return;
      try { const u = await window.claude.use('user'); if (u && u.can && u.can('data.write') === false) setShared(s => ({ ...s, readOnly: true })); } catch (e) {}
      const seedKeys = makeSeed();
      const arrayKeys = Object.keys(seedKeys).filter(k => Array.isArray(seedKeys[k]));
      const metaKeys = Object.keys(seedKeys).filter(k => !Array.isArray(seedKeys[k]) && k !== 'logos');
      const sync = createSharedSync(db, {
        arrayKeys, metaKeys, seed: () => makeSeed(), getLocal: () => dataRef.current,
        onRemote: d => { dataRef.current = d; setData(d); },
        onStatus: st => setShared(s => ({ ...s, ...st })),
        onWarn: m => notify(m, 'warn')
      });
      syncRef.current = sync;
      setShared(s => ({ ...s, phase: 'connecting' }));
      stop = sync.start();
    })();
    return () => { cancelled = true; if (stop) stop(); };
  }, []);
  const notify = useCallback((msg, tone = 'ok', action) => { const id = uid('n'); setNotes(n => [...n.slice(-2), { id, msg, tone, action }]); setTimeout(() => setNotes(n => n.filter(x => x.id !== id)), 7000); }, []);
  const viewer = userId ? getUser(data, userId) : null;
  const role = viewer && viewer.status === 'approved' ? ROLES[viewer.role] : null;
  const tab = role ? (tabsFor(viewer).includes(activeTab) ? activeTab : role.defaultTab) : null;
  const [profileOpen, setProfileOpen] = useState(false);
  const switchUser = id => { if (WP) { const d = (WP.demoUsers || []).find(x => x.id === id); if (!d) return; wpLogin(d.membershipId, d.password).then(() => window.location.reload()).catch(e => notify(e.message, 'bad')); return; } const u = getUser(data, id); if (!u) return; setUserId(id); LS.set('bc-session', id); setActiveTab(ROLES[u.role].defaultTab); setNav({}); };
  const signOut = () => { if (WP) { if (userId) { setUserId(null); wpLogout(); } return; } setUserId(null); LS.del('bc-session'); setActiveTab(null); setNav({}); };
  const [publicTab, setPublicTab] = useState('signin');
  const [activationCode, setActivationCode] = useState('');
  useEffect(() => {
    const read = () => { const h = window.location.hash || ''; const m = /^#activate-([A-Za-z0-9]+)$/.exec(h); if (m) { setActivationCode(m[1].toUpperCase()); setPublicTab('activate'); setUserId(null); LS.del('bc-session'); } const gm = /^#guardian-([A-Za-z0-9]+)$/.exec(h); if (gm) { setGuardianCode(gm[1].toUpperCase()); setPublicTab('guardian'); setUserId(null); LS.del('bc-session'); } };
    read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
  }, []);
  const openActivation = code => { signOut(); setActivationCode(code); setPublicTab('activate'); window.scrollTo({ top: 0 }); };
  const [guardianCode, setGuardianCode] = useState('');
  const openGuardian = code => { signOut(); setGuardianCode(code); setPublicTab('guardian'); window.scrollTo({ top: 0 }); };
  const go = useCallback((t, extra) => { setActiveTab(t); setNav(extra || {}); window.scrollTo({ top: 0 }); }, []);
  const clearNav = useCallback(() => setNav({}), []);
  const register = r => {
    if (WP) return;
    const id = uid('u'); const num = String(Math.floor(1000 + Math.random() * 9000));
    const u = { id, firstName: r.firstName.trim(), lastName: r.lastName.trim(), role: r.role, gender: r.gender, dob: r.dob, province: r.province, email: r.email.trim(), membershipId: ID_PREFIX[r.role] + num, password: r.password, status: 'approved', selectedCoachIds: [], club: r.coachId ? (getUser(data, r.coachId) || {}).club : '' };
    if (r.role === 'medical') u.honorific = 'Dr.';
    update(d => { d.users.push(u); if (r.role === 'boxer' && r.coachId) crCreate(d, { boxerId: u.id, coachId: r.coachId, type: 'start', by: u.id, note: 'Requested when creating my account.' }); });
    setUserId(id); LS.set('bc-session', id); setActiveTab(ROLES[u.role].defaultTab);
    notify(`Welcome, ${u.firstName}. Your membership ID is ${u.membershipId}.`);
  };
  const resetDemo = () => { if (WP) return; commit(makeSeed()); notify(shared.phase === 'live' ? 'Shared test data reset for all testers.' : 'Demo data reset.', 'info'); };
  const logoCtx = useMemo(() => ({ logo, setLogo }), [logo, setLogo]);

  const NoteStack = <div className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-3xl flex-col gap-2 px-3" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }} aria-live="polite">
    {notes.map(n => <div key={n.id} className="pointer-events-auto shadow-lg"><Banner tone={n.tone} onClose={() => setNotes(x => x.filter(y => y.id !== n.id))} action={n.action && <Btn size="sm" onClick={() => { n.action.fn(); setNotes(x => x.filter(y => y.id !== n.id)); }}>{n.action.label}</Btn>}>{n.msg}</Banner></div>)}
  </div>;

  if (!viewer || !role) return <LangCtx.Provider value={langCtx}><LogoCtx.Provider value={logoCtx}><AppCtx.Provider value={{ data, update, viewer: PUBLIC_VIEWER, notify, go: () => {}, nav: {}, clearNav: () => {}, openActivation, openGuardian }}>{NoteStack}{(shared.phase === 'connecting' || shared.phase === 'seeding') && <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30" role="status"><div className="rounded-lg border border-line bg-surface px-5 py-4 text-sm font-semibold shadow-xl">{shared.phase === 'seeding' ? 'Setting up the shared test data…' : 'Connecting to the shared test data…'}</div></div>}<SharedStatusBar shared={shared} /><PublicPortal data={data} onSignIn={id => { setActivationCode(''); setPublicTab('signin'); switchUser(id); }} onRegister={register} tab={publicTab} setTab={setPublicTab} activationCode={activationCode} guardianCode={guardianCode} /></AppCtx.Provider></LogoCtx.Provider></LangCtx.Provider>;

  const restoreData = obj => { const d = migrateData(structuredClone(obj)); if (!d) return false; if (!LS.set(DATA_KEY, JSON.stringify(d)) && shared.phase !== 'live') return false; commit(d); if (!getUser(d, userId)) signOut(); return true; };
  const ctx = { data, update, viewer, notify, go, nav, clearNav, openActivation, openGuardian, restoreData };
  const approvedUsers = data.users.filter(u => u.status === 'approved');
  const paidFor = kind => (data.evalRequests || []).filter(r => r.status === 'paid' && (data.programs || []).some(p => p.id === r.programId && p.kind === kind)).length + (kind === 'coach' ? (data.evalIntake || []).filter(i => ['unmatched', 'review'].includes(i.status)).length : 0);
  const tabCount = t => t === 'COACHPROG' && viewer.role === 'nsoadmin' ? paidFor('coach') + (nccpReminder(data).overdue ? 1 : 0) : t === 'OFFPROG' && viewer.role === 'nsoadmin' ? paidFor('official') : t === 'EVALUATOR' ? (data.evalRequests || []).filter(r => r.assignedEvaluatorId === viewer.id && (r.status === 'assigned' || (r.status === 'in_progress' && (r.tasks || []).some(x => taskState(x) === 'submitted')))).length : t === 'EVALS' ? (data.evalRequests || []).filter(r => r.requesterId === viewer.id && r.status === 'in_progress' && (r.tasks || []).some(x => taskState(x) === 'needs_work')).length : tabCountBase(t);
  const openPending = (data.openRequests || []).filter(r => r.status === 'pending' && (() => { const b = getUser(data, r.boxerId); return b && canDecideOpen(viewer, b); })()).length;
  const relUrgent = (data.coachRequests || []).filter(r => r.status === 'pending_admin' && (() => { const b = getUser(data, r.boxerId); return b && (viewer.role === 'nsoadmin' || (viewer.role === 'ptso' && b.province === viewer.province)); })()).length;
  const relCoach = viewer.role === 'coach' ? (data.coachRequests || []).filter(r => r.coachId === viewer.id && (r.status === 'pending_coach' || (r.status === 'pending_both' && !r.accepts.coach))).length : 0;
  const tabCountBase = t => t === 'USERS' ? openPending + relUrgent : t === 'BOXERS' && viewer.role === 'coach' ? relCoach : t === 'COACHES' && viewer.role === 'boxer' ? (data.coachRequests || []).filter(r => r.boxerId === viewer.id && (r.status === 'pending_boxer' || (r.status === 'pending_both' && !r.accepts.boxer))).length : t === 'DOCS' && viewer.role === 'nsoadmin' ? (data.docs || []).filter(d => d.status === 'pending').length : t === 'CALENDAR' ? calPendingFor(data, viewer).length : 0;
  let main = null;
  if (tab === 'DASHBOARD') main = viewer.role === 'boxer' ? <RecordBook boxerId={viewer.id} /> : viewer.role === 'coach' ? <CoachDashboard /> : <DirectoryDashboard national={viewer.role === 'nsoadmin'} />;
  if (tab === 'EVENTS') main = <EventsView />;
  if (tab === 'SANCTIONS') main = <SanctionSystemView />;
  if (tab === 'MEDICALS') main = <MedicalConsoleView />;
  if (tab === 'USERS') main = <UsersView />;
  if (tab === 'TRAVEL') main = <TravelPassView />;
  if (tab === 'DOCS') main = <DocumentLibraryView />;
  if (tab === 'CALENDAR') main = <CalendarView />;
  if (tab === 'ORGS') main = <OrgDirectoryView />;
  if (tab === 'COACHES') main = <MyCoachesView />;
  if (tab === 'BOXERS') main = <CoachBoxersView />;
  if (tab === 'CLUB') main = <ClubManagerView />;
  if (tab === 'SAFESPORT') main = <SafeSportView />;
  if (tab === 'EVALS') main = <MyEvaluationsView />;
  if (tab === 'COACHPROG') main = <EvalAdminView kind="coach" />;
  if (tab === 'OFFPROG') main = <EvalAdminView kind="official" />;
  if (tab === 'EVALUATOR') main = <EvaluatorView />;

  return <LangCtx.Provider value={langCtx}><LogoCtx.Provider value={logoCtx}><AppCtx.Provider value={ctx}>
    {NoteStack}
    {(shared.phase === 'connecting' || shared.phase === 'seeding') && <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30" role="status"><div className="rounded-lg border border-line bg-surface px-5 py-4 text-sm font-semibold shadow-xl">{shared.phase === 'seeding' ? 'Setting up the shared test data…' : 'Connecting to the shared test data…'}</div></div>}
    <SharedStatusBar shared={shared} />
    {profileOpen && <MembershipProfileModal userId={viewer.id} onClose={() => setProfileOpen(false)} />}
    <div className="flex min-h-screen flex-col">
      <header className="sticky z-30 border-b border-line bg-surface" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="rope-rule" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <BoxingCanadaLogo size="lg" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold text-maple">BOXING CANADA</div>
            <h1 className="font-display text-lg font-bold leading-tight sm:text-xl">{role.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!WP && <><label className="sr-only" htmlFor="user-switch">Active user</label>
            <select id="user-switch" className="field w-auto max-w-[260px] py-1.5" value={viewer.id} onChange={e => switchUser(e.target.value)}>
              {Object.keys(ROLES).map(rk => <optgroup key={rk} label={ROLES[rk].emoji + ' ' + ROLES[rk].label}>{approvedUsers.filter(u => u.role === rk).map(u => <option key={u.id} value={u.id}>{ROLES[u.role].emoji} {nameOf(data, u.id)}</option>)}</optgroup>)}
            </select></>}
            <NotificationBell /><Btn size="sm" variant="ghost" onClick={() => setProfileOpen(true)}>My profile</Btn><LangToggle /><Btn size="sm" onClick={signOut}>Sign Out</Btn>
          </div>
        </div>
        <MobileSectionMenu items={tabsFor(viewer).map(t => ({ key: t, label: TAB_LABELS[viewer.role][t], count: tabCount(t) }))} current={tab} onPick={t => go(t)} />
        <nav className="mx-auto hidden max-w-7xl flex-wrap gap-x-1 px-4 md:flex" aria-label="Sections">
          {tabsFor(viewer).map(t => <button key={t} type="button" onClick={() => go(t)} aria-current={tab === t ? 'page' : undefined} className={cx('-mb-px whitespace-nowrap border-b-[3px] px-3 py-2 text-sm font-semibold', tab === t ? 'border-maple text-ink' : 'border-transparent text-muted hover:text-ink')}>{TAB_LABELS[viewer.role][t]}{(() => { const n = tabCount(t); return n ? <span className="ml-1.5 rounded-full bg-maple px-1.5 py-0.5 text-[10px] font-bold text-white">{n}</span> : null; })()}</button>)}
        </nav>
      </header>
      {(!WP || WP.testMode) && <div className="hidden border-b border-line bg-sunk md:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-1.5">
          <span className="whitespace-nowrap text-xs font-semibold text-muted">Quick role demo</span>
          {(WP ? (WP.demoUsers || []).map(x => x.id) : DEMO_BAR).map(id => { const u = getUser(data, id); if (!u || u.status !== 'approved') return null; return <button key={id} type="button" onClick={() => switchUser(id)} aria-pressed={viewer.id === id} className={cx('whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', viewer.id === id ? 'border-rope bg-rope text-white' : 'border-line bg-surface text-ink hover:bg-sunk')}><span aria-hidden="true">{ROLES[u.role].emoji}</span> {u.firstName}</button>; })}
        </div>
      </div>}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5" key={viewer.id + tab}>
        {(store.failed || store.chars >= STORAGE_BUDGET * 0.85) && <Banner tone={store.failed ? 'bad' : 'warn'} className="mb-4" action={viewer.role === 'nsoadmin' && <Btn size="sm" variant="primary" onClick={() => setBackupOpen(true)}>Data & backup</Btn>}>{store.failed ? 'Your last change couldn’t be saved: this browser’s storage is full. Export a backup and remove large uploaded files before continuing.' : `Browser storage is ${Math.round(store.chars / STORAGE_BUDGET * 100)}% full. Export a backup and remove large uploaded files soon.`}</Banner>}
        {backupOpen && <DataBackupModal store={store} onClose={() => setBackupOpen(false)} onReset={resetDemo} />}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span aria-hidden="true" className="text-lg">{role.emoji}</span><span className="font-semibold">{nameOf(data, viewer.id)}</span><NationalTeamBadge user={viewer} /><span className="text-muted">{viewer.membershipId}, {PROVINCE_INFO[viewer.province].name}</span>{(!WP || WP.testMode) && <Badge tone="neutral" className="ml-auto">Reference date {fmtDate(REF_DATE)}</Badge>}</div>
        {main}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 text-xs text-muted">
          <BoxingCanadaLogo size="xs" />
          <span>© 2026 Boxing Canada. Digital Competitor Record Books, medical forms and sanctions.</span>
          {!WP && <><StorageMeter store={store} onOpen={viewer.role === 'nsoadmin' ? () => setBackupOpen(true) : null} />
          <Btn size="xs" variant="ghost" onClick={resetDemo}>Reset demo data</Btn></>}
          {WP && <span className="ml-auto">Portal {WP.version}</span>}
        </div>
      </footer>
    </div>
  </AppCtx.Provider></LogoCtx.Provider></LangCtx.Provider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
