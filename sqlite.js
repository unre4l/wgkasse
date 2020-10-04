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
      'paypal VARCAR NULL)')
      .run();
    this.db.prepare('CREATE TABLE IF NOT EXISTS ausgaben ' +
      '(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
      'bezeichnung VARCHAR NOT NULL, ' +
      'betrag INTEGER NOT NULL, ' +
      'wgmensch INTEGER NOT NULL, ' +
      'empfaenger INTEGER NULL,' +
      'created_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
      .run();
  }

  wgler(id, name) {
    this.db.prepare('REPLACE INTO wgleute(id, name) VALUES (@id, @name)')
      .run({id, name});
  }

  paypal(id, handle) {
    this.db.prepare('UPDATE wgleute SET paypal = @handle WHERE id = @id')
      .run({handle, id});
  }

  ausgabe(wgmensch, betrag, bezeichnung) {
    let betrag_cent = (typeof betrag === 'string'
      ? parseFloat(betrag.replace(/[^0-9.,]*/g, ''))
      : betrag) * 100
    betrag_cent = betrag_cent > 0 ? betrag_cent * -1 : betrag_cent

    this.db.prepare('INSERT INTO ausgaben (bezeichnung, betrag, wgmensch) VALUES (@bezeichnung, @betrag, @wgmensch)')
      .run({
        bezeichnung: bezeichnung.trim(),
        betrag: betrag_cent,
        wgmensch,
      });
  }

  begleichen(wgmensch, betrag, empfaenger) {
    let betrag_cent = (typeof betrag === 'string'
      ? parseFloat(betrag.replace(/[^0-9.,]*/g, ''))
      : betrag) * 100
    betrag_cent = betrag_cent < 0 ? betrag_cent * -1 : betrag_cent

    this.db.prepare(
      'INSERT INTO ausgaben (bezeichnung, betrag, wgmensch, empfaenger) VALUES (@ezeichnung, @betrag, @wgmensch, @empfaenger)')
      .run({
        bezeichnung: 'BEGLEICHEN',
        betrag: betrag_cent,
        wgmensch,
        empfaenger,
      });
  }

  schulden(wgmensch) {
    // const leute =  this.db.prepare('SELECT * from wgleute').all();
    const ausgaben = this.db.prepare('SELECT * from ausgaben').all();

    // const leute =  this.db.prepare('SELECT * from wgleute').all();
    // const ausgaben = [
    //   {
    //     bezeichnung: 'eier',
    //     betrag: -2344,
    //     wgmensch: 1,
    //     empfaenger: null,
    //     created_at: '2020-10-03 20:13:24'
    //   },
    //   {
    //     bezeichnung: 'müll',
    //     betrag: -9872,
    //     wgmensch: 2,
    //     empfaenger: null,
    //     created_at: '2020-10-03 20:13:24'
    //   },
    //   {
    //     bezeichnung: 'putzeimer',
    //     betrag: -234,
    //     wgmensch: 3,
    //     empfaenger: null,
    //     created_at: '2020-10-03 20:13:24'
    //   },
    //   {
    //     bezeichnung: 'irgendwas',
    //     betrag: -5345,
    //     wgmensch: 4,
    //     empfaenger: null,
    //     created_at: '2020-10-03 20:13:24'
    //   },
    //   {
    //     bezeichnung: 'nochwas',
    //     betrag: -1234,
    //     wgmensch: 4,
    //     empfaenger: null,
    //     created_at: '2020-10-03 20:13:24'
    //   },
    //   {
    //     bezeichnung: 'BEGLEICHUNG',
    //     betrag: 1000,
    //     wgmensch: 1,
    //     empfaenger: 4,
    //     created_at: '2020-10-03 20:13:24'
    //   },
    //   {
    //     bezeichnung: 'BEGLEICHUNG',
    //     betrag: 2000,
    //     wgmensch: 1,
    //     empfaenger: 2,
    //     created_at: '2020-10-03 20:13:24'
    //   },
    // ];

    const aufwand = ausgaben.filter(({empfaenger}) => !empfaenger).reduce((acc, ausgabe) => {
      if (!acc[ausgabe.wgmensch]) {
        acc[ausgabe.wgmensch] = ausgabe.betrag
      } else {
        acc[ausgabe.wgmensch] += ausgabe.betrag
      }
      return acc;
    }, {});

    const beglichen = ausgaben.filter(({empfaenger}) => empfaenger != null).reduce((acc, {wgmensch, empfaenger, betrag}) => {
      if (!acc[wgmensch]) {
        acc[wgmensch] = {}
      }

      acc[wgmensch][empfaenger] = !acc[wgmensch][empfaenger]
        ? betrag
        : acc[wgmensch][empfaenger] + betrag

      return acc;
    }, {});

    // aufwand = Aufwand der jewieligen Person:
    // {
    //   'Person1': -123,
    //   'Person2': -53,
    //   ...
    // }

    // beglichen = Begleichungen der jewieligen Person:
    // {
    //   'Person1': {
    //      'Person2': 23,
    //      'Person3': 72,
    //      ...
    //   },
    //   'Person2': {
    //      'Person1': 32,
    //      'Person3': 21,
    //       ...
    //   },
    //   ...
    // }

    // aufwand normalisiert

    const geringsterAufwand = Math.max(...Object.values(aufwand));
    const aufwand_norm = {1: -2110, 2: -9638, 3: 0, 4: -6345} // mapValues(aufwand, (betrag) => betrag - geringsterAufwand)
    // aufwand_norm = Aufwand normalisuert der jewieligen Person:
    // {
    //   'Person1': -123, -> 45 -> -78
    //   'Person2': -12, -> 45 -> 33
    //   'Person3': 0, -> 45 -> 45
    //   ...
    // }
    // 135/3 = 45

    const schulden = Object.entries(aufwand_norm).reduce(
      (acc, [wgmensch, aufwand], i, leutz) => {
        // name schuldet wgmensch seinen anteil
        const anteil = aufwand / leutz.length
        leutz.filter(([id]) => id !== wgmensch).forEach(([name]) => {
          acc[name][wgmensch] += anteil
        })
        return acc;
      },
      Object.keys(aufwand).reduce((acc, name, i, wgmenschen) => {
        acc[name] = {}
        wgmenschen.forEach((wgmensch) => {
          acc[name][wgmensch] = 0
        })
        return acc;
      }, aufwand),
    );

    // {
    //   'Person1': {
    //     'Person2': -123,
    //     'Person3': -12,
    //   },
    //   'Person2': {
    //     'Person1': -123,
    //     'Person3': -12,
    //   },
    //   'Person3': {
    //     'Person1': -41 (-123/3),
    //     'Person2': -4 (-12/3),
    //   },
    // }

    // schulden mit begleichungen verrechnen

    const verrechnet = Object.entries(beglichen).reduce((acc, [selbst, beglichen]) => {
      acc[selbst] = Object.entries(acc[selbst]).reduce((ctx, [gegenüber, schuld]) => {
        if(schuld === 0) {
          return ctx;
        }

        console.log(gegenüber, schuld)
        ctx[gegenüber] = schuld + beglichen[gegenüber]
        return ctx;
      }, { ...acc[selbst] })
      return acc;
    }, { ...schulden })

    return verrechnet[wgmensch];
  }
}

db = new Persistance()

Object.freeze(db)

module.exports = db;
