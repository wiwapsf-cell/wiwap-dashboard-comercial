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

  if(mktInited)return; mktInited=true;
  initMktCharts();
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
  // Volume por fonte + taxa conversão
  const fonteMap={};
  for(const r of base.filter(r=>inPeriod(r.criado_em))){const f=simplifyFonte(r.fonte);if(!fonteMap[f])fonteMap[f]={vol:0,conv:0};fonteMap[f].vol++;if(r.dt_pagamento&&r.etapa==='Pagamento Recebido')fonteMap[f].conv++;}
  const fArr=Object.entries(fonteMap).sort((a,b)=>b[1].vol-a[1].vol).slice(0,10);
  const c4=ec('ch-mkt-fonte');
  if(c4)c4.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:12,right:44,bottom:48,left:36},
    xAxis:{type:'category',data:fArr.map(f=>f[0]),axisLabel:{...AX,fontSize:9,rotate:12}},
    yAxis:[{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},{type:'value',max:20,axisLabel:{...AX,fontSize:9,formatter:'{value}%'},splitLine:{show:false}}],
    series:[{name:'Volume (leads)',type:'bar',data:fArr.map(f=>f[1].vol),barMaxWidth:36,itemStyle:{color:p=>{const v=fArr[p.dataIndex][1].vol;return v>=40?TL:v>=20?TL2:'#b2e4e5';},borderRadius:[4,4,0,0]}},{name:'Taxa conversão',type:'line',yAxisIndex:1,data:fArr.map(f=>f[1].vol>0?+(f[1].conv/f[1].vol*100).toFixed(1):0),lineStyle:{color:NV,width:2},itemStyle:{color:NV},symbol:'circle',symbolSize:6,label:{show:true,position:'top',formatter:p=>p.value>0?p.value+'%':'',fontSize:9,fontFamily:F,color:NV}}]
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
