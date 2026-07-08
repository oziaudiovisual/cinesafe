# ADR 0003 — Denormalização de dados no cliente

> Dados de leitura frequente são copiados ("denormalizados") para dentro dos documentos que os exibem, evitando leituras extras e expondo só o necessário.

- **Status:** Aceito
- **Data:** 2026-07-08

## Contexto

Sem backend (ver [ADR 0001](0001-firebase-baas-client-only.md)), cada tela é
montada com leituras diretas do Firestore feitas pelo cliente. A vitrine pública
do marketplace precisa mostrar, para cada item, o nome, o avatar e a
localização do dono — mas a coleção `users` **não é pública** (as regras só
permitem leitura autenticada). Buscar o perfil do dono a cada item seria
impossível para visitantes e caro para usuários logados (N leituras por página).

## Decisão

**Denormalizar** os campos de leitura frequente para dentro do documento que os
exibe, no momento da escrita, feito pela própria camada de serviço do cliente.

### `equipment.ownerProfile` (o caso central)

`equipmentService.addEquipment` e `updateEquipment` gravam um subconjunto do
perfil do dono direto no item:

```ts
// services/equipmentService.ts
ownerProfile: ownerProfile ? {
  name: ownerProfile.name,
  avatarUrl: ownerProfile.avatarUrl,
  location: ownerProfile.location
} : undefined
```

Regra explícita e deliberada: **o telefone NUNCA é denormalizado** no item,
porque a vitrine é pública e o número vazaria. O contato acontece por outro
caminho (notificação com `fromUserPhone`, sujeita a limite — ver
[ADR 0004](0004-freemium-por-indicacao.md)).

### Outros documentos denormalizados

| Documento | Campos denormalizados | Onde é escrito |
| --- | --- | --- |
| `equipment` | `ownerProfile { name, avatarUrl, location }` | `equipmentService.addEquipment` / `updateEquipment` / `transferEquipmentOwnership` |
| `chats` | `participantInfo { [uid]: { name, avatarUrl } }` | `chatService.openChat` |
| `contracts` | `ownerName/ownerAvatar`, `counterpartyName/counterpartyAvatar`, `equipmentName/equipmentImage` | `contractService.createContract` |
| `notifications` | `fromUserName`, `fromUserAvatar`, `fromUserPhone`, `itemName`, `itemImage` | `notificationService.createNotification` |
| `return_alerts` | `renterName/renterAvatar`, `ownerName`, `equipmentName/equipmentImage` | `contractService.raisePublicAlert` |

### Normalização acoplada

No mesmo ponto de escrita, `serialNumber` é **normalizado** (`trim().toUpperCase()`)
em `addEquipment` e `updateEquipment`, para que a verificação de serial
(`checkSerial`) seja consistente.

## Consequências

**Positivas**

- Vitrine pública funciona **sem** expor a coleção `users` (as regras podem
  manter `users` como leitura só-autenticada).
- Leitura de listas é O(1) por item: nenhuma consulta secundária ao perfil.

**Negativas / trade-offs**

- **Risco de dado defasado (stale):** se o dono muda nome/avatar/localização, os
  itens já gravados não atualizam sozinhos. Mitigação parcial: `updateEquipment`
  e `transferEquipmentOwnership` regravam `ownerProfile` fresco; `checkSerial`
  recompõe o perfil se estiver ausente. Não há reconciliação em massa.
- Consistência depende da camada de serviço do cliente (não há trigger de
  servidor que garanta a cópia).

## Referências cruzadas

- [ADR 0001 — Firebase client-only](0001-firebase-baas-client-only.md)
- [Modelo de dados](../03-data-model.md)
- [Feature: Marketplace](../features/marketplace.md)
- [Feature: Inventário](../features/inventory.md)

## Fontes no código

- `services/equipmentService.ts` (`addEquipment`, `updateEquipment`, `transferEquipmentOwnership`, `checkSerial`)
- `services/chatService.ts` (`openChat` → `participantInfo`)
- `services/contractService.ts` (`createContract`, `raisePublicAlert`)
- `services/notificationService.ts` (`createNotification`)
