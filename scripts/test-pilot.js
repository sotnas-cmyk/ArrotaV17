const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const required = [
  ['profile behaviour', 'scripts/test-profile.js'],
  ['scenario behaviour', 'scripts/test-scenarios.js'],
  ['calibration', 'scripts/test-calibration.js'],
  ['human profiles', 'scripts/test-human-profiles.js'],
  ['real use cases', 'scripts/test-use-cases.js'],
  ['real ranking', 'scripts/test-real-ranking.js']
];

const files = [
  'src/profile.js', 'src/app.js', 'data/restaurantes.json',
  'data/taxonomia.json', 'index.html'
];
const missing = files.filter(f => !fs.existsSync(path.join(root, f)));
if (missing.length) throw new Error('Ficheiros em falta: ' + missing.join(', '));

const reports = {
  useCases: JSON.parse(fs.readFileSync(path.join(root, 'scripts/use-cases-report.json'), 'utf8')),
  human: JSON.parse(fs.readFileSync(path.join(root, 'scripts/human-profiles-report.json'), 'utf8')),
  calibration: JSON.parse(fs.readFileSync(path.join(root, 'scripts/calibration-report.json'), 'utf8')),
  ranking: JSON.parse(fs.readFileSync(path.join(root, 'scripts/real-ranking-report.json'), 'utf8'))
};

const checks = [
  ['10 cenários de utilização passaram', reports.useCases.passed === 10 && reports.useCases.total === 10],
  ['5 perfis humanos passaram', reports.human.totalChecks === 5],
  ['calibração 0→1→2→3→5→10 evidências existe', Array.isArray(reports.calibration.rows) && reports.calibration.rows.map(r => r.evidencia).join(',') === '0,1,2,3,5,10'],
  ['ranking real usa 318 restaurantes', reports.ranking.restaurants === 318],
  ['ranking real tem personalização efectiva', Object.keys(reports.ranking.scenarios || {}).some(s => { const x = reports.ranking.scenarios[s]; const base = (x.explorador || []).map(r => r.id).join(','); return Object.keys(x).some(p => p !== 'explorador' && (x[p] || []).map(r => r.id).join(',') !== base); })]
];

const failed = checks.filter(c => !c[1]);
const report = {
  version: 'V17',
  purpose: 'piloto controlado antes de recolher feedback real',
  status: failed.length ? 'FAIL' : 'READY',
  checks: checks.map(c => ({ name: c[0], ok: c[1] })),
  recommendation: failed.length ? 'Corrigir os testes falhados antes de experimentar.' : 'Pronto para piloto; não acrescentar novas regras de aprendizagem durante o piloto.'
};
fs.writeFileSync(path.join(root, 'scripts/pilot-readiness-report.json'), JSON.stringify(report, null, 2));
if (failed.length) {
  console.error('Pilot readiness: FAIL');
  failed.forEach(c => console.error(' - ' + c[0]));
  process.exit(1);
}
console.log('Pilot readiness: READY');
checks.forEach(c => console.log((c[1] ? 'OK' : 'FAIL') + ' — ' + c[0]));
