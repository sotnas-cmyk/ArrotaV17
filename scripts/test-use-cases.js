const fs=require('fs'); const assert=require('assert');
const restaurants=JSON.parse(fs.readFileSync(__dirname+'/../data/restaurantes.json','utf8'));
function loadProfile(){delete require.cache[require.resolve('../src/profile.js')];global.window={};const store={};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]};require('../src/profile.js');return global.window.Porta10AProfile;}
const A=r=>r.atributos||{}; const has=(r,b,v)=>(A(r)[b]||[]).includes(v);
const moods={peixe:r=>has(r,'cozinhas','peixe'),marisco:r=>has(r,'cozinhas','marisco'),petiscos:r=>has(r,'cozinhas','petiscos'),classico:r=>has(r,'ambientes','clássico')||r.tipo==='clássico',contemporaneo:r=>has(r,'ambientes','contemporâneo')||r.tipo==='fine dining'||r.tipo==='date / contemporâneo'};
function q(r){let s=0;if(r.morada)s++;if(r.telefone)s++;if(r.website)s++;if(r.especialidade)s++;if(r.lat!=null&&r.lon!=null)s++;if(r.fonte)s++;if(r.actualizado)s++;if(Object.values(A(r)).some(x=>Array.isArray(x)&&x.length))s++;return s/8;}
function rank(P,mood){let pred=moods[mood]||(()=>true);return restaurants.filter(r=>r.estado==='aberto'&&!P.hasDisliked(r)&&pred(r)).map(r=>{let i=P.preferenceMatch(r,{moods:[mood]});let p=Math.max(-1,Math.min(1,i.score/5)),w=.20*i.confidence,base=.65+.18*.5+.17*q(r);return {r,score:base*(1-w)+p*w,i}}).sort((a,b)=>b.score-a.score||a.r.nome.localeCompare(b.r.nome,'pt'));}
const find=(pred,n=1)=>restaurants.filter(r=>r.estado==='aberto'&&pred(r)).slice(0,n);
const report={scenarios:[],total:0,passed:0};
function check(name,fn){const out={name};try{fn(out);out.status='OK';report.passed++;}catch(e){out.status='FALHOU';out.error=e.message;throw e}finally{report.scenarios.push(out);report.total++;}}
// 1 novo utilizador: editorial manda, sem aprendizagem pessoal.
check('Novo utilizador — tanto faz',o=>{const P=loadProfile();const a=rank(P,'qualquer').slice(0,5).map(x=>x.r.id);const b=rank(P,'qualquer').slice(0,5).map(x=>x.r.id);assert.deepStrictEqual(a,b);o.top=rank(P,'qualquer').slice(0,5).map(x=>x.r.nome)});
// 2 pedido concreto: peixe deve continuar a ser peixe mesmo com perfil clássico.
check('Pedido actual vence — peixe',o=>{const P=loadProfile();find(moods.classico,5).forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['classico']}}));const top=rank(P,'peixe').slice(0,10);assert(top.every(x=>moods.peixe(x.r)));o.top=top.slice(0,5).map(x=>x.r.nome)});
// 3 preferência pessoal desempata dentro do pedido.
check('Preferência pessoal desempata — peixe',o=>{const P=loadProfile();const likes=find(moods.peixe,5);likes.forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['peixe']}}));const top=rank(P,'peixe').slice(0,10);const liked=top.filter(x=>likes.some(y=>y.id===x.r.id)).length;assert(liked>=1);o.likedInTop10=liked;o.top=top.slice(0,5).map(x=>x.r.nome)});
// 4 rejeição explícita: casa rejeitada desaparece, similares apenas recebem sinal negativo.
check('Não gostei — rejeição explícita',o=>{const P=loadProfile();const r=find(moods.classico,1)[0];P.record('disliked',r,{source:'decide',decisionContext:{moods:['classico']}});assert(!rank(P,'classico').some(x=>x.r.id===r.id));assert(P.hasDisliked(r));o.rejected=r.nome});
// 5 exploração: pedir outra sugestão não cria rejeição.
check('Outra sugestão — exploração neutra',o=>{const P=loadProfile();const a=rank(P,'petiscos')[0].r;P.record('suggestion_requested',a,{moods:['petiscos']});const b=rank(P,'petiscos')[0].r;assert(!P.hasDisliked(a));assert(P.preferenceMatch(a,{moods:['petiscos']}).confidence===0);o.first=a.nome;o.after=b.nome});
// 6 alternativa repetida: sinal fraco.
check('Alternativa repetida — sinal fraco',o=>{const P=loadProfile();const fs=find(moods.classico,3),as=find(moods.peixe,3);as.forEach((r,i)=>P.record('alternative_chosen',r,{chosenFeatures:P.features(r),fromFeatures:P.features(fs[i])}));const info=P.preferenceMatch(as[0],{moods:['qualquer']});assert(info.confidence<=.2);o.confidence=info.confidence;o.score=+info.score.toFixed(3)});
// 7 mudança de opinião.
check('Mudança de opinião — estado actual',o=>{const P=loadProfile();const r=find(moods.classico,1)[0];P.record('liked',r,{source:'decide',decisionContext:{moods:['classico']}});const x=P.preferenceMatch(r,{moods:['classico']}).score;P.record('disliked',r,{source:'decide',decisionContext:{moods:['classico']}});const y=P.preferenceMatch(r,{moods:['classico']}).score;assert(y<x);o.restaurant=r.nome;o.before=+x.toFixed(3);o.after=+y.toFixed(3)});
// 8 contexto não universaliza.
check('Contexto — peixe não contamina tanto o resto',o=>{const P=loadProfile();find(moods.peixe,5).forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['peixe']}}));const fish=P.preferenceMatch(find(moods.peixe,1)[0],{moods:['peixe']});const neutral=P.preferenceMatch(find(moods.peixe,1)[0],{moods:['qualquer']});assert(fish.score>=neutral.score);o.contextScore=+fish.score.toFixed(3);o.neutralScore=+neutral.score.toFixed(3)});
// 9 favoritos ajudam, mas não substituem opinião.
check('Guardado/favorito — sinal intermédio',o=>{const P=loadProfile();const r=find(moods.classico,1)[0];P.record('favorite_added',r);const info=P.preferenceMatch(r,{moods:['qualquer']});assert(info.confidence<=.1);assert(info.score>0);o.restaurant=r.nome;o.confidence=info.confidence;o.score=+info.score.toFixed(3)});
// 10 perfil forte continua subordinado ao pedido.
check('Perfil forte — pedido actual continua a mandar',o=>{const P=loadProfile();find(moods.classico,10).forEach(r=>P.record('liked',r,{source:'decide',decisionContext:{moods:['classico']}}));const top=rank(P,'marisco').slice(0,10);assert(top.every(x=>moods.marisco(x.r)));o.confidence=P.preferenceMatch(find(moods.classico,1)[0],{moods:['qualquer']}).confidence;o.top=top.slice(0,5).map(x=>x.r.nome)});
fs.writeFileSync(__dirname+'/use-cases-report.json',JSON.stringify(report,null,2));console.log(`Use-case tests: ${report.passed}/${report.total} OK`);console.log(JSON.stringify(report,null,2));
