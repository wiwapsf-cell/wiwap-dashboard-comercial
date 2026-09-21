/* ═══════════════════════════════════════════════════════
   SDR.JS — Aba da SDR
   Depende de: core.js, comercial.js (allRecords, flowRecords,
   novoMap, inPeriod, byHunter, normalizeHorario, parseDateBR,
   nstr, novo, getChart, COLORS, resizeVisible)
═══════════════════════════════════════════════════════ */

// ── Normaliza horário incluindo 16h ──────────────────────────────
function normalizeHorarioSDR(raw) {
  const v = (raw || '').trim();
  if (!v || v === 'não selecionada') return null;
  if (v.includes('11h') || v.startsWith('Opção 1')) return 'Às 11h';
  if (v.includes('15h') || v.startsWith('Opção 2')) return 'Às 15h';
  if (v.includes('16h') || v.startsWith('Opção 3')) return 'Às 16h';
  return 'Outro';
}

const SDR_SLOTS = ['Às 11h', 'Às 15h', 'Às 16h', 'Outro'];

// ── Utilitários locais ───────────────────────────────────────────
function sdrShowup(r) {
  return !!nstr(novo(r.id_bitrix), '[Show-up] Data entrada');
}

// Leads criados no período (todos, antes de filtro segmento)
function sdrLeadsCriados() {
  return allRecords.filter(r => inPeriod(r.criado_em));
}

// Reuniões criadas no período (dt_reuniao_agendada no período)
function sdrAgendadosHoje() {
  return flowRecords.filter(r => r.dt_reuniao_agendada && inPeriod(r.dt_reuniao_agendada));
}

// Reuniões marcadas para hoje (dt_apresentacao no período)
function sdrReunioesMarcadas() {
  return flowRecords.filter(r => r.dt_apresentacao && inPeriod(r.dt_apresentacao));
}

// Presença = marcadas no período com show-up preenchido
function sdrPresenca(marcadas) {
  return marcadas.filter(r => sdrShowup(r));
}

// ── Últimos 7 dias úteis (exclui sábado e domingo) ──────────────
function sdrUltimos7d() {
  const hoje = new Date();
  const dias = [];
  let d = new Date(hoje);
  while (dias.length < 7) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      dias.unshift(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

function sdrLabelDia(iso) {
  const d = new Date(iso + 'T12:00:00');
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hoje = new Date().toISOString().slice(0, 10);
  return iso === hoje ? 'Hoje' : nomes[d.getDay()];
}

// Para cada dia: agendadas e presentes (reuniões marcadas para aquele dia)
function sdrMetricasPorDia(dias) {
  return dias.map(iso => {
    const marcadas = flowRecords.filter(r => r.dt_apresentacao && r.dt_apresentacao.startsWith(iso));
    const presentes = marcadas.filter(r => sdrShowup(r));
    const agendGer  = flowRecords.filter(r => r.dt_reuniao_agendada && r.dt_reuniao_agendada.startsWith(iso));
    const leads     = allRecords.filter(r => r.criado_em && r.criado_em.startsWith(iso));
    return {
      iso,
      marcadas: marcadas.length,
      presentes: presentes.length,
      noshow: marcadas.length - presentes.length,
      pct: marcadas.length > 0 ? +(presentes.length / marcadas.length * 100).toFixed(1) : 0,
      agendGerados: agendGer.length,
      leadsCriados: leads.length,
    };
  });
}

// Média 7d por slot de horário (exclui hoje)
function sdrMediaSlot(slot, dias7d) {
  const diasSemHoje = dias7d.slice(0, -1);
  let tot = 0, su = 0;
  for (const iso of diasSemHoje) {
    const recs = flowRecords.filter(r =>
      r.dt_apresentacao && r.dt_apresentacao.startsWith(iso) &&
      normalizeHorarioSDR(r.horario_agenda) === slot
    );
    tot += recs.length;
    su  += recs.filter(r => sdrShowup(r)).length;
  }
  return { tot, su, pct: tot > 0 ? +(su / tot * 100).toFixed(1) : 0 };
}

// ── Cor semáforo por % ──────────────────────────────────────────
function sdrCorPct(pct, ref) {
  if (pct >= ref) return '#059669';
  if (pct >= ref * 0.85) return '#d97706';
  return '#dc2626';
}
function sdrCorDiff(diff) {
  if (diff > 0)  return '#059669';
  if (diff < 0)  return '#dc2626';
  return '#64748b';
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────────
function renderSDR() {
  renderSDRKpis();
  renderSDRHorario();
  renderSDRShowupChart();
  renderSDRAgendChart();
  renderSDRFonteHunter();
  renderSDRBacklog();
  setTimeout(resizeVisible, 80);
}

// ── KPIs ────────────────────────────────────────────────────────
function renderSDRKpis() {
  const leads    = sdrLeadsCriados();
  const agend    = sdrAgendadosHoje();
  const marcadas = sdrReunioesMarcadas();
  const pres     = sdrPresenca(marcadas);
  const noshow   = marcadas.length - pres.length;
  const showPct  = marcadas.length > 0 ? (pres.length / marcadas.length * 100).toFixed(1) : '—';
  const taxaAg   = leads.length > 0 ? (agend.length / leads.length * 100).toFixed(1) : '—';

  // Médias 7d
  const dias7 = sdrUltimos7d();
  const met7  = sdrMetricasPorDia(dias7);
  const med7leads = +(met7.reduce((s,m)=>s+m.leadsCriados,0)/7).toFixed(0);
  const med7agend = +(met7.reduce((s,m)=>s+m.agendGerados,0)/7).toFixed(0);
  const med7marc  = +(met7.reduce((s,m)=>s+m.marcadas,0)/7).toFixed(0);
  const med7showPct = +(met7.filter(m=>m.marcadas>0).reduce((s,m)=>s+(m.pct/met7.filter(m=>m.marcadas>0).length),0)).toFixed(1);

  const diffLeads = leads.length - med7leads;
  const diffAgend = agend.length - med7agend;
  const diffMarc  = marcadas.length - med7marc;
  const diffShow  = marcadas.length > 0 ? +(+showPct - med7showPct).toFixed(1) : 0;

  function badge(diff) {
    if (diff > 0) return `<span class="sdr-badge up">+${diff}</span>`;
    if (diff < 0) return `<span class="sdr-badge dn">${diff}</span>`;
    return `<span class="sdr-badge fl">±0</span>`;
  }
  function badgePp(diff) {
    if (diff > 0) return `<span class="sdr-badge up">+${diff}pp</span>`;
    if (diff < 0) return `<span class="sdr-badge dn">${diff}pp</span>`;
    return `<span class="sdr-badge fl">±0</span>`;
  }

  const showColor = showPct === '—' ? '' :
    (+showPct >= 70 ? 'gr' : +showPct >= 60 ? 'or' : 'rd');
  const barW = showPct === '—' ? 0 : Math.min(+showPct, 100);
  const barC = showPct === '—' ? '#cbd5e1' :
    (+showPct >= 70 ? '#059669' : +showPct >= 60 ? '#d97706' : '#dc2626');

  document.getElementById('sdr-kpis').innerHTML = `
    <div class="sdr-kc nv">
      <div class="sdr-kl">Leads Criados
        <span class="sdr-info" data-tip="Leads com Criado no dentro do período. Todos passam pela SDR.">i</span>
        ${badge(diffLeads)}
      </div>
      <div class="sdr-kv nv">${leads.length}</div>
      <div class="sdr-ks">hoje · média 7d: ${med7leads}</div>
    </div>
    <div class="sdr-kc tl">
      <div class="sdr-kl">Agendados Hoje
        <span class="sdr-info" data-tip="Reuniões CRIADAS hoje (dt_reuniao_agendada = hoje). A reunião pode acontecer em qualquer data futura.">i</span>
        ${badge(diffAgend)}
      </div>
      <div class="sdr-kv tl">${agend.length}</div>
      <div class="sdr-ks">criados hoje · média 7d: ${med7agend}</div>
    </div>
    <div class="sdr-kc nv">
      <div class="sdr-kl">Reuniões p/ Hoje
        <span class="sdr-info" data-tip="Reuniões cuja Data da Apresentação = hoje. Podem ter sido agendadas em qualquer dia anterior.">i</span>
        ${badge(diffMarc)}
      </div>
      <div class="sdr-kv">${marcadas.length}</div>
      <div class="sdr-ks">na agenda de hoje · média 7d: ${med7marc}</div>
    </div>
    <div class="sdr-kc ${showColor || 'or'}">
      <div class="sdr-kl">Presença Hoje
        <span class="sdr-info" data-tip="Reuniões de hoje com [Show-up] Data entrada preenchida, dividido pelas reuniões marcadas para hoje.">i</span>
        ${badgePp(diffShow)}
      </div>
      <div class="sdr-kv ${showColor}">${pres.length} <small style="font-size:13px;color:var(--muted);font-weight:500;">/ ${marcadas.length}</small></div>
      <div class="sdr-ks">${showPct}% show-up · ${noshow} no-show · média 7d: ${med7showPct}%</div>
      <div class="sdr-prog"><div class="sdr-prog-fill" style="width:${barW}%;background:${barC}"></div></div>
    </div>
    <div class="sdr-kc tl">
      <div class="sdr-kl">Taxa Agendamento
        <span class="sdr-info" data-tip="Agendados hoje ÷ Leads criados hoje.">i</span>
      </div>
      <div class="sdr-kv tl">${taxaAg}%</div>
      <div class="sdr-ks">de ${leads.length} leads · meta ≥ 40%</div>
    </div>
  `;
}

// ── HORÁRIO GRID ─────────────────────────────────────────────────
function renderSDRHorario() {
  const el = document.getElementById('sdr-horario-grid');
  if (!el) return;

  const agora = new Date();
  const hAgora = agora.getHours() * 60 + agora.getMinutes(); // minutos desde meia-noite

  // Minutos de corte de cada slot (quando consideramos encerrado)
  const slotCutoff = {
    'Às 11h': 12 * 60,   // após 12h = encerrado
    'Às 15h': 16 * 60,   // após 16h
    'Às 16h': 17 * 60,   // após 17h
    'Outro':  19 * 60,   // após 19h
  };

  const dias7 = sdrUltimos7d();
  const hoje  = new Date().toISOString().slice(0, 10);

  // Reuniões marcadas hoje
  const marcadasHoje = flowRecords.filter(r => r.dt_apresentacao && r.dt_apresentacao.startsWith(hoje));

  // Totais gerais
  let totAgend = 0, totPres = 0, totNoshow = 0;

  const colsHTML = SDR_SLOTS.map(slot => {
    const recs    = marcadasHoje.filter(r => normalizeHorarioSDR(r.horario_agenda) === slot);
    const pres    = recs.filter(r => sdrShowup(r)).length;
    const noshow  = recs.length - pres;
    const pct     = recs.length > 0 ? +(pres / recs.length * 100).toFixed(1) : 0;
    const med7    = sdrMediaSlot(slot, dias7);

    totAgend  += recs.length;
    totPres   += pres;
    totNoshow += noshow;

    // Status do slot
    const corte   = slotCutoff[slot] || 19 * 60;
    const encerrado = hAgora >= corte && recs.length > 0;
    const emAberto  = hAgora < corte && recs.length > 0;
    const aguardando = recs.length === 0;

    let statusClass, statusTxt;
    if (aguardando) { statusClass = 'sdr-st-pending'; statusTxt = 'Sem agenda'; }
    else if (encerrado) { statusClass = 'sdr-st-done'; statusTxt = 'Encerrado'; }
    else { statusClass = 'sdr-st-live'; statusTxt = 'Em andamento'; }

    const cor     = sdrCorPct(pct, 65);
    const diff    = recs.length > 0 ? +(pct - med7.pct).toFixed(1) : null;
    const diffStr = diff !== null ? (diff > 0 ? `+${diff}pp` : `${diff}pp`) : '—';
    const diffCor = diff !== null ? sdrCorDiff(diff) : '#94a3b8';
    const barW    = Math.min(pct, 100);

    return `
      <div class="sdr-hcol">
        <div class="sdr-hcol-top">
          <div class="sdr-slot-lbl">${slot}</div>
          <span class="sdr-status-tag ${statusClass}">${statusTxt}</span>
        </div>
        <div class="sdr-big-row">
          <span class="sdr-agend">${recs.length}</span>
          <span class="sdr-agend-lbl">agendadas</span>
        </div>
        <div class="sdr-pres-row">
          <span class="sdr-pres">${pres}</span>
          <span class="sdr-pres-lbl">presentes</span>
          <span class="sdr-noshow">${noshow > 0 ? noshow + ' no-show' : ''}</span>
        </div>
        <div class="sdr-pct-row">
          <span class="sdr-pct-val" style="color:${recs.length > 0 ? cor : '#94a3b8'}">
            ${recs.length > 0 ? pct + '%' : '—'}
          </span>
          <span class="sdr-pct-lbl">${encerrado ? 'show-up' : (emAberto ? 'show-up (parcial)' : 'show-up')}</span>
        </div>
        <div class="sdr-hbar">
          <div class="sdr-hbar-fill" style="width:${barW}%;background:${cor}"></div>
        </div>
        <div class="sdr-media-row">
          <span class="sdr-media-lbl">Média 7d (${slot})</span>
          <div class="sdr-media-right">
            ${diff !== null ? `<span class="sdr-media-diff" style="color:${diffCor}">${diffStr}</span>` : ''}
            <span class="sdr-media-val">${med7.pct}%</span>
          </div>
        </div>
      </div>
    `;
  });

  // Coluna Total
  const totPct   = totAgend > 0 ? +(totPres / totAgend * 100).toFixed(1) : 0;
  const totCor   = sdrCorPct(totPct, 65);
  const med7tot  = +(sdrUltimos7d().slice(0,-1).reduce((s, iso) => {
    const recs = flowRecords.filter(r => r.dt_apresentacao && r.dt_apresentacao.startsWith(iso));
    const pr   = recs.filter(r => sdrShowup(r)).length;
    return s + (recs.length > 0 ? pr / recs.length * 100 : 0);
  }, 0) / 6).toFixed(1);
  const totDiff  = totAgend > 0 ? +(totPct - +med7tot).toFixed(1) : null;
  const totDiffCor = totDiff !== null ? sdrCorDiff(totDiff) : '#94a3b8';
  const totDiffStr = totDiff !== null ? (totDiff > 0 ? `+${totDiff}pp` : `${totDiff}pp`) : '—';

  el.innerHTML = colsHTML.join('') + `
    <div class="sdr-hcol" style="background:var(--bg)">
      <div class="sdr-hcol-top">
        <div class="sdr-slot-lbl" style="color:var(--tx)">Total</div>
        <span class="sdr-status-tag sdr-st-live">Geral</span>
      </div>
      <div class="sdr-big-row">
        <span class="sdr-agend" style="color:var(--navy)">${totAgend}</span>
        <span class="sdr-agend-lbl">agendadas</span>
      </div>
      <div class="sdr-pres-row">
        <span class="sdr-pres">${totPres}</span>
        <span class="sdr-pres-lbl">presentes</span>
        <span class="sdr-noshow">${totNoshow > 0 ? totNoshow + ' no-show' : ''}</span>
      </div>
      <div class="sdr-pct-row">
        <span class="sdr-pct-val" style="color:${totAgend > 0 ? totCor : '#94a3b8'}">
          ${totAgend > 0 ? totPct + '%' : '—'}
        </span>
        <span class="sdr-pct-lbl">show-up geral</span>
      </div>
      <div class="sdr-hbar">
        <div class="sdr-hbar-fill" style="width:${Math.min(totPct,100)}%;background:${totCor}"></div>
      </div>
      <div class="sdr-media-row">
        <span class="sdr-media-lbl">Média 7d geral</span>
        <div class="sdr-media-right">
          ${totDiff !== null ? `<span class="sdr-media-diff" style="color:${totDiffCor}">${totDiffStr}</span>` : ''}
          <span class="sdr-media-val">${med7tot}%</span>
        </div>
      </div>
    </div>
  `;
}

// ── GRÁFICO: SHOW-UP 7d COM NÚMEROS ─────────────────────────────
function renderSDRShowupChart() {
  const chart = getChart('sdr-ch-showup');
  if (!chart) return;

  const dias7  = sdrUltimos7d();
  const mets   = sdrMetricasPorDia(dias7);
  const labels = dias7.map(sdrLabelDia);
  const marcA  = mets.map(m => m.marcadas);
  const presA  = mets.map(m => m.presentes);
  const pctA   = mets.map(m => m.pct);

  const med7pct = mets.filter(m=>m.marcadas>0).length > 0
    ? +(mets.filter(m=>m.marcadas>0).reduce((s,m)=>s+m.pct,0) / mets.filter(m=>m.marcadas>0).length).toFixed(1)
    : 0;

  chart.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
      backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
      formatter: p => {
        const idx = p[0].dataIndex;
        return `<b>${p[0].axisValue}</b><br/>` +
          `Agendadas: <b>${marcA[idx]}</b><br/>` +
          `Presentes: <b>${presA[idx]}</b><br/>` +
          `No-show: <b>${marcA[idx] - presA[idx]}</b><br/>` +
          `Show-up: <b>${pctA[idx]}%</b>`;
      }
    },
    legend: {
      data: ['Agendadas', 'Presentes', 'Show-up %'],
      textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 10.5, color: '#64748b' },
      bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 14
    },
    grid: { left: 36, right: 46, top: 14, bottom: 34 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10.5, color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLine: { show: false }, axisTick: { show: false }
      },
      {
        type: 'value', min: 0, max: 100, name: '',
        axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8', formatter: '{value}%' },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false }
      }
    ],
    series: [
      {
        name: 'Agendadas', type: 'bar',
        data: marcA,
        itemStyle: { color: '#e2e8f0', borderRadius: [3,3,0,0] },
        barMaxWidth: 22, barGap: '-20%',
        label: { show: true, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: 'JetBrains Mono' }
      },
      {
        name: 'Presentes', type: 'bar',
        data: presA.map((v, i) => ({
          value: v,
          itemStyle: { color: i === dias7.length - 1 ? '#00a0a3' : '#5fc7c9', borderRadius: [3,3,0,0] }
        })),
        barMaxWidth: 22,
        label: { show: true, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#1e293b', fontFamily: 'JetBrains Mono' }
      },
      {
        name: 'Show-up %', type: 'line', yAxisIndex: 1,
        data: pctA, smooth: false,
        symbol: 'circle', symbolSize: 7,
        itemStyle: { color: '#003462' }, lineStyle: { color: '#003462', width: 2 },
        label: { show: true, formatter: p => p.value ? p.value + '%' : '', fontSize: 10, color: '#003462', fontWeight: 700, fontFamily: 'JetBrains Mono', position: 'top' },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { type: 'dashed', color: '#059669', width: 1.5 },
          label: { formatter: `Média ${med7pct}%`, fontSize: 9.5, color: '#059669', fontFamily: 'Plus Jakarta Sans', fontWeight: 700, position: 'insideEndTop' },
          data: [{ yAxis: med7pct }]
        }
      }
    ]
  }, true);
}

// ── GRÁFICO: AGENDAMENTOS 7d ─────────────────────────────────────
function renderSDRAgendChart() {
  const chart = getChart('sdr-ch-agend');
  if (!chart) return;

  const dias7  = sdrUltimos7d();
  const mets   = sdrMetricasPorDia(dias7);
  const labels = dias7.map(sdrLabelDia);
  const leadsA = mets.map(m => m.leadsCriados);
  const agendA = mets.map(m => m.agendGerados);

  chart.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
      backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
      formatter: p => {
        const idx = p[0].dataIndex;
        const taxa = leadsA[idx] > 0 ? (agendA[idx] / leadsA[idx] * 100).toFixed(1) : '—';
        return `<b>${p[0].axisValue}</b><br/>` +
          `Leads criados: <b>${leadsA[idx]}</b><br/>` +
          `Agendamentos: <b>${agendA[idx]}</b><br/>` +
          `Taxa: <b>${taxa}%</b>`;
      }
    },
    legend: {
      data: ['Leads criados', 'Agendamentos gerados'],
      textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 10.5, color: '#64748b' },
      bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 14
    },
    grid: { left: 36, right: 12, top: 14, bottom: 34 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10.5, color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLine: { show: false }, axisTick: { show: false }
    },
    series: [
      {
        name: 'Leads criados', type: 'bar',
        data: leadsA,
        itemStyle: { color: '#e2e8f0', borderRadius: [3,3,0,0] },
        barMaxWidth: 22,
        label: { show: true, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: 'JetBrains Mono' }
      },
      {
        name: 'Agendamentos gerados', type: 'bar',
        data: agendA.map((v, i) => ({
          value: v,
          itemStyle: { color: i === dias7.length - 1 ? '#00a0a3' : '#14c0c4', borderRadius: [3,3,0,0] }
        })),
        barMaxWidth: 22,
        label: { show: true, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#1e293b', fontFamily: 'JetBrains Mono' }
      }
    ]
  }, true);
}

// ── GRÁFICO: FONTE E HUNTER ──────────────────────────────────────
function renderSDRFonteHunter() {
  const dias7 = sdrUltimos7d();

  // Agrupa show-up por fonte (período filtrado ou 7d se filtro = hoje)
  const recs7d = flowRecords.filter(r => r.dt_apresentacao && dias7.some(d => r.dt_apresentacao.startsWith(d)));

  const fonteMap = {};
  const hunterMap = {};

  recs7d.forEach(r => {
    const f  = (typeof simplifyFonte === 'function' ? simplifyFonte(r.fonte) : r.fonte) || 'Sem fonte';
    const h  = r.hunter || 'Sem hunter';
    const su = sdrShowup(r);
    if (!fonteMap[f])  fonteMap[f]  = { ag: 0, su: 0 };
    if (!hunterMap[h]) hunterMap[h] = { ag: 0, su: 0 };
    fonteMap[f].ag++;  if (su) fonteMap[f].su++;
    hunterMap[h].ag++; if (su) hunterMap[h].su++;
  });

  // Fonte chart
  const fonteSorted = Object.entries(fonteMap)
    .filter(([,v]) => v.ag >= 2)
    .map(([k,v]) => ({ name: k, pct: +(v.su / v.ag * 100).toFixed(1) }))
    .sort((a,b) => a.pct - b.pct);

  const chFonte = getChart('sdr-ch-fonte');
  if (chFonte && fonteSorted.length > 0) {
    chFonte.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 }, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1 },
      grid: { left: 110, right: 52, top: 6, bottom: 8 },
      xAxis: { type: 'value', max: 100, axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      yAxis: { type: 'category', data: fonteSorted.map(f => f.name), axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: '#4a5468', fontWeight: 500 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 16, itemStyle: { borderRadius: [0,3,3,0] },
        data: fonteSorted.map(f => ({ value: f.pct, itemStyle: { color: f.pct >= 70 ? '#059669' : f.pct >= 55 ? '#d97706' : '#dc2626' } })),
        label: { show: true, position: 'right', formatter: p => p.value + '%', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#1e293b', fontWeight: 700 }
      }]
    }, true);
  } else if (chFonte) {
    chFonte.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'Sem dados suficientes', fill: '#94a3b8', fontSize: 12 } }] }, true);
  }

  // Hunter chart
  const HUNTERS_WL = typeof HUNTERS_WHITELIST !== 'undefined' ? HUNTERS_WHITELIST : Object.keys(hunterMap);
  const hunterSorted = HUNTERS_WL
    .filter(h => hunterMap[h] && hunterMap[h].ag > 0)
    .map(h => ({ name: h.split(' ')[0], pct: +(hunterMap[h].su / hunterMap[h].ag * 100).toFixed(1) }))
    .sort((a,b) => a.pct - b.pct);

  const chHunter = getChart('sdr-ch-hunter');
  if (chHunter && hunterSorted.length > 0) {
    chHunter.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 }, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1 },
      grid: { left: 80, right: 52, top: 6, bottom: 8 },
      xAxis: { type: 'value', max: 100, axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      yAxis: { type: 'category', data: hunterSorted.map(h => h.name), axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: '#4a5468', fontWeight: 500 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 16, itemStyle: { borderRadius: [0,3,3,0] },
        data: hunterSorted.map(h => ({ value: h.pct, itemStyle: { color: h.pct >= 70 ? '#059669' : h.pct >= 55 ? '#d97706' : '#dc2626' } })),
        label: { show: true, position: 'right', formatter: p => p.value + '%', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#1e293b', fontWeight: 700 }
      }]
    }, true);
  }
}

// ── BACKLOG ──────────────────────────────────────────────────────
function renderSDRBacklog() {
  const el = document.getElementById('sdr-backlog');
  if (!el) return;

  const hoje = new Date().toISOString().slice(0, 10);

  // 1. Leads sem primeiro contato (sem dt_reuniao_agendada e sem dt_msg_wpp_hunter, criados antes de hoje)
  const semContato = flowRecords.filter(r => {
    if (!r.criado_em || r.criado_em >= hoje) return false;
    return !r.dt_reuniao_agendada && !r.dt_msg_wpp_hunter;
  });

  // 2. No-shows aguardando (dt_apresentacao < hoje, sem [Show-up] Data entrada)
  const noShows = flowRecords.filter(r => {
    if (!r.dt_apresentacao || r.dt_apresentacao >= hoje) return false;
    return !sdrShowup(r);
  });

  // 3. Reuniões marcadas para hoje ainda sem status (horário ainda não chegou e sem show-up)
  const agora = new Date();
  const hAgora = agora.getHours();
  const aguardando = flowRecords.filter(r => {
    if (!r.dt_apresentacao || !r.dt_apresentacao.startsWith(hoje)) return false;
    if (sdrShowup(r)) return false;
    const h = normalizeHorarioSDR(r.horario_agenda);
    if (h === 'Às 11h' && hAgora >= 12) return false; // já deveria ter acontecido
    return true;
  });

  const items = [
    {
      title: 'Leads sem primeiro contato',
      sub: 'Leads criados antes de hoje sem agendamento nem msg wpp hunter · SLA 1 dia útil',
      val: semContato.length,
      cls: semContato.length > 10 ? 'bad' : semContato.length > 3 ? 'warn' : ''
    },
    {
      title: 'No-shows aguardando remarcação',
      sub: 'Reuniões passadas sem [Show-up] Data entrada · pendentes de retomada',
      val: noShows.length,
      cls: noShows.length > 5 ? 'bad' : noShows.length > 0 ? 'warn' : ''
    },
    {
      title: 'Reuniões de hoje ainda aguardando',
      sub: 'Horários ainda não encerrados e sem presença registrada',
      val: aguardando.length,
      cls: aguardando.length > 3 ? 'warn' : ''
    },
  ];

  el.innerHTML = items.map(it => `
    <div class="sdr-bl-item">
      <div>
        <div class="sdr-bl-title">${it.title}</div>
        <div class="sdr-bl-sub">${it.sub}</div>
      </div>
      <div class="sdr-bl-val ${it.cls}">${it.val}</div>
    </div>
  `).join('');
}
