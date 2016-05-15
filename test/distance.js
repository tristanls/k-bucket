'use strict'
var KBucket = require('../index')

var test = module.exports = {}

test['distance between 00000000 and 00000000 is 00000000'] = function (test) {
  test.expect(1)
  test.equal(KBucket.distance(new Buffer([ 0x00 ]), new Buffer([ 0x00 ])), 0)
  test.done()
}

test['distance between 00000000 and 00000001 is 00000001'] = function (test) {
  test.expect(1)
  test.equal(KBucket.distance(new Buffer([ 0x00 ]), new Buffer([ 0x01 ])), 1)
  test.done()
}

test['distance between 00000010 and 00000001 is 00000011'] = function (test) {
  test.expect(1)
  test.equal(KBucket.distance(new Buffer([ 0x02 ]), new Buffer([ 0x01 ])), 3)
  test.done()
}

test['distance between 00000000 and 0000000000000000 is 0000000011111111'] = function (test) {
  test.expect(1)
  test.equal(KBucket.distance(new Buffer([ 0x00 ]), new Buffer([ 0x00, 0x00 ])), 255)
  test.done()
}

test['distance between 0000000100100100 and 0100000000100100 is 0100000100000000'] = function (test) {
  test.expect(1)
  test.equal(KBucket.distance(new Buffer([ 0x01, 0x24 ]), new Buffer([ 0x40, 0x24 ])), 16640)
  test.done()
}
