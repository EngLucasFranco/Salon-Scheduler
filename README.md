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

No SQLite local, estas contas são criadas automaticamente:

| Nível | Usuário | Senha |
| --- | --- | --- |
| Cliente | `010101` | `000001` |
| Gestor | `020202` | `000002` |

Os usuários aceitam somente letras e números, com mínimo de 6 caracteres. A
senha também tem mínimo de 6 caracteres.

O guia de banco de dados e deploy está em [SETUP.md](./SETUP.md).

## Armazenamento de senhas

Cadastros e alterações de senha usam Argon2id no SQLite e no MongoDB, com
64 MiB de memória, 3 iterações, paralelismo 4 e salt aleatório por senha.
A configuração está centralizada em `backend/utils/password.js`, seguindo
o [perfil de 64 MiB da RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html#section-4).
Meça a latência e o consumo de memória sob logins simultâneos no servidor de produção.

Hashes bcrypt existentes continuam válidos e são substituídos por Argon2id
após um login bem-sucedido. O bcrypt é mantido apenas para essa compatibilidade.
A inicialização do SQLite converte registros antigos em texto puro para Argon2id,
preservando hashes já existentes. A migração durante o login não sobrescreve
uma senha alterada simultaneamente.

Execute `npm test --prefix backend` para validar hashing, autenticação, migração
e persistência. Os testes usam SQLite temporário e simulam as operações do MongoDB,
sem acessar o banco de produção.
