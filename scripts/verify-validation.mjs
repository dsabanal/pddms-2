/* eslint-disable @typescript-eslint/explicit-function-return-type -- Node harness uses JavaScript. */
// Field-level rules found in the November 2026 QA pass: every form schema accepts real input
// (e.g. "0.5% Cream", "+63 917 123 4567") and rejects the edge cases listed in the QA report.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

if (!process.env.VALIDATION_TEST_PHASE) {
  const child = spawnSync(
    process.execPath,
    [
      '--experimental-loader',
      new URL('./inventory-test-loader.mjs', import.meta.url).href,
      fileURLToPath(import.meta.url)
    ],
    { stdio: 'inherit', env: { ...process.env, VALIDATION_TEST_PHASE: '1' } }
  )
  assert.equal(child.status, 0, 'validation checks failed')
} else {
  const schemas = await import('../src/shared/schemas.ts')
  const { wholesaleOrderSchema } = await import('../src/shared/wholesale.ts')
  const { localDate } = await import('../src/shared/inventory.ts')
  const { validationIssues } = await import('../src/shared/validation.ts')
  const shift = (days) => {
    const value = new Date(`${localDate()}T00:00:00Z`)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
  }
  const accepts = (schema, value) => {
    const result = schema.safeParse(value)
    assert.ok(result.success, JSON.stringify(result.error?.issues ?? []))
    return result.data
  }
  const rejects = (schema, value, field) => {
    const result = schema.safeParse(value)
    assert.equal(result.success, false, `accepted ${JSON.stringify(value).slice(0, 120)}`)
    if (field)
      assert.ok(
        validationIssues(result.error).some((issue) => issue.field === field),
        `no ${field} issue in ${JSON.stringify(result.error.issues)}`
      )
  }

  // 1. Senior/PWD discount IDs.
  const customer = {
    fullName: 'Lola Remedios',
    phone: '09171234567',
    email: null,
    address: null,
    discountType: 'senior',
    discountId: 'SC-12345',
    discountExpiresAt: null
  }
  accepts(schemas.newCustomerSchema, customer)
  accepts(schemas.newCustomerSchema, { ...customer, discountId: 'OSCA 2024/0012' })
  for (const discountId of ['💊', 'abc', '<b>1234</b>', 'x'.repeat(41)])
    rejects(schemas.newCustomerSchema, { ...customer, discountId }, 'discountId')
  rejects(schemas.newCustomerSchema, { ...customer, discountType: 'pwd' }, 'discountExpiresAt')
  accepts(schemas.newCustomerSchema, {
    ...customer,
    discountType: 'pwd',
    discountExpiresAt: shift(365)
  })
  rejects(
    schemas.newCustomerSchema,
    { ...customer, discountExpiresAt: shift(-1) },
    'discountExpiresAt'
  )
  accepts(schemas.newCustomerSchema, { ...customer, discountExpiresAt: localDate() })
  accepts(schemas.newCustomerSchema, {
    ...customer,
    discountType: 'none',
    discountId: null,
    discountExpiresAt: null
  })

  // 2. Receiving: the selling price must be at least ₱0.01 (the cost check runs in the database).
  const receipt = {
    requestId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    deliveredAt: localDate(),
    notes: null,
    items: [
      { itemId: 1, receivedQuantity: 1, batchNumber: 'B-1', sellPrice: 0, expiresAt: shift(400) }
    ]
  }
  rejects(schemas.purchaseOrderDeliverySchema, receipt, 'sellPrice')

  // 4. Wholesale orders cannot be due before the order date.
  const order = {
    requestId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    customerId: 1,
    dueDate: localDate(),
    deliveryAddress: '1 Main St',
    notes: '',
    items: [{ batchId: 1, quantity: 1, unitPriceCents: 500 }]
  }
  accepts(wholesaleOrderSchema, order)
  rejects(wholesaleOrderSchema, { ...order, dueDate: shift(-1) }, 'dueDate')

  // 5. Formulations with strengths and combinations.
  const product = {
    category: 'Analgesic',
    genericName: 'Paracetamol',
    brandName: 'Biogesic',
    formulation: '500 mg Tablet',
    isPrescribed: false,
    isControlled: false,
    reorderLevel: 10
  }
  for (const formulation of ['0.5% Cream', 'Vit B1+B6+B12', '1:1 Suspension', '250 mg/5 mL'])
    accepts(schemas.newDrugSchema, { ...product, formulation })
  for (const formulation of ['<script>', '💊 Tablet', '-Tablet'])
    rejects(schemas.newDrugSchema, { ...product, formulation }, 'formulation')

  // 6. Length limits on names and addresses.
  const long = (length) => 'A'.repeat(length)
  rejects(schemas.newCustomerSchema, { ...customer, fullName: long(121) }, 'fullName')
  rejects(schemas.newCustomerSchema, { ...customer, address: long(501) }, 'address')
  accepts(schemas.newCustomerSchema, { ...customer, fullName: long(120), address: long(500) })
  rejects(schemas.newDrugSchema, { ...product, brandName: long(121) }, 'brandName')
  const account = {
    role: 'cashier',
    fullName: 'Juan Dela Cruz',
    username: 'juan',
    password: 'Pass#2026'
  }
  rejects(schemas.newAccountSchema, { ...account, fullName: long(121) }, 'fullName')
  const supplier = {
    organization: 'Unilab',
    person: 'Maria Santos',
    phone: '09171234567',
    telephone: null,
    email: null,
    street: '1 Main St',
    city: 'General Santos',
    country: 'Philippines',
    province: 'South Cotabato',
    postalCode: '9500'
  }
  rejects(schemas.newSupplierSchema, { ...supplier, street: long(501) }, 'street')
  rejects(schemas.newSupplierSchema, { ...supplier, city: long(101) }, 'city')
  rejects(schemas.newSupplierSchema, { ...supplier, organization: long(121) }, 'organization')

  // 7. Supplier organization and telephone.
  rejects(schemas.newSupplierSchema, { ...supplier, organization: '!!!' }, 'organization')
  accepts(schemas.newSupplierSchema, { ...supplier, organization: 'Mercury Drug Corp. (GenSan)' })
  rejects(schemas.newSupplierSchema, { ...supplier, telephone: 'call me maybe' }, 'telephone')
  for (const telephone of ['(083) 552 1234', '+63 83 552 1234', '552-1234'])
    accepts(schemas.newSupplierSchema, { ...supplier, telephone })

  // 8. Mobile numbers are cleaned up to 09XXXXXXXXX.
  for (const phone of [
    '0917 123 4567',
    '0917-123-4567',
    '+639171234567',
    '+63 917 123 4567',
    '639171234567'
  ])
    assert.equal(accepts(schemas.newCustomerSchema, { ...customer, phone }).phone, '09171234567')
  assert.equal(
    accepts(schemas.newSupplierSchema, { ...supplier, phone: '+63 917-123-4567' }).phone,
    '09171234567'
  )
  for (const phone of ['0917123456', '08171234567', '+6309171234567', ''])
    rejects(schemas.newCustomerSchema, { ...customer, phone }, 'phone')

  // 9. Passwords.
  rejects(schemas.newAccountSchema, { ...account, password: '        ' }, 'password')
  rejects(schemas.newAccountSchema, { ...account, password: long(129) }, 'password')
  accepts(schemas.newAccountSchema, { ...account, password: 'pass word 2026' })
  rejects(schemas.accountUpdateSchema, { password: '         ' }, 'password')
  rejects(
    schemas.profileUpdateSchema,
    { fullName: 'Juan', username: 'juan', currentPassword: 'x', password: '          ' },
    'password'
  )
  rejects(
    schemas.masterSetupSchema,
    { username: 'admin', password: 'password123', fullName: 'Admin 2' },
    'fullName'
  )

  // 10. Reorder level.
  accepts(schemas.newDrugSchema, { ...product, reorderLevel: 1_000_000 })
  rejects(schemas.newDrugSchema, { ...product, reorderLevel: 1_000_001 }, 'reorderLevel')

  console.log(
    'PASS: discount IDs and expiry, receiving price floor, wholesale due date, formulations, length limits, supplier text, mobile clean-up, passwords, reorder level'
  )
}
