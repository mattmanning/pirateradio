#!/bin/sh

rsync -arvuz . david@piraterad.io:/app/pirateradio --exclude '.git'
