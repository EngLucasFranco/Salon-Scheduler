# Agenda Salão

Sistema de agendamento de horários para salões, composto por React/Vite no
frontend e Node.js/Express na API.

## Ambientes

- **Desenvolvimento local:** SQLite, salvo em `backend/data/agenda.sqlite`.
  Não requer MongoDB Atlas.
- **Produção (Vercel):** MongoDB Atlas, selecionado com `DB_PROVIDER=mongodb`.

## Início rápido

```powershell
npm run install:apps
npm install
Copy-Item backend/.env.example backend/.env
npm run dev
```

Antes de iniciar, defina valores seguros para `JWT_SECRET` e
`MANAGER_INVITE_CODE` em `backend/.env`. A interface abre em
`http://localhost:5173` e a API em `http://localhost:5000/api`.

O guia de banco de dados e deploy está em [SETUP.md](./SETUP.md).
