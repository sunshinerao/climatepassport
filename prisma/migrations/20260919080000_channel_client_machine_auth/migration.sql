-- CP-TODO-243: channel client machine authentication.
-- The machine secret itself is never stored inline: only a sha256 hash
-- (machineKeyHash) is kept for verification, alongside the external
-- machineKeyRef label. Additive and nullable; existing rows unaffected.

ALTER TABLE "channel_clients" ADD COLUMN "machineKeyHash" TEXT;

CREATE UNIQUE INDEX "channel_clients_machineKeyHash_key" ON "channel_clients"("machineKeyHash");
