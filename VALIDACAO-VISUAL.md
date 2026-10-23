# Validação da revisão visual — 23/10/2026

- Design Master: arquivo principal e NOTICE fornecidos pelo usuário, lidos integralmente. Referências complementares mencionadas no arquivo não foram anexadas; aplicado o procedimento e as regras condensadas disponíveis no principal.
- Modo Operate: inventário, trabalhos do usuário, duas direções alternativas e escolha de painel de campanha; plano e crítica internos em design-review/plan.md.
- 57 testes existentes passaram. Nenhum teste adicional que apenas repete CSS foi criado.
- src/, testes, migrações e todos os JS anteriores em public/ idênticos ao ZIP anterior. HTML preserva todos os IDs e a estrutura dos controles existentes, sem IDs duplicados. Logo original preservada.
- Novos JS passaram por node --check. O módulo visual não faz requisições à API nem altera payloads ou campos de campanhas. Busca e status apenas filtram elementos já exibidos.
- Browser QA com dados fictícios: busca sem resultados, limpar filtros, campanha pausada, edição, seletor por teclado, Story validado, toggle de follow, mensagens prontas, inserção/remoção de botão pela área SVG, salvamento e nova campanha visível na lista, 15 eventos por página, contatos, menu móvel e botão de fechar, simulador com entrega por botão, logout e tela de acesso.
- Layout conferido em desktop e viewports de 768, 390 e 320 pixels; sem transbordamento horizontal nas telas verificadas. Em 320px: editor com largura de 320px e todos os botões visíveis do diálogo com pelo menos 44px. Indicadores agrupados em uma linha de 152px no mobile e tablet.
- Contrastes dos tokens principais: texto light 13,90:1; secundário light 5,14:1; borda de campo light 3,03:1; texto dark 15,10:1; secundário dark 8,57:1; borda de campo dark 4,18:1. Campos e focos explícitos, motion reduzido e rolagem mantida com barras ocultas.
- Limites: testes de API usam Meta simulada. Nenhuma alteração ou publicação na conta do usuário. Viewports não substituem testes físicos de teclado virtual e navegador interno do Instagram.

## Escopo do ZIP

Somente public/index.html, public/workspace.css, public/interface-icons.js, public/interface-polish.js e documentação. Nenhum arquivo do Worker, configuração, banco ou token faz parte deste pacote.
