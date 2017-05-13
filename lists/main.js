/**
 * Created by savely on 12.05.2017.
 */
module.exports = {
	// Считает кол-во страниц для общего /list
	getPageCount: function() {
		return new Promise(function (resolve, reject) {
			r.db('lostfilm').table('serials').count()
				.then(function (res) {
					resolve(Math.ceil(res / 10));
				})

				.catch(function (error) {
					reject(error);
				});
		});
	},

	// Получает одру страницу для общего /list
	getPage: function(data) {
		return new Promise(function (resolve, reject) {
			const temp = data.p * 10;
			r.db('lostfilm').table('serials').orderBy(r.asc('title')).slice(temp - 10, temp)
				.then(function (res) {
					let text = '<b>Список сериалов:</b>\n\n';
					for (let i in res) {
						if (res.hasOwnProperty(i))
							text += `${res[i].title} (${res[i].title_orig})\n/about_${res[i].id} /full_${res[i].id} /fav_${res[i].id}\n\n`;
					}
					resolve(text);
				})

				.catch(function (error) {
					reject(error)
				});
		});
	}
};