#!/bin/sh

rsync -lrvuz . piraterad.io:/app/pirateradio --exclude '.git'
ssh piraterad.io "sudo chown -R root:pirateradio /app/pirateradio"
ssh piraterad.io "sudo chmod -R g+w /app/pirateradio"
ssh piraterad.io "sudo restart pirateradio.node"
