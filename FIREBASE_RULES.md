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

> Trade-off conhecido: `users` permite atualização por qualquer autenticado, porque
> o app faz escritas cruzadas pelo cliente (conexões mútuas, referral,
> `notificationStats`, `transactionHistory`). Endurecer isso exige mover essas
> escritas para Cloud Functions — é o item de segurança do plano de otimizações.

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
