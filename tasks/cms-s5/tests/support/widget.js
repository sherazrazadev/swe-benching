'use strict';

// Shared harness for the hidden suites.
//
// It builds the dashboard widget's DOM, loads the project's real Garnish library, defines the
// control-panel globals the widget expects, and then evaluates the widget either from the
// project's source (bundled on the fly, imports such as stylesheets ignored) or from the browser
// bundle that the control panel actually serves. It then exposes the real widget screens so a
// test can drive the real response handlers and user events.
//
// Nothing here computes an expected value from product code: tests assert literal expectations.

const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';
const SOURCE = path.join(
  WORKSPACE,
  'src/web/assets/craftsupport/src/CraftSupportWidget.js'
);
const SERVED = path.join(
  WORKSPACE,
  'src/web/assets/craftsupport/dist/CraftSupportWidget.js'
);
const GARNISH = path.join(
  WORKSPACE,
  'src/web/assets/garnish/dist/garnish.js'
);

function widgetDocument() {
  const screen = (name, heading, resultsHeading, verb) => `
    <div class="cs-screen cs-screen-2 cs-screen-${name}">
      <h2 class="cs-heading">${heading}</h2>
      <textarea class="cs-body-text"></textarea>
      <div class="cs-search-results-container hidden">
        <div class="cs-search-icon"></div>
        <h2>${resultsHeading}</h2>
        <ul class="cs-search-results"></ul>
      </div>
      <div class="cs-forms">
        <form class="cs-search-form" action="#" method="get">
          <div class="cs-search-params"></div>
          <div class="cs-button-wrapper">
            <p><a href="#">send to Developer Support</a></p>
            <button type="submit" class="btn submit fullwidth disabled">${verb}</button>
            <button type="button" class="btn fullwidth cancel">Cancel</button>
          </div>
        </form>
        <form class="cs-support-form hidden" action="#" method="post">
          <input type="text" class="cs-support-message">
          <div class="cs-support-more hidden">
            <input type="file" class="cs-support-attachment">
          </div>
          <button type="submit" class="btn submit fullwidth disabled">Send</button>
        </form>
      </div>
      <iframe class="hidden"></iframe>
    </div>`;

  return `<!doctype html><html><body>
    <div id="dashboard-grid" class="grid">
      <div class="item">
        <div id="widget1" class="widget craftsupport" data-id="1" data-type="CraftSupport">
          <div class="front"><div class="pane">
            <div class="body">
              <div class="cs-screen cs-screen-home">
                <button type="button" class="cs-opt" data-screen="help"></button>
                <button type="button" class="cs-opt" data-screen="feedback"></button>
              </div>
              ${screen('help', 'Get help', 'Similar questions on Stack Exchange', 'Ask on Stack Exchange')}
              ${screen('feedback', 'Give feedback', 'Similar issues on GitHub', 'Post on GitHub')}
            </div>
          </div></div>
        </div>
      </div>
    </div>
  </body></html>`;
}

function newWindow() {
  const dom = new JSDOM(widgetDocument(), {
    runScripts: 'dangerously',
    url: 'https://cms.example.test/admin/dashboard',
    pretendToBeVisual: true,
  });
  const w = dom.window;

  const $ = require('jquery')(w);
  w.$ = w.jQuery = $;

  // The tests drive the widget's response handlers with response objects; never let a scheduled
  // search or a click reach the network.
  $.ajax = function () {
    return {
      done() {
        return this;
      },
      fail() {
        return this;
      },
      always() {
        return this;
      },
    };
  };

  // Animations are irrelevant to the property; keep them synchronous and chainable so the
  // callbacks the widget registers still run.
  $.fn.velocity = function () {
    let complete = null;
    for (const arg of arguments) {
      if (arg && typeof arg === 'object' && typeof arg.complete === 'function') {
        complete = arg.complete.bind(this);
      }
    }
    if (complete) {
      complete();
    }
    return this;
  };

  // Control-panel helpers. escapeHtml/getText are the product's own implementations (text in,
  // serialized HTML out), reproduced here because the widget asset expects these globals.
  const displaySuccess = [];
  w.Craft = {
    escapeHtml(str) {
      return $('<div/>').text(str).html();
    },
    getText(str) {
      return $('<div/>').html(str).text();
    },
    t(_category, message) {
      return typeof message === 'string' ? message : '';
    },
    cp: {
      displaySuccess(message) {
        displaySuccess.push(message);
      },
    },
  };
  w.__displaySuccess = displaySuccess;

  if (!fs.existsSync(GARNISH)) {
    throw new Error('the control-panel base library is missing from the workspace');
  }
  w.eval(fs.readFileSync(GARNISH, 'utf8'));

  if (!w.Garnish || !w.Garnish.Base) {
    throw new Error('the control-panel base library did not initialize');
  }

  return {w, $, dom};
}

function sourceBundle() {
  const esbuild = require('esbuild');
  const result = esbuild.buildSync({
    entryPoints: [SOURCE],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    logLevel: 'silent',
    loader: {'.scss': 'empty', '.css': 'empty'},
  });
  return result.outputFiles[0].text;
}

function loadWidget(w, layer) {
  let code;
  if (layer === 'served') {
    if (!fs.existsSync(SERVED)) {
      throw new Error('the served widget asset is missing from the workspace');
    }
    code = fs.readFileSync(SERVED, 'utf8');
  } else if (layer === 'source') {
    if (!fs.existsSync(SOURCE)) {
      throw new Error('the widget source is missing from the workspace');
    }
    code = sourceBundle();
  } else {
    throw new Error('unknown layer: ' + layer);
  }

  w.eval(code);

  const Klass = w.Craft && w.Craft.CraftSupportWidget;
  if (!Klass) {
    throw new Error('the widget did not register itself (' + layer + ')');
  }
  return Klass;
}

// Instantiate the real widget and one of its real screens, the same way the control panel's
// dashboard script does, and make it the current screen as the widget's screen transition does.
function openScreen(layer, screen) {
  const {w, $, dom} = newWindow();
  const Klass = loadWidget(w, layer);
  const widget = new Klass(1, {issueTitlePrefix: '[4.x]: ', issueParams: {}});
  const view = widget.initScreen(screen);
  widget.currentScreen = view;
  return {w, $, dom, widget, view};
}

// True when attacker markup under `root` became elements/attributes rather than text.
function injectedMarkup(root, markerId) {
  return {
    marker: !!(root && root.querySelector('#' + markerId)),
    handler: !!(root && root.querySelector('[onerror], [onload], [onclick]')),
    script: !!(root && root.querySelector('script')),
  };
}

function payload(markerId) {
  return (
    '<img src="x" onerror="window.__csPwned=1">' +
    '<b id="' + markerId + '">injected</b>' +
    '<script>window.__csPwned=2<\/script>'
  );
}

// If any attacker element survived as an element with an inline handler, fire that handler the
// way the browser would; a blocked attack leaves the marker unset.
function executeInjected(root, w) {
  if (!root) {
    return;
  }
  const events = {onerror: 'error', onload: 'load', onclick: 'click'};
  for (const [attribute, type] of Object.entries(events)) {
    root.querySelectorAll('[' + attribute + ']').forEach((el) => {
      try {
        el.dispatchEvent(new w.Event(type));
      } catch (_) {
        /* ignore a handler that cannot run in this environment */
      }
    });
  }
}

module.exports = {
  WORKSPACE,
  SOURCE,
  SERVED,
  newWindow,
  loadWidget,
  openScreen,
  injectedMarkup,
  executeInjected,
  payload,
};
