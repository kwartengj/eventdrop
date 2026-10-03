import { describe, expect, it, vi } from "vitest";

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  return {
    ...actual,
    networkInterfaces: () => ({
      eth0: [{ address: "172.18.0.4", family: "IPv4", internal: false, netmask: "255.255.0.0", mac: "02:00:00:00:00:01", cidr: "172.18.0.4/16" }],
    }),
  };
});

import { advertiseOrigin } from "@/server/format";
import { runWithRequestStorage } from "@/server/storage/request-endpoint";

describe("share links on a public host", () => {
  it("uses the host the browser opened, without the local dev port", async () => {
    const previous = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = "http://localhost:3000";
    try {
      const req = new Request("http://eventdrop-env.eba-example.eu-north-1.elasticbeanstalk.com/", {
        headers: { host: "eventdrop-env.eba-example.eu-north-1.elasticbeanstalk.com" },
      });
      const origin = await runWithRequestStorage(req, async () => advertiseOrigin());
      expect(origin).toBe("http://eventdrop-env.eba-example.eu-north-1.elasticbeanstalk.com");
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_APP_URL;
      else process.env.PUBLIC_APP_URL = previous;
    }
  });

  it("keeps an explicit port from the browser", async () => {
    const previous = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = "http://localhost:3000";
    try {
      const req = new Request("http://192.168.1.20:3000/", { headers: { host: "192.168.1.20:3000" } });
      const origin = await runWithRequestStorage(req, async () => advertiseOrigin());
      expect(origin).toBe("http://192.168.1.20:3000");
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_APP_URL;
      else process.env.PUBLIC_APP_URL = previous;
    }
  });
});
