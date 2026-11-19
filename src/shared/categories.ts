/**
 * The medicine categories a product can have. Category is picked from this list, never typed, so
 * every report, filter and receipt shows the same spelling.
 *
 * To add a category, add it here. Products keep their category if one is ever removed; the edit
 * form then asks for a category from the list.
 */
export const medicineCategories = [
  'Analgesic',
  'Antacid',
  'Antibiotic',
  'Anticoagulant',
  'Anticonvulsant',
  'Antidepressant',
  'Antidiabetic',
  'Antidiarrheal',
  'Antiemetic',
  'Antifungal',
  'Antihistamine',
  'Antihypertensive',
  'Anti-inflammatory',
  'Antipsychotic',
  'Antiviral',
  'Bronchodilator',
  'Cough and Cold',
  'Dermatological',
  'Diuretic',
  'Eye and Ear',
  'Hormone',
  'Lipid-lowering',
  'Sedative',
  'Vitamins and Supplements',
  'Medical Supply',
  'Others'
] as const

export type MedicineCategory = (typeof medicineCategories)[number]

/** Where a product's category is not on the list and no spelling below matches. */
export const fallbackCategory: MedicineCategory = 'Others'

/** Other spellings people typed before the list existed, lowercase, mapped onto the list. */
const synonyms: Record<string, MedicineCategory> = {
  analgesics: 'Analgesic',
  'pain reliever': 'Analgesic',
  'pain relief': 'Analgesic',
  painkiller: 'Analgesic',
  antipyretic: 'Analgesic',
  'analgesic/antipyretic': 'Analgesic',
  antacids: 'Antacid',
  'proton pump inhibitor': 'Antacid',
  ppi: 'Antacid',
  antibiotics: 'Antibiotic',
  antibacterial: 'Antibiotic',
  'anti-bacterial': 'Antibiotic',
  antihistamines: 'Antihistamine',
  'anti-allergy': 'Antihistamine',
  antiallergy: 'Antihistamine',
  'anti-hypertensive': 'Antihypertensive',
  antihypertensives: 'Antihypertensive',
  'anti-diabetic': 'Antidiabetic',
  antidiabetics: 'Antidiabetic',
  antiinflammatory: 'Anti-inflammatory',
  nsaid: 'Anti-inflammatory',
  nsaids: 'Anti-inflammatory',
  antifungals: 'Antifungal',
  antivirals: 'Antiviral',
  bronchodilators: 'Bronchodilator',
  'cough & cold': 'Cough and Cold',
  'cough/cold': 'Cough and Cold',
  cough: 'Cough and Cold',
  cold: 'Cough and Cold',
  vitamin: 'Vitamins and Supplements',
  vitamins: 'Vitamins and Supplements',
  supplement: 'Vitamins and Supplements',
  supplements: 'Vitamins and Supplements',
  'vitamins & supplements': 'Vitamins and Supplements',
  diuretics: 'Diuretic',
  sedatives: 'Sedative',
  anxiolytic: 'Sedative',
  hormones: 'Hormone',
  statin: 'Lipid-lowering',
  statins: 'Lipid-lowering',
  'medical supplies': 'Medical Supply',
  supply: 'Medical Supply',
  supplies: 'Medical Supply',
  other: 'Others',
  medicine: 'Others'
}

const byLowercase = new Map<string, MedicineCategory>(
  medicineCategories.map((category) => [category.toLowerCase(), category])
)

/** The list entry for a category typed before the list existed, or "Others". */
export const normalizeCategory = (value: string | null | undefined): MedicineCategory => {
  const key = (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return byLowercase.get(key) ?? synonyms[key] ?? fallbackCategory
}

export const isMedicineCategory = (value: string): value is MedicineCategory =>
  (medicineCategories as readonly string[]).includes(value)
