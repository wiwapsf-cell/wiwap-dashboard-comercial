# Dashboard Wiwap — revisão de 27/10/2026

## Publicação
Este ZIP contém o projeto completo. Descompacte e envie o conteúdo para a raiz do repositório existente, substituindo arquivos de mesmo nome. Não envie o ZIP fechado nem uma pasta adicional envolvendo o projeto. Publicação pela integração GitHub/Vercel existente. Nenhuma alteração de n8n é necessária para esta entrega.

## Bot: card e funil
O card usa leads únicos com primeira data de criação de agenda no CRM dentro do filtro, escolha de horário seguida de confirmação na jornada na mesma data da criação, sem encaminhamento humano ou remarcação entre essas ações. Inclui leads criados antes do filtro. Confirmações isoladas, simples espelhamento do CRM e remarcações não são novas agendas atribuídas ao Bot.
A última etapa do funil agora aplica exatamente essa validação, restringe aos leads criados no período e exige as etapas anteriores do funil. Portanto, seus IDs sempre são subconjunto do card: a última etapa nunca supera o card. Card e barras diárias continuam usando a mesma lista de IDs.
Atribuição conservadora com base no histórico textual; histórico incompleto pode subestimar resultados. Para autoria definitiva seria necessário registrar explicitamente Bot/Humano no momento da criação.

## Comercial: métricas independentes por data
- Templates enviados: eventos comerciais de Retomada Ativa aceitos pela Meta no período. Não comprova entrega/leitura. Deduplicação dos registros históricos por fase mantém a regra existente de 60 segundos, pois a exportação não fornece ID de mensagem.
- Leads alcançados: IDs únicos com envio comercial no período.
- Leads que responderam: IDs únicos com resposta registrada na jornada dentro do filtro, posterior a uma retomada comercial e anterior à próxima mensagem ativa. Pode ser resposta a template anterior ao período. Não é contagem de todas as mensagens do WipMessage nem comprovação de causa.
- Reuniões agendadas: todos os leads com primeira data de criação de agenda no CRM no período, de qualquer origem, sem exigir envio ou resposta de template. Mesma regra do card Agendamentos gerados da guia Agendas.
- Presentes: todos os leads com reunião no período e entrada Show-up na mesma data, de qualquer origem. Mesma regra da guia Agendas.
- Em contato solicitado: etapa atual de todos os leads do executivo. A base não fornece data histórica de entrada; por isso esse número não é apresentado como passagens no período.
Atribuição pelo responsável atual do CRM. Indicadores independentes, não são um funil. Não dividir respostas pelos envios do período como se fossem uma coorte única. Modelos detalham envios e respostas por identificação/tentativa, com texto do catálogo. Um lead pode aparecer em mais de um modelo; não somar essas contagens de leads. Lista de conferência limitada a 50 IDs por executivo; totais usam todos.

## Preservado
Demais guias e cálculos, correção de presença (presentes / todas as reuniões), exclusão de fins de semana no gráfico de show-up, remoções de Marketing e otimizações de desempenho.

## Validação
Testados deduplicação de respostas, resposta a template antigo, agenda sem template, card versus funil do Bot, card versus gráfico diário, equivalência de agendas/presenças entre Comercial e Agendas, filtro por executivo, navegação e largura móvel. Testes em Chrome com bases locais de referência; não representam auditoria ao vivo de todos os IDs do CRM. Nada foi publicado automaticamente.
