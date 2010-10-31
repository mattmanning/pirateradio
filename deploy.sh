#!/bin/sh

rsync -arvuz . david@piraterad.io:/app/pirateradio --exclude '.git'
ssh david@piraterad.io "sudo restart pirateradio.node"
