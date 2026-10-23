# Registro de validação — 23/10/2026

Base: ManoChat-Atualizacao-GitHub.zip, entregue em 10/10/2026.

## Resultado

- 57/57 testes Node passaram (`npm test`, Node 24).
- Checagem de sintaxe de todos os JS de src/, public/ e tests/ passou.
- Navegador: editor desktop, modo clean e dark, configuração de botões, prévia ao editar mensagem, opções por teclado (setas + Enter), alteração da forma de entrega e salvamento pela API local.
- Viewport mobile 390 × 844 em iframe de QA: escolhas visíveis, editor em tela cheia, cabeçalho e rodapé sem deslocamento, documento e diálogo com largura de 390 pixels, sem transbordamento horizontal.
- Imagens da conferência local usam dados fictícios, sem envio ao Instagram.

## Compatibilidade preservada por comparação com a base

`src/lib/security.js`, wrangler.toml, package.json, package-lock.json e migrações 0001–0004 não mudaram. Configuração, secrets e banco de produção não foram acessados. wrangler.toml e arquivos de dependências foram excluídos do pacote para evitar substituição de configuração do ambiente.

`src/meta.js` foi alterado para aceitar templates opcionais, mantendo o payload anterior para strings. `src/lib/automation.js` ganhou parsing de postbacks. `src/index.js` ganhou salvamento da configuração, validação de cliques, envio opcional e leases por contato. Domínio da API, versão configurável, autenticação Bearer, callback, challenge, leitura do corpo bruto e HMAC do webhook foram mantidos.

VERIFY_META_BASELINE_ORIGINAL.json conserva os hashes anteriores. VERIFY_META_BASELINE.json registra os novos hashes revisados. A atualização dos hashes é deliberada porque botões exigem alterar o envio e a leitura de eventos; o teste de integridade sozinho NÃO prova compatibilidade. Os testes comportamentais cobrem também o fluxo anterior.

## Casos novos testados

Limite de botões e rótulos; ações permitidas por etapa; URLs inválidas; persistência e salvamento atômico; preservação da configuração em clientes antigos; migração ausente e migração repetida; primeira DM em texto por padrão; opt-in de template inicial; follow obrigatório; rejeição de outra campanha, conversa anterior, evento sem identidade, campanha pausada e botão removido; cliques duplicados e simultâneos; assinatura inválida; erro da Meta sem envio automático de segunda private reply.

## Limites

Meta simulada nos testes: a aceitação de templates, permissões e recebimento de postbacks na conta real exigem a validação descrita no guia. O teste mobile cobre layout em viewport; teclado virtual, áreas seguras e comportamento específico do Safari/iOS e aparelhos Android físicos ainda precisam ser conferidos no aparelho. Não houve publicação ou alteração de dados reais.

Revisão das mensagens: quatro testes adicionais cobrem o CTA RECEBER CONTEÚDO, condições de ativação, fallback de texto e destinos de arquivo/link. Essa revisão anterior de mensagens preservou os módulos de envio, webhook, segurança e banco.

## Capas e página de documentos

Sete testes novos: remoção seletiva de URLs representados por botões; payload real de entrega; página e prévia PDF; rejeição de tipos perigosos; autenticação da capa; atualização por ID sem vazamento de token; rejeição de hosts externos, redirects externos, HTML e vídeo sem thumbnail. Consulta de capa adicionada em método isolado de src/meta.js. Preservados os métodos de envio, o parser de webhook e os secrets.

Nesta revisão, a entrega e o simulador usam a mensagem com botão sem repetir o destino. Arquivos abrem uma página própria; não há conversão de Word nem upload automático no Drive. O armazenamento FILES é necessário para arquivos enviados. O usuário já confirmou os botões reais no Instagram antes desta revisão; os testes desta revisão usam a Meta simulada.

## Stories e sessões terminais

Treze testes adicionais cobrem migração 0006 repetível e backfill terminal, normalização de links, resolução na própria conta por permalink com paginação, ID da API separado do ID do link, persistência compatível com clientes antigos, banco sem migração, fluxo de Story com botões sem depender do opt-in de private reply, encerramento e reentrada apenas por evento novo, menções/referrals ignorados, isolamento de comentário/Story, campanha pausada, expiração, eventos antigos, erro ambíguo da Meta, lote de eventos e falha secundária do banco após envio.

Navegador: criação de campanha Story, validação de link com API simulada, salvamento, capa via proxy, reabertura em editor mobile de 390 pixels sem transbordamento. O envio real e as permissões de leitura de Stories na conta do usuário ainda precisam de confirmação após o deploy.

Comparação com o ZIP anterior: src/lib/security.js idêntico; src/meta.js mantém integralmente os métodos anteriores e acrescenta listStories separadamente. Configurações de produção e secrets não foram acessados. O fluxo autorizado e os novos hashes constam na baseline revisada, mantendo a baseline original.
