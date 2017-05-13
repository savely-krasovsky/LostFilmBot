/**
 * Created by savely on 12.05.2017.
 */
module.exports = {
	// Считает кол-во страниц для личного /mylist
	getPageCount: function (from_id) {
		return new Promise(function (resolve, reject) {
			r.db('lostfilm').table('users').get(from_id)('favorites').count()
				.then(function (res) {
					resolve(Math.ceil(res / 20));
				})

				.catch(function (error) {
					reject(error);
				});
		});
	},

	// Получает одну страницу для личного /mylist
	getPage: function (data, from_id) {
		return new Promise(function (resolve, reject) {
			const temp = data.p * 20;
			r.db('lostfilm').table('users').get(from_id)('favorites').orderBy(r.desc('id')).slice(temp - 20, temp)
				.then(function (res) {
					let text = '<b>Список сериалов:</b>\n\n';
					if (res.length !== 0)
						for (let i in res) {
							text += `${res[i].title} (${res[i].title_orig})\n/about_${res[i].id} /full_${res[i].id} /fav_${res[i].id}\n`;
						}
					else
						text += 'Избранные сериалы отсутствуют! Добавьте интересующие, ' +
							'нажав команду <code>/fav_xxx</code> возле названия сериала в общем /list!';
					resolve(text);
				})

				.catch(function (error) {
					reject(error)
				});
		});
	}
};