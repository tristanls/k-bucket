'use strict'
var KBucket = require('../index')

var test = module.exports = {}

test['id 00000000, bitIndex 0, should be low'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x00 ]), 0), -1)
  test.done()
}

test['id 01000000, bitIndex 0, should be low'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x40 ]), 0), -1)
  test.done()
}

test['id 01000000, bitIndex 1, should be high'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x40 ]), 1), 1)
  test.done()
}

test['id 01000000, bitIndex 2, should be low'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x40 ]), 2), -1)
  test.done()
}

test['id 01000000, bitIndex 9, should be low'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x40 ]), 9), -1)
  test.done()
}

test['id 01000001, bitIndex 7, should be high'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x41 ]), 7), 1)
  test.done()
}

test['id 0100000100000000, bitIndex 7, should be high'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x41, 0x00 ]), 7), 1)
  test.done()
}

test['id 000000000100000100000000, bitIndex 15, should be high'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  test.equal(kBucket._determineBucket(new Buffer([ 0x00, 0x41, 0x00 ]), 15), 1)
  test.done()
}
