var _ = require('underscore');

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

      this.logger.log('Order (' + checkOrder.id + ') filled successfully!');

      this.emit('filled', checkOrder);

    }

  }

};

monitor.prototype.processCancellation = function(checkOrder, cancelled, retry) {

  if(cancelled && checkOrder.status !== 'cancelled') {

    checkOrder.status = 'cancelled';

    this.logger.log('Order (' + checkOrder.id + ') cancelled!');

    this.emit('cancelled', checkOrder, retry);

  } else if(checkOrder.status !== 'filled') {

    checkOrder.status = 'filled';

    this.logger.log('Order (' + checkOrder.id + ') filled successfully!');

    this.emit('filled', checkOrder);

  }

};

monitor.prototype.processSimulation = function(checkOrder) {

  this.logger.log('Order (' + checkOrder.id + ') filled successfully!');

  checkOrder.status = 'filled';

  this.emit('filled', checkOrder);

};

monitor.prototype.add = function(orderDetails, cancelTime) {

  var wrapper = function() {

    this.checkOrder = {id: orderDetails.order, orderDetails: orderDetails, status: orderDetails.status};

    this.logger.log('Monitoring order: ' + this.checkOrder.id + ' (Cancellation after ' + cancelTime + ' minutes)');

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

          this.logger.log('Cancelling order: ' + this.checkOrder.id);

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

  if(this.checkOrder.status === 'open' && this.checkOrder.id !== 'Simulated') {

    clearInterval(this.checkOrder.interval);
    clearTimeout(this.checkOrder.timeout);

    this.logger.log('Cancelling order: ' + this.checkOrder.id);

    this.exchangeapi.cancelOrder(this.checkOrder.id, true, function(err, response) {
      this.processCancellation(this.checkOrder, response, false);
      this.checkOrder.status = 'resolved';
      this.logger.log('Previous order (' + this.checkOrder.id + ') resolved!');
      cb();
    }.bind(this));

  } else {
    cb();
  }

};

module.exports = monitor;
