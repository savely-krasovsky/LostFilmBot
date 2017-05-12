# LostFilmBot
_**Attention**: Supports only Russian localization yet!_

### [Live bot](https://t.me/LostFilm_bot)
Telegram bot for [LostFilm.TV](https://www.lostfilm.tv/).
Powered by [RethinkDB](https://rethinkdb.com).

Needs Node.js 7+, because of using async/await construction in the code.

### How to deploy
1. Install Node 7+ and RethinkDB.
2. Create database `lostfilm`, `users` and `serials` table in GUI ([localhost:8080](http://localhost:8080)) _(if you can, you can do it directly in code)_.
3. `git clone https://github.com/Lord-Protector/LostFilmBot.git`
4. `npm install`
5. Create file config.js in the root and paste it:
```javascript
module.exports.private = {
	token: 'YOUR_TONEN'
};
```
Of course you will should to get token from [@BotFather](https://t.me/BotFather).

### Roadmap
- [x] List of all LostFilm serials
- [x] Login into account and saving session
- [x] Personal list synced with site favorites
- [x] Ability to mark as watched
- [x] Downloading as ZIP all torrents for different quality
- [ ] Personal notifications about new series
- [ ] Localization on other languages
- [ ] *Suggest other features!*

**Feel free to commit and write me PM [here](https://t.me/kraso)!**
