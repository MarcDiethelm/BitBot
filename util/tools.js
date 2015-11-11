var moment = require('moment');

var tools = function() {

};

/**
 * Returns a JS timestamp as a unix timestamp (convert MS to S).
 * @param timestamp
 * @returns {number}
 */
tools.prototype.unixTimeStamp = function unixTimeStamp(timestamp) {
  return Math.floor(timestamp/1000);
};

/**
 * Returns the current time as a unix timestamp
 * @returns {number}
 */
tools.prototype.now = function now() {
  return Math.floor(Date.now() / 1000);
};

/**
 * Returns a date string from a unix timestamp
 * @returns {number}
 */
tools.prototype.formatDate = function formatDate(timestamp) {
  return moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

/**
 * Returns a random integer between min and max values.
 * @param min
 * @param max
 * @returns {number}
 */
tools.prototype.getRandomInt = function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Returns a random number between min and max values with a specified number of decimals.
 * @param decimals
 * @param min
 * @param max
 * @returns {number}
 */
tools.prototype.getRandomArbitrary = function getRandomArbitrary(decimals, min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
};

/**
 * Rounds a value up to an amount of decimals and returns it.
 * @param value
 * @param decimals
 * @returns {number}
 */
tools.prototype.round = function round(value, decimals) {
  // Shift
  value = value.toString().split('e');
  value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + decimals) : decimals)));
  // Shift back
  value = value.toString().split('e');
  return Number((value[0] + 'e' + (value[1] ? (+value[1] - decimals) : -decimals)));
};

/**
 * Floors a value up to an amount of decimals and returns it.
 * @param value
 * @param decimals
 * @returns {number}
 */
tools.prototype.floor = function floor(value, decimals) {
  // Shift
  value = value.toString().split('e');
  value = Math.floor(+(value[0] + 'e' + (value[1] ? (+value[1] + decimals) : decimals)));
  // Shift back
  value = value.toString().split('e');
  return Number((value[0] + 'e' + (value[1] ? (+value[1] - decimals) : -decimals)));
};

/**
 * Converts a range to a complete array and returns it.
 * @param {Array} range Array is defined as [incrementDecimals, startValue, endValue].
 * @returns {Array}
 */
tools.prototype.rangeToArray = function rangeToArray(range) {

  var result = [];
  var increment = this.floor(1 / Math.pow(10,range[0]), range[0]);

  for(var i = range[1]; i <= range[2]; i = this.round(i + increment,range[0])) {
    result.push(i);
  }

  return result;

};

/**
 * Run a specified function at a specified interval and at the exact start of that interval and returns a function to cancel the interval.
 * @param ms
 * @param func
 * @returns {Function} Function to cancel the set interval.
 */
tools.prototype.runEvery = function runEvery(ms, func) {

  var timeout;

  var loopFunc = function() {

    var now = new Date().getTime();
    var next = (now - (now % ms) + ms) - now;

    timeout = setTimeout(func, next);

  };

  loopFunc();

  var interval = setInterval(loopFunc, ms);

  return function() {
    clearInterval(interval);
    clearTimeout(timeout);
  };

};

var utiltools = new tools();

module.exports = utiltools;
