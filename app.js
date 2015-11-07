var _ = require('underscore');
var cluster = require('cluster');

var loggingservice = require('./services/loggingservice.js');

//------------------------------Config
var config = require('./config');
var packageJson = require('./package');
//------------------------------Config

var app = function() {

  _.bindAll(this, 'appListener', 'launchTrader', 'launchBacktester', 'launchGa', 'initializeModules', 'start');

};

app.prototype.appListener = function() {

  this.app.on('done', function() {
    this.logger.log('App closed.');
  }.bind(this));

};

app.prototype.launchTrader = function() {

  this.logger.log('Launching trader module.');
  this.logger.log('----------------------------------------------------');
  this.app = require('./apps/trader.js');
  this.appListener();
  this.app.start();

};

app.prototype.launchBacktester = function() {

  this.logger.log('Launching backtester module.');
  this.logger.log('----------------------------------------------------');
  this.app = require('./apps/backtester.js');
  this.appListener();
  this.app.start();

};

app.prototype.launchGa = function() {

  this.logger.log('Launching ga module.');
  this.logger.log('----------------------------------------------------');
  this.app = require('./apps/ga.js');
  this.appListener();
  this.app.start();

};

app.prototype.launchReset = function(collection) {

  this.logger.log('Launching ga module.');
  this.logger.log('----------------------------------------------------');
  this.app = require('./apps/reset.js');
  this.appListener();
  this.app.start(collection);

};

app.prototype.initializeModules = function(appName) {

  this.logger = new loggingservice(appName, config.debug);

};

app.prototype.start = function() {

  var argument = process.argv[2];

  if(!argument) {
    this.appName = 'trader';
    this.run = this.launchTrader;
  } else {
    if(argument === '-b') {
      this.appName = 'backtester';
      this.run = this.launchBacktester;
    } else if(argument === '-g') {
      this.appName = 'ga';
      this.run = this.launchGa;
    } else if(argument === '-rb') {
      this.appName = 'reset';
      this.run = function() {
        this.launchReset('balance');
      }.bind(this);
    } else if(argument === '-ro') {
      this.appName = 'reset';
      this.run = function() {
        this.launchReset('bestOrganism');
      }.bind(this);
    } else {
      this.appName = 'app';
      run = null;
    }
  }

  this.initializeModules(this.appName);

  //------------------------------AnnounceStart
  this.logger.log('----------------------------------------------------');
  this.logger.log('Starting BitBot v' + packageJson.version);
  this.logger.log('Real trading enabled = ' + config.tradingEnabled);
  this.logger.log('Candle stick size = ' + config.indicatorSettings.candleStickSizeMinutes + ' min');
  this.logger.log('----------------------------------------------------');
  //------------------------------AnnounceStart

  if(this.run) {
    this.run();
  } else {
    this.logger.log('Invalid argument, supported options:');
    this.logger.log('-b: Launch Backtester');
    this.logger.log('-rb: Reset balance');
  }

};

var application = new app();

application.start();
