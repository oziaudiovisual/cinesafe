
# Regras de Segurança Definitivas - Cine Safe

Para garantir a segurança dos dados e arquivos no Google Cloud/Firebase, **substitua imediatamente** as regras "allow all" usadas durante o MVP pelas regras abaixo antes de publicar a aplicação.

---

## 1. Cloud Storage (Arquivos)

Estas regras garantem que:
*   Qualquer usuário autenticado pode LER arquivos (necessário para visualizar itens de outros usuários).
*   Usuários só podem ESCREVER (upload/delete) em suas próprias pastas.
*   Apenas administradores podem gerenciar imagens de anúncios.

**Vá para:** Firebase Console -> Storage -> Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Regra Geral de Leitura: Usuários autenticados podem ver arquivos
    allow read: if request.auth != null;

    // Pasta de Usuários: Apenas o dono pode escrever
    // Garante isolamento de dados de perfil, equipamentos e notas fiscais
    match /users/{userId}/{allPaths=**} {
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Pasta de Anúncios: Apenas Admins
    match /ads/{filename} {
      allow write: if request.auth != null && 
                   firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

---

## 2. Cloud Firestore (Banco de Dados)

Estas regras garantem que:
*   Dados de usuários são protegidos contra escrita de terceiros.
*   Equipamentos só podem ser editados pelos donos.
*   Notificações são privadas.
*   Histórico de roubo é imutável após criação.

**Vá para:** Firebase Console -> Firestore Database -> Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Usuários: Leitura pública (perfil), Escrita apenas pelo próprio usuário
    match /users/{userId} {
      allow read;
      allow write: if request.auth.uid == userId;
    }
    
    // Equipamentos: Leitura pública, Escrita apenas pelo dono
    // Verifica ownership no recurso existente ou no novo recurso
    match /equipment/{equipmentId} {
      allow read;
      allow create, update, delete: if request.auth.uid == resource.data.ownerId || request.auth.uid == request.resource.data.ownerId;
    }
    
    // Notificações: Estritamente privadas para o destinatário
    match /notifications/{notificationId} {
      allow read, write, delete: if request.auth.uid == resource.data.toUserId || request.auth.uid == request.resource.data.toUserId;
    }

    // Histórico de Roubo: Leitura pública, Criação permitida, Edição/Exclusão negada
    match /theft_history/{historyId} {
      allow read;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }

    // Anúncios: Leitura pública, Escrita apenas por Admins
    match /ads/{adId} {
      allow read;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```
