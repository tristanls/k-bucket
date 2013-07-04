"use strict";

var KBucket = require('../index.js');

var test = module.exports = {};

test['localNodeId should be a random SHA-1 if not provided'] = function (test) {
    test.expect(2);
    var kBucket = new KBucket();
    test.ok(kBucket.localNodeId instanceof Buffer);
    test.equal(kBucket.localNodeId.length, 20); // SHA-1 is 160 bits (20 bytes)
    test.done();
};

test['localNodeId is populated from options if options.localNodeId Buffer is provided'] = function (test) {
    var localNodeId = new Buffer("some length");
    test.expect(2);
    var kBucket = new KBucket({localNodeId: localNodeId});
    test.ok(kBucket.localNodeId instanceof Buffer);
    test.equal(kBucket.localNodeId, localNodeId);
    test.done();
};