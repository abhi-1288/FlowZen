/**
 * ICE servers used for peer-to-peer interview calls.
 *
 * STUN alone connects roughly 85-90% of real-world calls. The remainder sit
 * behind symmetric NAT or a firewall that blocks UDP, and cannot be reached
 * without a TURN relay. Set the TURN variables to add one — no call code changes.
 */
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }

  return servers;
}

export const ICE_SERVERS: RTCIceServer[] = buildIceServers();

export const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 4,
  bundlePolicy: "max-bundle",
};
