#!/bin/bash

# Test deployment script - thin wrapper around deploy-clean.sh
export VAULT_PATH="$HOME/Documents/testvault/testvault"
exec ./deploy-clean.sh 