# Dashboard Wiwap — ajustes de 27/10/2026

## Publicação
Descompacte o ZIP e envie o conteúdo desta pasta para a raiz do repositório existente no GitHub. Substitua os arquivos de mesmo nome. Não envie o ZIP fechado nem crie outra pasta envolvendo o projeto. A Vercel deve publicar o commit conforme a integração existente.

Esta entrega contém o dashboard completo. Não é necessário trocar os fluxos n8n para aplicar estes ajustes de visualização.

## Regras dos indicadores
- Agendas / Agendamentos gerados: leads únicos pela data de criação do agendamento no CRM, independentemente da data de criação do lead.
- Bot / Agendamentos gerados pelo Bot: subconjunto acima com evento de escolha de horário seguido de confirmação na jornada, na mesma data da criação da agenda no CRM. Não atribui agendas por simples mudança de etapa. Não conta espelhamento isolado do CRM, confirmação isolada, escolha sem confirmação ou remarcação como nova agenda. Um encaminhamento humano ou pedido de remarcação entre a escolha e a confirmação invalida essa sequência.
- O card e o gráfico diário do Bot usam a mesma lista de IDs. Somar as barras do período deve produzir o total do card, com o mesmo filtro de hunter.
- O funil do Bot e os cards de mensagens/escolha/humano continuam acompanhando apenas leads criados no período, com rótulos explícitos. Podem ter valores diferentes do card de agendas, que inclui leads antigos.
- Retomadas do Bot: a coluna de agendas posteriores exige a mesma evidência de escolha + confirmação, após a tentativa e antes da próxima. Associação temporal não prova causalidade.
- Atribuição conservadora: o histórico textual não fornece um campo imutável de autoria. Históricos ausentes ou incompletos podem subestimar agendas do Bot; esta entrega não recupera dados históricos inexistentes. Para auditoria definitiva, registrar a origem Bot/Humano e o momento da criação no fluxo que efetivamente grava a reunião no CRM.
- Cobertura parcial: exibe os registros observados e informa quantos leads têm histórico disponível; não oculta toda a seleção por faltar uma parte dos dados. Ausência de histórico não comprova ausência de atendimento.
- Show-up / período selecionado: exclui sábados e domingos, inclusive em agregações por semana e mês. A janela do filtro permanece a mesma; 7 dias corridos podem mostrar cinco dias úteis. Os demais totais não excluem agendas de fim de semana.
- Status de atualização: tolerância de dez minutos para cadência de cinco minutos, execução e atualização do CSV. O aviso continua presente se houver recuperação pendente, ausência de controle ou falha na leitura.

## Outros ajustes
Removidos os três blocos antigos de Marketing: Impacto da API Oficial (Meta), Templates — Abandono Pós Cadastro e Templates — CA S2. Preservados os demais indicadores, Acompanhamento, remoções anteriores dos gráficos SDR e otimizações de desempenho.

## Validação
Verificadas regras de atribuição/deduplicação, cobertura parcial, exclusão de fins de semana e sintaxe dos scripts. Testado no Chrome com bases locais de referência: filtros, card versus gráfico, navegação entre guias e largura móvel. Nenhuma alteração foi publicada automaticamente no GitHub, na Vercel ou no n8n. Os testes não constituem reconciliação ao vivo de todos os IDs do CRM.

## Correção de presença — 27/10
Taxa = presentes ÷ todas as reuniões previstas no recorte, tanto nos horários quanto no total, no card e no gráfico. A taxa é parcial durante o dia. Quem ainda aguarda o fim do horário continua pendente, sem ser classificado antecipadamente como ausência. Reprodução do print: 2/8 = 25%; total 2/26 = 7,7%.
