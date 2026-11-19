import { sql, type Kysely } from 'kysely'
import { normalizeCategory } from '../src/shared/categories'
import { formatId } from '../src/shared/identifiers'
import type { Database } from '../src/shared/types'

/**
 * Post-defense revisions. Safe to run again, on the live database and on an older backup being
 * restored:
 *
 * - Medicine category is now picked from a fixed list. Categories typed before the list existed
 *   are moved onto the matching list entry ("vitamins" becomes "Vitamins and Supplements"), and
 *   anything with no match becomes "Others".
 * - Sale, purchase order and wholesale order numbers now follow PREFIX-000123 (TXN, PO, WO), made
 *   from the row id. Older numbers (SALE-<long code>, PO-<date>-<code>, WHO-<long code>) are
 *   rewritten, and so is a sale number quoted in a write-off reason. The audit log keeps the
 *   numbers it recorded at the time, as an audit trail should.
 */
export async function up(db: Kysely<Database>): Promise<void> {
  const tables = new Set((await db.introspection.getTables()).map((table) => table.name))

  if (tables.has('drugs')) {
    const drugs = await sql<{
      id: number
      category: string
    }>`SELECT id, category FROM drugs`.execute(db)
    for (const drug of drugs.rows) {
      const category = normalizeCategory(drug.category)
      if (category !== drug.category)
        await sql`UPDATE drugs SET category = ${category} WHERE id = ${drug.id}`.execute(db)
    }
  }

  const renumber = async (
    table: string,
    column: string,
    kind: 'sale' | 'purchaseOrder' | 'wholesaleOrder',
    rewriteStockOuts = false
  ): Promise<void> => {
    if (!tables.has(table)) return
    const rows = await sql<{ id: number; value: string }>`SELECT id, ${sql.ref(column)} AS value
      FROM ${sql.table(table)}`.execute(db)
    for (const row of rows.rows) {
      const value = formatId(kind, row.id)
      if (row.value === value) continue
      await sql`UPDATE ${sql.table(table)} SET ${sql.ref(column)} = ${value}
        WHERE id = ${row.id}`.execute(db)
      if (rewriteStockOuts && tables.has('stock_outs'))
        await sql`UPDATE stock_outs SET reason = replace(reason, ${row.value}, ${value})
          WHERE instr(reason, ${row.value}) > 0`.execute(db)
    }
  }
  await renumber('sales', 'reference', 'sale', true)
  await renumber('purchase_orders', 'order_number', 'purchaseOrder')
  await renumber('wholesale_orders', 'reference', 'wholesaleOrder')
}

export async function down(): Promise<void> {
  // Note: Old free-text categories and long reference codes are not kept, so this cannot be undone.
}
