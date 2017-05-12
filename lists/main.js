/**
 * Created by savely on 12.05.2017.
 */
module.exports = {
	// Считает кол-во страниц для общего /list
	 getPageCount: function() {
		return new Promise(function (resolve, reject) {
			r.db('lostfilm').table('serials').count()
				.then(function (res) {
					resolve(Math.ceil(res / 20));
				})

				.catch(function (error) {
					reject(error);
				});
		});
	},

	// Получает одру страницу для общего /list
	getPage: function(data) {
		return new Promise(function (resolve, reject) {
			const temp = data.p * 20;
			r.db('lostfilm').table('serials').orderBy(r.asc('title')).slice(temp - 20, temp)
				.then(function (res) {
					let text = '<b>Список сериалов:</b>\n\n';
					for (let i in res) {
						text += `${res[i].title} (${res[i].title_orig})\n/full_${res[i].id} /fav_${res[i].id}\n`;
					}
					resolve(text);
				})

				.catch(function (error) {
					reject(error)
				});
		});
	}
};