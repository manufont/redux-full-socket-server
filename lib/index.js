'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.serverStoreEnhancer = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _redux = require('redux');

var _reduxPersist = require('redux-persist');

var _ws = require('ws');

var _ws2 = _interopRequireDefault(_ws);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _redis = require('./redis');

var _redis2 = _interopRequireDefault(_redis);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var dispatchToClient = function dispatchToClient(reducer) {
  return function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var action = arguments[1];

    if (action.token) {
      return _extends({}, state, _defineProperty({}, action.token, reducer(state[action.token], action)));
    } else {
      return state;
    }
  };
};

var serverStoreEnhancer = exports.serverStoreEnhancer = function serverStoreEnhancer(clientReducer, dbPrefix) {

  var redisAsyncStorage = (0, _redis2.default)(dbPrefix);

  return function (next) {
    return function (reducer, initialState, enhancer) {
      var reducers = (0, _redux.combineReducers)({
        clients: dispatchToClient(clientReducer),
        server: reducer
      });

      var store = next(reducers, initialState, _redux.compose.apply(undefined, _toConsumableArray(enhancer ? [enhancer] : []).concat([(0, _reduxPersist.persistReducer)()])));

      (0, _reduxPersist.persistStore)(store, {
        storage: redisAsyncStorage,
        keyPrefix: dbPrefix
      });

      return store;
    };
  };
};

var init = function init(store, token) {
  return {
    type: 'INIT',
    payload: store.getState().clients[token],
    hide: true
  };
};

var cleanAction = function cleanAction(action) {
  return _extends({}, action, {
    hide: undefined,
    broadcast: undefined,
    token: undefined,
    sync: undefined
  });
};

var augmentAction = function augmentAction(action, token, socketId) {
  return _extends({}, action, {
    token: token,
    socketId: socketId
  });
};

var id = function id() {
  return '_' + Math.random().toString(36).substr(2, 9);
};

var startServer = function startServer(store, socketOptions) {
  var socketServer = new _ws2.default.Server(socketOptions);

  var tokenMap = {};

  socketServer.on('connection', function (socket, request) {

    var token = _url2.default.parse(request.url, true).query.token;

    var send = function send(action) {
      var message = JSON.stringify(cleanAction(action));
      if (action.broadcast) {
        Object.keys(tokenMap[token]).forEach(function (key) {
          if (action.sync || action.socketId !== key) {
            tokenMap[token][key].send(message);
          }
        });
      } else if (action.sync) {
        socket.send(message);
      }
    };

    var socketId = id();
    if (!tokenMap[token]) tokenMap[token] = {};
    tokenMap[token][socketId] = socket;
    socket.send(JSON.stringify(init(store, token)));

    socket.on('message', function (message) {
      var action = store.dispatch(augmentAction(JSON.parse(message), token, socketId));
      send(action);
    });

    socket.on('close', function () {
      delete tokenMap[token][socketId];
    });
  });

  return socketServer;
};

exports.default = startServer;