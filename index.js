require('dotenv').config()
const Kasse = require('./sqlite')
const {Telegraf} = require('telegraf')
const Markup = require('telegraf/markup')
const session = require('telegraf/session')
const Extra = require('telegraf/extra')

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

bot.command('schulden', async (ctx) => {
  const schulden = await Kasse.schulden(ctx.from.id)
  return ctx.reply('Deine Schulden:', Extra.markup(
    Markup.inlineKeyboard([
      ...schulden.map(({id, schulden, name, paypal}) => {
        const schuld = (schulden / 100).toFixed(2)
        const dataCb = {
          von: ctx.from.id,
          an: id,
          betrag: schuld,
        }
        return [
          Markup.urlButton(`${schuld}€ bei ${name}`, `${paypal}/${schuld}`),
          Markup.callbackButton('Schuld beglichen', `begleichen-${JSON.stringify(dataCb)}`)
        ];
      }),
    ])
  ))
  // console.log(leute, ausgaben)
})

bot.action(/^begleichen-(.*)$/, ctx => {
  console.log(ctx.match)
})

// register spendierhosen
bot.hears(/([a-zA-ZüöäÜÖÄ\ß\:\ \_\-]{4,}) ([0-9]+(,|.)?[0-9]*) ?€/, (ctx) => {
  const [_, bezeichnung, betrag] = ctx.match;
  Kasse.ausgabe(ctx.from.id, betrag, bezeichnung)
  const gifs = ['l0MYDoN32puQXNmx2', 'gTURHJs4e2Ies', 'fAhOtxIzrTxyE', 'cUSJDZLX6zab6', 'LZyFp6pObiyuk'];
  const gif = `https://i.giphy.com/media/${gifs[Math.floor(Math.random() * gifs.length)]}/100w.gif`
  return ctx.replyWithVideo(gif, {caption: `${ctx.from.first_name} hat ${bezeichnung} für ${betrag}€ gekauft.`})
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

