/**
 * Created by savely on 12.05.2017.
 */
const FeedParser = require('feedparser');

module.exports = function () {
	function fetch() {
		const feedparser = new FeedParser();

		request
			.get('http://retre.org/rssdd.xml')
			.on('error', function(err) {
				console.warn(err)
			})
			.pipe(feedparser);

		feedparser.on('error', function (error) {
			console.warn(error);
		});

		feedparser.on('readable', function () {
			const stream = this;
			let item;

			while (item = stream.read()) {
				if (item.categories[0] === '[MP4]') {
					const temp = item;
					const title = /\((.+)\)\./.exec(temp.title)[1];
					const num = /\(S(\d+)E(\d+)\)/.exec(temp.title);

					r.db('lostfilm').table('serials')
						.filter({'title_orig': title})

						.then(function (res) {
							if (res !== null) {
								const series = {
									title: title,
									season: parseInt(num[1]),
									episode: parseInt(num[2]),
									id: res[0].id,
									date: temp.date
								};
								r.db('lostfilm').table('feed')
									.insert(series)

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
						})

						.catch(function (error) {
							console.warn(error.message);
						});
				}
			}
		});
	}

	setInterval(fetch, 6000);

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
								const serial = R.find(R.propEq('id', id))(res[i].favorites);
								const text = 'Вышла ' + row.new_val.episode + ' серия ' + row.new_val.season + ' сезона, ' +
									'отслеживаемого вами сериала <b>' + serial.title + '</b>. Загрузить: /dl_' +
									id + '_' + row.new_val.season + '_' + row.new_val.episode;
								await bot.sendMessage(res[i].id, text, parse_html);
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