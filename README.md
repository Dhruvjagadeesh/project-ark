# Project Ark

## Live demo
https://project-ark-seven.vercel.app

Endangered species conservation and rescue management system.
DBMS Level 3 mini project: **MySQL + MongoDB + Next.js**.

## Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, React) |
| Backend | Next.js Route Handlers (`app/api/*`) |
| SQL | MySQL 8.0.16+ (`mysql2`) |
| NoSQL | MongoDB 7/8 (`mongodb` driver) |
| Auth | NextAuth (credentials, JWT sessions) + bcrypt |

## Setup

### 1. Prerequisites
Node.js 18+, MySQL 8, MongoDB Community Server + mongosh.

### 2. MySQL
In MySQL Workbench open and run (⚡) in this order:
1. `database/mysql/01_schema.sql` – tables, constraints, indexes, triggers, procedures, function, views, sample data
2. `database/mysql/02_alter_and_queries.sql` – ALTER/DROP demos, extra data, important queries

### 3. MongoDB
```
cd database/mongodb
mongosh ark_mongo.js
```
Creates 4 validated collections, indexes, sample documents and prints aggregation results.

### 4. App
```
npm install
copy .env.example .env.local      (Windows)   |   cp .env.example .env.local
```
Fill in your MySQL password and a random `NEXTAUTH_SECRET`
(`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), then:
```
npm run dev
```
Open http://localhost:3000

### Demo accounts (password `ark@123`)
| Email | Role |
|---|---|
| admin@ark.org | Administrator |
| ravi@forest.gov.in | Forest officer |
| meera@research.org | Researcher |
| anil@vet.org | Veterinary officer |

## Structure
```
app/            pages (dashboard, species, sightings, rescues, animals, research, users, login)
app/api/        route handlers – the only layer that talks to the databases
lib/            mysql pool, mongo client, auth + role guard
components/     shell/nav and small UI helpers
database/       SQL and MongoDB scripts
docs/           project documentation
middleware.js   page-level role protection
```
