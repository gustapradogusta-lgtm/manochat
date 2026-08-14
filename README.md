# ManoChat

Automação própria de comentário para Direct no Instagram, construída para rodar no plano gratuito da Cloudflare e usar somente a API oficial da Meta.

## O que já funciona

- Campanhas com palavra-chave por publicação ou para qualquer publicação.
- Private reply automática após o comentário.
- Continuação somente depois da resposta do usuário.
- Verificação de `is_user_follow_business`.
- Follow-gate opcional e entrega automática do link.
- Entrada alternativa quando o contato chama diretamente no Direct.
- Deduplicação persistente de comentários e mensagens no D1.
- Registro de interações e erros da Meta sem salvar tokens.
- Painel administrativo responsivo e protegido por sessão.
- Simulador do funil antes de conectar a conta real.

## Arquitetura gratuita

- Cloudflare Worker: API, webhook e painel.
- Cloudflare D1: campanhas, contatos, conversas e idempotência.
- Cloudflare Static Assets: HTML, CSS e JavaScript do painel.
- Meta Instagram API with Instagram Login: comentários, mensagens e perfil.

Nenhuma API de inteligência artificial é utilizada. As mensagens seguem regras determinísticas.

## Estrutura

```text
manochat/
├── migrations/0001_initial.sql
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── index.js
│   ├── meta.js
│   └── lib/
│       ├── automation.js
│       └── security.js
├── tests/automation.test.js
├── wrangler.toml
└── package.json
```

## Preparação para o deploy

As etapas abaixo serão realizadas em conjunto na Cloudflare quando a conta da Meta estiver pronta.

1. Criar o banco D1:

   ```bash
   npx wrangler d1 create manochat-db
   ```

2. Copiar o `database_id` retornado para `wrangler.toml`.

3. Aplicar a migração:

   ```bash
   npx wrangler d1 migrations apply manochat-db --remote
   ```

4. Cadastrar os secrets, um por vez:

   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put META_ACCESS_TOKEN
   npx wrangler secret put META_VERIFY_TOKEN
   npx wrangler secret put META_APP_SECRET
   npx wrangler secret put META_IG_USER_ID
   ```

5. Publicar:

   ```bash
   npx wrangler deploy
   ```

6. Na Meta, configurar:

   ```text
   https://SEU-WORKER.workers.dev/webhooks/instagram
   ```

   Assinar os eventos `comments` e `messages` e usar o mesmo `META_VERIFY_TOKEN`.

## Secrets

| Secret | Função |
|---|---|
| `ADMIN_PASSWORD` | Senha para entrar no painel |
| `SESSION_SECRET` | Assina a sessão; use uma sequência aleatória longa |
| `META_ACCESS_TOKEN` | Token da conta profissional do Instagram |
| `META_VERIFY_TOKEN` | Frase secreta usada na verificação do webhook |
| `META_APP_SECRET` | Valida a assinatura de cada evento recebido da Meta |
| `META_IG_USER_ID` | ID da conta profissional autorizada |

Nunca salve esses valores no GitHub, no `wrangler.toml` ou em prints públicos.

## Testes

```bash
node --test tests/*.test.js
node --check src/index.js
node --check public/app.js
```

## Regras importantes da Meta

- Uma private reply por comentário, enviada dentro da janela permitida pela Meta.
- Continuação do fluxo somente depois que o destinatário responder.
- Mensagens seguintes dentro da janela de atendimento permitida.
- O sistema não responde publicamente nem curte comentários automaticamente.
- Erros da Meta são registrados com código e subcódigo para diagnóstico.

## Privacidade

O banco guarda apenas o IGSID, username quando fornecido pela API, status de follow, etapa do funil e dados operacionais. Não armazena o conteúdo completo das conversas nem dados pessoais desnecessários.
