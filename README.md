# Auth API (Node.js + Express + Prisma)

![CI](https://github.com/john-dalmolin/auth-api-node/actions/workflows/ci.yml/badge.svg)

API de autenticação com foco em qualidade de engenharia para ambiente real: arquitetura em camadas, observabilidade, documentação OpenAPI, testes automatizados e pipeline de CI com banco real.

## Resumo

Este projeto implementa autenticação baseada em JWT com refresh token persistido no PostgreSQL, separando responsabilidades por camada (`routes -> controllers -> services -> repositories`).

O objetivo é manter uma base pronta para evolução, priorizando:

- legibilidade e manutenibilidade;
- previsibilidade de erro;
- segurança de sessão;
- cobertura de testes e automação.

## Stack

- Node.js 18+
- Express 5
- Prisma 7 + PostgreSQL
- JWT (`jsonwebtoken`) + `bcryptjs`
- Zod (validação de payload)
- Pino (logging estruturado)
- Jest + Supertest
- Swagger UI + swagger-jsdoc

## Arquitetura

### Camadas

- `routes`: define endpoints e composição de middlewares.
- `controllers`: valida entrada e delega regra de negócio.
- `services`: concentra regras de domínio de autenticação.
- `repositories`: encapsula acesso ao Prisma/Postgres.

### Middlewares principais

- `authMiddleware`: valida access token.
- `validate`: aplica schemas Zod e padroniza resposta de erro de payload.
- `errorHandler`: centraliza mapeamento de erros de domínio/infra.
- `requestId` + `logger`: correlação e rastreabilidade por requisição.
- `rateLimiter`: proteção inicial para endpoints de auth.

## Fluxo de autenticação

1. `POST /auth/register` cria usuário com senha hasheada.
2. `POST /auth/login` valida credenciais e emite `accessToken` + `refreshToken`.
3. `POST /auth/refresh` valida token de refresh e rotaciona sessão.
4. `POST /auth/logout` revoga refresh token ativo.
5. Rotas protegidas (`/auth/profile`, `/users/me`) aceitam apenas access token válido.

## Diagramas de fluxo

### Fluxo geral da requisição

```mermaid
flowchart TD
    A["Client (App, Swagger, curl)"] --> B["Express App"]
    B --> C["requestId middleware"]
    C --> D["logger middleware"]
    D --> E{"Route match"}

    E -->|"/auth/*"| F["rateLimiter"]
    F --> G["validate (Zod)"]
    G --> H["authController"]
    H --> I["authService"]
    I --> J["Repositories"]
    J --> K["Prisma Client"]
    K --> L["PostgreSQL"]

    E -->|"/auth/profile, /users/me"| M["authMiddleware (Bearer JWT)"]
    M --> N["Protected handlers"]
    N --> O["200 JSON response"]

    E -->|"/health, /ready"| P["healthController"]
    E -->|"/docs, /docs.json"| Q["docsRoutes (Swagger)"]

    H -. "AppError / runtime error" .-> R["errorHandler middleware"]
    I -. "AppError / runtime error" .-> R
    R --> S["JSON error response"]
```

### Fluxo de autenticação e rotação de refresh token

```mermaid
sequenceDiagram
    participant U as "User"
    participant API as "Auth API"
    participant SVC as "authService"
    participant DB as "PostgreSQL (RefreshToken)"

    U->>API: "POST /auth/login (email, password)"
    API->>SVC: "login()"
    SVC->>DB: "create(tokenHash, jti, userId, expiresAt)"
    SVC-->>API: "accessToken + refreshToken"
    API-->>U: "200 tokens"

    U->>API: "POST /auth/refresh (refreshToken)"
    API->>SVC: "refreshToken(token)"
    SVC->>SVC: "jwt.verify + hashToken"
    SVC->>DB: "findByJti(jti)"
    SVC->>DB: "revokeByJti(oldJti)"
    SVC->>DB: "create(newTokenHash, newJti, userId, expiresAt)"
    SVC-->>API: "new accessToken + new refreshToken"
    API-->>U: "200 rotated tokens"

    U->>API: "POST /auth/logout (refreshToken)"
    API->>SVC: "logout(token)"
    SVC->>DB: "findByJti(jti)"
    SVC->>DB: "revokeByJti(jti)"
    API-->>U: "200 logged out"
```

## Segurança e qualidade

### Implementado

- [x] Segredo JWT validado no startup (falha rápida).
- [x] Refresh token com `jti` único para rotação/revogação.
- [x] Tratamento de erro unificado com `AppError`.
- [x] Validação de payload com Zod.
- [x] Rate limiting nas rotas de autenticação.
- [x] Testes automatizados em múltiplas camadas.
- [x] CI com execução de testes e cobertura mínima.
- [x] Lint (`eslint`) e formatação (`prettier`) padronizados.

### Em andamento

- [ ] Persistência de refresh token como hash (`tokenHash`) em vez de texto puro.
- [ ] Alinhamento final de todos os testes ao novo contrato de hash-at-rest.

### Próximos passos

- [ ] Resolver warning de open handles no Jest (`--detectOpenHandles`).
- [ ] Migrar rate limiting para Redis (cenário de múltiplas instâncias).
- [ ] Aumentar cobertura de branches em fluxos de erro críticos.

## Pré-requisitos

- Docker + Docker Compose
- Node.js 18+
- npm

## Setup local

```bash
docker-compose up -d postgres
npm install
npm run dev
```

Crie o arquivo `.env` na raiz:

```env
DATABASE_URL="postgresql://auth_user:auth_password@localhost:5432/auth_api"
JWT_SECRET="super_secret_key"
PORT=3000
```

Para testes, o projeto usa `tests/.env.test`.

## Scripts úteis

- `npm run dev`: sobe a API com `nodemon`.
- `npm run start`: inicia em modo produção.
- `npm run lint`: valida padrão de código.
- `npm run lint:fix`: corrige problemas de lint automaticamente.
- `npm run format`: verifica formatação.
- `npm run format:write`: aplica formatação.
- `npm test -- --runInBand`: roda suíte completa.
- `npm run test:coverage`: roda suíte com cobertura.

## Testes e cobertura

A suíte inclui:

- testes e2e de autenticação e rotas protegidas;
- testes de middleware de autenticação;
- testes de repositório de refresh token;
- testes unitários de `AuthService`.

Notas importantes:

- `pretest` e `pretest:coverage` executam `prisma migrate reset --force && prisma generate` para garantir ambiente reproduzível.
- A CI aplica `coverageThreshold` global para evitar regressão silenciosa.

## Endpoints

- `POST /auth/register`: cria usuário.
- `POST /auth/login`: autentica e retorna tokens.
- `POST /auth/refresh`: renova sessão.
- `POST /auth/logout`: revoga refresh token.
- `GET /auth/profile`: rota protegida de perfil.
- `GET /users/me`: rota protegida de usuário autenticado.
- `GET /health`: liveness.
- `GET /ready`: readiness com verificação de banco.
- `GET /docs`: Swagger UI.
- `GET /docs.json`: OpenAPI em JSON.

## Validação manual (curl)

Registrar usuário:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@test.com","password":"123456"}'
```

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"123456"}'
```

Rota protegida:

```bash
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer <access_token>"
```

## Estrutura de pastas

```txt
src/
- app.js
- server.js
- logger.js
- config/
- controllers/
- docs/
- errors/
- middlewares/
- repositories/
- routes/
- services/
- validators/

prisma/
- schema.prisma
- migrations/

tests/
- auth.e2e.test.js
- health.e2e.test.js
- middleware/
- repositories/
- services/
- setup.js
- jest.env.js
```

## CI

Workflow em `.github/workflows/ci.yml`:

- provisiona PostgreSQL no GitHub Actions;
- instala dependências;
- executa lint;
- executa testes com cobertura;
- falha o pipeline se thresholds mínimos não forem atendidos.

## Decisões e trade-offs

- Refresh token em banco aumenta controle de sessão, com custo de estado adicional.
- Access token curto reduz impacto de comprometimento, com maior frequência de refresh.
- Camadas explícitas aumentam legibilidade e testabilidade, com mais arquivos e disciplina arquitetural.
- Reset de banco no pretest aumenta previsibilidade, com custo de tempo em execução local/CI.

## Roadmap técnico

### Segurança

- Concluir hash-at-rest de refresh token.
- Revogação por usuário/dispositivo.
- Rotina de revisão de dependências e vulnerabilidades.

### Confiabilidade

- Eliminar open handles no Jest.
- Cobrir cenários negativos e de erro de infra.
- Refinar observabilidade de falhas críticas.

### Escalabilidade

- Evoluir rate limit para Redis.
- Preparar comportamento para múltiplas instâncias.
