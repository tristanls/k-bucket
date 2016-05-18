'use strict'
var test = require('tape')
var KBucket = require('../')

test('adding a contact does not split K-bucket', function (t) {
  var kBucket = new KBucket()
  kBucket.add({ id: new Buffer('a') })
  t.false(kBucket.low)
  t.false(kBucket.high)
  t.true(kBucket.bucket)
  t.end()
})

test('adding maximum number of contacts (per K-bucket) [20] into K-bucket does not split K-bucket', function (t) {
  var kBucket = new KBucket()
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket; ++i) {
    kBucket.add({ id: new Buffer('' + i) })
  }
  t.false(kBucket.low)
  t.false(kBucket.high)
  t.true(kBucket.bucket)
  t.end()
})

test('adding maximum number of contacts (per K-bucket) + 1 [21] into K-bucket splits the K-bucket', function (t) {
  var kBucket = new KBucket()
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket + 1; ++i) {
    kBucket.add({ id: new Buffer('' + i) })
  }
  t.true(kBucket.low instanceof KBucket)
  t.true(kBucket.high instanceof KBucket)
  t.false(kBucket.bucket)
  t.end()
})

test('split buckets inherit options from parent bucket', function (t) {
  var OPTIONS = ['arbiter', 'localNodeId', 'root', 'numberOfNodesPerKBucket', 'numberOfNodesToPing']
  t.plan(OPTIONS.length * 2)
  var kBucket = new KBucket()
  var _options = {}
  OPTIONS.forEach(function (option) { _options[option] = kBucket[option] })
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket + 1; ++i) {
    kBucket.add({ id: new Buffer('' + i) })
  }
  OPTIONS.forEach(function (option) {
    t.same(kBucket.low[option], _options[option])
    t.same(kBucket.high[option], _options[option])
  })
  t.end()
})

test('split buckets contain all added contacts', function (t) {
  t.plan(20 /* numberOfNodesPerKBucket */ + 2)
  var kBucket = new KBucket({ localNodeId: new Buffer([ 0x00 ]) })
  var foundContact = {}
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket + 1; ++i) {
    kBucket.add({ id: new Buffer([ i ]) })
    foundContact[i] = false
  }
  var traverse = function (node) {
    if (!node.bucket) {
      traverse(node.low)
      traverse(node.high)
    } else {
      node.bucket.forEach(function (contact) {
        foundContact[parseInt(contact.id.toString('hex'), 16)] = true
      })
    }
  }
  traverse(kBucket)
  Object.keys(foundContact).forEach(function (key) { t.true(foundContact[key], key) })
  t.false(kBucket.bucket)
  t.end()
})

test('when splitting buckets the "far away" bucket should be marked to prevent splitting "far away" bucket', function (t) {
  t.plan(5)
  var kBucket = new KBucket({ localNodeId: new Buffer([ 0x00 ]) })
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket + 1; ++i) {
    kBucket.add({ id: new Buffer([ i ]) })
  }
  // above algorithm will split low bucket 4 times and put 0x00 through 0x0f
  // in the low bucket, and put 0x10 through 0x14 in high bucket
  // since localNodeId is 0x00, we expect every high bucket to be "far" and
  // therefore marked as "dontSplit = true"
  // there will be one "low" bucket and four "high" buckets (t.expect(5))
  var traverse = function (node, dontSplit) {
    if (!node.bucket) {
      traverse(node.low, false)
      traverse(node.high, true)
    } else {
      if (dontSplit) t.true(node.dontSplit)
      else t.false(node.dontSplit)
    }
  }
  traverse(kBucket)
  t.end()
})
