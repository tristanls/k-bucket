'use strict'
var KBucket = require('../index')

var test = module.exports = {}

test['throws TypeError if contact.id is not a Buffer'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  var contact = { id: 'foo' }
  test.throws(function () {
    kBucket.closest(contact.id, 4)
  }, TypeError)
  test.done()
}

test['closest nodes are returned'] = function (test) {
  test.expect(3)
  var kBucket = new KBucket()
  for (var i = 0; i < 0x12; ++i) kBucket.add({ id: new Buffer([ i ]) })
  var contact = { id: new Buffer([ 0x15 ]) } // 00010101
  var contacts = kBucket.closest(contact.id, 3)
  test.deepEqual(contacts[0].id, new Buffer([ 0x11 ])) // distance: 00000100
  test.deepEqual(contacts[1].id, new Buffer([ 0x10 ])) // distance: 00000101
  test.deepEqual(contacts[2].id, new Buffer([ 0x05 ])) // distance: 00010000
  test.done()
}

test['closest nodes are returned (including exact match)'] = function (test) {
  test.expect(3)
  var kBucket = new KBucket()
  for (var i = 0; i < 0x12; ++i) kBucket.add({ id: new Buffer([ i ]) })
  var contact = {id: new Buffer([ 0x11 ])} // 00010001
  var contacts = kBucket.closest(contact.id, 3)
  test.deepEqual(contacts[0].id, new Buffer([ 0x11 ])) // distance: 00000000
  test.deepEqual(contacts[1].id, new Buffer([ 0x10 ])) // distance: 00000001
  test.deepEqual(contacts[2].id, new Buffer([ 0x01 ])) // distance: 00010000
  test.done()
}

test["closest nodes are returned even if there isn't enough in one bucket"] = function (test) {
  test.expect(22)
  var kBucket = new KBucket({ localNodeId: new Buffer([ 0x00, 0x00 ]) })
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket; i++) {
    kBucket.add({ id: new Buffer([ 0x80, i ]) })
    kBucket.add({ id: new Buffer([ 0x01, i ]) })
  }
  kBucket.add({ id: new Buffer([ 0x00, 0x01 ]) })
  var contact = { id: new Buffer([ 0x00, 0x03 ]) } // 0000000000000011
  var contacts = kBucket.closest(contact.id, 22)
  test.deepEqual(contacts[0].id, new Buffer([ 0x00, 0x01 ])) // distance: 0000000000000010
  test.deepEqual(contacts[1].id, new Buffer([ 0x01, 0x03 ])) // distance: 0000000100000000
  test.deepEqual(contacts[2].id, new Buffer([ 0x01, 0x02 ])) // distance: 0000000100000010
  test.deepEqual(contacts[3].id, new Buffer([ 0x01, 0x01 ]))
  test.deepEqual(contacts[4].id, new Buffer([ 0x01, 0x00 ]))
  test.deepEqual(contacts[5].id, new Buffer([ 0x01, 0x07 ]))
  test.deepEqual(contacts[6].id, new Buffer([ 0x01, 0x06 ]))
  test.deepEqual(contacts[7].id, new Buffer([ 0x01, 0x05 ]))
  test.deepEqual(contacts[8].id, new Buffer([ 0x01, 0x04 ]))
  test.deepEqual(contacts[9].id, new Buffer([ 0x01, 0x0b ]))
  test.deepEqual(contacts[10].id, new Buffer([ 0x01, 0x0a ]))
  test.deepEqual(contacts[11].id, new Buffer([ 0x01, 0x09 ]))
  test.deepEqual(contacts[12].id, new Buffer([ 0x01, 0x08 ]))
  test.deepEqual(contacts[13].id, new Buffer([ 0x01, 0x0f ]))
  test.deepEqual(contacts[14].id, new Buffer([ 0x01, 0x0e ]))
  test.deepEqual(contacts[15].id, new Buffer([ 0x01, 0x0d ]))
  test.deepEqual(contacts[16].id, new Buffer([ 0x01, 0x0c ]))
  test.deepEqual(contacts[17].id, new Buffer([ 0x01, 0x13 ]))
  test.deepEqual(contacts[18].id, new Buffer([ 0x01, 0x12 ]))
  test.deepEqual(contacts[19].id, new Buffer([ 0x01, 0x11 ]))
  test.deepEqual(contacts[20].id, new Buffer([ 0x01, 0x10 ]))
  test.deepEqual(contacts[21].id, new Buffer([ 0x80, 0x03 ])) // distance: 1000000000000000
  // console.log(require('util').inspect(kBucket, false, null))
  test.done()
}
