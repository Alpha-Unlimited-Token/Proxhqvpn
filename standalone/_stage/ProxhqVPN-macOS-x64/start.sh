#!/bin/bash
cd "$(dirname "$0")"
./ProxhqVPN &
sleep 1
open http://localhost:7474
wait
