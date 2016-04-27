import Ember from 'ember';
import Ceibo from 'ceibo';

var { $, assert } = Ember;

class Selector {
  constructor(node, scope, selector, filters) {
    this.targetNode = node;
    this.targetScope = scope || '';
    this.targetSelector = selector || '';
    this.targetFilters = filters;
  }

  toString() {
    var scope,
        filters;

    if (this.targetFilters.resetScope) {
      scope = this.targetScope;
    } else {
      scope = this.calculateScope(this.targetNode, this.targetScope);
    }

    filters = this.calculateFilters(this.targetFilters);

    return $.trim(`${scope} ${this.targetSelector}${filters}`);
  }

  calculateFilters() {
    var filters = [];

    if (this.targetFilters.contains) {
      filters.push(`:contains("${this.targetFilters.contains}")`);
    }

    if (typeof this.targetFilters.at === 'number') {
      filters.push(`:eq(${this.targetFilters.at})`);
    } else if (this.targetFilters.last) {
      filters.push(':last');
    }

    return filters.join('');
  }

  calculateScope(node, targetScope) {
    var scopes = this.getScopes(node);

    scopes.reverse();
    scopes.push(targetScope);

    return $.trim(scopes.join(' '));
  }

  getScopes(node) {
    var scopes = [];

    if (node.scope) {
      scopes.push(node.scope);
    }

    if (!node.resetScope && Ceibo.parent(node)) {
      scopes = scopes.concat(this.calculateScope(Ceibo.parent(node)));
    }

    return scopes;
  }
}

function guardMultiple(items, selector, supportMultiple) {
  assert(
    `"${selector}" matched more than one element. If this is not an error use { multiple: true }`,
    supportMultiple || items.length <= 1
  );
}

/**
 * Builds a CSS selector from a target selector and a PageObject or a node in a PageObject, along with optional parameters.
 *
 * @example
 *
 * const component = PageObject.create({ scope: '.component'});
 *
 * buildSelector(component, '.my-element');
 * // returns '.component .my-element'
 *
 * @example
 *
 * const page = PageObject.create({});
 *
 * buildSelector(page, '.my-element', { at: 0 });
 * // returns '.my-element:eq(0)'
 *
 * @example
 *
 * const page = PageObject.create({});
 *
 * buildSelector(page, '.my-element', { contains: "Example" });
 * // returns ".my-element :contains('Example')"
 *
 * @example
 *
 * const page = PageObject.create({});
 *
 * buildSelector(page, '.my-element', { last: true });
 * // returns '.my-element:last'
 *
 * @public
 *
 * @param {Ceibo} node - Node of the tree
 * @param {string} targetSelector - CSS selector
 * @param {Object} options - Additional options
 * @param {boolean} options.resetScope - Do not use inherited scope
 * @param {string} options.contains - Filter by using :contains('foo') pseudo-class
 * @param {number} options.at - Filter by index using :eq(x) pseudo-class
 * @param {boolean} options.last - Filter by using :last pseudo-class
 * @return {string} Fully qualified selector
 */
export function buildSelector(node, targetSelector, options) {
  return (new Selector(node, options.scope, targetSelector, options)).toString();
}

function throwBetterError(node, key, selector) {
  var path = [key],
      current = node;

  do {
    path.unshift(Ceibo.meta(current).key);
  } while(current = Ceibo.parent(current));

  path[0] = 'page';

  var msg = `Element not found.

PageObject: '${path.join('.')}'
  Selector: '${selector}'
`;

  throw new Ember.Error(msg);
}

/**
 * Returns a jQuery element matched by a selector built from parameters
 *
 * @public
 *
 * @param {Ceibo} node - Node of the tree
 * @param {string} targetSelector - Specific CSS selector
 * @param {Object} options - Additional options
 * @param {boolean} options.resetScope - Do not use inherited scope
 * @param {string} options.contains - Filter by using :contains('foo') pseudo-class
 * @param {number} options.at - Filter by index using :eq(x) pseudo-class
 * @param {boolean} options.last - Filter by using :last pseudo-class
 * @param {boolean} options.multiple - Specify if built selector can match multiple elements.
 * @param {String} options.testContainer - Context where to search elements in the DOM
 * @param {String} options.pageObjectKey - Used in the error message when the element is not found
 * @return {Object} jQuery object
 *
 * @throws Will throw an error if no element matches selector
 * @throws Will throw an error if multiple elements are matched by selector and multiple option is not set
 */
export function findElementWithAssert(node, targetSelector, options = {}) {
  const selector = buildSelector(node, targetSelector, options);

  return simpleFindElementWithAssert(node, selector, options);
}

/**
 * The difference with findElementWithAssert is that this function uses the
 * selector as is
 * @private
 */
export function simpleFindElementWithAssert(node, selector, options = {}) {
  const context = getContext(node);

  let result;

  if (context) {
    // TODO: When a context is provided, throw an exception
    // or give a falsy assertion when there are no matches
    // for the selector. This will provide consistent behaviour
    // between acceptance and integration tests.
    if (options.testContainer) {
      result = Ember.$(selector, options.testContainer);
    } else {
      result = context.$(selector);
    }
  } else {
    /* global find */
    result = find(selector, options.testContainer);
  }

  if (result.length === 0) {
    throwBetterError(node, options.pageObjectKey, selector);
  }

  guardMultiple(result, selector, options.multiple);

  return result;
}

/**
 * The difference with simpleFindElementWithAssert is that this function also checks
 * if the elements are visible
 * @private
 */
export function simpleFindVisibleElementWithAssert(node, selector, options = {}) {
  let result = simpleFindElementWithAssert(...arguments);

  assert(
    `"${selector}" matched but the elements are not visible.`,
    result.is(':visible')
  );

  return result;
}

/**
 * Returns a jQuery element (can be an empty jQuery result)
 *
 * @public
 *
 * @param {Ceibo} node - Node of the tree
 * @param {string} targetSelector - Specific CSS selector
 * @param {Object} options - Additional options
 * @param {boolean} options.resetScope - Do not use inherited scope
 * @param {string} options.contains - Filter by using :contains('foo') pseudo-class
 * @param {number} options.at - Filter by index using :eq(x) pseudo-class
 * @param {boolean} options.last - Filter by using :last pseudo-class
 * @param {boolean} options.multiple - Specify if built selector can match multiple elements.
 * @param {String} options.testContainer - Context where to search elements in the DOM
 * @return {Object} jQuery object
 *
 * @throws Will throw an error if multiple elements are matched by selector and multiple option is not set
 */
export function findElement(node, targetSelector, options = {}) {
  const selector = buildSelector(node, targetSelector, options);
  const context = getContext(node);

  let result;

  if (context) {
    if (options.testContainer) {
      result = Ember.$(selector, options.testContainer);
    } else {
      result = context.$(selector);
    }
  } else {
    /* global find */
    result = find(selector, options.testContainer);
  }

  guardMultiple(result, selector, options.multiple);

  return result;
}

/**
 * Trim whitespaces at both ends and normalize whitespaces inside `text`
 *
 * Due to variations in the HTML parsers in different browsers, the text
 * returned may vary in newlines and other white space.
 *
 * @see http://api.jquery.com/text/
 */
export function normalizeText(text) {
  return $.trim(text).replace(/\n/g, ' ').replace(/\s\s*/g, ' ');
}

export function every(jqArray, cb) {
  var arr = jqArray.get();

  return Ember.A(arr).every(function(element) {
    return cb($(element));
  });
}

export function map(jqArray, cb) {
  var arr = jqArray.get();

  return Ember.A(arr).map(function(element) {
    return cb($(element));
  });
}

/**
 * Return the root of a node's tree
 *
 * @param {Ceibo} node - Node of the tree
 * @return {Ceibo} node - Root node of the tree
 */
function getRoot(node) {
  var parent = Ceibo.parent(node),
      root = node;

  while (parent) {
    root = parent;
    parent = Ceibo.parent(parent);
  }

  return root;
}

/**
 * Return a test context if one was provided during `create()`
 *
 * @param {Ceibo} node - Node of the tree
 * @return {?Object} The test's `this` context, or null
 */
export function getContext(node) {
  var root = getRoot(node);
  var context = root.context;

  if (typeof context === 'object' && typeof context.$ === 'function') {
    return context;
  } else {
    return null;
  }
}
