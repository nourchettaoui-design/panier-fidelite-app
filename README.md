# Panier Fidélité

## Déploiement

### URL publique

https://panier-fidelite-app.onrender.com

### Dépôt GitHub

https://github.com/nourchettaoui-design/panier-fidelite-app

---

# Présentation

Panier Fidélité est une application web permettant de gérer des cartes de fidélité.

Le projet est composé :

- d'un backend développé avec Node.js et Express ;
- d'un frontend développé avec React, Vite et TypeScript ;
- d'une base de données PostgreSQL.

L'application permet notamment :

- l'authentification des utilisateurs ;
- la gestion des utilisateurs ;
- la gestion des cartes de fidélité ;
- la gestion des points de fidélité ;
- la gestion des transactions ;
- la gestion des sessions ;
- l'envoi d'e-mails ;
- l'exécution de tâches planifiées.

---

# Technologies utilisées

## Backend

- Node.js
- Express.js
- PostgreSQL
- pg
- express-session
- Nodemailer

## Frontend

- React
- TypeScript
- Vite

## Tests

- Jest
- Supertest
- Vitest
- React Testing Library

---

# Prérequis

Avant de lancer le projet, installer :

- Node.js (version 16 ou supérieure)
- npm
- PostgreSQL

Vérifier les versions :

```bash
node -v
npm -v
```

---

# Installation

## 1. Cloner le projet

```bash
git clone https://github.com/nourchettaoui-design/panier-fidelite-app.git
```

Puis :

```bash
cd panier-fidelite-app
```

---

## 2. Installer le backend

```bash
cd backend
npm install
```

---

## 3. Installer le frontend

```bash
cd ../frontend
npm install
```

---

# Configuration de la base de données

Créer une base PostgreSQL.

Importer ensuite le fichier :

```
panier_fidelite_db.sql
```

Configurer les variables d'environnement du backend.

Exemple :

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=panier_fidelite_db
DB_USER=myuser
DB_PASSWORD=votre_mot_de_passe
```

Pour le déploiement sur Render, la connexion utilise la variable :

```env
DATABASE_URL
```

---

# Lancement du projet

## Backend

Depuis le dossier backend :

```bash
npm start
```

Le serveur démarre sur :

```
http://localhost:3001
```

---

## Frontend

Depuis le dossier frontend :

```bash
npm run dev
```

Le client démarre sur :

```
http://localhost:5173
```

---

# Déploiement

Application Render :

https://panier-fidelite-app.onrender.com

Dépôt GitHub :

https://github.com/nourchettaoui-design/panier-fidelite-app

---

# Base de données

Le projet utilise PostgreSQL.

Le fichier fourni :

```
panier_fidelite_db.sql
```

contient :

- les tables ;
- les contraintes ;
- les clés étrangères ;
- les index ;
- les triggers ;
- les données de démonstration.

---

# Identifiants de test

## Accès administrateur

E-mail :

```
manager1@example.com
```

Mot de passe :

```
Mymarket111$
```

---

## Accès utilisateur

E-mail :

```
manager1.user01@example.com
```

Mot de passe :

```
Mymarket113$
```

---

## Autres comptes utilisateurs

| E-mail | Mot de passe |
|--------|--------------|
| manager1.user02@example.com | Mymarket114$ |
| manager1.user03@example.com | Mymarket115$ |
| manager1.user04@example.com | Mymarket116$ |
| manager1.user05@example.com | Mymarket117$ |

---

# Informations de connexion SQL

## Développement local

SGBD :

```
PostgreSQL
```

Paramètres utilisés :

- DB_HOST
- DB_PORT
- DB_NAME
- DB_USER
- DB_PASSWORD

## Déploiement

La connexion à la base de données est réalisée grâce à la variable d'environnement :

```
DATABASE_URL
```

---

# Fonctionnalités

- Authentification des utilisateurs
- Gestion des utilisateurs
- Gestion des cartes de fidélité
- Gestion des points
- Historique des transactions
- Sessions utilisateurs
- API REST
- Interface React
- Envoi d'e-mails
- Base de données PostgreSQL
- Tâches planifiées

---

# Tests

## Backend

```bash
cd backend
npm test
```

## Frontend

```bash
cd frontend
npm test
```

---

# Structure du projet

```
panier-fidelite-app
│
├── backend
│
├── frontend
│
├── panier_fidelite_db.sql
│
├── README.md
│
└── .gitignore
```

---

# Compatibilité

L'application a été développée pour fonctionner sur les navigateurs modernes compatibles avec JavaScript.

---

# Auteur

**Nour Chettaoui**

Bachelor Data & Business Intelligence

Projet réalisé dans le cadre de la validation du Bloc de compétences 4 – Concevoir et développer des solutions web.