/* Porta 10A · memória pessoal do utilizador
 * Fase 3: preferência derivada de opiniões explícitas + comportamento repetido.
 * Tudo continua local ao dispositivo. Não guarda dados editoriais nem credenciais.
 */
(function (root) {
  "use strict";
  var KEY = "porta10a-profile-v1";
  var MAX_EVENTS = 300;
  var SCHEMA_VERSION = 2;

  function makeId() {
    return "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function empty() {
    return {
      version: SCHEMA_VERSION,
      userId: makeId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [],
      preferences: { cozinhas: {}, ambientes: {}, ocasioes: {}, tipos: {}, precos: {} }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      var p = JSON.parse(raw);
      if (!p || (p.version !== 1 && p.version !== SCHEMA_VERSION)) return empty();
      p.version = SCHEMA_VERSION;
      p.events = Array.isArray(p.events) ? p.events : [];
      p.preferences = p.preferences || {};
      ["cozinhas", "ambientes", "ocasioes", "tipos", "precos"].forEach(function (k) {
        p.preferences[k] = p.preferences[k] || {};
      });
      return p;
    } catch (e) {
      return empty();
    }
  }

  var profile = load();

  function persist() {
    profile.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) {}
  }

  function restaurantFeatures(r) {
    var a = r && r.atributos || {};
    return {
      cozinhas: Array.isArray(a.cozinhas) ? a.cozinhas : [],
      ambientes: Array.isArray(a.ambientes) ? a.ambientes : [],
      ocasioes: Array.isArray(a.ocasioes) ? a.ocasioes : [],
      tipos: r && r.tipo ? [r.tipo] : [],
      precos: a.preco ? [a.preco] : []
    };
  }

  function event(type, restaurant, meta) {
    var e = {
      type: type,
      restaurantId: restaurant && restaurant.id != null ? restaurant.id : null,
      at: new Date().toISOString(),
      meta: meta || {}
    };
    profile.events.push(e);
    if (profile.events.length > MAX_EVENTS) profile.events.splice(0, profile.events.length - MAX_EVENTS);
    persist();
  }

  function latestEventForRestaurant(id, types) {
    for (var i = profile.events.length - 1; i >= 0; i--) {
      var e = profile.events[i];
      if (String(e.restaurantId) === String(id) && types.indexOf(e.type) !== -1) return e;
    }
    return null;
  }

  function latestFeedback(r) {
    if (!r) return null;
    var e = latestEventForRestaurant(r.id, ["liked", "disliked"]);
    return e ? e.type : null;
  }

  function hasLiked(r) { return latestFeedback(r) === "liked"; }
  function hasDisliked(r) { return latestFeedback(r) === "disliked"; }

  /*
   * O comportamento do utilizador tem três significados distintos:
   *
   * - suggestion_requested: "mostra-me outra". É exploração, sem sinal
   *   positivo ou negativo sobre a casa actual.
   * - alternative_chosen: o utilizador escolheu explicitamente outra casa.
   *   É evidência de que a alternativa tinha valor acrescentado relativamente
   *   à primeira, mas não transforma a primeira numa casa "má".
   * - liked / disliked: opinião explícita e forte sobre uma casa.
   *
   * Nas escolhas entre duas casas, só aprendemos características que a casa
   * escolhida tem e a primeira não tinha. Assim evitamos inventar uma rejeição
   * da primeira quando a diferença pode ter sido outra coisa.
   */
  function behavioralEvidence() {
    var positive = {};
    var comparisons = 0;

    function add(bucket, key, amount) {
      if (!positive[bucket]) positive[bucket] = {};
      positive[bucket][key] = (positive[bucket][key] || 0) + amount;
    }

    profile.events.forEach(function (e) {
      if (e.type !== "alternative_chosen") return;
      comparisons += 1;
      var chosen = e.meta && e.meta.chosenFeatures;
      var from = e.meta && e.meta.fromFeatures;
      if (!chosen || !from) return;

      Object.keys(chosen).forEach(function (bucket) {
        var chosenValues = Array.isArray(chosen[bucket]) ? chosen[bucket] : [];
        var fromValues = Array.isArray(from[bucket]) ? from[bucket] : [];
        chosenValues.forEach(function (key) {
          /* Só conta como evidência diferenciadora quando esta característica
             existe na alternativa escolhida e não na primeira. Uma escolha
             isolada é exploração; a preferência só começa a ganhar peso
             quando o mesmo padrão se repete. */
          if (fromValues.indexOf(key) === -1) add(bucket, key, 1);
        });
      });
    });

    return { positive: positive, comparisons: comparisons };
  }

  function contextKey(moods) {
    return (Array.isArray(moods) ? moods : []).filter(function (m) { return m && m !== "qualquer"; }).slice().sort().join("|");
  }

  function derivedContextPreferences() {
    var out = {};
    profile.events.forEach(function (e) {
      if ((e.type !== "liked" && e.type !== "disliked") || !e.restaurantId) return;
      var dc = e.meta && e.meta.decisionContext;
      var key = contextKey(dc && dc.moods);
      if (!key) return;
      var f = e.meta && e.meta.features;
      if (!f) return;
      if (!out[key]) out[key] = { cozinhas: {}, ambientes: {}, ocasioes: {}, tipos: {}, precos: {} };
      var sign = e.type === "liked" ? 1 : -1;
      Object.keys(f).forEach(function (bucket) {
        (Array.isArray(f[bucket]) ? f[bucket] : []).forEach(function (value) {
          out[key][bucket][value] = (out[key][bucket][value] || 0) + sign * 1.5;
        });
      });
    });
    return out;
  }

  function derivedPreferences() {
    var out = { cozinhas: {}, ambientes: {}, ocasioes: {}, tipos: {}, precos: {} };
    var explicitByRestaurant = {};
    var favoriteByRestaurant = {};

    profile.events.forEach(function (e) {
      if (e.restaurantId == null) return;
      var id = String(e.restaurantId);
      if (e.type === "liked" || e.type === "disliked") explicitByRestaurant[id] = e;
      if (e.type === "favorite_added" || e.type === "favorite_removed") favoriteByRestaurant[id] = e;
    });

    /* Só a opinião actual de cada restaurante conta. Assim, gostar -> não
       gostar -> gostar não soma três opiniões; representa uma opinião actual. */
    Object.keys(explicitByRestaurant).forEach(function (id) {
      var e = explicitByRestaurant[id];
      var sign = e.type === "liked" ? 1 : -1;
      var f = e.meta && e.meta.features;
      if (!f) return;
      Object.keys(f).forEach(function (bucket) {
        (Array.isArray(f[bucket]) ? f[bucket] : []).forEach(function (key) {
          out[bucket][key] = (out[bucket][key] || 0) + sign * 3;
        });
      });
    });

    /* Também só interessa o estado actual do favorito de cada restaurante. */
    Object.keys(favoriteByRestaurant).forEach(function (id) {
      var e = favoriteByRestaurant[id];
      var sign = e.type === "favorite_added" ? 1 : -1;
      var strength = e.type === "favorite_added" ? 2 : 1;
      var f = e.meta && e.meta.features;
      if (!f) return;
      Object.keys(f).forEach(function (bucket) {
        (Array.isArray(f[bucket]) ? f[bucket] : []).forEach(function (key) {
          out[bucket][key] = (out[bucket][key] || 0) + sign * strength;
        });
      });
    });

    /* Escolhas entre alternativas: evidência positiva, mais fraca que uma
       opinião explícita. Nunca transformamos a primeira opção em "negativa". */
    var evidence = behavioralEvidence();
    Object.keys(evidence.positive).forEach(function (bucket) {
      Object.keys(evidence.positive[bucket]).forEach(function (key) {
        var count = evidence.positive[bucket][key];
        if (count >= 2) {
          out[bucket][key] = (out[bucket][key] || 0) + Math.min(2, count - 1) * 0.5;
        }
      });
    });

    /* Compatibilidade com a aprendizagem acumulada das versões anteriores. */
    Object.keys(out).forEach(function (bucket) {
      Object.keys(profile.preferences[bucket] || {}).forEach(function (key) {
        out[bucket][key] = (out[bucket][key] || 0) + Number(profile.preferences[bucket][key] || 0) * 0.25;
      });
    });

    return out;
  }

  function evidenceCounts(context) {
    var explicitRestaurants = {};
    var favoriteRestaurants = {};
    var contextualRestaurants = {};
    var alternativeChosenRestaurants = {};

    profile.events.forEach(function (e) {
      if (e.restaurantId == null) return;
      var id = String(e.restaurantId);
      if (e.type === "liked" || e.type === "disliked") {
        explicitRestaurants[id] = e;
        var dc = e.meta && e.meta.decisionContext;
        if (contextKey(dc && dc.moods) === contextKey(context && context.moods) && contextKey(context && context.moods)) {
          contextualRestaurants[id] = e;
        }
      }
      if (e.type === "favorite_added" || e.type === "favorite_removed") favoriteRestaurants[id] = e;
      if (e.type === "alternative_chosen") alternativeChosenRestaurants[id] = true;
    });

    var explicit = Object.keys(explicitRestaurants).length;
    var favorites = Object.keys(favoriteRestaurants).length;
    var contextual = Object.keys(contextualRestaurants).length;
    var alternatives = Object.keys(alternativeChosenRestaurants).length;

    /* Uma opinião sobre um restaurante com seis atributos continua a ser uma
       única peça de evidência. O mesmo vale para repetir a mesma opinião.
       Alternativas contam menos, porque são sinais comportamentais fracos. */
    return {
      independent: Math.min(10, explicit + (favorites * 0.5) + (alternatives * 0.5)),
      explicit: explicit,
      favorites: favorites,
      contextual: contextual
    };
  }

  function record(type, restaurant, meta) {
    var enriched = Object.assign({}, meta || {});
    if (restaurant) enriched.features = restaurantFeatures(restaurant);

    /* Quando a opinião acontece depois de uma decisão do "Decide por mim",
       guardamos o contexto da decisão. Isto permite distinguir uma opinião
       sobre a casa de uma opinião sobre o encaixe daquela casa naquela situação. */
    if (restaurant && (type === "liked" || type === "disliked") && meta && meta.source === "decide") {
      enriched.decisionContext = meta.decisionContext || null;
    }
    event(type, restaurant, enriched);
  }

  function decisionEvidence() {
    var out = { comparisons: 0, chosen: 0, explicitAfterChoice: 0, likedAfterChoice: 0, dislikedAfterChoice: 0 };
    profile.events.forEach(function (e) {
      if (e.type === "alternative_chosen") { out.comparisons += 1; out.chosen += 1; }
      if ((e.type === "liked" || e.type === "disliked") && e.meta && e.meta.source === "decide" && e.meta.decisionContext) {
        out.explicitAfterChoice += 1;
        if (e.type === "liked") out.likedAfterChoice += 1;
        if (e.type === "disliked") out.dislikedAfterChoice += 1;
      }
    });
    return out;
  }

  function preferenceMatch(r, context) {
    if (!r) return { score: 0, confidence: 0, evidence: 0, positive: [] };
    var f = restaurantFeatures(r);
    var prefs = derivedPreferences();
    var contextPrefs = derivedContextPreferences();
    var cKey = contextKey(context && context.moods);
    var cp = cKey ? contextPrefs[cKey] : null;
    var total = 0, n = 0, evidence = 0, absoluteEvidence = 0, positive = [];
    Object.keys(f).forEach(function (bucket) {
      f[bucket].forEach(function (key) {
        var globalValue = Number(prefs[bucket][key]) || 0;
        var contextualValue = cp ? (Number(cp[bucket][key]) || 0) : 0;
        /* O contexto é deliberadamente uma correcção moderada ao perfil global. */
        var value = globalValue + (contextualValue * 0.35);
        total += value;
        n += 1;
        evidence += value;
        absoluteEvidence += Math.abs(value);
        if (value > 0) positive.push({ bucket: bucket, key: key, value: value });
      });
    });
    var raw = n ? total / n : 0;
    var counts = evidenceCounts(context);
    /* A confiança mede quantidade de decisões independentes, não quantidade de
       atributos do restaurante. Dez restaurantes distintos já são suficientes
       para atingir o tecto; o sinal positivo/negativo não altera a confiança. */
    var confidence = Math.min(1, counts.independent / 10);
    var contextualEvidence = counts.contextual;
    return {
      score: raw,
      confidence: confidence,
      evidence: evidence,
      absoluteEvidence: absoluteEvidence,
      contextualEvidence: contextualEvidence,
      evidenceCount: counts.independent,
      explicitEvidence: counts.explicit,
      favoriteEvidence: counts.favorites,
      positive: positive
    };
  }

  function score(r) { return preferenceMatch(r).score; }

  function explain(r) {
    var match = preferenceMatch(r, null);
    return {
      score: match.score,
      confidence: match.confidence,
      evidence: match.evidence,
      positive: match.positive.slice(0, 5)
    };
  }

  function summary() {
    return derivedPreferences();
  }

  root.Porta10AProfile = {
    get: function () { return profile; },
    record: record,
    score: score,
    preferenceMatch: preferenceMatch,
    summary: summary,
    decisionEvidence: decisionEvidence,
    contextPreferences: derivedContextPreferences,
    features: restaurantFeatures,
    hasLiked: hasLiked,
    hasDisliked: hasDisliked,
    reset: function () { profile = empty(); persist(); },
    export: function () { return JSON.stringify(profile, null, 2); }
  };
})(window);
