# Auth API (Node.js + Express + Prisma)

![CI](https://github.com/john-dalmolin/auth-api-node/actions/workflows/ci.yml/badge.svg)

API de autenticação e gestão de sessão com foco em robustez de backend: arquitetura em camadas, controle de sessão com rotação de token, rate limiting com Redis, documentação OpenAPI e pipeline de qualidade com testes automatizados.

## Objetivo

Este projeto foi construído como laboratório de engenharia aplicada para portfólio, com foco em decisões técnicas próximas de ambiente real de produção.

O escopo principal cobre:

- autenticação com `accessToken` + `refreshToken` com rotação;
- revogação de sessão por token e por usuário;
- validação de entrada e tratamento de erros consistente;
- observabilidade mínima para operação;
- qualidade contínua com lint, cobertura e CI.

## Snapshot de maturidade (fev/2026)

- `16/16` suítes passando
- `104/104` testes passando
- cobertura global: `99.2%` (branches `99.2%`)
- `src/config` e `src/middlewares` com `100%` de branch coverage
- CI do GitHub Actions estável em `main`

## Stack

- Node.js 20 LTS
- Express 5
- TypeScript 5.9
- Prisma 7 + PostgreSQL
- Redis (`ioredis`)
- JWT (`jsonwebtoken`) + `bcryptjs`
- Zod (validação de payload)
- Pino (logging estruturado)
- Vitest + Jest + Supertest
- Biome (lint/format)
- Swagger UI + swagger-jsdoc

## Arquitetura

Padrão em camadas:

- `routes`: contrato HTTP e composição de middlewares
- `controllers`: orquestração de request/response
- `services`: regras de negócio
- `repositories`: persistência e consultas

Middlewares críticos:

- `requestId`: correlação por requisição
- `logger`: log estruturado com contexto
- `validate`: validação de entrada com Zod
- `authMiddleware`: proteção de rotas com JWT
- `rateLimiter`: proteção anti-abuso com Redis + fallback em memória
- `errorHandler`: normalização de respostas de erro

## Fluxo de autenticação e sessão

1. `POST /auth/register`: cria usuário com senha hasheada.
2. `POST /auth/login`: valida credenciais e emite `accessToken` + `refreshToken`.
3. `POST /auth/refresh`: valida refresh token, revoga o token anterior e gera novo par.
4. `POST /auth/logout`: revoga a sessão atual.
5. `POST /auth/logout-session` e `POST /auth/logout-all`: encerram sessões específicas ou todas.

## Segurança e confiabilidade implementadas

- refresh token persistido com hash (`tokenHash`) no banco
- rotação por `jti` com revogação explícita
- validação de `JWT_SECRET` no startup (fail fast)
- tratamento centralizado de erro com `AppError`
- rate limit para endpoints sensíveis
- redução de ruído em logs de teste
- teardown de recursos de teste para evitar open handles

## Setup local

Pré-requisitos:

- Docker + Docker Compose
- Node.js 20 LTS
- npm

Subir infraestrutura e aplicação:

```bash
docker-compose up -d postgres redis
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Arquivo `.env`:

```env
DATABASE_URL="postgresql://auth_user:auth_password@localhost:5432/auth_api"
JWT_SECRET="<gere-um-segredo-forte-com-no-minimo-32-caracteres>"
PORT=3000
REDIS_URL="redis://localhost:6379"
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

Para testes, usar `tests/.env.test`.

## Scripts principais

- `npm run dev`: desenvolvimento com watch
- `npm run start`: execução da API
- `npm run lint`: lint com Biome
- `npm run format`: valida formatação
- `npm test`: suíte principal (Vitest)
- `npm run test:coverage:jest`: cobertura com Jest
- `npm run test:coverage:vitest`: cobertura com Vitest
- `npm run typecheck`: verificação de tipos

## Validação rápida

```bash
npm run lint
npm run test:coverage:jest
npx jest --config jest.config.cjs --runInBand --detectOpenHandles --openHandlesTimeout=5000
```

## Endpoints principais

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/profile`
- `GET /users/me`
- `GET /auth/sessions`
- `POST /auth/logout-session`
- `POST /auth/logout-all`
- `GET /health`
- `GET /ready`
- `GET /docs`
- `GET /docs.json`

## Progresso técnico recente

Últimas entregas relevantes em `main`:

- [#14](https://github.com/john-dalmolin/auth-api-node/pull/14) estabilidade de runtime de testes (teardown Prisma)
- [#15](https://github.com/john-dalmolin/auth-api-node/pull/15) aumento de branch coverage em fluxos de auth/rate limiter
- [#16](https://github.com/john-dalmolin/auth-api-node/pull/16) redução de ruído de logs em execução de teste
- [#18](https://github.com/john-dalmolin/auth-api-node/pull/18) cobertura completa de branches em `src/config/prisma.ts`
- [#19](https://github.com/john-dalmolin/auth-api-node/pull/19) cobertura completa de branches em `src/logger.ts`
- [#20](https://github.com/john-dalmolin/auth-api-node/pull/20) cobertura completa de branches em `validate.ts` e `errorHandler.ts`
- [#21](https://github.com/john-dalmolin/auth-api-node/pull/21) cobertura completa de branches em rate limiter e redis config

## Roadmap técnico

Próximos incrementos:

- consolidar decisão final de cobertura (Jest vs Vitest vs modelo híbrido documentado)
- ampliar cenários de indisponibilidade externa (Redis e DB)
- evoluir regras de sessão por dispositivo (metadados mais ricos)
- documentar ADR de sessão/rotação
- reforçar checklist de segurança (dependências, segredo e expiração)

Backlog detalhado: `to-do.txt`.

## Estrutura de pastas

```txt
src/
- app.ts
- server.ts
- logger.ts
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
- auth.e2e.test.ts
- health.e2e.test.ts
- middleware/
- config/
- repositories/
- services/
- setup.js
- jest.env.js
- jest.globals.js
- vitest.setup.mjs
```
