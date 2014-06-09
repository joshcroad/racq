'use strict';

var util = require('util'),
	should = require('should'),
	debug = require('debug')('messages'),
	Queue = require('../lib/queue');

describe('Messages operations', function() {
	var queueName = 'demoQueue' + Math.floor(Math.random() * 9000 + 1000),
		message = {
			ttl: 60,
			body: {myProperty: 'myValue'}
		},
		q,
		msgId;
	
	before(function(done) {
		var config = require('./testConfig'),
			tokenPath = __dirname + '/token.json';
		
		config.persistedTokenPath = tokenPath;
		q = new Queue(config);	
		q.authenticate(function(error) {
			if(!error) {
				q.createQueue(queueName, done);
			}
		});
	});

	it('should post message to queue ' + queueName, function(done) {
		q.postMessages(queueName, message, done);
	});

	it('should get messages from queue ' + queueName, function(done) {
		var options = {
			limit: 1,
			echo: true
		};
		q.getMessages(queueName, options, function(error, result) {
			debug(util.inspect(result, true, 3));
			should.not.exist(error);
			should.exist(result);
			result.messages[0].body.myProperty.should.eql(message.body.myProperty);
			msgId = result.messages[0].id;
			done();
		});
	});

	it('should get the message from queue ' + queueName, function(done) {
		debug(msgId);
		q.getMessagesById(queueName, msgId, function(error, result) {
			should.not.exist(error);
			should.exist(result);
			result.body.myProperty.should.eql(message.body.myProperty);
			done();
		});
	});
	
	it('should delete message from queue ' + queueName, function(done) {
		debug(msgId);
		q.deleteMessage(queueName, msgId, done);
	});

	it('should post 20 messages to queue ' + queueName + ' and read them back in 4 groups of 5 messages', function(done) {
		var async = require('async');
		async.series([
			function postMessages(callback) {
				//prepare 20 messages, in 2 arrays of 10 (maximum per one postMessages call)
				var msgs1 = [],
					msgs2 = [];
				for(var i = 0; i < 10; i++) {
					msgs1.push({ttl: 600, body: {number: i + 1}});
					msgs2.push({ttl: 600, body: {number: i + 11}});
				}
				//send the 2 arrays simultanously
				async.parallel([
					function(cb) {
						q.postMessages(queueName, msgs1, cb);
					},
					function(cb) {
						q.postMessages(queueName, msgs2, cb);
					}
				], callback);
			},
			function getMessages(callback) {
				var next = 1,
					messageCount = 0,
					sum = 0;
				async.doWhilst(
					function getMessages(cb) {
						var options = {
							limit: 5,
							echo: true,
							marker: next
						};
						q.getMessages(queueName, options, function(error, result) {
							if(error) {
								return cb(error);
							}
							else {
								//debug(util.inspect(result, true, 3));
								result.messages.forEach(function(message) {
									messageCount++;
									sum += parseInt(message.body.number); 
								});
								next = result.marker;
								debug('sum: %s, next marker: %s', sum, next);
								return cb(null);
							}
						});
					},
					function test() {
						//stop when we got the 20 messages
						return next !== '21';
					},
					function evaluate() {
						//success means we got all 20 messages and summed their values (1 + 2 + ... + 20 == 210)
						callback(messageCount === 20 && sum === 210 ? null : new Error('message count/sum does not match'));
					}
				);
			}
		], 
		done);
	});

	after(function(done) {
		q.deleteQueue(queueName, done);
	});
});