var http = require('http');
var log = require('log');
var utility = require('utility');

var GeoIP = function() {
  this.api = http.createClient(80, 'www.geoplugin.net')

  var geoip = this;

  this.lookup = function(ip, callback) {
    log('geoip.lookup', { ip:ip });
    var request = geoip.api.request('GET', '/json.gp?ip=' + ip, { host:'www.geoplugin.net' })
    request.end();
    request.on('response', function(response) {
      log('geoip.lookup.response');
      response.on('data', function(chunk) {
        var match = chunk.toString().replace(/\n/g, '').match(/geoPlugin\((.+)\)/);
        data = JSON.parse(match[1]);
        log('geoip.lookup.response.data', {
          lat: data.geoplugin_latitude, long:data.geoplugin_longitude
        })
        callback(parseFloat(data.geoplugin_latitude), parseFloat(data.geoplugin_longitude))
      })
    });
  }
}

module.exports.create = function() {
  return new GeoIP();
}
