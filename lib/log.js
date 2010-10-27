var utility = require('utility');

module.exports = function(message, args) {
  var args = args || {};
  var line = '';

  line += '[' + (new Date()).toUTCString();
  line += '] ' + message;

  (utility.keys(args) || []).sort().forEach(function(key) {
    line += ' ' + key + '=' + args[key];
  });

  console.log(line);
}
