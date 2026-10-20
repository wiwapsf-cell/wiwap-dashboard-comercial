let botSelection=null;
function botNorm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function botSegment(x){
 const stage=botNorm(botValue(x.n,'[BOT] Etapa atual')),result=botNorm(botValue(x.n,'[BOT] Resultado do atendimento'));
 if(!stage)return 'unknown';
 if(/humano|contato solicitado/.test(stage+' '+result))return 'human';
 if(/encerrad|fora.*perfil|descart|nutri/.test(stage+' '+result))return 'closed';
 if(/reuniao confirmada|reuniao remarcada/.test(stage)||result==='agendado')return 'booked';
 if(/horario|confirmacao|agendamento/.test(stage))return 'booking';
 if(/qualifica|respondeu|mensagem recebida|conversa/.test(stage))return 'conversation';
 if(/cadastro recebido|contato entregue|aguardando entrega/.test(stage))return 'waiting';
 if(/retomada ativa/.test(stage))return 'active';
 return 'unknown';
}
const botSegments=[['waiting','Aguardando interação','Entrada registrada; sem avanço identificado'],['active','Em Retomada Ativa','Acompanhamento comercial em andamento'],['conversation','Em conversa / qualificação','Respondeu ou está na qualificação'],['booking','Escolha de horário / confirmação','Próximo passo de agendamento'],['booked','Reunião confirmada','Situação atual registrada'],['human','Com atendimento humano','Encaminhamento para a equipe'],['closed','Jornada encerrada','Encerramento ou fora de perfil'],['unknown','Sem dados suficientes','Não classificar como abandono']];
function botChoose(type,key){botSelection=type?{type,key}:null;renderBot();document.getElementById('bot-selection')?.scrollIntoView({behavior:'smooth',block:'center'});}
function botReached(x){
 const h=botNorm(botValue(x.n,'[BOT] Jornada do Bot')+' '+botValue(x.n,'[BOT] Etapa atual')+' '+botValue(x.n,'[BOT] Resultado do atendimento'));
 const booked=/reuniao confirmada|reuniao remarcada|agendado/.test(h);
 const offered=booked||/horarios apresentados|horario escolhido|aguardando confirmacao|horario selecionado/.test(h);
 const qualified=offered||/qualificacao concluida/.test(h);
 const answered=qualified||/mensagem recebida do lead|lead enviou mensagem ao bot|lead respondeu/.test(h);
 return [true,answered,qualified,offered,booked];
}
function botEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function botValue(row,k){return String(row?.[k]??'').trim();}
function botMetrics(records){
 const rows=records.map(r=>({r,n:novo(r.id_bitrix)}));
 const covered=rows.filter(x=>['[BOT] Jornada do Bot','[BOT] Origem da conversa','[BOT] Etapa atual','[BOT] Resultado do atendimento','[BOT] Retomadas'].some(k=>{const v=botNorm(botValue(x.n,k));return v&&!/^(sem registro|sem historico|nao informado|em andamento|0 retomada)/.test(v);}));
 const normalized=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const history=x=>normalized(botValue(x.n,'[BOT] Jornada do Bot'));
 const counts={covered:covered.length,total:rows.length,answered:covered.filter(x=>/mensagem recebida do lead|lead enviou mensagem ao bot/.test(history(x))).length,booked:covered.filter(x=>/reuniao confirmada|reuniao remarcada/.test(history(x))||botValue(x.n,'[BOT] Resultado do atendimento')==='Agendado').length,human:covered.filter(x=>/encaminhado para atendimento humano|lead respondeu a retomada ativa|atendimento humano iniciado/.test(history(x))||botValue(x.n,'[BOT] Resultado do atendimento')==='Encaminhado para humano').length};
 const follows=[['5 minutos',/retomada aceita pela meta: 5 minutos/],['30 minutos',/retomada aceita pela meta: 30 minutos/],['4h de conversa',/retomada aceita pela meta: 4 horas de conversa/],['2º template de cadastro',/retomada aceita pela meta: segundo template de cadastro/],['1º comercial',/retomada aceita pela meta: comercial — 1/],['2º comercial',/retomada aceita pela meta: comercial — 2/]].map(([name,regex])=>({name,count:covered.filter(x=>regex.test(history(x))).length}));
 return {rows,covered,counts,follows};
}
function renderBot(){
 if(!document.getElementById('bot-kpis'))return;
 const base=allRecords.filter(byHunter).filter(r=>inPeriod(r.criado_em));const m=botMetrics(base),c=m.counts;c.answered=m.covered.filter(x=>botReached(x)[1]).length;
 const schema=Object.values(novoMap).some(n=>Object.prototype.hasOwnProperty.call(n,'[BOT] Jornada do Bot'));
 document.getElementById('bot-coverage').textContent=!schema?'Aguardando a nova exportação da planilha com os campos do Bot. Os indicadores não estão disponíveis.':`${c.covered} de ${c.total} leads possuem dados da jornada. ${c.total-c.covered} sem histórico disponível; ausência de registro não significa ausência de interação.`;
 const cards=[['Leads no período',c.total],['Com jornada registrada',c.covered],['Com resposta ou avanço',c.answered],['Com reunião confirmada',c.booked],['Com encaminhamento humano',c.human]];
 document.getElementById('bot-kpis').innerHTML=cards.map(([name,v],i)=>`<div class="kc ${i>1?'tl':'nv'}"><div class="kl">${name}</div><div class="kv">${schema||i===0?v:'—'}</div><div class="ks">${i>1?'Dentro dos leads com jornada registrada':'Leads únicos'}</div></div>`).join('');
 document.getElementById('bot-followups').innerHTML=m.follows.map(x=>`<span class="bot-tag">${x.name}<b>${schema?x.count:'—'}</b></span>`).join('');
 const status={};for(const x of m.covered){const k=botValue(x.n,'[BOT] Etapa atual')||'Não informado';status[k]=(status[k]||0)+1;}
 document.getElementById('bot-status').innerHTML=Object.entries(status).map(([k,v])=>`<span class="bot-tag">${botEscape(k)} <b>${v}</b></span>`).join('')||'<p>Sem dados disponíveis.</p>';
 const steps=['Jornada registrada','Respondeu ao bot','Qualificação concluída','Horários / confirmação','Reunião confirmada'];
 const reached=steps.map((label,i)=>({label,count:m.covered.filter(x=>botReached(x)[i]).length}));
 document.getElementById('bot-funnel').innerHTML=reached.map((x,i)=>{const previous=i?reached[i-1].count:x.count,rate=previous?Math.round(x.count/previous*100):0;return `<button class="bot-funnel-step" onclick="botChoose('reach',${i})"><span class="bot-step-index">0${i+1}</span><span class="bot-step-body"><span>${x.label}</span><span class="bot-bar"><i style="width:${c.covered?x.count/c.covered*100:0}%"></i></span><small>${i?`${rate}% da etapa anterior · ${previous-x.count} sem registro deste avanço`:'Base com dados disponíveis'}</small></span><b>${x.count}</b></button>`;}).join('')+'<p class="ps">Etapas posteriores implicam as anteriores. Sem registro de avanço não significa abandono.</p>';
 document.getElementById('bot-stops').innerHTML=botSegments.map(([key,label,help])=>{const count=m.rows.filter(x=>botSegment(x)===key).length;return `<button class="bot-stop" onclick="botChoose('segment','${key}')"><span class="bot-dot ${key}"></span><span><strong>${label}</strong><small>${help}</small></span><b>${count}</b><em>${c.total?Math.round(count/c.total*100):0}%</em></button>`;}).join('');
 const selectionLabel=botSelection?(botSelection.type==='reach'?steps[botSelection.key]:botSegments.find(x=>x[0]===botSelection.key)?.[1]):'';
 document.getElementById('bot-selection').innerHTML=botSelection?`<div class="bot-note">Exibindo: <b>${botEscape(selectionLabel)}</b> <button class="bot-reset" onclick="botChoose(null)">Limpar filtro ×</button></div>`:'';
 const search=String(document.getElementById('bot-search')?.value||'').toLocaleLowerCase('pt-BR');
 const filtered=(botSelection||search?m.rows:m.covered).filter(x=>!botSelection||(botSelection.type==='reach'?m.covered.includes(x)&&botReached(x)[botSelection.key]:botSegment(x)===botSelection.key)).filter(({r})=>`${r.id_bitrix} ${r.nome_card||''}`.toLocaleLowerCase('pt-BR').includes(search));
 document.getElementById('bot-table').innerHTML=`<p class="ps">${filtered.length} leads encontrados. A busca também localiza cards sem histórico. Exibindo até 200.</p><table class="dt"><thead><tr><th>Lead / ID</th><th>Responsável</th><th>Origem</th><th>Etapa do bot</th><th>Resultado</th><th>Retomadas / pendência</th><th>Jornada</th></tr></thead><tbody>${filtered.slice(0,200).map(({r,n})=>`<tr><td>${botEscape(r.nome_card||'Sem nome')}<br><small>${botEscape(r.id_bitrix)}</small></td><td>${botEscape(r.responsavel)}</td><td>${botEscape(botValue(n,'[BOT] Origem da conversa')||'Sem registro')}</td><td>${botEscape(botValue(n,'[BOT] Etapa atual')||'Sem registro')}</td><td>${botEscape(botValue(n,'[BOT] Resultado do atendimento')||'Sem registro')}</td><td>${botEscape(botValue(n,'[BOT] Retomadas'))}<br>${botEscape(botValue(n,'[BOT] Pendência ou encaminhamento'))}</td><td><details><summary>Ver histórico</summary><pre>${botEscape(botValue(n,'[BOT] Jornada do Bot')||'Sem histórico disponível.')}</pre></details></td></tr>`).join('')}</tbody></table>`;
}
