/**
 * Created by savely on 10.05.2017.
 */
const Main = require('./lists/main');
const Personal = require('./lists/personal');
const Seasons = require('./lists/seasons');
const About = require('./lists/about');

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
		r.table('users')
			.get(msg.from.id)

			.then(async function (res) {
				if (res !== null && res.cookie !== undefined) {
					const j = request.jar();
					const cookie = request.cookie(res.cookie);
					const url = 'https://www.lostfilm.tv';
					j.setCookie(cookie, url);

					r.table('users').get(msg.from.id)
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
							url: 'https://lostfilm.tv/ajaxik.php',
							jar: j,
							formData: {
								act: 'serial',
								type: 'search',
								o: cycle * 10,
								s: 1,
								t: 99
							},
							json: true
						};

						cycle++;

						const part = new Promise(function (resolve, reject) {
							request.post(options)
								.then(function (res) {
									if (res.no_fav === true || res.data === undefined || res.data.length < 10)
										flag = false;

									res = fixId(res);

									return r.table('users').get(msg.from.id)
										.update({
											favorites: r.row('favorites').spliceAt(0, res)
										});
								})

								.then(function (res) {
									resolve(res);
								})

								.catch(function (error) {
									reject(error);
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
				} else {
					bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /login');
					throw new Error('[/mylist] User not authorized!');
				}
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

	bot.onText(/^\/about_(.+)/, function (msg, match) {
		r.table('serials')
			.get(parseInt(match[1]))

			.then(function (res) {
				const options = {
					url: `https://www.lostfilm.tv${res.link}/`,
					transform: function (body) {
						return cheerio.load(body)
					}
				};
				return Promise.all([res, request.get(options)]);
			})

			.then(function (res) {
				let text = '<b>' + res[0].title + '</b> (' + res[0].title_orig + ')\n\n' +
					'<b>Год выпуска:</b> ' + res[0].date + '\n' +
					'<b>Канал:</b> ' + res[0].channels + '\n' +
					'<b>Рейтинг:</b> ' + res[0].rating + '\n' +
					'<b>Жанр:</b> ' + res[0].genres + '\n';

				const $ = res[1];
				text += $('.text-block.description > .body').text();

				r.table('serials').get(parseInt(match[1]))
					.update({
						description: text
					})

					.then(async function () {
						const serialId = parseInt(match[1]);
						const temp = {
							p: 1,
							t: 'about',
							s: serialId
						};

						temp.mp = await About.getPageCount(temp);

						bot.sendPhoto(msg.chat.id, `http:${res[0].img}`)
							.then(async function () {
								bot.sendMessage(msg.chat.id, await About.getPage(temp), getPagination(temp));
							});
					})

					.catch(function (error) {
						console.warn(error.message);
					});
			})

			.catch(function (error) {
				console.warn(error.message);
			});
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

		if (data.t === 'about') {
			const temp = {
				p: data.p,
				mp: await About.getPageCount(data),
				t: data.t,
				s: data.s
			};
			text = await About.getPage(temp);
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