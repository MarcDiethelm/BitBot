var _ = require('underscore');

//------------------------------Config
var config = require('../config.js');
//------------------------------Config

var monitor = function(exchangeapi, logger) {

  this.exchangeapi = exchangeapi;
  this.logger = logger;

  _.bindAll(this, 'checkFilled', 'processCancellation', 'processSimulation', 'add', 'resolvePreviousOrder');

  this.checkOrder = {status: 'resolved'};

};

//---EventEmitter Setup
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(monitor, EventEmitter);
//---EventEmitter Setup

monitor.prototype.checkFilled = function(checkOrder, filled) {

  if(checkOrder.status !== 'filled') {

    if(filled) {

      checkOrder.status = 'filled';

      clearInterval(checkOrder.interval);
      clearTimeout(checkOrder.timeout);

      if (config.debug) {
        this.logger.log('Order (' + checkOrder.id + ') filled successfully!');
      }
      else {
        this.logger.log('Order filled successfully!');
      }


      this.emit('filled', checkOrder);

    }

  }

};

monitor.prototype.processCancellation = function(checkOrder, cancelled, retry) {

  if(cancelled && checkOrder.status !== 'cancelled') {

    checkOrder.status = 'cancelled';

    if (config.debug) {
      this.logger.debug('Order (' + checkOrder.id + ') cancelled!');
    }
    else {
      this.logger.debug('Order cancelled!');
    }

    this.emit('cancelled', checkOrder, retry);

  } else if(checkOrder.status !== 'filled') {

    checkOrder.status = 'filled';

    if (config.debug) {
      this.logger.log('Order (' + checkOrder.id + ') filled successfully!');
    }
    else {
      this.logger.log('Order filled successfully!');
    }


    this.emit('filled', checkOrder);

  }

};

monitor.prototype.processSimulation = function(checkOrder) {

  if (config.debug) {
    this.logger.log('Order (' + checkOrder.id + ') filled successfully!');
  }
  else {
    this.logger.log('Order filled successfully!');
  }


  checkOrder.status = 'filled';

  this.emit('filled', checkOrder);

};

monitor.prototype.add = function(orderDetails, cancelTime) {

  var wrapper = function() {

    this.checkOrder = {id: orderDetails.order, orderDetails: orderDetails, status: orderDetails.status};

    if (config.debug) {
      this.logger.log('Monitoring order (' + this.checkOrder.id + '): cancelling after ' + cancelTime + ' minutes)');
    }
    else {
      this.logger.log('Monitoring order for ' + cancelTime + ' min');
    }


    if(this.checkOrder.status === 'filled') {

      this.processSimulation(this.checkOrder);

    } else {

      this.checkOrder.interval = setInterval(function() {

        this.exchangeapi.orderFilled(this.checkOrder.id, false, function(err, response){
          if(!err) {
            this.checkFilled(this.checkOrder, response);
          }
        }.bind(this));

      }.bind(this), 1000 * 10);

      this.checkOrder.timeout = setTimeout(function() {

        clearInterval(this.checkOrder.interval);

        if(this.checkOrder.status === 'open') {

          if (config.debug) {
            this.logger.log('Cancelling order (' + this.checkOrder.id + ')');
          }
          else {
            this.logger.log('Cancelling order');
          }

          this.exchangeapi.cancelOrder(this.checkOrder.id, true, function(err, response) {
            this.processCancellation(this.checkOrder, response, true);
          }.bind(this));

        }

      }.bind(this), 1000 * 60 * cancelTime);

    }

  }.bind(this);

  this.resolvePreviousOrder(wrapper);

};

monitor.prototype.resolvePreviousOrder = function(cb) {

  if(this.checkOrder.status === 'open' && this.checkOrder.id !== 'simulated') {

    clearInterval(this.checkOrder.interval);
    clearTimeout(this.checkOrder.timeout);

    this.logger.log('Cancelling order: ' + this.checkOrder.id);

    this.exchangeapi.cancelOrder(this.checkOrder.id, true, function(err, response) {
      this.processCancellation(this.checkOrder, response, false);
      this.checkOrder.status = 'resolved';

      if (config.debug) {
        this.logger.log('Previous order (' + this.checkOrder.id + ') resolved!');
      }
      else {
        this.logger.log('Previous order resolved!');
      }
      cb();
    }.bind(this));

  } else {
    cb();
  }

};

module.exports = monitor;
