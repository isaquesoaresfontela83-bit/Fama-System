# Fama Pool financial bridge

The existing authenticated `/api/pool-provider` bridge retains its restricted Asaas operations. Pool webhooks use the public `/api/pool-provider/webhook` ingress, with a dedicated `FAMA_POOL_WEBHOOK_TOKEN`. Only references beginning `pool:` are forwarded to the fixed private Pool webhook. `FAMA_POOL_SITE_SERVICE_TOKEN` is a Sites service credential for that exact destination; it supplies no user identity. Both values are server secrets, never browser values.

The Pool receiver independently verifies its webhook token, persists event identifiers, and consults the provider before changing any financial state. Failed deliveries return an error for provider retries. ERP events and other webhooks are preserved. The legacy private webhook can be migrated only when its existing URL exactly matches the Pool URL.

No real charge, transfer or refund is required for integration tests. Production money movement still requires an authorized user action in the Pool application. Rotate the forwarding token if the Pool service credential changes.
