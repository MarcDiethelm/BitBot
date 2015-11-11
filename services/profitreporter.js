var _ = require('underscore');
var tools = require('../util/tools.js');
var async = require('async');

var reporter = function(currencyPair, storage, exchangeapi, logger) {

  this.currencyPair = currencyPair;
  this.storage = storage;
  this.exchangeapi = exchangeapi;
  this.logger = logger;

  this.currencyBalance = 0;
  this.assetBalance = 0;

  _.bindAll(this, 'initialize', 'createReport', 'processBalance', 'start', 'updateBalance');

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(reporter, EventEmitter);
//---EventEmitter Setup

reporter.prototype.initialize = function(err, result) {

  var currencyBalance = parseFloat(result.balance.currencyAvailable);
  var assetBalance = tools.round(parseFloat(result.balance.assetAvailable), 8);

  var highestBid = _.first(result.orderBook.bids).currencyPrice;
  var assetBalanceInCurrency = assetBalance * highestBid;

  this.initalTotalCurrencyBalance = tools.round(currencyBalance + assetBalanceInCurrency, 8);

  this.storage.setInitialBalance(this.initalTotalCurrencyBalance, function(err) {

    if(err) {

      this.logger.error('Couldn\'t get initialBalance due to a database error');
      this.logger.error(err.stack);

      process.exit();

    }

  }.bind(this));

};

reporter.prototype.createReport = function() {

  var report = this.currencyPair.asset + ': ' + this.assetBalance + ' ' + this.currencyPair.currency + ': ' + this.currencyBalance + ' Total in ' + this.currencyPair.currency + ': ' + this.totalCurrencyBalance + ' Profit: ' + this.profitAbsolute + ' (' + this.profitPercentage + '%)';

  this.logger.log('Profit Report: ' + report);
  this.logger.line();

  this.emit('report', report);

};

reporter.prototype.processBalance = function(err, result, includeReport, order) {

  this.currencyBalance = parseFloat(result.balance.currencyAvailable);
  this.assetBalance = tools.round(parseFloat(result.balance.assetAvailable), 8);

  var highestBid = _.first(result.orderBook.bids).currencyPrice;
  var assetBalanceInCurrency = this.assetBalance * highestBid;

  this.totalCurrencyBalance = tools.round(this.currencyBalance + assetBalanceInCurrency, 8);
  this.profitAbsolute = tools.round(this.totalCurrencyBalance - this.initalTotalCurrencyBalance, 8);
  this.profitPercentage = tools.round((this.profitAbsolute / this.initalTotalCurrencyBalance) * 100, 8);

  if(includeReport) {
    this.createReport();
  }

};

reporter.prototype.start = function() {

  this.storage.getInitialBalance(function(err, result) {

    if(err) {

      this.logger.error('Couldn\'t get initialBalance due to a database error');
      this.logger.error(err.stack);

      process.exit();

    } else {

      if(result) {

        this.initialTotalCurrencyBalance = result.initialBalance;
        this.initialTotalCurrencyBalanceTimestamp = result.timestamp;

      } else {

        async.series(
          {
            balance: function(cb) {this.exchangeapi.getBalance(true, cb);}.bind(this),
            orderBook: function(cb) {this.exchangeapi.getOrderBook(true, cb);}.bind(this)
          },
          this.initialize
        );

      }

    }

  }.bind(this));

};

reporter.prototype.updateBalance = function(includeReport, order) {

  if(order.orderDetails.order != 'Simulated') {

    async.series(
        {
          balance: function (cb) {
            this.exchangeapi.getBalance(true, cb);
          }.bind(this),
          orderBook: function (cb) {
            this.exchangeapi.getOrderBook(true, cb);
          }.bind(this)
        },
        function (err, result) {
          this.processBalance(err, result, includeReport, order);
        }.bind(this)
    );

  } else {

    this.exchangeapi.getOrderBook(true, function(err, result) {

        this.processBalance(err, {balance: {currencyAvailable: order.orderDetails.simulationBalance.currencyAvailable, assetAvailable: order.orderDetails.simulationBalance.assetAvailable}, orderBook: result}, includeReport, order);

    }.bind(this));

  }

};

module.exports = reporter;
