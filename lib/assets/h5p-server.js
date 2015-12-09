var H5PEditor = H5PEditor || {};
var ns = H5PEditor;

(function($) {
  $(document).ready(function () {

    var menuHidden = localStorage.getItem('menuHidden');
    menuHidden = (menuHidden !== null) ? JSON.parse(menuHidden) === true : false;
    if (menuHidden) {
      $('body').addClass('menu-hidden no-transition');
      setTimeout(function () {
        $('body').removeClass('no-transition');
      }, 500);
    }

    var $devMenu = $('.h5p-dev-menu');
    $('.menu-toggler').click(function () {
      $('body').toggleClass('menu-hidden');
      menuHidden = $('body').hasClass('menu-hidden');
      localStorage.setItem('menuHidden', menuHidden);
    });

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
    H5P.externalDispatcher.on('xAPI', function (event) {
      // Intentionally logging to console:
      console.log(event);
      numEvents++;
      $eventCounter.html(numEvents);
      $eventConsole.prepend($('<div>', {
        'class': 'event',
        html: event.type + '::' + event.data.statement.verb.display['en-US'],
        title: JSON.stringify(event.data, null, 1)
      }));
    });

    // Display library.json:
    var mainLibrary = JSON.stringify(H5PDev.mainLibrary, null, 1);
    $('.h5p-dev-library-meta .content').html('<pre>' + mainLibrary + '</pre>').attr('title',mainLibrary);

    var editorInitialized = false;

    // Edit button:
    $('.h5p-dev-edit').click(function () {
      $('.h5p-dev-editor-wrapper').show();
      if (editorInitialized) {
        return;
      }
      editorInitialized = true;

      ns.$ = H5P.jQuery;
      ns.basePath = H5PDev.editor.modulePath;
      //ns.contentId = Drupal.settings.h5peditor.nodeVersionId;
      //ns.fileIcon = Drupal.settings.h5peditor.fileIcon;
      ns.ajaxPath = H5PDev.editor.ajaxPath;
      ns.filesPath = H5PDev.editor.filesPath;

      // Handle buttons:
      $('.h5p-dev-editor-buttons .cancel').click(function () {
        $('.h5p-dev-editor-wrapper').hide();
        //$('.h5p-dev-editor-wrapper .h5p-editor-iframe').replaceWith('<div class="h5p-dev-editor"></div>');
      });

      // Semantics describing what copyright information can be stored for media.
      //ns.copyrightSemantics = Drupal.settings.h5peditor.copyrightSemantics;

      // Required styles and scripts for the editor
      ns.assets = H5PDev.editor.assets;

      // Required for assets
      ns.baseUrl = H5PDev.editor.modulePath;

      ns.getAjaxUrl = function (action, parameters) {
        var url = '/' + action;

        console.log(action, parameters);

        if (parameters !== undefined) {
          for (var key in parameters) {
            url += '/' + parameters[key];
          }
        }
        return url;
      };

      var jsonContent = H5PIntegration.contents['cid-1'].jsonContent;
      var lib = H5PDev.mainLibrary.machineName + ' ' + H5PDev.mainLibrary.majorVersion + '.' + H5PDev.mainLibrary.minorVersion;
      var h5peditor = new ns.Editor(lib, jsonContent, $('.h5p-dev-editor'));

      $('.h5p-dev-editor-buttons .save').click(function () {
        var jsonContent = h5peditor.getParams();
        H5PIntegration.contents['cid-1'].jsonContent = JSON.stringify(jsonContent);

        $('.h5p-iframe-wrapper').replaceWith('<div class="h5p-iframe-wrapper"><iframe id="h5p-iframe-1" class="h5p-iframe" data-content-id="1" style="height:1px" src="about:blank" frameBorder="0" scrolling="no"></iframe></div>');

        H5P.init();

        $('.h5p-dev-editor-wrapper').hide();
      });

      setTimeout(function () {
        var selector = h5peditor.selector;
        selector.$selector.val(lib).change();
      } , 2000);
    });
  });
}(H5P.jQuery));
