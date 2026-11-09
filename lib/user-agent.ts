// User-agent parsing for visit logging (see VisitLog in
// prisma/schema.prisma). Dependency-free on purpose: a small hand-rolled
// parser, no new package. Nothing here identifies a person: it only
// classifies the device class, the operating system and the browser
// (name + major version) from the user-agent string.

export type DeviceClass = "desktop" | "mobile" | "tablet";

/** Classify a user-agent into a device class; null when it says nothing. */
export function deviceFromUserAgent(ua: string | null): DeviceClass | null {
  if (!ua) return null;
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(lower)) return "tablet";
  if (/mobi|iphone|ipod|android|phone/.test(lower)) return "mobile";
  return "desktop";
}

/** Operating system from a user-agent, for example "Windows 10/11", "iOS 17.2" or "Android 14". Null when unknown. */
export function osFromUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  const win = ua.match(/Windows NT (\d+)\.(\d+)/);
  if (win) {
    const major = Number(win[1]);
    const minor = Number(win[2]);
    if (major === 10 && minor === 0) return "Windows 10/11";
    if (major === 6 && minor === 3) return "Windows 8.1";
    if (major === 6 && minor === 2) return "Windows 8";
    if (major === 6 && minor === 1) return "Windows 7";
    return `Windows NT ${major}.${minor}`;
  }
  if (/Windows Phone/.test(ua)) return "Windows Phone";
  const ios = ua.match(/iPhone OS (\d+)[_.](\d+)/) || ua.match(/CPU (?:iPhone )?OS (\d+)[_.](\d+)/);
  if (/iPhone|iPad|iPod/.test(ua)) {
    return ios ? `iOS ${ios[1]}.${ios[2]}` : "iOS";
  }
  const android = ua.match(/Android (\d+)(?:\.(\d+))?/);
  if (android) return android[2] ? `Android ${android[1]}.${android[2]}` : `Android ${android[1]}`;
  const mac = ua.match(/Mac OS X (\d+)[_.](\d+)(?:[_.](\d+))?/);
  if (mac) return `macOS ${mac[1]}.${mac[2]}${mac[3] ? `.${mac[3]}` : ""}`;
  if (/Macintosh/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

/** Browser name + major version from a user-agent, for example "Chrome 131" or "Safari 17.2". Null when unknown. */
export function browserFromUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  let m: RegExpMatchArray | null;
  // Edge (Chromium) first: its agent also contains "Chrome".
  m = ua.match(/Edg\/(\d+)/);
  if (m) return `Edge ${m[1]}`;
  m = ua.match(/EdgiOS\/(\d+)/);
  if (m) return `Edge ${m[1]}`;
  m = ua.match(/Edge\/(\d+)/);
  if (m) return `Edge ${m[1]}`;
  m = ua.match(/OPR\/(\d+)/);
  if (m) return `Opera ${m[1]}`;
  m = ua.match(/SamsungBrowser\/(\d+)/);
  if (m) return `Samsung Internet ${m[1]}`;
  m = ua.match(/CriOS\/(\d+)/);
  if (m) return `Chrome ${m[1]}`;
  m = ua.match(/FxiOS\/(\d+)/);
  if (m) return `Firefox ${m[1]}`;
  m = ua.match(/Firefox\/(\d+)/);
  if (m) return `Firefox ${m[1]}`;
  m = ua.match(/Chrome\/(\d+)/);
  if (m) return `Chrome ${m[1]}`;
  m = ua.match(/Version\/(\d+)(?:\.(\d+))?.*Safari\//);
  if (m && !/Chrome/.test(ua)) return m[2] ? `Safari ${m[1]}.${m[2]}` : `Safari ${m[1]}`;
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return null;
}

export type ParsedUserAgent = {
  device: DeviceClass | null;
  os: string | null;
  browser: string | null;
};

/** Full classification of a user-agent: device class, OS and browser. */
export function parseUserAgent(ua: string | null): ParsedUserAgent {
  return {
    device: deviceFromUserAgent(ua),
    os: osFromUserAgent(ua),
    browser: browserFromUserAgent(ua),
  };
}
