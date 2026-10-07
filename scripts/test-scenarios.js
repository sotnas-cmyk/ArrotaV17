const assert = require('assert');

function loadProfile() {
  delete require.cache[require.resolve('../src/profile.js')];
  global.window = {};
  const store = {};
  global.localStorage = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
    setItem(k,v){ store[k]=v; },
    removeItem(k){ delete store[k]; }
  };
  require('../src/profile.js');
  return global.window.Porta10AProfile;
}

function r(id, cozinha, ambiente, ocasiao='jantar', tipo='Restaurante', preco='€€') {
  return {id, tipo, atributos:{cozinhas:[cozinha], ambientes:[ambiente], ocasioes:[ocasiao], preco}};
}

function runPersona(name, setup, candidates, context) {
  const P = loadProfile();
  setup(P);
  const ranked = candidates.map(r => ({
    id:r.id,
    score:P.preferenceMatch(r, context).score,
    confidence:P.preferenceMatch(r, context).confidence
  })).sort((a,b)=>b.score-a.score);
  return {name, ranked};
}

const traditional = r('traditional','portugues','tradicional');
const contemporary = r('contemporary','portugues','contemporaneo');
const seafoodCasual = r('seafood-casual','peixe','casual');
const seafoodClassical = r('seafood-classical','peixe','classico');
const meatCasual = r('meat-casual','carne','casual');
const meatClassical = r('meat-classical','carne','classico');
const candidates = [traditional, contemporary, seafoodCasual, seafoodClassical, meatCasual, meatClassical];

const explorer = runPersona('explorador', P => {
  P.record('suggestion_requested', traditional, {moods:['qualquer']});
  P.record('suggestion_requested', seafoodCasual, {moods:['peixe']});
}, candidates, {moods:['qualquer']});
assert(explorer.ranked.every(x => x.score === 0), 'exploração isolada não deve criar preferência');

const traditionalUser = runPersona('tradicional', P => {
  P.record('liked', traditional, {source:'decide', decisionContext:{moods:['qualquer']}});
  P.record('disliked', contemporary, {source:'decide', decisionContext:{moods:['qualquer']}});
}, candidates, {moods:['qualquer']});
assert(traditionalUser.ranked[0].id === 'traditional', 'utilizador tradicional deve favorecer tradicional');
assert(traditionalUser.ranked.find(x=>x.id==='contemporary').score < 0, 'contemporâneo deve ficar negativo após rejeição explícita');

const seafoodContext = runPersona('peixe-casual', P => {
  P.record('liked', seafoodCasual, {source:'decide', decisionContext:{moods:['peixe']}});
  P.record('liked', seafoodCasual, {source:'decide', decisionContext:{moods:['peixe']}});
}, candidates, {moods:['peixe']});
assert(seafoodContext.ranked[0].id === 'seafood-casual', 'contexto peixe deve favorecer a preferência contextual repetida');
// contextual confidence is checked by ranking behaviour

const alternativeUser = runPersona('alternativas', P => {
  for (let i=0;i<3;i++) {
    P.record('alternative_chosen', meatCasual, {
      fromFeatures:P.features(meatClassical),
      chosenFeatures:P.features(meatCasual),
      moods:['carne']
    });
  }
}, [meatClassical, meatCasual], {moods:['carne']});
assert(alternativeUser.ranked[0].id === 'meat-casual', 'escolhas relativas repetidas devem favorecer a característica diferenciadora');
assert(alternativeUser.ranked[0].score < 1, 'evidência relativa não deve ganhar força de opinião explícita');

console.log('Scenario tests: OK');
console.log(JSON.stringify({explorer, traditionalUser, seafoodContext, alternativeUser}, null, 2));
