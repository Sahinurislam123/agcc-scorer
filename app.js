const KEY='agcc-scorer-v1';
const $=id=>document.getElementById(id);
const uid=()=>Math.random().toString(36).slice(2,9);
const defaultState=()=>({teams:[{id:'t1',name:'Arati Knight Riders',short:'AKR'},{id:'t2',name:'Royal Challengers Arati',short:'RCA'},{id:'t3',name:'Arati Super Kings',short:'ASK'},{id:'t4',name:'Arati Indians',short:'AI'}],players:[],fixtures:[],settings:{name:'ARATI GRAM CRICKET CARNIVAL',overs:5,maxXI:11},match:null});
let db;
try{db=JSON.parse(localStorage.getItem(KEY))||defaultState()}catch{db=defaultState()}
let undoStack=[];
let cloudClient=null, cloudSession=null, cloudTimer=null, cloudApplying=false, cloudChannel=null;
function save(){
  localStorage.setItem(KEY,JSON.stringify(db));
  if(cloudClient && cloudSession && !cloudApplying){
    clearTimeout(cloudTimer);
    cloudTimer=setTimeout(()=>pushCloudState(),500);
  }
}
async function pushCloudState(){
  if(!cloudClient || !cloudSession || cloudApplying) return;
  const role=cloudSession.user?.app_metadata?.role;
  if(role!=='admin'){ setAuthStatus('SIGNED IN · READ ONLY'); return; }
  const {error}=await cloudClient.from('app_state').upsert({id:'main',state:db,updated_at:new Date().toISOString()},{onConflict:'id'});
  if(error) toast('Cloud save failed: '+error.message);
}
function setAuthStatus(text){const el=$('authStatus');if(el)el.textContent=text;}
async function initCloud(){
  const cfg=window.AGCC_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase?.createClient){setAuthStatus('LOCAL MODE');return;}
  cloudClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  $('storageBadge').textContent='CLOUD AVAILABLE';
  const {data:{session}}=await cloudClient.auth.getSession();
  cloudSession=session;
  setAuthStatus(session?(session.user?.app_metadata?.role==='admin'?'ADMIN SIGNED IN':'SIGNED IN · READ ONLY'):'NOT SIGNED IN');
  if(session) await pullCloudState();
  else await pullPublicCloudState();
  cloudClient.auth.onAuthStateChange(async (_event,sessionNow)=>{
    cloudSession=sessionNow;
    setAuthStatus(sessionNow?(sessionNow.user?.app_metadata?.role==='admin'?'ADMIN SIGNED IN':'SIGNED IN · READ ONLY'):'NOT SIGNED IN');
    if(sessionNow) await pullCloudState();
  });
  cloudChannel=cloudClient.channel('agcc-app-state').on('postgres_changes',{event:'*',schema:'public',table:'app_state',filter:'id=eq.main'},payload=>{
    if(payload.new?.state){cloudApplying=true;db=payload.new.state;localStorage.setItem(KEY,JSON.stringify(db));render();cloudApplying=false;}
  }).subscribe();
}
async function pullPublicCloudState(){
  if(!cloudClient)return;
  const {data,error}=await cloudClient.from('app_state').select('state').eq('id','main').maybeSingle();
  if(!error&&data?.state){cloudApplying=true;db=data.state;localStorage.setItem(KEY,JSON.stringify(db));render();cloudApplying=false;}
}
async function pullCloudState(){
  if(!cloudClient)return;
  const {data,error}=await cloudClient.from('app_state').select('state').eq('id','main').maybeSingle();
  if(error){toast('Cloud load failed: '+error.message);return;}
  if(data?.state){cloudApplying=true;db=data.state;localStorage.setItem(KEY,JSON.stringify(db));render();cloudApplying=false;}
  else if(cloudSession?.user?.app_metadata?.role==='admin'){await pushCloudState();}
}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2300)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function team(id){return db.teams.find(t=>t.id===id)}
function teamLabel(id){const t=team(id);return t?t.name:'Unknown team'}
function playersFor(teamId){return db.players.filter(p=>p.teamId===teamId)}
function getMatch(){
  if(!db.match){
    db.match=newMatch(db.teams[0]?.id,db.teams[1]?.id,db.settings.overs);
  }
  db.match.overs=Number(db.match.overs)||Number(db.settings.overs)||5;
  db.match.innings.forEach(i=>{
    i.overs=Number(i.overs)||db.match.overs;
  });
  return db.match;
}
function blankInnings(teamId,oppId){return {teamId,oppId,runs:0,wickets:0,balls:0,batters:{},bowlers:{},striker:null,nonStriker:null,bowler:null,history:[],extras:{wide:0,noball:0,bye:0,legbye:0,penalty:0},completed:false}}
function newMatch(a,b,overs){return {id:uid(),title:'Friendly Match',overs:Number(overs)||5,inningsNo:1,target:null,innings:[blankInnings(a,b)],status:'live',result:''}}
function inns(){return getMatch().innings[getMatch().inningsNo-1]}
function batterRecord(i,pid){if(!pid)return null;if(!i.batters[pid])i.batters[pid]={runs:0,balls:0,fours:0,sixes:0,out:false,howOut:''};return i.batters[pid]}
function bowlerRecord(i,pid){if(!pid)return null;if(!i.bowlers[pid])i.bowlers[pid]={runs:0,balls:0,wickets:0,wides:0,noballs:0};return i.bowlers[pid]}
function ensureLineups(i){const ps=playersFor(i.teamId);if(!i.striker)i.striker=ps.find(p=>p.xi)?.id||ps[0]?.id||null;if(!i.nonStriker)i.nonStriker=ps.find(p=>p.xi&&p.id!==i.striker)?.id||ps.find(p=>p.id!==i.striker)?.id||null;const bs=playersFor(i.oppId);if(!i.bowler)i.bowler=bs.find(p=>p.role==='Bowler'||p.role==='All-rounder')?.id||bs[0]?.id||null;if(i.striker)batterRecord(i,i.striker);if(i.nonStriker)batterRecord(i,i.nonStriker);if(i.bowler)bowlerRecord(i,i.bowler)}
function takeSnapshot(){undoStack.push(JSON.stringify(db));if(undoStack.length>50)undoStack.shift()}
function canBall(){const i=inns();return !i.completed&&getMatch().status==='live'&&i.balls<i.overs*6&&i.wickets<10}
function legalBall(){const i=inns();i.balls++;const b=bowlerRecord(i,i.bowler);if(b)b.balls++}
function overText(balls){return `${Math.floor(balls/6)}.${balls%6}`}
function swapStrike(){const i=inns();[i.striker,i.nonStriker]=[i.nonStriker,i.striker]}
function maybeFinish(){const m=getMatch(),i=inns();if(m.inningsNo===2&&m.target!==null&&i.runs>=m.target){i.completed=true;m.status='completed';m.result=`${teamLabel(i.teamId)} won by ${10-i.wickets} wicket(s)`;syncFixture(m);return}if(i.balls>=i.overs*6||i.wickets>=10){i.completed=true;if(m.inningsNo===1){m.status='innings-break'}else{m.status='completed';if(i.runs===m.target-1)m.result='Match tied';else if(i.runs<m.target-1)m.result=`${teamLabel(i.oppId)} won by ${m.target-1-i.runs} run(s)`;else m.result=`${teamLabel(i.teamId)} won`;syncFixture(m)}}}
function syncFixture(m){const f=db.fixtures.find(x=>x.matchId===m.id);if(f){f.status='completed';f.result=m.result;f.scoreA=m.innings.find(i=>i.teamId===f.a)?.runs??null;f.scoreB=m.innings.find(i=>i.teamId===f.b)?.runs??null}}
function recordRuns(n){if(!canBall())return toast('ইনিংস শেষ হয়েছে।');takeSnapshot();const i=inns(),br=batterRecord(i,i.striker),bo=bowlerRecord(i,i.bowler);i.runs+=n;if(br){br.runs+=n;br.balls++;if(n===4)br.fours++;if(n===6)br.sixes++}if(bo)bo.runs+=n;legalBall();i.history.push({label:String(n),type:n===4?'four':n===6?'six':'run'});if(n%2===1)swapStrike();if(i.balls%6===0)swapStrike();maybeFinish();save();render();if(getMatch().status==='completed')toast(getMatch().result)}
function recordExtra(type){if(!canBall())return toast('ইনিংস শেষ হয়েছে।');takeSnapshot();const i=inns(),bo=bowlerRecord(i,i.bowler);let runs=1,label=type.toUpperCase(),legal=true;if(type==='wide'||type==='noball'){legal=false;if(type==='wide'&&bo)bo.wides++;if(type==='noball'&&bo)bo.noballs++}if(type==='penalty')runs=5;i.runs+=runs;i.extras[type]=(i.extras[type]||0)+runs;if(bo&&type!=='bye'&&type!=='legbye')bo.runs+=runs;if(type==='bye'||type==='legbye'){const br=batterRecord(i,i.striker);if(br)br.balls++}if(legal)legalBall();i.history.push({label,type:'extra'});maybeFinish();save();render()}
function recordWicket(){if(!canBall())return toast('ইনিংস শেষ হয়েছে।');takeSnapshot();const i=inns(),br=batterRecord(i,i.striker),bo=bowlerRecord(i,i.bowler);i.wickets++;if(br){br.out=true;br.howOut='out';br.balls++}if(bo)bo.wickets++;legalBall();i.history.push({label:'W',type:'wicket'});const available=playersFor(i.teamId).filter(p=>p.id!==i.striker&&p.id!==i.nonStriker&&!i.batters[p.id]?.out);i.striker=available.find(p=>p.xi)?.id||available[0]?.id||null;if(i.striker)batterRecord(i,i.striker);maybeFinish();save();render()}
function switchInnings(){const m=getMatch(),i=inns();if(m.status==='completed')return toast(m.result);if(m.inningsNo===1){i.completed=true;m.target=i.runs+1;m.inningsNo=2;const next=blankInnings(i.oppId,i.teamId);next.overs=m.overs;m.innings.push(next);m.status='live';ensureLineups(next);save();render();toast(`২য় ইনিংস শুরু। লক্ষ্য ${m.target} রান।`)}else{maybeFinish();if(m.status!=='completed'){m.status='completed';m.result=i.runs===m.target-1?'Match tied':i.runs<m.target-1?`${teamLabel(i.oppId)} won by ${m.target-1-i.runs} run(s)`:`${teamLabel(i.teamId)} won`;syncFixture(m)}save();render();toast(m.result||'Match completed')}}
function selectOptions(el,items,selected,placeholder){el.innerHTML=(placeholder?`<option value="">${esc(placeholder)}</option>`:'')+items.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.name)}</option>`).join('')}
function renderSelectors(){const m=getMatch(),i=inns();selectOptions($('batTeam'),db.teams,i.teamId);selectOptions($('bowlTeam'),db.teams,i.oppId);selectOptions($('playerTeam'),db.teams,db.teams[0]?.id);selectOptions($('squadTeam'),db.teams,db.teams[0]?.id);selectOptions($('fixtureA'),db.teams,db.teams[0]?.id);selectOptions($('fixtureB'),db.teams,db.teams[1]?.id);const ps=playersFor(i.teamId),bs=playersFor(i.oppId);selectOptions($('strikerSelect'),ps,i.striker,'Choose batter');selectOptions($('nonStrikerSelect'),ps,i.nonStriker,'Choose batter');selectOptions($('bowlerSelect'),bs,i.bowler,'Choose bowler');}
function renderLive(){const m=getMatch(),i=inns();ensureLineups(i);$('matchTag').textContent=m.status==='completed'?'● MATCH COMPLETE':m.status==='innings-break'?'● INNINGS BREAK':'● LIVE MATCH';$('matchFormat').textContent=`${m.overs} OVERS`;$('totalScore').textContent=`${i.runs}/${i.wickets}`;$('overText').textContent=`${overText(i.balls)} overs`;$('runRate').textContent=(i.balls?i.runs/(i.balls/6):0).toFixed(2);$('crrText').textContent=(i.balls?i.runs/(i.balls/6):0).toFixed(2);$('targetText').textContent=m.target??'—';$('ballsLeft').textContent=Math.max(0,i.overs*6-i.balls);$('inningsText').textContent=m.inningsNo===1?'1st':'2nd';$('resultBanner').classList.toggle('hidden',!m.result);$('resultBanner').textContent=m.result||'';
const batters=Object.entries(i.batters).map(([id,s])=>({p:db.players.find(p=>p.id===id),s})).filter(x=>x.p);$('battersTable').innerHTML=batters.length?`<table><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${batters.map(({p,s})=>`<tr><td><strong>${esc(p.name)}${p.id===i.striker?' *':''}</strong><br><small>${s.out?'OUT':'not out'}</small></td><td>${s.runs}</td><td>${s.balls}</td><td>${s.fours}</td><td>${s.sixes}</td><td>${s.balls?(100*s.runs/s.balls).toFixed(1):'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Add players in Teams & Players to track batter stats.</p>';
const bowlers=Object.entries(i.bowlers).map(([id,s])=>({p:db.players.find(p=>p.id===id),s})).filter(x=>x.p);$('bowlerTable').innerHTML=bowlers.length?`<table><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Eco</th></tr></thead><tbody>${bowlers.map(({p,s})=>`<tr><td>${esc(p.name)}${p.id===i.bowler?' *':''}</td><td>${overText(s.balls)}</td><td>${s.runs}</td><td>${s.wickets}</td><td>${s.balls?(s.runs/(s.balls/6)).toFixed(2):'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Bowling figures appear after selecting a bowler.</p>';
$('ballHistory').innerHTML=i.history.length?i.history.slice(-36).reverse().map(x=>`<span class="ball ${x.type}">${esc(x.label)}</span>`).join(''):'<span class="muted">No deliveries yet.</span>';
document.querySelectorAll('[data-run],[data-extra],#wicketBtn').forEach(el=>el.disabled=m.status!=='live'||i.completed);$('endInningsBtn').textContent=m.inningsNo===1?'End / Next Innings':'Finish Match';}
function renderTeams(){ $('teamsList').innerHTML=db.teams.map(t=>`<div class="entity"><div class="entity-main"><strong>${esc(t.name)}</strong><small>${esc(t.short)} · ${playersFor(t.id).length} players</small></div><button data-del-team="${t.id}">Delete</button></div>`).join('')||'<p class="muted">No teams yet.</p>';const tid=$('squadTeam').value||db.teams[0]?.id;const list=playersFor(tid);$('squadList').innerHTML=list.map(p=>`<div class="entity"><div class="entity-main"><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></div><label class="xi"><input type="checkbox" data-xi="${p.id}" ${p.xi?'checked':''}> XI</label><button data-del-player="${p.id}">Delete</button></div>`).join('')||'<p class="muted">Add players to build the squad.</p>'}
function renderFixtures(){ $('fixturesList').innerHTML=db.fixtures.map(f=>`<div class="entity fixture-card"><div class="fixture-info"><strong>${esc(f.title)} · ${f.overs} overs</strong><small>${esc(teamLabel(f.a))} vs ${esc(teamLabel(f.b))} · ${esc(f.status)}${f.result?' · '+esc(f.result):''}</small></div><div class="fixture-actions"><button class="primary" data-start-fixture="${f.id}">${f.status==='completed'?'Replay':'Start'}</button><button class="outline" data-del-fixture="${f.id}">Delete</button></div></div>`).join('')||'<p class="muted">No fixtures. Create one above.</p>'}
function renderPoints(){const rows=db.teams.map(t=>{const played=db.fixtures.filter(f=>f.status==='completed'&&(f.a===t.id||f.b===t.id));let won=0,lost=0,tied=0,nr=0,pts=0;played.forEach(f=>{if(f.result==='Match tied'){tied++;pts++}else if(f.result?.includes(t.name+' won')){won++;pts+=2}else if(f.result?.includes('No Result')){nr++;pts++}else lost++});return {t,played:played.length,won,lost,tied,nr,pts,nrr:'—'}}).sort((a,b)=>b.pts-a.pts||b.won-a.won);$('pointsBody').innerHTML=rows.map((r,n)=>`<tr><td>${n+1}</td><td><strong>${esc(r.t.short||r.t.name)}</strong></td><td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td>${r.tied}</td><td>${r.nr}</td><td><strong>${r.pts}</strong></td><td>${r.nrr}</td></tr>`).join('')}
function render(){renderSelectors();renderLive();renderTeams();renderFixtures();renderPoints();$('tournamentName').value=db.settings.name;$('defaultOvers').value=String(db.settings.overs);$('maxXI').value=String(db.settings.maxXI);$('storageBadge').textContent=window.AGCC_CONFIG?.supabaseUrl?'SUPABASE READY':'LOCAL MODE';$('dbStatus').textContent=window.AGCC_CONFIG?.supabaseUrl?'SUPABASE CONFIGURED':'DATABASE NOT CONFIGURED';}
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));document.querySelectorAll('.tab').forEach(v=>v.classList.toggle('active',v.dataset.view===name));if(name==='live')renderLive()}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>recordRuns(Number(b.dataset.run))));
document.querySelectorAll('[data-extra]').forEach(b=>b.addEventListener('click',()=>recordExtra(b.dataset.extra)));
$('wicketBtn').addEventListener('click',recordWicket);$('undoBtn').addEventListener('click',()=>{if(!undoStack.length)return toast('কোনো স্কোর undo করার নেই');db=JSON.parse(undoStack.pop());save();render();toast('শেষ অ্যাকশন undo হয়েছে')});
$('swapStrikeBtn').addEventListener('click',()=>{takeSnapshot();swapStrike();save();render()});$('endInningsBtn').addEventListener('click',switchInnings);
$('batTeam').addEventListener('change',e=>{if(e.target.value===inns().oppId)return toast('Batting ও bowling team আলাদা হতে হবে');takeSnapshot();const m=getMatch(),old=inns();old.teamId=e.target.value;old.batters={};old.striker=null;old.nonStriker=null;ensureLineups(old);save();render()});
$('bowlTeam').addEventListener('change',e=>{if(e.target.value===inns().teamId)return toast('Batting ও bowling team আলাদা হতে হবে');takeSnapshot();inns().oppId=e.target.value;inns().bowler=null;ensureLineups(inns());save();render()});
$('strikerSelect').addEventListener('change',e=>{inns().striker=e.target.value||null;if(inns().striker)batterRecord(inns(),inns().striker);save();render()});$('nonStrikerSelect').addEventListener('change',e=>{inns().nonStriker=e.target.value||null;if(inns().nonStriker)batterRecord(inns(),inns().nonStriker);save();render()});$('bowlerSelect').addEventListener('change',e=>{inns().bowler=e.target.value||null;if(inns().bowler)bowlerRecord(inns(),inns().bowler);save();render()});
$('newMatchBtn').addEventListener('click',()=>{if(!confirm('নতুন ম্যাচ শুরু হবে। বর্তমান লাইভ ম্যাচ বন্ধ হবে।'))return;const a=$('batTeam').value,b=$('bowlTeam').value;if(!a||!b||a===b)return toast('দুটি আলাদা দল বেছে নাও');db.match=newMatch(a,b,db.settings.overs);ensureLineups(inns());save();render();toast('নতুন ম্যাচ তৈরি হয়েছে')});
$('clearHistoryBtn').addEventListener('click',()=>{if(confirm('বল-বাই-বল তালিকা খালি করবেন?')){inns().history=[];save();render()}});
$('teamForm').addEventListener('submit',e=>{e.preventDefault();const name=$('teamName').value.trim();if(!name)return;db.teams.push({id:uid(),name,short:$('teamShort').value.trim().toUpperCase()||name.split(/\s+/).map(x=>x[0]).join('').slice(0,4).toUpperCase()});e.target.reset();save();render();toast('Team added')});
$('playerForm').addEventListener('submit',e=>{e.preventDefault();if(!db.teams.length)return toast('আগে একটি দল তৈরি করো');db.players.push({id:uid(),teamId:$('playerTeam').value,name:$('playerName').value.trim(),role:$('playerRole').value,xi:playersFor($('playerTeam').value).filter(p=>p.xi).length<db.settings.maxXI});e.target.reset();save();render();toast('Player added')});
$('squadTeam').addEventListener('change',renderTeams);
$('teamsList').addEventListener('click',e=>{const id=e.target.dataset.delTeam;if(!id)return;if(!confirm('দল ও তার খেলোয়াড় মুছবেন?'))return;db.teams=db.teams.filter(t=>t.id!==id);db.players=db.players.filter(p=>p.teamId!==id);db.fixtures=db.fixtures.filter(f=>f.a!==id&&f.b!==id);save();render()});
$('squadList').addEventListener('change',e=>{const id=e.target.dataset.xi;if(!id)return;const p=db.players.find(p=>p.id===id);if(!p)return;const count=playersFor(p.teamId).filter(x=>x.xi).length;if(e.target.checked&&!p.xi&&count>=db.settings.maxXI){e.target.checked=false;return toast(`সর্বোচ্চ ${db.settings.maxXI} জন Playing XI-তে রাখা যাবে`)}p.xi=e.target.checked;save();renderTeams()});
$('squadList').addEventListener('click',e=>{const id=e.target.dataset.delPlayer;if(!id)return;db.players=db.players.filter(p=>p.id!==id);save();render()});
$('fixtureForm').addEventListener('submit',e=>{e.preventDefault();const a=$('fixtureA').value,b=$('fixtureB').value;if(!a||!b||a===b)return toast('দুটি আলাদা দল বেছে নাও');db.fixtures.push({id:uid(),title:$('fixtureTitle').value.trim()||`Match ${db.fixtures.length+1}`,a,b,overs:Number($('fixtureOvers').value),status:'scheduled',result:'',matchId:null});e.target.reset();save();render();toast('Fixture added')});
$('fixturesList').addEventListener('click',e=>{const start=e.target.dataset.startFixture,del=e.target.dataset.delFixture;if(del){db.fixtures=db.fixtures.filter(f=>f.id!==del);save();render();return}if(start){const f=db.fixtures.find(f=>f.id===start);if(!f)return;if(f.status==='completed'&&!confirm('এই ম্যাচটি আবার শুরু করলে আগের স্কোর মুছে যাবে। চালাবেন?'))return;db.match=newMatch(f.a,f.b,f.overs);db.match.title=f.title;f.status='live';f.matchId=db.match.id;ensureLineups(inns());save();render();showView('live');toast('Fixture loaded into scorer')}})
$('refreshPoints').addEventListener('click',renderPoints);
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();db.settings.name=$('tournamentName').value.trim()||'AGCC';db.settings.overs=Number($('defaultOvers').value);db.settings.maxXI=Number($('maxXI').value);save();render();toast('Settings saved')});
$('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='agcc-scorer-backup.json';a.click();URL.revokeObjectURL(url);toast('Backup downloaded')});
$('importFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(!parsed.teams||!parsed.fixtures)throw Error();db=parsed;save();render();toast('Backup restored')}catch{toast('Invalid backup JSON')}e.target.value=''});
$('resetAllBtn').addEventListener('click',()=>{if(!confirm('সব দল, খেলোয়াড়, ম্যাচ ও সেটিংস মুছে ফেলবেন?'))return;db=defaultState();undoStack=[];save();render();toast('App data reset')});
$('shareBtn').addEventListener('click',async()=>{const m=getMatch(),i=inns(),txt=`${db.settings.name}\n${teamLabel(i.teamId)} ${i.runs}/${i.wickets} (${overText(i.balls)} overs)\n${m.target?'Target: '+m.target+'\n':''}${teamLabel(i.oppId)}\n${m.result||'Live Score'}\n${location.href}`;try{if(navigator.share)await navigator.share({title:'AGCC Live Score',text:txt,url:location.href});else if(navigator.clipboard){await navigator.clipboard.writeText(txt);toast('Score copied to clipboard')}else prompt('Copy score',txt)}catch{}});
$('authForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!cloudClient)return toast('config.js-এ Supabase URL ও anon key বসাও');
  const email=$('adminEmail').value.trim(),password=$('adminPassword').value;
  const {data,error}=await cloudClient.auth.signInWithPassword({email,password});
  if(error)return toast('Login failed: '+error.message);
  cloudSession=data.session;
  setAuthStatus(data.user?.app_metadata?.role==='admin'?'ADMIN SIGNED IN':'SIGNED IN · READ ONLY');
  await pullCloudState();toast('Signed in');
});
$('signOutBtn')?.addEventListener('click',async()=>{
  if(cloudClient) await cloudClient.auth.signOut();
  cloudSession=null;setAuthStatus('NOT SIGNED IN');toast('Signed out');
});
render();
initCloud();
