#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname postgres --set ON_ERROR_STOP=1 \
  --set orders_password="$ORDERS_DB_PASSWORD" \
  --set inventory_password="$INVENTORY_DB_PASSWORD" \
  --set fulfillment_password="$FULFILLMENT_DB_PASSWORD" <<'SQL'
CREATE ROLE catering_orders LOGIN CREATEDB PASSWORD :'orders_password';
CREATE ROLE catering_inventory LOGIN CREATEDB PASSWORD :'inventory_password';
CREATE ROLE catering_fulfillment LOGIN CREATEDB PASSWORD :'fulfillment_password';
CREATE DATABASE orders OWNER catering_orders;
CREATE DATABASE inventory OWNER catering_inventory;
CREATE DATABASE fulfillment OWNER catering_fulfillment;
SQL
