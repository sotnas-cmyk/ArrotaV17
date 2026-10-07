const assert = require('assert');

const store = {};
global.window = {};
global.localStorage = {
  getItem(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
  setItem(k,v){ store[k]=v; },
  removeItem(k){ delete store[k]; }
};
require('../src/profile.js');
const P = global.window.Porta10AProfile;

function r(id, cozinha, ambiente, ocasiao='jantar', tipo='Restaurante', preco='€€') {
  return {id, tipo, atributos:{cozinhas:[cozinha], ambientes:[ambiente], ocasioes:[ocasiao], preco}};
}
const peixeCasual = r('1','peixe','casual');
const peixeClassico = r('2','peixe','classico');
const carneClassico = r('3','carne','classico');

// Exploration is neutral.
P.record('suggestion_requested', peixeCasual, {moods:['peixe']});
assert.strictEqual(P.score(peixeCasual), 0, 'exploration must not alter preference');

// One alternative choice is deliberately weak and does not create preference.
P.record('alternative_chosen', peixeCasual, {
  fromFeatures:P.features(peixeClassico), chosenFeatures:P.features(peixeCasual), moods:['peixe']
});
assert.strictEqual(P.score(peixeCasual), 0, 'single relative choice must remain neutral');

// Repeated differentiated choices create only a weak positive signal.
P.record('alternative_chosen', peixeCasual, {fromFeatures:P.features(peixeClassico), chosenFeatures:P.features(peixeCasual), moods:['peixe']});
const weak = P.score(peixeCasual);
assert(weak > 0 && weak < 1, 'repeated relative choices should create weak evidence');

// Explicit dislike is strong and negative.
P.record('disliked', carneClassico, {source:'decide', decisionContext:{moods:['carne']}});
assert(P.score(carneClassico) < 0, 'explicit dislike must be negative');
assert(P.hasDisliked(carneClassico), 'latest dislike should be visible');

// A later like reverses the explicit opinion for the restaurant.
P.record('liked', carneClassico, {source:'decide', decisionContext:{moods:['carne']}});
assert(P.hasLiked(carneClassico), 'latest explicit opinion should win');
assert(!P.hasDisliked(carneClassico), 'old dislike should not remain current');

// Contextual evidence is only created by explicit feedback in that context.
P.record('liked', peixeClassico, {source:'decide', decisionContext:{moods:['peixe']}});
const contextual = P.preferenceMatch(peixeClassico, {moods:['peixe']});
assert(contextual.confidence > 0, 'explicit contextual opinion should create confidence');

console.log('Profile behaviour tests: OK');
