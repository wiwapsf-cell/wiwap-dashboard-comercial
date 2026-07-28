function renderAcomp(){
  const now=new Date(maxDate+'T12:00:00');
  const year=now.getFullYear(), month=now.getMonth(), day=now.getDate();
  const duTotal=countBusinessDaysInMonth(year,month);
  const duPassados=Math.max(1,countBusinessDaysUpTo(year,month,day));
  const duRestantes=Math.max(0,duTotal-duPassados);
  // Faturamento do mês corrente (todos hunters ou filtrado)
  const mesIni=`${year}-${String(month+1).padStart(2,'0')}-01`;
  const fatMes=fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=mesIni&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,selectedHunter));
  const fatReal=fatMes.reduce((s,r)=>s+r.valor,0);
  const setupsMes=fatMes.length;
  const ticket=setupsMes>0?fatReal/setupsMes:TICKET_MEDIO;
  const metaFatTotal=selectedHunter?META_POR_HUNTER:META_MENSAL;
  const proj=Math.round(fatReal*(duTotal/duPassados));
  const restante=Math.max(0,metaFatTotal-fatReal);

  setTxt('ac-fat',fmtR(fatReal));
  setTxt('ac-fat-s',`${setupsMes} setups no período · ${fmtPct(fatReal/metaFatTotal)} da meta`);
  setTxt('ac-ticket',fmtR(ticket));
  setTxt('ac-proj',fmtR(proj));
  setTxt('ac-proj-s',`${fmtPct(proj/metaFatTotal)} da meta · ${duPassados}/${duTotal} d.úteis`);
  setTxt('ac-rest',fmtR(restante));
  setTxt('ac-rest-s',`${fmtR(metaFatTotal)} − ${fmtR(fatReal)} realizado`);

  // Barras de meta do time (semanal + mensal)
  const H=HUNTERS_WHITELIST;
  const nH=selectedHunter?1:H.length;
  const metaSemSetups=META_SEM_SETUPS*nH, metaMesSetups=META_MES_SETUPS*nH;
  // semana atual (últimos 7 dias corridos até maxDate)
  const semIni=new Date(now);semIni.setDate(now.getDate()-6);const semIniISO=semIni.toISOString().slice(0,10);
  const fatSem=fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=semIniISO&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,selectedHunter));
  const setupsSem=fatSem.length, fatSemReal=fatSem.reduce((s,r)=>s+r.valor,0);
  const metaSemFat=metaSemSetups*ticket, metaMesFatTotal=selectedHunter?META_POR_HUNTER:META_MENSAL;
  const pctSem=pct(setupsSem,metaSemSetups), pctMes=pct(setupsMes,metaMesSetups);
  const projSetups=Math.round(setupsMes*(duTotal/duPassados));
  const mp=document.getElementById('ac-meta-prog');
  if(mp)mp.innerHTML=`
    <div class="meta-prog-row">
      <div class="meta-prog-header">
        <div><div class="meta-prog-title">Meta semanal — ${selectedHunter?selectedHunter.split(' ')[0]:'Time ('+nH+' hunters)'}</div><div class="meta-prog-subtitle">Semana atual · meta ${META_SEM_SETUPS} setups/hunter = ${metaSemSetups} setups · ticket ${fmtR(ticket)}</div></div>
        <div class="meta-prog-right"><div class="meta-prog-pct" style="color:${colorBar(pctSem)}">${pctSem.toFixed(1)}%</div><div class="meta-prog-detail">${setupsSem} / ${metaSemSetups} setups · ${fmtR(fatSemReal)} / ${fmtR(metaSemFat)}</div></div>
      </div>
      <div class="meta-bar"><div class="meta-bar-fill" style="width:${Math.min(pctSem,100)}%;background:${colorBar(pctSem)}"></div></div>
      <div class="meta-bar-sub">Faltam ${Math.max(0,metaSemSetups-setupsSem)} setups para a meta semanal (≈ ${fmtR(Math.max(0,metaSemFat-fatSemReal))})</div>
    </div>
    <div class="meta-prog-row">
      <div class="meta-prog-header">
        <div><div class="meta-prog-title">Meta mensal acumulada — ${selectedHunter?selectedHunter.split(' ')[0]:'Time ('+nH+' hunters)'}</div><div class="meta-prog-subtitle">Mês atual · meta ${META_MES_SETUPS} setups/hunter = ${metaMesSetups} setups · ${fmtR(metaMesFatTotal)}</div></div>
        <div class="meta-prog-right"><div class="meta-prog-pct" style="color:${colorBar(pctMes)}">${pctMes.toFixed(1)}%</div><div class="meta-prog-detail">${setupsMes} / ${metaMesSetups} setups · ${fmtR(fatReal)} / ${fmtR(metaMesFatTotal)}</div></div>
      </div>
      <div class="meta-bar"><div class="meta-bar-fill" style="width:${Math.min(pctMes,100)}%;background:${colorBar(pctMes)}"></div></div>
      <div class="meta-bar-sub">Faltam ${Math.max(0,metaMesSetups-setupsMes)} setups para a meta mensal (≈ ${fmtR(restante)}) · Projeção: ${projSetups} setups (${pct(projSetups,metaMesSetups).toFixed(1)}% da meta)</div>
    </div>`;

  // Hunter cards
  const container=document.getElementById('hunter-cards-container');
  if(container){
    const showH=selectedHunter?[selectedHunter]:H;
    const inis={'Ana Melo':'AM','Elizabete Soares':'ES','Jade Sena':'JS','Jose Rodrigo Moreira':'JR','Vinicius Pedro':'VP'};
    const cols={'Ana Melo':PU,'Elizabete Soares':NV,'Jade Sena':TL,'Jose Rodrigo Moreira':OR,'Vinicius Pedro':GR};
    container.innerHTML=showH.map(h=>{
      const fm=fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=mesIni&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,h));
      const fs=fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=semIniISO&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,h));
      const setupsM=fm.length, fatM=fm.reduce((s,r)=>s+r.valor,0), setupsS=fs.length;
      const tkt=setupsM>0?fatM/setupsM:TICKET_MEDIO;
      const pctM=pct(setupsM,META_MES_SETUPS), pctS=pct(setupsS,META_SEM_SETUPS);
      const projM=Math.round(setupsM*(duTotal/duPassados)), projFat=projM*tkt;
      const ritmo=+(setupsM/duPassados).toFixed(1), metaDia=+(META_SEM_SETUPS/5).toFixed(1);
      let lp=0;for(const r of flowRecords)if(canonHunter(r.responsavel)===h&&nstr(novo(r.id_bitrix),'[Geral] Ligação Pendente')==='Pendente')lp++;
      return `<div class="hcard">
        <div class="hcard-name"><div class="hcard-avatar" style="background:${cols[h]}22;color:${cols[h]}">${inis[h]}</div>${h}</div>
        <div class="prog-row"><div class="prog-label"><span class="prog-lname">Meta mensal (setups)</span><span class="prog-val" style="color:${colorBar(pctM)}">${setupsM} / ${META_MES_SETUPS}</span></div><div class="prog-bar"><div class="prog-fill" style="width:${Math.min(pctM,100)}%;background:${colorBar(pctM)}"></div></div><div style="font-size:9px;color:var(--muted);margin-top:2px">${pctM.toFixed(1)}% · faltam ${Math.max(0,META_MES_SETUPS-setupsM)} setups</div></div>
        <div class="prog-row"><div class="prog-label"><span class="prog-lname">Meta semanal</span><span class="prog-val" style="color:${colorBar(pctS)}">${setupsS} / ${META_SEM_SETUPS}</span></div><div class="prog-bar"><div class="prog-fill" style="width:${Math.min(pctS,100)}%;background:${colorBar(pctS)}"></div></div><div style="font-size:9px;color:var(--muted);margin-top:2px">${pctS.toFixed(1)}%</div></div>
        <div style="margin-top:8px">
          <div class="hcard-stat"><span class="hcard-stat-lbl">Faturamento real</span><span class="hcard-stat-val" style="color:${colorBar(pct(fatM,META_MES_FAT))}">${fmtR(fatM)}</span></div>
          <div class="hcard-stat"><span class="hcard-stat-lbl">Ticket médio</span><span class="hcard-stat-val">${fmtR(tkt)}</span></div>
          <div class="hcard-stat"><span class="hcard-stat-lbl">Projeção do mês</span><span class="hcard-stat-val" style="color:${projFat>=META_MES_FAT?GR:RD}">${fmtR(projFat)}</span></div>
          <div class="hcard-stat"><span class="hcard-stat-lbl">Ritmo atual</span><span class="hcard-stat-val">${ritmo} set/dia</span></div>
          <div class="hcard-stat"><span class="hcard-stat-lbl">Meta diária</span><span class="hcard-stat-val">${metaDia} set/dia</span></div>
          <div class="hcard-stat"><span class="hcard-stat-lbl">Lig. pendentes</span><span class="hcard-stat-val" style="color:${lp>2?OR:GY}">${lp}</span></div>
        </div></div>`;
    }).join('');
  }

  // Setups diários (mês)
  const dayMap={};
  for(const r of fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=mesIni&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,selectedHunter))){const d=r.dt_pagamento;dayMap[d]=(dayMap[d]||0)+1;}
  const dias=Object.keys(dayMap).sort();
  const media=dias.length?+(dias.reduce((s,d)=>s+dayMap[d],0)/dias.length).toFixed(0):0;
  const c1=ec('ch-setups-diario');
  if(c1)c1.setOption({
    tooltip:{trigger:'axis',...TP},grid:{top:12,right:8,bottom:28,left:36},
    xAxis:{type:'category',data:dias.map(d=>d.slice(5).split('-').reverse().join('/')),axisLabel:{...AX,fontSize:8,rotate:35}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'Setups',type:'bar',data:dias.map(d=>dayMap[d]),itemStyle:{color:TL,borderRadius:[3,3,0,0]},barMaxWidth:18},{name:'Média',type:'line',data:dias.map(()=>media),lineStyle:{color:RD,type:'dashed',width:1.5},symbol:'none'}]
  });
  // Fat vs meta por hunter
  const fatH=H.map(h=>fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=mesIni&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,h)).reduce((s,r)=>s+r.valor,0));
  const cols2=[PU,NV,TL,OR,GR];
  const c2=ec('ch-fat-vs-meta');
  if(c2)c2.setOption({
    tooltip:{trigger:'axis',valueFormatter:v=>fmtR(v),...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:12,right:8,bottom:36,left:8,containLabel:true},
    xAxis:{type:'category',data:H.map(h=>h.split(' ')[0]),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9,formatter:v=>'R$'+v/1000+'k'},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'Faturamento real',type:'bar',data:fatH,itemStyle:{borderRadius:[4,4,0,0],color:p=>cols2[p.dataIndex]},barMaxWidth:32},{name:'Meta (R$60k)',type:'line',data:H.map(()=>META_MES_FAT),lineStyle:{color:RD,type:'dashed',width:1.5},symbol:'none'}]
  });
  // Setups semanal por hunter
  const semH=H.map(h=>fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=semIniISO&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,h)).length);
  const c3=ec('ch-sem-hunter');
  if(c3)c3.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:10},itemHeight:8},
    grid:{top:12,right:8,bottom:36,left:8,containLabel:true},
    xAxis:{type:'category',data:H.map(h=>h.split(' ')[0]),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:[{name:'Setups semana',type:'bar',data:semH,itemStyle:{borderRadius:[4,4,0,0],color:p=>{const pp=semH[p.dataIndex]/META_SEM_SETUPS;return pp>=1?GR:pp>=.7?TL:pp>=.5?AM:RD;}},barMaxWidth:36,label:{show:true,position:'top',fontSize:10,fontFamily:F}},{name:'Meta (18)',type:'line',data:H.map(()=>META_SEM_SETUPS),lineStyle:{color:RD,type:'dashed',width:1.5},symbol:'none'}]
  });
  // Fat por segmento (bandeira)
  const segMap={};
  for(const r of fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=mesIni&&r.dt_pagamento<=maxDate&&!r.estorno&&matchFat(r,selectedHunter))){const b=(r.bandeira||'OUTROS').toUpperCase();segMap[b]=(segMap[b]||0)+r.valor;}
  const segArr=Object.entries(segMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const segCols=[NV,TL,OR,PU,GR,AM,RD,GY];
  const c4=ec('ch-fat-seg');
  if(c4)c4.setOption({
    tooltip:{trigger:'axis',valueFormatter:v=>fmtR(v),...TP},grid:{top:8,right:8,bottom:8,left:8,containLabel:true},
    xAxis:{type:'value',axisLabel:{...AX,fontSize:8,formatter:v=>'R$'+Math.round(v/1000)+'k'},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    yAxis:{type:'category',data:segArr.map(s=>s[0]).reverse(),axisLabel:{...AX,fontSize:9}},
    series:[{type:'bar',data:segArr.map((s,i)=>({value:s[1],itemStyle:{color:segCols[i]}})).reverse(),barWidth:14,label:{show:true,position:'right',fontSize:9,fontFamily:F,formatter:p=>'R$'+Math.round(p.value/1000)+'k'}}]
  });
  // Acumulado por hunter (mês)
  const allDays=[...new Set(fatRecords.filter(r=>r.dt_pagamento&&r.dt_pagamento>=mesIni&&r.dt_pagamento<=maxDate).map(r=>r.dt_pagamento))].sort();
  const cols3=[TL,NV,OR,PU,GR];
  const c5=ec('ch-acum-hunter');
  if(c5)c5.setOption({
    tooltip:{trigger:'axis',...TP},legend:{bottom:0,textStyle:{fontFamily:F,fontSize:9},itemHeight:7,data:H.map(h=>h.split(' ')[0])},
    grid:{top:8,right:8,bottom:32,left:36},
    xAxis:{type:'category',data:allDays.map(d=>d.slice(5).split('-').reverse().join('/')),axisLabel:{...AX,fontSize:9}},
    yAxis:{type:'value',axisLabel:{...AX,fontSize:9},splitLine:{lineStyle:{color:'#f1f5f9'}}},
    series:H.map((h,i)=>{let acc=0;const data=allDays.map(d=>{acc+=fatRecords.filter(r=>r.dt_pagamento===d&&!r.estorno&&matchFat(r,h)).length;return acc;});return{name:h.split(' ')[0],type:'line',smooth:true,data,lineStyle:{color:cols3[i],width:2},itemStyle:{color:cols3[i]},symbol:'circle',symbolSize:4};}).concat([{name:'Meta (70)',type:'line',data:allDays.map(()=>META_MES_SETUPS),lineStyle:{color:RD,type:'dashed',width:1.5},symbol:'none'}])
  });
}

// ══════════════════════════════════════════════════════════════
// MARKETING
// ══════════════════════════════════════════════════════════════
