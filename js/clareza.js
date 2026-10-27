function phase(e){if(!accepted(e))return '';if(isCommercialEvent(e))return 'commercial';if(/segundo template de cadastro|segunda tentativa apos 4h/.test(e.text))return 'cadastro2';if(/mensagem ativa aceita pela meta/.test(e.text))return 'cadastro1';if(/30 minutos/.test(e.text))return '30';if(/5 minutos/.test(e.text))return '5';if(/4 horas de conversa|retomada aceita pela meta: 4h/.test(e.text))return '4h';return '';}
function phaseRows(rows){return rows.map(x=>{const seen={};return {...x,events:x.events.filter(e=>{const p=phase(e);if(!p)return true;if(seen[p]!==undefined&&e.time-seen[p]<60000)return false;seen[p]=e.time;return true;})};});}
function modelPreview(label,kind){let model=Object.keys(templateCatalog).find(k=>label.includes(k));let body=model?templateCatalog[model]:'';if(kind==='cadastro1'||kind==='cadastro2'){const sample=kind==='cadastro1'?'Olá, {{nome}}! Recebemos seu cadastro pelo formulário da Financeira Wiwap.\n\n*Para dar continuidade ao seu atendimento, qual é o segmento da sua loja?*':'Olá, {{nome}}! Recebemos seu cadastro na Financeira Wiwap.\n\nVocê informou que sua loja trabalha com {{segmento}} e possui {{tipo_de_loja}}. *Essas informações estão corretas?*';return '<details class="message-preview"><summary>Ver mensagens da fase</summary><div class="whatsapp-message">'+botEscape(sample)+'</div><small>Variante registrada na automação de cadastro. A mensagem pode variar conforme os dados do lead; o histórico do dashboard não identifica a variante de cada envio.</small>'+(kind==='cadastro2'?'<h4>Alternativa genérica</h4><div class="whatsapp-message">'+botEscape(templateCatalog.retomada_01)+'</div>':'')+'</details>';}return `<details class="message-preview"><summary>Ver mensagem</summary><div class="whatsapp-message">${botEscape(body||'Modelo não encontrado no catálogo disponível.').replace(/\n/g,'<br>')}</div><small>Texto do catálogo disponível em 18/10. Variáveis como {{nome}} são substituídas no envio.</small></details>`;}
function helpFor(kind,label){if(kind==='commercial')return /2º|segundo/.test(label)?'Segunda tentativa comercial da Retomada Ativa, quando o lead permanece elegível e sem resposta.':'Primeira tentativa comercial da Retomada Ativa. O nome técnico do modelo não determina o número da tentativa.';if(kind==='cadastro1')return 'Abertura ativa do cadastro sem conversa: após 5 minutos, se o lead ainda não iniciou conversa; respeita a janela configurada.';if(kind==='cadastro2')return 'Segunda tentativa do cadastro sem conversa, após pelo menos 4 horas da primeira e sem resposta; respeita a janela configurada.';return 'Retomada de uma conversa já iniciada com o Bot, após o intervalo indicado e sem nova resposta.';}
function phaseTable(rows,types){return '<table class="dt featured"><thead><tr><th>Envio / quando acontece</th><th>Disparos aceitos</th><th>Leads únicos</th><th>Responderam</th><th>Taxa resposta</th><th>Agendaram depois</th><th>Taxa agenda</th></tr></thead><tbody>'+types.map(([kind,label])=>{const marked=rows.map(x=>({...x,events:x.events.map(e=>({...e,text:phase(e)===kind?e.text+' __selected__':e.text}))}));const m=recovery(marked,/__selected__/),sent=rows.reduce((s,x)=>s+x.events.filter(e=>phase(e)===kind&&inPeriod(e.date)).length,0);return `<tr><td><b>${label}</b> <span class="help-tip" tabindex="0" title="${botEscape(helpFor(kind,label))}">ⓘ</span>${kind.startsWith('cadastro')?modelPreview(label,kind):''}</td><td>${sent}</td><td>${m.sent}</td><td>${m.answered}</td><td>${m.sent?(100*m.answered/m.sent).toFixed(1)+'%':'—'}</td><td>${m.scheduled}</td><td>${m.sent?(100*m.scheduled/m.sent).toFixed(1)+'%':'—'}</td></tr>`;}).join('')+'</tbody></table>';}
const previousTemplatePanel=templatePanel;templatePanel=function(rows,pattern){if(pattern.source.includes('cadastro'))return '';return previousTemplatePanel(rows,pattern).replaceAll('Abertura ou nova tentativa para cadastro sem conversa','Tentativa comercial da Retomada Ativa').replace(/<p class="ps">Identificação registrada[^<]*<\/p>/,'').replace(/<b>(comercial[^<]*)<\/b>/g,(match,label)=>match+' <span tabindex="0" class="help-tip" title="'+botEscape(helpFor('commercial',label))+'">ⓘ</span>'+modelPreview(label,'commercial'));};
const renderBotBeforeClarity=renderBot;renderBot=function(){renderBotBeforeClarity();const all=phaseRows(periodRows().map(journey));if(!Object.values(novoMap).some(n=>Object.prototype.hasOwnProperty.call(n,'[BOT] Jornada do Bot')))return;document.getElementById('bot-recovery').innerHTML='<h3>Retomadas de conversa · Bot</h3><p class="ps">Conversa já iniciada, seguida de silêncio. Tentativas de 5 minutos, 30 minutos e 4 horas.</p>'+phaseTable(all,[['5','Retomada de conversa · 5 minutos'],['30','Retomada de conversa · 30 minutos'],['4h','Retomada de conversa · 4 horas']])+'<div class="active-separator"><h3>Disparos ativos · cadastro sem conversa</h3><p class="ps">Primeiro contato iniciado pela Wiwap e segunda tentativa caso não haja resposta. O antigo card “67” era o volume de aberturas ativas aceitas no período, incluindo cadastros antigos.</p>'+phaseTable(all,[['cadastro1','Abertura ativa · cadastro sem conversa'],['cadastro2','Segunda tentativa · cadastro sem conversa (4h)']])+'</div><p class="ps">Os dois nomes históricos da segunda tentativa são agrupados. Registros do mesmo lead e fase com menos de 60 segundos são tratados como um evento; o histórico não fornece o ID da mensagem. Resposta e agenda são posteriores ao envio, antes da próxima tentativa.</p>';
 const funnel=document.getElementById('bot-funnel'),slices=[...funnel.querySelectorAll('.funnel-slice')].map(e=>({label:e.querySelector('span').textContent,n:Number(e.querySelector('strong').textContent)}));if(slices.length){document.getElementById('bot-daily').insertAdjacentHTML('beforeend','<section class="bottleneck-box"><h3>Onde concentrar a atenção</h3>'+slices.slice(1).map((x,i)=>`<div class="drop-row"><span>${botEscape(slices[i].label)} → ${botEscape(x.label)}</span><b>${slices[i].n-x.n}</b><small>sem registro do próximo avanço · ${slices[i].n?((slices[i].n-x.n)/slices[i].n*100).toFixed(1):0}%</small></div>`).join('')+'<p class="ps">Perdas de avanço observadas; podem incluir encerramentos, atendimento humano ou histórico incompleto.</p></section>');}};


// Cobertura da base do Bot: ausência de ID não é resultado zero.
(function protectBotCoverage(){
  const previousRenderBotWithCoverage = renderBot;
  function coverage(){
    const rows=flowRecords.filter(byHunter).filter(r=>inPeriod(criadoBRT(r)));
    const missing=rows.filter(r=>!Object.prototype.hasOwnProperty.call(novoMap,String(r.id_bitrix||'')));
    const parsed=rows.filter(r=>journey(r).events.length>0);
    return {total:rows.length,missing:missing.length,parsed:parsed.length};
  }
  renderBot=function(){
    previousRenderBotWithCoverage();
    const health=coverage(),insight=document.getElementById('bot-insight');
    const periodLabels=['Enviaram mensagem ao Bot','Receberam abertura ativa','Escolheram horário / agendaram','Confirmaram a agenda','Encaminhamento humano'];
    if(health.total && (health.missing>0 || health.parsed===0)){
      // A base não permite fechar o total dos indicadores desta coorte.
      const label=health.missing>0?'Aguardando sincronização completa':'Histórico insuficiente para apurar';
      document.getElementById('bot-kpis').innerHTML=metricCards([
        ['Leads criados',health.total,'Base principal · período selecionado'],
        ...periodLabels.map(name=>[name,'—',label]),
      ]);
      if(insight)insight.innerHTML='<b>'+(health.missing>0?'Dados do Bot incompletos nesta seleção':'Sem histórico datado suficiente')+'</b><br>'+
        (health.missing>0?health.missing+' de '+health.total+' leads criados ainda não possuem linha correspondente na base do Bot. ':'')+
        health.parsed+' de '+health.total+' têm eventos datados reconhecidos. Os indicadores desta coorte estão indisponíveis até haver cobertura suficiente; ausência de registro não comprova ausência de atendimento.';
      document.getElementById('bot-funnel').innerHTML='<p class="ps">Funil indisponível: faltam dados para avaliar o avanço dos leads desta seleção.</p>';
      // Estes blocos contam eventos no período em toda a base, incluindo leads antigos.
      for(const id of ['bot-daily','bot-recovery']){
        const el=document.getElementById(id);
        if(el)el.insertAdjacentHTML('afterbegin','<p class="ps" data-bot-health-notice="true"><b>Base parcial:</b> os números abaixo representam apenas eventos já sincronizados. A ausência de eventos não confirma total zero no período.</p>');
      }
    }else if(health.total===0){
      if(insight)insight.innerHTML='<b>Nenhum lead criado nesta seleção.</b><br>Os gráficos por data de evento podem incluir leads criados em outros períodos.';
      document.getElementById('bot-funnel').innerHTML='<p class="ps">Sem leads criados no período para montar o funil.</p>';
    }
  };
})();
