const fs = require('fs');
const assert = require('assert');
const restaurants = JSON.parse(fs.readFileSync(__dirname + '/../data/restaurantes.json','utf8'));

function loadProfile(){
  delete require.cache[require.resolve('../src/profile.js')];
  global.window={}; const store={};
  global.localStorage={getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]};
  require('../src/profile.js'); return global.window.Porta10AProfile;
}
function has(r,b,v){return ((r.atributos||{})[b]||[]).includes(v)}
function classical(r){return has(r,'ambientes','clássico')||r.tipo==='clássico'}
function contemporary(r){return has(r,'ambientes','contemporâneo')||r.tipo==='fine dining'||r.tipo==='date / contemporâneo'}
function fish(r){return has(r,'cozinhas','peixe')}
function casual(r){return has(r,'ambientes','casual')}
function quality(r){let s=0;if(r.morada)s++;if(r.telefone)s++;if(r.website)s++;if(r.especialidade)s++;if(r.lat!=null&&r.lon!=null)s++;if(r.fonte)s++;if(r.actualizado)s++;const a=r.atributos||{};if((a.cozinhas||[]).length||(a.ambientes||[]).length||(a.ocasioes||[]).length||(a.caracteristicas||[]).length)s++;return s/8;}
function rank(P,mood){
  const need=mood==='qualquer'?[]:[mood];
  return restaurants.filter(r=>r.estado==='aberto'&&!P.hasDisliked(r)&&(!need.length || (need[0]==='classico'?classical(r):need[0]==='peixe'?fish(r):need[0]==='contemporaneo'?contemporary(r):true)))
    .map(r=>{
      const fit=need.length?1:1; const base=(fit*.65)+(.5*.18)+(quality(r)*.17);
      const info=P.preferenceMatch(r,{moods:[mood]}); const personal=Math.max(-1,Math.min(1,info.score/5)); const pw=.20*info.confidence;
      return {r,score:base*(1-pw)+personal*pw,personal:info.score,confidence:info.confidence};
    }).sort((a,b)=>b.score-a.score||String(a.r.nome).localeCompare(String(b.r.nome),'pt'));
}
function pick(pred,n=5){return restaurants.filter(r=>r.estado==='aberto'&&pred(r)).slice(0,n)}
function topIds(a,n=10){return a.slice(0,n).map(x=>x.r.id)}

const report={profiles:{},checks:[]};

// 1. Explorador: usar a app sem emitir opinião não pode criar preferência.
{
 const P=loadProfile(); const before=rank(P,'qualquer');
 restaurants.slice(0,12).forEach(r=>P.record('suggestion_requested',r,{moods:['qualquer']}));
 const after=rank(P,'qualquer');
 assert.deepStrictEqual(topIds(after),topIds(before),'exploração alterou ranking');
 report.checks.push('exploração neutra');
 report.profiles.explorador={confidence:P.preferenceMatch(restaurants[0],{moods:['qualquer']}).confidence,top:after.slice(0,5).map(x=>x.r.nome)};
}

// 2. Tradicional: opiniões explícitas repetidas em casas diferentes devem empurrar o perfil nessa direcção.
{
 const P=loadProfile(); const likes=pick(classical,5); const modern=pick(contemporary,5);
 likes.forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['qualquer']}}));
 modern.forEach(r=>P.record('disliked',r,{source:'decide',decisionContext:{moods:['qualquer']}}));
 const all=rank(P,'qualquer');
 const likedTop=all.slice(0,10).filter(x=>classical(x.r)).length;
 const confidence=P.preferenceMatch(likes[0],{moods:['qualquer']}).confidence;
 assert(confidence>=0.9,'perfil tradicional não ganhou confiança suficiente');
 assert(likedTop>=4,'perfil tradicional não favorece suficientemente casas clássicas');
 report.checks.push('perfil tradicional');
 report.profiles.tradicional={confidence,classicInTop10:likedTop,top:all.slice(0,5).map(x=>x.r.nome)};
}

// 3. Peixe contextual: gostar de peixe no contexto peixe não deve tornar o perfil universalmente "peixe" com a mesma força.
{
 const P=loadProfile(); const likes=pick(fish,5); likes.forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['peixe']}}));
 const fishMatch=P.preferenceMatch(likes[0],{moods:['peixe']});
 const neutralMatch=P.preferenceMatch(likes[0],{moods:['qualquer']});
 assert(fishMatch.score>=neutralMatch.score,'contexto de peixe não reforçou o contexto certo');
 report.checks.push('preferência contextual');
 report.profiles.peixeContextual={contextConfidence:fishMatch.confidence,contextScore:+fishMatch.score.toFixed(3),neutralScore:+neutralMatch.score.toFixed(3)};
}

// 4. Mudança de opinião: a opinião mais recente sobre uma casa substitui a anterior.
{
 const P=loadProfile(); const r=pick(classical,1)[0];
 P.record('liked',r,{source:'decide',decisionContext:{moods:['classico']}});
 const liked=P.preferenceMatch(r,{moods:['classico']}).score;
 P.record('disliked',r,{source:'decide',decisionContext:{moods:['classico']}});
 const disliked=P.preferenceMatch(r,{moods:['classico']}).score;
 assert(disliked<liked,'mudança de opinião não foi reflectida');
 assert(P.hasDisliked(r)&&!P.hasLiked(r),'estado final da opinião incorrecto');
 report.checks.push('mudança de opinião');
 report.profiles.mudancaOpiniao={liked:+liked.toFixed(3),disliked:+disliked.toFixed(3)};
}

// 5. Escolha relativa: escolher alternativas repetidamente pode criar uma preferência fraca,
// mas nunca uma rejeição automática das primeiras casas.
{
 const P=loadProfile(); const first=pick(classical,4); const alternatives=pick(fish,4);
 alternatives.forEach((r,i)=>P.record('alternative_chosen',r,{chosenFeatures:P.features(r),fromFeatures:P.features(first[i])}));
 first.forEach(r=>assert(!P.hasDisliked(r),'escolha de alternativa transformou primeira opção em rejeição'));
 const evidence=P.preferenceMatch(alternatives[0],{moods:['qualquer']});
 assert(evidence.confidence<=0.2,'alternativas isoladas deram confiança excessiva');
 report.checks.push('escolha relativa fraca');
 report.profiles.escolhaRelativa={confidence:evidence.confidence,score:+evidence.score.toFixed(3)};
}

report.totalChecks=report.checks.length;
fs.writeFileSync(__dirname+'/human-profiles-report.json',JSON.stringify(report,null,2));
console.log('Human profiles test: OK');
console.log(JSON.stringify(report,null,2));
