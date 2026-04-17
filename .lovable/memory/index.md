# Memory: index.md
Updated: now

# Project Memory

## Core
- App: 'Pedidos Brillitos Store' (Spanish). Tracks AliExpress, Shein, Temu, Amazon.
- Stack: Supabase (RLS). Edge functions return HTTP 200 on AI errors with JSON body.
- Soft delete: Use `deleted_at` everywhere. NEVER use physical DELETE.
- Data Fetching: Always fetch fresh from DB on mount/mutate. NO optimistic UI or local defaults for DB fields.
- DB Integrity: Use NUMERIC, inputs `type="number" step="0.01"`. Fallback to `null` (never 0/NaN). Display nulls as '—'.
- Financials: `ana_profit = shipping_charge_client - company_invoice_amount`. Product price is passthrough (0 profit).
- Commissions: `brother_cut = ana_profit * 0.30` ONLY when `brother_involved = true` per-order. If false, Ana keeps 100%.
- Theme: Pink (#e8317a primary, #fff0f4 bg, #1a1a2e text), 20px radius. Order states: Pendiente(gray), En Tránsito(blue), Llegó(green), No Llegó(red), En Venezuela(purple), Entregado(dark green).
- Manual overrides: Allowed on all calculated fields, marked with '📄 Real' badge.

## Memories
- [Project goal](mem://project/goal) — Web app to track orders from AliExpress, Shein, Temu, Amazon
- [Infrastructure](mem://tech/infrastructure) — Supabase DB tables, RLS, Storage buckets (product-photos, invoices)
- [Automation strategy](mem://features/automation-strategy) — Global Ctrl+V for images, AI extraction in modals
- [Design principles](mem://style/design-principles) — 2-column shipping calc, profit color coding (pink/green/red)
- [AI Extractor Tech](mem://tech/ai-extraction) — Gemini Flash config: inlineData, JSON MIME, temp 0.3, no system role
- [Client order hierarchy](mem://features/client-order-hierarchy) — 3 levels: Client → Orders (carts) → Products
- [Logistics](mem://features/shipping-logistics) — Volumetric formulas (Air/166, Sea/1728), cost distributions
- [Financial payments](mem://features/financial-payments) — Multicurrency support, auto Euro BCV rate
- [Shipping AI](mem://tech/shipping-ai-extraction) — Extracting weight/dims/costs from labels and invoices
- [Image optimization](mem://tech/image-optimization) — Client-side JPEG compression (1200px max, 70% quality)
- [Branding](mem://style/branding) — App name and WhatsApp contact details
- [Exchange rate](mem://features/exchange-rate-management) — Daily pg_cron job for Euro BCV via dolarapi.com
- [Edge functions](mem://tech/edge-functions-error-handling) — Return HTTP 200 with JSON body on AI errors
- [Database constraints](mem://tech/database-constraints-flexibility) — Removed check constraint on 'store', normalizes to lowercase
- [Pricing structure](mem://tech/pricing-data-structure) — `pricePerUnit` vs `pricePaid` for accurate AI extraction
- [Public catalog](mem://features/public-catalog) — 'Catálogo' tab with RLS for public web access
- [Order payment & delivery](mem://features/order-payment-delivery) — Product tracking states and auto `delivered_at`
- [Shipping calculator](mem://features/order-shipping-calculator) — 'Factura rápida' vs 'Calcular por peso', default rates
- [Payment flow](mem://features/two-stage-payment-flow) — 2-stage (Product, Shipping), UI blocks when paid
- [Client cards](mem://features/client-summary-cards) — Financial breakdown, '⚠️ Envío sin calcular' warning
- [Profit check](mem://features/profitability-safety-check) — '⚠️ Perderías dinero' red warning on negative margin
- [Quick estimate](mem://features/preliminary-shipping-estimate) — Weight-based projection during product creation
- [Quotations](mem://features/branded-quotation-generator) — Pink/white PNG generator, WhatsApp sharing
- [Inventory management](mem://features/inventory-management) — 'Género' tab for wholesale stock and profit projection
- [Collapsible UI](mem://style/persistent-collapsible-clients) — Save expanded state of client cards in localStorage
- [Collaborator earnings](mem://features/collaborator-earnings-system) — 30% default cut, 'Equipo' tab for tracking
- [Invoices](mem://features/invoice-documentation-system) — Inline editable 'Factura empresa', triggers recalculations
- [Data integrity](mem://tech/data-integrity-strategy) — NUMERIC inputs, `null` fallbacks, `parseFloat`, '—' display
- [Soft delete](mem://tech/soft-delete-policy) — `deleted_at` architecture, no physical DELETE
- [Order states UI](mem://features/client-order-management) — Color coded state management and transitions
- [Dashboard design](mem://style/dashboard-redesign-2024) — Pink aesthetic, 20px radius, 4-column layout
- [Por Cobrar](mem://features/por-cobrar-module) — Priority debt tracking, WhatsApp reminders
- [Quick calculator](mem://features/quick-calculator) — Dashboard widget: AI estimate (no weight), invoice distribution between clients, quick price
- [Data fetching](mem://tech/data-fetching-policy) — Fetch on mount, no optimistic UI or default DB states
- [Financial logic](mem://features/financial-logic-standardization) — Absolute formulas for ana_profit, brother_cut, net profit
- [Edit modal structure](mem://features/order-edit-modal-structure) — 2-stage structure: Product then Shipping
- [Save confirmation UX](mem://features/save-confirmation-ux) — Green checkmark, Sonner summary toasts
- [Brother involvement](mem://features/brother-involvement-toggle) — Per-order brother_involved boolean, controls 30% cut
