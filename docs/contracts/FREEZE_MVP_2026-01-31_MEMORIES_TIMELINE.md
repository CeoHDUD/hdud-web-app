

# HDUD — FREEZE | MVP Memórias + Timeline
> 🧭 **Bússola do Produto (MVP)**
>
> Este FREEZE existe para **proteger decisões já tomadas**, não para limitá-las.
>  
> Enquanto este arquivo for a referência ativa:
> - Nada aqui descrito deve ser reimplementado, reavaliado ou redesenhado.
> - Evoluções só podem ocorrer via **novo trilho + novo freeze**.
> - Dúvidas de escopo devem ser resolvidas consultando este documento **antes** de código ou discussão.


---

## 1) Natureza deste documento

Este arquivo registra o **baseline congelado do MVP** para:

- **Memórias (detalhe + versões + edição/PUT + rollback + diff)**
- **Timeline (consumo do agregador /timeline)**

Este FREEZE define **o que está validado end-to-end**, **quais rotas do core foram usadas**, e **o que fica fora do escopo**.

Tudo aqui é **pedra fundamental** para evitar retrabalho e “re-discussão” do que já foi entregue.

---

## 2) Ambiente e premissas de validação (obrigatório)

- Stack: **Docker Compose**
- Frontend: **Vite + React** (validação considerando build/serve de produção via Nginx quando aplicável)
- Backend: **HDUD API Core** (contratos estáveis)
- Autenticação: **JWT Bearer** em `Authorization: Bearer <token>`

---

## 3) Contratos do Core utilizados (rotas)

**Memórias**
- `GET /memory/:id`
- `PUT /memory/:id`
- `GET /memory/:id/versions`

**Timeline**
- `GET /timeline`

Observação: o Web consome **apenas** essas rotas para este MVP.

---

## 4) O que está validado end-to-end (DONE)

### 4.1 Memórias — Detalhe
- Abrir uma memória por URL `/memories/:id`
- Carregar e renderizar:
  - título
  - conteúdo (estado atual)
  - versão atual (vN)
  - metadados básicos (criado em / authorId quando disponível)
- Botões de recarregar:
  - **Recarregar detalhe** (refaz `GET /memory/:id`)
  - **Recarregar versões** (refaz `GET /memory/:id/versions`)

### 4.2 Memórias — Editar (PUT) + Versionamento
- Entrar em modo edição (quando permitido por `meta.can_edit`)
- Salvar alterações via `PUT /memory/:id` com:
  - `content` obrigatório
  - `title` opcional (pode ser null)
- Após salvar:
  - detalhe é recarregado
  - versões são recarregadas
  - confirmação visual: “Alterações salvas — nova versão registrada.”

### 4.3 Memórias — Versões (Linha do Tempo da Memória)
- Listar versões via `GET /memory/:id/versions`
- Exibir cards de versões com:
  - número da versão (vN)
  - snapshot do conteúdo
  - data/hora de criação (quando disponível)
- Marcar versão atual
- Exibir total de versões registradas

### 4.4 Memórias — Rollback (via PUT criando nova versão)
- Restaurar uma versão antiga criando uma **NOVA** versão via `PUT /memory/:id`
- Confirmação por `window.confirm`
- Após restaurar:
  - detalhe e versões recarregadas
  - feedback de sucesso exibido

### 4.5 Memórias — Diff (comparação de versões)
- Selecionar duas versões (A/B)
- Gerar diff **por linhas**:
  - adições
  - remoções
  - linhas iguais omitidas para legibilidade
- O diff é **somente leitura** (não altera backend)

### 4.6 Timeline — Agregador unificado
- Tela `/timeline` consome apenas `GET /timeline`
- Exibe:
  - filtros por tipo (Tudo/Memórias/Capítulos/Versões/Rollbacks)
  - agrupamento por dia
  - ordenação do mais recente para o mais antigo
- Possui bloco de “Diagnóstico” (visibilidade mínima):
  - endpoint usado
  - se Authorization foi enviado
  - status HTTP retornado

---

## 5) Evidências de freeze (repositório)

**Web**
- Commit: `8502eca` — `feat(memories): detail + versions + edit/put + rollback + diff (mvp)`
- Tag: `freeze-2026-01-31-memories-mvp`

---

## 6) Fora de escopo (explicitamente NÃO incluído neste MVP)

### Produto / UX
- Pesquisa, ordenação avançada, paginação e filtros complexos em Memórias
- Editor rico (markdown/WYSIWYG), upload de mídia, anexos
- Permissões avançadas (RBAC completo no front), multi-author, compartilhamento
- “Publicar/despublicar”, visibilidade pública, feed social
- Design final/polimento visual (este MVP prioriza funcionalidade)

### Backend / Core
- Novas rotas além das listadas (nenhuma foi criada por este freeze)
- Otimizações de performance e caching server-side
- Auditoria completa, observabilidade, métricas, tracing
- Timeline com eventos de versões/diff/rollback **via core** (entra quando o core expuser)
- Hardening de sessão (refresh token, rotação, etc.) fora do contrato atual

### Qualidade / Engenharia
- Testes automatizados (unit/e2e) como requisito de conclusão
- Refactors para “arquitetura perfeita” (somente correções necessárias ao MVP)

---

## 7) Como reproduzir o MVP rapidamente (smoke)

1. Subir ambiente via Docker Compose (web + api)
2. Login (obter token JWT)
3. Abrir: `/memories/:id`
4. Validar:
   - carrega detalhe (GET /memory/:id)
   - carrega versões (GET /memory/:id/versions)
5. Editar e salvar:
   - `PUT /memory/:id` cria nova versão
   - versões aumentam (vN)
6. Timeline:
   - abrir `/timeline`
   - valida `GET /timeline` e renderização cronológica

---

## 8) Regra de preservação do FREEZE

Este documento só pode ser alterado por:
- novo trilho + novo freeze (ex.: `FREEZE_MVP_YYYY-MM-DD.md`), ou
- patch explícito com justificativa e referência a commit/tag

Sem isso, o conteúdo aqui permanece como **fonte de verdade do MVP**.

---
