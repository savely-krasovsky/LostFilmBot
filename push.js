/**
 * Created by savely on 12.05.2017.
 */
const stream = require('stream');
const FeedParser = require('feedparser');

function hashCode(str){
	let hash = 0;
	if (str.length === 0) return hash;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
}

module.exports = function () {
	function fetch() {
		const feedparser = new FeedParser();

		// Загружаем RSS-файл
		console.log('RSS downloading started...');

		const options = {
			url: 'http://retre.org/rssdd.xml',
			encoding: null
		};

		request.get(options)
			.then(function (buffer) {
				// Ответ возвращается нам сразу буфером, но...
				const feed = new stream.PassThrough();
				feed.end(buffer);

				// feedparser требует Stream, так что стримим ему
				feed.pipe(feedparser);

				// Возвращаем промайз
				return new Promise(function (resolve, reject) {
					// На всякий случай обрабатываем возможную ошибку парсинга
					feedparser.on('error', function (error) {
						reject(error)
					});

					// После парсинга RSS отобразим сообщение в лог
					feedparser.on('end', function () {
						resolve('RSS successfully parsed!');
					});

					// Читаем RSS блоками сверху вниз
					feedparser.on('readable', function () {
						let item;
						while (item = feedparser.read()) {
							if (item.categories[0] === '[MP4]') {
								// Создаем временную переменную, потому что item может успеть
								// сменится за время асинхронного запроса в базу данных
								const temp = item;

								// Используя регулярки сохраняем из RSS название на английском,
								// а также номер сезона и серии
								const title = /\((.+)\)\./.exec(temp.title)[1];
								const num = /\(S(\d+)E(\d+)\)/.exec(temp.title);

								// Делаем запрос в базу с фильтром по названию,
								// чтобы узнать ID фильма. Узкое место:
								// Мы предполагаем, что фильм с таким название только ОДИН
								r.db('lostfilm').table('serials')
									.filter({'title_orig': title})

									.then(function (res) {
										// Если пусто -- ничего не делаем.
										// Скорее всего нужно обновить базу фильмов
										if (res !== null) {
											let series = {};

											if (parseInt(num[2]) !== 99)
												series = {
													title: title,
													season: parseInt(num[1]),
													episode: parseInt(num[2]),
													id: res[0].id,
													date: temp.date
												};
											else
												series = {
													title: title,
													season: parseInt(num[1]),
													episode: parseInt(num[2]),
													id: res[0].id,
													// Создаем фиктивную дату из хэша например Lost1016
													date: new Date(hashCode(title + res[0].id + parseInt(num[1])))
												};

											return r.db('lostfilm').table('feed')
												.insert(series);
										}
									})

									.then(function (res) {
										if (/Duplicate primary key/.exec(res.first_error))
											console.log('Nothing new!');
										else
											console.log('New!');
									})

									.catch(function (error) {
										reject(error);
									});
							}
						}
					});
				});
			})

			.then(function (res) {
				console.log(res);
			})

			.catch(function (error) {
				console.warn(error.message);
			});
	}

	setInterval(fetch, 1000 * 60 * 3);

	r.db('lostfilm').table('feed').changes()
		.then(function (cursor) {
			cursor.each(function(err, row) {
				if (err) reject(err);

				if (row.new_val !== null) {
					const id = row.new_val.id;
					r.db('lostfilm').table('users')
						.filter(function (user) {
							return user('favorites').contains(function (fav) {
								return fav('id').eq(id)
							});
						})

						.then(async function (res) {
							res = {
								users: res,
								new: row.new_val,
								serial: id
							};

							console.log(res);
							for (let i in res.users) {
								if (res.users.hasOwnProperty(i)) {
									const serial = R.find(R.propEq('id', res.serial))(res.users[i].favorites);

									let text = '';
									if (res.new.episode !== 99)
										text = '<b>' + serial.title + '</b>\n' +
											'Вышла ' + res.new.episode + ' серия ' + res.new.season + ' сезона.\n' +
											'Загрузить: /dl_' +	res.serial + '_' + res.new.season + '_' + res.new.episode;
									else
										text = '<b>' + serial.title + '</b>\n' +
											'Полностью вышел ' + res.new.season + ' сезон.\n' +
											'Загрузить: /dl_' +	res.serial + '_' + res.new.season;

									console.log(await bot.sendMessage(res.users[i].id, text, parse_html));
								}
							}
						})

						.catch(function (error) {
							throw new Error(error);
						})
				}
			});
		})

		.catch(function (error) {
			console.warn(error.message);
		});
};