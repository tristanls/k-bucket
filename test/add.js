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