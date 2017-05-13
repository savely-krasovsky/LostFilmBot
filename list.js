/**
 * Created by savely on 10.05.2017.
 */
const Main = require('./lists/main');
const Personal = require('./lists/personal');
const Seasons = require('./lists/seasons');

module.exports = function () {
	// Создает кнопочную inline-навигацию
	function getPagination(data) {
		let keys = [];
		if (data.p > 1) {
			const temp = R.clone(data);
			temp.p = 1;
			keys.push({ text: `<< ️${temp.p}`, callback_data: JSON.stringify(temp)});
		}
		if (data.p > 2) {
			const temp = R.clone(data);
			temp.p = temp.p - 1;
			keys.push({ text: `< ${temp.p}`, callback_data: JSON.stringify(temp)});
		}

		keys.push({ text: `- ${data.p}️ -`, callback_data: JSON.stringify(data)});

		if (data.p < data.mp - 1) {
			const temp = R.clone(data);
			temp.p = temp.p + 1;
			keys.push({ text: `${temp.p}️ >`, callback_data: JSON.stringify(temp)});
		}
		if (data.p < data.mp) {
			const temp = R.clone(data);
			temp.p = temp.mp;
			keys.push({ text: `${temp.p} >>`, callback_data: JSON.stringify(temp)});
		}

		return {
			reply_markup: JSON.stringify({
				inline_keyboard: [keys]
			}),
			parse_mode: 'HTML'
		};
	}

	// Отображает первую страницу /list по алфавиту
	bot.onText(/^\/list|^Список сериалов/, async function (msg) {
		const temp = {
			p: 1,
			t: 'public',
		};

		temp.mp = await Main.getPageCount();

		bot.sendMessage(msg.chat.id, await Main.getPage(temp), getPagination(temp))
	});

	// ОБНОВЛЯЕТ ВЕСЬ и отображает первую страницу личного /mylist
	bot.onText(/^\/mylist|^Избранное/, async function (msg) {
		r.db('lostfilm').table('users')
			.get(msg.from.id)

			.then(async function (res) {
				if (res !== null && res.cookie !== undefined) {
					const j = request.jar();
					const cookie = request.cookie(res.cookie);
					const url = 'https://www.lostfilm.tv';
					j.setCookie(cookie, url);

					r.db('lostfilm').table('users').get(msg.from.id)
						.update({
							favorites: []
						})

						.then(function (res) {
							console.log(res);
						})

						.catch(function (error) {
							console.warn(error.message);
						});

					let flag = true;
					let cycle = 0;
					do {
						const options = {
							method: 'POST',
							url: 'https://lostfilm.tv/ajaxik.php',
							jar: j,
							formData: {
								act: 'serial',
								type: 'search',
								o: cycle * 10,
								s: 1,
								t: 99
							}
						};

						cycle++;

						const part = new Promise(function (resolve, reject) {
							request(options, function (err, res, body) {
								if (err) reject(err);

								body = JSON.parse(body);

								if (body.no_fav === true || body.data === undefined || body.data.length < 10)
									flag = false;

								body = fixId(body);

								r.db('lostfilm').table('users').get(msg.from.id)
									.update({
										favorites: r.row('favorites').spliceAt(0, body)
									})

									.then(function (res) {
										resolve(res);
									})

									.catch(function (error) {
										reject(error);
									});
							});
						});

						console.log(await part);
					} while (flag);

					const temp = {
						p: 1,
						t: 'private',
					};

					temp.mp = await Personal.getPageCount(msg.from.id);

					bot.sendMessage(msg.chat.id, await Personal.getPage(temp, msg.from.id), getPagination(temp))
				} else
					bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /help');
			})

			.catch(function (error) {
				console.warn(error.message);
			});
	});

	// Отображает первый сезон и навигацию по сезонам
	bot.onText(/^\/full_(.+)/, async function (msg, match) {
		const serialId = parseInt(match[1]);
		const temp = {
			p: 1,
			t: 'seasons',
			s: serialId
		};

		temp.mp = await Seasons.getPageCount(temp);

		bot.sendMessage(msg.chat.id, await Seasons.getPage(temp), getPagination(temp));
	});

	// Обрабатывает перемещение по страницам
	bot.on('callback_query', async function (message) {
		const msg = message.message;
		const data = JSON.parse(message.data);

		let text, editOptions;

		if (data.t === 'public') {
			const temp = {
				p: data.p,
				mp: await Main.getPageCount(),
				t: data.t
			};
			text = await Main.getPage(temp);
			editOptions = Object.assign({},
				getPagination(temp),
				{chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML'});
		}

		if (data.t === 'private') {
			const temp = {
				p: data.p,
				mp: await Personal.getPageCount(message.from.id),
				t: data.t
			};
			text = await Personal.getPage(temp, message.from.id);
			editOptions = Object.assign({},
				getPagination(temp),
				{chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML'});
		}

		if (data.t === 'seasons') {
			const temp = {
				p: data.p,
				mp: await Seasons.getPageCount(data),
				t: data.t,
				s: data.s
			};
			text = await Seasons.getPage(temp);
			editOptions = Object.assign({},
				getPagination(temp),
				{chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML'});
		}

		bot.editMessageText(text, editOptions)
			.then(function (status) {
				console.log(status);
				bot.answerCallbackQuery(message.id).then(function (status) {
					console.log(status);
				});
			})

			.catch(function (error) {
				console.log(error.message);
				bot.answerCallbackQuery(message.id, 'Достаточно нажать один раз! (Или достигнут лимит, подожди немного)').then(function (status) {
					console.log(status);
				});
			});
	});
};