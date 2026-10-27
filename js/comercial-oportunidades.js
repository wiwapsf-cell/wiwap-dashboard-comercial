// Somente a guia Comercial. Coorte: leads com retomada comercial aceita no período.
function commercialModel(e){
 const text=e.text;
 const attempt=/2[º°o]?\s*template|segund[oa]/.test(text)?2:/1[º°o]?\s*template|primeir[oa]/.test(text)?1:0;
 const model=Object.keys(templateCatalog).sort((a,b)=>b.length-a.length).find(k=>text.includes(k))||'';
 return {attempt,model,key:attempt+'|'+(model||text),label:attempt?attempt+'ª tentativa':'Tentativa não identificada'};
}
function commercialOpportunityRows(base){
 const unique=new Map();
 for(const x of phaseRows(base.map(journey))){
  const id=String(x.r.id_bitrix||'');if(!id||unique.has(id))continue;
  const outcomes=[],responseAttempts=[];
  // A resposta tem a sua própria data, inclusive após um envio anterior ao filtro.
  const active=x.events.filter(accepted);
  for(let i=0;i<active.length;i++){
   const a=active[i];if(!isCommercialEvent(a))continue;
   const next=active[i+1];
   const response=x.events.find(e=>reply(e)&&e.time>a.time&&inPeriod(e.date)&&(!next||e.time<next.time));
   const item={event:a,response,model:commercialModel(a)};
   if(inPeriod(a.date))outcomes.push(item);
   if(response)responseAttempts.push(item);
  }
  const meeting=!!x.r.dt_reuniao_agendada&&inPeriod(x.r.dt_reuniao_agendada);
  const scheduled=!!x.r.dt_apresentacao&&inPeriod(x.r.dt_apresentacao);
  const present=scheduled&&sdrShowup(x.r);
  const contact=x.r.etapa==='Contato Solicitado';
  if(outcomes.length||responseAttempts.length||meeting||scheduled||present||contact)
   unique.set(id,{...x,outcomes,responseAttempts,responded:responseAttempts.length>0,meeting,scheduled,present,contact});
 }
 return [...unique.values()];
}
function commercialStats(rows){return {reached:rows.filter(x=>x.outcomes.length).length,sends:rows.reduce((s,x)=>s+x.outcomes.length,0),replies:rows.filter(x=>x.responded).length,contact:rows.filter(x=>x.contact).length,meetings:rows.filter(x=>x.meeting).length,scheduled:rows.filter(x=>x.scheduled).length,present:rows.filter(x=>x.present).length};}
function commercialTemplates(rows){
 const groups=new Map();
 for(const x of rows)for(const a of [...x.outcomes,...(x.responseAttempts||[]).filter(a=>!x.outcomes.includes(a))]){
  const m=a.model;let g=groups.get(m.key);
  if(!g){g={...m,sends:0,leads:new Set(),replies:new Set()};groups.set(m.key,g)}
  if(inPeriod(a.event.date)){g.sends++;g.leads.add(String(x.r.id_bitrix));}if(a.response)g.replies.add(String(x.r.id_bitrix));
 }
 if(!groups.size)return '<p class="ps">Sem retomadas comerciais registradas nesta seleção.</p>';
 return [...groups.values()].sort((a,b)=>a.attempt-b.attempt||a.model.localeCompare(b.model)).map(g=>{
  const friendly={retomada_01:'Retomar a conversa',abandono_pos_cadastro_template_1:'Convite para conhecer a solução',abandono_pos_cadastro_template_2:'Convite com benefícios do crediário'};
  const body=templateCatalog[g.model];
  return `<details class="co-model"><summary><span><b>${botEscape(g.label)}</b> · ${botEscape(friendly[g.model]||'Modelo não identificado')}</span><span>${g.leads.size} leads · ${g.replies.size} responderam</span></summary><div class="co-model-content"><p>${g.sends} envios aceitos no período · ${g.leads.size} leads alcançados · ${g.replies.size} responderam no período</p><code>${botEscape(g.model||'Identificação não disponível no catálogo')}</code><div class="whatsapp-message">${body?botEscape(body).replace(/\\n|\n/g,'<br>'):'Texto não disponível no catálogo. Não foi inferido pelo nome da tentativa.'}</div><small>Texto do catálogo disponível; variáveis são preenchidas no envio. A 1ª/2ª tentativa vem do evento, não do nome técnico do modelo. Respostas no período podem vir de envios anteriores ao filtro. Um lead pode receber mais de um modelo; não some os leads entre modelos.</small></div></details>`;
 }).join('');
}
function commercialExecutiveCard(name,rows){
 const m=commercialStats(rows);
 const initials=name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('');
 const values=[['Reuniões previstas',m.scheduled,'Data da reunião no período'],['Presentes',m.present,'Presença registrada na reunião'],['Agendamentos gerados',m.meetings,'Data de criação da agenda'],['Em contato solicitado',m.contact,'Etapa atual'],['Templates enviados',m.sends,'Retomada Ativa · aceitos'],['Leads que responderam',m.replies,'Resposta registrada no período']];
 const leads=rows.slice(0,50).map(x=>`<tr><td><a href="https://minastelecom.bitrix24.com.br/crm/lead/details/${encodeURIComponent(x.r.id_bitrix)}/" target="_blank" rel="noopener noreferrer">#${botEscape(x.r.id_bitrix)}</a></td><td>${x.responded?'Sim':'—'}</td><td>${x.contact?'Sim':'—'}</td><td>${x.meeting?'Sim':'—'}</td><td>${x.scheduled?'Sim':'—'}</td><td>${x.present?'Sim':'—'}</td></tr>`).join('');
 return `<article class="co-executive"><header><span class="co-avatar">${botEscape(initials)}</span><div><h3>${botEscape(name)}</h3><p>${m.reached} leads com retomada · ${m.sends} envios aceitos</p></div></header><div class="co-outcomes">${values.map(([label,n,desc])=>`<div><strong>${n}</strong><span>${label}</span><small>${desc}</small></div>`).join('')}</div><details class="co-details"><summary>Mensagens enviadas e resultados <span>${new Set(rows.flatMap(x=>[...x.outcomes,...(x.responseAttempts||[])].map(a=>a.model.key))).size} combinações</span></summary>${commercialTemplates(rows)}</details><details class="co-details"><summary>Conferir os leads <span>${rows.length} IDs</span></summary><div class="co-audit"><p class="ps">Exibindo até 50 IDs; os indicadores consideram todos os leads da seleção.</p><table><thead><tr><th>Lead</th><th>Respondeu</th><th>Contato atual</th><th>Agenda criada</th><th>Reunião prevista</th><th>Presente</th></tr></thead><tbody>${leads||'<tr><td colspan="6">Sem leads nesta seleção.</td></tr>'}</tbody></table></div></details></article>`;
}
renderFunil=function(){
 const root=document.getElementById('commercial-opportunities');if(!root)return;
 const rows=commercialOpportunityRows(flowRecords.filter(byHunter)),m=commercialStats(rows);
 const activeExecutives=HUNTERS_WHITELIST.filter(name=>botNorm(name)!=='elizabete soares');
 const names=new Set(activeExecutives.filter(name=>!selectedHunter||canonHunter(name)===canonHunter(selectedHunter)));
 const groups=[...names].map(name=>({name,rows:rows.filter(x=>(canonHunter(x.r.responsavel)||'Sem responsável')===name)}));
 root.innerHTML=`<div class="co-heading"><div><span class="co-eyebrow">GESTÃO DA OPERAÇÃO · COMERCIAL</span><h2>Agenda e produtividade da equipe.</h2><p>Reuniões previstas pela data da reunião; agendamentos gerados pela data de criação da agenda. Todas as origens.</p></div><span class="co-pill">${m.reached} leads com envio</span></div><div class="co-summary">${[['Reuniões previstas',m.scheduled,'Data da reunião · todas as origens'],['Presentes',m.present,'Data da reunião · todas as origens'],['Agendamentos gerados',m.meetings,'Data de criação da agenda'],['Templates enviados',m.sends,'Retomada Ativa · aceitos no período'],['Leads que responderam',m.replies,'Resposta no período após retomada'],['Em contato solicitado',m.contact,'Etapa atual · todas as origens']].map(([label,n,desc])=>`<div><span>${label}</span><strong>${n}</strong><small>${desc}</small></div>`).join('')}</div><div class="co-section-title"><h3>Operação por executivo</h3><span>Responsável atual no CRM · leads únicos em cada indicador</span></div><div class="co-grid">${groups.map(g=>commercialExecutiveCard(g.name,g.rows)).join('')||'<p class="ps">Nenhum executivo ativo exibido para este filtro.</p>'}</div><p class="ps co-scope">O resumo geral considera toda a base do filtro, como a guia Agendas. Os cartões mostram apenas os executivos ativos; os totais gerais podem incluir registros fora desses cartões.</p><details class="co-method"><summary>Como interpretar esta visão</summary><p><b>Templates enviados:</b> eventos comerciais aceitos no período; <b>leads alcançados:</b> pessoas únicas com esses envios. Aceitação pela Meta não comprova entrega ou leitura.</p><p><b>Respostas:</b> pessoas únicas com mensagem do lead na jornada dentro do período, após uma retomada comercial e antes da próxima mensagem ativa. Inclui respostas a envios anteriores ao filtro, por isso não é uma taxa de resposta dos envios do período. A jornada não equivale à consulta direta de todas as mensagens do WipMessage.</p><p><b>Reuniões previstas:</b> data da reunião dentro do filtro, incluindo remarcações, como o card Reuniões previstas da guia Agendas. <b>Agendamentos gerados:</b> todos os leads com primeira criação de agenda no CRM no período, independentemente de template ou origem. Mesma regra do card Agendamentos gerados da guia Agendas. <b>Presentes:</b> reunião no período com Show-up registrado na mesma data, de qualquer origem, mesmo que a agenda tenha sido criada antes do filtro.</p><p><b>Contato solicitado:</b> etapa atual de todos os leads do executivo; sem filtro histórico de entrada, porque essa data não está disponível. Responsável atual no CRM em todos os indicadores. Os grupos podem se sobrepor e não formam um funil.</p><p>Histórico incompleto pode subestimar envios e respostas. Ausência de registro não comprova ausência de atendimento.</p></details>`;
};
const commercialPreviousIntro=updatePageIntro;
updatePageIntro=function(id){commercialPreviousIntro(id);if(id==='com'){document.getElementById('page-title').textContent='A operação comercial, em uma visão.';document.getElementById('page-subtitle').textContent='Agenda prevista, presença e produtividade por executivo.';}};
