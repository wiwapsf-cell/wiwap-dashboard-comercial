// Estado confirmado pelo exportador, sem chaves privadas no navegador.
function parseSyncRow(rows,channel){
 const row=(rows||[]).find(r=>String(r['ID Bitrix']||'').trim()==='__WIWAP_SYNC_'+channel.toUpperCase()+'__');
 if(!row)return null;
 try{const x=JSON.parse(row[channel==='base'?'Nome':'[BOT] Pendência ou encaminhamento']||'');return x.version===1&&x.channel===channel?x:null;}catch(e){return null;}
}
function showSyncHealth(){
 const container=document.getElementById('sync-status');if(!container)return;
 const now=Date.now(),items=[],problems=[];
 const stamp=x=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x));
 for(const [channel,label] of [['base','Base principal'],['bot','Bot']]){
  const state=dashboardSync[channel];
  if(!state){items.push(label+': sincronização ainda não verificável');problems.push(label);continue;}
  if(state.pending){items.push(label+': recuperação de alterações em andamento');problems.push(label);continue;}
  const date=Date.parse(state.synced_through);
  if(!Number.isFinite(date)){items.push(label+': sem data de conclusão válida');problems.push(label);continue;}
  items.push(label+': alterações conferidas até '+stamp(date));
  if(now-date>5*60000)problems.push(label);
 }
 if(dashboardSync.readError)problems.push('falha na leitura das planilhas');
 const bad=problems.length>0;container.dataset.state=bad?'warning':'ok';
 container.innerHTML='<strong>'+(bad?'Dados podem estar incompletos':'Sincronização recente')+'</strong> · '+items.join(' · ')+(bad?'<br>Confira os fluxos indicados antes de interpretar zeros ou comparar totais com o CRM.':'');
 document.getElementById('data-health').textContent=bad?'Atenção à atualização das bases':'Bases com sincronização recente';
 const last=dashboardSync.readAt;document.getElementById('upd').textContent=last?'Leitura das planilhas: '+stamp(last):'Sem leitura concluída';
}
const renderAllBeforeSyncHealth=renderAll;
renderAll=function(){renderAllBeforeSyncHealth();showSyncHealth();};
let dashboardRefreshTimer=setInterval(()=>{if(document.visibilityState==='visible')loadData();},120000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(!dashboardSync.readAt||Date.now()-Date.parse(dashboardSync.readAt)>120000))loadData();});
