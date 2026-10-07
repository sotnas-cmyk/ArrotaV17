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
function isClassical(r){ const a=r.atributos||{}; return (a.ambientes||[]).includes('clássico') || r.tipo==='clássico'; }
const candidates = restaurants.filter(r=>r.estado==='aberto' && isClassical(r)).slice(0,12);
assert(candidates.length >= 10, 'precisamos de pelo menos 10 casas clássicas reais para calibrar');

const rows=[];
for (const n of [0,1,2,3,5,10]) {
  const P=loadProfile();
  for (let i=0;i<n;i++) P.record('liked', candidates[i], {source:'decide', decisionContext:{moods:['classico']}});
  const match=P.preferenceMatch(candidates[n ? n-1 : 0], {moods:['classico']});
  rows.push({evidencia:n, confidence:+match.confidence.toFixed(3), personalWeight:+(0.20*match.confidence).toFixed(3), score:+match.score.toFixed(3)});
}

// A mesma opinião repetida sobre uma casa continua a ser uma só evidência.
const P=loadProfile();
for(let i=0;i<8;i++) P.record('liked', candidates[0], {source:'decide', decisionContext:{moods:['classico']}});
const repeated=P.preferenceMatch(candidates[0], {moods:['classico']});
assert.strictEqual(repeated.confidence, 0.1, 'repetir a mesma opinião não deve inflacionar a confiança');

assert.deepStrictEqual(rows.map(x=>x.confidence), [0,0.1,0.2,0.3,0.5,1], 'confidence deve crescer com evidência independente');
assert(rows.every(x=>x.personalWeight <= 0.2), 'peso pessoal nunca pode ultrapassar 20%');

const report={principle:'confidence cresce por restaurantes distintos, não por número de atributos ou repetições', rows, repeatedSameRestaurant:{confidence:repeated.confidence,score:+repeated.score.toFixed(3)}};
fs.writeFileSync(__dirname+'/calibration-report.json',JSON.stringify(report,null,2));
console.log('Calibration test: OK');
console.log(JSON.stringify(report,null,2));
