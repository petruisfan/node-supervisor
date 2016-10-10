var logger = console.log;
var logs = "";
console.log = function(msg){
	// logger(msg);
	logs += msg;
};

var testScript = "test/fixture.js";
var supervisor = require('../lib/supervisor.js');

var assertValueExists = function(assertion, test){
	test.ok(assertion);
	test.done();
};

var tests = {
	tearDown: function testGroupOneTearDown(cb) {
		logs = "";
		console.log = logger;
		cb();
	},
	"should exist when supervisor is imported": function (test) {
		test.ok(!!supervisor);
		test.done();
	},
	"should accept a debug port when passed through": function (test) {
		var EXPECTED = '--debug=1234';
		var child = supervisor.run([EXPECTED, "--no-restart-on", "exit", "--", testScript]);
		try {
			assertValueExists(logs.indexOf(EXPECTED) > -1, test);
		} finally {
			child.kill();
		}
	},
	"should use debug alone when no port number passed through": function (test) {
		var EXPECTED = '--debug';
		var child = supervisor.run([EXPECTED, "--no-restart-on", "exit", "--", testScript]);
		try {
			assertValueExists(logs.indexOf(EXPECTED) > -1, test);
		} finally {
			child.kill();
		}
	},
	"should not overwrite with debug-brk value if debug-brk also passed through": function (test) {
		var EXPECTED = '--debug=1236';
		var child = supervisor.run([EXPECTED, "--debug-brk", "--no-restart-on", "exit", "--", testScript]);
		try {
			assertValueExists(logs.indexOf(EXPECTED) > -1, test);
		} finally {
			child.kill();
		}
	},
	"should pass the debug-brk flag through": function (test) {
		var EXPECTED = '--debug-brk';
		var child = supervisor.run([EXPECTED, "--no-restart-on", "exit", "--", testScript]);
		try {
			assertValueExists(logs.indexOf(EXPECTED) > -1, test);
		} finally {
			child.kill();
		}
	},
	"should pass the debug-brk port number arg through with debug-brk flag": function (test) {
		var EXPECTED = '--debug-brk=5859';
		var child = supervisor.run([EXPECTED, "--no-restart-on", "exit", "--", testScript]);
		try {
			assertValueExists(logs.indexOf(EXPECTED) > -1, test);
		} finally {
			child.kill();
		}
	}
};

module.exports.testGroupOne = tests;
