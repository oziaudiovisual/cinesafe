# Regras de Segurança - Cine Safe

As regras agora ficam **versionadas no repositório**:

- Firestore: [`firestore.rules`](firestore.rules)
- Storage: [`storage.rules`](storage.rules)
- Config de deploy: [`firebase.json`](firebase.json) e [`.firebaserc`](.firebaserc) (projeto `cine-guard`)

Elas substituem o "allow all" do MVP mantendo o app funcionando.

## O que essas regras fazem

- **Vitrine pública:** a página inicial é aberta, então a coleção `equipment` tem
  **leitura pública apenas para os itens do marketplace** (`status == SAFE` e
  `isForRent` ou `isForSale`). Inventário privado, notificações e perfis **não**
  são públicos. As fotos dos itens (Storage) também têm leitura pública.
- **Transferência de posse protegida:** só o destinatário de uma transferência
  `TRANSFER_PENDING` consegue assumir o item (fecha o buraco de aceitar
  transferência sem validação).
- **Notificações privadas:** só o destinatário lê/gerencia; qualquer autenticado
  cria, desde que assine como remetente.
- **Histórico de roubo** imutável após criado; **anúncios** só admin cria/edita.

- **Anti-escalonamento de privilégio (`users`):** a atualização é validada por
  campo. O dono edita o próprio perfil, mas **não** pode mudar `role`, `isBlocked`
  nem `referralCount` (senão viraria admin/Premium ou se desbloquearia). Outro
  usuário só consegue tocar os campos das escritas cruzadas legítimas
  (`connections`, `notificationStats`, `transactionHistory`, `referralCount`), e
  nada mais. Admin faz tudo (painel).

> Defesa em profundidade pendente: mover as escritas cruzadas para Cloud Functions
> (para que nem os campos de fluxo possam ser adulterados entre usuários) e validar
> os limites de uso no servidor. Isso exige um ambiente de teste (emulador do
> Firebase com Java, ou staging) para não arriscar os fluxos de autenticação em
> produção — ficou como próximo passo.

## Como publicar

### Opção A — via CLI (recomendado)

O CLI já está instalado, mas o login expirou. Rode uma vez:

```bash
firebase login --reauth        # abre o navegador (use a conta admin@ozi.com.br)
firebase deploy --only firestore:rules,storage
```

### Opção B — via Console (copiar e colar)

- **Firestore:** Firebase Console → Firestore Database → Rules → cole o conteúdo de
  [`firestore.rules`](firestore.rules) → Publicar.
- **Storage:** Firebase Console → Storage → Rules → cole o conteúdo de
  [`storage.rules`](storage.rules) → Publicar.

> Depois de publicar, confira na página inicial (deslogado) se a vitrine continua
> mostrando os itens. Se ficar vazia, provavelmente faltou publicar as regras do
> Firestore (a leitura pública de `equipment`).
