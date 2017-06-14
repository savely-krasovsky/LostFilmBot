/**
 * Created by savely on 10.05.2017.
 */
global.request = require('request-promise-native');
// Парсер HTML по типу jQuery
global.cheerio = require('cheerio');
// Либа для создания ZIP-архивов
global.archiver = require('archiver');
// Патч для дефолтной condole, расширяющий её функционал.
require('console-stamp')(console, { pattern: 'HH:MM:ss.l'});

// Конфиг с токеном для Телеграм
global.config = require('./config');
global.parse_html = {parse_mode:'HTML'};
const keyboard = {
	parse_mode: 'HTML',
	reply_markup: {
		keyboard: [
			[{text: 'Список сериалов'}, {text: 'Избранное'}],
			[{text: 'Расписание'}, {text: 'Моё расписание'}],
			[{text: '🔍Поиск'}, {text: 'ℹ️Помощь'}]
		]
	}
};

// Либа для работы с Телеграмом
const TelegramBot = require('node-telegram-bot-api');
global.bot = new TelegramBot(config.private.token, config.private.bot);

// Драйвер для работы с базой данных RethinkDB
global.r = require('rethinkdbdash')({
	db: 'lostfilm',
	servers: [
		{host: '192.168.1.2', port: 28015}
	]
});
// Либа по типу Underscore для функционального программирования
global.R = require('ramda');

// Подгружаем модули
require('./list')();
require('./push')();

const parseTorrent = require('parse-torrent');

/**
 * Конвертирует ID из string в int для правильной сортировки в БД
 * @param body
 * @returns {Array}
 */
global.fixId = function fixId(body) {
	let temp = [];
	for (let i in body.data)
		if (body.data.hasOwnProperty(i))
			temp.push({
				alias: body.data[i].alias,
				channels: body.data[i].channels,
				date: body.data[i].date,
				genres: body.data[i].genres,
				has_icon: body.data[i].has_icon,
				has_image: body.data[i].has_image,
				id: parseInt(body.data[i].id),
				img: body.data[i].img,
				link: body.data[i].link,
				not_favorited: body.data[i].not_favorited,
				rating: body.data[i].rating,
				status: body.data[i].status,
				status_5: body.data[i].status_5,
				status_auto: body.data[i].status_auto,
				status_auto_: body.data[i].status_auto_,
				status_season: body.data[i].status_season,
				title: body.data[i].title,
				title_orig: body.data[i].title_orig
			});
	return temp;
};

bot.onText(/^\/start/, function (msg) {
	bot.sendMessage(msg.chat.id, 'Жми /help, чтобы узнать базовые команды.', keyboard);
});

bot.onText(/^\/help|^ℹ️Помощь/, function (msg) {
	bot.sendMessage(msg.chat.id,
		'<b>LostFilm.TV Bot 1.1β</b> by @kraso\n\n' +
		'<b>Самостоятельные команды:</b>\n' +
		'/start - Если пропала удобная клавиатура ¯\\_(ツ)_/¯\n' +
		'/login - Авторизация\n' +
		'/list - Список сериалов по алфавиту\n' +
		'/mylist - Список избранных сериалов\n' +
		'/schedule - Расписание выхода новых серий\n' +
		'/myschedule - Расписание выхода избранных\n' +
		'/search - Поиск среди всех озвученных сериалов\n\n' +
		'<b>Работают только с кодом:</b>\n' +
		'<code>/about</code> - Описание сериала\n' +
		'<code>/full</code> - Все сезоны и серии сериала\n' +
		'<code>/fav</code> - Добавить/Удалить сериал из Избранного\n' +
		'<code>/dl</code> - Загрузить серию/сезон\n' +
		'<code>/mark</code> - Отметить серию/сезон (не)просмотренной\n\n' +
		'<b>Примечание:</b>\n' +
		'Ограничения Telegram не позволяют передавать напрямую torrent-файлы, ' +
		'поэтому все три типа качества упакованы в один ZIP-архив.', parse_html);
});

// Логинит нас и сохраняет куку в базу данных.
bot.onText(/^\/login/, function (msg) {
	bot.sendMessage(msg.chat.id, 'Введите электронную почту:', {reply_markup: {force_reply: true}})
		.then(function (res) {
			return new Promise(function (resolve) {
				bot.onReplyToMessage(msg.chat.id, res.message_id, function (login) {
					resolve(login.text);
				});
			});
		})

		.then(function (res) {
			return Promise.all([
				res,
				bot.sendMessage(msg.chat.id, 'Введите пароль:', {reply_markup: {force_reply: true}})
			]);
		})

		.then(function (res) {
			return new Promise(function (resolve) {
				bot.onReplyToMessage(msg.chat.id, res[1].message_id, function (pass) {
					resolve([res[0], pass.text])
				});
			});
		})

		.then(function (res) {
			const options = {
				url: 'https://lostfilm.tv/ajaxik.php',
				formData: {
					act: 'users',
					type: 'login',
					mail: res[0],
					pass: res[1],
					rem: '1'
				},
				resolveWithFullResponse: true
			};

			return request.post(options);
		})

		.then(function (res) {
			const body = JSON.parse(res.body);
			if (res.headers.hasOwnProperty('set-cookie'))
				return {
					body: body,
					// Выделяем нужную нам последнюю (!) куку
					cookie: res.headers['set-cookie'].slice(-1)[0]
				};
			else
				throw new Error('Incorrect login or password!');
		})

		.then(function (res) {
			if (res.body.success && res.body.success === true)
				return r.table('users')
					.insert({
						id: msg.from.id,
						cookie: res.cookie
					}, {conflict: 'update'});
			else
				throw new Error('Lostfilm answered strange response on login attempt!');
		})

		.then(function (res) {
			console.log(res);
			bot.sendMessage(msg.chat.id, 'Авторизовано!', keyboard);
		})

		.catch(function (error) {
			console.warn(error.message);
			bot.sendMessage(msg.chat.id, 'Что-то пошло не так...', keyboard);
		});
});

/**
 * Функция для загрузки торрент-файлов и упаковки их в zip-архив.
 * Последний параметр torrentOnly не обязателен и требуется только для обладателей
 * личного бота. Берет нужное качество из конфига и загружает только его.
 * @param from_id
 * @param serial
 * @param season
 * @param episode
 * @param torrentOnly
 * @returns {Promise}
 */
global.download = function(from_id, serial, season, episode, torrentOnly) {
	// Флаг для пользователей личного бота.
	// Требуется, когда нужна загрузка определенного торрента, а не архива.
	if (torrentOnly === undefined)
		torrentOnly = false;

	return new Promise(function (resolve, reject) {
		r.table('users')
			.get(from_id)

			.then(function (res) {
				if (res !== null && res.cookie !== undefined) {
					return res;
				} else
					throw new Error('[/dl] User not authorized!');
			})

			.then(function (res) {
				const j = request.jar();
				const cookie = request.cookie(res.cookie);
				const url = 'https://www.lostfilm.tv';
				j.setCookie(cookie, url);

				// Делаем запрос в некую поисковую систему LostFilm
				// которая принимает три параметра: c, s, e (сериал, сезон, эпизод)
				// и отправляет в ответ запрос на переадресацию
				const options = {
					url: 'https://lostfilm.tv/v_search.php',
					jar: j,
					qs: {c: serial, s: season, e: episode},
					transform: function (body) {
						return cheerio.load(body);
					}
				};

				return request.get(options);
			})

			.then(function ($) {
				const options = {
					url: $('body > a').attr('href'),
					transform: function (body) {
						return cheerio.load(body);
					}
				};

				return request.get(options);
			})

			.then(function ($) {
				// В перспективе нам может понадобиться usess-код, расположенный внизу
				// любой страницы retre.org, поэтому парсим и сохраняем в базу "на всякий"
				const usess = /- (.+) ;/.exec($('.footer-banner.left > a').attr('title'))[1];
				r.table('users')
					.get(from_id)
					.update({
						usess: usess
					});

				const item = $('.inner-box--item');

				if (item.is('.inner-box--item')) {
					// Создаем массив file, содержащий три объекта с качеством и ссылкой на загрузку
					let files = [];
					item
						.each(function () {
							//const quality = $(this).children('.inner-box--label').text().trim();
							const options = {
								url: $('.inner-box--link.main > a', this).attr('href'),
								encoding: null
							};

							files.push(request.get(options));
						});

					return Promise.all(files);
				} else
					throw new Error('Incorrect codes for download!');
			})

			.then(function (res) {
				// Создаем архив ZIP
				let archive = archiver('zip', {
					zlib: { level: 9 }
				});

				let text = '<b>Магнет-ссылки:</b>\n\n';
				for (let i in res) {
					if (res.hasOwnProperty(i)) {
						const buffer = Buffer.from(res[i], 'utf8');
						const torrent = parseTorrent(buffer);

						text += ('<b>' + torrent.name + '</b>\n<code>' + parseTorrent.toMagnetURI({
							name: torrent.name,
							infoHash: torrent.infoHash,
							announce: torrent.announce
						}) + '</code>\n\n');

						// Чекаем наш флаг и существование конфигурации для личного бота
						if (torrentOnly === true && config.private.download) {
							const re = new RegExp(config.private.download.quality);

							// Регуляркой чекаем, какой нам нужно формат отдать в промайз
							if (re.exec(torrent.name))
								resolve({
									magnet: text,
									filename: `${torrent.name}.torrent`,
									buffer: buffer
								});
						}

						archive.append(buffer, {name: `${torrent.name}.torrent`});
					}
				}

				// Завершаем компоновку архива
				archive.finalize();

				// Создаем временный массив temp для будущего Buffer
				let temp = [];
				archive.on('data', function (chunk) {
					// Стримим содержимое архива пачками chunk в temp
					temp.push(chunk);
				});

				archive.on('error', function (error) {
					throw new Error(error);
				});

				// По завершению стрима собираем Buffer
				archive.on('end', function () {
					const buffer = Buffer.concat(temp);
					r.table('serials')
						.get(serial)

						.then(function(res) {
							let filename = '';
							if (episode === 999)
								filename = `${res.alias}_S${season}.zip`;
							else
								filename = `${res.alias}_S${season}E${episode}.zip`;

							resolve({
								magnet: text,
								filename: filename,
								buffer: buffer
							});
						})

						.catch(function (error) {
							throw new Error(error);
						})
				});
			})

			.catch(function (error) {
				reject(error);
			});
	});
};

// Загружает нужные нам торрент-файлы и пакует их в ZIP для отправки адресату.
bot.onText(/^\/dl_(\d+)_(\d+)_(\d+)|^\/dl_(\d+)_(\d+)/, function (msg, match) {
	let serial, season, episode;
	if (match[3] !== undefined) {
		serial = parseInt(match[1]);
		season = parseInt(match[2]);
		episode = parseInt(match[3]);
	} else {
		serial = parseInt(match[4]);
		season = parseInt(match[5]);
		episode = 999;
	}

	download(msg.from.id, serial, season, episode)
		.then(async function (res) {
			await bot.sendMessage(msg.chat.id, res.magnet, parse_html);
			await bot.sendDocument(msg.chat.id, res.buffer, {}, res.filename);
		})

		.catch(function (error) {
			console.warn(error.message);
		})
});

// Отмечает серию или сезон, как Просмотренный (или наоборот) через API Lostfilm.
bot.onText(/^\/mark_(\d+)_(\d+)_(\d+)|^\/mark_(\d+)_(\d+)/, function (msg, match) {
	let formData;
	if (match[3] !== undefined)
		formData = {
			act: 'serial',
			type: 'markepisode',
			val: `${match[1]}-${match[2]}-${match[3]}`
		};
	else
		formData = {
			act: 'serial',
			type: 'markseason',
			val: `${match[4]}-${match[5]}`
		};

	r.table('users')
		.get(msg.from.id)

		.then(function (res) {
			if (res !== null && res.cookie !== undefined) {
				return res;
			}
			else {
				bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /login');
				throw new Error('[/mark] User not authorized!');
			}
		})

		.then(function (res) {
			const j = request.jar();
			const cookie = request.cookie(res.cookie);
			const url = 'https://www.lostfilm.tv';
			j.setCookie(cookie, url);

			const options = {
				url: 'https://lostfilm.tv/ajaxik.php',
				jar: j,
				formData: formData,
				json: true
			};

			return request.post(options);
		})

		.then(function (res) {
			if (res.result === 'on')
				bot.sendMessage(msg.chat.id, 'Серия/сезон отмечен просмотренным!');

			if (res.result === 'off')
				bot.sendMessage(msg.chat.id, 'Серия/сезон отмечен непросмотренным!')
		})

		.catch(function (error) {
			console.warn(error.message);
			bot.sendMessage(msg.chat.id, 'Что-то пошло не так...');
		});
});

// Отмечает сериал как Избранный (или наоборот) через API Lostfilm.
bot.onText(/^\/fav_(\d+)/, function (msg, match) {
	r.table('users')
		.get(msg.from.id)

		.then(function (res) {
			if (res !== null && res.cookie !== undefined) {
				return res;
			} else {
				bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /login');
				throw new Error('[/fav] User not authorized!');
			}
		})

		.then(function (res) {
			const j = request.jar();
			const cookie = request.cookie(res.cookie);
			const url = 'https://www.lostfilm.tv';
			j.setCookie(cookie, url);

			const options = {
				method: 'POST',
				url: 'https://lostfilm.tv/ajaxik.php',
				jar: j,
				formData: {
					act: 'serial',
					type: 'follow',
					id: parseInt(match[1])
				},
				json: true
			};

			return request.post(options);
		})

		.then(function (res) {
			if (res.result === 'on')
				bot.sendMessage(msg.chat.id, 'Сериал добавлен в избранное!');

			if (res.result === 'off')
				bot.sendMessage(msg.chat.id, 'Сериал удален из избранного!');
		})

		.catch(function (error) {
			console.warn(error.message);
			bot.sendMessage(msg.chat.id, 'Что-то пошло не так...');
		});
});

// Сервисная команда для обновления всех существующих сериалов в базе.
// По идее нужно автоматизировать её выполнение.
bot.onText(/^\/update/, async function () {
	let flag = true;
	let cycle = 0;
	do {
		const options = {
			method: 'POST',
			url: 'https://lostfilm.tv/ajaxik.php',
			formData: {
				act: 'serial',
				type: 'search',
				o: cycle * 10,
				s: 3,
				t: 0
			},
			json: true
		};

		cycle++;

		const part = new Promise(function (resolve, reject) {
			request.post(options)
				.then(function (body) {
					if (body.data.length < 10)
						flag = false;

					body = fixId(body);

					return r.table('serials')
						.insert(body, {conflict: 'update'});
				})

				.then(function (res) {
					resolve(res)
				})

				.catch(function (error) {
					reject(error);
				});
			});

		console.log(await part);
	} while (flag);
});

bot.onText(/^\/search|🔍Поиск/, function (msg) {
    /**
	 * Возвращает нужный запрос в зависимости от детектированного языка
     * @param type
     * @param text
     * @returns {Promise}
     */
	function dbRequest(type, text) {
		if (type === 'cyrillic')
			type = 'title';
		else if (type === 'latin')
			type = 'title_orig';

		return r.table('serials').orderBy(type)
			.filter(function (serials) {
				return serials(type).match('(?i)' + text);
			}).limit(10);
	}


	bot.sendMessage(msg.chat.id, 'Введите часть или полное название сериала на любом языке.',
		{reply_markup: {force_reply: true}})

		.then(function (res) {
			return new Promise(function (resolve) {
				bot.onReplyToMessage(res.chat.id, res.message_id, function (res) {
					resolve(res);
				});
			});
		})

		.then(function (res) {
			return r.branch(
				r.expr(res.text).match("\\p{Latin}+").ne(null),
				dbRequest('latin', res.text),
				dbRequest('cyrillic', res.text)
			);
		})

		.then(function (res) {
			let text = `Найдено: <b>${res.length} совп.</b>\n\n`;
			for (let i in res) {
				if (res.hasOwnProperty(i))
					text += `${res[i].title} (${res[i].title_orig})\n/about_${res[i].id} /full_${res[i].id} /fav_${res[i].id}\n\n`;
			}

			bot.sendMessage(msg.chat.id, text, keyboard);
		})

		.catch(function (error) {
			console.warn(error.message);
			bot.sendMessage(msg.chat.id, 'Что-то пошло не так...', keyboard);
		});
});

/**
 * Парсит расписание из объекта $, который понимает cheerio.
 * На выходе готовый массив.
 * @param $
 * @returns {Array}
 */
function parseSchedule($) {
	const table = $('tbody > tr');

	let result = [];
	let count = 0;
	table
		.each(function (i, elem) {
			if ($('th', elem).is('th')) {
				result[count] = [];
				result[count].push($('th', elem).text());
				count++;
			}

			let block = [];
			if ($('td', elem).is('td')) {
				const temp = $('td', elem).text().replace(/\t/g, '').replace(/\r/g, '').split('\n');
				for (let i in temp) {
					if (temp.hasOwnProperty(i) && temp[i] !== '')
						block.push(temp[i]);
				}
			}

			if (block.length > 0)
				result[count - 1].push(block);
		});

	return result;
}

bot.onText(/^\/schedule|^\/myschedule|^Расписание|^Моё расписание/, function (msg, match) {
	let base_url = '';
	if (match[0] === '/myschedule' || match[0] === 'Моё расписание')
		base_url = 'https://www.lostfilm.tv/schedule/my_1/date_ru';
	else if (match[0] === '/schedule' || match[0] === 'Расписание')
		base_url = 'https://www.lostfilm.tv/schedule/my_0/date_ru';

	r.table('users')
		.get(msg.from.id)

		.then(function (res) {
			if (res !== null && res.cookie !== undefined) {
				return res;
			} else {
				bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /login');
				throw new Error('[/schedule] User not authorized!');
			}
		})

		.then(function (res) {
			const j = request.jar();
			const cookie = request.cookie(res.cookie);
			const url = 'https://www.lostfilm.tv';
			j.setCookie(cookie, url);

			const options = {
				url: base_url,
				jar: j,
				transform: function (body) {
					return cheerio.load(body)
				}
			};

			return request.get(options);
		})

		.then(async function ($) {
			const result = parseSchedule($);

			let text = '';
			for (let i in result) {
				if (result.hasOwnProperty(i)) {
					const caption = result[i][0].replace(/[а-яА-Я0-9]/g, function (letter) {
						return letter.toUpperCase();
					});

					text += `\n<b>${caption}</b>\n\n`;
					for (let j = 1; j < result[i].length; j++) {
						const temp = {
							title: result[i][j][0],
							title_orig: result[i][j][1],
							num: result[i][j][2],
							howLong: result[i][j][5],
							date: result[i][j][4]
						};

						try {
							const serial = await r.table('serials')
								.filter({'title_orig': temp.title_orig}).nth(0);

							text += `${temp.title} (${temp.title_orig})\n${temp.num} ${temp.howLong} <i>(${temp.date})</i>\n/about_${serial.id} /full_${serial.id}\n\n`
						} catch (error) {
							throw new Error(error);
						}
					}
				}
			}

			return bot.sendMessage(msg.chat.id, text, parse_html);
		})

		.then(function (res) {
			console.log(res);
		})

		.catch(function (error) {
			console.warn(error.message);
			bot.sendMessage(msg.chat.id, 'Что-то пошло не так...');
		})
});

bot.onText(/^\/donate/, function (msg) {
	bot.sendMessage(msg.chat.id, "Небольшую сумму на поддержание и разработку можно подкинуть <a href='https://krasovsky.me/bots'>здесь</a>.", {parse_mode: 'HTML'});
});

// Логирование всех взаимодействий с ботом.
bot.on('message', function (msg) {
	console.log(msg);
});
