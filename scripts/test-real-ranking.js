const fs = require('fs');
const assert = require('assert');
const restaurants = JSON.parse(fs.readFileSync(__dirname + '/../data/restaurantes.json','utf8'));

function loadProfile() {
  delete require.cache[require.resolve('../src/profile.js')];
  global.window = {};
  const store = {};
  global.localStorage = { getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null, setItem:(k,v)=>store[k]=v, removeItem:k=>delete store[k] };
  require('../src/profile.js');
  return global.window.Porta10AProfile;
}
function attrs(r){ const a=r.atributos||{}; return {cozinhas:a.cozinhas||[],ambientes:a.ambientes||[],ocasioes:a.ocasioes||[],caracteristicas:a.caracteristicas||[]}; }
function has(r,b,v){return attrs(r)[b].indexOf(v)!==-1;}
function fold(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function moodHay(r){return fold([r.especialidade,r.tipo,r.nome,r.notas].filter(Boolean).join(' '));}
const words={peixe:['peixe','bacalhau','polvo','sopa de','cataplana','robalo','dourada','sardinha','pescada'],marisco:['marisco','ameijoa','amêijoa','lagosta','lavagante','sapateira','percebe','marisqueira','camarão','gamba'],carne:['carne','porco','cabrito','vitela','novilho','grelhad','churrasc','frango','javali','posta','bife','prego','costeleta','leitão'],petiscos:['petisco','tasco','taberna','petiscos'],classico:['clássico','classico','cozido','feijoada','francesinha','tripas','alentejan']};
function matches(r,m){
 if(!m||m==='qualquer') return true;
 if(m==='peixe'&&has(r,'cozinhas','peixe')) return true;
 if(m==='marisco'&&has(r,'cozinhas','marisco')) return true;
 if(m==='carne'&&(has(r,'cozinhas','carne')||has(r,'cozinhas','grelhados'))) return true;
 if(m==='petiscos'&&has(r,'cozinhas','petiscos')) return true;
 if(m==='classico'&&(has(r,'ambientes','clássico')||r.tipo==='clássico')) return true;
 if(m==='romantico'&&has(r,'ambientes','romântico')) return true;
 if(m==='familiar'&&has(r,'ambientes','familiar')) return true;
 if(m==='grupo'&&has(r,'ambientes','grupo')) return true;
 if(m==='contemporaneo'&&(has(r,'ambientes','contemporâneo')||r.tipo==='date / contemporâneo'||r.tipo==='fine dining')) return true;
 if(m==='casual'&&has(r,'ambientes','casual')) return true;
 return (words[m]||[]).some(w=>moodHay(r).includes(fold(w)));
}
function quality(r){let s=0;if(r.morada)s++;if(r.telefone)s++;if(r.website)s++;if(r.especialidade)s++;if(r.lat!=null&&r.lon!=null)s++;if(r.fonte)s++;if(r.actualizado)s++;const a=attrs(r);if(a.cozinhas.length||a.ambientes.length||a.ocasioes.length||a.caracteristicas.length)s++;return s/8;}
function features(r){return {cozinhas:(r.atributos&&r.atributos.cozinhas)||[],ambientes:(r.atributos&&r.atributos.ambientes)||[],ocasioes:(r.atributos&&r.atributos.ocasioes)||[],tipos:r.tipo?[r.tipo]:[],precos:(r.atributos&&r.atributos.preco)?[r.atributos.preco]:[]};}
function rank(P,moods){
 const need=moods.filter(m=>m&&m!=='qualquer');
 return restaurants.filter(r=>r.estado==='aberto' && (!need.length||need.some(m=>matches(r,m))) && !P.hasDisliked(r)).map(r=>{
   const hits=need.filter(m=>matches(r,m)).length; const fit=need.length?hits/need.length:1;
   const personalInfo=P.preferenceMatch(r,{moods}); const personal=Math.max(-1,Math.min(1,personalInfo.score/5));
   const base=(fit*.65)+(.5*.18)+(quality(r)*.17); const pw=.20*personalInfo.confidence;
   return {r,score:base*(1-pw)+personal*pw,personal:personalInfo.score,confidence:personalInfo.confidence};
 }).sort((a,b)=>b.score-a.score||String(a.r.nome).localeCompare(String(b.r.nome),'pt'));
}
function choose(arr, pred, n=3){return arr.filter(pred).slice(0,n);}
function setupPersona(kind,P){
 if(kind==='tradicional'){
   const likes=choose(restaurants,r=>r.estado==='aberto'&&(has(r,'ambientes','clássico')||r.tipo==='clássico'));
   const dislikes=choose(restaurants,r=>r.estado==='aberto'&&(has(r,'ambientes','contemporâneo')||r.tipo==='fine dining'||r.tipo==='date / contemporâneo'));
   likes.forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['qualquer']}}));
   dislikes.forEach(r=>P.record('disliked',r,{source:'decide',decisionContext:{moods:['qualquer']}}));
 } else if(kind==='peixe-casual'){
   const likes=choose(restaurants,r=>r.estado==='aberto'&&has(r,'cozinhas','peixe'));
   likes.forEach(r=>{P.record('liked',r,{source:'decide',decisionContext:{moods:['peixe']}});});
 } else if(kind==='romantico-contemporaneo'){
   const likes=choose(restaurants,r=>r.estado==='aberto'&&has(r,'ambientes','contemporâneo'));
   likes.forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['contemporaneo']}}));
 }
}
const scenarios=[['tanto faz',['qualquer']],['peixe',['peixe']],['petiscos',['petiscos']],['contemporaneo',['contemporaneo']],['classico',['classico']]];
const personas=['explorador','tradicional','peixe-casual','romantico-contemporaneo'];
const report={restaurants:restaurants.length,open:restaurants.filter(r=>r.estado==='aberto').length,scenarios:{}};
for(const [s,moods] of scenarios){ report.scenarios[s]={}; for(const p of personas){const P=loadProfile(); if(p==='explorador'){restaurants.slice(0,8).forEach(r=>P.record('suggestion_requested',r,{moods}));}else setupPersona(p,P); const ranked=rank(P,moods).slice(0,10); report.scenarios[s][p]=ranked.map(x=>({id:x.r.id,nome:x.r.nome,score:+x.score.toFixed(4),personal:+x.personal.toFixed(3),confidence:+x.confidence.toFixed(3)})); }}
// Basic sanity: exploration should not alter scores; at least one persona should differ from explorer in a scenario.
let differences=0; for(const s of Object.keys(report.scenarios)){const a=report.scenarios[s].explorador.map(x=>x.id).join(',');for(const p of personas.slice(1)){if(report.scenarios[s][p].map(x=>x.id).join(',')!==a)differences++;}}
assert(differences>0,'personalization should alter at least one real ranking');
fs.writeFileSync(__dirname+'/real-ranking-report.json',JSON.stringify(report,null,2));
console.log(`Real ranking test: OK (${report.restaurants} restaurantes; ${report.open} abertos; ${differences} rankings diferentes)`);
for(const s of Object.keys(report.scenarios)){
 console.log(`\n${s.toUpperCase()}`);
 for(const p of personas) console.log(`${p}: ${report.scenarios[s][p].slice(0,5).map(x=>x.nome).join(' | ')}`);
}
