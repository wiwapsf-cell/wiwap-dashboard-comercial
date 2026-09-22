/* ═══════════════════════════════════════════════════════
   SDR.JS — Aba da SDR
   Depende de: core.js, comercial.js (allRecords, flowRecords,
   novoMap, inPeriod, byHunter, normalizeHorario, parseDateBR,
   nstr, novo, ec, resizeVisible)
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
const SDR_SHOWUP_META = 50; // meta de show-up e agendamento %

// ── Utilitários locais ───────────────────────────────────────────
function sdrShowup(r) {
  return !!nstr(novo(r.id_bitrix), '[Show-up] Data entrada');
}

// Leads criados no período (todos, antes de filtro segmento)
function sdrLeadsCriados() {
  return flowRecords.filter(r => inPeriod(r.criado_em));
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
// Retorna os últimos N dias úteis a partir de uma data base (ISO string)
function sdrDiasUteis(n, baseIso) {
  const base = baseIso ? new Date(baseIso + 'T12:00:00') : new Date();
  const dias = [];
  let d = new Date(base);
  while (dias.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dias.unshift(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

// Sempre retorna os últimos 7 dias úteis a partir do fim do período atual
function sdrUltimos7d() {
  const { end } = computeRange();
  return sdrDiasUteis(7, end);
}

// Dia de referência do painel (fim do período filtrado)
function sdrDiaRef() {
  return computeRange().end;
}

function sdrLabelDia(iso) {
  const d = new Date(iso + 'T12:00:00');
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ref = sdrDiaRef();
  return iso === ref ? (ref === new Date().toISOString().slice(0,10) ? 'Hoje' : iso.slice(5)) : nomes[d.getDay()];
}

// Gera dias do período filtrado em granularidade adequada
function sdrDiasPeriodo() {
  const { start, end } = computeRange();
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');

  // Conta dias úteis no período (Seg–Sex)
  let bizDays = 0;
  const tmp = new Date(s);
  while (tmp <= e) {
    const dow = tmp.getDay();
    if (dow !== 0 && dow !== 6) bizDays++;
    tmp.setDate(tmp.getDate() + 1);
  }

  if (bizDays <= 14) {
    // dia a dia — exclui fins de semana
    const dias = [];
    let d = new Date(s);
    while (d <= e) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) dias.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return { dias, granular: 'dia' };
  } else if (bizDays <= 65) {
    // semanas: agrupa por semana (segunda)
    const semanas = {};
    let d = new Date(s);
    while (d <= e) {
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      const seg = new Date(d);
      seg.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      const key = seg.toISOString().slice(0, 10);
      if (!semanas[key]) semanas[key] = [];
      semanas[key].push(iso);
      d.setDate(d.getDate() + 1);
    }
    return { dias: Object.keys(semanas).sort(), grupos: semanas, granular: 'semana' };
  } else {
    // meses
    const meses = {};
    let d = new Date(s);
    while (d <= e) {
      const key = d.toISOString().slice(0, 7); // yyyy-mm
      if (!meses[key]) meses[key] = [];
      meses[key].push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return { dias: Object.keys(meses).sort(), grupos: meses, granular: 'mes' };
  }
}

function sdrLabelPeriodo(key, granular) {
  if (granular === 'dia') return sdrLabelDia(key);
  if (granular === 'semana') {
    const d = new Date(key + 'T12:00:00');
    return `${d.getDate()}/${d.getMonth()+1}`;
  }
  // mês
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [,m] = key.split('-');
  return meses[+m - 1];
}

// Para cada dia/período: métricas de show-up e agendamentos
function sdrMetricasPorDia(dias) {
  return dias.map(iso => {
    const marcadas = flowRecords.filter(r => r.dt_apresentacao && r.dt_apresentacao.startsWith(iso));
    const presentes = marcadas.filter(r => sdrShowup(r));
    const agendGer  = flowRecords.filter(r => r.dt_reuniao_agendada && r.dt_reuniao_agendada.startsWith(iso));
    const leads     = flowRecords.filter(r => r.criado_em && r.criado_em.startsWith(iso));
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

function sdrMetricasAgrupadas(grupos, chaves) {
  return chaves.map(key => {
    const isos = grupos[key] || [];
    const marcadas = flowRecords.filter(r => r.dt_apresentacao && isos.includes(r.dt_apresentacao));
    const presentes = marcadas.filter(r => sdrShowup(r));
    const agendGer  = flowRecords.filter(r => r.dt_reuniao_agendada && isos.includes(r.dt_reuniao_agendada));
    const leads     = flowRecords.filter(r => r.criado_em && isos.includes(r.criado_em));
    return {
      iso: key,
      marcadas: marcadas.length,
      presentes: presentes.length,
      noshow: marcadas.length - presentes.length,
      pct: marcadas.length > 0 ? +(presentes.length / marcadas.length * 100).toFixed(1) : 0,
      agendGerados: agendGer.length,
      leadsCriados: leads.length,
    };
  });
}

// Média 7d por slot de horário (usa dias úteis dos últimos 7d excluindo o dia de referência)
function sdrMediaSlot(slot, dias7d) {
  const ref = sdrDiaRef();
  const diasSemRef = dias7d.filter(d => d !== ref);
  let tot = 0, su = 0;
  for (const iso of diasSemRef) {
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

const SDR_SHOWUP_META_PLACEHOLDER = null; // já declarada no topo

// ── RENDER PRINCIPAL ─────────────────────────────────────────────
function renderSDR() {
  renderSDRKpis();
  renderSDRHorario();
  renderSDRShowupChart();
  renderSDRAgendChart();
  renderSDRFonteHunter();
  renderSDRLigacoes();
  renderSDRTempo();
  renderSDRHeatmap();
  renderSDRSegmentos();
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

  // Taxa de agendamento: coorte 7 dias
  // Leads criados nos últimos 7 dias úteis → quantos viraram agendamento
  const dias7c = sdrUltimos7d();
  const { start: startC } = { start: dias7c[0], end: dias7c[dias7c.length-1] };
  const leadsCoorte  = flowRecords.filter(r => r.criado_em && r.criado_em >= startC);
  const agendCoorte  = leadsCoorte.filter(r => r.dt_reuniao_agendada);
  const taxaAg = leadsCoorte.length > 0 ? (agendCoorte.length / leadsCoorte.length * 100).toFixed(1) : '—';
  const taxaAgColor = taxaAg === '—' ? '' : (+taxaAg >= 50 ? 'gr' : +taxaAg >= 40 ? 'or' : 'rd');

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
    (+showPct >= 50 ? 'gr' : +showPct >= 42 ? 'or' : 'rd');
  const barW = showPct === '—' ? 0 : Math.min(+showPct, 100);
  const barC = showPct === '—' ? '#cbd5e1' :
    (+showPct >= 50 ? '#059669' : +showPct >= 42 ? '#d97706' : '#dc2626');

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
    <div class="sdr-kc ${taxaAgColor || 'tl'}">
      <div class="sdr-kl">Taxa Agendamento
        <span class="sdr-info" data-tip="Coorte 7 dias: dos leads criados nos últimos 7 dias úteis, quantos % já viraram agendamento. Meta ≥ 50%.">i</span>
      </div>
      <div class="sdr-kv ${taxaAgColor || 'tl'}">${taxaAg}%</div>
      <div class="sdr-ks">${agendCoorte.length} de ${leadsCoorte.length} leads (7d úteis) · meta ≥ 50%</div>
    </div>
  `;
}

// ── HORÁRIO GRID ─────────────────────────────────────────────────
function renderSDRHorario() {
  const el = document.getElementById('sdr-horario-grid');
  if (!el) return;

  const agora  = new Date();
  const hAgora = agora.getHours() * 60 + agora.getMinutes();
  const ref    = sdrDiaRef();  // dia do filtro atual
  const ehHoje = ref === agora.toISOString().slice(0, 10);

  // Minutos de corte de cada slot (quando consideramos encerrado)
  const slotCutoff = {
    'Às 11h': 12 * 60,
    'Às 15h': 16 * 60,
    'Às 16h': 17 * 60,
    'Outro':  19 * 60,
  };

  const dias7 = sdrUltimos7d();

  // Reuniões marcadas no dia de referência do filtro
  const marcadasRef = flowRecords.filter(r => r.dt_apresentacao && r.dt_apresentacao.startsWith(ref));

  // Totais gerais
  let totAgend = 0, totPres = 0, totNoshow = 0;

  const colsHTML = SDR_SLOTS.map(slot => {
    const recs    = marcadasRef.filter(r => normalizeHorarioSDR(r.horario_agenda) === slot);
    const pres    = recs.filter(r => sdrShowup(r)).length;
    const noshow  = recs.length - pres;
    const pct     = recs.length > 0 ? +(pres / recs.length * 100).toFixed(1) : 0;
    const med7    = sdrMediaSlot(slot, dias7);

    totAgend  += recs.length;
    totPres   += pres;
    totNoshow += noshow;

    // Status do slot: só aplica lógica de horário se for hoje, senão é sempre Encerrado
    let statusClass, statusTxt;
    if (recs.length === 0) {
      statusClass = 'sdr-st-pending'; statusTxt = 'Sem agenda';
    } else if (!ehHoje) {
      statusClass = 'sdr-st-done'; statusTxt = 'Encerrado';
    } else {
      const corte = slotCutoff[slot] || 19 * 60;
      if (hAgora >= corte) { statusClass = 'sdr-st-done'; statusTxt = 'Encerrado'; }
      else { statusClass = 'sdr-st-live'; statusTxt = 'Em andamento'; }
    }

    const cor     = sdrCorPct(pct, SDR_SHOWUP_META);
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
          <span class="sdr-pct-lbl">${statusTxt === 'Em andamento' ? 'show-up (parcial)' : 'show-up'}</span>
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
  const totCor   = sdrCorPct(totPct, SDR_SHOWUP_META);
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

// ── GRÁFICO: SHOW-UP PERÍODO COM NÚMEROS ─────────────────────────
function renderSDRShowupChart() {
  const chart = ec('sdr-ch-showup');
  if (!chart) return;

  const { dias, grupos, granular } = sdrDiasPeriodo();
  const mets = grupos ? sdrMetricasAgrupadas(grupos, dias) : sdrMetricasPorDia(dias);
  const labels = dias.map(d => sdrLabelPeriodo(d, granular));
  const marcA  = mets.map(m => m.marcadas);
  const presA  = mets.map(m => m.presentes);
  const pctA   = mets.map(m => m.pct);
  const ref    = sdrDiaRef();

  const med7pct = mets.filter(m=>m.marcadas>0).length > 0
    ? +(mets.filter(m=>m.marcadas>0).reduce((s,m)=>s+m.pct,0) / mets.filter(m=>m.marcadas>0).length).toFixed(1)
    : 0;

  // DataZoom: mostra janela de ~14 pontos, com scroll se tiver mais
  const totalPts = labels.length;
  const showPts  = Math.min(14, totalPts);
  const zoomEnd  = 100;
  const zoomStart = totalPts > showPts ? Math.round((1 - showPts / totalPts) * 100) : 0;
  const showLabels = totalPts <= 20;

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
      top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 14
    },
    dataZoom: totalPts > 7 ? [
      { type: 'slider', start: zoomStart, end: zoomEnd, height: 18, bottom: 2,
        borderColor: '#e2e8f0', fillerColor: 'rgba(0,160,163,0.12)',
        handleStyle: { color: '#00a0a3' }, textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 9, color: '#94a3b8' } },
      { type: 'inside', start: zoomStart, end: zoomEnd }
    ] : [],
    grid: { left: 36, right: 46, top: 28, bottom: totalPts > 7 ? 40 : 18 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8', rotate: totalPts > 14 ? 30 : 0 },
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
        label: { show: showLabels, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: 'JetBrains Mono' }
      },
      {
        name: 'Presentes', type: 'bar',
        data: presA.map((v, i) => ({
          value: v,
          itemStyle: { color: dias[i] === ref ? '#00a0a3' : '#5fc7c9', borderRadius: [3,3,0,0] }
        })),
        barMaxWidth: 22,
        label: { show: showLabels, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#1e293b', fontFamily: 'JetBrains Mono' }
      },
      {
        name: 'Show-up %', type: 'line', yAxisIndex: 1,
        data: pctA, smooth: false,
        symbol: 'circle', symbolSize: 7,
        itemStyle: { color: '#003462' }, lineStyle: { color: '#003462', width: 2 },
        label: { show: showLabels, formatter: p => p.value ? p.value + '%' : '', fontSize: 10, color: '#003462', fontWeight: 700, fontFamily: 'JetBrains Mono', position: 'top' },
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

// ── GRÁFICO: AGENDAMENTOS PERÍODO ─────────────────────────────────
function renderSDRAgendChart() {
  const chart = ec('sdr-ch-agend');
  if (!chart) return;

  const { dias, grupos, granular } = sdrDiasPeriodo();
  const mets   = grupos ? sdrMetricasAgrupadas(grupos, dias) : sdrMetricasPorDia(dias);
  const labels = dias.map(d => sdrLabelPeriodo(d, granular));
  const leadsA = mets.map(m => m.leadsCriados);
  const agendA = mets.map(m => m.agendGerados);
  const ref    = sdrDiaRef();

  const totalPts2  = labels.length;
  const showPts2   = Math.min(14, totalPts2);
  const zStart2    = totalPts2 > showPts2 ? Math.round((1 - showPts2 / totalPts2) * 100) : 0;
  const showLbl2   = totalPts2 <= 20;

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
      top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 14
    },
    dataZoom: totalPts2 > 7 ? [
      { type: 'slider', start: zStart2, end: 100, height: 18, bottom: 2,
        borderColor: '#e2e8f0', fillerColor: 'rgba(0,160,163,0.12)',
        handleStyle: { color: '#00a0a3' }, textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 9, color: '#94a3b8' } },
      { type: 'inside', start: zStart2, end: 100 }
    ] : [],
    grid: { left: 36, right: 12, top: 28, bottom: totalPts2 > 7 ? 40 : 18 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8', rotate: totalPts2 > 14 ? 30 : 0 },
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
        label: { show: showLbl2, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: 'JetBrains Mono' }
      },
      {
        name: 'Agendamentos gerados', type: 'bar',
        data: agendA.map((v, i) => ({
          value: v,
          itemStyle: { color: dias[i] === ref ? '#00a0a3' : '#14c0c4', borderRadius: [3,3,0,0] }
        })),
        barMaxWidth: 22,
        label: { show: showLbl2, position: 'top', formatter: p => p.value || '', fontSize: 10, fontWeight: 700, color: '#1e293b', fontFamily: 'JetBrains Mono' }
      }
    ]
  }, true);
}

// ── GRÁFICO: FONTE E HUNTER ──────────────────────────────────────
function renderSDRFonteHunter() {
  const dias7 = sdrUltimos7d();
  // Label do período global (respeita filtro selecionado)
  const { start: pStart, end: pEnd } = computeRange();
  const fmtD = s => { const [y,m,d] = s.split('-'); return `${d}/${m}`; };
  const periodoLabel = `${fmtD(pStart)} – ${fmtD(pEnd)}`;

  // Fonte: fixo 7 dias úteis (amostra representativa por fonte)
  const recs7d  = flowRecords.filter(r => r.dt_apresentacao && dias7.some(d => r.dt_apresentacao.startsWith(d)));
  // Hunter: respeita o período global selecionado
  const recsHunter = flowRecords.filter(r => r.dt_apresentacao && inPeriod(r.dt_apresentacao));

  const fonteMap = {};
  const hunterMap = {};

  recs7d.forEach(r => {
    const f  = simplifyFonteDetalhado(r);
    const su = sdrShowup(r);
    if (!fonteMap[f]) fonteMap[f] = { ag: 0, su: 0 };
    fonteMap[f].ag++; if (su) fonteMap[f].su++;
  });

  recsHunter.forEach(r => {
    const h  = r.hunter || 'Sem hunter';
    const su = sdrShowup(r);
    if (!hunterMap[h]) hunterMap[h] = { ag: 0, su: 0 };
    hunterMap[h].ag++; if (su) hunterMap[h].su++;
  });

  // ── FONTE ────────────────────────────────────────────────────────
  const fonteSorted = Object.entries(fonteMap)
    .filter(([,v]) => v.ag >= 3)
    .map(([k,v]) => ({ name: k, ag: v.ag, su: v.su, pct: +(v.su / v.ag * 100).toFixed(1) }))
    .sort((a,b) => a.pct - b.pct);

  const chFonte = ec('sdr-ch-fonte');
  if (chFonte && fonteSorted.length > 0) {
    chFonte.setOption({
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
        backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
        formatter: p => {
          const d = fonteSorted.find(f => f.name === p[0].name) || fonteSorted[p[0].dataIndex];
          return `<b>${p[0].name}</b><br/>Presentes: <b>${d.su}</b> de <b>${d.ag}</b> agendadas<br/>Show-up: <b>${p[0].value}%</b>`;
        }
      },
      grid: { left: 120, right: 72, top: 6, bottom: 8 },
      xAxis: { type: 'value', max: 100, axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      yAxis: { type: 'category', data: fonteSorted.map(f => f.name), axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: '#4a5468', fontWeight: 500, width: 110, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 18, itemStyle: { borderRadius: [0,3,3,0] },
        data: fonteSorted.map(f => ({ value: f.pct, itemStyle: { color: f.pct >= 55 ? '#059669' : f.pct >= 42 ? '#d97706' : '#dc2626' } })),
        label: { show: true, position: 'right', formatter: p => {
          const d = fonteSorted[p.dataIndex];
          return `{pct|${p.value}%}  {cnt|${d.su}/${d.ag}}`;
        }, rich: { pct: { fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: '#1e293b' }, cnt: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8' } } }
      }]
    }, true);
  } else if (chFonte) {
    chFonte.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'Sem dados suficientes (mín. 3 agendamentos por fonte)', fill: '#94a3b8', fontSize: 12, fontFamily: 'Plus Jakarta Sans' } }] }, true);
  }

  // ── HUNTER ───────────────────────────────────────────────────────
  const HUNTERS_WL = typeof HUNTERS_WHITELIST !== 'undefined' ? HUNTERS_WHITELIST : Object.keys(hunterMap);
  const hunterSorted = HUNTERS_WL
    .filter(h => hunterMap[h] && hunterMap[h].ag > 0)
    .map(h => ({ name: h.split(' ')[0], fullName: h, ag: hunterMap[h].ag, su: hunterMap[h].su, pct: +(hunterMap[h].su / hunterMap[h].ag * 100).toFixed(1) }))
    .sort((a,b) => a.pct - b.pct);

  const chHunter = ec('sdr-ch-hunter');
  if (chHunter && hunterSorted.length > 0) {
    chHunter.setOption({
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
        backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
        formatter: p => {
          const d = hunterSorted[p[0].dataIndex];
          return `<b>${d.fullName}</b><br/>Período: <b>${periodoLabel}</b><br/>Presentes: <b>${d.su}</b> de <b>${d.ag}</b> agendadas<br/>Show-up: <b>${p[0].value}%</b>`;
        }
      },
      grid: { left: 80, right: 80, top: 6, bottom: 8 },
      xAxis: { type: 'value', max: 100, axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8', formatter: '{value}%' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      yAxis: { type: 'category', data: hunterSorted.map(h => h.name), axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: '#4a5468', fontWeight: 600 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 20, itemStyle: { borderRadius: [0,3,3,0] },
        data: hunterSorted.map(h => ({ value: h.pct, itemStyle: { color: h.pct >= 55 ? '#059669' : h.pct >= 42 ? '#d97706' : '#dc2626' } })),
        label: { show: true, position: 'right', formatter: p => {
          const d = hunterSorted[p.dataIndex];
          return `{pct|${p.value}%}  {cnt|${d.su}/${d.ag}}`;
        }, rich: { pct: { fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: '#1e293b' }, cnt: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8' } } }
      }]
    }, true);
  }
}

// ── BACKLOG ──────────────────────────────────────────────────────
function renderSDRBacklog() {
  const el = document.getElementById('sdr-backlog');
  if (!el) return;

  const hoje = new Date().toISOString().slice(0, 10);

  // Janela: últimos 30 dias (evita contar histórico inteiro)
  const dt30 = new Date();
  dt30.setDate(dt30.getDate() - 30);
  const limite30 = dt30.toISOString().slice(0, 10);

  // 1. Leads sem primeiro contato — criados nos últimos 30 dias, antes de hoje,
  //    sem agendamento e sem msg wpp hunter
  const semContato = flowRecords.filter(r => {
    if (!r.criado_em || r.criado_em >= hoje) return false;
    if (r.criado_em < limite30) return false;
    return !r.dt_reuniao_agendada && !r.dt_msg_wpp_hunter;
  });

  // 2. No-shows de hoje (reunião foi hoje, sem show-up)
  const noShowsHoje = flowRecords.filter(r => {
    if (!r.dt_apresentacao || !r.dt_apresentacao.startsWith(hoje)) return false;
    const agora = new Date();
    const hAgora = agora.getHours();
    const slot = normalizeHorarioSDR(r.horario_agenda);
    // só conta como no-show se o horário já passou
    if (slot === 'Às 11h' && hAgora < 12) return false;
    if (slot === 'Às 15h' && hAgora < 16) return false;
    if (slot === 'Às 16h' && hAgora < 17) return false;
    return !sdrShowup(r);
  });

  // 3. No-shows de ontem e anteontem (últimos 2 dias úteis, excluindo hoje)
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = ontem.toISOString().slice(0, 10);
  const anteontem = new Date();
  anteontem.setDate(anteontem.getDate() - 2);
  const anteontemStr = anteontem.toISOString().slice(0, 10);

  const noShowsRecentes = flowRecords.filter(r => {
    if (!r.dt_apresentacao) return false;
    if (!r.dt_apresentacao.startsWith(ontemStr) && !r.dt_apresentacao.startsWith(anteontemStr)) return false;
    return !sdrShowup(r);
  });

  // 4. Reuniões marcadas para hoje ainda aguardando (horário não encerrado)
  const agora = new Date();
  const hAgora = agora.getHours();
  const aguardando = flowRecords.filter(r => {
    if (!r.dt_apresentacao || !r.dt_apresentacao.startsWith(hoje)) return false;
    if (sdrShowup(r)) return false;
    const slot = normalizeHorarioSDR(r.horario_agenda);
    if (slot === 'Às 11h' && hAgora >= 12) return false;
    if (slot === 'Às 15h' && hAgora >= 16) return false;
    if (slot === 'Às 16h' && hAgora >= 17) return false;
    return true;
  });

  const items = [
    {
      title: 'No-shows de hoje sem remarcação',
      sub: `Reuniões de hoje que não realizaram · horários já encerrados`,
      val: noShowsHoje.length,
      cls: noShowsHoje.length > 5 ? 'bad' : noShowsHoje.length > 0 ? 'warn' : ''
    },
    {
      title: 'No-shows recentes (ontem / anteontem)',
      sub: `Reuniões dos últimos 2 dias sem presença · pendentes de retomada`,
      val: noShowsRecentes.length,
      cls: noShowsRecentes.length > 8 ? 'bad' : noShowsRecentes.length > 3 ? 'warn' : ''
    },
    {
      title: 'Leads sem contato (últimos 30d)',
      sub: `Leads de segmento válido criados há 1+ dia sem agendamento nem msg wpp`,
      val: semContato.length,
      cls: semContato.length > 20 ? 'bad' : semContato.length > 5 ? 'warn' : ''
    },
    {
      title: 'Reuniões de hoje ainda aguardando',
      sub: `Horários ainda não encerrados e sem presença registrada`,
      val: aguardando.length,
      cls: ''
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

// ── MAPA DE VALORES: resultado_ligacao_sdr ──────────────────────
const SDR_CALL_MAP = {
  '12258': 'Atendeu — agendou',
  '12260': 'Atendeu — não agendou',
  '12262': 'Não atendeu',
  '12264': 'Caixa postal',
  '12266': 'Número errado',
};
const SDR_CALL_COLORS = {
  'Atendeu — agendou':    '#059669',
  'Atendeu — não agendou': '#00a0a3',
  'Não atendeu':          '#d97706',
  'Caixa postal':         '#94a3b8',
  'Número errado':        '#dc2626',
};

function sdrResolveCall(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  return SDR_CALL_MAP[s] || s;
}

// ── LIGAÇÕES SDR ─────────────────────────────────────────────────
function renderSDRLigacoes() {
  const kpisEl = document.getElementById('sdr-ligacoes-kpis');
  const chart  = ec('sdr-ch-ligacoes');
  if (!kpisEl || !chart) return;

  const recs = flowRecords.filter(r => inPeriod(r.criado_em) && r.resultado_ligacao_sdr);
  const total = recs.length;

  const counts = {};
  Object.values(SDR_CALL_MAP).forEach(v => { counts[v] = 0; });
  recs.forEach(r => {
    const v = sdrResolveCall(r.resultado_ligacao_sdr);
    if (v && counts[v] !== undefined) counts[v]++;
  });

  const sucesso = (counts['Atendeu — agendou'] || 0);
  const atendeu = sucesso + (counts['Atendeu — não agendou'] || 0);
  const taxaSucesso = total > 0 ? (sucesso / total * 100).toFixed(1) : '—';
  const taxaAtendeu = total > 0 ? (atendeu / total * 100).toFixed(1) : '—';

  // KPIs inline
  const kpiData = [
    { lbl: 'Total ligações', val: total, sub: 'no período', color: 'var(--navy)' },
    { lbl: 'Atenderam', val: atendeu, sub: taxaAtendeu !== '—' ? taxaAtendeu + '%' : '—', color: 'var(--teal)' },
    { lbl: 'Agendou (sucesso)', val: sucesso, sub: taxaSucesso !== '—' ? taxaSucesso + '%' : '—', color: 'var(--gr)' },
    { lbl: 'Não atendeu', val: counts['Não atendeu'] + counts['Caixa postal'], sub: 'sem resposta + cx postal', color: 'var(--or)' },
    { lbl: 'Número errado', val: counts['Número errado'], sub: 'lead inválido', color: 'var(--rd)' },
  ];

  kpisEl.innerHTML = kpiData.map((k, i) => `
    <div style="padding:12px 16px;border-right:1px solid var(--border2);${i===4?'border-right:none':''}">
      <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">${k.lbl}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:${k.color};line-height:1">${k.val}</div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:3px">${k.sub}</div>
    </div>`).join('');

  if (total === 0) {
    chart.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'Nenhuma ligação registrada no período', fill: '#94a3b8', fontSize: 12, fontFamily: 'Plus Jakarta Sans' } }] }, true);
    return;
  }

  const labels = Object.keys(counts);
  const vals   = labels.map(l => counts[l]);
  const colors = labels.map(l => SDR_CALL_COLORS[l] || '#94a3b8');

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 }, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1 },
    grid: { left: 140, right: 20, top: 12, bottom: 12 },
    xAxis: { type: 'value', axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'category', data: labels, axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: '#4a5468', fontWeight: 500 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{
      type: 'bar', barMaxWidth: 18, itemStyle: { borderRadius: [0,3,3,0] },
      data: vals.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
      label: { show: true, position: 'right', formatter: p => {
        const pct = total > 0 ? (p.value / total * 100).toFixed(1) : 0;
        return p.value + '  ' + pct + '%';
      }, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#1e293b', fontWeight: 600 }
    }]
  }, true);
}

// ── TEMPO DE AÇÃO DA SDR ─────────────────────────────────────────
function renderSDRTempo() {
  const chart = ec('sdr-ch-tempo');
  if (!chart) return;

  // Primeiro contato real = MIN(dt_msg_wpp_hunter, dt_reuniao_agendada)
  // Como os campos são só data (sem hora), medimos em DIAS corridos
  const recs = flowRecords.filter(r =>
    inPeriod(r.criado_em) && r.criado_em &&
    (r.dt_msg_wpp_hunter || r.dt_reuniao_agendada)
  );

  if (recs.length === 0) {
    chart.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'Sem dados no período', fill: '#94a3b8', fontSize: 12, fontFamily: 'Plus Jakarta Sans' } }] }, true);
    return;
  }

  // Calcula diferença em HORAS entre criação e primeiro contato.
  // criado_hora (já em UTC-3) refina o ponto de partida.
  // Campos de contato são date-only → precisão ±12h por dia de diferença.
  const diffs = recs.map(r => {
    const horaCriacao = r.criado_hora ? (() => {
      const h = parseInt(r.criado_hora.split(':')[0], 10);
      return ((h - 3) + 24) % 24; // UTC → UTC-3
    })() : 12; // fallback meio-dia
    const criado = new Date(r.criado_em + 'T00:00:00');
    criado.setHours(horaCriacao);
    const datas = [r.dt_msg_wpp_hunter, r.dt_reuniao_agendada, r.dt_interacao]
      .filter(Boolean)
      .map(d => new Date(d + 'T12:00:00')); // contato sem hora → meio-dia
    if (!datas.length) return null;
    const primeiro = new Date(Math.min(...datas));
    const horas = Math.round((primeiro - criado) / 3600000);
    return horas >= 0 ? horas : null;
  }).filter(h => h !== null && h <= 240); // exclui outliers >10 dias

  if (diffs.length === 0) {
    chart.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'Sem dados válidos', fill: '#94a3b8', fontSize: 12 } }] }, true);
    return;
  }

  const avg  = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
  const sorted = diffs.slice().sort((a, b) => a - b);
  const med  = sorted[Math.floor(sorted.length / 2)];
  const fmtH = h => h < 24 ? `${h}h` : `${(h / 24).toFixed(1).replace('.', ',')}d`;

  // Buckets em HORAS: < 24h · 24–48h · 48–72h · 3–5 dias · 5–10 dias · 10+ dias
  const buckets = ['< 24h', '24–48h', '48–72h', '3–5 dias', '5–10 dias', '10+ dias'];
  const limits  = [24, 48, 72, 120, 240, Infinity];
  const bCount  = new Array(6).fill(0);
  diffs.forEach(h => {
    for (let i = 0; i < limits.length; i++) {
      if (h < limits[i]) { bCount[i]++; break; }
    }
  });

  const total = diffs.length;
  const ate24pct = total > 0 ? (bCount[0] / total * 100).toFixed(0) : 0;

  chart.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
      backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
      formatter: p => {
        const pct = total > 0 ? (p[0].value / total * 100).toFixed(1) : 0;
        return `<b>${p[0].axisValue}</b><br/>Leads: <b>${p[0].value}</b> (${pct}%)`;
      }
    },
    grid: { left: 50, right: 20, top: 44, bottom: 24 },
    graphic: [
      { type: 'text', left: 14, top: 10, style: {
        text: `Média: ${fmtH(avg)} · Mediana: ${fmtH(med)} · ${ate24pct}% contatados em < 24h`,
        fill: '#003462', fontSize: 11, fontWeight: 700, fontFamily: 'Plus Jakarta Sans'
      }},
      { type: 'text', right: 14, top: 10, style: {
        text: `${total} leads com 1º contato registrado`,
        fill: '#64748b', fontSize: 11, fontFamily: 'Plus Jakarta Sans'
      }},
    ],
    xAxis: {
      type: 'category', data: buckets,
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10.5, color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLine: { show: false }, axisTick: { show: false }
    },
    series: [{
      type: 'bar', barMaxWidth: 40,
      data: bCount.map((v, i) => ({
        value: v,
        itemStyle: {
          color: i === 0 ? '#059669' : i <= 1 ? '#00a0a3' : i <= 2 ? '#d97706' : '#dc2626',
          borderRadius: [3,3,0,0]
        }
      })),
      label: {
        show: true, position: 'top',
        formatter: p => p.value > 0 ? p.value : '',
        fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: '#1e293b'
      }
    }]
  }, true);
}

// ── HEATMAP HORA × DIA DA SEMANA ─────────────────────────────────
function renderSDRHeatmap() {
  const chart = ec('sdr-ch-heatmap');
  if (!chart) return;

  const DIAS  = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const FAIXAS = ['00–06h','06–08h','08–10h','10–12h','12–14h','14–16h','16–18h','18–20h','20–24h'];
  const FAIXA_LIMITES = [6, 8, 10, 12, 14, 16, 18, 20, 24];

  // Filtra registros com criado_em válido (ainda em UTC do Bitrix)
  // A conversão para BRT é feita dentro do loop para acertar data E hora juntas
  const recs = flowRecords.filter(r => r.criado_em);

  // Helper: converte criado_em (data UTC) + criado_hora (hora UTC) → Date em BRT
  function dtBRT(r) {
    const hUTC = r.criado_hora ? parseInt(r.criado_hora.split(':')[0], 10) : 12;
    const utc = new Date(r.criado_em + 'T' + String(isNaN(hUTC) ? 12 : hUTC).padStart(2,'0') + ':00:00Z');
    return new Date(utc.getTime() - 3 * 3600000); // UTC-3
  }

  // Verifica se há hora disponível
  const temHora = recs.some(r => r.criado_hora);

  if (!temHora) {
    // Fallback: só dia da semana (sem hora → usa criado_em direto)
    const dowCount = new Array(7).fill(0);
    recs.forEach(r => {
      if (!inPeriod(r.criado_em)) return;
      const dow = (new Date(r.criado_em + 'T12:00:00').getDay() + 6) % 7;
      dowCount[dow]++;
    });
    const maxV = Math.max(...dowCount, 1);
    chart.setOption({
      tooltip: { trigger: 'item', formatter: p => `<b>${DIAS[p.data[1]]}</b><br/>Leads: <b>${p.data[2]}</b>`, textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 }, backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1 },
      visualMap: { min: 0, max: maxV, calculable: false, show: true, orient: 'vertical', right: 8, top: 'center', inRange: { color: ['#f1f5f9','#bfdbfe','#003462'] }, textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 9, color: '#94a3b8' } },
      grid: { left: 44, right: 60, top: 10, bottom: 10 },
      xAxis: { type: 'category', data: ['Volume'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
      yAxis: { type: 'category', data: DIAS, axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 11, color: '#4a5468', fontWeight: 500 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{ type: 'heatmap', data: dowCount.map((v,i) => [0, i, v]), label: { show: true, formatter: p => p.data[2] > 0 ? String(p.data[2]) : '', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700 }, itemStyle: { borderWidth: 2, borderColor: '#fff' } }]
    }, true);
    return;
  }

  // Heatmap real: FAIXA × DIA DA SEMANA
  // matrix[faixa][dow] = count
  const matrix = Array.from({ length: FAIXAS.length }, () => new Array(7).fill(0));

  // Hora atual em BRT para bloquear horas futuras (independente de TZ do campo)
  const _nowBRT = new Date(Date.now() - 3 * 3600000);
  const _todayBRT = _nowBRT.toISOString().slice(0, 10);
  const _nowHBRT  = _nowBRT.getUTCHours();

  recs.forEach(r => {
    if (!r.criado_hora) return;
    const dt = dtBRT(r);
    const dateBRT = dt.toISOString().slice(0, 10);
    if (!inPeriod(dateBRT)) return;
    const hBRT = dt.getUTCHours();
    // Guarda de segurança: nunca exibir hora futura para hoje
    if (dateBRT === _todayBRT && hBRT > _nowHBRT) return;
    const dow = (dt.getUTCDay() + 6) % 7;
    const fi  = FAIXA_LIMITES.findIndex(lim => hBRT < lim);
    if (fi >= 0) matrix[fi][dow]++;
  });

  const data = [];
  let maxVal = 0;
  for (let fi = 0; fi < FAIXAS.length; fi++) {
    for (let di = 0; di < 7; di++) {
      const v = matrix[fi][di];
      if (v > maxVal) maxVal = v;
      data.push([di, fi, v]);
    }
  }

  chart.setOption({
    tooltip: {
      position: 'top',
      textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
      backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
      formatter: p => `<b>${DIAS[p.data[0]]} · ${FAIXAS[p.data[1]]}</b><br/>Leads: <b>${p.data[2]}</b>`
    },
    visualMap: {
      min: 0, max: maxVal || 1,
      calculable: false, show: true,
      orient: 'vertical', right: 4, top: 'center',
      inRange: { color: ['#f1f5f9','#93c5fd','#1d4ed8','#003462'] },
      textStyle: { fontFamily: 'Plus Jakarta Sans', fontSize: 9, color: '#94a3b8' }
    },
    grid: { left: 58, right: 50, top: 10, bottom: 24 },
    xAxis: {
      type: 'category', data: DIAS,
      splitArea: { show: true },
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10.5, color: '#4a5468', fontWeight: 600 },
      axisLine: { show: false }, axisTick: { show: false }
    },
    yAxis: {
      type: 'category', data: FAIXAS,
      splitArea: { show: true },
      axisLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 10, color: '#4a5468' },
      axisLine: { show: false }, axisTick: { show: false }
    },
    series: [{
      type: 'heatmap', data,
      label: {
        show: true,
        formatter: p => p.data[2] > 0 ? String(p.data[2]) : '',
        fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700,
        color: (params) => params.data[2] > maxVal * 0.55 ? '#ffffff' : '#1e293b'
      },
      itemStyle: { borderWidth: 2, borderColor: '#fff', borderRadius: 3 },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } }
    }]
  }, true);
}

// ── SEGMENTOS NO PIPELINE — TAXAS DE CONVERSÃO ───────────────────
function renderSDRSegmentos() {
  const elChart = document.getElementById('sdr-ch-segmentos');
  if (!elChart) return;

  // Normaliza segmento
  function normSeg(r) {
    const v = (r.segmento_loja || r.segmento_aberto || '').trim();
    if (!v) return 'Não informado';
    const l = v.toLowerCase();
    if (/celul|phone|cell|mobi/i.test(l)) return 'Celular';
    if (/móv|mov|furni/i.test(l)) return 'Móveis';
    if (/ótic|otic|óculo|oculo|eyew/i.test(l)) return 'Óculos';
    if (/eletrodom/i.test(l)) return 'Eletrodomésticos';
    if (/eletr/i.test(l)) return 'Eletrônicos';
    if (/infor|comput/i.test(l)) return 'Informática';
    if (/moda|roupa|vestu/i.test(l)) return 'Moda';
    if (/tim\b|vivo|claro|oi\b|telecom/i.test(l)) return 'Telecom';
    return 'Outros';
  }

  const recs = flowRecords.filter(r => inPeriod(r.criado_em));

  // Agrupa por segmento
  const segData = {};
  recs.forEach(r => {
    const seg = normSeg(r);
    if (!segData[seg]) segData[seg] = { total: 0, agend: 0, showup: 0, pag: 0 };
    segData[seg].total++;
    if (r.dt_reuniao_agendada)  segData[seg].agend++;
    if (r.dt_apresentacao && nstr(novo(r.id_bitrix), '[Show-up] Data entrada')) segData[seg].showup++;
    if (r.etapa === 'Pagamento Recebido') segData[seg].pag++;
  });

  const segs = Object.keys(segData)
    .filter(s => segData[s].total >= 2)
    .sort((a,b) => segData[b].total - segData[a].total);

  if (segs.length === 0) {
    const chart = ec('sdr-ch-segmentos');
    if (chart) chart.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'Sem dados de segmento no período', fill: '#94a3b8', fontSize: 12, fontFamily: 'Plus Jakarta Sans' } }] }, true);
    return;
  }

  // Renderiza como tabela HTML (mais legível que gráfico para taxas)
  elChart.style.height = 'auto';
  const pct = (n, d) => d > 0 ? (n / d * 100).toFixed(1) + '%' : '—';
  const cor = (v) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '#94a3b8';
    if (n >= 50) return '#059669';
    if (n >= 30) return '#d97706';
    return '#dc2626';
  };

  elChart.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
          <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Segmento</th>
          <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Total leads</th>
          <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Agendou</th>
          <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Taxa agend.</th>
          <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Show-up</th>
          <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Show-up %</th>
          <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Pagamentos</th>
          <th style="padding:10px 14px;text-align:right;font-size:10px;font-weight:700;color:#8892a3;text-transform:uppercase;letter-spacing:.5px">Conv. global</th>
        </tr>
      </thead>
      <tbody>
        ${segs.map((s, idx) => {
          const d = segData[s];
          const taxaAgend = pct(d.agend, d.total);
          const taxaShow  = pct(d.showup, d.agend);
          const taxaConv  = pct(d.pag, d.total);
          return `
            <tr style="${idx % 2 === 0 ? '' : 'background:#fafbfc'}">
              <td style="padding:10px 14px;font-weight:600;color:#1e2432">${s}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.total}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.agend}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${cor(taxaAgend)}">${taxaAgend}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.showup}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${cor(taxaShow)}">${taxaShow}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;color:#4a5468">${d.pag}</td>
              <td style="padding:10px 14px;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:${cor(taxaConv)}">${taxaConv}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}
