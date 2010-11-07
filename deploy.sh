#!/bin/sh

rsync -arvuz . piraterad.io:/app/pirateradio --exclude '.git'
ssh piraterad.io "sudo restart pirateradio.node"
