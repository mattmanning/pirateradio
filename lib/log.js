var utility = require('utility');

function pretty(id) {
  return id.substring(0, 6);
}

module.exports = function(message, args) {
  var args = args || {};
  var line = '';

  line += '[' + (new Date()).toUTCString();
  line += '] ' + message;

  (utility.keys(args) || []).sort().forEach(function(key) {
    var value = (args[key] || '').toString();
    if (value && value.match(/^[0-9a-f]+$/) && value.length > 10) {
      value = pretty(value);
    }
    line += ' ' + key + '=' + value;
  });

  console.log(line);
}
