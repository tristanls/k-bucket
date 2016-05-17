'use strict'
var test = require('tape')
var KBucket = require('../')

test('throws TypeError if contact.id is not a Buffer', function (t) {
  var kBucket = new KBucket()
  var contact = { id: 'foo' }
  t.throws(function () {
    kBucket.closest(contact.id, 4)
  })
  t.end()
})

test('closest nodes are returned', function (t) {
  var kBucket = new KBucket()
  for (var i = 0; i < 0x12; ++i) kBucket.add({ id: new Buffer([ i ]) })
  var contact = { id: new Buffer([ 0x15 ]) } // 00010101
  var contacts = kBucket.closest(contact.id, 3)
  t.same(contacts[0].id, new Buffer([ 0x11 ])) // distance: 00000100
  t.same(contacts[1].id, new Buffer([ 0x10 ])) // distance: 00000101
  t.same(contacts[2].id, new Buffer([ 0x05 ])) // distance: 00010000
  t.end()
})

test('closest nodes are returned (including exact match)', function (t) {
  var kBucket = new KBucket()
  for (var i = 0; i < 0x12; ++i) kBucket.add({ id: new Buffer([ i ]) })
  var contact = { id: new Buffer([ 0x11 ]) } // 00010001
  var contacts = kBucket.closest(contact.id, 3)
  t.same(contacts[0].id, new Buffer([ 0x11 ])) // distance: 00000000
  t.same(contacts[1].id, new Buffer([ 0x10 ])) // distance: 00000001
  t.same(contacts[2].id, new Buffer([ 0x01 ])) // distance: 00010000
  t.end()
})

test('closest nodes are returned even if there isn\'t enough in one bucket', function (t) {
  var kBucket = new KBucket({ localNodeId: new Buffer([ 0x00, 0x00 ]) })
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket; i++) {
    kBucket.add({ id: new Buffer([ 0x80, i ]) })
    kBucket.add({ id: new Buffer([ 0x01, i ]) })
  }
  kBucket.add({ id: new Buffer([ 0x00, 0x01 ]) })
  var contact = { id: new Buffer([ 0x00, 0x03 ]) } // 0000000000000011
  var contacts = kBucket.closest(contact.id, 22)
  t.same(contacts[0].id, new Buffer([ 0x00, 0x01 ])) // distance: 0000000000000010
  t.same(contacts[1].id, new Buffer([ 0x01, 0x03 ])) // distance: 0000000100000000
  t.same(contacts[2].id, new Buffer([ 0x01, 0x02 ])) // distance: 0000000100000010
  t.same(contacts[3].id, new Buffer([ 0x01, 0x01 ]))
  t.same(contacts[4].id, new Buffer([ 0x01, 0x00 ]))
  t.same(contacts[5].id, new Buffer([ 0x01, 0x07 ]))
  t.same(contacts[6].id, new Buffer([ 0x01, 0x06 ]))
  t.same(contacts[7].id, new Buffer([ 0x01, 0x05 ]))
  t.same(contacts[8].id, new Buffer([ 0x01, 0x04 ]))
  t.same(contacts[9].id, new Buffer([ 0x01, 0x0b ]))
  t.same(contacts[10].id, new Buffer([ 0x01, 0x0a ]))
  t.same(contacts[11].id, new Buffer([ 0x01, 0x09 ]))
  t.same(contacts[12].id, new Buffer([ 0x01, 0x08 ]))
  t.same(contacts[13].id, new Buffer([ 0x01, 0x0f ]))
  t.same(contacts[14].id, new Buffer([ 0x01, 0x0e ]))
  t.same(contacts[15].id, new Buffer([ 0x01, 0x0d ]))
  t.same(contacts[16].id, new Buffer([ 0x01, 0x0c ]))
  t.same(contacts[17].id, new Buffer([ 0x01, 0x13 ]))
  t.same(contacts[18].id, new Buffer([ 0x01, 0x12 ]))
  t.same(contacts[19].id, new Buffer([ 0x01, 0x11 ]))
  t.same(contacts[20].id, new Buffer([ 0x01, 0x10 ]))
  t.same(contacts[21].id, new Buffer([ 0x80, 0x03 ])) // distance: 1000000000000000
  // console.log(require('util').inspect(kBucket, false, null))
  t.end()
})
