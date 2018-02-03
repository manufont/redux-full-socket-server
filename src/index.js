import { createStore, combineReducers, applyMiddleware, compose } from 'redux';
import { persistStore, autoRehydrate } from 'redux-persist'
import WebSocket from 'ws';
import url from 'url';

import getRedisAsyncStorage from './redis';

const dispatchToClient = reducer => (state = {}, action) => {
  if(action.channel){
    return {
      ...state,
      [action.channel]: reducer(state[action.channel], action)
    }
  }else{
    return state;
  }
};

export const serverStoreEnhancer = (clientReducer, dbPrefix) => {

  const redisAsyncStorage = getRedisAsyncStorage(dbPrefix);

  return next => (reducer, initialState, enhancer) => {
    const reducers = combineReducers({
      clients: dispatchToClient(clientReducer),
      server: reducer
    });

    const store = next(
      reducers,
      initialState,
      compose(
        ...enhancer ? [enhancer] : [],
        autoRehydrate()
      )
    );

    persistStore(store, {
      storage: redisAsyncStorage,
      keyPrefix: dbPrefix
    });

    return store;
  }
}


const init = (store, channel) => ({
  type: 'INIT',
  payload: store.getState().clients[channel],
  hide: true
});


const cleanAction = action => ({
  ...action,
  hide: undefined,
  broadcast: undefined,
  channel: undefined,
  sync: undefined
});

const augmentAction = (action, channel, socketId) => ({
  ...action,
  channel,
  socketId
});

const id = () =>
  '_' + Math.random().toString(36).substr(2, 9);


const startServer = (store, socketOptions) => {
  const socketServer = new WebSocket.Server(socketOptions);

  const channelMap = {};

  socketServer.on('connection', (socket, request) => {

    const channel = url.parse(request.url, true).query.channel;

    const send = action => {
      const message = JSON.stringify(cleanAction(action));
      if(action.broadcast){
        Object.keys(channelMap[channel]).forEach( key => {
          if(action.sync || action.socketId !== key){
            channelMap[channel][key].send(message)
          }
        });
      }else if(action.sync){
        socket.send(message);
      }
    }

    const socketId = id();
    if(!channelMap[channel]) channelMap[channel] = {};
    channelMap[channel][socketId] = socket;
    socket.send(JSON.stringify(init(store, channel)));

    socket.on('message', message => {
      const action = store.dispatch(augmentAction(JSON.parse(message), channel, socketId));
      send(action);
    });

    socket.on('close', () => {
      delete channelMap[channel][socketId];
    })
  });

  return socketServer
};

export default startServer;