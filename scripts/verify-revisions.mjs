/* eslint-disable @typescript-eslint/explicit-function-return-type -- Executable JavaScript harness. */
/**
 * Verifies the post-defense revisions end to end through the IPC handlers:
 * - Medicine category comes from the fixed list; anything else is refused, and categories typed
 *   before the list existed are moved onto it by the upgrade.
 * - Sales, purchase orders and wholesale orders are numbered TXN-/PO-/WO-000123 from the row id,
 *   the receipt and delivery receipt use the same format, and the upgrade rewrites older numbers
 *   (and a sale number quoted in a stock-out reason).
 * - The app is configured with one database file only.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.env.REVISIONS_TEST_PHASE) {
  const directory = await mkdtemp(join(tmpdir(), 'pddms-revisions-test-'))
  try {
    const child = spawnSync(
      process.execPath,
      [
        '--experimental-loader',
        new URL('./inventory-test-loader.mjs', import.meta.url).href,
        fileURLToPath(import.meta.url)
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          REVISIONS_TEST_PHASE: 'workflow',
          DATABASE: join(directory, 'revisions.db'),
          INVENTORY_TEST_USER_DATA: directory
        }
      }
    )
    assert.equal(child.status, 0, 'workflow failed')
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
    assert.ok(directory.includes('pddms-revisions-test-'))
    await rm(directory, { recursive: true })
  }
} else {
  const { db } = await import('../src/main/db.ts')
  const { env } = await import('../src/main/env.ts')
  const { initializeDatabase, migrate } = await import('../src/main/migrations.ts')
  const { state } = await import('../src/main/api/index.ts')
  const { channels } = await import('../src/shared/constants.ts')
  const { localDate } = await import('../src/shared/inventory.ts')
  const { formatId, parseId, matchesId, batchLabel, customerId } =
    await import('../src/shared/identifiers.ts')
  const { medicineCategories, normalizeCategory } = await import('../src/shared/categories.ts')
  const { receiptModel } = await import('../src/shared/receipt.ts')
  const { deliveryReceiptNumber } = await import('../src/shared/wholesale.ts')
  const { handlers } = await import('./inventory-test-electron.mjs')
  const { sql } = await import('kysely')
  const { hash } = await import('argon2')
  for (const module of [
    'auth',
    'account',
    'customer',
    'supplier',
    'product',
    'price-list',
    'purchase-order',
    'procurement',
    'sales',
    'inventory',
    'wholesale'
  ])
    await import(`../src/main/${module}/controller.ts`)
  await initializeDatabase()

  // One database: the only file the app is configured with is DATABASE.
  assert.deepEqual(Object.keys(env).sort(), ['DATABASE', 'DRIVE_BACKUP_NAME'])
  assert.ok(!('DATABASE_BACKUP' in env))

  // Identifier helpers.
  assert.equal(formatId('sale', 12), 'TXN-000012')
  assert.equal(formatId('product', 1234567), 'MED-1234567')
  assert.deepEqual(parseId('txn 12'), { kind: 'sale', id: 12 })
  assert.deepEqual(parseId(' PO-000007 '), { kind: 'purchaseOrder', id: 7 })
  assert.equal(parseId('Paracetamol'), null)
  assert.equal(parseId('XYZ-12'), null)
  assert.ok(matchesId('med-5', 'product', 5))
  assert.ok(!matchesId('med-5', 'customer', 5))
  assert.equal(batchLabel({ id: 3, physicalTag: null }), 'BAT-000003')
  assert.equal(batchLabel({ id: 3, physicalTag: ' LOT-9 ' }), 'LOT-9')
  assert.equal(customerId({ id: 4, clientType: 'pharmacy' }), 'CLT-000004')
  assert.equal(customerId({ id: 4, clientType: 'retail' }), 'CUS-000004')
  // Every prefix is different, so an ID never names two kinds of record.
  const { idPrefixes } = await import('../src/shared/identifiers.ts')
  assert.equal(new Set(Object.values(idPrefixes)).size, Object.keys(idPrefixes).length)

  // Category helpers.
  assert.equal(normalizeCategory(' vitamins '), 'Vitamins and Supplements')
  assert.equal(normalizeCategory('ANALGESIC'), 'Analgesic')
  assert.equal(normalizeCategory('NSAID'), 'Anti-inflammatory')
  assert.equal(normalizeCategory('Something odd'), 'Others')
  assert.equal(new Set(medicineCategories).size, medicineCategories.length)

  const invoke = (channel, ...args) => handlers.get(channel)({}, ...args)
  const ok = async (channel, ...args) => {
    const result = await invoke(channel, ...args)
    assert.equal(result.success, true, `${channel}: ${result.error}`)
    return result
  }
  const bad = async (channel, pattern, ...args) => {
    const result = await invoke(channel, ...args)
    assert.equal(result.success, false, `${channel} should fail: ${JSON.stringify(result)}`)
    if (pattern) assert.match(result.error ?? '', pattern)
    return result
  }
  const today = localDate()
  const addDays = (offset) => {
    const value = new Date()
    value.setDate(value.getDate() + offset)
    return localDate(value)
  }
  const password = await hash('RevisionsTest123')
  const admin = await db
    .insertInto('accounts')
    .values({ role: 'master', username: 'rev-admin', fullName: 'Rev Admin', password })
    .returningAll()
    .executeTakeFirstOrThrow()
  state.session = { account: admin }

  // Category: only the list is accepted, on create and on edit.
  const productInput = {
    brandName: 'Rev Tablet',
    genericName: 'Paracetamol',
    formulation: '500 mg Tablet',
    category: 'Analgesic',
    isPrescribed: false,
    isControlled: false,
    reorderLevel: 5
  }
  await bad(channels.product.createOne, /Choose a category from the list/, {
    ...productInput,
    category: 'analgesics'
  })
  await bad(channels.product.createOne, /Choose a category from the list/, {
    ...productInput,
    category: 'Painkillers!'
  })
  const product = (await ok(channels.product.createOne, productInput)).product
  assert.equal(product.category, 'Analgesic')
  await bad(channels.product.updateOneById, /Choose a category from the list/, product.id, {
    category: 'Pain'
  })
  await ok(channels.product.updateOneById, product.id, { category: 'Anti-inflammatory' })

  // Purchase order, receiving, sale and wholesale order numbers.
  const supplier = (
    await ok(channels.supplier.createOne, {
      organization: 'Rev Supplier',
      person: 'Ana Reyes',
      phone: '09170000001',
      telephone: null,
      email: null,
      street: 'Street',
      city: 'City',
      province: 'Province',
      country: 'Philippines',
      postalCode: '1000',
      pdeaLicense: null
    })
  ).supplier
  const packId = (
    await ok(channels.priceList.createPack, {
      supplierId: supplier.id,
      drugId: product.id,
      piecesPerBox: 10,
      unitCost: 50,
      effectiveFrom: today,
      quotationReference: 'Q-REV'
    })
  ).data
  const draft = (
    await ok(channels.purchaseOrder.createOne, {
      supplierId: supplier.id,
      items: [{ packId, quantity: 5 }]
    })
  ).order
  assert.equal(draft.orderNumber, formatId('purchaseOrder', draft.id))
  assert.match(draft.orderNumber, /^PO-\d{6}$/)
  const order = (
    await ok(channels.purchaseOrder.updateStatusById, draft.id, { status: 'submitted' })
  ).order
  await ok(channels.purchaseOrder.recordDeliveryById, order.id, {
    requestId: randomUUID(),
    deliveredAt: today,
    notes: null,
    deliveredByName: 'Driver',
    checkedByName: 'Clerk',
    items: [
      {
        itemId: order.items[0].id,
        receivedQuantity: 5,
        batchNumber: 'LOT-REV',
        sellPrice: 8,
        expiresAt: addDays(400)
      }
    ]
  })
  const batch = await db
    .selectFrom('batches')
    .selectAll()
    .where('drugId', '=', product.id)
    .executeTakeFirstOrThrow()
  assert.equal(batch.physicalTag, 'LOT-REV')

  const sale = (
    await ok(channels.sales.checkout, {
      requestId: randomUUID(),
      customerId: null,
      items: [{ batchId: batch.id, quantity: 2, unit: 'piece', unitPriceCents: 800 }],
      expectedTotalCents: 1600,
      cashCents: 2000
    })
  ).sale
  assert.equal(sale.reference, formatId('sale', sale.id))
  assert.match(sale.reference, /^TXN-\d{6}$/)
  // The supplier's lot number is kept as written; BAT-000123 is only for batches without one.
  assert.equal(sale.items[0].batchNumber, 'LOT-REV')
  // The receipt prints one number, the transaction number.
  const receipt = receiptModel(sale)
  assert.equal(receipt.number, sale.reference)
  const saleStockOut = await db
    .selectFrom('stockOuts')
    .select('reason')
    .where('batchId', '=', batch.id)
    .orderBy('id', 'desc')
    .executeTakeFirstOrThrow()
  assert.equal(saleStockOut.reason, `Sale ${sale.reference}`)
  const history = (await ok(channels.sales.history)).records
  assert.ok(history.some((item) => item.reference === sale.reference))

  const client = await db
    .insertInto('customers')
    .values({
      fullName: 'Rev Pharmacy',
      clientType: 'pharmacy',
      contactPerson: 'Pharmacist',
      phone: '09171234567',
      email: null,
      address: 'Delivery address',
      discountType: 'none',
      discountId: null,
      discountExpiresAt: null
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  const orderId = (
    await ok(channels.wholesale.create, {
      requestId: randomUUID(),
      customerId: client.id,
      dueDate: today,
      scheduledDate: today,
      deliveryAddress: client.address,
      notes: '',
      items: [{ batchId: batch.id, quantity: 1, unitPriceCents: 8000 }]
    })
  ).data
  const wholesale = (await ok(channels.wholesale.get, orderId)).data
  assert.equal(wholesale.reference, formatId('wholesaleOrder', orderId))
  assert.equal(deliveryReceiptNumber(wholesale), formatId('deliveryReceipt', orderId))

  // Upgrade: older free-text categories and long reference codes are rewritten, once.
  const oldSale = `SALE-${randomUUID().toUpperCase()}`
  await sql`UPDATE drugs SET category = 'vitamins' WHERE id = ${product.id}`.execute(db)
  await sql`UPDATE sales SET reference = ${oldSale} WHERE id = ${sale.id}`.execute(db)
  await sql`UPDATE stock_outs SET reason = ${`Sale ${oldSale}`} WHERE reason = ${`Sale ${sale.reference}`}`.execute(
    db
  )
  await sql`UPDATE purchase_orders SET order_number = 'PO-20261118093000-AB12CD34'
    WHERE id = ${order.id}`.execute(db)
  await sql`UPDATE wholesale_orders SET reference = ${`WHO-${randomUUID().toUpperCase()}`}
    WHERE id = ${orderId}`.execute(db)
  await migrate(db)
  await migrate(db)
  const after = {
    category: (await sql`SELECT category FROM drugs WHERE id = ${product.id}`.execute(db)).rows[0]
      .category,
    sale: (await sql`SELECT reference FROM sales WHERE id = ${sale.id}`.execute(db)).rows[0]
      .reference,
    order: (await sql`SELECT order_number FROM purchase_orders WHERE id = ${order.id}`.execute(db))
      .rows[0].orderNumber,
    wholesale: (await sql`SELECT reference FROM wholesale_orders WHERE id = ${orderId}`.execute(db))
      .rows[0].reference,
    reason: (
      await sql`SELECT reason FROM stock_outs WHERE instr(reason, ${sale.reference}) > 0`.execute(
        db
      )
    ).rows.length
  }
  assert.deepEqual(after, {
    category: 'Vitamins and Supplements',
    sale: sale.reference,
    order: formatId('purchaseOrder', order.id),
    wholesale: formatId('wholesaleOrder', orderId),
    reason: 1
  })

  console.log(
    'PASS: category list enforced and upgraded, TXN/PO/WO/DR/BAT numbers from row ids, old numbers rewritten, one database configured'
  )
}
