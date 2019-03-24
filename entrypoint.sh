#!/bin/sh

# start the redis server
echo "starting redis server"
redis-server redis.conf  # TODO: make this a service

./wait-for-it.sh localhost:6379 -t 120 -- echo 'redis server is reachable'

# start the jshtmltopdf server
echo "starting jshtmltopdf server"
PM2=./node_modules/.bin/pm2
$PM2 start --env production

#./wait-for-it.sh localhost:8080 -t 120 -- echo 'jshtmltopdf server is reachable'

#node cli.js "$@" && $PM2 stop jshtmltopdf

./idle.sh
