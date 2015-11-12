var util = require('util');
var _ = require('underscore');
var tools = require('../util/tools.js');
var async = require('async');

var agent = function(tradingEnabled, exchangeSettings, storage, exchangeapi, logger) {

	_.bindAll(this, 'order', 'calculateOrder', 'placeRealOrder', 'placeSimulatedOrder', 'processOrder');

	this.tradingEnabled = tradingEnabled;
	this.currencyPair = exchangeSettings.currencyPair;
	this.tradingReserveAsset = exchangeSettings.tradingReserveAsset;
	this.tradingReserveCurrency = exchangeSettings.tradingReserveCurrency;
	this.slippagePercentage = exchangeSettings.slippagePercentage;

	this.storage = storage;
	this.exchangeapi = exchangeapi;
	this.logger = logger;

};

//---EventEmitter Setup;
var EventEmitter = require('events').EventEmitter;
util.inherits(agent, EventEmitter);
//---EventEmitter Setup

agent.prototype.order = function(orderType) {

	this.orderDetails = {};

	this.orderDetails.orderType = orderType;

	var process = function (err, result) {

		this.calculateOrder(result);

		if(this.tradingEnabled) {
			this.placeRealOrder();
		} else {
			this.placeSimulatedOrder();
		}

	}.bind(this);

	var simulate = function() {

		async.series(
			{
				balance: function(cb) {cb(null, {assetAvailable: this.simulationBalance.assetAvailable, currencyAvailable: this.simulationBalance.currencyAvailable, fee: this.simulationBalance.fee});}.bind(this),
				orderBook: function(cb) {this.exchangeapi.getOrderBook(true, cb);}.bind(this),
				lastClose: function(cb) {this.storage.getLastClose(cb);}.bind(this)
			},
			process.bind(this)
		);

	}.bind(this);

  this.logger.line();

	if(this.tradingEnabled) {

		async.series(
			{
				balance: function(cb) {this.exchangeapi.getBalance(true, cb);}.bind(this),
				orderBook: function(cb) {this.exchangeapi.getOrderBook(true, cb);}.bind(this),
				lastClose: function(cb) {this.storage.getLastClose(cb);}.bind(this)
			},
			process.bind(this)
		);

	} else {

		if(!this.simulationBalance) {

			this.exchangeapi.getBalance(true, function(err, result) {

				this.simulationBalance = {assetAvailable: result.assetAvailable, currencyAvailable: result.currencyAvailable, fee: result.fee};

				simulate();

			}.bind(this));

		} else {

			simulate();

		}

	}

};

agent.prototype.calculateOrder = function(result) {

	this.orderDetails.assetAvailable = parseFloat(result.balance.assetAvailable);
	this.orderDetails.currencyAvailable = parseFloat(result.balance.currencyAvailable);
	this.orderDetails.transactionFee = parseFloat(result.balance.fee);

	var orderBook = result.orderBook;

	var lastClose = result.lastClose;
	var assetBalanceInCurrency = this.orderDetails.assetAvailable * lastClose;
  this.orderDetails.totalCurrencyBalance = tools.round(this.orderDetails.currencyAvailable + assetBalanceInCurrency, 8);

	this.logger.debug(util.format(
		'Preparing to place a %s order!',
		this.orderDetails.orderType));

	this.logger.log(util.format(
		'Balance: %s %d, %s %d | Total in %s: %d | Trading Fee: %d %%',
		this.currencyPair.asset, this.orderDetails.assetAvailable, this.currencyPair.currency, this.orderDetails.currencyAvailable, this.currencyPair.currency, this.orderDetails.totalCurrencyBalance, this.orderDetails.transactionFee
	));

	if(this.orderDetails.orderType === 'buy') {

		var lowestAsk = lastClose;

		var lowestAskWithSlippage = tools.round(lowestAsk * (1 + (this.slippagePercentage / 100)), 8);
		var balance = (this.orderDetails.currencyAvailable - this.tradingReserveCurrency) * (1 - (this.orderDetails.transactionFee / 100));

		this.logger.debug('Lowest Ask: ' + lowestAsk + ' Lowest Ask With Slippage: ' + lowestAskWithSlippage);

		this.orderDetails.price = lowestAskWithSlippage;
		this.orderDetails.amount = tools.floor(balance / this.orderDetails.price, 8);

		this.simulationBalance = {assetAvailable: tools.round(this.orderDetails.assetAvailable +  this.orderDetails.amount,8), currencyAvailable: 0, fee: this.orderDetails.transactionFee};

	} else if(this.orderDetails.orderType === 'sell') {

		var highestBid = lastClose;

		var highestBidWithSlippage = tools.round(highestBid * (1 - (this.slippagePercentage / 100)), 8);

		this.logger.debug('Highest Bid: ' + highestBid + ' Highest Bid With Slippage: ' + highestBidWithSlippage);

		this.orderDetails.price = highestBidWithSlippage;
		this.orderDetails.amount = tools.round(this.orderDetails.assetAvailable - this.tradingReserveAsset, 8);

		this.simulationBalance = {assetAvailable: 0, currencyAvailable: tools.round(this.orderDetails.currencyAvailable + (this.orderDetails.amount * this.orderDetails.price), 8), fee: this.orderDetails.transactionFee};

	}

	this.orderDetails.simulationBalance = this.simulationBalance;

};

agent.prototype.placeRealOrder = function() {

	if(this.orderDetails.amount <= 0) {

		this.logger.log('Insufficient funds to place an order.');

	} else {

		this.exchangeapi.placeOrder(this.orderDetails.orderType, this.orderDetails.amount, this.orderDetails.price, true, this.processOrder);

	}

};

agent.prototype.placeSimulatedOrder = function() {

	if(this.orderDetails.amount <= 0) {

		this.logger.log('Insufficient funds to place an order.');
		this.logger.line();

	} else {

		this.orderDetails.order = 'simulated';

		this.orderDetails.status = 'filled';

		this.logger.log(util.format(
			'Placed simulated order: %s %d @ %d',
			this.orderDetails.orderType, this.orderDetails.amount, this.orderDetails.price
		));

		this.emit('simulatedOrder', this.orderDetails);

	}

};

agent.prototype.processOrder = function(err, order) {

	if(!order) {

		this.logger.log('Something went wrong when placing the ' + this.orderDetails.orderType + ' order.');
		this.logger.line();

	} else {

		this.orderDetails.order = order.txid;

		this.orderDetails.status = order.status;

		this.logger.log(util.format(
			'Placed order %s: %s %d @ %d',
			this.orderDetails.order, this.orderDetails.orderType, this.orderDetails.amount, this.orderDetails.price
		));

		this.emit('realOrder', this.orderDetails);

	}

};

module.exports = agent;
