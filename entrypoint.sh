#!/bin/sh

# start the redis server
echo "starting redis server"
redis-server redis.conf  # TODO: make this a service

./wait-for-it.sh localhost:6379 -t 120 -- echo 'redis server is reachable'

# start the jshtmltopdf server
echo "starting jshtmltopdf server"
node server.js &  # TODO: replace with pm2

./wait-for-it.sh localhost:8080 -t 120 -- echo 'jshtmltopdf server is reachable'

node client.js "$@"
