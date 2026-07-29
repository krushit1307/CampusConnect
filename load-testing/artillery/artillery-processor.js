/**
 * Artillery Custom Processor for Supabase Realtime
 * Handles WebSocket connection logic, subscription, and message generation.
 */

module.exports = {
  connectAndSubscribe: function (userContext, events, done) {
    const url = `${userContext.vars.target}/realtime/v1/websocket?apikey=${userContext.vars.apiKey}&vsn=1.0.0`;
    
    userContext.ws = {
      url: url,
      headers: {
        Authorization: `Bearer ${userContext.vars.jwt}`,
      },
      messages: []
    };

    // Artillery will handle the connection based on the ws config
    done();
  },

  sendMessage: function (userContext, events, done) {
    const msgId = Date.now();
    const payload = {
      topic: userContext.vars.channel,
      event: 'broadcast',
      payload: { 
        event: 'new_message', 
        payload: { 
          id: msgId, 
          text: `Artillery load test message ${msgId}`, 
          user_id: 'artillery-user' 
        } 
      },
      ref: msgId.toString(),
    };

    events.emit('message', JSON.stringify(payload));
    done();
  },

  closeConnection: function (userContext, events, done) {
    events.emit('close');
    done();
  }
};
