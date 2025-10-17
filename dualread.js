(function () {
  'use strict';

  // Simple cache to avoid repeated fetches for the same annotation file.
  var annotationCache = Object.create(null);

  function isAbsolute(url) {
    return /^([a-z]+:)?\/\//i.test(url || '');
  }

  function normalizeBasePath(basePath) {
    if (Array.isArray(basePath)) {
      return basePath[0] || '';
    }
    return basePath || '';
  }

  function joinBasePath(basePath, file) {
    if (!file) {
      return null;
    }

    if (isAbsolute(file)) {
      return file;
    }

    var base = normalizeBasePath(basePath);
    if (!base) {
      return file;
    }

    if (isAbsolute(base)) {
      return base.replace(/\/?$/, '/') + file.replace(/^\//, '');
    }

    return base.replace(/\/?$/, '/') + file.replace(/^\//, '');
  }

  function buildFetchOptions(vm) {
    var opts = {};
    if (vm.config.fetchOptions && typeof vm.config.fetchOptions === 'object') {
      Object.keys(vm.config.fetchOptions).forEach(function (key) {
        opts[key] = vm.config.fetchOptions[key];
      });
    }

    var headers = vm.config.requestHeaders;
    if (headers && typeof headers === 'object') {
      opts.headers = Object.assign({}, opts.headers || {}, headers);
    }

    if (!opts.cache) {
      opts.cache = 'force-cache';
    }

    return opts;
  }

  function fetchAnnotation(url, vm) {
    if (!url) {
      return Promise.resolve(null);
    }

    if (annotationCache[url]) {
      return annotationCache[url];
    }

    var fetchOptions = buildFetchOptions(vm);

    annotationCache[url] = fetch(url, fetchOptions).then(function (response) {
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Request failed: ' + response.status);
      }
      return response.text();
    }).catch(function (error) {
      console.warn('[docsify-ruby]', 'Failed to load annotation file:', url, error);
      return null;
    });

    return annotationCache[url];
  }

  function splitSegments(text) {
    var normalized = String(text || '').replace(/\r\n/g, '\n');
    var segments = [];
    var lastIndex = 0;
    var match;
    var separatorPattern = /\n{2,}/g;

    while ((match = separatorPattern.exec(normalized)) !== null) {
      segments.push({
        block: normalized.slice(lastIndex, match.index),
        separator: match[0]
      });
      lastIndex = match.index + match[0].length;
    }

    segments.push({
      block: normalized.slice(lastIndex),
      separator: ''
    });

    return segments;
  }

  function splitAnnotations(text) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map(function (block) { return block.trim(); })
      .filter(function (block) { return block.length > 0; });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (char) {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case '\'':
          return '&#39;';
        default:
          return char;
      }
    });
  }

  function shouldAnnotate(block) {
    var trimmed = block.trim();
    if (!trimmed) {
      return false;
    }

    if (/^<ruby[\s>]/i.test(trimmed)) {
      return false;
    }

    if (/^`{3}/.test(trimmed) || /^~{3}/.test(trimmed)) {
      return false;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      return false;
    }

    if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      return false;
    }

    if (/^>/.test(trimmed)) {
      return false;
    }

    if (/^\|/.test(trimmed)) {
      return false;
    }

    if (/^<([a-z]+)([\s>]|$)/i.test(trimmed) && !/^<p[\s>]/i.test(trimmed)) {
      return false;
    }

    return true;
  }

  function wrapWithRuby(block, annotation) {
    var leading = (block.match(/^\s*/) || [''])[0];
    var trailing = (block.match(/\s*$/) || [''])[0];
    var core = block.trim();

    if (!core) {
      return block;
    }

    var sanitizedAnnotation = escapeHtml(annotation)
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(function (line) { return line.trim(); })
      .join('<br>');

    return leading + '<ruby>' + core + '<rt>' + sanitizedAnnotation + '</rt></ruby>' + trailing;
  }

  function mergeContent(baseContent, annotationContent) {
    var segments = splitSegments(baseContent);
    var annotations = splitAnnotations(annotationContent);

    if (!annotations.length) {
      return baseContent;
    }

    var annotationIndex = 0;

    segments.forEach(function (segment) {
      if (annotationIndex >= annotations.length) {
        return;
      }

      if (!shouldAnnotate(segment.block)) {
        return;
      }

      segment.block = wrapWithRuby(segment.block, annotations[annotationIndex]);
      annotationIndex += 1;
    });

    if (annotationIndex < annotations.length) {
      console.warn('[docsify-ruby]', 'Unused annotations:', annotations.length - annotationIndex);
    }

    return segments.map(function (segment) {
      return segment.block + segment.separator;
    }).join('');
  }

  function createPlugin() {
    return function (hook, vm) {
      hook.beforeEach(function (content, next) {
        var file = vm.route && vm.route.file;

        if (!file || !/\.md$/i.test(file)) {
          next(content);
          return;
        }

        var annotationFile = file.replace(/\.md$/i, '_en.md');
        if (annotationFile === file) {
          next(content);
          return;
        }

        var annotationUrl = joinBasePath(vm.config.basePath, annotationFile);

        fetchAnnotation(annotationUrl, vm).then(function (annotationContent) {
          if (!annotationContent) {
            next(content);
            return;
          }

          try {
            var merged = mergeContent(content, annotationContent);
            next(merged);
          } catch (error) {
            console.error('[docsify-ruby]', 'Failed to merge annotation content for', file, error);
            next(content);
          }
        }).catch(function () {
          next(content);
        });
      });
    };
  }

  if (typeof window !== 'undefined') {
    window.$docsify = window.$docsify || {};
    var plugins = window.$docsify.plugins || [];
    plugins.push(createPlugin());
    window.$docsify.plugins = plugins;
  }
}());
