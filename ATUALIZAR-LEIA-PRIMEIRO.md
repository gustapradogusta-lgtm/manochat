# ManoChat — atualização visual com Design Master

Este é um pacote incremental para o ManoChat Studio que você já instalou. Ele contém somente quatro arquivos da interface. Não contém código do servidor, migrações, tokens ou configuração da Cloudflare.

## O que mudou

- Navegação com ícones consistentes e indicação clara da tela atual.
- Temas clean e dark com cores, campos e hierarquia revisados.
- Logo original preservada; apresentação branca no tema escuro.
- Cartões compactos com capas 9:16, estado da campanha e resultados organizados.
- Busca por campanha, publicação ou palavra-chave e filtro por status.
- Editor com separação entre gatilho, conversa e entrega; escolha de opções por teclado; prévia identifica comentário ou Story.
- Campos, botões, alternâncias, menu e rodapé adaptados ao celular.
- Tela de acesso, contatos, eventos, simulador e conexão com o mesmo padrão visual.

## Como subir, pelo navegador

1. Guarde um backup da sua pasta `public` atual.
2. Descompacte este ZIP. Você verá uma pasta chamada `public` e os guias.
3. Abra seu repositório no GitHub, na raiz onde já existem as pastas `public` e `src`.
4. Clique em Add file → Upload files.
5. Arraste a pasta `public` DESCOMPACTADA deste pacote para essa raiz. Não envie o ZIP inteiro e não coloque uma pasta `public` dentro da outra.
6. Antes de salvar, confira estes quatro caminhos:
   - public/index.html
   - public/workspace.css
   - public/interface-icons.js
   - public/interface-polish.js
7. Salve o commit com o nome: `Melhorar interface do ManoChat`.
8. Aguarde o deploy da Cloudflare concluir.
9. Abra o ManoChat e pressione Ctrl + Shift + R. No celular, feche e reabra a aba; se continuar vendo a aparência antiga, limpe os dados em cache desse site.

Não apague os outros arquivos de `public`: eles continuam sendo usados. Os quatro arquivos deste pacote se somam à versão atual da plataforma. Não envie uma pasta externa envolvendo `public`.

## Nesta atualização não há SQL

Não precisa abrir o Console D1 nem executar consultas para esta revisão visual. Não substitua `src`, `migrations`, `wrangler.toml`, `package.json` ou seus secrets. Mantenha sua configuração atual, inclusive a variável que já habilitou o botão da primeira DM.

## Depois de publicar

- Alterne entre Clean e Dark.
- Busque uma campanha e teste o filtro de Ativas/Pausadas.
- Abra uma campanha existente e confira as abas Gatilho, Conversa e Entrega, sem salvar se não quiser mudar a campanha.
- No celular, confira o menu, o botão para fechá-lo e o rodapé do editor.
- Faça um comentário novo ou uma resposta de Story de teste para confirmar o fluxo na sua conta após o deploy.

Se precisar voltar ao visual anterior, restaure o `public/index.html` do seu backup e recarregue o site. Os três arquivos novos ficam sem uso quando o HTML anterior não os carrega. O banco não precisa ser alterado.

## Exemplo usado para aplicar a habilidade

Reformule o design do ManoChat para uma plataforma profissional de automação do Instagram. Preserve a identidade da marca e melhore os temas claro e escuro, navegação, campos de escolha, campanhas com capas 9:16 e editor de mensagens com botões. Priorize uma experiência simples para pessoas sem conhecimento técnico e excelente no celular. Preserve os fluxos de comentários, Stories e entrega, sem alterar tokens ou configurações da Meta. Implemente, confira no navegador e entregue os arquivos prontos para atualizar o projeto.

## Validação

A direção escolhida foi um painel de operação preciso, com menos ornamentos e mais clareza para comparar e configurar campanhas. A revisão seguiu o arquivo Design Master enviado por você, com planejamento, alternativas, implementação e crítica visual.

57 testes de comportamento existentes passaram. O código do servidor, os scripts originais da interface e as migrações foram comparados com a versão anterior e permanecem idênticos. Todos os IDs anteriores do HTML foram preservados, sem duplicação.

Conferência no navegador em desktop, tablet de 768 pixels e telas de 390 e 320 pixels: temas, busca, filtro e estado vazio, opções por teclado, alternância de follow, aplicação de mensagens prontas, adicionar/remover botão, validação de Story, salvamento de campanha, paginação de 15 eventos, navegação móvel, acesso e simulador. Dados e API da Meta simulados; não houve envio real nem publicação em produção por este ambiente.
