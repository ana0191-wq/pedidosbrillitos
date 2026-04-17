---
name: brother-involvement-toggle
description: Per-order toggle to mark whether brother participates and earns 30% commission cut
type: feature
---
Toggle `brother_involved` (boolean, default true) en tablas `client_orders` y `orders`. Editable en `EditClientOrderDialog` y al crear en `AddClientOrderDialog`. Cuando está apagado, el Dashboard suma 100% de `ana_profit` al `netProfit` en vez de 70%. La columna `collaborator_earnings` no se crea para pedidos con brother_involved=false (manejar en hooks/useCollaborators si surge).
