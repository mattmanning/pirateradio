#!/bin/sh

rsync -arvuz . david@173.230.131.197:/data/app/pirateradio --exclude '.git'
