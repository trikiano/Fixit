# 🚀 Démarrage du projet Fixit (Local)

## Prérequis
- **Node.js** v18+
- **MySQL** local (ou Docker)

---

## 1. Lancer la base de données MySQL

### Option A — Docker (recommandé)
```bash
docker-compose up -d
```
Cela démarre un conteneur MySQL sur le port `3306` avec :
- Base de données : `fixit_db`
- Utilisateur : `fixit_user` / Mot de passe : `fixit_password`

### Option B — MySQL local déjà installé
Créez la base de données et l'utilisateur manuellement :
```sql
CREATE DATABASE fixit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fixit_user'@'localhost' IDENTIFIED BY 'fixit_password';
GRANT ALL PRIVILEGES ON fixit_db.* TO 'fixit_user'@'localhost';
FLUSH PRIVILEGES;
```
Modifiez `server/.env` selon vos paramètres de connexion.

---

## 2. Initialiser la base de données (première fois seulement)

```bash
cd server
node scripts/init-db.js
```

Cela crée toutes les tables et un utilisateur admin par défaut :
- **Email** : `admin@fixit.local`
- **Mot de passe** : `admin123`

> ⚠️ **Attention** : Ce script efface et recrée toutes les tables. Ne l'exécutez qu'une seule fois.

---

## 3. Démarrer le backend (API)

```bash
cd server
node index.js
```
Le serveur démarre sur `http://localhost:3000`.

(Pour le développement avec rechargement automatique : `npx nodemon index.js`)

---

## 4. Démarrer le frontend

Dans un nouveau terminal, depuis la racine du projet :
```bash
npm run dev
```
L'application est disponible sur `http://localhost:5173`.

---

## Configuration

### Backend (`server/.env`)
| Variable | Valeur par défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port du serveur API |
| `DB_HOST` | `localhost` | Hôte MySQL |
| `DB_USER` | `fixit_user` | Utilisateur MySQL |
| `DB_PASSWORD` | `fixit_password` | Mot de passe MySQL |
| `DB_NAME` | `fixit_db` | Nom de la base |
| `JWT_SECRET` | `super_secret_...` | Clé secrète JWT (à changer en production) |

### Frontend (`.env`)
| Variable | Valeur |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000/api` |
