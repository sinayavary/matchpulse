import "dotenv/config";
import { getTxlineConfigFromEnv } from "@matchpulse/txline-client";

const config = getTxlineConfigFromEnv();

console.log("SignalCore worker booting...");
console.log({ network: config.network, serviceLevelId: config.serviceLevelId, apiOrigin: config.apiOrigin });
console.log("Mock mode is active. Implement TxLINE ingestion after devnet access is activated.");

let tick = 0;
setInterval(() => {
  tick += 1;
  console.log(
    JSON.stringify({
      worker: "SignalCore",
      mode: "mock",
      tick,
      status: "heartbeat",
      timestamp: new Date().toISOString()
    })
  );
}, 10_000);
