(function($) {
  $(document).ready(function () {
    var $contents = $('.h5p-dev-contents .content');
    H5PDev.contents.forEach(function (name) {
      var $contentButton = $('<button>', {
        'class': 'h5p-dev-content-button' + (H5PDev.currentContent === name ? ' current' : ''),
        'html': name,
        click: function () {
          document.location.href = '/?content=' + name;
        }
      });
      $contentButton.appendTo($contents);
    })

    var numEvents = 0;
    var $eventConsole = $('.h5p-dev-events .content');
    var $eventCounter = $('.h5p-dev-events .event-counter');
    H5P.externalDispatcher.on('*', function (event) {
      // Intentionally logging to console:
      console.log(event);
      numEvents++;
      $eventCounter.html(numEvents);
      $eventConsole.prepend($('<div>', {
        'class': 'event',
        html: event.type,
        title: JSON.stringify(event.data, null, 1)
      }));
    });

    // Display library.json:
    var mainLibrary = JSON.stringify(H5PDev.mainLibrary, null, 1);
    $('.h5p-dev-library-meta .content').html('<pre>' + mainLibrary + '</pre>').attr('title',mainLibrary);
  });
}(H5P.jQuery));
