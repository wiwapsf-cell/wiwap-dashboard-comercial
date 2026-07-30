// ===== CARREGAMENTO =====
function parseCsvPromise(url){
  return new Promise((resolve,reject)=>{
    const full=url+(url.includes('?')?'&':'?')+'t='+Date.now();
    Papa.parse(full,{download:true,header:true,skipEmptyLines:true,complete:r=>resolve(r),error:e=>reject(e)});
  });
}
function loadData(){
  const safe=u=>parseCsvPromise(u).catch(e=>{console.warn('CSV opcional falhou:',u,e);return{data:[]};});
  Promise.all([parseCsvPromise(CSV_URL),safe(CSV_FAT),safe(CSV_META),safe(CSV_NOVO)])
  .then(([bx,ft,mt,nv])=>{
    if(!bx.data||!bx.data.length)throw new Error('Planilha Bitrix vazia');
    resolveColumns(bx.data);
    allRecords=bx.data.map(processRow).filter(r=>r.criado_em);
    flowRecords=allRecords.filter(r=>r.etapa!==OUTROS_SEGMENTOS);
    outrosRecords=allRecords.filter(r=>r.etapa===OUTROS_SEGMENTOS);
    for(const r of allRecords)for(const f of DATE_FIELDS)if(r[f]&&r[f]>maxDate)maxDate=r[f];
    const hoje=new Date().toISOString().slice(0,10); if(maxDate>hoje)maxDate=hoje;
    try{fatRecords=(ft.data||[]).map(processFatRow).filter(r=>r.dt_pagamento&&r.valor>0);for(const r of fatRecords)if(r.dt_pagamento>maxDate&&r.dt_pagamento<=hoje)maxDate=r.dt_pagamento;}catch(e){fatRecords=[];}
    try{metaRecords=(mt.data||[]).map(processMetaRow).filter(r=>r.dt_inicio);}catch(e){metaRecords=[];}
    try{ novoMap={}; for(const row of (nv.data||[])){const id=String(row['ID Bitrix']||'').trim();if(id)novoMap[id]=row;} }catch(e){novoMap={};}
    setTxt('upd','Atualizado em '+maxDate.split('-').reverse().join('/'));
    initHeader();
    renderAll();
  })
  .catch(e=>{console.error(e);setTxt('upd','Erro ao carregar');});
}

// ══════════════════════════════════════════════════════════════
// HEADER + TABS
// ══════════════════════════════════════════════════════════════
function initHeader(){
  document.querySelectorAll('#chips .chip').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('#chips .chip').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      periodState={type:'preset',preset:btn.dataset.p};
      const ds=document.getElementById('dt-start'),de=document.getElementById('dt-end');
      if(ds)ds.value='';if(de)de.value='';
      renderAll();
    };
  });
  const ok=document.getElementById('dt-ok');
  if(ok)ok.onclick=()=>{
    const s=document.getElementById('dt-start').value,e=document.getElementById('dt-end').value;
    if(s&&e){periodState={type:'custom',start:s,end:e};document.querySelectorAll('#chips .chip').forEach(b=>b.classList.remove('on'));renderAll();}
  };
  const hs=document.getElementById('hunter-sel');
  if(hs)hs.onchange=()=>{selectedHunter=hs.value;mktInited=false;renderAll();};
}
function tab(id,el){
  document.querySelectorAll('.tb').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('pane-'+id).classList.add('on');
  activeTab=id;
  if(id==='mkt'){renderMkt();}
  setTimeout(resizeVisible,60);
}

// filtro de hunter aplicado aos records de fluxo
const byHunter=r=>!selectedHunter||r.hunter===selectedHunter;
const novo=id=>novoMap[String(id)]||{};
const nstr=(r,k)=>(r[k]||'').trim();
// registros de uma etapa filtrados pela data DA PRÓPRIA etapa
function stageRecs(dateField){
  return flowRecords.filter(r=>{
    if(!byHunter(r))return false;
    const raw=nstr(novo(r.id_bitrix),dateField);
    const d=parseDateBR(raw);
    return d&&inPeriod(d);
  });
}
function cnt(arr,field,val){return arr.filter(r=>nstr(novo(r.id_bitrix),field)===val).length;}

// Normaliza valores do campo "Horário de Agenda" do Bitrix
function normalizeHorario(raw){
  const v=(raw||'').trim();
  if(!v||v==='não selecionada')return null;
  if(v.includes('11h')||v.startsWith('Opção 1'))return 'Às 11h';
  if(v.includes('15h')||v.startsWith('Opção 2'))return 'Às 15h';
  return 'Outro Horário';
}

// Ligações: considerar apenas leads criados a partir do alinhamento comercial (23/07/2026)
const LIGACAO_CUTOFF='2026-07-23';
const ligCutoff=r=>r.criado_em>=LIGACAO_CUTOFF;

// ══════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ══════════════════════════════════════════════════════════════
function renderAll(){
  renderKPIs();
  renderFunil();
  renderStage1();
  renderStage2();
  renderStage3();
  renderStage4();
  renderStage5();
  renderStage6();
  renderStage7();
  renderRankings();
  renderImpacto();
  renderAcomp();
  if(activeTab==='mkt'){mktInited=false;renderMkt();}
  setTimeout(resizeVisible,80);
}

// ══════════════════════════════════════════════════════════════
// KPIs COMERCIAL
// ══════════════════════════════════════════════════════════════
function renderKPIs(){
  const base=flowRecords.filter(byHunter);
  const leads=base.filter(r=>inPeriod(r.criado_em)).length;

  const agRecs=base.filter(r=>inPeriod(r.dt_apresentacao));
  const ag=agRecs.length;

  const realRecs=agRecs.filter(r=>nstr(novo(r.id_bitrix),'[Show-up] Data entrada'));
  const real=realRecs.length;

  const noshow=ag-real;
  const showRate=ag>0?real/ag:NaN;
  const noshowRate=ag>0?noshow/ag:NaN;

  const pag=base.filter(r=>inPeriod(r.dt_pagamento)&&r.etapa==='Pagamento Recebido').length;
  const conv=leads>0?pag/leads:NaN;

  // Ligações — filtradas por criado_em no período + cutoff 23/07
  const baseP=base.filter(r=>inPeriod(r.criado_em)&&ligCutoff(r));
  const ligFields=['[CA-S1] Resultado Ligação','[CA-S2] Resultado Ligação','[CA-S3] Resultado Ligação','[Show-up] Resultado Ligação','[NG] Resultado Ligação'];
  let ligPend=0,ligReal=0,ligAt=0;
  for(const r of baseP){
    const n=novo(r.id_bitrix);
    if(nstr(n,'[Geral] Ligação Pendente')==='Pendente')ligPend++;
    const results=ligFields.map(f=>nstr(n,f)).filter(v=>['Atendeu','Não atendeu','Caixa Postal'].includes(v));
    if(results.length)ligReal++;
    if(results.includes('Atendeu'))ligAt++;
  }
  const taxaAtend=ligReal>0?ligAt/ligReal:NaN;

  setTxt('k-leads',fmt(leads));
  setTxt('k-leads-s',selectedHunter?`Atribuídos a ${selectedHunter.split(' ')[0]}`:'Sem outros segmentos');
  setTxt('k-ag',fmt(ag));
  setTxt('k-ag-s',leads>0?`${fmtPct(ag/leads)} dos leads`:'—');
  setTxt('k-real',fmt(real));
  setTxt('k-real-s','Leads que entraram em Show-up');
  setTxt('k-show',fmtPct(showRate));
  setTxt('k-show-s',`${real} de ${ag} agendadas`);
  setTxt('k-noshow',fmtPct(noshowRate));
  setTxt('k-noshow-s',`${noshow} não compareceram`);
  setTxt('k-ligpend',fmt(ligPend));
  setTxt('k-ligreal',fmt(ligReal));
  setTxt('k-ligreal-s',isFinite(taxaAtend)?`${fmtPct(taxaAtend)} taxa de atendimento`:'—');
  setTxt('k-pag',fmt(pag));
  setTxt('k-conv',fmtPct(conv));
}

// ══════════════════════════════════════════════════════════════
// FUNIL
// ══════════════════════════════════════════════════════════════
function renderFunil(){
  const base=flowRecords.filter(byHunter);
  const leads=base.filter(r=>inPeriod(r.criado_em)).length;
  const ag=base.filter(r=>inPeriod(r.dt_apresentacao)).length;
  const real=base.filter(r=>inPeriod(r.dt_apresentacao)&&nstr(novo(r.id_bitrix),'[Show-up] Data entrada')).length;
  const pag=base.filter(r=>inPeriod(r.dt_pagamento)&&r.etapa==='Pagamento Recebido').length;
  const chart=ec('ch-funil'); if(!chart)return;
  const denom=leads||1;
  chart.setOption({
    tooltip:{trigger:'item',formatter:p=>`${p.name}<br/><b>${p.value}</b> (${(p.value/denom*100).toFixed(1)}%)`,...TP},
    series:[{type:'funnel',left:'15%',right:'15%',top:14,bottom:14,min:0,max:denom,minSize:'28%',maxSize:'100%',sort:'descending',gap:4,
      data:[{value:leads,name:'Leads recebidos',itemStyle:{color:TL}},{value:ag,name:'Agendadas',itemStyle:{color:'#008f92'}},{value:real,name:'Realizadas',itemStyle:{color:NV}},{value:pag,name:'Pagamento',itemStyle:{color:'#002040'}}],
      label:{show:true,position:'inside',color:'#fff',fontFamily:F,fontWeight:700,formatter:p=>`${p.name}\n${p.value}  ${(p.value/denom*100).toFixed(1)}%`,fontSize:12}}]
  });
}

// ══════════════════════════════════════════════════════════════
// STAGE 1 — NOVOS LEADS
// ══════════════════════════════════════════════════════════════
function renderStage1(){
  const base=flowRecords.filter(byHunter);
  const recebidos=base.filter(r=>inPeriod(r.criado_em));
  const agend=recebidos.filter(r=>r.dt_apresentacao);
  const aband=recebidos.filter(r=>{const n=novo(r.id_bitrix);return nstr(n,'[Abandono] Data entrada')&&!r.dt_apresentacao;});
  setTxt('s1-total',fmt(recebidos.length));
  setTxt('s1-agend',`${agend.length} (${fmtPct(recebidos.length?agend.length/recebidos.length:0)})`);
  setTxt('s1-aband',`${aband.length} (${fmtPct(recebidos.length?aband.length/recebidos.length:0)})`);

  const{start,end}=computeRange();
  const dayMap={};
  for(let d=new Date(start+'T12:00:00');d.toISOString().slice(0,10)<=end;d.setDate(d.getDate()+1)){
    const k=d.toISOString().slice(0,10);
    dayMap[k]={rec:0,ag:0,agTot:0,noshow:0};
  }
  for(const r of recebidos){
    if(dayMap[r.criado_em])dayMap[r.criado_em].rec++;
  }
  for(const r of base.filter(r=>r.dt_apresentacao&&inPeriod(r.dt_apresentacao))){
    if(!dayMap[r.dt_apresentacao])continue;
    dayMap[r.dt_apresentacao].agTot++;
    if(r.dt_apresentacao)dayMap[r.dt_apresentacao].ag++;
    const compareceu=nstr(novo(r.id_bitrix),'[Show-up] Data entrada');
    if(!compareceu)dayMap[r.dt_apresentacao].noshow++;
  }
  const dias=Object.keys(dayMap).sort();
  const recArr=dias.map(d=>dayMap[d].rec);
  const agArr=dias.map(d=>dayMap[d].ag);
  const nsArr=dias.map(d=>dayMap[d].agTot>0?+(dayMap[d].noshow/dayMap[d].agTot*100).toFixed(1):null);
  const labels=dias.map(d=>d.slice(5).split('-').reverse().join('/'));

  const chart=ec('ch-novos'); if(!chart)return;
  chart.setOption({
    tooltip:{trigger:'axis',...TP},
    legend:{bottom:28,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    dataZoom:[
      {type:'slider',bottom:0,height:18,start:Math.max(0,100-Math.round(21/dias.length*100)),end:100,
       borderColor:'#e2e8f0',fillerColor:'rgba(0,160,163,0.1)',handleStyle:{color:TL}},
      {type:'inside'}
    ],
    grid:{top:16,right:44,bottom:72,left:36},
    xAxis:{type:'category',data:labels,axisLabel:{...AX,fontSize:9,rotate:dias.length>20?30:0}},
    yAxis:[
      {type:'value',axisLabel:{...AX},splitLine:{lineStyle:{color:'#f1f5f9'}}},
      {type:'value',max:100,axisLabel:{...AX,formatter:'{value}%'},splitLine:{show:false}}
    ],
    series:[
      {name:'Recebidos',type:'bar',barGap:'8%',data:recArr,itemStyle:{color:TL2,borderRadius:[3,3,0,0]},barMaxWidth:20},
      {name:'Agendados',type:'bar',data:agArr,itemStyle:{color:NV,borderRadius:[3,3,0,0]},barMaxWidth:20},
      {name:'No-show %',type:'line',yAxisIndex:1,smooth:true,connectNulls:false,data:nsArr,
       lineStyle:{color:RD,width:2},itemStyle:{color:RD},symbol:'circle',symbolSize:5},
    ]
  });
}

// ══════════════════════════════════════════════════════════════
// STAGE 2 — ABANDONO PÓS CADASTRO
// ══════════════════════════════════════════════════════════════
function renderStage2(){
  const recs=stageRecs('[Abandono] Data entrada');
  const templ=recs.filter(r=>nstr(novo(r.id_bitrix),'[Abandono] Template Enviado'));
  const agendar=recs.filter(r=>nstr(novo(r.id_bitrix),'[Abandono] Resposta Botão')==='Agendar Reunião');
  const semint=recs.filter(r=>nstr(novo(r.id_bitrix),'[Abandono] Resposta Botão')==='Não tenho interesse');
  const virou=agendar.filter(r=>r.dt_apresentacao);
  const silencio=recs.filter(r=>{const rb=nstr(novo(r.id_bitrix),'[Abandono] Resposta Botão');return !rb;});
  setTxt('s2-templ',fmt(templ.length));
  setTxt('s2-agendar',`${agendar.length} (${templ.length?Math.round(agendar.length/templ.length*100):0}%)`);
  setTxt('s2-virou',`${virou.length} (${agendar.length?Math.round(virou.length/agendar.length*100):0}%)`);
  setTxt('s2-semint',`${semint.length} (${templ.length?Math.round(semint.length/templ.length*100):0}%)`);
  setTxt('s2-silencio',`${silencio.length} (${recs.length?Math.round(silencio.length/recs.length*100):0}%)`);
  const pie=ec('ch-ab-pie');
  if(pie)pie.setOption({
    title:{text:'Split da resposta',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    tooltip:{trigger:'item',formatter:'{b}: {c} ({d}%)',...TP},legend:{bottom:2,textStyle:{fontFamily:F,fontSize:10},itemHeight:9},
    series:[{type:'pie',radius:['40%','68%'],center:['50%','46%'],data:[{value:agendar.length,name:'Clicou "Agendar"',itemStyle:{color:GR}},{value:semint.length,name:'Sem interesse',itemStyle:{color:RD}},{value:silencio.length,name:'Silêncio → CA',itemStyle:{color:GY}}],label:{formatter:'{d}%',fontSize:11,fontFamily:F}}]
  });
  const byDay={};
  for(const r of recs){const n=novo(r.id_bitrix);const t=nstr(n,'[Abandono] Template Enviado');if(!t)continue;const d=nstr(n,'[Abandono] Data entrada').slice(0,10);if(!d)continue;if(!byDay[d])byDay[d]={env:0,ag:0};byDay[d].env++;if(nstr(n,'[Abandono] Resposta Botão')==='Agendar Reunião')byDay[d].ag++;}
  const dias=Object.keys(byDay).sort().slice(-14);
  const tl=ec('ch-ab-tl');
  if(tl)tl.setOption({
    title:{text:'Disparos por dia',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    grid:{top:28,right:8,bottom:30,left:32},tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:9},itemHeight:8},
    xAxis:{type:'category',data:dias.map(d=>d.slice(5).split('-').reverse().join('/')),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'Enviados',type:'bar',data:dias.map(d=>byDay[d].env),itemStyle:{color:TL,borderRadius:[3,3,0,0]},barMaxWidth:14},{name:'"Agendar"',type:'bar',data:dias.map(d=>byDay[d].ag),itemStyle:{color:GR,borderRadius:[3,3,0,0]},barMaxWidth:14}]
  });
}

// ══════════════════════════════════════════════════════════════
// LIGCHART
// ══════════════════════════════════════════════════════════════
function ligChart(id,label,a,na,cx,pend){
  const tot=a+na+cx+(pend||0);
  const chart=ec(id); if(!chart)return;
  const mkSeries=(name,val,color,round)=>({name,type:'bar',stack:'s',data:[val],itemStyle:{color,...(round?{borderRadius:[0,4,4,0]}:{})},label:{show:true,position:'inside',formatter:p=>p.value>0?`${(p.value/tot*100||0).toFixed(0)}%`:'',color:'#fff',fontSize:9,fontFamily:F}});
  const series=[mkSeries('Atendeu',a,GR),mkSeries('Não atendeu',na,OR),mkSeries('Caixa postal',cx,GY)];
  if(pend!==undefined)series.push(mkSeries('Pendente',pend,AM,true));
  chart.setOption({
    tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:params=>{const t=params.reduce((s,p)=>s+p.value,0)||1;return params.map(p=>`${p.marker}${p.seriesName}: <b>${p.value}</b> (${(p.value/t*100).toFixed(0)}%)`).join('<br/>');},...TP},
    legend:{bottom:0,textStyle:{fontFamily:F,fontSize:9},itemHeight:7},
    grid:{top:8,right:4,bottom:32,left:4,containLabel:true},
    xAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    yAxis:{type:'category',data:[label],axisLabel:{...AX,fontSize:9}},
    series
  });
}

// ══════════════════════════════════════════════════════════════
// STAGE 3 — CONTATO ATIVO HUNTER (S1/S2/S3)
// ══════════════════════════════════════════════════════════════
function renderStage3(){
  const s1=stageRecs('[CA-S1] Disparo Imediato');
  const s1nut=s1.filter(r=>r.etapa==='Nutrição').length;
  setTxt('ca-s1-disp',fmt(s1.length));
  setTxt('ca-s1-nut',fmt(s1nut));
  ligChart('ch-s1','CA S1',cnt(s1,'[CA-S1] Resultado Ligação','Atendeu'),cnt(s1,'[CA-S1] Resultado Ligação','Não atendeu'),cnt(s1,'[CA-S1] Resultado Ligação','Caixa Postal'),undefined);
  const s2=stageRecs('[CA-S2] Disparo Imediato');
  const s2d1=s2.filter(r=>nstr(novo(r.id_bitrix),'[CA-S2] Disparo D+1')).length;
  const s2resp=cnt(s2,'[CA-S2] Respondeu','Sim');
  const s2nut=s2.filter(r=>r.etapa==='Nutrição'||nstr(novo(r.id_bitrix),'[Abandono] Resposta Botão')==='Não tenho interesse').length;
  let ligPendGlobal=0; for(const r of flowRecords.filter(byHunter).filter(ligCutoff))if(nstr(novo(r.id_bitrix),'[Geral] Ligação Pendente')==='Pendente')ligPendGlobal++;
  setTxt('ca-s2-d0',fmt(s2.length));
  setTxt('ca-s2-d1',fmt(s2d1));
  setTxt('ca-s2-resp',fmt(s2resp));
  setTxt('ca-s2-nut',fmt(s2nut));
  ligChart('ch-s2','CA S2',cnt(s2,'[CA-S2] Resultado Ligação','Atendeu'),cnt(s2,'[CA-S2] Resultado Ligação','Não atendeu'),cnt(s2,'[CA-S2] Resultado Ligação','Caixa Postal'),ligPendGlobal);
  const s3=stageRecs('[CA-S3] Disparo Imediato');
  const s3d2=s3.filter(r=>nstr(novo(r.id_bitrix),'[CA-S3] Disparo D+2')).length;
  const s3nut=s3.filter(r=>r.etapa==='Nutrição').length;
  setTxt('ca-s3-d0',fmt(s3.length));
  setTxt('ca-s3-d2',fmt(s3d2));
  setTxt('ca-s3-nut',fmt(s3nut));
  ligChart('ch-s3','CA S3',cnt(s3,'[CA-S3] Resultado Ligação','Atendeu'),cnt(s3,'[CA-S3] Resultado Ligação','Não atendeu'),cnt(s3,'[CA-S3] Resultado Ligação','Caixa Postal'),undefined);
}

// ══════════════════════════════════════════════════════════════
// STAGE 4 — REUNIÃO AGENDADA
// ══════════════════════════════════════════════════════════════
function renderStage4(){
  const base=flowRecords.filter(byHunter);
  const agend=base.filter(r=>inPeriod(r.dt_apresentacao));
  const real=agend.filter(r=>nstr(novo(r.id_bitrix),'[Show-up] Data entrada'));
  const noshow=agend.filter(r=>r.motivo_wpp_hunter==='Lead marcou reunião, mas não participou (HUNTER)');
  setTxt('s4-agend',fmt(agend.length));
  setTxt('s4-real',`${real.length} (${fmtPct(agend.length?real.length/agend.length:0)})`);
  setTxt('s4-noshow',`${noshow.length} (${fmtPct(agend.length?noshow.length/agend.length:0)})`);
  const H=HUNTERS_WHITELIST; const ag={},rl={},ns={}; H.forEach(h=>{ag[h]=0;rl[h]=0;ns[h]=0;});
  for(const r of agend){
    const h=canonHunter(r.responsavel);if(!h)continue;
    ag[h]++;
    if(nstr(novo(r.id_bitrix),'[Show-up] Data entrada'))rl[h]++;
    if(r.motivo_wpp_hunter==='Lead marcou reunião, mas não participou (HUNTER)')ns[h]++;
  }
  const chart=ec('ch-reuniao'); if(!chart)return;
  chart.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:16,right:14,bottom:36,left:36},
    xAxis:{type:'category',data:H.map(h=>h.split(' ')[0]),axisLabel:{...AX}},
    yAxis:{type:'value',axisLabel:{...AX},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[
      {name:'Agendadas',type:'bar',barGap:'8%',data:H.map(h=>ag[h]),itemStyle:{color:TL2,borderRadius:[4,4,0,0]}},
      {name:'Realizadas',type:'bar',data:H.map(h=>rl[h]),itemStyle:{color:NV,borderRadius:[4,4,0,0]}},
      {name:'No-show',type:'bar',data:H.map(h=>ns[h]),itemStyle:{color:RD,borderRadius:[4,4,0,0]}}
    ]
  });
}

// ══════════════════════════════════════════════════════════════
// STAGE 5 — SHOW-UP
// ══════════════════════════════════════════════════════════════
function renderStage5(){
  const recs=stageRecs('[Show-up] Data entrada');
  const m1=recs.filter(r=>nstr(novo(r.id_bitrix),'[Show-up] Disparo M1'));
  const m2=recs.filter(r=>nstr(novo(r.id_bitrix),'[Show-up] Disparo M2'));
  const avancou=recs.filter(r=>nstr(novo(r.id_bitrix),'[Interação] Data entrada'));
  const nut=recs.filter(r=>r.etapa==='Nutrição').length;
  // Lig. Pendentes — filtrado por criado_em no período + cutoff 23/07
  const baseP=flowRecords.filter(byHunter).filter(r=>inPeriod(r.criado_em)&&ligCutoff(r));
  let ligPend=0; for(const r of baseP)if(nstr(novo(r.id_bitrix),'[Geral] Ligação Pendente')==='Pendente')ligPend++;
  setTxt('s5-total',fmt(recs.length));
  setTxt('s5-ligpend',fmt(ligPend));
  setTxt('s5-m1',fmt(m1.length));
  setTxt('s5-m2',fmt(m2.length));
  setTxt('s5-avancou',`${avancou.length} (${recs.length?Math.round(avancou.length/recs.length*100):0}%)`);
  setTxt('s5-nut',`${nut} (${recs.length?Math.round(nut/recs.length*100):0}%)`);
  // Show-up % por horário — NORMALIZADO
  const hbuck={}; const base=flowRecords.filter(byHunter).filter(r=>inPeriod(r.dt_apresentacao));
  for(const r of base){
    const h=normalizeHorario(r.horario_agenda); if(!h)continue;
    if(!hbuck[h])hbuck[h]={tot:0,su:0};
    hbuck[h].tot++;
    if(nstr(novo(r.id_bitrix),'[Show-up] Data entrada'))hbuck[h].su++;
  }
  const hnames=Object.keys(hbuck).slice(0,4);
  const chHora=ec('ch-su-hora');
  if(chHora)chHora.setOption({
    title:{text:'Show-up por horário',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    grid:{top:26,right:8,bottom:44,left:32},tooltip:{trigger:'axis',...TP},
    xAxis:{type:'category',data:hnames,axisLabel:{...AX,fontSize:9,rotate:15}},
    yAxis:{type:'value',max:100,axisLabel:{...AX,formatter:'{value}%'},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{type:'bar',data:hnames.map(h=>hbuck[h].tot>0?+(hbuck[h].su/hbuck[h].tot*100).toFixed(1):0),barMaxWidth:40,itemStyle:{color:p=>p.value>=60?GR:p.value>=40?AM:RD,borderRadius:[4,4,0,0]},label:{show:true,position:'top',formatter:'{c}%',fontFamily:F,fontWeight:700,fontSize:10}}]
  });
  // Show-up % por hunter
  const H=HUNTERS_WHITELIST; const hp={}; H.forEach(h=>hp[h]={tot:0,su:0});
  for(const r of base){
    const h=canonHunter(r.responsavel);if(!h)continue;
    hp[h].tot++;
    if(nstr(novo(r.id_bitrix),'[Show-up] Data entrada'))hp[h].su++;
  }
  const hdata=H.map(h=>({name:h.split(' ')[0],v:hp[h].tot>0?+(hp[h].su/hp[h].tot*100).toFixed(1):0})).sort((a,b)=>a.v-b.v);
  const chHunter=ec('ch-su-hunter');
  if(chHunter)chHunter.setOption({
    title:{text:'Show-up por Hunter',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    grid:{top:26,right:40,bottom:20,left:8,containLabel:true},tooltip:{trigger:'item',...TP},
    xAxis:{type:'value',max:100,axisLabel:{...AX,formatter:'{value}%'},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    yAxis:{type:'category',data:hdata.map(d=>d.name),axisLabel:{...AX,fontSize:10}},
    series:[{type:'bar',data:hdata.map((d,i)=>({value:d.v,itemStyle:{color:i===0?RD:TL}})),barMaxWidth:16,label:{show:true,position:'right',formatter:'{c}%',fontFamily:F,fontWeight:700,fontSize:10}}]
  });
  // Show-up % por dia da semana
  const dowT=[0,0,0,0,0],dowS=[0,0,0,0,0];
  for(const r of base){
    const d=new Date(r.dt_apresentacao+'T12:00:00').getDay();if(d<1||d>5)continue;
    dowT[d-1]++;
    if(nstr(novo(r.id_bitrix),'[Show-up] Data entrada'))dowS[d-1]++;
  }
  const chDia=ec('ch-su-dia');
  if(chDia)chDia.setOption({
    title:{text:'Show-up por dia da semana',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    grid:{top:26,right:8,bottom:20,left:32},tooltip:{trigger:'axis',...TP},
    xAxis:{type:'category',data:['Seg','Ter','Qua','Qui','Sex'],axisLabel:{...AX}},
    yAxis:{type:'value',max:100,axisLabel:{...AX,formatter:'{value}%'},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{type:'bar',data:dowT.map((t,i)=>t>0?+(dowS[i]/t*100).toFixed(1):0),barMaxWidth:36,itemStyle:{color:p=>p.value>=60?GR:p.value>=40?TL:RD,borderRadius:[4,4,0,0]},label:{show:true,position:'top',formatter:'{c}%',fontFamily:F,fontWeight:700,fontSize:9}}]
  });
  // Ligações show-up
  ligChart('ch-su-lig','Show-up',cnt(recs,'[Show-up] Resultado Ligação','Atendeu'),cnt(recs,'[Show-up] Resultado Ligação','Não atendeu'),cnt(recs,'[Show-up] Resultado Ligação','Caixa Postal'),ligPend);
  // M1/M2 por dia
  const md={};
  for(const r of recs){const n=novo(r.id_bitrix);const d1=parseDateBR(nstr(n,'[Show-up] Disparo M1'));const d2=parseDateBR(nstr(n,'[Show-up] Disparo M2'));if(d1){if(!md[d1])md[d1]={m1:0,m2:0};md[d1].m1++;}if(d2){if(!md[d2])md[d2]={m1:0,m2:0};md[d2].m2++;}}
  const dias=Object.keys(md).sort().slice(-14);
  const chM=ec('ch-su-m');
  if(chM)chM.setOption({
    title:{text:'Disparos M1 e M2 por dia',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    grid:{top:26,right:4,bottom:30,left:32},tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:9},itemHeight:7},
    xAxis:{type:'category',data:dias.map(d=>d.slice(5).split('-').reverse().join('/')),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'M1',type:'bar',barGap:'8%',data:dias.map(d=>md[d].m1),itemStyle:{color:TL,borderRadius:[3,3,0,0]},barMaxWidth:12},{name:'M2',type:'bar',data:dias.map(d=>md[d].m2),itemStyle:{color:TL2,borderRadius:[3,3,0,0]},barMaxWidth:12}]
  });
}

function renderStage6(){
  const recs=stageRecs('[Interação] Data entrada');
  const m1=recs.filter(r=>nstr(novo(r.id_bitrix),'[Interação] Disparo M1'));
  setTxt('s6-total',fmt(recs.length));
  setTxt('s6-m1',fmt(m1.length));
  const H=HUNTERS_WHITELIST; const daysSet=new Set();
  const perH={}; H.forEach(h=>perH[h]={});
  for(const r of recs){const h=canonHunter(r.responsavel);if(!h)continue;const d=parseDateBR(nstr(novo(r.id_bitrix),'[Interação] Data entrada'));if(!d)continue;daysSet.add(d);perH[h][d]=(perH[h][d]||0)+1;}
  const dias=[...daysSet].sort().slice(-14);
  const colors={[H[0]]:PU,[H[1]]:NV,[H[2]]:GR,[H[3]]:OR,[H[4]]:TL};
  const chart=ec('ch-inter'); if(!chart)return;
  chart.setOption({
    title:{text:'Volume de leads em Interação por hunter',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:9},itemHeight:7,data:H.map(h=>h.split(' ')[0])},
    grid:{top:26,right:8,bottom:32,left:32},
    xAxis:{type:'category',data:dias.map(d=>d.slice(5).split('-').reverse().join('/')),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:H.map((h,i)=>({name:h.split(' ')[0],type:'line',smooth:true,symbol:'circle',symbolSize:4,data:dias.map(d=>perH[h][d]||0),lineStyle:{color:HUNTER_COLORS[i],width:1.5},itemStyle:{color:HUNTER_COLORS[i]}}))
  });
}
const HUNTER_COLORS=[TL,NV,GR,OR,PU];

// ══════════════════════════════════════════════════════════════
// STAGE 7 — NEGOCIAÇÃO QUENTE
// ══════════════════════════════════════════════════════════════
function renderStage7(){
  const recs=stageRecs('[NG] Data entrada');
  const link=cnt(recs,'[NG] Motivo','Link de pagamento enviado');
  const futuro=cnt(recs,'[NG] Motivo','Lead deseja contato futuro');
  setTxt('s7-total',fmt(recs.length));
  setTxt('s7-link',`${link} (${recs.length?Math.round(link/recs.length*100):0}%)`);
  setTxt('s7-futuro',`${futuro} (${recs.length?Math.round(futuro/recs.length*100):0}%)`);
  const mot=ec('ch-ng-motivo');
  if(mot)mot.setOption({
    title:{text:'Motivo de entrada',textStyle:{fontFamily:F,fontSize:11,fontWeight:600}},
    tooltip:{trigger:'item',formatter:'{b}: {c} ({d}%)',...TP},legend:{bottom:2,textStyle:{fontFamily:F,fontSize:10},itemHeight:9},
    series:[{type:'pie',radius:['40%','68%'],center:['50%','46%'],data:[{value:link,name:'Link de pagamento enviado',itemStyle:{color:OR}},{value:futuro,name:'Deseja contato futuro',itemStyle:{color:AM}}],label:{formatter:'{d}%',fontSize:11,fontFamily:F}}]
  });
  // Ligação pendente — com cutoff 23/07
  const ngLigPend=recs.filter(r=>ligCutoff(r)&&nstr(novo(r.id_bitrix),'[NG] Motivo')==='Link de pagamento enviado'&&nstr(novo(r.id_bitrix),'[Geral] Ligação Pendente')==='Pendente').length;
  ligChart('ch-ng-lig','Neg. Quente',cnt(recs,'[NG] Resultado Ligação','Atendeu'),cnt(recs,'[NG] Resultado Ligação','Não atendeu'),cnt(recs,'[NG] Resultado Ligação','Caixa Postal'),ngLigPend);
}

// ══════════════════════════════════════════════════════════════
// RANKINGS + FAT POR HUNTER
// ══════════════════════════════════════════════════════════════
function renderRankings(){
  const base=flowRecords.filter(byHunter);
  const H=HUNTERS_WHITELIST;
  const stats=H.map(h=>{
    const recs=base.filter(r=>canonHunter(r.responsavel)===h);
    const ag=recs.filter(r=>inPeriod(r.dt_apresentacao)).length;
    const re=recs.filter(r=>(inPeriod(r.dt_interacao)&&r.ultima_interacao==='Reunião')||(nstr(novo(r.id_bitrix),'[Show-up] Data entrada').slice(0,10)&&inPeriod(nstr(novo(r.id_bitrix),'[Show-up] Data entrada').slice(0,10)))).length;
    const su=ag>0?Math.round(re/ag*100):0;
    const inter=recs.filter(r=>nstr(novo(r.id_bitrix),'[Interação] Data entrada').slice(0,10)&&inPeriod(nstr(novo(r.id_bitrix),'[Interação] Data entrada').slice(0,10))).length;
    const nq=recs.filter(r=>nstr(novo(r.id_bitrix),'[NG] Data entrada').slice(0,10)&&inPeriod(nstr(novo(r.id_bitrix),'[NG] Data entrada').slice(0,10))).length;
    const pg=recs.filter(r=>inPeriod(r.dt_pagamento)&&r.etapa==='Pagamento Recebido').length;
    const fat=fatRecords.filter(r=>r.dt_pagamento&&inPeriod(r.dt_pagamento)&&!r.estorno&&matchFat(r,h)).reduce((s,r)=>s+r.valor,0);
    let lp=0;for(const r of recs.filter(ligCutoff))if(nstr(novo(r.id_bitrix),'[Geral] Ligação Pendente')==='Pendente')lp++;
    return{n:h,ag,re,su,i:inter,nq,pg,fat,lp};
  }).sort((a,b)=>b.fat-a.fat||b.pg-a.pg);
  const pl=['p1','ptl','ptl','pgr','p2'];
  const rk=document.getElementById('rk-body');
  if(rk)rk.innerHTML=stats.map((r,i)=>`<tr><td><span class="pill ${pl[i]||'p2'}">${i+1}º</span></td><td class="hn">${r.n}</td><td class="mn">${r.ag}</td><td class="mn">${r.re}</td><td><div style="display:flex;align-items:center;gap:5px"><div style="flex:1;height:5px;background:#f1f5f9;border-radius:3px;min-width:36px"><div style="height:100%;border-radius:3px;background:#00a0a3;width:${r.su}%"></div></div><span class="mn" style="width:32px">${r.su}%</span></div></td><td class="mn">${r.i}</td><td class="mn">${r.nq}</td><td class="mn" style="font-weight:700">${r.pg}</td><td class="mn" style="color:${r.fat>0?GR:GY}">${r.fat>0?fmtR(r.fat):'—'}</td><td><span class="pill ${r.lp>2?'ppu':'p2'}">${r.lp}</span></td></tr>`).join('');

  const estMap={};
  for(const r of base.filter(r=>inPeriod(r.criado_em))){const uf=r.estado_uf;if(!uf)continue;if(!estMap[uf])estMap[uf]={l:0,c:0};estMap[uf].l++;if(r.dt_pagamento&&r.etapa==='Pagamento Recebido')estMap[uf].c++;}
  const estArr=Object.entries(estMap).map(([uf,d])=>({uf,nome:ESTADO_NOMES[uf]||uf,l:d.l,c:d.c,t:d.l>0?+(d.c/d.l*100).toFixed(1):0})).sort((a,b)=>b.l-a.l).slice(0,15);
  const est=document.getElementById('est-body');
  if(est)est.innerHTML=estArr.map(e=>`<tr><td><span class="uf">${e.uf}</span><span class="ufn">${e.nome}</span></td><td class="mn">${e.l}</td><td class="mn">${e.c}</td><td><span class="pill ${e.t>=6?'pgr':'p1'}">${e.t}%</span></td></tr>`).join('');

  const fatByH=H.map(h=>fatRecords.filter(r=>r.dt_pagamento&&inPeriod(r.dt_pagamento)&&!r.estorno&&matchFat(r,h)).reduce((s,r)=>s+r.valor,0));
  const chart=ec('ch-fat-hunter');
  if(chart)chart.setOption({
    tooltip:{trigger:'axis',valueFormatter:v=>fmtR(v),...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:12,right:8,bottom:36,left:36},
    xAxis:{type:'category',data:H.map(h=>h.split(' ')[0]),axisLabel:{...AX,fontSize:9,rotate:10}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9,formatter:v=>'R$'+v/1000+'k'},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'Faturamento',type:'bar',data:fatByH,itemStyle:{color:p=>[TL,NV,OR,PU,GR][p.dataIndex],borderRadius:[4,4,0,0]},barMaxWidth:36,label:{show:true,position:'top',fontSize:9,fontFamily:F,formatter:p=>'R$'+Math.round(p.value/1000)+'k'}},{name:'Meta (R$60k)',type:'line',data:H.map(()=>META_POR_HUNTER),lineStyle:{color:RD,width:1.5,type:'dashed'},symbol:'none'}]
  });
}

// ══════════════════════════════════════════════════════════════
// IMPACTO LIGAÇÕES + API OFICIAL
// ══════════════════════════════════════════════════════════════
function renderImpacto(){
  const base=flowRecords.filter(byHunter);
  const pagRecs=base.filter(r=>inPeriod(r.dt_pagamento)&&r.etapa==='Pagamento Recebido');
  const ligFields=['[CA-S1] Resultado Ligação','[CA-S2] Resultado Ligação','[CA-S3] Resultado Ligação','[Show-up] Resultado Ligação','[NG] Resultado Ligação'];
  const comLig=pagRecs.filter(r=>ligFields.some(f=>nstr(novo(r.id_bitrix),f)==='Atendeu'));
  const comApi=pagRecs.filter(r=>nstr(novo(r.id_bitrix),'[CA-S2] Disparo Imediato')||nstr(novo(r.id_bitrix),'[Abandono] Template Enviado'));
  const ticket=getTicketMedioReal();
  setTxt('imp-lig-pag',fmt(pagRecs.length));
  setTxt('imp-lig-at',`${comLig.length} (${pagRecs.length?Math.round(comLig.length/pagRecs.length*100):0}%)`);
  setTxt('imp-lig-rec',fmtR(comLig.length*ticket));
  setTxt('imp-api-pag',fmt(pagRecs.length));
  setTxt('imp-api-rec',`${comApi.length} (${pagRecs.length?Math.round(comApi.length/pagRecs.length*100):0}%)`);
  setTxt('imp-api-recrec',fmtR(comApi.length*ticket));
  const c1=ec('ch-lig-conv');
  if(c1)c1.setOption({tooltip:{trigger:'item',formatter:'{b}: {c}',...TP},legend:{bottom:2,textStyle:{fontFamily:F,fontSize:10},itemHeight:9},series:[{type:'pie',radius:['42%','70%'],center:['50%','46%'],data:[{value:comLig.length,name:'Com ligação atendida',itemStyle:{color:GR}},{value:pagRecs.length-comLig.length,name:'Sem ligação registrada',itemStyle:{color:GY}}],label:{formatter:'{d}%',fontSize:11,fontFamily:F}}]});
  const c2=ec('ch-api-conv');
  if(c2)c2.setOption({tooltip:{trigger:'item',formatter:'{b}: {c}',...TP},legend:{bottom:2,textStyle:{fontFamily:F,fontSize:10},itemHeight:9},series:[{type:'pie',radius:['42%','70%'],center:['50%','46%'],data:[{value:comApi.length,name:'Recebeu API Oficial',itemStyle:{color:NV}},{value:pagRecs.length-comApi.length,name:'Não recebeu',itemStyle:{color:GY}}],label:{formatter:'{d}%',fontSize:11,fontFamily:F}}]});
  // Ligações por hunter — com cutoff 23/07
  const H=HUNTERS_WHITELIST; const pend={},real={},at={}; H.forEach(h=>{pend[h]=0;real[h]=0;at[h]=0;});
  for(const r of base.filter(ligCutoff)){const h=canonHunter(r.responsavel);if(!h)continue;const n=novo(r.id_bitrix);if(nstr(n,'[Geral] Ligação Pendente')==='Pendente')pend[h]++;const res=ligFields.map(f=>nstr(n,f)).filter(v=>['Atendeu','Não atendeu','Caixa Postal'].includes(v));if(res.length)real[h]++;if(res.includes('Atendeu'))at[h]++;}
  const c3=ec('ch-lig-hunter');
  if(c3)c3.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:16,right:44,bottom:36,left:36},
    xAxis:{type:'category',data:H.map(h=>h.split(' ')[0]),axisLabel:{...AX}},
    yAxis:[{type:'value',axisLabel:{...AX},splitLine:{lineStyle:{color:'#f1f5f9'}}},{type:'value',max:100,axisLabel:{...AX,formatter:'{value}%'},splitLine:{show:false}}],
    series:[{name:'Pendentes',type:'bar',barGap:'8%',data:H.map(h=>pend[h]),itemStyle:{color:AM,borderRadius:[4,4,0,0]}},{name:'Realizadas',type:'bar',data:H.map(h=>real[h]),itemStyle:{color:GR,borderRadius:[4,4,0,0]}},{name:'Taxa atendimento',type:'line',yAxisIndex:1,data:H.map(h=>real[h]>0?+(at[h]/real[h]*100).toFixed(0):0),lineStyle:{color:NV,width:2},itemStyle:{color:NV},symbol:'circle',symbolSize:6,label:{show:true,position:'top',formatter:'{c}%',fontFamily:F,fontSize:9,color:NV}}]
  });
}

// ══════════════════════════════════════════════════════════════
// ACOMPANHAMENTO
// ══════════════════════════════════════════════════════════════
const META_MES_SETUPS=70, META_MES_FAT=60000, META_SEM_SETUPS=18;
function colorBar(p){return p>=100?GR:p>=70?TL:p>=50?AM:RD;}
