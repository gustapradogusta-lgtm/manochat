# Registro de validação — 23/10/2026

Base: ManoChat-Atualizacao-GitHub.zip, entregue em 10/10/2026.

## Resultado

- 33/33 testes Node passaram (`npm test`, Node 24).
- Checagem de sintaxe de todos os JS de src/, public/ e tests/ passou.
- Navegador: editor desktop, modo clean e dark, configuração de botões, prévia ao editar mensagem, opções por teclado (setas + Enter), alteração da forma de entrega e salvamento pela API local.
- Viewport mobile 390 × 844 em iframe de QA: escolhas visíveis, editor em tela cheia, cabeçalho e rodapé sem deslocamento, documento e diálogo com largura de 390 pixels, sem transbordamento horizontal.
- Imagens em revisao/ usam campanha e dados fictícios, sem envio ao Instagram.

## Compatibilidade preservada por comparação com a base

`src/lib/security.js`, wrangler.toml, package.json, package-lock.json e migrações 0001–0004 não mudaram. Configuração, secrets e banco de produção não foram acessados. wrangler.toml e arquivos de dependências foram excluídos do pacote para evitar substituição de configuração do ambiente.

`src/meta.js` foi alterado para aceitar templates opcionais, mantendo o payload anterior para strings. `src/lib/automation.js` ganhou parsing de postbacks. `src/index.js` ganhou salvamento da configuração, validação de cliques, envio opcional e leases por contato. Domínio da API, versão configurável, autenticação Bearer, callback, challenge, leitura do corpo bruto e HMAC do webhook foram mantidos.

VERIFY_META_BASELINE_ORIGINAL.json conserva os hashes anteriores. VERIFY_META_BASELINE.json registra os novos hashes revisados. A atualização dos hashes é deliberada porque botões exigem alterar o envio e a leitura de eventos; o teste de integridade sozinho NÃO prova compatibilidade. Os testes comportamentais cobrem também o fluxo anterior.

## Casos novos testados

Limite de botões e rótulos; ações permitidas por etapa; URLs inválidas; persistência e salvamento atômico; preservação da configuração em clientes antigos; migração ausente e migração repetida; primeira DM em texto por padrão; opt-in de template inicial; follow obrigatório; rejeição de outra campanha, conversa anterior, evento sem identidade, campanha pausada e botão removido; cliques duplicados e simultâneos; assinatura inválida; erro da Meta sem envio automático de segunda private reply.

## Limites

Meta simulada nos testes: a aceitação de templates, permissões e recebimento de postbacks na conta real exigem a validação descrita no guia. O teste mobile cobre layout em viewport; teclado virtual, áreas seguras e comportamento específico do Safari/iOS e aparelhos Android físicos ainda precisam ser conferidos no aparelho. Não houve publicação ou alteração de dados reais.
