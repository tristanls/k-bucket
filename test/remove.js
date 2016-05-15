'use strict'
var KBucket = require('../index')

var test = module.exports = {}

test['throws TypeError if contact.id is not a Buffer'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  var contact = { id: 'foo' }
  test.throws(function () {
    kBucket.remove(contact.id)
  }, TypeError)
  test.done()
}

test['removing a contact should remove contact from nested buckets'] = function (test) {
  test.expect(2)
  var kBucket = new KBucket({ localNodeId: new Buffer([ 0x00, 0x00 ]) })
  for (var i = 0; i < kBucket.numberOfNodesPerKBucket; ++i) {
    kBucket.add({ id: new Buffer([ 0x80, i ]) }) // make sure all go into "far away" bucket
  }
  // cause a split to happen
  kBucket.add({ id: new Buffer([ 0x00, i ]) })
  // console.log(require('util').inspect(kBucket, false, null))
  var contactToDelete = { id: new Buffer([ 0x80, 0x00 ]) }
  test.equal(kBucket.high._indexOf(contactToDelete.id), 0)
  kBucket.remove(new Buffer([ 0x80, 0x00 ]))
  test.equal(kBucket.high._indexOf(contactToDelete.id), -1)
  test.done()
}

test['should generate "removed"'] = function (test) {
  test.expect(1)
  var kBucket = new KBucket()
  var contact = { id: new Buffer('a') }
  kBucket.on('removed', function (removedContact) { test.deepEqual(removedContact, contact) })
  kBucket.add(contact)
  kBucket.remove(contact.id)
  test.done()
}
