var _ = require('underscore');
var tools = require('../util/tools.js');
var moment = require('moment');
var async = require('async');

var simulator = function(exchangeSettings, backTesterSettings, indicatorSettings, advisor, logger){

  this.logger = logger;

  this.options = {};

  this.options.exchange = exchangeSettings.exchange;
  this.options.asset = exchangeSettings.currencyPair.asset;
  this.options.currency = exchangeSettings.currencyPair.currency;
  this.options.slippagePercentage = exchangeSettings.slippagePercentage;
  this.options.initialAssetBalance = backTesterSettings.initialAssetBalance;
  this.options.initialCurrencyBalance = backTesterSettings.initialCurrencyBalance;
  this.options.candleStickSizeMinutes = indicatorSettings.candleStickSizeMinutes;

  this.advisor = advisor;

  // Set Variables
  this.options.currencyBalance = this.options.initialCurrencyBalance;
  this.options.assetBalance = this.options.initialAssetBalance;
  this.options.initialBalanceSumInAsset = 0;
  this.options.initialBalanceSumInCurrency = 0;
  this.options.totalBalanceInCurrency = 0;
  this.options.totalBalanceInAsset = 0;
  this.options.profit = 0;
  this.options.profitPercentage = 0;
  this.options.profitAfterFees = 0;
  this.options.profitPercentageAfterFees = 0;
  this.options.bhProfit = 0;
  this.options.bhProfitPercentage = 0;
  this.options.transactionFee = 0;
  this.options.totalTradedVolume = 0;
  this.options.highestCurrencyValue = this.options.initialCurrencyBalance;
  this.options.lowestCurrencyValue = this.options.initialCurrencyBalance;
  this.options.totalFeeCosts = 0;
  this.options.totalFeeCostsPercentage = 0;
  this.options.latestCandlePeriod;
  this.options.lastClose = 0;
  this.options.lastClosePlusSlippage = 0;
  this.options.lastCloseMinusSlippage = 0;
  this.options.csPeriod = 0;
  this.options.entryCurrency = 0;
  this.options.exitCurrency = 0;
  this.options.winners = 0;
  this.options.losers = 0;
  this.options.bigWinner = 0;
  this.options.bigLoser = 0;
  this.options.totalGain = 0;
  this.options.totalLoss = 0;
  this.options.averageGain = 0;
  this.options.averageLoss = 0;
  this.options.transactions = [];
  // Set Variables

  _.bindAll(this, 'calculate', 'postProcess', 'createOrder', 'report');

};

simulator.prototype.calculate = function(csArray, transactionFee, indicatorSettings, callback) {

  // Set Variables
  this.options.currencyBalance = this.options.initialCurrencyBalance;
  this.options.assetBalance = this.options.initialAssetBalance;
  this.options.totalFeeCosts = 0;
  this.options.transactionFee = 0;
  this.options.totalTradedVolume = 0;
  this.options.highestCurrencyValue = this.options.initialCurrencyBalance;
  this.options.lowestCurrencyValue = this.options.initialCurrencyBalance;
  this.options.winners = 0;
  this.options.losers = 0;
  this.options.bigWinner = 0;
  this.options.bigLoser = 0;
  this.options.totalGain = 0;
  this.options.totalLoss = 0;
  this.options.transactions = [];
  this.indicatorSettings = indicatorSettings;
  // Set Variables

  this.options.transactionFee = transactionFee;

  this.options.initialBalanceSumInAsset = this.options.assetBalance + tools.round(this.options.currencyBalance / _.first(csArray).close, 8);
  this.options.initialBalanceSumInCurrency = this.options.currencyBalance + tools.round(this.options.assetBalance * _.first(csArray).close, 8);

  this.options.firstCs = _.first(csArray);
  this.options.lastCs = _.last(csArray);

  _.each(csArray, function(cs) {

    this.options.latestCandlePeriod = cs.period;

    this.options.lastClose = cs.close;

    var result = this.advisor.update(cs);

    if (result.advice !== 'hold') {
      this.createOrder(result.advice);
    }

  }.bind(this));

  this.postProcess();
  callback(this.options);

};

simulator.prototype.postProcess = function() {

  this.options.totalBalanceInCurrency = tools.round(this.options.currencyBalance + (this.options.assetBalance * this.options.lastClose), 8);
  this.options.totalBalanceInAsset = tools.round(this.options.assetBalance + (this.options.currencyBalance / this.options.lastClose), 8);
  this.options.profit = tools.round(this.options.totalBalanceInCurrency - this.options.initialBalanceSumInCurrency, 8);
  this.options.profitAfterFees = tools.round(this.options.totalBalanceInCurrency - this.options.initialBalanceSumInCurrency - this.options.totalFeeCosts, 8);
  this.options.profitPercentage = tools.round(this.options.profit / this.options.initialBalanceSumInCurrency * 100, 8);
  this.options.profitPercentageAfterFees = tools.round(this.options.profitAfterFees / this.options.initialBalanceSumInCurrency * 100, 8);
  this.options.totalFeeCostsPercentage = tools.round(this.options.totalFeeCosts / this.options.initialBalanceSumInCurrency * 100, 8);
  this.options.bhProfit = tools.round((this.options.lastCs.close - this.options.firstCs.open) * this.options.initialBalanceSumInAsset, 8);
  this.options.bhProfitPercentage = tools.round(this.options.bhProfit / this.options.initialBalanceSumInCurrency * 100, 8);

  if(this.options.totalBalanceInCurrency > this.options.highestCurrencyValue) {
    this.options.highestCurrencyValue = this.options.totalBalanceInCurrency;
  }

  this.options.startDate = moment(new Date(this.options.firstCs.period*1000)).format('DD-MM-YYYY HH:mm:ss');
  this.options.endDate = moment(new Date(this.options.lastCs.period*1000)).format('DD-MM-YYYY HH:mm:ss');

  this.options.openPrice = this.options.firstCs.open;
  this.options.closePrice = this.options.lastCs.close;

  this.options.averageGain = tools.round(this.options.totalGain / this.options.winners, 8);
  this.options.averageLoss = tools.round(this.options.totalLoss / this.options.losers, 8);

  return this.options;

};

simulator.prototype.createOrder = function(type) {

  if(type === 'buy' && this.options.currencyBalance > 0) {

    this.options.entryCurrency = this.options.currencyBalance;

    this.options.usableBalance = tools.round(this.options.currencyBalance * (1 - (this.options.transactionFee / 100)), 8);

    this.options.lastClosePlusSlippage = tools.round(this.options.lastClose * (1 + (this.options.slippagePercentage / 100)), 8);

    this.options.totalTradedVolume = tools.round(this.options.totalTradedVolume + this.options.usableBalance, 8);

    this.options.totalFeeCosts = tools.round(this.options.totalFeeCosts + (this.options.currencyBalance * (this.options.transactionFee / 100)), 8);

    this.options.assetBalance = tools.round(this.options.assetBalance + (this.options.usableBalance / this.options.lastClosePlusSlippage), 8);
    this.options.currencyBalance = 0;

    this.options.newcurrencyBalance = tools.round(this.options.assetBalance * this.options.lastClosePlusSlippage, 8);

    if(this.options.newcurrencyBalance > this.options.highestCurrencyValue) {
      this.options.highestCurrencyValue = this.options.newcurrencyBalance;
    } else if(this.options.newcurrencyBalance < this.options.lowestCurrencyValue) {
      this.options.lowestCurrencyValue = this.options.newcurrencyBalance;
    }

    this.options.transactions.push(new Date(this.options.latestCandlePeriod * 1000) + ' Placed buy order ' + this.options.assetBalance + ' @ ' + this.options.lastClosePlusSlippage);

    this.advisor.setPosition({pos: 'bought', price: this.options.lastClosePlusSlippage});

  } else if(type === 'sell' && this.options.assetBalance > 0) {

    this.options.usableBalance = tools.round(this.options.assetBalance * (1 - (this.options.transactionFee / 100)), 8);

    this.options.lastCloseMinusSlippage = tools.round(this.options.lastClose * (1 - (this.options.slippagePercentage / 100)), 8);

    this.options.totalTradedVolume = tools.round(this.options.totalTradedVolume + (this.options.usableBalance * this.options.lastCloseMinusSlippage), 8);

    this.options.totalFeeCosts = tools.round(this.options.totalFeeCosts + (this.options.assetBalance * (this.options.transactionFee / 100) * this.options.lastCloseMinusSlippage), 8);

    this.options.currencyBalance = tools.round(this.options.currencyBalance + (this.options.usableBalance * this.options.lastCloseMinusSlippage), 8);
    this.options.assetBalance = 0;

    if(this.options.currencyBalance > this.options.highestCurrencyValue) {
      this.options.highestCurrencyValue = this.options.currencyBalance;
    } else if(this.options.currencyBalance < this.options.lowestCurrencyValue) {
      this.options.lowestCurrencyValue = this.options.currencyBalance;
    }

    this.options.exitCurrency = this.options.currencyBalance;

    if(this.options.entryCurrency > 0) {

      this.options.tradeResult = tools.round(this.options.exitCurrency - this.options.entryCurrency, 8);

      if(this.options.exitCurrency > this.options.entryCurrency) {
        this.options.winners += 1;
        this.options.totalGain = tools.round(this.options.totalGain + this.options.tradeResult, 8);
        if(this.options.tradeResult > this.options.bigWinner) {this.options.bigWinner = this.options.tradeResult;}
      } else {
        this.options.losers += 1;
        this.options.totalLoss = tools.round(this.options.totalLoss + this.options.tradeResult, 8);
        if(this.options.tradeResult < this.options.bigLoser) {this.options.bigLoser = this.options.tradeResult;}
      }

    }

    this.options.transactions.push(new Date(this.options.latestCandlePeriod * 1000) + ' Placed sell order ' + this.options.usableBalance + ' @ ' + this.options.lastCloseMinusSlippage);

    this.advisor.setPosition({pos: 'sold', price: this.options.lastCloseMinusSlippage});

  }

};

simulator.prototype.report = function() {

  this.options.transactions.forEach(function(transaction) {
    this.logger.log(transaction);
  }.bind(this));

  this.logger.log('---------------Report---------------');
  this.logger.log('Exchange: ' + this.options.exchange);
  this.logger.log('Transaction Fee: ' + this.options.transactionFee + '%');
  this.logger.log('Initial ' + this.options.asset + ' Balance: ' + this.options.initialAssetBalance);
  this.logger.log('Initial ' + this.options.currency + ' Balance: ' + this.options.initialCurrencyBalance);
  this.logger.log('Final ' + this.options.asset + ' Balance: ' + this.options.assetBalance);
  this.logger.log('Final ' + this.options.currency + ' Balance: ' + this.options.currencyBalance);
  this.logger.log('Total Initial Balance in ' + this.options.currency + ': ' + this.options.initialBalanceSumInCurrency);
  this.logger.log('Total Initial Balance in ' + this.options.asset + ': ' + this.options.initialBalanceSumInAsset);
  this.logger.log('Total Final Balance in ' + this.options.currency + ': ' + this.options.totalBalanceInCurrency);
  this.logger.log('Total Final Balance in ' + this.options.asset + ': ' + this.options.totalBalanceInAsset);
  this.logger.log('Winning trades : ' + this.options.winners + ' Losing trades: ' + this.options.losers);
  this.logger.log('Biggest winner: ' + this.options.bigWinner + ' Biggest loser: ' + this.options.bigLoser);
  this.logger.log('Average winner: ' + this.options.averageGain + ' Average loser: ' + this.options.averageLoss);
  this.logger.log('Profit: ' + this.options.profit + ' (' + this.options.profitPercentage + '%)');
  this.logger.log('Profit after fees: ' + this.options.profitAfterFees + ' (' + this.options.profitPercentageAfterFees + '%)');
  this.logger.log('Buy and Hold Profit: ' + this.options.bhProfit + ' (' + this.options.bhProfitPercentage + '%)');
  this.logger.log('Lost on fees: ' + this.options.totalFeeCosts + ' (' + this.options.totalFeeCostsPercentage + '%)');
  this.logger.log('Total traded volue: ' + this.options.totalTradedVolume);
  this.logger.log('Highest - Lowest ' + this.options.currency + ' Balance: ' + this.options.highestCurrencyValue + ' - ' + this.options.lowestCurrencyValue);
  this.logger.log('Open Price: ' + this.options.openPrice);
  this.logger.log('Close Price: ' + this.options.closePrice);
  this.logger.log('Start - End Date: ' + this.options.startDate + ' - ' + this.options.endDate);
  this.logger.log('Transactions: ' + this.options.transactions.length);
  this.logger.log('------------------------------------');

};

module.exports = simulator;
