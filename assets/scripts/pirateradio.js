$(window).ready(function() {
  locate_user();

  window.setInterval(function() {
    $.post('/message', { text: 'hey there!' });
  }, 500);
});

function locate_user() {
  if (navigator.geolocation) {
    console.log('getting position');
    navigator.geolocation.getCurrentPosition(position_success, position_error);
  } else {
    console.log('geolocation not supported');
  }
}

function position_success(position) {
  console.log('position: ' + position);

  var coords = {
    latitude:  position.coords.latitude,
    longitude: position.coords.longitude
  }

  $.post('/position', coords, function(data) {
    console.log(data);
  });
}

function position_error(message) {
  console.log('error: ' + message);
}
