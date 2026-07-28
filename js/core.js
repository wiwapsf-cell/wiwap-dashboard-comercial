// ══════════════════════════════════════════════════════════════
// WIWAP DASHBOARD v5 — dados reais (Bitrix + Faturamento + Meta + Novo Dash)
// ══════════════════════════════════════════════════════════════
const CSV_URL  = "https://docs.google.com/spreadsheets/d/176oVy1668Vy5jRGXkhdMbK5QqXcNUTrmPiaaDikuOv4/export?format=csv&gid=0";
const CSV_FAT  = "https://docs.google.com/spreadsheets/d/176oVy1668Vy5jRGXkhdMbK5QqXcNUTrmPiaaDikuOv4/export?format=csv&gid=2003547034";
const CSV_META = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRh52GL5azhYBBvLzLDVTzNK2oIMsNYxWecBjryXJgG3AvhB_OKI-zNvkKa7DVUX_do-Cca7VmuEoVA/pub?gid=1579259108&single=true&output=csv";
const CSV_NOVO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0F7GTpa8okqDP2lvXghPGHS0goJKdBV4YbK-d0tumHLwj7BaUnthl63xwe6lgtqdO76OqValImZTN/pub?gid=156694029&single=true&output=csv";

// Cores mockup
const NV='#003462',TL='#00a0a3',TL2='#5fc7c9',GR='#059669',RD='#dc2626',OR='#d97706',PU='#7c3aed',GY='#94a3b8',AM='#f59e0b',SK='#0ea5e9';
const TP={backgroundColor:'#fff',borderColor:'#e2e8f0',textStyle:{fontFamily:'Plus Jakarta Sans',fontSize:11}};
const AX={fontFamily:'Plus Jakarta Sans',fontSize:10,color:'#64748b'};
const F='Plus Jakarta Sans';

const TICKET_MEDIO = 860;
const META_MENSAL = 300000;
const META_POR_HUNTER = 60000;
const META_SETUPS_MES_HUNTER = 70;
const META_SETUPS_SEM_HUNTER = 18;
const OUTROS_SEGMENTOS = 'Outros Segmentoss';

let fatRecords = [];
let metaRecords = [];
let novoMap = {};
let allRecords = [], flowRecords = [], outrosRecords = [];
let RESOLVED_COLS = {};
let maxDate = '1970-01-01';
let selectedHunter = '';
let activeTab = 'com';
let mktInited = false;

// ===== PARSE =====
function parseBRL(s){ if(!s)return 0; return parseFloat(String(s).replace(/R\$\s*/g,'').replace(/\./g,'').replace(',','.'))||0; }
function parseDateBR(s){
  if(!s)return null;
  const str=String(s).trim();
  const m=str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m){const[,d,mo,y]=m;return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;}
  if(/^\d{4}-\d{2}-\d{2}/.test(str))return str.slice(0,10);
  return null;
}
function brToISO(s){ return parseDateBR(s); }

// ===== DIAS ÚTEIS =====
function feriadosBR(ano){
  return [`${ano}-01-01`,`${ano}-04-21`,`${ano}-05-01`,`${ano}-09-07`,`${ano}-10-12`,`${ano}-11-02`,`${ano}-11-15`,`${ano}-12-25`];
}
function isBusinessDay(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  const dow=d.getDay();
  if(dow===0||dow===6)return false;
  return !feriadosBR(d.getFullYear()).includes(dateStr);
}
function countBusinessDaysInMonth(year,month){
  let c=0;const last=new Date(year,month+1,0).getDate();
  for(let day=1;day<=last;day++){const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(isBusinessDay(iso))c++;}
  return c;
}
function countBusinessDaysUpTo(year,month,day){
  let c=0;
  for(let d=1;d<=day;d++){const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;if(isBusinessDay(iso))c++;}
  return c;
}

// ===== HUNTERS =====
const HUNTERS_WHITELIST=['Ana Melo','Elizabete Soares','Jade Sena','Jose Rodrigo Moreira','Vinicius Pedro'];
const normName=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const WHITELIST_NORM=HUNTERS_WHITELIST.map(normName);
function isHunter(name){return WHITELIST_NORM.includes(normName(name));}
function canonHunter(name){const i=WHITELIST_NORM.indexOf(normName(name));return i>=0?HUNTERS_WHITELIST[i]:null;}
// Match hunter no faturamento (primeiro nome)
function matchFat(r,hunter){
  if(!hunter)return true;
  if(!r.nome)return false;
  return hunter.trim().split(/\s+/)[0].toLowerCase()===r.nome.trim().split(/\s+/)[0].toLowerCase();
}

// ===== ESTADO =====
const ESTADO_NOMES={SP:'São Paulo',RJ:'Rio de Janeiro',MG:'Minas Gerais',PR:'Paraná',RS:'Rio Grande do Sul',SC:'Santa Catarina',BA:'Bahia',GO:'Goiás',PA:'Pará',CE:'Ceará',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',PE:'Pernambuco',ES:'Espírito Santo',RN:'Rio Grande do Norte',PI:'Piauí',PB:'Paraíba',AL:'Alagoas',SE:'Sergipe',AM:'Amazonas',RO:'Rondônia',TO:'Tocantins',AC:'Acre',AP:'Amapá',RR:'Roraima',DF:'Distrito Federal'};
const ESTADO_NORM={'SAO PAULO':'SP','SÃO PAULO':'SP','SP':'SP','RIO DE JANEIRO':'RJ','RJ':'RJ','MINAS GERAIS':'MG','MG':'MG','MINAS':'MG','PARANA':'PR','PARANÁ':'PR','PR':'PR','RIO GRANDE DO SUL':'RS','RS':'RS','SANTA CATARINA':'SC','SC':'SC','BAHIA':'BA','BA':'BA','GOIAS':'GO','GOIÁS':'GO','GO':'GO','PARA':'PA','PARÁ':'PA','PA':'PA','CEARA':'CE','CEARÁ':'CE','CE':'CE','MARANHAO':'MA','MARANHÃO':'MA','MA':'MA','MATO GROSSO':'MT','MT':'MT','MATO GROSSO DO SUL':'MS','MS':'MS','PERNAMBUCO':'PE','PE':'PE','ESPIRITO SANTO':'ES','ESPÍRITO SANTO':'ES','ES':'ES','RIO GRANDE DO NORTE':'RN','RN':'RN','PIAUI':'PI','PIAUÍ':'PI','PI':'PI','PARAIBA':'PB','PARAÍBA':'PB','PB':'PB','ALAGOAS':'AL','AL':'AL','SERGIPE':'SE','SE':'SE','AMAZONAS':'AM','AM':'AM','RONDONIA':'RO','RONDÔNIA':'RO','RO':'RO','TOCANTINS':'TO','TO':'TO','ACRE':'AC','AC':'AC','AMAPA':'AP','AMAPÁ':'AP','AP':'AP','RORAIMA':'RR','RR':'RR','DISTRITO FEDERAL':'DF','DF':'DF','BRASILIA':'DF','BRASÍLIA':'DF'};
function normEstado(v){ if(!v)return null; return ESTADO_NORM[String(v).trim().toUpperCase()]||null; }

// ===== COLUNAS BITRIX =====
const COL_MAP={
  criado_em:['Criado no'], responsavel:['Pessoa responsável'], etapa:['Etapa'], fonte:['Fonte de Lead'],
  nome_card:['Nome'], segmento_loja:['Qual o Segmento da Sua Loja?'], segmento_aberto:['Qual o segmento da sua loja? (Campo Aberto Tráfego):'],
  cidade:['Cidade:'], estado_raw:['Estado:'], motivo_descarte:['Motivo de Descarte:'],
  dt_msg_wpp_hunter:['dt_<msg._wpp_hunter>_first','dt_<msg_wpp_hunter>_first'],
  dt_reuniao_agendada:['dt_<reuniao_agendada)_first','dt_<reuniao_agendada>_first'],
  horario_agenda:['Horário de Agenda (Opções):'], dt_interacao:['dt_<interacao>_first'],
  dt_pagamento:['dt_<pagamento_recebido>_first'], ultima_interacao:['Qual foi a última interação?'],
  motivo_wpp_hunter:['Porque você está movendo para Msg. de Wpp Hunter?'],
  utm_source:['UTM Source'], utm_medium:['UTM Medium'], campanha_n8n:['Campanha ativa n8n:'],
  enviou_card:['Enviou o card de geração de valor? (SDR)'],
  dt_apresentacao:['Data da Apresentação:','Data da Apresentação','Data da Apresentacao:'],
  id_bitrix:['ID Bitrix']
};
const DATE_FIELDS=['criado_em','dt_msg_wpp_hunter','dt_reuniao_agendada','dt_apresentacao','dt_interacao','dt_pagamento'];
function resolveColumns(rawRows){
  RESOLVED_COLS={}; if(!rawRows.length)return;
  const realCols=Object.keys(rawRows[0]);
  const norm=s=>String(s).trim().replace(/\r/g,'');
  const realByNorm={}; for(const rc of realCols)realByNorm[norm(rc)]=rc;
  for(const[k,poss]of Object.entries(COL_MAP)){
    let best=null,bestCount=-1;
    for(const p of poss){const rc=realByNorm[norm(p)];if(!rc)continue;let c=0;for(const r of rawRows){const v=r[rc];if(v!==undefined&&v!==null&&String(v).trim()!=='')c++;}if(c>bestCount){bestCount=c;best=rc;}}
    RESOLVED_COLS[k]=best;
  }
}
function processRow(row){
  const obj={};
  for(const[k,col]of Object.entries(RESOLVED_COLS)){const v=col?row[col]:undefined;obj[k]=(v===undefined||v===null||String(v).trim()==='')?null:String(v).trim();}
  DATE_FIELDS.forEach(f=>{obj[f]=brToISO(obj[f]);});
  obj.estado_uf=normEstado(obj.estado_raw); delete obj.estado_raw;
  obj.hunter=canonHunter(obj.responsavel);
  return obj;
}
function processFatRow(row){
  return { bandeira:(row['Bandeira']||'').trim(), forma_pgto:(row['Forma Pagamento']||'').trim(),
    valor:parseBRL(row['Valor']), dt_pagamento:parseDateBR(row['Data Pagamento']), nome:(row['Nome']||'').trim(),
    dt_estorno:parseDateBR(row['Data de Modificação']), estorno:!!(row['Data de Modificação']&&row['Data de Modificação'].trim()) };
}
function processMetaRow(row){
  const keys=Object.keys(row);
  const dtKey=keys.find(k=>k.includes('nício'))||keys[0];
  const valKey=keys.find(k=>k.includes('Valor'))||keys[4];
  const campKey=keys.find(k=>k.includes('campanha'))||keys[2];
  return { dt_inicio:parseDateBR(row[dtKey]), campanha:(row[campKey]||'').trim(), valor:parseFloat(String(row[valKey]||'0').replace(',','.'))||0 };
}

// ===== FORMATTERS =====
const fmt=n=>new Intl.NumberFormat('pt-BR').format(n);
const fmtMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
const fmtPct=(n,dec=1)=>isNaN(n)||!isFinite(n)?'—':(n*100).toFixed(dec).replace('.',',')+'%';
const pct=(a,t)=>t>0?+(a/t*100).toFixed(1):0;
const fmtR=n=>'R$ '+Math.round(n).toLocaleString('pt-BR');
function setTxt(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}

// ===== TICKET MÉDIO REAL =====
function getTicketMedioReal(){
  const f=fatRecords.filter(r=>r.dt_pagamento&&inPeriod(r.dt_pagamento)&&!r.estorno&&matchFat(r,selectedHunter));
  if(!f.length)return TICKET_MEDIO;
  return f.reduce((s,r)=>s+r.valor,0)/f.length;
}

// ===== PERÍODO =====
let periodState={type:'preset',preset:'30d',start:null,end:null};
function computeRange(){
  const end=maxDate; const endD=new Date(end+'T12:00:00'); let startD=new Date(endD);
  if(periodState.type==='custom'&&periodState.start&&periodState.end)return{start:periodState.start,end:periodState.end};
  switch(periodState.preset){
    case'hoje':return{start:end,end};
    case'd1':{const d=new Date(endD);d.setDate(d.getDate()-1);const s=d.toISOString().slice(0,10);return{start:s,end:s};}
    case'7d':startD.setDate(endD.getDate()-6);break;
    case'30d':startD.setDate(endD.getDate()-29);break;
    case'90d':startD.setDate(endD.getDate()-89);break;
    case'12m':startD.setMonth(endD.getMonth()-12);break;
    case'tudo':return{start:'2000-01-01',end};
    default:startD.setDate(endD.getDate()-29);
  }
  return{start:startD.toISOString().slice(0,10),end};
}
function inPeriod(dateStr){ if(!dateStr)return false; const{start,end}=computeRange(); return dateStr>=start&&dateStr<=end; }

// ===== FONTES =====
function simplifyFonte(f){
  if(!f)return'Sem fonte';
  const s=String(f).trim();
  const m=s.match(/PB\d{2}/i); if(m)return'Meta - '+m[0].toUpperCase();
  if(/meta|facebook|instagram|fb|ig/i.test(s))return'Meta Ads';
  if(/google|gads/i.test(s))return'Google Ads';
  if(/organ/i.test(s))return'Orgânico';
  if(/indica/i.test(s))return'Indicação';
  return s.length>22?s.slice(0,20)+'…':s;
}

// ===== ECHARTS helper (dispose+init) =====
function ec(id){const e=document.getElementById(id);if(!e)return null;const ex=echarts.getInstanceByDom(e);if(ex)ex.dispose();return echarts.init(e);}
function resizeVisible(){document.querySelectorAll('.pane.on [id^="ch-"]').forEach(e=>{const i=echarts.getInstanceByDom(e);if(i)i.resize();});}
