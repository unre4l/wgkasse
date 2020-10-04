require('dotenv').config()
const sqlite = require('better-sqlite3')
const mapValues = require('lodash/mapValues')

class Persistance {
  constructor() {
    this.db = sqlite('wgkasse.db', {verbose: console.log});
    this.init()
  }

  init() {
    this.db.prepare('CREATE TABLE IF NOT EXISTS wgleute ' +
      '(id INTEGER PRIMARY KEY, ' +
      'name VARCHAR NOT NULL, ' +
      'paypal VARCAR NULL, ' +
      'deleted_at DATETIME NULL)')
      .run();
    this.db.prepare('CREATE TABLE IF NOT EXISTS ausgaben ' +
      '(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
      'von INTEGER NOT NULL, ' +
      'betrag INTEGER NOT NULL, ' +
      'is_settlement INTEGER DEFAULT 0,' +
      'betrifft TEXT NOT NULL,' +
      'bezeichnung VARCHAR NULL, ' +
      'created_at DATETIME DEFAULT CURRENT_TIMESTAMP,' +
      'deleted_at DATETIME NULL)')
      .run();

    //this.testDaten()
  }

  toCent(betrag) {
    return Math.round((typeof betrag === 'string'
      ? parseFloat(betrag.trim().replace(/[^0-9.,]*/g, ''))
      : betrag.trim()) * 100)
  }

  wgler(id, name) {
    this.db.prepare('REPLACE INTO wgleute(id, name, deleted_at) VALUES (@id, @name, null)')
      .run({id, name});
  }

  keinWgler(id) {
    this.db.prepare('UPDATE wgleute SET deleted_at = CURRENT_TIMESTAMP WHERE id = @id')
      .run({id});
  }

  paypal(id, handle) {
    this.db.prepare('UPDATE wgleute SET paypal = @handle WHERE id = @id')
      .run({id, handle});
  }

  wgLeuts() {
    return this.db.prepare('SELECT id from wgleute WHERE deleted_at is null').all().map(({id}) => id);
  }

  ausgabe(von, betrag, bezeichnung) {
    // snapshot wg leute zum zeitpunkt der ausgabe
    const betrifft = this.wgLeuts().filter((id) => id !== von).join(',')
    console.log('betrifft:', betrifft)
    this.db.prepare('INSERT INTO ausgaben (bezeichnung, betrag, von, betrifft) VALUES (@bezeichnung, @betrag, @von, @betrifft)')
      .run({
        bezeichnung: bezeichnung.trim(),
        betrag: this.toCent(betrag),
        von,
        betrifft
      });
  }

  invalidate_ausgabe(id) {
    this.db.prepare('UPDATE ausgaben SET deleted_at = CURRENT_TIMESTAMP WHERE id = @id')
      .run({id});
  }

  begleichen(von, an, betrag) {
    this.db.prepare(
      'INSERT INTO ausgaben (is_settlement, betrag, von, betrifft) VALUES (@is_settlement, @betrag, @von, @betrifft)')
      .run({
        is_settlement: 1,
        betrag: this.toCent(betrag),
        von,
        betrifft: `${an}`,
      });
  }

  testDaten() {
    const a = [
      {id: 1, name: 'bernie'},
      {id: 2, name: 'ert'},
      {id: 3, name: 'sherlock'},
      {id: 4, name: 'hubertus'},
      {id: 5, name: 'otto'}
    ]
    a.forEach((e) => this.wgler(e.id, e.name))

    const b = [
      {id: 4},
      {id: 5}
    ]
    b.forEach((e) => this.keinWgler(e.id))

    const ids = [process.env.OWN_TWITTER_ID, ...a.map(e => e.id)]

    for (let i = 0; i < 100; i++) {
      this.ausgabe(
        ids[Math.floor(Math.random()*ids.length)],
        `${(Math.random()*100)+1}€`,
        'Gummibären'
      )
    }

    function ranId(ids, except) {
      const id = ids[Math.floor(Math.random()*ids.length)]
      return (id === except) ? ranId(ids, except) : id;
    }

    for (let i = 0; i < 20; i++) {
      const von = ids[Math.floor(Math.random()*ids.length)];
      this.begleichen(
        von,
        ranId(ids, von),
        `${(Math.random()*50)+1}€`,
      )
    }
  }

  schulden(wgmensch) {
    const wgLeutzIds = this.db.prepare('SELECT id from wgleute').all().map(({id}) => id);
    const cashflow = this.db.prepare('SELECT * from ausgaben WHERE deleted_at is null').all();

    let matrix = wgLeutzIds.reduce((m, id, _, ids) => ({...m, [id]: ids.reduce((acc, vId) => ({...acc, [vId]: 0}),{}) }), {})
    console.log(matrix)

    // iterate through all ausgaben and sum it together
    cashflow.forEach(({ von, betrag, betrifft, is_settlement }) => {
      if (!is_settlement) {
        // ist ausgabe
        const relevant_leute = betrifft.split(',')
        const anteil = betrag/relevant_leute.length
        // jeder bekommt den anteil angerechnet, außer die spendierhose
        relevant_leute
          .forEach((id) => { matrix[id][`${von}`] += anteil })
      } else {
        // ist begleichung, ziehe betrag von schulden ab
        console.log({ von, betrag, betrifft, is_settlement })
        matrix[betrifft][`${von}`] -= betrag
      }
    })

    matrix = mapValues(matrix, (s) => mapValues(s, (b) => Math.round(b)))
    console.log(matrix)
    return matrix[wgmensch]
  }
}

db = new Persistance()

Object.freeze(db)

module.exports = db;
