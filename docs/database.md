# Database

Med Prix uses **one database**: a single SQLite file, `pddms.db`. Every module (sales, inventory,
suppliers and purchasing, wholesale, reports, users and the activity log) reads and writes tables in
that one file through the main process (Kysely over better-sqlite3). The screens never open the
database themselves; they ask the main process over IPC.

| Setting             | Meaning                                                                                                           |
| :------------------ | :---------------------------------------------------------------------------------------------------------------- |
| `DATABASE`          | Path of the one database file. Default `./pddms.db`; installed builds use the app's user-data folder.             |
| `DRIVE_BACKUP_NAME` | Optional. Only the file name a backup copy would get on Google Drive. That upload is planned and not switched on. |

Other files are **not** extra databases:

- **Backups** (`pddms-backup-*` folders) hold a copy of `pddms.db` plus the supplier invoice files.
  Restoring a backup replaces the current file; it never runs beside it.
- **Demo data** (`pddms-demo.db`, from `npm run demo:dev`) is a copy with the same tables and sample
  records. The app opens it _instead of_ `pddms.db` while the demo runs.
- **Supplier invoice files** (PDF or image) are stored in a folder; the database keeps their names.

Each computer has its own `pddms.db`; there is no shared network database.

## Tables (28)

The ERD is drawn in five parts so it fits on a page. All five parts are tables of the same file.

| Part                                | Tables                                                                                                                                                                  |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Sales and customers              | `customers`, `sales`, `sale_items`, `cash_counts`                                                                                                                       |
| 2. Inventory and expiry             | `drugs`, `batches`, `stock_outs`, `stock_counts`, `stock_count_lines`, `stock_adjustments`                                                                              |
| 3. Suppliers and purchase orders    | `suppliers`, `supplier_packs`, `supplier_pack_prices`, `supplier_product_costs`, `purchase_orders`, `purchase_order_items`                                              |
| 4. Deliveries, invoices and returns | `supplier_deliveries`, `supplier_delivery_items`, `supplier_delivery_rejections`, `supplier_invoices`, `supplier_payments`, `supplier_returns`, `supplier_credit_notes` |
| 5. Wholesale and administration     | `wholesale_orders`, `wholesale_order_items`, `wholesale_payments`, `accounts`, `audit_logs`                                                                             |

`kysely_migration` and `kysely_migration_lock` record which upgrades have run. The schema is
created and upgraded by `src/main/migrations.ts` when the app starts, and again on an older backup
being restored.

## Identifier formats

Every identifier the system makes follows one rule, **PREFIX-000123**: a prefix for the kind of
record and the record's row id, padded to six digits. Identifiers are made by the system from the
row id, so they are unique and never typed by hand. They are defined once, in
`src/shared/identifiers.ts`, and used on screens, in searches, on receipts and in reports.

| Prefix | Record                                   | Where it is stored or shown                              |
| :----- | :--------------------------------------- | :------------------------------------------------------- |
| `EMP`  | User account (employee)                  | User Management list and details                         |
| `MED`  | Medicine (product)                       | Inventory list, product page, counter search             |
| `BAT`  | Stock batch with no supplier lot number  | Batch lists, sale lines, reports                         |
| `CUS`  | Retail customer                          | Customers list and profile                               |
| `CLT`  | Pharmacy client (wholesale)              | Pharmacy Clients list and profile                        |
| `SUP`  | Supplier                                 | Suppliers list                                           |
| `TXN`  | Retail sale; also the receipt number     | `sales.reference`, receipt, transaction history, reports |
| `PO`   | Purchase order                           | `purchase_orders.order_number`                           |
| `RR`   | Receiving report (one delivery received) | Receiving records                                        |
| `WO`   | Wholesale order                          | `wholesale_orders.reference`                             |
| `DR`   | Delivery receipt for a wholesale order   | Printed delivery receipt                                 |
| `RET`  | Return to a supplier                     | Returns & Credits                                        |
| `CNT`  | Stock count                              | Stock count list and sheet                               |
| `CC`   | Cash drawer count                        | Cash count dialog, report                                |

The Inventory, counter, Customers, Pharmacy Clients, Suppliers and User Management searches accept
an identifier in any case, with or without the dash or leading zeros (`med 12` finds
`MED-000012`). Report searches find the full number, such as `TXN-000012`.

Numbers that come from outside the pharmacy keep the format they were issued in: supplier invoice
and credit note numbers, the supplier's batch or lot number, TIN, PDEA licence, Senior Citizen and
PWD ID numbers, prescription and S2 numbers, and GCash or Maya references.

## Medicine categories

A product's category is picked from a fixed list (`src/shared/categories.ts`) and checked again by
the main process, so the same category is never stored with two spellings. The list: Analgesic,
Antacid, Antibiotic, Anticoagulant, Anticonvulsant, Antidepressant, Antidiabetic, Antidiarrheal,
Antiemetic, Antifungal, Antihistamine, Antihypertensive, Anti-inflammatory, Antipsychotic, Antiviral,
Bronchodilator, Cough and Cold, Dermatological, Diuretic, Eye and Ear, Hormone, Lipid-lowering,
Sedative, Vitamins and Supplements, Medical Supply, Others.

Categories typed before the list existed are moved onto it by the upgrade (for example "vitamins"
becomes "Vitamins and Supplements"); anything with no match becomes "Others".
