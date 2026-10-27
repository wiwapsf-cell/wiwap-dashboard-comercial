// Somente a guia Comercial. Coorte: leads com retomada comercial aceita no período.
function commercialModel(e){
 const text=e.text;
 const attempt=/2[º°o]?\s*template|segund[oa]/.test(text)?2:/1[º°o]?\s*template|primeir[oa]/.test(text)?1:0;
 const model=Object.keys(templateCatalog).sort((a,b)=>b.length-a.length).find(k=>text.includes(k))||'';
 return {attempt,model,key:attempt+'|'+(model||text),label:attempt?attempt+'ª tentativa':'Tentativa não identificada'};
}
function commercialOpportunityRows(base){
 const end=computeRange().end,unique=new Map();
 for(const x of phaseRows(base.map(journey))){
  const id=String(x.r.id_bitrix||'');if(!id||unique.has(id))continue;
  const attempts=x.events.filter(e=>accepted(e)&&isCommercialEvent(e)&&inPeriod(e.date));
  if(!attempts.length)continue;
  const outcomes=[];
  for(const a of attempts){
   // Outra mensagem ativa inicia uma janela diferente de atribuição de resposta.
   const next=x.events.find(e=>accepted(e)&&e.time>a.time);
   const response=x.events.find(e=>reply(e)&&e.time>a.time&&e.date<=end&&(!next||e.time<next.time));
   outcomes.push({event:a,response,model:commercialModel(a)});
  }
  const first=attempts[0],created=x.r.dt_reuniao_agendada;
  const meeting=!!created&&created>=first.date&&created<=end;
  const date=x.r.dt_apresentacao;
  const present=!!date&&date>=first.date&&date<=end&&sdrShowup(x.r);
  unique.set(id,{...x,outcomes,responded:outcomes.some(a=>a.response),meeting,present,contact:x.r.etapa==='Contato Solicitado'});
 }
 return [...unique.values()];
}
function commercialStats(rows){return {reached:rows.length,sends:rows.reduce((s,x)=>s+x.outcomes.length,0),replies:rows.filter(x=>x.responded).length,contact:rows.filter(x=>x.contact).length,meetings:rows.filter(x=>x.meeting).length,present:rows.filter(x=>x.present).length};}
function commercialTemplates(rows){
 const groups=new Map();
 for(const x of rows)for(const a of x.outcomes){
  const m=a.model;let g=groups.get(m.key);
  if(!g){g={...m,sends:0,leads:new Set(),replies:new Set()};groups.set(m.key,g)}
  g.sends++;g.leads.add(String(x.r.id_bitrix));if(a.response)g.replies.add(String(x.r.id_bitrix));
 }
 if(!groups.size)return '<p class="ps">Sem retomadas comerciais registradas nesta seleção.</p>';
 return [...groups.values()].sort((a,b)=>a.attempt-b.attempt||a.model.localeCompare(b.model)).map(g=>{
  const friendly={retomada_01:'Retomar a conversa',abandono_pos_cadastro_template_1:'Convite para conhecer a solução',abandono_pos_cadastro_template_2:'Convite com benefícios do crediário'};
  const body=templateCatalog[g.model];
  return `<details class="co-model"><summary><span><b>${botEscape(g.label)}</b> · ${botEscape(friendly[g.model]||'Modelo não identificado')}</span><span>${g.leads.size} leads · ${g.replies.size} responderam</span></summary><div class="co-model-content"><p>${g.sends} envios aceitos · ${g.leads.size} leads únicos · ${g.replies.size} com resposta posterior</p><code>${botEscape(g.model||'Identificação não disponível no catálogo')}</code><div class="whatsapp-message">${body?botEscape(body).replace(/\\n|\n/g,'<br>'):'Texto não disponível no catálogo. Não foi inferido pelo nome da tentativa.'}</div><small>Texto do catálogo disponível; variáveis são preenchidas no envio. A 1ª/2ª tentativa vem do evento, não do nome técnico do modelo. Um lead pode receber mais de um modelo; não some os leads entre modelos.</small></div></details>`;
 }).join('');
}
function commercialExecutiveCard(name,rows){
 const m=commercialStats(rows),rate=m.reached?(100*m.replies/m.reached).toFixed(1)+'%':'—';
 const initials=name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('');
 const values=[['Em contato solicitado',m.contact,'Etapa atual'],['Reuniões agendadas',m.meetings,'Criação da agenda após a retomada'],['Presentes',m.present,'Reunião após a retomada']];
 const leads=rows.slice(0,50).map(x=>`<tr><td><a href="https://minastelecom.bitrix24.com.br/crm/lead/details/${encodeURIComponent(x.r.id_bitrix)}/" target="_blank" rel="noopener noreferrer">#${botEscape(x.r.id_bitrix)}</a></td><td>${x.responded?'Sim':'—'}</td><td>${x.contact?'Sim':'—'}</td><td>${x.meeting?'Sim':'—'}</td><td>${x.present?'Sim':'—'}</td></tr>`).join('');
 return `<article class="co-executive"><header><span class="co-avatar">${botEscape(initials)}</span><div><h3>${botEscape(name)}</h3><p>${m.reached} leads com retomada · ${m.sends} envios aceitos</p></div></header><div class="co-response"><div><span>Leads que responderam</span><strong>${m.replies}</strong></div><div><b>${rate}</b><small>dos leads com retomada</small></div></div><div class="co-outcomes">${values.map(([label,n,desc])=>`<div><strong>${n}</strong><span>${label}</span><small>${desc}</small></div>`).join('')}</div><details class="co-details"><summary>Mensagens enviadas e resultados <span>${new Set(rows.flatMap(x=>x.outcomes.map(a=>a.model.key))).size} combinações</span></summary>${commercialTemplates(rows)}</details><details class="co-details"><summary>Conferir os leads <span>${m.reached} IDs</span></summary><div class="co-audit"><p class="ps">Exibindo até 50 IDs; os indicadores consideram todos os leads da seleção.</p><table><thead><tr><th>Lead</th><th>Respondeu</th><th>Contato atual</th><th>Agendou</th><th>Presente</th></tr></thead><tbody>${leads||'<tr><td colspan="5">Sem leads nesta seleção.</td></tr>'}</tbody></table></div></details></article>`;
}
renderFunil=function(){
 const root=document.getElementById('commercial-opportunities');if(!root)return;
 const rows=commercialOpportunityRows(flowRecords.filter(byHunter)),m=commercialStats(rows);
 const names=new Set(selectedHunter?[selectedHunter]:HUNTERS_WHITELIST);
 for(const x of rows)names.add(canonHunter(x.r.responsavel)||'Sem responsável');
 const groups=[...names].map(name=>({name,rows:rows.filter(x=>(canonHunter(x.r.responsavel)||'Sem responsável')===name)}));
 root.innerHTML=`<div class="co-heading"><div><span class="co-eyebrow">RETOMADA ATIVA · COMERCIAL</span><h2>Oportunidades que chegaram ao time.</h2><p>Leads com template comercial aceito no período selecionado e seus avanços até o fim desse período.</p></div><span class="co-pill">${m.reached} leads únicos</span></div><div class="co-summary">${[['Leads que responderam',m.replies,'Após a retomada comercial'],['Em contato solicitado',m.contact,'Situação atual desses leads'],['Reuniões agendadas',m.meetings,'Criadas após a retomada'],['Presentes',m.present,'Presença registrada após a retomada']].map(([label,n,desc])=>`<div><span>${label}</span><strong>${n}</strong><small>${desc}</small></div>`).join('')}</div><div class="co-section-title"><h3>Oportunidades por executivo</h3><span>Responsável atual no CRM · leads únicos em cada indicador</span></div><div class="co-grid">${groups.map(g=>commercialExecutiveCard(g.name,g.rows)).join('')}</div><details class="co-method"><summary>Como interpretar esta visão</summary><p>Todos os indicadores partem dos mesmos ${m.reached} leads com retomada comercial aceita no período, mesmo que o cadastro seja anterior. Os grupos de resposta, contato, agenda e presença podem se sobrepor; não formam um funil sequencial.</p><p><b>Respostas:</b> pessoas únicas com mensagem do lead registrada na jornada após um envio comercial do período e antes da próxima mensagem ativa, até o fim do filtro. Os eventos não permitem contar todas as mensagens do WipMessage nem comprovam causalidade.</p><p><b>Contato solicitado:</b> etapa atual desses leads. Sem data de entrada disponível na base, não representa quantos passaram pela etapa no período.</p><p><b>Agendas:</b> primeira data de criação da agenda no CRM, entre o primeiro envio comercial do período e o fim do filtro. <b>Presenças:</b> reunião nessa mesma janela e entrada em Show-up na data da reunião. Datas do CRM sem hora só permitem associação por dia; não comprovam ordem dentro do mesmo dia. Uma presença pode pertencer a uma agenda criada antes do filtro.</p><p>Atribuição por responsável atual, não pelo executivo que atendia na época. Histórico incompleto pode subestimar respostas. Envios aceitos pela Meta não comprovam entrega ou leitura. A ausência de registro não comprova ausência de oportunidade.</p></details>`;
};
const commercialPreviousIntro=updatePageIntro;
updatePageIntro=function(id){commercialPreviousIntro(id);if(id==='com'){document.getElementById('page-title').textContent='Da retomada à oportunidade.';document.getElementById('page-subtitle').textContent='Respostas, contatos e reuniões em uma visão por executivo.';}};
