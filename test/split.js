"use strict";

var constants = require('../lib/constants.js'),
    KBucket = require('../index.js');

var test = module.exports = {};

test['adding a contact does not split K-bucket'] = function (test) {
    test.expect(3);
    var kBucket = new KBucket();
    kBucket.add({id: new Buffer("a")});
    test.ok(!kBucket.low);
    test.ok(!kBucket.high);
    test.ok(kBucket.bucket);
    test.done();
};

test['adding maximum number of contacts (per K-bucket) [' +
     constants.DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET + ']' +
     ' into K-bucket does not split K-bucket'] = function (test) {
    test.expect(3);
    var kBucket = new KBucket();
    for (var i = 0; i < constants.DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET; i++) {
        kBucket.add({id: new Buffer("" + i)});
    }
    test.ok(!kBucket.low);
    test.ok(!kBucket.high);
    test.ok(kBucket.bucket);
    test.done();
};

test['adding maximum number of contacts (per K-bucket) + 1 [' +
     (constants.DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET + 1) + ']' +
     ' into K-bucket splits the K-bucket'] = function (test) {
    test.expect(3);
    var kBucket = new KBucket();
    for (var i = 0; i < constants.DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET + 1; i++) {
        kBucket.add({id: new Buffer("" + i)});
    }
    test.ok(kBucket.low instanceof KBucket);
    test.ok(kBucket.high instanceof KBucket);
    test.ok(!kBucket.bucket);
    test.done();
};