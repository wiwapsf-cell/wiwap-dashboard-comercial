function renderMkt(){
  const base=flowRecords.filter(byHunter);
  // Leads de tráfego pago no período
  const leadsPagos=base.filter(r=>inPeriod(r.criado_em)&&/PB\d{2}|meta|google|facebook|instagram/i.test(r.fonte||''));
  const invTotal=metaRecords.filter(r=>inPeriod(r.dt_inicio)).reduce((s,r)=>s+r.valor,0);
  const pag=base.filter(r=>inPeriod(r.dt_pagamento)&&r.etapa==='Pagamento Recebido').length;
  const fatP=fatRecords.filter(r=>r.dt_pagamento&&inPeriod(r.dt_pagamento)&&!r.estorno&&matchFat(r,selectedHunter));
  const receita=fatP.reduce((s,r)=>s+r.valor,0);
  const cpl=leadsPagos.length>0?invTotal/leadsPagos.length:0;
  const cac=pag>0?invTotal/pag:0;
  const roas=invTotal>0?receita/invTotal:0;
  // Msgs API oficial (Abandono + CA S2)
  let msgsAb=0,msgsS2=0;
  for(const r of base){const n=novo(r.id_bitrix);if(nstr(n,'[Abandono] Template Enviado'))msgsAb++;if(nstr(n,'[CA-S2] Disparo Imediato'))msgsS2++;}
  setTxt('mk-cpl',cpl>0?fmtR(cpl):'—');
  setTxt('mk-cac',cac>0?fmtR(cac):'—');
  setTxt('mk-roas',roas>0?roas.toFixed(2).replace('.',',')+'×':'—');
  setTxt('mk-inv',fmtR(invTotal));
  setTxt('mk-msgs',fmt(msgsAb+msgsS2));
  setTxt('mk-msgs-s',`${msgsAb} Abandono · ${msgsS2} CA S2`);
  renderMktFonteTable();

  if(mktInited)return; mktInited=true;
  initMktCharts();
}

// Extrai o código de público [PB##] de qualquer string (fonte do lead OU nome da campanha
// na planilha de tráfego) — aceita "PB05", "PB-02", "PB07-B", "PB07" etc.
// IMPORTANTE: o sufixo de letra (ex: "-B" em PB07-B) é PRESERVADO e faz parte do código —
// confirmado que o Bitrix diferencia isso na fonte do lead ("[PB07]" vs "[PB07-B]" são
// campanhas/públicos DIFERENTES, não a mesma coisa). "PB07" e "PB07-B" nunca se misturam.
function extractPB(s){
  const m=String(s||'').match(/PB-?(\d{2})-?([A-Z])?/i);
  if(!m)return null;
  return m[2]?m[1]+'-'+m[2].toUpperCase():m[1];
}
// DE/PARA manual para campanhas que NÃO usam código [PB##] — usam nome de público livre,
// e às vezes esse nome vem escrito diferente na planilha de tráfego e na fonte do Bitrix
// (ex: "Retageing Site 180 dias" na campanha vs "Pixel Site 180 Dias" no Bitrix, mesmo
// público, grafias diferentes). Cada linha aqui é UM regex que casa as duas variações —
// adicione novas linhas conforme aparecerem outros casos assim.
const CAMPANHA_ALIAS=[
  {re:/retageing\s*site\s*180\s*dias|retargeting\s*site\s*180\s*dias|pixel\s*site\s*180\s*dias/i,key:'RETARGETING-SITE-180D'},
];
// Chave de casamento: tenta código PB## primeiro; se não achar, tenta os apelidos manuais
// acima; se nenhum dos dois bater, retorna null (sem gasto atribuído pra essa fonte)
function extractMatchKey(s){
  const pb=extractPB(s);
  if(pb)return'PB'+pb;
  const t=String(s||'');
  for(const a of CAMPANHA_ALIAS){ if(a.re.test(t))return a.key; }
  return null;
}
// Classifica o SUBTIPO de campanha (Formulário / LP Geral / LP de Agendamento) — usado
// para não misturar o gasto de campanhas diferentes que compartilham o mesmo código PB##.
// Funciona tanto no nome da campanha (planilha de tráfego) quanto na fonte do lead (Bitrix),
// reconhecendo as duas convenções de nomenclatura, com ou sem hífen/espaço (ex: "LP-GERAL",
// "LP Geral", "FORMS-INST", "Formulário").
function classifyTipoCampanha(s){
  const t=String(s||'');
  if(/LP[\s-]*de[\s-]*Agendamento/i.test(t))return'LP de Agendamento';
  if(/FORMS?-?INST/i.test(t)||/Formul[aá]rio/i.test(t))return'Formulário';
  if(/LP[\s-]*Geral/i.test(t))return'LP Geral';
  if(/\[LP\]/i.test(t))return'LP Geral';
  return null;
}

let mktFonteSort={key:'total',dir:'desc'};

function renderMktFonteTable(){
  const el=document.getElementById('mk-tbl-fontes');
  if(!el)return;
  const byH=flowRecords.filter(byHunter);
  // Cada coluna olha pro SEU PRÓPRIO campo de data — são 4 fatias independentes,
  // não uma coorte única. Um lead pode entrar em "Presença" hoje mesmo tendo sido
  // criado e agendado em dias diferentes.
  const baseLeads  = byH.filter(r=>inPeriod(r.criado_em));                                          // Criado no
  const baseAgend  = byH.filter(r=>inPeriod(r.dt_apresentacao));                                     // Data da Apresentação
  const basePres   = byH.filter(r=>inPeriod(parseDateBR(nstr(novo(r.id_bitrix),'[Show-up] Data entrada')))); // [Show-up] Data entrada
  const basePagos  = byH.filter(r=>r.etapa==='Pagamento Recebido'&&inPeriod(r.dt_pagamento));        // Data de pagamento

  if(!baseLeads.length&&!baseAgend.length&&!basePres.length&&!basePagos.length){
    el.innerHTML='<div style="padding:24px;text-align:center;color:#94a3b8;font-family:\'Plus Jakarta Sans\',sans-serif;font-size:12px">Sem leads no período</div>';
    return;
  }

  const fonteMap={};
  const bump=(r,field)=>{
    const f=(r.fonte||'Sem fonte').trim()||'Sem fonte';
    if(!fonteMap[f])fonteMap[f]={total:0,agend:0,presenca:0,conv:0};
    fonteMap[f][field]++;
  };
  baseLeads.forEach(r=>bump(r,'total'));
  baseAgend.forEach(r=>bump(r,'agend'));
  basePres.forEach(r=>bump(r,'presenca'));
  basePagos.forEach(r=>bump(r,'conv'));

  const ticket=getTicketMedioReal();
  const metaPeriodo=metaRecords.filter(r=>inPeriod(r.dt_inicio));

  // Maturidade da coorte: quantos dias já se passaram desde o FIM do período selecionado.
  // Um lote de leads muito recente ainda não teve tempo de completar o ciclo de vendas
  // (Leads → Agend. → Presença → Conversão), então o ROAS Coorte dele vai aparecer baixo
  // ou incompleto — isso não é o investimento "não performando", é só falta de tempo.
  const {end:periodoFim}=computeRange();
  const diasDesdeFim=Math.floor((new Date(maxDate+'T12:00:00')-new Date(periodoFim+'T12:00:00'))/86400000);
  const MATURIDADE_MIN=21; // dias — abaixo disso, avisamos que a coorte ainda está "verde"
  const coorteImatura=diasDesdeFim<MATURIDADE_MIN;

  const fontes=Object.keys(fonteMap);

  // Conversões por COORTE: dos leads CRIADOS no período (baseLeads), quantos já converteram
  // até HOJE — sem limite de data pra frente, dando tempo pro lote inteiro fechar o ciclo
  const coorteConvMap={};
  baseLeads.forEach(r=>{
    if(r.etapa!=='Pagamento Recebido')return;
    const f=(r.fonte||'Sem fonte').trim()||'Sem fonte';
    coorteConvMap[f]=(coorteConvMap[f]||0)+1;
  });

  let rows=fontes.map(f=>{
    const d=fonteMap[f];
    const pb=extractPB(f);
    const matchKey=extractMatchKey(f);
    const tipo=matchKey?classifyTipoCampanha(f):null;
    // Casa por chave (PB## ou apelido) + subtipo (Formulário/LP Geral/LP Agendamento) quando
    // dá pra identificar o subtipo dos dois lados; se não der, cai no casamento só pela chave
    // (evita zerar gasto por excesso de rigor)
    let gastoRecs;
    if(matchKey&&tipo){
      gastoRecs=metaPeriodo.filter(r=>extractMatchKey(r.campanha)===matchKey&&classifyTipoCampanha(r.campanha)===tipo);
    }else if(matchKey){
      gastoRecs=metaPeriodo.filter(r=>extractMatchKey(r.campanha)===matchKey);
    }else{
      gastoRecs=[];
    }
    const gasto=gastoRecs.reduce((s,r)=>s+r.valor,0);
    const receita=d.conv*ticket;
    const roas=gasto>0?receita/gasto:null;
    // ROAS Coorte: receita de quem NASCEU no período (não importa quando pagou) ÷ o
    // mesmo gasto do período (dinheiro que gerou esse lote de leads)
    const coorteConv=coorteConvMap[f]||0;
    const coorteReceita=coorteConv*ticket;
    const coorteRoas=gasto>0?coorteReceita/gasto:null;
    const taxaAgend=d.total>0?+(d.agend/d.total*100).toFixed(1):0;
    const taxaShow=d.agend>0?+(d.presenca/d.agend*100).toFixed(1):0;
    const taxaConv=d.total>0?+(d.conv/d.total*100).toFixed(1):0;
    return {fonte:f,pb,matchKey,tipo,...d,taxaAgend,taxaShow,taxaConv,gasto,receita,roas,coorteConv,coorteReceita,coorteRoas};
  });

  // Ordenação
  const {key,dir}=mktFonteSort;
  rows.sort((a,b)=>{
    let va=a[key], vb=b[key];
    if(va===null)va=-1; if(vb===null)vb=-1;
    if(typeof va==='string')return dir==='asc'?va.localeCompare(vb):vb.localeCompare(va);
    return dir==='asc'?va-vb:vb-va;
  });

  const pctFmt=(n)=>n>0||n===0?n.toFixed(1)+'%':'—';
  const cor=(n)=>{if(isNaN(n))return'#94a3b8';if(n>=50)return'#059669';if(n>=25)return'#d97706';return'#dc2626';};
  const corRoas=(r)=>{if(r===null)return'#94a3b8';if(r>=3)return'#059669';if(r>=1)return'#d97706';return'#dc2626';};

  const cols=[
    {key:'fonte',label:'Fonte / campanha',align:'left',sortable:false},
    {key:'total',label:'Leads',align:'right',sortable:true},
    {key:'agend',label:'Agend.',align:'right',sortable:true},
    {key:'taxaAgend',label:'Taxa agend.',align:'right',sortable:true},
    {key:'presenca',label:'Presença',align:'right',sortable:true},
    {key:'taxaShow',label:'Show-up %',align:'right',sortable:true},
    {key:'conv',label:'Conversões',align:'right',sortable:true},
    {key:'taxaConv',label:'Taxa conv.',align:'right',sortable:true},
    {key:'gasto',label:'Gasto tráfego',align:'right',sortable:true},
    {key:'receita',label:'Receita (est.)',align:'right',sortable:true},
    {key:'roas',label:'ROAS período',align:'right',sortable:true},
    {key:'coorteRoas',label:'ROAS coorte'+(coorteImatura?' ⏱':''),align:'right',sortable:true},
  ];

  const thHtml=cols.map(c=>{
    const arrow=mktFonteSort.key===c.key?(mktFonteSort.dir==='asc'?' ▲':' ▼'):'';
    const cursor=c.sortable?'cursor:pointer;user-select:none':'';
    return `<th data-key="${c.key}" data-sortable="${c.sortable}" style="padding:10px 14px;text-align:${c.align};font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px;${cursor}">${c.label}${arrow}</th>`;
  }).join('');

  el.innerHTML=`
    <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">${thHtml}</tr>
      </thead>
      <tbody>
        ${rows.map((d,idx)=>{
          return `
            <tr style="${idx%2===0?'':'background:#fafbfc'}">
              <td style="padding:10px 14px;font-weight:600;color:#1e2432;max-width:280px">${d.fonte}${d.matchKey?` <span style="font-weight:400;color:#94a3b8;font-size:10px">[${d.pb?'PB'+d.pb:'público identificado'}${d.tipo?' · '+d.tipo:''}]</span>`:''}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.total}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.agend}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${cor(d.taxaAgend)}">${pctFmt(d.taxaAgend)}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.presenca}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${cor(d.taxaShow)}">${pctFmt(d.taxaShow)}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.conv}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${cor(d.taxaConv)}">${pctFmt(d.taxaConv)}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.gasto>0?fmtR(d.gasto):'—'}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.receita>0?fmtR(d.receita):'—'}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${corRoas(d.roas)}">${d.roas!==null?d.roas.toFixed(2).replace('.',',')+'×':'—'}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${corRoas(d.coorteRoas)}" title="${d.coorteConv} conversão(ões) de leads nascidos no período, considerando até hoje">${d.coorteRoas!==null?d.coorteRoas.toFixed(2).replace('.',',')+'×':'—'}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  el.querySelectorAll('th[data-sortable="true"]').forEach(th=>{
    th.onclick=()=>{
      const k=th.dataset.key;
      if(mktFonteSort.key===k){mktFonteSort.dir=mktFonteSort.dir==='asc'?'desc':'asc';}
      else{mktFonteSort={key:k,dir:'desc'};}
      renderMktFonteTable();
    };
  });
}
function initMktCharts(){
  const base=flowRecords.filter(byHunter);
  // Impacto API oficial mks
  const viaAb=base.filter(r=>nstr(novo(r.id_bitrix),'[Abandono] Resposta Botão')==='Agendar Reunião'&&r.dt_apresentacao);
  const viaS2=base.filter(r=>nstr(novo(r.id_bitrix),'[CA-S2] Respondeu')==='Sim'&&r.dt_apresentacao);
  const totalApi=viaAb.length+viaS2.length;
  const converteram=[...viaAb,...viaS2].filter(r=>inPeriod(r.dt_pagamento)&&r.etapa==='Pagamento Recebido');
  const ticket=getTicketMedioReal();
  setTxt('mk-api-total',fmt(totalApi));
  setTxt('mk-api-ab',fmt(viaAb.length));
  setTxt('mk-api-s2',fmt(viaS2.length));
  setTxt('mk-api-conv',`${converteram.length} (${totalApi?Math.round(converteram.length/totalApi*100):0}%)`);
  setTxt('mk-api-rec',fmtR(converteram.length*ticket));
  // ch-mkt-api-tl (por dia, via Abandono / via CA S2)
  const dayMap={};
  for(const r of viaAb){const d=(r.dt_apresentacao||'').slice(0,10);if(d){if(!dayMap[d])dayMap[d]={ab:0,s2:0};dayMap[d].ab++;}}
  for(const r of viaS2){const d=(r.dt_apresentacao||'').slice(0,10);if(d){if(!dayMap[d])dayMap[d]={ab:0,s2:0};dayMap[d].s2++;}}
  const dias=Object.keys(dayMap).sort().slice(-14);
  const c0=ec('ch-mkt-api-tl');
  if(c0)c0.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:12,right:8,bottom:36,left:36},
    xAxis:{type:'category',data:dias.map(d=>d.slice(5).split('-').reverse().join('/')),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'Via Abandono',type:'bar',stack:'s',data:dias.map(d=>dayMap[d].ab),itemStyle:{color:TL}},{name:'Via CA S2',type:'bar',stack:'s',data:dias.map(d=>dayMap[d].s2),itemStyle:{color:NV,borderRadius:[4,4,0,0]},barMaxWidth:28}]
  });
  // Templates Abandono
  const tmplAb={};
  for(const r of base){const n=novo(r.id_bitrix);const t=nstr(n,'[Abandono] Template Enviado');if(!t)continue;if(!tmplAb[t])tmplAb[t]={env:0,ret:0};tmplAb[t].env++;if(nstr(n,'[Abandono] Resposta Botão')==='Agendar Reunião')tmplAb[t].ret++;}
  const abArr=Object.entries(tmplAb).sort((a,b)=>b[1].env-a[1].env).slice(0,6);
  const c1=ec('ch-mkt-tmpl-ab');
  if(c1)c1.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:9},itemHeight:8},
    grid:{top:16,right:44,bottom:48,left:8,containLabel:true},
    xAxis:{type:'category',data:abArr.map(t=>t[0].length>16?t[0].slice(0,14)+'…':t[0]),axisLabel:{...AX,fontSize:9,rotate:10}},
    yAxis:[{type:'value',name:'Disparos',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},{type:'value',name:'% Retorno',max:60,axisLabel:{...AX,fontSize:9,formatter:'{value}%'},splitLine:{show:false}}],
    series:[{name:'Disparos',type:'bar',data:abArr.map(t=>t[1].env),barMaxWidth:52,itemStyle:{color:TL,borderRadius:[4,4,0,0]},label:{show:true,position:'top',fontSize:10,fontFamily:F}},{name:'% Clicou Agendar',type:'line',yAxisIndex:1,data:abArr.map(t=>t[1].env>0?+(t[1].ret/t[1].env*100).toFixed(1):0),lineStyle:{color:GR,width:2},itemStyle:{color:GR},symbol:'circle',symbolSize:7,label:{show:true,position:'top',formatter:'{c}%',fontSize:9,fontFamily:F,color:GR}}]
  });
  // Templates CA S2
  const tmplCa={};
  for(const r of base){const n=novo(r.id_bitrix);const t=nstr(n,'[CA] Template Enviado');if(!t)continue;if(!tmplCa[t])tmplCa[t]={env:0,ret:0};tmplCa[t].env++;if(nstr(n,'[CA-S2] Respondeu')==='Sim')tmplCa[t].ret++;}
  const caArr=Object.entries(tmplCa).sort((a,b)=>b[1].env-a[1].env).slice(0,6);
  const c2=ec('ch-mkt-tmpl-ca');
  if(c2)c2.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:9},itemHeight:8},
    grid:{top:16,right:44,bottom:48,left:8,containLabel:true},
    xAxis:{type:'category',data:caArr.map(t=>t[0].length>16?t[0].slice(0,14)+'…':t[0]),axisLabel:{...AX,fontSize:9,rotate:10}},
    yAxis:[{type:'value',name:'Disparos',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},{type:'value',name:'% Respondeu',max:60,axisLabel:{...AX,fontSize:9,formatter:'{value}%'},splitLine:{show:false}}],
    series:[{name:'Disparos',type:'bar',data:caArr.map(t=>t[1].env),barMaxWidth:52,itemStyle:{color:NV,borderRadius:[4,4,0,0]},label:{show:true,position:'top',fontSize:10,fontFamily:F}},{name:'% Respondeu',type:'line',yAxisIndex:1,data:caArr.map(t=>t[1].env>0?+(t[1].ret/t[1].env*100).toFixed(1):0),lineStyle:{color:GR,width:2},itemStyle:{color:GR},symbol:'circle',symbolSize:7,label:{show:true,position:'top',formatter:'{c}%',fontSize:9,fontFamily:F,color:GR}}]
  });
  // Aquisição de leads (por dia criado_em)
  const leadDay={};
  for(const r of base.filter(r=>inPeriod(r.criado_em))){const d=r.criado_em;leadDay[d]=(leadDay[d]||0)+1;}
  const ldias=Object.keys(leadDay).sort();
  const c3=ec('ch-mkt-leads');
  if(c3)c3.setOption({
    tooltip:{trigger:'axis',...TP},grid:{top:8,right:8,bottom:28,left:36},
    xAxis:{type:'category',data:ldias.map(d=>d.slice(5).split('-').reverse().join('/')),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'Leads',type:'line',smooth:true,data:ldias.map(d=>leadDay[d]),lineStyle:{color:TL,width:2},itemStyle:{color:TL},symbol:'circle',symbolSize:4,areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(0,160,163,.22)'},{offset:1,color:'rgba(0,160,163,.02)'}]}}}]
  });
  // Gasto vs receita mensal (histórico)
  const gMonth={},rMonth={};
  for(const r of metaRecords){if(!r.dt_inicio)continue;const m=r.dt_inicio.slice(0,7);gMonth[m]=(gMonth[m]||0)+r.valor;}
  for(const r of fatRecords){if(!r.dt_pagamento||r.estorno)continue;const m=r.dt_pagamento.slice(0,7);rMonth[m]=(rMonth[m]||0)+r.valor;}
  const meses=[...new Set([...Object.keys(gMonth),...Object.keys(rMonth)])].sort().slice(-13);
  const mlabel=m=>{const[y,mo]=m.split('-');return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+mo-1]+'/'+y.slice(2);};
  const c5=ec('ch-mkt-gasto');
  if(c5)c5.setOption({
    tooltip:{trigger:'axis',valueFormatter:v=>fmtR(v),...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:12,right:52,bottom:36,left:52},
    xAxis:{type:'category',data:meses.map(mlabel),axisLabel:{...AX,fontSize:9,rotate:12}},
    yAxis:[{type:'value',name:'Gasto',axisLabel:{...AX,fontSize:9,formatter:v=>v>=1000?'R$'+Math.round(v/1000)+'k':'R$'+v},splitLine:{lineStyle:{color:'#f1f5f9'}}},{type:'value',name:'Receita',axisLabel:{...AX,fontSize:9,formatter:v=>v>=1000?'R$'+Math.round(v/1000)+'k':'R$'+v},splitLine:{show:false}}],
    series:[{name:'Gasto (tráfego)',type:'bar',data:meses.map(m=>gMonth[m]||0),barMaxWidth:28,itemStyle:{color:'#cbd5e1',borderRadius:[3,3,0,0]}},{name:'Receita (setups)',type:'line',yAxisIndex:1,smooth:true,data:meses.map(m=>rMonth[m]||0),lineStyle:{color:TL,width:2.5},itemStyle:{color:TL},symbol:'circle',symbolSize:5,areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(0,160,163,.15)'},{offset:1,color:'rgba(0,160,163,.01)'}]}}}]
  });
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
window.addEventListener('load',loadData);
window.addEventListener('resize',()=>document.querySelectorAll('[id^="ch-"]').forEach(e=>{const i=echarts.getInstanceByDom(e);if(i)i.resize();}));
