require('dotenv/config')
// This package ships as ESM — required from CommonJS, the factory function
// lands on `.default` rather than being the module itself.
const postgres = require('@prisma/orm-postgres/runtime').default
const contractJson = require('./contract.json')

const db = postgres({
  contractJson,
  url: process.env.DATABASE_URL,
})

module.exports = { db }
