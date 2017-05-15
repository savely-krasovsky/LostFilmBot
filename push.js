/**
 * Created by savely on 12.05.2017.
 */
const FeedParser = require('feedparser');

module.exports = function () {
	function fetch() {
		const feedparser = new FeedParser();

		// Загружаем RSS-файл
		console.log('RSS downloading started...');
		request
			.get('http://retre.org/rssdd.xml')
			.on('error', function(err) {
				console.warn(err)
			})
			.pipe(feedparser);

		// На всякий случай обрабатываем возможную ошибку парсинга
		feedparser.on('error', function (error) {
			console.warn(error.message);
		});

		// После парсинга RSS отобразим сообщение в лог
		feedparser.on('end', function () {
			console.log('RSS successfully parsed!');
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
								const series = {
									title: title,
									season: parseInt(num[1]),
									episode: parseInt(num[2]),
									id: res[0].id,
									date: temp.date
								};

								return r.db('lostfilm').table('feed')
									.insert(series);
							}
						})

						.then(function (res) {
							if (/Duplicate primary key/.exec(res.first_error))
								console.log('Nothing new!');
							else
								console.log(series);
						})

						.catch(function (error) {
							console.warn(error.message);
						});
				}
			}
		});
	}

	setInterval(fetch, 1000 * 60 * 3);

	r.db('lostfilm').table('feed').changes()
		.then(function (cursor) {
			cursor.each(function(err, row) {
				if (err) console.warn(err);
				console.log(row);

				if (row.new_val !== null) {
					const id = row.new_val.id;
					r.db('lostfilm').table('users')
						.filter(function (user) {
							return user('favorites').contains(function (fav) {
								return fav('id').eq(id)
							});
						})

						.then(async function (res) {
							for (let i in res) {
								if (res.hasOwnProperty(i)) {
									const serial = R.find(R.propEq('id', id))(res[i].favorites);
									const text = '<b>' + serial.title + '</b>\n' +
										'Вышла ' + row.new_val.episode + ' серия ' + row.new_val.season + ' сезона.\n' +
										'Загрузить: /dl_' +	id + '_' + row.new_val.season + '_' + row.new_val.episode;
									console.log(await bot.sendMessage(res[i].id, text, parse_html));
								}
							}
						})

						.catch(function (error) {
							console.warn(error.message);
						});
				}
			});
		})

		.catch(function (error) {
			console.warn(error);
		});
};