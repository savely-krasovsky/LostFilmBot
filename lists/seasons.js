/**
 * Created by savely on 12.05.2017.
 */
module.exports = {
	// Считает кол-во сезонов в одном сериале
	getPageCount: function (data) {
		return new Promise(function (resolve, reject) {
			r.table('serials')
				.get(data.s)

				.then(function (serial) {
					const options = {
						url: `https://www.lostfilm.tv/series/${serial.alias}/seasons/sort_1`,
						transform: function (body) {
							return cheerio.load(body);
						}
					};

					return request.get(options);
				})

				.then(function ($) {
					resolve(parseInt($('.series-block > div').length));
				})

				.catch(function (error) {
					reject(error);
				});
		});
	},

	// Получает один сезон для страницы /full_xxx
	getPage: function (data) {
		let text = '';

		return new Promise(function(resolve, reject) {
			r.table('serials')
				.get(data.s)

				.then(function (serial) {
					text = `<b>${serial.title} (${serial.title_orig})</b>\n/about_${serial.id}\n`;

					const options = {
						url: `https://www.lostfilm.tv/series/${serial.alias}/seasons/sort_1`,
						transform: function (body) {
							return cheerio.load(body);
						}
					};

					return request.get(options);
				})

				.then(function ($) {
					const ctx = `.series-block > div:nth-child(${data.p})`;

					text += `\n<b>${$('h2', ctx).text()}</b>\n`;

					let dl_season = '<i>Ещё не вышел</i>';
					let mark_season = '';

					const temp = $('.movie-details-block > .external-btn', ctx).attr('onclick');
					if (temp !== undefined) {
						const re = new RegExp('\\d+', 'g');
						const id = re.exec(temp);
						const season = re.exec(temp);

						if (id !== null) {
							dl_season = `/dl_${id}_${season}`;
							mark_season = `/mark_${id}_${season}`;
						}
					}

					text += `${dl_season} ${mark_season}\n\n`;
					$('tr', ctx)
						.each(function () {
							const num = $(this).children('.beta').text();

							let name = '';
							if ($('.gamma > div', this).is('div'))
								name = $('.gamma > div', this).contents().get(0).data.trim() +
									' (' + $('.gamma > div > span', this).text().trim() + ')';
							else
								name = $('.gamma', this).contents().get(0).data.trim() +
									' (' + $('.gamma > span', this).text().trim() + ')';

							const temp = $('.zeta > div', this).attr('onclick');
							const re = new RegExp('\\d+', 'g');
							const id = re.exec(temp);
							const season = re.exec(temp);
							const episode = re.exec(temp);

							let dl_episode = '<i>Ещё не вышла</i>';
							let mark_episode = '';

							if (id !== null) {
								dl_episode = `/dl_${id}_${season}_${episode}`;
								mark_episode = `/mark_${id}_${season}_${episode}`;
							}

							text += `${num}: ${name}\n${dl_episode} ${mark_episode}\n\n`;
						});

					resolve(text);
				})

				.catch(function (error) {
					reject(error);
				});
		});
	}
};