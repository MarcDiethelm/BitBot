var _ = require('underscore');
var winston = require('winston');
var fs = require('fs');
var tools = require('../util/tools');

var logger = function(app, debug, prefix) {

  if(prefix) {
    this.prefix = prefix + ': ';
  } else {
    this.prefix = '';
  }

  this.debugEnabled = debug;

  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
  }

  var myCustomLevels = {
    levels: {
      DEBUG: 0,
      INFO: 1,
      ERROR: 2
    }
  };

  var now = function() {
    var format = tools.formatDate(tools.now());

    return '[' + format + ']';
  };

  this.logger = new (winston.Logger)({
    levels: myCustomLevels.levels,
    transports: [
      new (winston.transports.Console)({
        'timestamp': now,
        level: 'INFO' }),
      new (winston.transports.DailyRotateFile)({
        'timestamp': now,
        datePattern: '_dd-MM-yyyy.log',
        filename: 'logs/' + app,
        level: 'DEBUG'})
    ]
  });

  _.bindAll(this, 'log', 'debug', 'error');

};

logger.prototype.log = function(message) {

  this.logger.log('INFO', this.prefix + message);

};

logger.prototype.debug = function(message) {

  if(this.debugEnabled) {

    this.logger.log('DEBUG', this.prefix + message);

  }

};

logger.prototype.error = function(message) {

  this.logger.log('ERROR', this.prefix + message);

};

logger.prototype.line = function() {

 this.logger.log('INFO', this.prefix + '----------------------------------------------------');

};

logger.prototype.logJson = function(value) {

  this.logger.log('INFO', '--------------Settings--------------');
  JSON.stringify(value, null, 2).split(/\n/).forEach(function(line){this.logger.log('INFO', line)}.bind(this));

};

module.exports = logger;
