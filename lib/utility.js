module.exports.clone = function(obj) {
  var newObj = (obj instanceof Array) ? [] : {};
  for (i in obj) {
    if (i == 'clone') continue;
    if (obj[i] && typeof obj[i] == "object") {
      newObj[i] = module.exports.clone(obj[i]);
    } else newObj[i] = obj[i]
  } return newObj;
};

module.exports.keys = function(obj) {
  var keys = [];
  for (var key in obj) { keys.push(key); }
  return keys;
}

module.exports.merge = function(destination, source) {
  for (var property in source) {
    destination[property] = source[property];
  }
  return destination;
};