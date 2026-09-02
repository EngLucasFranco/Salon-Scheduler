# Execução e publicação

## Desenvolvimento local

Pré-requisito local: Node.js 20 a 24. MongoDB Atlas só é necessário para produção.

1. Copie `backend/.env.example` para `backend/.env` e informe valores reais para
   `JWT_SECRET` e `MANAGER_INVITE_CODE`. O arquivo já vem com
   `DB_PROVIDER=sqlite` e cria o arquivo local `backend/data/agenda.sqlite`.
2. Instale tudo a partir da raiz: `npm run install:apps && npm install`.
3. Inicie ambos os serviços: `npm run dev`.

A interface estará em `http://localhost:5173` e a API em
`http://localhost:5000/api`. O arquivo `frontend/.env.development` já usa
essa URL e o backend já aceita essa origem via `CORS_ORIGIN`.

No banco SQLite local, a API cria as contas de demonstração `010101` / `000001`
(cliente) e `020202` / `000002` (gestor). Elas não são criadas no MongoDB Atlas.

No Windows, a cópia do arquivo de ambiente também pode ser feita com:

```powershell
Copy-Item backend/.env.example backend/.env
```

## MongoDB Atlas

Crie um usuário de banco com senha forte, libere o acesso de rede necessário
(para teste, `0.0.0.0/0`; para produção, restrinja quando possível) e use a
connection string SRV no campo `MONGODB_URI`. Essa variável nunca deve ser
enviada ao Git ou ao frontend.

## Vercel

Publique como dois projetos Vercel, usando o mesmo repositório e selecionando
uma *Root Directory* diferente em cada importação.

| Projeto | Root Directory | Build |
| --- | --- | --- |
| API | `backend` | Vercel executa `api/index.js` como função Node |
| Interface | `frontend` | `npm run build` (Vite) |

No projeto da API, cadastre em Production (e Preview, se desejar):

```text
MONGODB_URI
DB_PROVIDER=mongodb
JWT_SECRET
JWT_EXPIRES_IN=7d
MANAGER_INVITE_CODE
CORS_ORIGIN=https://url-do-frontend.vercel.app
```

No projeto da interface, cadastre:

```text
VITE_API_URL=https://url-da-api.vercel.app/api
```

Faça primeiro o deploy da API, use a URL gerada no `VITE_API_URL` e então
faça o deploy do frontend. Por fim, atualize `CORS_ORIGIN` da API com a URL
final do frontend e faça novo deploy da API. Para permitir mais de um domínio
(por exemplo produção e preview), separe as URLs por vírgulas.

`frontend/vercel.json` mantém o roteamento da SPA e `backend/vercel.json`
encaminha as rotas da API à função Express.
