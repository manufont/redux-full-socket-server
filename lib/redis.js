'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _redis = require('redis');

var _redis2 = _interopRequireDefault(_redis);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var getRedisAsyncStorage = function getRedisAsyncStorage(prefix) {
	var client = _redis2.default.createClient();

	return {
		getItem: function getItem(key, callback) {
			return client.get(key, callback);
		},
		setItem: function setItem(key, value, callback) {
			return client.set(key, value, callback);
		},
		removeItem: function removeItem(key, callback) {
			return client.del(key, callback);
		},
		getAllKeys: function getAllKeys(callback) {
			return client.keys(prefix + '*', callback);
		}
	};
};

exports.default = getRedisAsyncStorage;