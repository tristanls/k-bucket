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

test['split buckets contain all added contacts'] = function (test) {
    test.expect(constants.DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET + 2);
    var kBucket = new KBucket();
    var foundContact = [];
    for (var i = 0; i < constants.DEFAULT_NUMBER_OF_NODES_PER_K_BUCKET + 1; i++) {
        kBucket.add({id: new Buffer("" + i)});
        foundContact[i] = false;
    }
    var traverse = function (node) {
        if (!node.bucket) {
            traverse(node.low);
            traverse(node.high);
        } else {
            node.bucket.forEach(function (contact) {
                foundContact[contact.id.toString()] = true;
            });
        }
    };
    traverse(kBucket);
    for (i = 0; i < foundContact.length; i++) {
        test.ok(foundContact[i]);
    }
    test.ok(!kBucket.bucket);
    test.done();
};