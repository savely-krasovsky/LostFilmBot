/**
 * Created by savely on 10.05.2017.
 */
global.request = require('request');
// Парсер HTML по типу jQuery
global.cheerio = require('cheerio');
// Либа для создания ZIP-архивов
global.archiver = require('archiver');
// Патч для дефолтной condole, расширяющий её функционал.
require('console-stamp')(console, { pattern: 'HH:MM:ss.l'});

// Конфиг с токеном для Телеграм
global.config = require('./config');
global.parse_html = {parse_mode:'HTML'};

// Либа для работы с Телеграмом
const TelegramBot = require('node-telegram-bot-api');
global.bot = new TelegramBot(config.private.token, { polling: true });

// Драйвер для работы с базой данных RethinkDB
global.r = require('rethinkdbdash')();
// Либа по типу Underscore для функционального программирования
global.R = require('ramda');

// Подгружаем модули
require('./list')();
require('./push')();

// Конвертирует ID из string в int для правильной сортировки в БД
global.fixId = function fixId(body) {
	let temp = [];
	for (let i in body.data)
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
	bot.sendMessage(msg.chat.id, 'Жми /help, чтобы узнать базовые команды.');
});

bot.onText(/^\/help/, function (msg) {
	bot.sendMessage(msg.chat.id,
		'/login <code>email pass</code> - Авторизация\n' +
		'/list - Список сериалов по дате выхода\n' +
		'/mylist - Список избранных сериалов по дате выхода\n', parse_html);
});

// Логинит нас и сохраняет куку в базу данных.
bot.onText(/^\/login (.+) (.+)/, function (msg, match) {
	const options = {
		method: 'POST',
		url: 'https://lostfilm.tv/ajaxik.php',
		formData: {
			act: 'users',
			type: 'login',
			mail: match[1],
			pass: match[2],
			rem: '1'
		}
	};

	request(options, function (err, res, body) {
		if (err) throw new Error(err);

		body = JSON.parse(body);
		console.log(body);

		if (body.success && body.success === true)
			r.db('lostfilm').table('users')
				.insert({
					id: msg.from.id,
					cookie: res.headers['set-cookie'][res.headers['set-cookie'].length - 1]
				}, {conflict: 'update'})

				.then(function (status) {
					console.log(status);
					bot.sendMessage(msg.chat.id, 'Авторизовано!')
				})

				.catch(function (error) {
					console.warn(error.message);
				});
		else
			bot.sendMessage(msg.chat.id, 'Что-то пошло не так.')
	})
});

// Загружает нужные нам торрент-файлы и пакует их в ZIP для отправки адресату.
bot.onText(/^\/dl_(\d+)_(\d+)_(\d+)|^\/dl_(\d+)_(\d+)/, function (msg, match) {
	let qs;
	if (match[3] !== undefined)
		qs = {c: match[1], s: match[2], e: match[3]};
	else
		qs = {c: match[4], s: match[5], e: 999};

	r.db('lostfilm').table('users')
		.get(msg.from.id)

		.then(function (res) {
			if (res !== null && res.cookie !== undefined) {
				const j = request.jar();
				const cookie = request.cookie(res.cookie);
				const url = 'https://www.lostfilm.tv';
				j.setCookie(cookie, url);

				const options = {
					method: 'GET',
					url: 'https://lostfilm.tv/v_search.php',
					jar: j,
					qs: qs
				};

				request(options, function (err, res, body) {
					if (err) console.warn(err.message);

					let $ = cheerio.load(body);
					if ($('body > a').is('a'))
						request($('body > a').attr('href'), function (err, res, body) {
							if (err) console.warn(err.message);

							$ = cheerio.load(body);
							if ($('.inner-box--item').is('.inner-box--item')) {
								let file = [];
								$('.inner-box--item')
									.each(function (i) {
										file[i] = {
											quality: $(this).children('.inner-box--label').text().trim(),
											link: $('.inner-box--link.main > a', this).attr('href')
										};
									});

								let archive = archiver('zip', {
									zlib: { level: 9 }
								});

								for (let i in file) {
									const stream = request.get(file[i].link);
									archive.append(stream, {name: file[i].quality + '.torrent'})
								}

								archive.finalize();

								let temp = [];
								archive.on('data', function (chunk) {
									temp.push(chunk);
								});

								archive.on('end', function () {
									const buffer = Buffer.concat(temp);
									console.log(buffer);

									r.db('lostfilm').table('serials')
										.get(parseInt(match[1] || match[4]))

										.then(function (res) {
											const fileName = `${res.alias}_s${match[2] || match[5]}e${match[3]|| 'All'}.zip`;
											bot.sendDocument(msg.chat.id, buffer, {}, fileName);
										})

										.catch(function (error) {
											console.warn(error.message);
										});
								});
							} else
								bot.sendMessage(msg.chat.id, 'Указана неверная серия или сезон.');

							const usess = /- (.+) ;/.exec($('.footer-banner.left > a').attr('title'))[1];
							r.db('lostfilm').table('users')
								.insert({
									id: msg.from.id,
									usess: usess
								}, {conflict: 'update'})

								.then(function (status) {
									console.log(status)
								})

								.catch(function (error) {
									console.warn(error.message);
								});
						});
					else
						bot.sendMessage(msg.chat.id, 'Возможно, вы сменили пароль или аннулировали сессию.')
				})
			} else
				bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /help');
		})

		.catch(function (error) {
			console.warn(error.message);
		});
});

// Отмечает серию или сезон, как Просмотренный (или наоборот) через API Lostfilm.
bot.onText(/^\/mw_(\d+)_(\d+)_(\d+)|^\/mw_(\d+)_(\d+)/, function (msg, match) {
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

	r.db('lostfilm').table('users')
		.get(msg.from.id)

		.then(function (res) {
			if (res !== null && res.cookie !== undefined) {
				const j = request.jar();
				const cookie = request.cookie(res.cookie);
				const url = 'https://www.lostfilm.tv';
				j.setCookie(cookie, url);

				const options = {
					method: 'POST',
					url: 'https://lostfilm.tv/ajaxik.php',
					jar: j,
					formData: formData
				};

				request(options, function (err, res, body) {
					if (err) console.warn(err.message);

					body = JSON.parse(body);

					if (body.result === 'on')
						bot.sendMessage(msg.chat.id, 'Серия/сезон отмечен просмотренным!');

					if (body.result === 'off')
						bot.sendMessage(msg.chat.id, 'Серия/сезон отмечен непросмотренным!')
				});
			}
			else
				bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /help');
		})

		.catch(function (error) {
			console.warn(error.message);
		});
});

// Отмечает сериал как Избранный (или наоборот) через API Lostfilm.
bot.onText(/^\/fav_(\d+)/, function (msg, match) {
	r.db('lostfilm').table('users')
		.get(msg.from.id)

		.then(function (res) {
			if (res !== null && res.cookie !== undefined) {
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
					}
				};

				request(options, function (err, res, body) {
					if (err) console.warn(err.message);

					body = JSON.parse(body);

					if (body.result === 'on')
						bot.sendMessage(msg.chat.id, 'Сериал добавлен в избранное!');

					if (body.result === 'off')
						bot.sendMessage(msg.chat.id, 'Сериал удален из избранного!')
				});
			} else
				bot.sendMessage(msg.chat.id, 'Авторизуйтесь! /help');
		})

		.catch(function (error) {
			console.warn(error.message);
		})
});

// Сервисная команда для обновления всех существующих сериалов в базе.
// По идее нужно автоматизировать её выполнение.
bot.onText(/^\/update/, async function (msg) {
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
			}
		};

		cycle++;

		const part = new Promise(function (resolve, reject) {
			request(options, function (err, res, body) {
				if (err) reject(err);

				body = JSON.parse(body);
				if (body.data.length < 10)
					flag = false;

				body = fixId(body);

				r.db('lostfilm').table('serials')
					.insert(body, {conflict: 'update'})

					.then(function (status) {
						resolve(status);
					})

					.catch(function (error) {
						reject(error);
					})
			});
		});

		console.log(await part);
	} while (flag);
});

// Логирование всех взаимодействий с ботом.
bot.on('message', function (msg) {
	console.log(msg);
});