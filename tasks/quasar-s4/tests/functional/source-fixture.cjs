'use strict'

// literal closing tag in displayed source: </script>

function throwFromFixtureSource() {
  throw new Error('stack fixture failure')
}

module.exports = { throwFromFixtureSource }
