/**
 * One format for every identifier the system makes itself: PREFIX-000123.
 *
 * The number is the record's row id in the database, so an identifier is unique, never typed by
 * hand and never reused. The prefix says what kind of record it is. Six digits are shown; larger
 * numbers simply grow (PREFIX-1000000).
 *
 * Numbers that come from outside the pharmacy (supplier invoice and credit note numbers, the
 * supplier's batch or lot number, TIN, PDEA licence, Senior Citizen/PWD IDs, prescription numbers
 * and GCash/Maya references) are not ours to number. They are kept as written, trimmed.
 */
export const idPrefixes = {
  /** User account (employee). */
  account: 'EMP',
  /** Medicine (product). */
  product: 'MED',
  /** Stock batch received into inventory. */
  batch: 'BAT',
  /** Retail customer. */
  customer: 'CUS',
  /** Pharmacy client (wholesale). */
  pharmacyClient: 'CLT',
  /** Supplier. */
  supplier: 'SUP',
  /** Retail sale; also the number printed on the receipt. */
  sale: 'TXN',
  /** Purchase order to a supplier. */
  purchaseOrder: 'PO',
  /** Receiving report: one delivery received against a purchase order. */
  receiving: 'RR',
  /** Wholesale order from a pharmacy client. */
  wholesaleOrder: 'WO',
  /** Delivery receipt printed for a wholesale order. */
  deliveryReceipt: 'DR',
  /** Return of stock to a supplier. */
  supplierReturn: 'RET',
  /** Stock count. */
  stockCount: 'CNT',
  /** Cash drawer count. */
  cashCount: 'CC'
} as const

export type IdKind = keyof typeof idPrefixes

export const ID_DIGITS = 6

/** Formats a row id, e.g. formatId('sale', 12) is "TXN-000012". */
export const formatId = (kind: IdKind, id: number): string =>
  `${idPrefixes[kind]}-${String(id).padStart(ID_DIGITS, '0')}`

const kindByPrefix = new Map<string, IdKind>(
  Object.entries(idPrefixes).map(([kind, prefix]) => [prefix, kind as IdKind])
)

/**
 * Reads an identifier typed into a search box. Accepts any case, an optional dash or space and
 * missing leading zeros ("txn 12", "TXN-000012"). Returns null for anything else.
 */
export const parseId = (text: string): { kind: IdKind; id: number } | null => {
  const match = /^\s*([A-Za-z]{2,3})[\s-]?0*(\d{1,12})\s*$/.exec(text)
  if (!match) return null
  const kind = kindByPrefix.get(match[1].toUpperCase())
  const id = Number(match[2])
  return kind && Number.isSafeInteger(id) && id > 0 ? { kind, id } : null
}

/** True when the search text is the identifier of this record. */
export const matchesId = (text: string, kind: IdKind, id: number): boolean => {
  const parsed = parseId(text)
  return !!parsed && parsed.kind === kind && parsed.id === id
}

/** Batch label: the supplier's own batch/lot number when there is one, otherwise BAT-000012. */
export const batchLabel = (batch: { id: number; physicalTag: string | null }): string =>
  batch.physicalTag?.trim() || formatId('batch', batch.id)

/** Customer or pharmacy client identifier, by client type. */
export const customerId = (customer: { id: number; clientType?: string | null }): string =>
  formatId(customer.clientType === 'pharmacy' ? 'pharmacyClient' : 'customer', customer.id)
