import { describe, it, expect } from "vitest";
import { validateImageQuality } from "../../gemini/validation/ImageQualityValidator";

// Basic mocks of JPEG and PNG header bytes base64 encoded
const mockPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUHNgUKAhYFBzS5egAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUrAAAALklEQVQYV2P8//8/AxgwMjJgE4IpRpdg+I/LJCwKkCSwKkBSgC6B3E9wV+DSDwC5LxsF8z4H4wAAAABJRU5ErkJggg=="; // valid base64 but very small size

// Generate a large dummy payload to bypass size check
const makeDummyPng = (width: number, height: number, size = 20000): string => {
  const bytes = new Uint8Array(size);
  // PNG signature
  bytes[0] = 0x89; bytes[1] = 0x50; bytes[2] = 0x4E; bytes[3] = 0x47;
  bytes[4] = 0x0D; bytes[5] = 0x0A; bytes[6] = 0x1A; bytes[7] = 0x0A;
  // IHDR chunk: width is at 16, height at 20
  bytes[12] = 0x49; bytes[13] = 0x48; bytes[14] = 0x44; bytes[15] = 0x52;
  bytes[16] = (width >> 24) & 0xff;
  bytes[17] = (width >> 16) & 0xff;
  bytes[18] = (width >> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >> 24) & 0xff;
  bytes[21] = (height >> 16) & 0xff;
  bytes[22] = (height >> 8) & 0xff;
  bytes[23] = height & 0xff;

  // Add random data to bypass contrast check
  for (let i = 100; i < size; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  // Convert to base64
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:image/png;base64," + btoa(binary);
};

describe("Deterministic Image Quality Validator", () => {
  it("should fail validation if image file size is too small", () => {
    const result = validateImageQuality(mockPngBase64);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("file size is too small");
  });

  it("should fail if resolution is under 800x600 pixels", () => {
    const smallPng = makeDummyPng(400, 300, 25000);
    const result = validateImageQuality(smallPng);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("resolution is too low");
  });

  it("should succeed for a valid PNG image of sufficient size and resolution", () => {
    const validPng = makeDummyPng(1024, 768, 30000);
    const result = validateImageQuality(validPng);
    // Since we put random noise, contrast and brightness should fall in standard ranges
    expect(result.isValid).toBe(true);
    expect(result.resolution).toEqual({ width: 1024, height: 768 });
  });

  it("should detect washed out/all white images", () => {
    // Generate white bytes (all 255)
    const bytes = new Uint8Array(20000);
    bytes[0] = 0x89; bytes[1] = 0x50; bytes[2] = 0x4E; bytes[3] = 0x47;
    // Dimensions 1000x1000
    bytes[18] = 0x03; bytes[19] = 0xE8; bytes[22] = 0x03; bytes[23] = 0xE8;
    for (let i = 24; i < bytes.length; i++) {
      bytes[i] = 255;
    }
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const result = validateImageQuality("data:image/png;base64," + btoa(binary));
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("too bright") || e.includes("low contrast"))).toBe(true);
  });
});
