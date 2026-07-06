# 3. Flux métier (diagrammes de séquence & d'activité)

[← Modèle de données](02-MODELE-DONNEES.md) · [Index](README.md)

---

## 3.1 Authentification (séquence)

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant L as Page Login
    participant C as base44Client
    participant API as Backend /api/auth
    participant DB as PostgreSQL

    U->>L: saisit email + mot de passe
    L->>C: auth.login(email, password)
    C->>API: POST /auth/login
    API->>DB: findUnique(user by email)
    DB-->>API: utilisateur (password_hash)
    API->>API: bcrypt.compare(password, hash)
    alt identifiants valides
        API->>API: signToken(user) (JWT)
        API-->>C: { token, user }
        C->>C: localStorage["fixit_token"] = token
        C-->>L: succès
        L->>U: redirection vers l'application
    else invalides
        API-->>C: 401 « Identifiants incorrects »
        C-->>L: erreur
        L->>U: message d'erreur
    end

    Note over C,API: Ensuite, chaque appel API porte<br/>l'en-tête Authorization: Bearer <token>
```

---

## 3.2 Vente au point de vente (POS) — le flux central

Le POS gère **plusieurs tickets en parallèle**, un panier par ticket, un pavé numérique tactile (modes **Qté / Remise / Prix**), la sélection du client, et un **mode hors-ligne**.

```mermaid
sequenceDiagram
    actor V as Vendeur
    participant POS as Page POS
    participant Q as React Query
    participant C as base44Client
    participant API as Backend
    participant DB as PostgreSQL

    V->>POS: ajoute des produits au panier
    V->>POS: (option) sélectionne / crée un client
    V->>POS: ajuste Qté / Remise / Prix (pavé num.)
    V->>POS: clic « Encaisser » + choix du paiement

    POS->>POS: génère n° de vente, construit items + total
    POS->>POS: calcule les sorties de stock (produits non personnalisés)

    alt 🟢 En ligne
        loop pour chaque produit vendu
            POS->>C: Product.update(id, { quantity: nouveau })
            C->>API: PATCH /entities/Product/:id
            API->>DB: update quantité
            POS->>C: StockMovement.create({ type: "sortie", … })
            C->>API: POST /entities/StockMovement
            API->>DB: insert mouvement
        end
        POS->>C: Sale.create(vente)
        C->>API: POST /entities/Sale
        API->>DB: insert vente
        POS->>Q: invalide caches (products, sales)
    else 🔴 Hors-ligne
        POS->>POS: enqueue(vente + mises à jour stock)
        Note over POS: stockée localement,<br/>synchronisée au retour du réseau
    end

    POS->>V: écran de succès (n° ticket)
    opt SMS activé + téléphone client
        V->>POS: clic « Envoyer le ticket par SMS »
        POS->>C: functions.invoke("sendSms", …)
        C->>API: POST /functions/sendSms
        API-->>POS: succès / échec
    end
```

**À retenir :**
- Une vente **décrémente le stock** des produits et **trace un mouvement** `sortie` pour chaque article (référence = n° de ticket).
- Les articles « personnalisés » (réparation/service pré-chargés, prix libre) **n'affectent pas le stock**.
- Le **mode hors-ligne** met la vente en file d'attente (`useOfflineQueue`) et la rejoue automatiquement au retour de la connexion — utile en boutique avec un réseau instable.

---

## 3.3 Cycle de vie d'une réparation (activité)

Une réparation passe par **9 statuts**. Le client peut être notifié par SMS à chaque changement, et le règlement final se fait au POS.

```mermaid
stateDiagram-v2
    [*] --> reception : ouverture du dossier
    reception : 📥 Réception
    diagnostic : 🔍 Diagnostic
    devis_envoye : 📤 Devis envoyé
    en_attente_pieces : ⏳ Attente pièces
    en_reparation : 🔧 En réparation
    test : 🧪 Test
    pret : ✅ Prêt
    livre : 📦 Livré
    annule : ❌ Annulé

    reception --> diagnostic
    diagnostic --> devis_envoye
    devis_envoye --> en_attente_pieces : devis accepté
    devis_envoye --> annule : devis refusé
    en_attente_pieces --> en_reparation : pièces reçues
    diagnostic --> en_reparation : pas de pièce à commander
    en_reparation --> test
    test --> pret
    test --> en_reparation : test échoué
    pret --> livre : client récupère + paie
    livre --> [*]
    annule --> [*]

    note right of devis_envoye
        SMS possible au client
        à chaque étape
    end note
    note right of pret
        Encaissement via POS
        (réparation pré-chargée
        dans le panier)
    end note
```

**Passerelle Réparation → Caisse :** depuis un dossier « Prêt », l'application peut ouvrir le POS avec la réparation **déjà dans le panier** (via un paramètre d'URL `?preload=repair:…`), pré-remplissant le libellé, le prix et le client. Une garantie (`Warranty`) peut être générée à la livraison (`warranty_days`).

---

## 3.4 Ouverture & clôture de caisse (activité)

```mermaid
flowchart TD
    A([Début de journée]) --> B[Ouverture de caisse<br/>saisie du fond de caisse<br/>opening_balance]
    B --> C{Journée en cours}
    C -->|ventes espèces/carte| D[Cumul automatique<br/>total_cash_sales / total_card_sales]
    C -->|dépenses| E[Cumul des sorties<br/>total_expenses]
    D --> C
    E --> C
    C -->|fin de journée| F[Clôture de caisse]
    F --> G[Comptage réel<br/>closing_balance]
    G --> H[Solde attendu calculé<br/>expected_balance =<br/>fond + ventes espèces - dépenses]
    H --> I{closing == expected ?}
    I -->|oui| J[✅ Caisse équilibrée]
    I -->|non| K[⚠️ Écart enregistré<br/>difference + motif]
    J --> L([Caisse clôturée])
    K --> L
```

---

## 3.5 CRUD générique des entités (séquence)

Toutes les pages (Clients, Produits, Fournisseurs…) partagent **le même mécanisme** d'accès aux données, grâce à la route générique du backend.

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant P as Page (ex. Clients)
    participant C as base44Client
    participant MW as Middleware requireAuth
    participant R as routes/entities
    participant DB as Prisma / PostgreSQL

    U->>P: action (lister / créer / modifier / supprimer)
    P->>C: entities.Client.<méthode>(…)
    C->>MW: requête /api/entities/Client (+ JWT)
    alt JWT absent / invalide
        MW-->>C: 401 Non autorisé
    else JWT valide
        MW->>R: requête authentifiée
        R->>R: résout le modèle (MODEL_MAP)<br/>borne la limite (max 1000)
        R->>DB: findMany / create / update / delete
        DB-->>R: enregistrement(s)
        R-->>C: JSON
        C-->>P: données
        P->>U: mise à jour de l'écran
    end
```

**Détails techniques :**
- Une **table de correspondance** (`MODEL_MAP`) autorise 22 entités ; toute autre est rejetée (404). Cela évite l'accès arbitraire à des tables internes.
- Le nombre de résultats est **plafonné à 1000** (`MAX_TAKE`) pour éviter les requêtes massives.
- Tri par défaut : `created_date` décroissant. Les filtres supportent les opérateurs `gte`, `lte`, `contains`…
- Les champs `id`, `created_date`, `updated_date` sont **protégés** (ignorés en création/modification).

---

## 3.6 Envoi de SMS (séquence)

Le backend agit comme **passerelle multi-fournisseurs** : il relaie le message vers le service configuré dans les paramètres.

```mermaid
sequenceDiagram
    participant P as Page (POS / Réparations)
    participant C as base44Client
    participant F as routes/functions
    participant SMS as Fournisseur SMS

    P->>C: functions.invoke("sendSms", { to, message, provider, apiKey… })
    C->>F: POST /functions/sendSms (+ JWT)
    F->>F: nettoie le numéro, valide les paramètres
    alt provider = twilio
        F->>SMS: POST api.twilio.com (Basic auth)
    else provider = vonage
        F->>SMS: POST rest.nexmo.com
    else provider = infobip
        F->>SMS: POST {baseUrl}/sms/2/text/advanced
    end
    SMS-->>F: réponse (id, statut)
    F-->>C: { success, result } ou erreur
    C-->>P: confirmation d'envoi
```

> Les SMS servent à deux usages : **ticket de caisse** (POS) et **notification de réparation** (changement de statut). Les modèles de message sont personnalisables dans les paramètres (variables `{numero}`, `{client}`, `{total}`, `{articles}`…).

---

## 3.7 Téléversement de fichier (séquence)

```mermaid
sequenceDiagram
    participant P as Page (ex. fiche Produit)
    participant C as base44Client
    participant U as routes/upload (multer)
    participant FS as Volume fixit_uploads

    P->>C: integrations.Core.UploadFile({ file })
    C->>U: POST /upload (multipart + JWT)
    U->>FS: enregistre le fichier
    U-->>C: { url } (chemin /uploads/…)
    C-->>P: URL à stocker (ex. image_url du produit)
    Note over FS: servi ensuite par nginx via /uploads/*
```

---

[← Modèle de données](02-MODELE-DONNEES.md) · [Index](README.md) · [Suivant : Catalogue fonctionnel →](04-CATALOGUE-FONCTIONNEL.md)
