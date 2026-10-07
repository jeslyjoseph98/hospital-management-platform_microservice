#!/usr/bin/env bash
# Initiates the single-node replica set "rs0" on the "mongo" service, once it
# is actually reachable under that hostname (see docker-compose.yml comment
# on the mongo-rs-init service for why this can't run as a normal
# /docker-entrypoint-initdb.d script).
set -euo pipefail

until mongosh --host mongo --port 27017 --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; do
  echo "waiting for mongod..."
  sleep 2
done

mongosh --host mongo --port 27017 --quiet --eval '
  try {
    rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "mongo:27017" } ] });
    print("replica set initiated");
  } catch (e) {
    if (e.codeName === "AlreadyInitialized") {
      print("replica set already initialized");
    } else {
      throw e;
    }
  }
'
