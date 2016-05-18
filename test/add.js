'use strict'
var test = require('tape')
var KBucket = require('../')

test('throws TypeError if contact.id is not a Buffer', function (t) {
  var kBucket = new KBucket()
  var contact = { id: 'foo' }
  t.throws(function () {
    kBucket.add(contact)
  })
  t.end()
})

test('adding a contact places it in bucket', function (t) {
  var kBucket = new KBucket()
  var contact = { id: new Buffer('a') }
  kBucket.add(contact)
  t.true(kBucket.bucket[0] === contact)
  t.end()
})

test('adding an existing contact does not increase number of contacts in bucket', function (t) {
  var kBucket = new KBucket()
  var contact = { id: new Buffer('a') }
  kBucket.add(contact)
  kBucket.add({ id: new Buffer('a') })
  t.same(kBucket.bucket.length, 1)
  t.end()
})

test('adding same contact moves it to the end of the bucket (most-recently-contacted end)', function (t) {
  var kBucket = new KBucket()
  var contact = { id: new Buffer('a') }
  kBucket.add(contact)
  t.same(kBucket.bucket.length, 1)
  kBucket.add({ id: new Buffer('b') })
  t.same(kBucket.bucket.length, 2)
  t.true(kBucket.bucket[0] === contact) // least-recently-contacted end
  kBucket.add(contact)
  t.same(kBucket.bucket.length, 2)
  t.true(kBucket.bucket[1] === contact) // most-recently-contacted end
  t.end()
})

test('adding contact to bucket that can\'t be split results in calling "ping" callback', function (t) {
  t.plan(3 /* numberOfNodesToPing */ + 2)
  var kBucket = new KBucket({ localNodeId: new Buffer([ 0x00, 0x00 ]) })
  kBucket.on('ping', function (contacts, replacement) {
    t.same(contacts.length, kBucket.numberOfNodesToPing)
    // console.dir(kBucket.high.bucket[0])
    for (var i = 0; i < kBucket.numberOfNodesToPing; ++i) {
      // the least recently contacted end of the bucket should be pinged
      t.true(contacts[i] === kBucket.high.bucket[i])
    }
    t.same(replacement, { id: new Buffer([ 0x80, j ]) })
    t.end()
  })
  for (var j = 0; j < kBucket.numberOfNodesPerKBucket + 1; ++j) {
    kBucket.add({ id: new Buffer([ 0x80, j ]) }) // make sure all go into "far away" bucket
  }
})

test('should generate event "added" once', function (t) {
  t.plan(1)
  var kBucket = new KBucket()
  var contact = { id: new Buffer('a') }
  kBucket.on('added', function (newContact) {
    t.same(newContact, contact)
  })
  kBucket.add(contact)
  kBucket.add(contact)
  t.end()
})

test('should generate event "added" when adding to a split bucket', function (t) {
  t.plan(2)
  var kBucket = new KBucket({
    localNodeId: new Buffer('') // need non-random localNodeId for deterministic splits
  })
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket + 1; ++i) {
    kBucket.add({ id: new Buffer('' + i) })
  }
  t.false(kBucket.bucket)
  var contact = { id: new Buffer('a') }
  kBucket.on('added', function (newContact) {
    t.same(newContact, contact)
  })
  kBucket.add(contact)
  t.end()
})
