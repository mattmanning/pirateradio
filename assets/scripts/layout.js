function fillHeight() {
  top_p     = parseInt($('#header').css('padding-top').split('px')[0]);
  bottom_p  = parseInt($('#header').css('padding-bottom').split('px')[0]);
  padding   = top_p + bottom_p;

  height  = $(window).height() - $('#header').height() - padding;
  $('#content').height(height);
  $('#map').height(height);
  $('#map').width($(window).width() - $('#chat').width());
}

$(document).ready(function(){
  fillHeight();
  initialize_map();
  $(window).resize(fillHeight);
});