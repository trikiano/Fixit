# 1. Architecture technique

[← Retour à l'index](README.md)

---

## 1.1 Vue macroscopique (3 tiers)

L'application suit une architecture **client lourd / API / base de données** classique, entièrement conteneurisée.

```mermaid
flowchart LR
    User([👤 Utilisateur<br/>navigateur]) -->|HTTPS| Traefik

    subgraph Coolify["🐳 Serveur Coolify (Docker)"]
        Traefik[/"Traefik<br/>(proxy + SSL)"/]
        Traefik -->|":80"| FE

        subgraph FE["Conteneur frontend"]
            Nginx["nginx<br/>sert le build React<br/>+ reverse-proxy /api"]
        end

        Nginx -->|"/api/* et /uploads/*<br/>(réseau interne)"| BE

        subgraph BE["Conteneur backend"]
            Express["Express + Prisma<br/>:3001"]
        end

        Express -->|":5432<br/>(réseau interne)"| DB

        subgraph DB["Conteneur postgres"]
            PG[("PostgreSQL 16")]
        end

        PG -.->|volume| V1[("fixit_pgdata")]
        Express -.->|volume| V2[("fixit_uploads")]
    end

    style FE fill:#e3f2fd
    style BE fill:#e8f5e9
    style DB fill:#fff3e0
```

**Points clés :**
- Seul le conteneur **frontend (nginx)** est exposé publiquement. `backend` et `postgres` ne sont accessibles que sur le réseau interne Docker (pas de `ports:` publiés) — c'est Traefik/Coolify qui gère l'exposition externe.
- nginx joue **deux rôles** : servir les fichiers statiques du build Vite **et** relayer les appels `/api/` et `/uploads/` vers le backend via le DNS interne Docker (`http://backend:3001`).
- Deux volumes persistants : `fixit_pgdata` (données SQL) et `fixit_uploads` (fichiers téléversés).

---

## 1.2 Couches logicielles (composants)

```mermaid
flowchart TB
    subgraph Browser["🖥️ Navigateur (SPA React)"]
        Shell["Shell — gestionnaire d'onglets<br/>+ écran de verrouillage (PIN)"]
        Pages["18 Pages métier<br/>(lazy-loaded)"]
        Components["Composants (modales, UI shadcn)"]
        Query["TanStack React Query<br/>(cache + mutations)"]
        Client["base44Client.js<br/>(couche d'abstraction API)"]
        Offline["useOfflineQueue<br/>(file d'attente hors-ligne)"]
        Settings["SettingsContext<br/>(devise, SMS, boutique…)"]

        Shell --> Pages --> Components
        Pages --> Query --> Client
        Pages --> Offline
        Pages --> Settings
    end

    Client -->|"fetch + JWT Bearer"| API

    subgraph Server["⚙️ Backend Express"]
        Auth["middleware/auth<br/>(vérif. JWT)"]
        RAuth["routes/auth<br/>login · me · change-password"]
        REnt["routes/entities<br/>CRUD générique (22 entités)"]
        RFunc["routes/functions<br/>sendSms (Twilio/Vonage/Infobip)"]
        RUp["routes/upload<br/>fichiers (multer)"]
        Prisma["Prisma Client"]

        API[/"/api"/] --> Auth
        Auth --> RAuth & REnt & RFunc & RUp
        RAuth --> Prisma
        REnt --> Prisma
    end

    Prisma --> DB[("PostgreSQL")]

    style Browser fill:#e3f2fd
    style Server fill:#e8f5e9
```

### Le rôle pivot de `base44Client.js`

L'application a été exportée de la plateforme **Base44**. Pour la rendre autonome, tous les appels au SDK cloud d'origine ont été remplacés par un client local (`src/api/base44Client.js`) qui **conserve la même interface** (`base44.entities.X.create()`, `.list()`, `.filter()`…). Résultat : les 18 pages n'ont quasiment pas eu à être réécrites, seul le « tuyau » a changé.

Ce client expose 4 familles d'opérations :

| Famille | Méthodes | Cible backend |
|---------|----------|---------------|
| `entities.<Nom>` | `list, filter, get, create, update, delete` | `/api/entities/*` |
| `auth` | `me, login, logout, redirectToLogin` | `/api/auth/*` |
| `functions` | `invoke(name, data)` | `/api/functions/:name` |
| `integrations.Core` | `UploadFile({ file })` | `/api/upload` |

---

## 1.3 Navigation : un « bureau » à onglets

Particularité de l'UI : il n'y a **pas de barre latérale** classique. L'app se comporte comme un **système d'exploitation à onglets** (pensé pour le tactile / plein écran en boutique) :

```mermaid
stateDiagram-v2
    [*] --> Accueil
    Accueil --> Onglet : clic sur une tuile (18 modules)
    Onglet --> Onglet : ouverture d'autres modules
    Onglet --> Accueil : onglet « Accueil »
    Onglet --> [*] : fermeture de l'onglet (×)

    Accueil --> Verrouillé : bouton 🔒 / inactivité 5 min
    Onglet --> Verrouillé : bouton 🔒 / inactivité 5 min
    Verrouillé --> Accueil : PIN correct (déf. 1234)
    Verrouillé --> Verrouillé : PIN incorrect
```

- **Écran d'accueil** (`HomeScreen`) : grille de 18 tuiles colorées, une par module.
- **Onglets** : chaque module ouvert devient un onglet ; les pages sont **chargées à la demande** (`React.lazy`) pour accélérer le démarrage.
- **Verrouillage automatique** : après **5 minutes d'inactivité** (souris/clavier/tactile), un écran PIN bloque l'accès. PIN par défaut `1234`, stocké dans le navigateur (`localStorage`).

---

## 1.4 Authentification

- Connexion par **email + mot de passe** → le backend renvoie un **JWT** (signé avec `JWT_SECRET`).
- Le token est stocké dans `localStorage` (`fixit_token`) et envoyé en en-tête `Authorization: Bearer …` à chaque appel.
- **Toutes les routes** `/api/entities`, `/api/functions`, `/api/upload` exigent un JWT valide (middleware `requireAuth`).
- Mots de passe hachés avec **bcrypt** (coût 12).

> ⚠️ *Note de sécurité* : le stockage du JWT en `localStorage` et le PIN par défaut côté client font partie des points d'amélioration sécurité identifiés (voir le compte-rendu de sécurité).

---

## 1.5 Arborescence du dépôt (simplifiée)

```
Fixit/
├── src/                      # Frontend React
│   ├── api/base44Client.js   # Couche d'abstraction API
│   ├── components/           # Modales & UI par domaine (pos, repairs, services…)
│   ├── components/shell/     # Shell à onglets + écran d'accueil + verrouillage
│   ├── components/settings/  # SettingsContext (devise, SMS…)
│   ├── pages/                # 18 pages métier
│   └── hooks/                # useOfflineQueue…
├── backend/                  # API Node.js
│   ├── src/routes/           # auth · entities · functions · upload
│   ├── src/middleware/       # auth (JWT)
│   ├── src/seed.js           # Données de démonstration (idempotent)
│   └── prisma/               # schema.prisma + migrations
├── docker-compose.yml        # Stack 3 services
├── Dockerfile.frontend       # Build Vite → nginx
├── backend/Dockerfile        # Build backend + migrate + seed
└── nginx.conf                # Service statique + reverse-proxy
```

---

[← Retour à l'index](README.md) · [Suivant : Modèle de données →](02-MODELE-DONNEES.md)
