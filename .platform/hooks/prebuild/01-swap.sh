#!/bin/bash
# Elastic Beanstalk builds the Next.js image on the instance. A t3.micro
# has 1 GB of RAM, so that build is often killed while EC2 stays Running.
set -euo pipefail
if swapon --show | grep -q .; then
  exit 0
fi
if [ ! -f /swapfile ]; then
  if ! fallocate -l 2G /swapfile 2>/dev/null; then
    dd if=/dev/zero of=/swapfile bs=1M count=2048
  fi
  chmod 600 /swapfile
  mkswap /swapfile
fi
swapon /swapfile
