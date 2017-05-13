/**
 * Created by savely on 13.05.2017.
 */
module.exports = {
	// Считает кол-во страниц для личного /about
	getPageCount: function (data) {
		return new Promise(function (resolve, reject) {
			r.db('lostfilm').table('serials')
				.get(data.s)

				.then(function (res) {
					resolve(Math.ceil(res.description.length / 1024));
				})

				.catch(function (error) {
					reject(error);
				});
		});
	},

	// Считает кол-во страниц для личного /about
	getPage: function (data) {
		return new Promise(function (resolve, reject) {
			r.db('lostfilm').table('serials')
				.get(data.s)

				.then(function (res) {
					const temp = (data.p - 1) * 1024;
					resolve(res.description.slice(temp, temp + 1024));
				})

				.catch(function (error) {
					reject(error);
				});
		});
	}
};