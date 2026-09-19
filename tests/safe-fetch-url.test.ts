import { describe, it, expect } from "vitest";
import { fetchUrlSafely, isPrivateIp, UnsafeUrlError } from "@/lib/security/safeFetchUrl";

describe("isPrivateIp", () => {
  it("herkent private/gereserveerde IPv4-ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true); // cloud metadata-endpoint
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("100.64.0.1")).toBe(true); // carrier-grade NAT
  });

  it("laat gewone publieke IPv4-adressen door", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false); // net buiten 172.16.0.0/12
    expect(isPrivateIp("172.15.255.255")).toBe(false);
  });

  it("herkent private/gereserveerde IPv6-ranges", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true); // IPv4-mapped
  });

  it("laat een publiek IPv6-adres door", () => {
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("wijst ongeldige input defensief af", () => {
    expect(isPrivateIp("niet-een-ip")).toBe(true);
  });
});

describe("fetchUrlSafely — SSRF-afwijzingen (geen netwerk nodig)", () => {
  it("wijst een niet-http(s)-scheme af", async () => {
    await expect(fetchUrlSafely("ftp://example.com/regeling.txt")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("wijst een ongeldige URL af", async () => {
    await expect(fetchUrlSafely("niet-een-url")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("wijst een URL met inloggegevens af", async () => {
    await expect(fetchUrlSafely("http://user:pass@example.com/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("wijst localhost af", async () => {
    await expect(fetchUrlSafely("http://localhost:3000/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("wijst een letterlijk privé IPv4-adres af (geen DNS nodig)", async () => {
    await expect(fetchUrlSafely("http://127.0.0.1/geheim")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(fetchUrlSafely("http://192.168.1.1/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("wijst het cloud-metadata-adres af", async () => {
    await expect(fetchUrlSafely("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  it("wijst een letterlijk privé IPv6-adres af", async () => {
    await expect(fetchUrlSafely("http://[::1]/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
