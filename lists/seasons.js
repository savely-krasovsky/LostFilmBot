/**
 * Created by savely on 12.05.2017.
 */
module.exports = {
	// Считает кол-во сезонов в одном сериале
	getPageCount: function (data) {
		return new Promise(function (resolve, reject) {
			r.db('lostfilm').table('serials')
				.get(data.s)

				.then(function (serial) {
					request(`https://www.lostfilm.tv/series/${serial.alias}/seasons/sort_1`, function (err, res, body) {
						if (err) reject(err);

						const $ = cheerio.load(body);

						resolve(parseInt($('.series-block > div').length));
					});
				})

				.catch(function (error) {
					reject(error);
				})
		});
	},

	// Получает один сезон для страницы /full_xxx
	getPage: function (data) {
		return new Promise(function(resolve, reject) {
			r.db('lostfilm').table('serials')
				.get(data.s)

				.then(function (serial) {
					request(`https://www.lostfilm.tv/series/${serial.alias}/seasons/sort_1`, function (err, res, body) {
						if (err) reject(err);

						const $ = cheerio.load(body);
						const ctx = `.series-block > div:nth-child(${data.p})`;
						let text = `<b>${serial.title} (${serial.title_orig})</b>\n/about_${serial.id}\n`;

						text += `\n<b>${$('h2', ctx).text()}</b>\n`;

						let dl_season = '<i>Ещё не вышел</i>';
						let mw_season = '';

						const temp = $('.movie-details-block > .external-btn', ctx).attr('onclick');
						if (temp !== undefined) {
							const re = new RegExp('\\d+', 'g');
							const id = re.exec(temp);
							const season = re.exec(temp);

							if (id !== null) {
								dl_season = `/dl_${id}_${season}`;
								mw_season = `/mw_${id}_${season}`;
							}
						}

						text += `${dl_season} ${mw_season}\n\n`;
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
								let mw_episode = '';

								if (id !== null) {
									dl_episode = `/dl_${id}_${season}_${episode}`;
									mw_episode = `/mw_${id}_${season}_${episode}`;
								}

								text += `${num}: ${name}\n${dl_episode} ${mw_episode}\n`;
							});

						resolve(text);
					});
				})

				.catch(function (error) {
					reject(error);
				})
		});
	}
};