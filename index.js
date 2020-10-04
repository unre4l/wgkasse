require('dotenv').config()
const Kasse = require('./sqlite')
const {Telegraf} = require('telegraf')
const Markup = require('telegraf/markup')
const session = require('telegraf/session')
const Extra = require('telegraf/extra')


// const Stage = require('telegraf/stage')
// const WizardScene = require('telegraf/scenes/wizard')
// const {MenuTemplate, MenuMiddleware, createBackMainMenuButtons} = require('telegraf-inline-menu')


// const EinkaufListe =

// const soll = ['Spühli', 'Klopapier', 'Pilze', 'handtücher', 'Topf', 'Knobi', 'Zwiebel', 'Obst', 'Tücher', 'Müllsäcke']
//
//
// const EinkaufMenu = new MenuTemplate(ctx => 'Was hast du eingekauft?')
// EinkaufMenu.select('einkauf', soll, {
//   isSet: (ctx, key) => {
//     console.log('isset', key,  ctx.session.einkauf)
//     return ctx.session.einkauf === key
//   },
//   set: (ctx, key) => {
//     console.log('set', key)
//     ctx.session.einkauf = key
//   },
//
//   do: async ctx => {
//     ctx.editMessageReplyMarkup({
//       inline_keyboard: null,
//     })
//     return true;
//   },
// })
//
// const EinkaufMenuMiddleware = new MenuMiddleware('/einkauf/', EinkaufMenu)
//
//
// const EinkaufScene = new WizardScene('Einkauf',
//   (ctx) => {
//     ctx.wizard.state.einkauf = {};
//     EinkaufMenuMiddleware.replyToContext(ctx)
//     return ctx.wizard.next()
//   },
//   (ctx) => {
//     console.log('aaaaaaaaaaaaaaaasd')
//     console.log(ctx)
//     const einkauf = ctx.message.text.trim().toLocaleLowerCase()
//     ctx.wizard.state.einkauf = einkauf
//     return ctx.wizard.next()
//   },
//   (ctx) => {
//     ctx.reply(`Wie viel hast du für ${ctx.session.einkauf} ausgegeben?`);
//   },
//   (ctx) => {
//     const betrag = ctx.message.text
//     Kasse.ausgabe(ctx.from.id, betrag, ctx.wizard.state.einkauf)
//     ctx.replyWithVideo(
//       `https://i.giphy.com/media/${buyGifs[Math.floor(Math.random() * buyGifs.length)]}/100w.gif`,
//       {caption: `${ctx.from.first_name} hat ${bezeichnung} für ${betrag}€ gekauft.`})
//     return ctx.scene.leave()
//   },
// );


// const stage = new Stage()
// stage.register(EinkaufScene)

const WgGroupOnly = async ({chat, from: {id, first_name}}, next) => {
  if (chat.id !== parseInt(process.env.WG_KASSSE_GROUP_ID, 10)) {
    return;
  }
  Kasse.wgler(id, first_name)
  next()
}

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.telegram.getMe().then((botInfo) => {
  bot.options.username = botInfo.username
})
bot.use(WgGroupOnly)
bot.use(session())
// bot.use(menuMiddleware)
// bot.use(stage.middleware())

// bot.command('einkauf', ctx => {
//   ctx.scene.enter('Einkauf')
// })

// bot.command('paypal', (ctx) => )
// bot.action('cancel', (ctx) => ctx.scene.leave())


// bot.hears('meine schulden', (ctx) => {
//   const empfaenger = ctx.message.entities[0].user
//   // const bezeichnung = ctx.match[1].trim();
//   // const betrag = ctx.match[2].trim();
//   // console.log(bezeichnung, betrag)
//   // Kasse.ausgabe(ctx.from.id, betrag, bezeichnung)
//   // return ctx.replyWithVideo(
//   //   `https://i.giphy.com/media/${buyGifs[Math.floor(Math.random() * buyGifs.length)]}/100w.gif`,
//   //   {caption: `${ctx.from.first_name} hat ${bezeichnung} für ${betrag}€ gekauft.`})
// })


bot.command('pyramid', (ctx) => {
  return ctx.reply('Keyboard wrap', Extra.markup(
    Markup.keyboard(['one', 'two', 'three', 'four', 'five', 'six'], {
      wrap: (btn, index, currentRow) => currentRow.length >= (index + 1) / 2
    })
  ))
})

bot.command('schulden', async (ctx) => {
  await Kasse.schulden(ctx.from.id)
  // console.log(leute, ausgaben)
})

// register spendierhosen
bot.hears(/([a-zA-ZüöäÜÖÄ\ß\:\ \_\-]{4,}) ([0-9]+(,|.)?[0-9]*) ?€/, (ctx) => {
  const [_, bezeichnung, betrag] = ctx.match;
  Kasse.ausgabe(ctx.from.id, betrag, bezeichnung)
  const gifs = ['l0MYDoN32puQXNmx2', 'gTURHJs4e2Ies', 'fAhOtxIzrTxyE', 'cUSJDZLX6zab6', 'LZyFp6pObiyuk'];
  const gif = `https://i.giphy.com/media/${gifs[Math.floor(Math.random() * gifs.length)]}/100w.gif`
  return ctx.replyWithVideo(gif,{caption: `${ctx.from.first_name} hat ${bezeichnung} für ${betrag}€ gekauft.`})
})

// set paypal adress for quick cashflow
bot.hears(/paypal.me\/[\w]+/, (ctx) => {
  const paypal = `https://${ctx.match[0].trim()}`;
  Kasse.paypal(ctx.from.id, paypal)
  return ctx.replyWithVideo('https://i.giphy.com/media/dykJfX4dbM0Vy/100w.gif', {caption: `${paypal} ist für ${ctx.from.first_name} hinterlegt.`})
})

// handle relevant wgmenschen
bot.on(
  'new_chat_members',
  ({message: {new_chat_members}}) => new_chat_members.forEach(({id, first_name}) => Kasse.wgler(id, first_name))
)
bot.on(
  'left_chat_member',
  ({message: {left_chat_member: {id}}}) => Kasse.keinWgler(id)
)

// Bahhof? fallback for things beyond understanding
bot.hears(/.*/, (ctx) => ctx.reply('🚉'))

bot.launch()

