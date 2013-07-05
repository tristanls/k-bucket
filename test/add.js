"use strict";

var constants = require('../lib/constants.js'),
    KBucket = require('../index.js');

var test = module.exports = {};

test['adding a contact places it in bucket'] = function (test) {
    test.expect(1);
    var kBucket = new KBucket();
    var contact = {id: new Buffer("a")};
    kBucket.add(contact);
    test.ok(kBucket.bucket[0] === contact);
    test.done();
};

test['adding an existing contact does not increase number of contacts in ' +
     'bucket' ] = function (test) {
    test.expect(1);
    var kBucket = new KBucket();
    var contact = {id: new Buffer("a")};
    kBucket.add(contact);
    kBucket.add({id: new Buffer("a")});
    test.equal(kBucket.bucket.length, 1);
    test.done();
};

test['adding same contact moves it to the end of the bucket ' +
     '(most-recently-contacted end)'] = function (test) {
    test.expect(5);
    var kBucket = new KBucket();
    var contact = {id: new Buffer("a")};
    kBucket.add(contact);
    test.equal(kBucket.bucket.length, 1);
    kBucket.add({id: new Buffer("b")});
    test.equal(kBucket.bucket.length, 2);
    test.equal(kBucket.bucket[0], contact); // least-recently-contacted end
    kBucket.add(contact);
    test.equal(kBucket.bucket.length, 2);
    test.equal(kBucket.bucket[1], contact); // most-recently-contacted end
    test.done();
};