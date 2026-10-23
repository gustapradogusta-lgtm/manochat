# ManoChat — Stories e encerramento após a entrega

Esta versão inclui as capas 9:16, entrega por botão sem endereço repetido, página de documentos e as novas campanhas de Story.

## O que foi ajustado na conversa

- Somente um novo comentário válido ou uma nova resposta ao Story configurado inicia um fluxo.
- Enquanto o fluxo está aberto, a pessoa pode responder ou usar os botões para receber o conteúdo.
- Depois da entrega, a automação encerra. “Obrigado”, “quero”, mensagens comuns e botões antigos não provocam novo envio.
- Uma entrega com erro de resposta da Meta também não é repetida automaticamente. Em caso de dúvida, confira os registros e use uma nova entrada de teste.
- Há uma proteção independente de encerramento: se uma gravação secundária falhar depois do envio, uma nova DM não deve repetir a entrega.
- Campanhas pausadas, sessões encerradas ou expiradas não continuam. Uma sessão tem duração máxima de 24 horas; um novo comentário ou uma nova resposta ao Story inicia outra.
- Menções, compartilhamentos de Story e mensagens comuns não criam campanhas. O gatilho implementado é uma resposta com texto ao seu Story.

## Primeiro: atualizar o banco, pelo navegador

Não basta subir os arquivos nesta revisão. Aplique a atualização 0006 antes do deploy do código. Não altere seu token, seus secrets ou as conexões que já funcionam.

1. Guarde o backup do código atual e um backup/exportação do banco D1.
2. Entre na Cloudflare, na mesma conta do Worker ManoChat.
3. Abra **Storage & databases → D1** (ou localize D1 pelo menu da conta).
4. Abra o banco que já está vinculado como **DB** no seu Worker. No seu projeto, ele foi identificado como **manochat-db**. Não crie outro banco.
5. Abra a aba **Console**.
6. Execute os quatro blocos abaixo, um por vez. Cada bloco deve terminar com uma mensagem de sucesso antes de você passar ao próximo. Se algum falhar, pare nessa etapa e envie apenas o erro, sem tokens.

Os blocos criam tabelas auxiliares e preservam campanhas e contatos. Podem ser executados novamente sem apagar os registros existentes. Eles também conservam como encerradas as conversas já entregues.

### Bloco 1 de 4

```sql
-- Additive and repeatable: existing campaigns and credentials are preserved.
CREATE TABLE IF NOT EXISTS campaign_triggers (
 campaign_id INTEGER PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
 trigger_type TEXT NOT NULL DEFAULT 'comment' CHECK(trigger_type IN ('comment','story')),
 story_id TEXT,
 story_link_id TEXT,
 story_link TEXT,
 story_username TEXT
);
```

### Bloco 2 de 4

```sql
CREATE TABLE IF NOT EXISTS automation_sessions (
 igsid TEXT PRIMARY KEY REFERENCES contacts(igsid) ON DELETE CASCADE,
 source_type TEXT NOT NULL CHECK(source_type IN ('comment','story')),
 source_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','sending','delivered','failed','closed')),
 source_event_at INTEGER NOT NULL DEFAULT 0,
 started_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
```

### Bloco 3 de 4

```sql
CREATE TABLE IF NOT EXISTS conversation_locks (
 igsid TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
```

### Bloco 4 de 4

```sql
INSERT OR IGNORE INTO automation_sessions(igsid,source_type,source_id,state,source_event_at,started_at,expires_at)
 SELECT igsid,'comment',source_comment_id,CASE WHEN stage='delivered' THEN 'delivered' ELSE 'active' END,0,
 CAST(strftime('%s','now') AS INTEGER)*1000,CAST(strftime('%s','now') AS INTEGER)*1000+86400000
 FROM conversations WHERE source_comment_id IS NOT NULL;
```

## Depois: subir o código no GitHub

1. Descompacte o ZIP.
2. Abra a raiz do seu repositório no GitHub, onde já existem `src` e `public`.
3. Clique em **Add file → Upload files**.
4. Envie as pastas e os arquivos DESCOMPACTADOS. Não envie o ZIP inteiro nem uma pasta externa envolvendo o projeto.
5. Confira os caminhos `src/index.js`, `src/lib/story-campaigns.js`, `src/lib/automation-sessions.js`, `public/app.js` e `migrations/0006_stories_sessions.sql`.
6. Salve com o nome `Adicionar Stories e encerrar apos entrega`.
7. Aguarde o deploy da Cloudflare concluir. Se seu projeto não publica automaticamente, use o mesmo procedimento de deploy que já vinha usando.
8. Recarregue o painel com Ctrl + Shift + R. No celular, feche a aba e abra novamente.

A migração 0005 incluída continua sendo a dos botões que você já usa. Para esta revisão, execute os quatro blocos da 0006 acima. Os arquivos `wrangler.toml`, `package.json` e `package-lock.json` não estão no ZIP: mantenha os seus.

## Preservar o botão da primeira DM

Mantenha a variável `META_PRIVATE_REPLY_BUTTONS_ENABLED` com o valor exato `true`, que você já habilitou. Se a Cloudflare avisar que essa configuração será sobrescrita no próximo deploy, mantenha esta linha dentro do bloco `[vars]` do SEU `wrangler.toml`:

```toml
META_PRIVATE_REPLY_BUTTONS_ENABLED = "true"
```

Não crie dois blocos `[vars]`. Não substitua o arquivo inteiro por um exemplo e não coloque o token nele. Conserve nome do Worker, ID do banco, bindings e demais configurações atuais. A atualização não inclui nenhum token real.

## Criar uma campanha por Story

1. Publique o Story normalmente no Instagram, no perfil conectado ao ManoChat. Esta atualização não publica Stories automaticamente.
2. Abra o Story e use **Compartilhar → Copiar link** (o nome do botão pode variar conforme o aplicativo).
3. No ManoChat, abra **Campanhas → Criar campanha**.
4. Em **Iniciar campanha por**, escolha **Resposta a Story**.
5. Dê um nome à campanha.
6. Defina palavras-chave, como `GUIA`, ou ative **Qualquer resposta ao Story**. Esse modo considera respostas com texto, incluindo emojis, recebidas com a identificação do Story.
7. Cole o link completo no campo **Link do Story**. Exemplo de formato: `https://www.instagram.com/stories/seuperfil/123456789/`.
8. Você pode clicar em **Conferir Story** para validar. A validação também acontece ao salvar um link novo: é necessário encontrar o Story ativo na conta conectada.
9. Configure as mensagens e botões na aba **Conversa**. Se quiser aplicar os modelos prontos, use **Aplicar mensagens prontas**, revise e salve.
10. Configure o material e o botão na aba **Entrega**. Salve a campanha com o status **Ativa**.

Para cadastrar uma campanha de Story, além das mensagens e do material, basta colar o link: não é necessário procurar o ID manualmente. A ferramenta guarda separadamente o ID da API e o número presente no link. Links de destaque, links encurtados, Stories de outra conta e Stories expirados não são aceitos como uma nova configuração.

Quando o Story sair do ar, publique outro Story e troque o link da campanha. Se a consulta da Meta não permitir localizar o Story, o painel apresenta o erro e não ativa um gatilho genérico para qualquer mensagem.

As respostas de Stories são recebidas pelo webhook de mensagens. O sistema já utiliza mensagens para o seu fluxo atual, mas é necessário testar um Story real nessa conta. Não é necessário trocar o token preventivamente nem refazer toda a integração. Se não chegar o evento, confira o webhook e os acessos atuais antes de mudar configurações.

## Teste obrigatório após o deploy

1. Faça um comentário NOVO em uma campanha antiga e percorra o fluxo até receber o material.
2. Depois da entrega, envie “obrigado” e depois “quero” por DM. O ManoChat não deve responder a essas duas mensagens.
3. Tente um botão antigo de continuar, se ainda aparecer no histórico. Ele não deve repetir a entrega.
4. Faça um novo comentário válido: agora uma nova entrada pode iniciar o fluxo.
5. Por outra conta, responda ao Story cadastrado com a palavra-chave. Você deve receber a primeira mensagem no Direct, sem resposta pública no post.
6. Termine a entrega do Story e envie outra DM comum. A automação deve permanecer encerrada.
7. Responda novamente ao Story: essa nova resposta é uma nova entrada permitida.
8. Confira que Story diferente, menção em Story e DM solta não iniciam a campanha.

Se houver erro, restaure o commit anterior e confira os registros da Cloudflare. As novas tabelas podem permanecer; o código anterior não depende delas. Não apague o banco nem remova tabelas para desfazer a atualização.

## Capas e materiais

As capas são menores, em proporção 9:16 e com cantos arredondados. A consulta por ID busca um endereço atualizado; se a imagem não estiver disponível, o painel mostra uma indicação em vez de um ícone quebrado. Um Story expirado pode deixar de fornecer capa.

A entrega não repete o endereço quando um botão já abre aquele mesmo conteúdo. Se você escreveu um link manualmente dentro da Mensagem de entrega, retire esse trecho do texto. O endereço permanece no campo Link de entrega.

Em Link + arquivo, configure um botão para o link e outro para o arquivo. Se algum material não tiver botão correspondente, seu endereço continua no texto para não deixar o destinatário sem acesso.

Um link de visualização do Drive abre o próprio Drive. Configure o compartilhamento no Drive; a ferramenta não muda as permissões nem envia arquivos automaticamente para ele.

Arquivos enviados pela ferramenta precisam do armazenamento R2 com binding `FILES`, além das tabelas já existentes. Esta revisão não cria esse armazenamento na sua conta. Sem ele, use um link do Drive.

Botões de arquivo abrem uma página com nome, tamanho e opção de baixar. PDFs têm prévia quando o navegador permite; no navegador interno do Instagram pode ser necessário baixar ou abrir no navegador externo. Word, ZIP e outros formatos são baixados e abertos no aplicativo compatível. Quem tiver o link pode acessar o material; não use para documentos privados.

## O que foi conferido

57 testes automatizados passaram. Cobrem fluxo anterior, encerramento, mensagens após entrega, botões antigos, eventos repetidos, sessões expiradas, campanha pausada, erros de envio/gravação, validação de link de Story, separação de gatilhos, arquivos e consulta de capas. Cadastro e salvamento de Story conferidos no navegador com dados fictícios, inclusive editor de 390 pixels sem transbordamento horizontal.

Os métodos existentes de envio e a autenticação da Meta foram comparados e preservados. Adicionamos a consulta de Stories em um método separado. Segurança de sessão e assinatura do webhook preservadas. Nenhum acesso ao seu banco de produção, token real ou deploy foi realizado por este ambiente. Os testes automatizados simulam a Meta; a confirmação final é o teste na sua conta após publicar.

Referências técnicas: documentação oficial da Meta, “Stories” e “Instagram webhook notification examples”, consultadas em 23/10/2026:
https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/stories
https://developers.facebook.com/documentation/instagram-platform/webhooks/examples
