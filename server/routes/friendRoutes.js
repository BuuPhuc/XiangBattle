const express = require('express')
const { requireAuth } = require('../middleware/authMiddleware')
const {
  getFriends,
  getOnlineFriends,
  getReceivedRequests,
  getSentRequests,
  getRelationshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
} = require('../controllers/friendController')

const router = express.Router()

// Literal paths ('/requests/received', '/requests/sent') are registered
// ahead of anything with a :userId param — same ordering reason
// userRoutes.js documents for its own '/me' vs '/:userId' split, though
// here it only matters for readability since every param route below uses
// a different HTTP method or path depth than these GETs.
router.get('/', requireAuth, getFriends)
router.get('/online', requireAuth, getOnlineFriends)
router.get('/requests/received', requireAuth, getReceivedRequests)
router.get('/requests/sent', requireAuth, getSentRequests)
router.get('/status/:userId', requireAuth, getRelationshipStatus)

router.post('/requests/:userId', requireAuth, sendFriendRequest)
router.patch('/requests/:userId/accept', requireAuth, acceptFriendRequest)
router.patch('/requests/:userId/reject', requireAuth, rejectFriendRequest)
router.delete('/requests/:userId', requireAuth, cancelFriendRequest)

router.delete('/:userId', requireAuth, removeFriend)

module.exports = router
