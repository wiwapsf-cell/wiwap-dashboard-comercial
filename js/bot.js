function botEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function botValue(row,k){return String(row?.[k]??'').trim();}
function botMetrics(records){
 const rows=records.map(r=>({r,n:novo(r.id_bitrix)}));
 const covered=rows.filter(x=>['[BOT] Jornada do Bot','[BOT] Origem da conversa','[BOT] Etapa atual','[BOT] Resultado do atendimento','[BOT] Retomadas','[BOT] Pendência ou encaminhamento'].some(k=>botValue(x.n,k)));
 const normalized=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const history=x=>normalized(botValue(x.n,'[BOT] Jornada do Bot'));
 const counts={covered:covered.length,total:rows.length,answered:covered.filter(x=>/mensagem recebida do lead|lead enviou mensagem ao bot/.test(history(x))).length,booked:covered.filter(x=>/reuniao confirmada|reuniao remarcada/.test(history(x))||botValue(x.n,'[BOT] Resultado do atendimento')==='Agendado').length,human:covered.filter(x=>/encaminhado para atendimento humano|lead respondeu a retomada ativa|atendimento humano iniciado/.test(history(x))||botValue(x.n,'[BOT] Resultado do atendimento')==='Encaminhado para humano').length};
 const follows=[['5 minutos',/retomada aceita pela meta: 5 minutos/],['30 minutos',/retomada aceita pela meta: 30 minutos/],['4h de conversa',/retomada aceita pela meta: 4 horas de conversa/],['2º template de cadastro',/retomada aceita pela meta: segundo template de cadastro/],['1º comercial',/retomada aceita pela meta: comercial — 1/],['2º comercial',/retomada aceita pela meta: comercial — 2/]].map(([name,regex])=>({name,count:covered.filter(x=>regex.test(history(x))).length}));
 return {rows,covered,counts,follows};
}
function renderBot(){
 if(!document.getElementById('bot-kpis'))return;
 const base=allRecords.filter(byHunter).filter(r=>inPeriod(r.criado_em));const m=botMetrics(base),c=m.counts;
 const schema=Object.values(novoMap).some(n=>Object.prototype.hasOwnProperty.call(n,'[BOT] Jornada do Bot'));
 document.getElementById('bot-coverage').textContent=!schema?'Aguardando a nova exportação da planilha com os campos do Bot. Os indicadores não estão disponíveis.':`${c.covered} de ${c.total} leads possuem dados da jornada. ${c.total-c.covered} sem histórico disponível; ausência de registro não significa ausência de interação.`;
 const cards=[['Leads no período',c.total],['Com jornada registrada',c.covered],['Com resposta registrada',c.answered],['Com reunião confirmada',c.booked],['Com encaminhamento humano',c.human]];
 document.getElementById('bot-kpis').innerHTML=cards.map(([name,v],i)=>`<div class="kc ${i>1?'tl':'nv'}"><div class="kl">${name}</div><div class="kv">${schema||i===0?v:'—'}</div><div class="ks">${i>1?'Dentro dos leads com jornada registrada':'Leads únicos'}</div></div>`).join('');
 document.getElementById('bot-followups').innerHTML=m.follows.map(x=>`<span class="bot-tag">${x.name}<b>${schema?x.count:'—'}</b></span>`).join('');
 const status={};for(const x of m.covered){const k=botValue(x.n,'[BOT] Etapa atual')||'Não informado';status[k]=(status[k]||0)+1;}
 document.getElementById('bot-status').innerHTML=Object.entries(status).map(([k,v])=>`<span class="bot-tag">${botEscape(k)} <b>${v}</b></span>`).join('')||'<p>Sem dados disponíveis.</p>';
 const search=String(document.getElementById('bot-search')?.value||'').toLocaleLowerCase('pt-BR');
 const filtered=m.rows.filter(({r})=>`${r.id_bitrix} ${r.nome_card||''}`.toLocaleLowerCase('pt-BR').includes(search));
 document.getElementById('bot-table').innerHTML=`<p class="ps">${filtered.length} leads encontrados. Exibindo até 200; use a busca para localizar um card.</p><table class="dt"><thead><tr><th>Lead / ID</th><th>Responsável</th><th>Origem</th><th>Etapa do bot</th><th>Resultado</th><th>Retomadas / pendência</th><th>Jornada</th></tr></thead><tbody>${filtered.slice(0,200).map(({r,n})=>`<tr><td>${botEscape(r.nome_card||'Sem nome')}<br><small>${botEscape(r.id_bitrix)}</small></td><td>${botEscape(r.responsavel)}</td><td>${botEscape(botValue(n,'[BOT] Origem da conversa')||'Sem registro')}</td><td>${botEscape(botValue(n,'[BOT] Etapa atual')||'Sem registro')}</td><td>${botEscape(botValue(n,'[BOT] Resultado do atendimento')||'Sem registro')}</td><td>${botEscape(botValue(n,'[BOT] Retomadas'))}<br>${botEscape(botValue(n,'[BOT] Pendência ou encaminhamento'))}</td><td><details><summary>Ver histórico</summary><pre>${botEscape(botValue(n,'[BOT] Jornada do Bot')||'Sem histórico disponível.')}</pre></details></td></tr>`).join('')}</tbody></table>`;
}
