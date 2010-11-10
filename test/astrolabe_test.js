require.paths.unshift(__dirname + '/../lib');

var assert = require('assert');
var vows = require('vows');

var astrolabe = require('astrolabe');

var iteration;

vows.describe('astrolabe').addBatch({

  'update': {
    topic: function() {
      var a = astrolabe.create();
      a.on('update', this.callback);
      a.update('user1', 100.0, 50.0, 2000);
    },

    'receives update when a user connects': function(err, results) {
      assert.equal(results.from,      'user1');
      assert.equal(results.latitude,  100.0);
      assert.equal(results.longitude, 50.0);
      assert.equal(results.radius,    2000);
    }
  },
  
  'connect': {
    topic: function() {
      var a = astrolabe.create();
      a.on('connect', this.callback);
      iteration = 0;
      a.update('user1', 100.0, 50.0, 2000);
      a.update('user2', 100.0, 50.0, 1800);
    },

    'connects users': function(err, result) {
      switch (iteration) {
        case 0:
          assert.equal(result.listener, 'user1');
          assert.equal(result.poster,   'user1');
          break;
        case 1:
        console.log(result);
          assert.equal(result.listener, 'user1');
          assert.equal(result.poster,   'user2');
          break;
        case 2:
          assert.equal(result.listener, 'user2');
          assert.equal(result.poster,   'user2');
          break;
        case 3:
          console.log(result);
          assert.equal(result.listener, 'user1');
          assert.equal(result.poster,   'user2');
          break;
      }
      iteration ++;
    },
  }
}).export(module);
